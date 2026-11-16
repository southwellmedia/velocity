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
      title: 'Démo du starter Astro 7',
      description:
        'Le starter Velocity tel que vous le recevez : composants, tokens de design, formulaires, recherche et i18n, avec les chiffres de compilation de cette page.',
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
      badge: 'Velocity v{version} · compilé le {date}',
      badgeNoVersion: 'Compilé le {date}',
      title: 'Cette page, c’est Velocity,',
      titleHighlight: 'mesuré',
      titleEnd: '.',
      leadBefore: 'Chaque chiffre de cette page est compté ou mesuré à la compilation. Créez un projet avec',
      leadAfter: 'et elle devient votre page d’accueil, avec vos propres chiffres.',
      whatsNew: 'Ce qui change en 2.x',
      copied: 'Copié',
    },
    receipt: {
      title: 'Reçu de compilation',
      commit: 'commit {sha}',
      components: 'Composants',
      agentSkills: 'Skills pour agents',
      locales: 'Langues',
      jsKb: 'JS sur cette page',
      pages: 'Pages générées',
      buildTime: 'Durée de compilation',
      installed: 'installé',
      counted: 'compté',
      measured: 'mesuré',
      config: 'config',
      note: 'Les versions viennent des paquets installés et les décomptes des fichiers du projet pendant le rendu de cette page. Le JavaScript (gzip), les pages et la durée de compilation sont mesurés à la fin de la compilation puis écrits dans la page. Un chiffre qui ne peut pas être mesuré n’est pas affiché.',
    },
    whatsNew: {
      eyebrow: 'Nouveautés de la 2.x',
      heading: 'Le changelog, en marche sur cette page.',
      intro: 'Chaque carte est un changement de la 2.x visible ici. L’étiquette indique s’il est nouveau ou modifié depuis la 1.x.',
      new: 'Nouveau',
      changed: 'Modifié',
      astro: {
        title: 'Astro 7 en dessous',
        text: 'Compilateur Rust, Vite 8, Actions et cache des routes. Les pages sont du HTML prérendu, et cette section n’envoie aucun JavaScript.',
      },
      agents: {
        title: 'Des skills pour agents dans chaque projet',
        text: 'Règles et skills pour Claude Code, Codex et Cursor : comment ajouter une page ou un composant, et quels fichiers une mise à jour remplace.',
      },
      hue: {
        title: 'Une seule teinte de marque, échelle OKLCH',
        textBefore: 'Les dix nuances de la marque dérivent de',
        textAfter: '. Changez un nombre et toutes les couleurs de marque suivent.',
      },
      blocks: {
        title: 'Des sections de page en composants',
        text: 'Hero, fonctionnalités, tarifs, FAQ, contact et plus reçoivent vos textes en props : une nouvelle page, c’est surtout de l’écriture.',
      },
    },
    specimens: {
      eyebrow: 'Composants',
      heading: '{count} composants, dans leurs états.',
      intro: 'De vrais composants, pas des captures. Survol, focus et clic fonctionnent ici, et chaque carte indique son fichier source. Changez de thème pour voir les deux.',
      theme: 'Thème',
      dark: 'Sombre',
      light: 'Clair',
      browse: 'Voir tous les composants sur la page des composants',
      primary: 'Principal',
      secondary: 'Secondaire',
      outline: 'Contour',
      disabled: 'Désactivé',
      emailLabel: 'E-mail',
      emailPlaceholder: 'vous@exemple.com',
      emailHint: 'L’aide s’affiche sous le champ. Les erreurs la remplacent.',
      tabAstro: 'Astro',
      tabReact: 'React',
      tabTokens: 'Tokens',
      tabAstroText: 'Statique par défaut. Pas de JavaScript sauf si un composant en a besoin.',
      tabReactText: 'Les îlots React 19 ne s’hydratent que là où vous ajoutez une directive client.',
      tabTokensText: 'Couleurs, espacements et rayons sont des variables CSS dans src/styles/tokens.',
      alertTitle: 'Message envoyé',
      alertText: 'Les alertes existent en info, succès, avertissement et erreur.',
      switchLabel: 'M’avertir des nouvelles versions',
      switchHint: 'Une vraie case à cocher avec le rôle d’interrupteur.',
      badgeDefault: 'Par défaut',
      badgeSuccess: 'Succès',
      badgeWarning: 'Avertissement',
      badgeInfo: 'Info',
      kbdText: 'Ouvrir la recherche',
    },
    start: {
      eyebrow: 'Démarrer',
      heading: 'Créez un projet à partir de cette démo.',
      intro: 'Lancez la commande, choisissez les flags utiles, puis suivez la documentation pour faire du site le vôtre.',
      flagsLabel: 'Flags de la CLI',
      flags: {
        demo: 'Cette page, les pages d’exemple et les articles de blog',
        components: 'Choisir les composants d’UI à inclure',
        i18n: 'Routage multilingue, avec les textes en espagnol et en français',
        pages: 'Générer des pages avec routes et navigation déjà reliées',
        yes: 'Passer les questions et garder les valeurs par défaut',
      },
      docs: 'Lire la documentation',
      github: 'Code source sur GitHub',
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
