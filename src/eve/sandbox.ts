import {
  defaultBackend,
  defineSandbox,
  type DefaultBackendOptions,
  type SandboxDefinition,
  type SandboxSession,
} from "eve/sandbox";
import { justbash } from "eve/sandbox/just-bash";

export interface ImpelDefaultSandboxOptions {
  backend?: DefaultBackendOptions;
  installWorkspaceTools?: boolean;
}

const DEFAULT_GH_CLI_VERSION = "2.63.2";
const SANDBOX_TOOLS_REVALIDATION_KEY = "impel-default-workspace-tools-v1";

export function impelJustBashSandbox(): SandboxDefinition {
  return defineSandbox({
    backend: justbash(),
    async onSession({ use }) {
      await use();
    },
  });
}

export function impelDefaultSandbox({
  backend = { vercel: { resources: { vcpus: 2 } } },
  installWorkspaceTools = true,
}: ImpelDefaultSandboxOptions = {}): SandboxDefinition {
  return defineSandbox({
    backend: defaultBackend(backend),
    revalidationKey: () =>
      [
        SANDBOX_TOOLS_REVALIDATION_KEY,
        installWorkspaceTools ? "tools" : "minimal",
        process.env.IMPEL_EVE_GH_CLI_VERSION ?? DEFAULT_GH_CLI_VERSION,
      ].join(":"),
    async bootstrap({ use }) {
      const sandbox = await use();
      if (installWorkspaceTools) {
        await installImpelWorkspaceTools(sandbox);
      }
    },
    async onSession({ use }) {
      await use();
    },
  });
}

export async function installImpelWorkspaceTools(
  sandbox: Pick<SandboxSession, "run">,
): Promise<void> {
  const ghCliVersion =
    process.env.IMPEL_EVE_GH_CLI_VERSION ?? DEFAULT_GH_CLI_VERSION;

  await runBootstrapCommand(
    sandbox,
    "install workspace binaries",
    [
      "set -eu",
      "export DEBIAN_FRONTEND=noninteractive",
      'if command -v apt-get >/dev/null 2>&1; then',
      "  apt-get update",
      [
        "  apt-get install -y --no-install-recommends",
        "bash",
        "ca-certificates",
        "curl",
        "git",
        "git-lfs",
        "jq",
        "openssh-client",
        "ripgrep",
        "tar",
        "unzip",
        "xz-utils",
      ].join(" "),
      "  rm -rf /var/lib/apt/lists/*",
      "else",
      '  echo "apt-get is not available; expected a Vercel/Debian-compatible Eve sandbox image." >&2',
      "  exit 1",
      "fi",
      "git lfs install --skip-repo >/dev/null 2>&1 || true",
      "if ! command -v gh >/dev/null 2>&1; then",
      `  GH_VERSION=${shellQuote(ghCliVersion)}`,
      '  ARCH="$(uname -m)"',
      '  case "$ARCH" in',
      '    x86_64|amd64) GH_ARCH="amd64" ;;',
      '    aarch64|arm64) GH_ARCH="arm64" ;;',
      '    *) echo "Unsupported architecture for gh CLI: $ARCH" >&2; exit 1 ;;',
      "  esac",
      '  curl -fsSL "https://github.com/cli/cli/releases/download/v${GH_VERSION}/gh_${GH_VERSION}_linux_${GH_ARCH}.tar.gz" -o /tmp/gh.tgz',
      "  tar -xzf /tmp/gh.tgz -C /tmp",
      '  install -m 0755 "/tmp/gh_${GH_VERSION}_linux_${GH_ARCH}/bin/gh" /usr/local/bin/gh',
      '  rm -rf /tmp/gh.tgz "/tmp/gh_${GH_VERSION}_linux_${GH_ARCH}"',
      "fi",
      "git --version",
      "gh --version",
      "rg --version",
      "jq --version",
    ].join("\n"),
  );
}

async function runBootstrapCommand(
  sandbox: Pick<SandboxSession, "run">,
  label: string,
  command: string,
): Promise<void> {
  const result = await sandbox.run({ command });
  if (result.exitCode === 0) return;

  throw new Error(
    [
      `Eve sandbox bootstrap failed during ${label} (exit ${result.exitCode}).`,
      result.stderr ? `stderr: ${result.stderr}` : undefined,
      result.stdout ? `stdout: ${result.stdout}` : undefined,
    ]
      .filter((line): line is string => Boolean(line))
      .join(" "),
  );
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}
