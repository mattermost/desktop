// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable max-lines */

import 'renderer/css/settings.css';

import React from 'react';
import {FormCheck, Col, FormGroup, FormText, Container, Row, Button, FormControl} from 'react-bootstrap';
import {FormattedMessage, injectIntl, IntlShape} from 'react-intl';
import ReactSelect, {ActionMeta, MultiValue} from 'react-select';

import {CombinedConfig, LocalConfiguration} from 'types/config';
import {SaveQueueItem} from 'types/settings';
import {DeepPartial} from 'types/utils';

import {localeTranslations} from 'common/utils/constants';

import {getAPI} from 'renderer/api';

import AutoSaveIndicator, {SavingState} from './AutoSaveIndicator';

const CONFIG_TYPE_UPDATES = 'updates';
const CONFIG_TYPE_APP_OPTIONS = 'appOptions';

type Props = {
    intl: IntlShape;
}

type State = DeepPartial<CombinedConfig> & {
    ready: boolean;
    maximized?: boolean;
    savingState: SavingStateItems;
    userOpenedDownloadDialog: boolean;
    allowSaveSpellCheckerURL: boolean;
    availableLanguages: Array<{label: string; value: string}>;
    availableSpellcheckerLanguages: Array<{label: string; value: string}>;
    canUpgrade?: boolean;
}

type SavingStateItems = {
    appOptions: SavingState;
    updates: SavingState;
}

class SettingsPage extends React.PureComponent<Props, State> {
    trayIconThemeRef: React.RefObject<HTMLDivElement>;
    downloadLocationRef: React.RefObject<HTMLInputElement>;
    showTrayIconRef: React.RefObject<HTMLInputElement>;
    autostartRef: React.RefObject<HTMLInputElement>;
    hideOnStartRef: React.RefObject<HTMLInputElement>;
    minimizeToTrayRef: React.RefObject<HTMLInputElement>;
    flashWindowRef: React.RefObject<HTMLInputElement>;
    bounceIconRef: React.RefObject<HTMLInputElement>;
    showUnreadBadgeRef: React.RefObject<HTMLInputElement>;
    useSpellCheckerRef: React.RefObject<HTMLInputElement>;
    spellCheckerURLRef: React.RefObject<HTMLInputElement>;
    enableHardwareAccelerationRef: React.RefObject<HTMLInputElement>;
    startInFullscreenRef: React.RefObject<HTMLInputElement>;
    autoCheckForUpdatesRef: React.RefObject<HTMLInputElement>;
    logLevelRef: React.RefObject<HTMLSelectElement>;
    appLanguageRef: React.RefObject<HTMLSelectElement>;

    saveQueue: SaveQueueItem[];

    selectedSpellCheckerLocales: Array<{label: string; value: string}>;

    savingIsDebounced: boolean;
    resetSaveStateIsDebounced: boolean;

    constructor(props: Props) {
        super(props);
        this.state = {
            ready: false,
            savingState: {
                appOptions: SavingState.SAVING_STATE_DONE,
                updates: SavingState.SAVING_STATE_DONE,
            },
            userOpenedDownloadDialog: false,
            allowSaveSpellCheckerURL: false,
            availableLanguages: [],
            availableSpellcheckerLanguages: [],
        };

        this.getConfig();
        this.trayIconThemeRef = React.createRef();
        this.downloadLocationRef = React.createRef();
        this.showTrayIconRef = React.createRef();
        this.autostartRef = React.createRef();
        this.hideOnStartRef = React.createRef();
        this.minimizeToTrayRef = React.createRef();
        this.flashWindowRef = React.createRef();
        this.bounceIconRef = React.createRef();
        this.showUnreadBadgeRef = React.createRef();
        this.useSpellCheckerRef = React.createRef();
        this.enableHardwareAccelerationRef = React.createRef();
        this.startInFullscreenRef = React.createRef();
        this.spellCheckerURLRef = React.createRef();
        this.autoCheckForUpdatesRef = React.createRef();
        this.logLevelRef = React.createRef();
        this.appLanguageRef = React.createRef();

        this.saveQueue = [];
        this.selectedSpellCheckerLocales = [];

        this.savingIsDebounced = false;
        this.resetSaveStateIsDebounced = false;
    }

    componentDidMount() {
        getAPI().onReloadConfiguration(() => {
            this.updateSaveState();
            this.getConfig();
        });

        getAPI().getAvailableSpellCheckerLanguages().then((languages: string[]) => {
            const availableSpellcheckerLanguages = languages.filter((language) => localeTranslations[language]).map((language) => ({label: localeTranslations[language], value: language}));
            availableSpellcheckerLanguages.sort((a, b) => a.label.localeCompare(b.label));
            this.setState({availableSpellcheckerLanguages});
        });

        getAPI().getAvailableLanguages().then((languages: string[]) => {
            const availableLanguages = languages.filter((language) => localeTranslations[language]).map((language) => ({label: localeTranslations[language], value: language}));
            availableLanguages.sort((a, b) => a.label.localeCompare(b.label));
            this.setState({availableLanguages});
        });
    }

    getConfig = () => {
        getAPI().getLocalConfiguration().then((config) => {
            this.setState({ready: true, maximized: false, ...this.convertConfigDataToState(config as Partial<LocalConfiguration>, this.state) as Omit<State, 'ready'>});
        });
    }

    convertConfigDataToState = (configData: Partial<LocalConfiguration>, currentState: Partial<State> = {}) => {
        const newState = Object.assign({} as State, configData);
        newState.savingState = currentState.savingState || {
            appOptions: SavingState.SAVING_STATE_DONE,
            updates: SavingState.SAVING_STATE_DONE,
        };
        this.selectedSpellCheckerLocales = configData.spellCheckerLocales?.map((language: string) => ({label: localeTranslations[language] || language, value: language})) || [];
        return newState;
    }

    saveSetting = (configType: 'updates' | 'appOptions', {key, data}: {key: keyof CombinedConfig; data: CombinedConfig[keyof CombinedConfig]}) => {
        this.saveQueue.push({
            configType,
            key,
            data,
        });
        this.updateSaveState();
        this.processSaveQueue();
    }

    processSaveQueue = () => {
        if (this.savingIsDebounced) {
            return;
        }

        this.savingIsDebounced = true;
        setTimeout(() => {
            this.savingIsDebounced = false;
            getAPI().updateConfiguration(this.saveQueue.splice(0, this.saveQueue.length));
        }, 500);
    }

    updateSaveState = () => {
        let queuedUpdateCounts = {
            [CONFIG_TYPE_UPDATES]: 0,
            [CONFIG_TYPE_APP_OPTIONS]: 0,
        };

        queuedUpdateCounts = this.saveQueue.reduce((updateCounts, {configType}) => {
            updateCounts[configType]++;
            return updateCounts;
        }, queuedUpdateCounts);

        const savingState = Object.assign({}, this.state.savingState);

        Object.entries(queuedUpdateCounts).forEach(([configType, count]) => {
            if (count > 0) {
                savingState[configType as keyof SavingStateItems] = SavingState.SAVING_STATE_SAVING;
            } else if (count === 0 && savingState[configType as keyof SavingStateItems] === SavingState.SAVING_STATE_SAVING) {
                savingState[configType as keyof SavingStateItems] = SavingState.SAVING_STATE_SAVED;
                this.resetSaveState(configType as keyof SavingStateItems);
            }
        });

        this.setState({savingState});
    }

    resetSaveState = (configType: keyof SavingStateItems) => {
        if (this.resetSaveStateIsDebounced) {
            return;
        }
        this.resetSaveStateIsDebounced = true;
        setTimeout(() => {
            this.resetSaveStateIsDebounced = false;
            if (this.state.savingState[configType] !== SavingState.SAVING_STATE_SAVING) {
                const savingState = Object.assign({}, this.state.savingState);
                savingState[configType] = SavingState.SAVING_STATE_DONE;
                this.setState({savingState});
            }
        }, 2000);
    }

    handleChangeShowTrayIcon = () => {
        const shouldShowTrayIcon = this.showTrayIconRef.current?.checked;
        window.timers.setImmediate(this.saveSetting, CONFIG_TYPE_APP_OPTIONS, {key: 'showTrayIcon', data: shouldShowTrayIcon});
        this.setState({
            showTrayIcon: shouldShowTrayIcon,
        });

        if (window.process.platform === 'darwin' && !shouldShowTrayIcon) {
            this.setState({
                minimizeToTray: false,
            });
        }
    }

    handleChangeTrayIconTheme = (theme: string) => {
        window.timers.setImmediate(this.saveSetting, CONFIG_TYPE_APP_OPTIONS, {key: 'trayIconTheme', data: theme});
        this.setState({
            trayIconTheme: theme,
        });
    }

    handleChangeAutoStart = () => {
        window.timers.setImmediate(this.saveSetting, CONFIG_TYPE_APP_OPTIONS, {key: 'autostart', data: this.autostartRef.current?.checked});
        this.setState({
            autostart: this.autostartRef.current?.checked,
        });
    }

    handleChangeHideOnStart = () => {
        window.timers.setImmediate(this.saveSetting, CONFIG_TYPE_APP_OPTIONS, {key: 'hideOnStart', data: this.hideOnStartRef.current?.checked});
        this.setState({
            hideOnStart: this.hideOnStartRef.current?.checked,
        });
    }

    handleChangeMinimizeToTray = () => {
        const shouldMinimizeToTray = (process.platform === 'win32' || this.state.showTrayIcon) && this.minimizeToTrayRef.current?.checked;

        window.timers.setImmediate(this.saveSetting, CONFIG_TYPE_APP_OPTIONS, {key: 'minimizeToTray', data: shouldMinimizeToTray});
        this.setState({
            minimizeToTray: shouldMinimizeToTray,
        });
    }

    handleFlashWindow = () => {
        window.timers.setImmediate(this.saveSetting, CONFIG_TYPE_APP_OPTIONS, {
            key: 'notifications',
            data: {
                ...this.state.notifications,
                flashWindow: this.flashWindowRef.current?.checked ? 2 : 0,
            },
        });
        this.setState({
            notifications: {
                ...this.state.notifications,
                flashWindow: this.flashWindowRef.current?.checked ? 2 : 0,
            },
        });
    }

    handleBounceIcon = () => {
        window.timers.setImmediate(this.saveSetting, CONFIG_TYPE_APP_OPTIONS, {
            key: 'notifications',
            data: {
                ...this.state.notifications,
                bounceIcon: this.bounceIconRef.current?.checked,
            },
        });
        this.setState({
            notifications: {
                ...this.state.notifications,
                bounceIcon: this.bounceIconRef.current?.checked,
            },
        });
    }

    handleBounceIconType = (event: React.ChangeEvent<HTMLInputElement>) => {
        window.timers.setImmediate(this.saveSetting, CONFIG_TYPE_APP_OPTIONS, {
            key: 'notifications',
            data: {
                ...this.state.notifications,
                bounceIconType: event.target.value,
            },
        });
        this.setState({
            notifications: {
                ...this.state.notifications,
                bounceIconType: event.target.value as 'critical' | 'informational',
            },
        });
    }

    handleShowUnreadBadge = () => {
        window.timers.setImmediate(this.saveSetting, CONFIG_TYPE_APP_OPTIONS, {key: 'showUnreadBadge', data: this.showUnreadBadgeRef.current?.checked});
        this.setState({
            showUnreadBadge: this.showUnreadBadgeRef.current?.checked,
        });
    }

    handleChangeUseSpellChecker = () => {
        window.timers.setImmediate(this.saveSetting, CONFIG_TYPE_APP_OPTIONS, {key: 'useSpellChecker', data: this.useSpellCheckerRef.current?.checked});
        this.setState({
            useSpellChecker: this.useSpellCheckerRef.current?.checked,
        });
    }

    handleChangeLogLevel = () => {
        window.timers.setImmediate(this.saveSetting, CONFIG_TYPE_APP_OPTIONS, {key: 'logLevel', data: this.logLevelRef.current?.value});
        this.setState({
            logLevel: this.logLevelRef.current?.value,
        });
    }

    handleChangeAppLanguage = () => {
        window.timers.setImmediate(this.saveSetting, CONFIG_TYPE_APP_OPTIONS, {key: 'appLanguage', data: this.appLanguageRef.current?.value});
        this.setState({
            appLanguage: this.appLanguageRef.current?.value,
        });
    }

    handleChangeAutoCheckForUpdates = () => {
        window.timers.setImmediate(this.saveSetting, CONFIG_TYPE_UPDATES, {key: 'autoCheckForUpdates', data: this.autoCheckForUpdatesRef.current?.checked});
        this.setState({
            autoCheckForUpdates: this.autoCheckForUpdatesRef.current?.checked,
        }, () => {
            if (this.state.autoCheckForUpdates) {
                this.checkForUpdates();
            }
        });
    }

    checkForUpdates = () => {
        getAPI().checkForUpdates();
    }

    handleChangeSpellCheckerLocales = (value: MultiValue<{label: string; value: string}>, actionMeta: ActionMeta<{label: string; value: string}>) => {
        switch (actionMeta.action) {
        case 'select-option':
            this.selectedSpellCheckerLocales = [...value];
            break;
        case 'remove-value':
            this.selectedSpellCheckerLocales = this.selectedSpellCheckerLocales.filter((language) => language.value !== actionMeta.removedValue.value);
        }

        const values = this.selectedSpellCheckerLocales.map((language) => language.value);
        window.timers.setImmediate(this.saveSetting, CONFIG_TYPE_APP_OPTIONS, {key: 'spellCheckerLocales', data: values});
        this.setState({
            spellCheckerLocales: values,
        });
    }

    handleChangeEnableHardwareAcceleration = () => {
        window.timers.setImmediate(this.saveSetting, CONFIG_TYPE_APP_OPTIONS, {key: 'enableHardwareAcceleration', data: this.enableHardwareAccelerationRef.current?.checked});
        this.setState({
            enableHardwareAcceleration: this.enableHardwareAccelerationRef.current?.checked,
        });
    }

    handleChangeStartInFullscreen = () => {
        window.timers.setImmediate(this.saveSetting, CONFIG_TYPE_APP_OPTIONS, {key: 'startInFullscreen', data: this.startInFullscreenRef.current?.checked});
        this.setState({
            startInFullscreen: this.startInFullscreenRef.current?.checked,
        });
    }

    saveDownloadLocation = (location: string) => {
        if (!location) {
            return;
        }
        this.setState({
            downloadLocation: location,
        });
        window.timers.setImmediate(this.saveSetting, CONFIG_TYPE_APP_OPTIONS, {key: 'downloadLocation', data: location});
    }

    handleChangeDownloadLocation = (e: React.ChangeEvent<HTMLInputElement>) => {
        this.saveDownloadLocation(e.target.value);
    }

    selectDownloadLocation = () => {
        if (!this.state.userOpenedDownloadDialog) {
            getAPI().getDownloadLocation(this.state.downloadLocation).then((result) => this.saveDownloadLocation(result));
            this.setState({userOpenedDownloadDialog: true});
        }
        this.setState({userOpenedDownloadDialog: false});
    }

    saveSpellCheckerURL = (): void => {
        window.timers.setImmediate(this.saveSetting, CONFIG_TYPE_APP_OPTIONS, {key: 'spellCheckerURL', data: this.state.spellCheckerURL});
    }

    resetSpellCheckerURL = (): void => {
        this.setState({spellCheckerURL: undefined, allowSaveSpellCheckerURL: false});
        window.timers.setImmediate(this.saveSetting, CONFIG_TYPE_APP_OPTIONS, {key: 'spellCheckerURL', data: null});
    }

    handleChangeSpellCheckerURL= (e: React.ChangeEvent<HTMLInputElement>): void => {
        const dictionaryURL = e.target.value;
        let allowSaveSpellCheckerURL;
        try {
            // eslint-disable-next-line no-new
            new URL(dictionaryURL);
            allowSaveSpellCheckerURL = true;
        } catch {
            allowSaveSpellCheckerURL = false;
        }
        this.setState({
            spellCheckerURL: dictionaryURL,
            allowSaveSpellCheckerURL,
        });
    }

    handleDoubleClick = () => {
        getAPI().doubleClickOnWindow('settings');
    }

    render() {
        const {intl} = this.props;

        const settingsPage = {
            close: {
                textDecoration: 'none',
                position: 'absolute',
                right: '0',
                top: '5px',
                fontSize: '35px',
                fontWeight: 'normal',
                color: '#bbb',
            },
            heading: {
                textAlign: 'center' as const,
                fontSize: '24px',
                margin: '0',
                padding: '1em 0',
            },
            sectionHeading: {
                fontSize: '20px',
                margin: '0',
                padding: '1em 0',
                display: 'inline-block',
            },
            sectionHeadingLink: {
                marginTop: '24px',
                display: 'inline-block',
                fontSize: '15px',
            },
            footer: {
                padding: '0.4em 0',
            },
            downloadLocationInput: {
                marginRight: '3px',
                marginTop: '8px',
                width: '320px',
                height: '34px',
                padding: '0 12px',
                borderRadius: '4px',
                border: '1px solid #ccc',
                fontWeight: 500,
            },

            downloadLocationButton: {
                marginBottom: '4px',
            },

            logLevelInput: {
                marginRight: '3px',
                marginTop: '8px',
                width: '320px',
                height: '34px',
                padding: '0 12px',
                borderRadius: '4px',
                border: '1px solid #ccc',
                fontWeight: 500,
            },

            appLanguageInput: {
                marginRight: '3px',
                marginTop: '8px',
                width: '320px',
                height: '34px',
                padding: '0 12px',
                borderRadius: '4px',
                border: '1px solid #ccc',
                fontWeight: 500,
            },

            container: {
                paddingBottom: '40px',
            },

            checkForUpdatesButton: {
                marginBottom: '4px',
                marginLeft: '16px',
                marginTop: '8px',
            },
        };

        const options = [];

        // MacOS has an option in the Dock, to set the app to autostart, so we choose to not support this option for OSX
        if (window.process.platform === 'win32' || window.process.platform === 'linux') {
            options.push(
                <FormCheck>
                    <FormCheck.Input
                        type='checkbox'
                        key='inputAutoStart'
                        id='inputAutoStart'
                        ref={this.autostartRef}
                        checked={this.state.autostart}
                        onChange={this.handleChangeAutoStart}
                    />
                    <FormattedMessage
                        id='renderer.components.settingsPage.startAppOnLogin'
                        defaultMessage='Start app on login'
                    />
                    <FormText>
                        <FormattedMessage
                            id='renderer.components.settingsPage.startAppOnLogin.description'
                            defaultMessage='If enabled, the app starts automatically when you log in to your machine.'
                        />
                    </FormText>
                </FormCheck>);

            options.push(
                <FormCheck>
                    <FormCheck.Input
                        type='checkbox'
                        key='inputHideOnStart'
                        id='inputHideOnStart'
                        ref={this.hideOnStartRef}
                        checked={this.state.hideOnStart}
                        onChange={this.handleChangeHideOnStart}
                    />
                    <FormattedMessage
                        id='renderer.components.settingsPage.launchAppMinimized'
                        defaultMessage='Launch app minimized'
                    />
                    <FormText>
                        <FormattedMessage
                            id='renderer.components.settingsPage.launchAppMinimized.description'
                            defaultMessage='If enabled, the app will start in system tray, and will not show the window on launch.'
                        />
                    </FormText>
                </FormCheck>);
        }

        options.push(
            <>
                <FormCheck>
                    <FormCheck.Input
                        type='checkbox'
                        key='inputSpellChecker'
                        id='inputSpellChecker'
                        ref={this.useSpellCheckerRef}
                        checked={this.state.useSpellChecker}
                        onChange={this.handleChangeUseSpellChecker}
                    />
                    <FormattedMessage
                        id='renderer.components.settingsPage.checkSpelling'
                        defaultMessage='Check spelling'
                    />
                    <FormText>
                        <FormattedMessage
                            id='renderer.components.settingsPage.checkSpelling.description'
                            defaultMessage='Highlight misspelled words in your messages based on your system language or language preference.'
                        />
                        {' '}
                        <FormattedMessage
                            id='renderer.components.settingsPage.afterRestart'
                            defaultMessage='Setting takes effect after restarting the app.'
                        />
                    </FormText>
                </FormCheck>
                {this.state.useSpellChecker &&
                    <ReactSelect
                        inputId='inputSpellCheckerLocalesDropdown'
                        className='SettingsPage__spellCheckerLocalesDropdown'
                        classNamePrefix='SettingsPage__spellCheckerLocalesDropdown'
                        options={this.state.availableSpellcheckerLanguages}
                        isMulti={true}
                        isClearable={false}
                        onChange={this.handleChangeSpellCheckerLocales}
                        value={this.selectedSpellCheckerLocales}
                        placeholder={
                            <FormattedMessage
                                id='renderer.components.settingsPage.checkSpelling.preferredLanguages'
                                defaultMessage='Select preferred language(s)'
                            />
                        }
                    />
                }
            </>,
        );
        if (process.platform !== 'darwin') {
            if (this.state.spellCheckerURL === null || typeof this.state.spellCheckerURL === 'undefined') {
                options.push(
                    <Button
                        id='editSpellcheckerURL'
                        key='editSpellcheckerURL'
                        onClick={() => this.setState({spellCheckerURL: '', allowSaveSpellCheckerURL: false})}
                        variant='link'
                    >
                        <FormattedMessage
                            id='renderer.components.settingsPage.checkSpelling.editSpellcheckUrl'
                            defaultMessage='Use an alternative dictionary URL'
                        />
                    </Button>,
                );
            } else {
                options.push(
                    <div
                        style={settingsPage.container}
                        key='containerInputSpellcheckerURL'
                    >
                        <input
                            disabled={!this.state.useSpellChecker}
                            style={settingsPage.downloadLocationInput}
                            key='inputSpellCheckerURL'
                            id='inputSpellCheckerURL'
                            ref={this.spellCheckerURLRef}
                            onChange={this.handleChangeSpellCheckerURL}
                            value={this.state.spellCheckerURL}
                        />
                        <Button
                            disabled={!this.state.allowSaveSpellCheckerURL}
                            key='saveSpellCheckerURL'
                            style={settingsPage.downloadLocationButton}
                            id='saveSpellCheckerURL'
                            onClick={this.saveSpellCheckerURL}
                        >
                            <FormattedMessage
                                id='label.save'
                                defaultMessage='Save'
                            />
                        </Button>
                        <FormText>
                            <FormattedMessage
                                id='renderer.components.settingsPage.checkSpelling.specifyURL'
                                defaultMessage='Specify the url where dictionary definitions can be retrieved'
                            />
                        </FormText>
                        <Button
                            id='revertSpellcheckerURL'
                            key='revertSpellcheckerURL'
                            onClick={this.resetSpellCheckerURL}
                            variant='link'
                        >
                            <FormattedMessage
                                id='renderer.components.settingsPage.checkSpelling.revertToDefault'
                                defaultMessage='Revert to default'
                            />
                        </Button>
                    </div>);
            }
        }
        if (window.process.platform === 'darwin' || window.process.platform === 'win32') {
            const taskbar = window.process.platform === 'win32' ? 'taskbar' : 'Dock';
            options.push(
                <FormCheck
                    key='showunreadbadge'
                >
                    <FormCheck.Input
                        type='checkbox'
                        key='inputShowUnreadBadge'
                        id='inputShowUnreadBadge'
                        ref={this.showUnreadBadgeRef}
                        checked={this.state.showUnreadBadge}
                        onChange={this.handleShowUnreadBadge}
                    />
                    <FormattedMessage
                        id='renderer.components.settingsPage.showUnreadBadge'
                        defaultMessage='Show red badge on {taskbar} icon to indicate unread messages'
                        values={{taskbar}}
                    />
                    <FormText>
                        <FormattedMessage
                            id='renderer.components.settingsPage.showUnreadBadge.description'
                            defaultMessage='Regardless of this setting, mentions are always indicated with a red badge and item count on the {taskbar} icon.'
                            values={{taskbar}}
                        />
                    </FormText>
                </FormCheck>);
        }

        if (window.process.platform === 'win32' || window.process.platform === 'linux') {
            options.push(
                <FormCheck>
                    <FormCheck.Input
                        type='checkbox'
                        key='flashWindow'
                        id='inputflashWindow'
                        ref={this.flashWindowRef}
                        checked={!this.state.notifications || this.state.notifications.flashWindow === 2}
                        onChange={this.handleFlashWindow}
                    />
                    <FormattedMessage
                        id='renderer.components.settingsPage.flashWindow'
                        defaultMessage='Flash taskbar icon when a new message is received'
                    />
                    <FormText>
                        <FormattedMessage
                            id='renderer.components.settingsPage.flashWindow.description'
                            defaultMessage='If enabled, the taskbar icon will flash for a few seconds when a new message is received.'
                        />
                        {window.process.platform === 'linux' && (
                            <>
                                <br/>
                                <em>
                                    <strong>
                                        <FormattedMessage
                                            id='renderer.components.settingsPage.flashWindow.description.note'
                                            defaultMessage='NOTE: '
                                        />
                                    </strong>
                                    <FormattedMessage
                                        id='renderer.components.settingsPage.flashWindow.description.linuxFunctionality'
                                        defaultMessage='This functionality may not work with all Linux window managers.'
                                    />
                                </em>
                            </>
                        )}
                    </FormText>
                </FormCheck>);
        }

        if (window.process.platform === 'darwin') {
            options.push(
                <FormGroup
                    key='OptionsForm'
                >
                    <FormCheck
                        type='checkbox'
                        inline={true}
                        key='bounceIcon'
                        id='inputBounceIcon'
                        ref={this.bounceIconRef}
                        checked={this.state.notifications ? this.state.notifications.bounceIcon : false}
                        onChange={this.handleBounceIcon}
                        style={{marginRight: '10px'}}
                        label={
                            <FormattedMessage
                                id='renderer.components.settingsPage.bounceIcon'
                                defaultMessage='Bounce the Dock icon'
                            />
                        }
                    />
                    <FormCheck
                        type='radio'
                        inline={true}
                        name='bounceIconType'
                        value='informational'
                        disabled={!this.state.notifications || !this.state.notifications.bounceIcon}
                        defaultChecked={
                            !this.state.notifications ||
                !this.state.notifications.bounceIconType ||
                this.state.notifications.bounceIconType === 'informational'
                        }
                        onChange={this.handleBounceIconType}
                        label={
                            <FormattedMessage
                                id='renderer.components.settingsPage.bounceIcon.once'
                                defaultMessage='once'
                            />
                        }
                    />
                    {' '}
                    <FormCheck
                        type='radio'
                        inline={true}
                        name='bounceIconType'
                        value='critical'
                        disabled={!this.state.notifications || !this.state.notifications.bounceIcon}
                        defaultChecked={this.state.notifications && this.state.notifications.bounceIconType === 'critical'}
                        onChange={this.handleBounceIconType}
                        label={
                            <FormattedMessage
                                id='renderer.components.settingsPage.bounceIcon.untilOpenApp'
                                defaultMessage='until I open the app'
                            />
                        }
                    />
                    <FormText
                        style={{marginLeft: '20px'}}
                    >
                        <FormattedMessage
                            id='renderer.components.settingsPage.bounceIcon.description'
                            defaultMessage='If enabled, the Dock icon bounces once or until the user opens the app when a new notification is received.'
                        />
                    </FormText>
                </FormGroup>,
            );
        }

        if (window.process.platform === 'darwin' || window.process.platform === 'linux') {
            options.push(
                <FormCheck
                    key='inputShowTrayIcon'
                >
                    <FormCheck.Input
                        type='checkbox'
                        id='inputShowTrayIcon'
                        ref={this.showTrayIconRef}
                        checked={this.state.showTrayIcon}
                        onChange={this.handleChangeShowTrayIcon}
                    />
                    {window.process.platform === 'darwin' ?
                        <FormattedMessage
                            id='renderer.components.settingsPage.trayIcon.show.darwin'
                            defaultMessage='Show {appName} icon in the menu bar'
                            values={{appName: this.state.appName}}
                        /> :
                        <FormattedMessage
                            id='renderer.components.settingsPage.trayIcon.show'
                            defaultMessage='Show icon in the notification area'
                        />
                    }
                    <FormText>
                        <FormattedMessage
                            id='renderer.components.settingsPage.afterRestart'
                            defaultMessage='Setting takes effect after restarting the app.'
                        />
                    </FormText>
                </FormCheck>);
        }

        if (this.state.showTrayIcon) {
            if (window.process.platform === 'linux' || window.process.platform === 'win32') {
                options.push(
                    <FormGroup
                        key='trayIconTheme'
                        ref={this.trayIconThemeRef}
                        style={{marginLeft: '20px'}}
                    >
                        <FormattedMessage
                            id='renderer.components.settingsPage.trayIcon.color'
                            defaultMessage='Icon color: '
                        />
                        {window.process.platform === 'win32' &&
                            <>
                                <FormCheck
                                    type='radio'
                                    inline={true}
                                    name='trayIconTheme'
                                    value='use_system'
                                    defaultChecked={this.state.trayIconTheme === 'use_system' || !this.state.trayIconTheme}
                                    onChange={() => this.handleChangeTrayIconTheme('use_system')}
                                    label={
                                        <FormattedMessage
                                            id='renderer.components.settingsPage.trayIcon.theme.systemDefault'
                                            defaultMessage='Use system default'
                                        />
                                    }
                                />
                                {' '}
                            </>
                        }
                        <FormCheck
                            type='radio'
                            inline={true}
                            name='trayIconTheme'
                            value='light'
                            defaultChecked={this.state.trayIconTheme === 'light' || !this.state.trayIconTheme}
                            onChange={() => this.handleChangeTrayIconTheme('light')}
                            label={
                                <FormattedMessage
                                    id='renderer.components.settingsPage.trayIcon.theme.light'
                                    defaultMessage='Light'
                                />
                            }
                        />
                        {' '}
                        <FormCheck
                            type='radio'
                            inline={true}
                            name='trayIconTheme'
                            value='dark'
                            defaultChecked={this.state.trayIconTheme === 'dark'}
                            onChange={() => this.handleChangeTrayIconTheme('dark')}
                            label={
                                <FormattedMessage
                                    id='renderer.components.settingsPage.trayIcon.theme.dark'
                                    defaultMessage='Dark'
                                />
                            }
                        />
                    </FormGroup>,
                );
            }
        }

        if (window.process.platform === 'linux' || window.process.platform === 'win32') {
            options.push(
                <FormCheck
                    key='inputMinimizeToTray'
                >
                    <FormCheck.Input
                        type='checkbox'
                        id='inputMinimizeToTray'
                        ref={this.minimizeToTrayRef}
                        disabled={process.platform !== 'win32' && !this.state.showTrayIcon}
                        checked={this.state.minimizeToTray}
                        onChange={this.handleChangeMinimizeToTray}
                    />
                    <FormattedMessage
                        id='renderer.components.settingsPage.minimizeToTray'
                        defaultMessage='Leave app running in notification area when application window is closed'
                    />
                    <FormText>
                        <FormattedMessage
                            id='renderer.components.settingsPage.minimizeToTray.description'
                            defaultMessage='If enabled, the app stays running in the notification area after app window is closed.'
                        />
                        {this.state.showTrayIcon &&
                            <>
                                {' '}
                                <FormattedMessage
                                    id='renderer.components.settingsPage.afterRestart'
                                    defaultMessage='Setting takes effect after restarting the app.'
                                />
                            </>
                        }
                    </FormText>
                </FormCheck>);
        }

        options.push(
            <FormCheck
                key='inputEnableHardwareAcceleration'
            >
                <FormCheck.Input
                    type='checkbox'
                    id='inputEnableHardwareAcceleration'
                    ref={this.enableHardwareAccelerationRef}
                    checked={this.state.enableHardwareAcceleration}
                    onChange={this.handleChangeEnableHardwareAcceleration}
                />
                <FormattedMessage
                    id='renderer.components.settingsPage.enableHardwareAcceleration'
                    defaultMessage='Use GPU hardware acceleration'
                />
                <FormText>
                    <FormattedMessage
                        id='renderer.components.settingsPage.enableHardwareAcceleration.description'
                        defaultMessage='If enabled, Mattermost UI is rendered more efficiently but can lead to decreased stability for some systems.'
                    />
                    {' '}
                    <FormattedMessage
                        id='renderer.components.settingsPage.afterRestart'
                        defaultMessage='Setting takes effect after restarting the app.'
                    />
                </FormText>
            </FormCheck>,
        );

        options.push(
            <FormCheck
                key='inputStartInFullScreen'
            >
                <FormCheck.Input
                    type='checkbox'
                    id='inputStartInFullScreen'
                    ref={this.startInFullscreenRef}
                    checked={this.state.startInFullscreen}
                    onChange={this.handleChangeStartInFullscreen}
                />
                <FormattedMessage
                    id='renderer.components.settingsPage.fullscreen'
                    defaultMessage='Open app in fullscreen'
                />
                <FormText>
                    <FormattedMessage
                        id='renderer.components.settingsPage.fullscreen.description'
                        defaultMessage='If enabled, the Mattermost application will always open in full screen'
                    />
                </FormText>
            </FormCheck>,
        );

        options.push(
            <div
                style={settingsPage.container}
                key='containerDownloadLocation'
            >
                <hr/>
                <FormattedMessage
                    id='renderer.components.settingsPage.appLanguage'
                    defaultMessage='Set app language (beta)'
                />
                <FormControl
                    style={settingsPage.appLanguageInput}
                    as='select'
                    id='inputAppLanguage'
                    ref={this.appLanguageRef}
                    value={this.state.appLanguage}
                    onChange={this.handleChangeAppLanguage}
                >
                    <option value=''>
                        {intl.formatMessage({id: 'renderer.components.settingsPage.appLanguage.useSystemDefault', defaultMessage: 'Use system default'})}
                    </option>
                    {this.state.availableLanguages.map((language) => {
                        return (
                            <option
                                key={language.value}
                                value={language.value}
                            >
                                {language.label}
                            </option>
                        );
                    })}
                </FormControl>
                <FormText>
                    <FormattedMessage
                        id='renderer.components.settingsPage.appLanguage.description'
                        defaultMessage='Chooses the language that the Desktop App will use for menu items and popups. Still in beta, some languages will be missing translation strings.'
                    />
                    <br/>
                    <FormattedMessage
                        id='renderer.components.settingsPage.afterRestart'
                        defaultMessage='Setting takes effect after restarting the app.'
                    />
                </FormText>
                <br/>
                <div>
                    <FormattedMessage
                        id='renderer.components.settingsPage.downloadLocation'
                        defaultMessage='Download Location'
                    />
                </div>
                <input
                    disabled={true}
                    style={settingsPage.downloadLocationInput}
                    key='inputDownloadLocation'
                    id='inputDownloadLocation'
                    ref={this.downloadLocationRef}
                    onChange={this.handleChangeDownloadLocation}
                    value={this.state.downloadLocation}
                />
                <Button
                    style={settingsPage.downloadLocationButton}
                    id='saveDownloadLocation'
                    onClick={this.selectDownloadLocation}
                >
                    <FormattedMessage
                        id='label.change'
                        defaultMessage='Change'
                    />
                </Button>
                <FormText>
                    <FormattedMessage
                        id='renderer.components.settingsPage.downloadLocation.description'
                        defaultMessage='Specify the folder where files will download.'
                    />
                </FormText>
                <br/>
                <FormattedMessage
                    id='renderer.components.settingsPage.loggingLevel'
                    defaultMessage='Logging level'
                />
                <FormControl
                    style={settingsPage.logLevelInput}
                    as='select'
                    id='inputLogLevel'
                    ref={this.logLevelRef}
                    value={this.state.logLevel}
                    onChange={this.handleChangeLogLevel}
                >
                    <option value='error'>
                        {intl.formatMessage({id: 'renderer.components.settingsPage.loggingLevel.level.error', defaultMessage: 'Errors (error)'})}
                    </option>
                    <option value='warn'>
                        {intl.formatMessage({id: 'renderer.components.settingsPage.loggingLevel.level.warn', defaultMessage: 'Errors and Warnings (warn)'})}
                    </option>
                    <option value='info'>
                        {intl.formatMessage({id: 'renderer.components.settingsPage.loggingLevel.level.info', defaultMessage: 'Info (info)'})}
                    </option>
                    <option value='verbose'>
                        {intl.formatMessage({id: 'renderer.components.settingsPage.loggingLevel.level.verbose', defaultMessage: 'Verbose (verbose)'})}
                    </option>
                    <option value='debug'>
                        {intl.formatMessage({id: 'renderer.components.settingsPage.loggingLevel.level.debug', defaultMessage: 'Debug (debug)'})}
                    </option>
                    <option value='silly'>
                        {intl.formatMessage({id: 'renderer.components.settingsPage.loggingLevel.level.silly', defaultMessage: 'Finest (silly)'})}
                    </option>
                </FormControl>
                <FormText>
                    <FormattedMessage
                        id='renderer.components.settingsPage.loggingLevel.description'
                        defaultMessage='Logging is helpful for developers and support to isolate issues you may be encountering with the desktop app.'
                    />
                    <br/>
                    <FormattedMessage
                        id='renderer.components.settingsPage.loggingLevel.description.subtitle'
                        defaultMessage='Increasing the log level increases disk space usage and can impact performance. We recommend only increasing the log level if you are having issues.'
                    />
                </FormText>
            </div>,
        );

        let optionsRow = null;
        if (options.length > 0) {
            optionsRow = (
                <Row>
                    <Col md={12}>
                        <h2 style={settingsPage.sectionHeading}>
                            <FormattedMessage
                                id='renderer.components.settingsPage.appOptions'
                                defaultMessage='App Options'
                            />
                        </h2>
                        <div className='IndicatorContainer appOptionsSaveIndicator'>
                            <AutoSaveIndicator
                                id='appOptionsSaveIndicator'
                                savingState={this.state.savingState.appOptions}
                                errorMessage={
                                    <FormattedMessage
                                        id='renderer.components.settingsPage.saving.error'
                                        defaultMessage={'Can\'t save your changes. Please try again.'}
                                    />
                                }
                            />
                        </div>
                        { options.map((opt) => (
                            <FormGroup key={opt.key}>
                                {opt}
                            </FormGroup>
                        )) }
                    </Col>
                </Row>
            );
        }

        let updateRow = null;
        if (this.state.canUpgrade) {
            updateRow = (
                <>
                    <Row>
                        <Col md={12}>
                            <h2 style={settingsPage.sectionHeading}>
                                <FormattedMessage
                                    id='renderer.components.settingsPage.updates'
                                    defaultMessage='Updates'
                                />
                            </h2>
                            <div className='IndicatorContainer updatesSaveIndicator'>
                                <AutoSaveIndicator
                                    id='updatesSaveIndicator'
                                    savingState={this.state.savingState.updates}
                                    errorMessage={
                                        <FormattedMessage
                                            id='renderer.components.settingsPage.saving.error'
                                            defaultMessage={'Can\'t save your changes. Please try again.'}
                                        />
                                    }
                                />
                            </div>
                            <FormGroup
                                key='inputAutoCheckForUpdates'
                            >
                                <FormCheck>
                                    <FormCheck.Input
                                        type='checkbox'
                                        key='inputAutoCheckForUpdates'
                                        id='inputAutoCheckForUpdates'
                                        ref={this.autoCheckForUpdatesRef}
                                        checked={this.state.autoCheckForUpdates}
                                        onChange={this.handleChangeAutoCheckForUpdates}
                                    />
                                    <FormattedMessage
                                        id='renderer.components.settingsPage.updates.automatic'
                                        defaultMessage='Automatically check for updates'
                                    />
                                    <FormText>
                                        <FormattedMessage
                                            id='renderer.components.settingsPage.updates.automatic.description'
                                            defaultMessage='If enabled, updates to the Desktop App will download automatically and you will be notified when ready to install.'
                                        />
                                    </FormText>
                                </FormCheck>
                                <Button
                                    style={settingsPage.checkForUpdatesButton}
                                    id='checkForUpdatesNow'
                                    onClick={this.checkForUpdates}
                                >
                                    <FormattedMessage
                                        id='renderer.components.settingsPage.updates.checkNow'
                                        defaultMessage='Check for Updates Now'
                                    />
                                </Button>
                            </FormGroup>
                        </Col>
                    </Row>
                    <hr/>
                </>
            );
        }

        let waitForIpc;
        if (this.state.ready) {
            waitForIpc = (
                <>
                    {updateRow}
                    {optionsRow}
                </>
            );
        } else {
            waitForIpc = (
                <p>
                    <FormattedMessage
                        id='renderer.components.settingsPage.loadingConfig'
                        defaultMessage='Loading configuration...'
                    />
                </p>
            );
        }

        return (
            <div
                className='container-fluid'
                style={{
                    height: '100%',
                }}
            >
                <div
                    style={{
                        overflowY: 'auto',
                        height: '100%',
                        margin: '0 -15px',
                    }}
                >
                    <div style={{position: 'relative'}}>
                        <h1 style={settingsPage.heading}>
                            <FormattedMessage
                                id='renderer.components.settingsPage.header'
                                defaultMessage='Settings'
                            />
                        </h1>
                        <hr/>
                    </div>
                    <Container
                        className='settingsPage'
                    >
                        {waitForIpc}
                    </Container>
                </div>
            </div>
        );
    }
}

export default injectIntl(SettingsPage);
