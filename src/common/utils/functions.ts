// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* Runtime implementation of F#-style function pipelines.
 * Passes an argument x through an array of functions,
 * such that the output of the first becomes the input of the second,
 * and so on for N functions.
 *
 * Its type signature is verbose an inelegant so that type inference
 * can work properly. Signatures are provided for up to 10 functions,
 * which should cover most cases. Add more as need.d
 */
export function pipe<A, B>(
    a: A,
    b: (x: A) => B,
): B;

export function pipe<A, B, C>(
    a: A,
    b: (x: A) => B,
    c: (x: B) => C,
): C;

export function pipe<A, B, C, D>(
    a: A,
    b: (x: A) => B,
    c: (x: B) => C,
    d: (x: C) => D,
): D;

export function pipe<A, B, C, D, E>(
    a: A,
    b: (x: A) => B,
    c: (x: B) => C,
    d: (x: C) => D,
    e: (x: C) => E,
): E;

export function pipe<A, B, C, D, E, F>(
    a: A,
    b: (x: A) => B,
    c: (x: B) => C,
    d: (x: C) => D,
    e: (x: D) => E,
    f: (x: E) => F,
): F;

export function pipe<A, B, C, D, E, F, G>(
    a: A,
    b: (x: A) => B,
    c: (x: B) => C,
    d: (x: C) => D,
    e: (x: C) => E,
    f: (x: E) => F,
    g: (x: F) => G,
): G;

export function pipe<A, B, C, D, E, F, G, H>(
    a: A,
    b: (x: A) => B,
    c: (x: B) => C,
    d: (x: C) => D,
    e: (x: C) => E,
    f: (x: E) => F,
    g: (x: F) => G,
    h: (x: G) => H,
): H;

export function pipe<A, B, C, D, E, F, G, H, I>(
    a: A,
    b: (x: A) => B,
    c: (x: B) => C,
    d: (x: C) => D,
    e: (x: C) => E,
    f: (x: E) => F,
    g: (x: F) => G,
    h: (x: G) => H,
    i: (x: I) => I,
): I;

export function pipe<A, B, C, D, E, F, G, H, I, J>(
    a: A,
    b: (x: A) => B,
    c: (x: B) => C,
    d: (x: C) => D,
    e: (x: C) => E,
    f: (x: E) => F,
    g: (x: F) => G,
    h: (x: G) => H,
    i: (x: H) => I,
    j: (x: I) => J,
): J;

export function pipe<A, B, C, D, E, F, G, H, I, J, K>(
    a: A,
    b: (x: A) => B,
    c: (x: B) => C,
    d: (x: C) => D,
    e: (x: C) => E,
    f: (x: E) => F,
    g: (x: F) => G,
    h: (x: G) => H,
    i: (x: H) => I,
    j: (x: I) => J,
    k: (x: J) => K,
): K;

export function pipe<A>(x: A, ...fs: Array<(x: any) => any>): any {
    let a = x;
    for (const f of fs) {
        a = f(a);
    }
    return a;
}

/* Runtime implementation of F#-style function composition.
 * It works the same as function composition, but in reverse.
 * So instead of (f o g)(x) = g(f(x))
 * we do (f >> g)(x) = f(g(x))
 * so that the order or reading and writing is identical to
 * the order of execution.
 *
 * Its type signature is verbose an inelegant so that type inference
 * can work properly. Signatures are provided for up to 10 functions,
 * which should cover most cases. Add more as need.d
 */
export function compose<A, B, C>(
    b: (x: A) => B,
    c: (x: B) => C,
): (x: A) => C;

export function compose<A, B, C, D>(
    b: (x: A) => B,
    c: (x: B) => C,
    d: (x: C) => D,
): (x: A) => D;

export function compose<A, B, C, D, E>(
    b: (x: A) => B,
    c: (x: B) => C,
    d: (x: C) => D,
    e: (x: D) => E,
): (x: A) => E;

export function compose<A, B, C, D, E, F>(
    b: (x: A) => B,
    c: (x: B) => C,
    d: (x: C) => D,
    e: (x: D) => E,
    f: (x: E) => F,
): (x: A) => F;

export function compose<A, B, C, D, E, F, G>(
    b: (x: A) => B,
    c: (x: B) => C,
    d: (x: C) => D,
    e: (x: D) => E,
    f: (x: E) => F,
    g: (x: F) => G,
): (x: A) => G;

export function compose<A, B, C, D, E, F, G, H>(
    b: (x: A) => B,
    c: (x: B) => C,
    d: (x: C) => D,
    e: (x: D) => E,
    f: (x: E) => F,
    g: (x: F) => G,
    h: (x: G) => H,
): (x: A) => H;

export function compose<A, B, C, D, E, F, G, H, I>(
    b: (x: A) => B,
    c: (x: B) => C,
    d: (x: C) => D,
    e: (x: D) => E,
    f: (x: E) => F,
    g: (x: F) => G,
    h: (x: G) => H,
    i: (x: H) => I,
): (x: A) => I;

export function compose<A, B, C, D, E, F, G, H, I, J>(
    b: (x: A) => B,
    c: (x: B) => C,
    d: (x: C) => D,
    e: (x: D) => E,
    f: (x: E) => F,
    g: (x: F) => G,
    h: (x: G) => H,
    i: (x: H) => I,
    j: (x: J) => J,
): (x: A) => J;

export function compose<A, B, C, D, E, F, G, H, I, J, K>(
    b: (x: A) => B,
    c: (x: B) => C,
    d: (x: C) => D,
    e: (x: D) => E,
    f: (x: E) => F,
    g: (x: F) => G,
    h: (x: G) => H,
    i: (x: H) => I,
    j: (x: I) => J,
    k: (x: J) => K,
): (x: A) => K;

export function compose<A>(...fs: Array<(x: any) => any>): (x: A) => any {
    return (function compose(x) {
        let a = x;
        for (const f of fs) {
            a = f(a);
        }
        return a;
    });
}
