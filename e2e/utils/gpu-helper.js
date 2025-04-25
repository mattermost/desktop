// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Helper functions to handle GPU-related issues in E2E tests
 */

/**
 * Disables GPU features in Electron to prevent crashes during tests
 * @param {Object} app - The Electron app instance
 */
async function disableGPUFeatures(app) {
    if (!app || !app.evaluate) {
        return;
    }

    await app.evaluate(async () => {
        // Disable GPU features that might cause crashes
        if (process && process.electronBinding) {
            try {
                // Disable hardware acceleration
                const gpuInfo = process.electronBinding('gpu_info');
                if (gpuInfo && gpuInfo.disableHardwareAcceleration) {
                    gpuInfo.disableHardwareAcceleration();
                }
                
                // Force software rendering
                if (process.electronBinding('features')) {
                    process.electronBinding('features').setEnabled('disable-accelerated-2d-canvas', true);
                    process.electronBinding('features').setEnabled('disable-gpu-compositing', true);
                }
                
                // Disable viz process if available
                if (process.electronBinding('viz_process_transport')) {
                    process.electronBinding('viz_process_transport').shutdown();
                }
            } catch (e) {
                console.error('Failed to disable hardware acceleration:', e);
            }
        }
    });
}

/**
 * Sets environment variables to disable GPU usage
 */
function setGPUEnvironmentVariables() {
    process.env.ELECTRON_DISABLE_GPU = '1';
    process.env.ELECTRON_NO_ATTACH_CONSOLE = '1';
    process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = '1';
    process.env.ELECTRON_DISABLE_HARDWARE_ACCELERATION = '1';
    process.env.ELECTRON_ENABLE_LOGGING = '1';
    
    // Disable sandbox for Linux
    if (process.platform === 'linux') {
        process.env.ELECTRON_NO_SANDBOX = '1';
    }
}

module.exports = {
    disableGPUFeatures,
    setGPUEnvironmentVariables,
};
