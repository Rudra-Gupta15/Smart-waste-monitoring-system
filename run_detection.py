"""
Standalone Waste Detection — Run without the full server.

Supports three modes automatically based on --source:
  • Static image  — detect_image() used, results shown instantly
  • Video file    — frame-by-frame with tracking + display
  • Webcam / RTSP — live feed with tracking + display

Usage:
    python run_detection.py                        # webcam (index 0)
    python run_detection.py --source photo.jpg     # static image
    python run_detection.py --source video.mp4     # video file
    python run_detection.py --source rtsp://...    # RTSP stream
"""

import argparse
import sys
import time
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent))

# pyrefly: ignore [missing-import]
import cv2
from backend.ai.detector import WasteDetector
from backend.app.config import EVIDENCE_DIR

# Image file extensions handled via detect_image() (no tracking needed)
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".webp"}


def _print_result(result, label=""):
    """Pretty-print a FrameResult to the terminal."""
    if result.object_count == 0:
        print(f"  [{label}] No waste detected.")
        return
    print(
        f"  [{label}] {result.object_count} object(s) | Severity: {result.severity}"
    )
    for d in result.detections:
        types_str = f"  [{','.join(d.types_list)}]" if d.types_list else ""
        print(
            f"    • #{d.id} {d.class_name}{types_str}  — {d.category}  "
            f"conf={d.confidence:.1%}  bbox={d.bbox}"
        )


def run_image(source: str, detector: WasteDetector, args):
    """Detect waste in a single static image using detect_image()."""
    print(f"\n[*] Static image mode: {source}")

    frame = cv2.imread(source)
    if frame is None:
        print(f"[ERROR] Cannot read image: {source}")
        sys.exit(1)

    h, w = frame.shape[:2]
    print(f"[*] Resolution: {w}×{h}")

    t0 = time.time()
    result = detector.detect_image(frame)
    elapsed_ms = (time.time() - t0) * 1000
    print(f"[*] Inference time: {elapsed_ms:.0f} ms")

    _print_result(result, time.strftime("%H:%M:%S"))

    if args.save and result.annotated_frame is not None:
        ts = time.strftime("%Y%m%d_%H%M%S")
        path = EVIDENCE_DIR / f"img_{ts}_{result.severity}.jpg"
        cv2.imwrite(str(path), result.annotated_frame)
        print(f"  [Saved] {path}")

    if not args.no_display and result.annotated_frame is not None:
        print("\n[*] Press any key to close the window.")
        cv2.imshow("Smart Waste Detection — Image", result.annotated_frame)
        cv2.waitKey(0)
        cv2.destroyAllWindows()


def run_video(source, detector: WasteDetector, args):
    """Run detection on a video file or live camera feed."""
    is_image_src = isinstance(source, str) and Path(source).suffix.lower() in IMAGE_EXTS
    if is_image_src:
        # Already handled by run_image()
        run_image(source, detector, args)
        return

    is_file = isinstance(source, str) and Path(source).is_file()
    mode = "video file" if is_file else "live camera"
    print(f"\n[*] {mode.title()} mode: {source}")

    cap = cv2.VideoCapture(source)
    if not cap.isOpened():
        print(f"[ERROR] Cannot open source: {source}")
        sys.exit(1)

    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    frame_delay = (1.0 / fps) if is_file else 0.0

    print(f"[*] Resolution  : {w}×{h} @ {fps:.0f} FPS")
    print(f"[*] Confidence  : {args.confidence}")
    print(f"[*] Frame skip  : every {args.interval} frame(s)")
    print(f"[*] Save snaps  : {args.save}")
    print("\n[*] Press 'q' to quit  |  's' to save snapshot\n")

    frame_count = 0
    detection_count = 0
    start_time = time.time()

    while True:
        t_frame = time.time()
        ret, frame = cap.read()
        if not ret:
            if is_file:
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                continue
            print("[*] End of stream.")
            break

        frame_count += 1

        if frame_count % args.interval == 0:
            result = detector.detect(frame)
            display_frame = result.annotated_frame if result.annotated_frame is not None else frame

            if result.object_count > 0:
                detection_count += 1
                _print_result(result, time.strftime("%H:%M:%S"))

                if args.save:
                    ts = time.strftime("%Y%m%d_%H%M%S")
                    path = EVIDENCE_DIR / f"vid_{ts}_{result.severity}.jpg"
                    cv2.imwrite(str(path), display_frame)
        else:
            display_frame = frame

        if not args.no_display:
            cv2.putText(
                display_frame,
                "Press 'q' quit  |  's' save snapshot",
                (10, display_frame.shape[0] - 10),
                cv2.FONT_HERSHEY_SIMPLEX, 0.45, (180, 180, 180), 1,
            )
            cv2.imshow("Smart Waste Detection Monitor", display_frame)
            key = cv2.waitKey(1) & 0xFF
            if key == ord("q"):
                break
            elif key == ord("s"):
                ts = time.strftime("%Y%m%d_%H%M%S")
                path = EVIDENCE_DIR / f"manual_{ts}.jpg"
                cv2.imwrite(str(path), display_frame)
                print(f"  [Saved] {path}")

        # Pace output to real video speed
        if is_file and frame_delay > 0:
            elapsed = time.time() - t_frame
            sleep = frame_delay - elapsed
            if sleep > 0:
                time.sleep(sleep)

    elapsed = time.time() - start_time
    print(f"\n{'=' * 50}")
    print(f"  Session Summary")
    print(f"  Duration     : {elapsed:.1f}s")
    print(f"  Frames       : {frame_count}")
    print(f"  Detections   : {detection_count}")
    print(f"  FPS avg      : {frame_count / elapsed:.1f}")
    print(f"{'=' * 50}\n")

    cap.release()
    cv2.destroyAllWindows()


def main():
    parser = argparse.ArgumentParser(
        description="Smart Waste Detection — standalone runner",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--source", default="0",
        help="Camera index (0), image path, video file path, or RTSP URL",
    )
    parser.add_argument(
        "--confidence", type=float, default=0.20,
        help="Detection confidence threshold (default: 0.20)",
    )
    parser.add_argument(
        "--interval", type=int, default=1,
        help="Process every N-th frame for video/live (default: 1)",
    )
    parser.add_argument("--save", action="store_true", help="Save detection snapshots")
    parser.add_argument("--no-display", action="store_true", help="Run headless (no window)")
    args = parser.parse_args()

    # Parse source
    source: str | int = args.source
    try:
        source = int(source)
    except ValueError:
        pass  # Keep as string (file path or RTSP)

    # Initialize detector
    detector = WasteDetector(confidence=args.confidence)
    detector.load_model()

    # Route to the correct mode
    if isinstance(source, str) and Path(source).suffix.lower() in IMAGE_EXTS:
        run_image(source, detector, args)
    else:
        run_video(source, detector, args)


if __name__ == "__main__":
    main()
