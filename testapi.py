# test_connection.py
from google.cloud import optimization_v1

def test_connection():
    try:
        # This will use the credentials from your environment variable
        # or the explicitly provided credentials
        client = optimization_v1.FleetRoutingClient()
        print("✅ Successfully created Fleet Routing client")
        return True
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return False

if __name__ == "__main__":
    test_connection()