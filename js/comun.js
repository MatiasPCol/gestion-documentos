// Funciones compartidas por el panel y la página pública.

const CONFIGURADO = !CONFIG.SUPABASE_URL.startsWith('PENDIENTE');

function crearCliente() {
  return CONFIGURADO ? supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY) : null;
}

const ESTADOS = {
  vencido: { orden: 0, texto: 'Vencido' },
  por_vencer: { orden: 1, texto: 'Por vencer' },
  vigente: { orden: 2, texto: 'Vigente' },
  no_vence: { orden: 3, texto: 'No vence' },
};

// Las fechas llegan como "AAAA-MM-DD"; se leen en hora local para no correrse un día.
function leerFecha(texto) {
  if (!texto) return null;
  const [a, m, d] = texto.split('-').map(Number);
  return new Date(a, m - 1, d);
}

function diasHasta(texto) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Math.round((leerFecha(texto) - hoy) / 86400000);
}

function estadoDocumento(fechaVencimiento) {
  if (!fechaVencimiento) return 'no_vence';
  const dias = diasHasta(fechaVencimiento);
  if (dias < 0) return 'vencido';
  if (dias <= CONFIG.DIAS_AVISO) return 'por_vencer';
  return 'vigente';
}

// El estado de un negocio es el peor de sus documentos.
function estadoNegocio(documentos) {
  if (!documentos.length) return null;
  return documentos
    .map((d) => estadoDocumento(d.fecha_vencimiento))
    .sort((a, b) => ESTADOS[a].orden - ESTADOS[b].orden)[0];
}

function formatoFecha(texto) {
  if (!texto) return '—';
  return leerFecha(texto).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
}

function textoVencimiento(fechaVencimiento) {
  if (!fechaVencimiento) return 'No vence';
  const dias = diasHasta(fechaVencimiento);
  if (dias < 0) return `Venció hace ${-dias} día${dias === -1 ? '' : 's'}`;
  if (dias === 0) return 'Vence hoy';
  return `Vence en ${dias} día${dias === 1 ? '' : 's'}`;
}

function etiquetaEstado(estado) {
  return `<span class="estado estado-${estado}">${ESTADOS[estado].texto}</span>`;
}

function esc(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// ---------- Validación de lo que se escribe en los formularios ----------
// La base de datos repite estas reglas (supabase/validaciones.sql): aquí solo se avisa antes.

const LIMITES = {
  nombre: 120, nit: 20, actividad: 80, direccion: 150, propietario: 100, telefono: 20, email: 120,
  tipo: 100, numero: 50, notas: 500,
};

const REGEX = {
  nit: /^\d{1,3}(\.?\d{3}){1,4}(-\d)?$/, // 900.000.000-0 o 900000000
  celular: /^(57)?3\d{9}$/, // celular de Colombia, con o sin 57
  email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
  codigo: /^[0-9a-f]{6,64}$/i, // código del QR (hexadecimal)
};

const ARCHIVO_MAX_MB = 10;
const ARCHIVO_TIPOS = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic'];

// Quita caracteres de control y espacios de sobra. En textos de varias líneas deja los saltos de línea.
function limpiarTexto(valor, multilinea = false) {
  let texto = String(valor ?? '').normalize('NFC');
  texto = multilinea
    ? texto.replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n')
    : texto.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ');
  return texto.trim() || null;
}

function soloDigitos(texto) {
  return (texto || '').replace(/\D/g, '');
}

function revisarLargos(datos) {
  const largo = Object.keys(datos).find((k) => LIMITES[k] && datos[k] && datos[k].length > LIMITES[k]);
  return largo ? `El campo "${largo}" es muy largo (máximo ${LIMITES[largo]} caracteres).` : null;
}

// Devuelve el primer error que encuentre, o null si todo está bien.
function validarNegocio(datos) {
  if (!datos.nombre || datos.nombre.length < 2) return 'Escribe el nombre del negocio.';
  const largo = revisarLargos(datos);
  if (largo) return largo;
  if (datos.nit && !REGEX.nit.test(datos.nit.replace(/\s/g, ''))) return 'El NIT no es válido. Ejemplo: 900.123.456-7';
  if (datos.telefono && !REGEX.celular.test(soloDigitos(datos.telefono))) return 'El WhatsApp debe ser un celular de 10 dígitos que empiece por 3.';
  if (datos.email && !REGEX.email.test(datos.email)) return 'El correo no es válido.';
  return null;
}

function validarDocumento(datos, archivo) {
  if (!datos.tipo || datos.tipo.length < 2) return 'Escribe el tipo de documento.';
  const largo = revisarLargos(datos);
  if (largo) return largo;
  for (const campo of ['fecha_expedicion', 'fecha_vencimiento']) {
    const anio = datos[campo] && Number(datos[campo].slice(0, 4));
    if (anio && (anio < 1950 || anio > 2100)) return 'Revisa las fechas: el año no es válido.';
  }
  if (datos.fecha_expedicion && diasHasta(datos.fecha_expedicion) > 0) return 'La fecha de expedición no puede ser futura.';
  if (datos.fecha_expedicion && datos.fecha_vencimiento && datos.fecha_vencimiento < datos.fecha_expedicion) {
    return 'La fecha de vencimiento no puede ser antes de la de expedición.';
  }
  if (archivo) {
    if (!ARCHIVO_TIPOS.includes(archivo.type)) return 'El archivo debe ser PDF o foto (JPG, PNG, WEBP o HEIC).';
    if (archivo.size > ARCHIVO_MAX_MB * 1024 * 1024) return `El archivo pesa más de ${ARCHIVO_MAX_MB} MB.`;
  }
  return null;
}

function urlPublica(codigo) {
  return new URL(`negocio.html?c=${encodeURIComponent(codigo)}`, location.href).href;
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-brand]').forEach((el) => { el.textContent = CONFIG.BRAND; });
  if (document.title.includes('{brand}')) document.title = document.title.replace('{brand}', CONFIG.BRAND);
});
