import subprocess
import sys
import time
import os

def run():
    # Detect active Python environment, prioritizing local virtual environment if it exists
    workspace_dir = os.path.dirname(os.path.abspath(__file__))
    if os.name == 'nt':
        venv_python = os.path.join(workspace_dir, "venv", "Scripts", "python.exe")
    else:
        venv_python = os.path.join(workspace_dir, "venv", "bin", "python")
        
    if os.path.exists(venv_python):
        python_exe = venv_python
    else:
        python_exe = sys.executable
        
    print(f"Active Python interpreter: {python_exe}")
    print("Starting FastAPI Backend (Uvicorn) on http://127.0.0.1:8000 ...")
    
    try:
        backend_proc = subprocess.Popen([
            python_exe, "-m", "uvicorn", "backend.main:app", 
            "--host", "127.0.0.1", "--port", "8000"
        ])
        
        while True:
            # Periodically poll process status
            backend_rc = backend_proc.poll()
            if backend_rc is not None:
                print(f"Backend process terminated with code {backend_rc}")
                break
            time.sleep(1)
            
    except KeyboardInterrupt:
        print("\nShutting down backend process...")
    finally:
        try:
            backend_proc.terminate()
            backend_proc.wait()
        except NameError:
            pass
        print("Processes cleaned up successfully.")

if __name__ == "__main__":
    run()
