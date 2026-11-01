// Página pública: muestra el estado de los documentos del negocio del QR.

const BANNERS = {
  vigente: ['Documentos al día', 'Todos los documentos están vigentes.'],
  no_vence: ['Documentos al día', 'Todos los documentos están vigentes.'],
  por_vencer: ['Documentos vigentes', 'Uno o más documentos vencen pronto.'],
  vencido: ['Documentos vencidos', 'Uno o más documentos no están vigentes.'],
};

// Datos de ejemplo para mostrar la plataforma sin conectarla (negocio.html?c=demo).
function negocioDemo() {
  return {
    nombre: 'Negocio X',
    actividad: 'Tienda de barrio',
    direccion: 'Calle 00 # 00-00, Pereira',
    documentos: [
      { tipo: 'Certificado de bomberos', fecha_vencimiento: enDiasDesdeHoy(12) },
      { tipo: 'Concepto sanitario', fecha_vencimiento: enDiasDesdeHoy(-20) },
      { tipo: 'Matrícula mercantil (Cámara de Comercio)', fecha_vencimiento: enDiasDesdeHoy(160) },
      { tipo: 'RUT', fecha_vencimiento: null },
      { tipo: 'Sayco Acinpro', fecha_vencimiento: enDiasDesdeHoy(65) },
      { tipo: 'Uso del suelo', fecha_vencimiento: null },
    ],
  };
}

async function consultar(codigo) {
  if (codigo === 'demo') return negocioDemo();
  const db = crearCliente();
  if (!db || !codigo || !REGEX.codigo.test(codigo)) return null; // un código raro ni se consulta
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

// ---------- Simulación (solo en la demo) ----------
// El visitante cambia fechas y agrega documentos; todo vive en memoria y se pierde al recargar.

function aFechaTexto(fecha) {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
}

function enDiasDesdeHoy(n) {
  const f = new Date();
  f.setDate(f.getDate() + n);
  return aFechaTexto(f);
}

function iniciarSimulacion(negocio) {
  const tabla = document.getElementById('sim-documentos');

  const repintar = () => {
    pintar(negocio);
    tabla.innerHTML = negocio.documentos.map((d, i) => `<tr>
        <td><strong>${esc(d.tipo)}</strong></td>
        <td><input type="date" data-i="${i}" value="${esc(d.fecha_vencimiento || '')}" ${d.fecha_vencimiento ? '' : 'disabled'} aria-label="Vencimiento de ${esc(d.tipo)}"></td>
        <td><label><input type="checkbox" data-no-vence="${i}" ${d.fecha_vencimiento ? '' : 'checked'}> No vence</label></td>
        <td><button class="boton chico peligro" type="button" data-quitar="${i}">Quitar</button></td>
      </tr>`).join('') || '<tr><td class="muted">No hay documentos. Agrega uno abajo.</td></tr>';
  };

  tabla.addEventListener('change', (e) => {
    const i = Number(e.target.dataset.i ?? e.target.dataset.noVence);
    const doc = negocio.documentos[i];
    if (!doc) return;
    if (e.target.type === 'checkbox') doc.fecha_vencimiento = e.target.checked ? null : enDiasDesdeHoy(90);
    else if (e.target.value) doc.fecha_vencimiento = e.target.value;
    repintar();
  });

  tabla.addEventListener('click', (e) => {
    const boton = e.target.closest('[data-quitar]');
    if (!boton) return;
    negocio.documentos.splice(Number(boton.dataset.quitar), 1);
    repintar();
  });

  document.getElementById('sim-agregar').addEventListener('submit', (e) => {
    e.preventDefault();
    const form = e.target;
    const datos = { tipo: limpiarTexto(form.elements.tipo.value), fecha_vencimiento: form.elements.fecha_vencimiento.value || null };
    const invalido = validarDocumento(datos);
    document.getElementById('sim-error').textContent = invalido || '';
    if (invalido) return;
    negocio.documentos.push(datos);
    form.reset();
    repintar();
  });

  document.querySelector('.sim-atajos').addEventListener('click', (e) => {
    const accion = e.target.dataset.sim;
    if (!accion) return;
    if (accion === 'al-dia') {
      negocio.documentos.forEach((d) => {
        if (d.fecha_vencimiento && estadoDocumento(d.fecha_vencimiento) !== 'vigente') d.fecha_vencimiento = enDiasDesdeHoy(365);
      });
    }
    if (accion === 'vencer') {
      const doc = negocio.documentos.find((d) => d.fecha_vencimiento && estadoDocumento(d.fecha_vencimiento) !== 'vencido');
      if (doc) doc.fecha_vencimiento = enDiasDesdeHoy(-5);
    }
    if (accion === 'reiniciar') negocio.documentos = negocioDemo().documentos;
    document.getElementById('sim-error').textContent = '';
    repintar();
  });

  document.getElementById('simulacion').hidden = false;
  repintar();
}

(async () => {
  const codigo = new URLSearchParams(location.search).get('c');
  const pie = document.getElementById('pie');
  try {
    const negocio = await consultar(codigo);
    if (negocio && codigo === 'demo') iniciarSimulacion(negocio);
    else if (negocio) pintar(negocio);
    else document.getElementById('no-encontrado').hidden = false;
  } catch (e) {
    document.getElementById('no-encontrado').hidden = false;
    console.error(e);
  }
  document.getElementById('cargando').hidden = true;
  const ahora = new Date().toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' });
  pie.textContent = `Consultado el ${ahora} · Esta página muestra el registro de ${CONFIG.BRAND} y no reemplaza los documentos originales.`;
})();
