// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import LoadingScreen from './LoadingScreen';

const mockRef: {current: {classList: {contains: jest.Mock}} | null} = {current: null};
const mockSetState = jest.fn();
const mockTransitionEnd = jest.fn();

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
    default: (...args: unknown[]) => mockTransitionEnd(...args),
}));

jest.mock('renderer/components/Images/background', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('renderer/components/LoadingAnimation', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('./LoadingScreen.scss', () => ({}), {virtual: true});

describe('renderer/components/LoadingScreen', () => {
    const onFadeOutComplete = jest.fn();

    const getTransitionEndCallback = () => {
        LoadingScreen({loading: false, onFadeOutComplete});
        const [ref, callback, properties] = mockTransitionEnd.mock.calls[0];
        expect(ref).toBe(mockRef);
        expect(properties).toEqual(['opacity']);
        return callback as () => void;
    };

    beforeEach(() => {
        mockRef.current = {classList: {contains: jest.fn()}};
    });

    it('should not report the fade out as complete when the loaded class is absent', () => {
        mockRef.current?.classList.contains.mockReturnValue(false);

        getTransitionEndCallback()();

        expect(mockRef.current?.classList.contains).toHaveBeenCalledWith('LoadingScreen--loaded');
        expect(mockSetState).not.toHaveBeenCalled();
        expect(onFadeOutComplete).not.toHaveBeenCalled();
    });

    it('should report the fade out as complete when the loaded class is present', () => {
        mockRef.current?.classList.contains.mockReturnValue(true);

        getTransitionEndCallback()();

        expect(mockRef.current?.classList.contains).toHaveBeenCalledWith('LoadingScreen--loaded');
        expect(mockSetState).toHaveBeenCalledWith(true);
        expect(onFadeOutComplete).toHaveBeenCalledTimes(1);
    });

    it('should not report the fade out as complete when the element is gone', () => {
        mockRef.current = null;

        getTransitionEndCallback()();

        expect(onFadeOutComplete).not.toHaveBeenCalled();
    });
});
