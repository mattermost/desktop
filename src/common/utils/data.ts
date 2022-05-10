// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Utility functions for data structures.

/** Returns whether any variable is iterable. */
export function isIterable(x: any): boolean {
    if (x == null) {
        return false;
    }
    return typeof x[Symbol.iterator] === 'function';
}

/** generic implementation of map
 * Map is defined on functors, allowing us to lift functions
 * from one category onto another, for example turning
 * functions that deal with numbers into functions
 * that deal with arrays of numbers.
 * (where "array" can be any container obeying functor laws)
 *
 * An implementation is provided for iterators for convenience.
 * Note that they are not functors, as the very act of
 * looping through them permanently consumes them.
 */
export function map<A, B, K>(f: (x: A) => B): {
    (xs: A[]): B[];
    (xs: Promise<A>): Promise<B>;
    (xs: Set<A>): Set<B>;
    (xs: Map<K, A>): Map<K, B>;
    (xs: {[key: string]: A}): {[key: string]: B};
    (xs: Iterable<A>): Iterable<B>;
};
export function map<A, B>(f: (x: A) => B): (xs: any) => any {
    return (function map(xs) {
        if (!xs) {
            throw new TypeError('invalid collection type');
        } else if (Array.isArray(xs)) {
            return xs.map(f);
        } else if (xs instanceof Promise) {
            return xs.then(f);
        } else if (xs instanceof Set) {
            return mapSet(f, xs);
        } else if (xs instanceof Map) {
            return mapMap(f, xs);
        } else if (isIterable(xs)) {
            return mapIterable(f, xs);
        } else if (typeof xs === 'object') {
            return mapRecord(f, xs);
        } else {
            throw new TypeError('invalid collection type');
        }
    });
}

// helper functions for map
export function mapSet<A, B>(f: (x: A) => B, xs: Set<A>): Set<B> {
    const s: Set<B> = new Set();
    for (const x of xs) {
        s.add(f(x));
    }
    return s;
}

export function mapMap<A, B, K>(f: (x: A) => B, xs: Map<K, A>): Map<K, B> {
    const m: Map<K, B> = new Map();
    for (const [k, x] of xs.entries()) {
        m.set(k, f(x));
    }
    return m;
}

export function mapRecord<A, B>(f: (x: A) => B, xs: {[key: string]: A}): {[key: string]: B} {
    const o: {[key: string]: B} = {};
    for (const [k, x] of Object.entries(xs)) {
        o[k] = f(x);
    }
    return o;
}

export function* mapIterable<A, B>(f: (x: A) => B, xs: Iterable<A>): Iterable<B> {
    for (const x of xs) {
        yield f(x);
    }
}

/** generic implementation of bind
 * Bind is defined on monads, and is similar to map,
 * except it automatically unwraps nested monads.
 * Thus, an array of arrays of integers becomes
 * an array of integers. This is equivalent to mapping
 * and flattening one level.
 *
 * An implementation is provided for iterators for convenience.
 * Not that they are not monads, as looping through them
 * permanently consumes them.
 */
export function bind<A, B>(f: (x: A) => B[]): (xs: A[]) => B[];
export function bind<A, B>(f: (x: A) => Promise<B>): (xs: Promise<A>) => Promise<B>;
export function bind<A, B>(f: (x: A) => Set<B>): (xs: Set<A>) => Set<B>;
export function bind<A, B>(f: (x: A) => Iterable<B>): (xs: Iterable<A>) => Iterable<B>;
export function bind<A>(f: (x: A) => any): (xs: any) => any {
    return (function bind(xs) {
        if (!xs) {
            throw new TypeError('invalid collection type');
        } else if (Array.isArray(xs)) {
            return xs.flatMap(f);
        } else if (xs instanceof Promise) {
            return xs.then(f);
        } else if (xs instanceof Set) {
            return bindSet(f, xs);
        } else if (isIterable(xs)) {
            return bindIterable(f, xs);
        } else {
            throw new TypeError('invalid collection type');
        }
    });
}

// helper functions for bind
function bindSet<A, B>(f: (x: A) => Set<B>, xs: Set<A>): Set<B> {
    const s: Set<B> = new Set();
    for (const x of xs) {
        const ys = f(x);
        for (const y of ys) {
            s.add(y);
        }
    }
    return s;
}

function* bindIterable<A, B>(f: (x: A) => Iterable<B>, xs: Iterable<A>): Iterable<B> {
    for (const x of xs) {
        yield* f(x);
    }
}

/** curried implementation of sort for any iterable */
export function sort<T>(f: (a: T, b: T) => number): (xs: Iterable<T>) => T[] {
    return (function sort(xs) {
        if (Array.isArray(xs)) {
            return xs.sort(f);
        } else if (isIterable(xs)) {
            return Array.from(xs).sort(f);
        }
        throw new TypeError('invalid collection type');
    });
}

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

/** splits any iterable into two arrays, depending on whether they pass a filter function
 * items that pass are on the left, and items that don't are on the right
 */
export function partition<T>(f: (x: T) => boolean): (xs: Iterable<T>) => [T[], T[]] {
    return (function partition(xs) {
        const trues: T[] = [];
        const falses: T[] = [];
        for (const x of xs) {
            if (f(x)) {
                trues.push(x);
            } else {
                falses.push(x);
            }
        }
        return [trues, falses];
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
