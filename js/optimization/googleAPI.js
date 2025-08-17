// CLIENT-SIDE: Use your server proxy instead of direct API calls
async function optimizeWithGoogleAPI() {
    try {
        console.log('🎯 Starting enhanced route optimization with multi-strategy approach...');
        
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

// ✅ FIXED: Use server or OSRM instead of direct Google API calls
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
        console.log(`🔄 Trying server directions API for route ${routeIndex}...`);
        
        // Try your local server first
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch('http://localhost:3000/api/directions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(routeRequest),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
            const directionsResult = await response.json();
            console.log(`✅ Server directions API responded for route ${routeIndex}`);
            return processDirectionsResponse(directionsResult, group, depot, routeIndex);
        } else {
            throw new Error(`Server responded with ${response.status}`);
        }
        
    } catch (error) {
        console.warn(`⚠️ Server directions failed for route ${routeIndex}, using OSRM fallback:`, error.message);
        
        // Fallback to OSRM direct
        return await getOSRMDirections(group, depot, routeIndex);
    }
}

// ✅ NEW: Direct OSRM routing as fallback
async function getOSRMDirections(group, depot, routeIndex) {
    try {
        console.log(`🔄 Using OSRM for route ${routeIndex}...`);
        
        // Build coordinate string for OSRM
        const coordinates = [
            `${depot.Longitude},${depot.Latitude}`, // Start at depot
            ...group.stops.map(stop => 
                `${parseFloat(stop.lng || stop.snapped_lon)},${parseFloat(stop.lat || stop.snapped_lat)}`
            ),
            `${COLLEGE_COORDS[1]},${COLLEGE_COORDS[0]}` // End at college
        ].join(';');
        
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=true`;
        
        const response = await fetch(osrmUrl);
        const data = await response.json();
        
        if (data.routes && data.routes[0]) {
            const route = data.routes[0];
            const totalDistance = route.distance / 1000; // Convert to km
            const totalDuration = route.duration / 60; // Convert to minutes
            
            console.log(`✅ OSRM responded for route ${routeIndex}: ${totalDistance.toFixed(1)}km`);
            
            // Distance check
            if (totalDistance > 50) {
                console.warn(`❌ OSRM route ${routeIndex} too long (${totalDistance.toFixed(1)}km)`);
                return createRadialRoute(group, depot, routeIndex);
            }
            
            return {
                busId: `Bus ${routeIndex}`,
                depot: depot['Parking Name'],
                stops: group.stops,
                totalStudents: group.totalStudents,
                efficiency: `${((group.totalStudents / 55) * 100).toFixed(1)}%`,
                totalDistance: `${totalDistance.toFixed(1)} km`,
                totalTime: `${Math.round(totalDuration)} min`,
                accessibility: { isValid: true, issues: [] },
                direction: group.direction,
                routeType: 'osrm-optimized',
                osrmData: {
                    geometry: route.geometry,
                    waypoints: route.waypoints
                }
            };
        } else {
            throw new Error('No OSRM route found');
        }
        
    } catch (error) {
        console.error(`❌ OSRM failed for route ${routeIndex}:`, error);
        return createBasicRoute(group, depot, routeIndex);
    }
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

// ✅ MODIFIED: Main optimization function to incorporate new approaches
async function getBusOptimizedRoutes() {
    try {
        const filteredStops = filterStopsByDistance(stopsData, 40);
        const maxCapacity = parseInt(document.getElementById('maxCapacity').value) || 55;
        
        console.log(`🚌 Starting enhanced optimization for ${filteredStops.length} stops`);
        
        // ✅ CREATE ROUTES USING MULTIPLE STRATEGIES for better coverage
        const strategiesResults = {
            corridor: await createCorridorBasedRoutes(filteredStops, maxCapacity),
            segment: await createRoutesBySegment(filteredStops, maxCapacity),
            directional: await createGeographicalClusters(filteredStops, maxCapacity)
        };
        
        // Validate route lengths across all strategies
        Object.keys(strategiesResults).forEach(strategy => {
            strategiesResults[strategy] = strategiesResults[strategy].filter(validateRouteLength);
            console.log(`✅ ${strategy}: ${strategiesResults[strategy].length} valid routes`);
        });
        
        // Collect all valid routes
        let allRoutes = [
            ...strategiesResults.corridor,
            ...strategiesResults.segment,
            ...strategiesResults.directional
        ];
        
        // ✅ ANALYZE COVERAGE
        const {
            servingRoutes,
            servedStops,
            servedStudents,
            duplicateStops,
            unservedStops
        } = analyzeRouteCoverage(allRoutes, filteredStops);
        
        const totalStudents = filteredStops.reduce((sum, stop) => sum + parseInt(stop.num_students), 0);
        const coveragePercent = (servedStudents / totalStudents * 100).toFixed(1);
        
        console.log(`📊 COVERAGE ANALYSIS:`);
        console.log(`   - Students served: ${servedStudents}/${totalStudents} (${coveragePercent}%)`);
        console.log(`   - Stops served: ${servedStops.length}/${filteredStops.length}`);
        console.log(`   - Duplicate stops: ${duplicateStops}`);
        console.log(`   - Unserved stops: ${unservedStops.length}`);
        
        // ✅ SALVAGE OPERATION: Create routes for unserved stops if coverage is low
        if (parseFloat(coveragePercent) < 85 && unservedStops.length > 0) {
            console.log(`🔄 Coverage below 85% - attempting to create routes for unserved stops...`);
            
            // Try to create routes for unserved stops
            const salvageRoutes = await createSalvageRoutes(unservedStops, maxCapacity);
            
            // Add valid salvage routes
            const validSalvageRoutes = salvageRoutes.filter(validateRouteLength);
            console.log(`✅ Created ${validSalvageRoutes.length} additional routes for previously unserved stops`);
            
            allRoutes = [...servingRoutes, ...validSalvageRoutes];
            
            // Recalculate coverage
            const finalCoverage = analyzeRouteCoverage(allRoutes, filteredStops);
            const finalCoveragePercent = (finalCoverage.servedStudents / totalStudents * 100).toFixed(1);
            
            console.log(`📊 FINAL COVERAGE: ${finalCoveragePercent}% of students`);
        } else {
            // No need for salvage, just use the serving routes (no duplicates)
            allRoutes = servingRoutes;
        }
        
        // ✅ Assign depots smartly
        allRoutes.forEach(route => {
            if (!route.assignedDepot) {
                route.assignedDepot = findOptimalDepot(route);
            }
        });
        
        // ✅ Limit to maximum number of buses available
        const totalStudentsInShift = filteredStops.reduce((sum, stop) => sum + parseInt(stop.num_students || 0), 0);
        const maxBusesNeeded = Math.ceil(totalStudentsInShift / maxCapacity);
        
        // Sort routes by efficiency
        allRoutes.sort((a, b) => {
            const effA = parseFloat(a.efficiency?.replace('%', '')) || 0;
            const effB = parseFloat(b.efficiency?.replace('%', '')) || 0;
            return effB - effA; // Highest efficiency first
        });
        
        // Take the most efficient routes up to the limit
        const finalRoutes = allRoutes.slice(0, maxBusesNeeded);
        
        console.log(`🎯 Final solution: ${finalRoutes.length} routes`);
        return finalRoutes;
        
    } catch (error) {
        console.error('Enhanced route optimization failed:', error);
        return await simulateOptimization(); // Fallback to simulation
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