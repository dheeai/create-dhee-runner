/**
 * File-content builders for the create-dhee-runner scaffolder. Each
 * function returns the text of one generated file; index.ts decides which
 * to emit based on the chosen template. Kept as pure string builders (no
 * fs) so they are trivially testable and the package stays self-contained.
 */

export interface RunnerTemplateVars {
  /** npm package name (e.g. "dhee-runner-vibevoice" or "@acme/dhee-runner-x"). */
  name: string;
  /** Dot-namespaced tool id (e.g. "vibevoice.tts", "comfy.vibevoice"). */
  tool: string;
  /** Human label. */
  displayName: string;
  /** One-line description. */
  description: string;
  /** Template kind. */
  template: 'api' | 'comfy';
  /** Env vars the runner reads / requires. */
  credentials: string[];
  /** Network hosts the runner reaches (api template) — informational. */
  networkHosts: string[];
  /** Specifier for @dheeai/runner-sdk dependency ("^0.1.0" or "workspace:*"). */
  sdkSpecifier: string;
}

export function packageJson(v: RunnerTemplateVars): string {
  const pkg = {
    name: v.name,
    version: '0.1.0',
    description: v.description,
    type: 'module',
    license: 'Apache-2.0',
    keywords: ['dhee-runner'],
    main: './dist/index.js',
    types: './dist/index.d.ts',
    exports: {
      '.': { types: './dist/index.d.ts', default: './dist/index.js' },
    },
    dhee: { runners: './dist/index.js' },
    files: ['dist', 'runner.json', 'workflows', 'LICENSE', 'README.md'],
    scripts: {
      build: 'tsc -p tsconfig.json',
      typecheck: 'tsc -p tsconfig.json --noEmit',
    },
    engines: { node: '>=20.0.0' },
    dependencies: { '@dheeai/runner-sdk': v.sdkSpecifier },
    devDependencies: { '@types/node': '^22.15.29', typescript: '^5.8.3' },
  };
  return JSON.stringify(pkg, null, 2) + '\n';
}

export function tsconfig(): string {
  const cfg = {
    compilerOptions: {
      target: 'ES2022',
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      lib: ['ES2022'],
      types: ['node'],
      rootDir: './src',
      outDir: './dist',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      declaration: true,
      declarationMap: true,
      sourceMap: true,
      isolatedModules: true,
      verbatimModuleSyntax: true,
      noUncheckedIndexedAccess: true,
      noImplicitOverride: true,
      noPropertyAccessFromIndexSignature: true,
    },
    include: ['src/**/*'],
    exclude: ['dist', 'node_modules'],
  };
  return JSON.stringify(cfg, null, 2) + '\n';
}

export function runnerJson(v: RunnerTemplateVars): string {
  const manifest = {
    tool: v.tool,
    version: '0.1.0',
    engineCompat: '>=0.1.0',
    credentials: v.credentials,
    displayName: v.displayName,
    description: v.description,
    entry: 'dist/index.js',
    permissions: {
      network: v.template === 'api' ? v.networkHosts : ['<comfy-endpoint-host>'],
      filesystem: 'project',
      subprocess: false,
      env:
        v.template === 'comfy'
          ? Array.from(new Set([...v.credentials, 'COMFY_MODE', 'COMFYUI_BASE_URL', 'ENDPOINT_self_local']))
          : v.credentials,
    },
  };
  return JSON.stringify(manifest, null, 2) + '\n';
}

export function license(): string {
  return `Apache License 2.0

Copyright (c) ${'YEAR'} <author>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

See the License for the specific language governing permissions and
limitations under the License.
`;
}

export function readme(v: RunnerTemplateVars): string {
  const install = v.template === 'comfy'
    ? `\n## ComfyUI workflow\n\nThis runner drives a ComfyUI workflow. Drop your exported **API-format**\nworkflow JSON in \`workflows/\` (the scaffold ships \`workflows/${shortName(v.name)}.json\`\nas a placeholder) and update the node-id constants in \`src/index.ts\`\n(\`PROMPT_NODE_ID\`, etc.) to match it.\n\nThe endpoint is resolved by the engine via \`resolveEndpointUrl\` —\n\`COMFY_MODE=local\` (default) forces \`ENDPOINT_self_local\` / \`COMFYUI_BASE_URL\`.\n`
    : `\n## Credentials\n\nSet ${v.credentials.map((c) => `\`${c}\``).join(', ') || '(none)'} in the engine's environment.\n`;
  return `# ${v.name}

> ${v.description}

A [Dhee](https://github.com/dheeai) runner exposing the tool \`${v.tool}\`.
Built against \`@dheeai/runner-sdk\` only (the runner firewall) and discovered
by the engine via the \`dhee-runner-*\` npm convention.

## Build

\`\`\`sh
pnpm install && pnpm build
\`\`\`
${install}
## Use in a bundle

\`\`\`jsonc
// bundle.json
"dependencies": {
  "runners":        { "${v.tool}": ">=0.1.0" },
  "runnerPackages": { "${v.tool}": "${v.name}" }
}
\`\`\`

Then reference it from a node:

\`\`\`jsonc
{ "id": "my_node", "runner": { "tool": "${v.tool}", "config": { /* … */ } } }
\`\`\`
`;
}

// ── api template source ────────────────────────────────────────────────

export function indexApi(v: RunnerTemplateVars): string {
  const credEnv = v.credentials[0] ?? 'API_KEY';
  return `import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';

import { defineRunner } from '@dheeai/runner-sdk';
import type {
  RunnerContext,
  RunnerDescription,
  RunnerManifest,
  RunnerResult,
} from '@dheeai/runner-sdk';

export const manifest = {
  tool: '${v.tool}',
  version: '0.1.0',
  engineCompat: '>=0.1.0',
  credentials: ${JSON.stringify(v.credentials)},
  displayName: '${v.displayName}',
  description: '${v.description}',
  entry: 'dist/index.js',
  permissions: {
    network: ${JSON.stringify(v.networkHosts)},
    filesystem: 'project',
    subprocess: false,
    env: ${JSON.stringify(v.credentials)},
  },
} satisfies RunnerManifest;

const DESCRIPTION: RunnerDescription = {
  id: manifest.tool,
  displayName: '${v.displayName}',
  description: '${v.description}',
  capabilities: [],
  // TODO: declare the real input/output modalities for this runner.
  modalities: { input: ['text'], output: ['text'] },
  costHint: 'paid_api',
  configSchema: {
    type: 'object',
    required: ['outputPath'],
    properties: {
      outputPath: { type: 'string', description: 'Project-relative output path (injected by the walker).' },
      prompt: { type: 'string', description: 'Optional inline prompt.' },
    },
    additionalProperties: true,
  },
};

export const runner = defineRunner({
  describe: () => DESCRIPTION,
  run,
});

async function run(ctx: RunnerContext): Promise<RunnerResult> {
  const apiKey = readEnv('${credEnv}');
  if (!apiKey) return { ok: false, error: '${v.tool}: missing ${credEnv}' };

  const config = ctx.node.runner.config;
  const outputPath = readString(config, 'outputPath');
  if (!outputPath) return { ok: false, error: '${v.tool}: missing outputPath' };
  const outAbs = resolveProjectPath(ctx.projectDir, outputPath);
  if (!outAbs) return { ok: false, error: \`\${'${v.tool}'}: outputPath escapes project: \${outputPath}\` };

  const prompt = readString(config, 'prompt') ?? asString(ctx.inputs['prompt']);

  ctx.log(\`${v.tool}: generating \${outputPath}\`);

  // TODO: call your provider's API here, using \`apiKey\`, \`prompt\`, and
  // any other config fields. Stream/await the bytes, then write them.
  const bytes = Buffer.from(\`TODO ${v.tool} output for: \${prompt ?? ''}\`, 'utf-8');

  try {
    await mkdir(dirname(outAbs), { recursive: true });
    await writeFile(outAbs, bytes);
  } catch (err) {
    return { ok: false, error: \`\${'${v.tool}'}: write failed: \${msg(err)}\` };
  }

  return {
    ok: true,
    outputPath,
    outputs: [{ path: outputPath, kind: 'file', metadata: { byteLength: bytes.byteLength } }],
    metadata: { tool: '${v.tool}' },
  };
}

function resolveProjectPath(projectDir: string, p: string): string | null {
  if (isAbsolute(p)) return null;
  const root = resolve(projectDir);
  const abs = resolve(root, p);
  const rel = relative(root, abs);
  return rel.startsWith('..') || isAbsolute(rel) ? null : abs;
}
function readString(o: Record<string, unknown>, k: string): string | undefined {
  const val = o[k];
  return typeof val === 'string' && val.trim().length > 0 ? val.trim() : undefined;
}
function asString(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : undefined;
}
function readEnv(k: string): string | undefined {
  const val = process.env[k];
  return val && val.trim().length > 0 ? val.trim() : undefined;
}
function msg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// npm-ecosystem discovery entry (dhee.runners).
export const runners = [{ manifest, runner }];
`;
}

// ── comfy template source ──────────────────────────────────────────────

export function indexComfy(v: RunnerTemplateVars): string {
  const wf = shortName(v.name);
  return `import { mkdir } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { readFileSync } from 'node:fs';

import { defineRunner, resolveEndpointUrl, retryTransient } from '@dheeai/runner-sdk';
import type {
  RunnerContext,
  RunnerDescription,
  RunnerManifest,
  RunnerResult,
} from '@dheeai/runner-sdk';

import { ComfyClient } from './comfyClient.js';

export const manifest = {
  tool: '${v.tool}',
  version: '0.1.0',
  engineCompat: '>=0.1.0',
  credentials: ${JSON.stringify(v.credentials)},
  displayName: '${v.displayName}',
  description: '${v.description}',
  entry: 'dist/index.js',
  permissions: {
    network: ['<comfy-endpoint-host>'],
    filesystem: 'project',
    subprocess: false,
    env: ${JSON.stringify(Array.from(new Set([...v.credentials, 'COMFY_MODE', 'COMFYUI_BASE_URL', 'ENDPOINT_self_local'])))},
  },
} satisfies RunnerManifest;

const DESCRIPTION: RunnerDescription = {
  id: manifest.tool,
  displayName: '${v.displayName}',
  description: '${v.description}',
  capabilities: ['comfyui'],
  // TODO: set the real modalities (e.g. text -> audio for TTS).
  modalities: { input: ['text'], output: ['audio'] },
  costHint: 'local_gpu',
  configSchema: {
    type: 'object',
    required: ['workflowPath', 'outputPath'],
    properties: {
      workflowPath: { type: 'string', description: 'Bundle-relative ComfyUI (API-format) workflow JSON.' },
      outputPath: { type: 'string', description: 'Project-relative output path (injected by the walker).' },
      endpoint: { type: 'string', description: 'Named endpoint label (resolved by resolveEndpointUrl).' },
      prompt: { type: 'string', description: 'Optional inline text fed to the workflow.' },
    },
    additionalProperties: true,
  },
};

// ── Workflow node ids — EDIT these to match your workflows/${wf}.json ──
// Open your API-format workflow and find the node whose input field you
// want the engine to drive, then set the id + field here.
const PROMPT_NODE_ID = 'TODO_NODE_ID';
const PROMPT_NODE_FIELD = 'text';

export const runner = defineRunner({ describe: () => DESCRIPTION, run });

async function run(ctx: RunnerContext): Promise<RunnerResult> {
  const config = ctx.node.runner.config;

  const workflowPath = readString(config, 'workflowPath');
  if (!workflowPath) return { ok: false, error: '${v.tool}: missing workflowPath' };
  const bundleDir = ctx.bundleDir;
  if (!bundleDir) return { ok: false, error: '${v.tool}: ctx.bundleDir is required to resolve workflowPath' };

  const outputPath = readString(config, 'outputPath');
  if (!outputPath) return { ok: false, error: '${v.tool}: missing outputPath' };
  const outAbs = resolveProjectPath(ctx.projectDir, outputPath);
  if (!outAbs) return { ok: false, error: \`\${'${v.tool}'}: outputPath escapes project: \${outputPath}\` };

  const endpointLabel = readString(config, 'endpoint') ?? 'self.local';
  const baseUrl = resolveEndpointUrl(endpointLabel);
  if (!baseUrl) {
    return { ok: false, error: \`\${'${v.tool}'}: no Comfy endpoint resolved for "\${endpointLabel}" (set COMFYUI_BASE_URL or ENDPOINT_self_local)\` };
  }

  const prompt = readString(config, 'prompt') ?? asString(ctx.inputs['prompt']) ?? '';

  let workflow: Record<string, { inputs: Record<string, unknown>; class_type?: string }>;
  try {
    workflow = JSON.parse(readFileSync(join(bundleDir, workflowPath), 'utf-8'));
  } catch (err) {
    return { ok: false, error: \`\${'${v.tool}'}: failed to read workflow \${workflowPath}: \${msg(err)}\` };
  }

  // Inject the prompt into the workflow node.
  const node = workflow[PROMPT_NODE_ID];
  if (node && node.inputs) node.inputs[PROMPT_NODE_FIELD] = prompt;

  const client = new ComfyClient(baseUrl);
  ctx.log(\`${v.tool}: running \${workflowPath} on \${baseUrl}\`);

  let outputs;
  try {
    outputs = await retryTransient(() => client.run(workflow, { signal: ctx.signal }), {
      signal: ctx.signal,
      log: ctx.log,
      label: '${v.tool} queue',
    });
  } catch (err) {
    return { ok: false, error: \`\${'${v.tool}'}: comfy run failed: \${msg(err)}\` };
  }
  if (outputs.length === 0) return { ok: false, error: '${v.tool}: Comfy returned no outputs' };

  const picked = outputs[0]!;
  try {
    await mkdir(dirname(outAbs), { recursive: true });
    await retryTransient(() => client.download(picked, outAbs), { signal: ctx.signal, log: ctx.log, label: '${v.tool} download' });
  } catch (err) {
    return { ok: false, error: \`\${'${v.tool}'}: download failed: \${msg(err)}\` };
  }

  return {
    ok: true,
    outputPath,
    outputs: [{ path: outputPath, kind: 'file', metadata: { comfyOutput: picked.filename } }],
    metadata: { tool: '${v.tool}', endpoint: endpointLabel, comfyOutput: picked.filename },
  };
}

function resolveProjectPath(projectDir: string, p: string): string | null {
  if (isAbsolute(p)) return null;
  const root = resolve(projectDir);
  const abs = resolve(root, p);
  const rel = relative(root, abs);
  return rel.startsWith('..') || isAbsolute(rel) ? null : abs;
}
function readString(o: Record<string, unknown>, k: string): string | undefined {
  const val = o[k];
  return typeof val === 'string' && val.trim().length > 0 ? val.trim() : undefined;
}
function asString(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : undefined;
}
function msg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// npm-ecosystem discovery entry (dhee.runners).
export const runners = [{ manifest, runner }];
`;
}

export function comfyClient(): string {
  return `/**
 * Self-contained ComfyUI client — depends only on global fetch (Node 20+),
 * NOT on dhee-core internals (keeps this runner SDK-firewall clean). Queues
 * an API-format workflow, polls /history until it produces outputs (or
 * errors), and downloads output files via /view.
 *
 * Polling (not WebSocket) is deliberate: it needs no extra dependency and
 * is robust for batch generation. For very long renders, raise timeoutMs.
 */

export interface ComfyOutput {
  filename: string;
  subfolder: string;
  type: string;
}

export interface RunOpts {
  signal?: AbortSignal;
  /** Overall wait budget (ms). Default 10 min. */
  timeoutMs?: number;
  /** Poll interval (ms). Default 1500. */
  pollMs?: number;
}

interface HistoryEntry {
  status?: { status_str?: string; completed?: boolean; messages?: Array<[string, unknown]> };
  outputs?: Record<string, Record<string, unknown>>;
}

const OUTPUT_KEYS = ['images', 'gifs', 'videos', 'audio'] as const;

export class ComfyClient {
  private readonly baseUrl: string;
  private readonly clientId: string;

  constructor(baseUrl: string, clientId?: string) {
    this.baseUrl = baseUrl.replace(/\\/$/, '');
    this.clientId = clientId ?? \`dhee-\${Math.abs(hashString(baseUrl + Date.now().toString()))}\`;
  }

  /** Upload a local file to Comfy's input store; returns the stored name. */
  async uploadFile(absPath: string, type: 'input' | 'temp' = 'input'): Promise<{ name: string }> {
    const { readFile } = await import('node:fs/promises');
    const { basename } = await import('node:path');
    const bytes = await readFile(absPath);
    const form = new FormData();
    form.append('image', new Blob([new Uint8Array(bytes)]), basename(absPath));
    form.append('type', type);
    form.append('overwrite', 'true');
    const res = await fetch(\`\${this.baseUrl}/upload/image\`, { method: 'POST', body: form });
    if (!res.ok) throw new Error(\`upload failed: \${res.status} \${res.statusText}\`);
    const json = (await res.json()) as { name?: string };
    if (!json.name) throw new Error('upload response missing name');
    return { name: json.name };
  }

  async queuePrompt(workflow: Record<string, unknown>, signal?: AbortSignal): Promise<string> {
    const res = await fetch(\`\${this.baseUrl}/prompt\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: workflow, client_id: this.clientId }),
      signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(\`/prompt failed: \${res.status} \${res.statusText} \${body.slice(0, 300)}\`);
    }
    const json = (await res.json()) as { prompt_id?: string };
    if (!json.prompt_id) throw new Error('/prompt response missing prompt_id');
    return json.prompt_id;
  }

  async waitForOutputs(promptId: string, opts: RunOpts = {}): Promise<ComfyOutput[]> {
    const timeoutMs = opts.timeoutMs ?? 10 * 60_000;
    const pollMs = opts.pollMs ?? 1500;
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (opts.signal?.aborted) throw new Error('aborted');
      const res = await fetch(\`\${this.baseUrl}/history/\${promptId}\`, { signal: opts.signal });
      if (res.ok) {
        const hist = (await res.json()) as Record<string, HistoryEntry>;
        const entry = hist[promptId];
        if (entry) {
          if (entry.status?.status_str === 'error') {
            throw new Error(\`workflow errored: \${describeError(entry)}\`);
          }
          const outs = collectOutputs(entry);
          if (outs.length > 0) return outs;
          if (entry.status?.completed) return outs; // completed with no media
        }
      }
      await delay(pollMs, opts.signal);
    }
    throw new Error(\`timed out after \${timeoutMs}ms waiting for prompt \${promptId}\`);
  }

  async download(out: ComfyOutput, destAbs: string): Promise<void> {
    const { writeFile } = await import('node:fs/promises');
    const params = new URLSearchParams({ filename: out.filename, subfolder: out.subfolder ?? '', type: out.type || 'output' });
    const res = await fetch(\`\${this.baseUrl}/view?\${params.toString()}\`, { method: 'GET' });
    if (!res.ok) throw new Error(\`/view failed: \${res.status} \${res.statusText}\`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength === 0) throw new Error('downloaded file was empty');
    await writeFile(destAbs, buf);
  }

  async run(workflow: Record<string, unknown>, opts: RunOpts = {}): Promise<ComfyOutput[]> {
    const promptId = await this.queuePrompt(workflow, opts.signal);
    return this.waitForOutputs(promptId, opts);
  }
}

function collectOutputs(entry: HistoryEntry): ComfyOutput[] {
  const outs: ComfyOutput[] = [];
  const byNode = entry.outputs ?? {};
  for (const nodeOut of Object.values(byNode)) {
    for (const key of OUTPUT_KEYS) {
      const list = (nodeOut as Record<string, unknown>)[key];
      if (Array.isArray(list)) {
        for (const item of list as Array<Record<string, unknown>>) {
          const filename = item['filename'];
          if (typeof filename === 'string') {
            outs.push({
              filename,
              subfolder: typeof item['subfolder'] === 'string' ? item['subfolder'] : '',
              type: typeof item['type'] === 'string' ? item['type'] : 'output',
            });
          }
        }
      }
    }
  }
  return outs;
}

function describeError(entry: HistoryEntry): string {
  const messages = entry.status?.messages ?? [];
  const kinds = messages.map((m) => m[0]).join(', ');
  return kinds || 'unknown error';
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((res, rej) => {
    const t = setTimeout(res, ms);
    signal?.addEventListener('abort', () => { clearTimeout(t); rej(new Error('aborted')); }, { once: true });
  });
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}
`;
}

export function placeholderWorkflow(): string {
  return JSON.stringify(
    {
      _comment:
        'Placeholder ComfyUI workflow (API format). Replace with your exported workflow and update PROMPT_NODE_ID/PROMPT_NODE_FIELD in src/index.ts.',
      TODO_NODE_ID: { class_type: 'PrimitiveString', inputs: { text: '' } },
    },
    null,
    2,
  ) + '\n';
}

/** Last path segment of a package name, without scope or dhee-runner- prefix. */
export function shortName(name: string): string {
  const unscoped = name.includes('/') ? name.slice(name.indexOf('/') + 1) : name;
  return unscoped.replace(/^dhee-runner-?/, '') || 'runner';
}
