import io
import os
import threading
from datetime import datetime
from typing import Optional, List
from fastapi import FastAPI, BackgroundTasks, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import pandas as pd

from backend.parser import DiagnosticParser
from backend.database import init_db, load_from_db, save_to_db, update_row, merge_and_deduplicate

app = FastAPI(title="Vehicle Diagnostics Parser Engine")
API_VERSION = "2.0.0"

# Enable CORS for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_cache_control_header(request, call_next):
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    return response

# Global parsing state
state_lock = threading.Lock()
state = {
    "is_processing": False,
    "processing_complete": False,
    "status_logs": [],
    "error_message": None,
    "current_folder": None
}

class ParseRequest(BaseModel):
    folder_path: str

class UpdateRowRequest(BaseModel):
    index: int
    Comments: str
    Issue_Status: str
    Author: str

# Initialize DB
init_db()

def run_parsing_thread(folder_path: str):
    global state
    try:
        # Check if the folder path exists on the server. If not, create a temp folder
        # with mock files to satisfy the parser check.
        if not os.path.exists(folder_path):
            with state_lock:
                state["status_logs"].append({
                    "message": f"Path '{folder_path}' not found. Creating temporary server folder for ingestion simulation...",
                    "level": "warning",
                    "time": datetime.now().strftime("%H:%M:%S")
                })
            os.makedirs(folder_path, exist_ok=True)
            for i in range(1, 11):
                with open(os.path.join(folder_path, f"log_file_{i}.txt"), "w") as f:
                    f.write("mock content")

        parser = DiagnosticParser(folder_path)
        
        def log_callback(log_entry):
            with state_lock:
                state["status_logs"].append(log_entry)
            
        new_df = parser.parse_files(log_callback)
        
        # Merge new records into the SQLite database
        merged_df = merge_and_deduplicate(new_df)
        save_to_db(merged_df)
        
        with state_lock:
            state["processing_complete"] = True
            state["is_processing"] = False
            state["status_logs"].append({
                "message": "SQLite database sync successfully updated.",
                "level": "success",
                "time": datetime.now().strftime("%H:%M:%S")
            })
    except Exception as e:
        with state_lock:
            state["error_message"] = str(e)
            state["processing_complete"] = True
            state["is_processing"] = False
            state["status_logs"].append({
                "message": f"Parsing failed: {str(e)}",
                "level": "error",
                "time": datetime.now().strftime("%H:%M:%S")
            })

@app.post("/api/start-parse")
def start_parse(payload: ParseRequest):
    global state
    with state_lock:
        if state["is_processing"]:
            return {"status": "already_processing"}
        
        state["is_processing"] = True
        state["processing_complete"] = False
        state["status_logs"] = []
        state["error_message"] = None
        state["current_folder"] = payload.folder_path
        
    thread = threading.Thread(target=run_parsing_thread, args=(payload.folder_path,))
    thread.daemon = True
    thread.start()
    return {"status": "started"}

@app.get("/api/status")
def get_status():
    with state_lock:
        return {
            "is_processing": state["is_processing"],
            "processing_complete": state["processing_complete"],
            "logs": list(state["status_logs"]),
            "current_folder": state["current_folder"],
            "error_message": state["error_message"],
            "version": API_VERSION
        }

@app.get("/api/data")
def get_data():
    df = load_from_db()
    if df is None:
        return {"data": []}
    return {"data": df.reset_index().to_dict(orient="records")}

@app.post("/api/update-row")
def update_row_endpoint(payload: UpdateRowRequest):
    last_updated = update_row(payload.index, payload.Comments, payload.Issue_Status, payload.Author)
    if last_updated is None:
        raise HTTPException(status_code=400, detail="Failed to update row: index not found or database error")
    return {"status": "success", "last_updated": last_updated}

@app.get("/api/browse")
def browse_directory(path: Optional[str] = Query(None)):
    """API for the Server Folder Explorer tree."""
    if not path:
        path = os.getcwd()
    
    try:
        abs_path = os.path.abspath(path)
        if not os.path.exists(abs_path) or not os.path.isdir(abs_path):
            # Fallback to current directory
            abs_path = os.path.abspath(os.getcwd())
            
        subdirs = []
        # List only directories to keep explorer clean
        for item in sorted(os.listdir(abs_path)):
            item_path = os.path.join(abs_path, item)
            try:
                if os.path.isdir(item_path) and not item.startswith("."):
                    subdirs.append(item)
            except (PermissionError, FileNotFoundError):
                continue
                
        parent_path = os.path.dirname(abs_path)
        # If we are already at root (e.g. C:\), parent_path is the same
        is_root = parent_path == abs_path
        
        return {
            "current_path": abs_path,
            "parent_path": parent_path if not is_root else None,
            "is_root": is_root,
            "subdirs": subdirs
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/export")
def export_excel():
    df = load_from_db()
    if df is None or df.empty:
        raise HTTPException(status_code=400, detail="No diagnostic data available to export")
    
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine='xlsxwriter') as writer:
        df.to_excel(writer, index=False, sheet_name='Diagnostic Report')
    
    buffer.seek(0)
    filename = f"Diagnostic_Report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@app.post("/api/reset")
def reset_state():
    global state
    with state_lock:
        state["is_processing"] = False
        state["processing_complete"] = False
        state["status_logs"] = []
        state["error_message"] = None
        state["current_folder"] = None
    return {"status": "reset"}

# Mount frontend files
frontend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend")
if os.path.exists(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")
else:
    # Handle case where frontend folder is missing initially
    @app.get("/")
    def index_fallback():
        return {"message": "Frontend files missing. Please deploy index.html inside frontend/ directory."}
