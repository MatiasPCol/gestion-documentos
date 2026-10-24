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

function urlPublica(codigo) {
  return new URL(`negocio.html?c=${encodeURIComponent(codigo)}`, location.href).href;
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-brand]').forEach((el) => { el.textContent = CONFIG.BRAND; });
  if (document.title.includes('{brand}')) document.title = document.title.replace('{brand}', CONFIG.BRAND);
});
