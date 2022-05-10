// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Utility functions for data structures.

/** helper function for sorting, simulating python's "key" argument for its sort function.
 * Accepts a function that should return the field
 * that the iterable's contents should be sorted by.
 */
export function by(f: (x: any) => number|string): (a: any, b: any) => number {
    return (function by(a, b) {
        const fa = f(a);
        const fb = f(b);
        if (fa < fb) {
            return -1;
        } else if (fa > fb) {
            return 1;
        }
        return 0;
    });
}

/** Creates an array of exactly two elements.
 * This is useful because the typescript type checker
 * deduces Array<string|number> from [0, '1']
 * and not [number, string]
 */
export function duad<A, B>(a: A, b: B): [A, B] {
    return [a, b];
}
