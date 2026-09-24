import { SiteHeader } from '@/components/SiteHeader'
import { Button } from '@/components/ui/button'

export default function Page() {
  return (
    <>
      <SiteHeader />
      <main className="fluid-container lg:fluid-pt-160">
        <h1 className="lg:fluid-display-72">Ship faster</h1>
        <Button className="lg:fluid-px-24">Start</Button>
      </main>
    </>
  )
}
