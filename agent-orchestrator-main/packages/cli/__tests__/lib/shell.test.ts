import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockExecFile } = vi.hoisted(() => ({
  mockExecFile: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  execFile: mockExecFile,
}));

import {
  exec,
  execSilent,
  tmux,
  git,
  gh,
  getTmuxSessions,
  getTmuxActivity,
} from "../../src/lib/shell.js";

beforeEach(() => {
  mockExecFile.mockReset();
});

function mockSuccess(stdout: string, stderr = ""): void {
  mockExecFile.mockImplementation(
    (
      _cmd: string,
      _args: string[],
      _opts: unknown,
      cb: (err: null, result: { stdout: string; stderr: string }) => void,
    ) => {
      cb(null, { stdout, stderr });
    },
  );
}

function mockFailure(message = "command failed"): void {
  mockExecFile.mockImplementation(
    (_cmd: string, _args: string[], _opts: unknown, cb: (err: Error) => void) => {
      cb(new Error(message));
    },
  );
}

describe("exec", () => {
  it("returns stdout and stderr trimmed", async () => {
    mockSuccess("  hello world  \n", "  stderr output  \n");
    const result = await exec("echo", ["hello"]);
    expect(result.stdout).toBe("  hello world");
    expect(result.stderr).toBe("  stderr output");
  });

  it("passes cwd and env options", async () => {
    mockSuccess("ok");
    await exec("cmd", ["arg"], { cwd: "/tmp", env: { FOO: "bar" } });
    expect(mockExecFile).toHaveBeenCalledWith(
      "cmd",
      ["arg"],
      expect.objectContaining({ cwd: "/tmp" }),
      expect.any(Function),
    );
    const opts = mockExecFile.mock.calls[0][2];
    expect(opts.env).toMatchObject({ FOO: "bar" });
  });

  it("throws on command failure", async () => {
    mockFailure("bad command");
    await expect(exec("bad", [])).rejects.toThrow("bad command");
  });
});

describe("execSilent", () => {
  it("returns stdout on success", async () => {
    mockSuccess("output\n");
    const result = await execSilent("cmd", []);
    expect(result).toBe("output");
  });

  it("returns null on failure", async () => {
    mockFailure();
    const result = await execSilent("cmd", []);
    expect(result).toBeNull();
  });
});

describe("tmux", () => {
  it("delegates to execSilent with tmux command", async () => {
    mockSuccess("session-1\n");
    const result = await tmux("list-sessions");
    expect(mockExecFile).toHaveBeenCalledWith(
      "tmux",
      ["list-sessions"],
      expect.any(Object),
      expect.any(Function),
    );
    expect(result).toBe("session-1");
  });

  it("returns null on failure", async () => {
    mockFailure();
    const result = await tmux("bad-cmd");
    expect(result).toBeNull();
  });
});

describe("git", () => {
  it("returns stdout on success", async () => {
    mockSuccess("main\n");
    const result = await git(["branch", "--show-current"]);
    expect(result).toBe("main");
  });

  it("returns null on failure", async () => {
    mockFailure();
    const result = await git(["status"]);
    expect(result).toBeNull();
  });

  it("passes cwd argument", async () => {
    mockSuccess("ok");
    await git(["status"], "/my/repo");
    expect(mockExecFile).toHaveBeenCalledWith(
      "git",
      ["status"],
      expect.objectContaining({ cwd: "/my/repo" }),
      expect.any(Function),
    );
  });
});

describe("gh", () => {
  it("returns stdout on success", async () => {
    mockSuccess("MERGED\n");
    const result = await gh(["pr", "view"]);
    expect(result).toBe("MERGED");
  });

  it("returns null on failure", async () => {
    mockFailure();
    const result = await gh(["pr", "view"]);
    expect(result).toBeNull();
  });
});

describe("getTmuxSessions", () => {
  it("parses newline-separated session names", async () => {
    mockSuccess("app-1\napp-2\nother-3\n");
    const result = await getTmuxSessions();
    expect(result).toEqual(["app-1", "app-2", "other-3"]);
  });

  it("returns empty array when tmux fails", async () => {
    mockFailure();
    const result = await getTmuxSessions();
    expect(result).toEqual([]);
  });

  it("filters out empty lines", async () => {
    mockSuccess("app-1\n\napp-2\n");
    const result = await getTmuxSessions();
    expect(result).toEqual(["app-1", "app-2"]);
  });
});

describe("getTmuxActivity", () => {
  it("parses unix timestamp and converts to milliseconds", async () => {
    mockSuccess("1700000000\n");
    const result = await getTmuxActivity("session-1");
    expect(result).toBe(1700000000000);
  });

  it("returns null on failure", async () => {
    mockFailure();
    const result = await getTmuxActivity("session-1");
    expect(result).toBeNull();
  });

  it("returns null for non-numeric output", async () => {
    mockSuccess("not-a-number\n");
    const result = await getTmuxActivity("session-1");
    expect(result).toBeNull();
  });
});
