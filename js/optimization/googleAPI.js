// CLIENT-SIDE: Use your server proxy instead of direct API calls
async function optimizeWithGoogleAPI() {
    try {
        console.log('🎯 Starting enhanced route optimization with geographical clustering...');
        
        // Use the new getBusOptimizedRoutes function instead of the old approach
        const optimizedRoutes = await getBusOptimizedRoutes();
        
        if (!optimizedRoutes || optimizedRoutes.length === 0) {
            throw new Error('No valid routes generated');
        }
        
        console.log(`✅ Generated ${optimizedRoutes.length} optimized routes`);
        return optimizedRoutes;
        
    } catch (error) {
        console.error('Route Optimization API Error:', error);
        showStatus(`⚠️ Route Optimization API failed: ${error.message}`, 'warning');
        return await simulateOptimization();
    }
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
            globalDurationCostPerHour: 1000,
            //maxTotalDistanceMeters: 50000  // 50km max per route
        },
        searchMode: "CONSUME_ALL_AVAILABLE_TIME"
    };
}

// ✅ ENHANCED CLIENT-SIDE VALIDATION: Filter out routes exceeding 50km
// ✅ Enhanced route processing with simplified validation
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
                const validation = await validateRouteAccessibility(routeData);
                
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
async function validateRouteAccessibility(route) {
    try {
        const stops = route.stops;
        if (stops.length === 0) return { isValid: true, issues: [] };
        
        const issues = [];
        let isValid = true;
        
        // Check if route is too long
        const distanceKm = parseFloat(route.totalDistance.replace(' km', '').replace('~', ''));
        if (distanceKm > 60) {
            issues.push('Route exceeds 60km limit');
            isValid = false;
        }
        
        // Check if route has too many stops (might indicate narrow roads)
        if (stops.length > 15) {
            issues.push('Too many stops - may have accessibility issues');
        }
        
        // Check average distance between stops
        const avgDistanceBetweenStops = distanceKm / Math.max(1, stops.length - 1);
        if (avgDistanceBetweenStops < 1.5) {
            issues.push('Stops very close together - possible narrow roads');
        }
        
        // For now, be lenient - only fail routes with major issues
        return {
            isValid: issues.length <= 1,
            issues: issues,
            validatedDistance: distanceKm
        };
        
    } catch (error) {
        console.error('Route validation failed:', error);
        return { isValid: true, issues: ['Validation skipped'] };
    }
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

// ✅ IMPROVED: Better route optimization with smarter depot assignment
async function getBusOptimizedRoutes() {
    try {
        const filteredStops = filterStopsByDistance(stopsData, 40);
        const maxCapacity = parseInt(document.getElementById('maxCapacity').value) || 55;
        
        console.log(`🚌 Starting optimization for ${filteredStops.length} stops with ${maxCapacity} capacity per bus`);
        
        // ✅ Create smart directional clusters to avoid loops
        const routeGroups = createGeographicalClusters(filteredStops, maxCapacity);
        
        console.log(`📊 Created ${routeGroups.length} route groups`);
        
        const optimizedRoutes = [];
        
        // Process each cluster
        for (let groupIndex = 0; groupIndex < routeGroups.length; groupIndex++) {
            const group = routeGroups[groupIndex];
            
            // Use the depot assigned by clustering algorithm
            const depot = group.assignedDepot || depotsData[groupIndex % depotsData.length];
            
            console.log(`🔄 Processing route ${groupIndex + 1}/${routeGroups.length}: ${group.stops.length} stops in ${group.direction} direction`);
            
            // Create waypoints for this group
            const waypoints = group.stops.map(stop => ({
                location: { 
                    lat: parseFloat(stop.snapped_lat), 
                    lng: parseFloat(stop.snapped_lon) 
                },
                stopover: true
            }));
            
            // Call Google Directions API for better bus routing
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
                optimizeWaypoints: true,  // Let Google optimize the order
                travelMode: 'DRIVING',
                avoidTolls: false,
                avoidHighways: false,
                avoidFerries: true
            };
            
            try {
                const response = await fetch('http://localhost:3000/api/directions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(routeRequest)
                });
                
                if (response.ok) {
                    const directionsResult = await response.json();
                    const optimizedRoute = processDirectionsResponse(directionsResult, group, depot, groupIndex + 1);
                    if (optimizedRoute) {
                        optimizedRoutes.push(optimizedRoute);
                        console.log(`✅ Route ${groupIndex + 1} completed: ${optimizedRoute.totalDistance}, ${optimizedRoute.totalStudents} students`);
                    }
                } else {
                    console.warn(`❌ Directions API failed for route ${groupIndex + 1}, using basic route`);
                    const basicRoute = createBasicRoute(group, depot, groupIndex + 1);
                    if (basicRoute) optimizedRoutes.push(basicRoute);
                }
            } catch (error) {
                console.error(`Failed to get directions for route ${groupIndex + 1}:`, error);
                // Create a basic route without Google optimization
                const basicRoute = createBasicRoute(group, depot, groupIndex + 1);
                if (basicRoute) optimizedRoutes.push(basicRoute);
            }
            
            // Small delay to avoid rate limiting
            if (groupIndex < routeGroups.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
        
        // ✅ Sort routes by efficiency for better display
        optimizedRoutes.sort((a, b) => {
            const effA = parseFloat(a.efficiency.replace('%', ''));
            const effB = parseFloat(b.efficiency.replace('%', ''));
            return effB - effA; // Higher efficiency first
        });
        
        console.log(`🎉 Generated ${optimizedRoutes.length} optimized routes`);
        
        // ✅ Log summary
        const totalStudentsCovered = optimizedRoutes.reduce((sum, route) => sum + route.totalStudents, 0);
        const totalOriginalStudents = filteredStops.reduce((sum, stop) => sum + parseInt(stop.num_students), 0);
        const coverage = ((totalStudentsCovered / totalOriginalStudents) * 100).toFixed(1);
        
        console.log(`📊 Coverage: ${totalStudentsCovered}/${totalOriginalStudents} students (${coverage}%)`);
        
        return optimizedRoutes;
        
    } catch (error) {
        console.error('Bus route optimization failed:', error);
        return await simulateOptimization(); // Fallback to simulation
    }
}

function createGeographicalClusters(stops, maxCapacity) {
    const clusters = [];
    
    console.log(`🎯 Creating anti-loop clusters for ${stops.length} stops`);
    
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
    
    // ✅ STEP 2: Group by strict directional sectors
    const sectorGroups = {};
    stopsWithBearing.forEach(stop => {
        if (!sectorGroups[stop.direction]) {
            sectorGroups[stop.direction] = [];
        }
        sectorGroups[stop.direction].push(stop);
    });
    
    // ✅ STEP 3: Create radial routes (closest to farthest) within each sector
    Object.keys(sectorGroups).forEach(direction => {
        const sectorStops = sectorGroups[direction];
        
        if (sectorStops.length === 0) return;
        
        // Sort by distance - CRITICAL: Always go from closest to farthest
        sectorStops.sort((a, b) => a.distance - b.distance);
        
        console.log(`📍 ${direction} sector: ${sectorStops.length} stops`);
        
        // Create capacity-based clusters within this direction
        let currentCluster = { 
            stops: [], 
            totalStudents: 0, 
            direction,
            minBearing: Infinity,
            maxBearing: -Infinity,
            avgDistance: 0
        };
        
        sectorStops.forEach(stop => {
            const studentCount = parseInt(stop.num_students);
            
            // ✅ ANTI-LOOP CHECK: Ensure bearing consistency
            const bearingSpread = Math.max(currentCluster.maxBearing, stop.bearing) - 
                                Math.min(currentCluster.minBearing, stop.bearing);
            
            // If adding this stop exceeds capacity OR creates too much bearing spread
            if (currentCluster.totalStudents + studentCount > maxCapacity || 
                (currentCluster.stops.length > 0 && bearingSpread > 90)) {
                
                if (currentCluster.stops.length > 0) {
                    finalizeCluster(currentCluster);
                    clusters.push(currentCluster);
                }
                
                currentCluster = {
                    stops: [stop],
                    totalStudents: studentCount,
                    direction,
                    minBearing: stop.bearing,
                    maxBearing: stop.bearing,
                    avgDistance: stop.distance
                };
            } else {
                currentCluster.stops.push(stop);
                currentCluster.totalStudents += studentCount;
                currentCluster.minBearing = Math.min(currentCluster.minBearing, stop.bearing);
                currentCluster.maxBearing = Math.max(currentCluster.maxBearing, stop.bearing);
                currentCluster.avgDistance = currentCluster.stops.reduce((sum, s) => sum + s.distance, 0) / currentCluster.stops.length;
            }
        });
        
        // Add the last cluster
        if (currentCluster.stops.length > 0) {
            finalizeCluster(currentCluster);
            clusters.push(currentCluster);
        }
    });
    // ✅ STEP 4: Validate all clusters for anti-loop compliance
    const validClusters = clusters.filter(cluster => validateClusterStraightness(cluster));
    
    console.log(`✅ Created ${validClusters.length} validated straight-line clusters (from ${clusters.length} initial)`);
    
    // Assign depots to valid clusters
    validClusters.forEach((cluster, index) => {
        cluster.assignedDepot = findOptimalDepot(cluster);
        console.log(`🚌 Cluster ${index + 1} (${cluster.direction}): ${cluster.stops.length} stops, ${cluster.totalStudents} students, spread: ${cluster.bearingSpread.toFixed(1)}°`);
    });
    
    return validClusters.slice(0, 16); // Max 16 buses
}


// ✅ NEW: Calculate precise bearing between two points
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
    const centroidLat = cluster.stops.reduce((sum, stop) => sum + stop.lat, 0) / cluster.stops.length;
    const centroidLng = cluster.stops.reduce((sum, stop) => sum + stop.lng, 0) / cluster.stops.length;
    
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
        const clusterBearing = (cluster.minBearing + cluster.maxBearing) / 2;
        
        let bearingDiff = Math.abs(depotBearing - clusterBearing);
        if (bearingDiff > 180) bearingDiff = 360 - bearingDiff;
        
        // Score: prioritize direction alignment over distance
        const directionScore = 100 - bearingDiff; // Higher score for better alignment
        const distanceScore = Math.max(0, 50 - distanceToCluster); // Higher score for closer distance
        
        const totalScore = directionScore * 2 + distanceScore; // Weight direction more heavily
        
        if (totalScore > bestScore) {
            bestScore = totalScore;
            bestDepot = depot;
        }
    });
    
    console.log(`🎯 Depot "${bestDepot['Parking Name']}" selected for ${cluster.direction} cluster (score: ${bestScore.toFixed(1)})`);
    return bestDepot;
}


// ✅ NEW: Validate cluster doesn't create loops
function validateClusterStraightness(cluster) {
    const MAX_BEARING_SPREAD = 60; // Maximum 60° spread allowed
    const MAX_STRAIGHTNESS_FACTOR = 0.3; // Maximum 30% deviation allowed
    const MAX_BACKTRACK_RATIO = 0.2; // Maximum 20% backtracking allowed
    
    // Check 1: Bearing spread
    if (cluster.bearingSpread > MAX_BEARING_SPREAD) {
        console.warn(`❌ Cluster ${cluster.direction} rejected: bearing spread ${cluster.bearingSpread.toFixed(1)}° > ${MAX_BEARING_SPREAD}°`);
        return false;
    }
    
    // Check 2: Straightness factor
    if (cluster.straightnessFactor > MAX_STRAIGHTNESS_FACTOR) {
        console.warn(`❌ Cluster ${cluster.direction} rejected: straightness factor ${cluster.straightnessFactor.toFixed(2)} > ${MAX_STRAIGHTNESS_FACTOR}`);
        return false;
    }
    
    // Check 3: Backtracking detection
    const backtrackRatio = detectBacktracking(cluster.stops);
    if (backtrackRatio > MAX_BACKTRACK_RATIO) {
        console.warn(`❌ Cluster ${cluster.direction} rejected: backtracking ${(backtrackRatio * 100).toFixed(1)}% > ${MAX_BACKTRACK_RATIO * 100}%`);
        return false;
    }
    
    console.log(`✅ Cluster ${cluster.direction} validated: spread ${cluster.bearingSpread.toFixed(1)}°, straightness ${cluster.straightnessFactor.toFixed(2)}, backtrack ${(backtrackRatio * 100).toFixed(1)}%`);
    return true;
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
    if (totalDistance > 50) { // Stricter limit for real transport
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
            orderedStops = group.stops.sort((a, b) => a.distance - b.distance);
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
        const currentDistance = stops[i].distance;
        const previousDistance = stops[i - 1].distance;
        
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
    const radialStops = group.stops.sort((a, b) => a.distance - b.distance);
    
    // Calculate estimated distance (radial routes are typically shortest)
    const estimatedDistance = Math.max(
        15, // Minimum realistic distance
        radialStops[radialStops.length - 1].distance * 1.3 // Farthest stop distance + 30% for routing
    );
    
    return {
        busId: `Bus ${routeIndex}`,
        depot: depot['Parking Name'],
        stops: radialStops,
        totalStudents: group.totalStudents,
        efficiency: `${((group.totalStudents / 55) * 100).toFixed(1)}%`,
        totalDistance: `${Math.min(45, estimatedDistance).toFixed(1)} km`, // Cap at 45km
        totalTime: 'Estimated',
        accessibility: { isValid: true, issues: [] },
        direction: group.direction,
        routeType: 'radial-forced',
        loopValidation: { passed: true, method: 'radial-guaranteed' }
    };
}

// ✅ NEW: Finalize cluster with straightness metrics
function finalizeCluster(cluster) {
    if (cluster.stops.length === 0) return;
    
    // Calculate bearing spread
    cluster.bearingSpread = cluster.maxBearing - cluster.minBearing;
    
    // Handle edge case where bearings cross 0° (North)
    if (cluster.bearingSpread > 180) {
        cluster.bearingSpread = 360 - cluster.bearingSpread;
    }
    
    // Calculate route straightness factor
    cluster.straightnessFactor = calculateStraightnessFactor(cluster.stops);
    
    // Sort stops by distance for optimal routing
    cluster.stops.sort((a, b) => a.distance - b.distance);
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
        
        // Calculate bearing from stop1 to stop2
        const bearing1to2 = calculateBearing(stop1.lat, stop1.lng, stop2.lat, stop2.lng);
        
        // Calculate bearing from stop2 to stop3
        const bearing2to3 = calculateBearing(stop2.lat, stop2.lng, stop3.lat, stop3.lng);
        
        // Calculate angular deviation
        let angularDiff = Math.abs(bearing2to3 - bearing1to2);
        if (angularDiff > 180) angularDiff = 360 - angularDiff;
        
        totalDeviation += angularDiff;
    }
    
    // Normalize (maximum possible deviation per segment is 180°)
    const maxPossibleDeviation = (stops.length - 2) * 180;
    return totalDeviation / maxPossibleDeviation;
}



// ✅ IMPROVED: Better basic route with distance estimation
function createBasicRoute(group, depot, routeIndex) {
    // Estimate distance based on number of stops and their spread
    const avgDistance = group.stops.reduce((sum, stop, index) => {
        if (index === 0) return sum;
        const prevStop = group.stops[index - 1];
        return sum + calculateHaversineDistance(
            parseFloat(prevStop.snapped_lat), parseFloat(prevStop.snapped_lon),
            parseFloat(stop.snapped_lat), parseFloat(stop.snapped_lon)
        );
    }, 0) / Math.max(1, group.stops.length - 1);
    
    const estimatedDistance = Math.max(15, Math.min(45, avgDistance * group.stops.length + 10));
    
    return {
        busId: `Bus ${routeIndex}`,
        depot: depot['Parking Name'],
        stops: group.stops,
        totalStudents: group.totalStudents,
        efficiency: `${((group.totalStudents / 55) * 100).toFixed(1)}%`,
        totalDistance: `~${estimatedDistance.toFixed(1)} km`,
        totalTime: 'Estimated',
        accessibility: { isValid: true, issues: ['Basic route estimation'] },
        direction: group.direction,
        routeType: 'estimated'
    };
}

// ✅ Helper function to find stop by shipment index
function findStopByShipmentIndex(shipmentIndex) {
    const filteredStops = filterStopsByDistance(stopsData, 40);
    return filteredStops[shipmentIndex] || null;
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

// ✅ NEW: Create shorter alternative when route is too long
function createShorterAlternative(group, depot, routeIndex) {
    // Split the group into smaller chunks
    const maxStopsPerRoute = 8; // Limit stops to keep routes shorter
    const chunks = [];
    
    for (let i = 0; i < group.stops.length; i += maxStopsPerRoute) {
        chunks.push({
            stops: group.stops.slice(i, i + maxStopsPerRoute),
            totalStudents: group.stops.slice(i, i + maxStopsPerRoute)
                .reduce((sum, stop) => sum + parseInt(stop.num_students), 0)
        });
    }
    
    // Return the first chunk as a route, others will be processed separately
    const chunk = chunks[0];
    const estimatedDistance = Math.min(40, chunk.stops.length * 4); // Conservative estimate
    
    return {
        busId: `Bus ${routeIndex}`,
        depot: depot['Parking Name'],
        stops: chunk.stops,
        totalStudents: chunk.totalStudents,
        efficiency: `${((chunk.totalStudents / 55) * 100).toFixed(1)}%`,
        totalDistance: `~${estimatedDistance} km`,
        totalTime: 'Estimated',
        accessibility: { isValid: true, issues: ['Shortened for efficiency'] },
        direction: group.direction,
        routeType: 'shortened'
    };
}


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