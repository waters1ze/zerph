from PIL import Image
import numpy as np

# Color Palette matching authentic Minecraft Allay
C_TRANS = (0, 0, 0, 0)
C_HEAD_TOP = (165, 230, 255, 255)    # Top highlight #a5e6ff
C_MAIN = (104, 192, 232, 255)        # Main cyan #68c0e8
C_SHADOW = (64, 154, 204, 255)       # Shadow cyan #409acc
C_DARK = (45, 120, 165, 255)         # Dark shadow #2d78a5
C_EYE_WHITE = (255, 255, 255, 255)   # Pure glowing white eyes
C_WING_MAIN = (104, 192, 232, 220)   # Translucent wing
C_WING_LIGHT = (180, 235, 255, 240)  # Wing highlight
C_WING_DARK = (55, 140, 185, 220)    # Wing edge

def draw_allay_sprite(pose='idle', filename='public/images/zerfik_idle.png'):
    grid = np.zeros((32, 32, 4), dtype=np.uint8)

    def set_p(x, y, color):
        if 0 <= x < 32 and 0 <= y < 32:
            grid[y, x] = color

    def fill_rect(x1, y1, x2, y2, color):
        for y in range(y1, y2 + 1):
            for x in range(x1, x2 + 1):
                set_p(x, y, color)

    # Base head position: (11..20, 5..14) -> 10x10 cube head
    hx1, hy1, hx2, hy2 = 11, 5, 20, 14

    if pose == 'down':
        # Head tilted slightly down
        hy1 += 1
        hy2 += 1
    elif pose == 'up' or pose == 'thinking':
        # Head tilted slightly up
        hy1 -= 1
        hy2 -= 1

    # 1. Stepped Minecraft Wings
    if pose == 'happy' or pose == 'celebrate':
        # Wings raised up high in celebration
        fill_rect(5, 6, 10, 7, C_WING_MAIN)
        fill_rect(3, 8, 6, 9, C_WING_MAIN)
        fill_rect(1, 10, 4, 11, C_WING_MAIN)
        fill_rect(5, 6, 10, 6, C_WING_LIGHT)

        fill_rect(21, 6, 26, 7, C_WING_MAIN)
        fill_rect(25, 8, 28, 9, C_WING_MAIN)
        fill_rect(27, 10, 30, 11, C_WING_MAIN)
        fill_rect(21, 6, 26, 6, C_WING_LIGHT)
    elif pose == 'look_left':
        fill_rect(3, 11, 10, 12, C_WING_MAIN)
        fill_rect(1, 13, 5, 14, C_WING_MAIN)
        fill_rect(3, 11, 10, 11, C_WING_LIGHT)
        fill_rect(21, 12, 26, 13, C_WING_MAIN)
        fill_rect(25, 14, 28, 15, C_WING_DARK)
    elif pose == 'look_right':
        fill_rect(5, 12, 10, 13, C_WING_MAIN)
        fill_rect(3, 14, 6, 15, C_WING_DARK)
        fill_rect(21, 11, 28, 12, C_WING_MAIN)
        fill_rect(26, 13, 30, 14, C_WING_MAIN)
        fill_rect(21, 11, 28, 11, C_WING_LIGHT)
    else:
        # Downward stepped wings
        fill_rect(4, 11, 10, 12, C_WING_MAIN)
        fill_rect(2, 13, 6, 14, C_WING_MAIN)
        fill_rect(1, 15, 3, 16, C_WING_DARK)
        fill_rect(4, 11, 10, 11, C_WING_LIGHT)

        fill_rect(21, 11, 27, 12, C_WING_MAIN)
        fill_rect(25, 13, 29, 14, C_WING_MAIN)
        fill_rect(28, 15, 30, 16, C_WING_DARK)
        fill_rect(21, 11, 27, 11, C_WING_LIGHT)

    # 2. Torso (13..18, 15..19) -> 6x5 block
    fill_rect(13, 15, 18, 19, C_MAIN)
    fill_rect(13, 18, 18, 19, C_SHADOW)
    # Highlight on chest
    fill_rect(15, 15, 16, 16, C_HEAD_TOP)

    # 3. Floating stepped tail/dress (20..25)
    fill_rect(14, 20, 17, 21, C_MAIN)
    fill_rect(14, 22, 16, 23, C_SHADOW)
    fill_rect(15, 24, 15, 25, C_DARK)

    # 4. Tiny Block Arms:
    # - By default: resting flush and lowered DOWN against the torso (NOT sticking out!)
    # - When happy: joyfully raised up high!
    if pose == 'happy' or pose == 'celebrate':
        # Arms raised joyfully up high!
        fill_rect(10, 10, 12, 14, C_MAIN)
        fill_rect(10, 10, 12, 10, C_HEAD_TOP)
        fill_rect(19, 10, 21, 14, C_MAIN)
        fill_rect(19, 10, 21, 10, C_HEAD_TOP)
    elif pose == 'thinking':
        # Left arm down, right arm bent to cheek
        fill_rect(12, 16, 13, 19, C_MAIN)
        fill_rect(18, 12, 19, 15, C_HEAD_TOP)
    else:
        # Arms hanging completely down along torso (flush with body, vertically lowered)
        fill_rect(12, 16, 13, 20, C_MAIN)
        fill_rect(12, 19, 13, 20, C_SHADOW)
        fill_rect(18, 16, 19, 20, C_MAIN)
        fill_rect(18, 19, 19, 20, C_SHADOW)

    # 5. Cubic Minecraft Head (10x10)
    fill_rect(hx1, hy1, hx2, hy2, C_MAIN)
    fill_rect(hx1, hy1, hx2, hy1 + 1, C_HEAD_TOP)
    fill_rect(hx1, hy2 - 1, hx2, hy2, C_SHADOW)
    fill_rect(hx1, hy1, hx1, hy2, C_MAIN)
    fill_rect(hx2, hy1, hx2, hy2, C_DARK)

    # 6. Glowing Rectangular Eyes (Vertical 2x4 White Bars)
    if pose == 'down':
        eye1_x, eye2_x = hx1 + 2, hx1 + 6
        eye_y1, eye_y2 = hy1 + 5, hy1 + 8
    elif pose == 'up':
        eye1_x, eye2_x = hx1 + 2, hx1 + 6
        eye_y1, eye_y2 = hy1 + 1, hy1 + 4
    elif pose == 'look_left':
        eye1_x, eye2_x = hx1 + 1, hx1 + 4
        eye_y1, eye_y2 = hy1 + 3, hy1 + 6
    elif pose == 'look_right':
        eye1_x, eye2_x = hx1 + 5, hx1 + 8
        eye_y1, eye_y2 = hy1 + 3, hy1 + 6
    elif pose == 'thinking':
        eye1_x, eye2_x = hx1 + 3, hx1 + 6
        eye_y1, eye_y2 = hy1 + 2, hy1 + 5
    elif pose == 'happy' or pose == 'celebrate':
        eye1_x, eye2_x = hx1 + 2, hx1 + 6
        eye_y1, eye_y2 = hy1 + 2, hy1 + 5
    else:
        eye1_x, eye2_x = hx1 + 2, hx1 + 6
        eye_y1, eye_y2 = hy1 + 3, hy1 + 6

    fill_rect(eye1_x, eye_y1, eye1_x + 1, eye_y2, C_EYE_WHITE)
    fill_rect(eye2_x, eye_y1, eye2_x + 1, eye_y2, C_EYE_WHITE)

    base_img = Image.fromarray(grid, 'RGBA')
    upscaled = base_img.resize((256, 256), Image.Resampling.NEAREST)
    upscaled.save(filename, 'PNG')
    print(f"Generated Allay pose with lowered arms: {pose} -> {filename}")

draw_allay_sprite('idle', 'public/images/zerfik_idle.png')
draw_allay_sprite('down', 'public/images/zerfik_down.png')
draw_allay_sprite('up', 'public/images/zerfik_up.png')
draw_allay_sprite('look_left', 'public/images/zerfik_left.png')
draw_allay_sprite('look_right', 'public/images/zerfik_right.png')
draw_allay_sprite('thinking', 'public/images/zerfik_thinking.png')
draw_allay_sprite('happy', 'public/images/zerfik_happy.png')
draw_allay_sprite('idle', 'public/images/zerfik_spirit.png')
