// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Certificate} from 'electron/common';

export type ComparableCertificate = {
    data: string;
    issuerName: string;
    dontTrust: boolean;
}

export type CertificateModalData = {
    url: string;
    list: Certificate[];
}
