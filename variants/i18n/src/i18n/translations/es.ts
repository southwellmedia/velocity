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
      title: 'El starter de Astro 7 en demo',
      description:
        'El starter Velocity tal como lo recibes: componentes, tokens de diseño, formularios, búsqueda e i18n, con las cifras de compilación de esta página.',
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
      badge: 'Velocity v{version} · compilado el {date}',
      badgeNoVersion: 'Compilado el {date}',
      title: 'Esta página es Velocity,',
      titleHighlight: 'medido',
      titleEnd: '.',
      leadBefore: 'Cada cifra de esta página se cuenta o se mide al compilarla. Crea un proyecto con',
      leadAfter: 'y esta será tu página de inicio, con tus propias cifras.',
      whatsNew: 'Qué cambió en 2.x',
      copied: 'Copiado',
    },
    receipt: {
      title: 'Recibo de compilación',
      commit: 'commit {sha}',
      components: 'Componentes',
      agentSkills: 'Skills para agentes',
      locales: 'Idiomas',
      jsKb: 'JS en esta página',
      pages: 'Páginas generadas',
      buildTime: 'Tiempo de compilación',
      installed: 'instalado',
      counted: 'contado',
      measured: 'medido',
      config: 'config',
      note: 'Las versiones salen de los paquetes instalados y los recuentos de los archivos del proyecto mientras se genera esta página. El JavaScript (con gzip), las páginas y el tiempo de compilación se miden al terminar la compilación y se escriben en la página. Si una cifra no se puede medir, no se muestra.',
    },
    whatsNew: {
      eyebrow: 'Novedades de 2.x',
      heading: 'El changelog, funcionando en esta página.',
      intro: 'Cada tarjeta es un cambio de 2.x que puedes ver aquí. La etiqueta indica si es nuevo o si cambió desde 1.x.',
      new: 'Nuevo',
      changed: 'Cambiado',
      astro: {
        title: 'Astro 7 por debajo',
        text: 'Compilador en Rust, Vite 8, Actions y caché de rutas. Las páginas son HTML prerenderizado y esta sección no envía JavaScript.',
      },
      agents: {
        title: 'Skills para agentes en cada proyecto',
        text: 'Reglas y skills para Claude Code, Codex y Cursor: cómo añadir una página o un componente, y qué archivos reemplaza una actualización.',
      },
      hue: {
        title: 'Un solo tono de marca, escala OKLCH',
        textBefore: 'Los diez pasos de la marca salen de',
        textAfter: '. Cambia un número y todos los colores de marca lo siguen.',
      },
      blocks: {
        title: 'Secciones de página como componentes',
        text: 'Hero, características, precios, FAQ, contacto y más reciben tus textos como props, así que una página nueva es sobre todo escribir.',
      },
    },
    specimens: {
      eyebrow: 'Componentes',
      heading: '{count} componentes, en sus estados.',
      intro: 'Componentes reales, no capturas. Hover, foco y pulsación funcionan aquí, y cada tarjeta indica su archivo. Cambia el tema para ver los dos.',
      theme: 'Tema',
      dark: 'Oscuro',
      light: 'Claro',
      browse: 'Ver todos los componentes en la página de componentes',
      primary: 'Principal',
      secondary: 'Secundario',
      outline: 'Contorno',
      disabled: 'Desactivado',
      emailLabel: 'Correo electrónico',
      emailPlaceholder: 'tu@ejemplo.com',
      emailHint: 'Las ayudas van bajo el campo. Los errores las sustituyen.',
      tabAstro: 'Astro',
      tabReact: 'React',
      tabTokens: 'Tokens',
      tabAstroText: 'Estático por defecto. Sin JavaScript salvo que un componente lo necesite.',
      tabReactText: 'Las islas de React 19 solo se hidratan donde añades una directiva client.',
      tabTokensText: 'Colores, espaciado y radios son variables CSS en src/styles/tokens.',
      alertTitle: 'Mensaje enviado',
      alertText: 'Las alertas pueden ser de información, éxito, aviso o error.',
      switchLabel: 'Avisarme de nuevas versiones',
      switchHint: 'Un checkbox real con rol de interruptor.',
      badgeDefault: 'Por defecto',
      badgeSuccess: 'Éxito',
      badgeWarning: 'Aviso',
      badgeInfo: 'Info',
      kbdText: 'Abrir búsqueda',
    },
    start: {
      eyebrow: 'Empezar',
      heading: 'Crea un proyecto a partir de esta demo.',
      intro: 'Ejecuta el comando, elige los flags que necesitas y sigue la documentación para hacer tuyo el sitio.',
      flagsLabel: 'Flags de la CLI',
      flags: {
        demo: 'Esta página, las páginas de ejemplo y las entradas del blog',
        components: 'Elige qué componentes de UI incluir',
        i18n: 'Rutas multilingües, con textos en español y francés',
        pages: 'Genera páginas con rutas y navegación ya conectadas',
        yes: 'Omite las preguntas y usa los valores por defecto',
      },
      docs: 'Leer la documentación',
      github: 'Código en GitHub',
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
