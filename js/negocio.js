// Página pública: muestra el estado de los documentos del negocio del QR.

const BANNERS = {
  vigente: ['Documentos al día', 'Todos los documentos están vigentes.'],
  no_vence: ['Documentos al día', 'Todos los documentos están vigentes.'],
  por_vencer: ['Documentos vigentes', 'Uno o más documentos vencen pronto.'],
  vencido: ['Documentos vencidos', 'Uno o más documentos no están vigentes.'],
};

// Datos de ejemplo para mostrar la plataforma sin conectarla (negocio.html?c=demo).
function negocioDemo() {
  const enDias = (n) => {
    const f = new Date();
    f.setDate(f.getDate() + n);
    return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
  };
  return {
    nombre: 'Negocio X',
    actividad: 'Tienda de barrio',
    direccion: 'Calle 00 # 00-00, Pereira',
    documentos: [
      { tipo: 'Certificado de bomberos', fecha_vencimiento: enDias(12) },
      { tipo: 'Concepto sanitario', fecha_vencimiento: enDias(-20) },
      { tipo: 'Matrícula mercantil (Cámara de Comercio)', fecha_vencimiento: enDias(160) },
      { tipo: 'RUT', fecha_vencimiento: null },
      { tipo: 'Sayco Acinpro', fecha_vencimiento: enDias(65) },
      { tipo: 'Uso del suelo', fecha_vencimiento: null },
    ],
  };
}

async function consultar(codigo) {
  if (codigo === 'demo') return negocioDemo();
  const db = crearCliente();
  if (!db || !codigo) return null;
  const { data, error } = await db.rpc('estado_negocio', { p_codigo: codigo });
  if (error) throw error;
  return data;
}

function pintar(negocio) {
  document.getElementById('nombre').textContent = negocio.nombre;
  document.getElementById('actividad').textContent = negocio.actividad || '';
  document.getElementById('direccion').textContent = negocio.direccion || '';

  const docs = [...negocio.documentos].sort((a, b) =>
    ESTADOS[estadoDocumento(a.fecha_vencimiento)].orden - ESTADOS[estadoDocumento(b.fecha_vencimiento)].orden);

  const banner = document.getElementById('banner');
  const estado = estadoNegocio(docs);
  if (estado) {
    const [titulo, detalle] = BANNERS[estado];
    banner.className = `banner banner-${estado}`;
    banner.innerHTML = `${esc(titulo)}<small>${esc(detalle)}</small>`;
  } else {
    banner.className = 'banner banner-por_vencer';
    banner.innerHTML = 'Sin documentos registrados';
  }

  document.getElementById('documentos').innerHTML = docs.map((d) => {
    const est = estadoDocumento(d.fecha_vencimiento);
    const vence = d.fecha_vencimiento ? `${textoVencimiento(d.fecha_vencimiento)} · ${formatoFecha(d.fecha_vencimiento)}` : 'No vence';
    return `<li><div><strong>${esc(d.tipo)}</strong><span class="muted">${esc(vence)}</span></div>${etiquetaEstado(est)}</li>`;
  }).join('');

  document.getElementById('resultado').hidden = false;
}

(async () => {
  const codigo = new URLSearchParams(location.search).get('c');
  const pie = document.getElementById('pie');
  try {
    const negocio = await consultar(codigo);
    if (negocio) pintar(negocio);
    else document.getElementById('no-encontrado').hidden = false;
  } catch (e) {
    document.getElementById('no-encontrado').hidden = false;
    console.error(e);
  }
  document.getElementById('cargando').hidden = true;
  const ahora = new Date().toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' });
  pie.textContent = `Consultado el ${ahora}. Esta página muestra el registro de ${CONFIG.BRAND} y no reemplaza los documentos originales.`;
})();
