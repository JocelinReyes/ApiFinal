let map = L.map('map').setView([19.4326, -99.1332], 13);
let startMarker = null;
let endMarker = null;
let currentMode = 'driving';
let routeLayer = null;

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18,
}).addTo(map);

document.querySelectorAll('.transport-icon').forEach((button) => {
  button.addEventListener('click', () => {
    document
      .querySelectorAll('.transport-icon')
      .forEach((b) => b.classList.remove('active'));
    button.classList.add('active');
    currentMode = button.dataset.mode;
    if (startMarker && endMarker) calculateRoute();
  });
});

function createSuggestionItem(text, latlng, container, input, markerType) {
  const div = document.createElement('div');
  div.className = 'suggestion-item';
  div.textContent = text;
  div.onclick = () => {
    input.value = text;
    container.innerHTML = '';
    if (markerType === 'start') {
      if (startMarker) map.removeLayer(startMarker);
      startMarker = L.marker(latlng).addTo(map).bindPopup('Inicio').openPopup();
    } else {
      if (endMarker) map.removeLayer(endMarker);
      endMarker = L.marker(latlng).addTo(map).bindPopup('Destino').openPopup();
    }
    map.setView(latlng, 14);
    if (startMarker && endMarker) calculateRoute();
  };
  container.appendChild(div);
}

async function fetchSuggestions(query) {
  if (!query) return [];
  try {
    const res = await axios.get('/search_location', { params: { query } });
    return res.data;
  } catch {
    return [];
  }
}

function setupAutocomplete(inputId, suggestionId, markerType) {
  const input = document.getElementById(inputId);
  const suggestionBox = document.getElementById(suggestionId);

  input.addEventListener('input', async () => {
    const query = input.value.trim();
    suggestionBox.innerHTML = '';
    if (!query) return;

    const results = await fetchSuggestions(query);
    results.forEach(r => {
      const coords = [r.coords[1], r.coords[0]];
      createSuggestionItem(r.name, coords, suggestionBox, input, markerType);
    });
  });

  input.addEventListener('blur', () => {
    setTimeout(() => {
      suggestionBox.innerHTML = '';
    }, 150);
  });
}

setupAutocomplete('start-search', 'start-suggestions', 'start');
setupAutocomplete('end-search', 'end-suggestions', 'end');

async function calculateRoute() {
  if (!startMarker || !endMarker) return;

  const start = [startMarker.getLatLng().lng, startMarker.getLatLng().lat];
  const end = [endMarker.getLatLng().lng, endMarker.getLatLng().lat];
  const speed = Number(document.getElementById('speed').value);
  const maxTime = Number(document.getElementById('max-time').value);

  if (speed <= 0 || maxTime <= 0) {
    showToast('Velocidad y tiempo máximo deben ser positivos.');
    return;
  }

  try {
    const res = await axios.post('/calculate_route', {
      start: start,
      end: end,
      mode: currentMode,
    });

    const data = res.data;
    if (routeLayer) map.removeLayer(routeLayer);

    // Duración estimada ajustada con velocidad ingresada (minutos)
    const duration_hours = (data.distance / 1000) / speed;
    const duration_min = duration_hours * 60;

    if (duration_min > maxTime) {
      showToast(
        `La ruta dura ${duration_min.toFixed(
          1
        )} min, que excede el tiempo máximo permitido (${maxTime} min).`
      );
      return;
    }

    routeLayer = L.polyline(data.geometry.map((c) => [c[1], c[0]]), {
      color: 'purple',
      weight: 5,
    }).addTo(map);

    document.getElementById('distance').textContent = (data.distance / 1000).toFixed(2) + ' km';
    document.getElementById('duration').textContent = duration_min.toFixed(1) + ' min';
    document.getElementById('fuel').textContent =
      data.fuel_used > 0 ? data.fuel_used.toFixed(2) + ' L' : 'No aplica';
  } catch (error) {
    showToast(error.response?.data?.error || 'Error al calcular la ruta');
  }
}

function showToast(msg) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}
