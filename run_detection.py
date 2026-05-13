"""
Standalone Waste Detection — Run without the full server.
Opens webcam/video, detects waste objects, shows annotated feed in a window.

Usage:
    python run_detection.py                      # webcam
    python run_detection.py --source video.mp4   # video file
    python run_detection.py --source rtsp://...  # RTSP stream
"""

import argparse
import sys
import time
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent))

import cv2
from backend.ai.detector import WasteDetector
from backend.app.config import EVIDENCE_DIR


def main():
    parser = argparse.ArgumentParser(description="Smart Waste Detection - Live Camera Monitor")
    parser.add_argument("--source", default="0", help="Camera index (0), video file path, or RTSP URL")
    parser.add_argument("--confidence", type=float, default=0.35, help="Detection confidence threshold")
    parser.add_argument("--interval", type=int, default=1, help="Process every N-th frame")
    parser.add_argument("--save", action="store_true", help="Save detection snapshots")
    parser.add_argument("--no-display", action="store_true", help="Run headless (no window)")
    args = parser.parse_args()

    # Parse source
    source = args.source
    try:
        source = int(source)
    except ValueError:
        pass

    # Initialize detector
    detector = WasteDetector(confidence=args.confidence)
    detector.load_model()

    # Open camera
    print(f"\n[*] Opening camera source: {source}")
    cap = cv2.VideoCapture(source)
    if not cap.isOpened():
        print(f"[ERROR] Cannot open source: {source}")
        sys.exit(1)

    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    print(f"[*] Resolution: {w}x{h} @ {fps:.0f} FPS")
    print(f"[*] Confidence threshold: {args.confidence}")
    print(f"[*] Processing every {args.interval} frame(s)")
    print(f"[*] Save detections: {args.save}")
    print("\n[*] Press 'q' to quit, 's' to save snapshot\n")

    frame_count = 0
    detection_count = 0
    start_time = time.time()

    while True:
        ret, frame = cap.read()
        if not ret:
            if isinstance(source, str) and Path(source).is_file():
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                continue
            print("[*] End of stream.")
            break

        frame_count += 1

        if frame_count % args.interval == 0:
            result = detector.detect(frame)
            display_frame = result.annotated_frame

            if result.object_count > 0:
                detection_count += 1
                elapsed = time.time() - start_time
                print(
                    f"  [{time.strftime('%H:%M:%S')}] "
                    f"Waste detected! Count: {result.object_count} | "
                    f"Severity: {result.severity} | "
                    f"Classes: {[d.class_name for d in result.detections]}"
                )

                if args.save:
                    ts = time.strftime("%Y%m%d_%H%M%S")
                    path = EVIDENCE_DIR / f"det_{ts}_{result.severity}.jpg"
                    cv2.imwrite(str(path), result.annotated_frame)
        else:
            display_frame = frame

        if not args.no_display:
            # Add controls hint
            cv2.putText(display_frame, "Press 'q' to quit | 's' to save snapshot",
                        (10, display_frame.shape[0] - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.45, (180, 180, 180), 1)

            cv2.imshow("Smart Waste Detection Monitor", display_frame)
            key = cv2.waitKey(1) & 0xFF

            if key == ord("q"):
                break
            elif key == ord("s"):
                ts = time.strftime("%Y%m%d_%H%M%S")
                path = EVIDENCE_DIR / f"manual_{ts}.jpg"
                cv2.imwrite(str(path), display_frame)
                print(f"  [Saved] {path}")

    # Summary
    elapsed = time.time() - start_time
    print(f"\n{'='*50}")
    print(f"  Session Summary")
    print(f"  Duration: {elapsed:.1f}s")
    print(f"  Frames processed: {frame_count}")
    print(f"  Detections: {detection_count}")
    print(f"  FPS: {frame_count / elapsed:.1f}")
    print(f"{'='*50}\n")

    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
