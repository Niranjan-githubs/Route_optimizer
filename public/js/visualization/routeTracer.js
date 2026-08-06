// Road tracing functionality
function createStopIcon(color, students) {
    return L.divIcon({
        className: 'custom-stop-icon',
        html: `<div style="background-color: ${color};">${students}</div>`,
        iconSize: [24, 24]
    });
}

// Decode Google polyline (keep this for potential server responses)
function decodePolyline(encoded) {
    const points = [];
    let index = 0, len = encoded.length;
    let lat = 0, lng = 0;

    while (index < len) {
        let b, shift = 0, result = 0;
        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lat += dlat;

        shift = 0;
        result = 0;
        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lng += dlng;

        points.push([lat * 1e-5, lng * 1e-5]);
    }
    return points;
}

// Get actual route using OSRM (free, no CORS issues)
async function getDirections(origin, destination) {
    try {
        // Build OSRM request URL
        const coordinates = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson`;
        
        const response = await fetch(osrmUrl);
        
        if (!response.ok) {
            throw new Error(`OSRM API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.routes && data.routes[0] && data.routes[0].geometry) {
            // Convert GeoJSON coordinates [lng, lat] to Leaflet format [lat, lng]
            return data.routes[0].geometry.coordinates.map(coord => [coord[1], coord[0]]);
        }
        
        throw new Error('No route found');
        
    } catch (error) {
        console.error('OSRM routing error:', error);
        // Fallback to straight line
        return [[origin.lat, origin.lng], [destination.lat, destination.lng]];
    }
}

async function visualizeOptimizedRoutes() {
    console.log('Starting route visualization...');
    
    if (!window.map) {
        console.error('Map not initialized!');
        return;
    }
    
    if (!window.optimizationResults) {
        console.error('No optimization results to visualize!');
        return;
    }
    
    console.log(`Visualizing ${window.optimizationResults.length} routes...`);
    
    // Clear existing routes
    window.map.eachLayer((layer) => {
        if (layer instanceof L.Polyline || (layer instanceof L.Marker && layer.options.title !== 'college')) {
            window.map.removeLayer(layer);
        }
    });
    
    // Draw each route
    for (const [index, route] of window.optimizationResults.entries()) {
        if (!route.stops || route.stops.length === 0) {
            console.warn(`Route ${index} has no stops`);
            continue;
        }
        
        console.log(`Drawing route ${index + 1} with ${route.stops.length} stops`);
        
        const color = ROUTE_COLORS[index % ROUTE_COLORS.length];
        
        // Build waypoints array starting from college
        const waypoints = [
            { lat: COLLEGE_COORDS[0], lng: COLLEGE_COORDS[1] },
            ...route.stops.map(stop => ({
                lat: parseFloat(stop.snapped_lat),
                lng: parseFloat(stop.snapped_lon)
            }))
        ];
        
        // Draw road segments between consecutive waypoints
        for (let i = 0; i < waypoints.length - 1; i++) {
            try {
                const roadCoordinates = await getDirections(waypoints[i], waypoints[i + 1]);
                
                // Draw route segment
                L.polyline(roadCoordinates, {
                    color: color,
                    weight: 3,
                    opacity: 0.8
                }).addTo(window.map);
                
                // Small delay to avoid overwhelming the OSRM server
                await new Promise(resolve => setTimeout(resolve, 100));
                
            } catch (error) {
                console.error(`Error getting directions for route ${index + 1}, segment ${i}:`, error);
                
                // Fallback to straight line for this segment
                L.polyline([
                    [waypoints[i].lat, waypoints[i].lng],
                    [waypoints[i + 1].lat, waypoints[i + 1].lng]
                ], {
                    color: color,
                    weight: 3,
                    opacity: 0.8,
                    dashArray: '5, 5' // Dashed to indicate fallback
                }).addTo(window.map);
            }
        }
        
        // Add markers for stops
        route.stops.forEach((stop, stopIndex) => {
            const marker = L.marker([
                parseFloat(stop.snapped_lat),
                parseFloat(stop.snapped_lon)
            ], {
                icon: createStopIcon(color, stop.num_students)
            }).addTo(window.map);
            
            marker.bindPopup(`
                <b>${route.busId} - Stop ${stopIndex + 1}</b><br>
                Students: ${stop.num_students}<br>
                Distance: ${stop.distance?.toFixed(1) || 'N/A'} km
            `);
        });
    }
    
    // Fit map to show all routes
    const allCoords = window.optimizationResults.flatMap(route => 
        route.stops.map(stop => [
            parseFloat(stop.snapped_lat),
            parseFloat(stop.snapped_lon)
        ])
    );
    if (allCoords.length > 0) {
        window.map.fitBounds(L.latLngBounds(allCoords));
    }
    
    console.log('Route visualization complete');
}