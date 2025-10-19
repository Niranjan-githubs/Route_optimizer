#!/usr/bin/env python3
"""
Simple CSV Splitter for Google Maps API Processing
Splits large CSV files into chunks of 2000 rows each
"""

import pandas as pd
import os
from pathlib import Path

def split_csv_into_chunks(input_file, chunk_size=2000, output_dir="chunks"):
    """
    Split a CSV file into smaller chunks for Google Maps API processing
    
    Args:
        input_file: Path to the input CSV file
        chunk_size: Number of rows per chunk (default: 2000)
        output_dir: Directory to save chunk files
    """
    print(f"📂 Loading CSV file: {input_file}")
    
    # Read the CSV file
    df = pd.read_csv(input_file)
    total_rows = len(df)
    total_chunks = (total_rows + chunk_size - 1) // chunk_size  # Ceiling division
    
    print(f"📊 File statistics:")
    print(f"   - Total rows: {total_rows:,}")
    print(f"   - Chunk size: {chunk_size:,}")
    print(f"   - Total chunks: {total_chunks}")
    
    # Create output directory
    os.makedirs(output_dir, exist_ok=True)
    
    # Get base filename without extension
    base_name = Path(input_file).stem
    
    print(f"\n🔄 Splitting into chunks...")
    
    # Split into chunks
    for i in range(total_chunks):
        start_idx = i * chunk_size
        end_idx = min((i + 1) * chunk_size, total_rows)
        
        # Extract chunk
        chunk_df = df.iloc[start_idx:end_idx]
        
        # Create output filename
        output_file = os.path.join(output_dir, f"{base_name}_chunk_{i+1:03d}.csv")
        
        # Save chunk
        chunk_df.to_csv(output_file, index=False)
        
        print(f"   ✅ Chunk {i+1:3d}/{total_chunks}: {len(chunk_df):4d} rows -> {output_file}")
    
    print(f"\n🎉 Successfully split {input_file} into {total_chunks} chunks!")
    print(f"📁 Chunks saved in: {output_dir}/")
    
    # Create a summary file
    summary_file = os.path.join(output_dir, "chunks_summary.txt")
    with open(summary_file, 'w') as f:
        f.write(f"CSV Split Summary\n")
        f.write(f"================\n")
        f.write(f"Original file: {input_file}\n")
        f.write(f"Total rows: {total_rows:,}\n")
        f.write(f"Chunk size: {chunk_size:,}\n")
        f.write(f"Total chunks: {total_chunks}\n")
        f.write(f"Output directory: {output_dir}/\n\n")
        f.write(f"Chunk files:\n")
        for i in range(total_chunks):
            f.write(f"  - {base_name}_chunk_{i+1:03d}.csv\n")
    
    print(f"📋 Summary saved to: {summary_file}")
    
    return total_chunks

def main():
    """Main function"""
    # Configuration
    INPUT_FILE = "1stround_data/1stround_master.csv"
    CHUNK_SIZE = 2000
    OUTPUT_DIR = "1stround_data/chunks"
    
    try:
        # Check if input file exists
        if not os.path.exists(INPUT_FILE):
            print(f"❌ Error: Input file '{INPUT_FILE}' not found!")
            print(f"   Please make sure the file exists in the correct location.")
            return
        
        # Split the CSV
        total_chunks = split_csv_into_chunks(
            input_file=INPUT_FILE,
            chunk_size=CHUNK_SIZE,
            output_dir=OUTPUT_DIR
        )
        
        print(f"\n💡 Next steps:")
        print(f"   1. Process each chunk file individually with Google Maps API")
        print(f"   2. Each chunk contains up to {CHUNK_SIZE:,} rows")
        print(f"   3. Chunk files are ready for batch processing")
        
    except Exception as e:
        print(f"❌ Error during execution: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
