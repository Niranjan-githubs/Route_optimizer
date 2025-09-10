import csv
import os
from datetime import datetime

# Configuration - Easily changeable input file
INPUT_CSV_FILE = "combined_data.csv"

class CSVValidator:
    def __init__(self, file_path):
        self.file_path = file_path
        self.errors = []
        self.warnings = []
        self.delimiter = None
        self.total_rows = 0
        self.valid_rows = 0
        self.headers = []
        
    def validate(self):
        """Main validation method"""
        print(f"Validating CSV file: {self.file_path}")
        print("-" * 50)
        
        # Check if file exists
        if not self._check_file_exists():
            return False
            
        # Detect delimiter and validate structure
        if not self._detect_delimiter():
            return False
            
        # Validate content
        self._validate_content()
        
        # Print results
        self._print_results()
        
        return len(self.errors) == 0
    
    def _check_file_exists(self):
        """Check if the CSV file exists"""
        if not os.path.exists(self.file_path):
            self.errors.append(f"File not found: {self.file_path}")
            return False
        
        if not os.path.isfile(self.file_path):
            self.errors.append(f"Path is not a file: {self.file_path}")
            return False
            
        return True
    
    def _detect_delimiter(self):
        """Detect the CSV delimiter"""
        try:
            with open(self.file_path, 'r', encoding='utf-8') as file:
                # Read a sample to detect delimiter
                sample = file.read(1024)
                if not sample:
                    self.errors.append("File is empty")
                    return False
                
                # Reset file pointer
                file.seek(0)
                
                # Try to detect delimiter
                sniffer = csv.Sniffer()
                try:
                    self.delimiter = sniffer.sniff(sample).delimiter
                    print(f"Detected delimiter: '{self.delimiter}' (ASCII: {ord(self.delimiter)})")
                except csv.Error:
                    # If sniffer fails, try common delimiters
                    for delim in [',', ';', '\t', '|']:
                        if delim in sample:
                            self.delimiter = delim
                            print(f"Fallback delimiter detected: '{self.delimiter}' (ASCII: {ord(self.delimiter)})")
                            break
                    
                    if not self.delimiter:
                        self.errors.append("Could not detect CSV delimiter")
                        return False
                
                # Try to read the first row to get headers
                file.seek(0)
                try:
                    reader = csv.reader(file, delimiter=self.delimiter)
                    self.headers = next(reader)
                    print(f"Headers found: {self.headers}")
                    print(f"Number of columns: {len(self.headers)}")
                except StopIteration:
                    self.errors.append("File contains no data rows")
                    return False
                except csv.Error as e:
                    self.errors.append(f"Error reading headers: {e}")
                    return False
                    
        except UnicodeDecodeError as e:
            self.errors.append(f"File encoding error: {e}")
            return False
        except Exception as e:
            self.errors.append(f"Unexpected error reading file: {e}")
            return False
            
        return True
    
    def _validate_content(self):
        """Validate the content of each row"""
        expected_columns = len(self.headers)
        
        try:
            with open(self.file_path, 'r', encoding='utf-8') as file:
                reader = csv.reader(file, delimiter=self.delimiter)
                
                # Skip header row
                next(reader)
                
                for row_num, row in enumerate(reader, start=2):  # Start at 2 since header is row 1
                    self.total_rows += 1
                    row_valid = True
                    
                    # Check column count
                    if len(row) != expected_columns:
                        self.errors.append(f"Line {row_num}: Expected {expected_columns} columns, found {len(row)} columns")
                        row_valid = False
                        continue
                    
                    # Create a dictionary for easier access
                    row_dict = dict(zip(self.headers, row))
                    
                    # Validate specific fields if they exist
                    if 'vehicle_number' in row_dict:
                        if not row_dict['vehicle_number'].strip():
                            self.warnings.append(f"Line {row_num}: Empty vehicle_number")
                    
                    if 'data_received' in row_dict:
                        if not self._validate_datetime(row_dict['data_received'], row_num):
                            row_valid = False
                    
                    if 'latitude' in row_dict:
                        if not self._validate_coordinate(row_dict['latitude'], 'latitude', row_num, -90, 90):
                            row_valid = False
                    
                    if 'longitude' in row_dict:
                        if not self._validate_coordinate(row_dict['longitude'], 'longitude', row_num, -180, 180):
                            row_valid = False
                    
                    if 'speed' in row_dict:
                        if not self._validate_numeric(row_dict['speed'], 'speed', row_num, min_val=0):
                            row_valid = False
                    
                    if 'total_distance' in row_dict:
                        if not self._validate_numeric(row_dict['total_distance'], 'total_distance', row_num, min_val=0):
                            row_valid = False
                    
                    if 'fuel' in row_dict:
                        if not self._validate_numeric(row_dict['fuel'], 'fuel', row_num, min_val=0):
                            row_valid = False
                    
                    if row_valid:
                        self.valid_rows += 1
                        
        except Exception as e:
            self.errors.append(f"Error validating content: {e}")
    
    def _validate_datetime(self, date_str, row_num):
        """Validate datetime format 'DD/MM/YYYY HH:MM:SS'"""
        if not date_str.strip():
            self.warnings.append(f"Line {row_num}: Empty data_received field")
            return True  # Don't count as error, just warning
        
        try:
            datetime.strptime(date_str.strip(), "%d/%m/%Y %H:%M:%S")
            return True
        except ValueError:
            self.errors.append(f"Line {row_num}: Invalid datetime format '{date_str}'. Expected 'DD/MM/YYYY HH:MM:SS'")
            return False
    
    def _validate_coordinate(self, coord_str, coord_name, row_num, min_val, max_val):
        """Validate latitude or longitude"""
        if not coord_str.strip():
            self.warnings.append(f"Line {row_num}: Empty {coord_name} field")
            return True  # Don't count as error for empty coordinates
        
        try:
            coord_val = float(coord_str.strip())
            if coord_val < min_val or coord_val > max_val:
                self.errors.append(f"Line {row_num}: {coord_name} '{coord_val}' out of valid range ({min_val} to {max_val})")
                return False
            return True
        except ValueError:
            self.errors.append(f"Line {row_num}: Invalid {coord_name} value '{coord_str}'. Must be a number.")
            return False
    
    def _validate_numeric(self, value_str, field_name, row_num, min_val=None, max_val=None):
        """Validate numeric fields"""
        if not value_str.strip():
            self.warnings.append(f"Line {row_num}: Empty {field_name} field")
            return True  # Don't count as error for empty numeric fields
        
        try:
            value = float(value_str.strip())
            if min_val is not None and value < min_val:
                self.warnings.append(f"Line {row_num}: {field_name} '{value}' is below expected minimum ({min_val})")
            if max_val is not None and value > max_val:
                self.warnings.append(f"Line {row_num}: {field_name} '{value}' is above expected maximum ({max_val})")
            return True
        except ValueError:
            self.errors.append(f"Line {row_num}: Invalid {field_name} value '{value_str}'. Must be a number.")
            return False
    
    def _print_results(self):
        """Print validation results"""
        print("\n" + "="*50)
        print("VALIDATION RESULTS")
        print("="*50)
        
        print(f"File: {self.file_path}")
        print(f"Delimiter: '{self.delimiter}' (ASCII: {ord(self.delimiter) if self.delimiter else 'N/A'})")
        print(f"Headers: {self.headers}")
        print(f"Total rows processed: {self.total_rows}")
        print(f"Valid rows: {self.valid_rows}")
        print(f"Invalid rows: {self.total_rows - self.valid_rows}")
        
        print(f"\nErrors found: {len(self.errors)}")
        print(f"Warnings found: {len(self.warnings)}")
        
        if self.errors:
            print("\n" + "-"*30)
            print("ERRORS:")
            print("-"*30)
            for error in self.errors[:20]:  # Limit to first 20 errors
                print(f"❌ {error}")
            
            if len(self.errors) > 20:
                print(f"... and {len(self.errors) - 20} more errors")
        
        if self.warnings:
            print("\n" + "-"*30)
            print("WARNINGS:")
            print("-"*30)
            for warning in self.warnings[:10]:  # Limit to first 10 warnings
                print(f"⚠️  {warning}")
            
            if len(self.warnings) > 10:
                print(f"... and {len(self.warnings) - 10} more warnings")
        
        if not self.errors:
            print("\n✅ CSV file is VALID!")
        else:
            print(f"\n❌ CSV file has {len(self.errors)} error(s) that need to be fixed!")
        
        print("="*50)

def main():
    """Main function to validate the CSV file"""
    validator = CSVValidator(INPUT_CSV_FILE)
    is_valid = validator.validate()
    
    # Return delimiter information
    if validator.delimiter:
        print(f"\nDetected delimiter: '{validator.delimiter}'")
        return validator.delimiter
    else:
        print("\nCould not detect delimiter")
        return None

if __name__ == "__main__":
    main()