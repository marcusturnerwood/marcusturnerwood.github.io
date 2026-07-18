/*
 * Reusable password-lock widget for statically-hosted, client-side-encrypted
 * content (posts or projects). The protected file is AES-256-GCM encrypted
 * at build time with a key derived from a password via PBKDF2-SHA256; nothing
 * in the page or the .enc.json payload is useful without that password, since
 * decryption happens entirely in the visitor's browser via the Web Crypto API.
 *
 * Two modes, set via data-mode on the root element:
 *   "view"     (default) — renders the decrypted file inline in an <iframe>
 *              (via a blob: URL) using the browser's native viewer, with its
 *              toolbar/download affordances suppressed where the browser
 *              honours the #toolbar=0 PDF viewer hint. This raises the bar
 *              against casual saving but is NOT real DRM: once bytes reach
 *              the browser, print/screenshot/dev-tools/save-as remain
 *              possible for a sufficiently motivated visitor. Treat this as
 *              "not a two-click download", not as leak-proof.
 *   "download" — the previous behaviour: triggers a normal file download.
 *
 * Markup contract, per lock on a page:
 *   <div class="password-lock" data-enc-src="/assets/protected/foo.enc.json" data-mode="view">
 *     <form class="password-lock-form">
 *       <input type="password" class="password-lock-input" required>
 *       <button type="submit">Unlock</button>
 *     </form>
 *     <p class="password-lock-status" hidden></p>
 *     <div class="password-lock-viewer" hidden><iframe class="password-lock-frame"></iframe></div>
 *   </div>
 */
(function () {
  function b64ToBytes(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  async function deriveKey(password, salt, iterations) {
    const enc = new TextEncoder();
    const baseKey = await crypto.subtle.importKey(
      'raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );
  }

  async function unlock(encSrc, password) {
    const resp = await fetch(encSrc, { cache: 'no-store' });
    if (!resp.ok) throw new Error('Could not load protected data (' + resp.status + ')');
    const payload = await resp.json();

    const salt = b64ToBytes(payload.salt);
    const iv = b64ToBytes(payload.iv);
    const ciphertext = b64ToBytes(payload.ciphertext);

    const key = await deriveKey(password, salt, payload.iterations);
    // AES-GCM decrypt throws (OperationError) if the key/tag don't match,
    // i.e. if the password was wrong. There is no separate "check" step.
    const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);

    return {
      blob: new Blob([plainBuf], { type: payload.mime || 'application/octet-stream' }),
      filename: payload.filename || 'download',
    };
  }

  function setStatus(el, text, kind) {
    el.hidden = !text;
    el.textContent = text || '';
    el.className = 'password-lock-status' + (kind ? ' password-lock-status--' + kind : '');
  }

  function initLock(root) {
    const form = root.querySelector('.password-lock-form');
    const input = root.querySelector('.password-lock-input');
    const status = root.querySelector('.password-lock-status');
    const viewer = root.querySelector('.password-lock-viewer');
    const frame = root.querySelector('.password-lock-frame');
    const encSrc = root.dataset.encSrc;
    const mode = root.dataset.mode || 'view';
    if (!form || !input || !status || !encSrc) return;

    if (!window.isSecureContext && location.hostname !== 'localhost') {
      setStatus(status, 'This page requires HTTPS to unlock protected content.', 'error');
      form.querySelector('button')?.setAttribute('disabled', 'disabled');
      return;
    }

    form.addEventListener('submit', async function (ev) {
      ev.preventDefault();
      const password = input.value;
      if (!password) return;

      const button = form.querySelector('button');
      button.disabled = true;
      setStatus(status, 'Unlocking…', 'pending');

      try {
        const { blob, filename } = await unlock(encSrc, password);
        const url = URL.createObjectURL(blob);

        if (mode === 'download') {
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 30000);
          setStatus(status, 'Unlocked — download started.', 'success');
        } else if (viewer && frame) {
          // #toolbar=0&navpanes=0 suppresses the built-in PDF viewer's own
          // download/print toolbar in Chromium/Firefox's native viewers.
          frame.src = url + '#toolbar=0&navpanes=0';
          viewer.hidden = false;
          form.hidden = true;
          setStatus(status, 'Unlocked.', 'success');
        }
        input.value = '';
      } catch (err) {
        setStatus(status, 'Incorrect password, or the file could not be decrypted.', 'error');
      } finally {
        button.disabled = false;
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.password-lock').forEach(initLock);
  });
})();
