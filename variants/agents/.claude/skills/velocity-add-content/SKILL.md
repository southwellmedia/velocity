---
name: velocity-add-content
description: Add content to this Velocity site, either a blog post with valid frontmatter or a new content collection (Content Layer, glob loader, Zod schema) with its own pages, URLs, search indexing and share images. Use when asked to write or publish a post, add articles, case studies, projects, team members or other structured content, or create a collection.
---

# Add content

**First, read the Project notes in `AGENTS.md`.** They describe this site's own conventions and take priority over the examples here.

Decide what's needed:

- **A blog post:** follow "Add a blog post". The blog already has its pages, feed, search and share images.
- **A new kind of content**, such as projects or case studies: follow "Add a collection".
- **A one-off page** such as Pricing: use the `velocity-add-page` skill instead.

## Add a blog post

Create `src/content/blog/<locale>/<slug>.mdx`, or `.md` without components. Use `defaultLocale` from `src/i18n/locales.mjs` as the folder for the main language. The file name becomes the URL slug, so use kebab-case.

The schema is the `blog` collection in `src/content.config.ts`:

```yaml
---
title: "Launching our new studio"            # required, at most 100 characters
description: "One sentence for cards, search results and the meta description." # required, at most 200
publishedAt: 2026-11-07                      # required
updatedAt: 2026-11-20                        # optional
author: "Jane Doe"                           # defaults to "Team"
image: ../../../assets/blog/new-studio.jpg   # optional, relative to this file, and the file must exist
imageAlt: "The studio's front entrance"      # required whenever image is set
tags: ["news", "studio"]                     # defaults to []
draft: false                                 # true shows the post in dev only
featured: false
locale: en                                   # match the folder
---
```

- The layout renders `title` as the page's `<h1>`, so start the body at `##` and don't skip heading levels.
- In MDX, import components by file path, such as `import Badge from '@/components/ui/data-display/Badge/Badge.astro';`. Check that the file exists first.
- Put images in `src/assets/` so Astro optimizes them, and give every image alt text.
- A translation shares the slug in another locale's folder, such as `src/content/blog/<locale>/<slug>.mdx`. The language switcher and hreflang link them automatically.
- The post gets its URL, the blog index, the RSS feed, search, its share image and E2E coverage automatically. A set `image` becomes the share image. Otherwise one is generated.

Link to posts only through `src/lib/blog.ts`: `getPosts(locale)` for lists, which excludes drafts in production and sorts newest first, and `getPostUrl(post)` for links. Never build `/blog/...` URLs by hand, because the locale prefix and slug rules live there.

## Add a collection

### 1. Define it

Add the collection to `src/config/collections.ts`, which is merged into `src/content.config.ts`. Don't edit `src/content.config.ts`: upgrades replace it. Don't reuse the names `blog`, `pages`, `authors` or `faqs`.

```ts
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { defaultLocale, locales } from '../i18n/locales.mjs';

const projects = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/projects' }),
  schema: ({ image }) =>
    z.object({
      title: z.string().max(100),
      description: z.string().max(200),
      cover: image().optional(),
      coverAlt: z.string().optional(),
      order: z.number().default(0),
      draft: z.boolean().default(false),
      locale: z.enum(locales).default(defaultLocale),
    }),
});

export const siteCollections = { projects };
```

- Import `z` from `astro/zod`, never from `zod`.
- Use `pattern: '**/*.json'` for data without a body, such as team members or testimonials.
- Keep a `locale` field if the site has, or may get, more than one language. Store entries in `src/content/<collection>/<locale>/`, like the blog.
- Run `npx astro sync` to generate the collection's types.

If the entries only appear inside an existing page, such as testimonials on the home page, stop here. Read them in that page's view with `getCollection()`, filtered by locale.

### 2. Give it URLs in one place

Create `src/lib/<collection>.ts`, modeled on `src/lib/blog.ts`, as the only code that maps entries to URLs. New files in `src/lib/` survive upgrades.

```ts
import { getCollection, type CollectionEntry } from 'astro:content';
import { defaultLocale, type Locale } from '@/i18n/config';
import { localizeRoute } from '@/i18n/paths';

export type Project = CollectionEntry<'projects'>;

/** 'en/acme-redesign' → 'acme-redesign' */
export const getProjectSlug = (entry: Project) => entry.id.split('/').slice(1).join('/');

export const getProjectUrl = (entry: Project) =>
  `${localizeRoute('projects', entry.data.locale)}/${getProjectSlug(entry)}`;

export async function getProjects(locale: Locale | string = defaultLocale) {
  const entries = await getCollection(
    'projects',
    (entry) => entry.data.locale === locale && (import.meta.env.PROD ? !entry.data.draft : true),
  );
  return entries.sort((a, b) => a.data.order - b.data.order);
}
```

Add the route to `routes` in `src/config/nav.config.ts` as `projects: { path: 'projects' }`. The entry pages live in a folder, so the route can't have translated `slugs`.

### 3. Add the pages

Use the view and wrapper pattern, modeled on the blog's files:

| Page | View | Default-locale wrapper | Localized wrapper |
|------|------|------------------------|-------------------|
| List | like `src/views/BlogIndexView.astro` | like `src/pages/blog/index.astro` | like `src/pages/[lang]/blog/index.astro` |
| Entry | like `src/views/BlogPostView.astro` | like `src/pages/blog/[...slug].astro` | like `src/pages/[lang]/blog/[...slug].astro` |

- The wrappers stay thin. Their `getStaticPaths()` calls your `get…()` helper and passes each entry to the view.
- The view renders the body with `const { Content } = await render(entry);` from `astro:content`, and links with your `get…Url()` helper.
- Use `PageLayout`. It renders the site header and footer and marks its content with `data-pagefind-body`, so search indexes it. A custom layout must add `data-pagefind-body` itself, or the pages won't appear in search.
- For hreflang between translated entries, pass `alternates` the way `BlogPostView` and `BlogLayout` do. `PageLayout` doesn't take them.
- Pass `image={entry.data.cover?.src}` to use the cover as the share image. Otherwise every page gets a generated one, so don't add share-image routes.
- Add the list page's copy and a `navItems` entry as described in the `velocity-add-page` skill.

### 4. Cover the entry pages in E2E

The list route is tested automatically because it's in `routes`. Entry pages aren't. Add a spec such as `tests/e2e/<collection>.spec.ts` that visits each entry URL and runs the same axe check as `tests/e2e/pages.spec.ts`. Don't edit `tests/e2e/site.ts`, because upgrades replace it.

## Check your work

1. Run `npm run validate`. Invalid frontmatter and missing images fail the build with the entry and field named.
2. Run `npm run check:agent`. It scans the source and build output for raw translation keys, CSP problems (inline event handlers, unhashed inline scripts), broken internal links and stubbed forms, and prints the file, the rule and the fix for each. Fix everything it reports.
3. Run `npm run build && npm run test:e2e` for the axe and CSP checks. If Playwright has no browser, run `npx playwright install chromium`.
4. Open the new pages in the dev server, and search for a phrase from the new content on the built site to confirm it's indexed. Drafts are visible in dev but missing from the build.
