// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/** Sidebar channel list item for a channel name (e.g. town-square). */
export function channelItemSelector(channelName: string): string {
    return `#sidebarItem_${channelName}`;
}

export const CHANNEL_HEADER_SELECTORS = [
    '#channelHeaderTitle',
    '[data-testid="channelHeaderTitle"]',
    '.channel-header__title',
    '[aria-label="channel header region"] strong',
].join(', ');

export const POST_TEXTBOX_CANDIDATES = [
    '[data-slate-editor="true"]',
    '#post_textbox[contenteditable="true"]',
    '[data-testid="post_textbox"][contenteditable="true"]',
    '#post_textbox',
    '[data-testid="post_textbox"]',
    '.post-create__input [contenteditable="true"]',
    '.post-create__input [role="textbox"]',
    '.AdvancedTextEditor [contenteditable="true"]',
    '[role="textbox"][contenteditable="true"]',
    'textarea#post_textbox',
] as const;

export const POST_TEXTBOX_SELECTOR = POST_TEXTBOX_CANDIDATES.join(', ');

const POST_TEXTBOX_CANDIDATES_JSON = JSON.stringify(POST_TEXTBOX_CANDIDATES);
const CHANNEL_HEADER_SELECTORS_JSON = JSON.stringify(CHANNEL_HEADER_SELECTORS);

/**
 * Shared visibility helper for renderer-side probes.
 * Inlined into runInRenderer strings — cannot be imported in the renderer process.
 */
export const IS_VISIBLE_JS = `
    const __mmIsVisible = (element) => {
        if (!(element instanceof HTMLElement) || !element.isConnected) {
            return false;
        }
        const style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
            return false;
        }
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    };
`;

/** Resolve the editable post composer root element. */
export const POST_TEXTBOX_RESOLVER_JS = `
    ${IS_VISIBLE_JS}

    const __mmResolvePostTextboxRoot = () => {
        const candidates = ${POST_TEXTBOX_CANDIDATES_JSON}.map((selector) => document.querySelector(selector)).filter(Boolean);
        for (const candidate of candidates) {
            if (!__mmIsVisible(candidate)) {
                continue;
            }
            if (candidate.matches('[contenteditable="true"], textarea, input')) {
                return candidate;
            }
            const nested = candidate.querySelector('[contenteditable="true"], textarea, input');
            if (nested && __mmIsVisible(nested)) {
                return nested;
            }
        }
        return null;
    };
`;

/** True when the post composer is visible and can receive keyboard focus. */
export const IS_COMPOSER_INTERACTIVE_JS = `
    ${POST_TEXTBOX_RESOLVER_JS}

    const root = __mmResolvePostTextboxRoot();
    if (!root) {
        return false;
    }
    if (root.closest('[aria-disabled="true"]')) {
        return false;
    }
    root.focus?.();
    return document.activeElement === root || root.contains(document.activeElement);
`;

/** True when loading spinners are not visible (style-only, no rect check). */
export const IS_ELEMENT_SHOWN_JS = `
    const __mmIsShown = (element) => {
        if (!(element instanceof HTMLElement) || !element.isConnected) {
            return false;
        }
        const style = window.getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    };
`;

const POST_LIST_COMPOSER_SELECTORS = [
    '[data-slate-editor="true"]',
    '#post_textbox',
    '[data-testid="post_textbox"]',
    '[role="textbox"][contenteditable="true"]',
].join(', ');

/** Lenient channel-ready check used by legacy waitForChannelPostListLoaded callers. */
export const IS_CHANNEL_POST_LIST_LOADED_JS = `
    ${IS_ELEMENT_SHOWN_JS}

    const postList = document.querySelector(
        '#post-list, .post-list, [data-testid="postList"], .post-list-holder',
    );
    if ([...(postList?.querySelectorAll('.post-list__loading, .post-list__dynamic-loading') ?? [])].some(__mmIsShown)) {
        return false;
    }

    const channelLoading = document.querySelector(
        '#channelView .loading-screen, .channel-view .loading-screen, .ChannelLoader, .channel-loader',
    );
    if (__mmIsShown(channelLoading)) {
        return false;
    }

    return Boolean(
        document.querySelector(${CHANNEL_HEADER_SELECTORS_JSON})
        && document.querySelector('${POST_LIST_COMPOSER_SELECTORS}'),
    );
`;

/** True when the channel header and interactive composer are both present. */
export const IS_CHANNEL_VIEW_LOADED_JS = `
    ${IS_VISIBLE_JS}
    ${POST_TEXTBOX_RESOLVER_JS}

    const hasHeader = document.querySelector(${CHANNEL_HEADER_SELECTORS_JSON});
    const composer = __mmResolvePostTextboxRoot()
        || document.querySelector('${POST_LIST_COMPOSER_SELECTORS}');
    if (hasHeader && composer) {
        return true;
    }

    const postList = document.querySelector(
        '#post-list, .post-list, [data-testid="postList"], .post-list-holder',
    );
    if ([...(postList?.querySelectorAll('.post-list__loading, .post-list__dynamic-loading') ?? [])].some(__mmIsVisible)) {
        return false;
    }

    const channelLoading = document.querySelector(
        '#channelView .loading-screen, .channel-view .loading-screen, .ChannelLoader, .channel-loader',
    );
    if (__mmIsVisible(channelLoading)) {
        return false;
    }

    return Boolean(hasHeader && composer);
`;

/** True when a top-level JS error banner is shown (webapp crashed partially). */
export const HAS_CLIENT_JS_ERROR_JS = `
    Boolean(
        document.body?.textContent?.includes('A JavaScript error has occurred')
        || document.querySelector('.error-bar, [data-testid="errorInModal"]'),
    )
`;
