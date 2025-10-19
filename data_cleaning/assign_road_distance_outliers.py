#!/usr/bin/env python3
"""
Road Distance Outliers Assignment Script
=======================================

Specifically targets the 236 students who failed due to road distance constraints
by using more relaxed parameters and flexible assignment strategies.

Usage:
    python assign_road_distance_outliers.py
"""

import pandas as pd
import numpy as np
import googlemaps
import json
from geopy.distance import geodesic
import time
from tqdm import tqdm
from pathlib import Path
import os
from dotenv import load_dotenv
import warnings
warnings.filterwarnings('ignore')

class RoadDistanceOutlierAssigner:
    def __init__(self, google_maps_api_key, max_cluster_size=30):
        """
        Initialize the road distance outlier assigner with relaxed constraints
        
        Args:
            google_maps_api_key: Google Maps API key
            max_cluster_size: Maximum students per cluster (increased to 30)
        """
        self.max_cluster_size = max_cluster_size
        self.gmaps = googlemaps.Client(key=google_maps_api_key)
        self.distance_cache = {}
        self.api_calls_made = 0
        self.max_api_calls = 3000  # More API calls for this focused effort
        
        print(f"🔄 Road Distance Outlier Assigner Initialized")
        print(f"👥 Max cluster size: {self.max_cluster_size} students")
        print(f"🔑 API call limit: {self.max_api_calls}")
        
    def load_data(self, outliers_file, centroids_file):
        """Load road distance outliers and existing centroids"""
        print(f"📂 Loading road distance outliers from: {outliers_file}")
        self.outliers_df = pd.read_csv(outliers_file)
        
        # Filter only the road distance constraint failures
        self.outliers_df = self.outliers_df[
            self.outliers_df['reason'] == 'No feasible assignment found within relaxed constraints'
        ].copy()
        
        print(f"📂 Loading centroids from: {centroids_file}")
        self.centroids_df = pd.read_csv(centroids_file)
        
        print(f"✅ Loaded {len(self.outliers_df)} road distance outliers and {len(self.centroids_df)} existing clusters")
        return self.outliers_df, self.centroids_df
    
    def calculate_road_distance(self, origin, destination):
        """Calculate road distance with caching"""
        cache_key = f"{origin[0]:.6f},{origin[1]:.6f}_{destination[0]:.6f},{destination[1]:.6f}"
        
        if cache_key in self.distance_cache:
            return self.distance_cache[cache_key]
        
        if self.api_calls_made >= self.max_api_calls:
            return geodesic(origin, destination).kilometers
        
        try:
            result = self.gmaps.distance_matrix(
                origins=[origin],
                destinations=[destination],
                mode="driving",
                units="metric"
            )
            
            self.api_calls_made += 1
            
            if result['status'] == 'OK' and result['rows'][0]['elements'][0]['status'] == 'OK':
                distance_km = result['rows'][0]['elements'][0]['distance']['value'] / 1000.0
                self.distance_cache[cache_key] = distance_km
                return distance_km
            else:
                straight_dist = geodesic(origin, destination).kilometers
                self.distance_cache[cache_key] = straight_dist
                return straight_dist
                
        except Exception as e:
            straight_dist = geodesic(origin, destination).kilometers
            self.distance_cache[cache_key] = straight_dist
            return straight_dist
    
    def find_candidate_clusters_relaxed(self, outlier_lat, outlier_lon, max_straight_line_km=5.0):
        """
        Find candidate clusters with RELAXED constraints
        
        Args:
            outlier_lat: Outlier latitude
            outlier_lon: Outlier longitude
            max_straight_line_km: Maximum straight-line distance (increased to 5km)
        """
        candidates = []
        
        # STEP 1: Pre-filter using straight-line distance (5km radius)
        straight_line_candidates = []
        for _, centroid_row in self.centroids_df.iterrows():
            centroid_lat = centroid_row['centroid_lat']
            centroid_lon = centroid_row['centroid_lon']
            cluster_id = centroid_row['cluster_id']
            current_size = centroid_row['student_count']
            
            # Skip if cluster is at max capacity (but allow up to 30 students)
            if current_size >= self.max_cluster_size:
                continue
            
            # Calculate straight-line distance
            straight_dist = geodesic((outlier_lat, outlier_lon), (centroid_lat, centroid_lon)).kilometers
            
            # Pre-filter by straight-line distance (5km radius)
            if straight_dist <= max_straight_line_km:
                straight_line_candidates.append({
                    'cluster_id': cluster_id,
                    'centroid_lat': centroid_lat,
                    'centroid_lon': centroid_lon,
                    'current_size': current_size,
                    'straight_line_distance': straight_dist,
                    'remaining_capacity': self.max_cluster_size - current_size
                })
        
        # Sort by straight-line distance and take top 8 candidates (more than before)
        straight_line_candidates.sort(key=lambda x: x['straight_line_distance'])
        top_candidates = straight_line_candidates[:8]  # Check top 8 with road distance
        
        if not top_candidates:
            return []
        
        # STEP 2: Calculate road distance for top candidates
        for candidate in top_candidates:
            if self.api_calls_made >= self.max_api_calls:
                candidate['road_distance'] = candidate['straight_line_distance']
            else:
                road_distance = self.calculate_road_distance(
                    (outlier_lat, outlier_lon),
                    (candidate['centroid_lat'], candidate['centroid_lon'])
                )
                candidate['road_distance'] = road_distance
            
            candidates.append(candidate)
        
        # Sort by road distance
        candidates.sort(key=lambda x: x['road_distance'])
        return candidates
    
    def evaluate_assignment_relaxed(self, outlier, candidate_cluster, max_road_distance_km=2.5):
        """
        Evaluate assignment with RELAXED road distance constraints
        
        Args:
            outlier: Outlier data
            candidate_cluster: Candidate cluster info
            max_road_distance_km: Maximum road distance (increased to 2.5km)
        """
        road_distance = candidate_cluster['road_distance']
        
        # RELAXED constraint: 2.5km road distance
        is_feasible = road_distance <= max_road_distance_km
        
        # Calculate assignment score (lower is better)
        capacity_penalty = candidate_cluster['current_size'] / self.max_cluster_size
        distance_penalty = road_distance / max_road_distance_km
        
        # Weight distance more heavily since we're specifically targeting distance issues
        score = (distance_penalty * 0.7) + (capacity_penalty * 0.3)
        
        return {
            'is_feasible': is_feasible,
            'road_distance_km': road_distance,
            'max_road_distance_km': max_road_distance_km,
            'assignment_score': score,
            'capacity_utilization': capacity_penalty,
            'distance_utilization': distance_penalty
        }
    
    def assign_road_distance_outliers(self, max_road_distance_km=2.5):
        """
        Main function to assign road distance outliers with relaxed constraints
        """
        print(f"🔄 Starting road distance outlier assignment...")
        print(f"📏 Max road distance constraint: {max_road_distance_km} km")
        print(f"📏 Max straight-line search radius: 5.0 km")
        print(f"👥 Max cluster size: {self.max_cluster_size} students")
        
        assignment_results = []
        successfully_assigned = 0
        still_outliers = 0
        
        # Process each road distance outlier
        for idx, outlier in tqdm(self.outliers_df.iterrows(), total=len(self.outliers_df), desc="Processing road distance outliers"):
            outlier_lat = outlier['student_lat']
            outlier_lon = outlier['student_lon']
            
            # Find candidate clusters with relaxed constraints
            candidates = self.find_candidate_clusters_relaxed(
                outlier_lat, outlier_lon, max_straight_line_km=5.0
            )
            
            if not candidates:
                # No candidates found
                result = {
                    'user': outlier['user'],
                    'email': outlier['email'],
                    'department': outlier['department'],
                    'student_lat': outlier_lat,
                    'student_lon': outlier_lon,
                    'assigned_cluster_id': -1,
                    'assignment_status': 'STILL_OUTLIER',
                    'road_distance_km': None,
                    'assignment_score': None,
                    'reason': 'No suitable clusters within 5km straight-line distance'
                }
                assignment_results.append(result)
                still_outliers += 1
                continue
            
            # Evaluate each candidate with relaxed constraints
            best_assignment = None
            best_score = float('inf')
            
            for candidate in candidates:
                evaluation = self.evaluate_assignment_relaxed(outlier, candidate, max_road_distance_km)
                
                if evaluation['is_feasible'] and evaluation['assignment_score'] < best_score:
                    best_assignment = {
                        'candidate': candidate,
                        'evaluation': evaluation
                    }
                    best_score = evaluation['assignment_score']
            
            if best_assignment:
                # Successfully assigned
                candidate = best_assignment['candidate']
                evaluation = best_assignment['evaluation']
                
                result = {
                    'user': outlier['user'],
                    'email': outlier['email'],
                    'department': outlier['department'],
                    'student_lat': outlier_lat,
                    'student_lon': outlier_lon,
                    'assigned_cluster_id': candidate['cluster_id'],
                    'assignment_status': 'ASSIGNED_WITH_RELAXED_CONSTRAINTS',
                    'road_distance_km': evaluation['road_distance_km'],
                    'assignment_score': evaluation['assignment_score'],
                    'reason': f"Assigned to cluster {candidate['cluster_id']} with {evaluation['road_distance_km']:.2f}km road distance (relaxed constraints)"
                }
                
                # Update cluster size
                self.centroids_df.loc[
                    self.centroids_df['cluster_id'] == candidate['cluster_id'], 
                    'student_count'
                ] += 1
                
                successfully_assigned += 1
            else:
                # No feasible assignment found even with relaxed constraints
                result = {
                    'user': outlier['user'],
                    'email': outlier['email'],
                    'department': outlier['department'],
                    'student_lat': outlier_lat,
                    'student_lon': outlier_lon,
                    'assigned_cluster_id': -1,
                    'assignment_status': 'STILL_OUTLIER',
                    'road_distance_km': None,
                    'assignment_score': None,
                    'reason': f'No feasible assignment found even with {max_road_distance_km}km road distance constraint'
                }
                still_outliers += 1
            
            assignment_results.append(result)
            
            # Small delay to avoid API rate limits
            if self.api_calls_made % 100 == 0:
                time.sleep(0.2)
        
        # Create results DataFrame
        results_df = pd.DataFrame(assignment_results)
        
        # Print summary
        print(f"\n📊 ROAD DISTANCE OUTLIER ASSIGNMENT SUMMARY:")
        print(f"✅ Successfully assigned: {successfully_assigned} outliers")
        print(f"❌ Still outliers: {still_outliers} outliers")
        print(f"📈 Assignment rate: {(successfully_assigned/len(self.outliers_df)*100):.1f}%")
        print(f"🔑 API calls made: {self.api_calls_made}")
        
        return results_df
    
    def save_results(self, results_df, output_file):
        """Save assignment results"""
        results_df.to_csv(output_file, index=False)
        print(f"💾 Results saved to: {output_file}")
        
        # Save updated centroids
        centroids_output = output_file.replace('.csv', '_updated_centroids.csv')
        self.centroids_df.to_csv(centroids_output, index=False)
        print(f"💾 Updated centroids saved to: {centroids_output}")
        
        return output_file, centroids_output

def main():
    # Load environment variables
    env_path = Path(__file__).parent.parent / '.env'
    load_dotenv(env_path)
    
    # File paths
    OUTLIERS_FILE = "oct2/reassigned_outliers_final_outliers.csv"
    CENTROIDS_FILE = "oct2/reassigned_outliers_updated_centroids.csv"
    OUTPUT_FILE = "oct2/road_distance_outliers_assigned.csv"
    
    # Load API key
    GOOGLE_MAPS_API_KEY = os.getenv('GOOGLE_MAPS_API_KEY')
    if not GOOGLE_MAPS_API_KEY:
        print("⚠️ GOOGLE_MAPS_API_KEY not found in .env file. Using hardcoded fallback.")
        GOOGLE_MAPS_API_KEY = "AIzaSyAiVn2TbI7qSuTzw1EKvY4urq7V5aTZkZg"
    
    print("🚀 Starting Road Distance Outlier Assignment")
    print("=" * 50)
    
    # Initialize system
    assigner = RoadDistanceOutlierAssigner(
        google_maps_api_key=GOOGLE_MAPS_API_KEY,
        max_cluster_size=30  # Increased cluster size
    )
    
    # Load data
    assigner.load_data(OUTLIERS_FILE, CENTROIDS_FILE)
    
    # Perform assignment with relaxed constraints
    results = assigner.assign_road_distance_outliers(max_road_distance_km=2.5)
    
    # Save results
    assigner.save_results(results, OUTPUT_FILE)
    
    print(f"\n🎉 Road distance outlier assignment completed!")
    print(f"📁 Check the output files for detailed results.")

if __name__ == "__main__":
    main()

