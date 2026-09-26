/**
 * Copies text to the clipboard.
 *
 * @remarks
 * `navigator.clipboard` only exists in secure contexts, so the app fails to
 * copy when served over plain HTTP (e.g. a Tailscale hostname). Falls back to
 * a hidden textarea and `execCommand('copy')` in that case.
 *
 * @param text - The text to copy.
 * @returns Whether the copy succeeded.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}
