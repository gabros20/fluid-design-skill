import { FRAME } from '@/lib/frame'
import { cn } from '@/lib/cn'
import { Stage, StageItem } from '@/motion/components/Stage'

/**
 * A large centred statement. Content-driven height (block padding only).
 * Display type in a FIXED measure → `fluid-display-*` (typography.md). The
 * lines are the AUTHORED breaks: each is a block span and one StageItem,
 * staggered by the contract's 0.067s. Block, not inline, at every breakpoint:
 * a transform does nothing on an inline box. On a phone a line may wrap
 * inside its own block, which reads fine as verse.
 */
const LINES = [
  'We bake one thing, slowly.',
  'A dough that rests for three days,',
  'an oven that never drops below 400°,',
  'and toppings you could count on one hand.'
]

export function Manifesto() {
  return (
    <section className="w-full bg-surface-cream">
      <div className={cn(FRAME, 'fluid-py-96 lg:fluid-py-180')}>
        <Stage trigger="view" className="mx-auto max-w-[1120px] text-center">
          <StageItem variant="liftFade" className="[--hero-lift:16px] lg:[--hero-lift:24px]">
            <p className="fluid-copy-11 font-medium tracking-[0.24em] text-text-accent-ink uppercase lg:fluid-copy-12/16">
              The house rule
            </p>
          </StageItem>
          <p className="fluid-mt-24 font-display fluid-display-30 leading-[1.22] font-light tracking-[-0.015em] text-text-heading sm:text-[38px] lg:fluid-mt-32 lg:fluid-display-48/64">
            {LINES.map((line, i) => (
              <StageItem
                key={line}
                as="span"
                variant="liftFade"
                delay={0.067 * (i + 1)}
                className="block [--hero-lift:24px] lg:[--hero-lift:32px]"
              >
                {line}{' '}
              </StageItem>
            ))}
          </p>
        </Stage>
      </div>
    </section>
  )
}
