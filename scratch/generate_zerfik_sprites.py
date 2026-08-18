from PIL import Image, ImageDraw
import math

def create_sprite(pose='idle', filename='public/images/zerfik_idle.png'):
    # 256x256 high-definition canvas with pure transparent background
    img = Image.new('RGBA', (256, 256), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Center coordinates
    cx, cy = 128, 128

    # Wing colors
    wing_outer = (14, 165, 233, 200) # cyan-500
    wing_inner = (125, 211, 252, 230) # sky-300
    wing_glow = (224, 242, 254, 255) # sky-100

    # Body colors
    body_dark = (2, 132, 199, 255) # sky-600
    body_main = (14, 165, 233, 255) # sky-500
    body_light = (56, 189, 248, 255) # sky-400
    body_bright = (186, 230, 253, 255) # sky-200
    body_highlight = (240, 249, 255, 255) # sky-50

    # Eye colors
    eye_white = (255, 255, 255, 255)
    eye_pupil = (15, 23, 42, 255) # slate-900

    # Blush
    blush = (251, 113, 133, 140) # rose-400

    # 1. Draw Wings
    if pose == 'thinking':
        # Wings lowered slightly
        draw.polygon([(cx - 24, cy - 10), (cx - 70, cy - 35), (cx - 78, cy + 5), (cx - 24, cy + 15)], fill=wing_outer)
        draw.polygon([(cx - 24, cy - 8), (cx - 62, cy - 28), (cx - 70, cy + 2), (cx - 24, cy + 10)], fill=wing_inner)
        draw.polygon([(cx + 24, cy - 10), (cx + 70, cy - 35), (cx + 78, cy + 5), (cx + 24, cy + 15)], fill=wing_outer)
        draw.polygon([(cx + 24, cy - 8), (cx + 62, cy - 28), (cx + 70, cy + 2), (cx + 24, cy + 10)], fill=wing_inner)
    elif pose == 'celebrate' or pose == 'happy':
        # Wings raised high in excitement
        draw.polygon([(cx - 24, cy - 20), (cx - 80, cy - 65), (cx - 85, cy - 15), (cx - 24, cy + 5)], fill=wing_outer)
        draw.polygon([(cx - 24, cy - 18), (cx - 72, cy - 55), (cx - 76, cy - 18), (cx - 24, cy + 2)], fill=wing_inner)
        draw.polygon([(cx + 24, cy - 20), (cx + 80, cy - 65), (cx + 85, cy - 15), (cx + 24, cy + 5)], fill=wing_outer)
        draw.polygon([(cx + 24, cy - 18), (cx + 72, cy - 55), (cx + 76, cy - 18), (cx + 24, cy + 2)], fill=wing_inner)
    elif pose == 'look_left':
        # Left wing forward, right wing back
        draw.polygon([(cx - 24, cy - 15), (cx - 75, cy - 45), (cx - 80, cy + 5), (cx - 24, cy + 15)], fill=wing_outer)
        draw.polygon([(cx - 24, cy - 12), (cx - 65, cy - 38), (cx - 70, cy + 2), (cx - 24, cy + 10)], fill=wing_inner)
        draw.polygon([(cx + 20, cy - 12), (cx + 55, cy - 35), (cx + 60, cy + 2), (cx + 20, cy + 10)], fill=wing_outer)
    elif pose == 'look_right':
        # Right wing forward, left wing back
        draw.polygon([(cx - 20, cy - 12), (cx - 55, cy - 35), (cx - 60, cy + 2), (cx - 20, cy + 10)], fill=wing_outer)
        draw.polygon([(cx + 24, cy - 15), (cx + 75, cy - 45), (cx + 80, cy + 5), (cx + 24, cy + 15)], fill=wing_outer)
        draw.polygon([(cx + 24, cy - 12), (cx + 65, cy - 38), (cx + 70, cy + 2), (cx + 24, cy + 10)], fill=wing_inner)
    else: # idle
        # Balanced floating wings
        draw.polygon([(cx - 24, cy - 15), (cx - 75, cy - 45), (cx - 82, cy - 5), (cx - 24, cy + 10)], fill=wing_outer)
        draw.polygon([(cx - 24, cy - 12), (cx - 66, cy - 38), (cx - 72, cy - 8), (cx - 24, cy + 8)], fill=wing_inner)
        draw.polygon([(cx + 24, cy - 15), (cx + 75, cy - 45), (cx + 82, cy - 5), (cx + 24, cy + 10)], fill=wing_outer)
        draw.polygon([(cx + 24, cy - 12), (cx + 66, cy - 38), (cx + 72, cy - 8), (cx + 24, cy + 8)], fill=wing_inner)

    # 2. Draw Body & Ghost Tail (Cute Spirit Shape)
    # Ghostly Tail
    tail_pts = [(cx - 22, cy + 40), (cx, cy + 85), (cx + 22, cy + 40), (cx + 10, cy + 25), (cx - 10, cy + 25)]
    draw.polygon(tail_pts, fill=body_main)
    draw.polygon([(cx - 15, cy + 38), (cx, cy + 75), (cx + 15, cy + 38)], fill=body_light)

    # Torso
    draw.rounded_rectangle([cx - 28, cy - 10, cx + 28, cy + 52], radius=16, fill=body_main, outline=body_dark, width=2)
    draw.rounded_rectangle([cx - 22, cy - 6, cx + 22, cy + 46], radius=12, fill=body_light)

    # Gem / Core on chest (Diamond crystal)
    draw.polygon([(cx, cy + 10), (cx + 10, cy + 22), (cx, cy + 34), (cx - 10, cy + 22)], fill=body_highlight, outline=body_dark, width=2)
    draw.polygon([(cx, cy + 14), (cx + 6, cy + 22), (cx, cy + 30), (cx - 6, cy + 22)], fill=eye_white)

    # Arms
    if pose == 'thinking':
        # Right hand to chin/cheek
        draw.ellipse([cx - 38, cy + 8, cx - 22, cy + 32], fill=body_light, outline=body_dark, width=2)
        draw.ellipse([cx + 12, cy - 8, cx + 32, cy + 16], fill=body_light, outline=body_dark, width=2)
    elif pose == 'celebrate' or pose == 'happy':
        # Both hands raised happily
        draw.ellipse([cx - 44, cy - 15, cx - 24, cy + 10], fill=body_light, outline=body_dark, width=2)
        draw.ellipse([cx + 24, cy - 15, cx + 44, cy + 10], fill=body_light, outline=body_dark, width=2)
    else:
        # Floating cute stubby arms
        draw.ellipse([cx - 40, cy + 10, cx - 22, cy + 36], fill=body_light, outline=body_dark, width=2)
        draw.ellipse([cx + 22, cy + 10, cx + 40, cy + 36], fill=body_light, outline=body_dark, width=2)

    # 3. Head (Large cute cubic/rounded Allay head)
    head_x = cx
    head_y = cy - 42

    if pose == 'thinking':
        head_x = cx + 4
        head_y = cy - 44

    draw.rounded_rectangle([head_x - 44, head_y - 40, head_x + 44, head_y + 40], radius=24, fill=body_main, outline=body_dark, width=3)
    draw.rounded_rectangle([head_x - 38, head_y - 34, head_x + 38, head_y + 34], radius=20, fill=body_light)

    # Top head highlight
    draw.rounded_rectangle([head_x - 30, head_y - 30, head_x + 10, head_y - 12], radius=10, fill=body_highlight)

    # 4. Eyes & Facial Expression
    eye_offset_x = 0
    eye_offset_y = 0
    if pose == 'look_left':
        eye_offset_x = -8
    elif pose == 'look_right':
        eye_offset_x = 8
    elif pose == 'thinking':
        eye_offset_x = 4
        eye_offset_y = -6

    lx = head_x - 20 + eye_offset_x
    rx = head_x + 20 + eye_offset_x
    ey = head_y - 4 + eye_offset_y

    if pose == 'celebrate' or pose == 'happy':
        # Happy curved closed eyes (^ ^)
        draw.arc([lx - 12, ey - 10, lx + 12, ey + 10], start=180, end=360, fill=eye_pupil, width=4)
        draw.arc([rx - 12, ey - 10, rx + 12, ey + 10], start=180, end=360, fill=eye_pupil, width=4)
        # Big smile
        draw.arc([head_x - 10, head_y + 8, head_x + 10, head_y + 24], start=0, end=180, fill=eye_pupil, width=3)
        # Cheeks blush
        draw.ellipse([lx - 8, ey + 12, lx + 8, ey + 22], fill=blush)
        draw.ellipse([rx - 8, ey + 12, rx + 8, ey + 22], fill=blush)
    elif pose == 'thinking':
        # Big curious looking up eyes
        draw.rounded_rectangle([lx - 10, ey - 12, lx + 10, ey + 12], radius=6, fill=eye_white, outline=body_dark, width=2)
        draw.rounded_rectangle([rx - 10, ey - 12, rx + 10, ey + 12], radius=6, fill=eye_white, outline=body_dark, width=2)
        # Pupil looking up-right
        draw.rounded_rectangle([lx + 1, ey - 10, lx + 9, ey], radius=3, fill=eye_pupil)
        draw.rounded_rectangle([rx + 1, ey - 10, rx + 9, ey], radius=3, fill=eye_pupil)
        # Thoughtful small 'o' mouth
        draw.ellipse([head_x - 4, head_y + 14, head_x + 4, head_y + 22], fill=eye_pupil)
    else:
        # Standard cute glowing square/pill eyes
        draw.rounded_rectangle([lx - 9, ey - 12, lx + 9, ey + 12], radius=6, fill=eye_white, outline=body_dark, width=2)
        draw.rounded_rectangle([rx - 9, ey - 12, rx + 9, ey + 12], radius=6, fill=eye_white, outline=body_dark, width=2)
        # Pupils
        p_ox = 0
        if pose == 'look_left': p_ox = -4
        elif pose == 'look_right': p_ox = 4
        draw.rounded_rectangle([lx - 4 + p_ox, ey - 6, lx + 4 + p_ox, ey + 6], radius=3, fill=eye_pupil)
        draw.rounded_rectangle([rx - 4 + p_ox, ey - 6, rx + 4 + p_ox, ey + 6], radius=3, fill=eye_pupil)
        # Cute smile
        draw.arc([head_x - 10, head_y + 8, head_x + 10, head_y + 22], start=0, end=180, fill=eye_pupil, width=3)
        # Soft blush
        draw.ellipse([lx - 6, ey + 12, lx + 6, ey + 20], fill=blush)
        draw.ellipse([rx - 6, ey + 12, rx + 6, ey + 20], fill=blush)

    img.save(filename, 'PNG')
    print(f"Generated clean sprite: {filename}")

create_sprite('idle', 'public/images/zerfik_idle.png')
create_sprite('look_left', 'public/images/zerfik_left.png')
create_sprite('look_right', 'public/images/zerfik_right.png')
create_sprite('thinking', 'public/images/zerfik_thinking.png')
create_sprite('happy', 'public/images/zerfik_happy.png')
create_sprite('idle', 'public/images/zerfik_spirit.png')
