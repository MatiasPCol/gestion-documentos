# Gestión de Documentos

Plataforma para tener al día los documentos de los negocios (matrícula mercantil, bomberos, concepto sanitario, uso del suelo, etc.). Cada negocio recibe un **QR**: cuando llega la alcaldía, lo escanea y ve qué documentos están vigentes, por vencer o vencidos.

En vivo: https://gestion-documentos-qr.netlify.app (Netlify publica solo cada push a `main`).

## Páginas

| Página | Para quién | Qué hace |
| --- | --- | --- |
| `admin.html` | El administrador | Crear negocios, cargar documentos con su fecha de vencimiento, subir archivos, renovar, imprimir el QR y avisar por WhatsApp lo que se vence. |
| `negocio.html?c=<código>` | Quien escanea el QR | Muestra el estado de los documentos del negocio. No muestra archivos ni datos privados. |
| `negocio.html?c=demo` | Para mostrar la plataforma | Ejemplo con el Negocio X, sin base de datos. Trae una simulación: el visitante cambia fechas o agrega documentos y ve cómo cambia la página. Nada se guarda. |

## Estados

- **Vigente:** vence en más de 30 días.
- **Por vencer:** vence en 30 días o menos (se cambia en `DIAS_AVISO`).
- **Vencido:** la fecha ya pasó.
- **No vence:** el documento no tiene fecha de vencimiento.

## Configuración

1. Crear un proyecto en Supabase y ejecutar `supabase/esquema.sql` y luego `supabase/validaciones.sql` (reglas de formato y largo de los datos, y límite de 10 MB para archivos). `supabase/negocio-x.sql` carga el negocio de ejemplo.
2. Poner la URL y la llave pública del proyecto en `js/config.js`. `BRAND` es el nombre que ven los clientes.
3. Crear el usuario administrador en Supabase (Authentication → Users → Add user) y darle permiso:
   `insert into admins (user_id) select id from auth.users where email = 'correo@ejemplo.com';`
4. Avisos por correo: ejecutar `supabase/avisos.sql`, crear una cuenta en [Resend](https://resend.com) con el mismo correo del administrador y guardar su llave en Vault:
   `select vault.create_secret('re_TU_LLAVE', 'resend_api_key');`

## Avisos por correo

Todos los días a las 7:00 a. m. (hora de Colombia), `pg_cron` ejecuta `enviar_avisos()`. Esta función manda un correo a los administradores cuando un documento está a 30, 15, 7, 3 o 1 día de vencer, el día que vence y el día siguiente. Los lunes manda el resumen de todo lo pendiente. El botón **Enviar correo de prueba** del panel manda el resumen al instante.

## Tecnología

HTML, CSS y JavaScript sin compilación, [Supabase](https://supabase.com) (base de datos, login y archivos) y Netlify. Los permisos se controlan con Row Level Security: solo los administradores ven y editan datos, y el público solo puede consultar el estado mediante la función `estado_negocio`.

## Validación de datos

Lo que se escribe en el panel se limpia (espacios y caracteres raros) y se revisa antes de guardar: NIT, celular de WhatsApp (10 dígitos que empiezan por 3), correo, largo de cada campo, orden de las fechas y tipo y peso del archivo. Las reglas están en `js/comun.js` y se repiten en la base de datos (`supabase/validaciones.sql`), así no se pueden saltar. Todo lo que se muestra en pantalla pasa por `esc()` para evitar que se cuele HTML.
