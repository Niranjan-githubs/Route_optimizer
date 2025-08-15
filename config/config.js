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
    // Visualization Configuration
visualization: {
    colors: [
        // Reds
        '#FF0000', '#FF4D4D', '#FF9999', '#FFE5E5', '#CC0000',
        // Blues
        '#0000FF', '#4D4DFF', '#9999FF', '#E5E5FF', '#0000CC',
        // Greens
        '#00FF00', '#4DFF4D', '#99FF99', '#E5FFE5', '#00CC00',
        // Purples
        '#800080', '#B366B3', '#D9B3D9', '#F2E6F2', '#660066',
        // Oranges
        '#FFA500', '#FFB84D', '#FFD699', '#FFF2E5', '#CC8400',
        // Teals
        '#008080', '#33B3B3', '#80CCCC', '#E5F2F2', '#006666',
        // Pinks
        '#FF69B4', '#FF99CC', '#FFC6E0', '#FFE5F0', '#CC5490',
        // Browns
        '#8B4513', '#B37349', '#D9B3A3', '#F2E6E0', '#663219',
        // Limes
        '#32CD32', '#66D966', '#99E699', '#E5F5E5', '#269926',
        // Indigos
        '#4B0082', '#7A33B3', '#B380CC', '#EBE5F2', '#3C0066'
    ],
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