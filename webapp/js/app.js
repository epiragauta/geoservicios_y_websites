// ===================== CONFIGURACIÓN =====================
const CONFIG = {
  // WMS (el del DANE u otro). Reemplaza URL y nombres de capa por los tuyos.
  wmsUrl: 'https://geoportal.dane.gov.co/mparcgis/services/MGN2024/Serv_CapasMGN_2024/MapServer/WMSServer',
  wmsDepartamentos: '8',
  wmsMunicipios: '7',
  wmsAtribucion: 'DANE - Departamento Administrativo Nacional de Estadística',

  // "WFS": GeoJSON de departamentos. Con un archivo local funciona
  // también cuando la app está desplegada en línea.
  wfsUrl: 'datos/departamentos.geojson',
  // Si usas un WFS real, pon aquí su URL con outputFormat=application/json.

  // Posibles nombres de los atributos (se usa el primero que exista)
  camposNombre: ['dpto_cnmbr', 'DPTO_CNMBR', 'nombre', 'NOMBRE', 'name'],
  camposCodigo: ['dpto_ccdgo', 'DPTO_CCDGO', 'codigo', 'CODIGO', 'id']
};

const prop = (p, campos) => {
  for (const c of campos) if (p && p[c] !== undefined && p[c] !== null) return p[c];
  return '';
};
const nombreDe = p => prop(p, CONFIG.camposNombre);
const codigoDe = p => prop(p, CONFIG.camposCodigo);

// ===================== MAPA Y CAPAS BASE =====================
const map = L.map('map', { zoomControl: true }).setView([4.5709, -74.2973], 6);

const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors', maxZoom: 19
}).addTo(map);

const satelite = L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  { attribution: 'Tiles &copy; Esri', maxZoom: 19 });

// ===================== WMS =====================
const wmsOpts = { format: 'image/png', transparent: true, attribution: CONFIG.wmsAtribucion };

const departamentosWMS = L.tileLayer.wms(CONFIG.wmsUrl,
  { ...wmsOpts, layers: CONFIG.wmsDepartamentos });
const municipiosWMS = L.tileLayer.wms(CONFIG.wmsUrl,
  { ...wmsOpts, layers: CONFIG.wmsMunicipios });

municipiosWMS.addTo(map);
departamentosWMS.addTo(map);

// ===================== "WFS" (GeoJSON interactivo) =====================
const estiloBase = { color: '#232323', weight: 2, fillColor: '#e8f881', fillOpacity: 0.35 };
const estiloHover = { weight: 4, color: '#666', fillOpacity: 0.6 };
const estiloSel = { weight: 4, color: '#b34700', fillColor: '#ff8c00', fillOpacity: 0.55 };

let capaWFS = null;
let seleccionada = null;

const info = L.control({ position: 'topleft' });
info.onAdd = function () {
  this._div = L.DomUtil.create('div', 'panel info');
  this.update();
  return this._div;
};
info.update = function (props) {
  this._div.innerHTML = '<h4>Colombia - Servicios Geográficos</h4>' + (props
    ? `<div class="nombre">${nombreDe(props)}</div>Código: ${codigoDe(props)}`
    : 'Pasa el cursor sobre un departamento o toca uno para ver su información.') +
    '<br><small>Datos: DANE | Servicio WMS: geoportal DANE</small>';
};
info.addTo(map);

function onEachFeature(feature, layer) {
  const p = feature.properties;
  layer.bindPopup(`<strong>${nombreDe(p)}</strong><br>Código: ${codigoDe(p)}`);
  layer.on({
    mouseover: e => { if (e.target !== seleccionada) e.target.setStyle(estiloHover); info.update(p); },
    mouseout: e => { if (e.target !== seleccionada) capaWFS.resetStyle(e.target); info.update(seleccionada ? seleccionada.feature.properties : undefined); },
    click: e => seleccionar(e.target)
  });
}

function seleccionar(layer) {
  if (seleccionada) capaWFS.resetStyle(seleccionada);
  seleccionada = layer;
  layer.setStyle(estiloSel);
  info.update(layer.feature.properties);
  map.fitBounds(layer.getBounds(), { padding: [20, 20] });
}

fetch(CONFIG.wfsUrl)
  .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
  .then(data => {
    capaWFS = L.geoJSON(data, { style: estiloBase, onEachFeature }).addTo(map);
    controlCapas.addOverlay(capaWFS, 'Departamentos (WFS)');
    poblarBuscador(data);
  })
  .catch(err => {
    console.error('Error cargando departamentos:', err);
    info._div.insertAdjacentHTML('beforeend',
      '<br><span style="color:#b00020">No se pudieron cargar los departamentos.</span>');
  });

// ===================== CONTROLES =====================
const controlCapas = L.control.layers(
  { 'OpenStreetMap': osm, 'Satélite': satelite },
  { 'Municipios': municipiosWMS, 'Departamentos': departamentosWMS },
  { collapsed: window.innerWidth < 600 }
).addTo(map);

L.control.scale({ position: 'bottomleft', metric: true, imperial: false }).addTo(map);

// Leyenda
const leyenda = L.control({ position: 'bottomright' });
leyenda.onAdd = function () {
  const div = L.DomUtil.create('div', 'panel legend');
  div.innerHTML = `
    <button class="legend-toggle" type="button">Leyenda</button>
    <div class="legend-body">
      <h4>Leyenda</h4>
      <div><i class="dep"></i>Departamentos</div>
      <div><i class="mun"></i>Municipios</div>
      <div><i class="sel"></i>Departamento seleccionado</div>
    </div>`;
  div.querySelector('.legend-toggle').addEventListener('click', () => div.classList.toggle('open'));
  L.DomEvent.disableClickPropagation(div);
  return div;
};
leyenda.addTo(map);

// Búsqueda con autocompletado
const buscador = L.control({ position: 'topright' });
buscador.onAdd = function () {
  const div = L.DomUtil.create('div', 'panel search');
  div.innerHTML = `
    <input id="q" type="text" list="lista-dptos" placeholder="Buscar departamento..." autocomplete="off">
    <datalist id="lista-dptos"></datalist>
    <button id="btn-buscar" type="button">Buscar</button>`;
  L.DomEvent.disableClickPropagation(div);
  L.DomEvent.disableScrollPropagation(div);
  return div;
};
buscador.addTo(map);

const quitarTildes = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function poblarBuscador(data) {
  const lista = document.getElementById('lista-dptos');
  data.features.map(f => nombreDe(f.properties)).filter(Boolean).sort()
    .forEach(n => { const o = document.createElement('option'); o.value = n; lista.appendChild(o); });
}

function buscar() {
  const q = quitarTildes(document.getElementById('q').value.trim());
  if (!q || !capaWFS) return;
  let encontrada = null;
  capaWFS.eachLayer(l => {
    if (!encontrada && quitarTildes(String(nombreDe(l.feature.properties))).includes(q)) encontrada = l;
  });
  if (encontrada) { seleccionar(encontrada); encontrada.openPopup(); }
  else alert('No se encontró ningún departamento con ese nombre.');
}
document.getElementById('btn-buscar').addEventListener('click', buscar);
document.getElementById('q').addEventListener('keydown', e => { if (e.key === 'Enter') buscar(); });
