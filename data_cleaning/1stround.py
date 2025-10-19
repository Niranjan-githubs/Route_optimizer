import pandas as pd
import numpy as np
import re
from typing import List, Tuple, Dict

# Define coordinate bounding boxes for areas to exclude
# Format: {'area_name': {'min_lat': float, 'max_lat': float, 'min_lng': float, 'max_lng': float}}
EXCLUDED_AREA_BOUNDS = {
    'Minjur': {
        'min_lat': 13.2650, 'max_lat': 13.2950,
        'min_lng': 80.2450, 'max_lng': 80.2750
    },
    'Ponneri': {
        'min_lat': 13.3300, 'max_lat': 13.3600,
        'min_lng': 80.1900, 'max_lng': 80.2200
    },
    'Uthukottai': {
        'min_lat': 13.2050, 'max_lat': 13.2350,
        'min_lng': 79.8200, 'max_lng': 79.8500
    },
    'Chengalpattu': {
        'min_lat': 12.6800, 'max_lat': 12.7200,
        'min_lng': 79.9700, 'max_lng': 80.0100
    },
    'Padur': {
        'min_lat': 12.7900, 'max_lat': 12.8200,
        'min_lng': 80.1600, 'max_lng': 80.1900
    },
    'Cheyyar': {
        'min_lat': 12.6500, 'max_lat': 12.6900,
        'min_lng': 79.5400, 'max_lng': 79.5800
    },
    'Vandavasi': {
        'min_lat': 12.4800, 'max_lat': 12.5200,
        'min_lng': 79.5800, 'max_lng': 79.6200
    },
    'Uthiramerur': {
        'min_lat': 12.6100, 'max_lat': 12.6500,
        'min_lng': 79.7500, 'max_lng': 79.7900
    },
    'Ranipet': {
        'min_lat': 12.9100, 'max_lat': 12.9500,
        'min_lng': 79.3200, 'max_lng': 79.3600
    },
    'Arani': {
        'min_lat': 12.6600, 'max_lat': 12.7000,
        'min_lng': 79.2700, 'max_lng': 79.3100
    },
    'Vellore': {
        'min_lat': 12.9000, 'max_lat': 12.9400,
        'min_lng': 79.1200, 'max_lng': 79.1600
    },
    'Sholingur': {
        'min_lat': 13.1100, 'max_lat': 13.1500,
        'min_lng': 79.4100, 'max_lng': 79.4500
    },
    'Thiruthani': {
        'min_lat': 13.1700, 'max_lat': 13.2100,
        'min_lng': 79.6300, 'max_lng': 79.6700
    },
    'Nemili_Panappakkam': {
        'min_lat': 12.8800, 'max_lat': 12.9200,
        'min_lng': 79.5800, 'max_lng': 79.6200
    },
    'Maraimalai_Nagar': {
        'min_lat': 12.7800, 'max_lat': 12.8200,
        'min_lng': 80.0100, 'max_lng': 80.0500
    },
    'Senthamangalam': {
        'min_lat': 13.0800, 'max_lat': 13.1200,
        'min_lng': 79.4500, 'max_lng': 79.4900
    }
}

def load_and_parse_csv(file_path: str) -> pd.DataFrame:
    """
    Load and parse the CSV file with the given format.
    The CSV appears to have bus_no as bold headers followed by data rows.
    """
    try:
        # Read the raw file to handle the special format
        with open(file_path, 'r', encoding='utf-8') as file:
            lines = file.readlines()
        
        # Parse the data
        data = []
        current_bus_no = None
        
        for line in lines:
            line = line.strip()
            
            # Skip empty lines and headers
            if not line or line.startswith('**') and ('user' in line or 'boarding_point_name' in line or 'pincode' in line):
                continue
            
            # Check if line contains bus number (bold format **number**)
            bus_match = re.match(r'\*\*(\d+)\*\*', line)
            if bus_match:
                current_bus_no = bus_match.group(1)
                continue
            
            # If we have a current bus number and the line contains data
            if current_bus_no and line and not line.startswith('**'):
                # Split the line and try to parse coordinates
                parts = line.split()
                
                # Look for pincode (6-digit number)
                pincode = None
                latitude = None
                longitude = None
                address = ""
                
                for i, part in enumerate(parts):
                    # Check for 6-digit pincode
                    if re.match(r'^\d{6}$', part):
                        pincode = part
                        # Next parts should be coordinates
                        if i + 1 < len(parts):
                            try:
                                latitude = float(parts[i + 1])
                            except ValueError:
                                pass
                        if i + 2 < len(parts):
                            try:
                                longitude = float(parts[i + 2])
                                # Everything after coordinates is address
                                if i + 3 < len(parts):
                                    address = ' '.join(parts[i + 3:])
                            except ValueError:
                                pass
                        break
                
                if pincode and latitude and longitude:
                    data.append({
                        'bus_no': current_bus_no,
                        'boarding_point_name': '',  # Not clearly defined in the format
                        'pincode': pincode,
                        'latitude': latitude,
                        'longitude': longitude,
                        'address': address
                    })
        
        return pd.DataFrame(data)
    
    except FileNotFoundError:
        print(f"Error: File '{file_path}' not found.")
        return pd.DataFrame()
    except Exception as e:
        print(f"Error reading file: {e}")
        return pd.DataFrame()

def load_standard_csv(file_path: str) -> pd.DataFrame:
    """
    Load standard CSV format.
    """
    try:
        df = pd.read_csv(file_path)
        # Clean column names
        df.columns = df.columns.str.strip()
        return df
    except Exception as e:
        print(f"Error reading standard CSV: {e}")
        return pd.DataFrame()

def point_in_bounds(lat: float, lng: float, bounds: Dict[str, float]) -> bool:
    """
    Check if a point (lat, lng) falls within the given bounds.
    """
    return (bounds['min_lat'] <= lat <= bounds['max_lat'] and 
            bounds['min_lng'] <= lng <= bounds['max_lng'])

def identify_coordinate_outliers(df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """
    Identify outliers based on coordinate bounding boxes for excluded areas.
    """
    outliers = []
    clean_data = []
    
    for idx, row in df.iterrows():
        try:
            lat = float(row['latitude'])
            lng = float(row['longitude'])
            
            is_outlier = False
            outlier_reason = ""
            
            # Check if coordinates fall within any excluded area
            for area_name, bounds in EXCLUDED_AREA_BOUNDS.items():
                if point_in_bounds(lat, lng, bounds):
                    is_outlier = True
                    outlier_reason = f"Out of range - deleted route (coordinates within {area_name.replace('_', '-')} bounds)"
                    break
            
            row_dict = row.to_dict()
            if is_outlier:
                row_dict['outlier_reason'] = outlier_reason
                outliers.append(row_dict)
            else:
                clean_data.append(row_dict)
                
        except (ValueError, TypeError) as e:
            # Invalid coordinates - treat as outlier
            row_dict = row.to_dict()
            row_dict['outlier_reason'] = f"Invalid coordinates - {str(e)}"
            outliers.append(row_dict)
    
    clean_df = pd.DataFrame(clean_data)
    outliers_df = pd.DataFrame(outliers)
    
    return clean_df, outliers_df

def update_area_bounds():
    """
    Function to help update coordinate bounds for areas.
    You can use this to add or modify area boundaries.
    """
    print("Current excluded area bounds:")
    print("="*50)
    for area, bounds in EXCLUDED_AREA_BOUNDS.items():
        print(f"{area.replace('_', ' ')}:")
        print(f"  Latitude: {bounds['min_lat']} to {bounds['max_lat']}")
        print(f"  Longitude: {bounds['min_lng']} to {bounds['max_lng']}")
        print()

def add_custom_area_bounds(area_name: str, min_lat: float, max_lat: float, 
                          min_lng: float, max_lng: float):
    """
    Add custom area bounds for additional exclusion zones.
    """
    EXCLUDED_AREA_BOUNDS[area_name] = {
        'min_lat': min_lat,
        'max_lat': max_lat,
        'min_lng': min_lng,
        'max_lng': max_lng
    }
    print(f"Added bounds for {area_name}")

def visualize_outliers_by_area(outliers_df: pd.DataFrame):
    """
    Show breakdown of outliers by area.
    """
    if not outliers_df.empty:
        print("\nOutlier breakdown by area:")
        print("-" * 30)
        area_counts = {}
        
        for reason in outliers_df['outlier_reason']:
            if 'coordinates within' in reason:
                area = reason.split('coordinates within ')[1].split(' bounds')[0]
                area_counts[area] = area_counts.get(area, 0) + 1
            else:
                area_counts['Invalid coordinates'] = area_counts.get('Invalid coordinates', 0) + 1
        
        for area, count in sorted(area_counts.items()):
            print(f"{area}: {count} records")

def clean_bus_data(input_file: str, output_clean: str = 'cleaned_bus_data.csv', 
                   output_outliers: str = '1stround_outliers.csv', use_standard_csv: bool = False):
    """
    Main function to clean bus data using coordinate-based filtering.
    """
    print("Bus Route Data Cleaner (Coordinate-based)")
    print("="*45)
    
    # Load data
    if use_standard_csv:
        print("Loading standard CSV format...")
        df = load_standard_csv(input_file)
    else:
        print("Loading custom format CSV...")
        df = load_and_parse_csv(input_file)
    
    if df.empty:
        print("No data found or error in parsing. Please check your input file.")
        return
    
    print(f"Loaded {len(df)} records")
    print(f"Columns: {list(df.columns)}")
    
    # Validate required columns
    required_columns = ['latitude', 'longitude']
    missing_cols = [col for col in required_columns if col not in df.columns]
    if missing_cols:
        print(f"Error: Missing required columns: {missing_cols}")
        return
    
    # Remove any duplicate entries
    df_deduplicated = df.drop_duplicates()
    duplicates_removed = len(df) - len(df_deduplicated)
    if duplicates_removed > 0:
        print(f"Removed {duplicates_removed} duplicate records")
    
    # Show current area bounds
    print(f"\nExcluding coordinates from {len(EXCLUDED_AREA_BOUNDS)} areas:")
    for area in EXCLUDED_AREA_BOUNDS.keys():
        print(f"  - {area.replace('_', ' ')}")
    
    # Identify outliers using coordinate bounds
    print("\nIdentifying outliers using coordinate bounds...")
    clean_df, outliers_df = identify_coordinate_outliers(df_deduplicated)
    
    print(f"Clean data: {len(clean_df)} records")
    print(f"Outliers: {len(outliers_df)} records")
    
    # Save clean data
    if not clean_df.empty:
        clean_df.to_csv(output_clean, index=False)
        print(f"Clean data saved to: {output_clean}")
        
        # Display sample of clean data
        print("\nSample of clean data:")
        print(clean_df.head())
    
    # Save outliers
    if not outliers_df.empty:
        outliers_df.to_csv(output_outliers, index=False)
        print(f"Outliers saved to: {output_outliers}")
        
        # Show outlier breakdown
        visualize_outliers_by_area(outliers_df)
    else:
        print("No outliers found!")
    
    # Data quality summary
    print("\n" + "="*50)
    print("DATA QUALITY SUMMARY")
    print("="*50)
    
    if not clean_df.empty:
        print(f"Total original records: {len(df)}")
        print(f"Duplicates removed: {duplicates_removed}")
        print(f"Outliers removed: {len(outliers_df)}")
        print(f"Final clean records: {len(clean_df)}")
        print(f"Data retention rate: {len(clean_df)/len(df)*100:.1f}%")
        
        # Coordinate range check for clean data
        print(f"\nCoordinate ranges in clean data:")
        print(f"Latitude: {clean_df['latitude'].min():.4f} to {clean_df['latitude'].max():.4f}")
        print(f"Longitude: {clean_df['longitude'].min():.4f} to {clean_df['longitude'].max():.4f}")
        
        # Check if coordinates are within typical Chennai bounds
        chennai_bounds = {'min_lat': 12.7, 'max_lat': 13.3, 'min_lng': 79.9, 'max_lng': 80.3}
        clean_coords = clean_df[(clean_df['latitude'] >= chennai_bounds['min_lat']) & 
                               (clean_df['latitude'] <= chennai_bounds['max_lat']) &
                               (clean_df['longitude'] >= chennai_bounds['min_lng']) & 
                               (clean_df['longitude'] <= chennai_bounds['max_lng'])]
        
        print(f"Records within Chennai metro bounds: {len(clean_coords)} ({len(clean_coords)/len(clean_df)*100:.1f}%)")
        
        if 'bus_no' in clean_df.columns:
            print(f"Unique bus numbers: {clean_df['bus_no'].nunique()}")

if __name__ == "__main__":
    # Configuration
    INPUT_FILE = "data_cleaning/TransportMasterAll.csv"  # Change this to your input file name
    OUTPUT_CLEAN = "1stround_master.csv"
    OUTPUT_OUTLIERS = "1stround_master_outliers.csv"
    
    # Set to True if your CSV is in standard format with proper headers and commas
    USE_STANDARD_CSV = True
    
    # Run the cleaner
    clean_bus_data(INPUT_FILE, OUTPUT_CLEAN, OUTPUT_OUTLIERS, USE_STANDARD_CSV)
    
    # Uncomment to see current area bounds
    # update_area_bounds()
    
    # Uncomment to validate coordinates with current bounds
    # validate_coordinates_with_gmaps()
    
    # Example: Add custom area bounds
    # add_custom_area_bounds("Custom_Area", 12.5, 12.6, 79.8, 79.9)
    
    # Example: Create bounds from center point and radius
    # center_bounds = get_area_bounds_from_center(12.9320, 79.3335, 3.0)  # Ranipet with 3km radius
    # print("Ranipet 3km radius bounds:", center_bounds)