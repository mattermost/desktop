// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {IntlProvider as BaseIntlProvider} from 'react-intl';

import {GET_LANGUAGE_INFORMATION, RETRIEVED_LANGUAGE_INFORMATION} from 'common/communication';

import {Language} from '../../i18n/i18n';

type State = {
    language?: Language;
}

export default class IntlProvider extends React.PureComponent<any, State> {
    constructor(props: any) {
        super(props);
        this.state = {};
    }

    componentDidMount() {
        window.addEventListener('message', this.handleMessageEvent);
        window.postMessage({type: GET_LANGUAGE_INFORMATION});
    }

    componentWillUnmount() {
        window.removeEventListener('message', this.handleMessageEvent);
    }

    handleMessageEvent = (event: MessageEvent<{type: string; data: Language}>) => {
        if (event.data.type === RETRIEVED_LANGUAGE_INFORMATION) {
            this.setState({
                language: event.data.data,
            });
        }
    }

    render() {
        if (!this.state.language) {
            return null;
        }

        return (
            <BaseIntlProvider
                key={this.state.language.value}
                locale={this.state.language.value}
                messages={this.state.language.url}
                textComponent='span'
                wrapRichTextChunksInFragment={false}
            >
                {this.props.children}
            </BaseIntlProvider>
        );
    }
}
