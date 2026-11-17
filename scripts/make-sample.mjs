// Membuat public/data/tour.sample.json: data contoh sesuai skema PRD §5,
// dipakai selama tour.json asli dari agen ekspor belum ada. Jalankan: npm run sample
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const hex = ([r, g, b]) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')

const zones = [
  { id: 'publik', label: 'Publik (tunggu, bermain anak, baca)', color: hex([120, 170, 220]) },
  { id: 'admin', label: 'Administrasi & farmasi', color: hex([240, 180, 90]) },
  { id: 'klinis', label: 'Klinis / ruang praktik', color: hex([110, 190, 150]) },
  { id: 'steril', label: 'Sterilisasi', color: hex([70, 150, 230]) },
  { id: 'radiasi', label: 'Radiologi / zona radiasi', color: hex([170, 120, 210]) },
  { id: 'servis', label: 'Servis / toilet', color: hex([150, 150, 150]) },
  { id: 'ibadah', label: 'Ibadah (mushola & wudhu)', color: hex([150, 200, 110]) },
  { id: 'sirkulasi', label: 'Sirkulasi', color: hex([225, 215, 195]) },
]

// [id, no, nama, zona, rect, pano, deskripsi, isi]
const roomDefs = [
  ['tunggu', 1, 'Ruang Tunggu', 'publik', [0, 0, 9, 6.2], 'tunggu',
    'Ruang tunggu terbuka dengan sofa, sudut baca, dan pojok mainan anak.',
    ['Sofa dan kursi', 'Sudut baca', 'Pojok mainan anak', 'Dispenser air']],
  ['resepsionis', 2, 'Resepsionis & Administrasi', 'admin', [9, 0, 5.5, 6.2], 'resepsionis',
    'Meja resepsionis menghadap pintu masuk, dengan meja administrasi dan poster edukasi gigi.',
    ['Meja resepsionis', 'Meja administrasi', 'Lemari arsip', 'Poster edukasi']],
  ['farmasi', 3, 'Farmasi', 'admin', [14.5, 0, 3.5, 6.2], 'farmasi',
    'Farmasi kecil dengan loket ke koridor dan rak obat.',
    ['Rak obat', 'Lemari pendingin obat', 'Meja racik', 'Loket']],
  ['mushola', 4, 'Mushola', 'ibadah', [18, 0, 4, 3.6], 'mushola',
    'Mushola untuk pasien dan staf, dekat tempat wudhu.',
    ['Karpet sholat', 'Rak Al-Quran', 'Penanda kiblat']],
  ['wudhu', 5, 'Tempat Wudhu', 'ibadah', [20, 3.6, 2, 2.6], null,
    'Tempat wudhu ringkas di samping mushola.', ['Keran wudhu']],
  ['toilet', 6, 'Toilet', 'servis', [18, 3.6, 2, 2.6], null,
    'Toilet pasien dan staf.', ['Kloset', 'Wastafel']],
  ['koridor', 7, 'Koridor', 'sirkulasi', [0, 6.2, 22, 1.8], 'koridor-barat',
    'Koridor utama yang menghubungkan ruang publik dengan deret ruang klinis.', ['Downlight', 'Jalur sirkulasi']],
  ['praktik-1', 8, 'Ruang Praktik 1', 'klinis', [0, 8, 5, 5.6], 'praktik-1',
    'Dental unit sejajar dinding, kabinet di sisi barat, jendela lebar di sisi utara.',
    ['Dental unit berlayar', 'Kabinet dan wastafel', 'Meja konsultasi', 'Kursi operator dan asisten']],
  ['praktik-2', 9, 'Ruang Praktik 2', 'klinis', [5, 8, 5, 5.6], 'praktik-2',
    'Tata letak sama dengan ruang praktik 1, dengan jendela serah instrumen ke sterilisasi.',
    ['Dental unit berlayar', 'Kabinet dan wastafel', 'Meja konsultasi', 'Jendela serah instrumen']],
  ['sterilisasi', 10, 'Sterilisasi', 'steril', [10, 8, 3.2, 5.6], 'sterilisasi',
    'Alur satu arah: kotor, bersih, lalu area steril.', ['Meja dekontaminasi', 'Autoklaf', 'Lemari steril']],
  ['praktik-3', 11, 'Ruang Praktik 3', 'klinis', [13.2, 8, 5, 5.6], 'praktik-3',
    'Tata letak sama dengan ruang praktik 1, dengan jendela serah instrumen ke sterilisasi.',
    ['Dental unit berlayar', 'Kabinet dan wastafel', 'Meja konsultasi']],
  ['radiologi', 12, 'Radiologi Panoramik', 'radiasi', [18.2, 8, 3.8, 5.6], 'radiologi',
    'Ruang unit panoramik dengan sekat timbal dan meja baca hasil.', ['Unit panoramik', 'Sekat timbal', 'Meja baca hasil']],
]

const shrink = (v, lo, hi, a, b) => (a <= lo + 1e-6 ? 0.2 : 0.06) + (b >= hi - 1e-6 ? 0.2 : 0.06)
const rooms = roomDefs.map(([id, no, name, zone, rect, pano, description, equipment]) => {
  const [x, y, w, d] = rect
  const area = (w - shrink(0, 0, 22, x, x + w)) * (d - shrink(0, 0, 13.6, y, y + d))
  return { id, no, name, zone, area: Math.round(area * 10) / 10, rect, description, equipment, pano }
})

// [id, ruang, label, x, y, sambungan]
const panoDefs = [
  ['luar-parkir', null, 'Tampak luar', 11, -8, ['luar-pintu']],
  ['luar-pintu', null, 'Teras pintu masuk', 9, -2, ['luar-parkir', 'resepsionis']],
  ['tunggu', 'tunggu', 'Ruang tunggu', 4.6, 3, ['resepsionis']],
  ['resepsionis', 'resepsionis', 'Resepsionis & administrasi', 10.2, 2.6, ['luar-pintu', 'tunggu', 'koridor-barat']],
  ['farmasi', 'farmasi', 'Farmasi', 16.2, 3, ['koridor-timur']],
  ['mushola', 'mushola', 'Mushola', 20, 1.8, ['koridor-timur']],
  ['koridor-barat', 'koridor', 'Koridor', 5.5, 7.1, ['resepsionis', 'koridor-timur', 'praktik-1', 'praktik-2']],
  ['koridor-timur', 'koridor', 'Koridor', 16.5, 7.1, ['koridor-barat', 'sterilisasi', 'praktik-3', 'radiologi', 'farmasi', 'mushola']],
  ['praktik-1', 'praktik-1', 'Ruang Praktik 1', 3.3, 9.6, ['koridor-barat']],
  ['praktik-2', 'praktik-2', 'Ruang Praktik 2', 8.3, 9.6, ['koridor-barat']],
  ['sterilisasi', 'sterilisasi', 'Sterilisasi', 11.6, 9.4, ['koridor-timur']],
  ['praktik-3', 'praktik-3', 'Ruang Praktik 3', 16.5, 9.6, ['koridor-timur']],
  ['radiologi', 'radiologi', 'Radiologi panoramik', 20.1, 9.6, ['koridor-timur']],
]
const pos = Object.fromEntries(panoDefs.map(([id, , , x, y]) => [id, [x, y]]))
const yawTo = (from, to) => {
  const [x0, y0] = pos[from]
  const [x1, y1] = pos[to]
  return Math.round(((Math.atan2(x1 - x0, y1 - y0) * 180) / Math.PI + 360) % 360)
}

const practiceInfo = [
  { yawDeg: 270, pitchDeg: -8, title: 'Dental unit modern berlayar', text: 'Dental unit sejajar dinding dengan layar monitor di lengan.' },
  { yawDeg: 0, pitchDeg: 4, title: 'Jendela lebar + vitrase di sisi DU', text: 'Cahaya alami masuk lewat vitrase di sisi dental unit.' },
  { yawDeg: 300, pitchDeg: -4, title: 'Zona statis jam 12: kabinet + wastafel, ≥ 1,0 m bebas', text: 'Ruang bebas minimal 1,0 m di belakang sandaran kepala.' },
]
const infoByPano = {
  'luar-parkir': [{ yawDeg: 300, pitchDeg: -10, title: 'Parkir + petak difabel', text: 'Petak parkir difabel berada paling dekat dengan teras.' }],
  'luar-pintu': [{ yawDeg: 320, pitchDeg: -12, title: 'Parkir + petak difabel', text: 'Petak parkir difabel berada paling dekat dengan teras.' }],
  tunggu: [
    { yawDeg: 300, pitchDeg: -8, title: 'Sudut baca', text: 'Kursi santai dan rak buku rendah.' },
    { yawDeg: 240, pitchDeg: -12, title: 'Pojok mainan anak', text: 'Karpet, meja kecil, dan rak mainan.' },
  ],
  resepsionis: [
    { yawDeg: 90, pitchDeg: 4, title: 'Poster edukasi gigi', text: 'Poster anatomi gigi dan cara menyikat gigi.' },
    { yawDeg: 120, pitchDeg: 0, title: 'Akses farmasi', text: 'Farmasi dapat dicapai lewat koridor.' },
  ],
  'praktik-1': practiceInfo,
  'praktik-2': practiceInfo,
  'praktik-3': practiceInfo,
  sterilisasi: [
    { yawDeg: 270, pitchDeg: -10, title: 'Kotor', text: 'Area dekontaminasi instrumen bekas pakai.' },
    { yawDeg: 0, pitchDeg: -10, title: 'Bersih', text: 'Area pengemasan instrumen.' },
    { yawDeg: 90, pitchDeg: -6, title: 'Area steril', text: 'Penyimpanan dan serah instrumen steril.' },
  ],
  radiologi: [
    { yawDeg: 20, pitchDeg: -4, title: 'Unit panoramik', text: 'Unit panoramik dengan penanda posisi di lantai.' },
    { yawDeg: 120, pitchDeg: -10, title: 'Meja baca hasil', text: 'Meja baca di balik sekat timbal.' },
  ],
}

const panos = panoDefs.map(([id, room, label, x, y, links]) => ({
  id,
  room,
  label,
  position: [x, y, 1.55],
  northYawDeg: 0,
  files: {
    preview: `panos/${id}-preview.webp`,
    mobile: `panos/${id}-mobile.webp`,
    full: `panos/${id}-full.webp`,
  },
  links: links.map((to) => ({ to, yawDeg: yawTo(id, to), pitchDeg: -12 })),
  info: infoByPano[id] ?? [],
}))

const gallery = [
  ['03-maket-potong', 'Maket potong', 'Potongan tanpa atap memperlihatkan seluruh tata ruang.'],
  ['02-tampak-luar', 'Tampak luar', 'Fasad dengan massa pintu masuk dan signage Provenza Dental.'],
  ['04-ruang-praktik', 'Ruang praktik', 'Dental unit sejajar dinding dengan kabinet berpelapis marmer hijau.'],
  ['05-resepsionis-ruang-tunggu', 'Resepsionis dan ruang tunggu', 'Hall terbuka yang menyambut pasien sejak pintu masuk.'],
  ['06-sterilisasi', 'Sterilisasi', 'Alur kotor, bersih, steril dalam satu ruang.'],
  ['07-radiologi', 'Radiologi', 'Unit panoramik dengan sekat timbal.'],
  ['08-farmasi', 'Farmasi', 'Farmasi kecil dengan loket ke koridor.'],
  ['09-mushola', 'Mushola', 'Ruang ibadah yang tenang, dekat tempat wudhu.'],
].map(([name, title, caption]) => ({
  file: `gallery/${name}.webp`,
  thumb: `gallery/${name}-thumb.webp`,
  title,
  caption,
}))

const tour = {
  building: { width: 22, depth: 13.6 },
  zones,
  rooms,
  flows: [
    {
      id: 'pasien', label: 'Alur pasien', color: '#d9534f', dashed: false,
      points: [[9, -3], [9, 2.6], [7.4, 2.6], [7.4, 4.95], [9.1, 4.95], [9.1, 7.1], [17.4, 7.1], [17.4, 9]],
    },
    {
      id: 'instrumen', label: 'Alur instrumen', color: '#2e7bd0', dashed: true,
      points: [[4.2, 9.4], [4.2, 7.55], [11.6, 7.55], [11.6, 8.9], [10.75, 9.6], [10.75, 12.5], [12.3, 12.6], [12.5, 9.6], [14, 8.75]],
    },
  ],
  clearances: ['praktik-1', 'praktik-2', 'praktik-3'].map((room) => {
    const [x, y] = rooms.find((r) => r.id === room).rect
    return { room, rect: [x + 0.65, y + 2.4, 1.1, 2.6], label: '≥ 1,0 m bebas' }
  }),
  plan: { image: 'plan/plan.webp', bounds: [-1.5, -1.5, 23.5, 15] },
  maket: {
    file: 'maket/maket.glb',
    poster: 'maket/poster.webp',
    transform: 'glTF Y-up; X = timur, −Z = utara; origin = sudut barat-daya',
  },
  panos,
  gallery,
}

const out = fileURLToPath(new URL('../public/data/tour.sample.json', import.meta.url))
writeFileSync(out, JSON.stringify(tour, null, 2) + '\n')
console.log('Ditulis:', out)
