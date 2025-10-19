// Route Network Visualizer for combined_data.csv
// Creates Google Maps visualization with traced routes and bus stop overlays

class RouteNetworkVisualizer {
    constructor(map) {
        this.map = map;
        this.routeData = [];
        this.busStops = [];
        this.routePolylines = [];
        this.busStopMarkers = [];
        this.vehicleColors = {};
        this.routeColors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
            '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
            '#F8C471', '#82E0AA', '#F1948A', '#85C1E9', '#D7BDE2'
        ];
    }

    // Load and process combined_data.csv
    async loadRouteData() {
        try {
            console.log('🔄 Loading route data from combined_data.csv...');
            
            const response = await fetch('js/combined_data.csv');
            const csvText = await response.text();
            
            // Parse CSV
            const lines = csvText.split('\n');
            const headers = lines[0].split(',');
            const data = [];
            
            for (let i = 1; i < lines.length; i++) {
                if (lines[i].trim()) {
                    const values = lines[i].split(',');
                    if (values.length >= 10) {
                        data.push({
                            vehicle_number: values[0].trim(),
                            device_id: values[1].trim(),
                            speed: parseFloat(values[2]) || 0,
                            total_distance: parseFloat(values[3]) || 0,
                            fuel: parseFloat(values[4]) || 0,
                            data_received: values[5].trim(),
                            latitude: parseFloat(values[6]) || 0,
                            longitude: parseFloat(values[7]) || 0,
                            location_text: values[8].trim(),
                            scraped_at: values[9].trim()
                        });
                    }
                }
            }
            
            console.log(`✅ Loaded ${data.length} route points`);
            this.routeData = data;
            return data;
        } catch (error) {
            console.error('❌ Error loading route data:', error);
            return [];
        }
    }

    // Load bus stops data
    async loadBusStops() {
        try {
            console.log('🔄 Loading bus stops data...');
            
            const response = await fetch('Routes_Data/Bus_Stops/coords.csv');
            const csvText = await response.text();
            
            const lines = csvText.split('\n');
            const data = [];
            
            for (let i = 1; i < lines.length; i++) {
                if (lines[i].trim()) {
                    const values = lines[i].split(',');
                    if (values.length >= 4) {
                        data.push({
                            name: values[0].trim(),
                            latitude: parseFloat(values[1]) || 0,
                            longitude: parseFloat(values[2]) || 0,
                            counts: values[3].trim()
                        });
                    }
                }
            }
            
            console.log(`✅ Loaded ${data.length} bus stops`);
            this.busStops = data;
            return data;
        } catch (error) {
            console.error('❌ Error loading bus stops:', error);
            return [];
        }
    }

    // Group route data by vehicle
    groupRoutesByVehicle() {
        const vehicleRoutes = {};
        
        this.routeData.forEach(point => {
            if (!vehicleRoutes[point.vehicle_number]) {
                vehicleRoutes[point.vehicle_number] = [];
            }
            vehicleRoutes[point.vehicle_number].push(point);
        });

        // Sort each vehicle's points by timestamp
        Object.keys(vehicleRoutes).forEach(vehicle => {
            vehicleRoutes[vehicle].sort((a, b) => {
                const timeA = new Date(a.data_received);
                const timeB = new Date(b.data_received);
                return timeA - timeB;
            });
        });

        return vehicleRoutes;
    }

    // Get road path between two points
    async getRoadPath(origin, destination) {
        try {
            // Try Google Directions API first
            const directionsService = new google.maps.DirectionsService();
            const result = await new Promise((resolve, reject) => {
                directionsService.route({
                    origin: origin,
                    destination: destination,
                    travelMode: google.maps.TravelMode.DRIVING,
                    avoidHighways: false,
                    avoidTolls: false
                }, (result, status) => {
                    if (status === 'OK') {
                        resolve(result);
                    } else {
                        reject(new Error(`Directions request failed: ${status}`));
                    }
                });
            });

            const path = [];
            result.routes[0].legs.forEach(leg => {
                leg.steps.forEach(step => {
                    if (step.polyline && step.polyline.points) {
                        const decoded = google.maps.geometry.encoding.decodePath(step.polyline.points);
                        decoded.forEach(point => path.push({ lat: point.lat(), lng: point.lng() }));
                    }
                });
            });

            return path.length > 0 ? path : null;
        } catch (error) {
            console.warn('Google Directions failed, using straight line:', error);
            return [origin, destination];
        }
    }

    // Draw route for a single vehicle
    async drawVehicleRoute(vehicleNumber, points, color) {
        if (points.length < 2) return;

        const routePolylines = [];
        
        for (let i = 0; i < points.length - 1; i++) {
            const origin = { lat: points[i].latitude, lng: points[i].longitude };
            const destination = { lat: points[i + 1].latitude, lng: points[i + 1].longitude };
            
            try {
                const path = await this.getRoadPath(origin, destination);
                
                if (path && path.length > 1) {
                    const polyline = new google.maps.Polyline({
                        path: path,
                        geodesic: true,
                        strokeColor: color,
                        strokeOpacity: 0.7,
                        strokeWeight: 3,
                        map: this.map
                    });
                    
                    routePolylines.push(polyline);
                }
                
                // Add small delay to prevent overwhelming the API
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
                console.warn(`Error drawing segment for ${vehicleNumber}:`, error);
            }
        }

        return routePolylines;
    }

    // Visualize all routes
    async visualizeRouteNetwork() {
        try {
            console.log('🎯 Starting route network visualization...');
            
            // Clear existing visualizations
            this.clearVisualizations();
            
            // Load data
            await this.loadRouteData();
            await this.loadBusStops();
            
            if (this.routeData.length === 0) {
                console.warn('No route data available');
                return;
            }

            // Group routes by vehicle
            const vehicleRoutes = this.groupRoutesByVehicle();
            const vehicles = Object.keys(vehicleRoutes);
            
            console.log(`📊 Found ${vehicles.length} vehicles with route data`);

            // Draw routes for each vehicle
            let colorIndex = 0;
            for (const vehicleNumber of vehicles) {
                const points = vehicleRoutes[vehicleNumber];
                const color = this.routeColors[colorIndex % this.routeColors.length];
                
                console.log(`🔄 Drawing route for ${vehicleNumber} (${points.length} points)`);
                
                const polylines = await this.drawVehicleRoute(vehicleNumber, points, color);
                this.routePolylines.push(...polylines);
                
                // Store color for this vehicle
                this.vehicleColors[vehicleNumber] = color;
                
                colorIndex++;
            }

            // Add bus stops
            this.addBusStopMarkers();

            console.log('✅ Route network visualization completed');
        } catch (error) {
            console.error('❌ Error visualizing route network:', error);
        }
    }

    // Add bus stop markers
    addBusStopMarkers() {
        this.busStops.forEach((stop, index) => {
            if (stop.latitude && stop.longitude) {
                const marker = new google.maps.Marker({
                    position: { lat: stop.latitude, lng: stop.longitude },
                    map: this.map,
                    title: stop.name,
                    icon: {
                        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                            <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="12" cy="12" r="10" fill="#e74c3c" stroke="white" stroke-width="2"/>
                                <text x="12" y="16" text-anchor="middle" fill="white" font-family="Arial" font-size="12" font-weight="bold">🚌</text>
                            </svg>
                        `),
                        scaledSize: new google.maps.Size(24, 24),
                        anchor: new google.maps.Point(12, 12)
                    }
                });

                const infoWindow = new google.maps.InfoWindow({
                    content: `
                        <div style="padding: 8px;">
                            <h4 style="margin: 0 0 4px 0; color: #2c3e50;">${stop.name}</h4>
                            <p style="margin: 0; color: #7f8c8d; font-size: 12px;">Capacity: ${stop.counts || 'N/A'}</p>
                            <p style="margin: 0; color: #7f8c8d; font-size: 12px;">Coordinates: ${stop.latitude.toFixed(4)}, ${stop.longitude.toFixed(4)}</p>
                        </div>
                    `
                });

                marker.addListener('click', () => {
                    infoWindow.open(this.map, marker);
                });

                this.busStopMarkers.push(marker);
            }
        });

        console.log(`✅ Added ${this.busStopMarkers.length} bus stop markers`);
    }

    // Clear all visualizations
    clearVisualizations() {
        // Clear route polylines
        this.routePolylines.forEach(polyline => {
            polyline.setMap(null);
        });
        this.routePolylines = [];

        // Clear bus stop markers
        this.busStopMarkers.forEach(marker => {
            marker.setMap(null);
        });
        this.busStopMarkers = [];

        console.log('🧹 Cleared all visualizations');
    }

    // Get route statistics
    getRouteStatistics() {
        const vehicleRoutes = this.groupRoutesByVehicle();
        const stats = {
            totalVehicles: Object.keys(vehicleRoutes).length,
            totalPoints: this.routeData.length,
            totalBusStops: this.busStops.length,
            vehicles: {}
        };

        Object.keys(vehicleRoutes).forEach(vehicle => {
            const points = vehicleRoutes[vehicle];
            const distances = [];
            
            for (let i = 0; i < points.length - 1; i++) {
                const dist = this.calculateDistance(
                    points[i].latitude, points[i].longitude,
                    points[i + 1].latitude, points[i + 1].longitude
                );
                distances.push(dist);
            }

            stats.vehicles[vehicle] = {
                pointCount: points.length,
                totalDistance: points[points.length - 1]?.total_distance || 0,
                avgSpeed: points.reduce((sum, p) => sum + p.speed, 0) / points.length,
                color: this.vehicleColors[vehicle] || '#000000'
            };
        });

        return stats;
    }

    // Calculate distance between two points
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth's radius in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }
}

// Global function to initialize route network visualization
window.visualizeRouteNetwork = async function() {
    if (!window.map) {
        console.error('Map not initialized');
        return;
    }

    const visualizer = new RouteNetworkVisualizer(window.map);
    await visualizer.visualizeRouteNetwork();
    
    // Display statistics
    const stats = visualizer.getRouteStatistics();
    console.log('📊 Route Network Statistics:', stats);
    
    // Store visualizer globally for future use
    window.routeNetworkVisualizer = visualizer;
};

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RouteNetworkVisualizer;
}
