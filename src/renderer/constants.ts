// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export const Constants = {
    SECOND_MS: 1000,
    MINUTE_MS: 60 * 1000,
    HOUR_MS: 60 * 60 * 1000,
    ICON_NAME_FROM_MIME_TYPE: {
        'application/pdf': 'pdf',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'ppt',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'excel',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'word',
        'application/x-apple-diskimage': 'generic',
        'application/zip': 'zip',
        'audio/mpeg': 'audio',
        'image/jpeg': 'image',
        'text/html': 'code',
        'text/plain': 'text',
        'video/mp4': 'video',
    },
    ICON_NAME_FROM_EXTENSION: {
        pdf: 'pdf',
        doc: 'word',
        docx: 'word',
        ppt: 'ppt',
        pptx: 'ppt',
        xls: 'excel',
        xlsx: 'excel',
        patch: 'patch',
        txt: 'text',

        // ZIP
        zip: 'zip',
        rar: 'zip',
        '7z': 'zip',
        tar: 'zip',
        gz: 'zip',

        // Audio
        mp3: 'audio',
        aac: 'audio',
        wav: 'audio',
        flac: 'audio',
        ogg: 'audio',

        // Image
        jpg: 'image',
        jpeg: 'image',
        svg: 'image',
        gif: 'image',
        png: 'image',
        bmp: 'image',
        tif: 'image',
        tiff: 'image',

        // Code
        html: 'code',
        xhtml: 'code',
        htm: 'code',
        css: 'code',
        sass: 'code',
        scss: 'code',
        js: 'code',
        jsx: 'code',
        tsx: 'code',
        ts: 'code',
        go: 'code',
        json: 'code',
        sh: 'code',
        py: 'code',
        rpy: 'code',
        c: 'code',
        cgi: 'code',
        pl: 'code',
        class: 'code',
        cpp: 'code',
        cc: 'code',
        cs: 'code',
        h: 'code',
        java: 'code',
        php: 'code',
        swift: 'code',
        vb: 'code',
        jsp: 'code',
        r: 'code',
        lib: 'code',
        dll: 'code',
        perl: 'code',
        run: 'code',

        // Video
        mp4: 'video',
        mov: 'video',
        wmv: 'video',
        avi: 'video',
        mkv: 'video',
        flv: 'video',
        webm: 'video',
    },

    /**
     * This is the ID of the root portal container that is used to render modals and other components
     * that need to be rendered outside of the main app container.
     */
    RootHtmlPortalId: 'root-portal',
    OverlaysTimings: {
        CURSOR_REST_TIME_BEFORE_OPEN: 400, // in ms
        CURSOR_MOUSEOVER_TO_OPEN: 400, // in ms
        CURSOR_MOUSEOUT_TO_CLOSE: 0,
        CURSOR_MOUSEOUT_TO_CLOSE_WITH_DELAY: 200, // in ms
        FADE_IN_DURATION: 250, // in ms
        FADE_OUT_DURATION: 150, // in ms
    },
    OverlayTransitionStyles: {
        START: {
            opacity: 0,
        },
    },
    OverlayArrow: {
        WIDTH: 10, // in px
        HEIGHT: 6, // in px
        OFFSET: 8, // in px
    },
};
