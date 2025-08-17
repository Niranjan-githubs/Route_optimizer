// Route selector functionality

// ✅ SOLUTION 5: Display accessibility warnings in UI
function displayRouteWithAccessibilityInfo(route) {
    const routeElement = document.createElement('div');
    routeElement.className = 'route-item';
    
    if (route.accessibility?.isValid === false) {
        routeElement.classList.add('accessibility-warning');
    }
    
    const accessibilityStatus = route.accessibility?.isValid ? 
        '<span class="accessibility-ok">✅ Bus Accessible</span>' :
        '<span class="accessibility-warning">⚠️ Accessibility Concerns</span>';
    
    const warningDetails = route.accessibility?.issues?.length > 0 ?
        `<div class="warning-details">Issues: ${route.accessibility.issues.join(', ')}</div>` : '';
    
    routeElement.innerHTML = `
        <div class="route-header">
            <strong>${route.busId}</strong> - ${route.depot}
            ${accessibilityStatus}
        </div>
        <div class="route-stats">
            Students: ${route.totalStudents} | Distance: ${route.totalDistance} | Efficiency: ${route.efficiency}
        </div>
        ${warningDetails}
        <div class="route-stops">
            ${route.stops.map(stop => `<span class="stop">Stop ${stop.cluster_number} (${stop.num_students} students)</span>`).join(' → ')}
        </div>
    `;
    
    return routeElement;
}


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
        const routeId = `route-${index}`;
        
        const routeContainer = document.createElement('div');
        routeContainer.className = 'route-selector-item';
        
        // Add radio button
        const radioInput = document.createElement('input');
        radioInput.type = 'radio';
        radioInput.name = 'routeSelection';
        radioInput.id = routeId;
        radioInput.onchange = () => selectRoute(routeId, index);
        
        // Create route display element
        const routeDisplay = displayRouteWithAccessibilityInfo(route);
        
        // Add to container
        routeContainer.appendChild(radioInput);
        routeContainer.appendChild(routeDisplay);
        
        individualSelectors.appendChild(routeContainer);
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
