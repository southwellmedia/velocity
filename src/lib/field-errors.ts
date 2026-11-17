/**
 * Inline error messages for form fields, shown only after the visitor has
 * interacted with a field (the browser's :user-invalid state), never while
 * the page first loads.
 *
 * Input, Textarea and Select render a hidden `[data-field-error]` message
 * next to the field and point at it with `data-error-id`. Once the field
 * matches :user-invalid this fills in a message in the site's language (from
 * `fieldMessages()`, falling back to the browser's own for rarer cases), sets aria-invalid and adds the message to
 * aria-describedby, so screen readers hear it with the field. It clears again
 * as soon as the value is valid. Errors rendered by the server are left alone.
 */
const FIELD = 'input[data-error-id], textarea[data-error-id], select[data-error-id]';

type Field = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
type Messages = Partial<
  Record<
    'required' | 'email' | 'url' | 'tooShort' | 'tooLong' | 'rangeUnderflow' | 'rangeOverflow',
    string
  >
>;
type Translate = (key: never, params?: Record<string, string | number>) => string;

/**
 * Message templates in the page's language, for the `data-messages` attribute
 * of a field's error element. The browser's validationMessage follows the
 * visitor's browser language, not the site's, so a French site would show
 * English errors to anyone with an English browser.
 */
export function fieldMessages(t: Translate): string {
  const tr = t as unknown as (key: string, params?: Record<string, string>) => string;
  const messages: Messages = {
    required: tr('form.validation.required'),
    email: tr('form.validation.email'),
    url: tr('form.validation.url'),
    tooShort: tr('form.validation.tooShort', { min: '{min}', count: '{count}' }),
    tooLong: tr('form.validation.tooLong', { max: '{max}', count: '{count}' }),
    rangeUnderflow: tr('form.validation.rangeUnderflow', { min: '{min}' }),
    rangeOverflow: tr('form.validation.rangeOverflow', { max: '{max}' }),
  };
  return JSON.stringify(messages);
}

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));

function messageFor(field: Field, messages: Messages): string {
  const v = field.validity;
  const length = field.value.length;
  // A message set with setCustomValidity() is the author's own; use it as is.
  if (v.customError) return field.validationMessage;
  if (v.valueMissing && messages.required) return messages.required;
  if (v.typeMismatch && field instanceof HTMLInputElement) {
    if (field.type === 'email' && messages.email) return messages.email;
    if (field.type === 'url' && messages.url) return messages.url;
  }
  if (!(field instanceof HTMLSelectElement)) {
    if (v.tooShort && messages.tooShort)
      return fill(messages.tooShort, { min: field.minLength, count: length });
    if (v.tooLong && messages.tooLong)
      return fill(messages.tooLong, { max: field.maxLength, count: length });
  }
  if (field instanceof HTMLInputElement) {
    if (v.rangeUnderflow && messages.rangeUnderflow)
      return fill(messages.rangeUnderflow, { min: field.min });
    if (v.rangeOverflow && messages.rangeOverflow)
      return fill(messages.rangeOverflow, { max: field.max });
  }
  return field.validationMessage;
}

function readMessages(el: HTMLElement): Messages {
  try {
    return JSON.parse(el.dataset.messages ?? '{}') as Messages;
  } catch {
    return {};
  }
}

function sync(field: Field) {
  const message = document.getElementById(field.dataset.errorId ?? '');
  if (!message) return;
  const text = message.querySelector<HTMLElement>('[data-field-error-text]') ?? message;
  const base = (field.dataset.describedby ?? '').split(' ').filter(Boolean);
  const invalid = field.matches(':user-invalid');

  if (invalid) {
    text.textContent = messageFor(field, readMessages(message));
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
