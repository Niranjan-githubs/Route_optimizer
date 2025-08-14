// Road tracing functionality

// Visualize optimized routes on map with actual road tracing
async function visualizeOptimizedRoutes() {
    if (!map || !optimizationResults.length) return;
    
    // Clear existing route layers
    map.eachLayer((layer) => {
        if (layer instanceof L.Polyline) {
            map.removeLayer(layer);
        }
    });
    
    showStatus('Tracing routes on actual roads...', 'info');
    
    // Draw routes with actual road tracing
    for (let index = 0; index < optimizationResults.length; index++) {
        const route = optimizationResults[index];
        const color = ROUTE_COLORS[index % ROUTE_COLORS.length];
        
        try {
            // Create waypoints for the route
            const waypoints = [];
            
            // Start from college
            waypoints.push(COLLEGE_COORDS);
            
            // Add all stops in the route
            route.stops.forEach(stop => {
                waypoints.push([parseFloat(stop.snapped_lat), parseFloat(stop.snapped_lon)]);
            });
            
            // End at depot
            const depot = depotsData.find(d => d['Parking Name'] === route.depot);
            if (depot) {
                waypoints.push([parseFloat(depot.Latitude), parseFloat(depot.Longitude)]);
            }
            
            // Get actual route from routing service
            const actualRoute = await getActualRoute(waypoints);
            
            if (actualRoute && actualRoute.length > 0) {
                // Create polyline for the actual route
                const polyline = L.polyline(actualRoute, {
                    color: color,
                    weight: 5,
                    opacity: 0.8,
                    smoothFactor: 1,
                    className: `route-${index}`
                }).addTo(map);
                
                // Calculate route metrics
                const distance = calculateRouteDistance(actualRoute);
                const estimatedTime = Math.round(distance * 2.5); // ~2.5 min per km in city traffic
                
                polyline.bindPopup(`<b>${route.busId}</b><br>
                                   Depot: ${route.depot}<br>
                                   Students: ${route.totalStudents}/55<br>
                                   Efficiency: ${route.efficiency}<br>
                                   Stops: ${route.stops.length}<br>
                                   Distance: ${distance.toFixed(1)} km<br>
                                   Est. Time: ${estimatedTime} min<br>
                                   <small>Route follows major roads & highways</small>`);
                
                // Add route markers for waypoints
                waypoints.forEach((waypoint, wpIndex) => {
                    let markerHtml, popupContent;
                    
                    if (wpIndex === 0) {
                        // College marker
                        markerHtml = '<i class="fas fa-university" style="color: #2d3748; font-size: 16px;"></i>';
                        popupContent = `<b>Start: College</b><br>${route.busId}`;
                    } else if (wpIndex === waypoints.length - 1) {
                        // Depot marker
                        markerHtml = `<i class="fas fa-warehouse" style="color: ${color}; font-size: 16px;"></i>`;
                        popupContent = `<b>End: ${route.depot}</b><br>${route.busId}`;
                    } else {
                        // Stop marker
                        const stop = route.stops[wpIndex - 1];
                        markerHtml = `<div style="background: ${color}; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 11px; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);">${stop.num_students}</div>`;
                        popupContent = `<b>Stop ${stop.cluster_number}</b><br>
                                       Students: ${stop.num_students}<br>
                                       Road: ${stop.route_name || 'Unknown'}<br>
                                       ${route.busId}`;
                    }
                    
                    L.marker(waypoint, {
                        icon: L.divIcon({
                            html: markerHtml,
                            iconSize: [24, 24],
                            className: `waypoint-icon route-${index}-marker`
                        }),
                        zIndexOffset: 1000
                    }).addTo(map).bindPopup(popupContent);
                });
                
                // Update route object with actual metrics
                route.actualDistance = distance;
                route.estimatedTime = estimatedTime;
            }
            
        } catch (error) {
            console.error(`Error tracing route ${index + 1}:`, error);
            // Fallback to straight lines if routing fails
            const fallbackCoords = [];
            fallbackCoords.push(COLLEGE_COORDS);
            route.stops.forEach(stop => {
                fallbackCoords.push([parseFloat(stop.snapped_lat), parseFloat(stop.snapped_lon)]);
            });
            
            const depot = depotsData.find(d => d['Parking Name'] === route.depot);
            if (depot) {
                fallbackCoords.push([parseFloat(depot.Latitude), parseFloat(depot.Longitude)]);
            }
            
            L.polyline(fallbackCoords, {
                color: color,
                weight: 3,
                opacity: 0.6,
                dashArray: '10, 5'
            }).addTo(map).bindPopup(`<b>${route.busId}</b><br>
                                    Depot: ${route.depot}<br>
                                    Students: ${route.totalStudents}<br>
                                    Efficiency: ${route.efficiency}<br>
                                    <small>Approximate route (routing failed)</small>`);
        }
    }
    
    showStatus('Route tracing completed!', 'success');
}
