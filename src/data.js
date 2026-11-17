// Memuat data tur: data/tour.json (asli) atau jatuh ke data/tour.sample.json.
export const url = (path) => import.meta.env.BASE_URL + path

async function fetchJson(path) {
  const res = await fetch(url(path))
  if (!res.ok) throw new Error(path + ' ' + res.status)
  return res.json() // di dev, berkas yang tidak ada mengembalikan HTML -> melempar galat
}

export async function loadTour() {
  let sample = false
  let raw
  try {
    raw = await fetchJson('data/tour.json')
  } catch {
    raw = await fetchJson('data/tour.sample.json')
    sample = true
  }
  return { tour: index(raw), sample }
}

const FLOW_LABEL = { pasien: 'Alur pasien', instrumen: 'Alur instrumen' }

function index(tour) {
  const rooms = [...tour.rooms].sort((a, b) => a.no - b.no)
  const roomById = new Map(rooms.map((r) => [r.id, r]))
  const zoneById = new Map(tour.zones.map((z) => [z.id, z]))
  const panoById = new Map(tour.panos.map((p) => [p.id, p]))
  for (const pano of tour.panos) pano.links = pano.links.filter((l) => panoById.has(l.to))
  const panoOrder = tour.panos.map((p) => p.id)
  // Zona -> daftar persegi [x0, y0, w, d]. Sumber: `zoneRects` ([{ zone, rect }], bila ada),
  // lalu `zone.rects`, lalu persegi ruang.
  const zoneRects = new Map(tour.zones.map((z) => [z.id, []]))
  if (Array.isArray(tour.zoneRects)) {
    for (const { zone, rect } of tour.zoneRects) zoneRects.get(zone)?.push(rect)
  } else {
    for (const zone of tour.zones) zoneRects.set(zone.id, zone.rects ?? rooms.filter((r) => r.zone === zone.id).map((r) => r.rect))
  }
  // Alur dikelompokkan per `group` (satu tombol lapisan per kelompok).
  const flows = (tour.flows ?? []).map((f) => ({ ...f, group: f.group ?? f.id }))
  const flowGroups = []
  for (const f of flows) {
    let g = flowGroups.find((x) => x.id === f.group)
    if (!g) flowGroups.push((g = { id: f.group, label: FLOW_LABEL[f.group] ?? 'Alur ' + f.group, color: f.color, dashed: false }))
  }
  return { ...tour, rooms, roomById, zoneById, panoById, panoOrder, zoneRects, flows, flowGroups, clearances: tour.clearances ?? [], gallery: tour.gallery ?? [] }
}

export function hasWebGL() {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}
