// Configuración de la plataforma.
// BRAND es el nombre que ven los clientes y la alcaldía: cámbialo según el cliente.
window.CONFIG = {
  BRAND: 'Gestión de Documentos',
  // La llave anon es pública por diseño: los permisos los controla la base de datos (RLS).
  SUPABASE_URL: 'https://tbiyvuxxnswvxylzgory.supabase.co',
  SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRiaXl2dXh4bnN3dnh5bHpnb3J5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI4ODE4ODYsImV4cCI6MjEwODQ1Nzg4Nn0.wpDZGC7GaOEkCv_DJ4N71BtzXiaawzj7zvbeVvRljgw',
  DIAS_AVISO: 30, // un documento pasa a "por vencer" cuando le quedan estos días o menos
};
