let map = L.map('map').setView([19.4326, -99.1332], 13);
let startMarker = null;
let endMarker = null;
let currentMode = 'driving';
let selecting = 'start';
let routeLayer = null;

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
}).addTo(map);

document.getElementById('set-start').addEventListener('click', () => {
    selecting = 'start';
    toggleActive('set-start');
});

document.getElementById('set-end').addEventListener('click', () => {
    selecting = 'end';
    toggleActive('set-end');
});

document.getElementById('clear-markers').addEventListener('click', () => {
    if (startMarker) map.removeLayer(startMarker);
    if (endMarker) map.removeLayer(endMarker);
    if (routeLayer) map.removeLayer(routeLayer);
    startMarker = null;
    endMarker = null;
    currentMode = 'driving';
    document.getElementById('distance').textContent = '-';
    document.getElementById('duration').textContent = '-';
    document.getElementById('fuel').textContent = '-';

    // Limpiar botones activos
    document.querySelectorAll('.transport-icon').forEach(b => b.classList.remove('active'));
    document.querySelector('[data-mode="driving"]').classList.add('active');
});

document.querySelectorAll('.transport-icon').forEach(button => {
    button.addEventListener('click', () => {
        document.querySelectorAll('.transport-icon').forEach(b => b.classList.remove('active'));
        button.classList.add('active');
        currentMode = button.dataset.mode;
        if (startMarker && endMarker) calculateRoute();
    });
});

map.on('click', function (e) {
    const coord = [e.latlng.lng, e.latlng.lat];
    if (selecting === 'start') {
        if (startMarker) map.removeLayer(startMarker);
        startMarker = L.marker(e.latlng).addTo(map).bindPopup('Inicio').openPopup();
    } else {
        if (endMarker) map.removeLayer(endMarker);
        endMarker = L.marker(e.latlng).addTo(map).bindPopup('Destino').openPopup();
    }

    if (startMarker && endMarker) {
        calculateRoute();
    }
});

function toggleActive(id) {
    document.getElementById('set-start').classList.remove('active');
    document.getElementById('set-end').classList.remove('active');
    document.getElementById(id).classList.add('active');
}

async function calculateRoute() {
    const start = [startMarker.getLatLng().lng, startMarker.getLatLng().lat];
    const end = [endMarker.getLatLng().lng, endMarker.getLatLng().lat];

    try {
        const response = await axios.post('/calculate_route', {
            start: start,
            end: end,
            mode: currentMode
        });

        const data = response.data;

        if (routeLayer) map.removeLayer(routeLayer);
        routeLayer = L.polyline(data.geometry.map(coord => [coord[1], coord[0]]), {
            color: 'purple',
            weight: 5,
        }).addTo(map);

        document.getElementById('distance').textContent = (data.distance / 1000).toFixed(2) + ' km';
        document.getElementById('duration').textContent = (data.duration / 60).toFixed(1) + ' min';

        const fuelApplicableModes = ['driving', 'scooter'];
        if (fuelApplicableModes.includes(currentMode)) {
            document.getElementById('fuel').textContent = data.fuel_used.toFixed(2) + ' litros';
        } else {
            document.getElementById('fuel').textContent = 'No aplica';
        }

    } catch (error) {
        console.error(error);
        showToast('Error al calcular la ruta: ' + (error.response?.data?.error || error.message));
    }
}

// --- Mensaje de error visual tipo toast simple ---
function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}
