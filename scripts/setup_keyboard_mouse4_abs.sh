#!/bin/bash
set -e

G=/sys/kernel/config/usb_gadget/kvm

########################################
# 0. Load composite framework & clean up
########################################
sudo modprobe libcomposite

if [ -d "$G" ]; then
  echo "" | sudo tee "$G/UDC"      # un-bind
  sudo find "$G/configs" -type l -exec rm -f {} \;
  sudo rm -rf "$G/functions"/*
  sudo rmdir "$G" || true
fi

########################################
# 1. Basic gadget descriptors
########################################
sudo mkdir -p "$G"
echo 0x1d6b | sudo tee    "$G/idVendor"      > /dev/null   # Linux Foundation
echo 0x0104 | sudo tee    "$G/idProduct"     > /dev/null   # Multifunction
sudo mkdir -p "$G/strings/0x409"
echo 0001     | sudo tee "$G/strings/0x409/serialnumber"
echo "Pi-KVM" | sudo tee "$G/strings/0x409/manufacturer"
echo "Pi-KVM KM" | sudo tee "$G/strings/0x409/product"

sudo mkdir -p "$G/configs/c.1"

########################################
# 2. Keyboard  (hid.usb0, 8-byte report)
########################################
sudo mkdir -p "$G/functions/hid.usb0"
echo 1 | sudo tee "$G/functions/hid.usb0/protocol"    # keyboard
echo 1 | sudo tee "$G/functions/hid.usb0/subclass"
echo 8 | sudo tee "$G/functions/hid.usb0/report_length"
# 8-byte boot-keyboard descriptor
echo -ne '\x05\x01\x09\x06\xa1\x01\x05\x07\x19\xe0\x29\xe7\x15\x00\x25\x01\x75\x01\x95\x08\x81\x02\x95\x01\x75\x08\x81\x01\x95\x05\x75\x01\x05\x08\x19\x01\x29\x05\x91\x02\x95\x01\x75\x03\x91\x01\x95\x06\x75\x08\x15\x00\x25\x65\x05\x07\x19\x00\x29\x65\x81\x00\xc0' \
  | sudo tee "$G/functions/hid.usb0/report_desc" > /dev/null

########################################
# 3. Mouse  (hid.usb1, 6-byte absolute + wheel)
########################################
sudo mkdir -p "$G/functions/hid.usb1"
echo 2 | sudo tee "$G/functions/hid.usb1/protocol"    # mouse
echo 1 | sudo tee "$G/functions/hid.usb1/subclass"
echo 6 | sudo tee "$G/functions/hid.usb1/report_length"  # buttons + X(2) + Y(2) + wheel

# 6-byte absolute X/Y + relative wheel descriptor
echo -ne '\
\x05\x01\x09\x02\xa1\x01\x09\x01\xa1\x00\
  \x05\x09\x19\x01\x29\x03\x15\x00\x25\x01\x95\x03\x75\x01\x81\x02\  # 3 buttons
  \x95\x01\x75\x05\x81\x01\                                        # padding
  \x05\x01\x16\x00\x00\x26\xff\x7f\x36\x00\x00\x46\xff\x7f\x75\x10\x95\x02\x09\x30\x09\x31\x81\x02\  # absolute X,Y
  \x05\x01\x09\x38\x15\x81\x25\x7f\x75\x08\x95\x01\x81\x06\
\xc0\xc0' \
  | sudo tee "$G/functions/hid.usb1/report_desc" > /dev/null

########################################
# 4. Link functions into config
########################################
sudo ln -s "$G/functions/hid.usb0" "$G/configs/c.1/"
sudo ln -s "$G/functions/hid.usb1" "$G/configs/c.1/"

########################################
# 5. Bind to first available UDC
########################################
UDC=$(ls /sys/class/udc | head -n1)
echo "$UDC" | sudo tee "$G/UDC"

echo "✅ Composite keyboard + absolute-mouse(+wheel) gadget bound on $UDC"
