import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva('inline-flex items-center justify-center rounded-md font-medium lg:fluid-px-40 lg:fluid-h-48 lg:fluid-text-16', {
  variants: { variant: { default: 'bg-black text-white', outline: 'border' } },
  defaultVariants: { variant: 'default' }
})

export function Button({ className, variant, ...props }: React.ComponentProps<'button'> & VariantProps<typeof buttonVariants>) {
  return <button className={cn(buttonVariants({ variant, className }))} {...props} />
}
