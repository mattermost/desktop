// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import type {ReactNode} from 'react';
import React, {memo} from 'react';
import type {MessageDescriptor} from 'react-intl';

interface Props {
    title: string | ReactNode | MessageDescriptor;
    isEmojiLarge?: boolean;
    hint?: string | ReactNode | MessageDescriptor;
}

function TooltipContent(props: Props) {
    return (
        <div className='tooltipContent'>
            <span
                className={classNames('tooltipContentTitleContainer', {
                    isEmojiLarge: props.isEmojiLarge,
                })}
            >
                <span className='tooltipContentTitle'>{props.title}</span>
            </span>
            {props.hint && (
                <span className='tooltipContentHint'>{props.hint}</span>
            )}
        </div>
    );
}

export default memo(TooltipContent);
