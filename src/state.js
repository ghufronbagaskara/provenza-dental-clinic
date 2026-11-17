// Status aplikasi + pub/sub kecil + routing hash (#/maket, #/denah, #/tur/<id>, #/galeri).
const listeners = {}
export const on = (event, fn) => (listeners[event] ??= new Set()).add(fn)
export const emit = (event, payload) => listeners[event]?.forEach((fn) => fn(payload))

export const state = {
  mode: 'maket',
  prevMode: 'maket',
  roomId: null,
  panoId: null,
  layers: { zones: new Set(), flows: new Set(), clearance: false, roof: true },
  layersTouched: false,
}

export const MODES = ['maket', 'denah', 'tur', 'galeri']

export function parseHash() {
  const [, mode, arg] = location.hash.split('/')
  return { mode: MODES.includes(mode) ? mode : 'maket', arg: arg ? decodeURIComponent(arg) : null }
}

export function go(mode, arg) {
  const hash = '#/' + mode + (arg ? '/' + encodeURIComponent(arg) : '')
  if (location.hash === hash) emit('route', parseHash())
  else location.hash = hash
}

export function startRouter() {
  addEventListener('hashchange', () => emit('route', parseHash()))
  emit('route', parseHash())
}

export function setRoom(id) {
  if (state.roomId === id) return
  state.roomId = id
  emit('room', id)
}

function layersChanged(userAction = true) {
  if (userAction) state.layersTouched = true
  emit('layers', state.layers)
}
export function toggleZone(id) {
  const z = state.layers.zones
  z.has(id) ? z.delete(id) : z.add(id)
  layersChanged()
}
export function setAllZones(ids, on) {
  state.layers.zones = new Set(on ? ids : [])
  layersChanged()
}
export function toggleFlow(id) {
  const f = state.layers.flows
  f.has(id) ? f.delete(id) : f.add(id)
  layersChanged()
}
export function toggleClearance() {
  state.layers.clearance = !state.layers.clearance
  layersChanged()
}
export function setRoof(on) {
  if (state.layers.roof === on) return
  state.layers.roof = on
  layersChanged(false)
}
export function toggleRoof() {
  state.layers.roof = !state.layers.roof
  layersChanged()
}
export function presetLayers(zones) {
  state.layers.zones = new Set(zones)
  layersChanged(false)
}
