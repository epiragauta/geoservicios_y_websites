// Crear el mapa centrado en Colombia
const map = L.map('map').setView([4.5709, -74.2973], 6);

// Agregar capa base de OpenStreetMap
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
}).addTo(map);

// URL del servicio WMS de GeoServer
const geoserverUrl = 'https://geoportal.dane.gov.co/mparcgis/services/MGN2024/Serv_CapasMGN_2024/MapServer/WMSServer';

// Agregar capa WMS de departamentos
const departamentosWMS = L.tileLayer.wms(geoserverUrl, {
    layers: '8',
    format: 'image/png',
    transparent: true,
    attribution: 'IGAC - Instituto Geográfico Agustín Codazzi'
}).addTo(map);

// URL del servicio WFS
const departamentosWFSUrl = '/datos/departamentos.geojson'; // Cambia esto a la URL de tu servicio WFS
let departamentosGeoJSON; // Variable para almacenar la capa GeoJSON

// Cargar y mostrar departamentos como GeoJSON
fetch(departamentosWFSUrl)
    .then(response => response.json())
    .then(data => {
        // Crear capa GeoJSON
        departamentosGeoJSON = L.geoJSON(data, {
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

        // Ajustar vista al extent de los datos
        map.fitBounds(departamentosGeoJSON.getBounds());
    })
    .catch(error => console.error('Error cargando WFS:', error));

// Agregar capa WMS de municipios
const municipiosWMS = L.tileLayer.wms(geoserverUrl, {
    layers: '7',
    format: 'image/png',
    transparent: true,
    attribution: 'IGAC'
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

function onEachFeature(feature, layer) {
    // Popup al hacer clic
    if (feature.properties) {
        const popupContent = `
            <strong>${feature.properties.dpto_cnmbr}</strong><br>
            Código: ${feature.properties.dpto_ccdgo}
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
        <h4>Colombia - Servicios Geográficos</h4>
        <p>Visualización de departamentos y municipios</p>
        <p><small>Datos: IGAC | Servidor: GeoServer</small></p>
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
    return div;
};

searchControl.addTo(map);

// Función de búsqueda
document.addEventListener('DOMContentLoaded', function() {
    const searchButton = document.getElementById('search-button');
    const searchInput = document.getElementById('search-input');

    searchButton.addEventListener('click', function() {
        const searchText = searchInput.value.toLowerCase();

        departamentosGeoJSON.eachLayer(function(layer) {
            const nombre = layer.feature.properties.dpto_cnmbr.toLowerCase();

            if (nombre.includes(searchText)) {
                map.fitBounds(layer.getBounds());
                layer.openPopup();
            }
        });
    });
});

// Marcador simple
const bogotaMarker = L.marker([4.7110, -74.0721])
    .addTo(map)
    .bindPopup('<b>Bogotá D.C.</b><br>Capital de Colombia');

// Marcador personalizado
const customIcon = L.icon({
    iconUrl: 'assets/images/marker-icon.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34]
});

const marker = L.marker([4.7110, -74.0721], {icon: customIcon})
    .addTo(map)
    .bindPopup('Bogotá');

const popupContent = `
    <div style="text-align: center;">
        <h3>${feature.properties.dpto_cnmbr}</h3>
        <img src="assets/images/${feature.properties.dpto_ccdgo}.jpg" width="200">
        <p><strong>Código:</strong> ${feature.properties.dpto_ccdgo}</p>
        <p><strong>Área:</strong> ${feature.properties.area.toLocaleString()} km²</p>
        <a href="#" onclick="zoomToDepartamento('${feature.properties.dpto_ccdgo}')">Ver detalle</a>
    </div>
`;

layer.bindPopup(popupContent);