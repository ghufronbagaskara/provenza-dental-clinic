// Minimap SVG: denah kecil dari data ruang, titik panorama, dan kerucut arah pandang.
import { h, svg } from '../dom.js'

export function createMinimap({ tour, onJump }) {
  // Batas gambar mencakup bangunan + semua titik panorama (termasuk yang di luar).
  let [x0, y0, x1, y1] = [0, 0, tour.building.width, tour.building.depth]
  for (const p of tour.panos) {
    x0 = Math.min(x0, p.position[0] - 1.5)
    x1 = Math.max(x1, p.position[0] + 1.5)
    y0 = Math.min(y0, p.position[1] - 1.5)
    y1 = Math.max(y1, p.position[1] + 1.5)
  }
  const sy = (y) => y1 - y // utara ke atas
  const roomRects = tour.rooms.map((r) => {
    const [x, y, w, d] = r.rect
    return svg('rect', { class: 'mm-room', x, y: sy(y + d), width: w, height: d })
  })
  const building = svg('rect', { class: 'mm-room', x: 0, y: sy(tour.building.depth), width: tour.building.width, height: tour.building.depth, fill: 'none', 'stroke-width': 0.22 })

  const cone = svg('path', { class: 'mm-cone', d: 'M0 0L-2.6 -4.6A5.3 5.3 0 0 1 2.6 -4.6Z' })
  const coneG = svg('g', { 'pointer-events': 'none' }, cone)
  const dots = new Map()
  const dotLayer = svg('g', {})
  for (const p of tour.panos) {
    const [x, y] = p.position
    const g = svg('g', { transform: `translate(${x} ${sy(y)})` })
    const dot = svg('circle', { class: 'mm-dot', r: 0.75 })
    const hit = svg('circle', {
      class: 'mm-dot-hit', r: 1.5, tabindex: 0, role: 'button', 'aria-label': 'Lompat ke ' + p.label,
    }, svg('title', {}, p.label))
    hit.addEventListener('click', () => onJump(p.id))
    hit.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onJump(p.id) } })
    g.append(dot, hit)
    dots.set(p.id, dot)
    dotLayer.append(g)
  }

  const root = svg('svg', { viewBox: `${x0} 0 ${x1 - x0} ${y1 - y0}`, role: 'group', 'aria-label': 'Minimap denah' }, ...roomRects, building, coneG, dotLayer)
  // Klik di area kosong: lompat ke titik panorama terdekat.
  root.addEventListener('click', (e) => {
    if (e.target.closest('.mm-dot-hit')) return
    const pt = root.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const p = pt.matrixTransform(root.getScreenCTM().inverse())
    let best = null
    let bestD = Infinity
    for (const pano of tour.panos) {
      const d = Math.hypot(pano.position[0] - p.x, sy(pano.position[1]) - p.y)
      if (d < bestD) { bestD = d; best = pano.id }
    }
    if (best && bestD < 6) onJump(best)
  })
  const el = h('div', { class: 'minimap' }, root)
  let currentId = null

  return {
    el,
    setPano(id) {
      currentId = id
      for (const [pid, dot] of dots) dot.classList.toggle('is-current', pid === id)
      const [x, y] = tour.panoById.get(id).position
      coneG.setAttribute('transform', `translate(${x} ${sy(y)})`)
    },
    // yaw dunia (derajat, 0 = utara, searah jarum jam) sama dengan rotasi SVG
    setView(yawDeg, fovDeg) {
      if (!currentId) return
      const s = Math.tan((fovDeg * Math.PI) / 360) / Math.tan((60 * Math.PI) / 360)
      const [x, y] = tour.panoById.get(currentId).position
      coneG.setAttribute('transform', `translate(${x} ${sy(y)}) rotate(${yawDeg}) scale(${s.toFixed(3)} 1)`)
    },
  }
}
