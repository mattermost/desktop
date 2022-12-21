// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export const measurePerformance = async (beforeRun, test, afterRun, numberOfRuns = 5, durationThreshold) => {
    const testRuns = [];
    for (let i = 0; i < numberOfRuns; i++) {
        testRuns.push((async () => {
            await beforeRun();

            const t0 = performance.now();
            await test();
            const t1 = performance.now();

            await afterRun();

            return t1 - t0;
        })());
    }
    const durations = await Promise.all(testRuns);
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    avgDuration.should.lessThanOrEqual(durationThreshold);
};
