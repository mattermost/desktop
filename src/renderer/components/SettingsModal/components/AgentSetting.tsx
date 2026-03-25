// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import type {AvailableAgent} from 'types/agent';
import type {AgentConfig, CurrentConfig} from 'types/config';

import './AgentSetting.scss';

const DEFAULT_SHORTCUT = 'CommandOrControl+Shift+Space';

function acceleratorToKeys(accelerator: string): string[] {
    return accelerator.split('+').map((key) => {
        switch (key) {
        case 'CommandOrControl':
            return window.process.platform === 'darwin' ? '⌘' : 'Ctrl';
        case 'Command':
            return '⌘';
        case 'Control':
            return 'Ctrl';
        case 'Shift':
            return window.process.platform === 'darwin' ? '⇧' : 'Shift';
        case 'Alt':
            return window.process.platform === 'darwin' ? '⌥' : 'Alt';
        case 'Space':
            return 'Space';
        default:
            return key;
        }
    });
}

function keyboardEventToAccelerator(e: KeyboardEvent): string | null {
    const parts: string[] = [];

    if (e.metaKey) {
        parts.push(window.process.platform === 'darwin' ? 'Command' : 'Meta');
    }
    if (e.ctrlKey) {
        parts.push('Control');
    }
    if (e.altKey) {
        parts.push('Alt');
    }
    if (e.shiftKey) {
        parts.push('Shift');
    }

    if (['Meta', 'Control', 'Alt', 'Shift'].includes(e.key)) {
        return null;
    }

    if (parts.length === 0) {
        return null;
    }

    let key = e.key;
    if (key === ' ') {
        key = 'Space';
    } else if (key.length === 1) {
        key = key.toUpperCase();
    }
    parts.push(key);

    const ctrlIdx = parts.indexOf('Control');
    const cmdIdx = parts.indexOf('Command');
    if (window.process.platform === 'darwin' && cmdIdx !== -1) {
        parts[cmdIdx] = 'CommandOrControl';
    } else if (window.process.platform !== 'darwin' && ctrlIdx !== -1) {
        parts[ctrlIdx] = 'CommandOrControl';
    }

    return parts.join('+');
}

export default function AgentSetting({
    onSave,
    value,
}: {
    onSave: (key: keyof CurrentConfig, value: AgentConfig) => void;
    value?: AgentConfig;
}) {
    const intl = useIntl();
    const [enabled, setEnabled] = useState(value?.enabled ?? true);
    const [shortcut, setShortcut] = useState(value?.shortcut ?? DEFAULT_SHORTCUT);
    const [selectedAgentId, setSelectedAgentId] = useState(value?.selectedAgentId ?? '');
    const [selectedServerId, setSelectedServerId] = useState(value?.selectedServerId ?? '');
    const [selectedAgentUsername, setSelectedAgentUsername] = useState(value?.selectedAgentUsername ?? '');
    const [recording, setRecording] = useState(false);
    const recordingRef = useRef(false);
    const [agents, setAgents] = useState<AvailableAgent[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        window.desktop.getAvailableAgents().then((result: AvailableAgent[]) => {
            setAgents(result);
            setLoading(false);
        }).catch(() => {
            setLoading(false);
        });
    }, []);

    const hasAgents = agents.length > 0;

    const save = useCallback((newValue: AgentConfig) => {
        onSave('agent', newValue);
    }, [onSave]);

    const toggleEnabled = useCallback(() => {
        if (!hasAgents) {
            return;
        }
        const newEnabled = !enabled;
        setEnabled(newEnabled);
        save({enabled: newEnabled, shortcut, selectedAgentId, selectedServerId, selectedAgentUsername});
    }, [enabled, shortcut, selectedAgentId, selectedServerId, selectedAgentUsername, save, hasAgents]);

    const handleAgentChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        if (!val) {
            setSelectedAgentId('');
            setSelectedServerId('');
            setSelectedAgentUsername('');
            save({enabled, shortcut, selectedAgentId: undefined, selectedServerId: undefined, selectedAgentUsername: undefined});
            return;
        }

        const [agentId, serverId] = val.split('::');
        const agent = agents.find((a) => a.id === agentId && a.serverId === serverId);
        const username = agent?.username ?? '';
        setSelectedAgentId(agentId);
        setSelectedServerId(serverId);
        setSelectedAgentUsername(username);
        save({enabled, shortcut, selectedAgentId: agentId, selectedServerId: serverId, selectedAgentUsername: username});
    }, [enabled, shortcut, agents, save]);

    const startRecording = useCallback(() => {
        setRecording(true);
        recordingRef.current = true;
    }, []);

    const cancelRecording = useCallback(() => {
        setRecording(false);
        recordingRef.current = false;
    }, []);

    const resetToDefault = useCallback(() => {
        setShortcut(DEFAULT_SHORTCUT);
        save({enabled, shortcut: DEFAULT_SHORTCUT, selectedAgentId, selectedServerId, selectedAgentUsername});
    }, [enabled, selectedAgentId, selectedServerId, selectedAgentUsername, save]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!recordingRef.current) {
                return;
            }

            e.preventDefault();
            e.stopPropagation();

            if (e.key === 'Escape') {
                cancelRecording();
                return;
            }

            const accelerator = keyboardEventToAccelerator(e);
            if (accelerator) {
                setShortcut(accelerator);
                setRecording(false);
                recordingRef.current = false;
                save({enabled, shortcut: accelerator, selectedAgentId, selectedServerId, selectedAgentUsername});
            }
        };

        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [enabled, selectedAgentId, selectedServerId, save, cancelRecording]);

    const keys = shortcut ? acceleratorToKeys(shortcut) : [];

    // Group agents by server
    const serverGroups = agents.reduce<Record<string, AvailableAgent[]>>((acc, agent) => {
        const key = agent.serverName;
        if (!acc[key]) {
            acc[key] = [];
        }
        acc[key].push(agent);
        return acc;
    }, {});

    if (loading) {
        return (
            <div className='AgentSetting'>
                <div className='AgentSetting__loading'>
                    <i className='icon-spinner'/>
                    <FormattedMessage
                        id='renderer.components.settingsPage.agent.loading'
                        defaultMessage='Loading agents...'
                    />
                </div>
            </div>
        );
    }

    return (
        <div className='AgentSetting'>
            {!hasAgents && (
                <div className='AgentSetting__unavailable'>
                    <i className='icon-alert-outline'/>
                    <FormattedMessage
                        id='renderer.components.settingsPage.agent.unavailable'
                        defaultMessage='No servers with the Agents plugin configured. Install and configure the Agents plugin on a connected server to use this feature.'
                    />
                </div>
            )}

            <div className='AgentSetting__toggle'>
                <div className='AgentSetting__toggle-content'>
                    <button
                        className={classNames('AgentSetting__checkbox', {checked: enabled && hasAgents, disabled: !hasAgents})}
                        onClick={toggleEnabled}
                        role='checkbox'
                        aria-checked={enabled && hasAgents}
                        aria-labelledby='agentSetting-enabled'
                        disabled={!hasAgents}
                    >
                        <input
                            id='agentSetting-enabled'
                            defaultChecked={enabled}
                            type='checkbox'
                            tabIndex={-1}
                            disabled={true}
                        />
                        <i className='icon-check'/>
                    </button>
                    <label
                        htmlFor='agentSetting-enabled'
                        className={classNames('AgentSetting__label', {disabled: !hasAgents})}
                        onClick={toggleEnabled}
                    >
                        <FormattedMessage
                            id='renderer.components.settingsPage.agent.enabled'
                            defaultMessage='Enable agent window'
                        />
                        <div className='AgentSetting__sublabel'>
                            <FormattedMessage
                                id='renderer.components.settingsPage.agent.enabled.description'
                                defaultMessage='When enabled, you can open the agent prompt window using a global keyboard shortcut.'
                            />
                        </div>
                    </label>
                </div>
            </div>

            {enabled && hasAgents && (
                <>
                    <div className='AgentSetting__agent-select'>
                        <div className='AgentSetting__agent-select-label'>
                            <FormattedMessage
                                id='renderer.components.settingsPage.agent.selectAgent'
                                defaultMessage='Agent'
                            />
                            <div className='AgentSetting__sublabel'>
                                <FormattedMessage
                                    id='renderer.components.settingsPage.agent.selectAgent.description'
                                    defaultMessage='Select which agent to use when opening the prompt window.'
                                />
                            </div>
                        </div>
                        <select
                            className='AgentSetting__select'
                            value={selectedAgentId && selectedServerId ? `${selectedAgentId}::${selectedServerId}` : ''}
                            onChange={handleAgentChange}
                        >
                            <option value=''>
                                {intl.formatMessage({
                                    id: 'renderer.components.settingsPage.agent.selectAgent.placeholder',
                                    defaultMessage: 'Select an agent...',
                                })}
                            </option>
                            {Object.entries(serverGroups).map(([serverName, serverAgents]) => (
                                <optgroup
                                    key={serverName}
                                    label={serverName}
                                >
                                    {serverAgents.map((agent) => (
                                        <option
                                            key={`${agent.id}::${agent.serverId}`}
                                            value={`${agent.id}::${agent.serverId}`}
                                        >
                                            {agent.displayName}
                                        </option>
                                    ))}
                                </optgroup>
                            ))}
                        </select>
                    </div>

                    <div className='AgentSetting__keybind'>
                        <div className='AgentSetting__keybind-label'>
                            <FormattedMessage
                                id='renderer.components.settingsPage.agent.shortcut'
                                defaultMessage='Global keyboard shortcut'
                            />
                            <div className='AgentSetting__sublabel'>
                                <FormattedMessage
                                    id='renderer.components.settingsPage.agent.shortcut.description'
                                    defaultMessage='Keyboard shortcut to open the agent prompt window from anywhere. Works even when the app is not focused.'
                                />
                            </div>
                        </div>
                        <div className='AgentSetting__keybind-controls'>
                            <div className={classNames('AgentSetting__keybind-display', {recording})}>
                                {recording ? (
                                    <span className='AgentSetting__recording-text'>
                                        <FormattedMessage
                                            id='renderer.components.settingsPage.agent.shortcut.recording'
                                            defaultMessage='Press a key combination...'
                                        />
                                    </span>
                                ) : (
                                    <div className='AgentSetting__keys'>
                                        {keys.map((key, i) => (
                                            <kbd
                                                key={i}
                                                className='AgentSetting__key'
                                            >
                                                {key}
                                            </kbd>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className='AgentSetting__keybind-actions'>
                                {recording ? (
                                    <button
                                        className='AgentSetting__button'
                                        onClick={cancelRecording}
                                    >
                                        <FormattedMessage
                                            id='renderer.components.settingsPage.agent.shortcut.cancel'
                                            defaultMessage='Cancel'
                                        />
                                    </button>
                                ) : (
                                    <>
                                        <button
                                            className='AgentSetting__button'
                                            onClick={startRecording}
                                        >
                                            <FormattedMessage
                                                id='renderer.components.settingsPage.agent.shortcut.record'
                                                defaultMessage='Record shortcut'
                                            />
                                        </button>
                                        <button
                                            className='AgentSetting__button AgentSetting__button--secondary'
                                            onClick={resetToDefault}
                                            title={intl.formatMessage({
                                                id: 'renderer.components.settingsPage.agent.shortcut.reset',
                                                defaultMessage: 'Reset to default',
                                            })}
                                        >
                                            <FormattedMessage
                                                id='renderer.components.settingsPage.agent.shortcut.reset'
                                                defaultMessage='Reset to default'
                                            />
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
