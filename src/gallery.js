// Galeri render diam + lightbox (elemen <dialog>, fokus terkunci dan Esc bawaan peramban).
import { h } from './dom.js'
import { icons } from './icons.js'
import { url } from './data.js'

export function createGallery({ host, items }) {
  let current = 0
  const lbImg = h('img', { alt: '' })
  const lbTitle = h('h2', {})
  const lbCaption = h('p', {})
  const prev = h('button', { class: 'icon-btn lb-prev', type: 'button', 'aria-label': 'Gambar sebelumnya', html: icons.prev, onclick: () => open(current - 1) })
  const next = h('button', { class: 'icon-btn lb-next', type: 'button', 'aria-label': 'Gambar berikutnya', html: icons.next, onclick: () => open(current + 1) })
  const close = h('button', { class: 'icon-btn lb-close', type: 'button', 'aria-label': 'Tutup', html: icons.close, onclick: () => dialog.close() })
  const dialog = h('dialog', { class: 'lightbox', 'aria-label': 'Tampilan gambar besar' },
    h('div', { class: 'lb-inner' }, lbImg, h('div', { class: 'lb-cap' }, lbTitle, lbCaption)), prev, next, close)
  dialog.addEventListener('click', (e) => { if (e.target === dialog || e.target.classList.contains('lb-inner')) dialog.close() })
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') open(current - 1)
    else if (e.key === 'ArrowRight') open(current + 1)
  })

  function open(index) {
    current = (index + items.length) % items.length
    const item = items[current]
    lbImg.onerror = () => { if (item.thumb && lbImg.src !== new URL(url(item.thumb), location.href).href) lbImg.src = url(item.thumb) }
    lbImg.src = url(item.file)
    lbImg.alt = item.title + '. ' + item.caption
    lbTitle.textContent = item.title
    lbCaption.textContent = item.caption
    if (!dialog.open) dialog.showModal()
  }

  const grid = h('div', { class: 'gallery-grid' }, items.map((item, index) => {
    const thumb = h('img', { src: url(item.thumb ?? item.file), alt: item.title, loading: 'lazy', decoding: 'async' })
    const button = h('button', { type: 'button', 'aria-label': 'Perbesar: ' + item.title, onclick: () => open(index) }, thumb)
    thumb.addEventListener('error', () => { thumb.remove(); button.append(h('span', { class: 'ph' }, item.title)) })
    return h('figure', { class: 'shot' }, button, h('figcaption', {}, h('h2', {}, item.title), h('p', {}, item.caption)))
  }))

  host.append(
    h('div', { class: 'gallery-head' },
      h('h1', {}, 'Galeri render'),
      h('p', {}, 'Render final rancangan Provenza Dental, dari fasad sampai ruang praktik.')),
    grid, dialog)
}
