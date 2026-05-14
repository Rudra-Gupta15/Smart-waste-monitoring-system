# pyrefly: ignore [missing-import]
import cv2

cap = cv2.VideoCapture(r"c:\Study\Projects\smart waste management\data\uploads\2.jpg")
print("Opened:", cap.isOpened())
ret, frame = cap.read()
print("First read:", ret)
ret, frame = cap.read()
print("Second read:", ret)

cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
ret, frame = cap.read()
print("Third read (after set):", ret)
