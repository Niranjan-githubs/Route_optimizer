// Metrics and results display

// Update metrics display
function updateMetrics() {
    const totalStudents = studentData.length;
    const requiredBuses = Math.ceil(totalStudents / parseInt(document.getElementById('maxCapacity').value));
    
    document.getElementById('totalStudents').textContent = totalStudents;
    document.getElementById('requiredBuses').textContent = requiredBuses;
    document.getElementById('totalStops').textContent = stopsData.length;
    document.getElementById('totalDepots').textContent = depotsData.length;
    
    document.getElementById('metrics').style.display = 'grid';
}
