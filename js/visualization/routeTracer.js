// Road tracing functionality

// Visualize optimized routes on map with actual road tracing
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
    window.optimizationResults.forEach((route, index) => {
        if (!route.stops || route.stops.length === 0) {
            console.warn(`Route ${index} has no stops`);
            return;
        }
        
        console.log(`Drawing route ${index + 1} with ${route.stops.length} stops`);
        
        const color = ROUTE_COLORS[index % ROUTE_COLORS.length];
        const coordinates = [];
        
        // Start from college
        coordinates.push(COLLEGE_COORDS);
        
        // Add each stop
        route.stops.forEach(stop => {
            coordinates.push([
                parseFloat(stop.snapped_lat),
                parseFloat(stop.snapped_lon)
            ]);
        });
        
        // Draw route line
        const routeLine = L.polyline(coordinates, {
            color: color,
            weight: 3,
            opacity: 0.8
        }).addTo(window.map);
        
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
    });
    
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