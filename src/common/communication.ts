// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export const SWITCH_SERVER = 'switch-server';
export const SWITCH_TAB = 'switch-tab';
export const CLOSE_TAB = 'close-tab';
export const OPEN_TAB = 'open-tab';
export const SET_ACTIVE_VIEW = 'set-active-view';
export const UPDATE_LAST_ACTIVE = 'update-last-active';
export const FOCUS_BROWSERVIEW = 'focus-browserview';
export const HISTORY = 'history';

export const QUIT = 'quit';

export const GET_CONFIGURATION = 'get-configuration';
export const UPDATE_CONFIGURATION = 'update-configuration';
export const GET_LOCAL_CONFIGURATION = 'get-local-configuration';
export const RELOAD_CONFIGURATION = 'reload-config';
export const EMIT_CONFIGURATION = 'emit-configuration';

export const UPDATE_TEAMS = 'update-teams';
export const DARK_MODE_CHANGE = 'dark_mode_change';
export const GET_DARK_MODE = 'get-dark-mode';
export const USER_ACTIVITY_UPDATE = 'user-activity-update';
export const UPDATE_SHORTCUT_MENU = 'update-shortcut-menu';

export const OPEN_APP_MENU = 'open-app-menu';
export const APP_MENU_WILL_CLOSE = 'app-menu-will-close';

export const LOAD_RETRY = 'load_retry';
export const LOAD_SUCCESS = 'load_success';
export const LOAD_FAILED = 'load_fail';

export const MAXIMIZE_CHANGE = 'maximized_change';

export const DOUBLE_CLICK_ON_WINDOW = 'double_click';

export const SHOW_NEW_SERVER_MODAL = 'show_new_server_modal';
export const SHOW_EDIT_SERVER_MODAL = 'show-edit-server-modal';
export const SHOW_REMOVE_SERVER_MODAL = 'show-remove-server-modal';
export const MAIN_WINDOW_SHOWN = 'main-window-shown';

export const RETRIEVE_MODAL_INFO = 'retrieve-modal-info';
export const MODAL_INFO = 'modal-info';
export const MODAL_CANCEL = 'modal-cancel';
export const MODAL_RESULT = 'modal-result';
export const MODAL_SEND_IPC_MESSAGE = 'modal-send-ipc-message';
export const MODAL_OPEN = 'modal-open';
export const MODAL_CLOSE = 'modal-close';
export const NOTIFY_MENTION = 'notify_mention';
export const WINDOW_CLOSE = 'window_close';
export const WINDOW_MINIMIZE = 'window_minimize';
export const WINDOW_MAXIMIZE = 'window_maximize';
export const WINDOW_RESTORE = 'window_restore';
export const GET_FULL_SCREEN_STATUS = 'get-full-screen-status';

export const UPDATE_TARGET_URL = 'update_target_url';

export const PLAY_SOUND = 'play_sound';

export const GET_DOWNLOAD_LOCATION = 'get_download_location';

export const UPDATE_MENTIONS = 'update_mentions';
export const IS_UNREAD = 'is_unread';
export const UNREAD_RESULT = 'unread_result';
export const SESSION_EXPIRED = 'session_expired';
export const UPDATE_TRAY = 'update_tray';
export const UPDATE_BADGE = 'update_badge';

export const SET_VIEW_OPTIONS = 'set-view-name';
export const REACT_APP_INITIALIZED = 'react-app-initialized';

export const TOGGLE_BACK_BUTTON = 'toggle-back-button';

export const SHOW_SETTINGS_WINDOW = 'show-settings-window';

export const RECEIVED_LOADING_SCREEN_DATA = 'received-loading-screen-data';
export const GET_LOADING_SCREEN_DATA = 'get-loading-screen-data';
export const LOADING_SCREEN_ANIMATION_FINISHED = 'loading-screen-animation-finished';
export const TOGGLE_LOADING_SCREEN_VISIBILITY = 'toggle-loading-screen-visibility';

export const SELECT_NEXT_TAB = 'select-next-tab';
export const SELECT_PREVIOUS_TAB = 'select-previous-tab';
export const FOCUS_THREE_DOT_MENU = 'focus-three-dot-menu';

export const LOADSCREEN_END = 'loadscreen-end';

export const OPEN_TEAMS_DROPDOWN = 'open-teams-dropdown';
export const CLOSE_TEAMS_DROPDOWN = 'close-teams-dropdown';
export const UPDATE_TEAMS_DROPDOWN = 'update-teams-dropdown';
export const UPDATE_DROPDOWN_MENTIONS = 'update-dropdown-mentions';
export const REQUEST_TEAMS_DROPDOWN_INFO = 'request-teams-dropdown-info';
export const RECEIVE_DROPDOWN_MENU_SIZE = 'receive-dropdown-menu-size';
export const SEND_DROPDOWN_MENU_SIZE = 'send-dropdown-menu-size';

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

export const BROWSER_HISTORY_BUTTON = 'browser-history-button';
export const BROWSER_HISTORY_PUSH = 'browser-history-push';
export const APP_LOGGED_IN = 'app-logged-in';
export const APP_LOGGED_OUT = 'app-logged-out';

export const GET_AVAILABLE_SPELL_CHECKER_LANGUAGES = 'get-available-spell-checker-languages';

export const GET_VIEW_NAME = 'get-view-name';
export const GET_VIEW_WEBCONTENTS_ID = 'get-view-webcontents-id';

export const RESIZE_MODAL = 'resize-modal';
export const GET_MODAL_UNCLOSEABLE = 'get-modal-uncloseable';
export const MODAL_UNCLOSEABLE = 'modal-uncloseable';

export const UPDATE_PATHS = 'update-paths';

export const UPDATE_URL_VIEW_WIDTH = 'update-url-view-width';

export const RELOAD_CURRENT_VIEW = 'reload-current-view';

export const PING_DOMAIN = 'ping-domain';
export const PING_DOMAIN_RESPONSE = 'ping-domain-response';

export const GET_LANGUAGE_INFORMATION = 'get-language-information';
export const RETRIEVED_LANGUAGE_INFORMATION = 'retrieved-language-information';
export const GET_AVAILABLE_LANGUAGES = 'get-available-languages';

export const VIEW_FINISHED_RESIZING = 'view-finished-resizing';

// Calls
export const DISPATCH_GET_DESKTOP_SOURCES = 'dispatch-get-desktop-sources';
export const DESKTOP_SOURCES_RESULT = 'desktop-sources-result';
export const DESKTOP_SOURCES_MODAL_REQUEST = 'desktop-sources-modal-request';
export const CALLS_JOIN_CALL = 'calls-join-call';
export const CALLS_LEAVE_CALL = 'calls-leave-call';
export const CALLS_WIDGET_RESIZE = 'calls-widget-resize';
export const CALLS_WIDGET_SHARE_SCREEN = 'calls-widget-share-screen';
export const CALLS_WIDGET_CHANNEL_LINK_CLICK = 'calls-widget-channel-link-click';
export const CALLS_JOINED_CALL = 'calls-joined-call';

export const REQUEST_CLEAR_DOWNLOADS_DROPDOWN = 'request-clear-downloads-dropdown';
export const CLOSE_DOWNLOADS_DROPDOWN = 'close-downloads-dropdown';
export const OPEN_DOWNLOADS_DROPDOWN = 'open-downloads-dropdown';
export const SHOW_DOWNLOADS_DROPDOWN_BUTTON_BADGE = 'show-downloads-dropdown-button-badge';
export const HIDE_DOWNLOADS_DROPDOWN_BUTTON_BADGE = 'hide-downloads-dropdown-button-badge';
export const REQUEST_DOWNLOADS_DROPDOWN_INFO = 'request-downloads-dropdown-info';
export const UPDATE_DOWNLOADS_DROPDOWN = 'update-downloads-dropdown';
export const DOWNLOADS_DROPDOWN_SHOW_FILE_IN_FOLDER = 'downloads-dropdown-show-file-in-folder';
export const REQUEST_HAS_DOWNLOADS = 'request-has-downloads';
export const DOWNLOADS_DROPDOWN_FOCUSED = 'downloads-dropdown-focused';
export const RECEIVE_DOWNLOADS_DROPDOWN_SIZE = 'receive-downloads-dropdown-size';
export const SEND_DOWNLOADS_DROPDOWN_SIZE = 'send-downloads-dropdown-size';
export const GET_DOWNLOADED_IMAGE_THUMBNAIL_LOCATION = 'get-downloaded-image-thumbnail-location';

export const OPEN_DOWNLOADS_DROPDOWN_MENU = 'open-downloads-dropdown-menu';
export const CLOSE_DOWNLOADS_DROPDOWN_MENU = 'close-downloads-dropdown-menu';
export const TOGGLE_DOWNLOADS_DROPDOWN_MENU = 'toggle-downloads-dropdown-menu';
export const UPDATE_DOWNLOADS_DROPDOWN_MENU = 'update-downloads-dropdown-menu';
export const UPDATE_DOWNLOADS_DROPDOWN_MENU_ITEM = 'update-downloads-dropdown-menu-item';
export const REQUEST_DOWNLOADS_DROPDOWN_MENU_INFO = 'request-downloads-dropdown-menu-info';
export const DOWNLOADS_DROPDOWN_MENU_CANCEL_DOWNLOAD = 'downloads-dropdown-menu-cancel-download';
export const DOWNLOADS_DROPDOWN_MENU_CLEAR_FILE = 'downloads-dropdown-menu-clear-file';
export const DOWNLOADS_DROPDOWN_MENU_OPEN_FILE = 'downloads-dropdown-menu-open-file';

export const GET_CURRENT_SERVER_URL = 'get-current-server-url';
export const SETUP_INITIAL_COOKIES = 'setup-initial-cookies';
export const SET_COOKIE = 'set-cookie';

export const GET_DESKTOP_APP_API = 'get-desktop-app-api';
