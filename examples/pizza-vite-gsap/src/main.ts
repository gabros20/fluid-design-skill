// Order matters: the stack-agnostic base layer, then the motion layer's
// pre-JS resting states, then the page.
import './styles/fluid/shared/base.css'
// The motion half of the old base.css, from the scroll-animation skill since the split.
import './motion/motion-base.css'
import './motion/motion.css'
import './styles/main.scss'

import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

import { ENGAGE_QUERY, initFluidMotion, type ScrubStageOptions } from './motion'

// Seam points measured on public/video/oven-scrub.mp4 (30 fps, 300 frames),
// which scripts/make-scrub-video.py builds so both loops are periodic by
// construction: frame 0 == frame 60 (head), frame 240 == frame 298 (tail).
const OVEN_SCENE: ScrubStageOptions = {
  fps: 30,
  headLoop: { fromFrame: 1, matchFrame: 61 },
  tailLoop: { fromFrame: 241 }
}

const motion = initFluidMotion(document, {
  headerTheme: { header: '.site-header', base: 'light' },
  scrubStage: (el) => (el.id === 'forno' ? OVEN_SCENE : undefined)
})

// Scaled travel (scroll-animation's fluid-interop.md §3, pattern 1): as the
// hero scrolls away the peel drifts 240 drawn px right and turns 8°. GSAP
// only writes a unitless --scene-p; main.scss turns it into
// `translate: calc(var(--scene-p) * 240 * var(--fluid)) 0`, so the
// distance follows the fluid scale live, through a resize, with no refresh.
// Desktop only (the composition it moves across exists from engageAt up),
// and never under reduced motion.
gsap.registerPlugin(ScrollTrigger)
const mm = gsap.matchMedia()
mm.add(`${ENGAGE_QUERY} and (prefers-reduced-motion: no-preference)`, () => {
  // On the img, not .hero__pizza: see main.scss (GSAP folds translate on
  // any element whose transform it tweens, and the entrance tweens that one).
  gsap.to('.hero__pizza img', {
    '--scene-p': 1,
    ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true }
  })
})

if (import.meta.hot) {
  import.meta.hot.accept(() => {
    motion.destroy()
    mm.revert()
  })
}
