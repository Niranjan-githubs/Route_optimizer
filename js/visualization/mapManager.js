// Map initialization and management
window.map = null;

function initMap() {
    if (window.map) return;
    
    // Make sure the map container exists
    const mapContainer = document.getElementById('map');
    if (!mapContainer) {
        console.error('Map container not found!');
        return;
    }
    
    // Initialize the map
    window.map = L.map('map').setView(COLLEGE_COORDS, 11);
    
    // Add the tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(window.map);
    
    // Add college marker
    L.marker(COLLEGE_COORDS, {
        title: 'college',
        icon: L.divIcon({
            className: 'college-icon',
            html: '🏫',
            iconSize: [30, 30]
        })
    }).addTo(window.map);
    
    console.log('Map initialized successfully');
}
