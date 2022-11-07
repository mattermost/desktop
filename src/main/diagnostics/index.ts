// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import log from 'electron-log';

class DiagnosticsModule {
    step: number;

    constructor() {
        this.step = 0;
    }

    run = () => {
        log.debug('Diagnostics.runDiagnostics');
    }
}

const Diagnostics = new DiagnosticsModule();

export default Diagnostics;
