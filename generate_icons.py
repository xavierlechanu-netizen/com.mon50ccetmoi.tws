#!/usr/bin/env python3
"""Generate app icons for Mon 50cc et moi"""
from PIL import Image, ImageDraw, ImageFont
import math
import os

def create_icon(size, output_path, is_adaptive=False):
    """Create the app icon with map + scooter 50cc theme"""
    
    # Colors
    bg_dark = (26, 26, 46)        # #1a1a2e
    primary = (233, 69, 96)        # #e94560
    primary_light = (233, 69, 96, 60)
    white = (255, 255, 255)
    road_color = (60, 60, 90)
    road_light = (80, 80, 120)
    green_area = (40, 60, 50)
    green_light = (50, 80, 65)
    pin_blue = (59, 130, 246)      # #3b82f6
    pin_green = (16, 185, 129)     # #10b981
    pin_orange = (249, 115, 22)    # #f97316
    
    img = Image.new('RGBA', (size, size), bg_dark + (255,))
    draw = ImageDraw.Draw(img)
    
    s = size / 1024  # Scale factor
    
    # --- Background: Map-like pattern ---
    
    # Subtle grid lines (map feel)
    grid_color = (35, 35, 60, 80)
    for i in range(0, size, int(60 * s)):
        draw.line([(i, 0), (i, size)], fill=(35, 35, 60), width=max(1, int(1 * s)))
    for i in range(0, size, int(60 * s)):
        draw.line([(0, i), (size, i)], fill=(35, 35, 60), width=max(1, int(1 * s)))
    
    # Green areas (parks on map)
    park_positions = [
        (int(100 * s), int(100 * s), int(250 * s), int(200 * s)),
        (int(700 * s), int(650 * s), int(900 * s), int(800 * s)),
        (int(50 * s), int(600 * s), int(180 * s), int(720 * s)),
        (int(780 * s), int(120 * s), int(950 * s), int(250 * s)),
    ]
    for park in park_positions:
        draw.rounded_rectangle(park, radius=int(20 * s), fill=green_area)
    
    # Roads - main horizontal
    road_w = int(28 * s)
    # Main horizontal road
    draw.rectangle([(0, int(380 * s) - road_w//2), (size, int(380 * s) + road_w//2)], fill=road_color)
    # Dashed center line
    for x in range(0, size, int(40 * s)):
        draw.rectangle([(x, int(380 * s) - 1), (x + int(20 * s), int(380 * s) + 1)], fill=(100, 100, 140))
    
    # Main vertical road  
    draw.rectangle([(int(500 * s) - road_w//2, 0), (int(500 * s) + road_w//2, size)], fill=road_color)
    for y in range(0, size, int(40 * s)):
        draw.rectangle([(int(500 * s) - 1, y), (int(500 * s) + 1, y + int(20 * s))], fill=(100, 100, 140))
    
    # Diagonal road
    for i in range(int(-200 * s), size + int(200 * s), 1):
        x1 = i
        y1 = int(i * 0.7 + 200 * s)
        if 0 <= x1 < size and 0 <= y1 < size:
            for w in range(-int(14 * s), int(14 * s)):
                px = min(max(x1, 0), size - 1)
                py = min(max(y1 + w, 0), size - 1)
                if 0 <= px < size and 0 <= py < size:
                    img.putpixel((px, py), road_color + (255,))

    # Secondary road
    draw.rectangle([(int(300 * s) - int(12 * s), int(200 * s)), (int(300 * s) + int(12 * s), int(650 * s))], fill=road_light)
    
    # Another road
    draw.rectangle([(int(150 * s), int(550 * s) - int(12 * s)), (int(750 * s), int(550 * s) + int(12 * s))], fill=road_light)
    
    # --- GPS Pin markers on map ---
    def draw_pin(cx, cy, color, pin_size=1.0):
        ps = int(22 * s * pin_size)
        # Pin body (circle)
        draw.ellipse([
            (cx - ps, cy - ps),
            (cx + ps, cy + ps)
        ], fill=color)
        # Pin point
        points = [
            (cx - int(ps * 0.6), cy + int(ps * 0.4)),
            (cx + int(ps * 0.6), cy + int(ps * 0.4)),
            (cx, cy + int(ps * 1.8))
        ]
        draw.polygon(points, fill=color)
        # White inner circle
        inner = int(ps * 0.5)
        draw.ellipse([
            (cx - inner, cy - inner),
            (cx + inner, cy + inner)
        ], fill=white)
    
    # Place pins on map
    draw_pin(int(200 * s), int(300 * s), pin_blue, 0.8)
    draw_pin(int(700 * s), int(250 * s), pin_orange, 0.7)
    draw_pin(int(600 * s), int(700 * s), pin_green, 0.75)
    draw_pin(int(150 * s), int(500 * s), primary, 0.65)
    
    # --- Central circle with scooter icon ---
    center_x = int(512 * s)
    center_y = int(480 * s)
    circle_r = int(200 * s)
    
    # Outer glow
    for r in range(circle_r + int(30 * s), circle_r, -1):
        alpha = int(30 * (1 - (r - circle_r) / (30 * s)))
        glow_color = primary[:3] + (alpha,)
        draw.ellipse([
            (center_x - r, center_y - r),
            (center_x + r, center_y + r)
        ], fill=glow_color)
    
    # White circle background
    draw.ellipse([
        (center_x - circle_r, center_y - circle_r),
        (center_x + circle_r, center_y + circle_r)
    ], fill=white)
    
    # Primary border
    border_w = int(8 * s)
    draw.ellipse([
        (center_x - circle_r, center_y - circle_r),
        (center_x + circle_r, center_y + circle_r)
    ], outline=primary, width=border_w)
    
    # --- Draw scooter inside circle ---
    sc = circle_r / 200  # scooter scale
    sx = center_x  # scooter center x
    sy = center_y + int(20 * sc)  # scooter center y, slightly below center
    
    # Wheels
    wheel_r = int(35 * sc)
    wheel_y = sy + int(50 * sc)
    left_wheel_x = sx - int(70 * sc)
    right_wheel_x = sx + int(65 * sc)
    
    # Left wheel (back)
    draw.ellipse([
        (left_wheel_x - wheel_r, wheel_y - wheel_r),
        (left_wheel_x + wheel_r, wheel_y + wheel_r)
    ], fill=bg_dark)
    draw.ellipse([
        (left_wheel_x - int(wheel_r * 0.55), wheel_y - int(wheel_r * 0.55)),
        (left_wheel_x + int(wheel_r * 0.55), wheel_y + int(wheel_r * 0.55))
    ], fill=(80, 80, 100))
    draw.ellipse([
        (left_wheel_x - int(wheel_r * 0.25), wheel_y - int(wheel_r * 0.25)),
        (left_wheel_x + int(wheel_r * 0.25), wheel_y + int(wheel_r * 0.25))
    ], fill=bg_dark)
    
    # Right wheel (front)
    draw.ellipse([
        (right_wheel_x - wheel_r, wheel_y - wheel_r),
        (right_wheel_x + wheel_r, wheel_y + wheel_r)
    ], fill=bg_dark)
    draw.ellipse([
        (right_wheel_x - int(wheel_r * 0.55), wheel_y - int(wheel_r * 0.55)),
        (right_wheel_x + int(wheel_r * 0.55), wheel_y + int(wheel_r * 0.55))
    ], fill=(80, 80, 100))
    draw.ellipse([
        (right_wheel_x - int(wheel_r * 0.25), wheel_y - int(wheel_r * 0.25)),
        (right_wheel_x + int(wheel_r * 0.25), wheel_y + int(wheel_r * 0.25))
    ], fill=bg_dark)
    
    # Body / frame - main body connecting wheels
    body_points = [
        (left_wheel_x + int(15 * sc), wheel_y - int(15 * sc)),  
        (left_wheel_x + int(20 * sc), sy - int(40 * sc)),       # Up to seat area
        (sx - int(10 * sc), sy - int(55 * sc)),                 # Seat back
        (sx + int(30 * sc), sy - int(50 * sc)),                 # Seat front
        (right_wheel_x - int(10 * sc), sy - int(20 * sc)),     # Down toward front
        (right_wheel_x, wheel_y - int(20 * sc)),                # Front wheel connection
    ]
    draw.polygon(body_points, fill=primary)
    
    # Seat
    seat_points = [
        (sx - int(40 * sc), sy - int(55 * sc)),
        (sx + int(25 * sc), sy - int(52 * sc)),
        (sx + int(20 * sc), sy - int(62 * sc)),
        (sx - int(35 * sc), sy - int(65 * sc)),
    ]
    draw.polygon(seat_points, fill=bg_dark)
    
    # Front fork (handlebar to front wheel)
    fork_points = [
        (right_wheel_x - int(5 * sc), wheel_y - int(20 * sc)),
        (sx + int(45 * sc), sy - int(70 * sc)),
        (sx + int(55 * sc), sy - int(70 * sc)),
        (right_wheel_x + int(5 * sc), wheel_y - int(15 * sc)),
    ]
    draw.polygon(fork_points, fill=(60, 60, 90))
    
    # Handlebar
    handlebar_y = sy - int(75 * sc)
    handlebar_x = sx + int(50 * sc)
    draw.rounded_rectangle([
        (handlebar_x - int(25 * sc), handlebar_y - int(5 * sc)),
        (handlebar_x + int(25 * sc), handlebar_y + int(5 * sc))
    ], radius=int(5 * sc), fill=bg_dark)
    
    # Headlight
    draw.ellipse([
        (handlebar_x + int(5 * sc), handlebar_y + int(5 * sc)),
        (handlebar_x + int(20 * sc), handlebar_y + int(18 * sc))
    ], fill=(255, 230, 100))
    
    # Exhaust pipe
    exhaust_points = [
        (left_wheel_x - int(10 * sc), wheel_y - int(5 * sc)),
        (left_wheel_x - int(30 * sc), wheel_y + int(5 * sc)),
        (left_wheel_x - int(30 * sc), wheel_y + int(12 * sc)),
        (left_wheel_x - int(5 * sc), wheel_y + int(5 * sc)),
    ]
    draw.polygon(exhaust_points, fill=(120, 120, 140))
    
    # Rear fender
    draw.arc([
        (left_wheel_x - wheel_r - int(5 * sc), wheel_y - wheel_r - int(5 * sc)),
        (left_wheel_x + wheel_r + int(5 * sc), wheel_y + wheel_r + int(5 * sc))
    ], start=180, end=280, fill=primary, width=int(6 * sc))
    
    # --- "50cc" text at top ---
    # Try to use a font, fall back to default
    try:
        font_large = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", int(90 * s))
        font_small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", int(50 * s))
    except:
        try:
            font_large = ImageFont.truetype("/app/frontend/assets/fonts/SpaceMono-Regular.ttf", int(90 * s))
            font_small = ImageFont.truetype("/app/frontend/assets/fonts/SpaceMono-Regular.ttf", int(50 * s))
        except:
            font_large = ImageFont.load_default()
            font_small = ImageFont.load_default()
    
    # Top banner "50cc"
    banner_y = int(80 * s)
    
    # Draw text with shadow
    text = "50cc"
    bbox = draw.textbbox((0, 0), text, font=font_large)
    text_w = bbox[2] - bbox[0]
    text_x = (size - text_w) // 2
    
    # Shadow
    draw.text((text_x + int(3 * s), banner_y + int(3 * s)), text, fill=(0, 0, 0, 100), font=font_large)
    # Main text
    draw.text((text_x, banner_y), text, fill=white, font=font_large)
    
    # Bottom text "GPS"  
    bottom_text = "GPS"
    bbox2 = draw.textbbox((0, 0), bottom_text, font=font_small)
    bt_w = bbox2[2] - bbox2[0]
    bt_x = (size - bt_w) // 2
    bt_y = int(850 * s)
    
    # Background pill for GPS
    pill_padding = int(20 * s)
    pill_rect = [
        bt_x - pill_padding,
        bt_y - int(5 * s),
        bt_x + bt_w + pill_padding,
        bt_y + (bbox2[3] - bbox2[1]) + int(10 * s)
    ]
    draw.rounded_rectangle(pill_rect, radius=int(20 * s), fill=primary)
    draw.text((bt_x, bt_y), bottom_text, fill=white, font=font_small)
    
    # Convert to RGB for PNG saving (no alpha for icon)
    if not is_adaptive:
        final = Image.new('RGB', (size, size), bg_dark)
        final.paste(img, mask=img.split()[3])
        final.save(output_path, 'PNG', quality=95)
    else:
        final = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        final.paste(img, mask=img.split()[3])
        final.save(output_path, 'PNG', quality=95)
    
    print(f"Created: {output_path} ({size}x{size})")

def create_favicon(size, output_path):
    """Create a simple favicon"""
    img = Image.new('RGBA', (size, size), (26, 26, 46, 255))
    draw = ImageDraw.Draw(img)
    s = size / 64
    
    # Simple circle with "50"
    primary = (233, 69, 96)
    white = (255, 255, 255)
    
    # Circle
    margin = int(4 * s)
    draw.ellipse([(margin, margin), (size - margin, size - margin)], fill=primary)
    
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", int(24 * s))
    except:
        font = ImageFont.load_default()
    
    text = "50"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    draw.text(((size - tw) // 2, (size - th) // 2 - int(2 * s)), text, fill=white, font=font)
    
    final = Image.new('RGB', (size, size), (26, 26, 46))
    final.paste(img, mask=img.split()[3])
    final.save(output_path, 'PNG')
    print(f"Created: {output_path} ({size}x{size})")

def create_splash_icon(size, output_path):
    """Create splash screen icon"""
    # Transparent background for splash
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    primary = (233, 69, 96)
    white = (255, 255, 255)
    bg_dark = (26, 26, 46)
    s = size / 200
    
    # Central scooter circle
    center = size // 2
    radius = int(80 * s)
    
    # White circle
    draw.ellipse([
        (center - radius, center - radius),
        (center + radius, center + radius)
    ], fill=white)
    
    # Primary border
    draw.ellipse([
        (center - radius, center - radius),
        (center + radius, center + radius)
    ], outline=primary, width=int(5 * s))
    
    # "50cc" text inside
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", int(35 * s))
        font_small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", int(18 * s))
    except:
        font = ImageFont.load_default()
        font_small = ImageFont.load_default()
    
    text = "50cc"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    draw.text(((size - tw) // 2, center - int(20 * s)), text, fill=primary, font=font)
    
    gps_text = "GPS"
    bbox2 = draw.textbbox((0, 0), gps_text, font=font_small)
    gw = bbox2[2] - bbox2[0]
    draw.text(((size - gw) // 2, center + int(20 * s)), gps_text, fill=bg_dark, font=font_small)
    
    img.save(output_path, 'PNG')
    print(f"Created: {output_path} ({size}x{size})")

# Generate all icons
output_dir = "/app/frontend/assets/images"

# Main icon (1024x1024)
create_icon(1024, os.path.join(output_dir, "icon.png"))

# Adaptive icon for Android (1024x1024)
create_icon(1024, os.path.join(output_dir, "adaptive-icon.png"), is_adaptive=True)

# Favicon (48x48)
create_favicon(48, os.path.join(output_dir, "favicon.png"))

# Splash icon
create_splash_icon(200, os.path.join(output_dir, "splash-icon.png"))

print("\nAll icons generated successfully!")
