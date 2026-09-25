import { twMerge } from 'tailwind-merge'
export const cn = (...a: string[]) => twMerge(a.join(' '))
