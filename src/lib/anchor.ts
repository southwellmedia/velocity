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
    const margin = 8;
    // Clearing the height cap below resets the panel's own scroll; keep it.
    const scrollTop = panel.scrollTop;
    // Never wider than the viewport: long unbroken labels scroll sideways.
    panel.style.maxWidth = `${window.innerWidth - margin * 2}px`;
    panel.style.overflowX = 'auto';
    // Measure at natural height: undo a cap from an earlier placement first.
    panel.style.maxHeight = '';
    panel.style.overflowY = '';
    const t = trigger.getBoundingClientRect();
    let p = panel.getBoundingClientRect();
    const room = window.innerHeight - margin * 2;
    // Taller than the viewport: cap it and let it scroll inside.
    if (p.height > room) {
      panel.style.maxHeight = `${room}px`;
      panel.style.overflowY = 'auto';
      p = panel.getBoundingClientRect();
    }
    const fitsBelow = t.bottom + gap + p.height <= window.innerHeight - margin;
    const fitsAbove = t.top - gap - p.height >= margin;
    const above = placement === 'top' ? fitsAbove || !fitsBelow : !fitsBelow && fitsAbove;
    let top = above ? t.top - p.height - gap : t.bottom + gap;
    // Neither side fits: keep the whole panel on screen, even if it covers the trigger.
    top = Math.min(Math.max(margin, top), window.innerHeight - p.height - margin);
    let left = align === 'end' ? t.right - p.width : t.left;
    left = Math.max(margin, Math.min(left, window.innerWidth - p.width - margin));
    panel.style.position = 'fixed';
    panel.style.margin = '0';
    panel.style.inset = 'auto';
    panel.style.top = `${top}px`;
    panel.style.left = `${left}px`;
    panel.scrollTop = scrollTop;
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
