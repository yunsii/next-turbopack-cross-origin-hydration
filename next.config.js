/** @type {import('next').NextConfig} */
module.exports = {
  // App + assets are served under the /sub prefix (mimics a path-prefixed deploy).
  basePath: '/sub',
  // assetPrefix is what Turbopack bakes into the runtime's CHUNK_BASE_PATH constant:
  //   unset  (BREAK): CHUNK_BASE_PATH = "/sub/_next/"                       (origin-relative)
  //   AP=<url> (FIX): CHUNK_BASE_PATH = "http://cdn.local:3000/sub/_next/"  (full cross-origin)
  assetPrefix: process.env.AP || undefined,
  // Keep the runtime readable so you can `grep CHUNK_BASE_PATH` (the bug
  // reproduces with minify on or off — it is independent of minification).
  experimental: { turbopackMinify: false },
}
