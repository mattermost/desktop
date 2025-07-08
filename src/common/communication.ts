// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export const GET_APP_INFO = 'get-app-info';

export const SWITCH_SERVER = 'switch-server';
export const SWITCH_TAB = 'switch-tab';
export const CLOSE_VIEW = 'close-view';
export const OPEN_VIEW = 'open-view';
export const SET_ACTIVE_VIEW = 'set-active-view';
export const FOCUS_BROWSERVIEW = 'focus-browserview';
export const HISTORY = 'history';

export const QUIT = 'quit';

export const GET_CONFIGURATION = 'get-configuration';
export const UPDATE_CONFIGURATION = 'update-configuration';
export const GET_LOCAL_CONFIGURATION = 'get-local-configuration';
export const RELOAD_CONFIGURATION = 'reload-config';
export const EMIT_CONFIGURATION = 'emit-configuration';

export const DARK_MODE_CHANGE = 'dark_mode_change';
export const GET_DARK_MODE = 'get-dark-mode';
export const USER_ACTIVITY_UPDATE = 'user-activity-update';
export const UPDATE_SHORTCUT_MENU = 'update-shortcut-menu';

export const OPEN_APP_MENU = 'open-app-menu';
export const APP_MENU_WILL_CLOSE = 'app-menu-will-close';

export const LOAD_RETRY = 'load_retry';
export const LOAD_SUCCESS = 'load_success';
export const LOAD_FAILED = 'load_fail';
export const LOAD_INCOMPATIBLE_SERVER = 'load_incompatible_server';

export const MAXIMIZE_CHANGE = 'maximized_change';

export const DOUBLE_CLICK_ON_WINDOW = 'double_click';

export const SHOW_NEW_SERVER_MODAL = 'show_new_server_modal';
export const SHOW_EDIT_SERVER_MODAL = 'show-edit-server-modal';
export const SHOW_REMOVE_SERVER_MODAL = 'show-remove-server-modal';

export const RETRIEVE_MODAL_INFO = 'retrieve-modal-info';
export const MODAL_CANCEL = 'modal-cancel';
export const MODAL_RESULT = 'modal-result';
export const MODAL_OPEN = 'modal-open';
export const MODAL_CLOSE = 'modal-close';
export const NOTIFY_MENTION = 'notify_mention';
export const EXIT_FULLSCREEN = 'exit-fullscreen';
export const GET_FULL_SCREEN_STATUS = 'get-full-screen-status';

export const UPDATE_TARGET_URL = 'update_target_url';

export const PLAY_SOUND = 'play_sound';

export const GET_DOWNLOAD_LOCATION = 'get_download_location';

export const UPDATE_MENTIONS = 'update_mentions';
export const UNREADS_AND_MENTIONS = 'unreads-and-mentions';
export const SESSION_EXPIRED = 'session_expired';

export const REACT_APP_INITIALIZED = 'react-app-initialized';

export const SHOW_SETTINGS_WINDOW = 'show-settings-window';

export const LOADING_SCREEN_ANIMATION_FINISHED = 'loading-screen-animation-finished';
export const TOGGLE_LOADING_SCREEN_VISIBILITY = 'toggle-loading-screen-visibility';

export const SELECT_NEXT_TAB = 'select-next-tab';
export const SELECT_PREVIOUS_TAB = 'select-previous-tab';
export const FOCUS_THREE_DOT_MENU = 'focus-three-dot-menu';

export const LOADSCREEN_END = 'loadscreen-end';

export const OPEN_SERVERS_DROPDOWN = 'open-servers-dropdown';
export const CLOSE_SERVERS_DROPDOWN = 'close-servers-dropdown';
export const UPDATE_SERVERS_DROPDOWN = 'update-servers-dropdown';
export const REQUEST_SERVERS_DROPDOWN_INFO = 'request-servers-dropdown-info';
export const RECEIVE_DROPDOWN_MENU_SIZE = 'receive-dropdown-menu-size';

export const UPDATE_AVAILABLE = 'update-available';
export const UPDATE_DOWNLOADED = 'update-downloaded';
export const UPDATE_PROGRESS = 'update-progress';
export const UPDATE_REMIND_LATER = 'update-remind-later';
export const CANCEL_UPDATE_DOWNLOAD = 'cancel-update-download';
export const CANCEL_UPGRADE = 'cancel-upgrade';
export const START_UPDATE_DOWNLOAD = 'start-update-download';
export const START_UPGRADE = 'start-upgrade';
export const CHECK_FOR_UPDATES = 'check-for-updates';
export const NO_UPDATE_AVAILABLE = 'no-update-available';

export const BROWSER_HISTORY_PUSH = 'browser-history-push';
export const TAB_LOGIN_CHANGED = 'tab-login-changed';

export const GET_AVAILABLE_SPELL_CHECKER_LANGUAGES = 'get-available-spell-checker-languages';

export const GET_VIEW_INFO_FOR_TEST = 'get-view-info-for-test';

export const GET_MODAL_UNCLOSEABLE = 'get-modal-uncloseable';

export const UPDATE_PATHS = 'update-paths';

export const SET_URL_FOR_URL_VIEW = 'set-url-for-url-view';
export const UPDATE_URL_VIEW_WIDTH = 'update-url-view-width';

export const OPEN_SERVER_EXTERNALLY = 'open-server-externally';
export const OPEN_SERVER_UPGRADE_LINK = 'open-server-upgrade-link';
export const OPEN_CHANGELOG_LINK = 'open-changelog-link';

export const PING_DOMAIN = 'ping-domain';

export const GET_LANGUAGE_INFORMATION = 'get-language-information';
export const GET_AVAILABLE_LANGUAGES = 'get-available-languages';

// Calls
export const GET_DESKTOP_SOURCES = 'get-desktop-sources';
export const DESKTOP_SOURCES_MODAL_REQUEST = 'desktop-sources-modal-request';
export const CALLS_JOIN_CALL = 'calls-join-call';
export const CALLS_LEAVE_CALL = 'calls-leave-call';
export const CALLS_WIDGET_RESIZE = 'calls-widget-resize';
export const CALLS_WIDGET_SHARE_SCREEN = 'calls-widget-share-screen';
export const CALLS_LINK_CLICK = 'calls-link-click';
export const CALLS_JOINED_CALL = 'calls-joined-call';
export const CALLS_POPOUT_FOCUS = 'calls-popout-focus';
export const CALLS_ERROR = 'calls-error';
export const CALLS_JOIN_REQUEST = 'calls-join-request';
export const CALLS_WIDGET_OPEN_THREAD = 'calls-widget-open-thread';
export const CALLS_WIDGET_OPEN_STOP_RECORDING_MODAL = 'calls-widget-open-stop-recording-modal';
export const CALLS_WIDGET_OPEN_USER_SETTINGS = 'calls-widget-open-user-settings';

export const REQUEST_CLEAR_DOWNLOADS_DROPDOWN = 'request-clear-downloads-dropdown';
export const CLOSE_DOWNLOADS_DROPDOWN = 'close-downloads-dropdown';
export const OPEN_DOWNLOADS_DROPDOWN = 'open-downloads-dropdown';
export const SHOW_DOWNLOADS_DROPDOWN_BUTTON_BADGE = 'show-downloads-dropdown-button-badge';
export const HIDE_DOWNLOADS_DROPDOWN_BUTTON_BADGE = 'hide-downloads-dropdown-button-badge';
export const REQUEST_DOWNLOADS_DROPDOWN_INFO = 'request-downloads-dropdown-info';
export const UPDATE_DOWNLOADS_DROPDOWN = 'update-downloads-dropdown';
export const DOWNLOADS_DROPDOWN_OPEN_FILE = 'downloads-dropdown-open-file';
export const REQUEST_HAS_DOWNLOADS = 'request-has-downloads';
export const DOWNLOADS_DROPDOWN_FOCUSED = 'downloads-dropdown-focused';
export const RECEIVE_DOWNLOADS_DROPDOWN_SIZE = 'receive-downloads-dropdown-size';

export const OPEN_DOWNLOADS_DROPDOWN_MENU = 'open-downloads-dropdown-menu';
export const CLOSE_DOWNLOADS_DROPDOWN_MENU = 'close-downloads-dropdown-menu';
export const TOGGLE_DOWNLOADS_DROPDOWN_MENU = 'toggle-downloads-dropdown-menu';
export const UPDATE_DOWNLOADS_DROPDOWN_MENU = 'update-downloads-dropdown-menu';
export const UPDATE_DOWNLOADS_DROPDOWN_MENU_ITEM = 'update-downloads-dropdown-menu-item';
export const REQUEST_DOWNLOADS_DROPDOWN_MENU_INFO = 'request-downloads-dropdown-menu-info';
export const DOWNLOADS_DROPDOWN_MENU_CANCEL_DOWNLOAD = 'downloads-dropdown-menu-cancel-download';
export const DOWNLOADS_DROPDOWN_MENU_CLEAR_FILE = 'downloads-dropdown-menu-clear-file';
export const DOWNLOADS_DROPDOWN_MENU_OPEN_FILE = 'downloads-dropdown-menu-open-file';
export const DOWNLOADS_DROPDOWN_MENU_SHOW_FILE_IN_FOLDER = 'downloads-dropdown-menu-show-file-in-folder';

export const SERVERS_URL_MODIFIED = 'servers-modified';
export const SERVERS_UPDATE = 'servers-update';
export const UPDATE_SERVER_ORDER = 'update-server-order';
export const UPDATE_TAB_ORDER = 'update-tab-order';
export const GET_LAST_ACTIVE = 'get-last-active';
export const GET_ORDERED_SERVERS = 'get-ordered-servers';
export const GET_ORDERED_TABS_FOR_SERVER = 'get-ordered-tabs-for-server';

export const UPDATE_APPSTATE = 'update-appstate';
export const UPDATE_APPSTATE_TOTALS = 'update-appstate-totals';
export const UPDATE_APPSTATE_FOR_VIEW_ID = 'update-appstate-for-view-id';

export const MAIN_WINDOW_CREATED = 'main-window-created';
export const MAIN_WINDOW_RESIZED = 'main-window-resized';
export const MAIN_WINDOW_FOCUSED = 'main-window-focused';

export const VALIDATE_SERVER_URL = 'validate-server-url';

export const GET_IS_DEV_MODE = 'get-is-dev-mode';

export const TOGGLE_SECURE_INPUT = 'toggle-secure-input';

export const REQUEST_BROWSER_HISTORY_STATUS = 'request-browser-history-status';
export const BROWSER_HISTORY_STATUS_UPDATED = 'browser-history-status-updated';

export const NOTIFICATION_CLICKED = 'notification-clicked';

export const OPEN_NOTIFICATION_PREFERENCES = 'open-notification-preferences';
export const OPEN_WINDOWS_CAMERA_PREFERENCES = 'open-windows-camera-preferences';
export const OPEN_WINDOWS_MICROPHONE_PREFERENCES = 'open-windows-microphone-preferences';
export const GET_MEDIA_ACCESS_STATUS = 'get-media-access-status';

export const GET_NONCE = 'get-nonce';

export const DEVELOPER_MODE_UPDATED = 'developer-mode-updated';
export const IS_DEVELOPER_MODE_ENABLED = 'is-developer-mode-enabled';

export const METRICS_SEND = 'metrics-send';
export const METRICS_RECEIVE = 'metrics-receive';
export const METRICS_REQUEST = 'metrics-request';

export const GET_UNIQUE_SERVERS_WITH_PERMISSIONS = 'get-unique-servers-with-permissions';
export const ADD_SERVER = 'add-server';
export const EDIT_SERVER = 'edit-server';
export const REMOVE_SERVER = 'remove-server';
