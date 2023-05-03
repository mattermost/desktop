// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {IpcMainEvent, ipcMain} from 'electron';

import Analytics from '@rudderstack/rudder-sdk-node';

import {TRACK_EVENT} from 'common/communication';
import {Logger} from 'common/log';
import {RUDDERSTACK_KEY} from 'common/utils/constants';

const log = new Logger('Telemetry');

export class Telemetry {
    private client: Analytics;

    constructor() {
        this.client = new Analytics(RUDDERSTACK_KEY, {
            dataPlaneUrl: 'http://localhost:8080/',
        });

        ipcMain.on(TRACK_EVENT, this.onTrackEvent);
    }

    trackEvent = (category: string, event: string, props?: any) => {
        log.info('trackEvent', category, event, props);

        try {
            this.client.track({
                event: 'event',
                anonymousId: '00000000',
                properties: {
                    category,
                    type: event,
                    ...props,
                },
            });
        } catch (error) {
            log.error('trackEvent', error);
        }
    }

    private onTrackEvent = (e: IpcMainEvent, category: string, event: string, props?: any) =>
        this.trackEvent(category, event, props);
}

const telemetry = new Telemetry();
export default telemetry;
