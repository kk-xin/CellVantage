import os
import mysql.connector
from dotenv import load_dotenv

# Load environment variables from the local .env file
load_dotenv()

def initialize_database():
    # Establish a baseline connection to the MySQL server 
    # (Database name is omitted here to safely execute DROP and CREATE operations)
    connection = mysql.connector.connect(
        host=os.getenv("DB_HOST"),
        port=int(os.getenv("DB_PORT", 3306)),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD")
    )
    cursor = connection.cursor()
    
    # Dynamically resolve the absolute path of schema.sql to ensure cross-platform compatibility
    current_dir = os.path.dirname(os.path.abspath(__file__))
    sql_file_path = os.path.join(current_dir, 'database', 'schema.sql')
    
    print("Starting database initialization...")
    
    try:
        # Read and parse the target SQL schema file
        with open(sql_file_path, 'r', encoding='utf-8') as f:
            # Split the entire script into individual executable statements using the semicolon delimiter
            sql_commands = f.read().split(';')
        
        # Iterate through and execute each SQL command sequentially
        for command in sql_commands:
            # Strip leading/trailing whitespaces and skip any empty statements
            clean_command = command.strip()
            if clean_command:
                cursor.execute(clean_command)
                
        # Explicitly commit all changes to the database
        connection.commit()
        print("Database, tables, and views initialized successfully.")
        
    except mysql.connector.Error as db_error:
        print(f"Database error occurred during initialization: {db_error}")
    except FileNotFoundError:
        print(f"Error: The schema file was not found at {sql_file_path}")
    except Exception as general_error:
        print(f"An unexpected error occurred: {general_error}")
    finally:
        # Ensure database resources and connections are properly released under all conditions
        cursor.close()
        connection.close()

if __name__ == "__main__":
    initialize_database()