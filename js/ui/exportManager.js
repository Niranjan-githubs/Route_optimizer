// Export functionality

// Export results to CSV
function exportResults() {
    if (!optimizationResults.length) {
        showStatus('No optimization results to export', 'error');
        return;
    }
    
    // Prepare export data
    const exportData = [];
    
    optimizationResults.forEach((route, routeIndex) => {
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
                route_distance_km: route.actualDistance ? route.actualDistance.toFixed(1) : 'N/A',
                estimated_time_min: route.estimatedTime || 'N/A',
                shift_time: document.getElementById('shiftTime').value,
                day_of_week: document.getElementById('dayOfWeek').value
            });
        });
    });
    
    // Convert to CSV
    const csv = Papa.unparse(exportData);
    
    // Create download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `optimized_routes_${document.getElementById('shiftTime').value}_${document.getElementById('dayOfWeek').value}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showStatus('Results exported successfully!', 'success');
}
