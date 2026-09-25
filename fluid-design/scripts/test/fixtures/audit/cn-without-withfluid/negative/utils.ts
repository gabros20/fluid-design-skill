import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'
import { withFluid } from '@/styles/fluid/cn'

const twMerge = extendTailwindMerge(withFluid)
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
