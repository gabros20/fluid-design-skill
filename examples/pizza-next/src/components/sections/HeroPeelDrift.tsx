'use client'

import { m, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'

import { useFluidUnit } from '@/motion/hooks/useFluidUnit'
import { ENGAGE_QUERY } from '@/motion/lib/constants'

/**
 * Scaled travel (scroll-animation's fluid-interop.md §3, pattern 3): as the
 * hero scrolls away the peel drifts 240 drawn px right and turns 8°. The
 * distance is progress × 240 × the live --fluid unit, so it is the same
 * fraction of the composition at 1440×900 and 2560×1440, and re-scales on
 * resize without a remount. It sits on its own wrapper so the StageItem
 * entrance keeps sole ownership of the outer element's transform.
 *
 * Desktop only (below engageAt the unit is 1px and the layout stacks), and
 * off under reduced motion: a style-bound MotionValue is not an animation, so
 * MotionConfig's reducedMotion="user" would not stop it by itself.
 */
export function HeroPeelDrift({ sectionId, children }: { sectionId: string; children: ReactNode }) {
  // Hero is a server component, so the section arrives by id. A layout
  // effect declared before useScroll fills the ref before useScroll reads it.
  const section = useRef<HTMLElement | null>(null)
  useLayoutEffect(() => {
    section.current = document.getElementById(sectionId)
  }, [sectionId])

  const reduced = useReducedMotion()
  const [desktop, setDesktop] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(ENGAGE_QUERY)
    const on = () => setDesktop(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  const { scrollYProgress } = useScroll({ target: section, offset: ['start start', 'end start'] })
  const f = useFluidUnit()
  const x = useTransform(() => scrollYProgress.get() * 240 * f.get())
  const rotate = useTransform(() => scrollYProgress.get() * 8)

  const active = desktop && !reduced
  return (
    <m.div className="size-full" style={active ? { x, rotate } : undefined}>
      {children}
    </m.div>
  )
}
