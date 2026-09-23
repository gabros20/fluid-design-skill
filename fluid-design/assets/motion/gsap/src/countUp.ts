import gsap from 'gsap'

import { EASE_NAMES, registerEases } from './eases'

/**
 * `[data-count-up="<value>"]` — a number that counts up when it first
 * reaches the viewport. Port of `CountUp`.
 *
 * TRIGGERED, like the rest of the entrance system, and deliberately its own
 * mechanism rather than a `[data-stage-item]`: a stage variant animates
 * *style*, this animates *text*.
 *
 * ## Why it writes `textContent` instead of anything reactive
 *
 * The whole point of doing this outside a framework's render loop is that a
 * frame of counting costs nothing but a string write on one node — there is
 * no state to update and no re-render to schedule.
 *
 * The static HTML must already hold the FINAL value in `data-count-up`
 * (and, ideally, as the element's own text, for crawlers and no-JS
 * visitors). This module only ever rewinds the node to "0" once the
 * animation is about to run, on the client — never before.
 */
export interface CountUpOptions {
  /** Seconds. Long enough to read as counting, short enough not to hold the eye. */
  duration?: number
  /** Fraction of the element that must be visible before it starts. */
  amount?: number
}

export interface CountUpController {
  destroy(): void
}

export function initCountUps(root: ParentNode = document, options: CountUpOptions = {}): CountUpController {
  registerEases()
  const duration = options.duration ?? 1.2
  const amount = options.amount ?? 0.6
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const els = Array.from(root.querySelectorAll<HTMLElement>('[data-count-up]'))
  const observers: IntersectionObserver[] = []
  const tweens: gsap.core.Tween[] = []

  for (const el of els) {
    const value = Number.parseFloat(el.dataset.countUp ?? '')
    if (!Number.isFinite(value)) continue

    const run = () => {
      if (reduced) {
        // Reduced motion gets the figure, not the performance — withholding
        // it would be a content change, not a motion one.
        el.textContent = String(value)
        return
      }
      const counter = { n: 0 }
      el.textContent = '0'
      tweens.push(
        gsap.to(counter, {
          n: value,
          duration,
          ease: EASE_NAMES.entrance, // the same curve as the page-load move
          onUpdate: () => {
            el.textContent = String(Math.round(counter.n))
          }
        })
      )
    }

    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (!entry?.isIntersecting) return
        run()
        io.disconnect()
      },
      { threshold: amount }
    )
    io.observe(el)
    observers.push(io)
  }

  return {
    destroy() {
      observers.forEach((io) => io.disconnect())
      tweens.forEach((t) => t.kill())
    }
  }
}
