<script setup lang="ts">
import { ref, onMounted } from 'vue'

const featured = [
  {
    id: 'brainfile',
    name: 'Brainfile',
    label: 'TS / PYTHON',
    description: 'File-based task coordination for humans and AI agents. Kanban, contracts, and ADRs in markdown.',
    meta: [
      { label: 'Format', value: 'Markdown + YAML' },
      { label: 'Works with', value: 'Claude · Codex · Cursor' },
    ],
    url: 'https://brainfile.md',
    external: true,
  },
  {
    id: 'oneagent',
    name: 'Oneagent',
    label: 'GO',
    description: 'Config-driven CLI unifying Claude, Codex, and Gemini from a single interface.',
    meta: [
      { label: 'Backends', value: 'Claude · Codex · Gemini' },
      { label: 'Output', value: 'Normalized JSON' },
    ],
    url: '/oneagent',
    external: false,
  },
  {
    id: 'moxie',
    name: 'Moxie',
    label: 'GO',
    description: 'Always-on chat agent bridging Telegram and Slack with AI coding backends. Switch models, schedule tasks, delegate to subagents.',
    meta: [
      { label: 'Transports', value: 'Telegram · Slack' },
      { label: 'Backends', value: 'Claude · Codex · Gemini' },
    ],
    url: 'https://github.com/1broseidon/moxie',
    external: true,
  },
]

const others = [
  {
    id: 'cymbal',
    name: 'Cymbal',
    label: 'GO',
    description: 'Fast code indexer and symbol navigator built on tree-sitter.',
    url: 'https://github.com/1broseidon/cymbal',
    external: true,
  },
  {
    id: 'ketch',
    name: 'Ketch',
    label: 'GO',
    description: 'Stateless CLI for web search and scraping.',
    url: 'https://github.com/1broseidon/ketch',
    external: true,
  },
  {
    id: 'promptext',
    name: 'Promptext',
    label: 'GO',
    description: 'Smart code context extractor with relevance scoring.',
    url: '/promptext',
    external: false,
  },
  {
    id: 'termtile',
    name: 'Termtile',
    label: 'GO',
    description: 'X11-native terminal tiling with smart grid layouts.',
    url: '/termtile',
    external: false,
  },
]

const allProjects = [...featured, ...others]

const ghStats = ref<{ lastPush: string } | null>(null)

onMounted(async () => {
  try {
    const res = await fetch('https://api.github.com/users/1broseidon/repos?per_page=100')
    if (!res.ok) return
    const repos = await res.json() as Array<{ pushed_at: string }>
    const lastPush = repos
      .map((r: { pushed_at: string }) => r.pushed_at)
      .sort()
      .pop() ?? ''
    const daysAgo = Math.floor((Date.now() - new Date(lastPush).getTime()) / 86400000)
    ghStats.value = {
      lastPush: daysAgo === 0 ? 'Today' : daysAgo === 1 ? '1 day ago' : `${daysAgo} days ago`,
    }
  } catch { /* silent fail */ }
})
</script>

<template>
  <div class="min-h-screen flex flex-col p-8 md:p-12 bg-bg text-primary max-w-[1400px] mx-auto w-full">
    <!-- Navigation -->
    <nav class="fixed top-0 left-0 w-full z-50 px-8 py-6 flex items-center justify-between bg-bg/80 backdrop-blur-sm border-b border-divider">
      <div class="uppercase tracking-ultra-wide font-bold text-sm">
        CHAIN.SH
      </div>
      <a href="https://github.com/1broseidon" target="_blank" rel="noopener"
         class="text-muted hover:text-primary transition-colors">
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
        </svg>
      </a>
    </nav>

    <!-- Hero -->
    <main class="flex-grow flex flex-col justify-center items-start mt-32 mb-20 fade-up" style="animation-delay: 100ms">
      <div class="relative w-full overflow-visible">
        <h1 class="hero-headline">
          CHAIN
        </h1>
      </div>
      <div class="mt-8 flex flex-col md:flex-row md:items-center gap-6">
        <div class="flex items-center gap-6">
          <div class="h-px w-24 bg-accent"></div>
          <p class="uppercase tracking-[0.3em] text-muted text-sm font-medium">Developer tools for the agent era</p>
        </div>
      </div>
    </main>

    <!-- Projects -->
    <section class="mb-16 fade-up" style="animation-delay: 200ms">
      <div class="flex items-center justify-between mb-12">
        <h2 class="uppercase tracking-[0.4em] text-xs font-bold text-accent">Tools</h2>
        <div class="h-px flex-grow mx-8 bg-divider"></div>
        <span class="text-[11px] uppercase tracking-widest text-muted">{{ String(allProjects.length).padStart(2, '0') }} Projects</span>
      </div>

      <!-- Featured cards -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
        <a v-for="(project, i) in featured" :key="project.id"
           :href="project.url"
           :target="project.external ? '_blank' : undefined"
           :rel="project.external ? 'noopener' : undefined"
           class="group border-matte p-6 hover:bg-accent/5 transition-colors flex flex-col">
          <div class="flex justify-between items-start mb-12">
            <span class="text-[11px] text-accent font-bold">{{ String(i + 1).padStart(3, '0') }}</span>
            <span class="text-[11px] text-muted tracking-tighter">{{ project.label }}</span>
          </div>
          <h3 class="text-xl uppercase font-bold tracking-widest mb-2">{{ project.name }}</h3>
          <p class="text-[11px] text-muted uppercase tracking-widest leading-relaxed mb-6 flex-grow">{{ project.description }}</p>
          <div class="pt-4 border-t border-divider space-y-1 mt-auto">
            <div v-for="meta in project.meta" :key="meta.label"
                 class="flex justify-between text-[11px] uppercase text-muted/60">
              <span>{{ meta.label }}</span>
              <span>{{ meta.value }}</span>
            </div>
          </div>
        </a>
      </div>

      <!-- Other projects — list format -->
      <div class="mt-12">
        <a v-for="(project, i) in others" :key="project.id"
           :href="project.url"
           :target="project.external ? '_blank' : undefined"
           :rel="project.external ? 'noopener' : undefined"
           class="group grid grid-cols-[auto_1fr_auto] md:grid-cols-[auto_minmax(0,200px)_1fr_auto] items-center gap-6 py-5 border-t border-divider list-row transition-colors">
          <span class="text-[11px] text-accent font-bold">{{ String(featured.length + i + 1).padStart(3, '0') }}</span>
          <h3 class="text-sm uppercase font-bold tracking-widest">{{ project.name }}</h3>
          <p class="hidden md:block text-[11px] text-muted uppercase tracking-widest text-right">{{ project.description }}</p>
          <span class="text-[11px] text-muted tracking-tighter text-right">{{ project.label }}</span>
        </a>
      </div>
    </section>

    <!-- Footer -->
    <footer class="w-full mt-auto fade-up" style="animation-delay: 300ms">
      <div class="pt-6 border-t border-divider flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-muted">
        <span>&copy; {{ new Date().getFullYear() }} CHAIN.SH</span>
        <span v-if="ghStats">Last Push: {{ ghStats.lastPush }}</span>
      </div>
    </footer>
  </div>
</template>
