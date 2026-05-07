// Generate PWA icons from public/favicon.svg
// Run with: node scripts/generate-pwa-icons.mjs
import sharp from 'sharp'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const PUBLIC = resolve(ROOT, 'public')
const ICONS_DIR = resolve(PUBLIC, 'icons')

// Larger SVG variant for better rasterization (same shape as favicon.svg)
const APP_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
  <rect width="512" height="512" rx="96" fill="#10b981"/>
  <path d="M160 360L256 152L352 360" stroke="white" stroke-width="40" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M192 296H320" stroke="white" stroke-width="40" stroke-linecap="round"/>
</svg>`

// Maskable: same logo but with extra padding (safe zone) and full-bleed background
const MASKABLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
  <rect width="512" height="512" fill="#10b981"/>
  <g transform="translate(96 96) scale(0.625)">
    <path d="M160 360L256 152L352 360" stroke="white" stroke-width="40" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M192 296H320" stroke="white" stroke-width="40" stroke-linecap="round"/>
  </g>
</svg>`

await mkdir(ICONS_DIR, { recursive: true })

const tasks = [
  { svg: APP_SVG, size: 192, out: 'icons/icon-192.png' },
  { svg: APP_SVG, size: 512, out: 'icons/icon-512.png' },
  { svg: MASKABLE_SVG, size: 512, out: 'icons/icon-maskable-512.png' },
  { svg: APP_SVG, size: 180, out: 'apple-touch-icon.png' },
]

for (const { svg, size, out } of tasks) {
  const outPath = resolve(PUBLIC, out)
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(outPath)
  console.log(`✓ ${out} (${size}x${size})`)
}

console.log('\nAll PWA icons generated.')
