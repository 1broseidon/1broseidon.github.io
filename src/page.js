/* The page and captured examples work without JavaScript.
 * The orbit illustrates possible tool use; it does not replay the CLI capture. */
(() => {
  const orbit = document.querySelector('.orbit')
  if (!orbit) return

  const stage = orbit.querySelector('.orbit-stage')
  const nodes = [...orbit.querySelectorAll('[data-orbit-tool]')]
  const control = orbit.querySelector('.orbit-playback')
  const need = orbit.querySelector('.orbit-need')
  const response = orbit.querySelector('.orbit-response span')
  const link = orbit.querySelector('.orbit-response a')
  const spec = orbit.querySelector('.orbit-spec')
  const announcement = orbit.querySelector('.orbit-announcement')
  const reach = orbit.querySelector('.orbit-reach')
  const signal = orbit.querySelector('.orbit-signal')
  const reduced = matchMedia('(prefers-reduced-motion: reduce)')

  // Geometry is read from the stage, so build.mjs stays its single source and
  // the animation cannot drift away from the server-rendered first frame.
  const g = stage.dataset
  const [cx, cy, rx, ry, start, boxW, boxH] =
    ['cx', 'cy', 'rx', 'ry', 'start', 'w', 'h'].map((key) => Number(g[key]))
  const spacing = 360 / nodes.length

  // How far the labels stand off the ring. build.mjs sets the default inline;
  // a media query can pull them closer on narrow screens, so it is read back
  // from the cascade rather than hard-coded here.
  let labelK = Number(g.label)
  const readLabelK = () => {
    const value = parseFloat(getComputedStyle(stage).getPropertyValue('--label-k'))
    if (!Number.isNaN(value)) labelK = value
  }

  // Each label is paired with its dot on the ring once, up front.
  const marks = nodes.map((node) => orbit.querySelector(`[data-dot="${node.dataset.orbitTool}"]`))

  const at = (deg, k = 1) => {
    const rad = (deg * Math.PI) / 180
    return { x: cx + rx * k * Math.cos(rad), y: cy + ry * k * Math.sin(rad), rad }
  }

  const stepDuration = 5200
  const orbitDuration = 160000
  const travel = 950
  let active = 0
  let rotation = 0
  let elapsed = 0
  let playing = !reduced.matches
  let visible = true
  let hovered = false
  let frame = null
  let previousTime = null

  const draw = () => {
    let target
    nodes.forEach((node, index) => {
      const deg = start + spacing * index + rotation
      const dot = at(deg)
      const label = at(deg, labelK)
      // 0 at the back of the ring, 1 at the front — drives scale and weight.
      const depth = ((Math.sin(dot.rad) + 1) / 2).toFixed(3)

      node.style.left = `${(label.x / boxW) * 100}%`
      node.style.top = `${(label.y / boxH) * 100}%`
      node.style.setProperty('--depth', depth)

      const mark = marks[index]
      if (mark) {
        mark.setAttribute('cx', dot.x.toFixed(2))
        mark.setAttribute('cy', dot.y.toFixed(2))
        mark.style.setProperty('--depth', depth)
      }
      if (index === active) target = dot
    })

    reach.setAttribute('d', `M${cx} ${cy}L${target.x.toFixed(2)} ${target.y.toFixed(2)}`)

    // One signal travels to the chosen tool and returns before the next need.
    const phase = elapsed / travel
    const progress = phase <= 1 ? phase : Math.max(0, 2 - phase)
    signal.setAttribute('cx', (cx + (target.x - cx) * progress).toFixed(2))
    signal.setAttribute('cy', (cy + (target.y - cy) * progress).toFixed(2))
    signal.style.opacity = !reduced.matches && phase < 2 ? '1' : '0'
    // The dot acknowledges the signal the moment it lands.
    orbit.dataset.landed = String(reduced.matches || phase >= 1)
  }

  const select = (index, announce = false) => {
    active = index
    elapsed = 0
    const chosen = nodes[index]
    nodes.forEach((node, i) => {
      node.classList.toggle('is-selected', i === index)
      node.setAttribute('aria-pressed', String(i === index))
      if (marks[i]) marks[i].classList.toggle('is-selected', i === index)
    })
    need.textContent = chosen.dataset.need
    response.textContent = chosen.dataset.response
    link.textContent = chosen.dataset.orbitTool
    link.href = `#${chosen.dataset.orbitTool}`
    if (spec) spec.textContent = chosen.dataset.spec
    if (announce) {
      announcement.textContent = `When the agent needs ${chosen.dataset.need}, ${chosen.dataset.orbitTool} ${chosen.dataset.response}`
    }
    draw()
  }

  const canRun = () => playing && visible && !hovered && !document.hidden

  const tick = (time) => {
    frame = null
    if (!canRun()) { previousTime = null; return }
    if (previousTime !== null) {
      const delta = Math.min(time - previousTime, 80)
      if (!reduced.matches) rotation = (rotation + (delta / orbitDuration) * 360) % 360
      elapsed += delta
      if (elapsed >= stepDuration) select((active + 1) % nodes.length)
    }
    previousTime = time
    draw()
    frame = requestAnimationFrame(tick)
  }

  const sync = () => {
    if (!canRun()) {
      if (frame !== null) cancelAnimationFrame(frame)
      frame = null
      previousTime = null
    } else if (frame === null) {
      frame = requestAnimationFrame(tick)
    }
  }

  const setPlaying = (next) => {
    playing = next
    orbit.dataset.paused = String(!playing)
    control.querySelector('span').textContent = playing ? 'Pause' : 'Play'
    control.setAttribute('aria-label', playing ? 'Pause the orbit animation' : 'Play the tool examples')
    sync()
  }

  nodes.forEach((node, index) => {
    node.disabled = false
    node.addEventListener('focus', () => setPlaying(false))
    node.addEventListener('click', () => {
      setPlaying(false)
      select(index, true)
    })
  })
  control.hidden = false
  control.addEventListener('click', () => setPlaying(!playing))

  // Hold the orbit while a pointer is choosing a tool, or the scene is unseen.
  stage.addEventListener('pointerenter', (event) => {
    if (event.pointerType !== 'mouse') return
    hovered = true
    sync()
  })
  stage.addEventListener('pointerleave', () => { hovered = false; sync() })
  document.addEventListener('visibilitychange', sync)
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting && entry.intersectionRatio >= .25
      sync()
    }, { threshold: [0, .25] })
    observer.observe(orbit)
  }
  reduced.addEventListener('change', () => {
    if (reduced.matches) setPlaying(false)
    draw()
  })

  readLabelK()
  addEventListener('resize', () => { readLabelK(); draw() }, { passive: true })

  select(0)
  setPlaying(playing)
})();

// Setup chooser and clipboard action.
(() => {
  const picker = document.querySelector('#tool-picker')
  const panels = [...document.querySelectorAll('.panel')]
  if (!picker || !panels.length) return

  const show = () => {
    panels.forEach((panel) => {
      const active = panel.id === `setup-${picker.value}`
      panel.hidden = !active
      panel.querySelector('.copy-status').textContent = ''
    })
  }

  document.querySelector('.picker-control').hidden = false
  picker.addEventListener('change', show)
  show()

  document.querySelectorAll('[data-copy]').forEach((button) => {
    button.hidden = false
    button.closest('.panel').querySelector('.panel-hint').textContent =
      'Paste the setup prompt into your agent’s chat.'

    button.addEventListener('click', async () => {
      const prompt = document.getElementById(button.dataset.copy)
      const status = button.closest('.panel').querySelector('.copy-status')
      try {
        await navigator.clipboard.writeText(prompt.value)
        prompt.hidden = true
        status.textContent = 'Copied. Ready to paste into your agent’s chat.'
      } catch {
        /* Clipboard blocked — reveal the textarea so the text is still gettable. */
        prompt.hidden = false
        prompt.focus()
        prompt.select()
        status.textContent = 'Select and copy the prompt above.'
      }
    })
  })
})();
