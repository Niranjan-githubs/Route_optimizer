// Configuration file for the College Bus Route Optimization System
const CONFIG = {
    // API Configuration
    api: {
        // Replace with your actual Google API key
        googleApiKey: 'AIzaSyAiVn2TbI7qSuTzw1EKvY4urq7V5aTZkZg',
        
        // Replace with your actual Google Cloud Project ID
        projectId: 'stunning-shadow-454718-r7',
        
        // API Endpoints
        routes: {
            optimization: 'https://routeoptimization.googleapis.com/v1',
            directions: 'https://maps.googleapis.com/maps/api/directions/json',
            osrm: 'https://router.project-osrm.org/route/v1/driving'
        },
        
        // Rate limiting
        rateLimits: {
            optimizationCallsPerDay: 1000,
            directionsCallsPerDay: 2500
        }
    },
    
    // College Configuration
    college: {
        name: 'Rajalakshmi Engineering College',
        coordinates: [13.062049521609033, 80.00346942987923], // [lat, lng]
        timezone: 'Asia/Kolkata'
    },
    
    // Bus Configuration
    bus: {
        defaultCapacity: 55,
        maxCapacity: 64,
        minCapacity: 20,
        averageSpeed: 25, // km/h in city traffic
        stopDuration: 5 // minutes per stop
    },
    
    // Route Configuration
    routing: {
        avoidTolls: false,
        avoidHighways: false,
        avoidFerries: true,
        optimizeWaypoints: true,
        units: 'metric'
    },
    
    // Map Configuration
    map: {
        defaultZoom: 10,
        maxZoom: 18,
        minZoom: 8,
        tileLayer: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '© OpenStreetMap contributors'
    },
    
    // Visualization Configuration
    visualization: {
        colors: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57', '#FF9FF3', '#54A0FF', '#5F27CD'],
        routeWeight: 5,
        routeOpacity: 0.8,
        markerSizes: {
            college: 30,
            depot: 24,
            stop: 24
        }
    },
    
    // Optimization Parameters
    optimization: {
        algorithms: {
            default: 'google_api',
            fallback: 'greedy_nearest_neighbor',
            available: [
                'google_api',
                'greedy_nearest_neighbor',
                'savings_algorithm',
                'sweep_algorithm'
            ]
        },
        constraints: {
            maxRouteTime: 120, // minutes
            maxRouteDistance: 100, // kilometers
            serviceTime: 5 // minutes per stop
        }
    },
    
    // Data Validation Rules
    validation: {
        csv: {
            students: {
                requiredColumns: ['student_lat', 'student_lon'],
                optionalColumns: ['student_id', 'name', 'route']
            },
            stops: {
                requiredColumns: ['snapped_lat', 'snapped_lon', 'num_students', 'cluster_number'],
                optionalColumns: ['route_name', 'route_type']
            },
            depots: {
                requiredColumns: ['Latitude', 'Longitude', 'Parking Name'],
                optionalColumns: ['Counts', 'Address']
            }
        },
        coordinates: {
            chennaiBounds: {
                north: 13.3,
                south: 12.7,
                east: 80.5,
                west: 79.8
            }
        }
    },
    
    // Export Configuration
    export: {
        formats: ['csv', 'json', 'xlsx'],
        defaultFormat: 'csv',
        includeMetadata: true
    },
    
    // Performance Configuration
    performance: {
        maxDataPoints: 10000,
        batchSize: 100,
        timeout: 30000, // 30 seconds
        retryAttempts: 3
    },
    
    // Environment
    environment: 'development', // 'development' or 'production'
    
    // Debug Configuration
    debug: {
        enabled: true,
        logLevel: 'info', // 'error', 'warn', 'info', 'debug'
        showPerformanceMetrics: true
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}