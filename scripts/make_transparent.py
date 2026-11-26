import os
from PIL import Image

def make_transparent(input_path, output_path):
    img = Image.open(input_path).convert("RGBA")
    datas = img.getdata()

    new_data = []
    for item in datas:
        # item is (R, G, B, A)
        r, g, b, a = item
        # If pure white or very close to white
        if r > 245 and g > 245 and b > 245:
            # Smooth feathering between 240 and 255
            diff = max(r, g, b) - 240
            alpha = max(0, int(255 - (diff / 15.0) * 255))
            new_data.append((r, g, b, alpha))
        else:
            new_data.append(item)

    img.putdata(new_data)
    img.save(output_path, "PNG")
    print(f"Processed: {output_path}")

icons = [
    ("3d_lock_green.jpg", "3d_lock_green.png"),
    ("3d_key_green.jpg", "3d_key_green.png"),
    ("3d_shield_green.jpg", "3d_shield_green.png"),
    ("3d_user_green.jpg", "3d_user_green.png"),
    ("3d_lock_blue.jpg", "3d_lock_blue.png"),
    ("3d_key_blue.jpg", "3d_key_blue.png"),
    ("3d_shield_blue.jpg", "3d_shield_blue.png"),
    ("3d_user_blue.jpg", "3d_user_blue.png"),
]

for src, dst in icons:
    src_path = os.path.join(r"c:\patient_matters\mobile\assets\images", src)
    dst_path = os.path.join(r"c:\patient_matters\mobile\assets\images", dst)
    if os.path.exists(src_path):
        make_transparent(src_path, dst_path)

    # Also copy to doctor_matters
    doc_dst_path = os.path.join(r"c:\doctor_matters\mobile\assets\images", dst)
    if os.path.exists(dst_path):
        Image.open(dst_path).save(doc_dst_path, "PNG")
        print(f"Copied to doctor: {doc_dst_path}")

