// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import type {IntlShape} from 'react-intl';

import {localeTranslations} from 'common/utils/constants';

import type {SettingsDefinition} from 'types/settings';

import CheckSetting from './components/CheckSetting';
import DownloadSetting from './components/DownloadSetting';
import NotificationSetting from './components/NotificationSetting';
import RadioSetting from './components/RadioSetting';
import SelectSetting from './components/SelectSetting';
import ServerSetting from './components/ServerSetting';
import SpellCheckerSetting from './components/SpellCheckerSetting';
import UpdatesSetting from './components/UpdatesSetting';

const getLanguages = async (func: () => Promise<string[]>) => {
    return (await func()).filter((language) => localeTranslations[language]).
        map((language) => ({label: localeTranslations[language], value: language})).
        sort((a, b) => a.label.localeCompare(b.label));
};

const definition: (intl: IntlShape) => Promise<SettingsDefinition> = async (intl: IntlShape) => {
    return {
        general: {
            title: (
                <FormattedMessage
                    id='renderer.components.settingsPage.general'
                    defaultMessage='General'
                />
            ),
            icon: 'settings-outline',
            settings: [
                {
                    id: 'autoCheckForUpdates',
                    component: UpdatesSetting,
                    condition: (await window.desktop.getLocalConfiguration()).canUpgrade,
                },
                {
                    id: 'downloadLocation',
                    component: DownloadSetting,
                },
                {
                    id: 'autostart',
                    component: CheckSetting,
                    condition: window.process.platform === 'win32' || window.process.platform === 'linux',
                    props: {
                        label: (
                            <FormattedMessage
                                id='renderer.components.settingsPage.startAppOnLogin'
                                defaultMessage='Start app on login'
                            />
                        ),
                        subLabel: (
                            <FormattedMessage
                                id='renderer.components.settingsPage.startAppOnLogin.description'
                                defaultMessage='If enabled, the app starts automatically when you log in to your machine.'
                            />
                        ),
                    },
                },
                {
                    id: 'hideOnStart',
                    component: CheckSetting,
                    condition: window.process.platform === 'win32' || window.process.platform === 'linux',
                    props: {
                        label: (
                            <FormattedMessage
                                id='renderer.components.settingsPage.launchAppMinimized'
                                defaultMessage='Launch app minimized'
                            />
                        ),
                        subLabel: (
                            <FormattedMessage
                                id='renderer.components.settingsPage.launchAppMinimized.description'
                                defaultMessage='If enabled, the app will start in system tray, and will not show the window on launch.'
                            />
                        ),
                    },
                },
                {
                    id: 'showTrayIcon',
                    component: CheckSetting,
                    condition: window.process.platform === 'darwin' || window.process.platform === 'linux',
                    props: {
                        label: (
                            <FormattedMessage
                                id='renderer.components.settingsPage.trayIcon.show'
                                defaultMessage='Show icon in the notification area'
                            />
                        ),
                        subLabel: (
                            <FormattedMessage
                                id='renderer.components.settingsPage.afterRestart'
                                defaultMessage='Setting takes effect after restarting the app.'
                            />
                        ),
                    },
                },
                {
                    id: 'trayIconTheme',
                    component: RadioSetting,
                    condition: (window.process.platform === 'linux' || window.process.platform === 'win32') && (await window.desktop.getLocalConfiguration()).showTrayIcon,
                    props: {
                        label: (
                            <FormattedMessage
                                id='renderer.components.settingsPage.trayIcon.color'
                                defaultMessage='Icon color'
                            />
                        ),
                        options: [
                            {
                                value: 'use_system',
                                label: (
                                    <FormattedMessage
                                        id='renderer.components.settingsPage.trayIcon.theme.systemDefault'
                                        defaultMessage='Use system default'
                                    />
                                ),
                            },
                            {
                                value: 'light',
                                label: (
                                    <FormattedMessage
                                        id='renderer.components.settingsPage.trayIcon.theme.light'
                                        defaultMessage='Light'
                                    />
                                ),
                            },
                            {
                                value: 'dark',
                                label: (
                                    <FormattedMessage
                                        id='renderer.components.settingsPage.trayIcon.theme.dark'
                                        defaultMessage='Dark'
                                    />
                                ),
                            },
                        ],
                    },
                },
                {
                    id: 'minimizeToTray',
                    component: CheckSetting,
                    condition: window.process.platform === 'linux' || window.process.platform === 'win32',
                    props: {
                        label: (
                            <FormattedMessage
                                id='renderer.components.settingsPage.minimizeToTray'
                                defaultMessage='Leave app running in notification area when application window is closed'
                            />
                        ),
                        subLabel: (
                            <>
                                <FormattedMessage
                                    id='renderer.components.settingsPage.minimizeToTray.description'
                                    defaultMessage='If enabled, the app stays running in the notification area after app window is closed.'
                                />
                                <br/>
                                <FormattedMessage
                                    id='renderer.components.settingsPage.afterRestart'
                                    defaultMessage='Setting takes effect after restarting the app.'
                                />
                            </>
                        ),
                    },
                },
                {
                    id: 'startInFullscreen',
                    component: CheckSetting,
                    condition: window.process.platform !== 'linux',
                    props: {
                        label: (
                            <FormattedMessage
                                id='renderer.components.settingsPage.fullscreen'
                                defaultMessage='Open app in full screen'
                            />
                        ),
                        subLabel: (
                            <FormattedMessage
                                id='renderer.components.settingsPage.fullscreen.description'
                                defaultMessage='If enabled, the {appName} application will always open in full screen'
                                values={{appName: (await window.desktop.getVersion()).name}}
                            />
                        ),
                    },
                },
            ],
        },
        notifications: {
            title: (
                <FormattedMessage
                    id='renderer.components.settingsPage.notifications'
                    defaultMessage='Notifications'
                />
            ),
            icon: 'bell-outline',
            settings: [
                {
                    id: 'showUnreadBadge',
                    component: CheckSetting,
                    condition: window.process.platform === 'darwin' || window.process.platform === 'win32',
                    props: {
                        heading: (
                            <FormattedMessage
                                id='renderer.components.settingsPage.showUnreadBadge.heading'
                                defaultMessage='Unread Badge'
                            />
                        ),
                        label: (
                            window.process.platform === 'win32' ? (
                                <FormattedMessage
                                    id='renderer.components.settingsPage.showUnreadBadge.taskbar'
                                    defaultMessage='Show red badge on taskbar icon to indicate unread messages'
                                />
                            ) : (
                                <FormattedMessage
                                    id='renderer.components.settingsPage.showUnreadBadge.dock'
                                    defaultMessage='Show red badge on Dock icon to indicate unread messages'
                                />
                            )
                        ),
                        subLabel: (
                            window.process.platform === 'win32' ? (
                                <FormattedMessage
                                    id='renderer.components.settingsPage.showUnreadBadge.description.taskbar'
                                    defaultMessage='Regardless of this setting, mentions are always indicated with a red badge and item count on the taskbar icon.'
                                />
                            ) : (
                                <FormattedMessage
                                    id='renderer.components.settingsPage.showUnreadBadge.description.dock'
                                    defaultMessage='Regardless of this setting, mentions are always indicated with a red badge and item count on the Dock icon.'
                                />
                            )
                        ),
                    },
                },
                {
                    id: 'notifications',
                    component: NotificationSetting,
                },
            ],
        },
        language: {
            title: (
                <FormattedMessage
                    id='renderer.components.settingsPage.language'
                    defaultMessage='Language'
                />
            ),
            icon: 'globe',
            settings: [
                {
                    id: 'appLanguage',
                    component: SelectSetting,
                    props: {
                        label: (
                            <FormattedMessage
                                id='renderer.components.settingsPage.appLanguage'
                                defaultMessage='App Language'
                            />
                        ),
                        subLabel: (
                            <>
                                <FormattedMessage
                                    id='renderer.components.settingsPage.appLanguage.description'
                                    defaultMessage='The language that the Desktop App will use for menu items and popups. Still in beta, some languages will be missing translation strings.'
                                />
                                &nbsp;
                                <FormattedMessage
                                    id='renderer.components.settingsPage.afterRestart'
                                    defaultMessage='Setting takes effect after restarting the app.'
                                />
                            </>
                        ),
                        placeholder: (
                            <FormattedMessage
                                id='renderer.components.settingsPage.appLanguage.placeholder'
                                defaultMessage='Use system default'
                            />
                        ),
                        options: await getLanguages(window.desktop.getAvailableLanguages),
                    },
                },
                {
                    id: 'useSpellChecker',
                    component: SpellCheckerSetting,
                    props: {
                        heading: (
                            <h3>
                                <FormattedMessage
                                    id='renderer.components.settingsPage.spellChecker'
                                    defaultMessage='Spell Checker'
                                />
                            </h3>
                        ),
                        label: (
                            <FormattedMessage
                                id='renderer.components.settingsPage.checkSpelling'
                                defaultMessage='Check spelling'
                            />
                        ),
                        subLabel: (
                            <>
                                <FormattedMessage
                                    id='renderer.components.settingsPage.checkSpelling.description'
                                    defaultMessage='Highlight misspelled words in your messages based on your system language or language preference.'
                                />
                                &nbsp;
                                <FormattedMessage
                                    id='renderer.components.settingsPage.afterRestart'
                                    defaultMessage='Setting takes effect after restarting the app.'
                                />
                            </>
                        ),
                        options: await getLanguages(window.desktop.getAvailableSpellCheckerLanguages),
                    },
                },
            ],
        },
        servers: {
            title: (
                <FormattedMessage
                    id='renderer.components.settingsPage.servers'
                    defaultMessage='Servers'
                />
            ),
            icon: 'server-variant',
            settings: [
                {
                    id: 'teams',
                    component: ServerSetting,
                },
            ],
        },
        advanced: {
            title: (
                <FormattedMessage
                    id='renderer.components.settingsPage.advanced'
                    defaultMessage='Advanced'
                />
            ),
            icon: 'tune',
            settings: [
                {
                    id: 'logLevel',
                    component: SelectSetting,
                    props: {
                        label: (
                            <FormattedMessage
                                id='renderer.components.settingsPage.loggingLevel'
                                defaultMessage='Logging level'
                            />
                        ),
                        subLabel: (
                            <FormattedMessage
                                id='renderer.components.settingsPage.loggingLevel.description'
                                defaultMessage='Logging is helpful for developers and support to isolate issues you may be encountering with the desktop app.'
                            />
                        ),
                        bottomBorder: true,
                        options: [
                            {
                                value: 'error',
                                label: intl.formatMessage({
                                    id: 'renderer.components.settingsPage.loggingLevel.level.error',
                                    defaultMessage: 'Errors (error)',
                                }),
                            },
                            {
                                value: 'warn',
                                label: intl.formatMessage({
                                    id: 'renderer.components.settingsPage.loggingLevel.level.warn',
                                    defaultMessage: 'Errors and Warnings (warn)',
                                }),
                            },
                            {
                                value: 'info',
                                label: intl.formatMessage({
                                    id: 'renderer.components.settingsPage.loggingLevel.level.info',
                                    defaultMessage: 'Info (info)',
                                }),
                            },
                            {
                                value: 'verbose',
                                label: intl.formatMessage({
                                    id: 'renderer.components.settingsPage.loggingLevel.level.verbose',
                                    defaultMessage: 'Verbose (verbose)',
                                }),
                            },
                            {
                                value: 'debug',
                                label: intl.formatMessage({
                                    id: 'renderer.components.settingsPage.loggingLevel.level.debug',
                                    defaultMessage: 'Debug (debug)',
                                }),
                            },
                            {
                                value: 'silly',
                                label: intl.formatMessage({
                                    id: 'renderer.components.settingsPage.loggingLevel.level.silly',
                                    defaultMessage: 'Finest (silly)',
                                }),
                            },
                        ],
                    },
                },
                {
                    id: 'enableMetrics',
                    component: CheckSetting,
                    props: {
                        label: (
                            <FormattedMessage
                                id='renderer.components.settingsPage.enableMetrics'
                                defaultMessage='Send anonymous usage data to your configured servers'
                            />
                        ),
                        subLabel: (
                            <FormattedMessage
                                id='renderer.components.settingsPage.enableMetrics.description'
                                defaultMessage='Sends usage data about the application and its performance to your configured servers that accept it.'
                            />
                        ),
                    },
                },
                {
                    id: 'enableHardwareAcceleration',
                    component: CheckSetting,
                    props: {
                        label: (
                            <FormattedMessage
                                id='renderer.components.settingsPage.enableHardwareAcceleration'
                                defaultMessage='Use GPU hardware acceleration'
                            />
                        ),
                        subLabel: (
                            <>
                                <FormattedMessage
                                    id='renderer.components.settingsPage.enableHardwareAcceleration.description'
                                    defaultMessage='If enabled, {appName} UI is rendered more efficiently but can lead to decreased stability for some systems.'
                                    values={{appName: (await window.desktop.getVersion()).name}}
                                />
                                &nbsp;
                                <FormattedMessage
                                    id='renderer.components.settingsPage.afterRestart'
                                    defaultMessage='Setting takes effect after restarting the app.'
                                />
                            </>
                        ),
                    },
                },
            ],
        },
    };
};

export default definition;
