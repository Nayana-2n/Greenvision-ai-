from metadata import extract_metadata
from scale import determine_scale

image = input("Image Path: ")

metadata = extract_metadata(image)

scale = determine_scale(metadata)

print("\n------------ SCALE ------------")

for k, v in scale.items():
    print(f"{k:20}: {v}")
