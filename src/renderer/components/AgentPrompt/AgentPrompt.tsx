// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {useIntl} from 'react-intl';

import './AgentPrompt.scss';

export default function AgentPrompt() {
    const intl = useIntl();
    const inputRef = useRef<HTMLInputElement>(null);
    const [value, setValue] = useState('');

    const placeholder = intl.formatMessage({
        id: 'renderer.components.agentPrompt.placeholder',
        defaultMessage: 'Ask the agent...',
    });

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            window.desktop.hideAgentWindow();
        } else if (e.key === 'Enter' && value.trim()) {
            e.preventDefault();
            window.desktop.agentWindowSubmit(value.trim());
            setValue('');
        }
    }, [value]);

    useEffect(() => {
        const cleanup = window.desktop.onAgentWindowShown(() => {
            setValue('');
            inputRef.current?.focus();
        });

        // Focus on initial mount
        inputRef.current?.focus();

        return cleanup;
    }, []);

    return (
        <div className='AgentPrompt'>
            <div className='AgentPrompt__container'>
                <i className='icon icon-creation-outline AgentPrompt__icon'/>
                <input
                    ref={inputRef}
                    className='AgentPrompt__input'
                    type='text'
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    autoFocus={true}
                />
            </div>
        </div>
    );
}
