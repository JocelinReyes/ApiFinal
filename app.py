from flask import Flask, render_template, request, jsonify
import requests
from math import radians, sin, cos, sqrt, atan2

app = Flask(__name__)

ORS_API_KEY = '5b3ce3597851110001cf624890499254530e4be7af8b1db44545832a'
ORS_BASE_URL = 'https://api.openrouteservice.org'
MAX_DISTANCE_LIMIT = 6000000  # 6,000 km

FUEL_RATES = {
    'driving': 0.08,
    'scooter': 0.035
}

MODE_MAP = {
    'driving': 'driving-car',
    'walking': 'foot-walking',
    'cycling': 'cycling-regular',
    'wheelchair': 'wheelchair',
    'scooter': 'cycling-regular'
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
            return jsonify({'error': 'Modo de transporte inválido'}), 400

        mode = MODE_MAP[mode_frontend]

        if not is_within_distance_limit(start, end):
            return jsonify({'error': 'La distancia entre los puntos es demasiado grande (más de 6,000 km).'}), 400

        route = get_route(start, end, profile=mode)
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

@app.route('/search_location')
def search_location():
    query = request.args.get('query')
    url = f"{ORS_BASE_URL}/geocode/search"
    headers = {'Authorization': ORS_API_KEY}
    params = {
        'api_key': ORS_API_KEY,
        'text': query,
        'size': 5
    }
    response = requests.get(url, headers=headers, params=params)
    results = response.json().get('features', [])
    return jsonify([{
        'name': r['properties']['label'],
        'coords': r['geometry']['coordinates']
    } for r in results])

def get_route(start, end, profile='driving-car'):
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
        route_summary = data['features'][0]['properties']['summary']
        geometry = data['features'][0]['geometry']
        return {
            'geometry': geometry['coordinates'],
            'distance': route_summary['distance'],
            'duration': route_summary['duration']
        }
    else:
        raise Exception("Error al consultar ruta en ORS")

def is_within_distance_limit(start, end):
    lat1, lon1 = radians(start[1]), radians(start[0])
    lat2, lon2 = radians(end[1]), radians(end[0])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    distance = 6371000 * c
    return distance <= MAX_DISTANCE_LIMIT

if __name__ == '__main__':
    app.run(debug=True)
