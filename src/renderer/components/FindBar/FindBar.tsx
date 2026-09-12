// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import './FindBar.scss';

export default function FindBar() {
    const {formatMessage} = useIntl();
    const inputRef = useRef<HTMLInputElement>(null);
    const [query, setQuery] = useState('');
    const [result, setResult] = useState({activeMatchOrdinal: 0, matches: 0});

    const focusInput = useCallback(() => {
        const input = inputRef.current;
        if (!input) {
            return;
        }
        input.focus();
        input.select();
    }, []);

    useEffect(() => {
        window.desktop.findBar.onOpen(() => {
            setQuery('');
            setResult({activeMatchOrdinal: 0, matches: 0});
            requestAnimationFrame(focusInput);
        });
        window.desktop.findBar.onFocus(focusInput);
        window.desktop.findBar.onResult((nextResult) => {
            setResult(nextResult);
        });
    }, [focusInput]);

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value;
        setQuery(value);
        window.desktop.findBar.find(value, {findNext: true});
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            window.desktop.findBar.close();
            return;
        }
        if (event.key === 'Enter') {
            event.preventDefault();
            if (event.shiftKey) {
                window.desktop.findBar.findPrevious();
                return;
            }
            window.desktop.findBar.findNext();
        }
    };

    let matchLabel = '';
    if (query && result.matches > 0) {
        matchLabel = formatMessage(
            {
                id: 'renderer.components.findBar.matchCount',
                defaultMessage: '{current} of {total}',
            },
            {current: result.activeMatchOrdinal, total: result.matches},
        );
    } else if (query) {
        matchLabel = formatMessage({id: 'renderer.components.findBar.noResults', defaultMessage: 'No results'});
    }

    return (
        <div className='FindBar'>
            <input
                ref={inputRef}
                className='FindBar__input'
                type='text'
                value={query}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder={formatMessage({id: 'renderer.components.findBar.placeholder', defaultMessage: 'Find in page'})}
                aria-label={formatMessage({id: 'renderer.components.findBar.placeholder', defaultMessage: 'Find in page'})}
            />
            <span className='FindBar__count'>{matchLabel}</span>
            <button
                type='button'
                className='FindBar__button'
                onClick={() => window.desktop.findBar.findPrevious()}
                aria-label={formatMessage({id: 'renderer.components.findBar.previous', defaultMessage: 'Previous match'})}
            >
                <FormattedMessage
                    id='renderer.components.findBar.previousShort'
                    defaultMessage='Prev'
                />
            </button>
            <button
                type='button'
                className='FindBar__button'
                onClick={() => window.desktop.findBar.findNext()}
                aria-label={formatMessage({id: 'renderer.components.findBar.next', defaultMessage: 'Next match'})}
            >
                <FormattedMessage
                    id='renderer.components.findBar.nextShort'
                    defaultMessage='Next'
                />
            </button>
            <button
                type='button'
                className='FindBar__button FindBar__button--close'
                onClick={() => window.desktop.findBar.close()}
                aria-label={formatMessage({id: 'renderer.components.findBar.close', defaultMessage: 'Close find'})}
            >
                <FormattedMessage
                    id='renderer.components.findBar.closeShort'
                    defaultMessage='Close'
                />
            </button>
        </div>
    );
}
