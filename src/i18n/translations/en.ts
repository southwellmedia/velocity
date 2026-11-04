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
      title: 'The Complete Astro Starter',
      description:
        'Design tokens, accessible components, SEO, and i18n configured from the first commit. Velocity ships what other starters leave as homework.',
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
      badge: 'v2.0 is live — now on Astro 7',
      title: 'Your next site',
      titleHighlight: 'starts here.',
      description:
        'Design tokens, accessible components, SEO, and i18n configured from the first commit. Velocity ships what other starters leave as homework.',
      docs: 'View Docs',
      github: 'View on GitHub',
      socialProof: 'Shipped to production weekly.',
    },
  },

  landing: {
    techStack: {
      astro: 'Rust compiler, Vite 8, Actions, route caching, zero-JS by default',
      tailwind: 'Lightning CSS engine, @theme API, OKLCH colors',
      typescript: 'Strict mode, path aliases, full type inference',
      react: 'Server components, actions, use() hook support',
    },
    features: {
      heading: 'Everything you need.',
      headingHighlight: "Nothing you don't.",
      intro:
        'We stripped away the bloat and kept the primitives that actually speed up development for agencies and freelancers.',
      copy: 'Copy',
      copied: 'Copied',
      theming: {
        label: 'Theming',
        description: 'Design tokens & dark mode',
        title: 'Design Tokens & Dark Mode',
        content:
          "Complete design system using Tailwind v4's CSS-first configuration with built-in dark mode. Semantic color tokens, system preference detection, and localStorage persistence.",
      },
      seo: {
        label: 'SEO & Meta',
        description: 'OG images & structured data',
        title: 'Automated SEO Handling',
        content:
          'Strictly typed metadata injection for every page with automatic OG image generation. Includes sitemap, robots.txt, and JSON-LD structured data.',
      },
      perf: {
        label: 'Performance',
        description: 'Zero JS by default',
        title: 'Zero JS by Default',
        content:
          "Astro's island architecture ensures your pages ship 0kb of JavaScript unless explicitly interactive. Optimized for Core Web Vitals.",
      },
      components: {
        label: 'Components',
        description: 'Type-safe UI primitives',
        title: 'Type-Safe Components',
        content:
          'TypeScript-first UI primitives with full prop validation and IDE autocompletion. Includes buttons, inputs, cards, modals, and more.',
      },
      i18n: {
        label: 'i18n Ready',
        description: 'Optional multi-language',
        title: 'i18n Ready',
        content:
          'Add multi-language support with the --i18n flag. Includes type-safe translations, automatic locale detection, and SEO-friendly URL structures.',
      },
      content: {
        label: 'Content',
        description: 'Blog, MDX & search',
        title: 'Content & Search',
        content:
          'Type-safe content collections with Zod schemas, MDX support, RSS feeds, and Pagefind integration for lightning-fast static search.',
      },
    },
    lighthouse: {
      badge: 'Lighthouse Report',
      heading: 'Perfect scores. Out of the box.',
      listLabel: 'Lighthouse scores',
      performance: 'Performance',
      accessibility: 'Accessibility',
      bestPractices: 'Best Practices',
      seo: 'SEO',
      note: '*Tested in production for landing page demo · Desktop & Mobile emulation · Results will vary.',
    },
    credibility: {
      eyebrow: 'One Command',
      heading: 'Scaffold exactly',
      headingHighlight: 'what you need.',
      intro: 'Not every project needs everything. The Velocity CLI lets you pick your starting point.',
      pagesBefore: 'Need custom pages? Use',
      pagesMiddle: "and they're generated with routes and nav already wired. Pair it with",
      pagesAfter: 'and you get localized versions too—translations scaffolded and ready.',
      outro: 'No prompts to click through. No wizard to escape. Just flags that do what they say.',
      flags: {
        demo: 'Sample landing page + blog posts',
        components: '24 optional UI components',
        i18n: 'Multi-language routing configured',
        pages: 'Generate pages (+ i18n versions)',
        yes: 'Skip prompts, use defaults',
      },
      stats: {
        command: 'command to start',
        flags: 'flags to customize',
        components: 'components included',
      },
      terminalComment: 'Add what you need',
      terminalSuccess: 'Project created successfully!',
    },
    cta: {
      heading: 'Stop configuring.',
      headingHighlight: 'Start building.',
      description:
        'Join the developers building faster, better websites with Velocity. Open source and free forever.',
      docs: 'View Docs',
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
