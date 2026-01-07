import subprocess
import os
import time
import signal
import sys
import webbrowser

def main():
    print("🚀 Initializing Analysis Pro Dashboard...")
    
    # Paths
    root_dir = os.path.dirname(os.path.abspath(__file__))
    backend_script = os.path.join(root_dir, "stock_analysis", "server.py")
    frontend_dir = os.path.join(root_dir, "web_dashboard")
    
    # 1. Start Backend
    print("🔥 Starting Python Backend (Port 5000)...")
    backend = subprocess.Popen([sys.executable, backend_script], cwd=os.path.dirname(backend_script))
    
    # 2. Start Frontend
    print("⚛️  Starting React Frontend (Port 5173)...")
    frontend = subprocess.Popen(["npm", "run", "dev"], cwd=frontend_dir)
    
    print("\n✅ System Activated")
    print("---------------------------------------")
    print("Backend:  http://localhost:5001")
    print("Frontend: http://localhost:5173")
    print("---------------------------------------")
    print("Press Ctrl+C to shutdown both servers.\n")
    
    # Open browser after a slight delay
    time.sleep(3)
    webbrowser.open("http://localhost:5173")

    try:
        backend.wait()
        frontend.wait()
    except KeyboardInterrupt:
        print("\n🛑 Shutting down...")
        backend.terminate()
        frontend.terminate()
        print("Bye!")

if __name__ == "__main__":
    main()
