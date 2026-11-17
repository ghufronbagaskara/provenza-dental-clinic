// Equirect uji prosedural: dipakai bila berkas panorama belum ada atau gagal dimuat.
// Sudut gambar `a` (derajat, positif ke kanan dari tengah) untuk arah dunia `psi` = northYawDeg + psi.
const MARKS = [
  [0, 'U', '#d8c39a'],
  [90, 'T', '#f6f3ee'],
  [180, 'S', '#f6f3ee'],
  [270, 'B', '#f6f3ee'],
]

export function testPanoCanvas(label, northYawDeg = 0, width = 2048) {
  const w = width
  const h = width / 2
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const g = canvas.getContext('2d')
  const xOf = (a) => (w * (0.5 + a / 360) + w) % w
  const yOf = (p) => h * (0.5 - p / 180)

  const sky = g.createLinearGradient(0, 0, 0, h)
  sky.addColorStop(0, '#9fb4a8')
  sky.addColorStop(0.5, '#e4ddd0')
  sky.addColorStop(0.5, '#b7ab9c')
  sky.addColorStop(1, '#6d6256')
  g.fillStyle = sky
  g.fillRect(0, 0, w, h)

  g.lineWidth = 1.5
  for (let a = -180; a < 180; a += 15) {
    g.strokeStyle = a % 45 === 0 ? 'rgba(23,56,44,.55)' : 'rgba(23,56,44,.22)'
    g.beginPath()
    g.moveTo(xOf(a), 0)
    g.lineTo(xOf(a), h)
    g.stroke()
  }
  for (let p = -75; p <= 75; p += 15) {
    g.strokeStyle = p === 0 ? '#17382c' : 'rgba(23,56,44,.22)'
    g.lineWidth = p === 0 ? 4 : 1.5
    g.beginPath()
    g.moveTo(0, yOf(p))
    g.lineTo(w, yOf(p))
    g.stroke()
  }

  g.textAlign = 'center'
  g.textBaseline = 'middle'
  for (const [psi, letter, color] of MARKS) {
    const x = xOf(northYawDeg + psi)
    g.fillStyle = '#17382c'
    g.beginPath()
    g.arc(x, yOf(0), 78, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = color
    g.font = '700 110px Georgia, serif'
    g.fillText(letter, x, yOf(0) + 6)
    g.font = '500 34px system-ui, sans-serif'
    g.fillStyle = '#17382c'
    g.fillText(psi + '°', x, yOf(0) - 112)
  }
  for (let psi = 0; psi < 360; psi += 45) {
    if (psi % 90 === 0) continue
    g.font = '500 40px system-ui, sans-serif'
    g.fillStyle = '#17382c'
    g.fillText(psi + '°', xOf(northYawDeg + psi), yOf(0) - 40)
  }
  g.font = '600 64px Georgia, serif'
  for (let psi = 0; psi < 360; psi += 90) {
    g.fillStyle = '#17382c'
    g.fillText('Panorama uji: ' + label, xOf(northYawDeg + psi + 45), yOf(32))
  }
  g.fillText('Lantai', xOf(northYawDeg), yOf(-55))
  return canvas
}
