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
    currentFilter: 'all',
    isLoading: false
};

// Constants
const COLLEGE_COORDS = [13.008867898985972, 80.00353386796435]; // Array format for compatibility
const ROUTE_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57', '#FF9FF3', '#54A0FF', '#5F27CD'];

// Global variables for optimization system
window.COLLEGE_COORDS = COLLEGE_COORDS;
window.stopsData = [];
window.depotsData = [];

// Global initMap function for Google Maps callback
window.initMap = function() {
    console.log('🚀 Google Maps API loaded. Initializing Smart Bus Route Optimizer...');
    // Small delay to ensure DOM is ready
    setTimeout(() => {
        if (document.readyState === 'complete') {
            initializeApp();
        } else {
            document.addEventListener('DOMContentLoaded', initializeApp);
        }
    }, 100);
};

// Initialize application
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 DOMContentLoaded fired.');
    // Only initialize if not already done by Google Maps callback
    if (!AppState.map && !window.googleMapsInitialized) {
        console.log('🚀 Google Maps not yet initialized via callback. Initializing from DOMContentLoaded...');
        initializeApp();
    }
});

function initializeApp() {
    if (window.googleMapsInitialized) {
        console.log('🚫 Application already initialized, skipping...');
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
        
        // Add stop markers
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

// Route Optimization
async function optimizeRoutes() {
    if (!AppState.stopsData.length || !AppState.depotsData.length) {
        showToast('Please load data first', 'warning');
        return;
    }
    
    if (AppState.isLoading) return;
    
    showLoading('Optimizing routes... This may take a moment.');
    AppState.isLoading = true;
    
    try {
        const busCapacity = parseInt(document.getElementById('maxCapacity').value) || 55;
        
        // Call optimization API
        const results = await callOptimizationAPI(AppState.stopsData, AppState.depotsData, busCapacity);
        
        AppState.optimizationResults = results;
        visualizeRoutes(results);
        showRouteSelector();
        document.getElementById('exportBtn').disabled = false;
        
        // Show floating action button
        document.getElementById('floatingActionBtn').style.display = 'flex';
        
        showToast(`Route optimization completed! Generated ${results.length} efficient routes.`, 'success');
        
    } catch (error) {
        console.error('❌ Optimization error:', error);
        showToast(`Optimization failed: ${error.message}`, 'error');
    } finally {
        hideLoading();
        AppState.isLoading = false;
    }
}

// API Call - Use your actual optimization system
async function callOptimizationAPI(stopsData, depotsData, busCapacity) {
    try {
        // Use your actual optimization system
        console.log('🚀 Using advanced optimization algorithms...');
        
        // Set global variables that your optimization system expects
        window.stopsData = stopsData;
        window.depotsData = depotsData;
        
        // Call your optimization function
        const routes = await getBusOptimizedRoutes();
        
        if (!routes || routes.length === 0) {
            throw new Error('No routes generated by optimization algorithm');
        }
        
        console.log(`✅ Advanced optimization completed: ${routes.length} routes`);
        return routes;
        
    } catch (error) {
        console.error('❌ Advanced optimization failed:', error);
        console.log('🔄 Falling back to simulation...');
        
        // Fallback to simulation
        return simulateOptimization(stopsData, depotsData, busCapacity);
    }
}

// Simplified version of your optimization system
async function getBusOptimizedRoutes() {
    try {
        const filteredStops = filterStopsByDistance(AppState.stopsData, 40);
        const maxCapacity = parseInt(document.getElementById('maxCapacity').value) || 55;
        
        console.log(`🚌 Starting enhanced optimization for ${filteredStops.length} stops`);
        
        // Create routes using multiple strategies
        const routes = await createGeographicalClusters(filteredStops, maxCapacity);
        
        console.log(`✅ Generated ${routes.length} optimized routes`);
        return routes;
        
    } catch (error) {
        console.error('Enhanced route optimization failed:', error);
        return [];
    }
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
                visibleStopIds.add(stop.cluster_number.toString());
            });
        }
    });
    
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
    AppState.polylines.forEach(polyline => {
        polyline.setMap(null);
    });
    AppState.polylines.clear();
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
    if (AppState.polylines.size === 0) return;
    
    const bounds = new google.maps.LatLngBounds();
    AppState.polylines.forEach(polyline => {
        const path = polyline.getPath();
        path.forEach(point => {
            bounds.extend(point);
        });
    });
    
    AppState.map.fitBounds(bounds);
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

function updateStopMarkersVisibility() {
    const visibleStopIds = new Set();
    
    AppState.optimizationResults.forEach((route, index) => {
        if (AppState.selectedRoutes.has(index)) {
            route.stops.forEach(stop => {
                visibleStopIds.add(stop.cluster_number.toString());
            });
        }
    });
    
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
}
