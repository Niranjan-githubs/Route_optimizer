// Route selector functionality

// Initialize route selectors
function initializeRouteSelectors() {
    const routeSelectorSection = document.getElementById('routeSelectorSection');
    const individualSelectors = document.getElementById('individualRouteSelectors');
    individualSelectors.innerHTML = '';
    selectedRoute = null;
    
    // Show the route selector section
    routeSelectorSection.style.display = 'block';
    
    // Add individual route radio buttons
    optimizationResults.forEach((route, index) => {
        const color = ROUTE_COLORS[index % ROUTE_COLORS.length];
        const routeId = `route-${index}`;
        
        const routeItem = document.createElement('label');
        routeItem.className = 'route-selector-item';
        
        const efficiency = ((route.totalStudents / 55) * 100).toFixed(1);
        const distance = route.actualDistance ? `${route.actualDistance.toFixed(1)} km` : '';
        const timeInfo = route.estimatedTime ? `~${route.estimatedTime} min` : '';
        
        routeItem.innerHTML = `
            <input type="radio" name="routeSelection" id="${routeId}" onchange="selectRoute('${routeId}', ${index})">
            <div style="flex: 1;">
                <span style="color: ${color}; font-weight: 600;">${route.busId}</span>
                <div style="margin-top: 4px; font-size: 12px; color: #718096;">
                    <span>${route.totalStudents} students</span>
                    <span style="margin: 0 8px;">•</span>
                    <span>${route.stops.length} stops</span>
                    ${distance ? `<span style="margin: 0 8px;">•</span><span>${distance}</span>` : ''}
                    ${timeInfo ? `<span style="margin: 0 8px;">•</span><span>${timeInfo}</span>` : ''}
                    <div style="margin-top: 2px;">Efficiency: ${efficiency}%</div>
                </div>
            </div>
        `;
        
        individualSelectors.appendChild(routeItem);
    });

    // Select "Show All" by default
    document.getElementById('selectAllRoutes').checked = true;
    document.querySelector('.route-selector-item').classList.add('selected');
    toggleAllRoutes();
}

// Toggle all routes
function toggleAllRoutes() {
    if (document.getElementById('selectAllRoutes').checked) {
        selectedRoute = null;
        document.querySelectorAll('.route-selector-item').forEach(item => {
            item.classList.remove('selected');
        });
        document.querySelector('.route-selector-item').classList.add('selected');
        updateRouteVisibility();
    }
}

// Select individual route
function selectRoute(routeId, index) {
    selectedRoute = routeId;
    
    // Update visual selection state
    document.querySelectorAll('.route-selector-item').forEach(item => {
        item.classList.remove('selected');
    });
    document.getElementById(routeId).parentElement.classList.add('selected');
    
    updateRouteVisibility();
}

// Update route visibility on map
function updateRouteVisibility() {
    // First, show/hide the route lines and their associated markers
    map.eachLayer((layer) => {
        if (layer instanceof L.Polyline || (layer instanceof L.Marker && layer.options.className?.includes('route-'))) {
            const routeClass = Array.from(layer.options.className?.split(' ') || [])
                .find(cls => cls.startsWith('route-'));
            
            if (routeClass) {
                const routeId = 'route-' + routeClass.split('-')[1];
                const isVisible = selectedRoute === null || selectedRoute === routeId;
                
                if (isVisible) {
                    if (layer instanceof L.Polyline) {
                        layer.setStyle({ opacity: 0.8 });
                    } else {
                        layer.setOpacity(1);
                        layer.getElement()?.style.setProperty('opacity', '1');
                    }
                } else {
                    if (layer instanceof L.Polyline) {
                        layer.setStyle({ opacity: 0 });
                    } else {
                        layer.setOpacity(0);
                        layer.getElement()?.style.setProperty('opacity', '0');
                    }
                }
            }
        }
    });

    // Update stop markers visibility
    if (optimizationResults) {
        const visibleStopIds = new Set();
        
        // Collect all stop IDs from selected route or all routes
        optimizationResults.forEach((route, index) => {
            const routeId = `route-${index}`;
            if (selectedRoute === null || selectedRoute === routeId) {
                route.stops.forEach(stop => {
                    visibleStopIds.add(stop.cluster_number.toString());
                });
            }
        });

        // Update stop markers visibility
        map.eachLayer((layer) => {
            if (layer instanceof L.Marker && !layer.options.className?.includes('route-')) {
                const popupContent = layer.getPopup()?.getContent();
                if (popupContent) {
                    // Extract stop number from popup content
                    const match = popupContent.match(/Stop (\d+)/);
                    if (match) {
                        const stopId = match[1];
                        if (visibleStopIds.has(stopId)) {
                            layer.setOpacity(1);
                            layer.getElement()?.style.setProperty('opacity', '1');
                        } else {
                            layer.setOpacity(0);
                            layer.getElement()?.style.setProperty('opacity', '0');
                        }
                    }
                }
            }
        });
    }
}
