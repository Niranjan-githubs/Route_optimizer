// Different optimization algorithms

// Simulate optimization (for demo purposes, replace with actual API call)
async function simulateOptimization() {
    const maxCapacity = parseInt(document.getElementById('maxCapacity').value);
    const routes = [];
    
    // Simple greedy algorithm for demonstration
    let currentRoute = [];
    let currentLoad = 0;
    let routeIndex = 0;
    
    // Sort stops by distance from college (simplified)
    const sortedStops = [...stopsData].sort((a, b) => {
        const distA = Math.sqrt(Math.pow(parseFloat(a.snapped_lat) - COLLEGE_COORDS[0], 2) + 
                              Math.pow(parseFloat(a.snapped_lon) - COLLEGE_COORDS[1], 2));
        const distB = Math.sqrt(Math.pow(parseFloat(b.snapped_lat) - COLLEGE_COORDS[0], 2) + 
                              Math.pow(parseFloat(b.snapped_lon) - COLLEGE_COORDS[1], 2));
        return distA - distB;
    });
    
    for (const stop of sortedStops) {
        const stopLoad = parseInt(stop.num_students);
        
        if (currentLoad + stopLoad <= maxCapacity) {
            currentRoute.push(stop);
            currentLoad += stopLoad;
        } else {
            // Finalize current route
            if (currentRoute.length > 0) {
                routes.push({
                    busId: `Bus ${routeIndex + 1}`,
                    depot: depotsData[routeIndex % depotsData.length]['Parking Name'],
                    stops: [...currentRoute],
                    totalStudents: currentLoad,
                    efficiency: `${((currentLoad / maxCapacity) * 100).toFixed(1)}%`
                });
                routeIndex++;
            }
            
            // Start new route
            currentRoute = [stop];
            currentLoad = stopLoad;
        }
    }
    
    // Add the last route
    if (currentRoute.length > 0) {
        routes.push({
            busId: `Bus ${routeIndex + 1}`,
            depot: depotsData[routeIndex % depotsData.length]['Parking Name'],
            stops: currentRoute,
            totalStudents: currentLoad,
            efficiency: `${((currentLoad / maxCapacity) * 100).toFixed(1)}%`
        });
    }
    
    return routes;
}

// Main optimization function
async function optimizeRoutes() {
    try {
        if (!studentData.length || !stopsData.length || !depotsData.length) {
            showStatus('Please load data first', 'error');
            return;
        }
        
        showStatus('Optimizing routes... This may take a moment.', 'info');
        document.getElementById('optimizeBtn').innerHTML = '<div class="loading"></div> Optimizing...';
        document.getElementById('optimizeBtn').disabled = true;

        // Initialize map
        initMap();
        
        
        // For demo purposes, using simulation. Replace with actual Google API call:
        const requestData = prepareOptimizationRequest();
        //const results = await callGoogleRouteOptimization(requestData);
        
        const results = await optimizeWithGoogleAPI();
        console.log('Results received in algorithms.js:', results);

        // Set global variable
        window.optimizationResults = results;
        console.log('Setting window.optimizationResults:', window.optimizationResults);
        
        // Check global variable properly
        if (!window.optimizationResults || window.optimizationResults.length === 0) {
            throw new Error('No optimization results generated');
        }
        
        // Ensure routes have all required fields for display
        window.optimizationResults = window.optimizationResults.map((route, index) => ({
            ...route,
            busId: route.busId || `Bus ${index+1}`,
            depot: route.depot || (route.assignedDepot ? route.assignedDepot['Parking Name'] : 'Default Depot'),
            stops: route.stops || [],
            totalStudents: route.totalStudents || 0,
            efficiency: route.efficiency || '0%',
            totalDistance: route.totalDistance || '0 km',
            routeType: route.routeType || 'optimized',
            direction: route.direction || 'MIXED'
        }));
        
        initializeRouteSelectors();
        visualizeOptimizedRoutes();
        displayResults();
        
        document.getElementById('exportBtn').disabled = false;
        showStatus(`Route optimization completed! Generated ${window.optimizationResults.length} efficient routes.`, 'success');
        
    } catch (error) {
        showStatus(`Optimization failed: ${error.message}`, 'error');
        console.error('Optimization error:', error);
    } finally {
        document.getElementById('optimizeBtn').innerHTML = '<i class="fas fa-magic"></i> Optimize Routes';
        document.getElementById('optimizeBtn').disabled = false;
    }
}