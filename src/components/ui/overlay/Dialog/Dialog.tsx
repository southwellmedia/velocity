import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

const sizes = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
} as const;

interface DialogProps {
  open: boolean;
  /** Called however the dialog closes: Escape, the backdrop, the close button or the back gesture */
  onClose: () => void;
  title?: string;
  description?: string;
  /** Accessible name when there is no visible title */
  label?: string;
  /** Accessible name of the close button (pass a translated string) */
  closeLabel?: string;
  size?: keyof typeof sizes;
  /** 'any': Escape and backdrop click close it (default). 'closerequest': Escape only. 'none': only your code closes it. */
  closedby?: 'any' | 'closerequest' | 'none';
  className?: string;
  children: ReactNode;
  footer?: ReactNode;
}

const supportsClosedBy =
  typeof HTMLDialogElement !== 'undefined' && 'closedBy' in HTMLDialogElement.prototype;

function outside(event: PointerEvent, dialog: HTMLDialogElement) {
  const r = dialog.getBoundingClientRect();
  return (
    event.clientX < r.left ||
    event.clientX > r.right ||
    event.clientY < r.top ||
    event.clientY > r.bottom
  );
}

/**
 * A modal on the native <dialog> element, opened with showModal(). The browser
 * contains focus, makes the page inert, closes it on Escape and returns focus
 * to whatever opened it; shares its styles with Dialog.astro.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  label,
  closeLabel = 'Close',
  size = 'md',
  closedby = 'any',
  className,
  children,
  footer,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const id = useId();
  const titleId = title ? `${id}-title` : undefined;
  const descriptionId = description ? `${id}-description` : undefined;

  // Mirror the `open` prop onto the element.
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Report every close back to the parent, and add backdrop clicks where
  // closedby isn't supported yet (Safari).
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const controller = new AbortController();
    const { signal } = controller;
    dialog.addEventListener('close', () => onCloseRef.current(), { signal });
    if (closedby === 'any' && !supportsClosedBy) {
      let pressedOutside = false;
      dialog.addEventListener('pointerdown', (e) => (pressedOutside = outside(e, dialog)), {
        signal,
      });
      dialog.addEventListener(
        'pointerup',
        (e) => {
          if (pressedOutside && outside(e, dialog)) dialog.close();
        },
        { signal }
      );
    }
    return () => controller.abort();
  }, [closedby]);

  return (
    <dialog
      ref={ref}
      className={cn(
        'velocity-dialog bg-background text-foreground border-border m-auto w-[calc(100%-2rem)] rounded-xl border p-0 shadow-xl',
        sizes[size],
        className
      )}
      {...({ closedby } as Record<string, string>)}
      aria-labelledby={titleId}
      aria-label={!title ? label : undefined}
      aria-describedby={descriptionId}
    >
      <button
        type="button"
        className="text-foreground-muted hover:text-foreground focus-visible:ring-ring absolute top-4 right-4 rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none"
        onClick={() => ref.current?.close()}
        aria-label={closeLabel}
      >
        <X className="h-5 w-5" aria-hidden="true" />
      </button>

      {(title || description) && (
        <div className="p-6 pb-0">
          {title && (
            <h2 id={titleId} className="text-foreground m-0 pr-8 text-lg font-semibold">
              {title}
            </h2>
          )}
          {description && (
            <p id={descriptionId} className="text-foreground-muted mt-1 text-sm">
              {description}
            </p>
          )}
        </div>
      )}

      <div className="p-6">{children}</div>

      {footer}
    </dialog>
  );
}

export default Dialog;
