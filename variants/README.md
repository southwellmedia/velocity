# Scaffold variants — the Velocity ⇄ CLI contract

`create-velocity-astro` (CLI ≥ 2.0) builds a project by downloading this repository
and applying the steps declared in `velocity-manifest.json → scaffold`. **The CLI
ships no template files of its own.** Everything a scaffolded project can contain
lives in this repo, and `pnpm test:scaffold` builds every combination in CI. A
change that breaks a variant fails the PR that caused it.

## Manifest shape (`scaffold`, schema version 1)

```jsonc
"scaffold": {
  "schemaVersion": 1,
  "minCliVersion": "2.0.0",      // older CLIs must refuse and tell the user to update
  "node": ">=22.23.4",           // CLI warns (scaffold) / errors (upgrade) if unmet
  "variants": [                  // applied IN ORDER, each only when `when` matches
    {
      "id": "i18n",
      "when": { "i18n": true },
      "overlay": "variants/i18n", // copied over the project root, overwriting
      "remove": []                // project-relative paths deleted after the overlay
    },
    {
      "id": "demo",               // no overlay: a variant can just add component requirements
      "when": { "demo": true },
      "alwaysInclude": ["*"]       // demo pages use every component; "*" disables pruning
    },
    {
      "id": "minimal",
      "when": { "demo": false },
      "overlay": "variants/minimal",
      "remove": ["src/components/landing", "..."]
    }
  ],
  "components": {
    "optionalDirs": ["src/components/ui", "src/components/patterns", "src/components/hero"],
    "alwaysInclude": ["search-input", "newsletter-form", "contact-form"]
  },
  "cleanup": ["variants", "scripts/scaffold-matrix.mjs"]
}
```

### Semantics

1. Download the repo at the requested ref.
2. For each variant in order: if every key in `when` equals the scaffold option of
   the same name (`demo`, `i18n`), copy `overlay/**` onto the project root, overwriting
   existing files, then delete each path in `remove` (files or directories, missing
   paths ignored).
   `overlay` and `remove` are optional. A matching variant may also list
   `alwaysInclude` ids, which are added to `components.alwaysInclude`.
3. Component selection: only paths under `components.optionalDirs` may be pruned.
   Components in `alwaysInclude` (registry ids, from the top level plus every
   applied variant), and their registry dependencies, are always kept because
   the remaining pages import them. `"*"` keeps every component. Category
   barrels (`ui/index.ts`, `ui/<category>/index.ts`) and `ui/types.ts` are
   removed on partial installs; nothing in Velocity imports them.
4. Delete every path in `cleanup`, and remove each npm script named in
   `cleanupScripts` from the project's `package.json` (repo-only tooling such as
   `test:scaffold`).
5. Write `.velocity/baseline.json`: the SHA-256 of every file under `files.safe`,
   exactly what `node scripts/check-agent.mjs --write-baseline` produces. Run that
   command in the new project, or reproduce it. `check:agent` compares against it to
   warn when an agent edits a file the next upgrade replaces. **Upgrades rewrite it
   after replacing files.** Without it, `check:agent` skips that rule and says so.
6. **Upgrades run steps 1–4 on the fresh download, using the options in the
   project's `.velocity.json`, before comparing files.** Otherwise a minimal or
   i18n project would be "upgraded" to demo or single-locale files.

A variant with no `when` always applies. `when` keys that the CLI does not recognise mean the variant does not apply.
Unknown top-level keys must be ignored, so new fields can be added without
breaking older 2.x CLIs.

## Variants in this repo

| Variant | When | What it does |
|---------|------|--------------|
| `agents` | always | Replaces the maintainer `AGENTS.md` with a short one the project owns, and adds Velocity's rules (`.agents/velocity.md`) and skills (`.agents/skills/`, mirrored to `.claude/skills/`). |
| `i18n` | `--i18n` | Enables `es` and `fr` in `src/i18n/locales.mjs` and adds site-copy translations in `src/i18n/translations/`. Routing, UI strings, hreflang and the language switcher are already in core. |
| `minimal` | no `--demo` | Replaces the home view and nav config with a minimal starter and removes demo pages and landing components. |

## Rules for maintainers

- Variants contain **whole files** and are tested together. Don't patch shared files
  from the CLI. If a variant needs to change a large core file, add an extension
  point to core instead.
- Every path a variant overlays or removes must exist in core, or the matrix fails.
- Every file in an optional component directory must belong to a registry entry,
  and each entry must declare the components it imports. `pnpm check:registry`
  enforces both, and `tests/unit/scaffold.test.ts` checks that no combination
  leaves a broken import.
- `variants/agents/` is what agents read in user projects, while the root `AGENTS.md` is for this repo. When a rule changes, update both. Skills must be identical in `.agents/skills/` and `.claude/skills/`, and must only reference tooling that survives `cleanup`.
- Run `pnpm test:scaffold` locally before changing anything under `variants/`,
  `src/i18n/`, `src/views/` or `src/config/`.

## Upgrades

The manifest also tells `create-velocity-astro upgrade` what it may change in an existing project:

| Manifest field | Existing file | Missing file |
|---|---|---|
| `files.safe` | Overwritten (user-modified files are backed up first) | Added |
| `files.protected` | Left alone | Left alone |
| `files.seed` (a subset of protected paths) | Left alone | Added |
| `migrations[].replace` | Backed up to `.velocity-backup/`, then replaced, once, when upgrading across that migration's `toVersion` | Added |
| `migrations[].remove` | Backed up to `.velocity-backup/`, then deleted, once | Nothing to do |

`packageJson` sets `engines` and adds `scripts`. A script is only changed when it's missing or still equals its `replaces` value, so scripts a project customized are kept.

A migration with `when` (for example `{ "i18n": true }`) applies only to projects created with those options, read from `.velocity.json`.

Upgrades run against the same variant pipeline as scaffolding. Use `replace` only for breaking releases where the old file can't work with the new version, and describe what to copy back in that migration's `description`.

A migration's `pattern` is a regular expression, so escape `(`, `[` and `.`.
