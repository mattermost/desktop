// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import LoadingScreen from './LoadingScreen';

const mockRef: {current: {classList: {contains: jest.Mock}} | null} = {current: null};
const mockSetState = jest.fn();
const mockUseTransitionEnd = jest.fn();

jest.mock('react', () => ({
    __esModule: true,
    default: {
        createElement: jest.fn(),
        useRef: () => mockRef,
        useState: (initial: unknown) => [initial, mockSetState],
        useEffect: jest.fn(),
        useCallback: (callback: () => void) => callback,
    },
}));

jest.mock('../../hooks/useTransitionEnd', () => ({
    __esModule: true,
    default: (...args: unknown[]) => mockUseTransitionEnd(...args),
}));

jest.mock('renderer/components/Images/background', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('renderer/components/LoadingAnimation', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('./LoadingScreen.scss', () => ({}));

describe('renderer/components/LoadingScreen', () => {
    const onFadeOutComplete = jest.fn();

    const renderAndGetOpacityTransitionEndHandler = () => {
        LoadingScreen({loading: false, onFadeOutComplete});
        const [ref, callback, properties] = mockUseTransitionEnd.mock.calls[0];
        expect(ref).toBe(mockRef);
        expect(properties).toEqual(['opacity']);
        return callback as () => void;
    };

    beforeEach(() => {
        mockRef.current = {classList: {contains: jest.fn()}};
    });

    it('should render the class that marks the fade out once loading and the load animation are complete', () => {
        LoadingScreen({loading: false, onFadeOutComplete});

        const [, props] = jest.mocked(React.createElement).mock.calls.find(([type]) => type === 'div')!;
        expect((props as {className: string}).className.split(' ')).toContain('LoadingScreen--loaded');
    });

    it('should report the fade out as complete when the opacity transition ends while fading out', () => {
        mockRef.current?.classList.contains.mockImplementation((className) => className === 'LoadingScreen--loaded');

        renderAndGetOpacityTransitionEndHandler()();

        expect(mockSetState).toHaveBeenCalledWith(true);
        expect(onFadeOutComplete).toHaveBeenCalledTimes(1);
    });

    it('should not report the fade out as complete when loading restarted and reversed the opacity transition', () => {
        mockRef.current?.classList.contains.mockReturnValue(false);

        renderAndGetOpacityTransitionEndHandler()();

        expect(mockSetState).not.toHaveBeenCalled();
        expect(onFadeOutComplete).not.toHaveBeenCalled();
    });

    it('should not report the fade out as complete when the element is no longer rendered', () => {
        mockRef.current = null;

        renderAndGetOpacityTransitionEndHandler()();

        expect(mockSetState).not.toHaveBeenCalled();
        expect(onFadeOutComplete).not.toHaveBeenCalled();
    });
});
