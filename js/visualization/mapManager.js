// Map initialization and management

// Initialize map
function initMap() {
    if (map) return;
    
    map = L.map('map').setView(COLLEGE_COORDS, 10);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    
    // Add college marker
    L.marker(COLLEGE_COORDS, {
        icon: L.divIcon({
            html: '<i class="fas fa-university" style="color: #2d3748; font-size: 20px;"></i>',
            iconSize: [30, 30],
            className: 'college-icon'
        })
    }).addTo(map).bindPopup('<b>Rajalakshmi Engineering College</b><br>Starting Point');
}
