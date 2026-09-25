import { cn } from '@/lib/utils'
export function Header({ open }) {
  return <header className={cn('sticky top-0', open && 'fluid-grow-until-[1440]')} />
}
