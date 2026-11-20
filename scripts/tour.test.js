// Tes data tur: `npm test`. Memeriksa public/data/tour.json; bila belum ada,
// memakai tour.sample.json (pengecekan berkas yang dirujuk dilewati untuk sampel).
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const publicDir = fileURLToPath(new URL('../public/', import.meta.url))
const real = existsSync(publicDir + 'data/tour.json')
const tour = JSON.parse(readFileSync(publicDir + (real ? 'data/tour.json' : 'data/tour.sample.json'), 'utf8'))
console.log(real ? 'Data: tour.json (asli)' : 'Data: tour.sample.json (sampel, tour.json belum ada)')

const panoById = new Map(tour.panos.map((pano) => [pano.id, pano]))
const inRange = (value, min, max) => Number.isFinite(value) && value >= min && value <= max

test('14 panorama dengan id unik', () => {
  assert.equal(panoById.size, tour.panos.length, 'id panorama ganda')
  assert.equal(tour.panos.length, 14)
})

test('nomor dan id ruang unik', () => {
  const numbers = tour.rooms.map((room) => room.no)
  assert.equal(new Set(numbers).size, numbers.length, 'nomor ruang ganda')
  assert.ok(numbers.every(Number.isInteger))
  assert.equal(new Set(tour.rooms.map((room) => room.id)).size, tour.rooms.length, 'id ruang ganda')
})

test('zona, ruang, dan panorama saling merujuk dengan benar', () => {
  const zoneIds = new Set(tour.zones.map((zone) => zone.id))
  const roomIds = new Set(tour.rooms.map((room) => room.id))
  for (const room of tour.rooms) {
    assert.ok(zoneIds.has(room.zone), `${room.id}: zona ${room.zone} tidak ada`)
    if (room.pano) assert.ok(panoById.has(room.pano), `${room.id}: panorama ${room.pano} tidak ada`)
  }
  for (const pano of tour.panos) {
    if (pano.room) assert.ok(roomIds.has(pano.room) || pano.room === 'luar', `${pano.id}: ruang ${pano.room} tidak ada`)
  }
  for (const clearance of tour.clearances ?? []) assert.ok(roomIds.has(clearance.room), clearance.room)
  for (const flow of tour.flows ?? []) assert.ok(flow.points.length >= 2, flow.id)
})

test('setiap sambungan panorama dua arah', () => {
  for (const pano of tour.panos) {
    for (const link of pano.links) {
      const target = panoById.get(link.to)
      assert.ok(target, `${pano.id} -> ${link.to}: tujuan tidak ada`)
      assert.ok(target.links.some((back) => back.to === pano.id), `${pano.id} -> ${link.to}: tidak ada arah sebaliknya`)
    }
  }
})

test('semua panorama dapat dicapai dari panorama pertama', () => {
  const seen = new Set([tour.panos[0].id])
  const queue = [tour.panos[0].id]
  while (queue.length) {
    for (const link of panoById.get(queue.shift()).links) {
      if (!seen.has(link.to)) {
        seen.add(link.to)
        queue.push(link.to)
      }
    }
  }
  assert.equal(seen.size, tour.panos.length)
})

test('yaw, pitch, dan posisi berada dalam rentang', () => {
  for (const pano of tour.panos) {
    assert.ok(inRange(pano.northYawDeg ?? 0, -360, 360), `${pano.id}: northYawDeg`)
    assert.equal(pano.position.length, 3, `${pano.id}: posisi`)
    assert.ok(inRange(pano.position[0], -30, tour.building.width + 30), `${pano.id}: x`)
    assert.ok(inRange(pano.position[1], -30, tour.building.depth + 30), `${pano.id}: y`)
    for (const hotspot of [...pano.links, ...pano.info]) {
      assert.ok(inRange(hotspot.yawDeg, -360, 360), `${pano.id}: yaw ${hotspot.yawDeg}`)
      assert.ok(inRange(hotspot.pitchDeg ?? 0, -90, 90), `${pano.id}: pitch ${hotspot.pitchDeg}`)
    }
    for (const info of pano.info) assert.ok(info.title, `${pano.id}: judul info kosong`)
  }
})

test('berkas yang dirujuk ada', { skip: real ? false : 'tour.json belum ada (memakai sampel)' }, () => {
  const files = [tour.plan.image, tour.maket.file, tour.maket.poster]
  for (const pano of tour.panos) files.push(pano.files.preview, pano.files.mobile, pano.files.full)
  for (const item of tour.gallery) files.push(item.file, item.thumb)
  for (const file of files.filter(Boolean)) assert.ok(existsSync(publicDir + file), `berkas tidak ada: ${file}`)
})

test('denah dan batas bangunan masuk akal', () => {
  const [xmin, ymin, xmax, ymax] = tour.plan.bounds
  assert.ok(xmax > xmin && ymax > ymin)
  assert.ok(xmin <= 0 && ymin <= 0 && xmax >= tour.building.width && ymax >= tour.building.depth)
})
