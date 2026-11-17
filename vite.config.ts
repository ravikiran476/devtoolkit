import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Adds a Content-Security-Policy to the production build. `connect-src 'none'` makes the
 * "nothing leaves this page" promise something the browser enforces: no fetch, XHR,
 * WebSocket or beacon can send data anywhere. The inline theme script is allowed by its hash.
 * Not used by the dev server, which injects scripts of its own.
 */
function contentSecurityPolicy(): Plugin {
  return {
    name: 'devtoolkit-csp',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      async handler(html) {
        const sha256 = async (text: string) => {
          const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
          return `'sha256-${btoa(String.fromCharCode(...digest))}'`;
        };
        const hashes = await Promise.all([...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => sha256(m[1]!)));
        const policy = [
          "default-src 'none'",
          `script-src 'self' ${hashes.join(' ')}`,
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data:",
          "font-src 'self'",
          "worker-src 'self'",
          "connect-src 'none'",
          "form-action 'none'",
          "base-uri 'none'",
          "object-src 'none'",
        ].join('; ');
        return html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`);
      },
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), contentSecurityPolicy()],
  worker: { format: 'es' },
});
