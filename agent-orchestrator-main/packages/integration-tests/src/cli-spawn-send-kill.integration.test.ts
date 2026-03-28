/**
 * Integration tests for CLI spawn → send → kill workflow.
 *
 * Requires:
 *   - tmux installed and running
 *
 * Tests real tmux sessions with trivial shell commands (no agent binaries needed).
 * Validates that the CLI's tmux interactions work end-to-end.
 */

import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
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

const SESSION_PREFIX = "ao-inttest-cli-";

const tmuxOk = await isTmuxAvailable();

describe.skipIf(!tmuxOk)("CLI spawn-send-kill workflow (integration)", () => {
  const sessionName = `${SESSION_PREFIX}${Date.now()}`;
  let tmpDir: string;

  beforeAll(async () => {
    await killSessionsByPrefix(SESSION_PREFIX);
    const raw = await mkdtemp(join(tmpdir(), "ao-inttest-cli-"));
    tmpDir = await realpath(raw);
  }, 30_000);

  afterAll(async () => {
    await killSession(sessionName);
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  }, 30_000);

  it("creates a real tmux session and verifies it exists", async () => {
    // Create a tmux session with a simple shell (cat will keep it alive)
    await createSession(sessionName, "bash", tmpDir);

    // Verify tmux has-session succeeds
    const { stdout } = await execFileAsync("tmux", ["has-session", "-t", sessionName], {
      timeout: 5_000,
    }).catch(() => ({ stdout: "FAIL" }));

    // has-session produces no stdout on success, throws on failure
    expect(stdout).not.toBe("FAIL");
  });

  it("sends keys to the session and verifies they appear in output", async () => {
    const marker = `INTTEST_MARKER_${Date.now()}`;

    // Send an echo command
    await execFileAsync("tmux", ["send-keys", "-t", sessionName, "-l", `echo ${marker}`], {
      timeout: 5_000,
    });
    await sleep(200);
    await execFileAsync("tmux", ["send-keys", "-t", sessionName, "Enter"], {
      timeout: 5_000,
    });

    // Wait for output to appear
    await sleep(1_000);

    const output = await capturePane(sessionName);
    expect(output).toContain(marker);
  });

  it("kills the session and verifies it is gone", async () => {
    await killSession(sessionName);

    // has-session should now fail
    const result = await execFileAsync("tmux", ["has-session", "-t", sessionName], {
      timeout: 5_000,
    }).catch(() => "GONE");

    expect(result).toBe("GONE");
  });

  it("handles killing an already-killed session gracefully", async () => {
    // Should not throw even though session is already gone
    await expect(killSession(sessionName)).resolves.not.toThrow();
  });
});

describe.skipIf(!tmuxOk)("CLI metadata integration (integration)", () => {
  const sessionName = `${SESSION_PREFIX}meta-${Date.now()}`;
  let tmpDir: string;

  beforeAll(async () => {
    const raw = await mkdtemp(join(tmpdir(), "ao-inttest-meta-"));
    tmpDir = await realpath(raw);
  }, 10_000);

  afterAll(async () => {
    await killSession(sessionName);
    if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
  }, 10_000);

  it("writes and reads metadata files correctly", async () => {
    const sessionDir = join(tmpDir, "project-sessions");
    mkdirSync(sessionDir, { recursive: true });

    const metaFile = join(sessionDir, sessionName);
    const metadata = [
      `worktree=${tmpDir}`,
      `branch=feat/INT-123`,
      `status=working`,
      `issue=INT-123`,
      `pr=https://github.com/org/repo/pull/42`,
    ].join("\n");

    writeFileSync(metaFile, metadata + "\n");
    expect(existsSync(metaFile)).toBe(true);

    const content = readFileSync(metaFile, "utf-8");
    expect(content).toContain("branch=feat/INT-123");
    expect(content).toContain("status=working");
    expect(content).toContain("issue=INT-123");
    expect(content).toContain("pr=https://github.com/org/repo/pull/42");
  });
});
