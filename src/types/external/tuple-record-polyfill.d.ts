// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

declare module '@bloomberg/record-tuple-polyfill' {
    export function Tuple<A>(A): [A];
    export function Tuple<A, B>(a: A, b: B): [A, B];
    export function Tuple<A, B, C>(a: A, b: B, c: C): [A, B, C];
    export function Tuple<A, B, C, D>(a: A, b: B, c: C, d: D): [A, B, C, D];
    export function Tuple<A, B, C, D, E>(a: A, b: B, c: C, d: D, e: E): [A, B, C, D, E];
    export function Tuple<A, B, C, D, E, F>(a: A, b: B, c: C, d: D, e: E, f: F): [A, B, C, D, E, F];
    export function Tuple<A, B, C, D, E, F, G>(a: A, b: B, c: C, d: D, e: E, f: F, g: G): [A, B, C, D, E, F, G];
    export function Tuple<A, B, C, D, E, F, G, H>(a: A, b: B, c: C, d: D, e: E, f: F, g: G, h: H): [A, B, C, D, E, F, G, H];
    export function Tuple<A, B, C, D, E, F, G, H, I>(a: A, b: B, c: C, d: D, e: E, f: F, g: G, h: H, i: I): [A, B, C, D, E, F, G, H, I];
    export function Tuple<A, B, C, D, E, F, G, H, I, J>(a: A, b: B, c: C, d: D, e: E, f: F, g: G, h: H, i: I, j: J): [A, B, C, D, E, F, G, H, I, J];
    export function Record<T>(x: {[key: string]: T}): {[key: string]: T};
}
