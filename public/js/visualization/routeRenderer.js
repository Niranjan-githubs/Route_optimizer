// Route visualization
// Visualize current data on map
function visualizeData() {
    if (!map || !stopsData.length || !depotsData.length) {
        showStatus('Please load data first', 'error');
        return;
    }
    
    // Clear existing markers except college
    map.eachLayer((layer) => {
        if (layer instanceof L.Marker && layer.options.title !== 'college') {
            map.removeLayer(layer);
        }
    });
    
    // Add bus stop markers
    stopsData.forEach((stop, index) => {
        const lat = parseFloat(stop.snapped_lat);
        const lon = parseFloat(stop.snapped_lon);
        const students = parseInt(stop.num_students);
        
        L.marker([lat, lon], {
            icon: L.divIcon({
                html: `<div style="background: #4299e1; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);">${students}</div>`,
                iconSize: [30, 30],
                className: 'stop-icon'
            })
        }).addTo(map)
          .bindPopup(`<b>Stop ${stop.cluster_number}</b><br>
                     Students: ${students}<br>
                     Route: ${stop.route_name || 'Unknown'}<br>
                     Type: ${stop.route_type || 'Unknown'}`);
    });
    
    // Add depot markers
    depotsData.forEach((depot, index) => {
        const lat = parseFloat(depot.Latitude);
        const lon = parseFloat(depot.Longitude);
        const capacity = parseInt(depot.Counts);
        
        L.marker([lat, lon], {
            icon: L.divIcon({
                html: `<i class="fas fa-warehouse" style="color: #e53e3e; font-size: 20px;"></i>`,
                iconSize: [30, 30],
                className: 'depot-icon'
            })
        }).addTo(map)
          .bindPopup(`<b>${depot['Parking Name']}</b><br>
                     Capacity: ${capacity} buses<br>
                     Coordinates: ${lat.toFixed(4)}, ${lon.toFixed(4)}`);
    });
    
    // Fit map to show all markers
    const group = new L.featureGroup();
    map.eachLayer((layer) => {
        if (layer instanceof L.Marker) {
            group.addLayer(layer);
        }
    });
    
    if (group.getLayers().length > 0) {
        map.fitBounds(group.getBounds().pad(0.1));
    }
}

// Display optimization results
function displayResults() {
    const routesList = document.getElementById('routesList');
    routesList.innerHTML = '';
    
    optimizationResults.forEach((route, index) => {
        const color = ROUTE_COLORS[index % ROUTE_COLORS.length];
        const routeItem = document.createElement('div');
        routeItem.className = 'route-item';
        routeItem.style.borderLeftColor = color;
        
        const stopsList = route.stops.map(stop => 
            `Stop ${stop.cluster_number} (${stop.num_students} students)`
        ).join(', ');

        const distanceInfo = route.actualDistance ?
            `<p><strong>RouteDistance: </strong> ${route.actualDistance.toFixed(1)} km</p>
            <p><strong>Est. time: </strong> ${route.estimatedTime} min</p>` : '';
        
        routeItem.innerHTML = `
            <h5 style="color: ${color};">${route.busId}</h5>
            <p><strong>Depot:</strong> ${route.depot}</p>
            <p><strong>Total Students:</strong> ${route.totalStudents}/55 (${route.efficiency})</p>
            ${distanceInfo}
            <p><strong>Stops (${route.stops.length}):</strong> ${stopsList}</p>
            <p><strong>Route Type:</strong> Major roads and highways prioritized</p>
        `;
        
        routesList.appendChild(routeItem);
    });
    
    document.getElementById('resultsPanel').style.display = 'block';
}

