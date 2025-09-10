



import csv
import json
from datetime import datetime
from collections import defaultdict

# Configuration - Easily changeable input/output files
INPUT_CSV_FILE = "combined_data.csv"
OUTPUT_JSON_FILE = "vehicle_routes.json"

# Configuration - Time settings
START_TIME = "04:00:00"
END_TIME = "12:00:00"

def parse_datetime(date_str):
    """Parse datetime string in format 'DD/MM/YYYY HH:MM:SS'"""
    try:
        return datetime.strptime(date_str, "%d/%m/%Y %H:%M:%S")
    except ValueError:
        return None

def is_time_in_range(dt, start_time_str, end_time_str):
    """Check if the time part of datetime is within the specified range"""
    if dt is None:
        return False
    
    time_str = dt.strftime("%H:%M:%S")
    return start_time_str <= time_str <= end_time_str

def process_all_vehicles_data(csv_file, start_time, end_time):
    """
    Process CSV data for all vehicles within time range.
    Groups coordinates by vehicle.
    """
    vehicle_coordinates = defaultdict(list)
    
    try:
        with open(csv_file, 'r', encoding='utf-8') as file:
            # Use csv.Sniffer to detect delimiter with fallback
            sample = file.read(1024)
            file.seek(0)
            
            # Try to detect delimiter
            delimiter = None
            try:
                sniffer = csv.Sniffer()
                delimiter = sniffer.sniff(sample).delimiter
                print(f"Detected delimiter: '{delimiter}' (ASCII: {ord(delimiter)})")
            except csv.Error:
                # If sniffer fails, try common delimiters
                for delim in [',', ';', '\t', '|']:
                    if delim in sample:
                        delimiter = delim
                        print(f"Fallback delimiter detected: '{delimiter}' (ASCII: {ord(delimiter)})")
                        break
                
                if not delimiter:
                    raise Exception("Could not determine delimiter")
            
            reader = csv.DictReader(file, delimiter=delimiter)
            
            # Process each row
            for row in reader:
                # Get vehicle number
                vehicle_number = row.get('vehicle_number', '').strip()
                if not vehicle_number:
                    continue
                
                # Parse the datetime
                data_received = row.get('data_received', '').strip()
                dt = parse_datetime(data_received)
                
                if dt is None:
                    continue
                
                # Check if time is within the specified range
                if not is_time_in_range(dt, start_time, end_time):
                    continue
                
                # Extract coordinates
                try:
                    latitude = float(row.get('latitude', 0))
                    longitude = float(row.get('longitude', 0))
                    
                    # Skip invalid coordinates (0, 0)
                    if latitude == 0 and longitude == 0:
                        continue
                    
                    # Group by vehicle
                    vehicle_coordinates[vehicle_number].append([latitude, longitude])
                    
                except (ValueError, TypeError):
                    continue
    
    except FileNotFoundError:
        print(f"Error: File '{csv_file}' not found.")
        return {}
    except Exception as e:
        print(f"Error processing file: {e}")
        return {}
    
    return vehicle_coordinates

def create_highways_json(vehicle_coordinates):
    """
    Convert vehicle-grouped coordinates into the required JSON format.
    Creates one object per vehicle in the highways array.
    """
    highways = []
    
    for vehicle, coordinates in sorted(vehicle_coordinates.items()):
        if coordinates:  # Only add if there are coordinates
            highway_obj = {
                "coordinates": coordinates
            }
            highways.append(highway_obj)
    
    return {"highways": highways}

def save_json_file(data, output_file):
    """Save data to JSON file with proper formatting"""
    try:
        with open(output_file, 'w', encoding='utf-8') as file:
            json.dump(data, file, indent=4, ensure_ascii=False)
        print(f"JSON file saved successfully: {output_file}")
        return True
    except Exception as e:
        print(f"Error saving JSON file: {e}")
        return False

def main():
    """Main function to process CSV and generate JSON output"""
    print(f"Processing all vehicle data")
    print(f"Time range: {START_TIME} to {END_TIME}")
    print(f"Input file: {INPUT_CSV_FILE}")
    print(f"Output file: {OUTPUT_JSON_FILE}")
    print("-" * 50)
    
    # Process the CSV data
    vehicle_coordinates = process_all_vehicles_data(
        INPUT_CSV_FILE, 
        START_TIME, 
        END_TIME
    )
    
    if not vehicle_coordinates:
        print("No data found for the specified time range.")
        return
    
    # Create the JSON structure
    result = create_highways_json(vehicle_coordinates)
    
    # Print summary
    total_coordinates = sum(len(coords) for coords in vehicle_coordinates.values())
    print(f"Found {len(vehicle_coordinates)} vehicles with {total_coordinates} total coordinates")
    
    # Save to JSON file
    if save_json_file(result, OUTPUT_JSON_FILE):
        print(f"Processing completed successfully!")
    else:
        print("Failed to save output file.")

if __name__ == "__main__":
    main()
