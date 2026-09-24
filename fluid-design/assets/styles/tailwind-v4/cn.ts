// fluid-design 2.0.0 · GENERATED from fluid.config.json — do not edit. Run `fluid generate`.
// cn.ts — class merging that knows the fluid utilities.

import { type ClassValue, clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// tailwind-merge does not know fluid-* utilities, so without this it keeps BOTH
// of 'lg:fluid-p-40 lg:fluid-p-24' and CSS source order picks the winner. Each
// family joins the Tailwind group its property already belongs to (fluid-p joins
// p, every font-size family joins font-size), so the last class wins, as a
// caller passing className expects.
const isFluidValue = (value: string) => /^(\d+(\.\d+)?(\/\d+(\.\d+)?)?|\[\d+\])$/.test(value)
const fluid = (name: string) => ({ [name]: [isFluidValue] })

export const twMerge = extendTailwindMerge<'fluid-grow-until' | 'fluid-shrink-until' | 'fluid-ui-grow-until' | 'fluid-off'>({
  extend: {
    classGroups: {
      p: [fluid('fluid-p'), fluid('fluid-ui-p')],
      px: [fluid('fluid-px'), fluid('fluid-ui-px')],
      py: [fluid('fluid-py'), fluid('fluid-ui-py')],
      pt: [fluid('fluid-pt')],
      pb: [fluid('fluid-pb')],
      pl: [fluid('fluid-pl')],
      pr: [fluid('fluid-pr')],
      m: [fluid('fluid-m')],
      mx: [fluid('fluid-mx')],
      my: [fluid('fluid-my')],
      mt: [fluid('fluid-mt')],
      mb: [fluid('fluid-mb')],
      ml: [fluid('fluid-ml')],
      mr: [fluid('fluid-mr')],
      gap: [fluid('fluid-gap'), fluid('fluid-ui-gap')],
      'gap-x': [fluid('fluid-gap-x')],
      'gap-y': [fluid('fluid-gap-y')],
      w: [fluid('fluid-w'), fluid('fluid-ui-w')],
      h: [fluid('fluid-h'), fluid('fluid-ui-h')],
      size: [fluid('fluid-size'), fluid('fluid-ui-size')],
      'min-w': [fluid('fluid-min-w')],
      'min-h': [fluid('fluid-min-h')],
      'max-h': [fluid('fluid-max-h')],
      inset: [fluid('fluid-inset')],
      top: [fluid('fluid-top')],
      right: [fluid('fluid-right')],
      bottom: [fluid('fluid-bottom')],
      left: [fluid('fluid-left')],
      'max-w': [fluid('fluid-cap')],
      'font-size': [fluid('fluid-text'), fluid('fluid-display'), fluid('fluid-copy'), fluid('fluid-ui-text')],
      'translate-x': [fluid('fluid-translate-x')],
      'translate-y': [fluid('fluid-translate-y')],
      ps: [fluid('fluid-ps')],
      pe: [fluid('fluid-pe')],
      ms: [fluid('fluid-ms')],
      me: [fluid('fluid-me')],
      start: [fluid('fluid-start')],
      end: [fluid('fluid-end')],
      'inset-x': [fluid('fluid-inset-x')],
      'inset-y': [fluid('fluid-inset-y')],
      basis: [fluid('fluid-basis')],
      'scroll-mt': [fluid('fluid-scroll-mt')],
      'scroll-pt': [fluid('fluid-scroll-pt')],
      'scroll-mb': [fluid('fluid-scroll-mb')],
      'scroll-pb': [fluid('fluid-scroll-pb')],
      rounded: [fluid('fluid-rounded')],
      'rounded-t': [fluid('fluid-rounded-t')],
      'rounded-b': [fluid('fluid-rounded-b')],
      'rounded-l': [fluid('fluid-rounded-l')],
      'rounded-r': [fluid('fluid-rounded-r')],
      'space-x': [fluid('fluid-space-x')],
      'space-y': [fluid('fluid-space-y')],
      'fluid-grow-until': [fluid('fluid-grow-until')],
      'fluid-shrink-until': [fluid('fluid-shrink-until')],
      'fluid-ui-grow-until': [fluid('fluid-ui-grow-until')],
      'fluid-off': ['fluid-off']
    }
  }
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
