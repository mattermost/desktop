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
                    process.electronBinding('features').setEnabled('disable-gpu-rasterization', true);
                    process.electronBinding('features').setEnabled('disable-gpu-memory-buffer-video-frames', true);
                    process.electronBinding('features').setEnabled('disable-software-rasterizer', true);
                }

                // Disable viz process if available
                if (process.electronBinding('viz_process_transport')) {
                    process.electronBinding('viz_process_transport').shutdown();
                }

                // Additional v8 settings to disable GPU
                const v8Util = process.electronBinding('v8_util');
                if (v8Util && v8Util.setHiddenValue) {
                    v8Util.setHiddenValue(global, 'forceDisableHardwareAcceleration', true);
                }
            } catch (e) {
                // eslint-disable-next-line no-console
                console.error('Failed to disable hardware acceleration:', e);
            }
        }
    });
}

/**
 * Sets environment variables to disable GPU usage
 */
function setGPUEnvironmentVariables() {
    // Basic GPU disabling
    process.env.ELECTRON_DISABLE_GPU = '1';
    process.env.ELECTRON_NO_ATTACH_CONSOLE = '1';
    process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = '1';
    process.env.ELECTRON_DISABLE_HARDWARE_ACCELERATION = '1';
    process.env.ELECTRON_ENABLE_LOGGING = '1';
    
    // Additional variables to prevent GPU crashes
    process.env.ELECTRON_DISABLE_GPU_COMPOSITING = '1';
    process.env.ELECTRON_DISABLE_D3D11 = '1';
    process.env.ELECTRON_DISABLE_RENDERER_BACKGROUNDING = '1';
    process.env.DISABLE_GPU_PROCESS_CRASH_LIMIT = '1';
    
    // Force software rendering
    process.env.LIBGL_ALWAYS_SOFTWARE = '1';
    process.env.GALLIUM_DRIVER = 'llvmpipe';
    process.env.MESA_LOADER_DRIVER_OVERRIDE = 'swrast';

    // Platform-specific settings
    if (process.platform === 'linux') {
        process.env.ELECTRON_NO_SANDBOX = '1';
        process.env.ELECTRON_DISABLE_SANDBOX = '1';
    }
}

module.exports = {
    disableGPUFeatures,
    setGPUEnvironmentVariables,
};
