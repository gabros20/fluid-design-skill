import { Header } from '@/components/Header'
import { CraftNumbers } from '@/components/sections/CraftNumbers'
import { DoughScene } from '@/components/sections/DoughScene'
import { Gallery } from '@/components/sections/Gallery'
import { Hero } from '@/components/sections/Hero'
import { Manifesto } from '@/components/sections/Manifesto'
import { Menu } from '@/components/sections/Menu'
import { Reserve } from '@/components/sections/Reserve'
import { StageVeil } from '@/motion/components/Stage'

export default function Page() {
  return (
    <>
      {/* Page-level, fixed: it must out-rank the fixed header, which a veil nested
          in the hero's stacking context could not. */}
      <StageVeil className="bg-surface-page" />
      <Header />
      <main>
        <Hero />
        <Manifesto />
        <DoughScene />
        <Menu />
        <CraftNumbers />
        <Gallery />
        <Reserve />
      </main>
    </>
  )
}
