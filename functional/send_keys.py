#!/usr/bin/env python3
import time
time.sleep(5)
hid_device = "/dev/hidg0"

# HID keycode map example (letter 'a')
NULL_CHAR = chr(0)
KEY_A = chr(4)  # HID keycode for 'a'

def send_key(key):
    with open(hid_device, 'rb+') as fd:
        # Press key
        fd.write((NULL_CHAR*2 + key + NULL_CHAR*5).encode())
        fd.flush()
        time.sleep(0.05)
        # Release key
        fd.write((NULL_CHAR*8).encode())
        fd.flush()

# Type 'hello'
keycodes = [11,8,15,15,18]  # HID codes for h,e,l,l,o
for k in keycodes:
    send_key(chr(k))
    time.sleep(0.1)
