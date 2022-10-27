// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
declare module 'mattermost_webapp/app' {
    const App: React.ComponentType;

    export default App;
}

declare module 'mattermost_webapp/registry' {
    export const getModule: <T>(name: string) => T;
    export const setModule: <T>(name: string, component: T) => boolean;
}

declare module 'mattermost_webapp/store' {
    const store: Store<any>;

    export default store;
}

declare module 'mattermost_webapp/styles';
declare module 'history';
