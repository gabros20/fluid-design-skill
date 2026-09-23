import { FRAME } from '@/lib/frame'
import { cn } from '@/lib/cn'
import { Stage, StageItem } from '@/motion/components/Stage'
import { PAGE_END_TRIGGER } from '@/motion/lib/triggers'

const HOURS = [
  ['Tue – Thu', '12:00 – 14:00 · 18:30 – 22:00'],
  ['Fri – Sat', '12:00 – 14:30 · 18:30 – 23:00'],
  ['Sun', '12:00 – 15:00']
]

/**
 * The reservation CTA and the footer, one dark band (`data-header-theme`).
 *
 * The CTA is ordinary page content on `--fluid`. The footer row is CHROME and
 * spends `--fluid-chrome` (width-always, never shrunk by a short window), via
 * arbitrary values: there is deliberately no `fluid-chrome-*` utility family.
 *
 * The last stage on the page uses PAGE_END_TRIGGER: a negative bottom margin
 * draws the trigger line inside the viewport, and the terminal screenful never
 * scrolls across it.
 */
export function Reserve() {
  return (
    <section id="reserve" data-header-theme="dark" className="w-full bg-surface-dark text-text-on-dark">
      <div className={cn(FRAME, 'fluid-pt-112 fluid-pb-64 lg:fluid-pt-200 lg:fluid-pb-120')}>
        <Stage trigger="view" className="grid grid-cols-1 fluid-gap-48 lg:grid-cols-[minmax(0,800fr)_minmax(0,400fr)] lg:fluid-gap-80">
          <div>
            <StageItem variant="liftFade" className="[--hero-lift:16px] lg:[--hero-lift:24px]">
              <p className="fluid-copy-11 font-medium tracking-[0.24em] text-text-on-dark-muted uppercase lg:fluid-copy-12/16">
                Réservation
              </p>
            </StageItem>
            <h2 className="fluid-mt-16 font-display fluid-display-48 leading-[1] font-light tracking-[-0.025em] sm:text-[72px] lg:fluid-mt-24 lg:fluid-display-100/100">
              <StageItem as="span" variant="liftFade" delay={0.067} className="block [--hero-lift:32px] lg:[--hero-lift:48px]">
                Book a table,
              </StageItem>
              <StageItem as="span" variant="liftFade" delay={0.134} className="block [--hero-lift:32px] lg:[--hero-lift:48px]">
                bring your hunger
              </StageItem>
            </h2>
            <StageItem variant="lift" delay={0.2} className="[--hero-lift:24px]">
              <a
                href="tel:+33389000000"
                className="fluid-mt-40 inline-flex items-center rounded-full bg-surface-action-inverse fluid-px-32 fluid-py-16 fluid-copy-14 font-medium tracking-[0.06em] text-text-on-action-inverse uppercase lg:fluid-mt-48 lg:px-[calc(36*var(--fluid-copy))] lg:py-[calc(18*var(--fluid-copy))] lg:fluid-copy-14/18"
              >
                Call +33 3 89 00 00 00
              </a>
            </StageItem>
          </div>

          <StageItem variant="liftFade" delay={0.2} className="self-end [--hero-lift:24px]">
            <dl className="fluid-copy-15 leading-[1.6] lg:fluid-copy-16/26">
              {HOURS.map(([day, time]) => (
                <div key={day} className="flex justify-between fluid-gap-24 border-t border-border-on-dark fluid-py-12 lg:fluid-py-14">
                  <dt className="text-text-on-dark">{day}</dt>
                  <dd className="text-right text-text-on-dark-muted">{time}</dd>
                </div>
              ))}
            </dl>
            <p className="fluid-mt-24 fluid-copy-15 leading-[1.6] text-text-on-dark-muted lg:fluid-mt-24 lg:fluid-copy-16/26">
              14 Rue des Boulangers, 68100 Mulhouse
            </p>
          </StageItem>
        </Stage>
      </div>

      <footer className="border-t border-border-on-dark">
        <Stage
          trigger="view"
          margin={PAGE_END_TRIGGER}
          className={cn(
            FRAME,
            'flex flex-col fluid-gap-12 fluid-py-32 fluid-copy-12 text-text-on-dark-muted sm:flex-row sm:items-center sm:justify-between',
            'lg:py-[calc(32*var(--fluid-chrome))] lg:text-[calc(13*var(--fluid-chrome))]'
          )}
        >
          <StageItem variant="liftFade" className="[--hero-lift:12px]">
            <p>© 2026 Forno Aurelia — a fictional restaurant for a fluid-design test build.</p>
          </StageItem>
          <StageItem variant="liftFade" delay={0.06} className="[--hero-lift:12px]">
            <p>
              Photos: Unsplash and Pexels, see CREDITS.md
            </p>
          </StageItem>
        </Stage>
      </footer>
    </section>
  )
}
