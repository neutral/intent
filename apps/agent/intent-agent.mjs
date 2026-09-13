#!/usr/bin/env node
import { main } from '../../dist/apps/cli/cli.js';
try {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== '--root') throw Object.assign(new Error('Usage: intent-agent --root <explicit-repository-directory>'), { code: 'intent.agent.arguments' });
  process.exitCode = await main(['mcp', args[1]]);
} catch (error) { process.stderr.write(`${error.code ?? 'intent.agent.failed'}: ${error.message}\n`); process.exitCode = 2; }
