/**
 * Route Optimization Controller
 * Manages different optimization algorithms and strategies
 */
class RouteOptimizer {
    constructor() {
        this.algorithms = new OptimizationAlgorithms();
        this.googleAPI = new GoogleRouteAPI();
        this.currentStrategy = CONFIG.optimization.algorithms.default;
    }
    
    /**
     * Main optimization method
     * @param {Object} data - Optimization data containing students, stops, depots, and config
     * @returns {Promise<Array>} Optimized routes
     */
    async optimize(data) {
        try {
            console.log(`Starting optimization with strategy: ${this.currentStrategy}`);
            
            // Validate input data
            this.validateOptimizationData(data);
            
            // Try primary optimization strategy
            let routes = await this.executeOptimization(data, this.currentStrategy);
            
            // If primary strategy fails, try fallback
            if (!routes || routes.length === 0) {
                console.warn('Primary optimization failed, trying fallback strategy');
                routes = await this.executeOptimization(data, CONFIG.optimization.algorithms.fallback);
            }
            
            // Post-process routes
            routes = await this.postProcessRoutes(routes, data);
            
            // Calculate metrics
            routes = this.calculateRouteMetrics(routes, data.config);
            
            console.log(`Optimization completed: ${routes.length} routes generated`);
            return routes;
            
        } catch (error) {
            console.error('Optimization failed:', error);
            throw new Error(`Route optimization failed: ${error.message}`);
        }
    }
    
    /**
     * Execute optimization with specific strategy
     * @param {Object} data - Optimization data
     * @param {string} strategy - Optimization strategy to use
     * @returns {Promise<Array>} Optimized routes
     */
    async executeOptimization(data, strategy) {
        switch (strategy) {
            case 'google_api':
                return await this.optimizeWithGoogleAPI(data);
            
            case 'greedy_nearest_neighbor':
                return await this.algorithms.greedyNearestNeighbor(data);
            
            case 'savings_algorithm':
                return await this.algorithms.savingsAlgorithm(data);
            
            case 'sweep_algorithm':
                return await this.algorithms.sweepAlgorithm(data);
            
            default:
                throw new Error(`Unknown optimization strategy: ${strategy}`);
        }
    }
    
    /**
     * Optimize using Google Route Optimization API
     * @param {Object} data - Optimization data
     * @returns {Promise<Array>} Optimized routes
     */
    async optimizeWithGoogleAPI(data) {
        try {
            // Check if API is configured
            if (!CONFIG.api.googleApiKey || CONFIG.api.googleApiKey === 'YOUR_API_KEY_HERE') {
                throw new Error('Google API key not configured');
            }
            
            // Prepare request for Google API
            const request = this.prepareGoogleAPIRequest(data);
            
            // Call Google Route Optimization API
            const response = await this.googleAPI.optimizeRoutes(request);
            
            // Process Google API response
            return this.processGoogleAPIResponse(response, data);
            
        } catch (error) {
            console.warn('Google API optimization failed:', error.message);
            throw error;
        }
    }
    
    /**
     * Prepare request for Google Route Optimization API
     * @param {Object} data - Optimization data
     * @returns {Object} Google API request object
     */
    prepareGoogleAPIRequest(data) {
        const { stops, depots, config } = data;
        const requiredBuses = Math.ceil(
            stops.reduce((sum, stop) => sum + stop.num_students, 0) / config.maxCapacity
        );
        
        // Prepare shipments (pickup points)
        const shipments = stops.map((stop, index) => ({
            deliveries: [{
                arrivalLocation: {
                    latLng: {
                        latitude: parseFloat(stop.snapped_lat),
                        longitude: parseFloat(stop.snapped_lon)
                    }
                },
                duration: `${CONFIG.optimization.constraints.serviceTime * 60}s`,
                loadDemands: {
                    students: parseInt(stop.num_students)
                }
            }],
            label: `stop_${stop.cluster_number || index}`
        }));
        
        // Prepare vehicles (buses)
        const vehicles = [];
        for (let i = 0; i < requiredBuses; i++) {
            const depot = depots[i % depots.length];
            
            vehicles.push({
                startLocation: {
                    latLng: {
                        latitude: CONFIG.college.coordinates[0],
                        longitude: CONFIG.college.coordinates[1]
                    }
                },
                endLocation: {
                    latLng: {
                        latitude: parseFloat(depot.latitude),
                        longitude: parseFloat(depot.longitude)
                    }
                },
                loadLimits: {
                    students: {
                        maxLoad: config.maxCapacity
                    }
                },
                label: `bus_${i + 1}`,
                routeModifiers: {
                    avoidTolls: CONFIG.routing.avoidTolls,
                    avoidHighways: CONFIG.routing.avoidHighways,
                    avoidFerries: CONFIG.routing.avoidFerries
                }
            });
        }
        
        return {
            model: {
                shipments,
                vehicles,
                globalStartTime: this.getOptimizationStartTime(config),
                globalEndTime: this.getOptimizationEndTime(config)
            },
            searchMode: "RETURN_FAST",
            interpretInjectedSolutionsUsingLabels: false
        };
    }
    
    /**
     * Process Google API response into route format
     * @param {Object} response - Google API response
     * @param {Object} data - Original optimization data
     * @returns {Array} Processed routes
     */
    processGoogleAPIResponse(response, data) {
        const routes = [];
        const { stops, depots } = data;
        
        if (response.routes) {
            response.routes.forEach((route, index) => {
                const routeStops = [];
                let totalStudents = 0;
                
                if (route.visits) {
                    route.visits.forEach(visit => {
                        if (visit.shipmentIndex !== undefined) {
                            const stop = stops[visit.shipmentIndex];
                            if (stop) {
                                routeStops.push(stop);
                                totalStudents += parseInt(stop.num_students);
                            }
                        }
                    });
                }
                
                if (routeStops.length > 0) {
                    const depot = depots[index % depots.length];
                    routes.push({
                        busId: `Bus ${index + 1}`,
                        depot: depot.parking_name || `Depot ${index + 1}`,
                        stops: routeStops,
                        totalStudents,
                        efficiency: `${((totalStudents / data.config.maxCapacity) * 100).toFixed(1)}%`,
                        googleMetrics: route.metrics || {}
                    });
                }
            });
        }
        
        return routes;
    }
    
    /**
     * Post-process routes for optimization and validation
     * @param {Array} routes - Raw optimized routes
     * @param {Object} data - Original optimization data
     * @returns {Promise<Array>} Post-processed routes
     */
    async postProcessRoutes(routes, data) {
        const processedRoutes = [];
        
        for (const route of routes) {
            try {
                // Validate route capacity
                if (route.totalStudents > data.config.maxCapacity) {
                    console.warn(`Route ${route.busId} exceeds capacity, splitting...`);
                    const splitRoutes = this.splitOverCapacityRoute(route, data.config.maxCapacity);
                    processedRoutes.push(...splitRoutes);
                } else {
                    // Optimize stop sequence within route
                    route.stops = await this.optimizeStopSequence(route.stops);
                    processedRoutes.push(route);
                }
                
            } catch (error) {
                console.error(`Error processing route ${route.busId}:`, error);
                // Keep original route if processing fails
                processedRoutes.push(route);
            }
        }
        
        return processedRoutes;
    }
    
    /**
     * Split route that exceeds capacity
     * @param {Object} route - Route to split
     * @param {number} maxCapacity - Maximum bus capacity
     * @returns {Array} Split routes
     */
    splitOverCapacityRoute(route, maxCapacity) {
        const splitRoutes = [];
        let currentRoute = {
            ...route,
            stops: [],
            totalStudents: 0
        };
        
        for (const stop of route.stops) {
            const stopStudents = parseInt(stop.num_students);
            
            if (currentRoute.totalStudents + stopStudents <= maxCapacity) {
                currentRoute.stops.push(stop);
                currentRoute.totalStudents += stopStudents;
            } else {
                // Finalize current route
                if (currentRoute.stops.length > 0) {
                    currentRoute.efficiency = `${((currentRoute.totalStudents / maxCapacity) * 100).toFixed(1)}%`;
                    splitRoutes.push(currentRoute);
                }
                
                // Start new route
                currentRoute = {
                    ...route,
                    busId: `${route.busId}_${splitRoutes.length + 1}`,
                    stops: [stop],
                    totalStudents: stopStudents
                };
            }
        }
        
        // Add final route
        if (currentRoute.stops.length > 0) {
            currentRoute.efficiency = `${((currentRoute.totalStudents / maxCapacity) * 100).toFixed(1)}%`;
            splitRoutes.push(currentRoute);
        }
        
        return splitRoutes;
    }
    
    /**
     * Optimize stop sequence within a route using nearest neighbor
     * @param {Array} stops - Stops to optimize
     * @returns {Promise<Array>} Optimized stop sequence
     */
    async optimizeStopSequence(stops) {
        if (stops.length <= 2) return stops;
        
        const optimized = [];
        const remaining = [...stops];
        let current = CONFIG.college.coordinates;
        
        while (remaining.length > 0) {
            let nearestIndex = 0;
            let nearestDistance = Infinity;
            
            remaining.forEach((stop, index) => {
                const distance = this.calculateDistance(
                    current[0], current[1],
                    parseFloat(stop.snapped_lat), parseFloat(stop.snapped_lon)
                );
                
                if (distance < nearestDistance) {
                    nearestDistance = distance;
                    nearestIndex = index;
                }
            });
            
            const nearestStop = remaining.splice(nearestIndex, 1)[0];
            optimized.push(nearestStop);
            current = [parseFloat(nearestStop.snapped_lat), parseFloat(nearestStop.snapped_lon)];
        }
        
        return optimized;
    }
    
    /**
     * Calculate route metrics
     * @param {Array} routes - Routes to analyze
     * @param {Object} config - Configuration
     * @returns {Array} Routes with metrics
     */
    calculateRouteMetrics(routes, config) {
        return routes.map(route => {
            const stops = route.stops || [];
            const totalDistance = this.calculateRouteDistance(route);
            const estimatedTime = this.calculateRouteTime(route, totalDistance);
            
            return {
                ...route,
                metrics: {
                    totalDistance: totalDistance.toFixed(2),
                    estimatedTime: Math.round(estimatedTime),
                    efficiency: ((route.totalStudents / config.maxCapacity) * 100).toFixed(1),
                    stopsCount: stops.length,
                    averageStudentsPerStop: stops.length > 0 ? (route.totalStudents / stops.length).toFixed(1) : 0
                }
            };
        });
    }
    
    /**
     * Calculate total distance for a route
     * @param {Object} route - Route object
     * @returns {number} Total distance in kilometers
     */
    calculateRouteDistance(route) {
        if (!route.stops || route.stops.length === 0) return 0;
        
        let totalDistance = 0;
        let currentPoint = CONFIG.college.coordinates;
        
        // Distance from college to first stop
        const firstStop = route.stops[0];
        totalDistance += this.calculateDistance(
            currentPoint[0], currentPoint[1],
            parseFloat(firstStop.snapped_lat), parseFloat(firstStop.snapped_lon)
        );
        
        // Distance between consecutive stops
        for (let i = 1; i < route.stops.length; i++) {
            const prevStop = route.stops[i - 1];
            const currentStop = route.stops[i];
            
            totalDistance += this.calculateDistance(
                parseFloat(prevStop.snapped_lat), parseFloat(prevStop.snapped_lon),
                parseFloat(currentStop.snapped_lat), parseFloat(currentStop.snapped_lon)
            );
        }
        
        return totalDistance;
    }
    
    /**
     * Calculate estimated time for a route
     * @param {Object} route - Route object
     * @param {number} distance - Total distance
     * @returns {number} Estimated time in minutes
     */
    calculateRouteTime(route, distance) {
        const travelTime = (distance / CONFIG.bus.averageSpeed) * 60; // Convert to minutes
        const stopTime = (route.stops?.length || 0) * CONFIG.bus.stopDuration;
        return travelTime + stopTime;
    }
    
    /**
     * Calculate distance between two points using Haversine formula
     * @param {number} lat1 - Latitude of first point
     * @param {number} lon1 - Longitude of first point
     * @param {number} lat2 - Latitude of second point
     * @param {number} lon2 - Longitude of second point
     * @returns {number} Distance in kilometers
     */
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth's radius in kilometers
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
                  
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }
    
    /**
     * Validate optimization data
     * @param {Object} data - Data to validate
     */
    validateOptimizationData(data) {
        if (!data.stops || data.stops.length === 0) {
            throw new Error('No stops data provided for optimization');
        }
        
        if (!data.depots || data.depots.length === 0) {
            throw new Error('No depots data provided for optimization');
        }
        
        if (!data.config || !data.config.maxCapacity) {
            throw new Error('Invalid configuration provided');
        }
        
        // Validate that we have students to transport
        const totalStudents = data.stops.reduce((sum, stop) => sum + (parseInt(stop.num_students) || 0), 0);
        if (totalStudents === 0) {
            throw new Error('No students found in stops data');
        }
        
        console.log(`Validation passed: ${data.stops.length} stops, ${data.depots.length} depots, ${totalStudents} students`);
    }
    
    /**
     * Get optimization start time based on configuration
     * @param {Object} config - Configuration object
     * @returns {string} ISO timestamp
     */
    getOptimizationStartTime(config) {
        // Convert shift time to 24-hour format
        const timeMap = {
            '8am': '08:00:00',
            '10am': '10:00:00',
            '3pm': '15:00:00',
            '5pm': '17:00:00'
        };
        
        const time = timeMap[config.shiftTime] || '08:00:00';
        return `2024-01-01T${time}Z`;
    }
    
    /**
     * Get optimization end time based on configuration
     * @param {Object} config - Configuration object
     * @returns {string} ISO timestamp
     */
    getOptimizationEndTime(config) {
        return "2024-01-01T20:00:00Z"; // Standard end time
    }
    
    /**
     * Set optimization strategy
     * @param {string} strategy - Strategy name
     */
    setStrategy(strategy) {
        if (CONFIG.optimization.algorithms.available.includes(strategy)) {
            this.currentStrategy = strategy;
            console.log(`Optimization strategy set to: ${strategy}`);
        } else {
            throw new Error(`Invalid optimization strategy: ${strategy}`);
        }
    }
    
    /**
     * Get available optimization strategies
     * @returns {Array} Available strategies
     */
    getAvailableStrategies() {
        return CONFIG.optimization.algorithms.available;
    }
}