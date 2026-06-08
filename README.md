# Turbopack cross-origin `assetPrefix` → silent no-hydration

Minimal reproduction of a **Turbopack production build** hydration failure: when a page is served from one origin but its JS chunks are loaded from a **cross-origin CDN**, and the runtime's baked `CHUNK_BASE_PATH` does **not** match that cross-origin URL, the page **never hydrates** — with **no console error**.

Symptom: SSR HTML renders fine, but `window.next` is `undefined`, `window.__NEXT_DATA__` is empty, event handlers are not attached, there is no SPA routing. Links only work as full-page navigations.

- Next.js `16.2.6`, Turbopack production build, Node 22.
- Webpack does **not** have this problem (it supports a runtime-settable public path); Turbopack does.

## Root cause

Turbopack bakes `CHUNK_BASE_PATH` into the browser runtime **at build time** from `assetPrefix`. There is no `__webpack_public_path__` equivalent at runtime (`__next_set_public_path__` is a no-op), and it is **not** auto-detected from the runtime script's own `src` — it is a hardcoded constant.

The browser runtime matches chunk-load resolvers **by URL**:

- the entry chunk pre-creates resolvers for its `otherChunks`, keyed by `getChunkRelativeUrl(path)` = `CHUNK_BASE_PATH + path`;
- when a chunk registers itself, it resolves a resolver keyed by `getUrlFromScript(chunk)` = the script element's `.src`.

If `CHUNK_BASE_PATH` is **origin-relative** (e.g. `"/sub/_next/"`) but the actual `<script src>` is a **cross-origin absolute** URL (e.g. `http://cdn.local:3000/sub/_next/…`, injected per-host by a custom `_document` / middleware / nginx), the two keys never match → the entry's `Promise.all(otherChunks.map(loadInitialChunk))` never resolves → `runtimeModuleIds` are never instantiated → **silent no-hydration**.

### Why it looks intermittent ("rebuild fixes it", "change an unrelated file fixes it")

Turbopack's chunk layout is **non-deterministic** across builds (module→chunk assignment, chunk ids/order). Whether the entry happens to wait on a chunk that hits the key mismatch depends on that layout, so **whether the page hangs is a per-build lottery**. Rebuilding the same commit — or editing an unrelated file and rebuilding — just re-rolls the layout, which is why it sometimes "fixes itself". The latent mismatch is always there; fixing `CHUNK_BASE_PATH` removes the lottery entirely.

## The fix

Make the baked `CHUNK_BASE_PATH` match the URL the chunks are actually loaded from — i.e. set the **build-time** `assetPrefix` to the full cross-origin CDN URL, instead of an origin-relative path. Turbopack can only do this at build time (single value); per-host runtime injection of the chunk base path is not supported.

## Reproduce

### 1. Hosts (two origins → 127.0.0.1)

The page is served from `app.local`, the chunks from `cdn.local` (cross-origin). Add to your hosts file:

```
127.0.0.1 app.local cdn.local
```

- Linux/macOS: `/etc/hosts`
- Windows (run PowerShell as Administrator):
  ```powershell
  Add-Content "$env:windir\System32\drivers\etc\hosts" "127.0.0.1 app.local cdn.local"
  ```

### 2. Install

```bash
npm install
```

### 3. BREAK — no hydration

Build with an **origin-relative** asset prefix → `CHUNK_BASE_PATH = "/sub/_next/"`, while `_document` points the SSR `<script src>` at the cross-origin CDN:

```bash
npm run build      # no AP env
npm start          # next start -H 0.0.0.0 -p 3000
```

Open <http://app.local:3000/sub> — the **button does nothing**. In the console:

```js
typeof window.next                          // "undefined"
Object.keys(window.__NEXT_DATA__).length    // 0
window.__HYDRATED__                          // undefined
```

### 4. FIX — hydration works

Build with the **full cross-origin** asset prefix → `CHUNK_BASE_PATH = "http://cdn.local:3000/sub/_next/"`, matching the chunk `src`:

```bash
AP=http://cdn.local:3000/sub npm run build
npm start
```

Open <http://app.local:3000/sub> — the **button increments**, SPA works:

```js
typeof window.next      // "object"
window.__HYDRATED__     // true
```

The **only** difference between BREAK and FIX is the build-time `assetPrefix` (→ `CHUNK_BASE_PATH`). In both cases the chunks are loaded cross-origin from `cdn.local`.

### Inspect the baked value

```bash
grep -ho 'CHUNK_BASE_PATH = "[^"]*"' .next/static/chunks/turbopack-*.js | head -1
# BREAK: CHUNK_BASE_PATH = "/sub/_next/"
# FIX:   CHUNK_BASE_PATH = "http://cdn.local:3000/sub/_next/"
```

## Files

| File | Role |
|---|---|
| `next.config.js` | `basePath: '/sub'`; `assetPrefix` from the `AP` env — this is what toggles the baked `CHUNK_BASE_PATH`. |
| `pages/_document.tsx` | Rewrites the SSR `assetPrefix` to the cross-origin CDN (`cdn.local`), simulating per-host CDN injection. This is what makes the chunks load cross-origin regardless of the build-time `assetPrefix`. |
| `pages/index.tsx` | An interactive page (counter button). |
| `components/Lazy.tsx` | Dynamically imported; its `useEffect` sets `window.__HYDRATED__ = true` — the hydration probe. The dynamic import ensures the entry has `otherChunks` to wait on. |

## Notes

- The bug reproduces with both minified and unminified Turbopack output (`experimental.turbopackMinify`); it is independent of minification.
- A real-world trigger: a build-time `assetPrefix` that is path-only (e.g. `/cdn-path`) combined with a per-host `_document`/nginx step that rewrites asset URLs to a cross-origin CDN domain — the build bakes the path-only `CHUNK_BASE_PATH`, but the served chunks are cross-origin.
