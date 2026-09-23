import Image, { type StaticImageData } from 'next/image'

import { FRAME } from '@/lib/frame'
import { cn } from '@/lib/cn'
import { Stage, StageItem } from '@/motion/components/Stage'

import crudo from '../../../public/images/pinsa-crudo.png'
import diavola from '../../../public/images/pinsa-diavola.png'
import funghi from '../../../public/images/pinsa-funghi.png'
import margherita from '../../../public/images/pinsa-margherita.png'
import mortadella from '../../../public/images/pinsa-mortadella.png'
import zucca from '../../../public/images/pinsa-zucca.png'

interface Pinsa {
  name: string
  ingredients: string
  price: number
  image: StaticImageData
}

const PINSAS: Pinsa[] = [
  { name: 'Margherita', ingredients: 'San Marzano tomato, fior di latte, basil, olive oil', price: 13, image: margherita },
  { name: 'Diavola', ingredients: 'Tomato, spicy salame, fior di latte, chilli honey', price: 15, image: diavola },
  { name: 'Mortadella', ingredients: 'Mortadella, stracciatella, crushed pistachio, lemon zest', price: 17, image: mortadella },
  { name: 'Funghi', ingredients: 'Fior di latte, roasted mushrooms, black truffle, thyme', price: 18, image: funghi },
  { name: 'Crudo', ingredients: 'Prosciutto crudo, rocket, parmigiano, cherry tomatoes', price: 16, image: crudo },
  { name: 'Zucca', ingredients: 'Pumpkin cream, fennel sausage, smoked scamorza, sage', price: 16, image: zucca }
]

/**
 * Six pinsas on an `auto-fill` grid whose MINIMUM is scaled
 * (frame-and-gutter.md §3): a frozen minimum inside a growing frame turns the
 * column count into a property of the monitor.
 *
 * 360 is the smallest minimum a fourth column can never beat at the canvas
 * (4·360 + 3·40 = 1560 > 1520 content) while three still fit at the
 * reference (3·360 + 2·40 = 1160 ≤ 1280). Scaled, both sides of the
 * comparison move together, so it is 3-up at every desktop size. Below lg the
 * unit is 1px and it reads as a plain 360px: 1-up on a phone, 2-up on a tablet.
 *
 * Each card is its OWN stage (one stage per arrival): the second row arrives a
 * screen later than the first. Within a row the cards stagger by column,
 * 60ms apart (the craft table's 30–80ms band).
 *
 * The cards scale with the frame, so their type spends `fluid-text-*`
 * (typography.md: the container scales → the base unit).
 */
export function Menu() {
  return (
    <section id="menu" className="w-full bg-surface-page">
      <div className={cn(FRAME, 'py-24 lg:fluid-py-160')}>
        <Stage
          trigger="view"
          className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-end lg:fluid-gap-40"
        >
          <div>
            <StageItem variant="liftFade" className="[--hero-lift:16px] lg:[--hero-lift:24px]">
              <p className="text-[11px] font-medium tracking-[0.24em] text-text-accent-ink uppercase lg:fluid-copy-12/16">
                La carta
              </p>
            </StageItem>
            <h2 className="mt-4 font-display text-[40px] leading-[1.05] font-light tracking-[-0.02em] text-text-heading sm:text-[52px] lg:fluid-mt-20 lg:fluid-display-80/84">
              <StageItem as="span" variant="liftFade" delay={0.067} className="block [--hero-lift:32px]">
                Six pinsas,
              </StageItem>
              <StageItem as="span" variant="liftFade" delay={0.134} className="block [--hero-lift:32px]">
                one dough
              </StageItem>
            </h2>
          </div>
          <StageItem variant="liftFade" delay={0.2} className="max-w-[400px] [--hero-lift:24px]">
            <p className="text-[15px] leading-[1.6] lg:fluid-copy-16/26">
              Every pinsa is 30 cm of the same 72-hour dough. Gluten-light, never heavy.
              Ask for the day&apos;s special at the counter.
            </p>
          </StageItem>
        </Stage>

        <ul className="mt-14 grid grid-cols-[repeat(auto-fill,minmax(min(calc(360*var(--fluid)),100%),1fr))] gap-x-8 gap-y-14 lg:fluid-mt-96 lg:fluid-gap-x-40 lg:fluid-gap-y-80">
          {PINSAS.map((p, i) => (
            <li key={p.name}>
              <Stage trigger="view">
                <StageItem variant="liftFade" delay={(i % 3) * 0.06} className="[--hero-lift:32px] lg:[--hero-lift:40px]">
                  <article>
                    {/* A fixed 4:3 plate, so cut-outs of slightly different trims
                        still line up across a row. The inset is a percentage:
                        already relative, it needs no fluid twin. */}
                    <div className="relative aspect-[4/3] rounded-[2px] bg-surface-cream">
                      <div className="absolute inset-[9%]">
                        <Image
                          src={p.image}
                          alt={`Pinsa ${p.name}, seen from above`}
                          fill
                          sizes="(min-width: 1024px) 30vw, (min-width: 768px) 45vw, 90vw"
                          className="object-contain"
                        />
                      </div>
                    </div>
                    <div className="mt-5 flex items-baseline justify-between gap-4 lg:fluid-mt-24 lg:fluid-gap-16">
                      <h3 className="font-display text-[26px] leading-[1.1] font-normal text-text-heading lg:fluid-text-30/34">
                        {p.name}
                      </h3>
                      <p className="text-[17px] font-medium text-text-heading tabular-nums lg:fluid-text-18/24">
                        €{p.price}
                      </p>
                    </div>
                    <p className="mt-2 max-w-[320px] text-[14px] leading-[1.55] text-text-muted lg:fluid-mt-8 lg:max-w-none lg:fluid-text-15/23">
                      {p.ingredients}
                    </p>
                  </article>
                </StageItem>
              </Stage>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
