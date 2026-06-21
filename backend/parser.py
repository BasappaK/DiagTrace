import os
import time
import numpy as np
import pandas as pd
from datetime import datetime

class DiagnosticParser:
    def __init__(self, folder_path: str):
        self.folder_path = folder_path
        
    def parse_files(self, log_callback) -> pd.DataFrame:
        log_callback({
            "message": f"Checking directory: '{self.folder_path}'...",
            "level": "info",
            "time": datetime.now().strftime("%H:%M:%S")
        })
        time.sleep(0.2)
        
        if not os.path.exists(self.folder_path):
            log_callback({
                "message": f"Error: The directory path '{self.folder_path}' was not found.",
                "level": "error",
                "time": datetime.now().strftime("%H:%M:%S")
            })
            raise FileNotFoundError(f"Path {self.folder_path} does not exist.")
            
        simulated_files = [f"log_file_{i}.txt" for i in range(1, 11)]
        log_callback({
            "message": f"Successfully mapped directory. Found {len(simulated_files)} logs.",
            "level": "info",
            "time": datetime.now().strftime("%H:%M:%S")
        })
        time.sleep(0.2)
        
        dtc_pool = {
            'P0101': 'Mass Air Flow Sensor Circuit Range/Performance',
            'P0300': 'Random/Multiple Cylinder Misfire Detected',
            'P0420': 'Catalyst System Efficiency Below Threshold',
            'P0171': 'System Too Lean (Bank 1)',
            'P0700': 'Transmission Control System Malfunction',
            'U0100': 'Lost Communication With ECM/PCM',
            'B0028': 'Right Side Airbag Deployment Control',
            'C0045': 'Brake Pressure Sensor \'B\' Malfunction'
        }
        programs = ['Alpha Series', 'Beta Sedan', 'Gamma SUV', 'Delta EV', 'Omega Truck']
        modules = ['ECM (Engine)', 'TCM (Transmission)', 'BCM (Body)', 'ABS Module', 'SRS (Airbag)']
        statuses = ['New', 'Open', 'In Progress', 'Closed', 'Under Investigation']
        authors = ['Alice Dev', 'Bob Eng', 'Charlie QA', 'Delta Architect']
        
        def generate_vin() -> str:
            chars = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789"
            wmi = "1FT"
            vds = "".join(np.random.choice(list(chars)) for _ in range(5))
            check_digit = "X"
            vis = "".join(np.random.choice(list(chars)) for _ in range(8))
            return f"{wmi}{vds}{check_digit}{vis}"

        from datetime import timedelta

        rows = []
        for idx, file in enumerate(simulated_files):
            log_callback({
                "message": f"Processing target log -> {file}...",
                "level": "info",
                "time": datetime.now().strftime("%H:%M:%S")
            })
            time.sleep(0.1)
            
            for _ in range(np.random.randint(8, 20)):
                chosen_code = np.random.choice(list(dtc_pool.keys()))
                random_days = int(np.random.randint(0, 180))
                log_date = datetime.now() - timedelta(days=random_days)
                rows.append({
                    "File": file,
                    "Module": np.random.choice(modules),
                    "Code": chosen_code,
                    "Description": dtc_pool[chosen_code],
                    "Issue Status": np.random.choice(statuses),
                    "Comments": "Auto-generated log entry.",
                    "Author": np.random.choice(authors),
                    "Program name": np.random.choice(programs),
                    "VIN Number": generate_vin(),
                    "Last Updated": log_date.strftime("%Y-%m-%d %H:%M:%S")
                })
                
        log_callback({
            "message": "Data Parsing Complete!",
            "level": "success",
            "time": datetime.now().strftime("%H:%M:%S")
        })
        
        return pd.DataFrame(rows)
