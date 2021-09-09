// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {storiesOf} from '@storybook/react';

import {action} from '@storybook/addon-actions';
import {Button, ButtonToolbar} from 'react-bootstrap';

storiesOf('Button', module).
    add('bsStyle', () => (
        <ButtonToolbar>
            <Button onClick={action('clicked default')}>{'Default'}</Button>
            <Button
                onClick={action('clicked primary')}
                variant='primary'
            >{'Primary'}</Button>
            <Button
                onClick={action('clicked danger')}
                variant='danger'
            >{'Danger'}</Button>
            <Button
                onClick={action('clicked link')}
                variant='link'
            >{'Link'}</Button>
        </ButtonToolbar>
    ));
