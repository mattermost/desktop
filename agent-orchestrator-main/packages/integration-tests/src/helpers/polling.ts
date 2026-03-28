/**
 * Polling utilities for integration tests.
 */

/** Sleep for the given number of milliseconds. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Poll a function until it returns a truthy value or the timeout expires.
 * Returns the last value returned by `fn`.
 */
export async function pollUntil<T>(
  fn: () => Promise<T>,
  opts: { timeoutMs: number; intervalMs?: number },
): Promise<T> {
  const { timeoutMs, intervalMs = 1_000 } = opts;
  const deadline = Date.now() + timeoutMs;
  let last: T;
  do {
    last = await fn();
    if (last) return last;
    if (Date.now() >= deadline) break;
    await sleep(intervalMs);
  } while (Date.now() < deadline);
  return last;
}

/**
 * Poll a function until its return value equals the expected value
 * or the timeout expires. Returns the last value.
 */
export async function pollUntilEqual<T>(
  fn: () => Promise<T>,
  expected: T,
  opts: { timeoutMs: number; intervalMs?: number },
): Promise<T> {
  const { timeoutMs, intervalMs = 1_000 } = opts;
  const deadline = Date.now() + timeoutMs;
  let last: T;
  do {
    last = await fn();
    if (last === expected) return last;
    if (Date.now() >= deadline) break;
    await sleep(intervalMs);
  } while (Date.now() < deadline);
  return last;
}
