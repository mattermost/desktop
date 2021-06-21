// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type ServerFromURL = {
    name: string;
    url: URL;
    index: number;
}

export type Boundaries = {
    maxX: number;
    maxY: number;
    minX: number;
    minY: number;
    maxWidth: number;
    maxHeight: number;
}
