import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import test from "node:test";
import {
  createImpelEveChannelState,
  prepareImpelEveWorkspace,
} from "../dist/eve/channel.js";

const execFileAsync = promisify(execFile);

test("partial sparse checkout materializes wiki but not raw and preserves exact SHA", async () => {
  const fixture = await createGitFixture();
  const previousToken = process.env.IMPEL_EVE_GITHUB_TOKEN;
  try {
    process.env.IMPEL_EVE_GITHUB_TOKEN = "test-token";

    const sparseRoot = join(fixture.root, "sparse-sandbox");
    const sparseSandbox = createLocalSandbox(
      sparseRoot,
      fixture.remote,
      "CreadorFund/impel-wiki",
    );
    const sparseState = createImpelEveChannelState(
      exactRunContext(fixture.sha),
    );
    await prepareImpelEveWorkspace(sparseState, {
      attachedRepoSparsePaths: {
        "creadorfund/IMPEL-WIKI": ["wiki"],
      },
      getSandbox: async () => sparseSandbox,
    });

    assert.equal(
      await readFile(join(sparseRoot, "wiki", "answer.md"), "utf8"),
      "knowledge\n",
    );
    assert.equal(
      await readFile(join(sparseRoot, "manifest.json"), "utf8"),
      '{"version":1}\n',
      "cone mode keeps required root metadata",
    );
    await assert.rejects(
      readFile(join(sparseRoot, "raw", "source.txt"), "utf8"),
      { code: "ENOENT" },
    );

    const tracked = await git(["-C", sparseRoot, "ls-files", "-t"]);
    assert.match(tracked, /^H wiki\/answer\.md$/m);
    assert.match(tracked, /^S raw\/source\.txt$/m);
    assert.equal(
      (await git(["-C", sparseRoot, "config", "--get", "remote.origin.promisor"])).trim(),
      "true",
    );
    assert.equal(
      (await git([
        "-C",
        sparseRoot,
        "config",
        "--get",
        "remote.origin.partialclonefilter",
      ])).trim(),
      "blob:none",
    );
    await assert.rejects(
      gitWithoutLazyFetch([
        "-C",
        sparseRoot,
        "cat-file",
        "-e",
        "HEAD:raw/source.txt",
      ]),
      "excluded blobs must not be downloaded during sparse preparation",
    );
    assert.equal(sparseState.workspace.repos[0].ref, fixture.sha);
    assert.equal(sparseState.workspace.repos[0].sha, fixture.sha);
    const marker = JSON.parse(
      await readFile(
        join(sparseRoot, ".impel", "run-context.json"),
        "utf8",
      ),
    );
    assert.equal(marker.repos[0].ref, fixture.sha);
    assert.equal(marker.repos[0].sha, fixture.sha);
    assert.ok(
      sparseSandbox.commands.some((command) =>
        command.includes("git fetch --filter=blob:none"),
      ),
    );

    const transitionCommandIndex = sparseSandbox.commands.length;
    await prepareImpelEveWorkspace(sparseState, {
      getSandbox: async () => sparseSandbox,
    });
    assert.equal(
      await readFile(join(sparseRoot, "raw", "source.txt"), "utf8"),
      "large original\n",
      "reusing a sparse single-repo sandbox for a full checkout restores excluded files",
    );
    assert.equal(
      (await git([
        "-C",
        sparseRoot,
        "config",
        "--bool",
        "core.sparseCheckout",
      ])).trim(),
      "false",
    );
    await gitWithoutLazyFetch([
      "-C",
      sparseRoot,
      "cat-file",
      "-e",
      "HEAD:raw/source.txt",
    ]);
    assert.ok(
      sparseSandbox.commands
        .slice(transitionCommandIndex)
        .some((command) => command.includes("git sparse-checkout disable")),
      "the legacy full-checkout path must explicitly disable stale sparse state",
    );

    const fullRoot = join(fixture.root, "full-sandbox");
    const fullSandbox = createLocalSandbox(
      fullRoot,
      fixture.remote,
      "CreadorFund/impel-wiki",
    );
    const fullState = createImpelEveChannelState(exactRunContext(fixture.sha));
    await prepareImpelEveWorkspace(fullState, {
      getSandbox: async () => fullSandbox,
    });
    assert.equal(
      await readFile(join(fullRoot, "raw", "source.txt"), "utf8"),
      "large original\n",
      "unconfigured repositories retain the full checkout behavior",
    );
    assert.equal(
      fullSandbox.commands.some((command) =>
        command.includes("--filter=blob:none"),
      ),
      false,
      "a fresh full checkout must not request partial-clone filtering",
    );
  } finally {
    if (previousToken === undefined) {
      delete process.env.IMPEL_EVE_GITHUB_TOKEN;
    } else {
      process.env.IMPEL_EVE_GITHUB_TOKEN = previousToken;
    }
    await rm(fixture.root, { recursive: true, force: true });
  }
});

function exactRunContext(sha) {
  return {
    repos: ["CreadorFund/impel-wiki"],
    branch: "main",
    codeIntelligence: {
      workspaceId: "ws_sparse_test",
      repositories: [
        {
          provider: "github",
          providerRepoId: "123",
          repoFullName: "CreadorFund/impel-wiki",
          commitSha: sha,
          requestedRef: "main",
        },
      ],
    },
  };
}

async function createGitFixture() {
  const root = await mkdtemp(join(tmpdir(), "eve-kit-sparse-"));
  const source = join(root, "source");
  const remote = join(root, "remote.git");
  await mkdir(join(source, "wiki"), { recursive: true });
  await mkdir(join(source, "raw"), { recursive: true });
  await writeFile(join(source, "wiki", "answer.md"), "knowledge\n");
  await writeFile(join(source, "raw", "source.txt"), "large original\n");
  await writeFile(join(source, "manifest.json"), '{"version":1}\n');
  await git(["init", source]);
  await git(["-C", source, "config", "user.email", "test@example.com"]);
  await git(["-C", source, "config", "user.name", "Eve Kit Test"]);
  await git(["-C", source, "add", "."]);
  await git(["-C", source, "commit", "-m", "fixture"]);
  const sha = (await git(["-C", source, "rev-parse", "HEAD"])).trim();
  await git(["clone", "--bare", source, remote]);
  await git(["--git-dir", remote, "config", "uploadpack.allowFilter", "true"]);
  await git([
    "--git-dir",
    remote,
    "config",
    "uploadpack.allowAnySHA1InWant",
    "true",
  ]);
  return { root, remote, sha };
}

function createLocalSandbox(root, remote, repoFullName) {
  const commands = [];
  const home = join(root, ".home");
  const githubRemote = `https://github.com/${repoFullName}.git`;
  const localRemote = pathToFileURL(remote).href;
  return {
    id: `sandbox_${root}`,
    commands,
    resolvePath(path) {
      return resolveSandboxPath(root, path);
    },
    async run({ command }) {
      commands.push(command);
      const localCommand = command.replaceAll("/workspace", root);
      try {
        const result = await execFileAsync("/bin/sh", ["-c", localCommand], {
          env: {
            ...process.env,
            GIT_CONFIG_COUNT: "2",
            GIT_CONFIG_KEY_0: `url.${localRemote}.insteadOf`,
            GIT_CONFIG_VALUE_0: githubRemote,
            GIT_CONFIG_KEY_1: "protocol.file.allow",
            GIT_CONFIG_VALUE_1: "always",
            HOME: home,
          },
          maxBuffer: 1024 * 1024,
        });
        return { exitCode: 0, stderr: result.stderr, stdout: result.stdout };
      } catch (error) {
        return {
          exitCode: error.code ?? 1,
          stderr: error.stderr ?? error.message,
          stdout: error.stdout ?? "",
        };
      }
    },
    async setNetworkPolicy() {},
    async writeTextFile({ path, content }) {
      const localPath = resolveSandboxPath(root, path);
      await mkdir(dirname(localPath), { recursive: true });
      await writeFile(localPath, content);
    },
  };
}

function resolveSandboxPath(root, path) {
  assert.ok(path === "/workspace" || path.startsWith("/workspace/"));
  return path === "/workspace"
    ? root
    : join(root, path.slice("/workspace/".length));
}

async function git(args) {
  const result = await execFileAsync("git", args, {
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
  });
  return result.stdout;
}

async function gitWithoutLazyFetch(args) {
  const result = await execFileAsync("git", args, {
    encoding: "utf8",
    env: { ...process.env, GIT_NO_LAZY_FETCH: "1" },
    maxBuffer: 1024 * 1024,
  });
  return result.stdout;
}
