'use client'

import Image from 'next/image'
import { useRef } from 'react'

import { cn } from '@/lib/cn'
import { Stage, StageItem } from '@/motion/components/Stage'
import { THEME_FADE } from '@/motion/hooks/header-theme'
import { useHeaderTheme } from '@/motion/hooks/useHeaderTheme'

/**
 * Fixed, transparent header whose ink follows the section beneath it
 * (`data-header-theme`). Chrome spends `--fluid-chrome`, never `--fluid`, so it
 * does not shrink on a short-but-wide window. Its geometry is the `--header-h`
 * contract from fluid.css: a `24 × --fluid` resting inset + safe area, then a
 * 34px row (mobile) or a `48 × --fluid-chrome` row (from lg).
 */
export function Header() {
  const ref = useRef<HTMLElement>(null)
  const theme = useHeaderTheme('light', ref)
  const dark = theme === 'dark'

  return (
    <Stage
      as="header"
      trigger="mount"
      className="pointer-events-none fixed inset-x-0 top-0 z-50 pt-[calc(24*var(--fluid)+var(--safe-top))]"
    >
      <StageItem variant="drop" className="[--hero-drop:-96px] lg:[--hero-drop:-120px]">
        <nav
          ref={ref}
          aria-label="Main"
          className={cn(
            'pointer-events-auto relative mx-auto grid fluid-h-34 w-full max-w-[1680px] grid-cols-[1fr_auto_1fr] items-center fluid-px-24',
            'lg:fluid-cap-1680 lg:fluid-px-80 lg:h-[calc(48*var(--fluid-chrome))]',
            THEME_FADE,
            dark ? 'text-text-on-dark' : 'text-text-heading'
          )}
        >
          <a href="#top" aria-label="Forno Aurelia, home" className="justify-self-start">
            <span
              className={cn(
                'block fluid-size-34 overflow-hidden rounded-full lg:size-[calc(48*var(--fluid-chrome))]',
                THEME_FADE,
                dark ? 'bg-surface-action-inverse' : 'bg-surface-page'
              )}
            >
              <Image
                src="/images/mascot.png"
                alt=""
                width={96}
                height={96}
                priority
                className="size-full object-contain"
              />
            </span>
          </a>

          {/* The wordmark is live type, not an image. */}
          <a href="#top" className="flex flex-col items-center text-center leading-none">
            <span className="font-display fluid-copy-18 font-normal tracking-[0.02em] lg:text-[calc(24*var(--fluid-chrome))]">
              Forno Aurelia
            </span>
            <span
              className={cn(
                'fluid-mt-3 hidden fluid-copy-9 tracking-[0.24em] uppercase sm:block lg:mt-[calc(5*var(--fluid-chrome))] lg:text-[calc(10*var(--fluid-chrome))]',
                THEME_FADE,
                dark ? 'text-text-on-dark-muted' : 'text-text-muted'
              )}
            >
              Pinsa romana · Mulhouse
            </span>
          </a>

          <a
            href="#menu"
            className={cn(
              'grid fluid-size-34 place-items-center justify-self-end rounded-full fluid-text-8.5 font-medium tracking-[0.04em] uppercase',
              'lg:size-[calc(48*var(--fluid-chrome))] lg:text-[calc(11*var(--fluid-chrome))] lg:tracking-[0.08em]',
              THEME_FADE,
              dark
                ? 'bg-surface-action-inverse text-text-on-action-inverse'
                : 'bg-surface-action text-text-on-action'
            )}
          >
            Menu
          </a>
        </nav>
      </StageItem>
    </Stage>
  )
}
