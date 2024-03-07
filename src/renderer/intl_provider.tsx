// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {IntlProvider as BaseIntlProvider} from 'react-intl';

import type {Language} from '../../i18n/i18n';

type State = {
    language?: Language;
}

export default class IntlProvider extends React.PureComponent<any, State> {
    constructor(props: any) {
        super(props);
        this.state = {};
    }

    async componentDidMount() {
        await this.getLanguageInformation();
    }

    getLanguageInformation = async () => {
        const language = await window.desktop.getLanguageInformation();
        this.setState({language});
    };

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
