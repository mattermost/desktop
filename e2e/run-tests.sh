#!/bin/bash
# This script provides a robust way to run Electron tests in a headless environment

# Set up virtual display
export DISPLAY=:99
Xvfb :99 -screen 0 1280x1024x24 -ac +extension GLX +render &
XVFB_PID=$!
sleep 3  # Give Xvfb time to start

# Set up D-Bus
mkdir -p /tmp/dbus-session
dbus-daemon --session --address=unix:path=/tmp/dbus-session/bus --fork --print-address
export DBUS_SESSION_BUS_ADDRESS=unix:path=/tmp/dbus-session/bus

# Set Electron flags to disable GPU and use software rendering
export ELECTRON_DISABLE_GPU=1
export ELECTRON_NO_SANDBOX=1
export ELECTRON_DISABLE_SANDBOX=1
export ELECTRON_USE_SOFTWARE_RENDERER=1
export ELECTRON_ENABLE_LOGGING=1
export ELECTRON_EXTRA_LAUNCH_ARGS="--disable-gpu --no-sandbox"

# Run the tests with proper error handling
cd e2e
npm run build
NODE_ENV=development ./node_modules/.bin/electron-mocha --require-main ./preload.js --no-sandbox --renderer --reporter mochawesome dist/e2e_bundle.js || true

npm run send-report || echo "Failed to send report"

# Cleanup
kill $XVFB_PID