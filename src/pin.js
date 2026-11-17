// Pin bernomor ruang (HTML), dipakai di Maket dan Denah.
import { h } from './dom.js'

export function createPin(room, onSelect) {
  return h('button', {
    class: 'pin', type: 'button', 'data-room': room.id, 'aria-pressed': 'false',
    'aria-label': `Ruang ${room.no}: ${room.name}`,
    onclick: () => onSelect(room.id),
  }, h('span', { class: 'pin-no' }, room.no), h('span', { class: 'pin-name' }, room.name))
}
