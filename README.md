# create-dhee-runner

Scaffold a new **dhee-runner-** package — a node executor for the [Dhee](https://github.com/dheeai) engine (`dhee-core`).

```sh
npm create dhee-runner my-cool-model -- --template comfy
# → dhee-runner-my-cool-model/
```

## What it generates

A ready-to-build package wired to [`@dheeai/runner-sdk`](https://github.com/dheeai/dhee-runner-sdk):

- `package.json` with the `dhee-runner` keyword guard, the `dhee.runners` entry point, and the `@dheeai/runner-sdk` dependency.
- `src/index.ts` exporting `{ manifest, runner }` (and `export const runners = [...]` for discovery) via `defineRunner`.
- A `runner.json` manifest, `tsconfig.json`, and build scripts.

## Options

```
npm create dhee-runner <name> [--template api|comfy] [--tool <tool.id>]
```

- `--template api` (default) — a cloud/HTTP-API runner skeleton.
- `--template comfy` — a ComfyUI-workflow runner skeleton (workflow-agnostic by config).
- `--tool <id>` — the tool id the runner registers (e.g. `comfy.myThing`). Defaults from the name.

## How discovery works

`dhee-core` finds your package by **name** (`dhee-runner-*`), the **`dhee-runner` keyword**, and the **`dhee.runners`** entry — no central registry. Runners depend on `@dheeai/runner-sdk` only (the firewall). See the SDK README for the full contract.

## License

Apache-2.0
