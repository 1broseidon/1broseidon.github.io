/* chain.sh — the whole build.
 *
 * Reads src/tools.json + src/repos.json + src/transcript.json + tokens.css +
 * src/page.css + src/page.js and writes one self-contained dist/index.html.
 * No framework, no bundler.
 *
 * There is no diagram. The page's one constructed artefact is a real terminal
 * session: four tools, one task, every line of output captured from an actual
 * run. src/transcript.json is the record; the highlighter below only tints it.
 * If a command in that file stops being true, re-run it and paste the new
 * output — do not edit it to look better.
 */

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'

const root = (path) => new URL(path, import.meta.url)

const [{ tools }, repos, session, tokens, css, script] = await Promise.all([
  readFile(root('src/tools.json'), 'utf8').then(JSON.parse),
  readFile(root('src/repos.json'), 'utf8').then(JSON.parse),
  readFile(root('src/transcript.json'), 'utf8').then(JSON.parse),
  readFile(root('tokens.css'), 'utf8'),
  readFile(root('src/page.css'), 'utf8'),
  readFile(root('src/page.js'), 'utf8'),
])

const esc = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
  )

const byId = Object.fromEntries(tools.map((tool) => [tool.id, tool]))
const stat = (key) => tools.reduce((sum, tool) => sum + (repos[tool.id]?.[key] ?? 0), 0)
const stars = stat('stars')
const releases = stat('releases')
const num = (n) => n.toLocaleString('en-US')
const year = new Date().getUTCFullYear()

/* ---------- terminal highlighting --------------------------------------
 * Tints only. Every character comes from src/transcript.json unchanged:
 * the prompt and its command, the `---` fences and `key:` names that these
 * tools actually print, and the ellipsis marking where a block was cut. */
const line = (raw) => {
  if (raw === '') return ''
  const prompt = raw.match(/^\$ (.*)$/)
  if (prompt) return `<b class="t-p">$</b> <b class="t-cmd">${esc(prompt[1])}</b>`
  if (/^\s*(---|…|#)/.test(raw)) return `<span class="t-dim">${esc(raw)}</span>`
  if (/^\s*>/.test(raw)) return `<span class="t-hit">${esc(raw)}</span>`
  const pair = raw.match(/^(\s*)([a-z_]+):(\s*)(.*)$/)
  if (pair) return `${pair[1]}<span class="t-dim">${esc(pair[2])}:</span>${pair[3]}${esc(pair[4])}`
  const url = raw.match(/^(\s*)(https?:\/\/\S+)$/)
  if (url) return `${url[1]}<span class="t-url">${esc(url[2])}</span>`
  return `<span class="t-out">${esc(raw)}</span>`
}

const step = (entry, index) => {
  const tool = byId[entry.tool]
  return `        <li class="step">
          <div class="step-head">
            <span class="step-num">0${index + 1}</span>
            <a class="step-tool" href="#${esc(tool.id)}">${esc(tool.name)}</a>
            <span class="step-why">${esc(entry.why)}</span>
            <span class="step-callout">${esc(entry.callout)}</span>
          </div>
          <pre class="term"><code>${entry.lines.map(line).join('\n')}</code></pre>
        </li>`
}

/* ---------- content ----------------------------------------------------- */

const arrow =
  '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 18 18 6M6 6h12v12"/></svg>'

const github =
  '<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.11-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12Z"/></svg>'

const specRow = (tool) => `        <tr id="${esc(tool.id)}">
          <td class="spec-name"><a href="${esc(tool.url)}" target="_blank" rel="noopener noreferrer">${esc(tool.name)} ${arrow}<span class="sr-only"> (opens in a new tab)</span></a></td>
          <td class="spec-role">${esc(tool.role)}</td>
          <td class="spec-what">${esc(tool.description)}</td>
          <td class="spec-meta">${esc(tool.lang)} · ${esc(tool.license)}</td>
        </tr>`

const panel = (tool, index) => {
  const prompt = `Help me set up ${tool.name} for this project. Read ${tool.install} for the current installation and setup instructions. Check support for my operating system and any prerequisites, explain the setup choices, then verify that it works.`
  return `        <div class="panel${index === 0 ? ' is-active' : ''}" id="setup-${esc(tool.id)}"${index === 0 ? '' : ' hidden'} aria-labelledby="setup-title-${esc(tool.id)}">
          <p class="panel-tool">${esc(tool.name)}</p>
          <h3 id="setup-title-${esc(tool.id)}">${esc(tool.description)}</h3>
          <div class="panel-actions">
            <a class="btn btn-primary" href="${esc(tool.install)}" target="_blank" rel="noopener noreferrer">get ${esc(tool.name)} ${arrow}<span class="sr-only"> (opens in a new tab)</span></a>
            <button class="btn" type="button" data-copy="prompt-${esc(tool.id)}" hidden>copy setup prompt</button>
          </div>
          <p class="panel-hint">follow the project guide for installation and first steps.</p>
          <label class="sr-only" for="prompt-${esc(tool.id)}">Setup prompt for ${esc(tool.name)}</label>
          <textarea class="prompt-fallback" id="prompt-${esc(tool.id)}" rows="4" readonly hidden>${esc(prompt)}</textarea>
          <p class="copy-status" role="status" aria-live="polite"></p>
        </div>`
}

const figure = (value, label) =>
  `      <div class="stat"><span class="stat-figure">${esc(value)}</span><span class="stat-label">${esc(label)}</span></div>`

const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="9" fill="#2b2596"/><g fill="none" stroke="#eef0f7" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M11 14.5 16.5 20 11 25.5"/><path d="M20.5 26h8.5"/></g></svg>`

const description =
  'Four open-source command-line tools for working with coding agents: research the web, navigate a codebase, keep local memory, and track the work in Markdown.'

const html = `<!DOCTYPE html>
<html lang="en" class="no-js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>chain.sh — tools for coding agents</title>
<meta name="description" content="${description}">
<link rel="canonical" href="https://chain.sh/">
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(favicon)}">
<meta property="og:type" content="website">
<meta property="og:url" content="https://chain.sh/">
<meta property="og:title" content="chain.sh">
<meta property="og:description" content="${description}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Serif&family=Geist:wght@400;500&family=JetBrains+Mono:wght@400;500&display=swap">
<style>${tokens.trim()}
${css.trim()}</style>
</head>
<body>
<script>document.documentElement.classList.remove('no-js')</script>
<a class="skip-link" href="#tools">Skip to the tools</a>

<aside class="chip" aria-label="Site">
  <a class="chip-mark" href="#top">chain.sh</a>
  <a class="chip-link" href="https://github.com/1broseidon" target="_blank" rel="noopener noreferrer">${github} <span class="chip-count">${num(stars)}</span><span class="sr-only"> stars on GitHub (opens in a new tab)</span></a>
</aside>

<main id="top">
  <section class="hero">
    <div class="wrap">
      <p class="eyebrow hero-eyebrow">00 · Tools for coding agents</p>
      <h1 class="hero-title">Four small tools that&nbsp;<em>chain</em>.</h1>
      <p class="hero-lede">Open-source command-line tools, local-first and small enough to read. Nothing here depends on anything else — but they compose, because they all read and write the plain files your agent already touches.</p>

      <figure class="session">
        <figcaption class="session-cap">Fig. 01 · ${esc(session.task)} · output verbatim</figcaption>
        <ol class="session-steps">
${session.steps.map(step).join('\n')}
        </ol>
        <p class="session-note">${esc(session.note)}</p>
      </figure>
    </div>
  </section>

  <section class="wrap section" id="tools">
    <div class="section-head reveal">
      <span class="eyebrow">01 · The tools</span>
      <h2>What each one does</h2>
    </div>

    <div class="stats reveal">
${figure(String(tools.length), 'Tools')}
${figure(num(releases), 'Tagged releases')}
${figure(num(stars), 'Stars on GitHub')}
    </div>

    <table class="spec">
      <caption class="sr-only">The four tools</caption>
      <tbody>
${tools.map(specRow).join('\n')}
      </tbody>
    </table>
  </section>

  <section class="wrap section" id="start">
    <div class="section-head reveal">
      <span class="eyebrow">02 · Start</span>
      <h2>Start with one</h2>
    </div>
    <div class="start">
      <div class="start-intro">
        <p>Add the rest when your workflow asks for it.</p>
        <div class="picker">
          <label class="picker-label" for="tool-picker">I want my agent to…</label>
          <div class="picker-control" hidden>
            <select id="tool-picker">
${tools.map((tool) => `              <option value="${esc(tool.id)}">${esc(tool.role.toLowerCase())} — ${esc(tool.name)}</option>`).join('\n')}
            </select>
          </div>
        </div>
      </div>
      <div>
${tools.map(panel).join('\n')}
      </div>
    </div>
  </section>
</main>

<footer class="wrap foot">
  <p class="foot-mark">chain.sh</p>
  <p class="foot-tagline">Four command-line tools for working with coding agents. Built and maintained by <a href="https://dikeakos.me">george dikeakos</a>.</p>
  <p class="foot-links">
    <a href="https://github.com/1broseidon" target="_blank" rel="noopener noreferrer">github</a> ·
${tools.map((tool) => `    <a href="${esc(tool.url)}" target="_blank" rel="noopener noreferrer">${esc(tool.name)}</a>`).join(' ·\n')}
  </p>
  <p class="foot-meta">mit · static html on cloudflare workers · no tracking · © ${year}</p>
</footer>

<script>${script.trim()}</script>
</body>
</html>
`

/* Sub-paths that used to be GitHub Pages sites under this domain, plus the
 * tools that no longer appear on the page. Their URLs are in the wild, so they
 * forward rather than 404. */
const redirects = `# Generated by build.mjs — do not edit.
/cymbal/*      https://cymbal.sh/:splat                          301
/cymbal        https://cymbal.sh/                                301
/hotline       https://hotline.dev/                              301
/prism         https://github.com/1broseidon/prism               301
/skills        https://github.com/1broseidon/skills              301
/promptext/*   https://github.com/1broseidon/promptext           301
/oneagent/*    https://github.com/1broseidon/oneagent            301
/termtile/*    https://github.com/1broseidon/termtile            301
/moxie/*       https://github.com/1broseidon/moxie               301
/rmkbl/*       https://github.com/1broseidon/rmkbl               301
`

await rm(root('dist'), { recursive: true, force: true })
await mkdir(root('dist'), { recursive: true })
await writeFile(root('dist/index.html'), html)
await writeFile(root('dist/_redirects'), redirects)

const kb = (n) => `${(n / 1024).toFixed(2)} kB`
console.log(
  `built dist/index.html  ${kb(Buffer.byteLength(html))}  ·  ${tools.length} tools  ·  ${session.steps.length} steps  ·  ${releases} releases / ${stars} stars`,
)
