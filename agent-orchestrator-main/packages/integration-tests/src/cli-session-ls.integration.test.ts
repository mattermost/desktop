/**
 * Integration tests for session listing with real tmux sessions.
 *
 * Requires:
 *   - tmux installed and running
 *
 * Creates real tmux sessions and verifies they appear in list-sessions output.
 */

import { execFile } from "node:child_process";
import { mkdtemp, rm, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  isTmuxAvailable,
  killSessionsByPrefix,
  createSession,
  killSession,
  capturePane,
} from "./helpers/tmux.js";
import { sleep } from "./helpers/polling.js";

const execFileAsync = promisify(execFile);

const SESSION_PREFIX = "ao-inttest-ls-";

const tmuxOk = await isTmuxAvailable();

describe.skipIf(!tmuxOk)("CLI session listing (integration)", () => {
  const session1 = `${SESSION_PREFIX}1-${Date.now()}`;
  const session2 = `${SESSION_PREFIX}2-${Date.now()}`;
  let tmpDir: string;

  beforeAll(async () => {
    await killSessionsByPrefix(SESSION_PREFIX);
    const raw = await mkdtemp(join(tmpdir(), "ao-inttest-ls-"));
    tmpDir = await realpath(raw);

    // Create two sessions
    await createSession(session1, "bash", tmpDir);
    await createSession(session2, "bash", tmpDir);
    await sleep(500);
  }, 30_000);

  afterAll(async () => {
    await killSession(session1);
    await killSession(session2);
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  }, 30_000);

  it("lists both sessions from tmux", async () => {
    const { stdout } = await execFileAsync("tmux", ["list-sessions", "-F", "#{session_name}"], {
      timeout: 5_000,
    });

    const sessions = stdout.trim().split("\n");
    expect(sessions).toContain(session1);
    expect(sessions).toContain(session2);
  });

  it("captures terminal output from specific session", async () => {
    // Send a command to session1 only
    const marker = `LS_TEST_${Date.now()}`;
    await execFileAsync("tmux", ["send-keys", "-t", session1, "-l", `echo ${marker}`], {
      timeout: 5_000,
    });
    await sleep(200);
    await execFileAsync("tmux", ["send-keys", "-t", session1, "Enter"], { timeout: 5_000 });
    await sleep(1_000);

    const output1 = await capturePane(session1);
    const output2 = await capturePane(session2);

    // Marker should be in session1 but not session2
    expect(output1).toContain(marker);
    expect(output2).not.toContain(marker);
  });

  it("reports session activity timestamp", async () => {
    const { stdout } = await execFileAsync(
      "tmux",
      ["display-message", "-t", session1, "-p", "#{session_activity}"],
      { timeout: 5_000 },
    );

    const ts = parseInt(stdout.trim(), 10);
    expect(isNaN(ts)).toBe(false);
    // Should be within the last 5 minutes
    const now = Math.floor(Date.now() / 1000);
    expect(ts).toBeGreaterThan(now - 300);
    expect(ts).toBeLessThanOrEqual(now + 5);
  });
});
