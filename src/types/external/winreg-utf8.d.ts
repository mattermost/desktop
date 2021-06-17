// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

declare module 'winreg-utf8' {
    import WindowsRegistry from 'winreg';
    export = WindowsRegistry;
}

declare namespace Winreg {
    export interface Options {

        /**
         * Optional hostname, must start with '\\' sequence.
         */
        host?: string;

        /**
         * Optional hive ID, default is HKLM.
         */
        hive?: string;

        /**
         * Optional key, default is the root key.
         */
        key?: string;

        /**
         * Optional registry hive architecture ('x86' or 'x64'; only valid on Windows 64 Bit Operating Systems).
         */
        arch?: string;

        utf8?: boolean;
    }
}
