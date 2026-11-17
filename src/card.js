// Kartu ruang: nama, luas, fungsi, isi, dan tombol Masuk 360°.
import { h, fmt } from './dom.js'
import { icons } from './icons.js'

export function createCard({ tour, webgl, enterPano, onClose, onSwitchView }) {
  const el = h('section', { class: 'card', 'aria-live': 'polite', hidden: true })

  function show(room, mode) {
    const zone = tour.zoneById.get(room.zone)
    const otherView = mode === 'denah' ? 'maket' : 'denah'
    const canOther = otherView === 'denah' || webgl
    el.replaceChildren(...[
      h('div', { class: 'card-head' }, h('span', { class: 'no' }, room.no), h('h2', {}, room.name)),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Tutup kartu ruang', onclick: onClose, html: icons.close }),
      h('div', { class: 'card-meta' },
        h('span', {}, fmt(room.area) + ' m²'),
        zone ? h('span', {}, h('i', { class: 'swatch', style: `background:${zone.color}` }), zone.label) : null),
      h('p', {}, room.description),
      room.equipment?.length ? h('ul', { class: 'tags', 'aria-label': 'Isi ruang' }, room.equipment.map((item) => h('li', {}, item))) : null,
      h('div', { class: 'card-actions' },
        room.pano && webgl
          ? h('button', { class: 'btn primary', type: 'button', onclick: () => enterPano(room.pano), html: icons.enter + '<span>Masuk 360°</span>' })
          : null,
        canOther ? h('button', { class: 'btn', type: 'button', onclick: () => onSwitchView(otherView) }, 'Lihat di ' + otherView) : null),
      !room.pano ? h('p', { class: 'card-note' }, 'Tidak ada panorama 360° karena ruangnya terlalu sempit.') : null,
    ].filter(Boolean))
    el.hidden = false
  }
  function hide() { el.hidden = true }
  return { el, show, hide }
}
