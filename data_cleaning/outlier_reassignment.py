#!/usr/bin/env python3
"""
Outlier Reassignment Script
===========================

This script attempts to reassign clustering outliers to existing clusters by:
1. Using road-based distance calculations for ALL distance measurements
2. Applying relaxed distance constraints with buffer zones
3. Maintaining meaningful cluster sizes
4. Prioritizing assignments that make geographic sense

Usage:
    python outlier_reassignment.py
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

class OutlierReassignmentSystem:
    def __init__(self, google_maps_api_key, distance_buffer_km=0.5, max_cluster_size=25):
        """
        Initialize the outlier reassignment system
        
        Args:
            google_maps_api_key: Google Maps API key for road distance calculations
            distance_buffer_km: Buffer to add to original distance constraint (default 0.5km)
            max_cluster_size: Maximum students per cluster after reassignment
        """
        self.distance_buffer_km = distance_buffer_km
        self.max_cluster_size = max_cluster_size
        self.gmaps = googlemaps.Client(key=google_maps_api_key)
        self.distance_cache = {}
        self.api_calls_made = 0
        self.max_api_calls = 4000  # Increased limit for multi-stage processing
        
        print(f"🔄 Outlier Reassignment System Initialized")
        print(f"📏 Distance buffer: +{self.distance_buffer_km} km")
        print(f"👥 Max cluster size: {self.max_cluster_size} students")
        
    def load_data(self, outliers_file, centroids_file):
        """Load outliers and existing centroids data"""
        print(f"📂 Loading outliers from: {outliers_file}")
        self.outliers_df = pd.read_csv(outliers_file)
        
        print(f"📂 Loading centroids from: {centroids_file}")
        self.centroids_df = pd.read_csv(centroids_file)
        
        # Validate data
        required_outlier_cols = ['student_lat', 'student_lon', 'user', 'email', 'department']
        required_centroid_cols = ['cluster_id', 'centroid_lat', 'centroid_lon', 'student_count']
        
        missing_outlier = [col for col in required_outlier_cols if col not in self.outliers_df.columns]
        missing_centroid = [col for col in required_centroid_cols if col not in self.centroids_df.columns]
        
        if missing_outlier:
            raise ValueError(f"Missing columns in outliers file: {missing_outlier}")
        if missing_centroid:
            raise ValueError(f"Missing columns in centroids file: {missing_centroid}")
            
        print(f"✅ Loaded {len(self.outliers_df)} outliers and {len(self.centroids_df)} existing clusters")
        return self.outliers_df, self.centroids_df
    
    def calculate_road_distance(self, origin, destination):
        """
        Calculate road distance using Google Maps API with caching
        
        Args:
            origin: (lat, lon) tuple
            destination: (lat, lon) tuple
            
        Returns:
            Road distance in kilometers
        """
        # Create cache key
        cache_key = f"{origin[0]:.6f},{origin[1]:.6f}_{destination[0]:.6f},{destination[1]:.6f}"
        
        if cache_key in self.distance_cache:
            return self.distance_cache[cache_key]
        
        if self.api_calls_made >= self.max_api_calls:
            print(f"⚠️ API limit reached. Using straight-line approximation.")
            return geodesic(origin, destination).kilometers
        
        try:
            # Use Google Maps Distance Matrix API
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
                # Fallback to straight-line distance
                straight_dist = geodesic(origin, destination).kilometers
                self.distance_cache[cache_key] = straight_dist
                return straight_dist
                
        except Exception as e:
            print(f"⚠️ API error: {e}. Using straight-line distance.")
            straight_dist = geodesic(origin, destination).kilometers
            self.distance_cache[cache_key] = straight_dist
            return straight_dist
    
    def find_candidate_clusters(self, outlier_lat, outlier_lon, max_straight_line_km=3.0):
        """
        Find candidate clusters for an outlier using SMART pre-filtering
        
        Args:
            outlier_lat: Outlier latitude
            outlier_lon: Outlier longitude
            max_straight_line_km: Maximum straight-line distance to pre-filter (default 3.0km)
            
        Returns:
            List of candidate cluster info
        """
        candidates = []
        
        # STEP 1: Pre-filter using straight-line distance (FAST, no API calls)
        straight_line_candidates = []
        for _, centroid_row in self.centroids_df.iterrows():
            centroid_lat = centroid_row['centroid_lat']
            centroid_lon = centroid_row['centroid_lon']
            cluster_id = centroid_row['cluster_id']
            current_size = centroid_row['student_count']
            
            # Skip if cluster is already at max capacity
            if current_size >= self.max_cluster_size:
                continue
            
            # Calculate straight-line distance (FAST)
            straight_dist = geodesic((outlier_lat, outlier_lon), (centroid_lat, centroid_lon)).kilometers
            
            # Pre-filter by straight-line distance
            if straight_dist <= max_straight_line_km:
                straight_line_candidates.append({
                    'cluster_id': cluster_id,
                    'centroid_lat': centroid_lat,
                    'centroid_lon': centroid_lon,
                    'current_size': current_size,
                    'straight_line_distance': straight_dist,
                    'remaining_capacity': self.max_cluster_size - current_size
                })
        
        # Sort by straight-line distance and take only top 5 candidates
        straight_line_candidates.sort(key=lambda x: x['straight_line_distance'])
        top_candidates = straight_line_candidates[:5]  # Only check top 5 with road distance
        
        if not top_candidates:
            return []
        
        # STEP 2: Calculate road distance only for top candidates (LIMITED API calls)
        for candidate in top_candidates:
            if self.api_calls_made >= self.max_api_calls:
                # Use straight-line distance if API limit reached
                candidate['road_distance'] = candidate['straight_line_distance']
            else:
                # Calculate road distance (API call)
                road_distance = self.calculate_road_distance(
                    (outlier_lat, outlier_lon),
                    (candidate['centroid_lat'], candidate['centroid_lon'])
                )
                candidate['road_distance'] = road_distance
            
            candidates.append(candidate)
        
        # Sort by road distance (closest first)
        candidates.sort(key=lambda x: x['road_distance'])
        
        return candidates
    
    def evaluate_assignment(self, outlier, candidate_cluster, original_constraint_km=1.0):
        """
        Evaluate if an outlier can be assigned to a candidate cluster
        
        Args:
            outlier: Outlier data row
            candidate_cluster: Candidate cluster info
            original_constraint_km: Original distance constraint from clustering
            
        Returns:
            Assignment score and details
        """
        # Road distance is already calculated in find_candidate_clusters
        road_distance = candidate_cluster['road_distance']
        
        # Calculate relaxed constraint (original + buffer)
        relaxed_constraint = original_constraint_km + self.distance_buffer_km
        
        # Check if assignment is feasible
        is_feasible = road_distance <= relaxed_constraint
        
        # Calculate assignment score (lower is better)
        # Factors: road distance, cluster capacity utilization
        capacity_penalty = candidate_cluster['current_size'] / self.max_cluster_size
        distance_penalty = road_distance / relaxed_constraint
        
        score = (distance_penalty * 0.6) + (capacity_penalty * 0.4)
        
        return {
            'is_feasible': is_feasible,
            'road_distance_km': road_distance,
            'relaxed_constraint_km': relaxed_constraint,
            'assignment_score': score,
            'capacity_utilization': capacity_penalty,
            'distance_utilization': distance_penalty
        }
    
    def reassign_outliers(self, original_constraint_km=1.0, max_straight_line_km=3.0):
        """
        Main function to reassign outliers to existing clusters with multi-stage approach
        
        Args:
            original_constraint_km: Original distance constraint from clustering
            max_straight_line_km: Maximum straight-line distance to consider for candidates
            
        Returns:
            DataFrame with reassignment results
        """
        print(f"🔄 Starting multi-stage outlier reassignment process...")
        print(f"📏 Original constraint: {original_constraint_km} km")
        print(f"📏 Relaxed constraint: {original_constraint_km + self.distance_buffer_km} km")
        print(f"📏 Max straight-line pre-filter: {max_straight_line_km} km")
        print(f"🔑 API call limit: {self.max_api_calls}")
        
        # STAGE 1: Standard reassignment with relaxed constraints
        print(f"\n🎯 STAGE 1: Standard reassignment with relaxed constraints...")
        stage1_results = self._reassign_stage1(original_constraint_km, max_straight_line_km)
        
        # STAGE 2: Road distance outliers with ultra-relaxed constraints
        print(f"\n🎯 STAGE 2: Road distance outliers with ultra-relaxed constraints...")
        stage2_results = self._reassign_stage2(stage1_results)
        
        # Combine results properly - replace Stage 1 outliers with Stage 2 results
        all_results = []
        stage2_users = {r['user'] for r in stage2_results}  # Track which users were processed in Stage 2
        
        for stage1_result in stage1_results:
            if stage1_result['assignment_status'] == 'STAGE1_OUTLIER' and stage1_result['user'] in stage2_users:
                # This student was processed in Stage 2, use Stage 2 result
                stage2_result = next(r for r in stage2_results if r['user'] == stage1_result['user'])
                all_results.append(stage2_result)
            elif stage1_result['assignment_status'] == 'STAGE1_OUTLIER':
                # This student failed Stage 1 and was not processed in Stage 2 - convert to FINAL_OUTLIER
                stage1_result['assignment_status'] = 'FINAL_OUTLIER'
                stage1_result['reason'] = 'No suitable clusters within 3km straight-line distance (not processed in Stage 2)'
                all_results.append(stage1_result)
            else:
                # Keep Stage 1 result (successful assignment)
                all_results.append(stage1_result)
        
        results_df = pd.DataFrame(all_results)
        
        # Print final summary
        total_assigned = len([r for r in all_results if r['assignment_status'] in ['REASSIGNED', 'ASSIGNED_WITH_RELAXED_CONSTRAINTS']])
        total_outliers = len([r for r in all_results if r['assignment_status'] == 'FINAL_OUTLIER'])
        
        print(f"\n📊 FINAL REASSIGNMENT SUMMARY:")
        print(f"✅ Successfully reassigned: {total_assigned} outliers")
        print(f"❌ Final outliers: {total_outliers} outliers")
        print(f"📈 Total reassignment rate: {(total_assigned/len(self.outliers_df)*100):.1f}%")
        print(f"🔑 Total API calls made: {self.api_calls_made}")
        
        return results_df
    
    def _reassign_stage1(self, original_constraint_km, max_straight_line_km):
        """Stage 1: Standard reassignment with relaxed constraints"""
        reassignment_results = []
        
        for idx, outlier in tqdm(self.outliers_df.iterrows(), total=len(self.outliers_df), desc="Stage 1 - Standard reassignment"):
            outlier_lat = outlier['student_lat']
            outlier_lon = outlier['student_lon']
            
            # Find candidate clusters using SMART pre-filtering
            candidates = self.find_candidate_clusters(
                outlier_lat, outlier_lon, max_straight_line_km=3.0
            )
            
            if not candidates:
                # No candidates found - remains an outlier
                result = {
                    'user': outlier['user'],
                    'email': outlier['email'],
                    'department': outlier['department'],
                    'student_lat': outlier_lat,
                    'student_lon': outlier_lon,
                    'assigned_cluster_id': -1,
                    'assignment_status': 'STAGE1_OUTLIER',
                    'road_distance_km': None,
                    'assignment_score': None,
                    'reason': 'No suitable clusters within 3km straight-line distance'
                }
                reassignment_results.append(result)
                continue
            
            # Evaluate each candidate
            best_assignment = None
            best_score = float('inf')
            
            for candidate in candidates:
                evaluation = self.evaluate_assignment(outlier, candidate, original_constraint_km)
                
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
                    'assignment_status': 'REASSIGNED',
                    'road_distance_km': evaluation['road_distance_km'],
                    'assignment_score': evaluation['assignment_score'],
                    'reason': f"Assigned to cluster {candidate['cluster_id']} with {evaluation['road_distance_km']:.2f}km distance"
                }
                
                # Update cluster size
                self.centroids_df.loc[
                    self.centroids_df['cluster_id'] == candidate['cluster_id'], 
                    'student_count'
                ] += 1
            else:
                # No feasible assignment found
                result = {
                    'user': outlier['user'],
                    'email': outlier['email'],
                    'department': outlier['department'],
                    'student_lat': outlier_lat,
                    'student_lon': outlier_lon,
                    'assigned_cluster_id': -1,
                    'assignment_status': 'STAGE1_OUTLIER',
                    'road_distance_km': None,
                    'assignment_score': None,
                    'reason': 'No feasible assignment found within relaxed constraints'
                }
            
            reassignment_results.append(result)
            
            # Small delay to avoid API rate limits
            if self.api_calls_made % 100 == 0:
                time.sleep(0.2)
        
        return reassignment_results
    
    def _reassign_stage2(self, stage1_results):
        """Stage 2: Ultra-relaxed constraints for road distance outliers"""
        # Filter students who failed in stage 1 due to road distance constraints
        road_distance_outliers = [r for r in stage1_results if r['assignment_status'] == 'STAGE1_OUTLIER' and 
                                 'relaxed constraints' in r['reason']]
        
        if not road_distance_outliers:
            return []
        
        print(f"   Processing {len(road_distance_outliers)} road distance outliers with ultra-relaxed constraints...")
        
        stage2_results = []
        
        for outlier_result in tqdm(road_distance_outliers, desc="Stage 2 - Ultra-relaxed reassignment"):
            outlier_lat = outlier_result['student_lat']
            outlier_lon = outlier_result['student_lon']
            
            # Find candidate clusters with ultra-relaxed constraints
            candidates = self._find_candidates_ultra_relaxed(outlier_lat, outlier_lon)
            
            if not candidates:
                # Still no candidates - final outlier
                outlier_result['assignment_status'] = 'FINAL_OUTLIER'
                outlier_result['reason'] = 'No suitable clusters even with ultra-relaxed constraints (5km radius, 2.5km road distance)'
                stage2_results.append(outlier_result)
                continue
            
            # Evaluate with ultra-relaxed constraints
            best_assignment = None
            best_score = float('inf')
            
            for candidate in candidates:
                evaluation = self._evaluate_ultra_relaxed(outlier_result, candidate)
                
                if evaluation['is_feasible'] and evaluation['assignment_score'] < best_score:
                    best_assignment = {
                        'candidate': candidate,
                        'evaluation': evaluation
                    }
                    best_score = evaluation['assignment_score']
            
            if best_assignment:
                # Successfully assigned with ultra-relaxed constraints
                candidate = best_assignment['candidate']
                evaluation = best_assignment['evaluation']
                
                outlier_result.update({
                    'assigned_cluster_id': candidate['cluster_id'],
                    'assignment_status': 'ASSIGNED_WITH_RELAXED_CONSTRAINTS',
                    'road_distance_km': evaluation['road_distance_km'],
                    'assignment_score': evaluation['assignment_score'],
                    'reason': f"Assigned to cluster {candidate['cluster_id']} with {evaluation['road_distance_km']:.2f}km road distance (ultra-relaxed constraints)"
                })
                
                # Update cluster size
                self.centroids_df.loc[
                    self.centroids_df['cluster_id'] == candidate['cluster_id'], 
                    'student_count'
                ] += 1
            else:
                # Still no feasible assignment - final outlier
                outlier_result['assignment_status'] = 'FINAL_OUTLIER'
                outlier_result['reason'] = 'No feasible assignment even with ultra-relaxed constraints (2.5km road distance, 30 students per cluster)'
            
            stage2_results.append(outlier_result)
            
            # Small delay to avoid API rate limits
            if self.api_calls_made % 100 == 0:
                time.sleep(0.2)
        
        return stage2_results
    
    def _find_candidates_ultra_relaxed(self, outlier_lat, outlier_lon, max_straight_line_km=5.0):
        """Find candidates with ultra-relaxed constraints (5km radius, 30 students per cluster)"""
        candidates = []
        
        # Pre-filter using straight-line distance (5km radius)
        straight_line_candidates = []
        for _, centroid_row in self.centroids_df.iterrows():
            centroid_lat = centroid_row['centroid_lat']
            centroid_lon = centroid_row['centroid_lon']
            cluster_id = centroid_row['cluster_id']
            current_size = centroid_row['student_count']
            
            # Allow up to 30 students per cluster
            if current_size >= 30:
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
                    'remaining_capacity': 30 - current_size
                })
        
        # Sort by straight-line distance and take top 8 candidates
        straight_line_candidates.sort(key=lambda x: x['straight_line_distance'])
        top_candidates = straight_line_candidates[:8]
        
        if not top_candidates:
            return []
        
        # Calculate road distance for top candidates
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
    
    def _evaluate_ultra_relaxed(self, outlier, candidate_cluster, max_road_distance_km=2.5):
        """Evaluate assignment with ultra-relaxed constraints (2.5km road distance, 30 students per cluster)"""
        road_distance = candidate_cluster['road_distance']
        
        # Ultra-relaxed constraint: 2.5km road distance
        is_feasible = road_distance <= max_road_distance_km
        
        # Calculate assignment score
        capacity_penalty = candidate_cluster['current_size'] / 30  # 30 students max
        distance_penalty = road_distance / max_road_distance_km
        
        # Weight distance more heavily
        score = (distance_penalty * 0.7) + (capacity_penalty * 0.3)
        
        return {
            'is_feasible': is_feasible,
            'road_distance_km': road_distance,
            'max_road_distance_km': max_road_distance_km,
            'assignment_score': score,
            'capacity_utilization': capacity_penalty,
            'distance_utilization': distance_penalty
        }
    
    def save_results(self, results_df, output_file):
        """Save reassignment results to CSV and separate final outliers"""
        results_df.to_csv(output_file, index=False)
        print(f"💾 Results saved to: {output_file}")
        
        # Save updated centroids
        centroids_output = output_file.replace('.csv', '_updated_centroids.csv')
        self.centroids_df.to_csv(centroids_output, index=False)
        print(f"💾 Updated centroids saved to: {centroids_output}")
        
        # Separate final outliers
        self.separate_final_outliers(results_df, output_file)
        
        return output_file, centroids_output
    
    def separate_final_outliers(self, results_df, output_file):
        """Separate students who remain outliers after reassignment"""
        print(f"\n🔄 Separating final cluster outliers...")
        
        # Filter students who remain outliers (FINAL_OUTLIER status)
        final_outliers = results_df[results_df['assignment_status'] == 'FINAL_OUTLIER'].copy()
        
        if len(final_outliers) == 0:
            print("🎉 No final outliers found! All students were successfully reassigned.")
            return
        
        # Clean up the final outliers data
        final_outliers_clean = final_outliers.drop(['assigned_cluster_id', 'road_distance_km', 'assignment_score'], axis=1)
        
        # Add additional columns for analysis
        final_outliers_clean['outlier_type'] = 'FINAL_CLUSTER_OUTLIER'
        final_outliers_clean['processing_stage'] = 'POST_MULTI_STAGE_REASSIGNMENT'
        final_outliers_clean['notes'] = 'Could not be assigned to any cluster even with ultra-relaxed constraints'
        
        # Calculate distance from college
        college_lat, college_lon = 13.008742457160453, 80.0035016814702
        
        def calculate_distance(lat, lon):
            return geodesic((college_lat, college_lon), (lat, lon)).kilometers
        
        final_outliers_clean['distance_from_college_km'] = final_outliers_clean.apply(
            lambda row: calculate_distance(row['student_lat'], row['student_lon']), axis=1
        )
        
        # Reorder columns for better readability
        column_order = [
            'user', 'email', 'department', 'student_lat', 'student_lon',
            'outlier_type', 'processing_stage', 'reason', 'notes', 'distance_from_college_km'
        ]
        
        final_outliers_clean = final_outliers_clean[column_order]
        
        # Save final outliers
        final_outliers_file = output_file.replace('.csv', '_final_outliers.csv')
        final_outliers_clean.to_csv(final_outliers_file, index=False)
        
        print(f"💾 Final outliers saved to: {final_outliers_file}")
        
        # Create summary statistics
        print(f"\n📊 FINAL OUTLIERS SUMMARY:")
        print(f"   - Total final outliers: {len(final_outliers_clean)}")
        print(f"   - Students per department:")
        
        dept_counts = final_outliers_clean['department'].value_counts()
        for dept, count in dept_counts.items():
            print(f"     • {dept}: {count} students")
        
        # Analyze reasons for remaining outliers
        print(f"\n🔍 REASONS FOR REMAINING OUTLIERS:")
        reason_counts = final_outliers['reason'].value_counts()
        for reason, count in reason_counts.items():
            print(f"   - {reason}: {count} students")
        
        # Geographic analysis
        print(f"\n📍 GEOGRAPHIC ANALYSIS:")
        print(f"   - Latitude range: {final_outliers_clean['student_lat'].min():.6f} to {final_outliers_clean['student_lat'].max():.6f}")
        print(f"   - Longitude range: {final_outliers_clean['student_lon'].min():.6f} to {final_outliers_clean['student_lon'].max():.6f}")
        print(f"   - Distance from college: {final_outliers_clean['distance_from_college_km'].min():.1f}km to {final_outliers_clean['distance_from_college_km'].max():.1f}km")
        print(f"   - Average distance: {final_outliers_clean['distance_from_college_km'].mean():.1f}km")
        
        print(f"\n🎯 RECOMMENDATIONS FOR FINAL OUTLIERS:")
        print(f"   1. Create dedicated outlier routes for clusters of nearby students")
        print(f"   2. Consider alternative transport modes (metro, public bus)")
        print(f"   3. Allow students to walk to nearest served stop")
        print(f"   4. Implement flexible pickup points")

def main():
    # Load environment variables from .env file (look in parent directory)
    env_path = Path(__file__).parent.parent / '.env'
    load_dotenv(env_path)
    
    # File paths - modify these as needed
    OUTLIERS_FILE = "oct2/cleaned_oct2_outliers.csv"
    CENTROIDS_FILE = "oct2/cleaned_oct2_centroids.csv"
    OUTPUT_FILE = "oct2/reassigned_outliers.csv"
    
    # Load configuration from environment variables (with fallback)
    GOOGLE_MAPS_API_KEY = os.getenv('GOOGLE_MAPS_API_KEY')
    if not GOOGLE_MAPS_API_KEY:
        print("⚠️ GOOGLE_MAPS_API_KEY not found in .env file. Using hardcoded fallback.")
        GOOGLE_MAPS_API_KEY = "AIzaSyAiVn2TbI7qSuTzw1EKvY4urq7V5aTZkZg"
    
    # Configuration parameters from .env file
    DISTANCE_BUFFER_KM = float(os.getenv('DISTANCE_BUFFER_KM', 0.5))
    MAX_CLUSTER_SIZE = int(os.getenv('MAX_CLUSTER_SIZE', 25))
    ORIGINAL_CONSTRAINT_KM = float(os.getenv('ORIGINAL_CONSTRAINT_KM', 1.0))
    MAX_ROAD_DISTANCE_KM = float(os.getenv('MAX_ROAD_DISTANCE_KM', 2.5))
    
    print("🚀 Starting Outlier Reassignment Process")
    print("=" * 50)
    
    # Initialize system
    system = OutlierReassignmentSystem(
        google_maps_api_key=GOOGLE_MAPS_API_KEY,
        distance_buffer_km=DISTANCE_BUFFER_KM,
        max_cluster_size=MAX_CLUSTER_SIZE
    )
    
    # Load data
    system.load_data(OUTLIERS_FILE, CENTROIDS_FILE)
    
    # Perform reassignment
    results = system.reassign_outliers(
        original_constraint_km=ORIGINAL_CONSTRAINT_KM,
        max_straight_line_km=MAX_ROAD_DISTANCE_KM
    )
    
    # Save results
    system.save_results(results, OUTPUT_FILE)
    
    print(f"\n🎉 Outlier reassignment completed!")
    print(f"📁 Check the output files for detailed results:")
    print(f"   - Reassignment results: {OUTPUT_FILE}")
    print(f"   - Updated centroids: {OUTPUT_FILE.replace('.csv', '_updated_centroids.csv')}")
    print(f"   - Final outliers: {OUTPUT_FILE.replace('.csv', '_final_outliers.csv')}")

if __name__ == "__main__":
    main()

# Command to run this script:
# cd /Users/mahaashreeanburaj/final_routes/Route_optimizer/data_cleaning
# python outlier_reassignment.py