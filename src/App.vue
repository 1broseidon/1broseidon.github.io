<script setup lang="ts">
import { ref, onMounted } from 'vue'

type Project = {
  id: string
  name: string
  category: string
  description: string
  url: string
  external: boolean
  repo?: string
  meta?: { k: string; v: string }[]
}

const featured: Project[] = [
  {
    id: 'cymbal',
    name: 'Cymbal',
    category: 'Code intelligence',
    description:
      'Fast code indexer and symbol navigator built on tree-sitter. A drop-in replacement for grep and find when an agent needs structural understanding of a codebase.',
    url: 'https://github.com/1broseidon/cymbal',
    external: true,
    repo: 'cymbal',
    meta: [
      { k: 'Language', v: 'Go' },
      { k: 'Built on', v: 'tree-sitter' },
    ],
  },
  {
    id: 'ketch',
    name: 'Ketch',
    category: 'Web tooling',
    description:
      'Stateless CLI for web search and scraping. Pipe-friendly, streams to stdout.',
    url: 'https://github.com/1broseidon/ketch',
    external: true,
    repo: 'ketch',
    meta: [{ k: 'Language', v: 'Go' }],
  },
  {
    id: 'brainfile',
    name: 'Brainfile',
    category: 'Coordination',
    description:
      'File-based task coordination for humans and AI agents. Kanban, contracts, and ADRs in markdown.',
    url: 'https://brainfile.md',
    external: true,
    meta: [
      { k: 'Format', v: 'Markdown + YAML' },
      { k: 'Backends', v: 'Claude · Codex · Cursor' },
    ],
  },
]

const others: Project[] = [
  {
    id: 'oneagent',
    name: 'Oneagent',
    category: 'Multi-backend CLI',
    description:
      'Config-driven CLI unifying Claude, Codex, and Gemini from a single interface.',
    url: '/oneagent',
    external: false,
  },
  {
    id: 'moxie',
    name: 'Moxie',
    category: 'Chat agent',
    description:
      'Always-on chat agent bridging Telegram and Slack with AI coding backends. Switch models, schedule tasks, delegate to subagents.',
    url: 'https://github.com/1broseidon/moxie',
    external: true,
  },
  {
    id: 'promptext',
    name: 'Promptext',
    category: 'Context extraction',
    description: 'Smart code context extractor with relevance scoring.',
    url: '/promptext',
    external: false,
  },
  {
    id: 'termtile',
    name: 'Termtile',
    category: 'Window manager',
    description: 'X11-native terminal tiling with smart grid layouts.',
    url: '/termtile',
    external: false,
  },
]

const allProjects = [...featured, ...others]

const ghStats = ref<{ lastPush: string } | null>(null)
const stars = ref<Record<string, number>>({})

onMounted(async () => {
  try {
    const res = await fetch('https://api.github.com/users/1broseidon/repos?per_page=100')
    if (!res.ok) return
    const repos = (await res.json()) as Array<{
      name: string
      pushed_at: string
      stargazers_count: number
    }>

    const lastPush = repos
      .map((r) => r.pushed_at)
      .sort()
      .pop() ?? ''
    if (lastPush) {
      const daysAgo = Math.floor((Date.now() - new Date(lastPush).getTime()) / 86400000)
      ghStats.value = {
        lastPush:
          daysAgo === 0 ? 'today' : daysAgo === 1 ? '1 day ago' : `${daysAgo} days ago`,
      }
    }

    const map: Record<string, number> = {}
    for (const r of repos) map[r.name.toLowerCase()] = r.stargazers_count
    stars.value = map
  } catch {
    /* silent fail */
  }
})

const year = new Date().getFullYear()
</script>

<template>
  <div class="shell">
    <!-- Nav -->
    <nav class="nav">
      <div class="nav-wordmark">chain.sh</div>
      <a
        href="https://github.com/1broseidon"
        target="_blank"
        rel="noopener"
        class="nav-icon"
        aria-label="GitHub"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
        </svg>
      </a>
    </nav>

    <!-- Hero -->
    <header class="hero fade-up" style="animation-delay: 80ms">
      <div class="hero-eyebrow">by George Dikeakos</div>
      <h1 class="hero-headline">
        Open-source tools<br />for AI coding agents.
      </h1>
      <div class="hero-sub-row">
        <span class="hero-rule" aria-hidden="true"></span>
        <p class="hero-sub">
          CLIs, runtimes, and coordination primitives for the people building agents.
          Mostly Go, some TypeScript. Boring on purpose.
        </p>
      </div>
    </header>

    <!-- Tools -->
    <section class="tools fade-up" style="animation-delay: 180ms">
      <div class="section-head">
        <span class="section-eyebrow">Featured</span>
        <span class="section-rule" aria-hidden="true"></span>
        <span class="section-count">{{ String(allProjects.length).padStart(2, '0') }} projects</span>
      </div>

      <div class="bento">
        <a
          v-for="(p, i) in featured"
          :key="p.id"
          :href="p.url"
          :target="p.external ? '_blank' : undefined"
          :rel="p.external ? 'noopener' : undefined"
          :class="['tile', i === 0 ? 'tile-lg' : 'tile-md']"
        >
          <span class="tile-label">{{ p.category }}</span>
          <h3 class="tile-name">{{ p.name }}</h3>
          <p class="tile-desc">{{ p.description }}</p>
          <div v-if="(p.meta && p.meta.length) || (p.repo && stars[p.repo] !== undefined)" class="tile-meta">
            <div v-for="m in p.meta" :key="m.k" class="tile-meta-row">
              <span class="k">{{ m.k }}</span>
              <span class="v">{{ m.v }}</span>
            </div>
            <div v-if="p.repo && stars[p.repo] !== undefined" class="tile-meta-row">
              <span class="k">Stars</span>
              <span class="v">★ {{ stars[p.repo] }}</span>
            </div>
          </div>
        </a>
      </div>

      <div class="section-head">
        <span class="section-eyebrow quiet">Also</span>
        <span class="section-rule" aria-hidden="true"></span>
      </div>

      <div class="list">
        <a
          v-for="p in others"
          :key="p.id"
          :href="p.url"
          :target="p.external ? '_blank' : undefined"
          :rel="p.external ? 'noopener' : undefined"
          class="list-item"
        >
          <span class="list-kicker">{{ p.category }}</span>
          <div class="list-name-row">
            <h3 class="list-name">{{ p.name }}</h3>
            <span class="list-arrow" aria-hidden="true">→</span>
          </div>
          <p class="list-desc">{{ p.description }}</p>
        </a>
      </div>
    </section>

    <!-- Footer -->
    <footer class="footer fade-up" style="animation-delay: 260ms">
      <span>© {{ year }} chain.sh</span>
      <span v-if="ghStats">last push <strong>{{ ghStats.lastPush }}</strong></span>
    </footer>
  </div>
</template>
