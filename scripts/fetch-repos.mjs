/* Refreshes src/repos.json (stars + release counts) from the GitHub API at
 * build time. Never fails the build: on any error the committed counts stand.
 * Keep build metadata current without making a network outage block the site. */

import { readFile, writeFile } from 'node:fs/promises'

const OUT = new URL('../src/repos.json', import.meta.url)
const current = JSON.parse(await readFile(OUT, 'utf8'))
const TOOLS = Object.keys(current)

const headers = {
  accept: 'application/vnd.github+json',
  ...(process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
}
const get = (path) =>
  fetch(`https://api.github.com${path}`, { headers, signal: AbortSignal.timeout(10_000) }).then(
    (res) => (res.ok ? res.json() : Promise.reject(new Error(`GitHub API ${res.status} on ${path}`))),
  )

try {
  const next = structuredClone(current)
  await Promise.all(
    TOOLS.map(async (id) => {
      const [repo, releases] = await Promise.all([
        get(`/repos/1broseidon/${id}`),
        get(`/repos/1broseidon/${id}/releases?per_page=100`),
      ])
      if (typeof repo.stargazers_count === 'number') next[id].stars = repo.stargazers_count
      if (Array.isArray(releases)) next[id].releases = releases.length
    }),
  )
  await writeFile(OUT, `${JSON.stringify(next, null, 2)}\n`)
  console.log('repos: refreshed', TOOLS.map((id) => `${id}=${next[id].stars}★/${next[id].releases}rel`).join(' '))
} catch (err) {
  console.warn(`repos: keeping committed counts (${err.message})`)
}
