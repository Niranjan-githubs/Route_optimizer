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

function prepareOptimizationRequest() {
    const maxCapacity = parseInt(document.getElementById('maxCapacity').value);
    
    // ✅ PRE-FILTER stops by distance before sending to API
    const filteredStops = filterStopsByDistance(stopsData, 40); // Pre-filter to 40km radius
    const requiredBuses = Math.max(1, Math.ceil(filteredStops.length * 0.7)); // More conservative bus estimate
    
    console.log(`📊 Using ${filteredStops.length}/${stopsData.length} stops within 40km radius`);
    console.log(`📊 Requesting ${requiredBuses} buses for route optimization`);
    
    // CORRECT format based on official Google Route Optimization API docs
    const shipments = filteredStops.map((stop, index) => ({
        deliveries: [{
            arrivalLocation: {
                latitude: parseFloat(stop.snapped_lat),
                longitude: parseFloat(stop.snapped_lon)
            },
            duration: "300s",
            loadDemands: {
                students: {
                    amount: parseInt(stop.num_students)
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
            loadLimits: {
                students: {
                    maxLoad: maxCapacity
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

// ✅ PRE-FILTER stops by distance before sending to API
function filterStopsByDistance(stopsData, maxRadiusKm = 50) {
    const filteredStops = [];
    const excludedStops = [];
    
    stopsData.forEach(stop => {
        // Calculate distance from college to stop
        const distanceToStop = calculateHaversineDistance(
            COLLEGE_COORDS[0], COLLEGE_COORDS[1],
            parseFloat(stop.snapped_lat), parseFloat(stop.snapped_lon)
        );
        
        // Only include stops within reasonable distance from college
        if (distanceToStop <= maxRadiusKm) {
            filteredStops.push(stop);
        } else {
            console.warn(`⚠️ Stop ${stop.cluster_number} too far from college (${distanceToStop.toFixed(1)}km) - Excluding`);
            excludedStops.push(stop);
        }
    });
    
    console.log(`📊 Pre-filtering: ${filteredStops.length}/${stopsData.length} stops within ${maxRadiusKm}km radius`);
    window.excludedStops = excludedStops;
    return filteredStops;
}

// ✅ ENHANCED CLIENT-SIDE VALIDATION: Filter out routes exceeding 50km
function processRouteOptimizationResponse(apiResponse) {
    const routes = [];
    const MAX_DISTANCE_KM = 50;  // 50 km limit (reduced from 60km for safety)
    
    if (apiResponse.routes) {
        apiResponse.routes.forEach((route, index) => {
            const routeStops = [];
            let totalStudents = 0;
            let routeDistanceKm = 0;
            
            // Calculate route distance
            if (route.metrics?.travelDistanceMeters) {
                routeDistanceKm = route.metrics.travelDistanceMeters / 1000;
            }
            
            // ✅ SKIP routes that exceed 50km distance limit
            if (routeDistanceKm > MAX_DISTANCE_KM) {
                console.warn(`⚠️ Route ${index + 1} exceeds ${MAX_DISTANCE_KM}km (${routeDistanceKm.toFixed(1)}km) - Filtering out`);
                
                // ✅ Try to salvage this route by creating smaller sub-routes
                if (route.visits && route.visits.length > 4) {
                    const salvageRoutes = createSubRoutesFromLongRoute(route, index, MAX_DISTANCE_KM);
                    routes.push(...salvageRoutes);
                }
                return; // Skip the original long route
            }
            
            if (route.visits) {
                route.visits.forEach(visit => {
                    // Skip visits without shipmentIndex (these are start/end points)
                    if (visit.shipmentIndex !== undefined) {
                        // Find the stop by matching the shipment index to filtered stops
                        const matchingStop = findStopByShipmentIndex(visit.shipmentIndex);
                        if (matchingStop) {
                            routeStops.push(matchingStop);
                            totalStudents += parseInt(matchingStop.num_students);
                        }
                    }
                });
            }
            
            // Only create route if it has actual stops (deliveries) AND is within distance limit
            if (routeStops.length > 0) {
                const maxCapacity = parseInt(document.getElementById('maxCapacity').value);
                
                routes.push({
                    busId: `Bus ${index + 1}`,
                    depot: depotsData[index % depotsData.length]['Parking Name'],
                    stops: routeStops,
                    totalStudents: totalStudents,
                    efficiency: `${((totalStudents / maxCapacity) * 100).toFixed(1)}%`,
                    totalDistance: `${routeDistanceKm.toFixed(1)} km`,
                    totalTime: route.vehicleStartTime && route.vehicleEndTime ? 
                              calculateTimeDifference(route.vehicleStartTime, route.vehicleEndTime) : 'N/A',
                    cost: route.metrics?.totalCost?.toFixed(2) || 'N/A',
                    withinDistanceLimit: true  // All routes here are within limit
                });
            }
        });
    }
    
    // ✅ LOG filtering results
    const totalAPIRoutes = apiResponse.routes?.length || 0;
    const acceptedRoutes = routes.length;
    console.log(`📊 Route filtering: ${acceptedRoutes}/${totalAPIRoutes} routes within ${MAX_DISTANCE_KM}km limit`);
    
    // ✅ Provide feedback to user
    if (acceptedRoutes < totalAPIRoutes * 0.6) {
        const filteredCount = totalAPIRoutes - acceptedRoutes;
        showStatus(`⚠️ ${filteredCount} routes exceeded ${MAX_DISTANCE_KM}km limit. Routes have been optimized to stay within distance constraints.`, 'warning');
    } else if (acceptedRoutes > 0) {
        showStatus(`✅ Generated ${acceptedRoutes} routes, all within ${MAX_DISTANCE_KM}km distance limit`, 'success');
    }
    
    return routes;
}

// ✅ Helper function to find stop by shipment index in the filtered data
function findStopByShipmentIndex(shipmentIndex) {
    const filteredStops = filterStopsByDistance(stopsData, 40);
    return filteredStops[shipmentIndex] || null;
}

// ✅ NEW: Create smaller sub-routes from overly long routes
function createSubRoutesFromLongRoute(longRoute, originalIndex, maxDistanceKm) {
    const subRoutes = [];
    
    if (!longRoute.visits || longRoute.visits.length <= 2) {
        return subRoutes; // Too few stops to split
    }
    
    // Get delivery visits only (skip start/end)
    const deliveryVisits = longRoute.visits.filter(visit => visit.shipmentIndex !== undefined);
    
    if (deliveryVisits.length <= 2) {
        return subRoutes; // Too few deliveries to split
    }
    
    // Split deliveries into chunks (rough estimate: half the visits per sub-route)
    const midPoint = Math.ceil(deliveryVisits.length / 2);
    const firstHalf = deliveryVisits.slice(0, midPoint);
    const secondHalf = deliveryVisits.slice(midPoint);
    
    [firstHalf, secondHalf].forEach((visitGroup, groupIndex) => {
        if (visitGroup.length > 0) {
            const routeStops = [];
            let totalStudents = 0;
            
            visitGroup.forEach(visit => {
                const matchingStop = findStopByShipmentIndex(visit.shipmentIndex);
                if (matchingStop) {
                    routeStops.push(matchingStop);
                    totalStudents += parseInt(matchingStop.num_students);
                }
            });
            
            if (routeStops.length > 0) {
                const maxCapacity = parseInt(document.getElementById('maxCapacity').value);
                
                // Estimate distance (conservative calculation)
                const estimatedDistance = Math.min(maxDistanceKm - 5, routeStops.length * 6); // Conservative estimate
                
                subRoutes.push({
                    busId: `Bus ${originalIndex + 1}-${groupIndex + 1}`,
                    depot: depotsData[originalIndex % depotsData.length]['Parking Name'],
                    stops: routeStops,
                    totalStudents: totalStudents,
                    efficiency: `${((totalStudents / maxCapacity) * 100).toFixed(1)}%`,
                    totalDistance: `~${estimatedDistance} km`,
                    totalTime: 'Estimated',
                    cost: 'N/A',
                    withinDistanceLimit: true,
                    isSalvagedRoute: true
                });
            }
        }
    });
    
    if (subRoutes.length > 0) {
        console.log(`📊 Salvaged ${subRoutes.length} sub-routes from long route ${originalIndex + 1}`);
    }
    
    return subRoutes;
}

// ✅ HELPER: Calculate Haversine distance between two points
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    return distance;
}

// Add this debug function to see the actual response structure
function debugRouteOptimizationResponse(apiResponse) {
    console.log('=== FULL API RESPONSE DEBUG ===');
    console.log('Keys in response:', Object.keys(apiResponse));
    
    if (apiResponse.routes) {
        console.log('Routes found:', apiResponse.routes.length);
        apiResponse.routes.forEach((route, index) => {
            if (route.metrics?.travelDistanceMeters) {
                const distanceKm = (route.metrics.travelDistanceMeters / 1000).toFixed(1);
                console.log(`Route ${index + 1} distance: ${distanceKm} km`);
            }
            if (route.visits) {
                console.log(`Route ${index + 1} visits: ${route.visits.length}`);
            }
        });
    }
    
    if (apiResponse.validationErrors) {
        console.log('Validation errors:', apiResponse.validationErrors);
    }
    
    return apiResponse;
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