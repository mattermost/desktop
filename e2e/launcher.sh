#!/bin/bash
# launcher.sh - Place this in your e2e directory

# Export necessary environment variables
export DISPLAY=:99
export DBUS_SESSION_BUS_ADDRESS=unix:path=/tmp/dbus-session-bus
export ELECTRON_DISABLE_SANDBOX=1
export ELECTRON_ENABLE_LOGGING=1
export ELECTRON_NO_ATTACH_CONSOLE=1
export ELECTRON_FORCE_SW_RENDERING=1
export SWIFTSHADER_DISABLE_PERFETTO=1
export LIBGL_ALWAYS_SOFTWARE=1
export LIBGL_DEBUG=verbose
export XDG_RUNTIME_DIR=/tmp/runtime-runner

# Create required directories
mkdir -p $XDG_RUNTIME_DIR
chmod 700 $XDG_RUNTIME_DIR

# Start D-Bus session daemon
dbus-daemon --session --address=$DBUS_SESSION_BUS_ADDRESS --nofork --nopidfile &
DBUS_PID=$!

# Start X virtual framebuffer
Xvfb $DISPLAY -screen 0 1280x960x24 -ac +extension GLX +render -noreset &
XVFB_PID=$!

# Wait for X server to start
sleep 3

# Run the actual test command with all the GPU disabling flags
cd e2e && node_modules/.bin/playwright test "$@" \
  --disable-gpu \
  --disable-gpu-sandbox \
  --disable-gpu-compositing \
  --disable-software-rasterizer \
  --disable-accelerated-video \
  --disable-accelerated-2d-canvas \
  --disable-accelerated-video-decode \
  --disable-gpu-process-for-dx12-info-collection \
  --disable-accelerated-mjpeg-decode \
  --disable-gpu-vsync \
  --use-gl=swiftshader \
  --in-process-gpu

# Clean up processes
kill $XVFB_PID
kill $DBUS_PID