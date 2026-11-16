/**
 * Site copy — English (default locale).
 *
 * This file is yours: upgrades never overwrite it. Put page copy here and use
 * it with `const t = useTranslations(locale); t('home.hero.title')`.
 * Any key from src/i18n/ui.ts can also be overridden here.
 *
 * Other locales live next to this file (es.ts, fr.ts, …). Missing keys fall
 * back to English.
 */
const en = {
  site: {
    tagline: 'A modern website built with Astro and Tailwind CSS',
  },

  meta: {
    home: {
      title: 'Astro 7 starter demo',
      description:
        'The Velocity starter as you get it: components, design tokens, forms, search and i18n, with the build figures for this page.',
    },
    about: {
      title: 'About Us',
      description: 'Learn about Velocity and the team behind it.',
    },
    contact: {
      title: 'Contact Us',
      description: 'Get in touch with the Velocity team.',
    },
  },

  home: {
    hero: {
      badge: 'Velocity v{version} · built {date}',
      badgeNoVersion: 'Built {date}',
      title: 'This page is Velocity,',
      titleHighlight: 'measured',
      titleEnd: '.',
      leadBefore: 'Every figure below is counted or measured when this page builds. Create a project with',
      leadAfter: 'and this becomes your home page, with your own numbers.',
      whatsNew: 'What 2.x changed',
      copied: 'Copied',
    },
    receipt: {
      title: 'Build receipt',
      commit: 'commit {sha}',
      components: 'Components',
      agentSkills: 'Agent skills',
      locales: 'Locales',
      jsKb: 'JS on this page',
      pages: 'Pages built',
      buildTime: 'Build time',
      installed: 'installed',
      counted: 'counted',
      measured: 'measured',
      config: 'config',
      note: "Versions come from the installed packages and counts from the project's files while this page renders. JavaScript (gzipped), pages and build time are measured once the build finishes and written into the page. A figure that can't be measured is left out.",
    },
    whatsNew: {
      eyebrow: "What's new in 2.x",
      heading: 'The changelog, running on this page.',
      intro: 'Each card is a 2.x change you can see here. The tag says whether it is new or changed since 1.x.',
      new: 'New',
      changed: 'Changed',
      astro: {
        title: 'Astro 7 underneath',
        text: 'Rust compiler, Vite 8, Actions and route caching. Pages are prerendered HTML, and this section ships no JavaScript.',
      },
      agents: {
        title: 'Agent skills in every project',
        text: 'Rules and skills for Claude Code, Codex and Cursor: how to add a page or a component, and which files an upgrade replaces.',
      },
      hue: {
        title: 'One brand hue, OKLCH scale',
        textBefore: 'All ten brand steps derive from',
        textAfter: '. Change one number and every brand color follows.',
      },
      blocks: {
        title: 'Page sections as components',
        text: 'Hero, features, pricing, FAQ, contact and more take your copy as props, so a new page is mostly writing.',
      },
    },
    specimens: {
      eyebrow: 'Components',
      heading: '{count} components, in their states.',
      intro: 'Real components, not screenshots. Hover, focus and press work here, and each tile names its source file. Switch the theme to see both.',
      theme: 'Theme',
      dark: 'Dark',
      light: 'Light',
      browse: 'Browse every component on the components page',
      primary: 'Primary',
      secondary: 'Secondary',
      outline: 'Outline',
      disabled: 'Disabled',
      emailLabel: 'Email',
      emailPlaceholder: 'you@example.com',
      emailHint: 'Hints sit under the field. Errors replace them.',
      tabAstro: 'Astro',
      tabReact: 'React',
      tabTokens: 'Tokens',
      tabAstroText: 'Static by default. No JavaScript unless a component needs it.',
      tabReactText: 'React 19 islands hydrate only where you add a client directive.',
      tabTokensText: 'Colors, spacing and radii are CSS variables in src/styles/tokens.',
      alertTitle: 'Message sent',
      alertText: 'Alerts come in info, success, warning and error.',
      switchLabel: 'Email me about releases',
      switchHint: 'A real checkbox with a switch role.',
      badgeDefault: 'Default',
      badgeSuccess: 'Success',
      badgeWarning: 'Warning',
      badgeInfo: 'Info',
      kbdText: 'Open search',
    },
    start: {
      eyebrow: 'Get started',
      heading: 'Start a project from this demo.',
      intro: 'Run the command, choose the flags you need, then follow the docs to make the site your own.',
      flagsLabel: 'CLI flags',
      flags: {
        demo: 'This page, the sample pages and blog posts',
        components: 'Choose which UI components to include',
        i18n: 'Multi-language routing, with Spanish and French copy',
        pages: 'Generate pages with routes and nav already wired',
        yes: 'Skip the prompts and use the defaults',
      },
      docs: 'Read the docs',
      github: 'Source on GitHub',
    },
  },

  about: {
    hero: {
      badge: 'Our Story',
      title: 'Built by developers,',
      titleHighlight: 'for developers.',
      description:
        'Velocity was born from the frustration of setting up the same tooling over and over. We decided to create the starter we always wished existed.',
    },
    mission: {
      title: 'Our Mission',
      text: 'To help developers ship beautiful, performant websites faster by eliminating boilerplate and providing sensible defaults.',
    },
    values: {
      title: 'What We Believe',
      performance: {
        title: 'Performance First',
        text: 'Every decision is made with performance in mind. Zero JavaScript by default, optimized images, and minimal CSS.',
      },
      simplicity: {
        title: 'Simplicity Matters',
        text: 'We strip away complexity so you can focus on what matters: building great products for your users.',
      },
      openSource: {
        title: 'Open Source',
        text: 'Velocity is free and open source. We believe in giving back to the community that made this possible.',
      },
    },
  },

  contact: {
    hero: {
      badge: 'Get in Touch',
      title: "Let's",
      titleHighlight: 'connect.',
      description: "Have a question, suggestion, or just want to say hello? We'd love to hear from you.",
    },
    form: {
      title: 'Send us a message',
      submit: 'Send Message',
      success: 'Message sent successfully! We will get back to you soon.',
      nameLabel: 'Your Name',
      emailLabel: 'Email Address',
      namePlaceholder: 'John Doe',
      emailPlaceholder: 'john@example.com',
      subjectPlaceholder: 'How can we help?',
      messagePlaceholder: 'Tell us more about your project or question...',
    },
    map: {
      ariaLabel: 'Map showing {name} location',
      placeholderTitle: 'Our Location',
    },
    other: {
      title: 'Other ways to reach us',
      email: 'Email',
      github: 'GitHub',
      twitter: 'Twitter',
    },
  },
};

export type SiteStrings = typeof en;
export default en;
