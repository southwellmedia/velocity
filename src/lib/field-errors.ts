/**
 * Inline error messages for form fields, shown only after the visitor has
 * interacted with a field (the browser's :user-invalid state), never while
 * the page first loads.
 *
 * Input, Textarea and Select render a hidden `[data-field-error]` message
 * next to the field and point at it with `data-error-id`. Once the field
 * matches :user-invalid this fills in the browser's own (already localized)
 * validation message, sets aria-invalid and adds the message to
 * aria-describedby, so screen readers hear it with the field. It clears again
 * as soon as the value is valid. Errors rendered by the server are left alone.
 */
const FIELD = 'input[data-error-id], textarea[data-error-id], select[data-error-id]';

type Field = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

function sync(field: Field) {
  const message = document.getElementById(field.dataset.errorId ?? '');
  if (!message) return;
  const text = message.querySelector<HTMLElement>('[data-field-error-text]') ?? message;
  const base = (field.dataset.describedby ?? '').split(' ').filter(Boolean);
  const invalid = field.matches(':user-invalid');

  if (invalid) {
    text.textContent = field.validationMessage;
    message.hidden = false;
    field.setAttribute('aria-invalid', 'true');
    field.setAttribute('aria-describedby', [...base, message.id].join(' '));
  } else {
    message.hidden = true;
    text.textContent = '';
    field.removeAttribute('aria-invalid');
    if (base.length) field.setAttribute('aria-describedby', base.join(' '));
    else field.removeAttribute('aria-describedby');
  }
}

function handle(event: Event) {
  const field = (event.target as Element | null)?.closest?.(FIELD) as Field | null;
  // :user-invalid updates after the event's default handling, so read it next frame.
  if (field) requestAnimationFrame(() => sync(field));
}

export function initFieldErrors() {
  if (document.documentElement.dataset.fieldErrorsInit) return;
  document.documentElement.dataset.fieldErrorsInit = 'true';
  for (const type of ['input', 'change', 'focusout']) document.addEventListener(type, handle);
  // `invalid` fires on submit and doesn't bubble, so listen in the capture phase.
  document.addEventListener('invalid', handle, true);
  document.addEventListener('reset', (event) => {
    const form = event.target as HTMLFormElement;
    requestAnimationFrame(() => form.querySelectorAll<Field>(FIELD).forEach(sync));
  });
}
