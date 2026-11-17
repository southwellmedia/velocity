import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { nextVersion, notes, prepare, releaseTitle, section, setVersion, upsertMigration } from '../../scripts/release.mjs';

const manifest = fs.readFileSync('velocity-manifest.json', 'utf8');

const BODY = `Adds the X logo.

## Release notes
- **Icon:** \`brand-x\` draws the X logo.
<!-- hidden from the notes -->

## Upgrade note
Footer social links accept \`platform: 'x'\`. Nothing needs doing.

## Testing
pnpm validate
`;

describe('release helper', () => {
  it('bumps versions', () => {
    expect(nextVersion('2.7.1', 'patch')).toBe('2.7.2');
    expect(nextVersion('2.7.1', 'minor')).toBe('2.8.0');
    expect(nextVersion('2.7.1', 'major')).toBe('3.0.0');
    expect(() => nextVersion('2.7.1-beta', 'patch')).toThrow();
    expect(() => nextVersion('2.7.1', 'huge')).toThrow();
  });

  it('reads a section of the PR description, without comments', () => {
    expect(section(BODY, 'Release notes')).toBe('- **Icon:** `brand-x` draws the X logo.');
    expect(section(BODY, 'upgrade note')).toBe("Footer social links accept `platform: 'x'`. Nothing needs doing.");
    expect(section(BODY, 'Missing')).toBe('');
    expect(notes(BODY)).toBe('- **Icon:** `brand-x` draws the X logo.');
    expect(notes('Just a description.')).toBe('Just a description.');
  });

  it('turns a PR title into a release title', () => {
    expect(releaseTitle('feat(Icon): add brand-x, the X logo')).toBe('Add brand-x, the X logo');
    expect(releaseTitle('fix!: drop Node 20')).toBe('Drop Node 20');
    expect(releaseTitle('Plain title')).toBe('Plain title');
  });

  it('sets the version without reformatting the file', () => {
    const updated = setVersion(manifest, '9.9.9');
    expect(JSON.parse(updated).version).toBe('9.9.9');
    expect(updated.length).toBe(manifest.length + '9.9.9'.length - JSON.parse(manifest).version.length);
  });

  it('adds a migration entry, then replaces it on a re-run, leaving the rest byte for byte', () => {
    const before = JSON.parse(manifest).migrations.length;
    const added = upsertMigration(manifest, { toVersion: '9.9.9', title: 'T', description: 'D' });
    const parsed = JSON.parse(added);
    expect(parsed.migrations).toHaveLength(before + 1);
    expect(parsed.migrations.at(-1)).toEqual({ fromVersion: '1.0.0', toVersion: '9.9.9', title: 'T', description: 'D' });
    expect(added.startsWith(manifest.slice(0, manifest.search(/\n {2}\],\n {2}"scaffold"/)))).toBe(true);

    const replaced = upsertMigration(added, { toVersion: '9.9.9', title: 'T2', description: 'D2' });
    expect(JSON.parse(replaced).migrations).toHaveLength(before + 1);
    expect(JSON.parse(replaced).migrations.at(-1).title).toBe('T2');
  });

  it('prepares a release idempotently from the base version', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'velocity-release-'));
    try {
      fs.copyFileSync('package.json', path.join(dir, 'package.json'));
      fs.copyFileSync('velocity-manifest.json', path.join(dir, 'velocity-manifest.json'));
      const from = JSON.parse(manifest).version;
      const run = () => prepare({ root: dir, from, level: 'patch', title: 'feat(Icon): add brand-x', body: BODY });
      const version = run();
      const once = fs.readFileSync(path.join(dir, 'velocity-manifest.json'), 'utf8');
      run();
      expect(fs.readFileSync(path.join(dir, 'velocity-manifest.json'), 'utf8')).toBe(once);
      expect(JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).version).toBe(version);
      const entry = JSON.parse(once).migrations.at(-1);
      expect(entry).toMatchObject({ toVersion: version, title: 'Add brand-x' });
      expect(entry.description).toContain("platform: 'x'");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('defaults the upgrade note when the PR has none', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'velocity-release-'));
    try {
      fs.copyFileSync('package.json', path.join(dir, 'package.json'));
      fs.copyFileSync('velocity-manifest.json', path.join(dir, 'velocity-manifest.json'));
      prepare({ root: dir, from: '2.7.1', level: 'patch', title: 'fix: something small', body: 'No sections here.' });
      const entry = JSON.parse(fs.readFileSync(path.join(dir, 'velocity-manifest.json'), 'utf8')).migrations.at(-1);
      expect(entry.description).toBe('Nothing needs doing.');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
