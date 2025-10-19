import pandas as pd
import numpy as np
from geopy.distance import geodesic
import re

def calculate_distance(lat1, lon1, lat2, lon2):
    """Calculate distance between two points using geodesic distance"""
    if pd.isna(lat1) or pd.isna(lon1) or pd.isna(lat2) or pd.isna(lon2):
        return np.nan
    return geodesic((lat1, lon1), (lat2, lon2)).kilometers

def check_excluded_areas(address):
    """Check if address contains any excluded area names"""
    if pd.isna(address):
        return False
    
    # Convert to lowercase for case-insensitive matching
    address_lower = address.lower()
    
    # List of excluded areas
    excluded_areas = [
        'minjur', 'ponneri', 'uthukottai', 'chengalpattu', 'padur', 
        'cheyyar', 'vandavasi', 'uthiramerur', 'ranipet', 'arani', 
        'vellore', 'sholingur', 'thiruthani', 'nemili', 'panappakkam',
        'maraimalai nagar', 'senthamangalam'
    ]
    
    # Check if any excluded area is in the address
    for area in excluded_areas:
        if area in address_lower:
            return True
    return False

def clean_bus_data(input_file, output_file, outliers_file, college_lat=13.008742457160453, college_lon=80.0035016814702, max_distance=40):
    """
    Clean bus data by removing students outside 40km range and in excluded areas
    
    Parameters:
    - input_file: path to input CSV file
    - output_file: path to save cleaned data
    - outliers_file: path to save outliers/excluded data
    - college_lat, college_lon: college coordinates
    - max_distance: maximum distance in km (default 40)
    """
    
    # Read the CSV file
    print("Reading data...")
    df = pd.read_csv(input_file)
    
    # Convert lat/lon to numeric, handling any errors
    df['latitude'] = pd.to_numeric(df['latitude'], errors='coerce')
    df['longitude'] = pd.to_numeric(df['longitude'], errors='coerce')
    
    # Calculate distances from college
    print("Calculating distances...")
    df['distance_from_college'] = df.apply(
        lambda row: calculate_distance(row['latitude'], row['longitude'], college_lat, college_lon),
        axis=1
    )
    
    # Check for excluded areas
    print("Checking excluded areas...")
    df['in_excluded_area'] = df['address'].apply(check_excluded_areas)
    
    # Create reason for exclusion column
    df['exclusion_reason'] = ''
    df.loc[df['distance_from_college'] > max_distance, 'exclusion_reason'] += 'Distance > 40km; '
    df.loc[df['in_excluded_area'], 'exclusion_reason'] += 'In excluded area; '
    df.loc[df['distance_from_college'].isna(), 'exclusion_reason'] += 'Invalid coordinates; '
    
    # Separate clean data and outliers
    outliers_mask = (
        (df['distance_from_college'] > max_distance) | 
        (df['in_excluded_area']) | 
        (df['distance_from_college'].isna())
    )
    
    clean_data = df[~outliers_mask].copy()
    outliers_data = df[outliers_mask].copy()
    
    # Remove helper columns from clean data
    clean_data = clean_data.drop(['distance_from_college', 'in_excluded_area', 'exclusion_reason'], axis=1)
    
    # Save files
    print(f"Saving clean data to {output_file}...")
    clean_data.to_csv(output_file, index=False)
    
    print(f"Saving outliers to {outliers_file}...")
    outliers_data.to_csv(outliers_file, index=False)
    
    # Print summary
    print("\n" + "="*50)
    print("DATA CLEANING SUMMARY")
    print("="*50)
    print(f"Total records processed: {len(df)}")
    print(f"Clean records (within 40km and allowed areas): {len(clean_data)}")
    print(f"Outliers/Excluded records: {len(outliers_data)}")
    
    if len(outliers_data) > 0:
        print("\nBreakdown of exclusions:")
        distance_outliers = sum(df['distance_from_college'] > max_distance)
        area_outliers = sum(df['in_excluded_area'])
        invalid_coords = sum(df['distance_from_college'].isna())
        
        print(f"- Records beyond 40km: {distance_outliers}")
        print(f"- Records in excluded areas: {area_outliers}")
        print(f"- Records with invalid coordinates: {invalid_coords}")
        
        print(f"\nRetention rate: {len(clean_data)/len(df)*100:.1f}%")
    
    return clean_data, outliers_data

# Example usage
if __name__ == "__main__":
    # Update these paths according to your file locations
    input_file = "Route_optimizer/data_cleaning/transport_oct2.csv"  # Your input file
    output_file = "cleaned_oct2.csv"  # Clean data output
    outliers_file = "cleaned_oct2_outliers.csv"  # Outliers output
    
    try:
        clean_data, outliers = clean_bus_data(input_file, output_file, outliers_file)
        print(f"\nProcessing complete! Check {output_file} and {outliers_file}")
        
        # Display first few rows of each dataset
        print(f"\nFirst 3 rows of clean data:")
        print(clean_data.head(3))
        
        if len(outliers) > 0:
            print(f"\nFirst 3 rows of outliers:")
            print(outliers[['user', 'latitude', 'longitude', 'address', 'distance_from_college', 'exclusion_reason']].head(3))
            
    except Exception as e:
        print(f"Error processing data: {e}")
        print("Make sure your input file exists and has the correct format.")

# Additional utility function to check specific coordinates
def check_single_location(lat, lon, address="", college_lat=13.008742457160453, college_lon=80.0035016814702):
    """Check a single location against the filtering criteria"""
    distance = calculate_distance(lat, lon, college_lat, college_lon)
    in_excluded = check_excluded_areas(address)
    
    print(f"Location: {address}")
    print(f"Coordinates: ({lat}, {lon})")
    print(f"Distance from college: {distance:.2f} km")
    print(f"In excluded area: {in_excluded}")
    print(f"Would be excluded: {distance > 40 or in_excluded}")
    return distance, in_excluded