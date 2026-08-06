// API communication helpers

// Get actual route using OSRM (Open Source Routing Machine) - free alternative
async function getActualRoute(waypoints) {
    try {
        if (waypoints.length < 2) return null;
        
        // Build OSRM API request for driving directions
        const coordinates = waypoints.map(wp => `${wp[1]},${wp[0]}`).join(';');
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=true`;
        
        const response = await fetch(osrmUrl);
        
        if (!response.ok) {
            throw new Error(`OSRM API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.routes && data.routes[0] && data.routes[0].geometry) {
            // Convert GeoJSON coordinates to Leaflet format [lat, lng]
            return data.routes[0].geometry.coordinates.map(coord => [coord[1], coord[0]]);
        }
        
        return null;
        
    } catch (error) {
        console.error('OSRM routing error:', error);
        
        // Fallback to Google Directions API if available
        return await getGoogleDirectionsRoute(waypoints);
    }
}

// Google Directions API fallback (requires API key)
async function getGoogleDirectionsRoute(waypoints) {
    try {
        const apiKey = GOOGLE_API_KEY;
        
        const origin = `${waypoints[0][0]},${waypoints[0][1]}`;
        const destination = `${waypoints[waypoints.length - 1][0]},${waypoints[waypoints.length - 1][1]}`;
        
        let waypointsParam = '';
        if (waypoints.length > 2) {
            const intermediateWaypoints = waypoints.slice(1, -1)
                .map(wp => `${wp[0]},${wp[1]}`)
                .join('|');
            waypointsParam = `&waypoints=optimize:true|${intermediateWaypoints}`;
        }
        
        const googleUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}${waypointsParam}&mode=driving&avoid=tolls&key=${apiKey}`;
        
        const response = await fetch(googleUrl);
        const data = await response.json();
        
        if (data.status === 'OK' && data.routes[0]) {
            // Decode the polyline
            const polyline = data.routes[0].overview_polyline.points;
            return decodePolyline(polyline);
        }
        
        return null;
        
    } catch (error) {
        console.error('Google Directions API error:', error);
        return null;
    }
}

// Error handling for API quotas and limits
function handleAPIError(error) {
    if (error.message.includes('quota')) {
        showStatus('API quota exceeded. Please check your Google Cloud billing.', 'error');
    } else if (error.message.includes('authentication')) {
        showStatus('API authentication failed. Please check your API key.', 'error');
    } else {
        showStatus(`API Error: ${error.message}`, 'error');
    }
}
