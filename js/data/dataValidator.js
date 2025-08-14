// Data validation logic

// Validate loaded data
function validateData() {
    // Validate student data
    if (!studentData.length || !studentData[0].student_lat) {
        throw new Error('Invalid student assignments data format');
    }
    
    // Validate stops data
    if (!stopsData.length || !stopsData[0].snapped_lat) {
        throw new Error('Invalid snapped stops data format');
    }
    
    // Validate depots data
    if (!depotsData.length || !depotsData[0].Latitude) {
        throw new Error('Invalid depots data format');
    }
    
    console.log(`Loaded ${studentData.length} students, ${stopsData.length} stops, ${depotsData.length} depots`);
}
