// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {randomUUID} from 'crypto';

import type {IpcMainEvent, IpcMainInvokeEvent, WebContents, WebFrameMain} from 'electron';
import {ipcMain, nativeTheme, powerMonitor} from 'electron';

import type {
    DesktopThemeApplyRequest,
    DesktopThemeApplyResult,
    DesktopThemeDirective,
    DesktopThemeFailureReason,
    DesktopThemeReleaseResult,
    DesktopThemeSurfaceRegistration,
    DesktopThemeSurfaceState,
    DesktopThemeSurfaceStateEvent,
    Theme,
} from '@mattermost/desktop-api';

import {
    DARK_MODE_CHANGE,
    DESKTOP_THEME_SURFACE_STATE_CHANGED,
    EMIT_CONFIGURATION,
    GET_THEME,
    RESET_THEME,
    SERVER_SWITCHED,
    SERVER_THEME_CHANGED,
    UPDATE_THEME,
} from 'common/communication';
import Config from 'common/config';
import {Logger} from 'common/log';
import ServerManager from 'common/servers/serverManager';
import {ViewType} from 'common/views/MattermostView';
import ViewManager from 'common/views/viewManager';
import {
    desktopThemeDirectiveToTheme,
    getDesktopThemeNativeSource,
    isLiveDesktopThemeDocument,
    isSameDesktopThemeDocument,
    rejectDesktopThemeApply,
} from 'main/desktopThemeUtils';
import SystemAppearanceMonitor from 'main/systemAppearanceMonitor';
import {isLightColor} from 'main/utils';

import type {CombinedConfig} from 'types/config';

export type CommittedMainView = {
    viewId: string;
    webContents: WebContents;
};

export type DesktopThemeDocument = CommittedMainView & {
    frame: WebFrameMain;
    scope: DesktopThemeSurfaceState['scope'];
};

type DesktopThemeSurface = DesktopThemeDocument & {
    surfaceId: string;
    state: DesktopThemeSurfaceState;
};

type DesktopThemeLease = {
    registration: DesktopThemeSurface;
    leaseId: string;
    lastSequence: number;
    directive?: DesktopThemeDirective;
};

type LifecycleBlocker = 'locked' | 'suspended';

type MainStandbyState = Omit<Extract<DesktopThemeSurfaceState, {scope: 'main-tab'; status: 'standby'}>, 'revision'>;

const log = new Logger('ThemeManager');

export class ThemeManager {
    private mainWindowViews: Set<WebContents>;
    private popoutViews: Map<string, Set<WebContents>>;
    private popoutThemes: Map<string, Theme>;
    private committedMainViewResolver?: () => CommittedMainView | undefined;
    private desktopThemeSurfaces = new Map<string, DesktopThemeSurface>();
    private desktopThemeSurfaceByFrame = new Map<WebFrameMain, DesktopThemeSurface>();
    private cutoverDocuments = new Map<string, DesktopThemeDocument>();
    private activeDesktopThemeLease?: DesktopThemeLease;
    private desktopThemeStateRevision = 0;
    private lifecycleBlockers = new Set<LifecycleBlocker>();
    private brokerTransition = Promise.resolve();
    private lifecycleInitialized = false;
    private quitting = false;
    private readonly createId: () => string;

    constructor(createId: () => string = randomUUID) {
        this.mainWindowViews = new Set();
        this.popoutViews = new Map();
        this.popoutThemes = new Map();
        this.createId = createId;

        ipcMain.on(EMIT_CONFIGURATION, this.handleEmitConfiguration);
        ipcMain.handle(GET_THEME, this.handleGetTheme);

        ServerManager.on(SERVER_THEME_CHANGED, this.handleServerThemeChanged);
        ServerManager.on(SERVER_SWITCHED, this.updateMainViews);
    }

    setCommittedMainViewResolver = (resolver: () => CommittedMainView | undefined) => {
        this.committedMainViewResolver = resolver;
        this.handleCommittedMainViewChanged();
    };

    handleCommittedMainViewChanged = () => {
        this.updateMainViews();
    };

    isCommittedMainView = ({viewId, webContents}: CommittedMainView) => {
        const committedMainView = this.resolveCommittedMainView();
        return committedMainView?.viewId === viewId && committedMainView.webContents === webContents;
    };

    initializeLifecycle = () => {
        if (this.lifecycleInitialized) {
            return;
        }
        this.lifecycleInitialized = true;
        powerMonitor.on('lock-screen', this.handleLockScreen);
        powerMonitor.on('unlock-screen', this.handleUnlockScreen);
        powerMonitor.on('suspend', this.handleSuspend);
        powerMonitor.on('resume', this.handleResume);
    };

    shutdown = () => {
        this.quitting = true;
        this.activeDesktopThemeLease = undefined;
        this.resetDesktopOutput();
    };

    registerDesktopThemeSurface = (document: DesktopThemeDocument): Promise<DesktopThemeSurfaceRegistration> => {
        return this.enqueueBrokerTransition(() => {
            if (!isLiveDesktopThemeDocument(document)) {
                throw new Error('Desktop theme surface document is no longer live');
            }

            const replaced = this.desktopThemeSurfaceByFrame.get(document.frame);
            if (replaced) {
                this.removeDesktopThemeSurface(replaced);
                if (this.activeDesktopThemeLease?.registration === replaced) {
                    this.revokeDesktopThemeLease('not-current');
                }
            }

            this.cutoverDocuments.set(document.viewId, document);

            const surfaceId = this.createId();
            const state = document.scope === 'popout' ? this.createPopoutState() : this.createStandbyState(this.currentStandbyReason());
            const registration = {...document, surfaceId, state};
            this.desktopThemeSurfaces.set(surfaceId, registration);
            this.desktopThemeSurfaceByFrame.set(document.frame, registration);
            this.publishDesktopThemeState(registration);

            if (document.scope === 'main-tab') {
                this.reconcileDesktopThemeOwner();
            } else {
                this.updatePopoutViews(document.viewId);
            }

            return {surfaceId, state: registration.state};
        });
    };

    applyDesktopTheme = (document: DesktopThemeDocument, request: DesktopThemeApplyRequest): Promise<DesktopThemeApplyResult> => {
        return this.enqueueBrokerTransition(() => {
            const registration = this.desktopThemeSurfaces.get(request.surfaceId);
            if (!registration) {
                return rejectDesktopThemeApply(request, 'unknown-surface');
            }
            if (!isSameDesktopThemeDocument(registration, document) || !isLiveDesktopThemeDocument(registration)) {
                return rejectDesktopThemeApply(request, 'invalid-document');
            }
            if (!this.isCommittedMainView(registration)) {
                return rejectDesktopThemeApply(request, 'not-owner');
            }
            if (!Config.themeSyncing) {
                return rejectDesktopThemeApply(request, 'desktop-sync-disabled');
            }
            const lifecycleReason = this.currentLifecycleReason();
            if (lifecycleReason) {
                return rejectDesktopThemeApply(request, lifecycleReason);
            }

            const lease = this.activeDesktopThemeLease;
            if (!lease || lease.registration !== registration || lease.leaseId !== request.leaseId) {
                return rejectDesktopThemeApply(request, 'stale-lease');
            }
            if (request.sequence <= lease.lastSequence) {
                return rejectDesktopThemeApply(request, 'stale-sequence');
            }

            const nativeSource = getDesktopThemeNativeSource(request.directive);
            if (!this.setNativeThemeSource(nativeSource)) {
                return this.failDesktopThemeApply(lease, request, 'native-theme-update');
            }

            const theme = desktopThemeDirectiveToTheme(request.directive);
            if (!this.publishDesktopShellTheme(theme)) {
                return this.failDesktopThemeApply(lease, request, 'desktop-shell-update');
            }

            lease.lastSequence = request.sequence;
            lease.directive = request.directive;
            return {
                status: 'applied',
                surfaceId: request.surfaceId,
                leaseId: request.leaseId,
                sequence: request.sequence,
            };
        });
    };

    releaseDesktopThemeSurface = (document: DesktopThemeDocument, surfaceId: string): Promise<DesktopThemeReleaseResult> => {
        return this.enqueueBrokerTransition(() => {
            const registration = this.desktopThemeSurfaces.get(surfaceId);
            if (!registration || !isSameDesktopThemeDocument(registration, document)) {
                return {status: 'stale'};
            }

            const wasActive = this.activeDesktopThemeLease?.registration === registration;
            this.removeDesktopThemeSurface(registration);
            if (wasActive && !this.revokeDesktopThemeLease('not-current')) {
                throw new Error('Failed to release Desktop theme output');
            }
            if (!wasActive && this.isCommittedMainView(registration) && !this.resetDesktopOutput()) {
                throw new Error('Failed to release Desktop theme output');
            }

            return {status: 'released'};
        });
    };

    handleDesktopThemeDocumentNavigationStarted = (webContents: WebContents, frame?: WebFrameMain) => {
        this.scheduleBrokerTransition(() => {
            this.removeDesktopThemeDocumentSurfaces(webContents, frame);
        });
    };

    handleDesktopThemeDocumentNavigationCompleted = (webContents: WebContents) => {
        this.scheduleBrokerTransition(() => {
            [...this.cutoverDocuments.entries()].forEach(([viewId, document]) => {
                if (
                    document.webContents === webContents &&
                    !isSameDesktopThemeDocument(this.desktopThemeSurfaceByFrame.get(document.frame), document)
                ) {
                    this.cutoverDocuments.delete(viewId);
                }
            });
        });
    };

    handleDesktopThemeDocumentInvalidated = (webContents: WebContents, frame?: WebFrameMain) => {
        this.scheduleBrokerTransition(() => {
            this.removeDesktopThemeDocumentSurfaces(webContents, frame);
            this.removeDesktopThemeDocumentCutover(webContents, frame);
        });
    };

    handleDesktopThemeViewInvalidated = (viewId: string) => {
        this.scheduleBrokerTransition(() => {
            const registrations = [...this.desktopThemeSurfaces.values()].filter((registration) => registration.viewId === viewId);
            registrations.forEach((registration) => {
                const wasActive = this.activeDesktopThemeLease?.registration === registration;
                this.removeDesktopThemeSurface(registration);
                if (wasActive) {
                    this.revokeDesktopThemeLease('not-current');
                }
            });
            this.cutoverDocuments.delete(viewId);
        });
    };

    handleDesktopThemeViewTypeChanged = (viewId: string, type: ViewType) => {
        const scope = type === ViewType.TAB ? 'main-tab' : 'popout';
        this.scheduleBrokerTransition(() => {
            const document = this.cutoverDocuments.get(viewId);
            if (!document || document.scope === scope) {
                return;
            }

            const registrationForFrame = this.desktopThemeSurfaceByFrame.get(document.frame);
            let registration = isSameDesktopThemeDocument(registrationForFrame, document) ? registrationForFrame : undefined;
            if (registration && this.isDesktopThemeRegistrationFailed(registration)) {
                this.removeDesktopThemeSurface(registration);
                registration = undefined;
            }
            if (scope === 'popout' && registration && this.activeDesktopThemeLease?.registration === registration) {
                this.revokeDesktopThemeLease('not-current');
            }

            this.cutoverDocuments.set(viewId, {...document, scope});
            if (registration) {
                registration.scope = scope;
                if (scope === 'popout') {
                    registration.state = this.createPopoutState();
                    this.publishDesktopThemeState(registration);
                }
            }

            this.reconcileDesktopThemeOwner();
            if (scope === 'popout') {
                this.updatePopoutViews(viewId);
            }
        });
    };

    isDesktopThemeDocumentCutover = (document: DesktopThemeDocument) => {
        return isSameDesktopThemeDocument(this.cutoverDocuments.get(document.viewId), document);
    };

    registerMainWindowView = (webContents: WebContents) => {
        this.mainWindowViews.add(webContents);
        webContents.on('destroyed', () => {
            this.mainWindowViews.delete(webContents);
        });
        if (this.committedMainViewResolver) {
            this.sendCurrentDesktopShellState(webContents);
        }
    };

    registerPopoutView = (webContents: WebContents, viewId: string) => {
        if (!this.popoutViews.has(viewId)) {
            this.popoutViews.set(viewId, new Set());
        }
        this.popoutViews.get(viewId)?.add(webContents);
        webContents.on('destroyed', () => {
            this.popoutViews.get(viewId)?.delete(webContents);
        });
        if (this.cutoverDocuments.get(viewId)?.scope === 'popout') {
            this.updatePopoutViews(viewId);
        }
    };

    updatePopoutTheme = (viewId: string, theme: Theme) => {
        this.popoutThemes.set(viewId, theme);
        this.updatePopoutViews(viewId);
    };

    private handleEmitConfiguration = (event: IpcMainEvent, config: CombinedConfig) => {
        if (Config.themeSyncing) {
            ServerManager.getAllServers().forEach((server) => {
                this.handleServerThemeChanged(server.id);
            });
        } else {
            this.updateMainViews();
            this.popoutViews.forEach((views) => {
                views.forEach((view) => {
                    view.send(RESET_THEME);
                });
            });
        }

        this.mainWindowViews.forEach((view) => {
            view.send(DARK_MODE_CHANGE, config.darkMode);
        });
        this.popoutViews.forEach((views) => {
            views.forEach((view) => {
                view.send(DARK_MODE_CHANGE, config.darkMode);
            });
        });
    };

    private handleServerThemeChanged = (serverId: string) => {
        if (!Config.themeSyncing) {
            return;
        }

        this.updateMainViews();
        const views = ViewManager.getViewsByServerId(serverId).filter((view) => view.type === ViewType.WINDOW);
        views.forEach((view) => {
            this.updatePopoutViews(view.id);
        });
    };

    private updateMainViews = () => {
        const committedMainView = this.resolveCommittedMainView();
        const document = committedMainView && this.getCommittedDesktopThemeDocument(committedMainView);
        if (this.activeDesktopThemeLease || (document && this.isDesktopThemeDocumentCutover(document))) {
            this.scheduleBrokerTransition(this.reconcileDesktopThemeOwner);
            return;
        }

        this.updateLegacyMainViews();
    };

    private updateLegacyMainViews = () => {
        if (!Config.themeSyncing) {
            this.resetThemeSource();
            this.mainWindowViews.forEach((view) => {
                view.send(RESET_THEME);
            });
            return;
        }

        const serverId = ServerManager.getCurrentServerId();
        if (!serverId) {
            this.resetThemeSource();
            this.mainWindowViews.forEach((view) => {
                view.send(RESET_THEME);
            });
            return;
        }
        const server = ServerManager.getServer(serverId);
        if (!server || !server.theme) {
            this.resetThemeSource();
            this.mainWindowViews.forEach((view) => {
                view.send(RESET_THEME);
            });
            return;
        }
        if (!server.theme.isUsingSystemTheme) {
            const themeSource = isLightColor(server.theme.centerChannelBg || '#fff') ? 'light' : 'dark';
            if (nativeTheme.themeSource !== themeSource) {
                nativeTheme.themeSource = themeSource;
            }
        }
        this.mainWindowViews.forEach((view) => {
            view.send(UPDATE_THEME, server.theme);
        });
    };

    private updatePopoutViews = (viewId: string) => {
        const popoutViews = this.popoutViews.get(viewId);
        if (popoutViews) {
            if (this.cutoverDocuments.get(viewId)?.scope === 'popout') {
                const currentTheme = this.getCurrentDesktopShellTheme();
                popoutViews.forEach((view) => {
                    if (currentTheme) {
                        view.send(UPDATE_THEME, currentTheme);
                    } else {
                        view.send(RESET_THEME);
                    }
                });
                return;
            }

            let theme = this.popoutThemes.get(viewId);
            if (!theme) {
                theme = ServerManager.getServer(viewId)?.theme;
            }
            if (!theme) {
                popoutViews.forEach((view) => {
                    view.send(RESET_THEME);
                });
                return;
            }
            popoutViews.forEach((view) => {
                view.send(UPDATE_THEME, theme);
            });
        }
    };

    private handleGetTheme = (event: IpcMainInvokeEvent) => {
        if (!Config.themeSyncing) {
            return undefined;
        }

        let popoutServerId;
        this.popoutViews.forEach((views, serverId) => {
            if (views.has(event.sender)) {
                popoutServerId = serverId;
            }
        });
        if (popoutServerId) {
            if (this.cutoverDocuments.get(popoutServerId)?.scope === 'popout') {
                return this.getCurrentDesktopShellTheme();
            }
            const server = ServerManager.getServer(popoutServerId);
            if (!server) {
                return undefined;
            }
            return server.theme;
        }

        if (this.committedMainViewResolver) {
            return this.getCurrentDesktopShellTheme();
        }

        const serverId = ServerManager.getCurrentServerId();
        if (!serverId) {
            return undefined;
        }
        const server = ServerManager.getServer(serverId);
        if (!server) {
            return undefined;
        }
        return server.theme;
    };

    private reconcileDesktopThemeOwner = () => {
        if (this.quitting) {
            return;
        }

        const committedMainView = this.resolveCommittedMainView();
        const candidate = committedMainView && [...this.desktopThemeSurfaces.values()].find((registration) =>
            registration.scope === 'main-tab' &&
            registration.viewId === committedMainView.viewId &&
            registration.webContents === committedMainView.webContents &&
            registration.frame === committedMainView.webContents.mainFrame &&
            isLiveDesktopThemeDocument(registration));
        const standbyReason = this.currentStandbyReason();

        [...this.desktopThemeSurfaces.values()].forEach((registration) => {
            if (registration.scope === 'main-tab' && registration !== candidate && !this.isDesktopThemeRegistrationFailed(registration)) {
                this.setDesktopThemeStandby(registration, standbyReason === 'not-current' ? 'not-current' : standbyReason);
            }
        });

        const lease = this.activeDesktopThemeLease;
        if (lease && (lease.registration !== candidate || !Config.themeSyncing || this.lifecycleBlockers.size > 0)) {
            if (!this.revokeDesktopThemeLease(standbyReason)) {
                if (candidate && candidate !== lease.registration) {
                    this.setDesktopThemeStandby(candidate, 'theme-reset-failed');
                }
                return;
            }
        }

        if (candidate && this.isDesktopThemeRegistrationFailed(candidate)) {
            return;
        }

        if (candidate && (!Config.themeSyncing || this.lifecycleBlockers.size > 0)) {
            this.setDesktopThemeStandby(candidate, standbyReason);
        }

        if (candidate && Config.themeSyncing && this.lifecycleBlockers.size === 0) {
            if (this.activeDesktopThemeLease?.registration === candidate) {
                return;
            }

            const leaseId = this.createId();
            this.activeDesktopThemeLease = {
                registration: candidate,
                leaseId,
                lastSequence: 0,
            };
            this.setDesktopThemeGranted(candidate, leaseId);
            return;
        }

        if (!committedMainView || !Config.themeSyncing || this.lifecycleBlockers.size > 0) {
            this.resetDesktopOutput();
            return;
        }

        const legacyDocument = this.getCommittedDesktopThemeDocument(committedMainView);
        if (!legacyDocument || this.isDesktopThemeDocumentCutover(legacyDocument)) {
            this.resetDesktopOutput();
            return;
        }

        this.updateLegacyMainViews();
    };

    private revokeDesktopThemeLease = (reason: MainStandbyState['reason']) => {
        const lease = this.activeDesktopThemeLease;
        if (!lease) {
            return this.resetDesktopOutput();
        }

        this.activeDesktopThemeLease = undefined;
        if (this.desktopThemeSurfaces.get(lease.registration.surfaceId) === lease.registration) {
            this.setDesktopThemeStandby(lease.registration, reason);
        }
        const released = this.resetDesktopOutput();
        if (!released && this.desktopThemeSurfaces.get(lease.registration.surfaceId) === lease.registration) {
            this.setDesktopThemeStandby(lease.registration, 'theme-reset-failed');
        }
        return released;
    };

    private isDesktopThemeRegistrationFailed = (registration: DesktopThemeSurface) => {
        return registration.state.scope === 'main-tab' &&
            registration.state.status === 'standby' &&
            (registration.state.reason === 'apply-failed' || registration.state.reason === 'theme-reset-failed');
    };

    private removeDesktopThemeDocumentSurfaces = (webContents: WebContents, frame?: WebFrameMain) => {
        const registrations = [...this.desktopThemeSurfaces.values()].filter((registration) =>
            registration.webContents === webContents && (!frame || registration.frame === frame));
        registrations.forEach((registration) => {
            const wasActive = this.activeDesktopThemeLease?.registration === registration;
            this.removeDesktopThemeSurface(registration);
            if (wasActive) {
                this.revokeDesktopThemeLease('not-current');
            }
        });
    };

    private removeDesktopThemeDocumentCutover = (webContents: WebContents, frame?: WebFrameMain) => {
        [...this.cutoverDocuments.entries()].forEach(([viewId, document]) => {
            if (document.webContents === webContents && (!frame || document.frame === frame)) {
                this.cutoverDocuments.delete(viewId);
            }
        });
    };

    private failDesktopThemeApply = (
        lease: DesktopThemeLease,
        request: DesktopThemeApplyRequest,
        reason: DesktopThemeFailureReason,
    ): DesktopThemeApplyResult => {
        this.activeDesktopThemeLease = undefined;
        const rolledBack = this.resetDesktopOutput();
        this.setDesktopThemeStandby(lease.registration, rolledBack ? 'apply-failed' : 'theme-reset-failed');
        return {
            status: 'failed',
            surfaceId: request.surfaceId,
            leaseId: request.leaseId,
            sequence: request.sequence,
            reason: rolledBack ? reason : 'theme-reset',
        };
    };

    private resetDesktopOutput = () => {
        const nativeReset = this.setNativeThemeSource('system');
        const shellReset = this.sendToDesktopShellTargets(RESET_THEME);
        return nativeReset && shellReset;
    };

    private publishDesktopShellTheme = (theme: Theme) => {
        return this.sendToDesktopShellTargets(UPDATE_THEME, theme);
    };

    private sendToDesktopShellTargets = (channel: string, ...args: unknown[]) => {
        let success = true;
        this.mainWindowViews.forEach((view) => {
            if (view.isDestroyed()) {
                this.mainWindowViews.delete(view);
                return;
            }
            try {
                view.send(channel, ...args);
            } catch (error) {
                success = false;
                log.warn('Unable to publish Desktop shell theme', {webContentsId: view.id, error});
            }
        });

        this.cutoverDocuments.forEach((document, viewId) => {
            if (document.scope !== 'popout') {
                return;
            }
            this.popoutViews.get(viewId)?.forEach((view) => {
                if (view.isDestroyed()) {
                    this.popoutViews.get(viewId)?.delete(view);
                    return;
                }
                try {
                    view.send(channel, ...args);
                } catch (error) {
                    success = false;
                    log.warn('Unable to publish Desktop popout shell theme', {webContentsId: view.id, error});
                }
            });
        });
        return success;
    };

    private setNativeThemeSource = (source: 'system' | 'light' | 'dark') => {
        try {
            if (nativeTheme.themeSource !== source) {
                nativeTheme.themeSource = source;
            }
            return nativeTheme.themeSource === source;
        } catch (error) {
            log.warn('Unable to set native theme source', {source, error});
            return false;
        }
    };

    private getCurrentDesktopShellTheme = () => {
        if (!Config.themeSyncing) {
            return undefined;
        }
        if (this.activeDesktopThemeLease?.directive) {
            return desktopThemeDirectiveToTheme(this.activeDesktopThemeLease.directive);
        }

        const committedMainView = this.resolveCommittedMainView();
        const document = committedMainView && this.getCommittedDesktopThemeDocument(committedMainView);
        if (document && this.isDesktopThemeDocumentCutover(document)) {
            return undefined;
        }

        const serverId = ServerManager.getCurrentServerId();
        return serverId ? ServerManager.getServer(serverId)?.theme : undefined;
    };

    private sendCurrentDesktopShellState = (webContents: WebContents) => {
        const theme = this.getCurrentDesktopShellTheme();
        if (theme) {
            webContents.send(UPDATE_THEME, theme);
        } else {
            webContents.send(RESET_THEME);
        }
    };

    private currentStandbyReason = (): MainStandbyState['reason'] => {
        if (!Config.themeSyncing) {
            return 'desktop-sync-disabled';
        }
        return this.currentLifecycleReason() ?? 'not-current';
    };

    private currentLifecycleReason = (): 'screen-locked' | 'system-suspended' | undefined => {
        if (this.lifecycleBlockers.has('locked')) {
            return 'screen-locked';
        }
        if (this.lifecycleBlockers.has('suspended')) {
            return 'system-suspended';
        }
        return undefined;
    };

    private createStandbyState = (reason: MainStandbyState['reason']): DesktopThemeSurfaceState => ({
        revision: ++this.desktopThemeStateRevision,
        scope: 'main-tab',
        status: 'standby',
        reason,
    });

    private createPopoutState = (): DesktopThemeSurfaceState => ({
        revision: ++this.desktopThemeStateRevision,
        scope: 'popout',
        status: 'ineligible',
        reason: 'not-main-tab',
    });

    private setDesktopThemeStandby = (registration: DesktopThemeSurface, reason: MainStandbyState['reason']) => {
        if (registration.state.scope === 'main-tab' && registration.state.status === 'standby' && registration.state.reason === reason) {
            return;
        }
        registration.state = this.createStandbyState(reason);
        this.publishDesktopThemeState(registration);
    };

    private setDesktopThemeGranted = (registration: DesktopThemeSurface, leaseId: string) => {
        registration.state = {
            revision: ++this.desktopThemeStateRevision,
            scope: 'main-tab',
            status: 'granted',
            leaseId,
        };
        this.publishDesktopThemeState(registration);
    };

    private publishDesktopThemeState = (registration: DesktopThemeSurface) => {
        const event: DesktopThemeSurfaceStateEvent = {
            surfaceId: registration.surfaceId,
            state: registration.state,
        };
        try {
            registration.frame.send(DESKTOP_THEME_SURFACE_STATE_CHANGED, event);
        } catch (error) {
            log.warn('Unable to publish Desktop theme surface state', {viewId: registration.viewId, error});
        }
    };

    private removeDesktopThemeSurface = (registration: DesktopThemeSurface) => {
        this.desktopThemeSurfaces.delete(registration.surfaceId);
        if (this.desktopThemeSurfaceByFrame.get(registration.frame) === registration) {
            this.desktopThemeSurfaceByFrame.delete(registration.frame);
        }
    };

    private getCommittedDesktopThemeDocument = (committedMainView: CommittedMainView): DesktopThemeDocument | undefined => {
        const frame = committedMainView.webContents.mainFrame;
        const document = {...committedMainView, frame, scope: 'main-tab' as const};
        return isLiveDesktopThemeDocument(document) ? document : undefined;
    };

    private enqueueBrokerTransition = <T>(transition: () => T | Promise<T>): Promise<T> => {
        const result = this.brokerTransition.then(() => {
            if (this.quitting) {
                throw new Error('Desktop theme broker is shutting down');
            }
            return transition();
        });
        this.brokerTransition = result.then(() => undefined, () => undefined);
        return result;
    };

    private scheduleBrokerTransition = (transition: () => unknown | Promise<unknown>) => {
        this.enqueueBrokerTransition(transition).catch((error) => {
            log.error('Desktop theme broker transition failed', {error});
        });
    };

    private handleLockScreen = () => {
        if (this.lifecycleBlockers.has('locked')) {
            return;
        }
        this.lifecycleBlockers.add('locked');
        SystemAppearanceMonitor.invalidate('invalid');
        this.updateMainViews();
    };

    private handleUnlockScreen = () => {
        if (!this.lifecycleBlockers.delete('locked')) {
            return;
        }
        SystemAppearanceMonitor.invalidate('invalid');
        this.updateMainViews();
    };

    private handleSuspend = () => {
        if (this.lifecycleBlockers.has('suspended')) {
            return;
        }
        this.lifecycleBlockers.add('suspended');
        SystemAppearanceMonitor.invalidate('invalid');
        this.updateMainViews();
    };

    private handleResume = () => {
        if (!this.lifecycleBlockers.delete('suspended')) {
            return;
        }
        SystemAppearanceMonitor.invalidate('invalid');
        this.updateMainViews();
    };

    private resolveCommittedMainView = () => {
        if (!this.committedMainViewResolver) {
            return undefined;
        }

        const committedMainView = this.committedMainViewResolver();
        if (!committedMainView || committedMainView.webContents.isDestroyed()) {
            return undefined;
        }

        const view = ViewManager.getView(committedMainView.viewId);
        if (!view || view.type !== ViewType.TAB || !ServerManager.getServer(view.serverId)) {
            return undefined;
        }

        return committedMainView;
    };

    private resetThemeSource = () => {
        if (nativeTheme.themeSource !== 'system') {
            nativeTheme.themeSource = 'system';
        }
    };
}

const themeManager = new ThemeManager();
export default themeManager;
