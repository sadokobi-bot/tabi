import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// The icon is full-bleed artwork, so iOS and maskable icons get no padding (the default adds a white frame).
export default defineConfig({
  preset: {
    ...minimal2023Preset,
    apple: { ...minimal2023Preset.apple, padding: 0 },
    maskable: { ...minimal2023Preset.maskable, padding: 0 },
  },
  images: ['public/icon.svg'],
})
