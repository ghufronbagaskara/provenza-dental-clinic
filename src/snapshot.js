// Tangkap PNG dari canvas WebGL tanpa preserveDrawingBuffer: render ulang satu frame di skala tinggi,
// toBlob di tick yang sama, lalu kembalikan ukuran. DOM (pin, panel, tombol) tidak pernah ikut.
import { h, reducedMotion } from './dom.js'

const pad2 = (n) => String(n).padStart(2, '0')

export function stampName(prefix, now = new Date()) {
  const d = `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}`
  const t = `${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`
  return `${prefix}-${d}-${t}.png`
}

// render(): menggambar satu frame ke renderer (kamera sudah siap).
export function captureCanvas({ renderer, width, height, name, render }) {
  const canvas = renderer.domElement
  const dpr = renderer.getPixelRatio()
  const scale = Math.max(dpr, Math.min(2, 3840 / Math.max(width, height)))
  renderer.setPixelRatio(scale)
  renderer.setSize(width, height, false)
  render()
  canvas.toBlob((blob) => {
    if (!blob) return
    const a = h('a', { href: URL.createObjectURL(blob), download: name })
    document.body.append(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 4000)
  }, 'image/png')
  renderer.setPixelRatio(dpr)
  renderer.setSize(width, height, false)
  render()
}

// Kilat 150 ms + toast; elemen dipasang oleh pemanggil di dalam host yang position: relative/absolute.
export function createSnapshotFeedback() {
  const flash = h('div', { class: 'tour-flash', 'aria-hidden': 'true' })
  const toast = h('div', { class: 'tour-toast', role: 'status', hidden: true }, 'Gambar disimpan')
  let timer = 0
  function notify() {
    if (!reducedMotion) {
      flash.classList.remove('go')
      void flash.offsetWidth
      flash.classList.add('go')
    }
    toast.hidden = false
    clearTimeout(timer)
    timer = setTimeout(() => { toast.hidden = true }, 1800)
  }
  return { flash, toast, notify }
}

// Pintasan hanya bila tidak sedang mengetik dan tanpa Ctrl/Meta/Alt.
export function isPlainShortcut(e) {
  return !e.ctrlKey && !e.metaKey && !e.altKey && !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName ?? '') && !e.target?.isContentEditable
}
