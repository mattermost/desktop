// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useState, useEffect, useCallback} from 'react';

import type {CombinedConfig} from 'types/config';

export function useConfig() {
    const [config, setConfig] = useState<CombinedConfig | undefined>(undefined);

    const requestConfig = useCallback(async (exitOnError?: boolean) => {
        // todo: should we block?
        try {
            const configRequest = await window.desktop.getConfiguration() as CombinedConfig;
            return configRequest;
        } catch (err: any) {
            console.error(`there was an error with the config: ${err}`);
            if (exitOnError) {
                window.desktop.quit(`unable to load configuration: ${err}`, err.stack);
            }
        }
        return undefined;
    }, []);

    const reloadConfig = useCallback(async () => {
        const configData = await requestConfig();
        setConfig(configData);
    }, [requestConfig]);

    useEffect(() => {
        requestConfig(true).then((configData) => {
            setConfig(configData);
        });
    }, []);

    useEffect(() => {
        const off = window.desktop.onReloadConfiguration(reloadConfig);
        return off;
    }, [reloadConfig]);

    return {
        config,
        reloadConfig,
    };
}

