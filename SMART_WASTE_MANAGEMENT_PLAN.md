# Smart Waste Management System

## AI-Powered Urban Waste Monitoring & Analytics Platform

---

## Table of Contents

- [1. Executive Summary](#1-executive-summary)
- [2. System Architecture](#2-system-architecture)
- [3. Technology Stack](#3-technology-stack)
- [4. Implementation Plan](#4-implementation-plan)
- [5. Use Case 1 — Household Waste Vehicle Pickup Monitoring](#5-use-case-1--household-waste-vehicle-pickup-monitoring)
- [6. Use Case 2 — AI-Driven Transfer Station Vehicle Monitoring](#6-use-case-2--ai-driven-transfer-station-vehicle-monitoring)
- [7. Use Case 3 — Weighbridge Entry Validation & Tier Weight Monitoring](#7-use-case-3--weighbridge-entry-validation--tier-weight-monitoring)
- [8. Use Case 4 — Street Garbage Monitoring from Vehicle-Mounted Cameras](#8-use-case-4--street-garbage-monitoring-from-vehicle-mounted-cameras)
- [9. Use Case 5 — Auto Ticket Creation from Video Analytics](#9-use-case-5--auto-ticket-creation-from-video-analytics)
- [10. Dashboard Design](#10-dashboard-design)
- [11. Database Schema Overview](#11-database-schema-overview)
- [12. API Endpoints](#12-api-endpoints)
- [13. Deployment Strategy](#13-deployment-strategy)

---

## 1. Executive Summary

The **Smart Waste Management System** is an AI-powered platform that leverages computer vision, IoT integration, and real-time analytics to revolutionize urban waste collection and monitoring. The system processes live video feeds from fixed cameras and vehicle-mounted dashcams, fuses data with IoT sensors (weighbridges, GPS, RFID), and delivers actionable intelligence through a centralized dashboard.

### Core Objectives

| Objective | Description |
|-----------|-------------|
| **Automate Monitoring** | Replace manual supervision with AI-driven video analytics |
| **Real-Time Visibility** | Live tracking of vehicles, pickups, and garbage hotspots |
| **Intelligent Alerting** | Auto-detect anomalies — missed pickups, overweight vehicles, illegal dumping |
| **Automated Ticketing** | Zero-human-intervention ticket creation for garbage incidents |
| **Data-Driven Decisions** | Analytics dashboards for route optimization and resource planning |

### Evaluation Criteria (40 Marks)

| Component | Marks |
|-----------|-------|
| Concept Presentation | 5 |
| Implementation Plan | 5 |
| Dashboard Design | 5 |
| UC1 — Household Pickup Monitoring | 5 |
| UC2 — Transfer Station Monitoring | 5 |
| UC3 — Weighbridge Validation | 5 |
| UC4 — Street Garbage Detection | 5 |
| UC5 — Auto Ticket Creation | 5 |
| **Total** | **40** |

---

## 2. System Architecture

### High-Level Architecture

```mermaid
graph TB
    subgraph DATA_SOURCES["Data Sources"]
        CAM1["CCTV — Household Points"]
        CAM2["CCTV — Transfer Station"]
        CAM3["CCTV — Weighbridge"]
        CAM4["Vehicle Dashcam + GPS"]
        IOT["IoT Sensors<br/>Weighbridge / RFID / GPS"]
    end

    subgraph INGESTION["Ingestion Layer"]
        VS["Video Stream Handler<br/>OpenCV | RTSP | File"]
        MQTT["MQTT Broker<br/>Mosquitto"]
    end

    subgraph AI_ENGINE["AI Processing Engine"]
        YOLO["YOLOv8 Object Detection<br/>Truck | Bin | Garbage"]
        TRACK["Vehicle Tracker<br/>ByteTrack | Centroid"]
        OCR["License Plate Recognition<br/>EasyOCR | PaddleOCR"]
        GARBAGE["Garbage Classifier<br/>Fine-tuned YOLO on TACO"]
        FUSION["Data Fusion Engine<br/>Camera + IoT Merge"]
    end

    subgraph LOGIC["Event & Rule Engine"]
        RULES["Rule Processor"]
        EVENTS["Event Generator"]
        ALERTS["Alert Manager"]
        TICKETS["Ticket Creator"]
    end

    subgraph STORAGE["Storage Layer"]
        PG["PostgreSQL<br/>Events | Tickets | Vehicles"]
        REDIS["Redis<br/>Real-time State | Counters"]
        FILES["File Storage<br/>Snapshots | Evidence"]
    end

    subgraph API_LAYER["API Layer — FastAPI"]
        REST["REST Endpoints"]
        WS["WebSocket — Live Feed"]
    end

    subgraph FRONTEND["Dashboard — React + Tailwind"]
        MAP["Live Map — Leaflet"]
        STATS["Stats & Charts"]
        ALERT_UI["Alert Panel"]
        TICKET_UI["Ticket Manager"]
        VIDEO_UI["Video Feed Viewer"]
    end

    CAM1 --> VS
    CAM2 --> VS
    CAM3 --> VS
    CAM4 --> VS
    IOT --> MQTT

    VS --> YOLO
    VS --> OCR
    MQTT --> FUSION

    YOLO --> TRACK
    YOLO --> GARBAGE
    OCR --> FUSION
    TRACK --> RULES
    GARBAGE --> RULES
    FUSION --> RULES

    RULES --> EVENTS
    RULES --> ALERTS
    RULES --> TICKETS

    EVENTS --> PG
    ALERTS --> REDIS
    TICKETS --> PG
    EVENTS --> FILES

    PG --> REST
    REDIS --> WS
    FILES --> REST

    REST --> MAP
    REST --> STATS
    REST --> TICKET_UI
    WS --> ALERT_UI
    WS --> VIDEO_UI

    style DATA_SOURCES fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px
    style INGESTION fill:#e3f2fd,stroke:#1565c0,stroke-width:2px
    style AI_ENGINE fill:#fff3e0,stroke:#e65100,stroke-width:2px
    style LOGIC fill:#fce4ec,stroke:#c62828,stroke-width:2px
    style STORAGE fill:#f3e5f5,stroke:#6a1b9a,stroke-width:2px
    style API_LAYER fill:#e0f7fa,stroke:#00695c,stroke-width:2px
    style FRONTEND fill:#fffde7,stroke:#f57f17,stroke-width:2px
```

### End-to-End Data Flow

```mermaid
graph LR
    A["Cameras + IoT"] -->|Frames & Sensor Data| B["Ingest"]
    B -->|Preprocessed Data| C["AI Detect"]
    C -->|Detections & Classifications| D["Rule Engine"]
    D -->|Events| E["Database"]
    D -->|Alerts| F["Redis PubSub"]
    D -->|Tickets| E
    E -->|REST API| G["Dashboard"]
    F -->|WebSocket| G

    style A fill:#c8e6c9,stroke:#388e3c
    style C fill:#ffe0b2,stroke:#ef6c00
    style D fill:#ffcdd2,stroke:#d32f2f
    style G fill:#fff9c4,stroke:#f9a825
```

---

## 3. Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 18 + Tailwind CSS | Dashboard UI |
| **Maps** | Leaflet / Mapbox GL | Live map, heatmaps, geofencing |
| **Charts** | Chart.js / Recharts | Analytics & reporting |
| **Backend** | Python 3.11 + FastAPI | REST API + WebSocket server |
| **AI / CV** | YOLOv8 (Ultralytics) | Object detection — trucks, bins, garbage |
| **Tracking** | ByteTrack / SORT | Multi-object tracking across frames |
| **OCR** | EasyOCR / PaddleOCR | License plate recognition |
| **Video** | OpenCV 4.x | Video capture, frame processing, drawing |
| **IoT** | MQTT (Mosquitto) | Sensor data ingestion — weight, GPS, RFID |
| **Database** | PostgreSQL 16 | Persistent storage — events, tickets, vehicles |
| **Cache** | Redis 7 | Real-time state, pub/sub for live updates |
| **Storage** | Local / S3 | Snapshots, evidence images, video clips |
| **Deployment** | Docker + Docker Compose | Containerized services |

### AI Models Required

| Model | Base | Training Data | Purpose |
|-------|------|--------------|---------|
| Vehicle Detector | YOLOv8m | COCO (pre-trained) | Detect trucks, vans, compactors |
| Garbage Detector | YOLOv8m | TACO Dataset | Detect litter, bags, piles, bins |
| Plate Reader | EasyOCR | Pre-trained | Read license plate text |
| Vehicle Classifier | Custom CNN | Transfer station data | Classify vehicle type and tier |

---

## 4. Implementation Plan

### Phase-wise Roadmap

```mermaid
gantt
    title Smart Waste Management — Implementation Roadmap
    dateFormat  YYYY-MM-DD
    axisFormat  %b %d

    section Foundation
    Project Setup & Architecture           :done, f1, 2026-05-07, 2d
    Database Schema Design                 :done, f2, after f1, 1d
    FastAPI Backend Skeleton               :active, f3, after f2, 2d
    React Dashboard Skeleton               :f4, after f2, 3d

    section AI Pipeline
    YOLOv8 Vehicle Detection Setup         :a1, after f3, 2d
    Garbage Detection Model (TACO)         :a2, after a1, 3d
    License Plate OCR Pipeline             :a3, after a1, 2d
    Vehicle Tracking (ByteTrack)           :a4, after a1, 2d

    section Use Cases
    UC1 — Household Pickup Monitoring      :u1, after a1, 3d
    UC2 — Transfer Station Monitoring      :u2, after a4, 3d
    UC3 — Weighbridge Validation           :u3, after a3, 3d
    UC4 — Street Garbage Detection         :u4, after a2, 3d
    UC5 — Auto Ticket Creation             :u5, after u4, 2d

    section Integration
    Dashboard Integration (All UCs)        :i1, after u5, 3d
    Live Map + Heatmap                     :i2, after i1, 2d
    WebSocket Real-time Alerts             :i3, after i1, 2d
    Testing & Demo Preparation             :i4, after i3, 3d
```

### Build Priority Order

| Priority | Component | Rationale |
|----------|-----------|-----------|
| 1 | Dashboard Skeleton | Immediate visual output for demo |
| 2 | UC1 — Pickup Monitoring | Simplest detection (truck in frame) |
| 3 | UC4 + UC5 — Garbage + Tickets | High demo impact, tightly coupled |
| 4 | UC2 — Transfer Station | Entry/exit counting logic |
| 5 | UC3 — Weighbridge | Most complex (IoT + OCR fusion) |

---

## 5. Use Case 1 — Household Waste Vehicle Pickup Monitoring

### Objective

Monitor fixed cameras at household collection points to detect whether waste vehicles arrived and performed pickups.

### Functional Flow

```mermaid
flowchart TD
    A["Camera at Collection Point"] --> B["Capture Frame<br/>every 1 second"]
    B --> C["YOLOv8 Object Detection"]
    C --> D{"Waste Truck<br/>Detected?"}

    D -->|No| B
    D -->|Yes| E["Track Truck in<br/>Geofenced Zone"]

    E --> F{"Truck Stopped<br/>near Bin Area<br/>for > 30 seconds?"}

    F -->|No| G{"Truck Left<br/>the Frame?"}
    G -->|No| E
    G -->|Yes| H["Log: PASS-THROUGH<br/>No Pickup"]

    F -->|Yes| I["Log: PICKUP CONFIRMED"]

    I --> J["Save Event to Database"]
    J --> K["Update Dashboard<br/>Mark Point as COLLECTED"]

    H --> L["Flag: MISSED PICKUP"]
    L --> M["Raise Alert on Dashboard"]

    K --> N["End-of-Day Report<br/>X/Y Collected | Z Missed"]
    M --> N

    style A fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px
    style D fill:#fff3e0,stroke:#e65100,stroke-width:2px
    style F fill:#fff3e0,stroke:#e65100,stroke-width:2px
    style I fill:#c8e6c9,stroke:#2e7d32,stroke-width:2px
    style L fill:#ffcdd2,stroke:#c62828,stroke-width:2px
    style N fill:#e3f2fd,stroke:#1565c0,stroke-width:2px
```

### Detection Logic

```mermaid
sequenceDiagram
    participant Camera
    participant OpenCV as OpenCV Processor
    participant YOLO as YOLOv8 Model
    participant Tracker as Zone Tracker
    participant DB as Database
    participant Dash as Dashboard

    loop Every 1 Second
        Camera->>OpenCV: Raw Frame
        OpenCV->>YOLO: Preprocessed Frame
        YOLO->>OpenCV: Detections [truck, bin, person...]
    end

    OpenCV->>Tracker: Truck detected at (x, y)
    Tracker->>Tracker: Check if (x,y) is in geofenced pickup zone
    Tracker->>Tracker: Monitor dwell time

    alt Dwell > 30s (Pickup)
        Tracker->>DB: INSERT pickup_event
        DB->>Dash: Update collection status
        Dash->>Dash: Mark GREEN on map
    else Truck leaves without stopping
        Tracker->>DB: INSERT missed_event
        DB->>Dash: Raise MISSED alert
        Dash->>Dash: Mark RED on map
    end
```

### Event Data Model

```json
{
  "event_id": "EVT-20260507-001",
  "type": "PICKUP_CONFIRMED",
  "collection_point_id": "CP-MG-042",
  "collection_point_name": "MG Road — Block A",
  "vehicle_detected": true,
  "vehicle_class": "compactor_truck",
  "arrival_time": "2026-05-07T06:32:15Z",
  "departure_time": "2026-05-07T06:34:48Z",
  "dwell_duration_seconds": 153,
  "pickup_confirmed": true,
  "confidence": 0.92,
  "snapshot_url": "/evidence/evt-20260507-001.jpg"
}
```

---

## 6. Use Case 2 — AI-Driven Transfer Station Vehicle Monitoring

### Objective

Track vehicles entering and exiting waste transfer stations — count, classify, measure dwell time, and detect anomalies.

### Functional Flow

```mermaid
flowchart TD
    A["Camera at Station Gate"] --> B["Frame Capture"]
    B --> C["YOLOv8 Vehicle Detection"]
    C --> D["Vehicle Classification<br/>Truck | Van | Compactor"]
    D --> E["ByteTrack Multi-Object Tracking"]

    E --> F{"Virtual Line<br/>Crossing?"}

    F -->|Entry Line Crossed| G["Register NEW VEHICLE"]
    F -->|Exit Line Crossed| H["Match with Entry Record"]
    F -->|No Crossing| B

    G --> I["Log Entry Event"]
    I --> J["Assign Tracking ID"]
    J --> K["Start Dwell Timer"]

    H --> L["Calculate Dwell Time"]
    L --> M["Log Exit Event"]

    K --> N{"Dwell Time<br/>> 60 min?"}
    N -->|Yes| O["ALERT: Possible<br/>Breakdown / Stuck"]
    N -->|No| P["Normal Operations"]

    I --> Q["Update Station Dashboard"]
    M --> Q
    O --> Q

    Q --> R["Live Stats Panel"]
    R --> R1["Currently Inside: N"]
    R --> R2["Today Total: N"]
    R --> R3["Avg Dwell: N min"]
    R --> R4["Peak Hour Analysis"]

    style A fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px
    style F fill:#fff3e0,stroke:#e65100,stroke-width:2px
    style G fill:#c8e6c9,stroke:#2e7d32,stroke-width:2px
    style H fill:#bbdefb,stroke:#1565c0,stroke-width:2px
    style O fill:#ffcdd2,stroke:#c62828,stroke-width:2px
    style N fill:#fff3e0,stroke:#e65100,stroke-width:2px
```

### Virtual Line Crossing Logic

```mermaid
graph LR
    subgraph FRAME["Camera Frame View"]
        direction TB
        ENTRY["--- ENTRY LINE ---"]
        ZONE["Station Zone"]
        EXIT["--- EXIT LINE ---"]
    end

    subgraph TRACKING["Tracking Logic"]
        T1["Frame N: Vehicle centroid ABOVE entry line"]
        T2["Frame N+1: Vehicle centroid BELOW entry line"]
        T3["ENTRY EVENT triggered"]
        T1 --> T2 --> T3
    end

    subgraph TRACKING2["Exit Logic"]
        T4["Vehicle centroid ABOVE exit line"]
        T5["Vehicle centroid BELOW exit line"]
        T6["EXIT EVENT triggered"]
        T4 --> T5 --> T6
    end

    style ENTRY fill:#c8e6c9,stroke:#2e7d32,stroke-width:2px
    style EXIT fill:#ffcdd2,stroke:#c62828,stroke-width:2px
```

### Station Monitoring Data Model

```json
{
  "station_id": "TS-CENTRAL-01",
  "vehicle_tracking_id": "TRK-20260507-014",
  "vehicle_type": "heavy_compactor",
  "license_plate": "KA01AB1234",
  "entry_time": "2026-05-07T09:15:32Z",
  "exit_time": "2026-05-07T09:42:18Z",
  "dwell_minutes": 26.8,
  "entry_snapshot": "/evidence/trk-014-entry.jpg",
  "exit_snapshot": "/evidence/trk-014-exit.jpg",
  "status": "DEPARTED",
  "alerts": []
}
```

---

## 7. Use Case 3 — Weighbridge Entry Validation & Tier Weight Monitoring

### Objective

Validate vehicle identity at the weighbridge using camera-based plate recognition, fuse with IoT weight sensor data, and enforce tier-based weight limits.

### Weight Tier Definitions

| Tier | Vehicle Type | Weight Range | Action on Exceed |
|------|-------------|-------------|-----------------|
| Tier 1 | Small Van / Auto | 0 — 3,000 kg | Alert + Block |
| Tier 2 | Medium Truck | 3,000 — 8,000 kg | Alert + Block |
| Tier 3 | Heavy Compactor | 8,000 — 15,000 kg | Alert + Block |
| Unregistered | Unknown | Any | Deny Entry |

### Functional Flow

```mermaid
flowchart TD
    A["Vehicle Approaches Weighbridge"] --> B["Camera Captures Vehicle"]
    A --> C["IoT Weighbridge Sensor Activates"]

    B --> D["YOLOv8 Detects Vehicle<br/>+ Plate Region"]
    D --> E["EasyOCR Reads<br/>License Plate"]
    E --> F["Plate: KA01AB1234"]

    C --> G["MQTT Publishes<br/>Weight: 8500 kg"]

    F --> H["DATA FUSION ENGINE"]
    G --> H

    H --> I["Lookup Vehicle in Database"]
    I --> J{"Vehicle<br/>Registered?"}

    J -->|No| K["DENY ENTRY<br/>Unregistered Vehicle Alert"]

    J -->|Yes| L["Retrieve Vehicle Profile"]
    L --> M["Expected Tier: Tier 2<br/>Max Weight: 8000 kg"]
    M --> N{"Actual Weight<br/>within Tier Range?"}

    N -->|Yes| O["VALIDATED<br/>Gate Opens"]
    N -->|No — Overweight| P["ANOMALY DETECTED<br/>Overweight by 500 kg"]

    O --> Q["Log Weighbridge Entry"]
    P --> R["Raise ALERT<br/>+ Block Gate"]
    K --> S["Log Denial + Snapshot"]

    Q --> T["Dashboard: Entry Logged"]
    R --> T
    S --> T

    style A fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px
    style H fill:#fff3e0,stroke:#e65100,stroke-width:2px
    style J fill:#fff3e0,stroke:#e65100,stroke-width:2px
    style N fill:#fff3e0,stroke:#e65100,stroke-width:2px
    style O fill:#c8e6c9,stroke:#2e7d32,stroke-width:2px
    style P fill:#ffcdd2,stroke:#c62828,stroke-width:2px
    style K fill:#ffcdd2,stroke:#c62828,stroke-width:2px
```

### Camera + IoT Fusion Sequence

```mermaid
sequenceDiagram
    participant Vehicle
    participant Camera
    participant YOLO as YOLOv8 + OCR
    participant Weighbridge as IoT Weighbridge
    participant MQTT as MQTT Broker
    participant Fusion as Data Fusion Engine
    participant DB as Database
    participant Gate as Gate Controller
    participant Dash as Dashboard

    Vehicle->>Camera: Enters camera view
    Vehicle->>Weighbridge: Drives onto weighbridge

    par Camera Pipeline
        Camera->>YOLO: Frame with vehicle
        YOLO->>YOLO: Detect plate region
        YOLO->>Fusion: plate = "KA01AB1234"
    and IoT Pipeline
        Weighbridge->>MQTT: {weight: 8500, unit: "kg"}
        MQTT->>Fusion: weight = 8500 kg
    end

    Fusion->>DB: Lookup vehicle by plate
    DB->>Fusion: {type: "medium_truck", tier: 2, max: 8000}

    alt Weight within Tier
        Fusion->>Gate: OPEN gate
        Fusion->>DB: Log validated entry
        Fusion->>Dash: Green entry notification
    else Weight exceeds Tier
        Fusion->>Gate: BLOCK gate
        Fusion->>DB: Log anomaly + snapshot
        Fusion->>Dash: Red alert — overweight
    else Plate not found
        Fusion->>Gate: BLOCK gate
        Fusion->>DB: Log unregistered attempt
        Fusion->>Dash: Red alert — unknown vehicle
    end
```

### Weighbridge Entry Data Model

```json
{
  "entry_id": "WB-20260507-009",
  "weighbridge_id": "WB-NORTH-01",
  "license_plate": "KA01AB1234",
  "plate_confidence": 0.95,
  "vehicle_type": "medium_truck",
  "expected_tier": 2,
  "tier_max_weight_kg": 8000,
  "actual_weight_kg": 8500,
  "weight_difference_kg": 500,
  "validation_status": "OVERWEIGHT",
  "gate_action": "BLOCKED",
  "entry_snapshot": "/evidence/wb-009-plate.jpg",
  "timestamp": "2026-05-07T10:15:42Z",
  "alert_raised": true
}
```

---

## 8. Use Case 4 — Street Garbage Monitoring from Vehicle-Mounted Cameras

### Objective

Detect garbage, litter, and overflowing bins from dashcam footage on waste transport vehicles. Tag detections with GPS coordinates and generate a city-wide garbage heatmap.

### Detection Categories

| Category | Examples | Severity Mapping |
|----------|----------|-----------------|
| **Litter** | Bottles, wrappers, cups | LOW |
| **Bags** | Plastic bags, trash bags on street | MEDIUM |
| **Pile** | Large garbage pile, dumped waste | HIGH |
| **Overflowing Bin** | Bin with garbage spilling out | MEDIUM |
| **Illegal Dump** | Construction debris, bulk waste | CRITICAL |

### Functional Flow

```mermaid
flowchart TD
    A["Waste Truck on Route<br/>Dashcam + GPS Active"] --> B["Continuous Capture Loop"]

    B --> C["Extract Frame<br/>every 2 seconds"]
    B --> D["Read GPS Coordinates<br/>every 2 seconds"]

    C --> E["YOLOv8 Custom Model<br/>Trained on TACO Dataset"]
    E --> F{"Garbage<br/>Detected?"}

    F -->|No| B
    F -->|Yes| G["Detection Processor"]

    G --> H["Count Objects in Frame"]
    G --> I["Classify Object Types"]
    G --> J["Estimate Severity"]

    H --> K{"Severity<br/>Assessment"}
    I --> K
    J --> K

    K -->|"1-3 items"| L["LOW Severity"]
    K -->|"4-10 items"| M["MEDIUM Severity"]
    K -->|"10+ items or pile"| N["HIGH Severity"]
    K -->|"Illegal dump"| O["CRITICAL Severity"]

    D --> P["Tag Detection<br/>with GPS Coordinates"]
    L --> P
    M --> P
    N --> P
    O --> P

    P --> Q["Reverse Geocode<br/>GPS to Street Address"]
    Q --> R["Save Snapshot<br/>with Bounding Boxes"]
    R --> S["Create Garbage Event"]

    S --> T["Store in Database"]
    T --> U["Update Garbage Heatmap"]
    T --> V["Feed to UC5<br/>Auto Ticket Creation"]

    U --> W["Dashboard Map View"]
    W --> X["Hotspot Analysis"]

    style A fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px
    style F fill:#fff3e0,stroke:#e65100,stroke-width:2px
    style K fill:#fff3e0,stroke:#e65100,stroke-width:2px
    style L fill:#fff9c4,stroke:#f9a825,stroke-width:2px
    style M fill:#ffe0b2,stroke:#ef6c00,stroke-width:2px
    style N fill:#ffcdd2,stroke:#c62828,stroke-width:2px
    style O fill:#f8bbd0,stroke:#880e4f,stroke-width:2px
    style V fill:#e1bee7,stroke:#6a1b9a,stroke-width:2px
```

### Vehicle Route Processing Pipeline

```mermaid
sequenceDiagram
    participant Dashcam
    participant GPS as GPS Module
    participant Processor as Frame Processor
    participant YOLO as Garbage Detector
    participant Geocoder as Reverse Geocoder
    participant DB as Database
    participant Map as Heatmap Engine

    loop Every 2 Seconds
        Dashcam->>Processor: Raw Frame
        GPS->>Processor: {lat: 12.971, lng: 77.594}
        Processor->>YOLO: Preprocessed Frame

        alt Garbage Found
            YOLO->>Processor: Detections [{class: "pile", conf: 0.89}, ...]
            Processor->>Processor: Score severity (HIGH)
            Processor->>Processor: Draw bounding boxes + save snapshot
            Processor->>Geocoder: (12.971, 77.594)
            Geocoder->>Processor: "MG Road, Ward 42, Bangalore"
            Processor->>DB: INSERT garbage_event
            DB->>Map: Trigger heatmap update
        else No Garbage
            YOLO->>Processor: No detections
            Note over Processor: Skip — continue to next frame
        end
    end
```

### Garbage Event Data Model

```json
{
  "event_id": "GRB-20260507-037",
  "vehicle_id": "TRUCK-KA01-7842",
  "route_id": "ROUTE-SOUTH-05",
  "location": {
    "latitude": 12.9716,
    "longitude": 77.5946,
    "address": "MG Road, Ward 42, Bangalore",
    "ward": "Ward 42",
    "zone": "South Zone"
  },
  "detections": [
    {"class": "garbage_pile", "confidence": 0.91, "bbox": [120, 340, 480, 520]},
    {"class": "plastic_bag", "confidence": 0.87, "bbox": [510, 380, 590, 440]},
    {"class": "plastic_bag", "confidence": 0.82, "bbox": [320, 410, 380, 460]}
  ],
  "severity": "HIGH",
  "object_count": 3,
  "snapshot_url": "/evidence/grb-037-annotated.jpg",
  "timestamp": "2026-05-07T10:32:00Z",
  "ticket_created": true,
  "ticket_id": "TKT-20260507-019"
}
```

---

## 9. Use Case 5 — Auto Ticket Creation from Video Analytics

### Objective

Automatically generate cleanup tickets when garbage is detected (from UC4 or any source), with de-duplication, severity-based prioritization, and crew assignment.

### Ticket Lifecycle

```mermaid
stateDiagram-v2
    [*] --> OPEN: Garbage Detected
    OPEN --> ASSIGNED: Auto-assign to crew
    ASSIGNED --> IN_PROGRESS: Crew acknowledges
    IN_PROGRESS --> RESOLVED: Crew uploads cleanup photo
    RESOLVED --> VERIFIED: AI verifies cleanup
    VERIFIED --> CLOSED: Confirmed clean
    RESOLVED --> REOPENED: Verification failed
    REOPENED --> ASSIGNED: Reassign
    OPEN --> DUPLICATE: Existing ticket in radius
    DUPLICATE --> [*]: Merged with parent ticket

    note right of OPEN
        Auto-created by system
        No human intervention
    end note

    note right of VERIFIED
        AI compares before/after
        snapshots to confirm cleanup
    end note
```

### Functional Flow

```mermaid
flowchart TD
    A["Garbage Event from UC4<br/>or Manual Report"] --> B{"Open Ticket<br/>within 100m Radius?"}

    B -->|Yes| C["UPDATE Existing Ticket"]
    C --> C1["Append new snapshot"]
    C --> C2["Bump severity if worse"]
    C --> C3["Update last_seen timestamp"]

    B -->|No| D["CREATE New Ticket"]

    D --> E["Populate Ticket Fields"]
    E --> E1["Location + Address"]
    E --> E2["Severity Level"]
    E --> E3["Evidence Snapshots"]
    E --> E4["Detection Metadata"]

    E1 --> F["Auto-Assignment Engine"]
    E2 --> F
    F --> F1["Lookup Ward/Zone"]
    F --> F2["Find Nearest Available Crew"]
    F --> F3["Check Crew Workload"]

    F1 --> G["Assign to Crew"]
    F2 --> G
    F3 --> G

    G --> H["Send Notifications"]
    H --> H1["Push to Crew Mobile App"]
    H --> H2["Email to Supervisor"]
    H --> H3["Dashboard Alert"]

    G --> I["Ticket: ASSIGNED"]

    I --> J["Crew Performs Cleanup"]
    J --> K["Crew Uploads Photo"]

    K --> L["AI Verification"]
    L --> M{"Location<br/>Clean?"}

    M -->|Yes| N["Ticket: VERIFIED + CLOSED"]
    M -->|No| O["Ticket: REOPENED<br/>Reassign to Crew"]
    O --> G

    N --> P["Analytics Update"]
    P --> P1["Resolution Time Tracked"]
    P --> P2["Crew Performance Scored"]
    P --> P3["Zone Cleanliness Index Updated"]

    style A fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px
    style B fill:#fff3e0,stroke:#e65100,stroke-width:2px
    style D fill:#c8e6c9,stroke:#2e7d32,stroke-width:2px
    style G fill:#bbdefb,stroke:#1565c0,stroke-width:2px
    style M fill:#fff3e0,stroke:#e65100,stroke-width:2px
    style N fill:#c8e6c9,stroke:#2e7d32,stroke-width:2px
    style O fill:#ffcdd2,stroke:#c62828,stroke-width:2px
```

### De-duplication Logic

```mermaid
flowchart LR
    A["New Garbage Event<br/>at (lat, lng)"] --> B["Query DB: Open Tickets"]
    B --> C["Calculate Distance<br/>to Each Open Ticket"]
    C --> D{"Any Ticket<br/>within 100m?"}
    D -->|Yes| E["Merge into<br/>Existing Ticket"]
    D -->|No| F["Create New Ticket"]

    style D fill:#fff3e0,stroke:#e65100,stroke-width:2px
```

### Ticket Data Model

```json
{
  "ticket_id": "TKT-20260507-019",
  "source": "AUTO_DETECTION",
  "source_event_ids": ["GRB-20260507-037", "GRB-20260507-041"],
  "location": {
    "latitude": 12.9716,
    "longitude": 77.5946,
    "address": "MG Road, Ward 42, Bangalore",
    "ward": "Ward 42",
    "zone": "South Zone"
  },
  "severity": "HIGH",
  "priority": 1,
  "status": "ASSIGNED",
  "assigned_crew": {
    "crew_id": "CREW-SOUTH-12",
    "crew_name": "South Zone Team 12",
    "assigned_at": "2026-05-07T10:33:15Z"
  },
  "evidence": [
    {
      "snapshot_url": "/evidence/grb-037-annotated.jpg",
      "captured_at": "2026-05-07T10:32:00Z",
      "type": "DETECTION"
    }
  ],
  "created_at": "2026-05-07T10:32:05Z",
  "updated_at": "2026-05-07T10:33:15Z",
  "resolved_at": null,
  "resolution_photo_url": null,
  "sla_deadline": "2026-05-07T14:32:05Z",
  "sla_hours": 4
}
```

---

## 10. Dashboard Design

### Layout Architecture

```mermaid
graph TB
    subgraph DASHBOARD["Smart Waste Management Dashboard"]
        subgraph NAV["Navigation Bar"]
            N1["Overview"]
            N2["UC1: Pickups"]
            N3["UC2: Station"]
            N4["UC3: Weighbridge"]
            N5["UC4: Street Scan"]
            N6["UC5: Tickets"]
            N7["Reports"]
        end

        subgraph MAIN["Main Content Area"]
            subgraph TOP_ROW["KPI Cards Row"]
                K1["Total Pickups Today<br/>142 / 180"]
                K2["Vehicles at Station<br/>7 Active"]
                K3["Weighbridge Entries<br/>34 Validated"]
                K4["Garbage Hotspots<br/>12 Detected"]
                K5["Open Tickets<br/>23 Pending"]
            end

            subgraph MID_ROW["Primary Panels"]
                MAP["Live City Map<br/>Vehicles | Garbage | Routes<br/>Heatmap Overlay"]
                FEED["Live Event Feed<br/>Real-time Alerts<br/>WebSocket Updates"]
            end

            subgraph BOTTOM_ROW["Analytics Panels"]
                CHART1["Collection Trend<br/>Line Chart — 7 Days"]
                CHART2["Vehicle Types<br/>Pie Chart"]
                CHART3["Severity Distribution<br/>Bar Chart"]
                TABLE["Recent Tickets<br/>Sortable Table"]
            end
        end
    end

    style NAV fill:#e3f2fd,stroke:#1565c0,stroke-width:2px
    style TOP_ROW fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px
    style MID_ROW fill:#fff3e0,stroke:#e65100,stroke-width:2px
    style BOTTOM_ROW fill:#f3e5f5,stroke:#6a1b9a,stroke-width:2px
```

### Dashboard Pages per Use Case

| Page | Key Components |
|------|---------------|
| **Overview** | KPI cards, city map with all layers, alert feed, summary charts |
| **UC1 — Pickups** | Collection points map (green/red), pickup timeline, daily completion % |
| **UC2 — Station** | Station camera feed, vehicle table (in/out), dwell time chart, capacity gauge |
| **UC3 — Weighbridge** | Live weighbridge feed, plate recognition display, weight log table, anomaly alerts |
| **UC4 — Street Scan** | Route map with garbage pins, heatmap toggle, severity filter, detection gallery |
| **UC5 — Tickets** | Ticket board (Kanban: Open/Assigned/Resolved), ticket detail modal, SLA tracker |
| **Reports** | Date range filters, exportable PDF, zone-wise analytics, crew performance |

---

## 11. Database Schema Overview

```mermaid
erDiagram
    COLLECTION_POINTS {
        uuid id PK
        string name
        float latitude
        float longitude
        string ward
        string zone
        string status
    }

    VEHICLES {
        uuid id PK
        string license_plate UK
        string type
        int weight_tier
        string status
    }

    PICKUP_EVENTS {
        uuid id PK
        uuid collection_point_id FK
        uuid vehicle_id FK
        timestamp arrival_time
        timestamp departure_time
        int dwell_seconds
        boolean pickup_confirmed
        float confidence
        string snapshot_url
    }

    STATION_EVENTS {
        uuid id PK
        string station_id
        uuid vehicle_id FK
        string vehicle_type
        timestamp entry_time
        timestamp exit_time
        float dwell_minutes
        string status
    }

    WEIGHBRIDGE_ENTRIES {
        uuid id PK
        string weighbridge_id
        uuid vehicle_id FK
        string license_plate
        float plate_confidence
        int expected_tier
        int tier_max_weight_kg
        int actual_weight_kg
        string validation_status
        string gate_action
        string snapshot_url
        timestamp created_at
    }

    GARBAGE_EVENTS {
        uuid id PK
        uuid vehicle_id FK
        string route_id
        float latitude
        float longitude
        string address
        string ward
        string severity
        int object_count
        json detections
        string snapshot_url
        timestamp detected_at
    }

    TICKETS {
        uuid id PK
        string source
        json source_event_ids
        float latitude
        float longitude
        string address
        string ward
        string zone
        string severity
        int priority
        string status
        string assigned_crew_id FK
        json evidence
        timestamp created_at
        timestamp resolved_at
        string resolution_photo_url
        int sla_hours
    }

    CREWS {
        uuid id PK
        string name
        string zone
        string status
        int active_tickets
    }

    ALERTS {
        uuid id PK
        string type
        string source_uc
        string message
        string severity
        json metadata
        boolean acknowledged
        timestamp created_at
    }

    COLLECTION_POINTS ||--o{ PICKUP_EVENTS : "has"
    VEHICLES ||--o{ PICKUP_EVENTS : "performs"
    VEHICLES ||--o{ STATION_EVENTS : "enters"
    VEHICLES ||--o{ WEIGHBRIDGE_ENTRIES : "weighed"
    VEHICLES ||--o{ GARBAGE_EVENTS : "detects from"
    GARBAGE_EVENTS ||--o{ TICKETS : "triggers"
    CREWS ||--o{ TICKETS : "assigned to"
```

---

## 12. API Endpoints

### Core REST Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/dashboard/stats` | KPI summary for all use cases |
| `GET` | `/api/dashboard/alerts` | Recent alerts with filters |
| `GET` | `/api/collections/points` | All collection points with status |
| `GET` | `/api/collections/events` | Pickup events with filters |
| `GET` | `/api/station/vehicles` | Current vehicles at station |
| `GET` | `/api/station/history` | Station entry/exit history |
| `GET` | `/api/weighbridge/entries` | Weighbridge entry log |
| `GET` | `/api/weighbridge/anomalies` | Flagged weight anomalies |
| `GET` | `/api/garbage/events` | Garbage detection events |
| `GET` | `/api/garbage/heatmap` | Aggregated heatmap data |
| `GET` | `/api/tickets` | All tickets with filters |
| `GET` | `/api/tickets/{id}` | Single ticket detail |
| `PATCH` | `/api/tickets/{id}/status` | Update ticket status |
| `POST` | `/api/tickets/{id}/resolve` | Mark ticket as resolved |
| `GET` | `/api/vehicles` | Registered vehicles |
| `GET` | `/api/crews` | Crew list and workload |
| `GET` | `/api/reports/daily` | Daily summary report |

### WebSocket Endpoints

| Endpoint | Purpose |
|----------|---------|
| `ws://host/ws/live-events` | Real-time event stream (all use cases) |
| `ws://host/ws/alerts` | Live alert notifications |
| `ws://host/ws/vehicle-tracking` | Live vehicle positions |

---

## 13. Deployment Strategy

### Docker Compose Architecture

```mermaid
graph TB
    subgraph DOCKER["Docker Compose Stack"]
        subgraph SERVICES["Application Services"]
            API["fastapi-backend<br/>:8000"]
            WORKER["ai-worker<br/>Video Processing"]
            REACT["react-dashboard<br/>:3000"]
        end

        subgraph DATA["Data Services"]
            PG["postgresql<br/>:5432"]
            RD["redis<br/>:6379"]
            MQ["mosquitto<br/>:1883"]
        end

        subgraph STORAGE["Volume Mounts"]
            VOL1["/data/evidence"]
            VOL2["/data/models"]
            VOL3["/data/postgres"]
        end
    end

    REACT -->|HTTP| API
    REACT -->|WebSocket| API
    API --> PG
    API --> RD
    WORKER --> PG
    WORKER --> RD
    WORKER --> MQ
    WORKER --> VOL1
    WORKER --> VOL2
    PG --> VOL3

    style SERVICES fill:#e3f2fd,stroke:#1565c0,stroke-width:2px
    style DATA fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px
    style STORAGE fill:#fff3e0,stroke:#e65100,stroke-width:2px
```

### Folder Structure

```
smart-waste-management/
├── backend/
│   ├── app/
│   │   ├── main.py                 # FastAPI entry point
│   │   ├── config.py               # Settings & environment
│   │   ├── models/                 # SQLAlchemy models
│   │   ├── schemas/                # Pydantic schemas
│   │   ├── routers/                # API route handlers
│   │   │   ├── dashboard.py
│   │   │   ├── collections.py      # UC1
│   │   │   ├── station.py          # UC2
│   │   │   ├── weighbridge.py      # UC3
│   │   │   ├── garbage.py          # UC4
│   │   │   └── tickets.py          # UC5
│   │   ├── services/               # Business logic
│   │   └── websocket/              # WebSocket handlers
│   ├── ai/
│   │   ├── detector.py             # YOLOv8 inference wrapper
│   │   ├── tracker.py              # ByteTrack vehicle tracking
│   │   ├── plate_reader.py         # License plate OCR
│   │   ├── garbage_classifier.py   # Garbage severity scoring
│   │   └── models/                 # Trained model weights
│   ├── iot/
│   │   ├── mqtt_client.py          # MQTT subscriber
│   │   └── simulator.py            # IoT data simulator
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Pickups.jsx         # UC1
│   │   │   ├── Station.jsx         # UC2
│   │   │   ├── Weighbridge.jsx     # UC3
│   │   │   ├── StreetScan.jsx      # UC4
│   │   │   └── Tickets.jsx         # UC5
│   │   ├── components/
│   │   │   ├── MapView.jsx
│   │   │   ├── StatsCard.jsx
│   │   │   ├── AlertFeed.jsx
│   │   │   ├── TicketBoard.jsx
│   │   │   └── VideoPlayer.jsx
│   │   └── services/
│   │       ├── api.js
│   │       └── websocket.js
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
├── SMART_WASTE_MANAGEMENT_PLAN.md
└── README.md
```

---

> **Document Version:** 1.0
> **Last Updated:** 2026-05-07
> **Status:** Planning & Design Phase
