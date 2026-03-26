// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {globalShortcut} from 'electron';

import AgentWindow from 'app/agentWindow';
import Config from 'common/config';
import {Logger} from 'common/log';

import type {AgentConfig, CombinedConfig} from 'types/config';

const log = new Logger('GlobalShortcutManager');

export class GlobalShortcutManager {
    private currentShortcut?: string;
    private currentEnabled?: boolean;

    private isFullyConfigured = (agent?: AgentConfig): boolean => {
        return Boolean(agent?.enabled && agent?.shortcut && agent?.selectedAgentId && agent?.selectedServerUrl);
    };

    init = () => {
        const agent = Config.agent;
        this.currentEnabled = this.isFullyConfigured(agent);

        if (this.currentEnabled && agent?.shortcut) {
            this.registerShortcut(agent.shortcut);
        }

        Config.on('update', this.handleConfigUpdate);
    };

    private handleConfigUpdate = (config: CombinedConfig) => {
        const agent: AgentConfig | undefined = config.agent;
        const nowEnabled = this.isFullyConfigured(agent);
        const shortcut = agent?.shortcut ?? '';

        if (!nowEnabled && this.currentEnabled) {
            // Disabled or agent deselected — unregister shortcut and destroy window
            this.unregisterShortcut();
            AgentWindow.destroy();
            this.currentEnabled = false;
            this.currentShortcut = undefined;
            log.info('Agent window disabled');
            return;
        }

        if (nowEnabled && !this.currentEnabled) {
            // Enabled with agent selected — init window and register shortcut
            AgentWindow.init();
            if (shortcut) {
                this.registerShortcut(shortcut);
            }
            this.currentEnabled = true;
            log.info('Agent window enabled');
            return;
        }

        if (nowEnabled && shortcut !== this.currentShortcut) {
            // Shortcut changed — re-register
            this.unregisterShortcut();
            if (shortcut) {
                this.registerShortcut(shortcut);
            }
        }
    };

    private registerShortcut = (accelerator: string) => {
        try {
            const success = globalShortcut.register(accelerator, () => {
                AgentWindow.toggle();
            });

            if (success) {
                this.currentShortcut = accelerator;
                log.info('Registered global shortcut:', accelerator);
            } else {
                log.warn('Failed to register global shortcut:', accelerator);
            }
        } catch (error) {
            log.error('Error registering global shortcut:', {error});
        }
    };

    private unregisterShortcut = () => {
        if (this.currentShortcut) {
            globalShortcut.unregister(this.currentShortcut);
            log.info('Unregistered global shortcut:', this.currentShortcut);
            this.currentShortcut = undefined;
        }
    };

    destroy = () => {
        this.unregisterShortcut();
        Config.off('update', this.handleConfigUpdate);
    };
}

const globalShortcutManager = new GlobalShortcutManager();
export default globalShortcutManager;
