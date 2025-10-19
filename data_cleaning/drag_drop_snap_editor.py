#!/usr/bin/env python3
"""
Drag & Drop Snap Editor
=======================

Interactive drag-and-drop tool to manually adjust snap outliers.
Drag markers to new positions and download the updated CSV.

Usage:
    python drag_drop_snap_editor.py
"""

import pandas as pd
import json
from pathlib import Path
import webbrowser
import os

class DragDropSnapEditor:
    def __init__(self, snap_outliers_file):
        self.snap_outliers_file = snap_outliers_file
        self.df = None
        
    def load_snap_outliers(self):
        """Load snap outliers data"""
        print(f"📂 Loading snap outliers from: {self.snap_outliers_file}")
        self.df = pd.read_csv(self.snap_outliers_file)
        print(f"✅ Loaded {len(self.df)} snap outliers affecting {self.df['num_students'].sum()} students")
        
        # Sort by snap distance (worst first)
        self.df = self.df.sort_values('snap_distance_meters', ascending=False)
        
    def create_drag_drop_interface(self):
        """Create a drag-and-drop web interface"""
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>Drag & Drop Snap Editor</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link rel="stylesheet" href="https://unpkg.com/leaflet@1.7.1/dist/leaflet.css" />
            <script src="https://unpkg.com/leaflet@1.7.1/dist/leaflet.js"></script>
            <style>
                body {{ 
                    margin: 0; 
                    padding: 0; 
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    background-color: #f5f5f5;
                }}
                #map {{ 
                    height: 100vh; 
                    width: 100%; 
                }}
                .control-panel {{ 
                    position: fixed; 
                    top: 10px; 
                    right: 10px; 
                    background: white; 
                    padding: 20px; 
                    border-radius: 10px; 
                    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                    z-index: 1000;
                    max-width: 350px;
                    max-height: 80vh;
                    overflow-y: auto;
                }}
                .header {{
                    text-align: center;
                    margin-bottom: 15px;
                    padding-bottom: 10px;
                    border-bottom: 2px solid #e0e0e0;
                }}
                .header h2 {{
                    margin: 0;
                    color: #333;
                    font-size: 18px;
                }}
                .stats {{
                    display: flex;
                    justify-content: space-between;
                    margin: 10px 0;
                    font-size: 12px;
                    color: #666;
                }}
                .cluster-item {{ 
                    margin: 8px 0; 
                    padding: 12px; 
                    border: 2px solid #e0e0e0; 
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    background: white;
                }}
                .cluster-item:hover {{ 
                    background-color: #f8f9fa; 
                    border-color: #007bff;
                    transform: translateY(-1px);
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                }}
                .cluster-item.selected {{ 
                    background-color: #e3f2fd; 
                    border-color: #2196f3;
                    box-shadow: 0 2px 12px rgba(33, 150, 243, 0.3);
                }}
                .cluster-item.adjusted {{
                    background-color: #e8f5e8;
                    border-color: #4caf50;
                }}
                .cluster-info {{
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }}
                .cluster-id {{
                    font-weight: bold;
                    color: #333;
                    font-size: 14px;
                }}
                .cluster-details {{
                    font-size: 11px;
                    color: #666;
                    margin-top: 4px;
                }}
                .distance-badge {{
                    padding: 2px 6px;
                    border-radius: 12px;
                    font-size: 10px;
                    font-weight: bold;
                    color: white;
                }}
                .distance-good {{ background-color: #4caf50; }}
                .distance-borderline {{ background-color: #ff9800; }}
                .distance-bad {{ background-color: #f44336; }}
                .action-buttons {{
                    margin-top: 15px;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }}
                .btn {{
                    padding: 12px 20px;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-weight: bold;
                    transition: all 0.3s ease;
                    text-align: center;
                }}
                .btn-primary {{
                    background: #007bff;
                    color: white;
                }}
                .btn-primary:hover {{
                    background: #0056b3;
                    transform: translateY(-1px);
                }}
                .btn-success {{
                    background: #28a745;
                    color: white;
                }}
                .btn-success:hover {{
                    background: #1e7e34;
                    transform: translateY(-1px);
                }}
                .btn-secondary {{
                    background: #6c757d;
                    color: white;
                }}
                .btn-secondary:hover {{
                    background: #545b62;
                }}
                .instructions {{
                    background: #f8f9fa;
                    padding: 10px;
                    border-radius: 6px;
                    margin-bottom: 15px;
                    font-size: 12px;
                    color: #495057;
                    border-left: 4px solid #007bff;
                }}
                .legend {{
                    background: #f8f9fa;
                    padding: 10px;
                    border-radius: 6px;
                    margin-bottom: 15px;
                    font-size: 11px;
                }}
                .legend-item {{
                    display: flex;
                    align-items: center;
                    margin: 3px 0;
                }}
                .legend-color {{
                    width: 12px;
                    height: 12px;
                    border-radius: 50%;
                    margin-right: 8px;
                }}
                .progress-bar {{
                    width: 100%;
                    height: 6px;
                    background-color: #e0e0e0;
                    border-radius: 3px;
                    overflow: hidden;
                    margin: 10px 0;
                }}
                .progress-fill {{
                    height: 100%;
                    background-color: #4caf50;
                    transition: width 0.3s ease;
                }}
            </style>
        </head>
        <body>
            <div id="map"></div>
            <div class="control-panel">
                <div class="header">
                    <h2>🗺️ Drag & Drop Snap Editor</h2>
                    <div class="stats">
                        <span>Total: {len(self.df)} clusters</span>
                        <span>Students: {self.df['num_students'].sum()}</span>
                    </div>
                </div>
                
                <div class="instructions">
                    <strong>📋 Instructions:</strong><br>
                    1. Click a cluster below to select it<br>
                    2. Drag the marker on the map to adjust position<br>
                    3. Repeat for all clusters you want to fix<br>
                    4. Download the updated CSV when done
                </div>
                
                <div class="legend">
                    <strong>🎨 Legend:</strong><br>
                    <div class="legend-item">
                        <div class="legend-color" style="background-color: #4caf50;"></div>
                        <span>Good (&lt;2km)</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-color" style="background-color: #ff9800;"></div>
                        <span>Borderline (2-5km)</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-color" style="background-color: #f44336;"></div>
                        <span>Problematic (&gt;5km)</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-color" style="background-color: #2196f3;"></div>
                        <span>Original Position</span>
                    </div>
                </div>
                
                <div class="progress-bar">
                    <div class="progress-fill" id="progress-fill" style="width: 0%"></div>
                </div>
                <div style="text-align: center; font-size: 12px; color: #666;">
                    <span id="progress-text">0 of {len(self.df)} clusters adjusted</span>
                </div>
                
                <div id="cluster-list">
                    <!-- Clusters will be populated here -->
                </div>
                
                <div class="action-buttons">
                    <button class="btn btn-primary" onclick="selectAllProblematic()">
                        🎯 Select All Problematic
                    </button>
                    <button class="btn btn-secondary" onclick="resetAllAdjustments()">
                        🔄 Reset All Changes
                    </button>
                    <button class="btn btn-success" onclick="downloadUpdatedCSV()">
                        📥 Download Updated CSV
                    </button>
                </div>
            </div>
            
            <script>
                // Initialize map
                var map = L.map('map').setView([13.0827, 80.2707], 11);
                L.tileLayer('https://{{s}}.tile.openstreetmap.org/{{z}}/{{x}}/{{y}}.png').addTo(map);
                
                var selectedCluster = null;
                var adjustments = {{}};
                var originalMarkers = {{}};
                var draggedMarkers = {{}};
                var connectionLines = {{}};
                
                // Cluster data
                var clusters = {self.df.to_json(orient='records')};
                
                // Create markers for each cluster
                clusters.forEach(function(cluster) {{
                    var color = cluster.snap_distance_meters < 2000 ? 'green' : 
                               cluster.snap_distance_meters < 5000 ? 'orange' : 'red';
                    
                    // Original position (blue circle)
                    var origMarker = L.circleMarker([cluster.original_lat, cluster.original_lon], {{
                        radius: 10,
                        color: '#2196f3',
                        fillColor: '#e3f2fd',
                        fillOpacity: 0.8,
                        weight: 2
                    }}).addTo(map);
                    
                    origMarker.bindPopup(`
                        <b>Cluster ${{cluster.cluster_number}} - Original</b><br>
                        Students: ${{cluster.num_students}}<br>
                        <i>This is where the cluster was originally located</i>
                    `);
                    
                    // Current snapped position (draggable marker)
                    var snappedMarker = L.marker([cluster.snapped_lat, cluster.snapped_lon], {{
                        draggable: true,
                        icon: L.icon({{
                            iconUrl: 'https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-' + color + '.png',
                            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                            iconSize: [25, 41],
                            iconAnchor: [12, 41],
                            popupAnchor: [1, -34],
                            shadowSize: [41, 41]
                        }})
                    }}).addTo(map);
                    
                    snappedMarker.bindPopup(`
                        <b>Cluster ${{cluster.cluster_number}}</b><br>
                        Students: ${{cluster.num_students}}<br>
                        Current snap: ${{cluster.snap_distance_meters.toFixed(1)}}m<br>
                        <strong>Drag me to adjust position!</strong>
                    `);
                    
                    // Line connecting original to snapped
                    var line = L.polyline([[cluster.original_lat, cluster.original_lon], 
                                         [cluster.snapped_lat, cluster.snapped_lon]], {{
                        color: color,
                        weight: 3,
                        opacity: 0.7
                    }}).addTo(map);
                    
                    // Store references
                    originalMarkers[cluster.cluster_number] = {{
                        orig: origMarker,
                        snapped: snappedMarker,
                        line: line,
                        data: cluster
                    }};
                    
                    // Add drag event listener
                    snappedMarker.on('dragend', function(e) {{
                        var newPos = e.target.getLatLng();
                        updateClusterPosition(cluster.cluster_number, newPos.lat, newPos.lng);
                    }});
                    
                    // Add click event to select cluster
                    snappedMarker.on('click', function(e) {{
                        selectCluster(cluster.cluster_number);
                    }});
                    
                    // Add to cluster list
                    addClusterToList(cluster);
                }});
                
                function addClusterToList(cluster) {{
                    var clusterItem = document.createElement('div');
                    clusterItem.className = 'cluster-item';
                    clusterItem.id = 'cluster-' + cluster.cluster_number;
                    
                    var distanceClass = cluster.snap_distance_meters < 2000 ? 'distance-good' : 
                                       cluster.snap_distance_meters < 5000 ? 'distance-borderline' : 'distance-bad';
                    
                    clusterItem.innerHTML = `
                        <div class="cluster-info">
                            <div>
                                <div class="cluster-id">Cluster ${{cluster.cluster_number}}</div>
                                <div class="cluster-details">
                                    ${{cluster.num_students}} students • 
                                    <span class="distance-badge ${{distanceClass}}">
                                        ${{cluster.snap_distance_meters.toFixed(0)}}m
                                    </span>
                                </div>
                            </div>
                        </div>
                    `;
                    
                    clusterItem.onclick = function() {{ 
                        selectCluster(cluster.cluster_number);
                        map.setView([cluster.snapped_lat, cluster.snapped_lon], 15);
                    }};
                    
                    document.getElementById('cluster-list').appendChild(clusterItem);
                }}
                
                function selectCluster(clusterId) {{
                    selectedCluster = clusterId;
                    updateClusterList();
                    
                    // Highlight the selected marker
                    Object.keys(originalMarkers).forEach(function(id) {{
                        var marker = originalMarkers[id].snapped;
                        if (id == clusterId) {{
                            marker.setOpacity(1.0);
                            marker.bringToFront();
                        }} else {{
                            marker.setOpacity(0.7);
                        }}
                    }});
                }}
                
                function updateClusterPosition(clusterId, newLat, newLng) {{
                    // Store adjustment
                    adjustments[clusterId] = {{lat: newLat, lng: newLng}};
                    
                    // Update the connection line
                    var originalData = originalMarkers[clusterId].data;
                    var line = originalMarkers[clusterId].line;
                    
                    // Remove old line
                    map.removeLayer(line);
                    
                    // Create new line
                    var newLine = L.polyline([[originalData.original_lat, originalData.original_lon], 
                                            [newLat, newLng]], {{
                        color: '#ff0000',
                        weight: 4,
                        opacity: 0.8,
                        dashArray: '5, 5'
                    }}).addTo(map);
                    
                    originalMarkers[clusterId].line = newLine;
                    
                    // Update cluster list
                    updateClusterList();
                    updateProgress();
                }}
                
                function updateClusterList() {{
                    var items = document.querySelectorAll('.cluster-item');
                    items.forEach(function(item) {{
                        var clusterId = parseInt(item.id.replace('cluster-', ''));
                        if (clusterId === selectedCluster) {{
                            item.className = 'cluster-item selected';
                        }} else if (adjustments[clusterId]) {{
                            item.className = 'cluster-item adjusted';
                        }} else {{
                            item.className = 'cluster-item';
                        }}
                    }});
                }}
                
                function updateProgress() {{
                    var adjustedCount = Object.keys(adjustments).length;
                    var totalCount = clusters.length;
                    var percentage = (adjustedCount / totalCount) * 100;
                    
                    document.getElementById('progress-fill').style.width = percentage + '%';
                    document.getElementById('progress-text').textContent = 
                        adjustedCount + ' of ' + totalCount + ' clusters adjusted';
                }}
                
                function selectAllProblematic() {{
                    // Select all clusters with >2km snap distance
                    var problematicClusters = clusters.filter(function(c) {{
                        return c.snap_distance_meters > 2000;
                    }});
                    
                    if (problematicClusters.length > 0) {{
                        var firstCluster = problematicClusters[0];
                        selectCluster(firstCluster.cluster_number);
                        map.setView([firstCluster.snapped_lat, firstCluster.snapped_lon], 12);
                    }}
                }}
                
                function resetAllAdjustments() {{
                    if (confirm('Are you sure you want to reset all adjustments?')) {{
                        adjustments = {{}};
                        
                        // Reset all markers to original positions
                        Object.keys(originalMarkers).forEach(function(clusterId) {{
                            var marker = originalMarkers[clusterId];
                            var originalData = marker.data;
                            
                            // Reset marker position
                            marker.snapped.setLatLng([originalData.snapped_lat, originalData.snapped_lon]);
                            
                            // Reset line
                            map.removeLayer(marker.line);
                            var newLine = L.polyline([[originalData.original_lat, originalData.original_lon], 
                                                     [originalData.snapped_lat, originalData.snapped_lon]], {{
                                color: originalData.snap_distance_meters < 2000 ? 'green' : 
                                      originalData.snap_distance_meters < 5000 ? 'orange' : 'red',
                                weight: 3,
                                opacity: 0.7
                            }}).addTo(map);
                            marker.line = newLine;
                        }});
                        
                        updateClusterList();
                        updateProgress();
                        selectedCluster = null;
                    }}
                }}
                
                function downloadUpdatedCSV() {{
                    if (Object.keys(adjustments).length === 0) {{
                        alert('No adjustments made! Please drag some markers to new positions first.');
                        return;
                    }}
                    
                    // Create updated data
                    var updatedClusters = clusters.map(function(cluster) {{
                        var updated = {{...cluster}};
                        
                        if (adjustments[cluster.cluster_number]) {{
                            var adj = adjustments[cluster.cluster_number];
                            updated.snapped_lat = adj.lat;
                            updated.snapped_lon = adj.lng;
                            
                            // Calculate new snap distance (simplified)
                            var latDiff = adj.lat - cluster.original_lat;
                            var lngDiff = adj.lng - cluster.original_lon;
                            var newDistance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111000;
                            updated.snap_distance_meters = Math.round(newDistance * 100) / 100;
                        }}
                        
                        return updated;
                    }});
                    
                    // Convert to CSV
                    var csvContent = "cluster_number,original_lat,original_lon,snapped_lat,snapped_lon,route_name,route_type,route_id,snap_distance_meters,num_students\\n";
                    
                    updatedClusters.forEach(function(cluster) {{
                        csvContent += cluster.cluster_number + "," +
                                    cluster.original_lat + "," +
                                    cluster.original_lon + "," +
                                    cluster.snapped_lat + "," +
                                    cluster.snapped_lon + "," +
                                    cluster.route_name + "," +
                                    cluster.route_type + "," +
                                    (cluster.route_id || "") + "," +
                                    cluster.snap_distance_meters + "," +
                                    cluster.num_students + "\\n";
                    }});
                    
                    // Download file
                    var blob = new Blob([csvContent], {{ type: 'text/csv' }});
                    var url = window.URL.createObjectURL(blob);
                    var a = document.createElement('a');
                    a.href = url;
                    a.download = 'manually_adjusted_snap_outliers.csv';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                    
                    alert('✅ Updated CSV downloaded! Check your downloads folder.');
                }}
                
                // Initialize
                updateProgress();
            </script>
        </body>
        </html>
        """
        
        with open('drag_drop_snap_editor.html', 'w') as f:
            f.write(html_content)
        
        print("🌐 Drag & Drop interface created: drag_drop_snap_editor.html")
        return 'drag_drop_snap_editor.html'
    
    def open_map_in_browser(self, map_file):
        """Open the map in the default web browser"""
        file_url = f"file://{os.path.abspath(map_file)}"
        print(f"🌐 Opening map in browser: {file_url}")
        webbrowser.open(file_url)

def main():
    """Main function to run the drag & drop snap editor"""
    print("🚀 Drag & Drop Snap Editor")
    print("=" * 50)
    
    # Initialize editor
    editor = DragDropSnapEditor("oct2/reassigned_snap_outliers.csv")
    editor.load_snap_outliers()
    
    # Create drag & drop interface
    map_file = editor.create_drag_drop_interface()
    
    # Open in browser
    editor.open_map_in_browser(map_file)
    
    print(f"\n🎯 DRAG & DROP INSTRUCTIONS:")
    print(f"1. The map will open in your browser")
    print(f"2. Click on any cluster marker to select it")
    print(f"3. DRAG the marker to a new position on the map")
    print(f"4. The red dashed line shows the new snap distance")
    print(f"5. Repeat for all clusters you want to adjust")
    print(f"6. Click 'Download Updated CSV' to get your changes")
    
    print(f"\n💡 FEATURES:")
    print(f"- 🎯 'Select All Problematic' - focuses on worst clusters first")
    print(f"- 🔄 'Reset All Changes' - undo all adjustments")
    print(f"- 📊 Progress bar shows how many clusters you've adjusted")
    print(f"- 🎨 Color-coded by severity (red = worst, green = good)")
    print(f"- 📥 Direct CSV download with all your changes")
    
    print(f"\n🎨 VISUAL GUIDE:")
    print(f"- 🔵 Blue circles: Original cluster positions")
    print(f"- 🟢 Green markers: Good snap distance (<2km)")
    print(f"- 🟠 Orange markers: Borderline (2-5km)")
    print(f"- 🔴 Red markers: Problematic (>5km) - drag these first!")
    print(f"- 🔴 Red dashed lines: Your new snap distances")

if __name__ == "__main__":
    main()

