// Data loading and parsing functionality

// Parse CSV data
function parseCSV(file) {
    return new Promise((resolve, reject) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                if (results.errors.length > 0) {
                    reject(results.errors);
                } else {
                    resolve(results.data);
                }
            },
            error: reject
        });
    });
}

// Load and process data
async function loadData() {
    try {
        const studentFile = document.getElementById('studentFile').files[0];
        const stopsFile = document.getElementById('stopsFile').files[0];
        const depotsFile = document.getElementById('depotsFile').files[0];
        const apiKey = GOOGLE_API_KEY;
        
        if (!studentFile || !stopsFile || !depotsFile) {
            showStatus('Please select all required CSV files', 'error');
            return;
        }
        
        // API key is now hardcoded in the code
        
        showStatus('Loading and processing data...', 'info');
        
        // Parse CSV files
        studentData = await parseCSV(studentFile);
        stopsData = await parseCSV(stopsFile);
        depotsData = await parseCSV(depotsFile);
        
        // Validate and process data
        validateData();
        updateMetrics();
        
        document.getElementById('optimizeBtn').disabled = false;
        showStatus('Data loaded successfully! Ready for optimization.', 'success');
        
        // Initialize map if not already done
        initMap();
        visualizeData();
        
    } catch (error) {
        showStatus(`Error loading data: ${error.message || error}`, 'error');
        console.error('Data loading error:', error);
    }
}