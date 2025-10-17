#!/usr/bin/env python3
"""
Final Outliers Separation Script
================================

This script separates students who couldn't be clustered even after the 
outlier reassignment process into a separate file called 'final_cluster_outliers.csv'.

Usage:
    python separate_final_outliers.py
"""

import pandas as pd
import os
from pathlib import Path

def separate_final_outliers():
    """Separate students who remain outliers after reassignment"""
    
    # File paths
    reassigned_file = "oct2/reassigned_outliers.csv"
    final_outliers_file = "oct2/final_cluster_outliers.csv"
    
    print("🔄 Separating final cluster outliers...")
    print("=" * 50)
    
    # Check if reassigned file exists
    if not os.path.exists(reassigned_file):
        print(f"❌ Error: {reassigned_file} not found!")
        print("Please run the outlier_reassignment.py script first.")
        return
    
    # Load the reassignment results
    print(f"📂 Loading reassignment results from: {reassigned_file}")
    df = pd.read_csv(reassigned_file)
    
    print(f"📊 Total students processed: {len(df)}")
    
    # Filter students who remain outliers (assignment_status == 'REMAINS_OUTLIER')
    final_outliers = df[df['assignment_status'] == 'REMAINS_OUTLIER'].copy()
    reassigned_students = df[df['assignment_status'] == 'REASSIGNED'].copy()
    
    print(f"✅ Successfully reassigned: {len(reassigned_students)} students")
    print(f"❌ Still outliers: {len(final_outliers)} students")
    
    if len(final_outliers) == 0:
        print("🎉 No final outliers found! All students were successfully reassigned.")
        return
    
    # Clean up the final outliers data
    final_outliers_clean = final_outliers.drop(['assigned_cluster_id', 'road_distance_km', 'assignment_score'], axis=1)
    
    # Add additional columns for analysis
    final_outliers_clean['outlier_type'] = 'FINAL_CLUSTER_OUTLIER'
    final_outliers_clean['processing_stage'] = 'POST_REASSIGNMENT'
    final_outliers_clean['notes'] = 'Could not be assigned to any cluster even with relaxed constraints'
    
    # Reorder columns for better readability
    column_order = [
        'user', 'email', 'department', 'student_lat', 'student_lon',
        'outlier_type', 'processing_stage', 'reason', 'notes'
    ]
    
    final_outliers_clean = final_outliers_clean[column_order]
    
    # Save final outliers
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
    
    # Calculate distance from college (approximate center)
    college_lat, college_lon = 13.008742457160453, 80.0035016814702
    
    def calculate_distance(lat, lon):
        from geopy.distance import geodesic
        return geodesic((college_lat, college_lon), (lat, lon)).kilometers
    
    final_outliers_clean['distance_from_college_km'] = final_outliers_clean.apply(
        lambda row: calculate_distance(row['student_lat'], row['student_lon']), axis=1
    )
    
    print(f"   - Distance from college: {final_outliers_clean['distance_from_college_km'].min():.1f}km to {final_outliers_clean['distance_from_college_km'].max():.1f}km")
    print(f"   - Average distance: {final_outliers_clean['distance_from_college_km'].mean():.1f}km")
    
    # Save updated file with distance information
    final_outliers_clean.to_csv(final_outliers_file, index=False)
    
    print(f"\n🎯 RECOMMENDATIONS FOR FINAL OUTLIERS:")
    print(f"   1. Create dedicated outlier routes for clusters of nearby students")
    print(f"   2. Consider alternative transport modes (metro, public bus)")
    print(f"   3. Allow students to walk to nearest served stop")
    print(f"   4. Implement flexible pickup points")
    
    print(f"\n✅ Final outliers separation completed!")
    print(f"📁 Check {final_outliers_file} for detailed analysis")

if __name__ == "__main__":
    separate_final_outliers()

