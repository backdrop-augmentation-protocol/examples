import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const previewLimit = 1024 * 1024;
const metadataPolicy = JSON.parse(await readFile(new URL('../workshop-metadata-policy.json', import.meta.url), 'utf8'));
const metadataKeys = ['contentrating', 'description', 'file', 'general', 'preview', 'ratingsex', 'ratingviolence', 'tags', 'title', 'type', 'version', 'visibility'];

function assert(condition, message) {
  if (!condition) throw new Error(`Invalid Workshop package: ${message}`);
}

function inside(root, path) {
  const offset = relative(root, path);
  return offset !== '..' && !offset.startsWith(`..${sep}`) && !isAbsolute(offset);
}

async function existingFile(root, from, value, label) {
  assert(typeof value === 'string' && value.length > 0, `${label} must be a nonempty path`);
  assert(!isAbsolute(value) && !value.includes('\\') && !value.startsWith('/'), `${label} must be relative`);
  const target = resolve(from, value);
  assert(inside(root, target), `${label} escapes the package: ${value}`);
  let info;
  try { info = await stat(target); } catch { assert(false, `${label} is missing: ${value}`); }
  assert(info.isFile(), `${label} is not a file: ${value}`);
  return { target, info };
}

async function filesUnder(dir) {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) result.push(...await filesUnder(path));
    else if (entry.isFile()) result.push(path);
    else assert(false, `unsupported entry: ${path}`);
  }
  return result;
}

function validateProperties(project) {
  const properties = project.general?.properties;
  assert(properties && typeof properties === 'object' && !Array.isArray(properties), 'general.properties must be an object');
  for (const [name, property] of Object.entries(properties)) {
    assert(property && typeof property === 'object' && !Array.isArray(property), `${name} must be an object`);
    assert(typeof property.text === 'string' && property.text.length > 0, `${name}.text is required`);
    assert(Number.isInteger(property.order), `${name}.order must be an integer`);
    if (property.index !== undefined) assert(Number.isInteger(property.index), `${name}.index must be an integer`);
    if (property.type === 'bool') assert(typeof property.value === 'boolean', `${name}.value must be boolean`);
    else if (property.type === 'color') assert(typeof property.value === 'string' && /^\d+(?:\.\d+)? \d+(?:\.\d+)? \d+(?:\.\d+)?$/.test(property.value), `${name}.value must be an RGB string`);
    else if (property.type === 'slider') {
      assert([property.value, property.min, property.max, property.step].every(v => typeof v === 'number' && Number.isFinite(v)), `${name} slider values must be finite numbers`);
      assert(property.min <= property.value && property.value <= property.max && property.step > 0, `${name} slider bounds are invalid`);
    } else assert(false, `${name}.type is unsupported: ${property.type}`);
  }
}

export function validateProjectMetadata(project) {
  assert(project && typeof project === 'object' && !Array.isArray(project), 'project.json must contain an object');
  assert(!('workshopid' in project) && !('workshopurl' in project), 'generated packages must not carry published Workshop identity');
  assert(metadataKeys.length === Object.keys(project).length && metadataKeys.every(key => Object.hasOwn(project, key)), 'project.json keys must match the canonical Web wallpaper template');
  for (const key of ['version', 'type', 'file', 'visibility', 'contentrating', 'ratingsex', 'ratingviolence']) {
    assert(project[key] === metadataPolicy[key], `${key} must be ${metadataPolicy[key]}`);
  }
  assert(typeof project.title === 'string' && Object.hasOwn(metadataPolicy.projects, project.title), 'title must identify a configured demo');
  assert(typeof project.description === 'string' && project.description.trim(), 'description must be a nonempty string');
  const profile = metadataPolicy.projects[project.title];
  assert(project.preview === profile.preview, `preview must be ${profile.preview}`);
  assert(Array.isArray(project.tags) && project.tags.length > 0 && project.tags.length <= 3 && new Set(project.tags).size === project.tags.length, 'tags must be a unique nonempty list of at most 3 genres');
  assert(project.tags.every(tag => metadataPolicy.allowedTags.includes(tag)), 'tags contain an unsupported genre');
  assert(profile.requiredTags.every(tag => project.tags.includes(tag)), 'tags are missing a required genre');
  validateProperties(project);
  return profile;
}

export async function validateWorkshopPackage(directory) {
  const root = resolve(directory);
  const projectPath = join(root, 'project.json');
  let project;
  try { project = JSON.parse(await readFile(projectPath, 'utf8')); }
  catch (error) { throw new Error(`Invalid Workshop package: cannot parse ${projectPath}: ${error.message}`); }
  validateProjectMetadata(project);
  await existingFile(root, root, project.file, 'file');
  const preview = await existingFile(root, root, project.preview, 'preview');
  assert(preview.info.size <= previewLimit, 'preview exceeds 1 MiB');
  assert(['.jpg', '.jpeg', '.png', '.gif'].includes(extname(preview.target).toLowerCase()), 'preview has unsupported extension');

  const files = await filesUnder(root);
  assert(files.filter(file => file.endsWith(`${sep}project.json`)).length === 1, 'nested project.json is not allowed');
  assert(!files.some(file => file.endsWith(`${sep}mock-state.json`)), 'mock-state.json must not be packaged');
  for (const file of files) {
    if (!['.html', '.js', '.css'].includes(extname(file))) continue;
    const content = await readFile(file, 'utf8');
    const references = [...content.matchAll(/["'](\.{1,2}\/[^"']+)["']/g)];
    for (const match of references) {
      const reference = match[1].split(/[?#]/)[0];
      // The demo deliberately falls back to a generated tone when this optional track is absent.
      if (relative(root, file) === 'main.js' && reference === './assets/host-wallpaper/bgm.ogg') continue;
      await existingFile(root, dirname(file), reference, `reference in ${relative(root, file)}`);
    }
  }
  const manifestPath = join(root, 'manifest.json');
  if (files.includes(manifestPath)) {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    for (const [name, entrypoint] of Object.entries(manifest.entrypoints ?? {})) {
      await existingFile(root, root, entrypoint, `manifest.entrypoints.${name}`);
    }
  }
  return { root, files: files.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const directories = process.argv.slice(2);
  assert(directories.length > 0, 'provide at least one package directory');
  for (const directory of directories) {
    const result = await validateWorkshopPackage(directory);
    console.log(`Validated ${result.root} (${result.files} files)`);
  }
}
