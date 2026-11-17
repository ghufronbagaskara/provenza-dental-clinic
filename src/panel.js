// Panel samping (desktop) / lembar bawah (HP): identitas, mode, lapisan, daftar ruang, ergonomi.
import { h, svg, fmt } from './dom.js'
import { icons, logo } from './icons.js'
import { go, on, state, toggleClearance, toggleFlow, toggleZone, toggleRoof, setAllZones } from './state.js'

const MODE_LABEL = { maket: 'Maket', denah: 'Denah', tur: 'Tur 360°', galeri: 'Galeri' }

// Zona jam di sekeliling dental unit: jam 12 = ujung kepala pasien, searah jarum jam dari atas.
const CLOCK = [
  { from: 7, to: 12, label: 'Operator', hours: 'jam 7–12', color: '#17382c' },
  { from: 12, to: 14, label: 'Statis', hours: 'jam 12–2', color: '#a8733f' },
  { from: 2, to: 4, label: 'Asisten', hours: 'jam 2–4', color: '#b7ab9c' },
  { from: 4, to: 7, label: 'Transfer', hours: 'jam 4–7', color: '#d8c39a' },
]

function clockSvg() {
  const c = 56
  const point = (hour, r) => {
    const a = (hour * 30 * Math.PI) / 180
    return [c + r * Math.sin(a), c - r * Math.cos(a)]
  }
  const arc = ({ from, to, color }) => {
    const [x0, y0] = point(from, 50)
    const [x1, y1] = point(to, 50)
    const [x2, y2] = point(to, 31)
    const [x3, y3] = point(from, 31)
    const span = (((to - from) % 12) + 12) % 12
    const large = span > 6 ? 1 : 0
    return svg('path', {
      d: `M${x0} ${y0}A50 50 0 ${large} 1 ${x1} ${y1}L${x2} ${y2}A31 31 0 ${large} 0 ${x3} ${y3}Z`,
      fill: color, stroke: '#f6f3ee', 'stroke-width': 1.5,
    })
  }
  return svg('svg', { viewBox: '0 0 112 112', width: 112, height: 112, role: 'img', 'aria-label': 'Zona jam kerja di sekeliling dental unit' },
    ...CLOCK.map(arc),
    svg('rect', { x: 46, y: 40, width: 20, height: 32, rx: 7, fill: '#f6f3ee', stroke: '#17382c', 'stroke-width': 1.2 }),
  )
}

function ergonomics() {
  return h('details', { class: 'ergo' },
    h('summary', {}, 'Ketentuan ergonomi'),
    h('div', { class: 'ergo-body' },
      h('div', { class: 'clock' },
        clockSvg(),
        h('ul', {}, CLOCK.map((z) => h('li', {}, h('i', { class: 'swatch', style: `background:${z.color}` }), h('span', {}, h('b', {}, z.label), ' ', z.hours)))),
      ),
      h('ul', {},
        h('li', {}, 'Bebas minimal 1,0 m di belakang sandaran kepala.'),
        h('li', {}, 'Jendela lebar bervitrase di sisi dental unit.'),
        h('li', {}, 'Dental unit lurus, sejajar dinding.'),
      ),
    ),
  )
}

export function createPanel({ tour, webgl, pickRoom, enterPano, togglePanelOpen }) {
  const defaultPano = () => (state.roomId && tour.roomById.get(state.roomId)?.pano) || tour.panoOrder[0]
  const modeButtons = {}
  const nav = h('nav', { class: 'modes', 'aria-label': 'Mode tampilan' },
    Object.keys(MODE_LABEL).map((mode) => {
      const disabled = !webgl && (mode === 'maket' || mode === 'tur')
      const btn = h('button', {
        class: 'mode', type: 'button', 'data-mode': mode,
        'aria-disabled': disabled ? 'true' : null,
        title: disabled ? 'Membutuhkan WebGL, tidak tersedia di peramban ini' : null,
        onclick: () => (disabled ? null : go(mode, mode === 'tur' ? (state.panoId ?? defaultPano()) : null)),
      }, h('span', { html: icons[mode] }), MODE_LABEL[mode])
      modeButtons[mode] = btn
      return btn
    }),
  )

  // --- lapisan
  const usedZones = tour.zones.filter((z) => (tour.zoneRects.get(z.id) ?? []).length)
  const zoneIds = usedZones.map((z) => z.id)
  const zoneSwitch = h('button', { class: 'switch', type: 'button', 'aria-pressed': 'false', onclick: () => setAllZones(zoneIds, state.layers.zones.size === 0) },
    h('span', { class: 'track' }), 'Zona')
  const chips = usedZones.map((z) => ({
    id: z.id,
    el: h('button', { class: 'chip', type: 'button', 'aria-pressed': 'false', onclick: () => toggleZone(z.id) },
      h('i', { class: 'swatch', style: `background:${z.color}` }), z.label),
  }))
  const legend = h('div', { class: 'legend', role: 'group', 'aria-label': 'Legenda zona', hidden: true }, chips.map((c) => c.el))
  const flowSwitches = tour.flowGroups.map((f) => ({
    id: f.id,
    el: h('button', { class: 'switch', type: 'button', 'aria-pressed': 'false', onclick: () => toggleFlow(f.id) },
      h('span', { class: 'track' }), h('i', { class: 'swatch line' + (f.dashed ? ' dash' : ''), style: `border-color:${f.color}` }), f.label),
  }))
  const clearSwitch = tour.clearances.length
    ? h('button', { class: 'switch', type: 'button', 'aria-pressed': 'false', onclick: toggleClearance },
      h('span', { class: 'track' }),
      h('i', { class: 'swatch', style: 'background:repeating-linear-gradient(45deg,#d8c39a,#d8c39a 2px,#f6f3ee 2px,#f6f3ee 4px);border-color:#a8733f' }),
      '≥ 1,0 m bebas (dental unit)')
    : null
  const roofSwitch = h('button', { class: 'switch', type: 'button', 'aria-pressed': 'true', hidden: true, onclick: toggleRoof },
    h('span', { class: 'track' }), 'Atap')
  let roofAvailable = false
  let curMode = 'maket'
  const syncRoof = () => { roofSwitch.hidden = !(roofAvailable && curMode === 'maket') }
  const layers = h('section', { class: 'section', 'aria-labelledby': 'h-lapisan' },
    h('h2', { id: 'h-lapisan' }, 'Lapisan'), roofSwitch, zoneSwitch, legend, flowSwitches.map((f) => f.el), clearSwitch)

  // --- daftar ruang
  const rows = new Map()
  const roomRow = (r) => {
    const row = h('li', { class: 'room-row' },
      h('button', { class: 'room-main', type: 'button', onclick: () => pickRoom(r.id) },
        h('span', { class: 'no' }, r.no), h('span', { class: 'room-name' }, r.name), h('span', { class: 'room-area' }, fmt(r.area) + ' m²')),
      r.pano && webgl
        ? h('button', { class: 'room-360', type: 'button', 'aria-label': 'Masuk 360° ' + r.name, title: 'Masuk 360°', onclick: () => enterPano(r.pano), html: icons.enter })
        : null,
    )
    rows.set(r.id, row)
    return row
  }
  const outsidePanos = tour.panos.filter((p) => !p.room || !tour.roomById.has(p.room))
  const list = h('section', { class: 'section room-list', 'aria-labelledby': 'h-ruang' },
    h('h2', { id: 'h-ruang' }, 'Ruang'),
    h('ul', {}, tour.rooms.map(roomRow)),
    outsidePanos.length && webgl
      ? [h('h3', {}, 'Di luar bangunan'),
        h('ul', {}, outsidePanos.map((p) => {
          const row = h('li', { class: 'room-row' },
            h('button', { class: 'room-main', type: 'button', onclick: () => enterPano(p.id), 'aria-label': p.label + ', masuk 360°' },
              h('span', { class: 'no', html: icons.tur.replace('width="20" height="20"', 'width="14" height="14"') }),
              h('span', { class: 'room-name' }, p.label)))
          rows.set('pano:' + p.id, row)
          return row
        }))]
      : null)

  const cardSlot = h('div', { class: 'card-slot', hidden: true })
  const ergo = h('section', { class: 'section' }, ergonomics())
  const note = h('section', { class: 'section' }, h('p', { class: 'note' }, 'Ukuran konseptual, bukan gambar konstruksi.'))

  const handle = h('button', { class: 'handle', type: 'button', 'aria-expanded': 'false', 'aria-controls': 'panel-body', onclick: () => togglePanelOpen() },
    h('span', {}, 'Lapisan dan daftar ruang'), h('span', { html: icons.chevron }))
  const body = h('div', { class: 'panel-body', id: 'panel-body' }, h('div', { class: 'panel-scroll' }, cardSlot, layers, list, ergo, note))

  const el = h('aside', { class: 'panel', 'data-open': 'false', 'aria-label': 'Panel tur' },
    h('header', { class: 'brand' }, h('span', { html: logo }),
      h('div', { class: 'brand-text' }, h('span', { class: 'wordmark' }, 'Provenza', h('small', {}, 'Dental')))),
    handle, body, nav)

  const chip = h('div', { class: 'brand-chip' }, h('span', { html: logo }), h('span', { class: 'wordmark' }, 'Provenza Dental'))

  function setOpen(open) {
    el.dataset.open = String(open)
    handle.setAttribute('aria-expanded', String(open))
  }
  const sync = (s) => {
    zoneSwitch.setAttribute('aria-pressed', String(s.zones.size > 0))
    legend.hidden = s.zones.size === 0
    for (const c of chips) c.el.setAttribute('aria-pressed', String(s.zones.has(c.id)))
    for (const f of flowSwitches) f.el.setAttribute('aria-pressed', String(s.flows.has(f.id)))
    clearSwitch?.setAttribute('aria-pressed', String(s.clearance))
    roofSwitch.setAttribute('aria-pressed', String(s.roof !== false))
  }
  on('layers', sync)
  sync(state.layers)

  function setMode(mode) {
    curMode = mode
    syncRoof()
    for (const [m, btn] of Object.entries(modeButtons)) {
      if (m === mode) btn.setAttribute('aria-current', 'page')
      else btn.removeAttribute('aria-current')
    }
    layers.hidden = mode === 'galeri' || mode === 'tur'
  }
  function setCurrentRoom(id) {
    for (const [key, row] of rows) row.classList.toggle('is-current', key === id)
  }
  const setRoofAvailable = (v) => { roofAvailable = v; syncRoof() }
  return { el, chip, cardSlot, setMode, setOpen, setCurrentRoom, setRoofAvailable }
}
