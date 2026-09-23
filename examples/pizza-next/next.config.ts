import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
    // The menu and hero cut-outs are drawn up to ~760 fluid px; at 2560 wide
    // (factor 1.6) and DPR 2 that asks for ~2400 device px, so keep the large sizes.
    deviceSizes: [640, 828, 1080, 1280, 1600, 1920, 2400]
  }
}

export default nextConfig
