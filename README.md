# College Bus Route Optimization System

A modular web application for optimizing college bus routes using Google Route Optimization API and advanced algorithms.

## File Structure

```
transport-final/
├── index.html                 # Main entry point
├── css/
│   └── styles.css            # All styling
├── js/
│   ├── app.js               # Main application controller
│   ├── data/
│   │   ├── dataLoader.js    # CSV loading and parsing
│   │   ├── dataValidator.js # Data validation logic
│   │   └── dataProcessor.js # Data transformation
│   ├── optimization/
│   │   ├── optimizer.js     # Main optimization controller
│   │   ├── algorithms.js    # Different optimization algorithms
│   │   └── googleAPI.js     # Google Route Optimization API
│   ├── visualization/
│   │   ├── mapManager.js    # Map initialization and management
│   │   ├── routeRenderer.js # Route visualization
│   │   └── routeTracer.js   # Road tracing functionality
│   ├── ui/
│   │   ├── statusManager.js # Status messages and notifications
│   │   ├── metricsDisplay.js# Metrics and results display
│   │   └── exportManager.js # Export functionality
│   └── utils/
│       ├── constants.js     # Configuration and constants
│       ├── helpers.js       # Utility functions
│       └── api.js          # API communication helpers
├── config/
│   └── config.js           # Environment configuration
└── README.md               # Documentation
```

## Features

- **Data Loading**: Load and parse CSV files for students, stops, and depots
- **Route Optimization**: Multiple optimization algorithms including Google API integration
- **Visualization**: Interactive map with route tracing on actual roads
- **Export**: Export optimized routes to CSV format
- **Real-time Metrics**: Display optimization metrics and efficiency

## Usage

1. Open `index.html` in a web browser
2. Load your CSV files (student assignments, snapped stops, depots)
3. Configure bus capacity and shift settings
4. Click "Optimize Routes" to generate optimized routes
5. View results on the map and export as needed

## Configuration

Update the API key in `js/utils/constants.js` to use Google Route Optimization API:

```javascript
const GOOGLE_API_KEY = "YOUR_ACTUAL_API_KEY_HERE";
```

## Dependencies

- Leaflet.js for map visualization
- PapaParse for CSV parsing
- Font Awesome for icons
- Google Route Optimization API (optional)

## Browser Compatibility

Works in all modern browsers with ES6 support.
