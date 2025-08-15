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

function prepareOptimizationRequest() {
    const maxCapacity = parseInt(document.getElementById('maxCapacity').value);
    const requiredBuses = Math.ceil(studentData.length / maxCapacity);
    
    // CORRECT format based on official Google Route Optimization API docs
    const shipments = stopsData.map((stop, index) => ({
        deliveries: [{
            arrivalLocation: {
                latitude: parseFloat(stop.snapped_lat),
                longitude: parseFloat(stop.snapped_lon)
            },
            duration: "300s",
            loadDemands: {           // ✅ Object with type as key
                students: {          // ✅ Load type as key
                    amount: parseInt(stop.num_students)  // ✅ Use "amount" field
                }
            }
        }],
        label: `stop_${stop.cluster_number}`
    }));
    
    const vehicles = [];
    for (let i = 0; i < requiredBuses; i++) {
        vehicles.push({
            startLocation: {
                latitude: COLLEGE_COORDS[0],
                longitude: COLLEGE_COORDS[1]
            },
            endLocation: {
                latitude: parseFloat(depotsData[i % depotsData.length].Latitude),
                longitude: parseFloat(depotsData[i % depotsData.length].Longitude)
            },
            loadLimits: {           // ✅ Object with type as key
                students: {         // ✅ Load type as key  
                    maxLoad: maxCapacity  // ✅ Use "maxLoad" field
                }
            },
            label: `bus_${i + 1}`,
            routeModifiers: {
                avoidTolls: false,
                avoidHighways: false,
                avoidFerries: true
            }
        });
    }
    
    return {
        model: {
            shipments: shipments,
            vehicles: vehicles,
            globalStartTime: "2024-01-01T08:00:00Z",
            globalEndTime: "2024-01-01T20:00:00Z"
        },
        searchMode: "RETURN_FAST"
    };
}

// Add this debug function to see the actual response structure
function debugRouteOptimizationResponse(apiResponse) {
    console.log('=== FULL API RESPONSE DEBUG ===');
    console.log('Keys in response:', Object.keys(apiResponse));
    console.log('Full response:', JSON.stringify(apiResponse, null, 2));
    
    if (apiResponse.routes) {
        console.log('Routes found:', apiResponse.routes.length);
        apiResponse.routes.forEach((route, index) => {
            console.log(`Route ${index}:`, Object.keys(route));
            if (route.visits) {
                console.log(`Route ${index} visits:`, route.visits.length);
                route.visits.forEach((visit, visitIndex) => {
                    console.log(`Visit ${visitIndex}:`, Object.keys(visit));
                    console.log(`Visit ${visitIndex} data:`, visit);
                });
            }
        });
    }
    
    if (apiResponse.validationErrors) {
        console.log('Validation errors:', apiResponse.validationErrors);
    }
    
    return apiResponse;
}

function processRouteOptimizationResponse(apiResponse) {
    const routes = [];
    
    if (apiResponse.routes) {
        apiResponse.routes.forEach((route, index) => {
            const routeStops = [];
            let totalStudents = 0;
            
            if (route.visits) {
                route.visits.forEach(visit => {
                    // Skip visits without shipmentIndex (these are start/end points)
                    if (visit.shipmentIndex !== undefined) {
                        const stop = stopsData[visit.shipmentIndex];
                        if (stop) {
                            routeStops.push(stop);
                            totalStudents += parseInt(stop.num_students);
                        }
                    }
                });
            }
            
            // Only create route if it has actual stops (deliveries)
            if (routeStops.length > 0) {
                const maxCapacity = parseInt(document.getElementById('maxCapacity').value);
                
                routes.push({
                    busId: `Bus ${index + 1}`,
                    depot: depotsData[index % depotsData.length]['Parking Name'],
                    stops: routeStops,
                    totalStudents: totalStudents,
                    efficiency: `${((totalStudents / maxCapacity) * 100).toFixed(1)}%`,
                    totalDistance: route.metrics?.travelDistanceMeters ? 
                                  `${(route.metrics.travelDistanceMeters / 1000).toFixed(1)} km` : 'N/A',
                    totalTime: route.vehicleStartTime && route.vehicleEndTime ? 
                              calculateTimeDifference(route.vehicleStartTime, route.vehicleEndTime) : 'N/A',
                    cost: route.metrics?.totalCost?.toFixed(2) || 'N/A'
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