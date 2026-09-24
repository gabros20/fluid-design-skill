import Image from 'next/image'

import { FRAME } from '@/lib/frame'
import { cn } from '@/lib/cn'
import { CountUp } from '@/motion/components/CountUp'
import { Stage, StageItem } from '@/motion/components/Stage'

import basil from '../../../public/images/ing-basil.png'
import scoop from '../../../public/images/ing-flour-scoop.png'
import tomatoes from '../../../public/images/ing-tomatoes.png'

const STATS = [
  { value: 72, unit: 'h', label: 'Cold fermentation before a pinsa meets the oven' },
  { value: 3, unit: '', label: 'Flours in the blend: wheat, rice and soy' },
  { value: 450, unit: '°C', label: 'Stone temperature, held all service long' },
  { value: 80, unit: '%', label: 'Hydration, for an open, airy crumb' }
]

/**
 * A stat row in a box that SCALES (`lg:fluid-w-1280`), so its type spends the
 * base unit (`fluid-text-*`). On a damped display unit a value inside a box on
 * the steeper curve outgrows its cell and re-wraps on a short window
 * (typography.md, the container rule).
 *
 * The ingredient cut-outs are positioned decorations drawn at fixed
 * coordinates inside the composition, so their offsets and sizes are on the
 * scale too (`fluid-top-*`, `fluid-w-*`); a frozen decoration drifts off its
 * spot as the frame grows. Negative offsets go inside an arbitrary value.
 */
export function CraftNumbers() {
  return (
    <section className="relative w-full overflow-clip bg-surface-sand">
      <div className={cn(FRAME, 'relative fluid-pt-96 fluid-pb-160 lg:fluid-pt-160 lg:fluid-pb-240')}>
        {/* Decorations: behind the copy, never read by assistive tech. */}
        <Image
          src={scoop}
          alt=""
          aria-hidden="true"
          sizes="(min-width: 1024px) 24vw, 40vw"
          className="pointer-events-none absolute fluid-top-32 right-[calc(-40*var(--fluid))] h-auto fluid-w-180 rotate-[-8deg] lg:fluid-top-60 lg:right-[calc(-20*var(--fluid))] lg:fluid-w-380"
        />
        <Image
          src={basil}
          alt=""
          aria-hidden="true"
          sizes="(min-width: 1024px) 16vw, 30vw"
          className="pointer-events-none absolute bottom-[calc(-10*var(--fluid))] left-[calc(-30*var(--fluid))] hidden h-auto fluid-w-150 rotate-[18deg] sm:block lg:bottom-[calc(-20*var(--fluid))] lg:left-[calc(-50*var(--fluid))] lg:fluid-w-220"
        />
        <Image
          src={tomatoes}
          alt=""
          aria-hidden="true"
          sizes="(min-width: 1024px) 18vw, 30vw"
          className="pointer-events-none absolute fluid-right-24 bottom-[calc(-20*var(--fluid))] h-auto fluid-w-140 rotate-[-6deg] lg:bottom-[calc(-30*var(--fluid))] lg:fluid-right-120 lg:fluid-w-230"
        />

        <Stage trigger="view" className="relative z-10 max-w-[640px] lg:fluid-cap-640">
          <StageItem variant="liftFade" className="[--hero-lift:16px] lg:[--hero-lift:24px]">
            <p className="fluid-copy-11 font-medium tracking-[0.24em] text-text-accent-ink uppercase lg:fluid-copy-12/16">
              The craft
            </p>
          </StageItem>
          <h2 className="fluid-mt-16 font-display fluid-display-40 leading-[1.05] font-light tracking-[-0.02em] text-text-heading lg:fluid-mt-20 lg:fluid-display-80/84">
            <StageItem as="span" variant="liftFade" delay={0.067} className="block [--hero-lift:32px]">
              Four numbers
            </StageItem>
            <StageItem as="span" variant="liftFade" delay={0.134} className="block [--hero-lift:32px]">
              we never change
            </StageItem>
          </h2>
        </Stage>

        <Stage
          as="ul"
          trigger="view"
          className="relative z-10 fluid-mt-56 grid grid-cols-2 fluid-gap-x-24 fluid-gap-y-40 lg:mx-auto lg:fluid-mt-120 lg:fluid-w-1280 lg:grid-cols-4 lg:fluid-gap-x-40"
        >
          {STATS.map((s, i) => (
            <StageItem
              key={s.label}
              as="li"
              variant="liftFade"
              delay={i * 0.06}
              className="border-t border-border-strong fluid-pt-20 [--hero-lift:24px] lg:fluid-pt-24"
            >
              <p className="font-display fluid-display-64 leading-none font-light tracking-[-0.03em] text-text-heading tabular-nums lg:fluid-text-112/112">
                <CountUp value={s.value} />
                {s.unit && (
                  <span className="fluid-ml-4 align-top fluid-copy-24 tracking-normal lg:fluid-ml-6 lg:fluid-text-36/48">
                    {s.unit}
                  </span>
                )}
              </p>
              <p className="fluid-mt-16 max-w-[240px] fluid-copy-14 leading-[1.5] lg:fluid-mt-16 lg:max-w-none lg:fluid-text-16/24">
                {s.label}
              </p>
            </StageItem>
          ))}
        </Stage>
      </div>
    </section>
  )
}
