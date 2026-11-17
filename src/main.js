// Titik masuk: memuat data, merangkai shell + 4 mode, dan memuat three secara lazy
// (hanya saat Maket / Tur 360° dibuka; Denah dan Galeri tidak menariknya).
import './style.css'
import { h } from './dom.js'
import { icons } from './icons.js'
import { hasWebGL, loadTour, url } from './data.js'
import { createPanel } from './panel.js'
import { createCard } from './card.js'
import { createPlan } from './plan.js'
import { createGallery } from './gallery.js'
import { createSnapshotFeedback, isPlainShortcut } from './snapshot.js'
import { go, on, presetLayers, setRoof, setRoom, startRouter, state } from './state.js'

const app = document.getElementById('app')

async function boot() {
  const webgl = hasWebGL()
  let tour
  try {
    ;({ tour } = await loadTour())
  } catch (error) {
    document.getElementById('boot').textContent = 'Data tur tidak dapat dimuat. Muat ulang halaman.'
    console.error(error)
    return
  }
  document.getElementById('boot').remove()

  // ---------- Pemilihan ruang ----------
  const enterPano = (id) => go('tur', id)
  const pickRoom = (id) => {
    setRoom(id)
    if (state.mode !== 'maket' && state.mode !== 'denah') go(webgl ? 'maket' : 'denah')
  }

  const panel = createPanel({
    tour, webgl, pickRoom, enterPano,
    togglePanelOpen: () => panel.setOpen(panel.el.dataset.open !== 'true'),
  })
  const card = createCard({
    tour, webgl, enterPano,
    onClose: () => setRoom(null),
    onSwitchView: (mode) => go(mode),
  })

  // ---------- Tampilan ----------
  const stage = h('main', { id: 'stage', tabindex: '-1' })
  const viewMaket = h('section', { id: 'view-maket', class: 'view', 'aria-label': 'Maket 3D' })
  const viewDenah = h('section', { id: 'view-denah', class: 'view', 'aria-label': 'Denah' })
  const viewTur = h('section', { id: 'view-tur', class: 'view', 'aria-label': 'Tur 360 derajat' })
  const viewGaleri = h('section', { id: 'view-galeri', class: 'view', 'aria-label': 'Galeri' })
  stage.append(viewMaket, viewDenah, viewTur, viewGaleri)
  app.append(stage, panel.chip, panel.el, card.el)

  const plan = createPlan({ host: viewDenah, tour, onSelect: pickRoom })
  createGallery({ host: viewGaleri, items: tour.gallery })

  // Kartu: di dalam panel (desktop) atau melayang di atas lembar bawah (HP).
  const wide = matchMedia('(min-width: 900px)')
  const mountCard = () => {
    if (wide.matches) panel.cardSlot.append(card.el)
    else app.append(card.el)
    syncCard()
  }
  function syncCard() {
    const showing = !!state.roomId && (state.mode === 'maket' || state.mode === 'denah')
    const room = tour.roomById.get(state.roomId)
    if (showing && room) card.show(room, state.mode)
    else card.hide()
    panel.cardSlot.hidden = !(showing && room && wide.matches)
  }
  wide.addEventListener('change', () => { mountCard(); maketApi?.then((m) => m.resize()) })

  // ---------- Maket (lazy) ----------
  const poster = h('img', { class: 'poster', src: url(tour.maket.poster), alt: 'Poster maket potong klinik Provenza Dental', decoding: 'async' })
  const canvasHost = h('div', { class: 'maket-canvas' })
  const labelHost = h('div', { class: 'labels' })
  const status = h('div', { class: 'status', role: 'status' }, h('span', {}, 'Memuat maket 3D…'), h('span', { class: 'bar' }, h('i')))
  let showPins = true
  try { showPins = localStorage.getItem('provenza-maket-angka') !== '0' } catch { /* abaikan */ }
  labelHost.classList.toggle('no-pins', !showPins)
  const pinsBtn = toolButton('Angka ruang (H)', icons.pins, () => setPins(!showPins))
  pinsBtn.setAttribute('aria-label', 'Angka ruang')
  pinsBtn.setAttribute('aria-pressed', String(showPins))
  const shotBtn = toolButton('Ambil gambar (P)', icons.camera, () => capture())
  shotBtn.setAttribute('aria-label', 'Ambil gambar')
  const feedback = createSnapshotFeedback()
  const tools = h('div', { class: 'stage-tools' },
    toolButton('Atur ulang tampilan', icons.reset, () => maketApi?.then((m) => m.reset())),
    toolButton('Perbesar', icons.plus, () => maketApi?.then((m) => m.zoom(1.3))),
    toolButton('Perkecil', icons.minus, () => maketApi?.then((m) => m.zoom(1 / 1.3))),
    pinsBtn, shotBtn,
  )
  tools.hidden = true
  viewMaket.append(poster, canvasHost, labelHost, tools, feedback.flash, feedback.toast, status)

  function setPins(on) {
    showPins = on
    pinsBtn.setAttribute('aria-pressed', String(on))
    labelHost.classList.toggle('no-pins', !on)
    try { localStorage.setItem('provenza-maket-angka', on ? '1' : '0') } catch { /* abaikan */ }
  }
  function capture() {
    maketApi?.then((m) => { if (m.capture?.()) feedback.notify() })
  }
  poster.addEventListener('error', () => {
    poster.remove()
    viewMaket.prepend(h('div', { class: 'fallback-art' }, h('strong', {}, 'Provenza Dental')))
  })

  function toolButton(label, icon, onclick) {
    return h('button', { class: 'icon-btn tool', type: 'button', 'aria-label': label, title: label, onclick, html: icon })
  }

  function showWarning(text) {
    status.className = 'status warn'
    status.replaceChildren(h('span', {}, text), h('button', { type: 'button', onclick: () => go('denah') }, 'Buka denah'))
  }

  let maketApi = null
  function ensureMaket() {
    if (maketApi || !webgl) return
    maketApi = (async () => {
      if (!poster.complete) await new Promise((r) => { poster.addEventListener('load', r, { once: true }); poster.addEventListener('error', r, { once: true }); setTimeout(r, 2500) })
      const { createMaket } = await import('./viewers/maket.js')
      const api = await createMaket({
        host: canvasHost, labelHost, tour,
        onSelect: pickRoom,
        onProgress: (p) => status.querySelector('i')?.style.setProperty('width', Math.round(p * 100) + '%'),
        getInsets: panelInsets,
      })
      viewMaket.classList.add('is-live')
      tools.hidden = false
      if (api.usedFallback) showWarning('Model 3D belum tersedia. Menampilkan maket sederhana dari data denah.')
      else status.hidden = true
      panel.setRoofAvailable(!!api.hasRoof)
      api.setLayers(state.layers)
      api.select(state.roomId)
      api.setActive(state.mode === 'maket')
      return api
    })().catch((error) => {
      console.error(error)
      showWarning('Maket 3D tidak dapat ditampilkan di perangkat ini.')
      return stub
    })
  }
  const stub = { setActive() {}, select() {}, setLayers() {}, reset() {}, zoom() {}, resize() {}, capture: () => false }

  function panelInsets() {
    const rect = panel.el.getBoundingClientRect()
    if (state.mode === 'tur' || !rect.width) return { left: 0, bottom: 0 }
    if (wide.matches) return { left: rect.right, bottom: 0 }
    return { left: 0, bottom: 140 } // tinggi lembar bawah saat tertutup
  }

  // ---------- Tur 360° (lazy) ----------
  let tourApi = null
  function ensureTour() {
    return (tourApi ??= import('./viewers/tour.js').then(({ createTour }) =>
      createTour({
        host: viewTur, tour,
        navigate: (id) => go('tur', id),
        exit: () => go(state.prevMode === 'tur' ? 'maket' : state.prevMode),
      }),
    ).catch((error) => {
      console.error(error)
      tourApi = null
      go('denah')
      return null
    }))
  }

  // ---------- Rute ----------
  let routeToken = 0
  on('route', async ({ mode, arg }) => {
    const token = ++routeToken
    if (!webgl && (mode === 'maket' || mode === 'tur')) return go('denah')
    if (mode === 'tur' && !tour.panoById.has(arg)) return go('tur', (tour.roomById.get(state.roomId)?.pano) ?? tour.panoOrder[0])

    const previous = state.mode
    if (mode === 'tur' && previous !== 'tur') state.prevMode = previous
    state.mode = mode
    app.dataset.mode = mode
    panel.setMode(mode)
    if (mode !== 'tur') {
      tourApi?.then((t) => t?.leave())
      panel.setOpen(false)
    }

    if (mode === 'maket') {
      ensureMaket()
      maketApi?.then((m) => m.setActive(true))
    } else {
      maketApi?.then((m) => m.setActive(false))
    }
    if (mode === 'denah' && !state.layersTouched && state.layers.zones.size === 0) {
      presetLayers(tour.zones.filter((z) => (tour.zoneRects.get(z.id) ?? []).length).map((z) => z.id))
    }
    syncCard()
    if (mode === 'tur') {
      state.panoId = arg
      const t = await ensureTour()
      if (t && token === routeToken) t.enter(arg)
    } else if (previous !== mode) {
      stage.focus({ preventScroll: true })
    }
    document.title = mode === 'tur' ? `${tour.panoById.get(arg).label} — Provenza Dental` : 'Provenza Dental — Tur Klinik Interaktif'
  })

  on('room', (id) => {
    if (id && state.mode === 'maket') setRoof(false)
    plan.select(id)
    maketApi?.then((m) => m.select(id))
    panel.setCurrentRoom(id)
    syncCard()
  })
  on('layers', (layers) => {
    plan.setLayers(layers)
    maketApi?.then((m) => m.setLayers(layers))
  })
  plan.setLayers(state.layers)

  mountCard()
  addEventListener('keydown', (e) => {
    if (state.mode === 'maket' && !tools.hidden && isPlainShortcut(e) && !document.querySelector('dialog[open]')) {
      const k = e.key.toLowerCase()
      if (k === 'h') { setPins(!showPins); return }
      if (k === 'p') { capture(); return }
    }
    if (e.key === 'Escape' && state.roomId && state.mode !== 'tur' && !document.querySelector('dialog[open]')) setRoom(null)
  })

  // Mulai: tanpa hash -> Maket (atau Denah bila WebGL tidak ada).
  if (!location.hash) history.replaceState(null, '', webgl ? '#/maket' : '#/denah')
  startRouter()
}

boot()
