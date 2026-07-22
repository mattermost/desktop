// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as fs from 'fs';

import {expect} from '@playwright/test';
import type {Page} from 'playwright';

export function readConfigValue<T>(configFilePath: string, key: string): T {
    return JSON.parse(fs.readFileSync(configFilePath, 'utf-8'))[key];
}

export async function waitForConfigValue<T>(
    configFilePath: string,
    key: string,
    expected: T,
    timeout = 15_000,
): Promise<void> {
    await expect.poll(
        () => readConfigValue<T>(configFilePath, key),
        {timeout, message: `config.json ${key} must become ${String(expected)}`},
    ).toBe(expected);
}

export async function toggleAutostartSetting(
    settingsWindow: Page,
    configFilePath: string,
): Promise<{before: boolean; after: boolean}> {
    const autostartToggle = settingsWindow.locator('#CheckSetting_autostart button');
    await autostartToggle.waitFor({state: 'visible', timeout: 10_000});
    const before = readConfigValue<boolean>(configFilePath, 'autostart');
    await autostartToggle.click();
    await waitForConfigValue(configFilePath, 'autostart', !before);
    return {before, after: !before};
}

export async function ensureAutostartEnabled(
    settingsWindow: Page,
    configFilePath: string,
): Promise<void> {
    if (readConfigValue<boolean>(configFilePath, 'autostart')) {
        return;
    }
    await toggleAutostartSetting(settingsWindow, configFilePath);
}
