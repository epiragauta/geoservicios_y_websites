// Crear el mapa centrado en el departamento de La Guajira
const map = L.map('map').setView([11.35, -72.5], 8);

// Agregar capa base de OpenStreetMap
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
}).addTo(map);

// URL del servicio WMS de GeoServer
const geoserverUrl = 'https://geoportal.dane.gov.co/mparcgis/services/MGN2024/Serv_CapasMGN_2024/MapServer/WMSServer';

// Código DANE del departamento a mostrar: La Guajira
const GUAJIRA_CCDGO = '44';

// Agregar capa WMS de departamentos
// Nota: el servicio es un ArcGIS MapServer WMS y no admite filtros por atributo (CQL),
// por lo que se restringe la carga de teselas a la extensión de La Guajira mediante 'bounds'.
const departamentosWMS = L.tileLayer.wms(geoserverUrl, {
    layers: '8',
    format: 'image/png',
    transparent: true,
    attribution: 'DANE - Departamento Administrativo Nacional de Estadística'
}).addTo(map);

// URL del servicio WFS
const departamentosWFSUrl = 'datos/departamentos.geojson'; // Cambia esto a la URL de tu servicio WFS
let departamentosGeoJSON; // Variable para almacenar la capa GeoJSON

// Cargar y mostrar departamentos como GeoJSON
fetch(departamentosWFSUrl)
    .then(response => response.json())
    .then(data => {
        // Crear capa GeoJSON (solo La Guajira)
        departamentosGeoJSON = L.geoJSON(data, {
            filter: feature => feature.properties.dpto_ccdgo === GUAJIRA_CCDGO,
            style: {
                color: '#232323',
                weight: 2,
                fillColor: '#e8f881',
                fillOpacity: 0.5
            },
            onEachFeature: onEachFeature
        });

        // Agregar al mapa
        departamentosGeoJSON.addTo(map);
        controlLayer.addOverlay(departamentosGeoJSON, "Departamentos (WFS)"); // Agregar al control de capas

        // Extensión de La Guajira
        const guajiraBounds = departamentosGeoJSON.getBounds();

        // Restringir las teselas de ambos WMS a la extensión de La Guajira
        departamentosWMS.options.bounds = guajiraBounds;
        departamentosWMS.redraw();
        municipiosWMS.options.bounds = guajiraBounds;

        // Centrar la vista en el departamento de La Guajira
        map.fitBounds(guajiraBounds);
    })
    .catch(error => console.error('Error cargando WFS:', error));

// Agregar capa WMS de municipios
const municipiosWMS = L.tileLayer.wms(geoserverUrl, {
    layers: '7',
    format: 'image/png',
    transparent: true,
    attribution: 'DANE - Departamento Administrativo Nacional de Estadística'
});

// Capas base
const baseMaps = {
    "OpenStreetMap": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }),
    "Satellite": L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri'
    })
};

// Capas superpuestas
let overlayMaps = {
    "Departamentos": departamentosWMS,    
    "Municipios": municipiosWMS
};

// Agregar control de capas
const controlLayer = L.control.layers(baseMaps, overlayMaps, {
    collapsed: false
}).addTo(map);

// Agregar capa base por defecto
baseMaps["OpenStreetMap"].addTo(map);

// ============================================================
// Capas detalladas de La Guajira (cartografía base IGAC/DANE)
// Datos recortados por departamento en datos/44_LA_GUAJIRA/.
// Se cargan de forma diferida (lazy): solo se descarga el GeoJSON
// cuando el usuario activa la capa en el control, porque algunas
// (Drenaje, Curvas de Nivel, Vías) pesan varios MB.
// ============================================================
const guajiraDataDir = 'datos/44_LA_GUAJIRA/';

const capasGuajira = [
    {
        file: 'Administrativo_P.geojson', label: 'Topónimos administrativos',
        tipo: 'punto', color: '#c62828', radio: 4
    },
    {
        file: 'Construccion_P.geojson', label: 'Construcciones',
        tipo: 'punto', color: '#6d4c41', radio: 3
    },
    {
        file: 'Costero_Insular.geojson', label: 'Costero / insular',
        tipo: 'punto', color: '#00838f', radio: 4
    },
    {
        file: 'Via.geojson', label: 'Vías',
        tipo: 'linea', estilo: { color: '#e65100', weight: 1.5 }
    },
    {
        file: 'Drenaje_Sencillo.geojson', label: 'Drenaje sencillo',
        tipo: 'linea', estilo: { color: '#1e88e5', weight: 1 }
    },
    {
        file: 'Curva_Nivel.geojson', label: 'Curvas de nivel',
        tipo: 'linea', estilo: { color: '#8d6e63', weight: 0.8 }
    },
    {
        file: 'Laguna.geojson', label: 'Lagunas',
        tipo: 'poligono', estilo: { color: '#0277bd', weight: 1, fillColor: '#4fc3f7', fillOpacity: 0.5 }
    },
    {
        file: 'Bosque.geojson', label: 'Bosques',
        tipo: 'poligono', estilo: { color: '#1b5e20', weight: 1, fillColor: '#66bb6a', fillOpacity: 0.4 }
    }
];

// Construye el contenido del popup a partir de los atributos más relevantes
function popupGuajira(props) {
    const campos = [
        ['NOMBRE_GEO', 'Nombre'],
        ['TIPO_VIA', 'Tipo de vía'],
        ['ESTADO_SUP', 'Estado superficie'],
        ['ESTADO_DRE', 'Estado drenaje'],
        ['ALTURA_SOB', 'Altura (m)'],
        ['TIPO_CURVA', 'Tipo de curva'],
        ['CODIGO_USO', 'Código de uso'],
        ['CODIGO_NOM', 'Código']
    ];
    const filas = campos
        .filter(([k]) => props[k] !== undefined && props[k] !== null && props[k] !== '')
        .map(([k, etiqueta]) => `<p style="margin:2px 0"><strong>${etiqueta}:</strong> ${props[k]}</p>`);
    return filas.length ? `<div>${filas.join('')}</div>` : '<div>Sin atributos</div>';
}

// Carga (una sola vez) el GeoJSON de una capa dentro de su layerGroup
function cargarCapaGuajira(cfg) {
    fetch(guajiraDataDir + cfg.file)
        .then(response => response.json())
        .then(data => {
            const capa = L.geoJSON(data, {
                style: cfg.estilo,
                pointToLayer: (feature, latlng) => L.circleMarker(latlng, {
                    radius: cfg.radio || 4,
                    color: cfg.color,
                    fillColor: cfg.color,
                    weight: 1,
                    fillOpacity: 0.8
                }),
                onEachFeature: (feature, layer) => {
                    if (feature.properties) {
                        layer.bindPopup(popupGuajira(feature.properties));
                    }
                }
            });
            capa.addTo(cfg._group);
        })
        .catch(error => console.error('Error cargando capa ' + cfg.file + ':', error));
}

// Registrar cada capa como overlay con carga diferida
capasGuajira.forEach(cfg => {
    cfg._group = L.layerGroup();
    cfg._loaded = false;
    controlLayer.addOverlay(cfg._group, cfg.label);
});

// Al activar una capa por primera vez, descargar su GeoJSON
map.on('overlayadd', function (e) {
    const cfg = capasGuajira.find(c => c._group === e.layer);
    if (cfg && !cfg._loaded) {
        cfg._loaded = true;
        cargarCapaGuajira(cfg);
    }
});

function onEachFeature(feature, layer) {
    // Popup al hacer clic
    if (feature.properties) {
        const popupContent = `
            <div style="text-align: center;">
                <h3>${feature.properties.dpto_cnmbr}</h3>
                <p><strong>Código:</strong> ${feature.properties.dpto_ccdgo}</p>
            </div>
        `;
        layer.bindPopup(popupContent);
    }

    // Highlight al pasar el mouse
    layer.on({
        mouseover: highlightFeature,
        mouseout: resetHighlight,
        click: zoomToFeature
    });
}

function highlightFeature(e) {
    const layer = e.target;

    layer.setStyle({
        weight: 5,
        color: '#666',
        fillOpacity: 0.7
    });

    layer.bringToFront();
}

function resetHighlight(e) {
    const layer = e.target;
    layer.setStyle({
        weight: 2,
        color: '#232323',
        fillOpacity: 0.5
    });
}

function zoomToFeature(e) {
    map.fitBounds(e.target.getBounds());
}

// Control de escala
L.control.scale({
    position: 'bottomleft',
    metric: true,
    imperial: false
}).addTo(map);

// Panel de información
const info = L.control({position: 'topleft'});

info.onAdd = function (map) {
    this._div = L.DomUtil.create('div', 'info');
    this._div.innerHTML = `
        <h4>La Guajira - Servicios Geográficos</h4>
        <p>Visualización del departamento y sus municipios</p>
        <p><small>Datos: DANE | Servidor: GeoServer</small></p>
    `;
    return this._div;
};

info.addTo(map);

// Crear control de búsqueda
const searchControl = L.control({position: 'topright'});

searchControl.onAdd = function (map) {
    const div = L.DomUtil.create('div', 'search-control');
    div.innerHTML = `
        <input type="text" id="search-input" placeholder="Buscar departamento...">
        <button id="search-button">Buscar</button>
    `;
    L.DomEvent.disableClickPropagation(div);
    return div;
};

searchControl.addTo(map);

// Función de búsqueda
document.addEventListener('DOMContentLoaded', function() {
    const searchButton = document.getElementById('search-button');
    const searchInput = document.getElementById('search-input');

    function buscar() {
        const searchText = searchInput.value.trim().toLowerCase();
        if (!searchText || !departamentosGeoJSON) return;

        let encontrado = null;
        departamentosGeoJSON.eachLayer(function(layer) {
            const nombre = layer.feature.properties.dpto_cnmbr.toLowerCase();
            if (!encontrado && nombre.includes(searchText)) {
                encontrado = layer;
            }
        });

        if (encontrado) {
            map.fitBounds(encontrado.getBounds());
            encontrado.openPopup();
        } else {
            alert('No se encontró el departamento: ' + searchInput.value);
        }
    }

    searchButton.addEventListener('click', buscar);
    searchInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') buscar();
    });
});

// Marcador de Riohacha (capital de La Guajira)
const riohachaMarker = L.marker([11.5444, -72.9072])
    .addTo(map)
    .bindPopup('<b>Riohacha</b><br>Capital de La Guajira');