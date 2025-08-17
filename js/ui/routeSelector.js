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
    console.log('Initializing route selectors with:', window.optimizationResults);
    const routeSelectorSection = document.getElementById('routeSelectorSection');
    const individualSelectors = document.getElementById('individualRouteSelectors');
    individualSelectors.innerHTML = '';
    selectedRoute = null;

    // Check if we have valid optimization results
    if (!window.optimizationResults || !window.optimizationResults.length) {
        console.warn('No optimization results available');
        return;
    }

    // Show the route selector section
    routeSelectorSection.style.display = 'block';

    // Add toggle all checkbox
    const toggleAllDiv = document.createElement('div');
    toggleAllDiv.className = 'toggle-all-routes';
    toggleAllDiv.innerHTML = `
        <label>
            <input type="checkbox" id="toggleAllRoutes" checked>
            Show All Routes
        </label>
    `;
    individualSelectors.appendChild(toggleAllDiv);

    // Create route toggles for each valid route
    window.optimizationResults.forEach((route, index) => {
        if (!route || !route.stops || route.stops.length === 0) {
            console.warn(`Skipping invalid route at index ${index}`);
            return;
        }

        const routeDiv = document.createElement('div');
        routeDiv.className = 'route-toggle';
        
        // Show key route information
        const efficiency = route.efficiency || '0%';
        const studentCount = route.totalStudents || 0;
        const distance = route.totalDistance || '0 km';
        
        routeDiv.innerHTML = `
            <label>
                <input type="checkbox" class="route-checkbox" data-route-index="${index}" checked>
                <span class="route-info">
                    <strong>${route.busId || `Bus ${index + 1}`}</strong>
                    <span class="route-details">
                        ${studentCount} students | ${distance} | ${efficiency} efficient
                    </span>
                </span>
            </label>
        `;
        
        // Add click handler for route selection
        routeDiv.addEventListener('click', (e) => {
            if (e.target.type !== 'checkbox') {
                const checkbox = routeDiv.querySelector('.route-checkbox');
                checkbox.checked = !checkbox.checked;
                updateRouteVisibility();
            }
        });
        
        individualSelectors.appendChild(routeDiv);
    });

    // Add event listeners
    document.getElementById('toggleAllRoutes').addEventListener('change', toggleAllRoutes);
    document.querySelectorAll('.route-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', updateRouteVisibility);
    });

    // Initial visibility update
    updateRouteVisibility();
}

function updateRouteDisplay() {
    const routeList = document.getElementById('routeList');
    const routeType = document.getElementById('routeTypeFilter').value;
    const direction = document.getElementById('directionFilter').value;
    const efficiency = document.getElementById('efficiencyFilter').value;
    
    routeList.innerHTML = '';
    
    window.optimizationResults.forEach((route, index) => {
        // Apply filters
        if (!shouldShowRoute(route, routeType, direction, efficiency)) {
            return;
        }
        
        const routeElement = createRouteElement(route, index);
        routeList.appendChild(routeElement);
    });
}

function shouldShowRoute(route, typeFilter, directionFilter, efficiencyFilter) {
    // Route type filter
    if (typeFilter !== 'all' && route.routeType !== typeFilter) {
        return false;
    }
    
    // Direction filter
    if (directionFilter !== 'all' && route.direction !== directionFilter) {
        return false;
    }
    
    // Efficiency filter
    const efficiency = parseFloat(route.efficiency.replace('%', ''));
    if (efficiencyFilter !== 'all') {
        if (efficiencyFilter === 'high' && efficiency <= 80) return false;
        if (efficiencyFilter === 'medium' && (efficiency < 50 || efficiency > 80)) return false;
        if (efficiencyFilter === 'low' && efficiency >= 50) return false;
    }
    
    return true;
}

function createRouteElement(route, index) {
    const routeElement = document.createElement('div');
    routeElement.className = 'route-item';
    routeElement.dataset.routeIndex = index;
    
    const routeTypeClass = route.routeType === 'optimized' ? 'optimized' : 
                          route.routeType === 'salvaged' ? 'salvaged' : 'basic';
    
    routeElement.innerHTML = `
        <div class="route-header ${routeTypeClass}">
            <strong>${route.busId}</strong>
            <span class="route-type">${route.routeType}</span>
            <span class="route-direction">${route.direction}</span>
        </div>
        <div class="route-stats">
            <span>Students: ${route.totalStudents}</span>
            <span>Distance: ${route.totalDistance}</span>
            <span>Efficiency: ${route.efficiency}</span>
        </div>
        <div class="route-stops">
            <strong>Stops:</strong> ${route.stops.map((stop, i) => 
                `<span class="stop" title="Stop ${i+1}: ${stop.num_students} students">
                    ${stop.cluster_number || i+1}
                </span>`).join(' → ')}
        </div>
    `;
    
    // Add click handler to show route on map
    routeElement.addEventListener('click', () => {
        // Remove previous selection
        document.querySelectorAll('.route-item.selected').forEach(el => 
            el.classList.remove('selected'));
        routeElement.classList.add('selected');
        
        // Update map
        window.selectedRoute = route;
        updateRouteVisibility();
    });
    
    return routeElement;
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
    window.map.eachLayer((layer) => {
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
