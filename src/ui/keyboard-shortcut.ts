interface Shortcut {
  key: string;
  matchKey: string;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
  signature: string;
}

interface ShortcutRegistry {
  registrations: Map<string, Array<() => void>>;
  listener: (event: KeyboardEvent) => void;
}

// 弱引用
const registries = new WeakMap<Document, ShortcutRegistry>();

/** Register a document-level toggle shortcut. For duplicate bindings, the newest instance wins. */
export function registerToggleShortcut(document: Document, value: string, toggle: () => void): () => void {
  const shortcut = parseShortcut(value);
  let registry = registries.get(document);
  if (!registry) {
    const registrations = new Map<string, Array<() => void>>();
    const listener = (event: KeyboardEvent): void => {
      if (event.defaultPrevented || event.repeat || event.isComposing || isEditableTarget(event)) return;
      for (const [signature, handlers] of registrations) {
        if (!matches(event, signature)) continue;
        handlers.at(-1)?.();
        event.preventDefault();
        return;
      }
    };
    registry = { registrations, listener };
    registries.set(document, registry);
    document.addEventListener('keydown', listener);
  }

  const handlers = registry.registrations.get(shortcut.signature) ?? [];
  handlers.push(toggle);
  registry.registrations.set(shortcut.signature, handlers);

  let unregistered = false;
  return () => {
    if (unregistered) return;
    unregistered = true;
    const current = registries.get(document);
    if (!current) return;
    const entries = current.registrations.get(shortcut.signature);
    if (entries) {
      const index = entries.lastIndexOf(toggle);
      if (index !== -1) entries.splice(index, 1);
      if (entries.length === 0) current.registrations.delete(shortcut.signature);
    }
    if (current.registrations.size === 0) {
      document.removeEventListener('keydown', current.listener);
      registries.delete(document);
    }
  };
}

export function validateToggleShortcut(value: string): void {
  parseShortcut(value);
}

function parseShortcut(value: string): Shortcut {
  const parts = value.split('+').map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) throw new Error('toggleShortcut must include a key and at least one modifier.');

  const modifiers = { ctrl: false, alt: false, shift: false, meta: false };
  let key: string | undefined;
  for (const part of parts) {
    switch (part.toLowerCase()) {
      case 'ctrl':
      case 'control':
        if (modifiers.ctrl) throw new Error('toggleShortcut contains a duplicate modifier.');
        modifiers.ctrl = true;
        break;
      case 'alt':
      case 'option':
        if (modifiers.alt) throw new Error('toggleShortcut contains a duplicate modifier.');
        modifiers.alt = true;
        break;
      case 'shift':
        if (modifiers.shift) throw new Error('toggleShortcut contains a duplicate modifier.');
        modifiers.shift = true;
        break;
      case 'meta':
      case 'cmd':
      case 'command':
        if (modifiers.meta) throw new Error('toggleShortcut contains a duplicate modifier.');
        modifiers.meta = true;
        break;
      default:
        if (key !== undefined) throw new Error('toggleShortcut must contain exactly one non-modifier key.');
        key = part.toLowerCase();
    }
  }

  if (!key) throw new Error('toggleShortcut must include a non-modifier key.');
  if (!modifiers.ctrl && !modifiers.alt && !modifiers.shift && !modifiers.meta) {
    throw new Error('toggleShortcut must include at least one modifier.');
  }
  const matchKey = keyCode(key) ? `code:${keyCode(key)}` : `key:${key}`;
  const signature = [modifiers.ctrl ? 'ctrl' : '', modifiers.alt ? 'alt' : '', modifiers.shift ? 'shift' : '', modifiers.meta ? 'meta' : '', matchKey].join('|');
  return { key, matchKey, ...modifiers, signature };
}

function matches(event: KeyboardEvent, signature: string): boolean {
  const expectedMatchKey = signature.slice(signature.lastIndexOf('|') + 1);
  const eventKey = expectedMatchKey.startsWith('code:')
    ? `code:${event.code}`
    : `key:${event.key.toLowerCase()}`;
  const eventSignature = [event.ctrlKey ? 'ctrl' : '', event.altKey ? 'alt' : '', event.shiftKey ? 'shift' : '', event.metaKey ? 'meta' : '', eventKey].join('|');
  return eventSignature === signature;
}

function keyCode(key: string): string | undefined {
  if (/^[a-z]$/.test(key)) return `Key${key.toUpperCase()}`;
  if (/^[0-9]$/.test(key)) return `Digit${key}`;
  const punctuation: Record<string, string> = {
    '`': 'Backquote', '-': 'Minus', '=': 'Equal', '[': 'BracketLeft', ']': 'BracketRight',
    '\\': 'Backslash', ';': 'Semicolon', "'": 'Quote', ',': 'Comma', '.': 'Period', '/': 'Slash',
  };
  return punctuation[key];
}

function isEditableTarget(event: KeyboardEvent): boolean {
  return event.composedPath().some((target) => {
    if (!target || typeof target !== 'object' || !('nodeType' in target) || target.nodeType !== 1) return false;
    const element = target as Element;
    return element.matches('input, textarea, select, [role="textbox"]') || (element as HTMLElement).isContentEditable;
  });
}
