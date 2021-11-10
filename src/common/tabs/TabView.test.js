// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {MattermostServer} from 'common/servers/MattermostServer';
import * as TabView from 'common/tabs/TabView';

describe('common/tabs/TabView', () => {
    describe('getServerView', () => {
        it('should return correct URL on messaging tab', () => {
            const server = new MattermostServer('server-1', 'http://server-1.com');
            const tab = {name: TabView.TAB_MESSAGING};
            expect(TabView.getServerView(server, tab).url).toBe(server.url);
        });

        it('should return correct URL on playbooks tab', () => {
            const server = new MattermostServer('server-1', 'http://server-1.com');
            const tab = {name: TabView.TAB_PLAYBOOKS};
            expect(TabView.getServerView(server, tab).url.toString()).toBe(`${server.url}playbooks`);
        });

        it('should return correct URL on boards tab', () => {
            const server = new MattermostServer('server-1', 'http://server-1.com');
            const tab = {name: TabView.TAB_FOCALBOARD};
            expect(TabView.getServerView(server, tab).url.toString()).toBe(`${server.url}boards`);
        });

        it('should throw error on bad tab name', () => {
            const server = new MattermostServer('server-1', 'http://server-1.com');
            const tab = {name: 'not a real tab name'};
            expect(() => {
                TabView.getServerView(server, tab);
            }).toThrow(Error);
        });
    });
});
