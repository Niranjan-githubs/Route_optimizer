// Ultra-minimal serverless function - no external dependencies
const http = require('http');
const fs = require('fs');
const path = require('path');

// Simple HTTP server
const server = http.createServer((req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    // Handle different routes
    if (req.url === '/') {
        // Serve index.html
        const filePath = path.join(__dirname, '../public/index.html');
        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('File not found');
            } else {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(data);
            }
        });
    } else if (req.url === '/api/health') {
        // Health check
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            status: 'ok', 
            service: 'bus-route-optimizer',
            timestamp: new Date().toISOString()
        }));
    } else if (req.url === '/api/test') {
        // Test endpoint
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            message: 'API is working!',
            timestamp: new Date().toISOString()
        }));
    } else {
        // Try to serve static files
        const filePath = path.join(__dirname, '../public', req.url);
        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('File not found');
            } else {
                // Determine content type
                const ext = path.extname(filePath);
                let contentType = 'text/plain';
                if (ext === '.html') contentType = 'text/html';
                else if (ext === '.css') contentType = 'text/css';
                else if (ext === '.js') contentType = 'application/javascript';
                else if (ext === '.json') contentType = 'application/json';
                
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(data);
            }
        });
    }
});

// Export the server for Vercel
module.exports = server;
