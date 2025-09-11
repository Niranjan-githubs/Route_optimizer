// ===== DROPPED STOPS TRACKING SYSTEM =====
let droppedStopsTracker = {
    allDroppedStops: [],
    reasons: {
        DISTANCE_FILTER: 'Distance from college exceeds limit',
        CLUSTER_REJECTED: 'Cluster failed validation (bearing/straightness/backtracking)',
        BACKTRACKING_REMOVAL: 'Removed due to sharp turns causing backtracking',
        ROUTE_LENGTH_EXCEEDED: 'Route exceeded maximum distance limit',
        NETWORK_SNAP_FAILED: 'Could not snap to bus network',
        UNASSIGNED: 'Not assigned to any route',
        SALVAGE_FAILED: 'Could not be salvaged into a route',
        CAPACITY_EXCEEDED: 'Exceeded bus capacity limits',
        INVALID_COORDINATES: 'Invalid or missing coordinates'
    }
};

// Function to add a dropped stop with reason
function trackDroppedStop(stop, reason, additionalInfo = {}) {
    const droppedStop = {
        cluster_number: stop.cluster_number || stop.id || 'unknown',
        original_lat: stop.original_lat || stop.snapped_lat,
        original_lon: stop.original_lon || stop.snapped_lon,
        snapped_lat: stop.snapped_lat,
        snapped_lon: stop.snapped_lon,
        num_students: stop.num_students || 0,
        route_name: stop.route_name || 'unknown',
        route_type: stop.route_type || 'unknown',
        snap_distance_meters: stop.snap_distance_meters || 0,
        reason: reason,
        reason_description: droppedStopsTracker.reasons[reason] || reason,
        additional_info: JSON.stringify(additionalInfo),
        dropped_at: new Date().toISOString(),
        distance_from_college_km: stop.distance_from_college_km || 
            (stop.snapped_lat && stop.snapped_lon ? 
                calculateHaversineDistance(COLLEGE_COORDS[0], COLLEGE_COORDS[1], 
                    parseFloat(stop.snapped_lat), parseFloat(stop.snapped_lon)) : null)
    };
    
    droppedStopsTracker.allDroppedStops.push(droppedStop);
    console.log(`📋 Tracked dropped stop ${droppedStop.cluster_number}: ${reason}`);
}

// Function to export dropped stops as CSV
function exportDroppedStopsAsCSV() {
    if (droppedStopsTracker.allDroppedStops.length === 0) {
        console.log('✅ No dropped stops to export');
        return null;
    }
    
    const headers = [
        'cluster_number', 'original_lat', 'original_lon', 'snapped_lat', 'snapped_lon',
        'num_students', 'route_name', 'route_type', 'snap_distance_meters',
        'reason', 'reason_description', 'additional_info', 'dropped_at', 'distance_from_college_km'
    ];
    
    const csvContent = [
        headers.join(','),
        ...droppedStopsTracker.allDroppedStops.map(stop => 
            headers.map(header => {
                const value = stop[header] || '';
                // Escape commas and quotes in CSV
                return typeof value === 'string' && (value.includes(',') || value.includes('"')) 
                    ? `"${value.replace(/"/g, '""')}"` 
                    : value;
            }).join(',')
        )
    ].join('\n');
    
    // Create and download CSV file
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dropped_stops_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    console.log(`📊 Exported ${droppedStopsTracker.allDroppedStops.length} dropped stops to CSV`);
    return csvContent;
}

// Function to get dropped stops summary
function getDroppedStopsSummary() {
    const summary = {
        total_dropped: droppedStopsTracker.allDroppedStops.length,
        total_students_dropped: droppedStopsTracker.allDroppedStops.reduce((sum, stop) => 
            sum + parseInt(stop.num_students || 0), 0),
        by_reason: {}
    };
    
    // Group by reason
    droppedStopsTracker.allDroppedStops.forEach(stop => {
        if (!summary.by_reason[stop.reason]) {
            summary.by_reason[stop.reason] = {
                count: 0,
                students: 0,
                stops: []
            };
        }
        summary.by_reason[stop.reason].count++;
        summary.by_reason[stop.reason].students += parseInt(stop.num_students || 0);
        summary.by_reason[stop.reason].stops.push(stop.cluster_number);
    });
    
    return summary;
}

// Manual export functions (call these from browser console)
window.exportDroppedStops = exportDroppedStopsAsCSV;
window.getDroppedStopsSummary = getDroppedStopsSummary;
window.getDroppedStopsData = () => droppedStopsTracker.allDroppedStops;

// CLIENT-SIDE: Use your server proxy instead of direct API calls
async function optimizeWithGoogleAPI() {
    try {
        console.log('🎯 Starting enhanced route optimization with multi-strategy approach...');
        
        // Clear previous dropped stops tracking
        droppedStopsTracker.allDroppedStops = [];
        
        // Use the new getBusOptimizedRoutes function instead of the old approach
        const optimizedRoutes = await getBusOptimizedRoutes();
        
        if (!optimizedRoutes || optimizedRoutes.length === 0) {
            throw new Error('No valid routes generated');
        }
        
        console.log(`✅ Generated ${optimizedRoutes.length} optimized routes`);
        
        // Export dropped stops if any
        if (droppedStopsTracker.allDroppedStops.length > 0) {
            const summary = getDroppedStopsSummary();
            console.log('📊 DROPPED STOPS SUMMARY:', summary);
            exportDroppedStopsAsCSV();
        }
        
        return optimizedRoutes;
        
    } catch (error) {
        console.error('Route Optimization API Error:', error);
        showStatus(`⚠️ Route Optimization API failed: ${error.message}`, 'warning');
        return await simulateOptimization();
    }
}

// Function to add a dropped stop with reason
function trackDroppedStop(stop, reason, additionalInfo = {}) {
    const droppedStop = {
        cluster_number: stop.cluster_number || stop.id || 'unknown',
        original_lat: stop.original_lat || stop.snapped_lat,
        original_lon: stop.original_lon || stop.snapped_lon,
        snapped_lat: stop.snapped_lat,
        snapped_lon: stop.snapped_lon,
        num_students: stop.num_students || 0,
        route_name: stop.route_name || 'unknown',
        route_type: stop.route_type || 'unknown',
        snap_distance_meters: stop.snap_distance_meters || 0,
        reason: reason,
        reason_description: droppedStopsTracker.reasons[reason] || reason,
        additional_info: additionalInfo,
        dropped_at: new Date().toISOString(),
        distance_from_college_km: stop.distance_from_college_km || 
            (stop.snapped_lat && stop.snapped_lon ? 
                calculateHaversineDistance(COLLEGE_COORDS[0], COLLEGE_COORDS[1], 
                    parseFloat(stop.snapped_lat), parseFloat(stop.snapped_lon)) : null)
    };
    
    droppedStopsTracker.allDroppedStops.push(droppedStop);
    console.log(`📋 Tracked dropped stop ${droppedStop.cluster_number}: ${reason}`);
}

// Function to export dropped stops as CSV
function exportDroppedStopsAsCSV() {
    if (droppedStopsTracker.allDroppedStops.length === 0) {
        console.log('✅ No dropped stops to export');
        return null;
    }
    
    const headers = [
        'cluster_number', 'original_lat', 'original_lon', 'snapped_lat', 'snapped_lon',
        'num_students', 'route_name', 'route_type', 'snap_distance_meters',
        'reason', 'reason_description', 'additional_info', 'dropped_at', 'distance_from_college_km'
    ];
    
    const csvContent = [
        headers.join(','),
        ...droppedStopsTracker.allDroppedStops.map(stop => 
            headers.map(header => {
                const value = stop[header] || '';
                // Escape commas and quotes in CSV
                return typeof value === 'string' && (value.includes(',') || value.includes('"')) 
                    ? `"${value.replace(/"/g, '""')}"` 
                    : value;
            }).join(',')
        )
    ].join('\n');
    
    // Create and download CSV file
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dropped_stops_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    console.log(`�� Exported ${droppedStopsTracker.allDroppedStops.length} dropped stops to CSV`);
    return csvContent;
}

//-------DROPPED STOPS TRACKING SYSTEM -------

// Function to get dropped stops summary
function getDroppedStopsSummary() {
    const summary = {
        total_dropped: droppedStopsTracker.allDroppedStops.length,
        total_students_dropped: droppedStopsTracker.allDroppedStops.reduce((sum, stop) => 
            sum + parseInt(stop.num_students || 0), 0),
        by_reason: {}
    };
    
    // Group by reason
    droppedStopsTracker.allDroppedStops.forEach(stop => {
        if (!summary.by_reason[stop.reason]) {
            summary.by_reason[stop.reason] = {
                count: 0,
                students: 0,
                stops: []
            };
        }
        summary.by_reason[stop.reason].count++;
        summary.by_reason[stop.reason].students += parseInt(stop.num_students || 0);
        summary.by_reason[stop.reason].stops.push(stop.cluster_number);
    });
    
    return summary;
}

function trackDroppedStop(stop, reason, additionalInfo = {}) {
    const droppedStop = {
        cluster_number: stop.cluster_number || stop.id || 'unknown',
        original_lat: stop.original_lat || stop.snapped_lat,
        original_lon: stop.original_lon || stop.snapped_lon,
        snapped_lat: stop.snapped_lat,
        snapped_lon: stop.snapped_lon,
        num_students: stop.num_students || 0,
        route_name: stop.route_name || 'unknown',
        route_type: stop.route_type || 'unknown',
        snap_distance_meters: stop.snap_distance_meters || 0,
        reason: reason,
        reason_description: droppedStopsTracker.reasons[reason] || reason,
        additional_info: additionalInfo,
        dropped_at: new Date().toISOString(),
        distance_from_college_km: stop.distance_from_college_km || 
            (stop.snapped_lat && stop.snapped_lon ? 
                calculateHaversineDistance(COLLEGE_COORDS[0], COLLEGE_COORDS[1], 
                    parseFloat(stop.snapped_lat), parseFloat(stop.snapped_lon)) : null)
    };
    
    droppedStopsTracker.allDroppedStops.push(droppedStop);
    console.log(`📋 Tracked dropped stop ${droppedStop.cluster_number}: ${reason}`);
}


// Function to export dropped stops as CSV
function exportDroppedStopsAsCSV() {
    if (droppedStopsTracker.allDroppedStops.length === 0) {
        console.log('✅ No dropped stops to export');
        return null;
    }
    
    const headers = [
        'cluster_number', 'original_lat', 'original_lon', 'snapped_lat', 'snapped_lon',
        'num_students', 'route_name', 'route_type', 'snap_distance_meters',
        'reason', 'reason_description', 'additional_info', 'dropped_at', 'distance_from_college_km'
    ];
    
    const csvContent = [
        headers.join(','),
        ...droppedStopsTracker.allDroppedStops.map(stop => 
            headers.map(header => {
                const value = stop[header] || '';
                // Escape commas and quotes in CSV
                return typeof value === 'string' && (value.includes(',') || value.includes('"')) 
                    ? `"${value.replace(/"/g, '""')}"` 
                    : value;
            }).join(',')
        )
    ].join('\n');
    
    // Create and download CSV file
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dropped_stops_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    console.log(`�� Exported ${droppedStopsTracker.allDroppedStops.length} dropped stops to CSV`);
    return csvContent;
}

// Function to get dropped stops summary
function getDroppedStopsSummary() {
    const summary = {
        total_dropped: droppedStopsTracker.allDroppedStops.length,
        total_students_dropped: droppedStopsTracker.allDroppedStops.reduce((sum, stop) => 
            sum + parseInt(stop.num_students || 0), 0),
        by_reason: {}
    };
    
    // Group by reason
    droppedStopsTracker.allDroppedStops.forEach(stop => {
        if (!summary.by_reason[stop.reason]) {
            summary.by_reason[stop.reason] = {
                count: 0,
                students: 0,
                stops: []
            };
        }
        summary.by_reason[stop.reason].count++;
        summary.by_reason[stop.reason].students += parseInt(stop.num_students || 0);
        summary.by_reason[stop.reason].stops.push(stop.cluster_number);
    });
    
    return summary;
}

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
            
            // Track the dropped stop
            trackDroppedStop(stop, 'DISTANCE_FILTER', {
                distance_km: distanceToStop,
                max_allowed_km: maxRadiusKm
            });
        }
    });
    
    console.log(`📊 Pre-filtering: ${filteredStops.length}/${stopsData.length} stops within ${maxRadiusKm}km radius`);
    window.excludedStops = excludedStops;
    return filteredStops;
}



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

// ✅ FIXED: Better Bus Calculation and Efficient Route Request
function prepareOptimizationRequest() {
    const maxCapacity = parseInt(document.getElementById('maxCapacity').value) || 55;
    
    // Pre-filter stops by distance
    const filteredStops = filterStopsByDistance(stopsData, 40);
    
    // ✅ BETTER BUS CALCULATION: Based on total students / 55 (as you mentioned)
    const totalStudents = filteredStops.reduce((sum, stop) => sum + parseInt(stop.num_students), 0);
    const requiredBuses = Math.min(16, Math.max(1, Math.ceil(totalStudents / 55))); // Cap at 16 buses max
    
    console.log(`📊 Using ${filteredStops.length}/${stopsData.length} stops within 40km radius`);
    console.log(`📊 Total students: ${totalStudents}, requiring ${requiredBuses} buses (${totalStudents}/55)`);
    
    const shipments = filteredStops.map((stop, index) => ({
        pickups: [{
            arrivalLocation: {
                latitude: parseFloat(stop.snapped_lat),
                longitude: parseFloat(stop.snapped_lon)
            },
            duration: "180s",
            loadDemands: {
                students: {
                    amount: parseInt(stop.num_students)
                }
            },
            timeWindows: [{
                startTime: "2024-01-01T07:00:00Z",
                endTime: "2024-01-01T09:00:00Z"
            }]
        }],
        label: `stop_${stop.cluster_number}`
    }));
    
    const vehicles = [];
    for (let i = 0; i < requiredBuses; i++) {
        vehicles.push({
            startLocation: {
                latitude: parseFloat(depotsData[i % depotsData.length].Latitude),
                longitude: parseFloat(depotsData[i % depotsData.length].Longitude)
            },
            endLocation: {
                latitude: COLLEGE_COORDS[0],
                longitude: COLLEGE_COORDS[1]
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
            },
            // ✅ HIGHER DISTANCE COST to discourage long routes
            costPerHour: 500,
            costPerKilometer: 200  // Much higher to penalize distance
        });
    }
    
    return {
        model: {
            shipments: shipments,
            vehicles: vehicles,
            globalStartTime: "2024-01-01T06:00:00Z",
            globalEndTime: "2024-01-01T10:00:00Z",
            // ✅ ADD: Encourage shorter, more efficient routes
            globalDurationCostPerHour: 1000
        },
        searchMode: "DEADLINE_AWARE"
    };
}

// ✅ ENHANCED CLIENT-SIDE VALIDATION: Filter out routes exceeding 50km
// ✅ Enhanced route processing with simplified validation
async function processRouteOptimizationResponse(apiResponse) {
    const routes = [];
    const MAX_DISTANCE_KM = 50;
    
    if (apiResponse.routes) {
        for (let index = 0; index < apiResponse.routes.length; index++) {
            const route = apiResponse.routes[index];
            const routeStops = [];
            let totalStudents = 0;
            let routeDistanceKm = 0;
            
            // Calculate route distance
            if (route.metrics?.travelDistanceMeters) {
                routeDistanceKm = route.metrics.travelDistanceMeters / 1000;
            }
            
            // Skip routes that exceed distance limit
            if (routeDistanceKm > MAX_DISTANCE_KM) {
                console.warn(`⚠️ Route ${index + 1} exceeds ${MAX_DISTANCE_KM}km (${routeDistanceKm.toFixed(1)}km) - Filtering out`);
                continue;
            }
            
            // Build route stops
            if (route.visits) {
                route.visits.forEach(visit => {
                    if (visit.shipmentIndex !== undefined) {
                        const matchingStop = findStopByShipmentIndex(visit.shipmentIndex);
                        if (matchingStop) {
                            routeStops.push(matchingStop);
                            totalStudents += parseInt(matchingStop.num_students);
                        }
                    }
                });
            }
            
            // Only process routes with actual stops
            if (routeStops.length > 0) {
                const maxCapacity = parseInt(document.getElementById('maxCapacity').value);
                
                const routeData = {
                    busId: `Bus ${index + 1}`,
                    depot: depotsData[index % depotsData.length]['Parking Name'],
                    stops: routeStops,
                    totalStudents: totalStudents,
                    efficiency: `${((totalStudents / maxCapacity) * 100).toFixed(1)}%`,
                    totalDistance: `${routeDistanceKm.toFixed(1)} km`,
                    totalTime: route.vehicleStartTime && route.vehicleEndTime ? 
                              calculateTimeDifference(route.vehicleStartTime, route.vehicleEndTime) : 'N/A',
                    cost: route.metrics?.totalCost?.toFixed(2) || 'N/A',
                    withinDistanceLimit: true
                };
                
                // ✅ Simple validation
                const validation = await validateNetworkRoute(routeData);
                
                routeData.accessibility = {
                    isValid: validation.isValid,
                    issues: validation.issues,
                    validatedDistance: validation.validatedDistance
                };
                
                if (validation.isValid) {
                    routes.push(routeData);
                    console.log(`✅ ${routeData.busId} passed basic validation`);
                } else {
                    console.warn(`⚠️ ${routeData.busId} has concerns:`, validation.issues);
                    routeData.hasAccessibilityWarnings = true;
                    routeData.warningMessage = validation.issues.join(', ');
                    routes.push(routeData); // Still include it with warnings
                }
            }
        }
    }

    // Provide feedback
    const validRoutes = routes.filter(r => r.accessibility?.isValid !== false);
    const problemRoutes = routes.filter(r => r.accessibility?.isValid === false);
    
    if (problemRoutes.length > 0) {
        showStatus(`⚠️ ${problemRoutes.length} routes have concerns. Check route details.`, 'warning');
    } else if (validRoutes.length > 0) {
        showStatus(`✅ Generated ${validRoutes.length} routes within ${MAX_DISTANCE_KM}km`, 'success');
    }
    
    return routes;
}



// ✅ SIMPLIFIED Route validation (basic checks only)
function validateNetworkRoute(route) {
    return {
        isValid: route.networkValidated || false,
        issues: route.networkValidated ? [] : ['Route not network-validated'],
        method: 'gps-network-constrained'
    };
}


function processRouteValidation(validationResponse, route) {
    const issues = [];
    let isValid = true;
    
    if (validationResponse.status === 'ZERO_RESULTS') {
        issues.push('No bus-accessible route found');
        isValid = false;
    }
    
    if (validationResponse.routes && validationResponse.routes.length > 0) {
        const googleRoute = validationResponse.routes[0];
        
        // Check for warnings about accessibility
        googleRoute.warnings?.forEach(warning => {
            if (warning.includes('toll') || warning.includes('restricted') || warning.includes('narrow')) {
                issues.push(warning);
            }
        });
        
        // Check legs for accessibility issues
        googleRoute.legs?.forEach((leg, index) => {
            leg.steps?.forEach(step => {
                if (step.maneuver && ['turn-sharp-left', 'turn-sharp-right', 'uturn-left', 'uturn-right'].includes(step.maneuver)) {
                    issues.push(`Difficult maneuver at stop ${index + 1}: ${step.maneuver}`);
                }
                
                // Check for narrow roads (heuristic: very short distance with long duration)
                if (step.distance?.value && step.duration?.value) {
                    const speedKmh = (step.distance.value / 1000) / (step.duration.value / 3600);
                    if (speedKmh < 10 && step.distance.value > 100) {
                        issues.push(`Potentially narrow road detected near stop ${index + 1}`);
                    }
                }
            });
        });
        
        // Compare distances - if Google's route is significantly longer, there might be accessibility constraints
        const googleDistanceKm = googleRoute.legs.reduce((total, leg) => total + leg.distance.value, 0) / 1000;
        const originalDistanceKm = parseFloat(route.totalDistance.replace(' km', '').replace('~', ''));
        
        if (googleDistanceKm > originalDistanceKm * 1.3) {
            issues.push('Route may have accessibility detours');
        }
    }
    
    return {
        isValid: isValid && issues.length === 0,
        issues: issues,
        validatedDistance: validationResponse.routes?.[0]?.legs?.reduce((total, leg) => total + leg.distance.value, 0) / 1000
    };
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

// ✅ ENHANCED: Main optimization function with advanced angular slicing algorithm
async function getBusOptimizedRoutes() {
    try {
        const filteredStops = filterStopsByDistance(stopsData, 40);
        const maxCapacity = parseInt(document.getElementById('maxCapacity').value) || 55;
        
        console.log(`🚌 Starting advanced optimization for ${filteredStops.length} stops`);
        
        // ✅ PRIMARY: Use the advanced angular slicing algorithm
        console.log(`🎯 Using advanced angular slicing algorithm (${ANGLE_SLICE_DEG}° sectors)`);
        const advancedRoutes = buildOptimizedRoutes(filteredStops, depotsData, maxCapacity);
        
        // Convert to your existing format
        const formattedAdvancedRoutes = convertAdvancedRoutesToFormat(advancedRoutes, 0);
        
        // ✅ FALLBACK: Use existing strategies if advanced algorithm doesn't produce enough routes
        let allRoutes = [...formattedAdvancedRoutes];
        
        // Check if we need more routes
        const totalStudents = filteredStops.reduce((sum, stop) => sum + parseInt(stop.num_students), 0);
        const maxBusesNeeded = Math.ceil(totalStudents / maxCapacity);
        
        if (allRoutes.length < maxBusesNeeded) {
            console.log(`🔄 Advanced algorithm produced ${allRoutes.length} routes, need ${maxBusesNeeded}. Adding fallback routes...`);
            
            // Get unserved stops from advanced routes
            const servedStopIds = new Set();
            allRoutes.forEach(route => {
                route.stops.forEach(stop => {
                    servedStopIds.add(stop.cluster_number);
                });
            });
            
            const unservedStops = filteredStops.filter(stop => !servedStopIds.has(stop.cluster_number));
            
            if (unservedStops.length > 0) {
                console.log(`📊 ${unservedStops.length} stops not served by advanced algorithm, creating fallback routes...`);
                
                // Use existing strategies for remaining stops
                const fallbackStrategies = {
                    corridor: await createCorridorBasedRoutes(unservedStops, maxCapacity),
                    segment: await createRoutesBySegment(unservedStops, maxCapacity),
                    directional: await createGeographicalClusters(unservedStops, maxCapacity)
                };
                
                // Validate and add fallback routes
                Object.keys(fallbackStrategies).forEach(strategy => {
                    fallbackStrategies[strategy] = fallbackStrategies[strategy].filter(validateRouteLength);
                    console.log(`✅ ${strategy} fallback: ${fallbackStrategies[strategy].length} routes`);
                });
                
                const fallbackRoutes = [
                    ...fallbackStrategies.corridor,
                    ...fallbackStrategies.segment,
                    ...fallbackStrategies.directional
                ];
                
                allRoutes = [...allRoutes, ...fallbackRoutes];
            }
        }
        
        // ✅ ANALYZE COVERAGE
        const {
            servingRoutes,
            servedStops,
            servedStudents,
            duplicateStops,
            unservedStops
        } = analyzeRouteCoverage(allRoutes, filteredStops);
        
        const coveragePercent = (servedStudents / totalStudents * 100).toFixed(1);
        
        console.log(`📊 COVERAGE ANALYSIS:`);
        console.log(`   - Students served: ${servedStudents}/${totalStudents} (${coveragePercent}%)`);
        console.log(`   - Stops served: ${servedStops.length}/${filteredStops.length}`);
        console.log(`   - Duplicate stops: ${duplicateStops}`);
        console.log(`   - Unserved stops: ${unservedStops.length}`);
        console.log(`   - Advanced routes: ${formattedAdvancedRoutes.length}`);
        
        // ✅ SALVAGE OPERATION: Create routes for unserved stops if coverage is low
        if (parseFloat(coveragePercent) < 85 && unservedStops.length > 0) {
            console.log(`🔄 Coverage below 85% - attempting to create salvage routes for unserved stops...`);
            
            const salvageRoutes = await createSalvageRoutes(unservedStops, maxCapacity);
            const validSalvageRoutes = salvageRoutes.filter(validateRouteLength);
            console.log(`✅ Created ${validSalvageRoutes.length} salvage routes for unserved stops`);
            
            allRoutes = [...servingRoutes, ...validSalvageRoutes];
            
            // Recalculate coverage
            const finalCoverage = analyzeRouteCoverage(allRoutes, filteredStops);
            const finalCoveragePercent = (finalCoverage.servedStudents / totalStudents * 100).toFixed(1);
            
            console.log(`📊 FINAL COVERAGE: ${finalCoveragePercent}% of students`);
        } else {
            allRoutes = servingRoutes;
        }
        
        // ✅ Assign depots smartly
        allRoutes.forEach(route => {
            if (!route.assignedDepot) {
                route.assignedDepot = findOptimalDepot(route);
            }
        });
        
        // ✅ Limit to maximum number of buses available (maxBusesNeeded already calculated above)
        
        // Sort routes by efficiency (advanced routes get priority)
        allRoutes.sort((a, b) => {
            // Advanced routes get priority
            if (a.isAdvancedOptimized && !b.isAdvancedOptimized) return -1;
            if (!a.isAdvancedOptimized && b.isAdvancedOptimized) return 1;
            
            // Then sort by efficiency
            const effA = parseFloat(a.efficiency?.replace('%', '')) || 0;
            const effB = parseFloat(b.efficiency?.replace('%', '')) || 0;
            return effB - effA; // Highest efficiency first
        });
        
        // Take the most efficient routes up to the limit
        const finalRoutes = allRoutes.slice(0, maxBusesNeeded);
        
        console.log(`🎯 Final solution: ${finalRoutes.length} routes (${formattedAdvancedRoutes.filter(r => finalRoutes.includes(r)).length} advanced)`);
        return finalRoutes;
        
    } catch (error) {
        console.error('Advanced route optimization failed:', error);
        console.log('🔄 Falling back to existing optimization strategies...');
        return await simulateOptimization(); // Fallback to simulation
    }
}

// ✅ ENHANCED: Better clustering with distance and directional grouping
function createGeographicalClusters(stops, maxCapacity) {
    const clusters = [];
    
    console.log(`🎯 Creating optimized clusters for ${stops.length} stops`);
    
    // ✅ STEP 1: Calculate bearing/direction from college for each stop
    const stopsWithBearing = stops.map(stop => {
        const lat = parseFloat(stop.snapped_lat);
        const lng = parseFloat(stop.snapped_lon);
        
        // Calculate precise bearing from college (0° = North, 90° = East, etc.)
        const bearing = calculateBearing(COLLEGE_COORDS[0], COLLEGE_COORDS[1], lat, lng);
        const distance = calculateHaversineDistance(COLLEGE_COORDS[0], COLLEGE_COORDS[1], lat, lng);
        
        // Assign to 8 directional sectors (45° each)
        const sector = Math.floor(((bearing + 22.5) % 360) / 45);
        const sectorNames = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
        const direction = sectorNames[sector];
        
        return { 
            ...stop, 
            bearing, 
            direction, 
            distance, 
            lat, 
            lng,
            sector 
        };
    });
    
    // ✅ NEW: Calculate the distribution statistics for dynamic parameter tuning
    const bearingStats = calculateBearingDistribution(stopsWithBearing);
    const distanceStats = calculateDistanceDistribution(stopsWithBearing);
    
    console.log(`📊 Stop distribution - Bearing SD: ${bearingStats.standardDeviation.toFixed(2)}°, Distance SD: ${distanceStats.standardDeviation.toFixed(2)}km`);
    
    // ✅ DYNAMIC TUNING: Adjust parameters based on geographic distribution
    const dynamicParameters = calculateDynamicParameters(bearingStats, distanceStats);
    console.log(`🔧 Dynamic parameters: Max bearing spread ${dynamicParameters.maxBearingSpread.toFixed(1)}°, Max distance spread ${dynamicParameters.maxDistanceSpread.toFixed(1)}km`);
    
    // ✅ STEP 2: Group by sectors first, then by distance within sectors
    const sectorGroups = {};
    stopsWithBearing.forEach(stop => {
        if (!sectorGroups[stop.direction]) {
            sectorGroups[stop.direction] = [];
        }
        sectorGroups[stop.direction].push(stop);
    });
    
    // ✅ STEP 3: Create distance-based clusters within each sector
    Object.keys(sectorGroups).forEach(direction => {
        const sectorStops = sectorGroups[direction];
        
        if (sectorStops.length === 0) return;
        
        console.log(`📍 ${direction} sector: ${sectorStops.length} stops`);
        
        // ✅ NEW: Sort by distance AND create distance bands
        sectorStops.sort((a, b) => a.distance - b.distance);
        
        // ✅ NEW: Create distance bands within each sector
        const distanceBands = createDistanceBands(sectorStops, dynamicParameters.maxDistanceSpread);
        
        console.log(`📏 ${direction} sector split into ${distanceBands.length} distance bands`);
        
        // Process each distance band within the sector
        distanceBands.forEach((band, bandIndex) => {
            // Sort band stops by distance from college
            band.sort((a, b) => a.distance - b.distance);
            
            let currentCluster = { 
                stops: [], 
                totalStudents: 0, 
                direction: `${direction}-${bandIndex + 1}`,
                minBearing: Infinity,
                maxBearing: -Infinity,
                avgDistance: 0,
                minDistance: Infinity,
                maxDistance: -Infinity
            };
            
            band.forEach(stop => {
                const studentCount = parseInt(stop.num_students);
                
                // Check capacity and bearing constraints
                const newMinBearing = Math.min(currentCluster.minBearing, stop.bearing);
                const newMaxBearing = Math.max(currentCluster.maxBearing, stop.bearing);
                const newMinDistance = Math.min(currentCluster.minDistance, stop.distance);
                const newMaxDistance = Math.max(currentCluster.maxDistance, stop.distance);
                
                let bearingSpread = newMaxBearing - newMinBearing;
                if (bearingSpread > 180) bearingSpread = 360 - bearingSpread;
                
                const wouldExceedCapacity = currentCluster.totalStudents + studentCount > maxCapacity;
                const wouldExceedBearingSpread = bearingSpread > dynamicParameters.maxBearingSpread;
                const wouldExceedDistanceSpread = newMaxDistance - newMinDistance > dynamicParameters.maxDistanceSpread;
                
                if ((wouldExceedCapacity || wouldExceedBearingSpread || wouldExceedDistanceSpread) && currentCluster.stops.length > 0) {
                    finalizeCluster(currentCluster);
                    clusters.push(currentCluster);
                    
                    // Start new cluster
                    currentCluster = {
                        stops: [stop],
                        totalStudents: studentCount,
                        direction: `${direction}-${bandIndex + 1}`,
                        minBearing: stop.bearing,
                        maxBearing: stop.bearing,
                        avgDistance: stop.distance,
                        minDistance: stop.distance,
                        maxDistance: stop.distance
                    };
                } else {
                    currentCluster.stops.push(stop);
                    currentCluster.totalStudents += studentCount;
                    currentCluster.minBearing = newMinBearing;
                    currentCluster.maxBearing = newMaxBearing;
                    currentCluster.minDistance = newMinDistance;
                    currentCluster.maxDistance = newMaxDistance;
                    currentCluster.avgDistance = currentCluster.stops.reduce((sum, s) => sum + s.distance, 0) / currentCluster.stops.length;
                }
            });
            
            // Add the last cluster
            if (currentCluster.stops.length > 0) {
                finalizeCluster(currentCluster);
                clusters.push(currentCluster);
            }
        });
    });
    
    // ✅ STEP 4: Validation + IMPROVED SALVAGE for rejected clusters
    const validClusters = [];
    const rejectedClusters = [];
    
    clusters.forEach(cluster => {
        if (validateClusterStraightness(cluster)) {
            validClusters.push(cluster);
        } else {
            console.warn(`⚠️ Cluster ${cluster.direction} rejected - will try to salvage`);
            rejectedClusters.push(cluster);
            
            // Track all stops in rejected cluster
            cluster.stops.forEach(stop => {
                trackDroppedStop(stop, 'CLUSTER_REJECTED', {
                    cluster_direction: cluster.direction,
                    cluster_stops_count: cluster.stops.length,
                    cluster_students: cluster.totalStudents
                });
            });
        }
    });
    
    // ✅ IMPROVED SALVAGE: Intelligently split rejected clusters instead of just regrouping stops
    if (rejectedClusters.length > 0) {
        console.log(`🔄 Attempting to salvage ${rejectedClusters.length} rejected clusters...`);
        const salvageRoutes = improvedSalvageRejectedClusters(rejectedClusters, maxCapacity, dynamicParameters);
        validClusters.push(...salvageRoutes);
    }
    
    console.log(`✅ Created ${validClusters.length} total clusters (${clusters.length} initial, ${rejectedClusters.length} rejected, ${validClusters.length - (clusters.length - rejectedClusters.length)} salvaged)`);
    
    // Assign depots to valid clusters
    validClusters.forEach((cluster, index) => {
        cluster.assignedDepot = findOptimalDepot(cluster);
        const efficiency = ((cluster.totalStudents / maxCapacity) * 100).toFixed(1);
        console.log(`🚌 Route ${index + 1} (${cluster.direction}): ${cluster.stops.length} stops, ${cluster.totalStudents} students (${efficiency}%)`);
    });
    
    const totalStudentsInShift = stops.reduce((sum, stop) => sum + parseInt(stop.num_students || 0), 0);
    const maxBusesNeeded = Math.ceil(totalStudentsInShift / maxCapacity);

    return validClusters.slice(0, maxBusesNeeded);
}

// ✅ NEW: Calculate bearing distribution for dynamic parameter tuning
function calculateBearingDistribution(stops) {
    // Calculate mean bearing (complex due to circular nature)
    const bearings = stops.map(stop => stop.bearing);
    
    // Convert to radians and calculate vector components
    const xComponents = bearings.map(b => Math.cos(b * Math.PI / 180));
    const yComponents = bearings.map(b => Math.sin(b * Math.PI / 180));
    
    // Calculate mean vector components
    const meanX = xComponents.reduce((a, b) => a + b, 0) / bearings.length;
    const meanY = yComponents.reduce((a, b) => a + b, 0) / bearings.length;
    
    // Calculate mean bearing
    let meanBearing = Math.atan2(meanY, meanX) * 180 / Math.PI;
    if (meanBearing < 0) meanBearing += 360;
    
    // Calculate circular standard deviation
    const resultantLength = Math.sqrt(meanX * meanX + meanY * meanY);
    const standardDeviation = Math.sqrt(-2 * Math.log(resultantLength)) * 180 / Math.PI;
    
    return {
        mean: meanBearing,
        standardDeviation: standardDeviation,
        range: 360,
        clusteringFactor: 1 - resultantLength // 0 = perfectly clustered, 1 = perfectly dispersed
    };
}

// ✅ NEW: Calculate distance distribution for dynamic parameter tuning
function calculateDistanceDistribution(stops) {
    const distances = stops.map(stop => stop.distance);
    
    // Calculate mean and standard deviation
    const mean = distances.reduce((a, b) => a + b, 0) / distances.length;
    const variance = distances.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / distances.length;
    const standardDeviation = Math.sqrt(variance);
    
    // Calculate min and max
    const min = Math.min(...distances);
    const max = Math.max(...distances);
    
    return {
        mean: mean,
        standardDeviation: standardDeviation,
        min: min,
        max: max,
        range: max - min
    };
}

// ✅ NEW: Calculate dynamic parameters based on data distribution
function calculateDynamicParameters(bearingStats, distanceStats) {
    // Calculate dynamic bearing spread
    // - More dispersed stops (high std dev) need more flexibility
    // - More clustered stops (low std dev) can use tighter constraints
    let maxBearingSpread = Math.min(120, Math.max(45, bearingStats.standardDeviation * 1.5));
    
    // Calculate dynamic distance spread
    // - Base on standard deviation of distances but keep reasonable bounds
    let maxDistanceSpread = Math.min(15, Math.max(5, distanceStats.standardDeviation * 1.2));
    
    // If stops are very clustered directionally but spread out in distance
    if (bearingStats.standardDeviation < 30 && distanceStats.standardDeviation > 8) {
        // Allow more distance spread since directions are tight
        maxDistanceSpread = Math.min(20, distanceStats.standardDeviation * 1.5);
    }
    
    // If stops are very dispersed directionally but clustered in distance
    if (bearingStats.standardDeviation > 60 && distanceStats.standardDeviation < 4) {
        // Tighten distance constraints since we're allowing more bearing spread
        maxDistanceSpread = Math.min(8, distanceStats.standardDeviation * 1.2);
        // Allow more bearing spread to accommodate the directional dispersion
        maxBearingSpread = Math.min(135, bearingStats.standardDeviation * 1.8);
    }
    
    return {
        maxBearingSpread: maxBearingSpread,
        maxDistanceSpread: maxDistanceSpread,
        clusteringScore: (1 - bearingStats.clusteringFactor) * 100
    };
}

// ✅ NEW: Create distance bands within a direction sector
function createDistanceBands(sectorStops, maxDistanceSpread) {
    if (sectorStops.length === 0) return [];
    if (sectorStops.length <= 5) return [sectorStops]; // Too few stops to split
    
    // Get distance range
    const minDistance = Math.min(...sectorStops.map(s => s.distance));
    const maxDistance = Math.max(...sectorStops.map(s => s.distance));
    const distanceRange = maxDistance - minDistance;
    
    // If range is small, don't split
    if (distanceRange <= maxDistanceSpread * 1.2) {
        return [sectorStops];
    }
    
    // Determine number of bands - dynamically calculated based on range
    const numBands = Math.max(2, Math.min(5, Math.ceil(distanceRange / maxDistanceSpread)));
    const bandWidth = distanceRange / numBands;
    
    // Create bands
    const bands = Array(numBands).fill().map(() => []);
    
    // Assign stops to bands
    sectorStops.forEach(stop => {
        const bandIndex = Math.min(
            numBands - 1,
            Math.floor((stop.distance - minDistance) / bandWidth)
        );
        bands[bandIndex].push(stop);
    });
    
    // Remove empty bands
    return bands.filter(band => band.length > 0);
}

// ✅ IMPROVED: Better salvaging of rejected clusters
function improvedSalvageRejectedClusters(rejectedClusters, maxCapacity, dynamicParams) {
    const salvageRoutes = [];
    
    // Process each rejected cluster
    rejectedClusters.forEach((cluster, index) => {
        console.log(`🔧 Salvaging cluster ${index + 1}: ${cluster.direction} with ${cluster.stops.length} stops`);
        
        // Identify the main issues with this cluster
        const issues = identifyClusterIssues(cluster);
        console.log(`   - Issues: ${issues.join(', ')}`);
        
        // Apply different salvage strategies based on the issues
        if (issues.includes('high-bearing-spread')) {
            // Split by bearing sub-sectors
            const subClusters = splitByBearing(cluster, dynamicParams.maxBearingSpread / 1.5);
            console.log(`   - Split into ${subClusters.length} bearing-based sub-clusters`);
            salvageRoutes.push(...subClusters);
            
        } else if (issues.includes('high-distance-spread')) {
            // Split by distance bands
            const subClusters = splitByDistance(cluster, dynamicParams.maxDistanceSpread / 1.5);
            console.log(`   - Split into ${subClusters.length} distance-based sub-clusters`);
            salvageRoutes.push(...subClusters);
            
        } else if (issues.includes('backtracking')) {
            // Try to identify and remove the problematic stops
            const optimizedCluster = removeBacktrackingStops(cluster);
            console.log(`   - Removed ${cluster.stops.length - optimizedCluster.stops.length} problematic stops`);
            salvageRoutes.push(optimizedCluster);
            
        } else {
            // Generic approach: split into smaller chunks
            const chunks = splitIntoChunks(cluster, Math.max(2, Math.floor(cluster.stops.length / 2)));
            console.log(`   - Split into ${chunks.length} generic chunks`);
            salvageRoutes.push(...chunks);
        }
    });
    
    // Finalize all salvaged routes
    salvageRoutes.forEach(route => {
        finalizeCluster(route);
        route.routeType = 'salvaged';
        route.direction = route.direction + '-S'; // Mark as salvaged
    });
    
    console.log(`✅ Created ${salvageRoutes.length} salvaged routes`);
    return salvageRoutes;
}

// ✅ NEW: Identify specific issues with a rejected cluster
function identifyClusterIssues(cluster) {
    const issues = [];
    
    // Check bearing spread
    const bearingSpread = cluster.maxBearing - cluster.minBearing;
    const adjustedBearingSpread = bearingSpread > 180 ? 360 - bearingSpread : bearingSpread;
    if (adjustedBearingSpread > 75) {
        issues.push('high-bearing-spread');
    }
    
    // Check distance spread
    const distanceSpread = cluster.maxDistance - cluster.minDistance;
    if (distanceSpread > 10) {
        issues.push('high-distance-spread');
    }
    
    // Check for backtracking
    const backtrackRatio = detectBacktracking(cluster.stops);
    if (backtrackRatio > 0.3) {
        issues.push('backtracking');
    }
    
    // Check straightness factor
    if (cluster.straightnessFactor > 0.4) {
        issues.push('low-straightness');
    }
    
    // If no specific issues found, mark as generic
    if (issues.length === 0) {
        issues.push('generic');
    }
    
    return issues;
}

// ✅ NEW: Split cluster by bearing into sub-clusters
function splitByBearing(cluster, maxBearingSpread) {
    // Create bearing-based groups
    const stops = [...cluster.stops];
    stops.sort((a, b) => a.bearing - b.bearing);
    
    const subClusters = [];
    let currentGroup = {
        stops: [stops[0]],
        totalStudents: parseInt(stops[0].num_students),
        direction: cluster.direction,
        minBearing: stops[0].bearing,
        maxBearing: stops[0].bearing
    };
    
    for (let i = 1; i < stops.length; i++) {
        const stop = stops[i];
        const bearingDiff = stop.bearing - currentGroup.minBearing;
        const adjustedBearingDiff = bearingDiff > 180 ? 360 - bearingDiff : bearingDiff;
        
        if (adjustedBearingDiff > maxBearingSpread) {
            // Complete current group and start new one
            subClusters.push(currentGroup);
            currentGroup = {
                stops: [stop],
                totalStudents: parseInt(stop.num_students),
                direction: cluster.direction + '-B' + subClusters.length,
                minBearing: stop.bearing,
                maxBearing: stop.bearing
            };
        } else {
            // Add to current group
            currentGroup.stops.push(stop);
            currentGroup.totalStudents += parseInt(stop.num_students);
            currentGroup.minBearing = Math.min(currentGroup.minBearing, stop.bearing);
            currentGroup.maxBearing = Math.max(currentGroup.maxBearing, stop.bearing);
        }
    }
    
    // Add the last group
    if (currentGroup.stops.length > 0) {
        subClusters.push(currentGroup);
    }
    
    return subClusters;
}

// ✅ NEW: Split cluster by distance into sub-clusters
function splitByDistance(cluster, maxDistanceSpread) {
    // Create distance-based groups
    const stops = [...cluster.stops];
    stops.sort((a, b) => a.distance - b.distance);
    
    const subClusters = [];
    let currentGroup = {
        stops: [stops[0]],
        totalStudents: parseInt(stops[0].num_students),
        direction: cluster.direction,
        minDistance: stops[0].distance,
        maxDistance: stops[0].distance
    };
    
    for (let i = 1; i < stops.length; i++) {
        const stop = stops[i];
        const distanceSpread = stop.distance - currentGroup.minDistance;
        
        if (distanceSpread > maxDistanceSpread) {
            // Complete current group and start new one
            subClusters.push(currentGroup);
            currentGroup = {
                stops: [stop],
                totalStudents: parseInt(stop.num_students),
                direction: cluster.direction + '-D' + subClusters.length,
                minDistance: stop.distance,
                maxDistance: stop.distance
            };
        } else {
            // Add to current group
            currentGroup.stops.push(stop);
            currentGroup.totalStudents += parseInt(stop.num_students);
            currentGroup.minDistance = Math.min(currentGroup.minDistance, stop.distance);
            currentGroup.maxDistance = Math.max(currentGroup.maxDistance, stop.distance);
        }
    }
    
    // Add the last group
    if (currentGroup.stops.length > 0) {
        subClusters.push(currentGroup);
    }
    
    return subClusters;
}

// ✅ NEW: Remove stops that cause backtracking
function removeBacktrackingStops(cluster) {
    const stops = [...cluster.stops];
    
    // Sort stops by distance from college
    stops.sort((a, b) => a.distance - b.distance);
    
    
    // Identify stops that cause backtracking
    const problematicIndices = [];
    
    for (let i = 1; i < stops.length - 1; i++) {
        const prevStop = stops[i-1];
        const currentStop = stops[i];
        const nextStop = stops[i+1];
        
        // Calculate bearings
        const bearingToCurrent = calculateBearing(
            prevStop.lat, prevStop.lng,
            currentStop.lat, currentStop.lng
        );
        
        const bearingToNext = calculateBearing(
            currentStop.lat, currentStop.lng,
            nextStop.lat, nextStop.lng
        );
        
        // Calculate angular difference
        let bearingDiff = Math.abs(bearingToNext - bearingToCurrent);
        if (bearingDiff > 180) bearingDiff = 360 - bearingDiff;
        
        // If bearing change is too sharp, mark stop as problematic
        if (bearingDiff > 120) {
            problematicIndices.push(i);
        }
    }

    // Track problematic stops before removing them
    problematicIndices.forEach(index => {
        trackDroppedStop(stops[index], 'BACKTRACKING_REMOVAL', {
            cluster_direction: cluster.direction,
            bearing_change: Math.abs(calculateBearing(stops[index-1].lat, stops[index-1].lng, stops[index].lat, stops[index].lng) - 
                                    calculateBearing(stops[index].lat, stops[index].lng, stops[index+1].lat, stops[index+1].lng)),
            position_in_route: index
        });
    });
    
    // Remove problematic stops
    const optimizedStops = stops.filter((stop, index) => !problematicIndices.includes(index));
    
    // Create a new optimized cluster
    return {
        stops: optimizedStops,
        totalStudents: optimizedStops.reduce((sum, stop) => sum + parseInt(stop.num_students), 0),
        direction: cluster.direction + '-O',
        minBearing: Math.min(...optimizedStops.map(s => s.bearing)),
        maxBearing: Math.max(...optimizedStops.map(s => s.bearing)),
        routeType: 'optimized-salvage'
    };
}

// ✅ NEW: Split a cluster into smaller chunks
function splitIntoChunks(cluster, numChunks) {
    const stops = [...cluster.stops];
    const chunkSize = Math.ceil(stops.length / numChunks);
    const chunks = [];
    
    // Sort by distance for better chunks
    stops.sort((a, b) => a.distance - b.distance);
    
    for (let i = 0; i < stops.length; i += chunkSize) {
        const chunkStops = stops.slice(i, i + chunkSize);
        
        if (chunkStops.length > 0) {
            chunks.push({
                stops: chunkStops,
                totalStudents: chunkStops.reduce((sum, stop) => sum + parseInt(stop.num_students), 0),
                direction: cluster.direction + '-' + (chunks.length + 1),
                minBearing: Math.min(...chunkStops.map(s => s.bearing)),
                maxBearing: Math.max(...chunkStops.map(s => s.bearing)),
                routeType: 'chunked-salvage'
            });
        }
    }
    
    return chunks;
}

// ✅ RADICAL SOLUTION: Completely different approach - Corridor-Based Routing
async function createCorridorBasedRoutes(stops, maxCapacity) {
    console.log(`🛣️ Creating corridor-based routes for ${stops.length} stops`);
    
    // STEP 1: Calculate the main travel corridors
    const corridors = identifyTravelCorridors(stops);
    console.log(`🔍 Identified ${corridors.length} main travel corridors`);
    
    // STEP 2: Assign stops to their nearest corridor
    const corridorAssignments = assignStopsToCorridors(stops, corridors);
    
    // STEP 3: Create routes within each corridor
    const routes = [];
    corridors.forEach((corridor, index) => {
        const corridorStops = corridorAssignments[index] || [];
        if (corridorStops.length === 0) return;
        
        console.log(`🚌 Corridor ${index + 1}: ${corridorStops.length} stops`);
        
        // Create smaller routes within this corridor
        const corridorRoutes = createRoutesWithinCorridor(corridorStops, maxCapacity, corridor);
        routes.push(...corridorRoutes);
    });
    
    return routes;
}

// Identify main travel corridors (major roads/directions)
function identifyTravelCorridors(stops) {
    // Calculate the college center
    const centerLat = COLLEGE_COORDS[0];
    const centerLng = COLLEGE_COORDS[1];
    
    // STRATEGY: Identify high-density lines radiating from the college
    // 1. Divide the area into 16 narrow sectors (22.5 degrees each)
    // 2. For each sector, find the highest density path
    
    const sectors = [];
    for (let angle = 0; angle < 360; angle += 22.5) {
        sectors.push({
            minAngle: angle,
            maxAngle: angle + 22.5,
            stops: []
        });
    }
    
    // Assign stops to sectors
    stops.forEach(stop => {
        const bearing = calculateBearing(
            centerLat, centerLng,
            parseFloat(stop.snapped_lat), parseFloat(stop.snapped_lon)
        );
        
        // Find appropriate sector
        const sectorIndex = Math.floor(bearing / 22.5) % 16;
        sectors[sectorIndex].stops.push({
                ...stop,
            bearing: bearing,
            distance: calculateHaversineDistance(
                centerLat, centerLng,
                parseFloat(stop.snapped_lat), parseFloat(stop.snapped_lon)
            ),
            lat: parseFloat(stop.snapped_lat),
            lng: parseFloat(stop.snapped_lon)
        });
    });
    
    // Find corridor for each sector with enough stops
    const corridors = [];
    sectors.forEach(sector => {
        if (sector.stops.length < 3) return; // Skip sparse sectors
        
        // Sort by distance
        sector.stops.sort((a, b) => a.distance - b.distance);
        
        // Create a corridor as a line from college to the most distant stop in the sector
        if (sector.stops.length > 0) {
            const farthestStop = sector.stops[sector.stops.length - 1];
            corridors.push({
                startLat: centerLat,
                startLng: centerLng,
                endLat: parseFloat(farthestStop.snapped_lat),
                endLng: parseFloat(farthestStop.snapped_lon),
                bearing: (sector.minAngle + sector.maxAngle) / 2,
                length: farthestStop.distance,
                sectorIndex: corridors.length
            });
        }
    });
    
    // Add cross-corridors if needed for areas with high density
    // (This could be enhanced with actual road network data)
    
    return corridors;
}

// Assign stops to nearest corridor
function assignStopsToCorridors(stops, corridors) {
    const assignments = Array(corridors.length).fill().map(() => []);
    
    stops.forEach(stop => {
        const lat = parseFloat(stop.snapped_lat);
        const lng = parseFloat(stop.snapped_lon);
        
        // Find nearest corridor
        let nearestCorridorIndex = 0;
        let nearestDistance = Infinity;
        
        corridors.forEach((corridor, index) => {
            const distance = pointToLineDistance(
                lat, lng,
                corridor.startLat, corridor.startLng,
                corridor.endLat, corridor.endLng
            );
            
            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestCorridorIndex = index;
            }
        });
        
        // Only assign if reasonably close to corridor (within 5km)
        if (nearestDistance <= 5) {
            assignments[nearestCorridorIndex].push({
                ...stop,
                corridorDistance: nearestDistance,
                distanceAlongCorridor: calculateDistanceAlongLine(
                    lat, lng,
                    corridors[nearestCorridorIndex].startLat, 
                    corridors[nearestCorridorIndex].startLng,
                    corridors[nearestCorridorIndex].endLat,
                    corridors[nearestCorridorIndex].endLng
                ),
                lat: lat,
                lng: lng,
                distance: calculateHaversineDistance(
                    COLLEGE_COORDS[0], COLLEGE_COORDS[1],
                    lat, lng
                )
            });
        }
    });
    
    return assignments;
}

// Calculate perpendicular distance from point to line
function pointToLineDistance(pointLat, pointLng, lineLat1, lineLng1, lineLat2, lineLng2) {
    // Calculate using vector cross product divided by line length
    
    // Convert to flat coordinates for simplicity (approximate for small areas)
    const x = pointLng - lineLng1;
    const y = pointLat - lineLat1;
    const dx = lineLng2 - lineLng1;
    const dy = lineLat2 - lineLat1;
    
    // If line is a point, return distance to the point
    if (dx === 0 && dy === 0) {
        return calculateHaversineDistance(pointLat, pointLng, lineLat1, lineLng1);
    }
    
    // Calculate projection factor
    const proj = (x * dx + y * dy) / (dx * dx + dy * dy);
    
    // If projection is outside line segment, return distance to nearest endpoint
    if (proj < 0) {
        return calculateHaversineDistance(pointLat, pointLng, lineLat1, lineLng1);
    }
    if (proj > 1) {
        return calculateHaversineDistance(pointLat, pointLng, lineLat2, lineLng2);
    }
    
    // Calculate perpendicular distance using cross product
    const perpX = lineLng1 + proj * dx;
    const perpY = lineLat1 + proj * dy;
    
    return calculateHaversineDistance(pointLat, pointLng, perpY, perpX);
}

// Calculate distance along a line (0 = start, 1 = end)
function calculateDistanceAlongLine(pointLat, pointLng, lineLat1, lineLng1, lineLat2, lineLng2) {
    // Calculate using dot product
    
    // Convert to flat coordinates for simplicity
    const x = pointLng - lineLng1;
    const y = pointLat - lineLat1;
    const dx = lineLng2 - lineLng1;
    const dy = lineLat2 - lineLat1;
    
    // Calculate projection factor
    const proj = (x * dx + y * dy) / (dx * dx + dy * dy);
    
    // Clamp to line segment
    return Math.max(0, Math.min(1, proj));
}

// Create routes within a corridor
function createRoutesWithinCorridor(corridorStops, maxCapacity, corridor) {
    // Sort stops by distance along corridor (from college outward)
    corridorStops.sort((a, b) => a.distanceAlongCorridor - b.distanceAlongCorridor);
    
    // Group into segments to keep routes short (max 25km)
    const MAX_SEGMENT_LENGTH = 35; // km
    const segments = [];
    let currentSegment = {
        stops: [],
        startDistance: corridorStops[0]?.distanceAlongCorridor || 0,
        endDistance: corridorStops[0]?.distanceAlongCorridor || 0
    };
    
    corridorStops.forEach(stop => {
        // If adding this stop would make segment too long, start new segment
        const stopDistanceKm = stop.distance; // From college
        if (stopDistanceKm - currentSegment.startDistance > MAX_SEGMENT_LENGTH && currentSegment.stops.length > 0) {
            segments.push(currentSegment);
            currentSegment = {
                stops: [stop],
                startDistance: stopDistanceKm,
                endDistance: stopDistanceKm
            };
        } else {
            currentSegment.stops.push(stop);
            currentSegment.endDistance = Math.max(currentSegment.endDistance, stopDistanceKm);
        }
    });
    
    // Add last segment
    if (currentSegment.stops.length > 0) {
        segments.push(currentSegment);
    }
    
    // Create routes within each segment
    const routes = [];
    segments.forEach((segment, segIndex) => {
        // Group by capacity
        let currentRoute = {
            stops: [],
            totalStudents: 0,
            direction: `C${corridor.sectorIndex}-S${segIndex}`
        };
        
        segment.stops.forEach(stop => {
            const students = parseInt(stop.num_students);
            
            // If adding this stop would exceed capacity, create a new route
            if (currentRoute.totalStudents + students > maxCapacity && currentRoute.stops.length > 0) {
                finalizeCorridorRoute(currentRoute, corridor, routes.length + 1);
                routes.push(currentRoute);
                
                currentRoute = {
                    stops: [stop],
                    totalStudents: students,
                    direction: `C${corridor.sectorIndex}-S${segIndex}-R${routes.length + 1}`
                };
            } else {
                currentRoute.stops.push(stop);
                currentRoute.totalStudents += students;
            }
        });
        
        // Add final route in segment
        if (currentRoute.stops.length > 0) {
            finalizeCorridorRoute(currentRoute, corridor, routes.length + 1);
            routes.push(currentRoute);
        }
    });
    
    return routes;
}

// Finalize a corridor route
function finalizeCorridorRoute(route, corridor, index) {
    // Calculate basic metrics
    route.minBearing = corridor.bearing - 11.25;
    route.maxBearing = corridor.bearing + 11.25;
    
    // Ensure stops are ordered by distance from college
    route.stops.sort((a, b) => a.distance - b.distance);
    
    // Calculate route distance estimate
    const farthestStopDistance = route.stops[route.stops.length - 1]?.distance || 0;
    route.estimatedDistance = Math.min(50, farthestStopDistance * 1.3); // 30% overhead for real roads
    
    // Set route type
    route.routeType = 'corridor';
    
    // Add route ID
    route.busId = `Bus ${index} (Corridor ${corridor.sectorIndex})`;
    
    // Calculate efficiency
    route.efficiency = `${((route.totalStudents / 55) * 100).toFixed(1)}%`;
    
    // Set total distance
    route.totalDistance = `${route.estimatedDistance.toFixed(1)} km`;
}

// ✅ ENHANCED: Maximum Route Length Enforcement
function validateRouteLength(route) {
    // MUCH stricter distance limits
    const STRICT_MAX_DISTANCE = 50; // km
    const PREFERRED_MAX_DISTANCE = 40; // km
    
    const distanceKm = getRouteDistance(route);
    
    // Strictly enforce limits
    if (distanceKm > STRICT_MAX_DISTANCE) {
        console.warn(`⚠️ Route ${route.busId} rejected - exceeds strict ${STRICT_MAX_DISTANCE}km limit (${distanceKm.toFixed(1)}km)`);

        // Track all stops in rejected route
        if (route.stops) {
            route.stops.forEach(stop => {
                trackDroppedStop(stop, 'ROUTE_LENGTH_EXCEEDED', {
                    route_id: route.busId,
                    route_distance_km: distanceKm,
                    max_allowed_km: STRICT_MAX_DISTANCE
                });
            });
        }

        return false;
    }


    
    // Add warnings but still accept routes near the limit
    if (distanceKm > PREFERRED_MAX_DISTANCE) {
        console.warn(`⚠️ Route ${route.busId} is longer than preferred (${distanceKm.toFixed(1)}km)`);
        route.distanceWarning = `Route exceeds preferred ${PREFERRED_MAX_DISTANCE}km limit`;
    }
    
    return true;
}

// Get actual route distance (or estimate if not available)
function getRouteDistance(route) {
    // Try to get numeric distance
    if (route.totalDistance) {
        const distanceText = route.totalDistance.toString();
        // Extract numeric part from strings like "25.3 km" or "~30 km"
        const match = distanceText.match(/[~]?(\d+\.?\d*)/);
        if (match && match[1]) {
            return parseFloat(match[1]);
        }
    }
    
    // If we have estimated distance
    if (route.estimatedDistance) {
        return route.estimatedDistance;
    }
    
    // Fallback: calculate from stops
    if (route.stops && route.stops.length > 0) {
    let totalDistance = 0;
    
        for (let i = 0; i < route.stops.length - 1; i++) {
    totalDistance += calculateHaversineDistance(
                parseFloat(route.stops[i].snapped_lat), parseFloat(route.stops[i].snapped_lon),
                parseFloat(route.stops[i+1].snapped_lat), parseFloat(route.stops[i+1].snapped_lon)
            );
        }
        
        // Add distance from last stop to college
        totalDistance += calculateHaversineDistance(
            parseFloat(route.stops[route.stops.length-1].snapped_lat), 
            parseFloat(route.stops[route.stops.length-1].snapped_lon),
            COLLEGE_COORDS[0], COLLEGE_COORDS[1]
        );
        
        // Add 40% for actual road distances vs straight line
        return totalDistance * 1.4;
    }
    
    // Default fallback
    return 30; // Assume 30km if we can't calculate
}

// ✅ NEW: Create multiple smaller routes rather than a few large ones
async function createRoutesBySegment(stops, maxCapacity) {
    console.log(`🔍 Creating segment-based routes for ${stops.length} stops`);
    
    // STEP 1: Create distance bands from college
    const distanceBands = [
        { min: 0, max: 10, name: "close" },
        { min: 10, max: 20, name: "medium" },
        { min: 20, max: 40, name: "far" }
    ];
    
    // STEP 2: Group stops by distance band
    const stopsByBand = {};
    distanceBands.forEach(band => {
        stopsByBand[band.name] = [];
    });
    
    stops.forEach(stop => {
        const distance = calculateHaversineDistance(
        COLLEGE_COORDS[0], COLLEGE_COORDS[1],
            parseFloat(stop.snapped_lat), parseFloat(stop.snapped_lon)
        );
        
        // Find appropriate band
        const band = distanceBands.find(band => 
            distance >= band.min && distance < band.max
        );
        
        if (band) {
            stopsByBand[band.name].push({
                ...stop,
                distance,
                lat: parseFloat(stop.snapped_lat),
                lng: parseFloat(stop.snapped_lon)
            });
        }
    });
    
    // STEP 3: Process each band separately with direction-based clustering
    const routes = [];
    
    Object.entries(stopsByBand).forEach(([bandName, bandStops]) => {
        if (bandStops.length === 0) return;
        
        console.log(`📊 Processing ${bandName} band with ${bandStops.length} stops`);
        
        // Create narrow directional clusters within each band
        const dirClusters = createNarrowDirectionalClusters(bandStops);
        
        // Create routes from these narrow clusters
        dirClusters.forEach((cluster, index) => {
            // Split large clusters by capacity
            const clusterRoutes = splitClusterByCapacity(cluster, maxCapacity, `${bandName}-${index}`);
            routes.push(...clusterRoutes);
        });
    });
    
    console.log(`✅ Created ${routes.length} segment-based routes`);
    return routes;
}

// Create very narrow directional clusters (15° sectors)
function createNarrowDirectionalClusters(stops) {
    // Create 24 narrow sectors (15° each)
    const sectors = Array(24).fill().map((_, i) => ({
        minAngle: i * 15,
        maxAngle: (i + 1) * 15,
        stops: []
    }));
    
    // Assign stops to sectors
    stops.forEach(stop => {
        const bearing = calculateBearing(
            COLLEGE_COORDS[0], COLLEGE_COORDS[1],
            parseFloat(stop.lat), parseFloat(stop.lng)
        );
        
        const sectorIndex = Math.floor(bearing / 15) % 24;
        sectors[sectorIndex].stops.push({
            ...stop,
            bearing
        });
    });
    
    // Filter out empty sectors and sort stops within each
    const clusters = sectors
        .filter(sector => sector.stops.length > 0)
        .map(sector => {
            // Sort by distance from college
            sector.stops.sort((a, b) => a.distance - b.distance);
            return {
                direction: `${Math.floor((sector.minAngle + sector.maxAngle) / 2)}°`,
                minBearing: sector.minAngle,
                maxBearing: sector.maxAngle,
                stops: sector.stops,
                totalStudents: sector.stops.reduce((sum, s) => sum + parseInt(s.num_students), 0)
            };
        });
    
    return clusters;
}

// Split cluster by capacity
function splitClusterByCapacity(cluster, maxCapacity, prefix) {
    const routes = [];
    
    // Group stops into routes by capacity
    let currentRoute = {
        stops: [],
        totalStudents: 0,
        direction: cluster.direction,
        minBearing: cluster.minBearing,
        maxBearing: cluster.maxBearing,
        routeType: 'segment'
    };
    
    cluster.stops.forEach(stop => {
        const students = parseInt(stop.num_students);
        
        // If adding this stop would exceed capacity, create a new route
        if (currentRoute.totalStudents + students > maxCapacity && currentRoute.stops.length > 0) {
            finalizeSegmentRoute(currentRoute, routes.length + 1, prefix);
            routes.push(currentRoute);
            
            currentRoute = {
                stops: [stop],
                totalStudents: students,
                direction: cluster.direction,
                minBearing: cluster.minBearing,
                maxBearing: cluster.maxBearing,
                routeType: 'segment'
            };
        } else {
            currentRoute.stops.push(stop);
            currentRoute.totalStudents += students;
        }
    });
    
    // Add final route
    if (currentRoute.stops.length > 0) {
        finalizeSegmentRoute(currentRoute, routes.length + 1, prefix);
        routes.push(currentRoute);
    }
    
    return routes;
}

// Finalize segment route
function finalizeSegmentRoute(route, index, prefix) {
    // Sort stops by distance
    route.stops.sort((a, b) => a.distance - b.distance);
    
    // Calculate distance
    let totalDistance = 0;
    for (let i = 0; i < route.stops.length - 1; i++) {
        totalDistance += calculateHaversineDistance(
            parseFloat(route.stops[i].lat), parseFloat(route.stops[i].lng),
            parseFloat(route.stops[i+1].lat), parseFloat(route.stops[i+1].lng)
        );
    }
    
    // Add distance to college
    const lastStop = route.stops[route.stops.length - 1];
    totalDistance += calculateHaversineDistance(
        parseFloat(lastStop.lat), parseFloat(lastStop.lng),
        COLLEGE_COORDS[0], COLLEGE_COORDS[1]
    );
    
    // Add overhead for real roads
    totalDistance *= 1.3;
    
    // Set properties
    route.busId = `Bus ${prefix}-${index}`;
    route.efficiency = `${((route.totalStudents / 55) * 100).toFixed(1)}%`;
    route.totalDistance = `${totalDistance.toFixed(1)} km`;
    route.estimatedDistance = totalDistance;
}

// ✅ NEW: Calculate bearing between two points
function calculateBearing(lat1, lng1, lat2, lng2) {
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const lat1Rad = lat1 * Math.PI / 180;
    const lat2Rad = lat2 * Math.PI / 180;
    
    const y = Math.sin(dLng) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - 
              Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
    
    const bearingRad = Math.atan2(y, x);
    const bearingDeg = (bearingRad * 180 / Math.PI + 360) % 360;
    
    return bearingDeg;
}

// ✅ NEW: Detect if route backtracks significantly
function detectBacktracking(stops) {
    if (stops.length < 3) return 0;
    
    let totalDistance = 0;
    let backtrackDistance = 0;
    
    for (let i = 0; i < stops.length - 1; i++) {
        const currentStop = stops[i];
        const nextStop = stops[i + 1];
        
        const segmentDistance = calculateHaversineDistance(
            currentStop.lat, currentStop.lng,
            nextStop.lat, nextStop.lng
        );
        
        totalDistance += segmentDistance;
        
        // Check if we're moving away from college (backtracking)
        const currentDistanceFromCollege = currentStop.distance;
        const nextDistanceFromCollege = nextStop.distance;
        
        if (nextDistanceFromCollege < currentDistanceFromCollege) {
            // We're getting closer to college - this might be backtracking
            const backtrackAmount = currentDistanceFromCollege - nextDistanceFromCollege;
            backtrackDistance += backtrackAmount;
        }
    }
    
    return totalDistance > 0 ? backtrackDistance / totalDistance : 0;
}

// ✅ NEW: Find optimal depot based on cluster direction and position
function findOptimalDepot(cluster) {
    if (!cluster.stops || cluster.stops.length === 0) {
        return depotsData[0]; // Fallback
    }
    
    // Calculate cluster centroid
    const centroidLat = cluster.stops.reduce((sum, stop) => sum + parseFloat(stop.lat || stop.snapped_lat), 0) / cluster.stops.length;
    const centroidLng = cluster.stops.reduce((sum, stop) => sum + parseFloat(stop.lng || stop.snapped_lon), 0) / cluster.stops.length;
    
    // Find depot that:
    // 1. Is closest to the cluster
    // 2. Is in the same general direction from college
    let bestDepot = depotsData[0];
    let bestScore = -Infinity;
    
    depotsData.forEach(depot => {
        const depotLat = parseFloat(depot.Latitude);
        const depotLng = parseFloat(depot.Longitude);
        
        // Distance to cluster centroid (closer is better)
        const distanceToCluster = calculateHaversineDistance(centroidLat, centroidLng, depotLat, depotLng);
        
        // Bearing alignment with cluster direction
        const depotBearing = calculateBearing(COLLEGE_COORDS[0], COLLEGE_COORDS[1], depotLat, depotLng);
        let clusterBearing = 0;
        
        // Different clusters have different ways of storing bearing info
        if (cluster.minBearing !== undefined && cluster.maxBearing !== undefined) {
            clusterBearing = (cluster.minBearing + cluster.maxBearing) / 2;
            if (Math.abs(cluster.maxBearing - cluster.minBearing) > 180) {
                // Handle wrapping around North
                clusterBearing = (clusterBearing + 180) % 360;
            }
        } else if (cluster.direction && !isNaN(parseFloat(cluster.direction))) {
            clusterBearing = parseFloat(cluster.direction);
        } else if (cluster.direction && cluster.direction.includes('°')) {
            clusterBearing = parseFloat(cluster.direction);
        }
        
        let bearingDiff = Math.abs(depotBearing - clusterBearing);
        if (bearingDiff > 180) bearingDiff = 360 - bearingDiff;
        
        // Score: prioritize direction alignment over distance
        const directionScore = 100 - distanceToCluster; // Higher score for better alignment
        const distanceScore = Math.max(0, 50 - bearingDiff); // Higher score for closer distance
        
        const totalScore = directionScore  + distanceScore; // Weight direction more heavily
        
        if (totalScore > bestScore) {
            bestScore = totalScore;
            bestDepot = depot;
        }
    });
    
    return bestDepot;
}

// ✅ NEW: Validate cluster doesn't create loops
function validateClusterStraightness(cluster) {
    const MAX_BEARING_SPREAD = 90; // Maximum 90° spread allowed
    const MAX_STRAIGHTNESS_FACTOR = 0.5; // Maximum 50% deviation allowed
    const MAX_BACKTRACK_RATIO = 0.4; // Maximum 40% backtracking allowed
    
    // Check 1: Bearing spread
    let bearingSpread = 0;
    if (cluster.minBearing !== undefined && cluster.maxBearing !== undefined) {
        bearingSpread = cluster.maxBearing - cluster.minBearing;
        if (bearingSpread < 0) bearingSpread += 360;
        if (bearingSpread > 180) bearingSpread = 360 - bearingSpread;
    
        if (bearingSpread > MAX_BEARING_SPREAD) {
            console.warn(`❌ Cluster ${cluster.direction} rejected: bearing spread ${bearingSpread.toFixed(1)}° > ${MAX_BEARING_SPREAD}°`);
            return false;
        }
    }
    
    // Check 2: Straightness factor
    if (cluster.straightnessFactor !== undefined && cluster.straightnessFactor > MAX_STRAIGHTNESS_FACTOR) {
        console.warn(`❌ Cluster ${cluster.direction} rejected: straightness factor ${cluster.straightnessFactor.toFixed(2)} > ${MAX_STRAIGHTNESS_FACTOR}`);
        return false;
    }
    
    // Check 3: Backtracking detection
    const backtrackRatio = detectBacktracking(cluster.stops);
    if (backtrackRatio > MAX_BACKTRACK_RATIO) {
        console.warn(`❌ Cluster ${cluster.direction} rejected: backtracking ${(backtrackRatio * 100).toFixed(1)}% > ${MAX_BACKTRACK_RATIO * 100}%`);
        return false;
    }
    
    if (cluster.straightnessFactor !== undefined) {
        console.log(`✅ Cluster ${cluster.direction} validated: spread ${bearingSpread.toFixed(1)}°, straightness ${cluster.straightnessFactor.toFixed(2)}, backtrack ${(backtrackRatio * 100).toFixed(1)}%`);
    } else {
        console.log(`✅ Cluster ${cluster.direction} validated: spread ${bearingSpread.toFixed(1)}°, backtrack ${(backtrackRatio * 100).toFixed(1)}%`);
    }
    return true;
}

// ✅ NEW: Finalize cluster with straightness metrics
function finalizeCluster(cluster) {
    if (cluster.stops.length === 0) return;
    
    // Calculate bearing spread
    if (cluster.minBearing !== undefined && cluster.maxBearing !== undefined) {
        cluster.bearingSpread = cluster.maxBearing - cluster.minBearing;
        
        // Handle edge case where bearings cross 0° (North)
        if (cluster.bearingSpread > 180) {
            cluster.bearingSpread = 360 - cluster.bearingSpread;
        }
    }
    
    // Calculate route straightness factor
    cluster.straightnessFactor = calculateStraightnessFactor(cluster.stops);
    
    // Sort stops by distance for optimal routing
    cluster.stops.sort((a, b) => {
        const distA = a.distance || calculateHaversineDistance(
            COLLEGE_COORDS[0], COLLEGE_COORDS[1],
            parseFloat(a.lat || a.snapped_lat), parseFloat(a.lng || a.snapped_lon)
        );
        
        const distB = b.distance || calculateHaversineDistance(
            COLLEGE_COORDS[0], COLLEGE_COORDS[1],
            parseFloat(b.lat || b.snapped_lat), parseFloat(b.lng || b.snapped_lon)
        );
        
        return distA - distB;
    });
}

// ✅ NEW: Calculate how "straight" a route is (0 = perfectly straight, 1 = maximum deviation)
function calculateStraightnessFactor(stops) {
    if (stops.length < 3) return 0; // Can't deviate with less than 3 points
    
    let totalDeviation = 0;
    
    // Check each triplet of consecutive stops
    for (let i = 0; i < stops.length - 2; i++) {
        const stop1 = stops[i];
        const stop2 = stops[i + 1];
        const stop3 = stops[i + 2];
        
        // Get coordinates
        const lat1 = parseFloat(stop1.lat || stop1.snapped_lat);
        const lng1 = parseFloat(stop1.lng || stop1.snapped_lon);
        const lat2 = parseFloat(stop2.lat || stop2.snapped_lat);
        const lng2 = parseFloat(stop2.lng || stop2.snapped_lon);
        const lat3 = parseFloat(stop3.lat || stop3.snapped_lat);
        const lng3 = parseFloat(stop3.lng || stop3.snapped_lon);
        
        // Calculate bearing from stop1 to stop2
        const bearing1to2 = calculateBearing(lat1, lng1, lat2, lng2);
        
        // Calculate bearing from stop2 to stop3
        const bearing2to3 = calculateBearing(lat2, lng2, lat3, lng3);
        
        // Calculate angular deviation
        let angularDiff = Math.abs(bearing2to3 - bearing1to2);
        if (angularDiff > 180) angularDiff = 360 - angularDiff;
        
        totalDeviation += angularDiff;
    }
    
    // Normalize (maximum possible deviation per segment is 180°)
    const maxPossibleDeviation = (stops.length - 2) * 180;
    return totalDeviation / maxPossibleDeviation;
}

// ✅ NEW: Analyze route coverage
function analyzeRouteCoverage(routes, allStops) {
    const stopMap = new Map(); // Map stops to routes serving them
    const studentMap = new Map(); // Map student counts by stop ID
    
    // Build map of all stops
    allStops.forEach(stop => {
        const stopId = stop.cluster_number || stop.id;
        stopMap.set(stopId, []);
        studentMap.set(stopId, parseInt(stop.num_students) || 0);
    });
    
    // Track which routes serve which stops
    routes.forEach((route, routeIndex) => {
        route.stops.forEach(stop => {
            const stopId = stop.cluster_number || stop.id;
            if (stopMap.has(stopId)) {
                stopMap.get(stopId).push(routeIndex);
            }
        });
    });
    
    // Count served and unserved stops
    const servedStops = [];
    const unservedStops = [];
    let duplicateStops = 0;
    let servedStudents = 0;
    
    stopMap.forEach((servingRoutes, stopId) => {
        if (servingRoutes.length > 0) {
            servedStops.push(stopId);
            servedStudents += studentMap.get(stopId);
            
            // Count stops served by multiple routes
            if (servingRoutes.length > 1) {
                duplicateStops++;
            }
        } else {
            // Find the original stop object
            const originalStop = allStops.find(s => (s.cluster_number || s.id) === stopId);
            if (originalStop) {
                unservedStops.push(originalStop);
            }
        }
    });
    
    // Create deduplicated routes (each stop appears in only one route)
    const servingRoutes = [];
    const routesAdded = new Set();
    
    // First add routes that uniquely serve stops
    stopMap.forEach((routeIndices, stopId) => {
        if (routeIndices.length === 1) {
            const routeIndex = routeIndices[0];
            if (!routesAdded.has(routeIndex)) {
                servingRoutes.push(routes[routeIndex]);
                routesAdded.add(routeIndex);
            }
        }
    });
    
    // Then add routes with duplicated stops if they weren't already added
    routes.forEach((route, index) => {
        if (!routesAdded.has(index)) {
            servingRoutes.push(route);
            routesAdded.add(index);
        }
    });
    
    return {
        servingRoutes,
        servedStops,
        unservedStops,
        duplicateStops,
        servedStudents
    };
}

// ✅ NEW: Create routes specifically for unserved stops
async function createSalvageRoutes(unservedStops, maxCapacity) {
    // Focus on serving unserved stops with very small, efficient routes
    
    // Group by proximity
    const stopClusters = [];
    const processedStops = new Set();
    
    // For each unprocessed stop, find nearby stops
    for (const stop of unservedStops) {
        const stopId = stop.cluster_number || stop.id;
        
        if (processedStops.has(stopId)) continue;
        
        const nearbyStops = [stop];
        processedStops.add(stopId);
        
        // Find other stops within 3km
        for (const other of unservedStops) {
            const otherId = other.cluster_number || other.id;
            
            if (processedStops.has(otherId)) continue;
            
            const distance = calculateHaversineDistance(
                parseFloat(stop.snapped_lat), parseFloat(stop.snapped_lon),
                parseFloat(other.snapped_lat), parseFloat(other.snapped_lon)
            );
            
            if (distance <= 3) {
                nearbyStops.push(other);
                processedStops.add(otherId);
            }
        }
        
        // If we have stops, create a cluster
        if (nearbyStops.length > 0) {
            const totalStudents = nearbyStops.reduce(
                (sum, s) => sum + parseInt(s.num_students), 0
            );
            
            stopClusters.push({
                stops: nearbyStops,
                totalStudents,
                centerLat: nearbyStops.reduce((sum, s) => sum + parseFloat(s.snapped_lat), 0) / nearbyStops.length,
                centerLng: nearbyStops.reduce((sum, s) => sum + parseFloat(s.snapped_lon), 0) / nearbyStops.length
            });
        }
    }
    
    // Sort clusters by student count (largest first)
    stopClusters.sort((a, b) => b.totalStudents - a.totalStudents);
    
    // Create routes from clusters
    const salvageRoutes = [];
    
    // Merge small nearby clusters until they reach capacity
    let currentRoute = {
        stops: [],
        totalStudents: 0,
        routeType: 'salvage'
    };
    
    for (let i = 0; i < stopClusters.length; i++) {
        const cluster = stopClusters[i];
        
        // If adding this cluster would exceed capacity, create new route
        if (currentRoute.totalStudents + cluster.totalStudents > maxCapacity && currentRoute.stops.length > 0) {
            finalizeSalvageRoute(currentRoute, salvageRoutes.length + 1);
            salvageRoutes.push(currentRoute);
            
            currentRoute = {
                stops: [...cluster.stops],
                totalStudents: cluster.totalStudents,
                routeType: 'salvage'
            };
        } else {
            // Add cluster to current route
            currentRoute.stops.push(...cluster.stops);
            currentRoute.totalStudents += cluster.totalStudents;
        }
    }
    
    // Add final route
    if (currentRoute.stops.length > 0) {
        finalizeSalvageRoute(currentRoute, salvageRoutes.length + 1);
        salvageRoutes.push(currentRoute);
    }
    
    return salvageRoutes;
}

// Finalize salvage route
function finalizeSalvageRoute(route, index) {
    // Calculate center point of route
    const centerLat = route.stops.reduce((sum, s) => sum + parseFloat(s.snapped_lat), 0) / route.stops.length;
    const centerLng = route.stops.reduce((sum, s) => sum + parseFloat(s.snapped_lon), 0) / route.stops.length;
    
    // Calculate bearing from college to center
    const bearing = calculateBearing(
        COLLEGE_COORDS[0], COLLEGE_COORDS[1],
        centerLat, centerLng
    );
    
    // Add properties
    route.busId = `Salvage ${index}`;
    route.direction = `S-${Math.round(bearing/10)*10}°`;
    route.minBearing = bearing - 20;
    route.maxBearing = bearing + 20;
    route.efficiency = `${((route.totalStudents / 55) * 100).toFixed(1)}%`;
    
    // Calculate best route order
    optimizeRouteOrder(route);
}

// Optimize stop order in a route
function optimizeRouteOrder(route) {
    // Sort by distance to create initial ordering
    route.stops.sort((a, b) => {
        const distA = calculateHaversineDistance(
            COLLEGE_COORDS[0], COLLEGE_COORDS[1],
            parseFloat(a.snapped_lat), parseFloat(a.snapped_lon)
        );
        const distB = calculateHaversineDistance(
            COLLEGE_COORDS[0], COLLEGE_COORDS[1],
            parseFloat(b.snapped_lat), parseFloat(b.snapped_lon)
        );
        return distA - distB;
    });
    
    // Calculate total distance with this ordering
    let totalDistance = 0;
    for (let i = 0; i < route.stops.length - 1; i++) {
        totalDistance += calculateHaversineDistance(
            parseFloat(route.stops[i].snapped_lat), parseFloat(route.stops[i].snapped_lon),
            parseFloat(route.stops[i+1].snapped_lat), parseFloat(route.stops[i+1].snapped_lon)
        );
    }
    
    // Add distance to college
    const lastStop = route.stops[route.stops.length - 1];
    totalDistance += calculateHaversineDistance(
        parseFloat(lastStop.snapped_lat), parseFloat(lastStop.snapped_lon),
        COLLEGE_COORDS[0], COLLEGE_COORDS[1]
    );
    
    // Add overhead for real roads
    totalDistance *= 1.3;
    
    route.totalDistance = `${totalDistance.toFixed(1)} km`;
    route.estimatedDistance = totalDistance;
}

// ✅ FIXED: Better error handling for Directions API
async function getDirectionsWithFallback(group, depot, routeIndex) {
    // Create waypoints for this group
    const waypoints = group.stops.map(stop => ({
        location: { 
            lat: parseFloat(stop.lat || stop.snapped_lat), 
            lng: parseFloat(stop.lng || stop.snapped_lon) 
        },
        stopover: true
    }));
    
    const routeRequest = {
        origin: { 
            lat: parseFloat(depot.Latitude), 
            lng: parseFloat(depot.Longitude) 
        },
        destination: { 
            lat: COLLEGE_COORDS[0], 
            lng: COLLEGE_COORDS[1] 
        },
        waypoints: waypoints,
        optimizeWaypoints: true,
        travelMode: 'DRIVING',
        avoidTolls: false,
        avoidHighways: false,
        avoidFerries: true
    };
    
    try {
        console.log(`🔄 Calling Directions API for route ${routeIndex}...`);
        
        // ✅ ADD TIMEOUT to API call
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        const response = await fetch('http://localhost:3000/api/directions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(routeRequest),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
            const directionsResult = await response.json();
            console.log(`✅ Directions API responded for route ${routeIndex}`);
            return processDirectionsResponse(directionsResult, group, depot, routeIndex);
        } else {
            const errorText = await response.text();
            console.warn(`❌ Directions API failed for route ${routeIndex}: ${response.status} - ${errorText}`);
            return createBasicRoute(group, depot, routeIndex);
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            console.warn(`⏱️ Directions API timeout for route ${routeIndex}`);
        } else {
            console.error(`❌ Directions API error for route ${routeIndex}:`, error);
        }
        return createBasicRoute(group, depot, routeIndex);
    }
}

// ✅ ENHANCED: Route processing with loop detection
function processDirectionsResponse(directionsResult, group, depot, routeIndex) {
    if (!directionsResult.routes || directionsResult.routes.length === 0) {
        console.warn(`No directions found for route ${routeIndex}`);
        return createBasicRoute(group, depot, routeIndex);
    }
    
    const route = directionsResult.routes[0];
    const totalDistance = route.legs.reduce((sum, leg) => sum + leg.distance.value, 0) / 1000;
    const totalDuration = route.legs.reduce((sum, leg) => sum + leg.duration.value, 0) / 60;
    
    // ✅ ENHANCED: Loop detection in Google's route
    const loopDetected = detectRouteLooping(route);
    if (loopDetected.hasLoop) {
        console.warn(`❌ Route ${routeIndex} contains loops: ${loopDetected.reason}`);
        return createRadialRoute(group, depot, routeIndex); // Force radial route
    }
    
    // Distance check
    if (totalDistance > 50) { // Stricter limit
        console.warn(`❌ Route ${routeIndex} too long (${totalDistance.toFixed(1)}km)`);
        return createRadialRoute(group, depot, routeIndex);
    }
    
    // Reorder stops based on Google's optimization (but validate it)
    let orderedStops = [...group.stops];
    if (route.waypoint_order) {
        const proposedOrder = route.waypoint_order.map(index => group.stops[index]);
        
        // Validate the proposed order doesn't create loops
        if (!createsLoops(proposedOrder)) {
            orderedStops = proposedOrder;
        } else {
            console.warn(`❌ Google's waypoint order creates loops - using radial order`);
            orderedStops = group.stops.sort((a, b) => {
                const distA = a.distance || calculateHaversineDistance(
                    COLLEGE_COORDS[0], COLLEGE_COORDS[1],
                    parseFloat(a.lat || a.snapped_lat), parseFloat(a.lng || a.snapped_lon)
                );
                const distB = b.distance || calculateHaversineDistance(
                    COLLEGE_COORDS[0], COLLEGE_COORDS[1],
                    parseFloat(b.lat || b.snapped_lat), parseFloat(b.lng || b.snapped_lon)
                );
                return distA - distB;
            });
        }
    }
    
    const maxCapacity = parseInt(document.getElementById('maxCapacity').value) || 55;
    const efficiency = ((group.totalStudents / maxCapacity) * 100).toFixed(1);
    
    return {
        busId: `Bus ${routeIndex}`,
        depot: depot['Parking Name'],
        stops: orderedStops,
        totalStudents: group.totalStudents,
        efficiency: `${efficiency}%`,
        totalDistance: `${totalDistance.toFixed(1)} km`,
        totalTime: `${Math.round(totalDuration)} min`,
        accessibility: { isValid: true, issues: [] },
        isGoogleOptimized: true,
        direction: group.direction,
        routeType: 'straight-line',
        loopValidation: { passed: true, method: 'google-validated' }
    };
}

// ✅ NEW: Detect loops in Google's route response
function detectRouteLooping(route) {
    // Check for excessive direction changes
    let directionChanges = 0;
    let previousBearing = null;
    
    route.legs.forEach(leg => {
        leg.steps.forEach(step => {
            if (step.start_location && step.end_location) {
                const bearing = calculateBearing(
                    step.start_location.lat, step.start_location.lng,
                    step.end_location.lat, step.end_location.lng
                );
                
                if (previousBearing !== null) {
                    let bearingDiff = Math.abs(bearing - previousBearing);
                    if (bearingDiff > 180) bearingDiff = 360 - bearingDiff;
                    
                    // Count significant direction changes (>45°)
                    if (bearingDiff > 45) {
                        directionChanges++;
                    }
                }
                previousBearing = bearing;
            }
        });
    });
    
    // Too many direction changes indicate looping
    const maxAllowedChanges = route.legs.length * 2; // Allow some flexibility
    if (directionChanges > maxAllowedChanges) {
        return {
            hasLoop: true,
            reason: `Too many direction changes: ${directionChanges} > ${maxAllowedChanges}`
        };
    }
    
    return { hasLoop: false };
}

// ✅ NEW: Check if stop order creates loops
function createsLoops(stops) {
    if (stops.length < 3) return false;
    
    // Check if distance from college generally increases
    let backwardMovements = 0;
    
    for (let i = 1; i < stops.length; i++) {
        const currentStop = stops[i];
        const previousStop = stops[i - 1];
        
        const currentDistance = currentStop.distance || calculateHaversineDistance(
            COLLEGE_COORDS[0], COLLEGE_COORDS[1],
            parseFloat(currentStop.lat || currentStop.snapped_lat), 
            parseFloat(currentStop.lng || currentStop.snapped_lon)
        );
        
        const previousDistance = previousStop.distance || calculateHaversineDistance(
            COLLEGE_COORDS[0], COLLEGE_COORDS[1],
            parseFloat(previousStop.lat || previousStop.snapped_lat), 
            parseFloat(previousStop.lng || previousStop.snapped_lon)
        );
        
        // If we're moving significantly backward toward college
        if (currentDistance < previousDistance - 2) { // 2km tolerance
            backwardMovements++;
        }
    }
    
    // Allow some flexibility but detect major backtracking
    const backtrackRatio = backwardMovements / (stops.length - 1);
    return backtrackRatio > 0.3; // More than 30% backward movements
}

// ✅ NEW: Create guaranteed radial (straight-line) route
function createRadialRoute(group, depot, routeIndex) {
    // Force radial ordering: closest to farthest from college
    const radialStops = group.stops.sort((a, b) => {
        const distA = a.distance || calculateHaversineDistance(
            COLLEGE_COORDS[0], COLLEGE_COORDS[1],
            parseFloat(a.lat || a.snapped_lat), parseFloat(a.lng || a.snapped_lon)
        );
        const distB = b.distance || calculateHaversineDistance(
            COLLEGE_COORDS[0], COLLEGE_COORDS[1],
            parseFloat(b.lat || b.snapped_lat), parseFloat(b.lng || b.snapped_lon)
        );
        return distA - distB;
    });
    
    // Calculate estimated distance (radial routes are typically shortest)
    const farthestStop = radialStops[radialStops.length - 1];
    const farthestDistance = farthestStop.distance || calculateHaversineDistance(
        COLLEGE_COORDS[0], COLLEGE_COORDS[1],
        parseFloat(farthestStop.lat || farthestStop.snapped_lat),
        parseFloat(farthestStop.lng || farthestStop.snapped_lon)
    );
    
    const estimatedDistance = Math.max(
        15, // Minimum realistic distance
        farthestDistance * 1.3 // Farthest stop distance + 30% for routing
    );
    
    return {
        busId: `Bus ${routeIndex}`,
        depot: depot['Parking Name'],
        stops: radialStops,
        totalStudents: group.totalStudents,
        efficiency: `${((group.totalStudents / 55) * 100).toFixed(1)}%`,
        totalDistance: `${Math.min(50, estimatedDistance).toFixed(1)} km`, // Cap at 30km
        totalTime: 'Estimated',
        accessibility: { isValid: true, issues: [] },
        direction: group.direction,
        routeType: 'radial-forced',
        loopValidation: { passed: true, method: 'radial-guaranteed' }
    };
}

// ✅ IMPROVED: Better basic route creation
function createBasicRoute(group, depot, routeIndex) {
    // Calculate more accurate distance estimation
    let totalDistance = 0;
    
    // Distance from depot to first stop
    if (group.stops.length > 0) {
        const firstStop = group.stops[0];
        totalDistance += calculateHaversineDistance(
            parseFloat(depot.Latitude), parseFloat(depot.Longitude),
            parseFloat(firstStop.lat || firstStop.snapped_lat), 
            parseFloat(firstStop.lng || firstStop.snapped_lon)
        );
    }
    
    // Distance between stops
    for (let i = 1; i < group.stops.length; i++) {
        const prevStop = group.stops[i-1];
        const currStop = group.stops[i];
        
        totalDistance += calculateHaversineDistance(
            parseFloat(prevStop.lat || prevStop.snapped_lat), 
            parseFloat(prevStop.lng || prevStop.snapped_lon),
            parseFloat(currStop.lat || currStop.snapped_lat), 
            parseFloat(currStop.lng || currStop.snapped_lon)
        );
    }
    
    // Distance from last stop to college
    if (group.stops.length > 0) {
        const lastStop = group.stops[group.stops.length - 1];
        totalDistance += calculateHaversineDistance(
            parseFloat(lastStop.lat || lastStop.snapped_lat), 
            parseFloat(lastStop.lng || lastStop.snapped_lon),
            COLLEGE_COORDS[0], COLLEGE_COORDS[1]
        );
    }
    
    // Add 20% for realistic routing
    totalDistance *= 1.2;
    
    const efficiency = ((group.totalStudents / 55) * 100).toFixed(1);
    const routeType = group.routeType || 'optimized';
    
    return {
        busId: `Bus ${routeIndex}`,
        depot: depot['Parking Name'],
        stops: group.stops,
        totalStudents: group.totalStudents,
        efficiency: `${efficiency}%`,
        totalDistance: `${Math.min(50, totalDistance).toFixed(1)} km`,
        totalTime: `${Math.round(totalDistance * 2)} min`, // Rough estimate: 30 km/h avg speed
        accessibility: { isValid: true, issues: [] },
        direction: group.direction,
        routeType: routeType,
        isEstimated: true
    };
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

// ✅ DEBUG: Check if your server is running
function checkServerStatus() {
    fetch('http://localhost:3000/health')
        .then(response => {
            if (response.ok) {
                console.log('✅ Server is running');
            } else {
                console.warn('⚠️ Server responded but may have issues');
            }
        })
        .catch(error => {
            console.error('❌ Server is not running:', error);
            console.log('💡 Make sure your Node.js server is running on port 3000');
        });
}

// ✅ ADVANCED ROUTE OPTIMIZATION: Angular Slicing with Inward-Flowing Routes
// This algorithm creates much better routes by using angular sectors and ensuring routes flow inward toward college

// --- Geometry helpers ---
function toRad(d) { return d * Math.PI / 180; }

function haversine(a, b) {
    const R = 6371000, dLat = toRad(b.lat - a.lat), dLon = toRad(b.lng - a.lng);
    const s1 = Math.sin(dLat / 2), s2 = Math.sin(dLon / 2);
    const q = s1 * s1 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * s2 * s2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(q)));
}

function bearing(a, b) {
    const φ1 = toRad(a.lat), φ2 = toRad(b.lat), dλ = toRad(b.lng - a.lng);
    const y = Math.sin(dλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(dλ);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function turnDelta(deg1, deg2) {
    let d = Math.abs(deg1 - deg2);
    return d > 180 ? 360 - d : d;
}

// --- Parameters you can tune ---
const DEST = { lat: COLLEGE_COORDS[0], lng: COLLEGE_COORDS[1] }; // college
const ANGLE_SLICE_DEG = 12;      // 10–15° works well
const ROAD_FACTOR = 1.25;        // road detour factor vs straight-line
const MONOTONE_DELTA_M = 300;    // each hop should move ≥300 m closer to DEST
const MAX_TURN_DEG = 70;         // keep heading generally toward DEST
const MAX_ROUTE_M = 40000;       // soft prefer, hard cap elsewhere 50km
const HARD_MAX_ROUTE_M = 50000;

// --- Preprocess: assign angle+radius per stop from DEST ---
function decorateStopsWithPolar(stops) {
    return stops.map(s => {
        const stopCoord = { lat: parseFloat(s.snapped_lat), lng: parseFloat(s.snapped_lon) };
        const r = haversine(DEST, stopCoord);
        const θ = bearing(DEST, stopCoord);
        return { 
            ...s, 
            r, 
            theta: θ,
            lat: stopCoord.lat,
            lng: stopCoord.lng,
            students: parseInt(s.num_students) || 1
        };
    });
}

// --- Bucket by angular slices ---
function bucketByAngle(stops) {
    const buckets = new Map();
    for (const s of stops) {
        const key = Math.floor(s.theta / ANGLE_SLICE_DEG);
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(s);
    }
    // sort each bucket by radius descending (farther first)
    for (const [, arr] of buckets) arr.sort((a, b) => b.r - a.r);
    return buckets;
}

// --- Route builder for a bucket (with borrow from neighbors when needed) ---
function buildRoutesFromBucket(buckets, key, maxCapacity, depot) {
    const my = buckets.get(key) || [];
    const left = buckets.get(key - 1) || [];
    const right = buckets.get(key + 1) || [];

    const pool = [...my]; // we'll borrow from neighbors only if needed

    const routes = [];
    while (pool.length) {
        let route = [];
        let load = 0;
        let dist = 0;

        // start at farthest remaining
        route.push(pool.shift());

        while (true) {
            const cur = route[route.length - 1];

            // candidate list: prefer same bucket first
            const candidates = pool.length ? pool : (left.length ? left : right);

            let best = null, bestGain = Infinity;
            for (let i = 0; i < candidates.length; i++) {
                const cand = candidates[i];
                // capacity early
                if ((load + (cand.students || 1)) > maxCapacity) continue;

                // monotone progress toward DEST
                if (cand.r > cur.r - MONOTONE_DELTA_M) continue;

                // heading constraint: prefer moves that keep overall bearing toward DEST
                const curHead = bearing(cur, DEST);
                const moveHead = bearing(cur, cand);
                if (turnDelta(curHead, moveHead) > MAX_TURN_DEG) continue;

                // projected length
                const leg = haversine(cur, cand) * ROAD_FACTOR;
                if ((dist + leg) > MAX_ROUTE_M) continue;

                if (leg < bestGain) {
                    bestGain = leg;
                    best = { idx: i, arr: candidates, stop: cand, leg };
                }
            }

            if (!best) break; // no feasible next hop

            route.push(best.stop);
            dist += best.leg;
            load += (best.stop.students || 1);
            best.arr.splice(best.idx, 1); // remove from its source array
        }

        // close route to DEST (college)
        const tail = route[route.length - 1];
        dist += haversine(tail, DEST) * ROAD_FACTOR;

        // hard cap check; if broken, split tail off to new route
        if (dist > HARD_MAX_ROUTE_M && route.length > 1) {
            const last = route.pop();
            // return last to its home bucket
            const homeKey = Math.floor(last.theta / ANGLE_SLICE_DEG);
            (buckets.get(homeKey) || my).push(last);
            // recompute dist w/o last
            const tail2 = route[route.length - 1];
            dist = 0;
            for (let i = 0; i < route.length - 1; i++) {
                dist += haversine(route[i], route[i + 1]) * ROAD_FACTOR;
            }
            dist += haversine(tail2, DEST) * ROAD_FACTOR;
        }

        routes.push({ stops: route, load, dist, depot });
    }
    return routes;
}

// --- 2-opt improvement on stop order (keeps DEST as sink) ---
function twoOptImprove(routeStops) {
    // routeStops are from farthest->nearest already; still, 2-opt can clean kinks
    function tourLength(arr) {
        let L = 0;
        for (let i = 0; i < arr.length - 1; i++) L += haversine(arr[i], arr[i + 1]) * ROAD_FACTOR;
        L += haversine(arr[arr.length - 1], DEST) * ROAD_FACTOR;
        return L;
    }
    let best = routeStops.slice();
    let bestL = tourLength(best);
    let improved = true;

    while (improved) {
        improved = false;
        for (let i = 0; i < best.length - 2; i++) {
            for (let k = i + 1; k < best.length - 1; k++) {
                const candidate = best.slice(0, i + 1)
                    .concat(best.slice(i + 1, k + 1).reverse())
                    .concat(best.slice(k + 1));
                const L = tourLength(candidate);
                if (L + 5 < bestL) { // small threshold to avoid micro-flips
                    best = candidate;
                    bestL = L;
                    improved = true;
                }
            }
        }
    }
    return best;
}

// --- Main: produce clean, inward-flowing routes ---
function buildOptimizedRoutes(stops, depots, maxCapacity) {
    console.log(`🎯 Building advanced optimized routes for ${stops.length} stops`);
    
    const S = decorateStopsWithPolar(stops);
    const buckets = bucketByAngle(S);

    console.log(`📊 Created ${buckets.size} angular sectors (${ANGLE_SLICE_DEG}° each)`);

    const allRoutes = [];
    for (const [key] of buckets) {
        // pick best depot for this sector (closest to sector centroid or to farthest stop)
        const depot = pickDepotForSector(key, buckets, depots);
        const sectorRoutes = buildRoutesFromBucket(buckets, key, maxCapacity, depot)
            .map(r => {
                const cleaned = twoOptImprove(r.stops);
                // recompute distance
                let d = 0;
                for (let i = 0; i < cleaned.length - 1; i++)
                    d += haversine(cleaned[i], cleaned[i + 1]) * ROAD_FACTOR;
                d += haversine(cleaned[cleaned.length - 1], DEST) * ROAD_FACTOR;
                return { ...r, stops: cleaned, dist: d };
            });
        allRoutes.push(...sectorRoutes);
    }
    
    console.log(`✅ Generated ${allRoutes.length} advanced optimized routes`);
    return allRoutes;
}

function pickDepotForSector(key, buckets, depots) {
    // simple: choose depot closest to the farthest stop in this sector
    const arr = buckets.get(key) || [];
    if (!arr.length) return depots[0];
    const far = arr[0];
    let best = depots[0], bd = Infinity;
    for (const d of depots) {
        const depotCoord = { lat: parseFloat(d.Latitude), lng: parseFloat(d.Longitude) };
        const dd = haversine(depotCoord, far);
        if (dd < bd) { bd = dd; best = d; }
    }
    return best;
}

// ✅ ENHANCED: Convert advanced routes to your existing format
function convertAdvancedRoutesToFormat(advancedRoutes, routeIndex) {
    return advancedRoutes.map((route, index) => {
        // Convert stops back to your format
        const formattedStops = route.stops.map(stop => ({
            cluster_number: stop.cluster_number,
            snapped_lat: stop.lat.toString(),
            snapped_lon: stop.lng.toString(),
            num_students: stop.students.toString(),
            lat: stop.lat,
            lng: stop.lng,
            distance: stop.r / 1000 // Convert to km
        }));

        // Calculate direction from sector
        const sectorAngle = route.stops.length > 0 ? route.stops[0].theta : 0;
        const direction = `${Math.round(sectorAngle)}°`;

        return {
            busId: `Bus ${routeIndex + index + 1} (Advanced)`,
            depot: route.depot['Parking Name'] || 'Main Depot',
            stops: formattedStops,
            totalStudents: route.load,
            efficiency: `${((route.load / 55) * 100).toFixed(1)}%`,
            totalDistance: `${(route.dist / 1000).toFixed(1)} km`,
            estimatedDistance: route.dist / 1000,
            direction: direction,
            routeType: 'advanced-angular',
            assignedDepot: route.depot,
            minBearing: sectorAngle - 6,
            maxBearing: sectorAngle + 6,
            isAdvancedOptimized: true
        };
    });
}

// Enhanced Bus Route Optimization with Real GPS Network Constraints
// This builds a road network from actual bus GPS tracking data and constrains routes to it

// ===== GPS NETWORK PREPROCESSING =====

// Global variables for the bus network
let busRouteNetwork = null;
let networkNodes = new Map();
let networkEdges = new Map();

/**
 * Load and process GPS tracking data from CSV to build bus-accessible network
 */
async function loadAndProcessGPSNetwork(csvData) {
    console.log('🗺️ Building bus-accessible network from GPS data...');
    
    const routes = parseGPSData(csvData);
    const network = buildRouteNetwork(routes);
    
    busRouteNetwork = network;
    console.log(`✅ Built network with ${network.nodes.size} nodes and ${network.edges.size} edges`);
    
    return network;
}

/**
 * Parse CSV data and group by vehicle/route
 */
function parseGPSData(csvData) {
    const lines = csvData.trim().split('\n').slice(1); // Skip header
    const routeMap = new Map();
    
    lines.forEach(line => {
        const [vehicle, device, speed, distance, fuel, timestamp, lat, lng, location, scraped] = line.split(',');
        
        if (!lat || !lng || lat === 'latitude' || lng === 'longitude') return;
        
        const point = {
            lat: parseFloat(lat),
            lng: parseFloat(lng),
            timestamp: new Date(timestamp),
            speed: parseFloat(speed) || 0,
            vehicle: vehicle
        };
        
        if (isValidCoordinate(point.lat, point.lng)) {
            if (!routeMap.has(vehicle)) {
                routeMap.set(vehicle, []);
            }
            routeMap.get(vehicle).push(point);
        }
    });
    
    // Sort points by timestamp for each vehicle
    routeMap.forEach(points => {
        points.sort((a, b) => a.timestamp - b.timestamp);
    });
    
    return routeMap;
}

/**
 * Build a network graph from GPS routes
 */
function buildRouteNetwork(routeMap) {
    const nodes = new Map();
    const edges = new Map();
    const SNAP_DISTANCE = 50; // meters - points within this distance are considered same node
    
    let nodeId = 0;
    
    // Process each vehicle's route
    for (const [vehicle, points] of routeMap) {
        console.log(`📍 Processing ${points.length} GPS points for ${vehicle}`);
        
        let previousNodeId = null;
        
        points.forEach(point => {
            // Find or create node for this GPS point
            const existingNodeId = findNearbyNode(point, nodes, SNAP_DISTANCE);
            let currentNodeId;
            
            if (existingNodeId !== null) {
                currentNodeId = existingNodeId;
                // Update node with additional data
                const node = nodes.get(currentNodeId);
                node.visits++;
                node.vehicles.add(vehicle);
            } else {
                currentNodeId = nodeId++;
                nodes.set(currentNodeId, {
                    id: currentNodeId,
                    lat: point.lat,
                    lng: point.lng,
                    visits: 1,
                    vehicles: new Set([vehicle])
                });
            }
            
            // Create edge from previous node if exists
            if (previousNodeId !== null && previousNodeId !== currentNodeId) {
                const edgeKey = `${previousNodeId}-${currentNodeId}`;
                const reverseKey = `${currentNodeId}-${previousNodeId}`;
                
                if (!edges.has(edgeKey) && !edges.has(reverseKey)) {
                    const prevNode = nodes.get(previousNodeId);
                    const currNode = nodes.get(currentNodeId);
                    const distance = haversine(prevNode, currNode);
                    
                    // Only add edge if distance is reasonable (not GPS jumps)
                    if (distance < 5000) { // 5km max edge length
                        edges.set(edgeKey, {
                            from: previousNodeId,
                            to: currentNodeId,
                            distance: distance,
                            vehicles: new Set([vehicle]),
                            bidirectional: false
                        });
                        
                        // Make it bidirectional
                        edges.set(reverseKey, {
                            from: currentNodeId,
                            to: previousNodeId,
                            distance: distance,
                            vehicles: new Set([vehicle]),
                            bidirectional: false
                        });
                    }
                }
            }
            
            previousNodeId = currentNodeId;
        });
    }
    
    // Filter nodes and edges by frequency (remove noise)
    const filteredNodes = new Map();
    const filteredEdges = new Map();
    
    // Keep nodes visited by multiple vehicles OR multiple times
    nodes.forEach((node, id) => {
        if (node.visits >= 2 || node.vehicles.size >= 1) {
            filteredNodes.set(id, node);
        }
    });
    
    // Keep edges between filtered nodes
    edges.forEach((edge, key) => {
        if (filteredNodes.has(edge.from) && filteredNodes.has(edge.to)) {
            filteredEdges.set(key, edge);
        }
    });
    
    console.log(`🔍 Filtered to ${filteredNodes.size} nodes and ${filteredEdges.size} edges`);
    
    return {
        nodes: filteredNodes,
        edges: filteredEdges,
        adjacencyList: buildAdjacencyList(filteredNodes, filteredEdges)
    };
}

/**
 * Find nearby node within snap distance
 */
function findNearbyNode(point, nodes, snapDistance) {
    for (const [nodeId, node] of nodes) {
        const distance = haversine(point, node);
        if (distance <= snapDistance) {
            return nodeId;
        }
    }
    return null;
}

/**
 * Build adjacency list for pathfinding
 */
function buildAdjacencyList(nodes, edges) {
    const adjacencyList = new Map();
    
    // Initialize empty lists
    nodes.forEach((_, nodeId) => {
        adjacencyList.set(nodeId, []);
    });
    
    // Add edges
    edges.forEach(edge => {
        adjacencyList.get(edge.from).push({
            to: edge.to,
            distance: edge.distance
        });
    });
    
    return adjacencyList;
}

// ===== NETWORK-CONSTRAINED ROUTE OPTIMIZATION =====

/**
 * Enhanced route optimization that uses bus network constraints
 */
async function getBusOptimizedRoutesWithNetwork(csvData) {
    try {
        // Load the GPS network if not already loaded
        if (!busRouteNetwork) {
            await loadAndProcessGPSNetwork(csvData);
        }
        
        const filteredStops = filterStopsByDistance(stopsData, 40);
        const maxCapacity = parseInt(document.getElementById('maxCapacity').value) || 55;
        
        console.log(`🚌 Starting network-constrained optimization for ${filteredStops.length} stops`);
        
        // Snap stops to network nodes
        //const networkSnappedStops = snapStopsToNetwork(filteredStops);
        //console.log(`📍 Snapped ${networkSnappedStops.length} stops to bus network`);
        
        // Build routes using network constraints
        const networkRoutes = buildNetworkConstrainedRoutes(filteredStops, maxCapacity);
        
        console.log(`✅ Generated ${networkRoutes.length} network-constrained routes`);

        // ✅ FINAL: Track unserved stops
        const {
            servingRoutes,
            servedStops,
            servedStudents,
            duplicateStops,
            unservedStops
        } = analyzeRouteCoverage(allRoutes, filteredStops);

        // Track unserved stops
        unservedStops.forEach(stop => {
            trackDroppedStop(stop, 'UNASSIGNED', {
                total_routes_generated: allRoutes.length,
                total_stops_served: servedStops.length
            });
        });

        // Export dropped stops summary
        const summary = getDroppedStopsSummary();
        console.log('📊 DROPPED STOPS SUMMARY:', summary);

        // Auto-export dropped stops CSV
        if (droppedStopsTracker.allDroppedStops.length > 0) {
            exportDroppedStopsAsCSV();
        }
        
        // Auto-export outliers CSV after optimization
        try {
            if (typeof window.exportOutliersCSV === 'function') {
                await window.exportOutliersCSV();
            }
        } catch (error) {
            console.log('⚠️ Could not auto-export outliers CSV:', error.message);
        }



        return networkRoutes;
        
    } catch (error) {
        console.error('Network-constrained optimization failed:', error);
        // Fallback to existing algorithm
        return await getBusOptimizedRoutes();
    }
}

/**
 * Snap student pickup stops to nearest network nodes
 */
function snapStopsToNetwork(stops) {
    const MAX_SNAP_DISTANCE = 500; // 500m max distance to snap to network
    const snappedStops = [];
    
    stops.forEach(stop => {
        const stopCoord = {
            lat: parseFloat(stop.snapped_lat),
            lng: parseFloat(stop.snapped_lon)
        };
        
        let nearestNodeId = null;
        let nearestDistance = Infinity;
        
        // Find closest network node
        busRouteNetwork.nodes.forEach((node, nodeId) => {
            const distance = haversine(stopCoord, node);
            if (distance < nearestDistance && distance <= MAX_SNAP_DISTANCE) {
                nearestDistance = distance;
                nearestNodeId = nodeId;
            }
        });
        
        if (nearestNodeId !== null) {
            const networkNode = busRouteNetwork.nodes.get(nearestNodeId);
            snappedStops.push({
                ...stop,
                networkNodeId: nearestNodeId,
                originalLat: parseFloat(stop.snapped_lat),
                originalLng: parseFloat(stop.snapped_lon),
                networkLat: networkNode.lat,
                networkLng: networkNode.lng,
                snapDistance: nearestDistance
            });
        } else {
            console.warn(`⚠️ Stop ${stop.cluster_number} could not be snapped to network (too far)`);
        }
    });
    
    console.log(`📊 Successfully snapped ${snappedStops.length}/${stops.length} stops to network`);
    return snappedStops;
}

/**
 * Build routes constrained to the bus network using shortest paths
 */
function buildNetworkConstrainedRoutes(snappedStops, maxCapacity) {
    const routes = [];
    
    // Group stops by network connectivity (connected components)
    const connectedGroups = findConnectedStopGroups(snappedStops);
    
    connectedGroups.forEach((group, groupIndex) => {
        console.log(`🔗 Processing connected group ${groupIndex + 1} with ${group.length} stops`);
        
        // Build routes within this connected group
        const groupRoutes = buildRoutesInConnectedGroup(group, maxCapacity, groupIndex);
        routes.push(...groupRoutes);
    });
    
    return routes;
}

/**
 * Find groups of stops that are connected in the network
 */
function findConnectedStopGroups(snappedStops) {
    const visited = new Set();
    const groups = [];
    
    snappedStops.forEach(stop => {
        if (!visited.has(stop.networkNodeId)) {
            const group = [];
            const queue = [stop.networkNodeId];
            const groupVisited = new Set();
            
            // BFS to find all connected stops
            while (queue.length > 0) {
                const nodeId = queue.shift();
                
                if (groupVisited.has(nodeId)) continue;
                groupVisited.add(nodeId);
                visited.add(nodeId);
                
                // Add stop at this node if exists
                const stopsAtNode = snappedStops.filter(s => s.networkNodeId === nodeId);
                group.push(...stopsAtNode);
                
                // Add connected nodes to queue
                const neighbors = busRouteNetwork.adjacencyList.get(nodeId) || [];
                neighbors.forEach(neighbor => {
                    if (!groupVisited.has(neighbor.to)) {
                        queue.push(neighbor.to);
                    }
                });
            }
            
            if (group.length > 0) {
                groups.push(group);
            }
        }
    });
    
    return groups;
}

/**
 * Build routes within a connected group using network paths
 */
function buildRoutesInConnectedGroup(group, maxCapacity, groupIndex) {
    const routes = [];
    
    // Calculate distances between all stops using network paths
    const stopDistances = calculateNetworkDistanceMatrix(group);
    
    // Build routes using a modified TSP approach with capacity constraints
    const unvisitedStops = [...group];
    let routeIndex = 1;
    
    while (unvisitedStops.length > 0) {
        const route = buildSingleNetworkRoute(unvisitedStops, stopDistances, maxCapacity);
        
        if (route.stops.length > 0) {
            const formattedRoute = formatNetworkRoute(route, groupIndex, routeIndex);
            routes.push(formattedRoute);
            routeIndex++;
            
            // Remove used stops
            route.stops.forEach(stop => {
                const index = unvisitedStops.findIndex(s => s.networkNodeId === stop.networkNodeId);
                if (index !== -1) {
                    unvisitedStops.splice(index, 1);
                }
            });
        } else {
            // Safety break
            break;
        }
    }
    
    return routes;
}

/**
 * Calculate shortest network distances between stops
 */
function calculateNetworkDistanceMatrix(stops) {
    const distances = new Map();
    
    // Calculate distances between each pair of stops
    for (let i = 0; i < stops.length; i++) {
        for (let j = i + 1; j < stops.length; j++) {
            const stop1 = stops[i];
            const stop2 = stops[j];
            
            const distance = findShortestNetworkPath(stop1.networkNodeId, stop2.networkNodeId);
            
            const key1 = `${stop1.networkNodeId}-${stop2.networkNodeId}`;
            const key2 = `${stop2.networkNodeId}-${stop1.networkNodeId}`;
            
            distances.set(key1, distance);
            distances.set(key2, distance);
        }
    }
    
    return distances;
}

/**
 * Find shortest path between two nodes using Dijkstra's algorithm
 */
function findShortestNetworkPath(startNodeId, endNodeId) {
    if (startNodeId === endNodeId) return { distance: 0, path: [startNodeId] };
    
    const distances = new Map();
    const previous = new Map();
    const unvisited = new Set();
    
    // Initialize distances
    busRouteNetwork.nodes.forEach((_, nodeId) => {
        distances.set(nodeId, Infinity);
        unvisited.add(nodeId);
    });
    distances.set(startNodeId, 0);
    
    while (unvisited.size > 0) {
        // Find unvisited node with minimum distance
        let currentNode = null;
        let minDistance = Infinity;
        
        for (const nodeId of unvisited) {
            const distance = distances.get(nodeId);
            if (distance < minDistance) {
                minDistance = distance;
                currentNode = nodeId;
            }
        }
        
        if (currentNode === null || minDistance === Infinity) break;
        
        unvisited.delete(currentNode);
        
        if (currentNode === endNodeId) {
            // Reconstruct path
            const path = [];
            let node = endNodeId;
            while (node !== undefined) {
                path.unshift(node);
                node = previous.get(node);
            }
            
            return { distance: distances.get(endNodeId), path };
        }
        
        // Check neighbors
        const neighbors = busRouteNetwork.adjacencyList.get(currentNode) || [];
        neighbors.forEach(neighbor => {
            if (!unvisited.has(neighbor.to)) return;
            
            const altDistance = distances.get(currentNode) + neighbor.distance;
            if (altDistance < distances.get(neighbor.to)) {
                distances.set(neighbor.to, altDistance);
                previous.set(neighbor.to, currentNode);
            }
        });
    }
    
    // No path found - return straight line distance as fallback
    const startNode = busRouteNetwork.nodes.get(startNodeId);
    const endNode = busRouteNetwork.nodes.get(endNodeId);
    
    return {
        distance: haversine(startNode, endNode) * 2, // Penalty for no network path
        path: [startNodeId, endNodeId],
        isDirectPath: true
    };
}

/**
 * Build a single route using network constraints
 */
function buildSingleNetworkRoute(availableStops, distanceMatrix, maxCapacity) {
    if (availableStops.length === 0) return { stops: [], totalStudents: 0 };
    
    const route = { stops: [], totalStudents: 0 };
    
    // Start with stop farthest from college (based on network distance)
    let farthestStop = availableStops[0];
    let maxDistanceFromCollege = 0;
    
    const collegeNode = findNearestNetworkNodeToCollege();
    
    availableStops.forEach(stop => {
        const pathToCollege = findShortestNetworkPath(stop.networkNodeId, collegeNode);
        if (pathToCollege.distance > maxDistanceFromCollege) {
            maxDistanceFromCollege = pathToCollege.distance;
            farthestStop = stop;
        }
    });
    
    route.stops.push(farthestStop);
    route.totalStudents += parseInt(farthestStop.num_students);
    
    // Greedily add nearest stops that maintain network connectivity
    while (true) {
        const currentStop = route.stops[route.stops.length - 1];
        let bestStop = null;
        let shortestDistance = Infinity;
        
        availableStops.forEach(stop => {
            if (route.stops.includes(stop)) return;
            
            const students = parseInt(stop.num_students);
            if (route.totalStudents + students > maxCapacity) return;
            
            const key = `${currentStop.networkNodeId}-${stop.networkNodeId}`;
            const pathDistance = distanceMatrix.get(key);
            
            if (pathDistance && pathDistance.distance < shortestDistance) {
                shortestDistance = pathDistance.distance;
                bestStop = stop;
            }
        });
        
        if (!bestStop) break;
        
        route.stops.push(bestStop);
        route.totalStudents += parseInt(bestStop.num_students);
    }
    
    return route;
}

/**
 * Find the network node closest to college
 */
function findNearestNetworkNodeToCollege() {
    const collegeCoord = { lat: COLLEGE_COORDS[0], lng: COLLEGE_COORDS[1] };
    
    let nearestNodeId = null;
    let nearestDistance = Infinity;
    
    busRouteNetwork.nodes.forEach((node, nodeId) => {
        const distance = haversine(collegeCoord, node);
        if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestNodeId = nodeId;
        }
    });
    
    return nearestNodeId;
}

/**
 * Format network route to match existing format
 */
function formatNetworkRoute(route, groupIndex, routeIndex) {
    // Calculate total route distance using network paths
    let totalNetworkDistance = 0;
    
    const collegeNode = findNearestNetworkNodeToCollege();
    
    // Distance between stops
    for (let i = 0; i < route.stops.length - 1; i++) {
        const path = findShortestNetworkPath(
            route.stops[i].networkNodeId,
            route.stops[i + 1].networkNodeId
        );
        totalNetworkDistance += path.distance;
    }
    
    // Distance from last stop to college
    const lastStopPath = findShortestNetworkPath(
        route.stops[route.stops.length - 1].networkNodeId,
        collegeNode
    );
    totalNetworkDistance += lastStopPath.distance;
    
    // Convert to km
    const totalDistanceKm = totalNetworkDistance / 1000;
    
    return {
        busId: `Bus G${groupIndex + 1}-R${routeIndex} (Network)`,
        depot: findOptimalDepot({ stops: route.stops }),
        stops: route.stops.map(stop => ({
            ...stop,
            // Use network coordinates for routing
            snapped_lat: stop.networkLat.toString(),
            snapped_lon: stop.networkLng.toString(),
            original_lat: stop.originalLat,
            original_lng: stop.originalLng,
            snap_distance: stop.snapDistance
        })),
        totalStudents: route.totalStudents,
        efficiency: `${((route.totalStudents / 55) * 100).toFixed(1)}%`,
        totalDistance: `${totalDistanceKm.toFixed(1)} km`,
        estimatedDistance: totalDistanceKm,
        routeType: 'network-constrained',
        isNetworkOptimized: true,
        networkValidated: true
    };
}

// ===== UTILITY FUNCTIONS =====

function isValidCoordinate(lat, lng) {
    return !isNaN(lat) && !isNaN(lng) && 
           lat >= -90 && lat <= 90 && 
           lng >= -180 && lng <= 180 &&
           lat !== 0 && lng !== 0;
}

function haversine(coord1, coord2) {
    const R = 6371000; // Earth's radius in meters
    const dLat = toRad(coord2.lat - coord1.lat);
    const dLng = toRad(coord2.lng - coord1.lng);
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(toRad(coord1.lat)) * Math.cos(toRad(coord2.lat)) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function toRad(deg) {
    return deg * (Math.PI / 180);
}

// ===== INTEGRATION WITH EXISTING CODE =====

/**
 * Enhanced main optimization function that tries network-constrained first
 */
async function optimizeWithNetworkConstraints(csvData) {
    try {
        console.log('🎯 Starting network-constrained optimization...');
        
        // Try network-constrained optimization first
        const networkRoutes = await getBusOptimizedRoutesWithNetwork(csvData);
        
        if (networkRoutes && networkRoutes.length > 0) {
            console.log(`✅ Network optimization successful: ${networkRoutes.length} routes`);
            return networkRoutes;
        } else {
            throw new Error('No valid network routes generated');
        }
        
    } catch (error) {
        console.warn('⚠️ Network optimization failed, falling back to geometric optimization:', error);
        return await getBusOptimizedRoutes();
    }
}

// ===== EXPORT FOR USE =====
// Replace your existing optimization call with:
// const optimizedRoutes = await optimizeWithNetworkConstraints(csvData);

module.exports = {
    loadAndProcessGPSNetwork,
    getBusOptimizedRoutesWithNetwork,
    optimizeWithNetworkConstraints
};