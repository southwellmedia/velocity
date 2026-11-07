# Velocity agent benchmark

A repeatable benchmark of what Velocity adds when an AI coding agent builds a site. It gives the same six plain-language requests to an agent in three kinds of project, then scores the result automatically in a real browser.

This directory is repo-only tooling. It is removed from scaffolded projects (`velocity-manifest.json → scaffold.cleanup`).

## What it measures

### Arms

| Arm                       | Project the agent starts in                                                                                                                                                                                           | Question it answers                                                                                               |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `velocity`                | This repo at a git commit (default `HEAD`), scaffolded with `scripts/scaffold.mjs`, the reference implementation of what `create-velocity-astro` produces. Default options: `demo=false, i18n=false, components=all`. | Baseline.                                                                                                         |
| `velocity-no-agent-files` | The same project with `AGENTS.md`, `CLAUDE.md`, `.agents/` and `.claude/` removed. Nothing else differs (the self-test checks this).                                                                                  | **velocity vs this arm:** what the agent files add, with the code held constant. This is the cleanest comparison. |
| `astro`                   | `npm create astro@latest -- --template minimal`.                                                                                                                                                                      | **velocity vs astro:** what the whole starter adds (code, conventions and agent files together).                  |

Every project has its dependencies installed, is a fresh git repository with one commit, and is called `site`. All runs of an arm start from a byte-identical copy.

### Tasks

`tasks/*.md` hold the prompts, sent verbatim (front matter removed). They are written the way a non-expert would ask, are identical across arms, and never mention Velocity, Astro or agent files (the self-test checks this). The only placeholder is `{{CONTACT_ENDPOINT}}`, which is the same URL for every arm.

| Task           | Required checks (all must pass)                                                                                                                                                                                                                                                         |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pricing-page` | Page exists (linked from home with "pricing" text, or a URL containing "pric"), exactly one `<h1>`, all three plan names and prices, at least three sign-up style buttons or links, linked from the header/nav.                                                                         |
| `faq-page`     | Page exists, one `<h1>`, all three questions and answers, linked from the footer. (FAQPage structured data is reported, not scored.)                                                                                                                                                    |
| `rebrand`      | On the home page, a visible element (text, background, border or SVG) within OKLab distance 0.05 of `#0F766E`; body, paragraph and heading text set in Inter; an Inter web font actually loaded.                                                                                        |
| `spanish`      | A page with `<html lang="es">`; the home page links to it; it links back to an English page; its text is different from the English home page and reads as Spanish (function-word count).                                                                                               |
| `contact-form` | A contact page with a form that has an email field; filling and submitting it in the browser delivers a request to the mock endpoint containing the test email and message; that request is JSON with `name`, `email` and `message`. (An on-page confirmation is reported, not scored.) |
| `blog-post`    | A page whose `<h1>` is the title; all three paragraphs; the date (2 November 2026, in any common format or a `<time datetime>`); the blog page links to it.                                                                                                                             |

Checks look only at the built site, served by `astro preview` and inspected in Chromium. They never look at file paths or framework conventions, so they apply equally to every arm. The crawler follows links from `/` and also visits every HTML page in the build output.

### Metrics

Reported separately so a reader can ignore the ones that favour Velocity by construction.

**Neutral** (apply to every arm):

- **Task passed**: every required check passed. Also the share of required checks passed.
- **Build passed**: install and `build` succeed with the project's package manager.
- **Accessibility**: axe-core WCAG 2 A/AA, serious and critical impact only, on desktop and mobile viewports with reduced motion, on `/` plus the pages the task touched (for `rebrand`, `/` plus four more pages, since a colour change affects contrast everywhere). Counted as distinct (page, rule) pairs.
- **Site health**: broken internal links, JavaScript errors.
- **Cost**: turns, input tokens (including cache reads and writes), output tokens, cost in USD, wall time, files changed. Fields the agent doesn't report are `n/a`, never 0.
- **Lighthouse** (optional, `--lighthouse`): only if a `lighthouse` CLI is on `PATH`.

**Velocity-specific** (plain Astro has no equivalent by default, so compare the two Velocity arms with each other):

- **CSP**: whether the site ships a Content Security Policy, and how many `securitypolicyviolation` events fire while the crawler, axe and the contact-form submission run. A violation means something the agent added is blocked in the browser.
- **i18n**: whether the Spanish task produced `hreflang` alternates.

## How to run

Requirements: the Velocity repo with dependencies installed (`pnpm install`; the scorer uses its `@axe-core/playwright`), Playwright's Chromium (`npx playwright install chromium`), git, npm, pnpm, network access to npm and GitHub (for `npm create astro`), and the agent CLI, logged in.

**Run it in a disposable VM or container.** The agent runs with permission prompts disabled.

```bash
# 1. Prove the scorer works on this machine (no model calls, ~2 minutes)
pnpm bench:selftest

# 2. Full run: 6 tasks × 3 arms × 5 repeats = 90 agent sessions
pnpm bench --model claude-opus-5-5

# Smaller or partial runs
pnpm bench --model claude-opus-5-5 --repeats 1 --tasks pricing-page,rebrand --arms velocity,velocity-no-agent-files

# Continue an interrupted run (skips completed runs, keeps the same seed and options)
pnpm bench --resume benchmark/results/2026-11-07-claude

# Score any project by hand, or rebuild a summary
pnpm bench:score --project /path/to/site --task all
pnpm bench:summary benchmark/results/2026-11-07-claude
```

Without the package scripts, use `node benchmark/run.mjs`, `node benchmark/score.mjs`, `node benchmark/summarize.mjs` and `node benchmark/selftest.mjs`.

### Agents

The agent command is a template. `{prompt}`, `{model}` and `{cwd}` are replaced per argument with no shell involved, so prompts need no escaping.

| `--agent`          | Template                                                                                                                                                                   | Status                                                                                             |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `claude` (default) | `claude -p {prompt} --model {model} --permission-mode bypassPermissions --output-format json --setting-sources project,local --strict-mcp-config --no-session-persistence` | Default. Metrics parsed from the JSON result: turns, tokens, cost, models used.                    |
| `codex`            | `codex exec --json --model {model} --dangerously-bypass-approvals-and-sandbox --skip-git-repo-check {prompt}`                                                              | Optional, not verified here. Tokens summed from `turn.completed` events; turns and cost are `n/a`. |
| `cursor`           | `cursor-agent -p {prompt} --model {model} --force --output-format json`                                                                                                    | Optional, not verified here. Usage parsed if present.                                              |

Anything else: `--agent-cmd '<template>'`. Check the flags against your installed version. `--setting-sources project,local` and `--strict-mcp-config` stop your own Claude Code settings, plugins and MCP servers from leaking into runs. Personal memory files can still load, so run with a clean user profile (for example a fresh container, or `CLAUDE_CONFIG_DIR` pointing to an empty directory you have logged in to).

### Options

| Option                    | Default                                |                                                                                                                                           |
| ------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `--model` / `BENCH_MODEL` | required                               | Pinned model ID. Use a dated or full ID, not an alias. `--allow-unpinned-model` overrides the requirement.                                |
| `--repeats`               | `5`                                    | Runs per task × arm.                                                                                                                      |
| `--tasks`, `--arms`       | all                                    | Comma-separated.                                                                                                                          |
| `--seed`                  | random, recorded                       | Run order is shuffled so arms interleave over time.                                                                                       |
| `--timeout-min`           | `30`                                   | Per agent session. A timeout counts as a failure.                                                                                         |
| `--velocity-ref`          | `HEAD`                                 | Git ref to scaffold from (`worktree` uses uncommitted files; don't publish those).                                                        |
| `--velocity-options`      | `demo=false,i18n=false,components=all` | Scaffold options.                                                                                                                         |
| `--create-astro-version`  | `latest`                               | Pin it (for example `4.13.1`) for reproducible astro-arm runs.                                                                            |
| `--allow-astro-fallback`  | off                                    | If `npm create astro` can't download the template, use a local stand-in. Results are labelled and must not be published as the astro arm. |
| `--mock-port`             | `4599`                                 | Port of the mock form provider (`http://127.0.0.1:<port>/messages`).                                                                      |
| `--work-dir`              | `$TMPDIR/velocity-bench`               | Where projects are created. `--keep-projects` keeps them.                                                                                 |
| `--out`                   | `benchmark/results/<date>-<agent>`     |                                                                                                                                           |
| `--lighthouse`            | off                                    |                                                                                                                                           |

### What a run does

For every task × arm × repeat, in shuffled order:

1. Copy the arm's base project and commit it.
2. Start the mock form provider. It records every request and sends CORS headers, as hosted form services do, so sending from the browser or the server both work.
3. Run the agent in the project with the task prompt. Kill anything it left running there, such as a dev server.
4. Score: record the diff, install, build, serve with `astro preview`, crawl, run the task checks, run axe, collect CSP violations.
5. Append one line to `raw.jsonl`. Delete the project.

Then write `summary.md`.

## Reading the results

`benchmark/results/<date>-<agent>/` contains:

- `meta.json`: agent template, pinned model and the models the agent reported using, Velocity commit and version, `create-astro` source and Astro version, task file hashes, scorer hash, seed, options.
- `raw.jsonl`: one record per run, with every check and its detail.
- `summary.md`: the tables below.
- `runs/<task>__<arm>__r<n>/`: prompt, agent stdout/stderr, the agent's diff, install, build and preview logs, and the crawl.

In `summary.md`, rates are shown as `passed/n (%, low–high)` with a Wilson 95% interval. With five repeats an interval spans roughly 30 to 40 points either side, so a 5/5 against 3/5 difference is suggestive, not conclusive. Treat differences with overlapping intervals as noise, and run more repeats before claiming one. Medians are over all runs in a group. Agent errors, timeouts and failed builds count as failures and are never dropped.

Read the comparisons separately:

- `velocity` vs `velocity-no-agent-files` isolates the agent files.
- `velocity` vs `astro` measures the whole starter. Velocity already has a blog, multilingual routing, a contact form component and a theme system, so some tasks are less work there. That is part of what Velocity adds, but it is not evidence about the agent files.

## Self-test

`pnpm bench:selftest` (no model calls) checks that the scorer can tell done from not done:

1. Unit checks: template splitting, agent output parsing, prompts free of Velocity/Astro hints.
2. Negative control: an untouched Velocity project. Every task must fail and no required check may pass, while build, axe (0 serious/critical) and CSP (present, 0 violations) are clean and the diff is empty.
3. Reference: Velocity scaffolded with `--i18n` must pass the Spanish checks, so they don't penalise Velocity's language switcher.
4. Ablation arm: only the agent files differ from the velocity arm.
5. Negative control: an untouched plain Astro project. Every task must fail.
6. Positive control: plain Astro plus a hand-written solution to all six tasks (`selftest/fixtures/astro-all-tasks`). Every task must pass with 0 serious/critical axe issues. This shows the checks can be passed without Velocity.
7. Pipeline: `run.mjs` end to end with a no-op agent (`selftest/noop-agent.mjs`), one task, all arms, into a temp directory.

## Caveats

- **Variance.** Agents are non-deterministic. Five repeats show large effects only. Report n and intervals with every number.
- **Model pinning.** Always pass a full model ID, and check `meta.json → agent.modelsReported`. An agent may use more than one model (for example a small model for housekeeping), and providers can change what an alias points to.
- **Versions drift.** `npm create astro@latest` and the agent CLI change over time. Pin `--create-astro-version`, record the CLI version, and compare only runs made with the same versions.
- **Scaffold fidelity.** The velocity arm comes from `scripts/scaffold.mjs`, not the published `create-velocity-astro`. The two implement the same contract, but the CLI may differ in details (for example writing `.velocity.json`).
- **Who wrote the tasks.** The tasks and checks were written for Velocity, which risks choosing tasks it is good at. The positive control shows the checks are achievable in plain Astro. More tasks from people outside the project are welcome.
- **Strict checks.** Checks test what the prompt asked for, not what the starter makes easy. For example, Velocity documents recolouring the brand scale with `--brand-hue`. Changing only the hue gives a different teal and fails the `#0F766E` check, because the user asked for that colour. `summary.md` shows the median colour distance so near misses are visible.
- **Lenient checks.** Text checks are substring matches. "Pro" would also match "professional", and the Spanish check counts function words rather than judging translation quality. A pass means the request was met in substance, not that the result is good. Read the diffs.
- **Serving.** Sites are served with `astro preview`. A project switched to an adapter that `astro preview` can't serve (for example some serverless adapters) fails the browser checks even if it would work when deployed.
- **Cost figures** are whatever the agent reports. Claude Code's `total_cost_usd` is an estimate at API list prices.

## Publishing

Publish every complete run, including ones where Velocity looks worse: the whole results directory, not a selection. Don't re-run single cells until they look better. If a run was broken (for example, auth expired halfway through), say so, and publish the re-run next to it rather than instead of it. Don't publish runs that used `--allow-astro-fallback`, `--velocity-ref worktree` or an unpinned model as headline results.
