# Gestión de Documentos

Plataforma para tener al día los documentos de los negocios (matrícula mercantil, bomberos, concepto sanitario, uso del suelo, etc.). Cada negocio recibe un **QR**: cuando llega la alcaldía, lo escanea y ve qué documentos están vigentes, por vencer o vencidos.

## Páginas

| Página | Para quién | Qué hace |
| --- | --- | --- |
| `admin.html` | El administrador | Crear negocios, cargar documentos con su fecha de vencimiento, subir archivos, renovar, imprimir el QR y avisar por WhatsApp lo que se vence. |
| `negocio.html?c=<código>` | Quien escanea el QR | Muestra el estado de los documentos del negocio. No muestra archivos ni datos privados. |
| `negocio.html?c=demo` | Para mostrar la plataforma | Ejemplo con el Negocio X, sin necesidad de base de datos. |

## Estados

- **Vigente:** vence en más de 30 días.
- **Por vencer:** vence en 30 días o menos (se cambia en `DIAS_AVISO`).
- **Vencido:** la fecha ya pasó.
- **No vence:** el documento no tiene fecha de vencimiento.

## Configuración

1. Crear un proyecto en Supabase y ejecutar `supabase/esquema.sql`. `supabase/negocio-x.sql` carga el negocio de ejemplo.
2. Poner la URL y la llave pública del proyecto en `js/config.js`. `BRAND` es el nombre que ven los clientes.
3. Crear el usuario administrador en Supabase (Authentication → Users → Add user) y darle permiso:
   `insert into admins (user_id) select id from auth.users where email = 'correo@ejemplo.com';`

## Tecnología

HTML, CSS y JavaScript sin compilación, [Supabase](https://supabase.com) (base de datos, login y archivos) y Netlify. Los permisos se controlan con Row Level Security: solo los administradores ven y editan datos, y el público solo puede consultar el estado mediante la función `estado_negocio`.
