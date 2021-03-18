// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import deepmerge from 'deepmerge';

export default function deepMergeProxy(x, y, options) {
    return deepmerge(x, y, options); // due to webpack conversion
}
