#!/usr/bin/env python3
"""
quick_mouse_test.py
Moves the mouse pointer in a small square (20 px per side) using hidg1.
Run with:  sudo python3 quick_mouse_test.py
"""

import os
import sys
import time

MOUSE_DEV = "/dev/hidg1"   # ← 3‑byte mouse interface
STEP      = 20             # pixels per side
DELAY     = 0.05           # seconds between moves

# 3‑byte helper: [buttons, dx, dy] (signed 8‑bit)
def send(dx, dy, buttons=0):
    def to_byte(n):
        return (n + 256) & 0xFF if n < 0 else n & 0xFF
    report = bytes([buttons & 0xFF, to_byte(dx), to_byte(dy)])
    fd.write(report)
    fd.flush()

if not os.path.exists(MOUSE_DEV):
    print(f"Error: {MOUSE_DEV} not found – make sure hidg1 exists.", file=sys.stderr)
    sys.exit(1)

with open(MOUSE_DEV, "wb+") as fd:
    # Square: right, down, left, up
    moves = [
        ( STEP,  0),  # right
        (  0,  STEP), # down
        (-STEP,  0),  # left
        (  0, -STEP)  # up
    ]

    for dx, dy in moves:
        # break larger step into ±4‑pixel chunks so it stays in 8‑bit range
        steps = max(abs(dx), abs(dy)) // 4
        for _ in range(steps):
            send(dx // steps, dy // steps)
            time.sleep(DELAY)

    # stop movement (zero delta)
    send(0, 0)

print("✔ Mouse square complete.")
