// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type Boundaries = {
    maxX: number;
    maxY: number;
    minX: number;
    minY: number;
    maxWidth: number;
    maxHeight: number;
}

export type DeepPartial<T> = {
    [P in keyof T]?: DeepPartial<T[P]>;
}
