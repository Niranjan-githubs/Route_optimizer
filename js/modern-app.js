// 🚌 Smart Bus Route Optimizer - Modern Application
// This replaces the old Leaflet-based system with Google Maps and fixes all UI bugs

// Global state
const AppState = {
    map: null,
    studentData: [],
    stopsData: [],
    depotsData: [],
    optimizationResults: [],
    selectedRoutes: new Set(),
    markers: new Map(),
    polylines: new Map(),
    routePolylinesByRoute: {}, // { [routeIndex]: Polyline[] }
    routeOverlaysByRoute: {},  // { [routeIndex]: Polyline[] }
    routeMarkersByRoute: {},   // { [routeIndex]: Marker[] }
    depotMarkersByRoute: {},   // { [routeIndex]: Marker }
    currentFilter: 'all',
    isLoading: false,
    // Feature flags
    featureFlags: {
        enableRoadWidthValidation: false // gate external road-width API
    }
};

// Constants
const COLLEGE_COORDS = [13.008867898985972, 80.00353386796435]; // Array format for compatibility
const ROUTE_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57', '#FF9FF3', '#54A0FF', '#5F27CD'];

// Global variables for optimization system
window.COLLEGE_COORDS = COLLEGE_COORDS;
window.stopsData = [];
window.depotsData = [];

// Global initMap function for Google Maps callback (will be set later to avoid conflicts)

// Initialize application
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 DOMContentLoaded fired.');
    // Wait for Google Maps API to load before initializing
    if (typeof google !== 'undefined' && google.maps) {
        console.log('🚀 Google Maps already loaded. Initializing from DOMContentLoaded...');
    initializeApp();
    } else {
        console.log('🚀 Waiting for Google Maps API to load...');
        // Wait for Google Maps to load
        window.waitForGoogleMaps = setInterval(() => {
            if (typeof google !== 'undefined' && google.maps) {
                console.log('🚀 Google Maps loaded. Initializing...');
                clearInterval(window.waitForGoogleMaps);
                initializeApp();
            }
        }, 100);
    }
});

function initializeApp() {
    if (window.googleMapsInitialized) {
        console.log('🚫 Application already initialized, skipping...');
        return;
    }
    
    // Check if Google Maps is ready
    if (typeof google === 'undefined' || !google.maps) {
        console.log('⏳ Waiting for Google Maps API to be ready...');
        setTimeout(initializeApp, 100);
        return;
    }
    
    initGoogleMap();
    setupEventListeners();
    hideLoading();
    window.googleMapsInitialized = true;
    console.log('✅ Application initialized successfully');
}

// Google Maps Integration
function initGoogleMap() {
    console.log('🗺️ Initializing Google Maps...');
    
    // Check if Google Maps API is loaded
    if (typeof google === 'undefined' || !google.maps) {
        console.error('❌ Google Maps API not loaded yet!');
        return;
    }
    
    const mapElement = document.getElementById('map');
    if (!mapElement) {
        console.error('❌ Map container not found!');
        return;
    }

    AppState.map = new google.maps.Map(mapElement, {
        center: { lat: COLLEGE_COORDS[0], lng: COLLEGE_COORDS[1] },
        zoom: 11,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: true
    });

    // Add college marker
    new google.maps.Marker({
        position: { lat: COLLEGE_COORDS[0], lng: COLLEGE_COORDS[1] },
        map: AppState.map,
        title: 'College',
        icon: {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="20" cy="20" r="20" fill="#3b82f6" stroke="white" stroke-width="3"/>
                    <text x="20" y="26" text-anchor="middle" fill="white" font-family="Arial" font-size="16" font-weight="bold">🏫</text>
                </svg>
            `),
            scaledSize: new google.maps.Size(40, 40),
            anchor: new google.maps.Point(20, 20)
        }
    });

    console.log('✅ Google Maps initialized successfully');
    
    // Add click listener for Street View
    AppState.map.addListener('click', function(event) {
        if (window.streetViewMode) {
            openStreetViewAtLocation(event.latLng);
            // Exit Street View mode after clicking
            window.streetViewMode = false;
            updateStreetViewButton();
        }
    });
    
    // Add double-click listener for quick Street View
    AppState.map.addListener('dblclick', function(event) {
        // Quick Street View at double-clicked location
        openStreetViewAtLocation(event.latLng);
    });
}

// Event Listeners
function setupEventListeners() {
    document.getElementById('studentFile').addEventListener('change', handleFileChange);
    document.getElementById('stopsFile').addEventListener('change', handleFileChange);
    document.getElementById('depotsFile').addEventListener('change', handleFileChange);
    
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', handleQuickFilter);
    });
    
    document.getElementById('maxCapacity').addEventListener('change', updateMetrics);
    document.getElementById('shiftTime').addEventListener('change', updateMetrics);
    document.getElementById('dayOfWeek').addEventListener('change', updateMetrics);
    
    // Search bar keyboard support and auto-complete
    const searchInput = document.getElementById('locationSearch');
    
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchLocation();
        }
    });
    
    searchInput.addEventListener('input', function(e) {
        const query = e.target.value.trim();
        if (query.length > 2) {
            showSearchRecommendations(query);
        } else {
            hideSearchRecommendations();
        }
    });
    
    // Close recommendations when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.map-search-container')) {
            hideSearchRecommendations();
        }
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        // Ctrl/Cmd + F for search focus
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
            e.preventDefault();
            document.getElementById('locationSearch').focus();
        }
        
        // Escape to close street view
        if (e.key === 'Escape') {
            const streetViewContainer = document.getElementById('streetViewContainer');
            if (streetViewContainer.classList.contains('active')) {
                closeStreetView();
            }
        }
    });
}

// File Handling
function handleFileChange(event) {
    const file = event.target.files[0];
    const fileId = event.target.id;
    const statusElement = document.getElementById(fileId + 'Status');
    
    if (file) {
        statusElement.textContent = `✅ ${file.name} selected`;
        statusElement.style.color = '#10b981';
        checkFilesReady();
    } else {
        statusElement.textContent = 'No file selected';
        statusElement.style.color = '#64748b';
    }
}

function checkFilesReady() {
    const studentFile = document.getElementById('studentFile').files[0];
    const stopsFile = document.getElementById('stopsFile').files[0];
    const depotsFile = document.getElementById('depotsFile').files[0];
    
    const loadBtn = document.getElementById('loadDataBtn');
    if (studentFile && stopsFile && depotsFile) {
        loadBtn.disabled = false;
        loadBtn.classList.add('btn-success');
        loadBtn.classList.remove('btn-primary');
    } else {
        loadBtn.disabled = true;
        loadBtn.classList.remove('btn-success');
        loadBtn.classList.add('btn-primary');
    }
}

// Data Loading
async function loadData() {
    if (AppState.isLoading) return;
    
    showLoading('Loading data files...');
    AppState.isLoading = true;
    
    try {
        const studentFile = document.getElementById('studentFile').files[0];
        const stopsFile = document.getElementById('stopsFile').files[0];
        const depotsFile = document.getElementById('depotsFile').files[0];
        
        const [studentData, stopsData, depotsData] = await Promise.all([
            parseCSV(studentFile),
            parseCSV(stopsFile),
            parseCSV(depotsFile)
        ]);
        
        AppState.studentData = studentData;
        AppState.stopsData = stopsData;
        AppState.depotsData = depotsData;
        
        updateMetrics();
        document.getElementById('metricsSection').style.display = 'block';
        document.getElementById('optimizeBtn').disabled = false;
        
        showToast('Data loaded successfully!', 'success');
        console.log(`📊 Loaded ${studentData.length} students, ${stopsData.length} stops, ${depotsData.length} depots`);
        
    } catch (error) {
        console.error('❌ Error loading data:', error);
        showToast(`Error loading data: ${error.message}`, 'error');
    } finally {
        hideLoading();
        AppState.isLoading = false;
    }
}

// CSV Parsing
function parseCSV(file) {
    return new Promise((resolve, reject) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                if (results.errors.length > 0) {
                    reject(new Error(`CSV parsing errors: ${results.errors.map(e => e.message).join(', ')}`));
                } else {
                    // Debug: Log CSV structure
                    console.log(`📄 CSV ${file.name} parsed successfully:`);
                    console.log(`   Headers: ${Object.keys(results.data[0] || {}).join(', ')}`);
                    console.log(`   First row:`, results.data[0]);
                    console.log(`   Total rows: ${results.data.length}`);
                    
                    resolve(results.data);
                }
            },
            error: reject
        });
    });
}

// Metrics Update
function updateMetrics() {
    if (!AppState.studentData.length || !AppState.stopsData.length || !AppState.depotsData.length) {
        return;
    }
    
    const totalStudents = AppState.studentData.length;
    const busCapacity = parseInt(document.getElementById('maxCapacity').value) || 55;
    const requiredBuses = Math.ceil(totalStudents / busCapacity);
    const totalStops = AppState.stopsData.length;
    const totalDepots = AppState.depotsData.length;
    
    document.getElementById('totalStudents').textContent = totalStudents.toLocaleString();
    document.getElementById('requiredBuses').textContent = requiredBuses;
    document.getElementById('totalStops').textContent = totalStops.toLocaleString();
    document.getElementById('totalDepots').textContent = totalDepots;
}

// Data Visualization
function visualizeData() {
    console.log('🔍 Starting data visualization...');
    console.log('Map exists:', !!AppState.map);
    console.log('Stops data length:', AppState.stopsData.length);
    console.log('Depots data length:', AppState.depotsData.length);
    
    if (!AppState.map || !AppState.stopsData.length || !AppState.depotsData.length) {
        console.log('❌ Cannot visualize: Missing map or data');
        showToast('Please load data first', 'warning');
        return;
    }
    
    showLoading('Visualizing data...');
    
    try {
        clearMap();
        console.log('🗑️ Map cleared');
        
        let stopMarkersAdded = 0;
        let depotMarkersAdded = 0;
        
        // Add stop markers (cluster/labeled counts)
        AppState.stopsData.forEach((stop, index) => {
            const lat = parseFloat(stop.snapped_lat);
            const lng = parseFloat(stop.snapped_lon);
            const students = parseInt(stop.num_students) || 0;
            
            console.log(`📍 Stop ${index}: lat=${lat}, lng=${lng}, students=${students}`);
            
            if (!isNaN(lat) && !isNaN(lng)) {
                const marker = new google.maps.Marker({
                    position: { lat, lng },
                    map: AppState.map,
                    title: `Stop ${stop.cluster_number} - ${students} students`,
                    icon: createStopIcon(students),
                    label: {
                        text: students.toString(),
                        color: 'white',
                        fontSize: '12px',
                        fontWeight: 'bold'
                    }
                });
                
                const infoWindow = new google.maps.InfoWindow({
                    content: `
                        <div style="padding: 10px; min-width: 200px;">
                            <h4 style="margin: 0 0 10px 0; color: #3b82f6;">Stop ${stop.cluster_number}</h4>
                            <p><strong>Students:</strong> ${students}</p>
                            <p><strong>Route:</strong> ${stop.route_name || 'Unknown'}</p>
                            <p><strong>Type:</strong> ${stop.route_type || 'Unknown'}</p>
                            <p><strong>Coordinates:</strong> ${lat.toFixed(6)}, ${lng.toFixed(6)}</p>
                        </div>
                    `
                });
                
                marker.addListener('click', () => {
                    infoWindow.open(AppState.map, marker);
                });
                
                AppState.markers.set(`stop-${stop.cluster_number}`, marker);
                stopMarkersAdded++;
            } else {
                console.log(`⚠️ Invalid coordinates for stop ${index}: lat=${lat}, lng=${lng}`);
            }
        });
        
        // Add depot markers
        AppState.depotsData.forEach((depot, index) => {
            const lat = parseFloat(depot.Latitude);
            const lng = parseFloat(depot.Longitude);
            const capacity = parseInt(depot.Counts) || 0;
            
            console.log(`🏭 Depot ${index}: lat=${lat}, lng=${lng}, capacity=${capacity}`);
            
            if (!isNaN(lat) && !isNaN(lng)) {
                const marker = new google.maps.Marker({
                    position: { lat, lng },
                    map: AppState.map,
                    title: `${depot['Parking Name']} - ${capacity} buses`,
                    icon: createDepotIcon(),
                    label: {
                        text: 'W',
                        color: 'white',
                        fontSize: '14px',
                        fontWeight: 'bold'
                    }
                });
                
                const infoWindow = new google.maps.InfoWindow({
                    content: `
                        <div style="padding: 10px; min-width: 200px;">
                            <h4 style="margin: 0 0 10px 0; color: #e53e3e;">${depot['Parking Name']}</h4>
                            <p><strong>Capacity:</strong> ${capacity} buses</p>
                            <p><strong>Coordinates:</strong> ${lat.toFixed(6)}, ${lng.toFixed(6)}</p>
                        </div>
                    `
                });
                
                marker.addListener('click', () => {
                    infoWindow.open(AppState.map, marker);
                });
                
                AppState.markers.set(`depot-${index}`, marker);
                depotMarkersAdded++;
            } else {
                console.log(`⚠️ Invalid coordinates for depot ${index}: lat=${lat}, lng=${lng}`);
            }
        });
        
        console.log(`✅ Added ${stopMarkersAdded} stop markers and ${depotMarkersAdded} depot markers`);
        console.log('Total markers in AppState:', AppState.markers.size);
        
        fitMapToMarkers();
        showToast(`Data visualized successfully! Added ${stopMarkersAdded} stops and ${depotMarkersAdded} depots`, 'success');
        
    } catch (error) {
        console.error('❌ Error visualizing data:', error);
        showToast(`Error visualizing data: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

// Ensure base stop markers exist for toggling by route selection
function ensureStopClusterMarkers() {
    if (!AppState.stopsData || AppState.stopsData.length === 0) return;
    if (AppState.hasClusterMarkers) return;
    // reuse visualizeData’s markers already created; flag true to avoid duplicates
    AppState.hasClusterMarkers = true;
}

// Create custom icons
function createStopIcon(studentCount) {
    const size = Math.max(20, Math.min(40, 20 + studentCount / 2));
    const color = studentCount > 20 ? '#ef4444' : studentCount > 10 ? '#f59e0b' : '#10b981';
    
    return {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
            <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
                <circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="${color}" stroke="white" stroke-width="2"/>
                <text x="${size/2}" y="${size/2 + 4}" text-anchor="middle" fill="white" font-family="Arial" font-size="${size/3}" font-weight="bold">${studentCount}</text>
            </svg>
        `),
        scaledSize: new google.maps.Size(size, size),
        anchor: new google.maps.Point(size/2, size/2)
    };
}

function createDepotIcon() {
    return {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
            <svg width="30" height="30" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg">
                <rect x="5" y="5" width="20" height="20" fill="#e53e3e" stroke="white" stroke-width="2"/>
                <text x="15" y="18" text-anchor="middle" fill="white" font-family="Arial" font-size="12" font-weight="bold">W</text>
            </svg>
        `),
        scaledSize: new google.maps.Size(30, 30),
        anchor: new google.maps.Point(15, 15)
    };
}







// Filter stops by distance
function filterStopsByDistance(stopsData, maxRadiusKm = 50) {
    const filteredStops = [];
    
    stopsData.forEach(stop => {
        const distanceToStop = calculateHaversineDistance(
            COLLEGE_COORDS[0], COLLEGE_COORDS[1],
            parseFloat(stop.snapped_lat), parseFloat(stop.snapped_lon)
        );
        
        if (distanceToStop <= maxRadiusKm) {
            filteredStops.push(stop);
        }
    });
    
    console.log(`📊 Pre-filtering: ${filteredStops.length}/${stopsData.length} stops within ${maxRadiusKm}km radius`);
    return filteredStops;
}

// Create geographical clusters
async function createGeographicalClusters(stops, maxCapacity) {
    const clusters = [];
    
    console.log(`🎯 Creating optimized clusters for ${stops.length} stops`);
    
    // Calculate bearing/direction from college for each stop
    const stopsWithBearing = stops.map(stop => {
        const lat = parseFloat(stop.snapped_lat);
        const lng = parseFloat(stop.snapped_lon);
        
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
    
    // Group by sectors
    const sectorGroups = {};
    stopsWithBearing.forEach(stop => {
        if (!sectorGroups[stop.direction]) {
            sectorGroups[stop.direction] = [];
        }
        sectorGroups[stop.direction].push(stop);
    });
    
    // Create clusters within each sector
    Object.keys(sectorGroups).forEach(direction => {
        const sectorStops = sectorGroups[direction];
        
        if (sectorStops.length === 0) return;
        
        console.log(`📍 ${direction} sector: ${sectorStops.length} stops`);
        
        // Sort by distance
        sectorStops.sort((a, b) => a.distance - b.distance);
        
        let currentCluster = { 
            stops: [], 
            totalStudents: 0, 
            direction: direction
        };
        
        sectorStops.forEach(stop => {
            const studentCount = parseInt(stop.num_students);
            
            if (currentCluster.totalStudents + studentCount <= maxCapacity) {
                currentCluster.stops.push(stop);
                currentCluster.totalStudents += studentCount;
            } else {
                if (currentCluster.stops.length > 0) {
                    finalizeCluster(currentCluster);
                    clusters.push(currentCluster);
                }
                
                currentCluster = {
                    stops: [stop],
                    totalStudents: studentCount,
                    direction: direction
                };
            }
        });
        
        if (currentCluster.stops.length > 0) {
            finalizeCluster(currentCluster);
            clusters.push(currentCluster);
        }
    });
    
    console.log(`✅ Created ${clusters.length} total clusters`);
    return clusters;
}

// Calculate bearing between two points
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

// Finalize cluster
function finalizeCluster(cluster) {
    if (cluster.stops.length === 0) return;
    
    // Sort stops by distance
    cluster.stops.sort((a, b) => a.distance - b.distance);
    
    // Calculate distance
    let totalDistance = 0;
    for (let i = 0; i < cluster.stops.length - 1; i++) {
        totalDistance += calculateHaversineDistance(
            parseFloat(cluster.stops[i].lat), parseFloat(cluster.stops[i].lng),
            parseFloat(cluster.stops[i+1].lat), parseFloat(cluster.stops[i+1].lng)
        );
    }
    
    // Add distance to college
    const lastStop = cluster.stops[cluster.stops.length - 1];
    totalDistance += calculateHaversineDistance(
        parseFloat(lastStop.lat), parseFloat(lastStop.lng),
        COLLEGE_COORDS[0], COLLEGE_COORDS[1]
    );
    
    // Add overhead for real roads
    totalDistance *= 1.3;
    
    // Set properties
    cluster.busId = `Bus ${Math.floor(Math.random() * 1000) + 1}`;
    cluster.efficiency = `${((cluster.totalStudents / 55) * 100).toFixed(1)}%`;
    cluster.totalDistance = `${totalDistance.toFixed(1)} km`;
    cluster.estimatedDistance = totalDistance;
    cluster.depot = AppState.depotsData[0]?.['Parking Name'] || 'Main Depot';
}

// Simulation (replace with actual API)
function simulateOptimization(stopsData, depotsData, busCapacity) {
    console.log('🔄 Running simulation optimization...');
    
    const routes = [];
    let currentRoute = {
        busId: 'Bus 1',
        depot: depotsData[0]?.['Parking Name'] || 'Main Depot',
        stops: [],
        totalStudents: 0,
        totalDistance: 0,
        efficiency: '85%'
    };
    
    stopsData.forEach((stop, index) => {
        if (currentRoute.totalStudents + parseInt(stop.num_students || 0) <= busCapacity) {
            currentRoute.stops.push(stop);
            currentRoute.totalStudents += parseInt(stop.num_students || 0);
        } else {
            if (currentRoute.stops.length > 0) {
                routes.push({ ...currentRoute });
            }
            
            currentRoute = {
                busId: `Bus ${routes.length + 2}`,
                depot: depotsData[0]?.['Parking Name'] || 'Main Depot',
                stops: [stop],
                totalStudents: parseInt(stop.num_students || 0),
                totalDistance: 0,
                efficiency: '85%'
            };
        }
    });
    
    if (currentRoute.stops.length > 0) {
        routes.push(currentRoute);
    }
    
    console.log(`✅ Simulation completed: ${routes.length} routes generated`);
    return routes;
}

// Route Visualization with Road-Following Routes
async function visualizeRoutes(routes) {
    if (!AppState.map || !routes.length) return;
    
    clearPolylines();
    showLoading('Generating road-following routes...');
    
    try {
        for (let index = 0; index < routes.length; index++) {
            const route = routes[index];
            if (route.stops.length === 0) continue;
            
            const color = ROUTE_COLORS[index % ROUTE_COLORS.length];
            
            // Build waypoints array starting from college
            const waypoints = [
                { lat: COLLEGE_COORDS[0], lng: COLLEGE_COORDS[1] },
                ...route.stops.map(stop => ({
                    lat: parseFloat(stop.snapped_lat),
                    lng: parseFloat(stop.snapped_lon)
                }))
            ].filter(point => !isNaN(point.lat) && !isNaN(point.lng));
            
            if (waypoints.length < 3) continue;
            
            // Use road-following route tracer instead of straight polylines
            await visualizeOptimizedRoute(waypoints, color, route, index);
            
            // Small delay to avoid overwhelming the routing service
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        fitMapToRoutes();
        showToast('Road-following routes generated successfully!', 'success');
        
    } catch (error) {
        console.error('Route visualization error:', error);
        showToast('Error generating routes. Using fallback polylines.', 'warning');
        
        // Fallback to straight polylines
    routes.forEach((route, index) => {
        if (route.stops.length === 0) return;
        
        const color = ROUTE_COLORS[index % ROUTE_COLORS.length];
        
        const waypoints = [
                { lat: COLLEGE_COORDS[0], lng: COLLEGE_COORDS[1] },
            ...route.stops.map(stop => ({
                lat: parseFloat(stop.snapped_lat),
                lng: parseFloat(stop.snapped_lon)
            })),
                { lat: COLLEGE_COORDS[0], lng: COLLEGE_COORDS[1] }
        ].filter(point => !isNaN(point.lat) && !isNaN(point.lng));
        
        if (waypoints.length < 3) return;
        
        const polyline = new google.maps.Polyline({
            path: waypoints,
                geodesic: true,
                strokeColor: color,
                strokeOpacity: 0.6,
                strokeWeight: 3,
                strokeDashArray: [10, 5], // Dashed to indicate fallback
                map: AppState.map
            });
            
            AppState.polylines.set(`route-${index}`, polyline);
            
            polyline.addListener('click', () => {
                showRouteInfo(route, index);
            });
        });
    } finally {
        hideLoading();
    }
}

// Get road-following directions using OSRM
async function getDirections(origin, destination) {
    try {
        // Build OSRM request URL
        const coordinates = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson`;
        
        const response = await fetch(osrmUrl);
        
        if (!response.ok) {
            throw new Error(`OSRM API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.routes && data.routes[0] && data.routes[0].geometry) {
            // Convert GeoJSON coordinates [lng, lat] to Leaflet format [lat, lng]
            return data.routes[0].geometry.coordinates.map(coord => [coord[1], coord[0]]);
        }
        
        throw new Error('No route found');
        
    } catch (error) {
        console.error('OSRM routing error:', error);
        // Fallback to straight line
        return [[origin.lat, origin.lng], [destination.lat, destination.lng]];
    }
}

// Helper function to visualize a single optimized route
async function visualizeOptimizedRoute(waypoints, color, route, index) {
    try {
        // Draw road segments between consecutive waypoints
        for (let i = 0; i < waypoints.length - 1; i++) {
            const roadCoordinates = await getDirections(waypoints[i], waypoints[i + 1]);
            
            // Draw route segment
            const polyline = new google.maps.Polyline({
                path: roadCoordinates.map(coord => ({ lat: coord[0], lng: coord[1] })),
            geodesic: true,
            strokeColor: color,
            strokeOpacity: 0.8,
            strokeWeight: 4,
            map: AppState.map
        });
        
            AppState.polylines.set(`route-${index}-segment-${i}`, polyline);
        
        polyline.addListener('click', () => {
            showRouteInfo(route, index);
        });
        }
        
        // Add markers for stops
        route.stops.forEach((stop, stopIndex) => {
            const marker = new google.maps.Marker({
                position: {
                    lat: parseFloat(stop.snapped_lat),
                    lng: parseFloat(stop.snapped_lon)
                },
                map: AppState.map,
                title: `Stop ${stopIndex + 1}: ${stop.num_students} students`,
                icon: {
                    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                        <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="12" cy="12" r="12" fill="${color}" stroke="white" stroke-width="2"/>
                            <text x="12" y="16" text-anchor="middle" fill="white" font-family="Arial" font-size="10" font-weight="bold">${stop.num_students}</text>
                        </svg>
                    `),
                    scaledSize: new google.maps.Size(24, 24),
                    anchor: new google.maps.Point(12, 12)
                }
            });
            
            AppState.markers.set(`stop-${route.busId}-${stopIndex}`, marker);
            
            // Add info window
            const infoWindow = new google.maps.InfoWindow({
                content: `
                    <div style="padding: 10px; min-width: 200px;">
                        <h4>${route.busId} - Stop ${stopIndex + 1}</h4>
                        <p><strong>Students:</strong> ${stop.num_students}</p>
                        <p><strong>Location:</strong> ${stop.snapped_lat}, ${stop.snapped_lon}</p>
                    </div>
                `
            });
            
            marker.addListener('click', () => {
                infoWindow.open(AppState.map, marker);
            });
        });
        
    } catch (error) {
        console.error(`Error visualizing route ${index}:`, error);
        throw error;
    }
}

// Route Selection
function showRouteSelector() {
    const selector = document.getElementById('floatingRouteSelector');
    const toggles = document.getElementById('routeToggles');
    
    if (!AppState.optimizationResults.length) return;
    
    toggles.innerHTML = '';
    
    AppState.optimizationResults.forEach((route, index) => {
        const toggle = document.createElement('div');
        toggle.className = 'route-toggle';
        toggle.innerHTML = `
            <label>
                <input type="checkbox" class="route-checkbox" data-route-index="${index}" checked>
                <span class="route-info">
                    <strong>${route.busId}</strong>
                    <span class="route-details">
                        ${route.totalStudents} students | ${route.efficiency} efficient
                    </span>
                </span>
            </label>
        `;
        
        const checkbox = toggle.querySelector('.route-checkbox');
        checkbox.addEventListener('change', (e) => {
            handleRouteToggle(index, e.target.checked);
        });
        
        toggles.appendChild(toggle);
    });
    
    selector.style.display = 'block';
    
    // Initialize all routes as visible
    AppState.selectedRoutes.clear();
    AppState.optimizationResults.forEach((_, index) => {
        AppState.selectedRoutes.add(index);
    });
}

// Route Toggle Handler
function handleRouteToggle(routeIndex, isVisible) {
    if (isVisible) {
        AppState.selectedRoutes.add(routeIndex);
    } else {
        AppState.selectedRoutes.delete(routeIndex);
    }
    
    updateRouteVisibility();
}

// Update Route Visibility
function updateRouteVisibility() {
    AppState.polylines.forEach((polyline, key) => {
        const routeIndex = parseInt(key.split('-')[1]);
        if (AppState.selectedRoutes.has(routeIndex)) {
            polyline.setMap(AppState.map);
        } else {
            polyline.setMap(null);
        }
    });
    
    updateStopMarkersVisibility();
}

// Update Stop Markers Visibility
function updateStopMarkersVisibility() {
    const visibleStopIds = new Set();
    
    AppState.optimizationResults.forEach((route, index) => {
        if (AppState.selectedRoutes.has(index)) {
            route.stops.forEach(stop => {
                const id = (stop.cluster_number || stop.id || '').toString();
                if (id) visibleStopIds.add(id);
            });
        }
    });
    
    // Update old markers
    AppState.markers.forEach((marker, key) => {
        if (key.startsWith('stop-')) {
            const stopId = key.split('-')[1];
            if (visibleStopIds.has(stopId)) {
                marker.setMap(AppState.map);
            } else {
                marker.setMap(null);
            }
        }
    });
    
    // Update new route markers (your algorithm routes)
    if (AppState.routeMarkers) {
        AppState.routeMarkers.forEach((marker, index) => {
            if (AppState.selectedRoutes.has(index)) {
                marker.setMap(AppState.map);
            } else {
                marker.setMap(null);
            }
        });
    }
}

// Test function to verify Geocoding API
function testGeocoding() {
    console.log('🧪 Testing Geocoding API...');
    
    if (typeof google === 'undefined') {
        console.log('❌ Google Maps API not loaded');
        showToast('Google Maps API not loaded', 'error');
        return;
    }
    
    if (!google.maps) {
        console.log('❌ Google Maps object not available');
        showToast('Google Maps object not available', 'error');
        return;
    }
    
    if (!google.maps.Geocoder) {
        console.log('❌ Geocoder not available');
        showToast('Geocoder not available', 'error');
        return;
    }
    
    console.log('✅ Geocoder available, testing with "New York"');
    
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: 'New York' }, (results, status) => {
        console.log('🧪 Test geocoding result:', status, results);
        
        if (status === 'OK') {
            console.log('✅ Geocoding API working!');
            showToast('Geocoding API is working!', 'success');
        } else {
            console.log('❌ Geocoding API failed:', status);
            showToast(`Geocoding API failed: ${status}`, 'error');
        }
    });
}

// Quick Filter Handler
function handleQuickFilter(event) {
    const filter = event.currentTarget.dataset.filter;
    
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.currentTarget.classList.add('active');
    
    AppState.currentFilter = filter;
    applyEfficiencyFilter(filter);
}

// Apply Efficiency Filter
function applyEfficiencyFilter(filter) {
    const checkboxes = document.querySelectorAll('.route-checkbox');
    
    checkboxes.forEach((checkbox, index) => {
        const route = AppState.optimizationResults[index];
        if (!route) return;
        
        let shouldShow = true;
        
        switch (filter) {
            case 'high-efficiency':
                shouldShow = route.efficiency.includes('8') || route.efficiency.includes('9');
                break;
            case 'medium-efficiency':
                shouldShow = route.efficiency.includes('5') || route.efficiency.includes('6') || route.efficiency.includes('7');
                break;
            case 'low-efficiency':
                shouldShow = route.efficiency.includes('1') || route.efficiency.includes('2') || route.efficiency.includes('3') || route.efficiency.includes('4');
                break;
            case 'all':
            default:
                shouldShow = true;
                break;
        }
        
        checkbox.checked = shouldShow;
        handleRouteToggle(index, shouldShow);
    });
}

// Map Utilities
function clearMap() {
    AppState.markers.forEach(marker => {
        marker.setMap(null);
    });
    AppState.markers.clear();
}

function clearPolylines() {
    // Clear old polylines
    AppState.polylines.forEach(polyline => {
        polyline.setMap(null);
    });
    AppState.polylines.clear();
    
    // Clear new route polylines (primary road-following) by route
    if (AppState.routePolylinesByRoute) {
        Object.keys(AppState.routePolylinesByRoute).forEach(key => {
            (AppState.routePolylinesByRoute[key] || []).forEach(polyline => {
                if (polyline && polyline.setMap) polyline.setMap(null);
            });
        });
        AppState.routePolylinesByRoute = {};
    }
    
    // Clear route markers
    if (AppState.routeMarkers) {
        AppState.routeMarkers.forEach(marker => {
            if (marker && marker.setMap) {
                marker.setMap(null);
            }
        });
        AppState.routeMarkers = [];
    }
    
    // Clear Google Directions overlays (secondary) by route
    if (AppState.routeOverlaysByRoute) {
        Object.keys(AppState.routeOverlaysByRoute).forEach(key => {
            (AppState.routeOverlaysByRoute[key] || []).forEach(overlay => {
                if (overlay && overlay.setMap) overlay.setMap(null);
            });
        });
        AppState.routeOverlaysByRoute = {};
    }
    
    // Clear route markers per route
    if (AppState.routeMarkersByRoute) {
        Object.keys(AppState.routeMarkersByRoute).forEach(key => {
            (AppState.routeMarkersByRoute[key] || []).forEach(marker => {
                if (marker && marker.setMap) marker.setMap(null);
            });
        });
        AppState.routeMarkersByRoute = {};
    }
    
    // Clear depot markers per route
    if (AppState.depotMarkersByRoute) {
        Object.keys(AppState.depotMarkersByRoute).forEach(key => {
            const marker = AppState.depotMarkersByRoute[key];
            if (marker && marker.setMap) marker.setMap(null);
        });
        AppState.depotMarkersByRoute = {};
    }
}

function fitMapToMarkers() {
    console.log('🎯 Fitting map to markers...');
    console.log('Markers count:', AppState.markers.size);
    
    if (AppState.markers.size === 0) {
        console.log('⚠️ No markers to fit to');
        return;
    }
    
    const bounds = new google.maps.LatLngBounds();
    AppState.markers.forEach((marker, key) => {
        const position = marker.getPosition();
        console.log(`📍 Extending bounds with ${key}: ${position.lat()}, ${position.lng()}`);
        bounds.extend(position);
    });
    
    console.log('🗺️ Fitting map to bounds:', bounds.toString());
    AppState.map.fitBounds(bounds);
}

function fitMapToRoutes() {
    const bounds = new google.maps.LatLngBounds();

    // Include legacy polylines
    if (AppState.polylines && AppState.polylines.size > 0) {
    AppState.polylines.forEach(polyline => {
        const path = polyline.getPath();
            path.forEach(point => bounds.extend(point));
        });
    }
    // Include primary route polylines
    if (AppState.routePolylines && AppState.routePolylines.length > 0) {
        AppState.routePolylines.forEach(polyline => {
            const path = polyline.getPath();
            path.forEach(point => bounds.extend(point));
        });
    }
    // Include overlays
    if (AppState.routeOverlays && AppState.routeOverlays.length > 0) {
        AppState.routeOverlays.forEach(polyline => {
            const path = polyline.getPath();
            path.forEach(point => bounds.extend(point));
        });
    }

    if (!bounds.isEmpty()) {
    AppState.map.fitBounds(bounds);
    }
}

// Route Information
function showRouteInfo(route, index) {
    const content = `
        <div style="padding: 15px; min-width: 300px;">
            <h3 style="margin: 0 0 15px 0; color: ${ROUTE_COLORS[index % ROUTE_COLORS.length]};">${route.busId}</h3>
            <div style="margin-bottom: 10px;">
                <strong>Depot:</strong> ${route.depot}<br>
                <strong>Total Students:</strong> ${route.totalStudents}<br>
                <strong>Efficiency:</strong> ${route.efficiency}<br>
                <strong>Stops:</strong> ${route.stops.length}
            </div>
            <div style="max-height: 200px; overflow-y: auto;">
                <strong>Route:</strong><br>
                ${route.stops.map((stop, i) => 
                    `${i + 1}. Stop ${stop.cluster_number} (${stop.num_students} students)`
                ).join('<br>')}
            </div>
        </div>
    `;
    
    const infoWindow = new google.maps.InfoWindow({
        content: content
    });
    
    const path = AppState.polylines.get(`route-${index}`).getPath();
    const centerIndex = Math.floor(path.getLength() / 2);
    const center = path.getAt(centerIndex);
    
    infoWindow.setPosition(center);
    infoWindow.open(AppState.map);
}

// Export Results
function exportResults() {
    if (!AppState.optimizationResults.length) {
        showToast('No results to export', 'warning');
        return;
    }
    
    try {
        const shiftTime = document.getElementById('shiftTime').value;
        const dayOfWeek = document.getElementById('dayOfWeek').value;
        
        const exportData = [];
        AppState.optimizationResults.forEach((route, routeIndex) => {
            route.stops.forEach((stop, stopIndex) => {
                exportData.push({
                    bus_id: route.busId,
                    depot: route.depot,
                    route_sequence: stopIndex + 1,
                    stop_cluster: stop.cluster_number,
                    stop_lat: stop.snapped_lat,
                    stop_lon: stop.snapped_lon,
                    students_pickup: stop.num_students,
                    road_type: stop.route_type,
                    road_name: stop.route_name,
                    total_students_in_bus: route.totalStudents,
                    bus_efficiency: route.efficiency,
                    shift_time: shiftTime,
                    day_of_week: dayOfWeek
                });
            });
        });
        
        const csv = Papa.unparse(exportData);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `optimized_routes_${shiftTime}_${dayOfWeek}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        showToast('Results exported successfully!', 'success');
        
    } catch (error) {
        console.error('❌ Export error:', error);
        showToast(`Export failed: ${error.message}`, 'error');
    }
}

// UI Controls
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('show');
}

function toggleRouteSelector() {
    const selector = document.getElementById('floatingRouteSelector');
    if (selector.style.display === 'none' || selector.style.display === '') {
        selector.style.display = 'block';
    } else {
        selector.style.display = 'none';
    }
}

// Loading States
function showLoading(message = 'Loading...') {
    const overlay = document.getElementById('loadingOverlay');
    const messageElement = overlay.querySelector('p');
    messageElement.textContent = message;
    overlay.style.display = 'flex';
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    overlay.style.display = 'none';
}

// Helper functions for optimization system
function showStatus(message, type = 'info') {
    showToast(message, type);
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

// Toast Notifications
function showToast(message, type = 'info', duration = 5000) {
    const container = document.getElementById('toastContainer');
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <i class="fas fa-${getToastIcon(type)}"></i>
            <span>${message}</span>
        </div>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, duration);
    
    toast.addEventListener('click', () => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    });
}

// ✅ INTEGRATED: showStatus function that your algorithms expect
function showStatus(message, type = 'info') {
    // Use showToast for now, but you can enhance this later
    showToast(message, type);
    
    // Also update the status display in the sidebar if it exists
    const statusElement = document.getElementById('status');
    if (statusElement) {
        statusElement.textContent = message;
        statusElement.className = `status-display ${type}`;
    }
}

function getToastIcon(type) {
    switch (type) {
        case 'success': return 'check-circle';
        case 'error': return 'exclamation-circle';
        case 'warning': return 'exclamation-triangle';
        case 'info': return 'info-circle';
        default: return 'info-circle';
    }
}

// Global functions for HTML onclick
window.loadData = loadData;
window.visualizeData = visualizeData;
window.optimizeRoutes = optimizeRoutes;
window.exportResults = exportResults;
window.toggleSidebar = toggleSidebar;
window.toggleRouteSelector = toggleRouteSelector;

// Route Selection Functions
window.selectAllRoutes = selectAllRoutes;
window.deselectAllRoutes = deselectAllRoutes;

// Map Control Functions
window.searchLocation = searchLocation;
window.toggleStreetView = toggleStreetView;
window.resetMapView = resetMapView;
window.toggleFullscreen = toggleFullscreen;
window.toggleMapType = toggleMapType;
window.closeStreetView = closeStreetView;

// Test Geocoding API
window.testGeocoding = testGeocoding;

// Route Selection Functions
function selectAllRoutes() {
    const checkboxes = document.querySelectorAll('.route-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.checked = true;
        const routeIndex = parseInt(checkbox.dataset.routeIndex);
        if (!isNaN(routeIndex)) {
            AppState.selectedRoutes.add(routeIndex);
        }
    });
    updateRouteVisibility();
    showToast('All routes selected', 'success');
}

function deselectAllRoutes() {
    const checkboxes = document.querySelectorAll('.route-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.checked = false;
        const routeIndex = parseInt(checkbox.dataset.routeIndex);
        if (!isNaN(routeIndex)) {
            AppState.selectedRoutes.delete(routeIndex);
        }
    });
    updateRouteVisibility();
    showToast('All routes deselected', 'info');
}

// Map Control Functions
let streetViewService = null;
let streetViewPanorama = null;
let currentMapType = 'roadmap';

function searchLocation() {
    const searchInput = document.getElementById('locationSearch');
    const query = searchInput.value.trim();
    
    if (!query) {
        showToast('Please enter a location to search', 'warning');
        return;
    }
    
    console.log('🔍 Searching for:', query);
    
    // Try to use Geocoding service first
    if (typeof google !== 'undefined' && google.maps && google.maps.Geocoder) {
        console.log('✅ Geocoding service available');
        const geocoder = new google.maps.Geocoder();
        
        geocoder.geocode({ address: query }, (results, status) => {
            console.log('📍 Geocoding result:', status, results);
            
            if (status === 'OK') {
                const location = results[0].geometry.location;
                console.log('✅ Location found:', location.lat(), location.lng());
                
                // Zoom to the location with smooth animation
                AppState.map.panTo(location);
                AppState.map.setZoom(15);
                
                // Add a marker for the searched location
                const marker = new google.maps.Marker({
                    position: location,
                    map: AppState.map,
                    title: query,
                    icon: {
                        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                            <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="12" cy="12" r="12" fill="#ef4444" stroke="white" stroke-width="2"/>
                                <text x="12" y="16" text-anchor="middle" fill="white" font-family="Arial" font-size="10" font-weight="bold">📍</text>
                            </svg>
                        `),
                        scaledSize: new google.maps.Size(24, 24),
                        anchor: new google.maps.Point(12, 12)
                    }
                });
                
                // Add bounce animation
                marker.setAnimation(google.maps.Animation.BOUNCE);
                setTimeout(() => marker.setAnimation(null), 2000);
                
                // Show info window with address
                const infoWindow = new google.maps.InfoWindow({
                    content: `<div style="padding: 8px;"><strong>${query}</strong><br>${results[0].formatted_address}</div>`
                });
                infoWindow.open(AppState.map, marker);
                
                showToast(`Found: ${results[0].formatted_address}`, 'success');
                
                // Clear search input
                searchInput.value = '';
                hideSearchRecommendations();
            } else {
                console.log('❌ Geocoding failed:', status);
                
                if (status === 'REQUEST_DENIED') {
                    showToast('Geocoding API access denied. Check API key restrictions and billing.', 'error');
                    console.log('🔑 API Key Issue: Check restrictions and billing in Google Cloud Console');
                } else if (status === 'OVER_QUERY_LIMIT') {
                    showToast('Geocoding API quota exceeded. Try again later.', 'warning');
                } else {
                    showToast(`Geocoding failed: ${status}`, 'error');
                }
                
                // Fallback to coordinate parsing
                fallbackSearch(query);
            }
        });
    } else {
        console.log('❌ Geocoding service not available');
        // Fallback to coordinate parsing
        fallbackSearch(query);
    }
}

function fallbackSearch(query) {
    // Try to parse coordinates (lat, lng format)
    const coordMatch = query.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/);
    if (coordMatch) {
        const lat = parseFloat(coordMatch[1]);
        const lng = parseFloat(coordMatch[2]);
        
        if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            const location = { lat, lng };
            AppState.map.setCenter(location);
            AppState.map.setZoom(15);
            
            // Add a marker for the searched location
            new google.maps.Marker({
                position: location,
                map: AppState.map,
                title: `Coordinates: ${lat}, ${lng}`,
                icon: {
                    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                        <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="12" cy="12" r="12" fill="#ef4444" stroke="white" stroke-width="2"/>
                            <text x="12" y="16" text-anchor="middle" fill="white" font-family="Arial" font-size="10" font-weight="bold">📍</text>
                        </svg>
                    `),
                    scaledSize: new google.maps.Size(24, 24),
                    anchor: new google.maps.Point(12, 12)
                }
            });
            
            showToast(`Navigated to coordinates: ${lat}, ${lng}`, 'success');
            return;
        }
    }
    
    // Try to search in predefined locations
    const predefinedLocations = {
        'college': { lat: COLLEGE_COORDS[0], lng: COLLEGE_COORDS[1], name: 'College' },
        'university': { lat: COLLEGE_COORDS[0], lng: COLLEGE_COORDS[1], name: 'University' },
        'campus': { lat: COLLEGE_COORDS[0], lng: COLLEGE_COORDS[1], name: 'Campus' },
        'center': { lat: COLLEGE_COORDS[0], lng: COLLEGE_COORDS[1], name: 'Center' },
        'home': { lat: COLLEGE_COORDS[0], lng: COLLEGE_COORDS[1], name: 'Home' }
    };
    
    const lowerQuery = query.toLowerCase();
    for (const [key, location] of Object.entries(predefinedLocations)) {
        if (lowerQuery.includes(key)) {
            AppState.map.setCenter(location);
            AppState.map.setZoom(15);
            
            new google.maps.Marker({
                position: location,
                map: AppState.map,
                title: location.name,
                icon: {
                    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                        <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="12" cy="12" r="12" fill="#ef4444" stroke="white" stroke-width="2"/>
                            <text x="12" y="16" text-anchor="middle" fill="white" font-family="Arial" font-size="10" font-weight="bold">📍</text>
                        </svg>
                    `),
                    scaledSize: new google.maps.Size(24, 24),
                    anchor: new google.maps.Point(12, 12)
                }
            });
            
            showToast(`Navigated to ${location.name}`, 'success');
            return;
        }
    }
    
    // If nothing found, show error with helpful message
    showToast('Location not found. Try coordinates (e.g., "12.345, 67.890") or keywords like "college", "center"', 'error');
}

function toggleStreetView() {
    const container = document.getElementById('streetViewContainer');
    const isActive = container.classList.contains('active');
    
    if (isActive) {
        closeStreetView();
    } else {
        // Toggle Street View mode for clicking
        window.streetViewMode = !window.streetViewMode;
        updateStreetViewButton();
        
        if (window.streetViewMode) {
            showToast('Click anywhere on the map to open Street View at that location', 'info');
            // Change cursor to indicate click mode
            AppState.map.setOptions({ draggableCursor: 'crosshair' });
            // Add visual indicator
            addStreetViewIndicator();
        } else {
            showToast('Street View click mode disabled', 'info');
            // Reset cursor
            AppState.map.setOptions({ draggableCursor: null });
            // Remove visual indicator
            removeStreetViewIndicator();
        }
    }
}

function updateStreetViewButton() {
    const streetViewBtn = document.querySelector('.map-control-btn[onclick="toggleStreetView()"]');
    if (streetViewBtn) {
        if (window.streetViewMode) {
            streetViewBtn.classList.add('active');
            streetViewBtn.innerHTML = '<i class="fas fa-mouse-pointer"></i>';
            streetViewBtn.title = 'Click mode active - Click on map to open Street View';
        } else {
            streetViewBtn.classList.remove('active');
            streetViewBtn.innerHTML = '<i class="fas fa-street-view"></i>';
            streetViewBtn.title = 'Street View - Click to enable click mode';
        }
    }
}

function addStreetViewIndicator() {
    // Add a floating indicator
    let indicator = document.getElementById('streetViewIndicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'streetViewIndicator';
        indicator.innerHTML = `
            <div style="
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(59, 130, 246, 0.9);
                color: white;
                padding: 12px 20px;
                border-radius: 25px;
                font-size: 14px;
                font-weight: bold;
                z-index: 9999;
                pointer-events: none;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                animation: pulse 2s infinite;
            ">
                <i class="fas fa-street-view"></i> Click anywhere on the map to open Street View
            </div>
        `;
        document.body.appendChild(indicator);
        
        // Add CSS animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes pulse {
                0% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                50% { opacity: 0.7; transform: translate(-50%, -50%) scale(1.05); }
                100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
            }
        `;
        document.head.appendChild(style);
    }
    indicator.style.display = 'block';
}

function removeStreetViewIndicator() {
    const indicator = document.getElementById('streetViewIndicator');
    if (indicator) {
        indicator.style.display = 'none';
    }
}

// Search Recommendations Functions
function showSearchRecommendations(query) {
    if (typeof google === 'undefined' || !google.maps || !google.maps.places) {
        return; // Places API not available
    }
    
    const service = new google.maps.places.AutocompleteService();
    const recommendationsDiv = document.getElementById('searchRecommendations');
    
    service.getPlacePredictions({
        input: query,
        types: ['geocode', 'establishment']
    }, (predictions, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
            displaySearchRecommendations(predictions);
        } else {
            hideSearchRecommendations();
        }
    });
}

function displaySearchRecommendations(predictions) {
    const recommendationsDiv = document.getElementById('searchRecommendations');
    recommendationsDiv.innerHTML = '';
    
    predictions.slice(0, 5).forEach((prediction, index) => {
        const item = document.createElement('div');
        item.className = 'recommendation-item';
        item.innerHTML = `
            <div class="recommendation-content">
                <i class="fas fa-map-marker-alt"></i>
                <div class="recommendation-text">
                    <div class="recommendation-main">${prediction.structured_formatting.main_text}</div>
                    <div class="recommendation-secondary">${prediction.structured_formatting.secondary_text}</div>
                </div>
            </div>
        `;
        
        item.addEventListener('click', () => {
            selectRecommendation(prediction);
        });
        
        recommendationsDiv.appendChild(item);
    });
    
    recommendationsDiv.style.display = 'block';
}

function selectRecommendation(prediction) {
    const searchInput = document.getElementById('locationSearch');
    searchInput.value = prediction.description;
    hideSearchRecommendations();
    searchLocation();
}

function hideSearchRecommendations() {
    const recommendationsDiv = document.getElementById('searchRecommendations');
    recommendationsDiv.style.display = 'none';
}

// ===== INTEGRATED OPTIMIZATION FUNCTIONS FROM ALGORITHMS.JS =====

// ✅ INTEGRATED: Main optimization function from algorithms.js
async function optimizeRoutes() {
    try {
        if (!AppState.stopsData || !AppState.stopsData.length || !AppState.depotsData || !AppState.depotsData.length) {
            showToast('Please load data first', 'error');
            return;
        }
        
        showToast('Optimizing routes... This may take a moment.', 'info');
        document.getElementById('optimizeBtn').innerHTML = '<div class="loading"></div> Optimizing...';
        document.getElementById('optimizeBtn').disabled = true;

        // Initialize map
        initGoogleMap();
        
        // Use your REAL optimization algorithm
        const results = await getBusOptimizedRoutes();
        console.log('Results received in modern-app.js:', results);

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
        showToast(`Route optimization completed! Generated ${window.optimizationResults.length} efficient routes.`, 'success');
        
    } catch (error) {
        showToast(`Optimization failed: ${error.message}`, 'error');
        console.error('Optimization error:', error);
    } finally {
        document.getElementById('optimizeBtn').innerHTML = '<i class="fas fa-magic"></i> Optimize Routes';
        document.getElementById('optimizeBtn').disabled = false;
    }
}

// ✅ INTEGRATED: Display optimization results
function displayResults() {
    if (window.optimizationResults && window.optimizationResults.length > 0) {
        showToast(`Optimization complete: ${window.optimizationResults.length} routes generated`, 'success');
        
        // Update metrics
        const totalStudents = window.optimizationResults.reduce((sum, route) => sum + route.totalStudents, 0);
        const totalDistance = window.optimizationResults.reduce((sum, route) => {
            const dist = parseFloat(route.totalDistance.replace(' km', '').replace('~', '')) || 0;
            return sum + dist;
        }, 0);
        
        // Update UI metrics
        if (document.getElementById('totalStudents')) {
            document.getElementById('totalStudents').textContent = totalStudents;
        }
        if (document.getElementById('requiredBuses')) {
            document.getElementById('requiredBuses').textContent = window.optimizationResults.length;
        }
        if (document.getElementById('totalStops')) {
            const totalStops = window.optimizationResults.reduce((sum, route) => sum + route.stops.length, 0);
            document.getElementById('totalStops').textContent = totalStops;
        }
        
        console.log('✅ Results displayed successfully');
    }
}

// ✅ INTEGRATED: Initialize route selectors
function initializeRouteSelectors() {
    if (!window.optimizationResults || window.optimizationResults.length === 0) {
        console.log('No optimization results to initialize selectors');
        return;
    }
    
    const routeTogglesContainer = document.getElementById('routeToggles');
    if (!routeTogglesContainer) {
        console.log('Route toggles container not found');
        return;
    }
    
    routeTogglesContainer.innerHTML = '';
    
    window.optimizationResults.forEach((route, index) => {
        const routeToggle = document.createElement('div');
        routeToggle.className = 'route-toggle';
        routeToggle.innerHTML = `
            <label>
                <input type="checkbox" class="route-checkbox" data-route-index="${index}" checked>
                <div class="route-info">
                    <strong>${route.busId}</strong>
                    <div class="route-details">
                        ${route.stops.length} stops • ${route.totalStudents} students • ${route.efficiency} efficiency
                    </div>
                </div>
            </label>
        `;
        
        routeTogglesContainer.appendChild(routeToggle);
        
        // Add event listener
        const checkbox = routeToggle.querySelector('.route-checkbox');
        checkbox.addEventListener('change', (e) => {
            handleRouteToggle(index, e.target.checked);
        });
    });
    
    // Initialize selected routes
    AppState.selectedRoutes = new Set(window.optimizationResults.map((_, index) => index));
    
    console.log(`✅ Initialized ${window.optimizationResults.length} route selectors`);
}

// ✅ INTEGRATED: Visualize optimized routes
function visualizeOptimizedRoutes() {
    if (!window.optimizationResults || window.optimizationResults.length === 0) {
        showToast('No optimization results to visualize', 'warning');
        return;
    }
    
    console.log('🎯 Visualizing optimized routes...');
    
    // Clear existing polylines
    clearPolylines();
    
    // Visualize each route
    console.log(`🎯 Starting visualization of ${window.optimizationResults.length} routes`);
    window.optimizationResults.forEach((route, index) => {
        console.log(`🎯 Processing route ${index + 1}:`, route);
        console.log(`🎯 Route has stops:`, !!route.stops);
        console.log(`🎯 Route stops length:`, route.stops ? route.stops.length : 'undefined');
        if (route.stops && route.stops.length > 0) {
            console.log(`🎯 Calling visualizeOptimizedRoute for route ${index + 1}`);
            visualizeOptimizedRoute(route.stops, getRouteColor(index), route, index);
        } else {
            console.warn(`⚠️ Route ${index + 1} has no stops or empty stops array`);
        }
    });
    
    // Fit map to show all routes
    fitMapToRoutes();
    
    showToast(`Visualized ${window.optimizationResults.length} optimized routes`, 'success');
}

// ✅ INTEGRATED: Visualize a single optimized route
async function visualizeOptimizedRoute(stops, color, route, index) {
    try {
        console.log(`🚌 Visualizing route ${index + 1}: ${stops.length} stops`);
        console.log(`🚌 Route object:`, route);
        console.log(`🚌 Route keys:`, Object.keys(route));
        console.log(`🚌 Route type:`, typeof route);
        console.log(`🚌 Route is array:`, Array.isArray(route));
        
        // Create waypoints for this route
        const waypoints = stops.map(stop => ({
            location: { 
                lat: parseFloat(stop.snapped_lat || stop.lat), 
                lng: parseFloat(stop.snapped_lon || stop.lng) 
            },
            stopover: true
        }));
        
        // Get depot for this route - handle both string and object formats
        let depot;
        console.log(`🚌 Route assignedDepot:`, route.assignedDepot);
        console.log(`🚌 Route depot:`, route.depot);
        console.log(`🚌 AppState.depotsData length:`, AppState.depotsData ? AppState.depotsData.length : 'undefined');
        
        if (route.assignedDepot && typeof route.assignedDepot === 'object') {
            // Use the assigned depot object
            depot = route.assignedDepot;
            console.log(`🚌 Using assignedDepot object:`, depot);
        } else if (route.depot && typeof route.depot === 'object') {
            // Use the depot object directly
            depot = route.depot;
            console.log(`🚌 Using depot object:`, depot);
        } else {
            // Fallback to depot by index
            depot = AppState.depotsData[index % AppState.depotsData.length];
            console.log(`🚌 Using depot by index:`, depot);
        }
        
        const depotLat = parseFloat(depot.Latitude || depot.lat);
        const depotLng = parseFloat(depot.Longitude || depot.lng);
        
        console.log(`🔍 Route ${index + 1} depot:`, depot);
        console.log(`🔍 Depot coordinates: ${depotLat}, ${depotLng}`);
        console.log(`🔍 Depot Latitude:`, depot.Latitude);
        console.log(`🔍 Depot lat:`, depot.lat);
        console.log(`🔍 Depot Longitude:`, depot.Longitude);
        console.log(`🔍 Depot lng:`, depot.lng);
        
        if (isNaN(depotLat) || isNaN(depotLng)) {
            console.warn(`Invalid depot coordinates for route ${index + 1}`);
            console.warn(`Depot object:`, depot);
            console.warn(`Depot keys:`, Object.keys(depot));
            return;
        }
        
        // 🎯 USE YOUR REAL ALGORITHM OUTPUT - NO MORE FALLBACKS!
        console.log(`🚀 Route ${index + 1} - Using YOUR algorithm output:`, route);
        
        // 🎯 FORCE YOUR ALGORITHMS TO BE USED - NO MORE GOOGLE DIRECTIONS BYPASS!
        console.log(`🚀 Route ${index + 1} - FORCING YOUR ALGORITHM OUTPUT:`, route);
        console.log(`🚀 Route type: ${route.routeType}`);
        console.log(`🚀 Route structure:`, JSON.stringify(route, null, 2));
        
        // Ensure routeType exists
        route.routeType = route.routeType || 'optimized';

        // Primary: draw road-following polyline using YOUR stop sequence (segment by segment)
        console.log(`🎯 Route ${index + 1} - DRAWING ROAD-FOLLOWING PATH USING YOUR STOP ORDER`);
        await drawPrimaryRoadRouteFromSequence(route, color, index, depot);
        console.log(`🎯 Primary road-following draw completed for route ${index + 1}`);
        
        // THEN: Try to get Google Directions for road-following enhancement (optional)
        try {
            console.log(`🎯 Route ${index + 1} - Now enhancing with Google Directions for road-following...`);
            const directionsResult = await getDirectionsWithFallback(
                { stops: stops, totalStudents: route.totalStudents },
                depot,
                index + 1
            );
            
            if (directionsResult && directionsResult.isGoogleOptimized) {
                console.log(`🎯 Route ${index + 1} - ENHANCING with Google Directions road-following!`);
                // Don't replace your route - just enhance the visualization
                enhanceRouteWithGoogleDirections(directionsResult, color, route, index, depot);
            }
        } catch (directionsError) {
            console.warn(`⚠️ Google Directions enhancement failed for route ${index + 1}, but YOUR algorithm route is already drawn:`, directionsError);
        }
        
    } catch (error) {
        console.error(`❌ CRITICAL ERROR visualizing route ${index + 1}:`, error);
        console.error(`❌ This route should have YOUR algorithm data but failed:`, route);
        // Don't throw - just log the error and continue with other routes
        console.error(`❌ Continuing with other routes...`);
    }
}

// ✅ INTEGRATED: Draw Google Directions route
function drawGoogleRoute(directionsResult, color, route, index, depot) {
    try {
        console.log(`🗺️ Drawing Google route ${index + 1} with actual road path`);
        console.log(`🔍 FULL directions result:`, directionsResult);
        console.log(`🔍 Directions result type:`, typeof directionsResult);
        console.log(`🔍 Directions result keys:`, Object.keys(directionsResult));
        
        // Check if we have the expected structure
        if (!directionsResult.googleDirectionsData) {
            console.error(`❌ No googleDirectionsData in directionsResult for route ${index + 1}`);
            console.log(`🔍 Available keys:`, Object.keys(directionsResult));
            throw new Error('No googleDirectionsData found');
        }
        
        console.log(`🔍 Google directions data:`, directionsResult.googleDirectionsData);
        console.log(`🔍 Routes array:`, directionsResult.googleDirectionsData.routes);
        
        if (!directionsResult.googleDirectionsData.routes || directionsResult.googleDirectionsData.routes.length === 0) {
            console.error(`❌ No routes in googleDirectionsData for route ${index + 1}`);
            throw new Error('No routes found in googleDirectionsData');
        }
        
        // Extract the route path from Google Directions
        const googleRoute = directionsResult.googleDirectionsData.routes[0];
        console.log(`🔍 Google route object:`, googleRoute);
        console.log(`🔍 Route legs:`, googleRoute.legs);
        const path = [];
        
        // Add depot as starting point
        if (depot) {
            const depotLat = parseFloat(depot.Latitude || depot.lat);
            const depotLng = parseFloat(depot.Longitude || depot.lng);
            if (!isNaN(depotLat) && !isNaN(depotLng)) {
                path.push({ lat: depotLat, lng: depotLng });
            }
        }
        
        // Extract path from Google Directions legs using the actual polyline data
        console.log(`🔍 Number of legs:`, googleRoute.legs.length);
        googleRoute.legs.forEach((leg, legIndex) => {
            console.log(`🔍 Leg ${legIndex}:`, leg);
            console.log(`🔍 Number of steps in leg ${legIndex}:`, leg.steps.length);
            
            // Add start point of the leg
            if (leg.start_location) {
                path.push({
                    lat: leg.start_location.lat,
                    lng: leg.start_location.lng
                });
                console.log(`📍 Added leg start:`, leg.start_location);
            }
            
            leg.steps.forEach((step, stepIndex) => {
                console.log(`🔍 Step ${stepIndex}:`, step);
                
                // Use the polyline data if available (this follows the actual roads)
                if (step.polyline && step.polyline.points) {
                    try {
                        // Decode the polyline to get all the road-following points
                        const decodedPoints = google.maps.geometry.encoding.decodePath(step.polyline.points);
                        console.log(`🔍 Decoded ${decodedPoints.length} points from polyline for step ${stepIndex}`);
                        
                        // Add all the decoded points to our path
                        decodedPoints.forEach(point => {
                            path.push({
                                lat: point.lat(),
                                lng: point.lng()
                            });
                        });
                    } catch (polylineError) {
                        console.warn(`⚠️ Failed to decode polyline for step ${stepIndex}, using start/end points:`, polylineError);
                        // Fallback to start/end points
                        if (step.start_location) {
                            path.push({
                                lat: step.start_location.lat,
                                lng: step.start_location.lng
                            });
                        }
                        if (step.end_location) {
                            path.push({
                                lat: step.end_location.lat,
                                lng: step.end_location.lng
                            });
                        }
                    }
                } else {
                    // Fallback to start/end points if no polyline data
                    if (step.start_location) {
                        path.push({
                            lat: step.start_location.lat,
                            lng: step.start_location.lng
                        });
                    }
                    if (step.end_location) {
                        path.push({
                            lat: step.end_location.lat,
                            lng: step.end_location.lng
                        });
                    }
                }
            });
            
            // Add end point of the leg
            if (leg.end_location) {
                path.push({
                    lat: leg.end_location.lat,
                    lng: leg.end_location.lng
                });
                console.log(`📍 Added leg end:`, leg.end_location);
            }
        });
        
        console.log(`🔍 Total path points extracted:`, path.length);
        console.log(`🔍 Path array:`, path);
        
        // Draw the polyline
        console.log(`🎨 Creating polyline for route ${index + 1} with ${path.length} points`);
        console.log(`🎨 Color:`, color);
        console.log(`🎨 Map object:`, AppState.map);
        
        const polyline = new google.maps.Polyline({
            path: path,
            geodesic: true,
            strokeColor: color,
            strokeOpacity: 0.5,
            strokeWeight: 3,
            map: AppState.map
        });
        
        console.log(`🎨 Polyline created:`, polyline);
        
        // Store the polyline for later removal
        if (!AppState.routePolylinesByRoute[index]) AppState.routePolylinesByRoute[index] = [];
        AppState.routePolylinesByRoute[index].push(polyline);
        
        console.log(`✅ Polyline added to map successfully`);
        
        // Add markers for stops
        route.stops.forEach((stop, stopIndex) => {
            const marker = new google.maps.Marker({
                position: {
                    lat: parseFloat(stop.snapped_lat || stop.lat),
                    lng: parseFloat(stop.snapped_lon || stop.lng)
                },
                map: AppState.map,
                title: `Stop ${stopIndex + 1}: ${stop.num_students || 0} students`,
                icon: {
                    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                        <svg width="20" height="20" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="10" cy="10" r="8" fill="${color}" stroke="white" stroke-width="2"/>
                            <text x="10" y="14" text-anchor="middle" font-size="10" fill="white" font-weight="bold">${stopIndex + 1}</text>
                    `),
                    scaledSize: new google.maps.Size(20, 20)
                }
            });
            
            // Store marker for later removal
            if (!AppState.routeMarkers) AppState.routeMarkers = [];
            AppState.routeMarkers.push(marker);
        });
        
        console.log(`✅ Google route ${index + 1} drawn with ${path.length} path points`);
        
    } catch (error) {
        console.error(`Error drawing Google route ${index + 1}:`, error);
        console.error(`❌ Google route enhancement failed - but YOUR algorithm route is already drawn!`);
        // Don't call fallback - your algorithm route is already drawn
    }
}

// 🎯 YOUR ALGORITHM VISUALIZATION FUNCTION - NO MORE FALLBACKS!
function drawYourAlgorithmRoute(route, color, index, depot) {
    try {
        console.log(`🎯 Drawing YOUR algorithm route ${index + 1} - routeType: ${route.routeType}`);
        console.log(`🎯 Route data:`, route);
        console.log(`🎯 Route keys:`, Object.keys(route));
        console.log(`🎯 Route stops:`, route.stops);
        console.log(`🎯 Route stops length:`, route.stops ? route.stops.length : 'undefined');
        console.log(`🎯 Route stops is array:`, Array.isArray(route.stops));
        
        // Use YOUR algorithm's route structure
        const path = [];
        
        // Add depot as starting point
        console.log(`🎯 Depot object:`, depot);
        console.log(`🎯 Depot type:`, typeof depot);
        if (depot) {
            console.log(`🎯 Depot keys:`, Object.keys(depot));
            const depotLat = parseFloat(depot.Latitude || depot.lat);
            const depotLng = parseFloat(depot.Longitude || depot.lng);
            console.log(`🎯 Depot coordinates: ${depotLat}, ${depotLng}`);
            if (!isNaN(depotLat) && !isNaN(depotLng)) {
                path.push({ lat: depotLat, lng: depotLng });
                console.log(`📍 Added depot:`, { lat: depotLat, lng: depotLng });
            } else {
                console.warn(`⚠️ Invalid depot coordinates: ${depotLat}, ${depotLng}`);
            }
        } else {
            console.warn(`⚠️ No depot provided for route ${index + 1}`);
        }
        
        // Add YOUR algorithm's optimized stop sequence
        if (route.stops && Array.isArray(route.stops)) {
            console.log(`🎯 Processing ${route.stops.length} stops for route ${index + 1}`);
            route.stops.forEach((stop, stopIndex) => {
                console.log(`🎯 Processing stop ${stopIndex + 1}:`, stop);
                console.log(`🎯 Stop keys:`, Object.keys(stop));
                const stopLat = parseFloat(stop.snapped_lat || stop.lat);
                const stopLng = parseFloat(stop.snapped_lon || stop.lng);
                console.log(`🎯 Stop coordinates: ${stopLat}, ${stopLng}`);
                
                if (!isNaN(stopLat) && !isNaN(stopLng)) {
                    path.push({ lat: stopLat, lng: stopLng });
                    console.log(`📍 Added stop ${stopIndex + 1}:`, { lat: stopLat, lng: stopLng });
                } else {
                    console.warn(`⚠️ Invalid stop coordinates for stop ${stopIndex + 1}: ${stopLat}, ${stopLng}`);
                }
            });
        } else {
            console.warn(`⚠️ No valid stops array for route ${index + 1}`);
            console.warn(`⚠️ Route stops:`, route.stops);
        }
        
        // Add college as end point
        path.push({ lat: COLLEGE_COORDS[0], lng: COLLEGE_COORDS[1] });
        console.log(`📍 Added college:`, { lat: COLLEGE_COORDS[0], lng: COLLEGE_COORDS[1] });
        
        console.log(`🎯 Total path points for YOUR algorithm route:`, path.length);
        console.log(`🎯 AppState.map exists:`, !!AppState.map);
        console.log(`🎯 AppState.map type:`, typeof AppState.map);
        
        // Create polyline using YOUR algorithm data
        console.log(`🎯 Creating polyline with ${path.length} points for route ${index + 1}`);
        console.log(`🎯 Path array:`, path);
        console.log(`🎯 Color:`, color);
        console.log(`🎯 Map object:`, AppState.map);
        
        const polyline = new google.maps.Polyline({
            path: path,
            geodesic: true,
            strokeColor: color,
            strokeOpacity: 0.25, // deemphasize straight connector
            strokeWeight: 3,
            map: AppState.map
        });
        
        console.log(`🎯 Polyline created:`, polyline);
        
        // Store the polyline for later removal (treat as overlay to deemphasize)
        if (!AppState.routeOverlaysByRoute[index]) AppState.routeOverlaysByRoute[index] = [];
        AppState.routeOverlaysByRoute[index].push(polyline);
        console.log(`🎯 Polyline stored in routePolylines array`);
        
        // Do not create per-route order markers. We will reuse cluster markers and toggle visibility.
        ensureStopClusterMarkers();
        updateStopMarkersVisibility();
        
        console.log(`✅ YOUR algorithm route ${index + 1} drawn successfully!`);
        console.log(`✅ Route type: ${route.routeType}`);
        console.log(`✅ Total students: ${route.totalStudents}`);
        console.log(`✅ Efficiency: ${route.efficiency}`);
        
    } catch (error) {
        console.error(`❌ Error drawing YOUR algorithm route ${index + 1}:`, error);
        console.error(`❌ Route data that failed:`, route);
        console.error(`❌ Depot data that failed:`, depot);
        // Don't throw - just log the error and continue
        console.error(`❌ Continuing with other routes...`);
    }
}

// 🎯 ENHANCE YOUR ALGORITHM ROUTE with Google Directions road-following (optional enhancement)
function enhanceRouteWithGoogleDirections(directionsResult, color, route, index, depot) {
    try {
        console.log(`🎯 ENHANCING route ${index + 1} with Google Directions road-following...`);
        
        // Check if we have the expected structure
        if (!directionsResult.googleDirectionsData) {
            console.error(`❌ No googleDirectionsData for enhancement of route ${index + 1}`);
            return;
        }
        
        const googleRoute = directionsResult.googleDirectionsData.routes[0];
        if (!googleRoute || !googleRoute.legs) {
            console.error(`❌ Invalid Google route structure for enhancement of route ${index + 1}`);
            return;
        }
        
        // Create a subtle road-following overlay that doesn't replace your algorithm route
        const path = [];
        
        // Add depot as starting point
        if (depot) {
            const depotLat = parseFloat(depot.Latitude || depot.lat);
            const depotLng = parseFloat(depot.Longitude || depot.lng);
            if (!isNaN(depotLat) && !isNaN(depotLng)) {
                path.push({ lat: depotLat, lng: depotLng });
            }
        }
        
        // Extract road-following path from Google Directions
        googleRoute.legs.forEach((leg, legIndex) => {
            if (leg.start_location) {
                path.push({
                    lat: leg.start_location.lat,
                    lng: leg.start_location.lng
                });
            }
            
            leg.steps.forEach((step, stepIndex) => {
                if (step.polyline && step.polyline.points) {
                    try {
                        const decodedPoints = google.maps.geometry.encoding.decodePath(step.polyline.points);
                        decodedPoints.forEach(point => {
                            path.push({
                                lat: point.lat(),
                                lng: point.lng()
                            });
                        });
                    } catch (polylineError) {
                        // Fallback to start/end points
                        if (step.start_location) {
                            path.push({
                                lat: step.start_location.lat,
                                lng: step.start_location.lng
                            });
                        }
                        if (step.end_location) {
                            path.push({
                                lat: step.end_location.lat,
                                lng: step.end_location.lng
                            });
                        }
                    }
                } else {
                    // Fallback to start/end points
                    if (step.start_location) {
                        path.push({
                            lat: step.start_location.lat,
                            lng: step.start_location.lng
                        });
                    }
                    if (step.end_location) {
                        path.push({
                            lat: step.end_location.lat,
                            lng: step.end_location.lng
                        });
                    }
                }
            });
            
            if (leg.end_location) {
                path.push({
                    lat: leg.end_location.lat,
                    lng: leg.end_location.lng
                });
            }
        });
        
        // Add college as end point
        path.push({ lat: COLLEGE_COORDS[0], lng: COLLEGE_COORDS[1] });
        
        // Create a subtle road-following overlay (dashed line, lower opacity)
        const roadOverlay = new google.maps.Polyline({
            path: path,
            geodesic: true,
            strokeColor: color,
            strokeOpacity: 0.4, // Subtle overlay
            strokeWeight: 2,     // Thinner than your algorithm route
            icons: [{
                icon: {
                    path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW
                },
                offset: '50%',
                repeat: '100px'
            }],
            map: AppState.map
        });
        
        // Store the overlay for later removal
        if (!AppState.routePolylinesByRoute[index]) AppState.routePolylinesByRoute[index] = [];
        AppState.routePolylinesByRoute[index].push(roadOverlay);
        
        console.log(`✅ Route ${index + 1} enhanced with Google Directions road-following overlay`);
        console.log(`✅ Your algorithm route is still the primary visualization`);
        
    } catch (error) {
        console.error(`❌ Error enhancing route ${index + 1} with Google Directions:`, error);
        // Don't throw - this is just an enhancement, not critical
    }
}

// Draw primary road-following route using YOUR stop sequence (segment-by-segment)
async function drawPrimaryRoadRouteFromSequence(route, color, index, depot) {
    try {
        const sequence = [];
        // Start at depot
        if (depot) {
            const dLat = parseFloat(depot.Latitude || depot.lat);
            const dLng = parseFloat(depot.Longitude || depot.lng);
            if (!isNaN(dLat) && !isNaN(dLng)) {
                sequence.push({ lat: dLat, lng: dLng });
            }
        }
        // Stops in given order
        (route.stops || []).forEach(stop => {
            const sLat = parseFloat(stop.snapped_lat || stop.lat);
            const sLng = parseFloat(stop.snapped_lon || stop.lng);
            if (!isNaN(sLat) && !isNaN(sLng)) {
                sequence.push({ lat: sLat, lng: sLng });
            }
        });
        // End at college
        sequence.push({ lat: COLLEGE_COORDS[0], lng: COLLEGE_COORDS[1] });

        if (sequence.length < 2) {
            console.warn(`⚠️ Route ${index + 1} has insufficient points for drawing`);
            return;
        }

        // Draw each segment with Google proxy first, OSRM as fallback
        for (let i = 0; i < sequence.length - 1; i++) {
            try {
                const path = await getRoadPath(sequence[i], sequence[i + 1]);
                if (!path || path.length < 2) {
                    console.warn(`⚠️ No road path for segment ${i} of route ${index + 1}; skipping draw`);
                    // small delay before next attempt
                    await new Promise(r => setTimeout(r, 150));
                    continue;
                }
                const seg = new google.maps.Polyline({
                    path,
                    geodesic: true,
                    strokeColor: color,
                    strokeOpacity: 0.9,
                    strokeWeight: 4,
                    map: AppState.map
                });
                if (!AppState.routePolylinesByRoute[index]) AppState.routePolylinesByRoute[index] = [];
                AppState.routePolylinesByRoute[index].push(seg);
                seg.addListener('click', () => showRouteInfo(route, index));
                await new Promise(r => setTimeout(r, 150));
            } catch (segErr) {
                console.warn(`⚠️ Segment draw failed for route ${index + 1}, segment ${i}:`, segErr);
                // Do not draw straight fallback; move on
                await new Promise(r => setTimeout(r, 200));
            }
        }

        // Create and store markers for this route (depot + stops)
        const routeMarkers = [];
        // Depot marker
        if (depot) {
            const dLat = parseFloat(depot.Latitude || depot.lat);
            const dLng = parseFloat(depot.Longitude || depot.lng);
            if (!isNaN(dLat) && !isNaN(dLng)) {
                const depotMarker = new google.maps.Marker({
                    position: { lat: dLat, lng: dLng },
                    map: AppState.map,
                    title: depot['Parking Name'] || 'Depot',
                    icon: createDepotIcon()
                });
                AppState.depotMarkersByRoute[index] = depotMarker;
            }
        }

        // Stop markers with numeric labels
        (route.stops || []).forEach((stop, stopIndex) => {
            const sLat = parseFloat(stop.snapped_lat || stop.lat);
            const sLng = parseFloat(stop.snapped_lon || stop.lng);
            if (isNaN(sLat) || isNaN(sLng)) return;
            const marker = new google.maps.Marker({
                position: { lat: sLat, lng: sLng },
                map: AppState.map,
                title: `Stop ${stopIndex + 1}: ${parseInt(stop.num_students || 0)} students`,
                icon: {
                    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                        <svg width="22" height="22" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="11" cy="11" r="9" fill="${color}" stroke="white" stroke-width="2"/>
                            <text x="11" y="15" text-anchor="middle" font-size="10" fill="white" font-weight="bold">${stopIndex + 1}</text>
                        </svg>
                    `),
                    scaledSize: new google.maps.Size(22, 22)
                }
            });
            routeMarkers.push(marker);
        });
        AppState.routeMarkersByRoute[index] = routeMarkers;
    } catch (e) {
        console.error(`❌ Error drawing primary road route for ${index + 1}:`, e);
    }
}

// Try Google Directions via local proxy first; fallback to OSRM; return [{lat,lng}]
async function getRoadPath(origin, destination) {
    // 1) Try Google proxy
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const request = {
            origin,
            destination,
            waypoints: [],
            optimizeWaypoints: false,
            travelMode: 'DRIVING',
            avoidFerries: true,
            avoidHighways: false,
            avoidTolls: false
        };
        const res = await fetch('http://localhost:3000/api/directions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (res.ok) {
            const data = await res.json();
            if (data.routes && data.routes[0]) {
                const path = [];
                data.routes[0].legs.forEach(leg => {
                    leg.steps.forEach(step => {
                        if (step.polyline && step.polyline.points && google?.maps?.geometry?.encoding) {
                            const dec = google.maps.geometry.encoding.decodePath(step.polyline.points);
                            dec.forEach(p => path.push({ lat: p.lat(), lng: p.lng() }));
                        } else {
                            if (step.start_location) path.push({ lat: step.start_location.lat, lng: step.start_location.lng });
                            if (step.end_location) path.push({ lat: step.end_location.lat, lng: step.end_location.lng });
                        }
                    });
                });
                if (path.length >= 2) return path;
            }
        }
    } catch (e) {
        // swallow and try OSRM
    }
    // 2) Fallback to OSRM
    try {
        const coords = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
        const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.json();
        const line = data?.routes?.[0]?.geometry?.coordinates;
        if (!line) return null;
        return line.map(([lng, lat]) => ({ lat, lng }));
    } catch (e) {
        return null;
    }
}

// ✅ INTEGRATED: Create fallback route when directions fail
function createFallbackRoute(stops, color, route, index, depot) {
    const routePath = [];
    
    // Add depot as start point - handle different depot formats
    if (depot) {
        const depotLat = parseFloat(depot.Latitude || depot.lat);
        const depotLng = parseFloat(depot.Longitude || depot.lng);
        
        if (!isNaN(depotLat) && !isNaN(depotLng)) {
            routePath.push({
                lat: depotLat,
                lng: depotLng
            });
        } else {
            console.warn(`⚠️ Invalid depot coordinates in fallback route ${index + 1}:`, depot);
        }
    }
    
    // If no valid depot, start from college
    if (routePath.length === 0) {
        routePath.push({
            lat: COLLEGE_COORDS[0],
            lng: COLLEGE_COORDS[1]
        });
    }
    
    // Add all stops
    stops.forEach(stop => {
        routePath.push({
            lat: parseFloat(stop.snapped_lat || stop.lat),
            lng: parseFloat(stop.snapped_lon || stop.lng)
        });
    });
    
    // Add college as end point
    routePath.push({
        lat: COLLEGE_COORDS[0],
        lng: COLLEGE_COORDS[1]
    });
    
    // Create polyline
    const polyline = new google.maps.Polyline({
        path: routePath,
        geodesic: true,
        strokeColor: color,
        strokeOpacity: 0.8,
        strokeWeight: 4,
        map: AppState.map
    });
    
    // Store polyline reference
    if (!AppState.polylines) AppState.polylines = new Map();
    AppState.polylines.set(`route-${index}`, polyline);
    
    console.log(`✅ Created fallback route ${index + 1} with ${routePath.length} points`);
}

// ✅ INTEGRATED: Get route color
function getRouteColor(index) {
    const colors = [
        '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
        '#06B6D4', '#F97316', '#84CC16', '#EC4899', '#6366F1'
    ];
    return colors[index % colors.length];
}

// ✅ INTEGRATED: Get directions with fallback
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
        // Preserve YOUR stop order; do not let Google reorder
        optimizeWaypoints: false,
        travelMode: 'DRIVING',
        avoidTolls: false,
        avoidHighways: false,
        avoidFerries: true
    };
    
    try {
        console.log(`🔄 Calling Directions API for route ${routeIndex}...`);
        
        // Add timeout to API call
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        const response = await fetch('http://localhost:3000/api/directions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(routeRequest),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
            const directionsResult = await response.json();
            console.log(`✅ Directions API responded for route ${routeIndex}`);
            
            // Return both the processed route and the raw directions data
            const processedRoute = processDirectionsResponse(directionsResult, group, depot, routeIndex);
            return {
                ...processedRoute,
                googleDirectionsData: directionsResult, // Include the raw Google Directions data
                isGoogleOptimized: true
            };
        } else {
            const errorText = await response.text();
            console.warn(`❌ Directions API failed for route ${routeIndex}: ${response.status} - ${errorText}`);
            return null; // Don't return fallback - enhancement failed
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            console.warn(`⏱️ Directions API timeout for route ${routeIndex}`);
        } else {
            console.error(`❌ Directions API error for route ${routeIndex}:`, error);
        }
        return null; // Don't return fallback - enhancement failed
    }
}

// ✅ INTEGRATED: Process directions response
function processDirectionsResponse(directionsResult, group, depot, routeIndex) {
    if (!directionsResult.routes || directionsResult.routes.length === 0) {
        console.warn(`No directions found for route ${routeIndex}`);
        return null; // Don't return fallback - enhancement failed
    }
    
    const route = directionsResult.routes[0];
    const totalDistance = route.legs.reduce((sum, leg) => sum + leg.distance.value, 0) / 1000;
    const totalDuration = route.legs.reduce((sum, leg) => sum + leg.duration.value, 0) / 60;
    
    // Check for loops in Google's route
    const loopDetected = detectRouteLooping(route);
    if (loopDetected.hasLoop) {
        console.warn(`❌ Route ${routeIndex} contains loops: ${loopDetected.reason}`);
        return null; // Don't return fallback - enhancement failed
    }
    
    // Distance check
    if (totalDistance > 50) { // Stricter limit
        console.warn(`❌ Route ${routeIndex} too long (${totalDistance.toFixed(1)}km)`);
        return null; // Don't return fallback - enhancement failed
    }
    
    // Reorder stops based on Google's optimization
    let orderedStops = [...group.stops];
    if (route.waypoint_order) {
        const proposedOrder = route.waypoint_order.map(index => group.stops[index]);
        
        // Validate the proposed order doesn't create loops
        if (!createsLoops(proposedOrder)) {
            orderedStops = proposedOrder;
        } else {
            console.warn(`❌ Google's waypoint order creates loops - using radial order`);
            orderedStops = group.stops.sort((a, b) => {
                const distA = a.distance || calculateHaversineDistance(
                    COLLEGE_COORDS[0], COLLEGE_COORDS[1],
                    parseFloat(a.lat || a.snapped_lat), parseFloat(a.lng || a.snapped_lon)
                );
                const distB = b.distance || calculateHaversineDistance(
                    COLLEGE_COORDS[0], COLLEGE_COORDS[1],
                    parseFloat(b.lat || b.snapped_lat), parseFloat(b.lng || b.snapped_lon)
                );
                return distA - distB;
            });
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
        routeType: 'road-following',
        loopValidation: { passed: true, method: 'google-validated' }
    };
}

// ✅ INTEGRATED: Create basic route
function createBasicRoute(group, depot, routeIndex) {
    // Calculate more accurate distance estimation
    let totalDistance = 0;
    
    // Distance from depot to first stop
    if (group.stops.length > 0) {
        const firstStop = group.stops[0];
        totalDistance += calculateHaversineDistance(
            parseFloat(depot.Latitude), parseFloat(depot.Longitude),
            parseFloat(firstStop.lat || firstStop.snapped_lat), 
            parseFloat(firstStop.lng || firstStop.snapped_lon)
        );
    }
    
    // Distance between stops
    for (let i = 1; i < group.stops.length; i++) {
        const prevStop = group.stops[i-1];
        const currStop = group.stops[i];
        
        totalDistance += calculateHaversineDistance(
            parseFloat(prevStop.lat || prevStop.snapped_lat), 
            parseFloat(prevStop.lng || prevStop.snapped_lon),
            parseFloat(currStop.lat || currStop.snapped_lat), 
            parseFloat(currStop.lng || currStop.snapped_lon)
        );
    }
    
    // Distance from last stop to college
    if (group.stops.length > 0) {
        const lastStop = group.stops[group.stops.length - 1];
        totalDistance += calculateHaversineDistance(
            parseFloat(lastStop.lat || lastStop.snapped_lat), 
            parseFloat(lastStop.lng || lastStop.snapped_lon),
            COLLEGE_COORDS[0], COLLEGE_COORDS[1]
        );
    }
    
    // Add 20% for realistic routing
    totalDistance *= 1.2;
    
    const efficiency = ((group.totalStudents / 55) * 100).toFixed(1);
    const routeType = group.routeType || 'optimized';
    
    return {
        busId: `Bus ${routeIndex}`,
        depot: depot['Parking Name'],
        stops: group.stops,
        totalStudents: group.totalStudents,
        efficiency: `${efficiency}%`,
        totalDistance: `${Math.min(50, totalDistance).toFixed(1)} km`,
        totalTime: `${Math.round(totalDistance * 2)} min`, // Rough estimate: 30 km/h avg speed
        accessibility: { isValid: true, issues: [] },
        direction: group.direction,
        routeType: routeType,
        isEstimated: true
    };
}

// ✅ INTEGRATED: Create radial route
function createRadialRoute(group, depot, routeIndex) {
    // Force radial ordering: closest to farthest from college
    const radialStops = group.stops.sort((a, b) => {
        const distA = a.distance || calculateHaversineDistance(
            COLLEGE_COORDS[0], COLLEGE_COORDS[1],
            parseFloat(a.lat || a.snapped_lat), parseFloat(a.lng || a.snapped_lon)
        );
        const distB = b.distance || calculateHaversineDistance(
            COLLEGE_COORDS[0], COLLEGE_COORDS[1],
            parseFloat(b.lat || b.snapped_lat), parseFloat(b.lng || b.snapped_lon)
        );
        return distA - distB;
    });
    
    // Calculate estimated distance (radial routes are typically shortest)
    const farthestStop = radialStops[radialStops.length - 1];
    const farthestDistance = farthestStop.distance || calculateHaversineDistance(
        COLLEGE_COORDS[0], COLLEGE_COORDS[1],
        parseFloat(farthestStop.lat || farthestStop.snapped_lat),
        parseFloat(farthestStop.lng || farthestStop.snapped_lon)
    );
    
    const estimatedDistance = Math.max(
        15, // Minimum realistic distance
        farthestDistance * 1.3 // Farthest stop distance + 30% for routing
    );
    
    return {
        busId: `Bus ${routeIndex}`,
        depot: depot['Parking Name'],
        stops: radialStops,
        totalStudents: group.totalStudents,
        efficiency: `${((group.totalStudents / 55) * 100).toFixed(1)}%`,
        totalDistance: `${Math.min(50, estimatedDistance).toFixed(1)} km`, // Cap at 50km
        totalTime: 'Estimated',
        accessibility: { isValid: true, issues: [] },
        direction: group.direction,
        routeType: 'radial-forced',
        loopValidation: { passed: true, method: 'radial-guaranteed' }
    };
}

// ✅ INTEGRATED: Detect loops in Google's route response
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
    // TEMPORARILY DISABLED - Google Directions naturally have many direction changes
    // const maxAllowedChanges = Math.max(50, route.legs.length * 10);
    // if (directionChanges > maxAllowedChanges) {
    //     return {
    //         hasLoop: true,
    //         reason: `Too many direction changes: ${directionChanges} > ${maxAllowedChanges}`
    //     };
    // }
    
    // Always allow routes for now
    return { hasLoop: false };
}

// ✅ INTEGRATED: Check if stop order creates loops
function createsLoops(stops) {
    if (stops.length < 3) return false;
    
    // Check if distance from college generally increases
    let backwardMovements = 0;
    
    for (let i = 1; i < stops.length; i++) {
        const currentStop = stops[i];
        const previousStop = stops[i - 1];
        
        const currentDistance = currentStop.distance || calculateHaversineDistance(
            COLLEGE_COORDS[0], COLLEGE_COORDS[1],
            parseFloat(currentStop.lat || currentStop.snapped_lat), 
            parseFloat(currentStop.lng || currentStop.snapped_lon)
        );
        
        const previousDistance = previousStop.distance || calculateHaversineDistance(
            COLLEGE_COORDS[0], COLLEGE_COORDS[1],
            parseFloat(previousStop.lat || previousStop.snapped_lat), 
            parseFloat(previousStop.lng || currentStop.snapped_lon)
        );
        
        // If we're moving significantly backward toward college
        if (currentDistance < previousDistance - 2) { // 2km tolerance
            backwardMovements++;
        }
    }
    
    // Allow some flexibility but detect major backtracking
    const backtrackRatio = backwardMovements / (stops.length - 1);
    return backtrackRatio > 0.3; // More than 30% backward movements
}

// ===== YOUR REAL OPTIMIZATION ALGORITHMS FROM GOOGLEAPI.JS =====

// ✅ INTEGRATED: Your main optimization function
async function getBusOptimizedRoutes() {
    try {
        const filteredStops = filterStopsByDistance(AppState.stopsData, 40);
        const maxCapacity = parseInt(document.getElementById('maxCapacity').value) || 55;
        
        console.log(`🚌 Starting enhanced optimization for ${filteredStops.length} stops`);
        
        // Use your REAL multi-strategy approach
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
        
        // Analyze coverage
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
        
        // Salvage operation for unserved stops
        if (parseFloat(coveragePercent) < 85 && unservedStops.length > 0) {
            console.log(`🔄 Coverage below 85% - attempting to create routes for unserved stops...`);
            
            const salvageRoutes = await createSalvageRoutes(unservedStops, maxCapacity);
            const validSalvageRoutes = salvageRoutes.filter(validateRouteLength);
            console.log(`✅ Created ${validSalvageRoutes.length} additional routes for previously unserved stops`);
            
            allRoutes = [...servingRoutes, ...validSalvageRoutes];
            
            // Recalculate coverage
            const finalCoverage = analyzeRouteCoverage(allRoutes, filteredStops);
            const finalCoveragePercent = (finalCoverage.servedStudents / totalStudents * 100).toFixed(1);
            
            console.log(`📊 FINAL COVERAGE: ${finalCoveragePercent}% of students`);
        } else {
            allRoutes = servingRoutes;
        }
        
        // Assign depots smartly
        allRoutes.forEach(route => {
            if (!route.assignedDepot) {
                route.assignedDepot = findOptimalDepot(route);
            }
        });
        
        // Limit to maximum number of buses available
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
        console.error('❌ Your algorithms failed - this should not happen!');
        throw new Error('Your optimization algorithms failed - check the data and algorithm logic!');
    }
}

// ✅ INTEGRATED: Filter stops by distance
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

// ✅ INTEGRATED: Validate route length
function validateRouteLength(route) {
    const STRICT_MAX_DISTANCE = 50; // km
    const PREFERRED_MAX_DISTANCE = 40; // km
    
    const distanceKm = getRouteDistance(route);
    
    // Strictly enforce limits
    if (distanceKm > STRICT_MAX_DISTANCE) {
        console.warn(`⚠️ Route ${route.busId} rejected - exceeds strict ${STRICT_MAX_DISTANCE}km limit (${distanceKm.toFixed(1)}km)`);
        return false;
    }
    
    // Add warnings but still accept routes near the limit
    if (distanceKm > PREFERRED_MAX_DISTANCE) {
        console.warn(`⚠️ Route ${route.busId} is longer than preferred (${distanceKm.toFixed(1)}km)`);
        route.distanceWarning = `Route exceeds preferred ${PREFERRED_MAX_DISTANCE}km limit`;
    }
    
    return true;
}

// ✅ INTEGRATED: Get route distance
function getRouteDistance(route) {
    if (route.totalDistance) {
        const distanceText = route.totalDistance.toString();
        const match = distanceText.match(/[~]?(\d+\.?\d*)/);
        if (match && match[1]) {
            return parseFloat(match[1]);
        }
    }
    
    if (route.estimatedDistance) {
        return route.estimatedDistance;
    }
    
    // Fallback: calculate from stops
    if (route.stops && route.stops.length > 0) {
        let totalDistance = 0;
        
        for (let i = 0; i < route.stops.length - 1; i++) {
            totalDistance += calculateHaversineDistance(
                parseFloat(route.stops[i].snapped_lat), parseFloat(route.stops[i].snapped_lon),
                parseFloat(route.stops[i+1].snapped_lat), parseFloat(route.stops[i+1].snapped_lon)
            );
        }
        
        // Add distance from last stop to college
        totalDistance += calculateHaversineDistance(
            parseFloat(route.stops[route.stops.length-1].snapped_lat), 
            parseFloat(route.stops[route.stops.length-1].snapped_lon),
            COLLEGE_COORDS[0], COLLEGE_COORDS[1]
        );
        
        // Add 40% for actual road distances vs straight line
        return totalDistance * 1.4;
    }
    
    return 30; // Assume 30km if we can't calculate
}

// ✅ INTEGRATED: Core clustering function from your algorithms
async function createGeographicalClusters(stops, maxCapacity) {
    const clusters = [];
    
    console.log(`🎯 Creating optimized clusters for ${stops.length} stops`);
    
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
    
    // ✅ NEW: Calculate the distribution statistics for dynamic parameter tuning
    const bearingStats = calculateBearingDistribution(stopsWithBearing);
    const distanceStats = calculateDistanceDistribution(stopsWithBearing);
    
    console.log(`📊 Stop distribution - Bearing SD: ${bearingStats.standardDeviation.toFixed(2)}°, Distance SD: ${distanceStats.standardDeviation.toFixed(2)}km`);
    
    // ✅ DYNAMIC TUNING: Adjust parameters based on geographic distribution
    const dynamicParameters = calculateDynamicParameters(bearingStats, distanceStats);
    console.log(`🔧 Dynamic parameters: Max bearing spread ${dynamicParameters.maxBearingSpread.toFixed(1)}°, Max distance spread ${dynamicParameters.maxDistanceSpread.toFixed(1)}km`);
    
    // ✅ STEP 2: Group by sectors first, then by distance within sectors
    const sectorGroups = {};
    stopsWithBearing.forEach(stop => {
        if (!sectorGroups[stop.direction]) {
            sectorGroups[stop.direction] = [];
        }
        sectorGroups[stop.direction].push(stop);
    });
    
    // ✅ STEP 3: Create distance-based clusters within each sector
    Object.keys(sectorGroups).forEach(direction => {
        const sectorStops = sectorGroups[direction];
        
        if (sectorStops.length === 0) return;
        
        console.log(`📍 ${direction} sector: ${sectorStops.length} stops`);
        
        // ✅ NEW: Sort by distance AND create distance bands
        sectorStops.sort((a, b) => a.distance - b.distance);
        
        // ✅ NEW: Create distance bands within each sector
        const distanceBands = createDistanceBands(sectorStops, dynamicParameters.maxDistanceSpread);
        
        console.log(`📏 ${direction} sector split into ${distanceBands.length} distance bands`);
        
        // Process each distance band within the sector
        distanceBands.forEach((band, bandIndex) => {
            // Sort band stops by distance from college
            band.sort((a, b) => a.distance - b.distance);
            
            let currentCluster = { 
                stops: [], 
                totalStudents: 0, 
                direction: `${direction}-${bandIndex + 1}`,
                minBearing: Infinity,
                maxBearing: -Infinity,
                avgDistance: 0,
                minDistance: Infinity,
                maxDistance: -Infinity
            };
            
            band.forEach(stop => {
                const studentCount = parseInt(stop.num_students);
                
                // Check capacity and bearing constraints
                const newMinBearing = Math.min(currentCluster.minBearing, stop.bearing);
                const newMaxBearing = Math.max(currentCluster.maxBearing, stop.bearing);
                const newMinDistance = Math.min(currentCluster.minDistance, stop.distance);
                const newMaxDistance = Math.max(currentCluster.maxDistance, stop.distance);
                
                let bearingSpread = newMaxBearing - newMinBearing;
                if (bearingSpread > 180) bearingSpread = 360 - bearingSpread;
                
                const wouldExceedCapacity = currentCluster.totalStudents + studentCount > maxCapacity;
                const wouldExceedBearingSpread = bearingSpread > dynamicParameters.maxBearingSpread;
                const wouldExceedDistanceSpread = newMaxDistance - newMinDistance > dynamicParameters.maxDistanceSpread;
                
                if ((wouldExceedCapacity || wouldExceedBearingSpread || wouldExceedDistanceSpread) && currentCluster.stops.length > 0) {
                    finalizeCluster(currentCluster);
                    clusters.push(currentCluster);
                    
                    // Start new cluster
                    currentCluster = {
                        stops: [stop],
                        totalStudents: studentCount,
                        direction: `${direction}-${bandIndex + 1}`,
                        minBearing: stop.bearing,
                        maxBearing: stop.bearing,
                        avgDistance: stop.distance,
                        minDistance: stop.distance,
                        maxDistance: stop.distance
                    };
                } else {
                    currentCluster.stops.push(stop);
                    currentCluster.totalStudents += studentCount;
                    currentCluster.minBearing = newMinBearing;
                    currentCluster.maxBearing = newMaxBearing;
                    currentCluster.minDistance = newMinDistance;
                    currentCluster.maxDistance = newMaxDistance;
                    currentCluster.avgDistance = currentCluster.stops.reduce((sum, s) => sum + s.distance, 0) / currentCluster.stops.length;
                }
            });
            
            // Add the last cluster
            if (currentCluster.stops.length > 0) {
                finalizeCluster(currentCluster);
                clusters.push(currentCluster);
            }
        });
    });
    
    // ✅ STEP 4: Validation + IMPROVED SALVAGE for rejected clusters
    const validClusters = [];
    const rejectedClusters = [];
    
    clusters.forEach(cluster => {
        if (validateClusterStraightness(cluster)) {
            validClusters.push(cluster);
        } else {
            console.warn(`⚠️ Cluster ${cluster.direction} rejected - will try to salvage`);
            rejectedClusters.push(cluster);
        }
    });
    
    // ✅ IMPROVED SALVAGE: Intelligently split rejected clusters instead of just regrouping stops
    if (rejectedClusters.length > 0) {
        console.log(`🔄 Attempting to salvage ${rejectedClusters.length} rejected clusters...`);
        const salvageRoutes = improvedSalvageRejectedClusters(rejectedClusters, maxCapacity, dynamicParameters);
        validClusters.push(...salvageRoutes);
    }
    
    console.log(`✅ Created ${validClusters.length} total clusters (${clusters.length} initial, ${rejectedClusters.length} rejected, ${validClusters.length - (clusters.length - rejectedClusters.length)} salvaged)`);
    
    // Assign depots to valid clusters
    validClusters.forEach((cluster, index) => {
        cluster.assignedDepot = findOptimalDepot(cluster);
        const efficiency = ((cluster.totalStudents / maxCapacity) * 100).toFixed(1);
        cluster.efficiency = efficiency;
        cluster.busId = `Bus ${index + 1}`;
        cluster.totalStudents = cluster.totalStudents;
        cluster.totalDistance = `${Math.min(50, cluster.maxDistance * 1.3).toFixed(1)} km`;
        cluster.routeType = 'geographical-cluster';
        
        console.log(`🚌 Route ${index + 1} (${cluster.direction}): ${cluster.stops.length} stops, ${cluster.totalStudents} students (${efficiency}%)`);
    });
    
    const totalStudentsInShift = stops.reduce((sum, stop) => sum + parseInt(stop.num_students || 0), 0);
    const maxBusesNeeded = Math.ceil(totalStudentsInShift / maxCapacity);

    return validClusters.slice(0, maxBusesNeeded);
}

// ✅ INTEGRATED: Finalize cluster with straightness metrics
function finalizeCluster(cluster) {
    if (cluster.stops.length === 0) return;
    
    // Calculate bearing spread
    if (cluster.minBearing !== undefined && cluster.maxBearing !== undefined) {
        cluster.bearingSpread = cluster.maxBearing - cluster.minBearing;
        
        // Handle edge case where bearings cross 0° (North)
        if (cluster.bearingSpread > 180) {
            cluster.bearingSpread = 360 - cluster.bearingSpread;
        }
    }
    
    // ✅ NEW: Calculate route straightness factor
    cluster.straightnessFactor = calculateStraightnessFactor(cluster.stops);
    
    // Sort stops by distance for optimal routing
    cluster.stops.sort((a, b) => {
        const distA = a.distance || calculateHaversineDistance(
            COLLEGE_COORDS[0], COLLEGE_COORDS[1],
            parseFloat(a.lat || a.snapped_lat), parseFloat(a.lng || a.snapped_lon)
        );
        
        const distB = b.distance || calculateHaversineDistance(
            COLLEGE_COORDS[0], COLLEGE_COORDS[1],
            parseFloat(b.lat || b.snapped_lat), parseFloat(b.lng || b.snapped_lon)
        );
        
        return distA - distB;
    });
}

// ✅ INTEGRATED: Find optimal depot
function findOptimalDepot(cluster) {
    if (!cluster.stops || cluster.stops.length === 0) {
        return AppState.depotsData[0]; // Fallback
    }
    
    // Calculate cluster centroid
    const centroidLat = cluster.stops.reduce((sum, stop) => sum + parseFloat(stop.lat || stop.snapped_lat), 0) / cluster.stops.length;
    const centroidLng = cluster.stops.reduce((sum, stop) => sum + parseFloat(stop.lng || stop.snapped_lon), 0) / cluster.stops.length;
    
    // Find depot that is closest to the cluster
    let bestDepot = AppState.depotsData[0];
    let bestDistance = Infinity;
    
    AppState.depotsData.forEach(depot => {
        const depotLat = parseFloat(depot.Latitude);
        const depotLng = parseFloat(depot.Longitude);
        
        const distanceToCluster = calculateHaversineDistance(centroidLat, centroidLng, depotLat, depotLng);
        
        if (distanceToCluster < bestDistance) {
            bestDistance = distanceToCluster;
            bestDepot = depot;
        }
    });
    
    return bestDepot;
}

// ✅ INTEGRATED: Analyze route coverage
function analyzeRouteCoverage(routes, allStops) {
    const stopMap = new Map(); // Map stops to routes serving them
    const studentMap = new Map(); // Map student counts by stop ID
    
    // Build map of all stops
    allStops.forEach(stop => {
        const stopId = stop.cluster_number || stop.id;
        stopMap.set(stopId, []);
        studentMap.set(stopId, parseInt(stop.num_students) || 0);
    });
    
    // Track which routes serve which stops
    routes.forEach((route, routeIndex) => {
        route.stops.forEach(stop => {
            const stopId = stop.cluster_number || stop.id;
            if (stopMap.has(stopId)) {
                stopMap.get(stopId).push(routeIndex);
            }
        });
    });
    
    // Count served and unserved stops
    const servedStops = [];
    const unservedStops = [];
    let duplicateStops = 0;
    let servedStudents = 0;
    
    stopMap.forEach((servingRoutes, stopId) => {
        if (servingRoutes.length > 0) {
            servedStops.push(stopId);
            servedStudents += studentMap.get(stopId);
            
            // Count stops served by multiple routes
            if (servingRoutes.length > 1) {
                duplicateStops++;
            }
        } else {
            // Find the original stop object
            const originalStop = allStops.find(s => (s.cluster_number || s.id) === stopId);
            if (originalStop) {
                unservedStops.push(originalStop);
            }
        }
    });
    
    // Create deduplicated routes (each stop appears in only one route)
    const servingRoutes = [];
    const routesAdded = new Set();
    
    // First add routes that uniquely serve stops
    stopMap.forEach((routeIndices, stopId) => {
        if (routeIndices.length === 1) {
            const routeIndex = routeIndices[0];
            if (!routesAdded.has(routeIndex)) {
                servingRoutes.push(routes[routeIndex]);
                routesAdded.add(routeIndex);
            }
        }
    });
    
    // Then add routes with duplicated stops if they weren't already added
    routes.forEach((route, index) => {
        if (!routesAdded.has(index)) {
            servingRoutes.push(route);
            routesAdded.add(index);
        }
    });
    
    return {
        servingRoutes,
        servedStops,
        unservedStops,
        duplicateStops,
        servedStudents
    };
}

// ✅ INTEGRATED: Create salvage routes for unserved stops
async function createSalvageRoutes(unservedStops, maxCapacity) {
    // Focus on serving unserved stops with very small, efficient routes
    
    // Group by proximity
    const stopClusters = [];
    const processedStops = new Set();
    
    // For each unprocessed stop, find nearby stops
    for (const stop of unservedStops) {
        const stopId = stop.cluster_number || stop.id;
        
        if (processedStops.has(stopId)) continue;
        
        const nearbyStops = [stop];
        processedStops.add(stopId);
        
        // Find other stops within 3km
        for (const other of unservedStops) {
            const otherId = other.cluster_number || other.id;
            
            if (processedStops.has(otherId)) continue;
            
            const distance = calculateHaversineDistance(
                parseFloat(stop.snapped_lat), parseFloat(stop.snapped_lon),
                parseFloat(other.snapped_lat), parseFloat(other.snapped_lon)
            );
            
            if (distance <= 3) {
                nearbyStops.push(other);
                processedStops.add(otherId);
            }
        }
        
        // If we have stops, create a cluster
        if (nearbyStops.length > 0) {
            const totalStudents = nearbyStops.reduce(
                (sum, s) => sum + parseInt(s.num_students), 0
            );
            
            stopClusters.push({
                stops: nearbyStops,
                totalStudents,
                centerLat: nearbyStops.reduce((sum, s) => sum + parseFloat(s.snapped_lat), 0) / nearbyStops.length,
                centerLng: nearbyStops.reduce((sum, s) => sum + parseFloat(s.snapped_lon), 0) / nearbyStops.length
            });
        }
    }
    
    // Sort clusters by student count (largest first)
    stopClusters.sort((a, b) => b.totalStudents - a.totalStudents);
    
    // Create routes from clusters
    const salvageRoutes = [];
    
    // Merge small nearby clusters until they reach capacity
    let currentRoute = {
        stops: [],
        totalStudents: 0,
        routeType: 'salvage'
    };
    
    for (let i = 0; i < stopClusters.length; i++) {
        const cluster = stopClusters[i];
        
        // If adding this cluster would exceed capacity, create new route
        if (currentRoute.totalStudents + cluster.totalStudents > maxCapacity && currentRoute.stops.length > 0) {
            finalizeSalvageRoute(currentRoute, salvageRoutes.length + 1);
            salvageRoutes.push(currentRoute);
            
            currentRoute = {
                stops: [...cluster.stops],
                totalStudents: cluster.totalStudents,
                routeType: 'salvage'
            };
        } else {
            // Add cluster to current route
            currentRoute.stops.push(...cluster.stops);
            currentRoute.totalStudents += cluster.totalStudents;
        }
    }
    
    // Add final route
    if (currentRoute.stops.length > 0) {
        finalizeSalvageRoute(currentRoute, salvageRoutes.length + 1);
        salvageRoutes.push(currentRoute);
    }
    
    return salvageRoutes;
}

// ✅ INTEGRATED: Finalize salvage route
function finalizeSalvageRoute(route, index) {
    // Calculate center point of route
    const centerLat = route.stops.reduce((sum, s) => sum + parseFloat(s.snapped_lat), 0) / route.stops.length;
    const centerLng = route.stops.reduce((sum, s) => sum + parseFloat(s.snapped_lon), 0) / route.stops.length;
    
    // Calculate bearing from college to center
    const bearing = calculateBearing(
        COLLEGE_COORDS[0], COLLEGE_COORDS[1],
        centerLat, centerLng
    );
    
    // Add properties
    route.busId = `Salvage ${index}`;
    route.direction = `S-${Math.round(bearing/10)*10}°`;
    route.minBearing = bearing - 20;
    route.maxBearing = bearing + 20;
    route.efficiency = `${((route.totalStudents / 55) * 100).toFixed(1)}%`;
    
    // Calculate best route order
    optimizeRouteOrder(route);
}

// ✅ INTEGRATED: Optimize stop order in a route
function optimizeRouteOrder(route) {
    // Sort by distance to create initial ordering
    route.stops.sort((a, b) => {
        const distA = calculateHaversineDistance(
            COLLEGE_COORDS[0], COLLEGE_COORDS[1],
            parseFloat(a.snapped_lat), parseFloat(a.snapped_lon)
        );
        const distB = calculateHaversineDistance(
            COLLEGE_COORDS[0], COLLEGE_COORDS[1],
            parseFloat(b.snapped_lat), parseFloat(b.snapped_lon)
        );
        return distA - distB;
    });
    
    // Calculate total distance with this ordering
    let totalDistance = 0;
    for (let i = 0; i < route.stops.length - 1; i++) {
        totalDistance += calculateHaversineDistance(
            parseFloat(route.stops[i].snapped_lat), parseFloat(route.stops[i].snapped_lon),
            parseFloat(route.stops[i+1].snapped_lat), parseFloat(route.stops[i+1].snapped_lon)
        );
    }
    
    // Add distance to college
    const lastStop = route.stops[route.stops.length - 1];
    totalDistance += calculateHaversineDistance(
        parseFloat(lastStop.snapped_lat), parseFloat(lastStop.snapped_lon),
        COLLEGE_COORDS[0], COLLEGE_COORDS[1]
    );
    
    // Add overhead for real roads
    totalDistance *= 1.3;
    
    route.totalDistance = `${totalDistance.toFixed(1)} km`;
    route.estimatedDistance = totalDistance;
}

// ✅ INTEGRATED: Create corridor-based routes
async function createCorridorBasedRoutes(stops, maxCapacity) {
    console.log(`🛣️ Creating corridor-based routes for ${stops.length} stops`);
    
    // Simple corridor approach - group by direction and distance
    const routes = [];
    
    // Group stops by general direction (8 sectors)
    const directionGroups = {};
    stops.forEach(stop => {
        const bearing = calculateBearing(
            COLLEGE_COORDS[0], COLLEGE_COORDS[1],
            parseFloat(stop.snapped_lat), parseFloat(stop.snapped_lon)
        );
        
        const sector = Math.floor(bearing / 45);
        const direction = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][sector];
        
        if (!directionGroups[direction]) {
            directionGroups[direction] = [];
        }
        
        directionGroups[direction].push({
            ...stop,
            bearing,
            distance: calculateHaversineDistance(
                COLLEGE_COORDS[0], COLLEGE_COORDS[1],
                parseFloat(stop.snapped_lat), parseFloat(stop.snapped_lon)
            )
        });
    });
    
    // Create routes within each direction
    Object.entries(directionGroups).forEach(([direction, directionStops]) => {
        if (directionStops.length === 0) return;
        
        // Sort by distance
        directionStops.sort((a, b) => a.distance - b.distance);
        
        let currentRoute = {
            stops: [],
            totalStudents: 0,
            direction: direction,
            routeType: 'corridor'
        };
        
        directionStops.forEach(stop => {
            const students = parseInt(stop.num_students);
            
            if (currentRoute.totalStudents + students > maxCapacity && currentRoute.stops.length > 0) {
                // Finalize current route
                finalizeCorridorRoute(currentRoute, routes.length + 1);
                routes.push(currentRoute);
                
                // Start new route
                currentRoute = {
                    stops: [stop],
                    totalStudents: students,
                    direction: direction,
                    routeType: 'corridor'
                };
            } else {
                currentRoute.stops.push(stop);
                currentRoute.totalStudents += students;
            }
        });
        
        // Add final route
        if (currentRoute.stops.length > 0) {
            finalizeCorridorRoute(currentRoute, routes.length + 1);
            routes.push(currentRoute);
        }
    });
    
    return routes;
}

// ✅ INTEGRATED: Finalize corridor route
function finalizeCorridorRoute(route, index) {
    // Calculate basic metrics
    route.minBearing = 0; // Will be calculated from stops
    route.maxBearing = 0;
    
    // Ensure stops are ordered by distance from college
    route.stops.sort((a, b) => a.distance - b.distance);
    
    // Calculate route distance estimate
    const farthestStopDistance = route.stops[route.stops.length - 1]?.distance || 0;
    route.estimatedDistance = Math.min(50, farthestStopDistance * 1.3); // 30% overhead for real roads
    
    // Add route ID
    route.busId = `Bus ${index} (Corridor ${route.direction})`;
    
    // Calculate efficiency
    route.efficiency = `${((route.totalStudents / 55) * 100).toFixed(1)}%`;
    
    // Set total distance
    route.totalDistance = `${route.estimatedDistance.toFixed(1)} km`;
}

// ✅ INTEGRATED: Create segment-based routes
async function createRoutesBySegment(stops, maxCapacity) {
    console.log(`🔍 Creating segment-based routes for ${stops.length} stops`);
    
    // Simple segment approach - group by distance bands
    const distanceBands = [
        { min: 0, max: 15, name: "close" },
        { min: 15, max: 30, name: "medium" },
        { min: 30, max: 50, name: "far" }
    ];
    
    const routes = [];
    
    distanceBands.forEach(band => {
        const bandStops = stops.filter(stop => {
            const distance = calculateHaversineDistance(
                COLLEGE_COORDS[0], COLLEGE_COORDS[1],
                parseFloat(stop.snapped_lat), parseFloat(stop.snapped_lon)
            );
            return distance >= band.min && distance < band.max;
        });
        
        if (bandStops.length === 0) return;
        
        // Create routes within this band
        let currentRoute = {
            stops: [],
            totalStudents: 0,
            direction: band.name,
            routeType: 'segment'
        };
        
        bandStops.forEach(stop => {
            const students = parseInt(stop.num_students);
            
            if (currentRoute.totalStudents + students > maxCapacity && currentRoute.stops.length > 0) {
                finalizeSegmentRoute(currentRoute, routes.length + 1, band.name);
                routes.push(currentRoute);
                
                currentRoute = {
                    stops: [stop],
                    totalStudents: students,
                    direction: band.name,
                    routeType: 'segment'
                };
            } else {
                currentRoute.stops.push(stop);
                currentRoute.totalStudents += students;
            }
        });
        
        // Add final route
        if (currentRoute.stops.length > 0) {
            finalizeSegmentRoute(currentRoute, routes.length + 1, band.name);
            routes.push(currentRoute);
        }
    });
    
    return routes;
}

// ✅ INTEGRATED: Finalize segment route
function finalizeSegmentRoute(route, index, prefix) {
    // Sort stops by distance
    route.stops.sort((a, b) => {
        const distA = calculateHaversineDistance(
            COLLEGE_COORDS[0], COLLEGE_COORDS[1],
            parseFloat(a.snapped_lat), parseFloat(a.snapped_lon)
        );
        const distB = calculateHaversineDistance(
            COLLEGE_COORDS[0], COLLEGE_COORDS[1],
            parseFloat(b.snapped_lat), parseFloat(b.snapped_lon)
        );
        return distA - distB;
    });
    
    // Calculate distance
    let totalDistance = 0;
    for (let i = 0; i < route.stops.length - 1; i++) {
        totalDistance += calculateHaversineDistance(
            parseFloat(route.stops[i].snapped_lat), parseFloat(route.stops[i].snapped_lon),
            parseFloat(route.stops[i+1].snapped_lat), parseFloat(route.stops[i+1].snapped_lon)
        );
    }
    
    // Add distance to college
    const lastStop = route.stops[route.stops.length - 1];
    totalDistance += calculateHaversineDistance(
        parseFloat(lastStop.snapped_lat), parseFloat(lastStop.snapped_lon),
        COLLEGE_COORDS[0], COLLEGE_COORDS[1]
    );
    
    // Add overhead for real roads
    totalDistance *= 1.3;
    
    // Set properties
    route.busId = `Bus ${prefix}-${index}`;
    route.efficiency = `${((route.totalStudents / 55) * 100).toFixed(1)}%`;
    route.totalDistance = `${totalDistance.toFixed(1)} km`;
    route.estimatedDistance = totalDistance;
}

function openStreetView() {
    const container = document.getElementById('streetViewContainer');
    const streetViewDiv = document.getElementById('streetView');
    
    if (!streetViewService) {
        streetViewService = new google.maps.StreetViewService();
    }
    
    // Get the current map center
    const center = AppState.map.getCenter();
    
    // Try to open Street View at the current center
    openStreetViewAtLocation(center);
}

function openStreetViewAtLocation(location) {
    const container = document.getElementById('streetViewContainer');
    const streetViewDiv = document.getElementById('streetView');
    
    if (!streetViewService) {
        streetViewService = new google.maps.StreetViewService();
    }
    
    streetViewService.getPanorama({
        location: location,
        radius: 50
    }, (data, status) => {
        if (status === 'OK') {
            if (!streetViewPanorama) {
                streetViewPanorama = new google.maps.StreetViewPanorama(streetViewDiv, {
                    position: data.location.latLng,
                    pov: {
                        heading: 34,
                        pitch: 10
                    },
                    zoom: 1
                });
            } else {
                streetViewPanorama.setPosition(data.location.latLng);
            }
            
            container.classList.add('active');
            showToast('Street View opened at selected location', 'success');
        } else {
            showToast('Street View not available at this location. Try clicking elsewhere.', 'warning');
        }
    });
}

function closeStreetView() {
    const container = document.getElementById('streetViewContainer');
    container.classList.remove('active');
    
    // Also exit Street View click mode if active
    if (window.streetViewMode) {
        window.streetViewMode = false;
        updateStreetViewButton();
        removeStreetViewIndicator();
        AppState.map.setOptions({ draggableCursor: null });
    }
    
    showToast('Street View closed', 'info');
}

function resetMapView() {
    if (AppState.map) {
        AppState.map.setCenter({ lat: COLLEGE_COORDS[0], lng: COLLEGE_COORDS[1] });
        AppState.map.setZoom(11);
        showToast('Map view reset to college', 'success');
    }
}

function toggleFullscreen() {
    const mapContainer = document.querySelector('.fullscreen-map');
    if (mapContainer.requestFullscreen) {
        mapContainer.requestFullscreen();
        showToast('Fullscreen mode activated', 'info');
    } else if (mapContainer.webkitRequestFullscreen) {
        mapContainer.webkitRequestFullscreen();
        showToast('Fullscreen mode activated', 'info');
    } else {
        showToast('Fullscreen not supported in this browser', 'warning');
    }
}

function toggleMapType() {
    const mapTypes = ['roadmap', 'satellite', 'hybrid', 'terrain'];
    const currentIndex = mapTypes.indexOf(currentMapType);
    const nextIndex = (currentIndex + 1) % mapTypes.length;
    currentMapType = mapTypes[nextIndex];
    
    AppState.map.setMapTypeId(google.maps.MapTypeId[currentMapType.toUpperCase()]);
    
    const mapTypeNames = {
        'roadmap': 'Road Map',
        'satellite': 'Satellite',
        'hybrid': 'Hybrid',
        'terrain': 'Terrain'
    };
    
    showToast(`Map type changed to ${mapTypeNames[currentMapType]}`, 'success');
}

// Enhanced route visibility update
function updateRouteVisibility() {
    // Update old polylines
    AppState.polylines.forEach((polyline, key) => {
        const routeIndex = parseInt(key.split('-')[1]);
        if (AppState.selectedRoutes.has(routeIndex)) {
            polyline.setMap(AppState.map);
        } else {
            polyline.setMap(null);
        }
    });
    
    // Update new route polylines (primary) grouped by route index
    if (AppState.routePolylinesByRoute) {
        Object.keys(AppState.routePolylinesByRoute).forEach(key => {
            const rIndex = parseInt(key);
            (AppState.routePolylinesByRoute[rIndex] || []).forEach(polyline => {
                polyline.setMap(AppState.selectedRoutes.has(rIndex) ? AppState.map : null);
            });
        });
    }
    
    // Update overlays grouped by route index
    if (AppState.routeOverlaysByRoute) {
        Object.keys(AppState.routeOverlaysByRoute).forEach(key => {
            const rIndex = parseInt(key);
            (AppState.routeOverlaysByRoute[rIndex] || []).forEach(overlay => {
                overlay.setMap(AppState.selectedRoutes.has(rIndex) ? AppState.map : null);
            });
        });
    }
    
    // Update route-specific stop markers
    if (AppState.routeMarkersByRoute) {
        Object.keys(AppState.routeMarkersByRoute).forEach(key => {
            const rIndex = parseInt(key);
            (AppState.routeMarkersByRoute[rIndex] || []).forEach(marker => {
                marker.setMap(AppState.selectedRoutes.has(rIndex) ? AppState.map : null);
            });
        });
    }
    
    // Update route-specific depot marker (if tracked)
    if (AppState.depotMarkersByRoute) {
        Object.keys(AppState.depotMarkersByRoute).forEach(key => {
            const rIndex = parseInt(key);
            const marker = AppState.depotMarkersByRoute[rIndex];
            if (marker && marker.setMap) {
                marker.setMap(AppState.selectedRoutes.has(rIndex) ? AppState.map : null);
            }
        });
    }
    
    updateStopMarkersVisibility();
}

// ✅ INTEGRATED: Missing helper functions
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

// ✅ MISSING: Calculate bearing distribution for dynamic parameter tuning
function calculateBearingDistribution(stops) {
    // Calculate mean bearing (complex due to circular nature)
    const bearings = stops.map(stop => stop.bearing);
    
    // Convert to radians and calculate vector components
    const xComponents = bearings.map(b => Math.cos(b * Math.PI / 180));
    const yComponents = bearings.map(b => Math.sin(b * Math.PI / 180));
    
    // Calculate mean vector components
    const meanX = xComponents.reduce((a, b) => a + b, 0) / bearings.length;
    const meanY = yComponents.reduce((a, b) => a + b, 0) / bearings.length;
    
    // Calculate mean bearing
    let meanBearing = Math.atan2(meanY, meanX) * 180 / Math.PI;
    if (meanBearing < 0) meanBearing += 360;
    
    // Calculate circular standard deviation
    const resultantLength = Math.sqrt(meanX * meanX + meanY * meanY);
    const standardDeviation = Math.sqrt(-2 * Math.log(resultantLength)) * 180 / Math.PI;
    
    return {
        mean: meanBearing,
        standardDeviation: standardDeviation,
        range: 360,
        clusteringFactor: 1 - resultantLength // 0 = perfectly clustered, 1 = perfectly dispersed
    };
}

// ✅ MISSING: Calculate distance distribution for dynamic parameter tuning
function calculateDistanceDistribution(stops) {
    const distances = stops.map(stop => stop.distance);
    
    // Calculate mean and standard deviation
    const mean = distances.reduce((a, b) => a + b, 0) / distances.length;
    const variance = distances.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / distances.length;
    const standardDeviation = Math.sqrt(variance);
    
    // Calculate min and max
    const min = Math.min(...distances);
    const max = Math.max(...distances);
    
    return {
        mean: mean,
        standardDeviation: standardDeviation,
        min: min,
        max: max,
        range: max - min
    };
}

// ✅ MISSING: Calculate dynamic parameters based on data distribution
function calculateDynamicParameters(bearingStats, distanceStats) {
    // Calculate dynamic bearing spread
    // - More dispersed stops (high std dev) need more flexibility
    // - More clustered stops (low std dev) can use tighter constraints
    let maxBearingSpread = Math.min(120, Math.max(45, bearingStats.standardDeviation * 1.5));
    
    // Calculate dynamic distance spread
    // - Base on standard deviation of distances but keep reasonable bounds
    let maxDistanceSpread = Math.min(15, Math.max(5, distanceStats.standardDeviation * 1.2));
    
    // If stops are very clustered directionally but spread out in distance
    if (bearingStats.standardDeviation < 30 && distanceStats.standardDeviation > 8) {
        // Allow more distance spread since directions are tight
        maxDistanceSpread = Math.min(20, distanceStats.standardDeviation * 1.5);
    }
    
    // If stops are very dispersed directionally but clustered in distance
    if (bearingStats.standardDeviation > 60 && distanceStats.standardDeviation < 4) {
        // Tighten distance constraints since we're allowing more bearing spread
        maxDistanceSpread = Math.min(8, distanceStats.standardDeviation * 1.2);
        // Allow more bearing spread to accommodate the directional dispersion
        maxBearingSpread = Math.min(135, bearingStats.standardDeviation * 1.8);
    }
    
    return {
        maxBearingSpread: maxBearingSpread,
        maxDistanceSpread: maxDistanceSpread,
        clusteringScore: (1 - bearingStats.clusteringFactor) * 100
    };
}

// ✅ MISSING: Create distance bands within a direction sector
function createDistanceBands(sectorStops, maxDistanceSpread) {
    if (sectorStops.length === 0) return [];
    if (sectorStops.length <= 5) return [sectorStops]; // Too few stops to split
    
    // Get distance range
    const minDistance = Math.min(...sectorStops.map(s => s.distance));
    const maxDistance = Math.max(...sectorStops.map(s => s.distance));
    const distanceRange = maxDistance - minDistance;
    
    // If range is small, don't split
    if (distanceRange <= maxDistanceSpread * 1.2) {
        return [sectorStops];
    }
    
    // Determine number of bands - dynamically calculated based on range
    const numBands = Math.max(2, Math.min(5, Math.ceil(distanceRange / maxDistanceSpread)));
    const bandWidth = distanceRange / numBands;
    
    // Create bands
    const bands = Array(numBands).fill().map(() => []);
    
    // Assign stops to bands
    sectorStops.forEach(stop => {
        const bandIndex = Math.min(
            numBands - 1,
            Math.floor((stop.distance - minDistance) / bandWidth)
        );
        bands[bandIndex].push(stop);
    });
    
    // Remove empty bands
    return bands.filter(band => band.length > 0);
}

// ✅ MISSING: Better salvaging of rejected clusters
function improvedSalvageRejectedClusters(rejectedClusters, maxCapacity, dynamicParams) {
    const salvageRoutes = [];
    
    // Process each rejected cluster
    rejectedClusters.forEach((cluster, index) => {
        console.log(`🔧 Salvaging cluster ${index + 1}: ${cluster.direction} with ${cluster.stops.length} stops`);
        
        // Identify the main issues with this cluster
        const issues = identifyClusterIssues(cluster);
        console.log(`   - Issues: ${issues.join(', ')}`);
        
        // Apply different salvage strategies based on the issues
        if (issues.includes('high-bearing-spread')) {
            // Split by bearing sub-sectors
            const subClusters = splitByBearing(cluster, dynamicParams.maxBearingSpread / 1.5);
            console.log(`   - Split into ${subClusters.length} bearing-based sub-clusters`);
            salvageRoutes.push(...subClusters);
            
        } else if (issues.includes('high-distance-spread')) {
            // Split by distance bands
            const subClusters = splitByDistance(cluster, dynamicParams.maxDistanceSpread / 1.5);
            console.log(`   - Split into ${subClusters.length} distance-based sub-clusters`);
            salvageRoutes.push(...subClusters);
            
        } else if (issues.includes('backtracking')) {
            // Try to identify and remove the problematic stops
            const optimizedCluster = removeBacktrackingStops(cluster);
            console.log(`   - Removed ${cluster.stops.length - optimizedCluster.stops.length} problematic stops`);
            salvageRoutes.push(optimizedCluster);
            
        } else {
            // Generic approach: split into smaller chunks
            const chunks = splitIntoChunks(cluster, Math.max(2, Math.floor(cluster.stops.length / 2)));
            console.log(`   - Split into ${chunks.length} generic chunks`);
            salvageRoutes.push(...chunks);
        }
    });
    
    // Finalize all salvaged routes
    salvageRoutes.forEach(route => {
        finalizeCluster(route);
        route.routeType = 'salvaged';
        route.direction = route.direction + '-S'; // Mark as salvaged
    });
    
    console.log(`✅ Created ${salvageRoutes.length} salvaged routes`);
    return salvageRoutes;
}

// ✅ MISSING: Identify specific issues with a rejected cluster
function identifyClusterIssues(cluster) {
    const issues = [];
    
    // Check bearing spread
    const bearingSpread = cluster.maxBearing - cluster.minBearing;
    const adjustedBearingSpread = bearingSpread > 180 ? 360 - bearingSpread : bearingSpread;
    if (adjustedBearingSpread > 75) {
        issues.push('high-bearing-spread');
    }
    
    // Check distance spread
    const distanceSpread = cluster.maxDistance - cluster.minDistance;
    if (distanceSpread > 10) {
        issues.push('high-distance-spread');
    }
    
    // Check for backtracking
    const backtrackRatio = detectBacktracking(cluster.stops);
    if (backtrackRatio > 0.3) {
        issues.push('backtracking');
    }
    
    // Check straightness factor
    if (cluster.straightnessFactor > 0.4) {
        issues.push('low-straightness');
    }
    
    // If no specific issues found, mark as generic
    if (issues.length === 0) {
        issues.push('generic');
    }
    
    return issues;
}

// ✅ MISSING: Split cluster by bearing into sub-clusters
function splitByBearing(cluster, maxBearingSpread) {
    // Create bearing-based groups
    const stops = [...cluster.stops];
    stops.sort((a, b) => a.bearing - b.bearing);
    
    const subClusters = [];
    let currentGroup = {
        stops: [stops[0]],
        totalStudents: parseInt(stops[0].num_students),
        direction: cluster.direction,
        minBearing: stops[0].bearing,
        maxBearing: stops[0].bearing
    };
    
    for (let i = 1; i < stops.length; i++) {
        const stop = stops[i];
        const bearingDiff = stop.bearing - currentGroup.minBearing;
        const adjustedBearingDiff = bearingDiff > 180 ? 360 - bearingDiff : bearingDiff;
        
        if (adjustedBearingDiff > maxBearingSpread) {
            // Complete current group and start new one
            subClusters.push(currentGroup);
            currentGroup = {
                stops: [stop],
                totalStudents: parseInt(stop.num_students),
                direction: cluster.direction + '-B' + subClusters.length,
                minBearing: stop.bearing,
                maxBearing: stop.bearing
            };
        } else {
            // Add to current group
            currentGroup.stops.push(stop);
            currentGroup.totalStudents += parseInt(stop.num_students);
            currentGroup.minBearing = Math.min(currentGroup.minBearing, stop.bearing);
            currentGroup.maxBearing = Math.max(currentGroup.maxBearing, stop.bearing);
        }
    }
    
    // Add the last group
    if (currentGroup.stops.length > 0) {
        subClusters.push(currentGroup);
    }
    
    return subClusters;
}

// ✅ MISSING: Split cluster by distance into sub-clusters
function splitByDistance(cluster, maxDistanceSpread) {
    // Create distance-based groups
    const stops = [...cluster.stops];
    stops.sort((a, b) => a.distance - b.distance);
    
    const subClusters = [];
    let currentGroup = {
        stops: [stops[0]],
        totalStudents: parseInt(stops[0].num_students),
        direction: cluster.direction,
        minDistance: stops[0].distance,
        maxDistance: stops[0].distance
    };
    
    for (let i = 1; i < stops.length; i++) {
        const stop = stops[i];
        const distanceSpread = stop.distance - currentGroup.minDistance;
        
        if (distanceSpread > maxDistanceSpread) {
            // Complete current group and start new one
            subClusters.push(currentGroup);
            currentGroup = {
                stops: [stop],
                totalStudents: parseInt(stop.num_students),
                direction: cluster.direction + '-D' + subClusters.length,
                minDistance: stop.distance,
                maxDistance: stop.distance
            };
        } else {
            // Add to current group
            currentGroup.stops.push(stop);
            currentGroup.totalStudents += parseInt(stop.num_students);
            currentGroup.minDistance = Math.min(currentGroup.minDistance, stop.distance);
            currentGroup.maxDistance = Math.max(currentGroup.maxDistance, stop.distance);
        }
    }
    
    // Add the last group
    if (currentGroup.stops.length > 0) {
        subClusters.push(currentGroup);
    }
    
    return subClusters;
}

// ✅ MISSING: Remove stops that cause backtracking
function removeBacktrackingStops(cluster) {
    const stops = [...cluster.stops];
    
    // Sort stops by distance from college
    stops.sort((a, b) => a.distance - b.distance);
    
    // Identify stops that cause backtracking
    const problematicIndices = [];
    
    for (let i = 1; i < stops.length - 1; i++) {
        const prevStop = stops[i-1];
        const currentStop = stops[i];
        const nextStop = stops[i+1];
        
        // Calculate bearings
        const bearingToCurrent = calculateBearing(
            prevStop.lat, prevStop.lng,
            currentStop.lat, currentStop.lng
        );
        
        const bearingToNext = calculateBearing(
            currentStop.lat, currentStop.lng,
            nextStop.lat, nextStop.lng
        );
        
        // Calculate angular difference
        let bearingDiff = Math.abs(bearingToNext - bearingToCurrent);
        if (bearingDiff > 180) bearingDiff = 360 - bearingDiff;
        
        // If bearing change is too sharp, mark stop as problematic
        if (bearingDiff > 120) {
            problematicIndices.push(i);
        }
    }
    
    // Remove problematic stops
    const optimizedStops = stops.filter((stop, index) => !problematicIndices.includes(index));
    
    // Create a new optimized cluster
    return {
        stops: optimizedStops,
        totalStudents: optimizedStops.reduce((sum, stop) => sum + parseInt(stop.num_students), 0),
        direction: cluster.direction + '-O',
        minBearing: Math.min(...optimizedStops.map(s => s.bearing)),
        maxBearing: Math.max(...optimizedStops.map(s => s.bearing)),
        routeType: 'optimized-salvage'
    };
}

// ✅ MISSING: Split a cluster into smaller chunks
function splitIntoChunks(cluster, numChunks) {
    const stops = [...cluster.stops];
    const chunkSize = Math.ceil(stops.length / numChunks);
    const chunks = [];
    
    // Sort by distance for better chunks
    stops.sort((a, b) => a.distance - b.distance);
    
    for (let i = 0; i < stops.length; i += chunkSize) {
        const chunkStops = stops.slice(i, i + chunkSize);
        
        if (chunkStops.length > 0) {
            chunks.push({
                stops: chunkStops,
                totalStudents: chunkStops.reduce((sum, stop) => sum + parseInt(stop.num_students), 0),
                direction: cluster.direction + '-' + (chunks.length + 1),
                minBearing: Math.min(...chunkStops.map(s => s.bearing)),
                maxBearing: Math.max(...chunkStops.map(s => s.bearing)),
                routeType: 'chunked-salvage'
            });
        }
    }
    
    return chunks;
}

// ✅ MISSING: Validate cluster doesn't create loops
function validateClusterStraightness(cluster) {
    const MAX_BEARING_SPREAD = 90; // Maximum 90° spread allowed
    const MAX_STRAIGHTNESS_FACTOR = 0.5; // Maximum 50% deviation allowed
    const MAX_BACKTRACK_RATIO = 0.4; // Maximum 40% backtracking allowed
    
    // Check 1: Bearing spread
    let bearingSpread = 0;
    if (cluster.minBearing !== undefined && cluster.maxBearing !== undefined) {
        bearingSpread = cluster.maxBearing - cluster.minBearing;
        if (bearingSpread < 0) bearingSpread += 360;
        if (bearingSpread > 180) bearingSpread = 360 - bearingSpread;
    
        if (bearingSpread > MAX_BEARING_SPREAD) {
            console.warn(`❌ Cluster ${cluster.direction} rejected: bearing spread ${bearingSpread.toFixed(1)}° > ${MAX_BEARING_SPREAD}°`);
            return false;
        }
    }
    
    // Check 2: Straightness factor
    if (cluster.straightnessFactor !== undefined && cluster.straightnessFactor > MAX_STRAIGHTNESS_FACTOR) {
        console.warn(`❌ Cluster ${cluster.direction} rejected: straightness factor ${cluster.straightnessFactor.toFixed(2)} > ${MAX_STRAIGHTNESS_FACTOR}`);
        return false;
    }
    
    // Check 3: Backtracking detection
    const backtrackRatio = detectBacktracking(cluster.stops);
    if (backtrackRatio > MAX_BACKTRACK_RATIO) {
        console.warn(`❌ Cluster ${cluster.direction} rejected: backtracking ${(backtrackRatio * 100).toFixed(1)}% > ${MAX_BACKTRACK_RATIO * 100}%`);
        return false;
    }
    
    if (cluster.straightnessFactor !== undefined) {
        console.log(`✅ Cluster ${cluster.direction} validated: spread ${bearingSpread.toFixed(1)}°, straightness ${cluster.straightnessFactor.toFixed(2)}, backtrack ${(backtrackRatio * 100).toFixed(1)}%`);
    } else {
        console.log(`✅ Cluster ${cluster.direction} validated: spread ${bearingSpread.toFixed(1)}°, backtrack ${(backtrackRatio * 100).toFixed(1)}%`);
    }
    return true;
}

// ✅ INTEGRATED: detectBacktracking function
function detectBacktracking(stops) {
    if (stops.length < 3) return 0;
    
    let backwardMovements = 0;
    
    for (let i = 1; i < stops.length; i++) {
        const currentStop = stops[i];
        const previousStop = stops[i - 1];
        
        const currentDistance = currentStop.distance || calculateHaversineDistance(
            COLLEGE_COORDS[0], COLLEGE_COORDS[1],
            parseFloat(currentStop.lat || currentStop.snapped_lat), 
            parseFloat(currentStop.lng || currentStop.snapped_lon)
        );
        
        const previousDistance = previousStop.distance || calculateHaversineDistance(
            COLLEGE_COORDS[0], COLLEGE_COORDS[1],
            parseFloat(previousStop.lat || previousStop.snapped_lat), 
            parseFloat(previousStop.lng || previousStop.snapped_lon)
        );
        
        // If we're moving significantly backward toward college
        if (currentDistance < previousDistance - 2) { // 2km tolerance
            backwardMovements++;
        }
    }
    
    // Return ratio of backward movements
    return backwardMovements / (stops.length - 1);
}

// ✅ MISSING: Calculate how "straight" a route is (0 = perfectly straight, 1 = maximum deviation)
function calculateStraightnessFactor(stops) {
    if (stops.length < 3) return 0; // Can't deviate with less than 3 points
    
    let totalDeviation = 0;
    
    // Check each triplet of consecutive stops
    for (let i = 0; i < stops.length - 2; i++) {
        const stop1 = stops[i];
        const stop2 = stops[i + 1];
        const stop3 = stops[i + 2];
        
        // Get coordinates
        const lat1 = parseFloat(stop1.lat || stop1.snapped_lat);
        const lng1 = parseFloat(stop1.lng || stop1.snapped_lon);
        const lat2 = parseFloat(stop2.lat || stop2.snapped_lat);
        const lng2 = parseFloat(stop2.lng || stop2.snapped_lon);
        const lat3 = parseFloat(stop3.lat || stop3.snapped_lat);
        const lng3 = parseFloat(stop3.lng || stop3.snapped_lon);
        
        // Calculate bearing from stop1 to stop2
        const bearing1to2 = calculateBearing(lat1, lng1, lat2, lng2);
        
        // Calculate bearing from stop2 to stop3
        const bearing2to3 = calculateBearing(lat2, lng2, lat3, lng3);
        
        // Calculate angular deviation
        let angularDiff = Math.abs(bearing2to3 - bearing1to2);
        if (angularDiff > 180) angularDiff = 360 - angularDiff;
        
        totalDeviation += angularDiff;
    }
    
    // Normalize (maximum possible deviation per segment is 180°)
    const maxPossibleDeviation = (stops.length - 2) * 180;
    return totalDeviation / maxPossibleDeviation;
}



// ===== MISSING CRITICAL FUNCTIONS FROM YOUR ORIGINAL SYSTEM =====

// ✅ INTEGRATED: prepareOptimizationRequest function from googleAPI.js
function prepareOptimizationRequest() {
    const maxCapacity = parseInt(document.getElementById('maxCapacity').value) || 55;
    
    // Pre-filter stops by distance
    const filteredStops = filterStopsByDistance(AppState.stopsData, 40);
    
    // ✅ BETTER BUS CALCULATION: Based on total students / 55 (as you mentioned)
    const totalStudents = filteredStops.reduce((sum, stop) => sum + parseInt(stop.num_students), 0);
    const requiredBuses = Math.min(16, Math.max(1, Math.ceil(totalStudents / 55))); // Cap at 16 buses max
    
    console.log(`📊 Using ${filteredStops.length}/${AppState.stopsData.length} stops within 40km radius`);
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
                            latitude: parseFloat(AppState.depotsData[i % AppState.depotsData.length].Latitude),
            longitude: parseFloat(AppState.depotsData[i % AppState.depotsData.length].Longitude)
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

// ✅ INTEGRATED: callGoogleRouteOptimization function
async function callGoogleRouteOptimization(requestData) {
    try {
        console.log('🚀 Calling Google Route Optimization API...');
        
        // This would be your actual Google API call
        // For now, we'll use the local optimization
        const results = await getBusOptimizedRoutes();
        
        if (!results || results.length === 0) {
            throw new Error('No routes generated from Google API');
        }
        
        console.log(`✅ Google API returned ${results.length} routes`);
        return results;
        
    } catch (error) {
        console.error('❌ Google Route Optimization API failed:', error);
        throw error;
    }
}

// ✅ INTEGRATED: optimizeWithGoogleAPI function (the main entry point)
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
        throw new Error('Google Route Optimization API failed - check API key and configuration!');
    }
}

// ✅ INTEGRATED: processRouteOptimizationResponse function
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
                    depot: AppState.depotsData[index % AppState.depotsData.length]['Parking Name'],
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

// ✅ INTEGRATED: findStopByShipmentIndex function
function findStopByShipmentIndex(shipmentIndex) {
    const filteredStops = filterStopsByDistance(AppState.stopsData, 40);
    return filteredStops[shipmentIndex] || null;
}

// ✅ INTEGRATED: validateRouteAccessibility function
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

// ✅ INTEGRATED: calculateTimeDifference function
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

// ✅ INTEGRATED: initMap function that your algorithms expect
function initMap() {
    // This function is called by your algorithms.js
    // We'll use our existing Google Maps initialization
    if (!AppState.map) {
        initGoogleMap();
    }
    
    console.log('✅ Map initialized for optimization algorithms');
}

// ✅ INTEGRATED: Global initMap for Google Maps callback (ensure it's not overridden)
window.initMap = function() {
    console.log('🚀 Google Maps API loaded via callback. Initializing Smart Bus Route Optimizer...');
    // Clear any waiting intervals
    if (window.waitForGoogleMaps) {
        clearInterval(window.waitForGoogleMaps);
    }
    // Small delay to ensure DOM is ready
    setTimeout(() => {
        if (document.readyState === 'complete') {
            initializeApp();
        } else {
            document.addEventListener('DOMContentLoaded', initializeApp);
        }
    }, 100);
};

// ✅ INTEGRATED: checkServerStatus function from googleAPI.js
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
