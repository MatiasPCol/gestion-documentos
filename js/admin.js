// Panel de administración: negocios, documentos, archivos y QR.

const db = crearCliente();
const $ = (selector) => document.querySelector(selector);

let negocios = [];
let actualId = null;
let editandoNegocio = null;
let editandoDocumento = null;

const negocioActual = () => negocios.find((n) => n.id === actualId);
const todosLosDocumentos = () => negocios.flatMap((n) => n.documentos.map((d) => ({ ...d, negocio: n })));
const ordenarPorEstado = (a, b) =>
  ESTADOS[estadoDocumento(a.fecha_vencimiento)].orden - ESTADOS[estadoDocumento(b.fecha_vencimiento)].orden
  || a.tipo.localeCompare(b.tipo);

// ---------- Sesión ----------

function mostrarVista(session) {
  $('#vista-login').hidden = !!session;
  $('#vista-app').hidden = !session;
  $('#barra-usuario').hidden = !session;
  if (session) {
    $('#usuario').textContent = session.user.email;
    cargar();
  }
}

$('#vista-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const datos = new FormData(e.target);
  $('#error-login').textContent = '';
  const { error } = await db.auth.signInWithPassword({ email: datos.get('email'), password: datos.get('password') });
  if (error) $('#error-login').textContent = 'Correo o contraseña incorrectos.';
});

$('#salir').addEventListener('click', () => db.auth.signOut());

// ---------- Carga y pintado ----------

async function cargar() {
  const { data: esAdmin } = await db.rpc('es_admin');
  $('#no-admin').hidden = !!esAdmin;
  const { data, error } = await db.from('negocios').select('*, documentos(*)').order('nombre');
  if (error) return alert(`No se pudieron cargar los negocios: ${error.message}`);
  negocios = data;
  if (!negocioActual()) actualId = null;
  pintarLista();
  pintarResumen();
  pintarAlertas();
  pintarDetalle();
}

function pintarLista() {
  const filtro = $('#buscar').value.trim().toLowerCase();
  const visibles = negocios.filter((n) => n.nombre.toLowerCase().includes(filtro));
  $('#lista-negocios').innerHTML = visibles.map((n) => {
    const estado = estadoNegocio(n.documentos);
    const etiqueta = estado ? etiquetaEstado(estado) : '<span class="muted" style="font-size:12px">Sin documentos</span>';
    return `<li><button type="button" data-id="${n.id}" class="${n.id === actualId ? 'activo' : ''}"><span>${esc(n.nombre)}</span>${etiqueta}</button></li>`;
  }).join('') || '<li class="muted" style="padding:10px">No hay negocios.</li>';
}

function pintarResumen() {
  const docs = todosLosDocumentos();
  const contar = (estado) => docs.filter((d) => estadoDocumento(d.fecha_vencimiento) === estado).length;
  const cifras = [
    [negocios.length, 'Negocios'],
    [contar('vigente') + contar('no_vence'), 'Documentos vigentes'],
    [contar('por_vencer'), `Por vencer (${CONFIG.DIAS_AVISO} días o menos)`],
    [contar('vencido'), 'Vencidos'],
  ];
  $('#resumen').innerHTML = cifras.map(([n, texto]) => `<div class="tarjeta cifra"><strong>${n}</strong><span>${esc(texto)}</span></div>`).join('');
}

function pintarAlertas() {
  const pendientes = todosLosDocumentos()
    .filter((d) => ['vencido', 'por_vencer'].includes(estadoDocumento(d.fecha_vencimiento)))
    .sort((a, b) => a.fecha_vencimiento.localeCompare(b.fecha_vencimiento));
  $('#alertas-seccion').hidden = !pendientes.length;
  $('#alertas').innerHTML = '<thead><tr><th>Negocio</th><th>Documento</th><th>Vencimiento</th><th>Estado</th><th></th></tr></thead><tbody>'
    + pendientes.map((d) => `<tr>
        <td><a href="#" data-abrir="${d.negocio.id}">${esc(d.negocio.nombre)}</a></td>
        <td>${esc(d.tipo)}</td>
        <td>${formatoFecha(d.fecha_vencimiento)}<div class="muted" style="font-size:12px">${textoVencimiento(d.fecha_vencimiento)}</div></td>
        <td>${etiquetaEstado(estadoDocumento(d.fecha_vencimiento))}</td>
        <td>${botonWhatsapp(d.negocio, d)}</td>
      </tr>`).join('')
    + '</tbody>';
}

function pintarDetalle() {
  const n = negocioActual();
  $('#detalle').hidden = !n;
  if (!n) return;

  $('#d-nombre').textContent = n.nombre;
  $('#d-actividad').textContent = n.actividad || '';
  const datos = [['NIT', n.nit], ['Dirección', n.direccion], ['Propietario', n.propietario], ['WhatsApp', n.telefono], ['Correo', n.email]];
  $('#d-datos').innerHTML = datos.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v || '—')}</dd></div>`).join('');

  const docs = [...n.documentos].sort(ordenarPorEstado);
  $('#tabla-documentos').innerHTML = docs.length
    ? '<thead><tr><th>Documento</th><th>Vencimiento</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>'
      + docs.map((d) => {
        const estado = estadoDocumento(d.fecha_vencimiento);
        const avisar = ['vencido', 'por_vencer'].includes(estado) ? botonWhatsapp(n, d) : '';
        const archivo = d.archivo_path ? `<button class="boton chico" type="button" data-accion="archivo" data-doc="${d.id}">Ver archivo</button>` : '';
        return `<tr>
          <td><strong>${esc(d.tipo)}</strong><div class="muted" style="font-size:12px">${esc(d.numero || '')}</div></td>
          <td>${formatoFecha(d.fecha_vencimiento)}<div class="muted" style="font-size:12px">${textoVencimiento(d.fecha_vencimiento)}</div></td>
          <td>${etiquetaEstado(estado)}</td>
          <td><div class="acciones">
            <button class="boton chico" type="button" data-accion="editar" data-doc="${d.id}">Editar / Renovar</button>
            ${archivo}${avisar}
            <button class="boton chico peligro" type="button" data-accion="borrar" data-doc="${d.id}">Eliminar</button>
          </div></td>
        </tr>`;
      }).join('') + '</tbody>'
    : '<tbody><tr><td class="muted">Este negocio aún no tiene documentos.</td></tr></tbody>';

  const url = urlPublica(n.codigo);
  $('#qr').innerHTML = '';
  new QRCode($('#qr'), { text: url, width: 180, height: 180, correctLevel: QRCode.CorrectLevel.M });
  $('#qr-nombre').textContent = n.nombre;
  $('#ver-publica').href = url;
}

function abrirNegocio(id) {
  actualId = id;
  pintarLista();
  pintarDetalle();
  $('#detalle').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---------- WhatsApp ----------

function numeroWhatsapp(telefono) {
  const digitos = (telefono || '').replace(/\D/g, '');
  if (!digitos) return null;
  return digitos.length === 10 ? `57${digitos}` : digitos; // 10 dígitos = celular de Colombia sin indicativo
}

function botonWhatsapp(negocio, doc) {
  const numero = numeroWhatsapp(negocio.telefono);
  if (!numero) return '';
  const verbo = diasHasta(doc.fecha_vencimiento) < 0 ? 'venció el' : 'vence el';
  const saludo = negocio.propietario ? `Hola ${negocio.propietario}` : 'Hola';
  const texto = `${saludo}, te escribo de ${CONFIG.BRAND}. El documento "${doc.tipo}" de ${negocio.nombre} ${verbo} ${formatoFecha(doc.fecha_vencimiento)}. Cuando lo renueves, envíamelo para dejarlo vigente.`;
  return `<a class="boton chico" target="_blank" rel="noopener" href="https://wa.me/${numero}?text=${encodeURIComponent(texto)}">Avisar por WhatsApp</a>`;
}

// ---------- Negocios ----------

function abrirDialogoNegocio(negocio = null) {
  editandoNegocio = negocio;
  const form = $('#form-negocio');
  form.reset();
  $('#titulo-negocio').textContent = negocio ? 'Editar negocio' : 'Nuevo negocio';
  $('#error-negocio').textContent = '';
  if (negocio) ['nombre', 'nit', 'actividad', 'direccion', 'propietario', 'telefono', 'email'].forEach((k) => { form.elements[k].value = negocio[k] || ''; });
  $('#dialogo-negocio').showModal();
}

$('#form-negocio').addEventListener('submit', async (e) => {
  if (e.submitter?.value !== 'guardar') return;
  e.preventDefault();
  const datos = Object.fromEntries(new FormData(e.target));
  Object.keys(datos).forEach((k) => { datos[k] = limpiarTexto(datos[k]); });
  if (datos.email) datos.email = datos.email.toLowerCase();
  if (datos.telefono) datos.telefono = soloDigitos(datos.telefono);
  const invalido = validarNegocio(datos);
  if (invalido) return ($('#error-negocio').textContent = invalido);
  $('#error-negocio').textContent = '';
  $('#guardar-negocio').disabled = true;
  const consulta = editandoNegocio
    ? db.from('negocios').update(datos).eq('id', editandoNegocio.id).select().single()
    : db.from('negocios').insert(datos).select().single();
  const { data, error } = await consulta;
  $('#guardar-negocio').disabled = false;
  if (error) return ($('#error-negocio').textContent = error.message);
  $('#dialogo-negocio').close();
  actualId = data.id;
  await cargar();
});

$('#borrar-negocio').addEventListener('click', async () => {
  const n = negocioActual();
  if (!confirm(`¿Eliminar "${n.nombre}" con todos sus documentos? Esto no se puede deshacer.`)) return;
  const archivos = n.documentos.map((d) => d.archivo_path).filter(Boolean);
  if (archivos.length) await db.storage.from('documentos').remove(archivos);
  const { error } = await db.from('negocios').delete().eq('id', n.id);
  if (error) return alert(error.message);
  actualId = null;
  await cargar();
});

// ---------- Documentos ----------

function abrirDialogoDocumento(doc = null) {
  editandoDocumento = doc;
  const form = $('#form-documento');
  form.reset();
  $('#titulo-documento').textContent = doc ? 'Editar o renovar documento' : 'Agregar documento';
  $('#error-documento').textContent = '';
  $('#archivo-actual').textContent = doc?.archivo_path ? 'Ya tiene un archivo. Sube otro solo si quieres reemplazarlo.' : '';
  if (doc) ['tipo', 'numero', 'fecha_expedicion', 'fecha_vencimiento', 'notas'].forEach((k) => { form.elements[k].value = doc[k] || ''; });
  $('#dialogo-documento').showModal();
}

$('#form-documento').addEventListener('submit', async (e) => {
  if (e.submitter?.value !== 'guardar') return;
  e.preventDefault();
  const form = e.target;
  const n = negocioActual();
  const datos = {};
  ['tipo', 'numero', 'fecha_expedicion', 'fecha_vencimiento'].forEach((k) => { datos[k] = limpiarTexto(form.elements[k].value); });
  datos.notas = limpiarTexto(form.elements.notas.value, true);
  const archivo = form.elements.archivo.files[0];
  const invalido = validarDocumento(datos, archivo);
  if (invalido) return ($('#error-documento').textContent = invalido);
  $('#error-documento').textContent = '';
  $('#guardar-documento').disabled = true;

  let archivoAnterior = null;
  if (archivo) {
    const limpio = archivo.name.normalize('NFD').replace(/[^\w.-]+/g, '_').slice(-80);
    const ruta = `${n.id}/${crypto.randomUUID()}-${limpio}`;
    const { error } = await db.storage.from('documentos').upload(ruta, archivo);
    if (error) {
      $('#guardar-documento').disabled = false;
      return ($('#error-documento').textContent = `No se pudo subir el archivo: ${error.message}`);
    }
    datos.archivo_path = ruta;
    archivoAnterior = editandoDocumento?.archivo_path;
  }

  const consulta = editandoDocumento
    ? db.from('documentos').update(datos).eq('id', editandoDocumento.id)
    : db.from('documentos').insert({ ...datos, negocio_id: n.id });
  const { error } = await consulta;
  $('#guardar-documento').disabled = false;
  if (error) return ($('#error-documento').textContent = error.message);
  if (archivoAnterior) await db.storage.from('documentos').remove([archivoAnterior]);
  $('#dialogo-documento').close();
  await cargar();
});

$('#tabla-documentos').addEventListener('click', async (e) => {
  const boton = e.target.closest('[data-accion]');
  if (!boton) return;
  const doc = negocioActual().documentos.find((d) => d.id === boton.dataset.doc);
  if (boton.dataset.accion === 'editar') abrirDialogoDocumento(doc);
  if (boton.dataset.accion === 'archivo') {
    const { data, error } = await db.storage.from('documentos').createSignedUrl(doc.archivo_path, 120);
    if (error) return alert(error.message);
    window.open(data.signedUrl, '_blank', 'noopener');
  }
  if (boton.dataset.accion === 'borrar') {
    if (!confirm(`¿Eliminar "${doc.tipo}"? Esto no se puede deshacer.`)) return;
    if (doc.archivo_path) await db.storage.from('documentos').remove([doc.archivo_path]);
    const { error } = await db.from('documentos').delete().eq('id', doc.id);
    if (error) return alert(error.message);
    await cargar();
  }
});

// ---------- Eventos generales ----------

$('#nuevo-negocio').addEventListener('click', () => abrirDialogoNegocio());
$('#editar-negocio').addEventListener('click', () => abrirDialogoNegocio(negocioActual()));
$('#nuevo-documento').addEventListener('click', () => abrirDialogoDocumento());
$('#buscar').addEventListener('input', pintarLista);
$('#lista-negocios').addEventListener('click', (e) => {
  const boton = e.target.closest('[data-id]');
  if (boton) abrirNegocio(boton.dataset.id);
});
$('#alertas').addEventListener('click', (e) => {
  const enlace = e.target.closest('[data-abrir]');
  if (!enlace) return;
  e.preventDefault();
  abrirNegocio(enlace.dataset.abrir);
});

$('#probar-avisos').addEventListener('click', async (e) => {
  e.target.disabled = true;
  const { data, error } = await db.rpc('probar_avisos');
  e.target.disabled = false;
  alert(error ? `No se pudo enviar: ${error.message}` : data);
});

$('#imprimir-qr').addEventListener('click', () => {
  const copia = $('#tarjeta-qr').cloneNode(true);
  copia.removeAttribute('id');
  copia.querySelectorAll('button, a').forEach((el) => el.remove());
  $('#zona-impresion').replaceChildren(copia);
  window.print();
});

// ---------- Inicio ----------

if (!CONFIGURADO) {
  $('#sin-config').hidden = false;
} else {
  // Se difiere para no llamar a Supabase dentro del propio aviso de sesión.
  db.auth.onAuthStateChange((_evento, session) => setTimeout(() => mostrarVista(session), 0));
}
