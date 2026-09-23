import { FRAME } from '@/lib/frame'
import { cn } from '@/lib/cn'
import { FadeOnExit } from '@/motion/components/FadeOnExit'
import { PullToCentre } from '@/motion/components/PullToCentre'
import { ScrubStage, type BackdropStop, type CameraConfig } from '@/motion/components/ScrubStage'
import { Stage, StageItem } from '@/motion/components/Stage'

/**
 * The page's ONE scroll-driven scene: a pinned, scrubbed render of the dough.
 *
 * Geometry: N = 4 viewports (act 1 = 1, spacer = 2, act 3 = 1). Progress
 * advances 1/(N−1) = 1/3 per viewport (scroll-scenes.md §2): act 1 fills the
 * screen at 0, the spacer spans 1/3 → 1, and act 3 fills the screen at 1.
 *
 * Asset (assets-src/VIDEO-NOTES.md): 270 frames at 30fps, rendered from one
 * 1920² master, all-intra. Frames 0–59 are the head loop (pose(60) = pose(0),
 * so `matchFrame: 60`), 60–209 the scrub band (a 90° turn, horizontal oval to
 * vertical, and a 1.2× push-in on a smoothstep), 210–269 the tail loop
 * (pose(269) = pose(209), so the tail re-enters at 210). Both seams decode
 * pixel-identical (PSNR ∞) against ~29–30 dB for the neighbouring frames.
 */
const CAMERA: CameraConfig = {
  canvas: 1920,
  crop: {
    // ffmpeg crop=1920:900:0:510 and crop=1080:1920:420:0, over 1920. The
    // desktop crop is WIDER than 16:9 (2.13:1) so the camera can pan the subject
    // from the right third to the left third without exposing a canvas edge.
    desktop: { x: 0, y: 0.265625, w: 1, h: 0.46875 },
    mobile: { x: 0.21875, y: 0, w: 0.5625, h: 1 }
  },
  // The pinsa is centred on the master canvas and stays there (it rotates and
  // zooms about its own centre), so head and tail share one point. Written in
  // MASTER-canvas coordinates: that is what the component's maths reads
  // (`(subject − crop.x) / crop.w`), whatever the SubjectPoint docblock says.
  subject: {
    desktop: { head: { x: 0.5, y: 0.5 }, tail: { x: 0.5, y: 0.5 } },
    mobile: { head: { x: 0.5, y: 0.5 }, tail: { x: 0.5, y: 0.5 } }
  },
  shots: {
    // Act 1's copy sits on the left, so the pinsa starts right of centre; act 3's
    // copy is on the right, so it pans across to the left third.
    desktop: { head: { zoom: 1, at: [0.71, 0.5] }, tail: { zoom: 1, at: [0.34, 0.5] } },
    // Phone: act 1's copy on top, so the pinsa sits low; act 3's copy sits at the
    // bottom, so the (now vertical) pinsa rises to the upper half.
    mobile: { head: { zoom: 1, at: [0.5, 0.62] }, tail: { zoom: 1, at: [0.5, 0.42] } }
  },
  // Height-driven base size, in svh of the pin: the crop's own aspect at one
  // pin-height (1920/900 desktop, 1080/1920 mobile), so zoom 1 is 1:1 with the
  // master at a 900-tall window.
  frameSize: { desktop: { h: 100, w: 213.33 }, mobile: { h: 100, w: 56.25 } }
}

/** Sampled from the ENCODED desktop tier's top/bottom tenth (VIDEO-NOTES.md). */
const BACKDROP: BackdropStop[] = [
  { at: 0, t: '#484849', b: '#464546' },
  { at: 0.25, t: '#484849', b: '#464546' },
  { at: 0.5, t: '#494949', b: '#474547' },
  { at: 0.75, t: '#534b47', b: '#564b48' },
  { at: 1, t: '#594d47', b: '#5d4e48' }
]

const EYEBROW =
  'text-[11px] font-medium tracking-[0.24em] text-text-on-dark-muted uppercase lg:fluid-copy-12/16'
const HEADING =
  'font-display text-[40px] leading-[1.05] font-light tracking-[-0.02em] text-text-on-dark sm:text-[52px] lg:fluid-display-80/84'
const BODY = 'text-[15px] leading-[1.6] text-text-on-dark-muted lg:fluid-copy-17/28'

export function DoughScene() {
  return (
    <ScrubStage
      src="/videos/dough-desktop.mp4"
      mobileSrc="/videos/dough-mobile.mp4"
      poster="/images/dough-poster-desktop.jpg"
      mobilePoster="/images/dough-poster-mobile.jpg"
      className="bg-surface-dark"
      fps={30}
      headLoop={{ fromFrame: 0, matchFrame: 60 }}
      tailLoop={{ fromFrame: 210 }}
      backdropStops={BACKDROP}
      camera={CAMERA}
    >
      {/* Act 1 — one viewport. Copy rides over the head loop, then fades as it
          leaves so it never competes with the turning render. No background and
          no overflow-hidden on anything riding over the pin. */}
      <section data-header-theme="dark" className="flex h-svh items-start lg:items-center">
        <div className={cn(FRAME, 'pt-[calc(var(--header-h)+48px)] lg:pt-0')}>
          <FadeOnExit className="max-w-[560px] [--exit-from:0.08] [--exit-to:0.4] lg:fluid-cap-560">
            <Stage trigger="view">
              <StageItem variant="liftFade" className="[--hero-lift:16px] lg:[--hero-lift:24px]">
                <p className={EYEBROW}>The dough</p>
              </StageItem>
              <h2 className={cn(HEADING, 'mt-4 lg:fluid-mt-24')}>
                <StageItem as="span" variant="liftFade" delay={0.067} className="block [--hero-lift:32px]">
                  Patience is the
                </StageItem>
                <StageItem as="span" variant="liftFade" delay={0.134} className="block [--hero-lift:32px]">
                  main ingredient
                </StageItem>
              </h2>
              <StageItem variant="liftFade" delay={0.2} className="[--hero-lift:24px]">
                <p className={cn(BODY, 'mt-5 max-w-[440px] lg:fluid-mt-32')}>
                  Three flours, 80% water and a pinch of sourdough, left cold for 72 hours.
                  The long rest breaks the starch down, so the crumb bakes open and the
                  crust stays light enough to eat to the last bite.
                </p>
              </StageItem>
            </Stage>
          </FadeOnExit>
        </div>
      </section>

      {/* Act 2 — TWO viewports, deliberately empty: the scrub spends them. */}
      <section aria-hidden="true" data-header-theme="dark" data-scrub-spacer="" className="h-[200svh]" />

      {/* Act 3 — one viewport, the tail loop's composition. The scroll well pulls
          it to rest, clamped to the pin so it can never ask to rest outside it. */}
      <section
        data-header-theme="dark"
        className="relative flex h-svh items-end pb-16 lg:items-center lg:pb-0"
      >
        <PullToCentre clamp="[data-scrub-stage]" />
        <div className={cn(FRAME, 'flex justify-end')}>
          <Stage trigger="view" className="max-w-[560px] lg:fluid-cap-560">
            <StageItem variant="liftFade" className="[--hero-lift:16px] lg:[--hero-lift:24px]">
              <p className={EYEBROW}>The bake</p>
            </StageItem>
            <h2 className={cn(HEADING, 'mt-4 lg:fluid-mt-24')}>
              <StageItem as="span" variant="liftFade" delay={0.067} className="block [--hero-lift:32px]">
                Crisp outside,
              </StageItem>
              <StageItem as="span" variant="liftFade" delay={0.134} className="block [--hero-lift:32px]">
                cloud inside
              </StageItem>
            </h2>
            <StageItem variant="liftFade" delay={0.2} className="[--hero-lift:24px]">
              <p className={cn(BODY, 'mt-5 max-w-[440px] lg:fluid-mt-32')}>
                Two and a half minutes on stone at 450°C. The oval blisters, the edge
                leopards, and the middle stays soft enough to fold.
              </p>
            </StageItem>
          </Stage>
        </div>
      </section>
    </ScrubStage>
  )
}
