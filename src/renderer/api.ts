// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {RendererAPI} from 'types/rendererAPI';

let api: RendererAPI | undefined;

export function getAPI() {
    if (!api) {
        throw new Error('API not available');
    }

    return api;
}

export async function setAPI() {
    if (api) {
        return;
    }

    api = await window.desktop.getAPI();
    if (api) {
        console.log('API initialized');
    }
}
