-- Esquema de Gestión de Documentos.
-- Solo los administradores (tabla admins) pueden ver y editar negocios y documentos.
-- El público (la alcaldía que escanea el QR) solo ve el estado mediante estado_negocio().

create extension if not exists pgcrypto;

create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  creado_en timestamptz not null default now()
);

create table public.negocios (
  id uuid primary key default gen_random_uuid(),
  -- Código del QR: aleatorio para que nadie pueda adivinar los de otros negocios.
  codigo text not null unique default encode(gen_random_bytes(9), 'hex'),
  nombre text not null,
  nit text,
  actividad text,
  direccion text,
  propietario text,
  telefono text,
  email text,
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

create table public.documentos (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios (id) on delete cascade,
  tipo text not null,
  numero text,
  fecha_expedicion date,
  fecha_vencimiento date, -- null = no vence
  archivo_path text,
  notas text,
  actualizado_en timestamptz not null default now()
);

create index documentos_negocio_id_idx on public.documentos (negocio_id);

create function public.es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

revoke all on function public.es_admin() from public;
grant execute on function public.es_admin() to authenticated;

create function public.tocar_actualizado() returns trigger
language plpgsql set search_path = public as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$;

create trigger documentos_actualizado
  before update on public.documentos
  for each row execute function public.tocar_actualizado();

alter table public.admins enable row level security;
alter table public.negocios enable row level security;
alter table public.documentos enable row level security;

create policy "admins se ven" on public.admins
  for select to authenticated using (public.es_admin());

create policy "admins manejan negocios" on public.negocios
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

create policy "admins manejan documentos" on public.documentos
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

-- Lo que ve quien escanea el QR: solo datos públicos del negocio y fechas de sus documentos.
create function public.estado_negocio(p_codigo text) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'nombre', n.nombre,
    'actividad', n.actividad,
    'direccion', n.direccion,
    'documentos', coalesce((
      select json_agg(json_build_object(
        'tipo', d.tipo,
        'fecha_vencimiento', d.fecha_vencimiento,
        'actualizado_en', d.actualizado_en
      ) order by d.tipo)
      from public.documentos d
      where d.negocio_id = n.id
    ), '[]'::json)
  )
  from public.negocios n
  where n.codigo = p_codigo and n.activo;
$$;

revoke all on function public.estado_negocio(text) from public;
grant execute on function public.estado_negocio(text) to anon, authenticated;

-- Archivos de los documentos: privados, solo para administradores.
insert into storage.buckets (id, name, public)
values ('documentos', 'documentos', false)
on conflict (id) do nothing;

create policy "admins manejan archivos" on storage.objects
  for all to authenticated
  using (bucket_id = 'documentos' and public.es_admin())
  with check (bucket_id = 'documentos' and public.es_admin());
