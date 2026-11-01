-- Reglas de validación en la base de datos.
-- Son las mismas de validarNegocio() y validarDocumento() en js/comun.js, pero aquí no se pueden saltar
-- aunque alguien llame a Supabase sin pasar por el panel.
-- "not valid" hace que las reglas apliquen a lo nuevo y a lo que se edite, sin fallar por datos viejos.

alter table public.negocios
  add constraint negocios_nombre_largo check (char_length(btrim(nombre)) between 2 and 120) not valid,
  add constraint negocios_nit_formato check (nit is null or nit ~ '^\d{1,3}(\.?\d{3}){1,4}(-\d)?$') not valid,
  add constraint negocios_actividad_largo check (char_length(actividad) <= 80) not valid,
  add constraint negocios_direccion_largo check (char_length(direccion) <= 150) not valid,
  add constraint negocios_propietario_largo check (char_length(propietario) <= 100) not valid,
  add constraint negocios_telefono_formato check (telefono is null or telefono ~ '^(57)?3\d{9}$') not valid,
  add constraint negocios_email_formato check (email is null or (char_length(email) <= 120 and email ~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$')) not valid;

alter table public.documentos
  add constraint documentos_tipo_largo check (char_length(btrim(tipo)) between 2 and 100) not valid,
  add constraint documentos_numero_largo check (char_length(numero) <= 50) not valid,
  add constraint documentos_notas_largo check (char_length(notas) <= 500) not valid,
  add constraint documentos_fechas_orden check (
    fecha_expedicion is null or fecha_vencimiento is null or fecha_vencimiento >= fecha_expedicion
  ) not valid,
  add constraint documentos_fechas_rango check (
    (fecha_expedicion is null or fecha_expedicion between '1950-01-01' and '2100-12-31')
    and (fecha_vencimiento is null or fecha_vencimiento between '1950-01-01' and '2100-12-31')
  ) not valid;

-- Archivos: máximo 10 MB y solo PDF o fotos.
update storage.buckets
set file_size_limit = 10 * 1024 * 1024,
    allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic']
where id = 'documentos';
