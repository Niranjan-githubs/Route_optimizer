// server.js - FIXED VERSION
require('dotenv').config(); // Load environment variables from .env file
const express = require('express');
const { GoogleAuth } = require('google-auth-library');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
// Enable CORS for your frontend
app.use(cors({
    origin: ['http://127.0.0.1:5500', 'http://localhost:5500', 'http://localhost:3000'],
    credentials: true
}));

app.use(express.static(__dirname));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});



const projectId = "stunning-shadow-454718-r7";


// Initialize Google Auth
const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    // Use service account key file or default credentials
    keyFilename: 'stunning-shadow-454718-r7-1eb800dfd42b.json' // Update this path
});



// Route to get authentication token (if needed separately)
app.get('/api/get-token', async (req, res) => {
    try {
        const authClient = await auth.getClient();
        const accessToken = await authClient.getAccessToken();
        
        res.json({ 
            token: accessToken.token,
            expires_in: 3600 // 1 hour
        });
    } catch (error) {
        console.error('Auth error:', error);
        res.status(500).json({ 
            error: 'Failed to get access token', 
            details: error.message 
        });
    }
});

// Main optimization endpoint - Updated for Route Optimization API
app.post('/api/optimize', async (req, res) => {
    try {
        console.log('Received optimization request:', JSON.stringify(req.body, null, 2));
        
        // Get authenticated client
        const authClient = await auth.getClient();
        
        // CORRECTED: Use Route Optimization API endpoint
        const url = `https://routeoptimization.googleapis.com/v1/projects/${projectId}:optimizeTours`;
        
        // Make request to Google Route Optimization API
        const response = await authClient.request({
            url: url,
            method: 'POST',
            data: req.body,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'bus-route-optimizer/1.0'
            }
        });
        
        console.log('Google API Response Status:', response.status);
        console.log('Google API Response:', JSON.stringify(response.data, null, 2));
        
        // Return the optimization result
        res.json(response.data);
        
    } catch (error) {
        console.error('Route Optimization API Error:', error);
        
        let errorDetails = {
            message: error.message,
            status: error.response?.status || 500
        };
        
        if (error.response?.data) {
            errorDetails.apiError = error.response.data;
            console.error('Google API Error Details:', error.response.data);
        }
        
        res.status(errorDetails.status).json({
            error: 'Route Optimization API failed',
            details: errorDetails
        });
    }
});

app.post('/api/validate-route', async (req, res) => {
    try {
        const { origin, destination, waypoints, travelMode, transitOptions, avoidTolls, avoidHighways, avoidFerries } = req.body;
        
        const directionsRequest = {
            origin: origin,
            destination: destination,
            waypoints: waypoints,
            mode: travelMode,
            alternatives: true,
            avoid: [
                ...(avoidTolls ? ['tolls'] : []),
                ...(avoidHighways ? ['highways'] : []),
                ...(avoidFerries ? ['ferries'] : [])
            ],
            // ✅ KEY: Add restrictions for large vehicles (buses)
            restrictions: {
                vehicleType: 'BUS',
                avoidRestrictedRoads: true,
                avoidLowBridges: true
            }
        };
        
        // If using transit mode, add transit options
        if (travelMode === 'TRANSIT' && transitOptions) {
            directionsRequest.transitOptions = transitOptions;
        }
        
        // Call Google Directions API
        const response = await googleDirections.directions(directionsRequest);
        res.json(response.data);
        
    } catch (error) {
        console.error('Route validation error:', error);
        res.status(500).json({ error: 'Route validation failed', details: error.message });
    }
});


app.post('/api/directions', async (req, res) => {
    try {
        console.log('📡 Received directions request:', JSON.stringify(req.body, null, 2));
        
        const { origin, destination, waypoints, optimizeWaypoints, travelMode, avoidTolls, avoidHighways, avoidFerries } = req.body;
        
        // Validate required parameters
        if (!origin || !destination) {
            return res.status(400).json({ error: 'Origin and destination are required' });
        }
        
        // Build waypoints string
        let waypointsStr = '';
        if (waypoints && waypoints.length > 0) {
            const waypointCoords = waypoints.map(wp => `${wp.location.lat},${wp.location.lng}`);
            waypointsStr = waypointCoords.join('|');
            if (optimizeWaypoints) {
                waypointsStr = `optimize:true|${waypointsStr}`;
            }
        }
        
        // Build avoid parameter
        const avoidParams = [];
        if (avoidTolls) avoidParams.push('tolls');
        if (avoidHighways) avoidParams.push('highways');  
        if (avoidFerries) avoidParams.push('ferries');
        
        // Check if API key is available
        const apiKey = process.env.GOOGLE_API_KEY;
        if (!apiKey) {
            console.error('❌ No Google API key found in environment variables');
            return res.status(500).json({ error: 'Google API key not configured' });
        }
        
        // Construct URL
        const params = new URLSearchParams({
            origin: `${origin.lat},${origin.lng}`,
            destination: `${destination.lat},${destination.lng}`,
            mode: travelMode || 'driving',
            key: apiKey
        });
        
        if (waypointsStr) params.append('waypoints', waypointsStr);
        if (avoidParams.length > 0) params.append('avoid', avoidParams.join('|'));
        
        const url = `https://maps.googleapis.com/maps/api/directions/json?${params.toString()}`;
        console.log('🌐 Calling Google Directions API:', url);
        
        const response = await fetch(url);
        const result = await response.json();
        
        console.log('✅ Google Directions API response status:', result.status);
        if (result.status !== 'OK') {
            console.error('❌ Google Directions API error:', result.error_message);
        }
        
        res.json(result);
        
    } catch (error) {
        console.error('❌ Directions API error:', error);
        res.status(500).json({ error: 'Directions failed', details: error.message });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        service: 'bus-route-optimizer',
        timestamp: new Date().toISOString()
    });
});

// ==================== ROUTE CACHING ENDPOINTS ====================

// Directory for cached routes
const CACHE_DIR = path.join(__dirname, 'cached_routes');

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    console.log('📁 Created cached_routes directory');
}

// Save optimized routes
app.post('/api/cache-routes', (req, res) => {
    try {
        const { name, routes, metadata } = req.body;
        
        if (!name || !routes) {
            return res.status(400).json({ error: 'name and routes are required' });
        }
        
        const cacheData = {
            name,
            routes,
            metadata: metadata || {},
            savedAt: new Date().toISOString()
        };
        
        // Sanitize filename to prevent security issues
        console.log('🔍 Server received name:', name, 'type:', typeof name);
        const nameStr = String(name || 'unnamed');
        console.log('🔍 nameStr after conversion:', nameStr, 'type:', typeof nameStr);
        const sanitizedName = nameStr.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50);
        const filename = `routes_${sanitizedName}.json`;
        const filepath = path.join(CACHE_DIR, filename);
        
        fs.writeFileSync(filepath, JSON.stringify(cacheData, null, 2));
        
        console.log(`✅ Routes cached successfully: ${filename}`);
        res.json({ 
            success: true, 
            message: 'Routes cached successfully',
            filename 
        });
    } catch (error) {
        console.error('❌ Error caching routes:', error);
        res.status(500).json({ error: 'Failed to cache routes', details: error.message });
    }
});

// Load cached routes by name
app.get('/api/cached-routes/:name', (req, res) => {
    try {
        const { name } = req.params;
        // Sanitize filename to match the saved format
        const nameStr = String(name || 'unnamed');
        const sanitizedName = nameStr.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50);
        const filename = `routes_${sanitizedName}.json`;
        const filepath = path.join(CACHE_DIR, filename);
        
        if (!fs.existsSync(filepath)) {
            return res.status(404).json({ error: 'Cached routes not found' });
        }
        
        const cacheData = JSON.parse(fs.readFileSync(filepath, 'utf8'));
        
        console.log(`📦 Loaded cached routes: ${filename}`);
        res.json(cacheData);
    } catch (error) {
        console.error('❌ Error loading cached routes:', error);
        res.status(500).json({ error: 'Failed to load cached routes', details: error.message });
    }
});

// List all cached routes
app.get('/api/cached-routes', (req, res) => {
    try {
        const files = fs.readdirSync(CACHE_DIR)
            .filter(file => file.startsWith('routes_') && file.endsWith('.json'))
            .map(file => {
                const filepath = path.join(CACHE_DIR, file);
                const stats = fs.statSync(filepath);
                const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
                
                return {
                    filename: file,
                    name: data.name || data.timestamp || 'Unnamed Route',
                    savedAt: data.savedAt,
                    routeCount: data.routes?.length || 0,
                    metadata: data.metadata || {}
                };
            })
            .sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
        
        console.log(`📋 Found ${files.length} cached route sets`);
        res.json({ routes: files });
    } catch (error) {
        console.error('❌ Error listing cached routes:', error);
        res.status(500).json({ error: 'Failed to list cached routes', details: error.message });
    }
});

// Delete cached routes by timestamp
app.delete('/api/cached-routes/:name', (req, res) => {
    try {
        const { name } = req.params;
        const filename = `routes_${name}.json`;
        const filepath = path.join(CACHE_DIR, filename);
        
        if (!fs.existsSync(filepath)) {
            return res.status(404).json({ error: 'Cached routes not found' });
        }
        
        fs.unlinkSync(filepath);
        
        console.log(`🗑️ Deleted cached routes: ${filename}`);
        res.json({ success: true, message: 'Cached routes deleted' });
    } catch (error) {
        console.error('❌ Error deleting cached routes:', error);
        res.status(500).json({ error: 'Failed to delete cached routes', details: error.message });
    }
});

// ==================== END ROUTE CACHING ENDPOINTS ====================

// ==================== VEHICLE ROUTES ENDPOINTS ====================

// Serve vehicle routes data in chunks
app.get('/api/vehicle-routes', (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        
        console.log(`📋 Loading vehicle routes: limit=${limit}, offset=${offset}`);
        
        // Read the vehicle routes file
        const vehicleRoutesPath = path.join(__dirname, 'data_cleaning', 'vehicle_routes.json');
        
        if (!fs.existsSync(vehicleRoutesPath)) {
            return res.status(404).json({ error: 'Vehicle routes file not found' });
        }
        
        // Read and parse the JSON file
        const rawData = fs.readFileSync(vehicleRoutesPath, 'utf8');
        const data = JSON.parse(rawData);
        
        if (!data.highways || !Array.isArray(data.highways)) {
            return res.status(400).json({ error: 'Invalid vehicle routes format' });
        }
        
        // Get the requested chunk
        const routes = data.highways.slice(offset, offset + limit);
        
        // Calculate route statistics and filter valid routes
        const routeStats = routes.map((route, index) => {
            const coordinates = route.coordinates || [];
            
            // Filter out invalid coordinates
            const validCoords = coordinates.filter(coord => 
                coord && 
                Array.isArray(coord) && 
                coord.length >= 2 && 
                typeof coord[0] === 'number' && 
                typeof coord[1] === 'number' &&
                !isNaN(coord[0]) && 
                !isNaN(coord[1]) &&
                coord[0] >= -180 && coord[0] <= 180 &&
                coord[1] >= -90 && coord[1] <= 90
            );
            
            const distance = calculateRouteDistance(validCoords);
            
            return {
                id: offset + index,
                name: route.name || `Route ${offset + index + 1}`,
                coordinates: validCoords,
                distance: distance,
                pointCount: validCoords.length,
                originalPointCount: coordinates.length,
                color: getRouteColor(offset + index),
                isValid: validCoords.length >= 2
            };
        }).filter(route => route.isValid); // Only return valid routes
        
        const response = {
            routes: routeStats,
            total: data.highways.length,
            hasMore: offset + limit < data.highways.length,
            offset: offset,
            limit: limit
        };
        
        console.log(`✅ Served ${routes.length} routes (${offset + 1}-${offset + routes.length} of ${data.highways.length})`);
        res.json(response);
        
    } catch (error) {
        console.error('❌ Error loading vehicle routes:', error);
        res.status(500).json({ error: 'Failed to load vehicle routes', details: error.message });
    }
});

// Get vehicle routes summary/statistics
app.get('/api/vehicle-routes/summary', (req, res) => {
    try {
        console.log('📊 Loading vehicle routes summary...');
        
        const vehicleRoutesPath = path.join(__dirname, 'data_cleaning', 'vehicle_routes.json');
        
        if (!fs.existsSync(vehicleRoutesPath)) {
            return res.status(404).json({ error: 'Vehicle routes file not found' });
        }
        
        // Read and parse the JSON file
        const rawData = fs.readFileSync(vehicleRoutesPath, 'utf8');
        const data = JSON.parse(rawData);
        
        if (!data.highways || !Array.isArray(data.highways)) {
            return res.status(400).json({ error: 'Invalid vehicle routes format' });
        }
        
        const totalRoutes = data.highways.length;
        let totalDistance = 0;
        let totalPoints = 0;
        let minDistance = Infinity;
        let maxDistance = 0;
        
        // Calculate summary statistics
        data.highways.forEach((route, index) => {
            const coordinates = route.coordinates || [];
            const distance = calculateRouteDistance(coordinates);
            
            totalDistance += distance;
            totalPoints += coordinates.length;
            minDistance = Math.min(minDistance, distance);
            maxDistance = Math.max(maxDistance, distance);
        });
        
        const summary = {
            totalRoutes: totalRoutes,
            totalDistance: totalDistance,
            averageDistance: totalRoutes > 0 ? totalDistance / totalRoutes : 0,
            minDistance: minDistance === Infinity ? 0 : minDistance,
            maxDistance: maxDistance,
            totalPoints: totalPoints,
            averagePointsPerRoute: totalRoutes > 0 ? totalPoints / totalRoutes : 0
        };
        
        console.log(`📊 Vehicle routes summary: ${totalRoutes} routes, ${totalDistance.toFixed(1)}km total`);
        res.json(summary);
        
    } catch (error) {
        console.error('❌ Error loading vehicle routes summary:', error);
        res.status(500).json({ error: 'Failed to load vehicle routes summary', details: error.message });
    }
});

// Helper function to calculate route distance (simplified)
function calculateRouteDistance(coordinates) {
    if (!coordinates || coordinates.length < 2) return 0;
    
    let totalDistance = 0;
    for (let i = 1; i < coordinates.length; i++) {
        const [lat1, lng1] = coordinates[i - 1];
        const [lat2, lng2] = coordinates[i];
        
        // Simple distance calculation (not perfectly accurate but fast)
        const distance = Math.sqrt(
            Math.pow(lat2 - lat1, 2) + Math.pow(lng2 - lng1, 2)
        ) * 111; // Rough conversion to km
        
        totalDistance += distance;
    }
    
    return totalDistance;
}

// Helper function to get route color
function getRouteColor(index) {
    const colors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
        '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52B788',
        '#E74C3C', '#3498DB', '#2ECC71', '#F39C12', '#9B59B6',
        '#1ABC9C', '#34495E', '#E67E22', '#95A5A6', '#F1C40F'
    ];
    return colors[index % colors.length];
}

// ==================== END VEHICLE ROUTES ENDPOINTS ====================

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({ 
        error: 'Internal server error', 
        details: error.message 
    });
});

// Clean request data to remove undefined/null values
function cleanRequestData(data) {
  if (typeof data !== 'object' || data === null) {
    return data;
  }
  
  if (Array.isArray(data)) {
    return data.map(item => cleanRequestData(item)).filter(item => item !== undefined);
  }
  
  const cleaned = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && value !== null) {
      cleaned[key] = cleanRequestData(value);
    }
  }
  return cleaned;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Export the app for Vercel
module.exports = app;