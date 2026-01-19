// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import prettyBytes from 'pretty-bytes';
import type {IntlShape} from 'react-intl';

import type {Theme} from '@mattermost/desktop-api';

import type {DownloadedItem} from 'types/downloads';

import {Constants} from './constants';

const prettyBytesConverter = (value: number | string, excludeUnits?: boolean, totalUnits?: string): string => {
    let returnValue = 'N/A';
    if (typeof value === 'number') {
        returnValue = prettyBytes(value);
    } else if (typeof value === 'string') {
        const parsed = parseInt(value, 10);

        if (typeof parsed === 'number') {
            returnValue = prettyBytes(parsed);
        }
    }
    if (excludeUnits && totalUnits === returnValue.split(' ')[1]) {
        return returnValue.split(' ')[0];
    }
    return returnValue;
};

const getFileSizeOrBytesProgress = (item: DownloadedItem) => {
    const totalMegabytes = prettyBytesConverter(item.totalBytes);
    if (item.state === 'progressing') {
        return `${prettyBytesConverter(item.receivedBytes, true, totalMegabytes.split(' ')[1])}/${totalMegabytes}`;
    }
    return `${totalMegabytes}`;
};

const getDownloadingFileStatus = (item: DownloadedItem) => {
    switch (item.state) {
    case 'completed':
        return 'Downloaded';
    case 'deleted':
        return 'Deleted';
    default:
        return 'Cancelled';
    }
};

const getIconClassName = (file: DownloadedItem) => {
    if (file.type === 'update' || file.type === 'update_deprecation') {
        return 'mattermost';
    }

    if (!file.mimeType) {
        return 'generic';
    }

    // Find thumbnail icon form MIME type
    const fileType = file.mimeType.toLowerCase() as keyof typeof Constants.ICON_NAME_FROM_MIME_TYPE;
    if (fileType in Constants.ICON_NAME_FROM_MIME_TYPE) {
        return Constants.ICON_NAME_FROM_MIME_TYPE[fileType];
    }

    // Fallback to file extension
    const extension = file.location.toLowerCase().split('.').pop() as keyof typeof Constants.ICON_NAME_FROM_EXTENSION;
    if (extension && (extension in Constants.ICON_NAME_FROM_EXTENSION)) {
        return Constants.ICON_NAME_FROM_EXTENSION[extension];
    }

    // use generic icon
    return 'generic';
};

const isImageFile = (file: DownloadedItem): boolean => {
    return file.mimeType?.toLowerCase().startsWith('image/') ?? false;
};

const prettyETA = (ms = 0, intl: IntlShape) => {
    let eta;

    if (ms < Constants.MINUTE_MS) {
        eta = `${Math.round(ms / Constants.SECOND_MS)} ${intl.formatMessage({id: 'renderer.time.sec', defaultMessage: 'sec'})}`;
    } else if (ms < Constants.HOUR_MS) {
        eta = `${Math.round(ms / Constants.MINUTE_MS)} ${intl.formatMessage({id: 'renderer.time.mins', defaultMessage: 'mins'})}`;
    } else {
        eta = `${Math.round(ms / Constants.HOUR_MS)} ${intl.formatMessage({id: 'renderer.time.hours', defaultMessage: 'hours'})}`;
    }
    return `${eta} ${intl.formatMessage({id: 'renderer.downloadsDropdown.remaining', defaultMessage: 'remaining'})}`;
};

const printVersion = () => {
    window.desktop.getVersion().then(({name, version}) => {
        // eslint-disable-next-line no-undef
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        console.log(`Starting ${name} v${version}${__HASH_VERSION__ ? ` commit: ${__HASH_VERSION__}` : ''}`);
    });
};

const setTheme = (theme: Theme) => {
    document.body.style.setProperty('--sidebar-bg', theme.sidebarBg);
    document.body.style.setProperty('--sidebar-bg-rgb', toRgbValues(theme.sidebarBg));
    document.body.style.setProperty('--sidebar-text', theme.sidebarText);
    document.body.style.setProperty('--sidebar-text-rgb', toRgbValues(theme.sidebarText));
    document.body.style.setProperty('--sidebar-unread-text', theme.sidebarUnreadText);
    document.body.style.setProperty('--sidebar-unread-text-rgb', toRgbValues(theme.sidebarUnreadText));
    document.body.style.setProperty('--sidebar-text-hover-bg', theme.sidebarTextHoverBg);
    document.body.style.setProperty('--sidebar-text-hover-bg-rgb', toRgbValues(theme.sidebarTextHoverBg));
    document.body.style.setProperty('--sidebar-text-active-border', theme.sidebarTextActiveBorder);
    document.body.style.setProperty('--sidebar-text-active-border-rgb', toRgbValues(theme.sidebarTextActiveBorder));
    document.body.style.setProperty('--sidebar-text-active-color', theme.sidebarTextActiveColor);
    document.body.style.setProperty('--sidebar-text-active-color-rgb', toRgbValues(theme.sidebarTextActiveColor));
    document.body.style.setProperty('--sidebar-header-bg', theme.sidebarHeaderBg);
    document.body.style.setProperty('--sidebar-header-bg-rgb', toRgbValues(theme.sidebarHeaderBg));
    document.body.style.setProperty('--sidebar-teambar-bg', theme.sidebarTeamBarBg);
    document.body.style.setProperty('--sidebar-teambar-bg-rgb', toRgbValues(theme.sidebarTeamBarBg));
    document.body.style.setProperty('--sidebar-header-text-color', theme.sidebarHeaderTextColor);
    document.body.style.setProperty('--sidebar-header-text-color-rgb', toRgbValues(theme.sidebarHeaderTextColor));
    document.body.style.setProperty('--online-indicator', theme.onlineIndicator);
    document.body.style.setProperty('--online-indicator-rgb', toRgbValues(theme.onlineIndicator));
    document.body.style.setProperty('--away-indicator', theme.awayIndicator);
    document.body.style.setProperty('--away-indicator-rgb', toRgbValues(theme.awayIndicator));
    document.body.style.setProperty('--dnd-indicator', theme.dndIndicator);
    document.body.style.setProperty('--dnd-indicator-rgb', toRgbValues(theme.dndIndicator));
    document.body.style.setProperty('--mention-bg', theme.mentionBg);
    document.body.style.setProperty('--mention-bg-rgb', toRgbValues(theme.mentionBg));
    document.body.style.setProperty('--mention-color', theme.mentionColor);
    document.body.style.setProperty('--mention-color-rgb', toRgbValues(theme.mentionColor));
    document.body.style.setProperty('--center-channel-bg', theme.centerChannelBg);
    document.body.style.setProperty('--center-channel-bg-rgb', toRgbValues(theme.centerChannelBg));
    document.body.style.setProperty('--center-channel-color', theme.centerChannelColor);
    document.body.style.setProperty('--center-channel-color-rgb', toRgbValues(theme.centerChannelColor));
    document.body.style.setProperty('--new-message-separator', theme.newMessageSeparator);
    document.body.style.setProperty('--new-message-separator-rgb', toRgbValues(theme.newMessageSeparator));
    document.body.style.setProperty('--link-color', theme.linkColor);
    document.body.style.setProperty('--link-color-rgb', toRgbValues(theme.linkColor));
    document.body.style.setProperty('--button-bg', theme.buttonBg);
    document.body.style.setProperty('--button-bg-rgb', toRgbValues(theme.buttonBg));
    document.body.style.setProperty('--button-color', theme.buttonColor);
    document.body.style.setProperty('--button-color-rgb', toRgbValues(theme.buttonColor));
    document.body.style.setProperty('--error-text', theme.errorTextColor);
    document.body.style.setProperty('--error-text-color-rgb', toRgbValues(theme.errorTextColor));
    document.body.style.setProperty('--mention-highlight-bg', theme.mentionHighlightBg);
    document.body.style.setProperty('--mention-highlight-bg-rgb', toRgbValues(theme.mentionHighlightBg));
    document.body.style.setProperty('--mention-highlight-link', theme.mentionHighlightLink);
    document.body.style.setProperty('--mention-highlight-link-rgb', toRgbValues(theme.mentionHighlightLink));
    document.body.style.setProperty('--code-theme', theme.codeTheme);
};

const resetTheme = () => {
    document.body.style.removeProperty('--sidebar-bg');
    document.body.style.removeProperty('--sidebar-bg-rgb');
    document.body.style.removeProperty('--sidebar-text');
    document.body.style.removeProperty('--sidebar-text-rgb');
    document.body.style.removeProperty('--sidebar-unread-text');
    document.body.style.removeProperty('--sidebar-unread-text-rgb');
    document.body.style.removeProperty('--sidebar-text-hover-bg');
    document.body.style.removeProperty('--sidebar-text-hover-bg-rgb');
    document.body.style.removeProperty('--sidebar-text-active-border');
    document.body.style.removeProperty('--sidebar-text-active-border-rgb');
    document.body.style.removeProperty('--sidebar-text-active-color');
    document.body.style.removeProperty('--sidebar-text-active-color-rgb');
    document.body.style.removeProperty('--sidebar-header-bg');
    document.body.style.removeProperty('--sidebar-header-bg-rgb');
    document.body.style.removeProperty('--sidebar-teambar-bg');
    document.body.style.removeProperty('--sidebar-teambar-bg-rgb');
    document.body.style.removeProperty('--sidebar-header-text-color');
    document.body.style.removeProperty('--sidebar-header-text-color-rgb');
    document.body.style.removeProperty('--online-indicator');
    document.body.style.removeProperty('--online-indicator-rgb');
    document.body.style.removeProperty('--away-indicator');
    document.body.style.removeProperty('--away-indicator-rgb');
    document.body.style.removeProperty('--dnd-indicator');
    document.body.style.removeProperty('--dnd-indicator-rgb');
    document.body.style.removeProperty('--mention-bg');
    document.body.style.removeProperty('--mention-bg-rgb');
    document.body.style.removeProperty('--mention-color');
    document.body.style.removeProperty('--mention-color-rgb');
    document.body.style.removeProperty('--center-channel-bg');
    document.body.style.removeProperty('--center-channel-bg-rgb');
    document.body.style.removeProperty('--center-channel-color');
    document.body.style.removeProperty('--center-channel-color-rgb');
    document.body.style.removeProperty('--new-message-separator');
    document.body.style.removeProperty('--new-message-separator-rgb');
    document.body.style.removeProperty('--link-color');
    document.body.style.removeProperty('--link-color-rgb');
    document.body.style.removeProperty('--button-bg');
    document.body.style.removeProperty('--button-bg-rgb');
    document.body.style.removeProperty('--button-color');
    document.body.style.removeProperty('--button-color-rgb');
    document.body.style.removeProperty('--error-text');
    document.body.style.removeProperty('--error-text-color-rgb');
    document.body.style.removeProperty('--mention-highlight-bg');
    document.body.style.removeProperty('--mention-highlight-bg-rgb');
    document.body.style.removeProperty('--mention-highlight-link');
    document.body.style.removeProperty('--mention-highlight-link-rgb');
    document.body.style.removeProperty('--code-theme');
};

function toRgbValues(hexStr: string): string {
    const rgbaStr = `${parseInt(hexStr.substring(1, 3), 16)}, ${parseInt(hexStr.substring(3, 5), 16)}, ${parseInt(hexStr.substring(5, 7), 16)}`;
    return rgbaStr;
}

export {
    getDownloadingFileStatus,
    getFileSizeOrBytesProgress,
    getIconClassName,
    isImageFile,
    prettyETA,
    printVersion,
    setTheme,
    resetTheme,
};
