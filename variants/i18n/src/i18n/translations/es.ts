/**
 * Site copy — Spanish. Same keys as en.ts; missing keys fall back to English.
 * Built-in UI strings (nav, blog, forms, search) are already translated in
 * src/i18n/ui.ts. Override any of them here.
 */
import type { SiteStrings } from './en';

const es: SiteStrings = {
  site: {
    tagline: 'Un sitio web moderno creado con Astro y Tailwind CSS',
  },

  meta: {
    home: {
      title: 'El starter completo para Astro',
      description:
        'Tokens de diseño, componentes accesibles, SEO e i18n configurados desde el primer commit. Velocity incluye lo que otros starters dejan como tarea pendiente.',
    },
    about: {
      title: 'Sobre nosotros',
      description: 'Conoce Velocity y al equipo que lo hace posible.',
    },
    contact: {
      title: 'Contacto',
      description: 'Ponte en contacto con el equipo de Velocity.',
    },
  },

  home: {
    hero: {
      badge: 'Ya está aquí la v2.0, ahora con Astro 7',
      title: 'Tu próximo sitio',
      titleHighlight: 'empieza aquí.',
      description:
        'Tokens de diseño, componentes accesibles, SEO e i18n configurados desde el primer commit. Velocity incluye lo que otros starters dejan como tarea pendiente.',
      docs: 'Ver documentación',
      github: 'Ver en GitHub',
      socialProof: 'En producción cada semana.',
    },
  },

  landing: {
    techStack: {
      astro: 'Compilador en Rust, Vite 8, Actions, caché de rutas y cero JS por defecto',
      tailwind: 'Motor Lightning CSS, API @theme y colores OKLCH',
      typescript: 'Modo estricto, alias de rutas e inferencia de tipos completa',
      react: 'Server components, actions y compatibilidad con el hook use()',
    },
    features: {
      heading: 'Todo lo que necesitas.',
      headingHighlight: 'Nada que te sobre.',
      intro:
        'Eliminamos lo superfluo y nos quedamos con las piezas que de verdad aceleran el desarrollo para agencias y freelancers.',
      copy: 'Copiar',
      copied: 'Copiado',
      theming: {
        label: 'Temas',
        description: 'Tokens de diseño y modo oscuro',
        title: 'Tokens de diseño y modo oscuro',
        content:
          'Sistema de diseño completo con la configuración CSS-first de Tailwind v4 y modo oscuro integrado. Tokens de color semánticos, detección de la preferencia del sistema y persistencia en localStorage.',
      },
      seo: {
        label: 'SEO y metadatos',
        description: 'Imágenes OG y datos estructurados',
        title: 'SEO automatizado',
        content:
          'Metadatos tipados en cada página con generación automática de imágenes OG. Incluye sitemap, robots.txt y datos estructurados JSON-LD.',
      },
      perf: {
        label: 'Rendimiento',
        description: 'Cero JS por defecto',
        title: 'Cero JS por defecto',
        content:
          'La arquitectura de islas de Astro garantiza que tus páginas envíen 0 KB de JavaScript salvo que sean interactivas de forma explícita. Optimizado para las Core Web Vitals.',
      },
      components: {
        label: 'Componentes',
        description: 'Primitivas de UI tipadas',
        title: 'Componentes con tipado seguro',
        content:
          'Primitivas de UI pensadas para TypeScript, con validación completa de props y autocompletado en el editor. Incluye botones, campos, tarjetas, modales y mucho más.',
      },
      i18n: {
        label: 'Listo para i18n',
        description: 'Multilingüe opcional',
        title: 'Listo para i18n',
        content:
          'Añade soporte multilingüe con la opción --i18n. Incluye traducciones tipadas, detección automática del idioma y URL optimizadas para SEO.',
      },
      content: {
        label: 'Contenido',
        description: 'Blog, MDX y búsqueda',
        title: 'Contenido y búsqueda',
        content:
          'Colecciones de contenido tipadas con esquemas Zod, soporte para MDX, feeds RSS e integración con Pagefind para una búsqueda estática ultrarrápida.',
      },
    },
    lighthouse: {
      badge: 'Informe de Lighthouse',
      heading: 'Accesible y lista para los buscadores desde el primer momento.',
      listLabel: 'Puntuaciones de Lighthouse',
      accessibility: 'Accesibilidad',
      bestPractices: 'Buenas prácticas',
      seo: 'SEO',
      note: '*Medido en producción en la página de demostración · Emulación de escritorio y móvil · Los resultados pueden variar.',
    },
    credibility: {
      eyebrow: 'Un solo comando',
      heading: 'Genera exactamente',
      headingHighlight: 'lo que necesitas.',
      intro: 'No todos los proyectos lo necesitan todo. La CLI de Velocity te deja elegir tu punto de partida.',
      pagesBefore: '¿Necesitas páginas propias? Usa',
      pagesMiddle: 'y se generan con las rutas y la navegación ya conectadas. Combínalo con',
      pagesAfter: 'y obtendrás también las versiones traducidas, con las traducciones listas para usar.',
      outro: 'Sin asistentes que recorrer ni preguntas que contestar. Solo opciones que hacen lo que dicen.',
      flags: {
        demo: 'Landing de ejemplo y artículos de blog',
        components: '24 componentes de UI opcionales',
        i18n: 'Rutas multilingües configuradas',
        pages: 'Genera páginas (y sus versiones i18n)',
        yes: 'Omite las preguntas y usa los valores por defecto',
      },
      stats: {
        command: 'comando para empezar',
        flags: 'opciones para personalizar',
        components: 'componentes incluidos',
      },
      terminalComment: 'Añade lo que necesites',
      terminalSuccess: '¡Proyecto creado correctamente!',
    },
    cta: {
      heading: 'Deja de configurar.',
      headingHighlight: 'Empieza a construir.',
      description:
        'Únete a los desarrolladores que crean sitios web mejores y más rápidos con Velocity. De código abierto y gratis para siempre.',
      docs: 'Ver documentación',
    },
  },

  about: {
    hero: {
      badge: 'Nuestra historia',
      title: 'Creado por desarrolladores,',
      titleHighlight: 'para desarrolladores.',
      description:
        'Velocity nació de la frustración de configurar las mismas herramientas una y otra vez. Decidimos crear el starter que siempre quisimos tener.',
    },
    mission: {
      title: 'Nuestra misión',
      text: 'Ayudar a los desarrolladores a lanzar sitios web atractivos y de alto rendimiento más rápido, eliminando el código repetitivo y ofreciendo valores por defecto sensatos.',
    },
    values: {
      title: 'En lo que creemos',
      performance: {
        title: 'El rendimiento, primero',
        text: 'Cada decisión se toma pensando en el rendimiento. Cero JavaScript por defecto, imágenes optimizadas y CSS mínimo.',
      },
      simplicity: {
        title: 'La sencillez importa',
        text: 'Eliminamos la complejidad para que puedas centrarte en lo importante: crear grandes productos para tus usuarios.',
      },
      openSource: {
        title: 'Código abierto',
        text: 'Velocity es gratuito y de código abierto. Creemos en devolver a la comunidad que lo hizo posible.',
      },
    },
  },

  contact: {
    hero: {
      badge: 'Escríbenos',
      title: 'Hablemos',
      titleHighlight: 'cuando quieras.',
      description: '¿Tienes una pregunta, una sugerencia o simplemente quieres saludar? Nos encantará saber de ti.',
    },
    form: {
      title: 'Envíanos un mensaje',
      submit: 'Enviar mensaje',
      success: '¡Mensaje enviado correctamente! Te responderemos pronto.',
      nameLabel: 'Tu nombre',
      emailLabel: 'Correo electrónico',
      namePlaceholder: 'Juan Pérez',
      emailPlaceholder: 'juan@ejemplo.com',
      subjectPlaceholder: '¿En qué podemos ayudarte?',
      messagePlaceholder: 'Cuéntanos más sobre tu proyecto o tu pregunta...',
    },
    map: {
      ariaLabel: 'Mapa con la ubicación de {name}',
      placeholderTitle: 'Dónde estamos',
    },
    other: {
      title: 'Otras formas de contactarnos',
      email: 'Correo electrónico',
      github: 'GitHub',
      twitter: 'Twitter',
    },
  },
};

export default es;
