-- Negocio de ejemplo con un documento en cada estado.
-- Las fechas son relativas a hoy para que siempre se vean los cuatro estados.

with nuevo as (
  insert into public.negocios (nombre, nit, actividad, direccion, propietario, telefono, email)
  values ('Negocio X', '900.000.000-0', 'Tienda de barrio', 'Calle 00 # 00-00, Pereira',
          'Propietario de ejemplo', '3000000000', 'negociox@ejemplo.com')
  returning id
)
insert into public.documentos (negocio_id, tipo, numero, fecha_expedicion, fecha_vencimiento, notas)
select id, tipo, numero, expedicion, vencimiento, notas
from nuevo, (values
  ('Matrícula mercantil (Cámara de Comercio)', 'MM-000001', current_date - 200, current_date + 160, 'Se renueva cada año antes del 31 de marzo'),
  ('RUT', '900000000', current_date - 400, null::date, 'No vence'),
  ('Uso del suelo', 'US-000123', current_date - 300, null::date, null),
  ('Certificado de bomberos', 'CB-2026-0456', current_date - 353, current_date + 12, 'Por vencer: avisar al cliente'),
  ('Concepto sanitario', 'CS-0789', current_date - 385, current_date - 20, 'Vencido'),
  ('Sayco Acinpro', 'SA-2026-111', current_date - 300, current_date + 65, 'Solo si el local pone música')
) as d (tipo, numero, expedicion, vencimiento, notas);
