/* chain.sh on Cloudflare Workers.
 *
 * The hub itself is static assets — this Worker exists for one job: keeping the
 * per-project sub-paths (chain.sh/cymbal/, chain.sh/promptext/, …) alive. Those
 * are separate GitHub Pages sites that have been served under this domain for
 * years, and the URLs are already in the wild.
 *
 * IMPORTANT — the custom domain must be removed from the 1broseidon.github.io
 * Pages settings before this proxy works. While chain.sh is set as the custom
 * domain, GitHub 301s 1broseidon.github.io/<name>/ back to chain.sh/<name>/,
 * which is this Worker: an infinite loop. We detect that case and return a
 * diagnosable 502 rather than melting.
 */

const PROJECTS = new Set([
  'cymbal',
  'promptext',
  'oneagent',
  'termtile',
  'moxie',
  'rmkbl',
])

const DEFAULT_ORIGIN = 'https://1broseidon.github.io'

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    const segment = url.pathname.split('/')[1]

    if (!PROJECTS.has(segment)) {
      return env.ASSETS.fetch(request)
    }

    return proxyProject(request, url, env, ctx)
  },
}

async function proxyProject(request, url, env, ctx) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: { allow: 'GET, HEAD' },
    })
  }

  const origin = env.PROJECT_ORIGIN || DEFAULT_ORIGIN
  const upstream = new URL(url.pathname + url.search, origin)

  const cache = caches.default
  const cacheKey = new Request(upstream.toString(), { method: 'GET' })
  const hit = await cache.match(cacheKey)
  if (hit) return hit

  let res
  try {
    res = await fetch(upstream, {
      method: request.method,
      headers: { accept: request.headers.get('accept') ?? '*/*' },
      redirect: 'manual',
    })
  } catch (err) {
    return new Response(`Upstream fetch failed: ${err.message}\n`, {
      status: 502,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    })
  }

  // The loop guard: upstream bouncing us back to our own host means the custom
  // domain is still set on the GitHub user site.
  if (res.status >= 300 && res.status < 400) {
    const location = res.headers.get('location')
    if (location) {
      let target
      try {
        target = new URL(location, upstream)
      } catch {
        target = null
      }
      if (target && target.hostname === url.hostname) {
        return new Response(
          'Upstream redirected back to this host — remove the chain.sh custom ' +
            'domain from the 1broseidon.github.io Pages settings so project ' +
            'pages resolve directly.\n',
          { status: 502, headers: { 'content-type': 'text/plain; charset=utf-8' } },
        )
      }
    }
  }

  const out = new Response(res.body, res)
  out.headers.set('cache-control', 'public, max-age=300')
  out.headers.delete('set-cookie')

  if (res.ok && request.method === 'GET') {
    ctx.waitUntil(cache.put(cacheKey, out.clone()))
  }

  return out
}
