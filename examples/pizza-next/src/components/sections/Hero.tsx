import Image from 'next/image'

import { cn } from '@/styles/fluid/cn'
import { Stage, StageItem } from '@/motion/components/Stage'

import { HeroPeelDrift } from './HeroPeelDrift'

import heroPeel from '../../../public/images/hero-pizza-peel.png'

/**
 * Hero — drawn at the reference height (900), so `lg:fluid-h-900`: exactly one
 * screen whenever height binds, never taller than the window. Mobile keeps an
 * svh floor and cancels it from lg (`lg:min-h-0`), per section-recipe §3.
 *
 * The arc is a CSS circle whose centre sits on the section's bottom edge, sized
 * in fluid units so it scales with the drawing. The widest row is
 * 250 + 40 + 700 + 40 + 250 = 1280, exactly the content budget at 1440
 * (`calc.mjs budget` PASS, 0px margin).
 */
export function Hero() {
  return (
    <section
      id="top"
      data-fit="screen"
      className="relative w-full overflow-clip bg-surface-page min-h-[max(640px,100svh)] lg:min-h-0 lg:fluid-h-900"
    >
      {/* The half-disc: diameter 1100, centre on the baseline. */}
      <div
        aria-hidden="true"
        className="absolute bottom-[calc(-190*var(--fluid))] left-1/2 fluid-size-380 -translate-x-1/2 rounded-full bg-surface-arc lg:fluid-size-1100 lg:bottom-[calc(-550*var(--fluid))]"
      />

      <Stage
        trigger="mount"
        className={cn(
          'fluid-container',
          'relative flex min-h-[max(640px,100svh)] flex-col pt-[calc(var(--fluid-header-h)+40*var(--fluid))] fluid-pb-32',
          'lg:fluid-pb-40 lg:h-full lg:min-h-0 lg:pt-[calc(var(--fluid-header-h)+70*var(--fluid))]'
        )}
      >
        <div className="flex flex-col items-center text-center">
          <StageItem
            variant="settle"
            className="[--hero-settle:-16px] lg:[--hero-settle:-24px]"
          >
            <p className="fluid-copy-11 font-medium tracking-[0.24em] text-text-accent-ink uppercase lg:fluid-copy-12/16">
              Pinsa romana · since 2019
            </p>
          </StageItem>
          <h1 className="fluid-mt-16 font-display fluid-display-44 leading-[1.02] font-light tracking-[-0.025em] text-text-heading lg:fluid-mt-20 lg:fluid-display-112/112">
            <StageItem as="span" variant="liftFade" className="block [--hero-lift:32px] lg:[--hero-lift:48px]">
              The airy bread
            </StageItem>
            <StageItem
              as="span"
              variant="liftFade"
              delay={0.067}
              className="block [--hero-lift:32px] lg:[--hero-lift:48px]"
            >
              of ancient Rome
            </StageItem>
          </h1>
        </div>

        <div className="relative fluid-mt-32 grid grid-cols-1 fluid-gap-24 lg:flex-1 lg:items-end lg:fluid-mt-0 lg:grid-cols-[250fr_780fr_250fr] lg:fluid-gap-40">
          <StageItem
            variant="liftFade"
            delay={0.2}
            className="order-2 max-w-[420px] self-center [--hero-lift:24px] lg:order-none lg:max-w-none lg:fluid-pb-120"
          >
            <p className="fluid-copy-15 leading-[1.6] lg:fluid-copy-15/24">
              Pinsa is the lighter cousin of pizza: a blend of wheat, rice and soy flour,
              fermented for 72 hours and stretched by hand into an oval.
            </p>
          </StageItem>

          <StageItem
            variant="lift"
            delay={0.1}
            className="relative order-1 [--hero-lift:40px] lg:order-none lg:fluid-h-560 lg:mt-[calc(-80*var(--fluid))]"
          >
            <HeroPeelDrift sectionId="top">
              <Image
                src={heroPeel}
                alt="A pinsa margherita on a wooden peel, seen from above"
                priority
                sizes="(min-width: 1024px) 56vw, 100vw"
                className="mx-auto h-auto w-full max-w-[560px] object-contain object-bottom lg:size-full lg:max-w-none"
              />
            </HeroPeelDrift>
          </StageItem>

          <StageItem
            variant="liftFade"
            delay={0.267}
            className="order-3 max-w-[420px] self-center [--hero-lift:24px] lg:order-none lg:max-w-none lg:fluid-pb-120"
          >
            <p className="fluid-copy-15 leading-[1.6] lg:fluid-copy-15/24">
              Baked at 450°C on stone, crisp outside and soft within. Topped simply, with
              produce from the Alsace markets and the south of Italy.
            </p>
          </StageItem>
        </div>
      </Stage>

      {/* The vertical reservation pill on the right edge. Desktop only: below lg the
          reservation CTA at the foot of the page carries the job. */}
      <a
        href="#reserve"
        className="absolute top-1/2 right-0 hidden -translate-y-1/2 items-center justify-center rounded-l-full bg-surface-action text-text-on-action lg:flex lg:fluid-w-56 lg:fluid-h-220"
      >
        <span className="font-medium tracking-[0.18em] uppercase [writing-mode:vertical-rl] lg:fluid-copy-12/16">
          Réservation
        </span>
      </a>
    </section>
  )
}
