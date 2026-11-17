/**
 * Places a top-layer popover next to the element that opened it.
 *
 * Where CSS anchor positioning is supported, the browser does the placing and
 * flips the panel when it would overflow the viewport (the rules live under
 * `[data-anchored]` in global.css). Elsewhere a few lines of script measure the
 * trigger and keep the panel beside it while the page scrolls or resizes.
 *
 * Call it from the popover's `toggle` event when it opens; the function it
 * returns stops the script fallback and is safe to call either way.
 */
export interface AnchorOptions {
  placement?: 'bottom' | 'top';
  align?: 'start' | 'end';
  /** Space between trigger and panel in px (script fallback; CSS uses 0.5rem) */
  gap?: number;
}

let counter = 0;

export const supportsAnchorPositioning = (): boolean =>
  typeof CSS !== 'undefined' &&
  CSS.supports('anchor-name: --a') &&
  CSS.supports('position-area: block-end');

export function anchorPopover(
  panel: HTMLElement,
  trigger: HTMLElement,
  options: AnchorOptions = {}
): () => void {
  const { placement = 'bottom', align = 'start', gap = 8 } = options;
  panel.dataset.placement = placement;
  panel.dataset.align = align;

  if (supportsAnchorPositioning()) {
    if (!panel.dataset.anchorName) panel.dataset.anchorName = `--velocity-anchor-${++counter}`;
    const name = panel.dataset.anchorName;
    trigger.style.setProperty('anchor-name', name);
    panel.style.setProperty('position-anchor', name);
    panel.dataset.anchored = '';
    return () => {};
  }

  const place = () => {
    const t = trigger.getBoundingClientRect();
    const p = panel.getBoundingClientRect();
    const fitsBelow = t.bottom + gap + p.height <= window.innerHeight;
    const fitsAbove = t.top - gap - p.height >= 0;
    const above = placement === 'top' ? fitsAbove || !fitsBelow : !fitsBelow && fitsAbove;
    const top = above ? t.top - p.height - gap : t.bottom + gap;
    let left = align === 'end' ? t.right - p.width : t.left;
    left = Math.min(Math.max(8, left), window.innerWidth - p.width - 8);
    panel.style.position = 'fixed';
    panel.style.margin = '0';
    panel.style.inset = 'auto';
    panel.style.top = `${Math.max(8, top)}px`;
    panel.style.left = `${left}px`;
  };

  place();
  const controller = new AbortController();
  window.addEventListener('resize', place, { signal: controller.signal, passive: true });
  window.addEventListener('scroll', place, {
    signal: controller.signal,
    passive: true,
    capture: true,
  });
  return () => controller.abort();
}
