/**
 * Site copy — French. Same keys as en.ts; missing keys fall back to English.
 * Built-in UI strings (nav, blog, forms, search) are already translated in
 * src/i18n/ui.ts. Override any of them here.
 */
import type { SiteStrings } from './en';

const fr: SiteStrings = {
  site: {
    tagline: 'Un site web moderne conçu avec Astro et Tailwind CSS',
  },

  meta: {
    home: {
      title: 'Le starter Astro complet',
      description:
        "Design tokens, composants accessibles, SEO et i18n configurés dès le premier commit. Velocity fournit ce que les autres starters vous laissent à faire.",
    },
    about: {
      title: 'À propos',
      description: "Découvrez Velocity et l'équipe qui le développe.",
    },
    contact: {
      title: 'Contact',
      description: "Contactez l'équipe Velocity.",
    },
  },

  home: {
    hero: {
      badge: 'La v2.0 est disponible, désormais sur Astro 7',
      title: 'Votre prochain site',
      titleHighlight: 'commence ici.',
      description:
        "Design tokens, composants accessibles, SEO et i18n configurés dès le premier commit. Velocity fournit ce que les autres starters vous laissent à faire.",
      docs: 'Voir la documentation',
      github: 'Voir sur GitHub',
      socialProof: 'En production chaque semaine.',
    },
  },

  landing: {
    techStack: {
      astro: 'Compilateur Rust, Vite 8, Actions, cache des routes et zéro JS par défaut',
      tailwind: 'Moteur Lightning CSS, API @theme et couleurs OKLCH',
      typescript: 'Mode strict, alias de chemins et inférence de types complète',
      react: 'Server components, actions et prise en charge du hook use()',
    },
    features: {
      heading: 'Tout ce dont vous avez besoin.',
      headingHighlight: 'Rien de superflu.',
      intro:
        "Nous avons retiré le superflu pour ne garder que les briques qui accélèrent vraiment le développement des agences et des freelances.",
      copy: 'Copier',
      copied: 'Copié',
      agents: {
        label: 'Agents IA',
        description: 'Règles et skills inclus',
        title: 'Prêt pour les agents IA',
        content:
          'Chaque projet inclut des règles et des skills pour Claude Code, Codex, Cursor et d\'autres agents. Ils savent ajouter des pages et des composants, et quels fichiers les mises à jour remplacent.',
      },
      theming: {
        label: 'Thèmes',
        description: 'Design tokens et mode sombre',
        title: 'Design tokens et mode sombre',
        content:
          "Système de design complet basé sur la configuration CSS-first de Tailwind v4, avec mode sombre intégré. Tokens de couleur sémantiques, détection des préférences système et persistance via localStorage.",
      },
      seo: {
        label: 'SEO et métadonnées',
        description: 'Images OG et données structurées',
        title: 'SEO automatisé',
        content:
          "Métadonnées typées pour chaque page avec génération automatique des images OG. Inclut le sitemap, le robots.txt et des données structurées JSON-LD.",
      },
      perf: {
        label: 'Performance',
        description: 'Zéro JS par défaut',
        title: 'Zéro JS par défaut',
        content:
          "L'architecture en îlots d'Astro garantit que vos pages n'envoient aucun JavaScript, sauf si elles sont explicitement interactives. Optimisé pour les Core Web Vitals.",
      },
      components: {
        label: 'Composants',
        description: "Primitives d'interface typées",
        title: 'Composants typés',
        content:
          "Primitives d'interface pensées pour TypeScript, avec validation complète des props et autocomplétion dans l'éditeur. Boutons, champs, cartes, fenêtres modales et bien plus.",
      },
      i18n: {
        label: 'Prêt pour l’i18n',
        description: 'Multilingue en option',
        title: 'Prêt pour l’i18n',
        content:
          "Ajoutez la prise en charge multilingue avec l'option --i18n. Traductions typées, détection automatique de la langue et URL optimisées pour le SEO.",
      },
      content: {
        label: 'Contenu',
        description: 'Blog, MDX et recherche',
        title: 'Contenu et recherche',
        content:
          'Collections de contenu typées avec des schémas Zod, prise en charge de MDX, flux RSS et intégration de Pagefind pour une recherche statique ultra-rapide.',
      },
    },
    lighthouse: {
      badge: 'Rapport Lighthouse',
      heading: 'Accessible et prêt pour les moteurs de recherche, dès le départ.',
      listLabel: 'Scores Lighthouse',
      accessibility: 'Accessibilité',
      bestPractices: 'Bonnes pratiques',
      seo: 'SEO',
      note: '*Mesuré en production sur la page de démonstration · Émulation ordinateur et mobile · Les résultats peuvent varier.',
    },
    credibility: {
      eyebrow: 'Une seule commande',
      heading: 'Générez exactement',
      headingHighlight: 'ce dont vous avez besoin.',
      intro:
        "Tous les projets n'ont pas besoin de tout. La CLI de Velocity vous laisse choisir votre point de départ.",
      pagesBefore: 'Besoin de pages personnalisées ? Utilisez',
      pagesMiddle: 'et elles sont générées avec les routes et la navigation déjà en place. Associez-la à',
      pagesAfter: 'et vous obtenez aussi les versions traduites, avec des traductions prêtes à remplir.',
      outro: "Pas d'assistant à parcourir, pas de questions à répondre. Juste des options qui font ce qu'elles disent.",
      flags: {
        demo: "Page d'accueil de démonstration et articles de blog",
        components: "24 composants d'interface optionnels",
        i18n: 'Routage multilingue configuré',
        pages: 'Génère des pages (et leurs versions i18n)',
        yes: 'Ignore les questions et utilise les valeurs par défaut',
      },
      stats: {
        command: 'commande pour démarrer',
        flags: 'options de personnalisation',
        components: 'composants inclus',
      },
      terminalComment: 'Ajoutez ce dont vous avez besoin',
      terminalSuccess: 'Projet créé avec succès !',
    },
    cta: {
      heading: 'Arrêtez de configurer.',
      headingHighlight: 'Commencez à créer.',
      description:
        'Rejoignez les développeurs qui créent des sites plus rapides et de meilleure qualité avec Velocity. Open source et gratuit pour toujours.',
      docs: 'Voir la documentation',
    },
  },

  about: {
    hero: {
      badge: 'Notre histoire',
      title: 'Conçu par des développeurs,',
      titleHighlight: 'pour des développeurs.',
      description:
        "Velocity est né de la frustration de configurer sans cesse les mêmes outils. Nous avons décidé de créer le starter que nous aurions aimé avoir.",
    },
    mission: {
      title: 'Notre mission',
      text: 'Aider les développeurs à livrer plus vite des sites web élégants et performants, en supprimant le code répétitif et en proposant des réglages par défaut judicieux.',
    },
    values: {
      title: 'Nos convictions',
      performance: {
        title: "La performance d'abord",
        text: 'Chaque décision est prise en pensant à la performance. Zéro JavaScript par défaut, images optimisées et CSS minimal.',
      },
      simplicity: {
        title: 'La simplicité compte',
        text: "Nous éliminons la complexité pour que vous puissiez vous concentrer sur l'essentiel : créer d'excellents produits pour vos utilisateurs.",
      },
      openSource: {
        title: 'Open source',
        text: 'Velocity est gratuit et open source. Nous tenons à rendre à la communauté qui a rendu ce projet possible.',
      },
    },
  },

  contact: {
    hero: {
      badge: 'Contactez-nous',
      title: 'Restons',
      titleHighlight: 'en contact.',
      description: 'Une question, une suggestion ou simplement envie de dire bonjour ? Nous serions ravis de vous lire.',
    },
    form: {
      title: 'Envoyez-nous un message',
      submit: 'Envoyer le message',
      success: 'Message envoyé avec succès ! Nous vous répondrons rapidement.',
      nameLabel: 'Votre nom',
      emailLabel: 'Adresse e-mail',
      namePlaceholder: 'Jean Dupont',
      emailPlaceholder: 'jean@exemple.fr',
      subjectPlaceholder: 'Comment pouvons-nous vous aider ?',
      messagePlaceholder: 'Parlez-nous de votre projet ou de votre question...',
    },
    map: {
      ariaLabel: 'Carte indiquant l’emplacement de {name}',
      placeholderTitle: 'Où nous trouver',
    },
    other: {
      title: 'Autres moyens de nous joindre',
      email: 'E-mail',
      github: 'GitHub',
      twitter: 'Twitter',
    },
  },
};

export default fr;
