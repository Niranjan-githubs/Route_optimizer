// Map initialization and management for Google Maps
window.map = null;

function initMap() {
    if (window.map) return;
    
    // Make sure the map container exists
    const mapContainer = document.getElementById('map');
    if (!mapContainer) {
        console.error('Map container not found!');
        return;
    }
    
    // Initialize Google Maps
    window.map = new google.maps.Map(mapContainer, {
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
        map: window.map,
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
    
    console.log('Google Maps initialized successfully');
}
