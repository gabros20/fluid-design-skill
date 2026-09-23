// Order matters: the stack-agnostic base layer, then the motion layer's
// pre-JS resting states, then the page.
import './styles/fluid/shared/base.css'
// The motion half of the old base.css, from the scroll-animation skill since the split.
import './motion/motion-base.css'
import './motion/motion.css'
import './styles/main.scss'

import { initFluidMotion, type ScrubStageOptions } from './motion'

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

if (import.meta.hot) {
  import.meta.hot.accept(() => motion.destroy())
}
