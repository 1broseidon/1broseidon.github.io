/* Links, panels and the diagram all work without JavaScript. This only upgrades
 * the chooser from "all three panels visible" to "pick one", adds clipboard
 * copy, and fades section heads in as they enter the viewport. */
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  const revealable = [...document.querySelectorAll('.reveal')]

  if (reduced || !('IntersectionObserver' in window)) {
    revealable.forEach((el) => el.classList.add('is-in'))
  } else {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry, i) => {
          if (!entry.isIntersecting) return
          setTimeout(() => entry.target.classList.add('is-in'), i * 60)
          observer.unobserve(entry.target)
        })
      },
      { rootMargin: '0px 0px -12% 0px' },
    )
    revealable.forEach((el) => observer.observe(el))
  }

  const chip = document.querySelector('.chip')
  if (chip) {
    let last = window.scrollY
    addEventListener(
      'scroll',
      () => {
        const y = window.scrollY
        chip.classList.toggle('is-tucked', y > 240 && y > last + 4)
        if (Math.abs(y - last) > 4) last = y
      },
      { passive: true },
    )
  }

  const picker = document.querySelector('#tool-picker')
  const panels = [...document.querySelectorAll('.panel')]
  if (!picker || !panels.length) return

  const show = () => {
    panels.forEach((panel) => {
      const active = panel.id === `setup-${picker.value}`
      panel.hidden = !active
      panel.classList.toggle('is-active', active)
      panel.querySelector('.copy-status').textContent = ''
    })
  }

  document.querySelector('.picker-control').hidden = false
  picker.addEventListener('change', show)
  show()

  document.querySelectorAll('[data-copy]').forEach((button) => {
    button.hidden = false
    button.closest('.panel').querySelector('.panel-hint').textContent =
      'follow the guide, or hand the setup prompt to your agent.'

    button.addEventListener('click', async () => {
      const prompt = document.getElementById(button.dataset.copy)
      const status = button.closest('.panel').querySelector('.copy-status')
      try {
        await navigator.clipboard.writeText(prompt.value)
        status.textContent = 'copied. paste it into your agent’s chat.'
        button.dataset.copied = '1'
        setTimeout(() => delete button.dataset.copied, 1600)
      } catch {
        /* Clipboard blocked — reveal the textarea so the text is still gettable. */
        prompt.hidden = false
        prompt.focus()
        prompt.select()
        status.textContent = 'select and copy the prompt above.'
      }
    })
  })
})()
