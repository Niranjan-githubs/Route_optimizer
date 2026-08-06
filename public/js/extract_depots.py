#!/usr/bin/env python3
"""
Extract depot locations from GPS tracking data.
Depots are identified as the last GPS points for each vehicle (where buses rest),
excluding the college coordinates.
"""

import pandas as pd
import numpy as np
from math import radians, cos, sin, asin, sqrt

def haversine_distance(lat1, lon1, lat2, lon2):
    """
    Calculate the great circle distance between two points 
    on the earth (specified in decimal degrees)
    Returns distance in kilometers
    """
    # Convert decimal degrees to radians
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    
    # Haversine formula
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * asin(sqrt(a))
    
    # Radius of earth in kilometers
    r = 6371
    return c * r

def extract_depot_locations(csv_file_path, college_lat=13.008742457160453, college_lon=80.00349095262305, 
                          college_radius_km=0.5, output_file="depot_locations.csv"):
    """
    Extract depot locations from GPS tracking data.
    
    Args:
        csv_file_path: Path to the combined_data.csv file
        college_lat: College latitude
        college_lon: College longitude  
        college_radius_km: Radius around college to exclude (in km)
        output_file: Output CSV file for depot locations
    """
    
    print("🚌 Extracting depot locations from GPS tracking data...")
    print(f"📍 College coordinates: {college_lat}, {college_lon}")
    print(f"🚫 Excluding points within {college_radius_km}km of college")
    
    # Read the CSV file
    print("📂 Loading GPS data...")
    df = pd.read_csv(csv_file_path)
    
    print(f"✅ Loaded {len(df)} GPS records")
    print(f"�� Found {df['vehicle_number'].nunique()} unique vehicles")
    
    # Clean vehicle numbers (remove spaces)
    df['vehicle_number'] = df['vehicle_number'].str.replace(' ', '')
    
    # Convert timestamps
    df['data_received'] = pd.to_datetime(df['data_received'], format='%d/%m/%Y %H:%M:%S')
    
    # Sort by vehicle and timestamp
    df = df.sort_values(['vehicle_number', 'data_received'])
    
    # Get the last GPS point for each vehicle (depot location)
    print("🔍 Finding last GPS points for each vehicle...")
    last_points = df.groupby('vehicle_number').tail(1).copy()
    
    print(f"📍 Found {len(last_points)} potential depot locations")
    
    # Filter out points near college
    print("🚫 Filtering out college area...")
    last_points['distance_from_college'] = last_points.apply(
        lambda row: haversine_distance(
            college_lat, college_lon, 
            row['latitude'], row['longitude']
        ), axis=1
    )
    
    # Keep only points outside college radius
    depot_locations = last_points[last_points['distance_from_college'] > college_radius_km].copy()
    
    print(f"✅ Found {len(depot_locations)} depot locations (excluding college area)")
    
    # Add some analysis
    depot_locations['depot_id'] = range(1, len(depot_locations) + 1)
    
    # Calculate distance from college for each depot
    depot_locations['distance_from_college_km'] = depot_locations['distance_from_college'].round(2)
    
    # Create final output
    output_columns = [
        'depot_id',
        'vehicle_number', 
        'latitude',
        'longitude',
        'distance_from_college_km',
        'data_received',
        'device_id',
        'total_distance',
        'fuel'
    ]
    
    depot_output = depot_locations[output_columns].copy()
    depot_output = depot_output.rename(columns={
        'data_received': 'last_seen_time',
        'total_distance': 'odometer_reading',
        'fuel': 'fuel_level'
    })
    
    # Sort by distance from college
    depot_output = depot_output.sort_values('distance_from_college_km')
    
    # Save to CSV
    depot_output.to_csv(output_file, index=False)
    
    print(f"💾 Depot locations saved to: {output_file}")
    
    # Print summary
    print("\n" + "="*60)
    print("🏁 DEPOT EXTRACTION SUMMARY")
    print("="*60)
    print(f"Total vehicles processed: {df['vehicle_number'].nunique()}")
    print(f"Depot locations found: {len(depot_output)}")
    print(f"Points excluded (near college): {len(last_points) - len(depot_output)}")
    print(f"Average distance from college: {depot_output['distance_from_college_km'].mean():.1f} km")
    print(f"Closest depot: {depot_output['distance_from_college_km'].min():.1f} km")
    print(f"Farthest depot: {depot_output['distance_from_college_km'].max():.1f} km")
    
    print("\n📍 DEPOT LOCATIONS:")
    for _, depot in depot_output.iterrows():
        print(f"  Depot {depot['depot_id']}: {depot['vehicle_number']} - "
              f"({depot['latitude']:.6f}, {depot['longitude']:.6f}) - "
              f"{depot['distance_from_college_km']:.1f}km from college")
    
    print("="*60)
    
    return depot_output

def main():
    # Configuration
    csv_file = "/Users/mahaashreeanburaj/final_routes/Route_optimizer/js/combined_data.csv"
    college_lat = 13.008742457160453
    college_lon = 80.00349095262305
    college_radius_km = 0.5  # 500m radius around college
    
    try:
        # Extract depot locations
        depots = extract_depot_locations(
            csv_file_path=csv_file,
            college_lat=college_lat,
            college_lon=college_lon,
            college_radius_km=college_radius_km,
            output_file="depot_locations.csv"
        )
        
        print(f"\n✅ Successfully extracted {len(depots)} depot locations!")
        print("📁 Output saved as 'depot_locations.csv'")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()