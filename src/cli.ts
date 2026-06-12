#!/usr/bin/env node
/**
 * Thin argv wrapper around scaffoldRunner. Supports:
 *   npm create dhee-runner <name> [--template api|comfy] [--tool x.y]
 *     [--display "Name"] [--desc "..."] [--cred ENV1,ENV2] [--dir <path>]
 *     [--host example.com] [--sdk <specifier>] [--force]
 */
import { scaffoldRunner, type ScaffoldRunnerOptions, type RunnerTemplate } from './index.js';

interface ParsedArgs {
  positionals: string[];
  flags: Record<string, string | boolean>;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const positionals: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) {
        flags[key] = true;
      } else {
        flags[key] = next;
        i++;
      }
    } else {
      positionals.push(a);
    }
  }
  return { positionals, flags };
}

const USAGE = `create-dhee-runner — scaffold a dhee-runner-* package

Usage:
  npm create dhee-runner <name> [options]

Arguments:
  <name>              Package name (e.g. dhee-runner-vibevoice, @acme/dhee-runner-x)

Options:
  --template <t>      'api' (default) or 'comfy'
  --tool <id>         Tool id, dot-namespaced (default: derived from name)
  --display <name>    Human display name
  --desc <text>       One-line description
  --cred <list>       Comma-separated required env vars
  --host <list>       Comma-separated network hosts (api template)
  --dir <path>        Target directory (default: ./<short-name>)
  --sdk <specifier>   @dheeai/runner-sdk version (default ^0.1.0)
  --force             Write into a non-empty directory
  -h, --help          Show this help
`;

function toList(v: string | boolean | undefined): string[] | undefined {
  if (typeof v !== 'string') return undefined;
  return v.split(',').map((s) => s.trim()).filter(Boolean);
}

export function main(argv: string[]): number {
  const { positionals, flags } = parseArgs(argv);
  if (flags['help'] || flags['h'] || positionals.length === 0) {
    process.stdout.write(USAGE);
    return positionals.length === 0 && !flags['help'] && !flags['h'] ? 1 : 0;
  }

  const opts: ScaffoldRunnerOptions = { name: positionals[0]! };
  if (typeof flags['template'] === 'string') opts.template = flags['template'] as RunnerTemplate;
  if (typeof flags['tool'] === 'string') opts.tool = flags['tool'];
  if (typeof flags['display'] === 'string') opts.displayName = flags['display'];
  if (typeof flags['desc'] === 'string') opts.description = flags['desc'];
  if (typeof flags['dir'] === 'string') opts.targetDir = flags['dir'];
  if (typeof flags['sdk'] === 'string') opts.sdkSpecifier = flags['sdk'];
  const cred = toList(flags['cred']);
  if (cred) opts.credentials = cred;
  const host = toList(flags['host']);
  if (host) opts.networkHosts = host;
  if (flags['force']) opts.force = true;

  try {
    const result = scaffoldRunner(opts);
    process.stdout.write(`\n✓ Scaffolded ${result.vars.name} (tool: ${result.vars.tool}, template: ${result.vars.template})\n`);
    process.stdout.write(`  → ${result.targetDir}\n`);
    for (const f of result.files) process.stdout.write(`    ${f}\n`);
    process.stdout.write(`\nNext:\n  cd ${result.targetDir}\n  pnpm install && pnpm build\n`);
    if (result.vars.template === 'comfy') {
      process.stdout.write(`  # drop your API-format workflow in workflows/ and edit PROMPT_NODE_ID in src/index.ts\n`);
    }
    return 0;
  } catch (err) {
    process.stderr.write(`\n✗ ${err instanceof Error ? err.message : String(err)}\n`);
    return 1;
  }
}

// Run when invoked directly (bin), not when imported by tests.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)));
}
