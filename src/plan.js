// Denah 2D: gambar plan.webp + overlay SVG (zona, ruang bebas, alur) + pin ruang HTML.
// viewBox SVG = plan.bounds dalam meter; sumbu Y layout (utara) dibalik ke bawah gambar.
import { h, svg } from './dom.js'
import { createPin } from './pin.js'
import { url } from './data.js'

export function createPlan({ host, tour, onSelect }) {
  const [xmin, ymin, xmax, ymax] = tour.plan.bounds
  const w = xmax - xmin
  const d = ymax - ymin
  const pct = (x, y) => `left:${(((x - xmin) / w) * 100).toFixed(3)}%;top:${(((ymax - y) / d) * 100).toFixed(3)}%`
  const sy = (y) => -y
  const rect = ([x, y, rw, rd], attrs) => svg('rect', { x, y: sy(y + rd), width: rw, height: rd, ...attrs })

  const img = h('img', { src: url(tour.plan.image), alt: 'Denah klinik Provenza Dental tampak atas', draggable: 'false' })
  img.addEventListener('error', () => img.remove())

  const zoneGroups = new Map()
  const zonesLayer = svg('g', { 'pointer-events': 'none' })
  for (const zone of tour.zones) {
    const g = svg('g', { 'data-zone': zone.id, class: 'zone-rect', opacity: 0, fill: zone.color, stroke: zone.color, 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke' },
      (tour.zoneRects.get(zone.id) ?? []).map((r) => rect(r, { 'fill-opacity': 0.5, 'vector-effect': 'non-scaling-stroke' })))
    zoneGroups.set(zone.id, g)
    zonesLayer.append(g)
  }

  const clearLayer = svg('g', { 'pointer-events': 'none', display: 'none' },
    tour.clearances.map((c) => svg('g', {}, svg('title', {}, c.label), rect(c.rect, { class: 'clear-rect' }))))

  const flowLayers = new Map()
  const flowsLayer = svg('g', { 'pointer-events': 'none' })
  for (const flow of tour.flows) {
    const g = svg('g', { display: 'none' }, svg('polyline', {
      class: 'flow-line' + (flow.dashed ? ' dashed' : ''), stroke: flow.color,
      points: flow.points.map(([x, y]) => `${x},${sy(y)}`).join(' '),
    }, svg('title', {}, flow.label)))
    flowLayers.set(flow.id, { g, group: flow.group })
    flowsLayer.append(g)
  }

  const hits = new Map()
  const hitLayer = svg('g', {})
  for (const room of tour.rooms) {
    const r = rect(room.rect, { class: 'hit', 'data-room': room.id })
    r.addEventListener('click', () => onSelect(room.id))
    hits.set(room.id, r)
    hitLayer.append(r)
  }

  const defs = svg('defs', {}, svg('pattern', { id: 'hatch', width: 0.35, height: 0.35, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' },
    svg('rect', { width: 0.35, height: 0.35, fill: 'rgba(216,195,154,0.35)' }),
    svg('line', { x1: 0, y1: 0, x2: 0, y2: 0.35, stroke: '#a8733f', 'stroke-width': 0.06 })))

  // Latar cadangan bila gambar denah tidak ada: gedung digambar dari data.
  const fallback = svg('g', { 'pointer-events': 'none' },
    svg('rect', { x: xmin, y: sy(ymax), width: w, height: d, fill: '#f1ece3' }),
    rect([0, 0, tour.building.width, tour.building.depth], { fill: '#faf8f4', stroke: '#17382c', 'stroke-width': 0.2 }),
    tour.rooms.map((r) => rect(r.rect, { fill: 'none', stroke: '#b7ab9c', 'stroke-width': 0.08 })))

  const svgEl = svg('svg', { viewBox: `${xmin} ${sy(ymax)} ${w} ${d}`, preserveAspectRatio: 'none', role: 'presentation' },
    defs, zonesLayer, clearLayer, flowsLayer, hitLayer)
  // Urutan lapisan: latar cadangan (SVG), gambar denah, overlay SVG, pin.
  const frame = h('div', { class: 'plan-frame', style: `--ratio:${w / d}` }, svgEl)
  svgEl.before(img)
  const bg = svg('svg', { viewBox: svgEl.getAttribute('viewBox'), preserveAspectRatio: 'none', 'aria-hidden': 'true' }, fallback)
  frame.prepend(bg)

  const pins = new Map()
  for (const room of tour.rooms) {
    const pin = createPin(room, onSelect)
    const [x, y, rw, rd] = room.rect
    pin.setAttribute('style', pct(x + rw / 2, y + rd / 2))
    pins.set(room.id, pin)
    frame.append(pin)
  }
  host.append(frame)

  return {
    select(id) {
      for (const [rid, r] of hits) r.classList.toggle('is-selected', rid === id)
      for (const [rid, p] of pins) p.setAttribute('aria-pressed', String(rid === id))
    },
    setLayers(layers) {
      for (const [id, g] of zoneGroups) g.setAttribute('opacity', layers.zones.has(id) ? 1 : 0)
      for (const { g, group } of flowLayers.values()) g.setAttribute('display', layers.flows.has(group) ? 'inline' : 'none')
      clearLayer.setAttribute('display', layers.clearance ? 'inline' : 'none')
    },
  }
}
