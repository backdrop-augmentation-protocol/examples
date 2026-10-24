import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const conformance = resolve(root, '..', 'conformance');
const packages = ['workshop-host-wallpaper', 'workshop-time-widget', 'workshop-calendar-widget']
  .map(name => resolve(root, 'dist', name));
const tsx = resolve(conformance, 'node_modules', 'tsx', 'dist', 'cli.mjs');
execFileSync(process.execPath, [tsx, resolve(conformance, 'src', 'check-we-package.ts'), ...packages],
  { cwd: conformance, stdio: 'inherit' });
