// Simplified serverless function for Vercel
const express = require('express');
const { GoogleAuth } = require('google-auth-library');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Enable CORS for your frontend
app.use(cors({
    origin: ['http://127.0.0.1:5500', 'http://localhost:5500', 'http://localhost:3000'],
    credentials: true
}));

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, '../public')));

// Serve the main HTML file for the root path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

const projectId = "stunning-shadow-454718-r7";

// Initialize Google Auth
const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    // Use environment variables instead of key file
    projectId: projectId
});

// Route to get authentication token
app.get('/api/get-token', async (req, res) => {
    try {
        const authClient = await auth.getClient();
        const accessToken = await authClient.getAccessToken();
        
        res.json({ 
            token: accessToken.token,
            expires_in: 3600
        });
    } catch (error) {
        console.error('Auth error:', error);
        res.status(500).json({ 
            error: 'Failed to get access token', 
            details: error.message 
        });
    }
});

// Main optimization endpoint
app.post('/api/optimize', async (req, res) => {
    try {
        console.log('Received optimization request');
        
        // Get authenticated client
        const authClient = await auth.getClient();
        
        // Use Route Optimization API endpoint
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

// Directions API endpoint
app.post('/api/directions', async (req, res) => {
    try {
        console.log('📡 Received directions request');
        
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
        console.log('🌐 Calling Google Directions API');
        
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

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({ 
        error: 'Internal server error', 
        details: error.message 
    });
});

// Export the app for Vercel
module.exports = app;
