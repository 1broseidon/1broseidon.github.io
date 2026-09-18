/* Refreshes src/stars.json from the GitHub API at build time.
 * Never fails the build: on any error the committed counts stand. */

import { readFile, writeFile } from 'node:fs/promises'

const OUT = new URL('../src/stars.json', import.meta.url)
const TOOLS = ['ketch', 'cymbal', 'hotline', 'brainfile', 'prism', 'recoil', 'skills']

try {
  const res = await fetch(
    'https://api.github.com/users/1broseidon/repos?per_page=100',
    {
      headers: {
        accept: 'application/vnd.github+json',
        ...(process.env.GITHUB_TOKEN
          ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
          : {}),
      },
      signal: AbortSignal.timeout(10_000),
    },
  )
  if (!res.ok) throw new Error(`GitHub API ${res.status}`)

  const repos = await res.json()
  const live = new Map(repos.map((r) => [r.name, r.stargazers_count]))

  const current = JSON.parse(await readFile(OUT, 'utf8'))
  const next = { ...current }
  for (const id of TOOLS) {
    if (typeof live.get(id) === 'number') next[id] = live.get(id)
  }

  await writeFile(OUT, `${JSON.stringify(next, null, 2)}\n`)
  console.log('stars: refreshed', TOOLS.map((id) => `${id}=${next[id]}`).join(' '))
} catch (err) {
  console.warn(`stars: keeping committed counts (${err.message})`)
}
