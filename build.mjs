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

import { mkdir, readFile, rm, writeFile, copyFile } from 'node:fs/promises'

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

/* The dial is derived, not hand-drawn: four stations on one circle, a leader
 * from each station to its label, and a needle sized to the hub. The pivot,
 * the hub's width and how far the signal runs go into the markup with the
 * coordinates, so page.css carries no geometry of its own and the drawing and
 * its animation cannot drift apart. A fifth tool re-spaces the stations
 * instead of landing on top of a fourth. */
const DIAL = { w: 440, h: 320, cx: 220, cy: 160, r: 118, lead: 16, hub: 99, start: -135 }

const rad = (deg) => (deg * Math.PI) / 180
const px = (v) => `${((v / DIAL.w) * 100).toFixed(3)}%`
const py = (v) => `${((v / DIAL.h) * 100).toFixed(3)}%`
const n2 = (v) => v.toFixed(2)

// The needle runs from just outside the hub to just short of the ring; the
// signal rides it as far as the station's edge.
const needleFrom = DIAL.cx + DIAL.hub / 2 + 6.5
const needleTo = DIAL.cx + DIAL.r - 5
const signalRun = needleTo - needleFrom - 1

const station = (index) => {
  const deg = DIAL.start + (360 / orbitNeeds.length) * index
  const at = (k) => ({ x: DIAL.cx + k * Math.cos(rad(deg)), y: DIAL.cy + k * Math.sin(rad(deg)) })
  return { deg, on: at(DIAL.r), end: at(DIAL.r + DIAL.lead), west: Math.cos(rad(deg)) < 0, north: Math.sin(rad(deg)) < 0 }
}

const orbitLeader = (state, index) => {
  const s = station(index)
  return `          <line class="orbit-leader${index === 0 ? ' is-engaged' : ''}" data-leader="${esc(state.tool)}" x1="${n2(s.on.x)}" y1="${n2(s.on.y)}" x2="${n2(s.end.x)}" y2="${n2(s.end.y)}"/>`
}
const orbitStation = (state, index) => {
  const s = station(index)
  return `          <circle class="orbit-station${index === 0 ? ' is-engaged' : ''}" data-station="${esc(state.tool)}" cx="${n2(s.on.x)}" cy="${n2(s.on.y)}" r="3.25"/>`
}
const orbitPing = (state, index) => {
  const s = station(index)
  return `          <circle class="orbit-ping" data-ping="${esc(state.tool)}" cx="${n2(s.on.x)}" cy="${n2(s.on.y)}" r="5"/>`
}

/* Each label hangs off the end of its leader by the corner nearest the ring,
 * so it grows away from the drawing: up and to the left above the north-west
 * station, down and to the right below the south-east one, and so on. */
const orbitNode = (state, index) => {
  const tool = byId[state.tool]
  const s = station(index)
  const x = s.west ? `right:${px(DIAL.w - s.end.x)}` : `left:${px(s.end.x)}`
  const y = s.north ? `bottom:${py(DIAL.h - s.end.y)}` : `top:${py(s.end.y)}`
  return `        <button class="orbit-tool${index === 0 ? ' is-selected is-engaged' : ''}" type="button" disabled
          data-orbit-tool="${esc(tool.id)}" data-need="${esc(state.need)}" data-response="${esc(state.response)}"
          data-spec="${esc(`${tool.lang} · ${tool.license}`)}" data-angle="${s.deg}" data-side="${s.west ? 'w' : 'e'}"
          style="${x};${y}"
          aria-pressed="${index === 0}" aria-label="${esc(tool.name)}: ${esc(tool.role)}" aria-controls="orbit-readout">
          <span class="orbit-tool-name">${esc(tool.name)}</span><span class="orbit-tool-role">${esc(tool.role)}</span>
        </button>`
}

const toolRow = (tool) => `        <li class="tool-row" id="${esc(tool.id)}">
          <div class="tool-heading">
            <h3><a href="${esc(tool.url)}" target="_blank" rel="noopener noreferrer">${esc(tool.name)}<span class="sr-only"> (opens in a new tab)</span></a></h3>
            <p class="tool-role">${esc(tool.role)}</p>
            <p class="tool-spec">${esc(`${tool.lang} · ${tool.license}`)}</p>
          </div>
          <p class="tool-description">${esc(tool.description)}</p>
          <a class="tool-guide" href="${esc(tool.install)}" target="_blank" rel="noopener noreferrer">Get started<span class="sr-only"> with ${esc(tool.name)} (opens in a new tab)</span></a>
        </li>`

const panel = (tool) => {
  const prompt = `Help me set up ${tool.name} for this project. Read ${tool.install} for the current installation and setup instructions. Check support for my operating system and any prerequisites, explain the setup choices, then verify that it works.`
  return `        <div class="panel" id="setup-${esc(tool.id)}" aria-labelledby="setup-title-${esc(tool.id)}" data-copy-scope>
          <h3 id="setup-title-${esc(tool.id)}">Set up ${esc(tool.name)}</h3>
          <p class="panel-description">${esc(tool.description)}</p>
          <div class="panel-actions">
            <a class="btn btn-primary" href="${esc(tool.install)}" target="_blank" rel="noopener noreferrer">Open install guide ${arrow}<span class="sr-only"> for ${esc(tool.name)} (opens in a new tab)</span></a>
            <button class="copy-button" type="button" data-copy="prompt-${esc(tool.id)}" data-copied="Copied. Ready to paste into your agent’s chat." hidden>Copy setup prompt</button>
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
<meta name="theme-color" content="#F7F6F1">
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
    <figure class="orbit" data-phase="home" data-answered="true" aria-label="An example of an agent reaching for the tool it needs">
      <div class="orbit-stage" role="group" aria-label="Explore the agent’s tools">
        <svg class="orbit-drawing" viewBox="0 0 ${DIAL.w} ${DIAL.h}" fill="none" aria-hidden="true">
          <circle class="orbit-track" cx="${DIAL.cx}" cy="${DIAL.cy}" r="${DIAL.r}"/>
${orbitNeeds.map(orbitLeader).join('\n')}
          <g class="orbit-needle" style="--angle:${station(0).deg}deg;transform-origin:${DIAL.cx}px ${DIAL.cy}px"><line class="orbit-needle-line" x1="${needleFrom}" y1="${DIAL.cy}" x2="${needleTo}" y2="${DIAL.cy}"/><circle class="orbit-signal" cx="${needleFrom}" cy="${DIAL.cy}" r="3" style="--run:${signalRun}px"/></g>
${orbitNeeds.map(orbitStation).join('\n')}
${orbitNeeds.map(orbitPing).join('\n')}
        </svg>
        <div class="orbit-agent" style="width:${px(DIAL.hub)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 7 5 5-5 5m8 0h5"/></svg><span>Agent</span></div>
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
      <div class="start-all">
        <div class="start-method" data-copy-scope>
          <h3>Or all four at once.</h3>
          <p>One command for macOS and Linux. It installs each tool from its latest release, checks every download against the release’s checksums, and never uses sudo. It is a plain shell script — read it first.</p>
          <pre class="command"><code id="bootstrap-command">curl -fsSL https://chain.sh/bootstrap.sh | sh</code></pre>
          <div class="start-all-actions">
            <a class="text-link" href="https://chain.sh/bootstrap.sh">Read bootstrap.sh</a>
            <button class="copy-button" type="button" data-copy="bootstrap-command" data-copied="Copied. Paste it into a terminal." hidden>Copy command</button>
          </div>
          <p class="copy-status" role="status" aria-live="polite"></p>
        </div>
        <div class="start-method" data-copy-scope>
          <h3>Or hand your agent the workflow.</h3>
          <p>The chain skill teaches an agent which tool answers which question, what order to ask them in, and what to write back before a session ends. One command adds it to the agents you already use, through the skills CLI. It installs none of the tools; the script above does that.</p>
          <pre class="command"><code id="skill-command">npx skills add 1broseidon/skills --skill chain</code></pre>
          <div class="start-all-actions">
            <a class="text-link" href="https://github.com/1broseidon/skills/blob/main/chain/SKILL.md" target="_blank" rel="noopener noreferrer">Read SKILL.md<span class="sr-only"> (opens in a new tab)</span></a>
            <button class="copy-button" type="button" data-copy="skill-command" data-copied="Copied. Paste it into a terminal." hidden>Copy command</button>
          </div>
          <p class="copy-status" role="status" aria-live="polite"></p>
        </div>
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

/* Every tool on the page answers at its own sub-path, derived from tools.json
 * so a new tool brings its redirect with it. Tools with their own site keep the
 * rest of the path; the ones that live on GitHub drop it, since a repo has no
 * matching tree. Below them are sub-paths that used to be GitHub Pages sites
 * under this domain, plus tools that no longer appear on the page — their URLs
 * are in the wild, so they forward rather than 404.
 *
 * Workers consumes this file; GitHub Pages ignored it. It is the only thing
 * forwarding these paths now, so it has to carry them all. */
const pad = (from) => from.padEnd(14)
const toolRedirects = tools
  .map((tool) => {
    const site = tool.dest !== 'github'
    const deep = site ? `${tool.url}/:splat` : tool.url
    const root = site ? `${tool.url}/` : tool.url
    return `${pad(`/${tool.id}/*`)} ${deep.padEnd(49)} 301\n${pad(`/${tool.id}`)} ${root.padEnd(49)} 301`
  })
  .join('\n')

const redirects = `# Generated by build.mjs — do not edit.
${toolRedirects}
${pad('/hotline')} ${'https://hotline.dev/'.padEnd(49)} 301
${pad('/prism')} ${'https://github.com/1broseidon/prism'.padEnd(49)} 301
${pad('/skills')} ${'https://github.com/1broseidon/skills'.padEnd(49)} 301
${pad('/promptext/*')} ${'https://github.com/1broseidon/promptext'.padEnd(49)} 301
${pad('/oneagent/*')} ${'https://github.com/1broseidon/oneagent'.padEnd(49)} 301
${pad('/termtile/*')} ${'https://github.com/1broseidon/termtile'.padEnd(49)} 301
${pad('/moxie/*')} ${'https://github.com/1broseidon/moxie'.padEnd(49)} 301
${pad('/rmkbl/*')} ${'https://github.com/1broseidon/rmkbl'.padEnd(49)} 301
`

await rm(root('dist'), { recursive: true, force: true })
await mkdir(root('dist'), { recursive: true })
await writeFile(root('dist/index.html'), html)
await writeFile(root('dist/_redirects'), redirects)

/* bootstrap.sh is served as-is so an operator can read it in a browser before
 * running it — that is the whole point of it being a plain shell script.
 * Without the header rule the .sh extension is served as a download. */
await copyFile(root('bootstrap.sh'), root('dist/bootstrap.sh'))
await writeFile(root('dist/_headers'), `/bootstrap.sh
  Content-Type: text/plain; charset=utf-8
`)

const kb = (n) => `${(n / 1024).toFixed(2)} kB`
console.log(
  `built dist/index.html  ${kb(Buffer.byteLength(html))}  ·  ${tools.length} tools  ·  ${session.steps.length} steps  ·  ${releases} releases / ${stars} stars`,
)
