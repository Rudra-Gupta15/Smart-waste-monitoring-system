import os
# pyrefly: ignore [missing-import]
import cv2
from pathlib import Path
# pyrefly: ignore [missing-import]
from ultralytics import YOLO

def auto_annotate():
    waste_dir = Path(r"c:\Study\Projects\smart waste management\Waste")
    model = YOLO(r"c:\Study\Projects\smart waste management\data\models\best_model.pt")
    
    # Mapping best_model classes to user's custom classes
    # User's classes: 0: garbage, 1: plastic_bag, 2: trash_bag, 3: litter, 4: garbage_pile, 5: bin
    class_map = {
        0: 0, # Glass -> garbage
        1: 0, # Metal -> garbage
        2: 3, # Paper -> litter
        3: 1, # Plastic -> plastic_bag
        4: 0, # Waste -> garbage
    }
    
    for img_path in waste_dir.glob("*.*"):
        if img_path.suffix.lower() not in [".jpg", ".jpeg", ".png"]:
            continue
            
        txt_path = img_path.with_suffix(".txt")
        
        # Run inference
        results = model(str(img_path), conf=0.10, verbose=False)[0]
        
        img_h, img_w = results.orig_img.shape[:2]
        
        raw_boxes = []
        for box in results.boxes:
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            cls_id = int(box.cls[0])
            raw_boxes.append({
                "bbox": [x1, y1, x2, y2],
                "cls": cls_id
            })
            
        # Cluster boxes to form garbage_pile (class 4)
        clusters = []
        MARGIN = 60
        
        for det in raw_boxes:
            x1, y1, x2, y2 = det["bbox"]
            b_x1, b_y1 = x1 - MARGIN, y1 - MARGIN
            b_x2, b_y2 = x2 + MARGIN, y2 + MARGIN
            
            matched_clusters = []
            for i, cluster in enumerate(clusters):
                cx1, cy1, cx2, cy2 = cluster["bbox"]
                if not (b_x2 < cx1 or b_x1 > cx2 or b_y2 < cy1 or b_y1 > cy2):
                    matched_clusters.append(i)
            
            if not matched_clusters:
                clusters.append({"bbox": [x1, y1, x2, y2], "dets": [det]})
            else:
                merged_dets = [det]
                min_x, min_y, max_x, max_y = x1, y1, x2, y2
                for i in sorted(matched_clusters, reverse=True):
                    c = clusters.pop(i)
                    merged_dets.extend(c["dets"])
                    cx1, cy1, cx2, cy2 = c["bbox"]
                    min_x = min(min_x, cx1)
                    min_y = min(min_y, cy1)
                    max_x = max(max_x, cx2)
                    max_y = max(max_y, cy2)
                clusters.append({"bbox": [min_x, min_y, max_x, max_y], "dets": merged_dets})
        
        # Write to txt in YOLO format (class_id center_x center_y width height)
        lines = []
        for c in clusters:
            if len(c["dets"]) >= 4:
                # garbage_pile is class 4
                out_cls = 4
                x1, y1, x2, y2 = c["bbox"]
            else:
                # keep individual
                for d in c["dets"]:
                    x1, y1, x2, y2 = d["bbox"]
                    out_cls = class_map.get(d["cls"], 0)
                    cx = ((x1 + x2) / 2) / img_w
                    cy = ((y1 + y2) / 2) / img_h
                    w = (x2 - x1) / img_w
                    h = (y2 - y1) / img_h
                    lines.append(f"{out_cls} {cx:.6f} {cy:.6f} {w:.6f} {h:.6f}")
                continue
                
            # garbage_pile coords
            cx = ((x1 + x2) / 2) / img_w
            cy = ((y1 + y2) / 2) / img_h
            w = (x2 - x1) / img_w
            h = (y2 - y1) / img_h
            # Clamp between 0 and 1
            cx, cy = max(0, min(1, cx)), max(0, min(1, cy))
            w, h = max(0, min(1, w)), max(0, min(1, h))
            lines.append(f"{out_cls} {cx:.6f} {cy:.6f} {w:.6f} {h:.6f}")
            
        with open(txt_path, "w") as f:
            f.write("\n".join(lines) + "\n")
            
        print(f"Annotated {img_path.name} with {len(lines)} labels.")

if __name__ == "__main__":
    auto_annotate()
