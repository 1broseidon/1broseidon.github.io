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
  const needle = orbit.querySelector('.orbit-needle')
  const reduced = matchMedia('(prefers-reduced-motion: reduce)')

  // Each label is paired with its station, leader and ping once, up front. The
  // angles arrive with the markup from build.mjs, so the needle and the drawing
  // share one geometry.
  const part = (attr) => nodes.map((node) => orbit.querySelector(`[${attr}="${node.dataset.orbitTool}"]`))
  const stations = part('data-station')
  const leaders = part('data-leader')
  const pings = part('data-ping')
  const angles = nodes.map((node) => Number(node.dataset.angle))

  // One need plays out in three moves: the needle sweeps to the tool, a signal
  // runs out along it, and the signal comes home. The moves themselves are CSS
  // transitions; this clock only decides which one is due.
  const stepDuration = 5600   // one need, then the next
  const outDuration = 450     // hub to station
  const backDuration = 450    // and the same again home
  // A quarter turn takes about two thirds of a second and a half turn about
  // one, so the needle moves at the same pace whatever the distance.
  const sweepFor = (deg) => (deg === 0 ? 0 : 320 + Math.abs(deg) * 3.8)

  let active = 0
  let angle = angles[0]                        // where the needle points; it accumulates, so auto-play keeps turning one way
  let sweep = 0                                // this need's sweep, in ms
  let elapsed = outDuration + backDuration     // ms since the need was chosen; starts at rest, until woken
  let answered = true                          // whether the readout shows this need's answer; the first ships written
  let engaged = -1                             // the station that is lit
  let playing = !reduced.matches
  let visible = false                          // until the observer reports the instrument on screen
  let woken = false
  let hovered = false
  let frame = null
  let previousTime = null

  const flight = () => sweep + outDuration + backDuration
  // Needs advance only while playing and unheld. A move already under way
  // completes regardless, so a click or a pause never strands the signal
  // between the hub and the tool.
  const running = () => playing && !hovered
  const flying = () => !reduced.matches && elapsed < flight()
  const awake = () => visible && !document.hidden && (running() || flying())

  // Lights one station, its leader and its label; -1 lights none.
  const engage = (index) => {
    if (engaged === index) return
    engaged = index
    stations.forEach((station, i) => station.classList.toggle('is-engaged', i === index))
    leaders.forEach((leader, i) => leader.classList.toggle('is-engaged', i === index))
    nodes.forEach((node, i) => node.classList.toggle('is-engaged', i === index))
  }
  pings.forEach((ping) => ping.addEventListener('animationend', () => ping.classList.remove('is-pinging')))

  const draw = () => {
    const t = reduced.matches ? Infinity : elapsed
    const phase = t < sweep ? 'sweep' : t < sweep + outDuration ? 'out' : t < flight() ? 'landed' : 'home'
    if (orbit.dataset.phase !== phase) {
      orbit.dataset.phase = phase
      if (phase === 'landed' && !reduced.matches) pings[active].classList.add('is-pinging')
    }
    // The tool answers the moment the signal lands; the hub acknowledges once
    // it is home. Under reduced motion both are true at once.
    if (phase === 'landed' || phase === 'home') {
      engage(active)
      if (!answered) {
        const chosen = nodes[active]
        response.textContent = chosen.dataset.response
        link.textContent = chosen.dataset.orbitTool
        link.href = `#${chosen.dataset.orbitTool}`
        if (spec) spec.textContent = chosen.dataset.spec
        answered = true
      }
    }
    if (orbit.dataset.answered !== String(answered)) orbit.dataset.answered = String(answered)
  }

  const select = (index, byUser = false) => {
    let delta = (((angles[index] - angle) % 360) + 360) % 360   // clockwise by default
    if (byUser && delta > 180) delta -= 360                       // a click takes the short way round
    if (index !== active) { answered = false; engage(-1) }        // asking the same tool again only sends the signal again
    active = index
    angle += delta
    sweep = sweepFor(delta)
    elapsed = 0
    needle.style.setProperty('--sweep', `${sweep}ms`)
    needle.style.setProperty('--angle', `${angle}deg`)
    nodes.forEach((node, i) => {
      node.classList.toggle('is-selected', i === index)
      node.setAttribute('aria-pressed', String(i === index))
    })
    const chosen = nodes[index]
    need.textContent = chosen.dataset.need
    if (byUser) {
      announcement.textContent = `When the agent needs ${chosen.dataset.need}, ${chosen.dataset.orbitTool} ${chosen.dataset.response}`
    }
    draw()
    sync()
  }

  const tick = (time) => {
    frame = null
    if (!awake()) { previousTime = null; return }
    const delta = previousTime === null ? 0 : Math.min(time - previousTime, 80)
    previousTime = time
    if (running()) {
      elapsed += delta
      if (elapsed >= stepDuration) { select((active + 1) % nodes.length); return }
    } else {
      // Held or paused: only the move already under way completes.
      elapsed = Math.min(elapsed + delta, flight())
    }
    draw()
    frame = requestAnimationFrame(tick)
  }

  const sync = () => {
    if (!awake()) {
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

  // The first need ships drawn: needle on the tool, station lit, answer written.
  // Waking sends one signal out to it and home, rather than clearing the readout
  // to write the same answer again.
  const wake = () => {
    woken = true
    elapsed = 0
    draw()
    sync()
  }

  nodes.forEach((node, index) => {
    node.disabled = false
    // Pointing at a label warms its leader and station, so the pairing reads before the click.
    const hot = (on) => {
      leaders[index].classList.toggle('is-hot', on)
      stations[index].classList.toggle('is-hot', on)
    }
    node.addEventListener('pointerenter', () => hot(true))
    node.addEventListener('pointerleave', () => hot(false))
    node.addEventListener('focus', () => { hot(true); setPlaying(false) })
    node.addEventListener('blur', () => hot(false))
    node.addEventListener('click', () => {
      setPlaying(false)
      select(index, true)
    })
  })
  control.hidden = false
  control.addEventListener('click', () => setPlaying(!playing))

  // Hold the instrument while a pointer is choosing a tool, or the scene is unseen.
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
      if (visible && !woken) wake()
      sync()
    }, { threshold: [0, .25] })
    observer.observe(orbit)
  } else {
    visible = true
    wake()
  }
  reduced.addEventListener('change', () => {
    if (reduced.matches) setPlaying(false)
    draw()
  })

  setPlaying(playing)
})();

// Setup chooser and clipboard actions.
(() => {
  const picker = document.querySelector('#tool-picker')
  const panels = [...document.querySelectorAll('.panel')]
  if (picker && panels.length) {
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
  }

  // Every copy button names its source by id: a hidden textarea holding a setup
  // prompt, or the visible bootstrap command. Its confirmation and status live
  // in the nearest [data-copy-scope].
  document.querySelectorAll('[data-copy]').forEach((button) => {
    const scope = button.closest('[data-copy-scope]')
    const status = scope.querySelector('.copy-status')
    const hint = scope.querySelector('.panel-hint')
    const source = document.getElementById(button.dataset.copy)
    const isField = source instanceof HTMLTextAreaElement
    button.hidden = false
    if (hint) hint.textContent = 'Paste the setup prompt into your agent’s chat.'

    button.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(isField ? source.value : source.textContent)
        if (isField) source.hidden = true
        status.textContent = button.dataset.copied
      } catch {
        /* Clipboard blocked — put the text in front of the reader instead. */
        if (isField) {
          source.hidden = false
          source.focus()
          source.select()
        } else {
          getSelection().selectAllChildren(source)
        }
        status.textContent = 'Select and copy the text above.'
      }
    })
  })
})();
