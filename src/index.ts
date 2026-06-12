/**
 * create-dhee-runner — scaffolds a new `dhee-runner-*` package.
 *
 * Two templates:
 *   - api:   a network/API runner (mirrors dhee-runner-openrouter-image).
 *   - comfy: a ComfyUI-workflow runner with a self-contained, dependency-
 *            free Comfy client (queue → poll /history → download).
 *
 * The scaffold logic is a pure function (`scaffoldRunner`) that writes into
 * a target directory, so it can be unit-tested without spawning a process.
 * cli.ts is the thin argv wrapper.
 */
import { mkdirSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import {
  comfyClient,
  indexApi,
  indexComfy,
  license,
  packageJson,
  placeholderWorkflow,
  readme,
  runnerJson,
  shortName,
  tsconfig,
  type RunnerTemplateVars,
} from './templates.js';

export type RunnerTemplate = 'api' | 'comfy';

export interface ScaffoldRunnerOptions {
  /** npm package name. Must match the dhee-runner-* convention. */
  name: string;
  /** Template to scaffold. Default 'api'. */
  template?: RunnerTemplate;
  /** Tool id (dot-namespaced). Default derived from name. */
  tool?: string;
  /** Human display name. Default derived from name. */
  displayName?: string;
  /** One-line description. */
  description?: string;
  /** Env vars the runner requires. Default [] (comfy) / ['API_KEY'] (api). */
  credentials?: string[];
  /** Network hosts (api template). */
  networkHosts?: string[];
  /** @dheeai/runner-sdk specifier. Default '^0.1.0' (use 'workspace:*' in-repo). */
  sdkSpecifier?: string;
  /** Directory to create the package in. Default <cwd>/<unscoped name>. */
  targetDir?: string;
  /** Allow writing into a non-empty directory. Default false. */
  force?: boolean;
}

export interface ScaffoldResult {
  targetDir: string;
  /** Relative paths of the files written. */
  files: string[];
  vars: RunnerTemplateVars;
}

const NAME_RE = /^(@[^/]+\/)?dhee-runner(-[a-z0-9-]+)?$/;
const TOOL_RE = /^[a-z][a-z0-9]*\.[a-z][a-z0-9_]*$/;

export function scaffoldRunner(opts: ScaffoldRunnerOptions): ScaffoldResult {
  const name = opts.name.trim();
  if (!NAME_RE.test(name)) {
    throw new Error(
      `Invalid package name "${name}". Must match the dhee-runner-* convention, e.g. "dhee-runner-vibevoice" or "@acme/dhee-runner-x".`,
    );
  }

  const template: RunnerTemplate = opts.template ?? 'api';
  if (template !== 'api' && template !== 'comfy') {
    throw new Error(`Unknown template "${template}". Use 'api' or 'comfy'.`);
  }

  const seg = shortName(name);
  const tool = (opts.tool ?? (template === 'comfy' ? `comfy.${seg}` : `${seg}.generate`)).trim();
  if (!TOOL_RE.test(tool)) {
    throw new Error(`Invalid tool id "${tool}". Use a dot-namespaced id like "vibevoice.tts" or "comfy.vibevoice".`);
  }

  const credentials = opts.credentials ?? (template === 'api' ? ['API_KEY'] : []);
  const vars: RunnerTemplateVars = {
    name,
    tool,
    template,
    displayName: opts.displayName ?? titleCase(seg),
    description: opts.description ?? `Dhee ${template} runner (${tool}).`,
    credentials,
    networkHosts: opts.networkHosts ?? (template === 'api' ? ['example.com'] : []),
    sdkSpecifier: opts.sdkSpecifier ?? '^0.1.0',
  };

  const targetDir = resolve(opts.targetDir ?? join(process.cwd(), seg));
  if (existsSync(targetDir) && readdirSync(targetDir).length > 0 && !opts.force) {
    throw new Error(`Target directory ${targetDir} is not empty. Pass force:true (or --force) to write anyway.`);
  }

  const files: Record<string, string> = {
    'package.json': packageJson(vars),
    'tsconfig.json': tsconfig(),
    'runner.json': runnerJson(vars),
    'README.md': readme(vars),
    'LICENSE': license(),
    'src/index.ts': template === 'comfy' ? indexComfy(vars) : indexApi(vars),
  };
  if (template === 'comfy') {
    files['src/comfyClient.ts'] = comfyClient();
    files[`workflows/${seg}.json`] = placeholderWorkflow();
  }

  const written: string[] = [];
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(targetDir, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
    written.push(rel);
  }

  return { targetDir, files: written.sort(), vars };
}

function titleCase(s: string): string {
  return s
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
