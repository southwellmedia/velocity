import fs from 'node:fs';
import path from 'node:path';
import satori from 'satori';
import sharp from 'sharp';

/**
 * Social share images.
 *
 * `renderCard` draws a card from the project's logo and theme color.
 * `completeSocialImages` runs after every build and checks each finished page, so a
 * page gets a card however it was made: a route, a blog post or a collection entry.
 * A page that names its own image must point at a file that exists, or the build
 * fails, because a broken share image is otherwise invisible until someone shares
 * the link.
 *
 * Plain JavaScript, because it runs in the build, outside Vite's aliases.
 */

const WIDTH = 1200;
const HEIGHT = 630;
const PADDING_X = 76;
const PADDING_Y = 60;
const CARD_BACKGROUND = '#111214';

const toRgb = (hex) => {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? [...value].map((c) => c + c).join('') : value;
  return [0, 2, 4].map((start) => parseInt(full.slice(start, start + 2), 16));
};

const toHex = (rgb) => `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;

const mix = (from, to, amount) => {
  const [a, b] = [toRgb(from), toRgb(to)];
  return toHex(a.map((channel, index) => channel + (b[index] - channel) * amount));
};

const luminance = (hex) => {
  const [r, g, b] = toRgb(hex).map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** The theme color, unless it would vanish against the dark card. */
export function cardAccent(themeColor) {
  if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(themeColor ?? '')) return '#fafafa';
  return luminance(themeColor) < 0.03 ? '#fafafa' : themeColor;
}

/** The logomark as a data URI, with its theme hooks filled in for the dark card. */
function loadLogo(root, accent) {
  const branding = path.join(root, 'src/assets/branding');
  const file = ['logomark-dark.svg', 'logomark.svg']
    .map((name) => path.join(branding, name))
    .find((candidate) => fs.existsSync(candidate));
  if (!file) return null;

  const svg = fs
    .readFileSync(file, 'utf8')
    .replace(/var\(--logo-accent[^)]*\)/g, accent)
    .replace(/currentColor/g, '#ffffff');
  const [, , width, height] = svg.match(/viewBox="([\d.-]+\s+){2}([\d.]+)\s+([\d.]+)"/)?.slice(0) ?? [];
  const ratio = width && height ? Number(width) / Number(height) : 1;
  return { src: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`, ratio };
}

const element = (type, style, children, extra = {}) => ({
  type,
  props: { style: { display: 'flex', ...style }, children, ...extra },
});

const shorten = (text, limit) => {
  if (text.length <= limit) return text;
  return `${text.slice(0, limit).replace(/\s+\S*$/, '')}…`;
};

/**
 * @param {{ title: string, description?: string, siteName: string, hostname: string,
 *   themeColor?: string, root?: string }} options
 * @returns {Promise<Buffer>} A 1200×630 PNG
 */
export async function renderCard({ title, description, siteName, hostname, themeColor, root = process.cwd() }) {
  const accent = cardAccent(themeColor);
  const logo = loadLogo(root, accent);
  const font = fs.readFileSync(path.join(root, 'public/fonts/inter-latin-400-normal.ttf'));
  const longTitle = title.length > 42;

  const brand = element('div', { alignItems: 'center', gap: 16 }, [
    logo &&
      element('img', { width: 52 * logo.ratio, height: 52 }, undefined, {
        src: logo.src,
        width: 52 * logo.ratio,
        height: 52,
      }),
    element('div', { fontSize: 30, fontWeight: 700, color: '#fafafa' }, siteName),
  ].filter(Boolean));

  const copy = element('div', { flexDirection: 'column', gap: 22 }, [
    element(
      'div',
      { fontSize: longTitle ? 58 : 76, fontWeight: 700, lineHeight: 1.08, letterSpacing: -1.5, color: '#fafafa' },
      shorten(title, 90)
    ),
    description &&
      element('div', { fontSize: 28, lineHeight: 1.4, color: '#b4b4bb', maxWidth: 940 }, shorten(description, 130)),
  ].filter(Boolean));

  const footer = element('div', { alignItems: 'center', gap: 14, fontSize: 24, color: '#9c9ca5' }, [
    element('div', { width: 44, height: 5, borderRadius: 3, background: accent }, undefined),
    element('div', {}, hostname),
  ]);

  const card = element(
    'div',
    {
      // Satori adds padding to the size, so subtract it to fill the card exactly
      width: WIDTH - PADDING_X * 2,
      height: HEIGHT - PADDING_Y * 2,
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: `${PADDING_Y}px ${PADDING_X}px`,
      backgroundColor: CARD_BACKGROUND,
      backgroundImage: `linear-gradient(135deg, ${CARD_BACKGROUND} 40%, ${mix(CARD_BACKGROUND, accent, 0.5)} 100%)`,
    },
    [brand, copy, footer]
  );

  const svg = await satori(card, {
    width: WIDTH,
    height: HEIGHT,
    fonts: [400, 500, 600, 700].map((weight) => ({ name: 'Inter', data: font, weight, style: 'normal' })),
  });
  return sharp(Buffer.from(svg)).png().toBuffer();
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

const decode = (text) =>
  text
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&(amp|lt|gt|quot|apos);/g, (_, name) => ENTITIES[name]);

const metaContent = (html, attribute, name) => {
  const tag = html.match(new RegExp(`<meta[^>]*${attribute}="${name}"[^>]*>`, 'i'))?.[0];
  const value = tag?.match(/content="([^"]*)"/i)?.[1];
  return value === undefined ? undefined : decode(value);
};

/** What a finished page says about its share image. */
export function readPage(html) {
  const siteName = metaContent(html, 'property', 'og:site_name') ?? '';
  const pageTitle = metaContent(html, 'property', 'og:title') ?? siteName;
  const suffix = ` — ${siteName}`;
  return {
    image: metaContent(html, 'property', 'og:image'),
    title: siteName && pageTitle.endsWith(suffix) ? pageTitle.slice(0, -suffix.length) : pageTitle,
    description: metaContent(html, 'property', 'og:description'),
    siteName,
    themeColor: metaContent(html, 'name', 'theme-color'),
  };
}

/**
 * Draws any generated card a finished page needs, and fails on missing custom images.
 *
 * @param {string} clientDir Where the prerendered pages are
 * @param {{ site?: string, root?: string }} [options]
 * @returns {Promise<{ pages: number, generated: number }>}
 */
export async function completeSocialImages(clientDir, { site, root = process.cwd() } = {}) {
  const pages = fs
    .readdirSync(clientDir, { recursive: true })
    .map(String)
    // The 404 page is never shared, and its URL isn't a real page
    .filter((file) => file.endsWith('.html') && path.basename(file) !== '404.html');

  const siteHost = site ? new URL(site).host : undefined;
  const missing = [];
  let generated = 0;

  for (const page of pages) {
    const details = readPage(fs.readFileSync(path.join(clientDir, page), 'utf8'));
    if (!details.image) continue;

    const url = new URL(details.image, site ?? 'https://example.com');
    if (siteHost && url.host !== siteHost) continue;

    const pathname = decodeURIComponent(url.pathname);
    const target = path.join(clientDir, pathname);
    if (fs.existsSync(target)) continue;

    if (!pathname.startsWith('/og/') || !pathname.endsWith('.png')) {
      missing.push(`  ${page.replaceAll('\\', '/')} → ${pathname}`);
      continue;
    }

    const png = await renderCard({
      title: details.title,
      description: details.description,
      siteName: details.siteName,
      hostname: siteHost ?? url.host,
      themeColor: details.themeColor,
      root,
    });
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, png);
    generated += 1;
  }

  if (missing.length) {
    throw new Error(
      `These pages use a share image that doesn't exist, so shared links would have no picture. ` +
        `Add the file, or remove the page's \`image\` prop to get a generated one:\n${missing.join('\n')}`
    );
  }
  return { pages: pages.length, generated };
}
