#!/usr/bin/env python3
"""
Outlier Routes Creator
=====================

Creates dedicated routes for the 301 final outliers by grouping them
geographically and creating small, efficient routes.

Usage:
    python create_outlier_routes.py
"""

import pandas as pd
import numpy as np
from geopy.distance import geodesic
from sklearn.cluster import DBSCAN
import json
from pathlib import Path

def create_outlier_routes():
    """Create dedicated routes for final outliers"""
    
    # Load final outliers
    outliers_file = "oct2/reassigned_outliers_final_outliers.csv"
    print(f"📂 Loading final outliers from: {outliers_file}")
    
    df = pd.read_csv(outliers_file)
    print(f"✅ Loaded {len(df)} final outliers")
    
    # Group outliers by proximity using DBSCAN
    print("🔄 Grouping outliers by geographic proximity...")
    
    # Convert coordinates to array
    coords = df[['student_lat', 'student_lon']].values
    
    # Use DBSCAN to group nearby outliers
    # eps=0.01 means ~1km radius, min_samples=2 means at least 2 students per group
    clustering = DBSCAN(eps=0.01, min_samples=2, metric='haversine').fit(np.radians(coords))
    
    # Add cluster labels
    df['outlier_cluster'] = clustering.labels_
    
    # Separate grouped outliers from isolated ones
    grouped_outliers = df[df['outlier_cluster'] != -1].copy()
    isolated_outliers = df[df['outlier_cluster'] == -1].copy()
    
    print(f"📊 Grouped outliers: {len(grouped_outliers)} students in {grouped_outliers['outlier_cluster'].nunique()} groups")
    print(f"📊 Isolated outliers: {len(isolated_outliers)} students")
    
    # Create routes for grouped outliers
    routes = []
    route_id = 1
    
    for cluster_id in grouped_outliers['outlier_cluster'].unique():
        cluster_students = grouped_outliers[grouped_outliers['outlier_cluster'] == cluster_id]
        
        # Calculate cluster centroid
        centroid_lat = cluster_students['student_lat'].mean()
        centroid_lon = cluster_students['student_lon'].mean()
        
        # Calculate total students and max distance from centroid
        total_students = len(cluster_students)
        max_distance = 0
        
        for _, student in cluster_students.iterrows():
            distance = geodesic(
                (centroid_lat, centroid_lon),
                (student['student_lat'], student['student_lon'])
            ).kilometers
            max_distance = max(max_distance, distance)
        
        # Create route info
        route = {
            'route_id': f'OUTLIER_ROUTE_{route_id}',
            'route_type': 'OUTLIER_DEDICATED',
            'centroid_lat': centroid_lat,
            'centroid_lon': centroid_lon,
            'total_students': total_students,
            'max_distance_from_centroid_km': max_distance,
            'estimated_route_length_km': max_distance * 2,  # Rough estimate
            'estimated_time_minutes': max_distance * 2 * 2,  # 2 min per km
            'students': cluster_students[['user', 'email', 'department', 'student_lat', 'student_lon']].to_dict('records')
        }
        
        routes.append(route)
        route_id += 1
    
    # Handle isolated outliers (create individual routes or suggest alternatives)
    isolated_routes = []
    for _, student in isolated_outliers.iterrows():
        distance_from_college = student['distance_from_college_km']
        
        if distance_from_college <= 5:
            # Close to college - suggest walking
            suggestion = "WALK_TO_COLLEGE"
        elif distance_from_college <= 15:
            # Medium distance - suggest public transport
            suggestion = "PUBLIC_TRANSPORT"
        else:
            # Far - suggest carpooling or dedicated pickup
            suggestion = "CARPOOL_OR_DEDICATED_PICKUP"
        
        isolated_route = {
            'route_id': f'ISOLATED_{student["user"]}',
            'route_type': 'ISOLATED_STUDENT',
            'suggestion': suggestion,
            'student': student[['user', 'email', 'department', 'student_lat', 'student_lon', 'distance_from_college_km']].to_dict(),
            'reason': f'Isolated student {distance_from_college:.1f}km from college'
        }
        
        isolated_routes.append(isolated_route)
    
    # Save results
    output_file = "oct2/outlier_routes.json"
    with open(output_file, 'w') as f:
        json.dump({
            'grouped_routes': routes,
            'isolated_students': isolated_routes,
            'summary': {
                'total_outliers': len(df),
                'grouped_students': len(grouped_outliers),
                'isolated_students': len(isolated_outliers),
                'dedicated_routes_created': len(routes),
                'routes_needed': len(routes) + len(isolated_routes)
            }
        }, f, indent=2)
    
    print(f"💾 Outlier routes saved to: {output_file}")
    
    # Print summary
    print(f"\n📊 OUTLIER ROUTES SUMMARY:")
    print(f"   - Dedicated routes created: {len(routes)}")
    print(f"   - Students in dedicated routes: {len(grouped_outliers)}")
    print(f"   - Isolated students: {len(isolated_outliers)}")
    print(f"   - Total routes needed: {len(routes) + len(isolated_routes)}")
    
    # Show route details
    print(f"\n🚌 DEDICATED ROUTES:")
    for route in routes:
        print(f"   - {route['route_id']}: {route['total_students']} students, "
              f"{route['estimated_route_length_km']:.1f}km, "
              f"{route['estimated_time_minutes']:.0f}min")
    
    # Show isolated student suggestions
    print(f"\n👤 ISOLATED STUDENTS SUGGESTIONS:")
    suggestions = {}
    for route in isolated_routes:
        suggestion = route['suggestion']
        if suggestion not in suggestions:
            suggestions[suggestion] = 0
        suggestions[suggestion] += 1
    
    for suggestion, count in suggestions.items():
        print(f"   - {suggestion}: {count} students")
    
    return output_file

if __name__ == "__main__":
    create_outlier_routes()

