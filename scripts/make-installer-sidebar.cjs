// Draws the image of the Windows installer's welcome and finish pages (NSIS sidebar: BMP, 164 x 314 pixels) from the
// illustration of the welcome screen. Run with: npx electron scripts/make-installer-sidebar.cjs
// Output: build/installerSidebar.bmp (picked up by electron-builder, see electron-builder.yml).
const { app, BrowserWindow } = require('electron')
const { mkdirSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')
const { pathToFileURL } = require('node:url')

const WIDTH = 164
const HEIGHT = 314
const ROOT = join(__dirname, '..')
const OUTPUT = join(ROOT, 'build', 'installerSidebar.bmp')

// Colors of the interface (src/renderer/src/styles): paper, ink, brand green, accent, rules.
const html = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#f7f4ec}svg{display:block}</style>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="#f7f4ec"/>
  <image href="${pathToFileURL(join(ROOT, 'build', 'icon.png')).href}" x="46" y="18" width="72" height="72"/>
  <g transform="rotate(-4 70 190)">
    <rect x="14" y="106" width="108" height="156" rx="10" fill="#fff" stroke="#ded8ca" stroke-width="1.5"/>
    <rect x="28" y="122" width="52" height="5" rx="2.5" fill="#8c8778" opacity=".45"/>
    <rect x="28" y="133" width="36" height="4" rx="2" fill="#ded8ca"/>
  </g>
  <g transform="rotate(2 82 196)">
    <rect x="30" y="112" width="112" height="160" rx="10" fill="#fff" stroke="#1e2622" stroke-width="2"/>
    <circle cx="52" cy="136" r="9" fill="#e6f0ea" stroke="#23624a" stroke-width="2"/>
    <rect x="68" y="128" width="56" height="5" rx="2.5" fill="#1e2622"/>
    <rect x="68" y="139" width="40" height="4" rx="2" fill="#23624a"/>
    <rect x="42" y="160" width="28" height="9" rx="4.5" fill="#c9e265"/>
    <rect x="74" y="160" width="22" height="9" rx="4.5" fill="#c9e265"/>
    <rect x="100" y="160" width="30" height="9" rx="4.5" fill="#c9e265"/>
    <rect x="42" y="182" width="88" height="4" rx="2" fill="#23624a" opacity=".2"/>
    <rect x="42" y="193" width="80" height="4" rx="2" fill="#23624a" opacity=".2"/>
    <rect x="42" y="204" width="88" height="4" rx="2" fill="#23624a" opacity=".2"/>
    <rect x="42" y="215" width="52" height="4" rx="2" fill="#23624a" opacity=".2"/>
    <rect x="42" y="234" width="88" height="4" rx="2" fill="#efeadf"/>
    <rect x="42" y="245" width="70" height="4" rx="2" fill="#efeadf"/>
  </g>
  <circle cx="132" cy="276" r="19" fill="#23624a"/>
  <polyline points="123,276 130,283 142,269" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`

/** 24-bit uncompressed BMP, bottom-up, rows padded to 4 bytes: the only format NSIS accepts. */
function toBmp(bgra, width, height) {
  const rowSize = Math.ceil((width * 3) / 4) * 4
  const buffer = Buffer.alloc(54 + rowSize * height)
  buffer.write('BM', 0)
  buffer.writeUInt32LE(buffer.length, 2)
  buffer.writeUInt32LE(54, 10)
  buffer.writeUInt32LE(40, 14)
  buffer.writeInt32LE(width, 18)
  buffer.writeInt32LE(height, 22)
  buffer.writeUInt16LE(1, 26)
  buffer.writeUInt16LE(24, 28)
  buffer.writeUInt32LE(rowSize * height, 34)
  for (let y = 0; y < height; y++) {
    const target = 54 + (height - 1 - y) * rowSize
    for (let x = 0; x < width; x++) {
      const source = (y * width + x) * 4
      buffer[target + x * 3] = bgra[source]
      buffer[target + x * 3 + 1] = bgra[source + 1]
      buffer[target + x * 3 + 2] = bgra[source + 2]
    }
  }
  return buffer
}

// One CSS pixel = one device pixel, whatever the screen: the image must be exactly 164 x 314.
app.commandLine.appendSwitch('force-device-scale-factor', '1')
app.whenReady().then(async () => {
  const window = new BrowserWindow({
    show: false,
    useContentSize: true,
    width: WIDTH,
    height: HEIGHT,
    webPreferences: { offscreen: false, sandbox: true },
  })
  const page = join(ROOT, 'build', '.sidebar.html')
  writeFileSync(page, html)
  await window.loadFile(page)
  await new Promise((resolve) => setTimeout(resolve, 300))
  const image = await window.webContents.capturePage({ x: 0, y: 0, width: WIDTH, height: HEIGHT })
  const size = image.getSize()
  if (size.width !== WIDTH || size.height !== HEIGHT)
    throw new Error(`unexpected capture size ${size.width}x${size.height}`)
  mkdirSync(join(ROOT, 'build'), { recursive: true })
  writeFileSync(OUTPUT, toBmp(image.toBitmap(), WIDTH, HEIGHT))
  if (process.env.SIDEBAR_PREVIEW) writeFileSync(process.env.SIDEBAR_PREVIEW, image.toPNG())
  require('node:fs').rmSync(page, { force: true })
  app.quit()
})
