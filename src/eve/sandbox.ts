import {
  defaultBackend,
  defineSandbox,
  type DefaultBackendOptions,
  type SandboxDefinition,
} from "eve/sandbox";
import { justbash } from "eve/sandbox/just-bash";

export interface ImpelDefaultSandboxOptions {
  backend?: DefaultBackendOptions;
}

export function impelJustBashSandbox(): SandboxDefinition {
  return defineSandbox({
    backend: justbash(),
    async onSession({ use }) {
      await use();
    },
  });
}

export function impelDefaultSandbox({
  backend = { vercel: { runtime: "node24", resources: { vcpus: 2 } } },
}: ImpelDefaultSandboxOptions = {}): SandboxDefinition {
  return defineSandbox({
    backend: defaultBackend(backend),
    async onSession({ use }) {
      await use();
    },
  });
}
