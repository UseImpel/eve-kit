import { defaultBackend, defineSandbox, } from "eve/sandbox";
import { justbash } from "eve/sandbox/just-bash";
export function impelJustBashSandbox() {
    return defineSandbox({
        backend: justbash(),
        async onSession({ use }) {
            await use();
        },
    });
}
export function impelDefaultSandbox({ backend = { vercel: { runtime: "node24", resources: { vcpus: 2 } } }, } = {}) {
    return defineSandbox({
        backend: defaultBackend(backend),
        async onSession({ use }) {
            await use();
        },
    });
}
//# sourceMappingURL=sandbox.js.map