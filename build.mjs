/* chain.sh — the whole build.
 *
 * Reads src/tools.json + src/repos.json + src/transcript.json + tokens.css +
 * src/page.css + src/page.js and writes one self-contained dist/index.html.
 * No framework, no bundler.
 *
 * The workflow examples use a real terminal session: four tools, one task,
 * every line of output captured from an actual run. src/transcript.json is
 * the record; the highlighter below only tints it.
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

const step = (entry) => {
  const tool = byId[entry.tool]
  return `        <li class="step">
          <div class="step-head">
            <a class="step-tool" href="#${esc(tool.id)}">${esc(tool.name)}</a>
            <p class="step-why">${esc(entry.why)}</p>
          </div>
          <details class="step-output">
            <summary>View captured output<span class="sr-only"> for ${esc(tool.name)}</span></summary>
            <pre class="term" tabindex="0" role="region" aria-label="Captured ${esc(tool.name)} output"><code>${entry.lines.map(line).join('\n')}</code></pre>
          </details>
        </li>`
}

/* ---------- content ----------------------------------------------------- */

const arrow =
  '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 18 18 6M6 6h12v12"/></svg>'

// Illustrative needs, separate from the captured terminal session below.
const orbitNeeds = [
  { tool: 'ketch', need: 'the right documentation', response: 'finds the web pages and docs.' },
  { tool: 'cymbal', need: 'a way through the code', response: 'traces symbols and their connections.' },
  { tool: 'recoil', need: 'a decision from last time', response: 'recalls the project’s memory.' },
  { tool: 'brainfile', need: 'a clear next step', response: 'keeps the tasks in view.' },
]

/* Orbit geometry is derived, not hand-drawn: the ring, its calibration ticks,
 * every tool's dot and every label's offset fall out of ORBIT plus the number
 * of tools. The same constants go to page.js as data-* on the stage, so the
 * server-rendered first frame and the animation cannot drift apart — and a
 * fifth tool re-spaces the ring instead of landing on top of a fourth. */
const ORBIT = { w: 440, h: 320, cx: 220, cy: 152, rx: 132, ry: 98, start: -135, label: 1.28, ticks: 48 }

const pointAt = (deg, k = 1) => {
  const rad = (deg * Math.PI) / 180
  return { x: ORBIT.cx + ORBIT.rx * k * Math.cos(rad), y: ORBIT.cy + ORBIT.ry * k * Math.sin(rad), rad }
}
const nodeDeg = (index) => ORBIT.start + (360 / orbitNeeds.length) * index
const px = (v) => `${((v / ORBIT.w) * 100).toFixed(3)}%`
const py = (v) => `${((v / ORBIT.h) * 100).toFixed(3)}%`
const n2 = (v) => v.toFixed(2)

/* Emitted as a rule ahead of page.css rather than an inline style: inline
 * declarations outrank media queries, which would freeze --label-k at its
 * desktop value and silently disable the narrow-screen override. */
const orbitVars = `.orbit-stage { --hub-x: ${px(ORBIT.cx)}; --hub-y: ${py(ORBIT.cy)}; --label-k: ${ORBIT.label}; }`

/* Ticks stay fixed while the tools travel past them. That is what makes the
 * rotation legible as motion rather than a diamond slowly wobbling. */
const orbitTicks = Array.from({ length: ORBIT.ticks }, (_, i) => {
  const deg = ORBIT.start + (360 / ORBIT.ticks) * i
  const major = i % (ORBIT.ticks / orbitNeeds.length) === 0
  const a = pointAt(deg)
  const b = pointAt(deg, major ? 1.085 : 1.045)
  return `          <line class="orbit-tick${major ? ' is-major' : ''}" x1="${n2(a.x)}" y1="${n2(a.y)}" x2="${n2(b.x)}" y2="${n2(b.y)}"/>`
}).join('\n')

/* Depth: 0 at the back of the ring, 1 at the front. Drives scale and weight so
 * the four tools read as orbiting rather than pinned to a flat diamond. */
const depthAt = (rad) => (Math.sin(rad) + 1) / 2

const orbitDot = (state, index) => {
  const p = pointAt(nodeDeg(index))
  return `          <circle class="orbit-dot${index === 0 ? ' is-selected' : ''}" data-dot="${esc(state.tool)}" cx="${n2(p.x)}" cy="${n2(p.y)}" r="3.25" style="--depth:${depthAt(p.rad).toFixed(3)}"/>`
}

const orbitNode = (state, index) => {
  const tool = byId[state.tool]
  const p = pointAt(nodeDeg(index), ORBIT.label)
  return `        <button class="orbit-tool${index === 0 ? ' is-selected' : ''}" type="button" disabled
          data-orbit-tool="${esc(tool.id)}" data-need="${esc(state.need)}" data-response="${esc(state.response)}"
          data-spec="${esc(`${tool.lang} · ${tool.license}`)}"
          style="left:${px(p.x)};top:${py(p.y)};--depth:${depthAt(p.rad).toFixed(3)}"
          aria-pressed="${index === 0}" aria-label="${esc(tool.name)}: ${esc(tool.role)}" aria-controls="orbit-readout">
          <span class="orbit-tool-name">${esc(tool.name)}</span><span class="orbit-tool-role">${esc(tool.role)}</span>
        </button>`
}

const toolRow = (tool) => `        <li class="tool-row" id="${esc(tool.id)}">
          <div class="tool-heading">
            <h3><a href="${esc(tool.url)}" target="_blank" rel="noopener noreferrer">${esc(tool.name)}<span class="sr-only"> (opens in a new tab)</span></a></h3>
            <p class="tool-role">${esc(tool.role)}</p>
          </div>
          <p class="tool-description">${esc(tool.description)}</p>
          <a class="tool-guide" href="${esc(tool.install)}" target="_blank" rel="noopener noreferrer">Get started<span class="sr-only"> with ${esc(tool.name)} (opens in a new tab)</span></a>
        </li>`

const panel = (tool) => {
  const prompt = `Help me set up ${tool.name} for this project. Read ${tool.install} for the current installation and setup instructions. Check support for my operating system and any prerequisites, explain the setup choices, then verify that it works.`
  return `        <div class="panel" id="setup-${esc(tool.id)}" aria-labelledby="setup-title-${esc(tool.id)}">
          <h3 id="setup-title-${esc(tool.id)}">Set up ${esc(tool.name)}</h3>
          <p class="panel-description">${esc(tool.description)}</p>
          <div class="panel-actions">
            <a class="btn btn-primary" href="${esc(tool.install)}" target="_blank" rel="noopener noreferrer">Open install guide ${arrow}<span class="sr-only"> for ${esc(tool.name)} (opens in a new tab)</span></a>
            <button class="copy-button" type="button" data-copy="prompt-${esc(tool.id)}" hidden>Copy setup prompt</button>
          </div>
          <p class="panel-hint">Follow the guide for installation and first steps.</p>
          <label class="sr-only" for="prompt-${esc(tool.id)}">Setup prompt for ${esc(tool.name)}</label>
          <textarea class="prompt-fallback" id="prompt-${esc(tool.id)}" rows="4" readonly hidden>${esc(prompt)}</textarea>
          <p class="copy-status" role="status" aria-live="polite"></p>
        </div>`
}

const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="9" fill="#2b2596"/><g fill="none" stroke="#eef0f7" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M11 14.5 16.5 20 11 25.5"/><path d="M20.5 26h8.5"/></g></svg>`

const description =
  'Four open-source command-line tools for working with coding agents: research the web, navigate a codebase, keep local memory, and track the work in Markdown.'

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#F1F0EB">
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
${orbitVars}
${css.trim()}</style>
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>

<header class="wrap mast" id="top">
  <a class="wordmark" href="#top" aria-label="chain.sh home">chain.sh</a>
  <nav class="mast-nav" aria-label="Main navigation">
    <a href="#tools">The tools</a>
    <a href="#workflow" class="nav-workflow">In practice</a>
    <a href="#start">Get started</a>
  </nav>
</header>

<main id="main" class="wrap">
  <section class="hero" aria-labelledby="hero-title">
    <div class="hero-copy">
      <h1 class="hero-title" id="hero-title">Tools for<br>coding agents.</h1>
      <p class="hero-lede">Research, code navigation, memory, and tasks. Four open-source tools for the work you do with agents.</p>
      <p class="hero-note">Use one on its own, or bring them into the same workflow.</p>
      <a class="text-link hero-link" href="#tools">Explore the tools</a>
    </div>
    <figure class="orbit" aria-label="An example of an agent reaching for the tool it needs">
      <div class="orbit-stage" role="group" aria-label="Explore the agent’s tools"
        data-cx="${ORBIT.cx}" data-cy="${ORBIT.cy}" data-rx="${ORBIT.rx}" data-ry="${ORBIT.ry}"
        data-start="${ORBIT.start}" data-label="${ORBIT.label}" data-w="${ORBIT.w}" data-h="${ORBIT.h}">
        <svg class="orbit-drawing" viewBox="0 0 ${ORBIT.w} ${ORBIT.h}" fill="none" aria-hidden="true">
          <ellipse class="orbit-track" cx="${ORBIT.cx}" cy="${ORBIT.cy}" rx="${ORBIT.rx}" ry="${ORBIT.ry}"/>
${orbitTicks}
          <path class="orbit-reach" d="M${ORBIT.cx} ${ORBIT.cy}L${n2(pointAt(nodeDeg(0)).x)} ${n2(pointAt(nodeDeg(0)).y)}"/>
${orbitNeeds.map(orbitDot).join('\n')}
          <circle class="orbit-signal" cx="${ORBIT.cx}" cy="${ORBIT.cy}" r="3"/>
        </svg>
        <div class="orbit-agent"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 7 5 5-5 5m8 0h5"/></svg><span>Your agent</span></div>
${orbitNeeds.map(orbitNode).join('\n')}
      </div>
      <figcaption class="orbit-caption">
        <div class="orbit-readout" id="orbit-readout">
          <p class="orbit-preamble">When the agent needs…</p>
          <p class="orbit-need">${esc(orbitNeeds[0].need)}</p>
          <p class="orbit-response"><a href="#ketch">ketch</a> <span>${esc(orbitNeeds[0].response)}</span></p>
          <p class="orbit-spec">${esc(`${byId[orbitNeeds[0].tool].lang} · ${byId[orbitNeeds[0].tool].license}`)}</p>
        </div>
        <button class="orbit-playback" type="button" aria-label="Pause the orbit animation" hidden><svg viewBox="0 0 16 16" aria-hidden="true"><path class="orbit-pause-icon" d="M5 3v10M11 3v10"/><path class="orbit-play-icon" d="m5 3 7 5-7 5Z"/></svg><span>Pause</span></button>
        <p class="sr-only orbit-announcement" role="status" aria-live="polite"></p>
      </figcaption>
    </figure>
  </section>

  <section class="section collection" id="tools" aria-labelledby="tools-title">
    <div class="section-head">
      <h2 id="tools-title">Choose what you need.</h2>
    </div>
    <ul class="tool-list">
${tools.map(toolRow).join('\n')}
    </ul>
  </section>

  <section class="section workflow" id="workflow" aria-labelledby="workflow-title">
    <div class="section-head">
      <h2 id="workflow-title">One task, a few tools.</h2>
      <p>Research an approach, trace the code, keep the decision, and leave a clear next step.</p>
    </div>
    <p class="session-task">${esc(session.task)}</p>
    <ol class="session-steps">
${session.steps.map(step).join('\n')}
    </ol>
    <p class="session-note">${esc(session.note)}</p>
  </section>

  <section class="section" id="start" aria-labelledby="start-title">
    <div class="start">
      <div class="start-intro">
        <h2 id="start-title">Start with one.</h2>
        <p>Follow the guide, or let your agent help with setup.</p>
        <div class="picker-control" hidden>
          <label class="picker-label" for="tool-picker">Choose a tool</label>
            <select id="tool-picker">
${tools.map((tool) => `              <option value="${esc(tool.id)}">${esc(tool.name)} — ${esc(tool.role)}</option>`).join('\n')}
            </select>
        </div>
      </div>
      <div class="panels">
${tools.map(panel).join('\n')}
      </div>
    </div>
  </section>
</main>

<footer class="wrap foot">
  <div><a class="wordmark" href="#top">chain.sh</a><p>Built and maintained by <a href="https://dikeakos.me">George Dikeakos</a>.</p></div>
  <div class="foot-links"><a href="https://github.com/1broseidon" target="_blank" rel="noopener noreferrer">Source on GitHub<span class="sr-only"> (opens in a new tab)</span></a><span>© ${year}</span></div>
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
