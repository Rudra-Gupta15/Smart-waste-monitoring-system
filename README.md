# Smart Waste Management System 🗑️🤖

An AI-powered urban waste detection and monitoring system that leverages computer vision to identify, track, and report discarded garbage in real-time.

## 🌟 Overview

This system is designed to automate the detection of waste in public spaces. Using **YOLOv8**, it identifies objects typically found in litter (bottles, containers, household waste) and assesses the severity of the situation based on object count and persistence.

### Key Features
- **Real-time Detection**: Processes video feeds from webcams, RTSP streams, or local video files.
- **Intelligent Tracking**: Uses IoU (Intersection over Union) tracking to prevent duplicate detections and ensure object persistence.
- **Severity Assessment**: Automatically classifies detection zones from "LOW" to "CRITICAL" based on waste volume.
- **Automated Ticketing**: Integrated with Supabase to generate maintenance tickets when high levels of waste are detected.
- **Interactive Dashboard**: A modern web interface to monitor live feeds, view statistics, and manage alerts.

## 🛠️ Tech Stack

- **Backend**: Python, FastAPI, OpenCV, Ultralytics (YOLOv8), PyTorch.
- **Frontend**: React (Vite), CSS3 (Modern Classical Editorial design).
- **Database/Auth**: Supabase.
- **Deployment**: Local dev server (npm/uvicorn).

## 🚀 Getting Started

### Prerequisites
- Python 3.8+
- Node.js & npm
- A webcam or video source

### Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd smart-waste-management
   ```

2. **Setup Virtual Environment**:
   ```bash
   python -m venv venv
   .\venv\Scripts\activate
   pip install -r backend/requirements.txt
   ```

3. **Install Frontend Dependencies**:
   ```bash
   cd frontend
   npm install
   cd ..
   ```

### Configuration

Create a `.env` file in the root or set environment variables:
- `CAMERA_SOURCE`: Camera index (e.g., `0`) or RTSP URL.
- `FRAME_INTERVAL`: Process every N-th frame (default: `3`).
- `API_PORT`: Backend port (default: `8000`).

## 🏃 Running the System

You can start both the backend and frontend simultaneously using the provided runner:

```bash
python run_server.py
```

- **Frontend**: [http://localhost:5173](http://localhost:5173)
- **API Documentation**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Live Video Feed**: [http://localhost:8000/api/detection/video-feed](http://localhost:8000/api/detection/video-feed)

## 📁 Project Structure

- `backend/`: FastAPI application, AI logic, and API routers.
- `frontend/`: React source code and assets.
- `data/`:
  - `models/`: YOLO weights (`yolov8m.pt`, etc.).
  - `evidence/`: Snapshots of detected waste events.
- `run_server.py`: Main entry point to launch the entire stack.

## 📄 License

This project is licensed under the MIT License.
