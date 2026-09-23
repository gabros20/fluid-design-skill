import type { Metadata, Viewport } from 'next'
import { DM_Sans, Jost } from 'next/font/google'
import type { ReactNode } from 'react'

import { MotionProvider } from '@/motion/components/MotionProvider'

import './globals.css'

// Display: a light geometric sans. Both are variable fonts: one file each covers every weight drawn.
const jost = Jost({ subsets: ['latin'], variable: '--font-jost', display: 'swap' })
const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans', display: 'swap' })

export const metadata: Metadata = {
  title: 'Forno Aurelia — Pinsa romana, Mulhouse',
  description: 'A fictional Roman pinsa kitchen. A test build for the fluid-design skill.'
}

// No themeColor on purpose: base.css explains why (iOS 26 samples fixed elements instead).
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' }

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${jost.variable} ${dmSans.variable}`}>
      <head>
        {/* The reveal safety net: every StageItem is SSR'd hidden. Without JS nothing reveals it. */}
        <noscript>
          <style>{`[data-stage-item]{opacity:1!important;transform:none!important}[data-stage-veil]{display:none!important}`}</style>
        </noscript>
      </head>
      <body className="font-sans text-text-body antialiased">
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  )
}
