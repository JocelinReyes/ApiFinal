from flask import Flask, render_template, request, jsonify
import requests
from math import radians, sin, cos, sqrt, atan2

app = Flask(__name__)

ORS_API_KEY = '5b3ce3597851110001cf624890499254530e4be7af8b1db44545832a'
ORS_BASE_URL = 'https://api.openrouteservice.org'
MAX_DISTANCE_LIMIT = 6000000  # 6,000 km

# Consumo de combustible (litros/km)
FUEL_RATES = {
    'driving': 0.08,
    'scooter': 0.035
}

# Modo frontend a perfil ORS
MODE_MAP = {
    'driving': 'driving-car',
    'walking': 'foot-walking',
    'cycling': 'cycling-regular',
    'wheelchair': 'wheelchair',
    'scooter': 'cycling-regular'  # Se reutiliza el perfil de bici
}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/calculate_route', methods=['POST'])
def calculate_route():
    try:
        data = request.get_json()
        start = data['start']
        end = data['end']
        mode_frontend = data.get('mode', 'driving')

        if mode_frontend not in MODE_MAP:
            return jsonify({'error': f"Modo inválido: '{mode_frontend}'"}), 400

        mode = MODE_MAP[mode_frontend]

        if not is_within_distance_limit(start, end):
            return jsonify({'error': 'Distancia demasiado grande (> 6,000 km)'}), 400

        route = get_route(start, end, mode)
        distance_km = route['distance'] / 1000
        fuel_used = distance_km * FUEL_RATES.get(mode_frontend, 0)

        return jsonify({
            'geometry': route['geometry'],
            'distance': route['distance'],
            'duration': route['duration'],
            'fuel_used': fuel_used
        })

    except Exception as e:
        return jsonify({'error': f"Error interno: {str(e)}"}), 500

def get_route(start, end, profile):
    headers = {
        'Authorization': ORS_API_KEY,
        'Content-Type': 'application/json; charset=utf-8'
    }

    body = {
        "coordinates": [start, end],
        "instructions": False,
        "geometry": True
    }

    url = f"{ORS_BASE_URL}/v2/directions/{profile}/geojson"
    response = requests.post(url, headers=headers, json=body)

    if response.status_code == 200:
        data = response.json()
        summary = data['features'][0]['properties']['summary']
        geometry = data['features'][0]['geometry']
        return {
            'geometry': geometry['coordinates'],
            'distance': summary['distance'],
            'duration': summary['duration']
        }
    else:
        raise Exception(response.text)

def is_within_distance_limit(start, end):
    lat1, lon1 = radians(start[1]), radians(start[0])
    lat2, lon2 = radians(end[1]), radians(end[0])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat / 2)**2 + cos(lat1) * cos(lat2) * sin(dlon / 2)**2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    distance = 6371000 * c
    return distance <= MAX_DISTANCE_LIMIT

if __name__ == '__main__':
    app.run(debug=True)
