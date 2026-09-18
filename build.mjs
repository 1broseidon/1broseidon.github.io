/* chain.sh — the whole build.
 *
 * Reads src/tools.json + src/stars.json + src/page.css and writes a single
 * self-contained dist/index.html. No framework, no bundler, no dependencies:
 * the page has no interactive state, so it ships no runtime JavaScript.
 */

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'

const root = (p) => new URL(p, import.meta.url)

const [tools, stars, css] = await Promise.all([
  readFile(root('src/tools.json'), 'utf8').then(JSON.parse),
  readFile(root('src/stars.json'), 'utf8').then(JSON.parse),
  readFile(root('src/page.css'), 'utf8'),
])

const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  )

const all = [...tools.featured, ...tools.also]
const total = all.reduce((n, t) => n + (stars[t.id] ?? 0), 0)
const year = new Date().getUTCFullYear()

const row = (t) => {
  const count = stars[t.id]
  const rel = t.external ? ' target="_blank" rel="noopener"' : ''
  return `      <a class="row" href="${esc(t.url)}"${rel}>
        <span class="row-name">${esc(t.name)}</span>
        <span class="row-dest">${esc(t.dest)}</span>
        <p class="row-desc">${esc(t.description)}</p>
        <span class="row-meta">${esc(t.lang)} · ${esc(t.license)}</span>
        <span class="row-stars">${typeof count === 'number' ? `★ ${count}` : ''}</span>
      </a>`
}

const group = (label, items) => `    <h2 class="grouphead">
      <span>${esc(label)}</span>
      <span class="count">${items.length}</span>
    </h2>
    <div class="rows">
${items.map(row).join('\n')}
    </div>`

const GH_MARK = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>`

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>chain.sh — command-line tools for coding agents</title>
<meta name="description" content="Command-line tools and agent infrastructure by George Dikeakos — ketch, cymbal, hotline, brainfile, prism, recoil and a set of agent skills.">
<link rel="canonical" href="https://chain.sh/">
<meta property="og:type" content="website">
<meta property="og:url" content="https://chain.sh/">
<meta property="og:title" content="chain.sh">
<meta property="og:description" content="Command-line tools and agent infrastructure by George Dikeakos.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Serif:wght@400&display=swap">
<style>
${css.trim()}
</style>
</head>
<body>
  <div class="shell">
    <header class="mast">
      <span class="mast-mark">chain.sh</span>
      <span class="mast-count">${all.length} tools</span>
      <nav class="mast-nav">
        <a class="mast-gh" href="https://github.com/1broseidon" target="_blank" rel="noopener">
          ${GH_MARK}
          <span>${total.toLocaleString('en-US')}</span>
        </a>
      </nav>
    </header>

    <section class="intro">
      <h1>chain.sh</h1>
      <div class="intro-rule" aria-hidden="true"></div>
      <p class="lede">Command-line tools and agent infrastructure, by George Dikeakos. Mostly Go and Rust — small binaries that do one thing, with output an agent can parse.</p>
      <p class="sub">Three have their own homes: <code>ketch.run</code>, <code>hotline.dev</code>, <code>brainfile.md</code>. The rest are served from here.</p>
    </section>

${group('Featured', tools.featured)}

${group('Also', tools.also)}

    <footer class="foot foot-pad">
      <span>© ${year} chain.sh</span>
      <span>MIT · Apache-2.0</span>
      <span class="spacer"><a href="https://github.com/1broseidon" target="_blank" rel="noopener">github.com/1broseidon</a></span>
    </footer>
  </div>
</body>
</html>
`

await rm(root('dist'), { recursive: true, force: true })
await mkdir(root('dist'), { recursive: true })
await writeFile(root('dist/index.html'), html)

const kb = (n) => `${(n / 1024).toFixed(2)} kB`
console.log(`built dist/index.html  ${kb(Buffer.byteLength(html))}  ·  ${all.length} tools  ·  0 kB JS`)
