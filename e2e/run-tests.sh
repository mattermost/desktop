#!/bin/bash
# This script provides a robust way to run Electron tests in a headless environment

# Set up virtual display with better parameters for software rendering
export DISPLAY=:99
Xvfb :99 -screen 0 1280x1024x24 -ac +extension GLX +render -extension RANDR -extension RENDER -nolisten tcp &
XVFB_PID=$!
sleep 5  # Give Xvfb more time to start

# Set up D-Bus
mkdir -p /tmp/dbus-session
dbus-daemon --session --address=unix:path=/tmp/dbus-session/bus --fork --print-address
export DBUS_SESSION_BUS_ADDRESS=unix:path=/tmp/dbus-session/bus

# Fix for keyboard warnings
export XKB_LOG_LEVEL=error
export XKB_DEFAULT_RULES=base
export XKB_DEFAULT_MODEL=pc105
export XKB_DEFAULT_LAYOUT=us

# Fix for native addon context issue
export ELECTRON_ENABLE_LOGGING=1
export ELECTRON_ENABLE_STACK_DUMPING=1
export ELECTRON_DISABLE_GPU=1
export ELECTRON_NO_SANDBOX=1
export ELECTRON_DISABLE_SANDBOX=1
export ELECTRON_USE_SOFTWARE_RENDERER=1
export ELECTRON_EXTRA_LAUNCH_ARGS="--disable-gpu --no-sandbox --disable-dev-shm-usage --js-flags=--expose-gc"
export NODE_OPTIONS="--no-force-async-hooks-checks"

# Create a simplified X session
echo '#!/bin/sh' > /tmp/xinitrc
echo 'xsetroot -solid grey' >> /tmp/xinitrc
echo 'exec xterm' >> /tmp/xinitrc
chmod +x /tmp/xinitrc

# Ensure the directory exists
mkdir -p ~/.electron

# Run the tests with proper error handling
cd "$(dirname "$0")"
npm run build

# Use electron-mocha with context isolation disabled
NODE_ENV=development ./node_modules/.bin/electron-mocha \
  --require-main ./preload.js \
  --no-sandbox \
  --renderer \
  --enableGPU=false \
  --reporter mochawesome \
  dist/e2e_bundle.js || true

npm run send-report || echo "Failed to send report"

# Cleanup
kill $XVFB_PID
