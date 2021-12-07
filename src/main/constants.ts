// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'path';

import {app} from 'electron';

const userDataPath = app.getPath('userData');

export const configPath = `${userDataPath}/config.json`;
export const allowedProtocolFile = path.resolve(userDataPath, 'allowedProtocols.json');
export const appVersionJson = path.join(userDataPath, 'app-state.json');
export const certificateStorePath = path.resolve(userDataPath, 'certificate.json');
export const trustedOriginsStoreFile = path.resolve(userDataPath, 'trustedOrigins.json');
export const boundsInfoPath = path.join(userDataPath, 'bounds-info.json');
