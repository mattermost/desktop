// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {findMainWindow} from './appReadiness';
import {closeDownloadsDropdownIfOpen} from './downloadsDropdown';
import {closeOverlayWindowsIfOpen} from './overlayWindows';
import {activateServerView} from './serverContext';
import type {ServerView} from './serverView';

/** Close desktop overlays that steal focus from server views (dropdowns, modals). */
export async function dismissBlockingOverlays(win: ServerView): Promise<void> {
    await closeDownloadsDropdownIfOpen(win.app);
    await closeOverlayWindowsIfOpen(win.app);
    await activateServerView(win.app, win.webContentsId);
    const mainWindow = findMainWindow(win.app);
    await mainWindow?.keyboard.press('Escape').catch(() => undefined);
    await win.keyboard.press('Escape').catch(() => undefined);
}
