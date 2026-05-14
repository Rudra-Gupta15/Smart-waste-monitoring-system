"""
Run the full Smart Waste Management server.
Starts FastAPI backend with camera detection + live video feed.

Usage:
    python run_server.py                          # webcam + server
    python run_server.py --source video.mp4       # video file
    CAMERA_SOURCE=0 python run_server.py          # via env var
"""

import os
import sys
import subprocess
import threading
import socket
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import uvicorn

# Global to store frontend process for cleanup
frontend_proc = None

def wait_for_port(port, timeout=60):
    """Wait for a port to become active on localhost."""
    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=1):
                return True
        except (OSError, ConnectionRefusedError):
            time.sleep(1)
    return False

def start_frontend_delayed(frontend_dir, port):
    """Wait for backend then start frontend."""
    global frontend_proc
    
    if wait_for_port(port):
        print(f"\n[*] Backend is ready. Starting Frontend (npm run dev)...")
        try:
            # Use shell=True for Windows to find npm
            frontend_proc = subprocess.Popen(
                ["npm", "run", "dev"],
                cwd=str(frontend_dir),
                shell=True
            )
        except Exception as e:
            print(f"[!] Could not start frontend: {e}")
    else:
        print(f"\n[!] Backend failed to start on port {port} within timeout. Frontend not started.")

def main():
    import argparse
    parser = argparse.ArgumentParser(description="Smart Waste Management Server")
    parser.add_argument("--source", default=None, help="Camera source (0=webcam, filepath, RTSP)")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--no-frontend", action="store_true", help="Do not start the frontend")
    args = parser.parse_args()

    if args.source is not None:
        os.environ["CAMERA_SOURCE"] = args.source

    frontend_dir = Path(__file__).resolve().parent / "frontend"
    
    if not args.no_frontend and frontend_dir.exists():
        # Start frontend in a separate thread that waits for backend
        threading.Thread(
            target=start_frontend_delayed, 
            args=(frontend_dir, args.port),
            daemon=True
        ).start()

    print("=" * 55)
    print("  Smart Waste Management System")
    print("  AI-Powered Waste Detection & Monitoring")
    print("=" * 55)
    print(f"  API Server:  http://localhost:{args.port}")
    print(f"  API Docs:    http://localhost:{args.port}/docs")
    print(f"  Video Feed:  http://localhost:{args.port}/api/detection/video-feed")
    print(f"  Frontend:    http://localhost:3000") # Vite default port in config
    print("=" * 55)

    try:
        uvicorn.run(
            "backend.app.main:app",
            host=args.host,
            port=args.port,
            reload=False,
        )
    except KeyboardInterrupt:
        pass
    finally:
        if frontend_proc:
            print("\n[*] Shutting down frontend...")
            # On Windows, we need to kill the process tree because npm starts sub-processes
            if os.name == 'nt':
                subprocess.call(['taskkill', '/F', '/T', '/PID', str(frontend_proc.pid)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            else:
                frontend_proc.terminate()


if __name__ == "__main__":
    main()
