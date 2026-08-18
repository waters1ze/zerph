from PIL import Image
import numpy as np

img = Image.open('public/images/zerfik_spirit.png').convert('RGBA')
arr = np.array(img)
h, w, _ = arr.shape

# Let's inspect where cyan/blue character pixels are
# Character is primarily blue/cyan: B > R + 20 and B > 80 (or white eyes where R > 200, G > 200, B > 200)
is_cyan_blue = (arr[:, :, 2].astype(int) > arr[:, :, 0].astype(int) + 15) & (arr[:, :, 2] > 70)
is_white_glow = (arr[:, :, 0] > 180) & (arr[:, :, 1] > 180) & (arr[:, :, 2] > 180)
is_character = is_cyan_blue | is_white_glow

print("Character pixels:", np.sum(is_character))

# Tree is in the hand (lower left of the character body)
is_tree = ((arr[:, :, 1] > arr[:, :, 0] + 15) & (arr[:, :, 1] > arr[:, :, 2] + 10)) | \
          ((arr[:, :, 0] > 50) & (arr[:, :, 0] < 160) & (arr[:, :, 1] > 25) & (arr[:, :, 1] < 120) & (arr[:, :, 2] < 70))

print("Tree pixels:", np.sum(is_tree))

# Build clean transparent image
new_arr = np.zeros_like(arr)

# Any pixel that is character: keep it
# Any pixel that is tree: make it transparent
# Any pixel that is grey/checkerboard background: make it transparent
for y in range(h):
    for x in range(w):
        r, g, b, a = arr[y, x]
        if a == 0:
            continue
        # If it's tree
        if is_tree[y, x]:
            continue
        # If it's grey checkerboard background
        # Check if R, G, B are close to each other and not blue-shifted
        diff_rg = abs(int(r) - int(g))
        diff_gb = abs(int(g) - int(b))
        diff_rb = abs(int(r) - int(b))
        if diff_rg <= 12 and diff_gb <= 12 and diff_rb <= 12 and b < 160:
            # Grey checkerboard background pixel -> transparent
            continue
        # Also check dark borders
        if r < 30 and g < 30 and b < 30 and a < 200:
            continue
        # If blue/cyan or white or character glow
        if b > r + 10 or (r > 160 and g > 160 and b > 160):
            new_arr[y, x] = [r, g, b, a]

# Save cleaned image
out_img = Image.fromarray(new_arr, 'RGBA')
out_img.save('public/images/zerfik_spirit.png')
print("Saved cleaned zerfik_spirit.png successfully!")
