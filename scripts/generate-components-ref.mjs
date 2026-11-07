#!/usr/bin/env node
/**
 * Generates the component reference agents read in user projects, so they can
 * learn the component library from one file instead of reading every source.
 *
 *   node scripts/generate-components-ref.mjs           # writes the file
 *   node scripts/generate-components-ref.mjs --check   # exits 1 if it is stale
 *
 * Output: variants/agents/.agents/components.md (`.agents/components.md` in
 * scaffolded projects). Inputs: component-registry.json (name, category,
 * description, useInstead, example, files, premium), each component's
 * `*.variants.ts` (CVA variants and defaults) and its prop types (`interface
 * Props` in .astro frontmatter, or the props type of a .tsx component).
 * The output depends only on those files, so it is deterministic.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const OUTPUT = 'variants/agents/.agents/components.md';

const read = (root, rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const oneLine = (text) => text.replace(/\s+/g, ' ').trim();
/** Escape text for a Markdown table cell. */
const cell = (text) => text.replace(/\|/g, '\\|');
const code = (text) => `\`${cell(text)}\``;
/** Hand-written prose: HTML tags such as <select> go in code spans so Markdown shows them. */
const prose = (text) =>
  oneLine(text)
    .split(/(`[^`]*`)/)
    .map((part, i) => (i % 2 ? part : part.replace(/<\/?[a-z][^>]*>/g, (tag) => `\`${tag}\``)))
    .join('');
/** The path a project imports: `@/` alias, and no extension for .tsx (Vite resolves it). */
const importPath = (file) => file.replace(/^src\//, '@/').replace(/\.tsx$/, '');
/** Defaults longer than this are expressions worth reading in source, not values. */
const MAX_DEFAULT = 40;

function parse(file, source) {
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind);
}

function frontmatter(source) {
  return source.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '';
}

function jsDoc(node) {
  const docs = node.jsDoc ?? [];
  const text = docs.map((d) => (typeof d.comment === 'string' ? d.comment : '')).join(' ');
  return oneLine(text);
}

/** The file a project imports for this component: the .astro named after it, else its .tsx. */
export function primaryFile(component) {
  const sources = component.files.filter((f) => f.startsWith('src/components/') && /\.(astro|tsx)$/.test(f));
  const named = (ext) => sources.find((f) => path.posix.basename(f) === `${component.name}${ext}`);
  return named('.astro') ?? sources.find((f) => f.endsWith('.astro')) ?? named('.tsx') ?? sources[0];
}

/** Find a top-level interface or type alias by name. */
function findType(sf, names) {
  for (const name of names) {
    const found = sf.statements.find(
      (s) => (ts.isInterfaceDeclaration(s) || ts.isTypeAliasDeclaration(s)) && s.name.text === name,
    );
    if (found) return found;
  }
  return undefined;
}

/** Defaults from `const { a = 1, ... } = Astro.props` or a destructured function parameter. */
function collectDefaults(sf) {
  const defaults = new Map();
  const visit = (node) => {
    if (ts.isObjectBindingPattern(node)) {
      const parent = node.parent;
      const fromAstroProps =
        ts.isVariableDeclaration(parent) && parent.initializer && /^Astro\.props\b/.test(parent.initializer.getText(sf));
      const fromParam = ts.isParameter(parent);
      if (fromAstroProps || fromParam) {
        for (const el of node.elements) {
          if (!el.initializer || el.dotDotDotToken) continue;
          const key = (el.propertyName ?? el.name).getText(sf);
          if (!defaults.has(key)) defaults.set(key, oneLine(el.initializer.getText(sf)));
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return defaults;
}

function membersOf(sf, decl) {
  const members = ts.isInterfaceDeclaration(decl)
    ? decl.members
    : ts.isTypeLiteralNode(decl.type)
      ? decl.type.members
      : [];
  return members
    .filter((m) => ts.isPropertySignature(m) && m.name)
    .map((m) => ({
      name: m.name.getText(sf),
      type: m.type ? oneLine(m.type.getText(sf)) : 'unknown',
      required: !m.questionToken,
      doc: jsDoc(m),
    }));
}

function heritageOf(sf, decl) {
  if (ts.isInterfaceDeclaration(decl)) {
    return (decl.heritageClauses ?? []).flatMap((h) => h.types.map((t) => oneLine(t.getText(sf))));
  }
  if (ts.isTypeAliasDeclaration(decl) && !ts.isTypeLiteralNode(decl.type)) return [oneLine(decl.type.getText(sf))];
  return [];
}

/** Props of a component file: members, extended types and defaults. */
export function extractProps(root, file, name) {
  const source = read(root, file);
  const sf = parse(file, file.endsWith('.astro') ? frontmatter(source) : source);
  const decl = findType(sf, file.endsWith('.astro') ? ['Props'] : [`${name}Props`, 'Props']);
  if (!decl) return undefined;
  const defaults = collectDefaults(sf);
  const members = membersOf(sf, decl).map((m) => ({ ...m, default: defaults.get(m.name) }));
  return { members, extends: heritageOf(sf, decl), types: referencedTypes(sf, decl) };
}

/** Local interfaces and type aliases the props refer to, directly or through each other. */
function referencedTypes(sf, decl) {
  const local = new Map();
  for (const s of sf.statements) {
    if ((ts.isInterfaceDeclaration(s) || ts.isTypeAliasDeclaration(s)) && s !== decl) local.set(s.name.text, s);
  }
  const found = new Set();
  const visit = (node) => {
    if (ts.isTypeReferenceNode(node) && ts.isIdentifier(node.typeName)) {
      const name = node.typeName.text;
      if (local.has(name) && !found.has(name)) {
        found.add(name);
        visit(local.get(name));
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(decl);
  // Source order, so output is stable
  return [...local.entries()]
    .filter(([name]) => found.has(name))
    .map(([, node]) => node.getText(sf).replace(/^export\s+/, ''));
}

/** Named slots in an .astro template, with `default` for an unnamed one. */
export function extractSlots(root, file) {
  if (!file.endsWith('.astro')) return [];
  const template = read(root, file).replace(/^---\r?\n[\s\S]*?\r?\n---/, '');
  const names = [...template.matchAll(/<slot\b([^>]*)>/g)].map((m) => m[1].match(/\bname="([^"]+)"/)?.[1] ?? 'default');
  return [...new Set(names)];
}

/** Keys of an untyped top-level `const icons = { ... }` map (the Icon component's names). */
export function extractIconNames(root, file) {
  if (!file.endsWith('.astro')) return [];
  const sf = parse(file, frontmatter(read(root, file)));
  for (const stmt of sf.statements) {
    if (!ts.isVariableStatement(stmt)) continue;
    for (const d of stmt.declarationList.declarations) {
      if (d.name.getText(sf) !== 'icons' || d.type || !d.initializer) continue;
      let init = d.initializer;
      if (ts.isAsExpression(init)) init = init.expression;
      if (!ts.isObjectLiteralExpression(init)) continue;
      return init.properties.filter((p) => p.name).map((p) => p.name.getText(sf).replace(/^['"]|['"]$/g, ''));
    }
  }
  return [];
}

/** True when a .tsx file exports a component under this name. */
function exportsNamed(root, file, name) {
  const source = read(root, file);
  return new RegExp(`export\\s+(function|const)\\s+${name}\\b`).test(source);
}

function propertyNamed(obj, key) {
  return obj.properties.find((p) => ts.isPropertyAssignment(p) && p.name.getText() === key);
}

/** CVA definitions in a variants file: export name, variant options and defaults. */
export function extractVariants(root, file) {
  const sf = parse(file, read(root, file));
  const result = [];
  for (const stmt of sf.statements) {
    if (!ts.isVariableStatement(stmt)) continue;
    for (const d of stmt.declarationList.declarations) {
      const init = d.initializer;
      if (!init || !ts.isCallExpression(init) || init.expression.getText(sf) !== 'cva') continue;
      const config = init.arguments[1];
      const variants = [];
      if (config && ts.isObjectLiteralExpression(config)) {
        const v = propertyNamed(config, 'variants')?.initializer;
        const defs = propertyNamed(config, 'defaultVariants')?.initializer;
        const defaultOf = (key) => {
          if (!defs || !ts.isObjectLiteralExpression(defs)) return undefined;
          const p = propertyNamed(defs, key);
          return p ? oneLine(p.initializer.getText(sf)).replace(/^['"]|['"]$/g, '') : undefined;
        };
        if (v && ts.isObjectLiteralExpression(v)) {
          for (const p of v.properties) {
            if (!ts.isPropertyAssignment(p) || !ts.isObjectLiteralExpression(p.initializer)) continue;
            const key = p.name.getText(sf).replace(/^['"]|['"]$/g, '');
            const options = p.initializer.properties
              .filter((o) => o.name)
              .map((o) => o.name.getText(sf).replace(/^['"]|['"]$/g, ''));
            variants.push({ name: key, options, default: defaultOf(key) });
          }
        }
      }
      result.push({ exportName: d.name.getText(sf), variants });
    }
  }
  return result;
}

/** Registry problems that make the reference incomplete. */
export function validateRegistry(registry) {
  const problems = [];
  for (const [id, c] of Object.entries(registry.components)) {
    if (!c.description?.trim()) problems.push(`registry "${id}" has no description`);
    if (!c.example?.trim()) problems.push(`registry "${id}" has no example`);
    const file = primaryFile(c);
    if (!file) problems.push(`registry "${id}" has no .astro or .tsx file`);
    else if (c.example && !c.example.includes(importPath(file).replace(/\.(astro|tsx)$/, ''))) {
      problems.push(`registry "${id}" example doesn't import ${importPath(file)}`);
    }
  }
  return problems;
}

function propsSection(props) {
  if (!props) return ['No props.', ''];
  const lines = [];
  if (props.members.length) {
    lines.push('| Prop | Type | Default | Required | Notes |', '|------|------|---------|----------|-------|');
    for (const m of props.members) {
      lines.push(
        `| ${code(m.name)} | ${code(m.type)} | ${m.default ? (m.default.length > MAX_DEFAULT ? 'computed' : code(m.default)) : ''} | ${m.required ? 'yes' : ''} | ${cell(prose(m.doc))} |`,
      );
    }
    lines.push('');
  }
  if (props.extends.length) {
    lines.push(`Also accepts: ${props.extends.map(code).join(', ')}.`, '');
  }
  if (props.types.length) lines.push('Types:', '', '```ts', ...props.types, '```', '');
  if (!lines.length) lines.push('No props.', '');
  return lines;
}

function variantsSection(defs) {
  const lines = [];
  for (const def of defs) {
    if (!def.variants.length) continue;
    lines.push(`\`${def.exportName}\`:`, '', '| Variant | Options | Default |', '|---------|---------|---------|');
    for (const v of def.variants) {
      lines.push(`| ${code(v.name)} | ${v.options.map(code).join(', ')} | ${v.default ? code(v.default) : ''} |`);
    }
    lines.push('');
  }
  return lines;
}

export function generate(root = repoRoot) {
  const registry = JSON.parse(read(root, 'component-registry.json'));
  const problems = validateRegistry(registry);
  if (problems.length) return { problems, output: '' };

  const entries = Object.entries(registry.components);
  const out = [
    '# Velocity components',
    '',
    '<!-- Generated by scripts/generate-components-ref.mjs from component-registry.json and the component sources. Do not edit by hand. -->',
    '',
    'This file lists every component Velocity ships. Read it before reading component source or building a new component: reuse what exists here.',
    '',
    '- **Check the import path exists in this project.** Projects can be scaffolded with only some components, so a component listed here may not be installed.',
    '- **Missing components can be restored.** Follow "Restore a Velocity component" in the `velocity-add-component` skill: it downloads the files listed under **Files** for the version in `.velocity.json`, along with their dependencies. The CLI has no separate restore command; a fresh scaffold with the component selected also includes it.',
    '- **Import by file path**, as in the examples. Category barrels such as `ui/index.ts` are removed from partial installs.',
    '- Every `.astro` component accepts `class`, merged with `cn()`. Restyle with a wrapper in `src/components/patterns/` instead of editing a shipped file.',
    '- Examples use literal text to stay short. In real pages, pass copy from `t()` (see `.agents/velocity.md`).',
    '',
    '## Index',
    '',
    '| Component | Import | Description |',
    '|-----------|--------|-------------|',
  ];
  for (const [, c] of entries) {
    out.push(`| [${c.name}](#${c.name.toLowerCase()}) | ${code(importPath(primaryFile(c)))} | ${cell(prose(c.description))} |`);
  }
  out.push('');

  for (const [id, c] of entries) {
    const file = primaryFile(c);
    const cat = registry.categories[c.category];
    const category = [cat?.name ?? c.category, c.subcategory && (cat?.subcategories?.[c.subcategory]?.name ?? c.subcategory)]
      .filter(Boolean)
      .join(' / ');
    out.push(`## ${c.name}`, '');
    out.push(prose(c.description), '');
    out.push(`- **Import:** \`import ${c.name} from '${importPath(file)}';\``);
    const island = c.files.find((f) => f.endsWith(`/${c.name}.tsx`) && f !== file && exportsNamed(root, f, c.name));
    if (island) out.push(`- **React island:** \`import { ${c.name} } from '${importPath(island)}';\``);
    out.push(`- **Registry id:** \`${id}\` · **Category:** ${category}${c.premium ? ' · **Premium**' : ''}`);
    if (c.dependencies.components.length) {
      out.push(`- **Uses:** ${c.dependencies.components.map((d) => registry.components[d]?.name ?? d).join(', ')}`);
    }
    out.push(`- **Files:** ${c.files.map((f) => `\`${f}\``).join(', ')}`, '');

    out.push('### Props', '', ...propsSection(extractProps(root, file, c.name)));

    const slots = extractSlots(root, file);
    if (slots.length) out.push(`**Slots:** ${slots.map((s) => `\`${s}\``).join(', ')}`, '');

    const icons = extractIconNames(root, file);
    if (icons.length) {
      out.push('### Icon names', '', `Unknown names render the \`x\` icon. ${icons.map((n) => `\`${n}\``).join(', ')}`, '');
    }

    const variantFiles = c.files.filter((f) => f.endsWith('.variants.ts'));
    const variants = variantsSection(variantFiles.flatMap((f) => extractVariants(root, f)));
    if (variants.length) out.push('### Variants', '', `CVA definitions from ${variantFiles.map((f) => `\`${path.posix.basename(f)}\``).join(', ')}.`, '', ...variants);

    out.push('### Example', '', '```astro', c.example.trim(), '```', '');

    if (c.useInstead?.length) {
      out.push('### Use instead', '', ...c.useInstead.map((note) => `- ${prose(note)}`), '');
    }
  }
  return { problems: [], output: `${out.join('\n').trimEnd()}\n` };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  const { problems, output } = generate();
  if (problems.length) {
    console.error(problems.map((p) => `✗ ${p}`).join('\n'));
    process.exit(1);
  }
  const target = path.join(repoRoot, OUTPUT);
  const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : undefined;
  if (check) {
    if (current !== output) {
      console.error(`✗ ${OUTPUT} is out of date. Run: node scripts/generate-components-ref.mjs`);
      process.exit(1);
    }
    console.log(`✓ ${OUTPUT} is up to date`);
  } else {
    fs.writeFileSync(target, output);
    console.log(`✓ wrote ${OUTPUT}`);
  }
}
