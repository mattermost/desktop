// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {EventEmitter} from 'events';

import type {WebContents, WebFrameMain} from 'electron';
import {ipcMain, nativeTheme, powerMonitor} from 'electron';

import type {DesktopShellTheme} from '@mattermost/desktop-api';

import {
    DESKTOP_THEME_SURFACE_STATE_CHANGED,
    RESET_THEME,
    UPDATE_THEME,
} from 'common/communication';
import Config from 'common/config';
import ServerManager from 'common/servers/serverManager';
import {ViewType} from 'common/views/MattermostView';
import ViewManager from 'common/views/viewManager';
import SystemAppearanceMonitor from 'main/systemAppearanceMonitor';
import {ThemeManager, type DesktopThemeDocument} from 'main/themeManager';
import {isLightColor} from 'main/utils';

jest.mock('electron', () => {
    const MockEventEmitter = jest.requireActual('events').EventEmitter;
    const mockIpcMain = new MockEventEmitter();
    Object.assign(mockIpcMain, {handle: jest.fn((event, handler) => mockIpcMain.on(event, handler))});
    return {
        ipcMain: mockIpcMain,
        nativeTheme: {themeSource: 'system'},
        powerMonitor: {on: jest.fn()},
    };
});

jest.mock('common/config', () => ({themeSyncing: true}));
jest.mock('common/servers/serverManager', () => {
    const MockEventEmitter = jest.requireActual('events').EventEmitter;
    const manager = new MockEventEmitter();
    return Object.assign(manager, {
        getCurrentServerId: jest.fn(),
        getServer: jest.fn(() => ({id: 'server-id'})),
        getAllServers: jest.fn(() => []),
    });
});
jest.mock('common/views/viewManager', () => ({
    getView: jest.fn(),
    getViewsByServerId: jest.fn(() => []),
}));
jest.mock('main/systemAppearanceMonitor', () => ({
    invalidate: jest.fn(),
}));
jest.mock('main/utils', () => ({
    isLightColor: jest.fn(),
}));

const shellTheme: DesktopShellTheme = {
    sidebarBg: '#111111',
    sidebarText: '#111111',
    sidebarUnreadText: '#111111',
    sidebarTextHoverBg: '#111111',
    sidebarTextActiveBorder: '#111111',
    sidebarTextActiveColor: '#111111',
    sidebarHeaderBg: '#111111',
    sidebarTeamBarBg: '#111111',
    sidebarHeaderTextColor: '#111111',
    onlineIndicator: '#111111',
    awayIndicator: '#111111',
    dndIndicator: '#111111',
    mentionBg: '#111111',
    mentionColor: '#111111',
    centerChannelBg: '#111111',
    centerChannelColor: '#111111',
    newMessageSeparator: '#111111',
    linkColor: '#111111',
    buttonBg: '#111111',
    buttonColor: '#111111',
    errorTextColor: '#111111',
    mentionHighlightBg: '#111111',
    mentionHighlightLink: '#111111',
    codeTheme: 'github',
};

function createDocument(viewId: string, scope: DesktopThemeDocument['scope'] = 'main-tab') {
    const frame = {
        detached: false,
        isDestroyed: jest.fn(() => false),
        send: jest.fn(),
    } as unknown as WebFrameMain;
    const webContents = Object.assign(new EventEmitter(), {
        id: Math.floor(Math.random() * 10000),
        isDestroyed: jest.fn(() => false),
        mainFrame: frame,
        send: jest.fn(),
    }) as unknown as WebContents;
    return {viewId, scope, frame, webContents};
}

function latestSurfaceState(document: DesktopThemeDocument, surfaceId: string) {
    const calls = jest.mocked(document.frame.send).mock.calls.filter(([channel, event]) =>
        channel === DESKTOP_THEME_SURFACE_STATE_CHANGED && event.surfaceId === surfaceId);
    return calls.at(-1)?.[1].state;
}

describe('Desktop theme broker', () => {
    let manager: ThemeManager;
    let owner: DesktopThemeDocument;
    let sequence: number;

    beforeEach(() => {
        sequence = 0;
        manager = new ThemeManager(() => `id-${++sequence}`);
        owner = createDocument('owner-view');
        jest.mocked(ViewManager.getView).mockImplementation((viewId) => ({
            id: viewId,
            serverId: 'server-id',
            type: 'tab',
        }) as never);
        jest.mocked(ServerManager.getServer).mockReturnValue({id: 'server-id'} as never);
        jest.mocked(isLightColor).mockReturnValue(true);
        (Config as {themeSyncing: boolean}).themeSyncing = true;
        nativeTheme.themeSource = 'system';
        manager.setCommittedMainViewResolver(() => ({viewId: owner.viewId, webContents: owner.webContents}));
    });

    afterEach(() => {
        ipcMain.removeAllListeners();
        jest.clearAllMocks();
    });

    it('grants only the exact committed main document', async () => {
        const background = createDocument('background-view');
        const ownerRegistration = await manager.registerDesktopThemeSurface(owner);
        const backgroundRegistration = await manager.registerDesktopThemeSurface(background);

        expect(ownerRegistration.state).toMatchObject({scope: 'main-tab', status: 'granted'});
        expect(backgroundRegistration.state).toMatchObject({scope: 'main-tab', status: 'standby', reason: 'not-current'});
    });

    it('marks popouts ineligible without disturbing the current lease', async () => {
        const ownerRegistration = await manager.registerDesktopThemeSurface(owner);
        const popoutRegistration = await manager.registerDesktopThemeSurface(createDocument('popout-view', 'popout'));

        expect(ownerRegistration.state).toMatchObject({status: 'granted'});
        expect(popoutRegistration.state).toMatchObject({scope: 'popout', status: 'ineligible', reason: 'not-main-tab'});
    });

    it('preserves a surface while its view moves between the main window and a popout', async () => {
        let viewType = ViewType.TAB;
        jest.mocked(ViewManager.getView).mockImplementation((viewId) => ({
            id: viewId,
            serverId: 'server-id',
            type: viewType,
        }) as never);
        const registration = await manager.registerDesktopThemeSurface(owner);
        const firstLeaseId = registration.state.status === 'granted' ? registration.state.leaseId : '';

        viewType = ViewType.WINDOW;
        manager.handleDesktopThemeViewTypeChanged(owner.viewId, viewType);
        await (manager as unknown as {brokerTransition: Promise<void>}).brokerTransition;
        expect(latestSurfaceState(owner, registration.surfaceId)).toMatchObject({scope: 'popout', status: 'ineligible', reason: 'not-main-tab'});
        await expect(manager.applyDesktopTheme(owner, {
            surfaceId: registration.surfaceId,
            leaseId: firstLeaseId,
            sequence: 1,
            directive: {mode: 'fixed', shellTheme},
        })).resolves.toMatchObject({status: 'rejected', reason: 'not-owner'});

        viewType = ViewType.TAB;
        manager.handleDesktopThemeViewTypeChanged(owner.viewId, viewType);
        await (manager as unknown as {brokerTransition: Promise<void>}).brokerTransition;
        const restoredState = latestSurfaceState(owner, registration.surfaceId);
        expect(restoredState).toMatchObject({scope: 'main-tab', status: 'granted'});
        expect(restoredState.leaseId).not.toBe(firstLeaseId);

        await expect(manager.applyDesktopTheme(owner, {
            surfaceId: registration.surfaceId,
            leaseId: restoredState.leaseId,
            sequence: 1,
            directive: {mode: 'fixed', shellTheme},
        })).resolves.toMatchObject({status: 'applied'});
    });

    it('applies a directive once and rejects duplicate sequence numbers', async () => {
        const shell = createDocument('internal-shell');
        manager.registerMainWindowView(shell.webContents);
        const registration = await manager.registerDesktopThemeSurface(owner);
        const leaseId = registration.state.status === 'granted' ? registration.state.leaseId : '';
        const request = {
            surfaceId: registration.surfaceId,
            leaseId,
            sequence: 1,
            directive: {mode: 'fixed' as const, shellTheme},
        };

        await expect(manager.applyDesktopTheme(owner, request)).resolves.toMatchObject({status: 'applied'});
        expect(shell.webContents.send).toHaveBeenLastCalledWith(UPDATE_THEME, {...shellTheme, isUsingSystemTheme: false});
        await expect(manager.applyDesktopTheme(owner, request)).resolves.toMatchObject({status: 'rejected', reason: 'stale-sequence'});
        await expect(manager.applyDesktopTheme(owner, {...request, sequence: 0})).resolves.toMatchObject({status: 'rejected', reason: 'stale-sequence'});
    });

    it('revokes and resets before granting a replacement owner', async () => {
        const replacement = createDocument('replacement-view');
        const ownerRegistration = await manager.registerDesktopThemeSurface(owner);
        const replacementRegistration = await manager.registerDesktopThemeSurface(replacement);

        manager.setCommittedMainViewResolver(() => undefined);
        await (manager as unknown as {brokerTransition: Promise<void>}).brokerTransition;
        expect(latestSurfaceState(owner, ownerRegistration.surfaceId)).toMatchObject({status: 'standby', reason: 'not-current'});
        expect(nativeTheme.themeSource).toBe('system');

        manager.setCommittedMainViewResolver(() => ({viewId: replacement.viewId, webContents: replacement.webContents}));
        await (manager as unknown as {brokerTransition: Promise<void>}).brokerTransition;
        expect(latestSurfaceState(replacement, replacementRegistration.surfaceId)).toMatchObject({status: 'granted'});
    });

    it('rolls back and revokes when shell publication fails', async () => {
        const shell = createDocument('internal-shell');
        manager.registerMainWindowView(shell.webContents);
        const registration = await manager.registerDesktopThemeSurface(owner);
        const leaseId = registration.state.status === 'granted' ? registration.state.leaseId : '';
        jest.mocked(shell.webContents.send).mockImplementation((channel) => {
            if (channel === UPDATE_THEME) {
                throw new Error('send failed');
            }
        });

        await expect(manager.applyDesktopTheme(owner, {
            surfaceId: registration.surfaceId,
            leaseId,
            sequence: 1,
            directive: {mode: 'fixed', shellTheme},
        })).resolves.toMatchObject({status: 'failed', reason: 'desktop-shell-update'});
        expect(nativeTheme.themeSource).toBe('system');
        expect(latestSurfaceState(owner, registration.surfaceId)).toMatchObject({status: 'standby', reason: 'apply-failed'});

        jest.mocked(shell.webContents.send).mockImplementation(() => undefined);
        manager.handleCommittedMainViewChanged();
        await (manager as unknown as {brokerTransition: Promise<void>}).brokerTransition;
        expect(latestSurfaceState(owner, registration.surfaceId)).toMatchObject({status: 'standby', reason: 'apply-failed'});
    });

    it('releases a registration without restoring legacy authority in that frame', async () => {
        const registration = await manager.registerDesktopThemeSurface(owner);
        await expect(manager.releaseDesktopThemeSurface(owner, registration.surfaceId)).resolves.toEqual({status: 'released'});

        jest.mocked(ServerManager.getCurrentServerId).mockReturnValue('server-id');
        jest.mocked(ServerManager.getServer).mockReturnValue({id: 'server-id', theme: {...shellTheme, isUsingSystemTheme: false}} as never);
        manager.handleCommittedMainViewChanged();
        await (manager as unknown as {brokerTransition: Promise<void>}).brokerTransition;
        expect(nativeTheme.themeSource).toBe('system');
    });

    it('keeps the cached legacy path until the current document registers', async () => {
        const shell = createDocument('internal-shell');
        manager.registerMainWindowView(shell.webContents);
        jest.mocked(ServerManager.getCurrentServerId).mockReturnValue('server-id');
        jest.mocked(ServerManager.getServer).mockReturnValue({id: 'server-id', theme: {...shellTheme, isUsingSystemTheme: false}} as never);

        manager.handleCommittedMainViewChanged();
        expect(shell.webContents.send).toHaveBeenLastCalledWith(UPDATE_THEME, {...shellTheme, isUsingSystemTheme: false});
        expect(nativeTheme.themeSource).toBe('light');

        jest.mocked(shell.webContents.send).mockClear();
        const registration = await manager.registerDesktopThemeSurface(owner);
        expect(registration.state).toMatchObject({status: 'granted'});
        expect(shell.webContents.send).not.toHaveBeenCalled();
        expect(nativeTheme.themeSource).toBe('light');
    });

    it('requires a fresh registration after a release failure', async () => {
        const shell = createDocument('internal-shell');
        manager.registerMainWindowView(shell.webContents);
        const registration = await manager.registerDesktopThemeSurface(owner);
        const firstLease = registration.state.status === 'granted' ? registration.state.leaseId : '';
        jest.mocked(shell.webContents.send).mockImplementation((channel) => {
            if (channel === RESET_THEME) {
                throw new Error('send failed');
            }
        });

        manager.setCommittedMainViewResolver(() => undefined);
        await (manager as unknown as {brokerTransition: Promise<void>}).brokerTransition;
        expect(latestSurfaceState(owner, registration.surfaceId)).toMatchObject({status: 'standby', reason: 'theme-reset-failed'});

        jest.mocked(shell.webContents.send).mockImplementation(() => undefined);
        manager.setCommittedMainViewResolver(() => ({viewId: owner.viewId, webContents: owner.webContents}));
        await (manager as unknown as {brokerTransition: Promise<void>}).brokerTransition;
        expect(latestSurfaceState(owner, registration.surfaceId)).toMatchObject({status: 'standby', reason: 'theme-reset-failed'});

        const replacement = await manager.registerDesktopThemeSurface(owner);
        expect(replacement.state).toMatchObject({status: 'granted'});
        expect(replacement.state.status === 'granted' && replacement.state.leaseId).not.toBe(firstLease);
    });

    it('does not replace an active registration when its reset fails', async () => {
        const shell = createDocument('internal-shell');
        manager.registerMainWindowView(shell.webContents);
        const registration = await manager.registerDesktopThemeSurface(owner);
        jest.mocked(shell.webContents.send).mockImplementation((channel) => {
            if (channel === RESET_THEME) {
                throw new Error('send failed');
            }
        });

        const failedReplacement = await manager.registerDesktopThemeSurface(owner);

        expect(failedReplacement.surfaceId).toBe(registration.surfaceId);
        expect(failedReplacement.state).toMatchObject({status: 'standby', reason: 'theme-reset-failed'});
        expect(latestSurfaceState(owner, registration.surfaceId)).toMatchObject({status: 'standby', reason: 'theme-reset-failed'});

        jest.mocked(shell.webContents.send).mockImplementation(() => undefined);
        jest.mocked(shell.webContents.send).mockClear();
        const replacement = await manager.registerDesktopThemeSurface(owner);
        expect(shell.webContents.send).toHaveBeenCalledWith(RESET_THEME);
        expect(replacement.surfaceId).not.toBe(registration.surfaceId);
        expect(replacement.state).toMatchObject({status: 'granted'});
    });

    it('does not reset the current owner when a failed background surface registers again', async () => {
        const shell = createDocument('internal-shell');
        const replacementOwner = createDocument('replacement-view');
        manager.registerMainWindowView(shell.webContents);
        const registration = await manager.registerDesktopThemeSurface(owner);
        jest.mocked(shell.webContents.send).mockImplementation((channel) => {
            if (channel === RESET_THEME) {
                throw new Error('send failed');
            }
        });

        manager.setCommittedMainViewResolver(() => ({viewId: replacementOwner.viewId, webContents: replacementOwner.webContents}));
        await (manager as unknown as {brokerTransition: Promise<void>}).brokerTransition;
        expect(latestSurfaceState(owner, registration.surfaceId)).toMatchObject({status: 'standby', reason: 'theme-reset-failed'});

        jest.mocked(shell.webContents.send).mockImplementation(() => undefined);
        const replacement = await manager.registerDesktopThemeSurface(replacementOwner);
        const leaseId = replacement.state.status === 'granted' ? replacement.state.leaseId : '';
        await expect(manager.applyDesktopTheme(replacementOwner, {
            surfaceId: replacement.surfaceId,
            leaseId,
            sequence: 1,
            directive: {mode: 'fixed', shellTheme},
        })).resolves.toMatchObject({status: 'applied'});

        jest.mocked(shell.webContents.send).mockClear();
        const failedRetry = await manager.registerDesktopThemeSurface(owner);
        expect(failedRetry).toEqual({
            surfaceId: registration.surfaceId,
            state: expect.objectContaining({status: 'standby', reason: 'theme-reset-failed'}),
        });
        expect(shell.webContents.send).not.toHaveBeenCalledWith(RESET_THEME);
    });

    it('does not revive a failed registration across view scope changes', async () => {
        let viewType = ViewType.TAB;
        jest.mocked(ViewManager.getView).mockImplementation((viewId) => ({
            id: viewId,
            serverId: 'server-id',
            type: viewType,
        }) as never);
        const shell = createDocument('internal-shell');
        manager.registerMainWindowView(shell.webContents);
        const registration = await manager.registerDesktopThemeSurface(owner);
        const leaseId = registration.state.status === 'granted' ? registration.state.leaseId : '';
        jest.mocked(shell.webContents.send).mockImplementation((channel) => {
            if (channel === UPDATE_THEME) {
                throw new Error('send failed');
            }
        });
        await manager.applyDesktopTheme(owner, {
            surfaceId: registration.surfaceId,
            leaseId,
            sequence: 1,
            directive: {mode: 'fixed', shellTheme},
        });

        viewType = ViewType.WINDOW;
        manager.handleDesktopThemeViewTypeChanged(owner.viewId, viewType);
        viewType = ViewType.TAB;
        manager.handleDesktopThemeViewTypeChanged(owner.viewId, viewType);
        await (manager as unknown as {brokerTransition: Promise<void>}).brokerTransition;

        expect(latestSurfaceState(owner, registration.surfaceId)).toMatchObject({status: 'standby', reason: 'apply-failed'});
        await expect(manager.applyDesktopTheme(owner, {
            surfaceId: registration.surfaceId,
            leaseId,
            sequence: 2,
            directive: {mode: 'fixed', shellTheme},
        })).resolves.toMatchObject({status: 'rejected', reason: 'unknown-surface'});
    });

    it('revokes for shell-sync disablement and grants a fresh lease when re-enabled', async () => {
        const registration = await manager.registerDesktopThemeSurface(owner);
        const firstLease = registration.state.status === 'granted' ? registration.state.leaseId : '';

        (Config as {themeSyncing: boolean}).themeSyncing = false;
        manager.handleCommittedMainViewChanged();
        await (manager as unknown as {brokerTransition: Promise<void>}).brokerTransition;
        expect(latestSurfaceState(owner, registration.surfaceId)).toMatchObject({status: 'standby', reason: 'desktop-sync-disabled'});

        (Config as {themeSyncing: boolean}).themeSyncing = true;
        manager.handleCommittedMainViewChanged();
        await (manager as unknown as {brokerTransition: Promise<void>}).brokerTransition;
        expect(latestSurfaceState(owner, registration.surfaceId)).toMatchObject({status: 'granted'});
        expect(latestSurfaceState(owner, registration.surfaceId).leaseId).not.toBe(firstLease);
    });

    it('invalidates the current document when its replacement commits', async () => {
        const first = await manager.registerDesktopThemeSurface(owner);
        const leaseId = first.state.status === 'granted' ? first.state.leaseId : '';
        expect(manager.isDesktopThemeDocumentCutover(owner)).toBe(true);
        await expect(manager.applyDesktopTheme(owner, {
            surfaceId: first.surfaceId,
            leaseId,
            sequence: 1,
            directive: {mode: 'fixed', shellTheme},
        })).resolves.toMatchObject({status: 'applied'});

        manager.handleDesktopThemeDocumentInvalidated(owner.webContents, owner.frame);
        await (manager as unknown as {brokerTransition: Promise<void>}).brokerTransition;
        expect(manager.isDesktopThemeDocumentCutover(owner)).toBe(false);

        const replacement = await manager.registerDesktopThemeSurface(owner);
        expect(replacement.surfaceId).not.toBe(first.surfaceId);
        await expect(manager.releaseDesktopThemeSurface(owner, first.surfaceId)).resolves.toEqual({status: 'stale'});
        expect(latestSurfaceState(owner, replacement.surfaceId)).toMatchObject({status: 'granted'});
    });

    it('has no owner after the committed view loses its server', async () => {
        const registration = await manager.registerDesktopThemeSurface(owner);
        jest.mocked(ServerManager.getServer).mockReturnValue(undefined);
        manager.handleCommittedMainViewChanged();
        await (manager as unknown as {brokerTransition: Promise<void>}).brokerTransition;

        expect(latestSurfaceState(owner, registration.surfaceId)).toMatchObject({status: 'standby', reason: 'not-current'});
        expect(nativeTheme.themeSource).toBe('system');
    });

    it('nests lock and suspend blockers and grants a fresh lease after both clear', async () => {
        const registration = await manager.registerDesktopThemeSurface(owner);
        const firstLease = registration.state.status === 'granted' ? registration.state.leaseId : '';
        manager.initializeLifecycle();
        const listener = (event: string) => jest.mocked(powerMonitor.on).mock.calls.find(([name]) => name === event)?.[1] as () => void;

        listener('lock-screen')();
        listener('suspend')();
        await (manager as unknown as {brokerTransition: Promise<void>}).brokerTransition;
        expect(latestSurfaceState(owner, registration.surfaceId)).toMatchObject({status: 'standby', reason: 'screen-locked'});

        listener('unlock-screen')();
        await (manager as unknown as {brokerTransition: Promise<void>}).brokerTransition;
        expect(latestSurfaceState(owner, registration.surfaceId)).toMatchObject({status: 'standby', reason: 'system-suspended'});

        listener('resume')();
        await (manager as unknown as {brokerTransition: Promise<void>}).brokerTransition;
        expect(latestSurfaceState(owner, registration.surfaceId)).toMatchObject({status: 'granted'});
        expect(latestSurfaceState(owner, registration.surfaceId).leaseId).not.toBe(firstLease);
        expect(SystemAppearanceMonitor.invalidate).toHaveBeenCalledTimes(4);
    });
});
