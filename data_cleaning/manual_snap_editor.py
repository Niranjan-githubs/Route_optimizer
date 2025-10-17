#!/usr/bin/env python3
"""
Manual Snap Editor
==================

Interactive tool to manually adjust snap outliers by clicking on a map.
This allows you to fine-tune cluster locations to better road positions.

Usage:
    python manual_snap_editor.py
"""

import pandas as pd
import folium
import json
from pathlib import Path
import webbrowser
import tempfile
import os

class ManualSnapEditor:
    def __init__(self, snap_outliers_file):
        self.snap_outliers_file = snap_outliers_file
        self.df = None
        self.manual_adjustments = {}
        
    def load_snap_outliers(self):
        """Load snap outliers data"""
        print(f"📂 Loading snap outliers from: {self.snap_outliers_file}")
        self.df = pd.read_csv(self.snap_outliers_file)
        print(f"✅ Loaded {len(self.df)} snap outliers affecting {self.df['num_students'].sum()} students")
        
        # Sort by snap distance (worst first)
        self.df = self.df.sort_values('snap_distance_meters', ascending=False)
        
    def create_interactive_map(self):
        """Create an interactive map for manual snapping"""
        print("🗺️ Creating interactive map...")
        
        # Create base map centered on Chennai
        m = folium.Map(
            location=[13.0827, 80.2707],  # Chennai center
            zoom_start=11,
            tiles='OpenStreetMap'
        )
        
        # Add different tile layers
        folium.TileLayer('CartoDB positron').add_to(m)
        folium.TileLayer('CartoDB dark_matter').add_to(m)
        
        # Color code by snap distance
        def get_color(distance):
            if distance < 2000:
                return 'green'  # Good
            elif distance < 5000:
                return 'orange'  # Borderline
            else:
                return 'red'  # Problematic
        
        # Add markers for each snap outlier
        for idx, row in self.df.iterrows():
            cluster_id = row['cluster_number']
            orig_lat = row['original_lat']
            orig_lon = row['original_lon']
            snapped_lat = row['snapped_lat']
            snapped_lon = row['snapped_lon']
            distance = row['snap_distance_meters']
            students = row['num_students']
            
            color = get_color(distance)
            
            # Original cluster position (blue)
            folium.CircleMarker(
                location=[orig_lat, orig_lon],
                radius=8,
                popup=f"""
                <b>Cluster {cluster_id}</b><br>
                <b>Original Position</b><br>
                Students: {students}<br>
                Snap Distance: {distance:.1f}m<br>
                <i>This is where the cluster was originally</i>
                """,
                color='blue',
                fillColor='lightblue',
                fillOpacity=0.7,
                weight=2
            ).add_to(m)
            
            # Current snapped position
            folium.CircleMarker(
                location=[snapped_lat, snapped_lon],
                radius=6,
                popup=f"""
                <b>Cluster {cluster_id}</b><br>
                <b>Current Snapped Position</b><br>
                Students: {students}<br>
                Snap Distance: {distance:.1f}m<br>
                <i>Click to adjust this position</i>
                """,
                color=color,
                fillColor=color,
                fillOpacity=0.8,
                weight=2
            ).add_to(m)
            
            # Line connecting original to snapped
            folium.PolyLine(
                locations=[[orig_lat, orig_lon], [snapped_lat, snapped_lon]],
                color=color,
                weight=2,
                opacity=0.6,
                popup=f"Snap distance: {distance:.1f}m"
            ).add_to(m)
            
            # Add clickable marker for manual adjustment
            folium.Marker(
                location=[snapped_lat, snapped_lon],
                popup=f"""
                <b>Cluster {cluster_id}</b><br>
                Students: {students}<br>
                Current snap: {distance:.1f}m<br>
                <button onclick="adjustCluster({cluster_id}, {snapped_lat}, {snapped_lon})">
                    Adjust Position
                </button>
                """,
                icon=folium.Icon(color=color, icon='map-marker', prefix='fa')
            ).add_to(m)
        
        # Add legend
        legend_html = '''
        <div style="position: fixed; 
                    bottom: 50px; left: 50px; width: 200px; height: 120px; 
                    background-color: white; border:2px solid grey; z-index:9999; 
                    font-size:14px; padding: 10px">
        <p><b>Snap Distance Legend:</b></p>
        <p><i class="fa fa-circle" style="color:green"></i> &lt; 2km (Good)</p>
        <p><i class="fa fa-circle" style="color:orange"></i> 2-5km (Borderline)</p>
        <p><i class="fa fa-circle" style="color:red"></i> &gt; 5km (Problematic)</p>
        <p><i class="fa fa-circle" style="color:blue"></i> Original Position</p>
        </div>
        '''
        m.get_root().html.add_child(folium.Element(legend_html))
        
        # Add JavaScript for manual adjustment
        js_code = """
        <script>
        function adjustCluster(clusterId, currentLat, currentLon) {
            var newLat = prompt("Enter new latitude for cluster " + clusterId + ":", currentLat);
            var newLon = prompt("Enter new longitude for cluster " + clusterId + ":", currentLon);
            
            if (newLat && newLon) {
                // Create a new marker at the adjusted position
                var newMarker = L.marker([newLat, newLon], {
                    icon: L.icon({
                        iconUrl: 'https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
                        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                        iconSize: [25, 41],
                        iconAnchor: [12, 41],
                        popupAnchor: [1, -34],
                        shadowSize: [41, 41]
                    })
                }).addTo(map);
                
                newMarker.bindPopup(`
                    <b>Cluster ${clusterId} - ADJUSTED</b><br>
                    New Position: ${newLat}, ${newLon}<br>
                    <button onclick="saveAdjustment(${clusterId}, ${newLat}, ${newLon})">
                        Save This Position
                    </button>
                `);
                
                // Draw line from original to new position
                L.polyline([[${currentLat}, ${currentLon}], [${newLat}, ${newLon}]], {
                    color: 'red',
                    weight: 3,
                    opacity: 0.8
                }).addTo(map);
            }
        }
        
        function saveAdjustment(clusterId, newLat, newLon) {
            // Store the adjustment (you'll need to implement saving)
            console.log("Saving adjustment for cluster " + clusterId + ": " + newLat + ", " + newLon);
            alert("Adjustment saved for cluster " + clusterId + "!");
        }
        </script>
        """
        m.get_root().html.add_child(folium.Element(js_code))
        
        return m
    
    def save_map(self, map_obj, output_file="manual_snap_map.html"):
        """Save the interactive map to HTML file"""
        map_obj.save(output_file)
        print(f"🗺️ Interactive map saved to: {output_file}")
        return output_file
    
    def open_map_in_browser(self, map_file):
        """Open the map in the default web browser"""
        file_url = f"file://{os.path.abspath(map_file)}"
        print(f"🌐 Opening map in browser: {file_url}")
        webbrowser.open(file_url)
    
    def load_vehicle_routes(self):
        """Load vehicle routes data for overlay"""
        try:
            vehicle_routes_path = "vehicle_routes.json"
            if not os.path.exists(vehicle_routes_path):
                print(f"⚠️ Vehicle routes file not found: {vehicle_routes_path}")
                return None
            
            print(f"📂 Loading vehicle routes from: {vehicle_routes_path}")
            with open(vehicle_routes_path, 'r') as f:
                data = json.load(f)
            
            if 'highways' in data and isinstance(data['highways'], list):
                print(f"✅ Loaded {len(data['highways'])} vehicle routes")
                return data['highways']
            else:
                print("⚠️ Invalid vehicle routes format")
                return None
                
        except Exception as e:
            print(f"⚠️ Error loading vehicle routes: {e}")
            return None

    def create_simple_web_interface(self):
        """Create a drag-and-drop web interface for manual adjustments"""
        # Load vehicle routes
        vehicle_routes = self.load_vehicle_routes()
        
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
                #map {{ height: 100vh; width: 100%; }}
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
                    2. DRAG the marker on the map to adjust position<br>
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
                
                <div style="margin-top: 15px; padding: 10px; background: #f8f9fa; border-radius: 6px;">
                    <label style="display: flex; align-items: center; cursor: pointer;">
                        <input type="checkbox" id="show-routes" onchange="toggleVehicleRoutes()" style="margin-right: 8px;">
                        <span style="font-size: 12px; font-weight: bold;">🗺️ Show Vehicle Routes</span>
                    </label>
                    <div style="font-size: 10px; color: #666; margin-top: 5px;">
                        Show actual bus routes traced on roads
                    </div>
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
                var vehicleRouteLayers = {{}};
                var routesVisible = false;
                
                // Cluster data
                var clusters = {self.df.to_json(orient='records')};
                
                // Vehicle routes data
                var vehicleRoutes = {json.dumps(vehicle_routes) if vehicle_routes else 'null'};
                
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
                
                // Vehicle routes functions
                function loadVehicleRoutes() {{
                    if (!vehicleRoutes || vehicleRoutes.length === 0) {{
                        console.log('No vehicle routes data available');
                        return;
                    }}
                    
                    console.log('Loading ' + vehicleRoutes.length + ' vehicle routes...');
                    
                    // Limit to first 100 routes to avoid performance issues
                    var routesToShow = vehicleRoutes.slice(0, 100);
                    
                    routesToShow.forEach(function(route, index) {{
                        try {{
                            // Handle the typo in the JSON structure
                            var coordinates = route['./oordinates'] || route.coordinates || [];
                            
                            if (coordinates.length > 1) {{
                                // Convert coordinates to LatLng format
                                var latLngs = coordinates.map(function(coord) {{
                                    return [coord[0], coord[1]];
                                }});
                                
                                // Create polyline for this route (traced on roads)
                                var polyline = L.polyline(latLngs, {{
                                    color: '#666666',
                                    weight: 3,
                                    opacity: 0.4,
                                    smoothFactor: 0.5,
                                    lineCap: 'round',
                                    lineJoin: 'round'
                                }});
                                
                                // Store reference
                                vehicleRouteLayers[index] = polyline;
                            }}
                        }} catch (e) {{
                            console.log('Error processing route ' + index + ':', e);
                        }}
                    }});
                    
                    console.log('Loaded ' + Object.keys(vehicleRouteLayers).length + ' route layers');
                }}
                
                function toggleVehicleRoutes() {{
                    var checkbox = document.getElementById('show-routes');
                    routesVisible = checkbox.checked;
                    
                    if (routesVisible) {{
                        // Show all route layers
                        Object.values(vehicleRouteLayers).forEach(function(layer) {{
                            layer.addTo(map);
                        }});
                        console.log('Vehicle routes shown');
                    }} else {{
                        // Hide all route layers
                        Object.values(vehicleRouteLayers).forEach(function(layer) {{
                            map.removeLayer(layer);
                        }});
                        console.log('Vehicle routes hidden');
                    }}
                }}
                
                // Initialize
                updateProgress();
                
                // Load vehicle routes after map is ready
                setTimeout(function() {{
                    loadVehicleRoutes();
                }}, 1000);
            </script>
        </body>
        </html>
        """
        
        with open('manual_snap_editor.html', 'w') as f:
            f.write(html_content)
        
        print("🌐 Simple web interface created: manual_snap_editor.html")
        return 'manual_snap_editor.html'
    
    def process_manual_adjustments(self, adjustments_file):
        """Process manual adjustments and create updated snap results"""
        print(f"📂 Loading manual adjustments from: {adjustments_file}")
        
        with open(adjustments_file, 'r') as f:
            adjustments = json.load(f)
        
        print(f"✅ Loaded {len(adjustments)} manual adjustments")
        
        # Create updated dataframe
        updated_df = self.df.copy()
        
        for cluster_id, coords in adjustments.items():
            cluster_id = int(cluster_id)
            mask = updated_df['cluster_number'] == cluster_id
            
            if mask.any():
                # Update snapped coordinates
                updated_df.loc[mask, 'snapped_lat'] = coords['lat']
                updated_df.loc[mask, 'snapped_lon'] = coords['lng']
                
                # Recalculate snap distance
                orig_lat = updated_df.loc[mask, 'original_lat'].iloc[0]
                orig_lon = updated_df.loc[mask, 'original_lon'].iloc[0]
                
                # Calculate new distance (simplified - you might want to use haversine)
                import math
                lat_diff = coords['lat'] - orig_lat
                lon_diff = coords['lng'] - orig_lon
                new_distance = math.sqrt(lat_diff**2 + lon_diff**2) * 111000  # Rough conversion to meters
                
                updated_df.loc[mask, 'snap_distance_meters'] = new_distance
        
        # Save updated results
        output_file = 'oct2/manually_adjusted_snap_outliers.csv'
        updated_df.to_csv(output_file, index=False)
        print(f"💾 Updated snap outliers saved to: {output_file}")
        
        # Show improvement summary
        original_avg = self.df['snap_distance_meters'].mean()
        updated_avg = updated_df['snap_distance_meters'].mean()
        
        print(f"\n📊 IMPROVEMENT SUMMARY:")
        print(f"Original average snap distance: {original_avg:.1f}m")
        print(f"Updated average snap distance: {updated_avg:.1f}m")
        print(f"Improvement: {original_avg - updated_avg:.1f}m reduction")
        
        return output_file

def main():
    """Main function to run the manual snap editor"""
    print("🚀 Manual Snap Editor")
    print("=" * 50)
    
    # Initialize editor
    editor = ManualSnapEditor("oct2/reassigned_snap_outliers.csv")
    editor.load_snap_outliers()
    
    # Create simple web interface
    map_file = editor.create_simple_web_interface()
    
    # Open in browser
    editor.open_map_in_browser(map_file)
    
    # Get vehicle routes info for display
    vehicle_routes = editor.load_vehicle_routes()
    
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
    print(f"- 🗺️ 'Show Vehicle Routes' - toggle bus route overlays")
    
    print(f"\n🎨 VISUAL GUIDE:")
    print(f"- 🔵 Blue circles: Original cluster positions")
    print(f"- 🟢 Green markers: Good snap distance (<2km)")
    print(f"- 🟠 Orange markers: Borderline (2-5km)")
    print(f"- 🔴 Red markers: Problematic (>5km) - drag these first!")
    print(f"- 🔴 Red dashed lines: Your new snap distances")
    print(f"- 🛣️ Gray lines: Vehicle routes traced on roads (toggle with checkbox)")
    
    if vehicle_routes:
        print(f"\n🗺️ VEHICLE ROUTES:")
        print(f"- {len(vehicle_routes)} routes loaded from vehicle_routes.json")
        print(f"- Check 'Show Vehicle Routes' to see bus route overlays")
        print(f"- Use routes to help position snap points on actual roads")
    else:
        print(f"\n⚠️ VEHICLE ROUTES:")
        print(f"- No vehicle routes found - check if vehicle_routes.json exists")

if __name__ == "__main__":
    main()
