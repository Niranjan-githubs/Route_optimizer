import pandas as pd

# Load your CSV file
df = pd.read_csv("TransportMasterProxy-2025-09-15 (2).csv")  # replace with your actual file name

# Filter rows where confirmed = 0
not_confirmed_df = df[df["confirmed"] == 0]

# Save to a new CSV file
not_confirmed_df.to_csv("not_confirmed.csv", index=False)

print("New CSV file 'not_confirmed.csv' created with unconfirmed users.")
