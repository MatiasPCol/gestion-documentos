-- Avisos por correo de documentos por vencer, enviados con Resend (https://resend.com).
-- Requisito: guardar la llave de Resend en Vault, desde el SQL Editor de Supabase:
--   select vault.create_secret('re_TU_LLAVE', 'resend_api_key');
-- Con el remitente onboarding@resend.dev, Resend solo entrega al correo con el que se creó la cuenta,
-- así que la cuenta de Resend debe usar el mismo correo del administrador.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

create function public.html_esc(texto text) returns text
language sql immutable set search_path = public as $$
  select replace(replace(replace(coalesce(texto, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;');
$$;

-- Envía el correo a todos los administradores.
-- Sin p_prueba solo avisa en los días clave (30, 15, 7, 3, 1, 0 y -1) y los lunes manda el resumen completo.
create function public.enviar_avisos(p_prueba boolean default false) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_marca constant text := 'Gestión de Documentos';
  v_panel constant text := 'https://gestion-documentos-qr.vercel.app/admin.html';
  v_hoy date := (now() at time zone 'America/Bogota')::date;
  v_lunes boolean := extract(isodow from v_hoy) = 1;
  v_llave text;
  v_para text[];
  v_total int;
  v_filas text;
  v_asunto text;
  v_html text;
  v_id bigint;
begin
  select decrypted_secret into v_llave from vault.decrypted_secrets where name = 'resend_api_key';
  if v_llave is null then
    return 'Falta guardar la llave de Resend en Vault (resend_api_key).';
  end if;

  select array_agg(u.email order by u.email) into v_para
  from public.admins a join auth.users u on u.id = a.user_id
  where u.email is not null;
  if v_para is null then
    return 'No hay administradores a quién avisar.';
  end if;

  with docs as (
    select n.nombre, d.tipo, d.fecha_vencimiento, d.fecha_vencimiento - v_hoy as dias
    from public.documentos d
    join public.negocios n on n.id = d.negocio_id
    where n.activo
      and d.fecha_vencimiento is not null
      and d.fecha_vencimiento - v_hoy <= 30
      and (p_prueba or v_lunes or d.fecha_vencimiento - v_hoy in (30, 15, 7, 3, 1, 0, -1))
  )
  select count(*),
         string_agg(format(
           '<tr><td style="padding:8px;border-bottom:1px solid #ddd">%s</td><td style="padding:8px;border-bottom:1px solid #ddd">%s</td><td style="padding:8px;border-bottom:1px solid #ddd">%s</td><td style="padding:8px;border-bottom:1px solid #ddd;color:%s;font-weight:bold">%s</td></tr>',
           html_esc(nombre), html_esc(tipo), to_char(fecha_vencimiento, 'DD/MM/YYYY'),
           case when dias < 0 then '#b3261e' else '#9a6200' end,
           case when dias < 0 then format('Venció hace %s día%s', -dias, case when dias = -1 then '' else 's' end)
                when dias = 0 then 'Vence hoy'
                else format('Vence en %s día%s', dias, case when dias = 1 then '' else 's' end) end
         ), '' order by dias)
  into v_total, v_filas
  from docs;

  if v_total = 0 and not p_prueba then
    return 'Hoy no hay nada que avisar.';
  end if;

  v_asunto := case
    when v_total = 0 then format('Prueba de avisos · %s', v_marca)
    when v_total = 1 then format('1 documento por vencer · %s', v_marca)
    else format('%s documentos por vencer · %s', v_total, v_marca) end;

  v_html := format(
    '<div style="font-family:Arial,sans-serif;color:#1c2333;max-width:640px">'
    '<h2 style="margin:0 0 8px">%s</h2>'
    '<p style="margin:0 0 16px">%s</p>'
    '%s'
    '<p style="margin:20px 0"><a href="%s" style="background:#1f5fd1;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Abrir el panel</a></p>'
    '<p style="color:#5d6679;font-size:12px">Aviso automático de %s.</p></div>',
    html_esc(v_marca),
    case when v_total = 0 then 'Los avisos por correo funcionan. Ahora mismo no hay documentos por vencer en los próximos 30 días.'
         when v_lunes and not p_prueba then 'Resumen semanal: documentos vencidos o que vencen en los próximos 30 días.'
         else 'Estos documentos necesitan atención:' end,
    case when v_total = 0 then ''
         else '<table style="border-collapse:collapse;width:100%;font-size:14px"><tr style="text-align:left;background:#eef1f6">'
              '<th style="padding:8px">Negocio</th><th style="padding:8px">Documento</th><th style="padding:8px">Vence</th><th style="padding:8px">Estado</th></tr>'
              || v_filas || '</table>' end,
    v_panel, html_esc(v_marca));

  select net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_llave, 'Content-Type', 'application/json'),
    body := jsonb_build_object(
      'from', v_marca || ' <onboarding@resend.dev>',
      'to', to_jsonb(v_para),
      'subject', v_asunto,
      'html', v_html)
  ) into v_id;

  return format('Correo enviado a %s con %s documento(s).', array_to_string(v_para, ', '), v_total);
end;
$$;

revoke all on function public.enviar_avisos(boolean) from public, anon, authenticated;

-- Botón "Enviar correo de prueba" del panel: solo para administradores.
create function public.probar_avisos() returns text
language plpgsql security definer set search_path = public as $$
begin
  if not public.es_admin() then
    raise exception 'Solo los administradores pueden probar los avisos';
  end if;
  return public.enviar_avisos(true);
end;
$$;

revoke all on function public.probar_avisos() from public, anon;
grant execute on function public.probar_avisos() to authenticated;

-- Todos los días a las 7:00 a. m. de Colombia (12:00 UTC).
select cron.schedule('avisos-vencimiento', '0 12 * * *', $$select public.enviar_avisos()$$);
