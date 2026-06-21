import os
import sqlite3
import threading
from typing import Optional, List, Dict, Any
import pandas as pd
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "diagnostics.db")

# Threading lock to serialize database writes
db_lock = threading.Lock()

def get_connection() -> sqlite3.Connection:
    """Get a connection to the SQLite database with WAL mode enabled and timeout."""
    conn = sqlite3.connect(DB_PATH, timeout=30.0, check_same_thread=False)
    # Enable WAL mode for better concurrency with multiple readers/writers
    try:
        conn.execute("PRAGMA journal_mode=WAL;")
    except Exception as e:
        print(f"Error setting WAL mode: {e}")
    # Return dictionary rows if needed, but standard connection is fine
    return conn

def init_db():
    """Initializes the database schema if it does not exist."""
    with db_lock:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS diagnostics (
                [index] INTEGER PRIMARY KEY AUTOINCREMENT,
                File TEXT,
                Module TEXT,
                Code TEXT,
                Description TEXT,
                [Issue Status] TEXT,
                Comments TEXT,
                Author TEXT,
                [Program name] TEXT,
                [VIN Number] TEXT,
                [Last Updated] TEXT
            )
        """)
        conn.commit()
        conn.close()

def load_from_db() -> Optional[pd.DataFrame]:
    """Loads all diagnostics data from the database as a Pandas DataFrame."""
    if not os.path.exists(DB_PATH):
        return None
    with db_lock:
        try:
            conn = get_connection()
            # Check if table exists
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='diagnostics'")
            if not cursor.fetchone():
                conn.close()
                return None
            
            df = pd.read_sql_query("SELECT * FROM diagnostics", conn)
            # Set the index column as the DataFrame index
            if "index" in df.columns:
                df.set_index("index", inplace=True)
            conn.close()
            return df
        except Exception as e:
            print(f"Error loading from SQLite: {e}")
            return None

def save_to_db(df: pd.DataFrame):
    """Saves a DataFrame to the diagnostics database, overwriting the existing table."""
    with db_lock:
        try:
            conn = get_connection()
            # If the index is not named, name it "index"
            if df.index.name is None:
                df.index.name = "index"
            
            # Save the dataframe
            df.to_sql("diagnostics", conn, if_exists="replace", index=True, index_label="index")
            conn.close()
        except Exception as e:
            print(f"Error saving to SQLite: {e}")

def update_row(index: int, comments: str, issue_status: str, author: str) -> Optional[str]:
    """Updates the editable columns for a specific row index, returns the Last Updated timestamp."""
    last_updated = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with db_lock:
        try:
            conn = get_connection()
            cursor = conn.cursor()
            # Verify if the index exists
            cursor.execute("SELECT 1 FROM diagnostics WHERE [index] = ?", (index,))
            if not cursor.fetchone():
                conn.close()
                return None
            
            # Perform update
            cursor.execute("""
                UPDATE diagnostics
                SET Comments = ?, [Issue Status] = ?, Author = ?, [Last Updated] = ?
                WHERE [index] = ?
            """, (comments, issue_status, author, last_updated, index))
            conn.commit()
            conn.close()
            return last_updated
        except Exception as e:
            print(f"Error updating SQLite row {index}: {e}")
            return None

def merge_and_deduplicate(new_df: pd.DataFrame) -> pd.DataFrame:
    """Merges new dataframe rows into the existing database entries, avoiding duplicate key combinations."""
    existing_df = load_from_db()
    if existing_df is None or existing_df.empty:
        return new_df
        
    id_cols = ["File", "Module", "Code", "Description", "Program name", "VIN Number"]
    
    # Ensure key columns exist in both dataframes
    for col in id_cols:
        if col not in existing_df.columns:
            existing_df[col] = ""
        if col not in new_df.columns:
            new_df[col] = ""
            
    # Fill NaN to avoid string formatting issues
    existing_temp = existing_df[id_cols].fillna("").astype(str)
    new_temp = new_df[id_cols].fillna("").astype(str)
    
    # Generate unique signature strings for matching
    existing_keys_set = set(existing_temp.apply(lambda row: "|".join(row), axis=1).tolist())
    new_keys = new_temp.apply(lambda row: "|".join(row), axis=1).tolist()
    
    # Filter new rows to keep only those that do not match existing keys
    keep_indices = []
    for idx, key in enumerate(new_keys):
        if key not in existing_keys_set:
            keep_indices.append(idx)
            existing_keys_set.add(key)  # Prevent duplicates within the newly parsed set itself
            
    filtered_new_df = new_df.iloc[keep_indices].copy()
    
    if not filtered_new_df.empty:
        # Reset the index of the merged dataframe so index remains clean and sequential
        combined_df = pd.concat([existing_df, filtered_new_df], ignore_index=True)
        return combined_df
    else:
        return existing_df
