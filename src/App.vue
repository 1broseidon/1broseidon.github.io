<script setup lang="ts">
import stars from './stars.json'

type Tool = {
  id: string
  name: string
  description: string
  dest: string
  url: string
  external: boolean
  lang: string
  license: string
}

const featured: Tool[] = [
  {
    id: 'ketch',
    name: 'ketch',
    description: 'Stateless CLI for web search, OSS code search, library docs and scraping. Built for AI agents.',
    dest: 'ketch.run',
    url: 'https://ketch.run',
    external: true,
    lang: 'Go',
    license: 'MIT',
  },
  {
    id: 'cymbal',
    name: 'cymbal',
    description: 'Language-agnostic code navigation powered by tree-sitter. Symbols, call graphs, impact.',
    dest: 'chain.sh/cymbal',
    url: '/cymbal/',
    external: false,
    lang: 'Go',
    license: 'MIT',
  },
  {
    id: 'hotline',
    name: 'hotline',
    description: 'A local-first room for your team of coding agents, over the Agent Client Protocol.',
    dest: 'hotline.dev',
    url: 'https://hotline.dev',
    external: true,
    lang: 'Rust',
    license: 'Apache-2.0',
  },
  {
    id: 'brainfile',
    name: 'brainfile',
    description: 'Markdown task boards for you and your agents. CLI, TUI and MCP server.',
    dest: 'brainfile.md',
    url: 'https://brainfile.md',
    external: true,
    lang: 'TypeScript',
    license: 'MIT',
  },
]

const also: Tool[] = [
  {
    id: 'prism',
    name: 'prism',
    description: 'Local MCP gateway in the system tray. One endpoint, human-in-the-loop tool approval.',
    dest: 'github',
    url: 'https://github.com/1broseidon/prism',
    external: true,
    lang: 'Rust',
    license: 'MIT',
  },
  {
    id: 'recoil',
    name: 'recoil',
    description: 'Fast local memory recall for agents and humans.',
    dest: 'github',
    url: 'https://github.com/1broseidon/recoil',
    external: true,
    lang: 'Go',
    license: 'MIT',
  },
  {
    id: 'skills',
    name: 'skills',
    description: 'Agent skills for coding agents — anvil for backend craft, scribe for documentation.',
    dest: 'github',
    url: 'https://github.com/1broseidon/skills',
    external: true,
    lang: 'Markdown',
    license: '—',
  },
]

const starsFor = (id: string): number | null =>
  typeof (stars as Record<string, number>)[id] === 'number'
    ? (stars as Record<string, number>)[id]
    : null

const total = [...featured, ...also].reduce((n, t) => n + (starsFor(t.id) ?? 0), 0)
const count = featured.length + also.length
const year = new Date().getFullYear()
</script>

<template>
  <div class="shell">
    <header class="mast">
      <span class="mast-mark">chain.sh</span>
      <span class="mast-count">{{ count }} tools</span>
      <nav class="mast-nav">
        <a
          class="mast-gh"
          href="https://github.com/1broseidon"
          target="_blank"
          rel="noopener"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
          </svg>
          <span>{{ total.toLocaleString('en-US') }}</span>
        </a>
      </nav>
    </header>

    <section class="intro">
      <h1>chain.sh</h1>
      <div class="intro-rule" aria-hidden="true"></div>
      <p class="lede">
        Command-line tools and agent infrastructure, by George Dikeakos. Mostly Go
        and Rust — small binaries that do one thing, with output an agent can parse.
      </p>
      <p class="sub">
        Three have their own homes: <code>ketch.run</code>, <code>hotline.dev</code>,
        <code>brainfile.md</code>. The rest are served from here.
      </p>
    </section>

    <h2 class="grouphead">
      <span>Featured</span>
      <span class="count">{{ featured.length }}</span>
    </h2>
    <div class="rows">
      <a
        v-for="t in featured"
        :key="t.id"
        class="row"
        :href="t.url"
        :target="t.external ? '_blank' : undefined"
        :rel="t.external ? 'noopener' : undefined"
      >
        <span class="row-name">{{ t.name }}</span>
        <span class="row-dest">{{ t.dest }}</span>
        <p class="row-desc">{{ t.description }}</p>
        <span class="row-meta">{{ t.lang }} · {{ t.license }}</span>
        <span class="row-stars">
          <template v-if="starsFor(t.id) !== null">★ {{ starsFor(t.id) }}</template>
        </span>
      </a>
    </div>

    <h2 class="grouphead">
      <span>Also</span>
      <span class="count">{{ also.length }}</span>
    </h2>
    <div class="rows">
      <a
        v-for="t in also"
        :key="t.id"
        class="row"
        :href="t.url"
        :target="t.external ? '_blank' : undefined"
        :rel="t.external ? 'noopener' : undefined"
      >
        <span class="row-name">{{ t.name }}</span>
        <span class="row-dest">{{ t.dest }}</span>
        <p class="row-desc">{{ t.description }}</p>
        <span class="row-meta">{{ t.lang }} · {{ t.license }}</span>
        <span class="row-stars">
          <template v-if="starsFor(t.id) !== null">★ {{ starsFor(t.id) }}</template>
        </span>
      </a>
    </div>

    <footer class="foot foot-pad">
      <span>© {{ year }} chain.sh</span>
      <span>MIT · Apache-2.0</span>
      <span class="spacer">
        <a href="https://github.com/1broseidon" target="_blank" rel="noopener">
          github.com/1broseidon
        </a>
      </span>
    </footer>
  </div>
</template>
