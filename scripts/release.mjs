#!/usr/bin/env node
/**
 * Release helper for .github/workflows/release.yml.
 *
 * A PR labelled `release: patch | minor | major` gets the version bump and its
 * upgrade note committed to it (`prepare`). When it merges, the workflow tags
 * the merge commit and publishes a GitHub release whose notes come from the
 * PR's "## Release notes" section (`notes`).
 *
 *   node scripts/release.mjs prepare --from 2.7.1 --level patch --title "…" --body-file body.md
 *   node scripts/release.mjs notes --body-file body.md
 *
 * `--from` is the version on main, so running `prepare` again (new commits,
 * an edited description, a different label) gives the same result instead of
 * bumping twice.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const LEVELS = ['patch', 'minor', 'major'];

/** "2.7.1" + "minor" → "2.8.0" */
export function nextVersion(current, level) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(current);
  if (!match) throw new Error(`Not a plain x.y.z version: ${current}`);
  if (!LEVELS.includes(level)) throw new Error(`Level must be one of ${LEVELS.join(', ')}: ${level}`);
  const [major, minor, patch] = match.slice(1).map(Number);
  if (level === 'major') return `${major + 1}.0.0`;
  if (level === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

/** The text under `## <heading>` in a PR description, without HTML comments, or '' */
export function section(body, heading) {
  const text = (body ?? '').replace(/\r\n/g, '\n').replace(/<!--[\s\S]*?-->/g, '');
  const lines = text.split('\n');
  const start = lines.findIndex((line) => line.trim().toLowerCase() === `## ${heading}`.toLowerCase());
  if (start === -1) return '';
  const end = lines.findIndex((line, i) => i > start && /^##\s/.test(line));
  return lines
    .slice(start + 1, end === -1 ? undefined : end)
    .join('\n')
    .trim();
}

/** -1, 0 or 1, comparing plain x.y.z versions */
export function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1;
  return 0;
}

/** "fix(Icon): add brand-x" → "Add brand-x" */
export function releaseTitle(prTitle) {
  const title = prTitle.replace(/^[a-z]+(\([^)]*\))?!?:\s*/i, '').trim();
  return title.charAt(0).toUpperCase() + title.slice(1);
}

/** Sets the first top-level "version" in a JSON file's text, keeping its formatting. */
export function setVersion(text, version) {
  const updated = text.replace(/("version":\s*")[^"]+(")/, `$1${version}$2`);
  if (updated === text && !text.includes(`"version": "${version}"`)) throw new Error('No "version" field found');
  return updated;
}

/**
 * Adds or replaces the migration entry for `toVersion` in velocity-manifest.json's
 * text, keeping the rest of the file byte for byte (the file has hand-formatted
 * arrays that JSON.stringify would reflow).
 */
export function upsertMigration(text, { toVersion, title, description }) {
  const entry = { fromVersion: '1.0.0', toVersion, title, description };
  const block = JSON.stringify(entry, null, 2)
    .split('\n')
    .map((line) => `    ${line}`)
    .join('\n');

  const marker = `"toVersion": "${toVersion}"`;
  const at = text.indexOf(marker);
  let updated;
  if (at !== -1) {
    const open = text.lastIndexOf('\n    {', at) + 1;
    const close = text.indexOf('\n    }', at) + '\n    }'.length;
    updated = text.slice(0, open) + block + text.slice(close);
  } else {
    const end = text.search(/\n {2}\],\n {2}"scaffold"/);
    if (end === -1) throw new Error('Could not find the end of "migrations" in velocity-manifest.json');
    updated = `${text.slice(0, end)},\n${block}${text.slice(end)}`;
  }
  JSON.parse(updated); // fail loudly rather than write a broken manifest
  return updated;
}

/** Removes the migration entry for `toVersion`, keeping the rest byte for byte. */
export function removeMigration(text, toVersion) {
  const at = text.indexOf(`"toVersion": "${toVersion}"`);
  if (at === -1) return text;
  const open = text.lastIndexOf('\n    {', at);
  const close = text.indexOf('\n    }', at) + '\n    }'.length;
  // Drop the separating comma: the one before the entry, or after it if it's first.
  const before = text.slice(0, open);
  const after = text.slice(close);
  const updated = before.endsWith(',') ? before.slice(0, -1) + after : before + after.replace(/^,/, '');
  JSON.parse(updated);
  return updated;
}

/** Bumps package.json and velocity-manifest.json, and writes the upgrade note. */
export function prepare({ root = '.', from, level, title, body }) {
  const version = nextVersion(from, level);
  notes(body); // fail now, on the open PR, rather than after the merge
  const note = section(body, 'Upgrade note') || 'Nothing needs doing.';
  const pkgPath = `${root}/package.json`;
  const manifestPath = `${root}/velocity-manifest.json`;
  writeFileSync(pkgPath, setVersion(readFileSync(pkgPath, 'utf8'), version));
  let manifest = setVersion(readFileSync(manifestPath, 'utf8'), version);
  // Main never has entries above its own version, so any are drafts from this
  // PR, e.g. 2.8.0 left behind when the label changed from minor to patch.
  for (const { toVersion } of JSON.parse(manifest).migrations) {
    if (compareVersions(toVersion, from) > 0 && toVersion !== version) manifest = removeMigration(manifest, toVersion);
  }
  writeFileSync(manifestPath, upsertMigration(manifest, { toVersion: version, title: releaseTitle(title), description: note }));
  return version;
}

/**
 * Release notes: the "## Release notes" section, or the whole description when
 * there's no such heading. A heading left empty (the PR template's) is an error,
 * so the template's other sections never end up in a release.
 */
export function notes(body) {
  const text = (body ?? '').replace(/\r\n/g, '\n');
  const hasHeading = /^## release notes\s*$/im.test(text);
  const fromSection = section(text, 'Release notes');
  if (fromSection) return fromSection;
  if (hasHeading) throw new Error('The "Release notes" section of the PR description is empty. Fill it in, or remove the heading to use the whole description.');
  return text.replace(/<!--[\s\S]*?-->/g, '').trim();
}

function args(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) out[argv[i].slice(2)] = argv[i + 1];
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [command, ...rest] = process.argv.slice(2);
  const opts = args(rest);
  const body = opts['body-file'] ? readFileSync(opts['body-file'], 'utf8') : '';
  if (command === 'prepare') {
    process.stdout.write(prepare({ from: opts.from, level: opts.level, title: opts.title ?? '', body }));
  } else if (command === 'notes') {
    process.stdout.write(notes(body));
  } else {
    console.error('Usage: release.mjs prepare --from <x.y.z> --level <patch|minor|major> --title <PR title> --body-file <file>\n       release.mjs notes --body-file <file>');
    process.exit(1);
  }
}
