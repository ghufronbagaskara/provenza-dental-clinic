// Tur 360°: bola terbalik + kamera di pusat. Render on demand (rAF hanya saat ada gerak).
// Konvensi: yaw dalam derajat, 0 = utara, searah jarum jam dari atas. Dunia three: utara = -Z, timur = +X.
import {
  BackSide, CanvasTexture, Mesh, MeshBasicMaterial, PerspectiveCamera, Scene, SphereGeometry,
  SRGBColorSpace, Texture, Vector3, WebGLRenderer,
} from 'three'
import { clamp, h, rad, reducedMotion } from '../dom.js'
import { icons } from '../icons.js'
import { url } from '../data.js'
import { captureCanvas, createSnapshotFeedback, isPlainShortcut, stampName } from '../snapshot.js'
import { createMinimap } from './minimap.js'
import { testPanoCanvas } from './procedural.js'

// Tanda untuk northYawDeg: +1 = utara tampak di sudut gambar `northYawDeg` dari tengah (searah jarum jam).
const NORTH_SIGN = 1
const FOV_MIN = 35
const FOV_MAX = 90
const PITCH_MAX = 85
const FADE_MS = 360

const dirOf = (yawDeg, pitchDeg, out = new Vector3()) => {
  const y = rad(yawDeg)
  const p = rad(pitchDeg)
  return out.set(Math.sin(y) * Math.cos(p), Math.sin(p), -Math.cos(y) * Math.cos(p))
}
const wrap180 = (a) => ((((a + 180) % 360) + 360) % 360) - 180

async function loadImageTexture(src) {
  const res = await fetch(src)
  if (!res.ok) throw new Error(src + ' ' + res.status)
  const blob = await res.blob()
  const bitmap = await createImageBitmap(blob, { imageOrientation: 'flipY' })
  const tex = new Texture(bitmap)
  tex.flipY = false
  tex.colorSpace = SRGBColorSpace
  tex.needsUpdate = true
  return tex
}

let showHints = true
try { showHints = localStorage.getItem('provenza-tur-petunjuk') !== '0' } catch { /* abaikan */ }

export function createTour({ host, tour, navigate, exit }) {
  const renderer = new WebGLRenderer({ antialias: false, powerPreference: 'high-performance' })
  const coarse = matchMedia('(pointer: coarse)').matches || innerWidth < 900
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, coarse ? 1.5 : 2))
  const maxTex = renderer.capabilities.maxTextureSize
  // Tier panorama: HP/layar kecil -> mobile; desktop -> full bila GPU kuat.
  const tiers = maxTex < 4096 ? [] : coarse || maxTex < 6144 ? ['mobile'] : ['full', 'mobile']

  const scene = new Scene()
  const camera = new PerspectiveCamera(72, 1, 0.1, 1100)
  camera.rotation.order = 'YXZ'
  const geometry = new SphereGeometry(500, 64, 40)
  const slots = [0, 1].map((i) => {
    const material = new MeshBasicMaterial({ side: BackSide, transparent: true, depthWrite: false, opacity: 1 })
    const mesh = new Mesh(geometry, material)
    mesh.scale.x = -1
    mesh.renderOrder = i
    mesh.visible = false
    scene.add(mesh)
    return { mesh, material, hires: null, cachedId: null }
  })
  let front = 0

  // ---------- DOM ----------
  const canvas = renderer.domElement
  canvas.tabIndex = 0
  canvas.setAttribute('aria-label', 'Panorama 360 derajat. Tombol panah menoleh, plus dan minus memperbesar atau memperkecil.')
  const canvasBox = h('div', { class: 'tour-canvas' }, canvas)
  const hotspotLayer = h('div', { class: 'hotspots' })
  hotspotLayer.classList.toggle('no-info', !showHints)
  const kicker = h('small', {}, 'Tur 360°')
  const titleText = h('strong', {})
  const note = h('div', { class: 'tour-fail', hidden: true, role: 'status' }, 'Panorama uji: berkas gambar belum tersedia')
  const loading = h('div', { class: 'tour-loading', hidden: true, role: 'status' }, 'Memuat resolusi penuh')
  const menu = h('div', { class: 'tour-menu', hidden: true, role: 'dialog', 'aria-label': 'Daftar panorama' })
  const menuBtn = h('button', { class: 'btn', type: 'button', 'aria-expanded': 'false', onclick: () => toggleMenu() }, h('span', { html: icons.list }), h('span', {}, 'Ruang'))
  const exitBtn = h('button', { class: 'btn exit', type: 'button', onclick: () => exit() }, h('span', { html: icons.exit }), h('span', {}, 'Keluar'))
  const hintBtn = h('button', { class: 'btn tbtn', type: 'button', 'aria-pressed': String(showHints), 'aria-label': 'Petunjuk', title: 'Petunjuk (H)', onclick: () => setHints(!showHints) }, h('span', { html: icons.hint }), h('span', { class: 'lbl' }, 'Petunjuk'))
  const shotBtn = h('button', { class: 'btn tbtn', type: 'button', 'aria-label': 'Ambil gambar', title: 'Ambil gambar (P)', onclick: () => capture() }, h('span', { html: icons.camera }), h('span', { class: 'lbl' }, 'Ambil gambar'))
  const feedback = createSnapshotFeedback()
  const { flash, toast } = feedback
  const prevBtn = h('button', { class: 'btn', type: 'button', 'aria-label': 'Panorama sebelumnya', onclick: () => step(-1) }, h('span', { html: icons.prev }), h('span', {}, 'Sebelumnya'))
  const nextBtn = h('button', { class: 'btn', type: 'button', 'aria-label': 'Panorama berikutnya', onclick: () => step(1) }, h('span', {}, 'Berikutnya'), h('span', { html: icons.next }))
  const minimap = createMinimap({ tour, onJump: (id) => navigate(id) })

  host.append(
    canvasBox, hotspotLayer,
    h('div', { class: 'tour-top' }, h('div', { class: 'tour-title' }, kicker, titleText), h('div', { class: 'tour-actions' }, hintBtn, shotBtn, menuBtn, exitBtn)),
    flash, toast, note, loading, minimap.el, h('div', { class: 'tour-nav' }, prevBtn, nextBtn), menu,
  )

  for (const pano of tour.panos) {
    const row = h('div', { class: 'room-row', 'data-pano': pano.id },
      h('button', { class: 'room-main', type: 'button', onclick: () => { toggleMenu(false); navigate(pano.id) } },
        h('span', { class: 'room-name' }, pano.label)))
    menu.append(row)
  }
  function toggleMenu(force) {
    const open = force ?? menu.hidden
    menu.hidden = !open
    menuBtn.setAttribute('aria-expanded', String(open))
    if (open) menu.querySelector('.is-current .room-main, .room-main')?.focus()
  }

  // ---------- Tekstur ----------
  const previews = new Map() // id -> { tex, fake }
  const fakeIds = new Set()
  async function previewOf(pano) {
    if (previews.has(pano.id)) return previews.get(pano.id)
    let tex
    try {
      tex = await loadImageTexture(url(pano.files.preview))
    } catch {
      tex = new CanvasTexture(testPanoCanvas(pano.label, pano.northYawDeg ?? 0))
      tex.colorSpace = SRGBColorSpace
      fakeIds.add(pano.id)
    }
    previews.set(pano.id, tex)
    return tex
  }
  function trimCache(keep) {
    if (previews.size <= 9) return
    for (const [id, tex] of previews) {
      if (keep.has(id)) continue
      if (slots.some((s) => s.cachedId === id)) continue
      tex.dispose()
      previews.delete(id)
      if (previews.size <= 9) break
    }
  }
  function releaseSlot(slot) {
    slot.hires?.dispose()
    slot.hires = null
    slot.cachedId = null
    slot.material.map = null
    slot.mesh.visible = false
  }

  // ---------- Pandangan ----------
  const view = { yaw: 0, pitch: 0, fov: 72 }
  const baseFov = () => (camera.aspect < 1 ? 85 : 72)
  let width = 0
  let height = 0
  let active = false
  let rafId = 0
  let currentId = null
  let navSeq = 0
  let fade = null
  let tween = null
  const velocity = { yaw: 0, pitch: 0 }
  let inertiaOn = false

  function applyCamera() {
    view.pitch = clamp(view.pitch, -PITCH_MAX, PITCH_MAX)
    view.fov = clamp(view.fov, FOV_MIN, FOV_MAX)
    view.yaw = wrap180(view.yaw)
    camera.rotation.set(rad(view.pitch), -rad(view.yaw), 0)
    if (camera.fov !== view.fov) {
      camera.fov = view.fov
      camera.updateProjectionMatrix()
    }
  }

  function orient(slot, pano) {
    // Tengah gambar menghadap yaw dunia = -northYawDeg (utara tampak di sudut gambar northYawDeg).
    slot.mesh.rotation.y = rad(NORTH_SIGN * (pano.northYawDeg ?? 0) - 90)
  }

  // ---------- Hotspot ----------
  let hotspots = []
  const tmp = new Vector3()
  const forward = new Vector3()
  function buildHotspots(pano) {
    hotspotLayer.replaceChildren()
    hotspots = []
    for (const link of pano.links) {
      const target = tour.panoById.get(link.to)
      const el = h('button', { class: 'hs nav', type: 'button', 'aria-label': 'Pindah ke ' + target.label, onclick: () => navigate(link.to) },
        h('span', { class: 'hs-ring', html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 18V7M7 11.5l5-5 5 5"/></svg>' }),
        h('span', { class: 'hs-label' }, target.label))
      hotspots.push({ el, dir: dirOf(link.yawDeg, link.pitchDeg ?? -12), yaw: link.yawDeg, pitch: link.pitchDeg ?? -12, anchor: 'nav' })
    }
    for (const info of pano.info ?? []) {
      const el = h('button', { class: 'hs info', type: 'button', 'aria-expanded': 'false', 'aria-label': info.title,
        onclick: () => el.setAttribute('aria-expanded', String(el.getAttribute('aria-expanded') !== 'true')) },
        h('span', { class: 'hs-dot' }),
        h('span', { class: 'hs-label' }, h('span', {}, info.title), info.text ? h('span', { class: 'hs-text' }, info.text) : null))
      hotspots.push({ el, dir: dirOf(info.yawDeg, info.pitchDeg ?? 0), yaw: info.yawDeg, pitch: info.pitchDeg ?? 0, anchor: 'info' })
    }
    for (const hs of hotspots) {
      hs.el.addEventListener('focus', () => aimAt(hs.yaw, hs.pitch, false))
      hotspotLayer.append(hs.el)
    }
  }
  function updateHotspots() {
    camera.getWorldDirection(forward)
    for (const hs of hotspots) {
      const facing = hs.dir.dot(forward)
      tmp.copy(hs.dir).multiplyScalar(100).project(camera)
      const x = ((tmp.x + 1) / 2) * width
      const y = ((1 - tmp.y) / 2) * height
      const off = facing < 0.1 || x < -40 || x > width + 40 || y < -40 || y > height + 40
      hs.el.classList.toggle('is-off', off)
      if (off) continue
      const shift = hs.anchor === 'nav' ? 'translate(-50%, -27px)' : 'translate(-11px, -11px)'
      hs.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) ${shift}`
    }
  }

  // ---------- Render ----------
  function requestRender() {
    if (active && !rafId) rafId = requestAnimationFrame(frame)
  }
  let lastT = 0
  function frame(t) {
    rafId = 0
    if (!active || !width) return
    const dt = Math.min(t - (lastT || t), 64)
    lastT = t
    let more = false
    if (inertiaOn) {
      view.yaw += velocity.yaw * dt
      view.pitch += velocity.pitch * dt
      const decay = Math.exp(-dt / 325)
      velocity.yaw *= decay
      velocity.pitch *= decay
      if (Math.hypot(velocity.yaw, velocity.pitch) < 0.002) inertiaOn = false
      else more = true
    }
    if (tween) {
      const p = Math.min((t - tween.start) / tween.duration, 1)
      const e = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2
      view.yaw = tween.yaw0 + tween.dyaw * e
      view.pitch = tween.pitch0 + (tween.pitch1 - tween.pitch0) * e
      if (p >= 1) tween = null
      else more = true
    }
    if (fade) {
      const p = Math.min((t - fade.start) / FADE_MS, 1)
      slots[fade.to].material.opacity = p
      if (p >= 1) {
        const out = slots[fade.from]
        releaseSlot(out)
        fade = null
      } else more = true
    }
    applyCamera()
    renderer.render(scene, camera)
    updateHotspots()
    minimap.setView(view.yaw, view.fov)
    if (more) rafId = requestAnimationFrame(frame)
    else lastT = 0
  }

  function aimAt(yaw, pitch, instant) {
    if (instant || reducedMotion) {
      view.yaw = yaw
      view.pitch = pitch
      applyCamera()
      requestRender()
      return
    }
    // Hanya menoleh bila hotspot sedang di luar layar.
    const d = dirOf(yaw, pitch)
    camera.getWorldDirection(forward)
    if (d.dot(forward) > 0.75) return
    inertiaOn = false
    tween = { start: performance.now(), duration: 500, yaw0: view.yaw, dyaw: wrap180(yaw - view.yaw), pitch0: view.pitch, pitch1: pitch }
    requestRender()
  }

  // ---------- Masuk panorama ----------
  function show(pano, tex, withFade) {
    const to = withFade && slots[front].mesh.visible ? 1 - front : front
    const slot = slots[to]
    if (to === front && slot.hires) { slot.hires.dispose(); slot.hires = null }
    slot.material.map = tex
    slot.material.needsUpdate = true
    slot.cachedId = pano.id
    orient(slot, pano)
    slot.mesh.visible = true
    if (to !== front && !reducedMotion) {
      slot.material.opacity = 0
      fade = { start: performance.now(), from: front, to }
      front = to
    } else {
      slot.material.opacity = 1
      if (to !== front) { releaseSlot(slots[front]); front = to }
      else if (slots[1 - front].mesh.visible) releaseSlot(slots[1 - front])
    }
  }

  async function upgrade(pano, seq) {
    if (fakeIds.has(pano.id)) return
    for (const tier of tiers) {
      loading.hidden = false
      try {
        const tex = await loadImageTexture(url(pano.files[tier]))
        if (seq !== navSeq || !active) { tex.dispose(); break }
        const slot = slots[front]
        slot.hires?.dispose()
        slot.hires = tex
        slot.material.map = tex
        slot.material.needsUpdate = true
        requestRender()
        break
      } catch { /* coba tier berikutnya; preview tetap tampil */ }
    }
    if (seq === navSeq) loading.hidden = true
  }

  function preloadNeighbors(pano) {
    const keep = new Set([pano.id, ...pano.links.map((l) => l.to)])
    for (const id of keep) if (id !== pano.id) previewOf(tour.panoById.get(id)).catch(() => {})
    trimCache(keep)
  }

  async function enter(id) {
    active = true
    host.classList.add('is-active')
    resize()
    if (id === currentId) { requestRender(); return }
    const pano = tour.panoById.get(id)
    const prev = currentId ? tour.panoById.get(currentId) : null
    const seq = ++navSeq
    const link = prev?.links.find((l) => l.to === id)
    const tex = await previewOf(pano)
    if (seq !== navSeq) return
    currentId = id
    titleText.textContent = pano.label
    note.hidden = !fakeIds.has(id)
    loading.hidden = true
    menu.querySelectorAll('.room-row').forEach((row) => row.classList.toggle('is-current', row.dataset.pano === id))
    buildHotspots(pano)
    minimap.setPano(id)
    if (link) {
      // Lanjut berjalan: pandangan mengarah ke tempat hotspot tadi.
      view.yaw = link.yawDeg
      view.pitch = 0
    } else if (!prev) {
      view.yaw = 0
      view.pitch = 0
    }
    view.fov = baseFov()
    velocity.yaw = velocity.pitch = 0
    inertiaOn = false
    tween = null
    if (fade) { releaseSlot(slots[fade.from]); fade = null }
    show(pano, tex, !!prev)
    requestRender()
    upgrade(pano, seq)
    preloadNeighbors(pano)
  }

  function leave() {
    active = false
    host.classList.remove('is-active')
    cancelAnimationFrame(rafId)
    rafId = 0
    navSeq++
    fade = null
    tween = null
    // Bebaskan GPU: tekstur resolusi tinggi dibuang, preview tetap ada.
    for (const slot of slots) releaseSlot(slot)
    toggleMenu(false)
    currentId = null
  }

  function step(delta) {
    const order = tour.panoOrder
    const i = order.indexOf(currentId)
    navigate(order[(i + delta + order.length) % order.length])
  }

  // ---------- Input ----------
  const pointers = new Map()
  let pinchStart = null
  let lastMove = 0
  const degPerPx = () => view.fov / Math.max(height, 1)
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId)
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    inertiaOn = false
    tween = null
    velocity.yaw = velocity.pitch = 0
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()]
      pinchStart = { dist: Math.hypot(a.x - b.x, a.y - b.y), fov: view.fov }
    }
    lastMove = performance.now()
    menu.hidden || toggleMenu(false)
  })
  canvas.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId)
    if (!p) return
    const dx = e.clientX - p.x
    const dy = e.clientY - p.y
    p.x = e.clientX
    p.y = e.clientY
    if (pointers.size === 2 && pinchStart) {
      const [a, b] = [...pointers.values()]
      view.fov = pinchStart.fov * (pinchStart.dist / Math.max(Math.hypot(a.x - b.x, a.y - b.y), 1))
    } else if (pointers.size === 1) {
      const k = degPerPx()
      view.yaw -= dx * k
      view.pitch += dy * k
      const now = performance.now()
      const dt = Math.max(now - lastMove, 1)
      lastMove = now
      velocity.yaw = -(dx * k) / dt
      velocity.pitch = (dy * k) / dt
    }
    applyCamera()
    requestRender()
  })
  const release = (e) => {
    if (!pointers.delete(e.pointerId)) return
    pinchStart = null
    if (pointers.size === 0 && !reducedMotion && performance.now() - lastMove < 80 && Math.hypot(velocity.yaw, velocity.pitch) > 0.01) {
      inertiaOn = true
      requestRender()
    }
  }
  canvas.addEventListener('pointerup', release)
  canvas.addEventListener('pointercancel', release)
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault()
    view.fov += e.deltaY * 0.03
    applyCamera()
    requestRender()
  }, { passive: false })
  canvas.addEventListener('keydown', (e) => {
    const step = 6
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }
    if (moves[e.key]) { view.yaw += moves[e.key][0]; view.pitch += moves[e.key][1] }
    else if (e.key === '+' || e.key === '=') view.fov -= 5
    else if (e.key === '-' || e.key === '_') view.fov += 5
    else return
    e.preventDefault()
    applyCamera()
    requestRender()
  })
  function setHints(on) {
    showHints = on
    hintBtn.setAttribute('aria-pressed', String(on))
    hotspotLayer.classList.toggle('no-info', !on)
    try { localStorage.setItem('provenza-tur-petunjuk', on ? '1' : '0') } catch { /* abaikan */ }
    requestRender()
  }
  function capture() {
    if (!active || !width || !currentId) return
    captureCanvas({
      renderer, width, height, name: stampName(`provenza-${currentId}`),
      render: () => { applyCamera(); renderer.render(scene, camera) },
    })
    requestRender()
    feedback.notify()
  }
  addEventListener('keydown', (e) => {
    if (active && isPlainShortcut(e)) {
      const k = e.key.toLowerCase()
      if (k === 'h') { setHints(!showHints); return }
      if (k === 'p') { capture(); return }
    }
    if (!active || e.key !== 'Escape') return
    if (!menu.hidden) toggleMenu(false)
    else exit()
  })

  // ---------- Ukuran ----------
  function resize() {
    width = canvasBox.clientWidth
    height = canvasBox.clientHeight
    if (!width || !height) return
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    requestRender()
  }
  new ResizeObserver(resize).observe(canvasBox)
  renderer.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); active = false })
  renderer.domElement.addEventListener('webglcontextrestored', () => { active = true; requestRender() })
  document.addEventListener('visibilitychange', () => { if (!document.hidden) requestRender() })

  applyCamera()
  return { enter, leave }
}
