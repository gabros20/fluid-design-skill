import Image from 'next/image'
import type { ReactNode } from 'react'

import { FRAME } from '@/lib/frame'
import { cn } from '@/lib/cn'
import { InViewLoopVideo } from '@/motion/components/InViewLoopVideo'
import { Stage, StageItem } from '@/motion/components/Stage'

/**
 * An asymmetric editorial spread. Column widths are `fr` ratios (immune to the
 * scale, frame-and-gutter.md §3); every drawn HEIGHT and offset is fluid.
 * Below lg the tiles fall back to plain aspect ratios and stack.
 *
 * The ambient flame loop is an `InViewLoopVideo` and sits OUTSIDE any
 * StageItem: nothing may animate a transform on a video or its ancestors.
 * Only its caption rises.
 */
function Caption({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn('mt-3 text-[13px] leading-[1.5] text-text-muted lg:fluid-mt-16 lg:fluid-copy-14/20', className)}>
      {children}
    </p>
  )
}

const PHOTO_BOX = 'relative w-full overflow-clip rounded-[2px] bg-surface-sand'

export function Gallery() {
  return (
    <section id="story" className="w-full bg-surface-page">
      <div className={cn(FRAME, 'py-24 lg:fluid-py-160')}>
        {/* Row 1: the oven, large, left; the dough hands offset down on the right. */}
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,780fr)_minmax(0,500fr)] lg:fluid-gap-x-80 lg:fluid-gap-y-0">
          <Stage trigger="view">
            <StageItem variant="lift" className="[--hero-lift:32px] lg:[--hero-lift:48px]">
              <div className={cn(PHOTO_BOX, 'aspect-[4/5] sm:aspect-[4/3] lg:aspect-auto lg:fluid-h-700')}>
                <Image
                  src="/images/photo-oven.webp"
                  alt="A wood-fired oven with an open flame"
                  fill
                  sizes="(min-width: 1024px) 56vw, 100vw"
                  className="object-cover"
                />
              </div>
            </StageItem>
            <StageItem variant="liftFade" delay={0.067} className="[--hero-lift:16px]">
              <Caption>The oven, lit at ten every morning and fed beech until close.</Caption>
            </StageItem>
          </Stage>

          <div className="lg:fluid-pt-200">
            <Stage trigger="view">
              <StageItem variant="lift" className="[--hero-lift:32px] lg:[--hero-lift:48px]">
                <div className={cn(PHOTO_BOX, 'aspect-[4/5] lg:aspect-auto lg:fluid-h-520')}>
                  <Image
                    src="/images/photo-dough-hands.webp"
                    alt="Hands stretching dough on a floured counter"
                    fill
                    sizes="(min-width: 1024px) 36vw, 100vw"
                    className="object-cover"
                  />
                </div>
              </StageItem>
              <StageItem variant="liftFade" delay={0.067} className="[--hero-lift:16px]">
                <Caption>Stretched by hand, never rolled: the pin would press the air out.</Caption>
              </StageItem>
            </Stage>
          </div>
        </div>

        {/* Pull quote: display type in a fixed measure. */}
        <Stage trigger="view" className="mx-auto mt-20 max-w-[980px] text-center lg:fluid-mt-140">
          <blockquote>
            <p className="font-display text-[30px] leading-[1.25] font-light tracking-[-0.015em] text-text-heading sm:text-[38px] lg:fluid-display-52/66">
              <StageItem as="span" variant="liftFade" className="block [--hero-lift:24px] lg:[--hero-lift:32px]">
                “In Rome they called it pinsa, from pinsere:
              </StageItem>
              <StageItem as="span" variant="liftFade" delay={0.067} className="block [--hero-lift:24px] lg:[--hero-lift:32px]">
                to press, to stretch. That is still the job.”
              </StageItem>
            </p>
            <StageItem variant="liftFade" delay={0.134} className="[--hero-lift:16px]">
              <footer className="mt-6 text-[12px] font-medium tracking-[0.2em] text-text-accent-ink uppercase lg:fluid-mt-32 lg:fluid-copy-12/16">
                Aurelia Conti, founder
              </footer>
            </StageItem>
          </blockquote>
        </Stage>

        {/* Row 2: the flame loop, small, left; the dining room large, right and raised. */}
        <div className="mt-20 grid grid-cols-1 gap-12 lg:fluid-mt-140 lg:grid-cols-[minmax(0,460fr)_minmax(0,820fr)] lg:fluid-gap-x-80 lg:fluid-gap-y-0">
          <div className="lg:fluid-pt-160">
            <div className={cn(PHOTO_BOX, 'aspect-[4/5] lg:aspect-auto lg:fluid-h-560')}>
              <InViewLoopVideo
                poster="/images/ambient-fire-poster.jpg"
                className="absolute inset-0 size-full max-w-none object-cover"
              >
                <source src="/videos/ambient-fire.mp4" type="video/mp4" />
              </InViewLoopVideo>
            </div>
            <Stage trigger="view">
              <StageItem variant="liftFade" className="[--hero-lift:16px]">
                <Caption>Beech and oak only. The fire is the one thing we never rush.</Caption>
              </StageItem>
            </Stage>
          </div>

          <Stage trigger="view">
            <StageItem variant="lift" className="[--hero-lift:32px] lg:[--hero-lift:48px]">
              <div className={cn(PHOTO_BOX, 'aspect-[4/3] lg:aspect-auto lg:fluid-h-640')}>
                <Image
                  src="/images/photo-dining.webp"
                  alt="A warm, low-lit dining room with wooden tables"
                  fill
                  sizes="(min-width: 1024px) 58vw, 100vw"
                  className="object-cover"
                />
              </div>
            </StageItem>
            <StageItem variant="liftFade" delay={0.067} className="[--hero-lift:16px]">
              <Caption>Forty seats on the Rue des Boulangers. Walk-ins welcome at the bar.</Caption>
            </StageItem>
          </Stage>
        </div>
      </div>
    </section>
  )
}
