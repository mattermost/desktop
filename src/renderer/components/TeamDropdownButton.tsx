// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';

type Props = {
    activeServerName: string;
    totalMentionCount: number;
}

const TeamDropdownButton: React.FC<Props> = (props: Props) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    return (
        <div></div>
    );
};

export default TeamDropdownButton;
