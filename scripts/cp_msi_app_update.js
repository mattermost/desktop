// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const fs = require('fs');
fs.copyFileSync('release/win-unpacked/resources/app-update.yml', 'release/msi-app-update.yml');
fs.unlinkSync('release/win-unpacked/resources/app-update.yml');
