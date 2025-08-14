// CLIENT-SIDE: Use your server proxy instead of direct API calls
async function optimizeWithGoogleAPI() {
    try {
        const requestData = prepareOptimizationRequest();
        
        console.log('Calling Route Optimization API via server proxy...');
        console.log('Request data:', JSON.stringify(requestData, null, 2));
        
        // Use your server proxy - NO direct API call to Google
        const response = await fetch('http://localhost:3000/api/optimize', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Server response error:', errorText);
            throw new Error(`Server Error: ${response.status} - ${errorText}`);
        }
        
        const result = await response.json();
        console.log('Route Optimization API Response:', result);
        return processRouteOptimizationResponse(result);
        
    } catch (error) {
        console.error('Route Optimization API Error:', error);
        showStatus(`⚠️ Route Optimization API failed: ${error.message}`, 'warning');
        return await simulateOptimization();
    }
}

// REMOVE the callGoogleRouteOptimization function - don't call Google directly from browser

// Keep the prepareOptimizationRequest function as is
function prepareOptimizationRequest() {
    const maxCapacity = parseInt(document.getElementById('maxCapacity').value);
    const requiredBuses = Math.ceil(studentData.length / maxCapacity);
    
    const shipments = stopsData.map((stop, index) => ({
        pickups: [{
            arrival_location: {
                lat_lng: {
                    latitude: parseFloat(stop.snapped_lat),
                    longitude: parseFloat(stop.snapped_lon)
                }
            },
            duration: "300s",
            load_demands: {
                students: {
                    amount: parseInt(stop.num_students)
                }
            },
            time_windows: [{
                start_time: "2024-01-01T07:00:00Z",
                end_time: "2024-01-01T09:00:00Z"
            }]
        }],
        label: `stop_${stop.cluster_number}`
    }));
    
    const vehicles = [];
    for (let i = 0; i < requiredBuses; i++) {
        vehicles.push({
            start_location: {
                lat_lng: {
                    latitude: COLLEGE_COORDS[0],
                    longitude: COLLEGE_COORDS[1]
                }
            },
            end_location: {
                lat_lng: {
                    latitude: parseFloat(depotsData[i % depotsData.length].Latitude),
                    longitude: parseFloat(depotsData[i % depotsData.length].Longitude)
                }
            },
            load_limits: {
                students: {
                    max_load: maxCapacity
                }
            },
            cost_per_hour: 25.0,
            cost_per_kilometer: 0.5,
            label: `bus_${i + 1}`,
            route_modifiers: {
                avoid_tolls: false,
                avoid_highways: false,
                avoid_ferries: true
            },
            start_time_windows: [{
                start_time: "2024-01-01T06:00:00Z",
                end_time: "2024-01-01T07:00:00Z"
            }],
            end_time_windows: [{
                start_time: "2024-01-01T10:00:00Z",
                end_time: "2024-01-01T12:00:00Z"
            }]
        });
    }
    
    return {
        model: {
            shipments: shipments,
            vehicles: vehicles,
            global_start_time: "2024-01-01T06:00:00Z",
            global_end_time: "2024-01-01T20:00:00Z"
        },
        search_mode: "RETURN_FAST",
        solve_mode: "DEFAULT_SOLVE",
        timeout: "30s",
        interpret_injected_solutions_using_labels: true,
        optimization_objective: {
            global_span_cost_coefficient: 1.0,
            local_span_cost_coefficient: 1.0
        }
    };
}

// Keep your response processing function
function processRouteOptimizationResponse(apiResponse) {
    const routes = [];
    
    if (apiResponse.routes) {
        apiResponse.routes.forEach((route, index) => {
            const routeStops = [];
            let totalStudents = 0;
            
            if (route.visits) {
                route.visits.forEach(visit => {
                    if (visit.shipment_index !== undefined) {
                        const stop = stopsData[visit.shipment_index];
                        if (stop) {
                            routeStops.push(stop);
                            totalStudents += parseInt(stop.num_students);
                        }
                    }
                });
            }
            
            if (routeStops.length > 0) {
                const maxCapacity = parseInt(document.getElementById('maxCapacity').value);
                
                routes.push({
                    busId: `Bus ${index + 1}`,
                    depot: depotsData[index % depotsData.length]['Parking Name'],
                    stops: routeStops,
                    totalStudents: totalStudents,
                    efficiency: `${((totalStudents / maxCapacity) * 100).toFixed(1)}%`,
                    totalDistance: route.route_polyline ? 'Calculated' : 'N/A',
                    totalTime: route.vehicle_start_time && route.vehicle_end_time ? 
                              calculateTimeDifference(route.vehicle_start_time, route.vehicle_end_time) : 'N/A',
                    cost: route.route_cost || 'N/A'
                });
            }
        });
    }
    
    return routes;
}

function calculateTimeDifference(startTime, endTime) {
    try {
        const start = new Date(startTime);
        const end = new Date(endTime);
        const diffMs = end - start;
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        return `${diffHours}h ${diffMins}m`;
    } catch (error) {
        return 'N/A';
    }
}