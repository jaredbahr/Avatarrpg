/**
 * Tiny DOM helpers.
 *
 * The HUD is DOM rather than canvas on purpose: free text wrapping, free
 * focus handling, free screen-reader semantics, and touch targets that scale
 * with the Large-text setting without any layout code. That trade only pays
 * off if building elements is terse, hence this file.
 */

type Child = Node | string | null | undefined | false;

export interface ElProps {
  class?: string;
  text?: string;
  html?: string;
  title?: string;
  id?: string;
  type?: string;
  value?: string;
  placeholder?: string;
  disabled?: boolean;
  hidden?: boolean;
  style?: Partial<CSSStyleDeclaration>;
  dataset?: Record<string, string>;
  attrs?: Record<string, string>;
  onClick?: (event: MouseEvent) => void;
  onInput?: (event: Event) => void;
  onKeyDown?: (event: KeyboardEvent) => void;
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: ElProps = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);

  if (props.class) node.className = props.class;
  if (props.id) node.id = props.id;
  if (props.title) node.title = props.title;
  if (props.text !== undefined) node.textContent = props.text;
  if (props.html !== undefined) node.innerHTML = props.html;
  if (props.hidden) node.hidden = true;

  if (props.style) Object.assign(node.style, props.style);
  if (props.dataset) {
    for (const [key, value] of Object.entries(props.dataset)) node.dataset[key] = value;
  }
  if (props.attrs) {
    for (const [key, value] of Object.entries(props.attrs)) node.setAttribute(key, value);
  }

  if (node instanceof HTMLInputElement) {
    if (props.type) node.type = props.type;
    if (props.value !== undefined) node.value = props.value;
    if (props.placeholder) node.placeholder = props.placeholder;
  }
  if (node instanceof HTMLButtonElement) {
    node.type = 'button';
    if (props.disabled) node.disabled = true;
  }

  if (props.onClick) node.addEventListener('click', props.onClick as EventListener);
  if (props.onInput) node.addEventListener('input', props.onInput as EventListener);
  if (props.onKeyDown) node.addEventListener('keydown', props.onKeyDown as EventListener);

  append(node, children);
  return node;
}

export function append(parent: HTMLElement, children: Child[]): void {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    parent.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
}

export function clear(node: HTMLElement): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

/** A button that always meets the minimum touch target via `button` in CSS. */
export function button(
  label: string,
  onClick: () => void,
  options: { class?: string; disabled?: boolean; title?: string; id?: string } = {},
): HTMLButtonElement {
  return el('button', {
    class: options.class,
    text: label,
    disabled: options.disabled,
    title: options.title,
    id: options.id,
    onClick: () => onClick(),
  });
}

/** Renders a painter into an <canvas> sized in rem, for portraits in the HUD. */
export function painterCanvas(
  assetKey: string,
  remSize: number,
  draw: (ctx: CanvasRenderingContext2D, size: number) => void,
  extraClass = '',
): HTMLCanvasElement {
  const canvas = el('canvas', { class: `painter ${extraClass}`.trim() });
  const px = Math.round(remSize * 16 * (window.devicePixelRatio || 1));
  canvas.width = px;
  canvas.height = px;
  canvas.style.width = `${remSize}rem`;
  canvas.style.height = `${remSize}rem`;
  canvas.dataset.asset = assetKey;
  const ctx = canvas.getContext('2d');
  if (ctx) draw(ctx, px);
  return canvas;
}

/**
 * A tooltip that also works under a finger. `title` shows on hover where there
 * is a mouse; on a tablet nothing hovers, so a tap shows the same text as a
 * toast. Harmless with a mouse: a click just repeats what the tooltip said.
 */
export function tip(node: HTMLElement, text: string, show: (text: string) => void): void {
  if (!text) return;
  node.title = text;
  node.addEventListener('click', () => show(text));
}

/** Screen-reader announcement without moving focus. */
export function announce(message: string): void {
  let region = document.getElementById('fnt-live');
  if (!region) {
    region = el('div', {
      id: 'fnt-live',
      class: 'visually-hidden',
      attrs: { 'aria-live': 'polite', 'aria-atomic': 'true', role: 'status' },
    });
    document.body.appendChild(region);
  }
  region.textContent = message;
}

/** True when the reduce-motion setting (or the OS preference) is on. */
export function motionReduced(): boolean {
  if (document.documentElement.dataset.reduceMotion === 'on') return true;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}
