// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const {spawn, exec} = require('child_process');

const axios = require('axios');

const mmctlPath = process.env.MMCTL_PATH || 'mmctl';

const ping = setInterval(async () => {
    try {
        const pingRequest = await axios.get('http://localhost:8065/api/v4/system/ping');
        if (pingRequest.status === 200) {
            const addUserRequest = await axios.post(
                'http://localhost:8065/api/v4/users',
                {
                    email: 'test@test.com',
                    username: 'admin1',
                    password: 'Sys@dmin123',
                    allow_marketing: false,
                });
            if (addUserRequest.status === 201) {
                clearInterval(ping);

                exec('echo "Sys@dmin123" > passfile', () => {
                    const mmctlauth = spawn(mmctlPath, ['auth', 'login', 'http://localhost:8065', '--name', 'local-server', '--username', 'admin1', '--password-file', 'passfile']);
                    mmctlauth.stdout.on('data', (data) => {
                        console.log(`${data}`);
                    });

                    mmctlauth.stderr.on('data', (data) => {
                        console.log(`ERROR: ${data}`);
                    });

                    mmctlauth.on('close', () => {
                        const sampledata = spawn(mmctlPath, ['sampledata']);
                        sampledata.stdout.on('data', (data) => {
                            console.log(`${data}`);
                        });

                        sampledata.stderr.on('data', (data) => {
                            console.log(`ERROR: ${data}`);
                        });

                        sampledata.on('close', () => {
                            exec(`${mmctlPath} config set AnnouncementSettings.UserNoticesEnabled false`, (err, stdout, stderr) => {
                                console.log(err, stdout, stderr);
                            });
                        });
                    });
                });
            }
        } else {
            console.log(`ERROR: Trying to contact server, got ${pingRequest.status}`);
        }
    } catch {
        console.log('waiting for server to respond...');
    }
}, 1000);
