import { build } from 'esbuild';

const marker = '<script type="module" src="./main.js"></script>';

export async function buildInlineEmbedded(template, entryPoint) {
  if (template.split(marker).length !== 2) throw new Error('Embedded template must contain exactly one main.js module script');
  const result = await build({
    entryPoints: [entryPoint],
    bundle: true,
    platform: 'browser',
    format: 'iife',
    target: 'es2020',
    write: false,
    logLevel: 'silent',
  });
  if (result.outputFiles.length !== 1) throw new Error('Embedded widget must bundle to one script');
  const script = result.outputFiles[0].text;
  if (/<\/script/i.test(script)) throw new Error('Embedded script contains an HTML script terminator');
  return template.replace(marker, `<script>\n${script}</script>`);
}
