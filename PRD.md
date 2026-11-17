# PRD — Provenza Dental: Tur Klinik Interaktif

Dokumen ini satu-satunya acuan untuk agen ekspor (Blender) dan agen web. Kalau ada yang bertentangan dengan brief, PRD ini yang berlaku.

## 1. Tujuan

Mempresentasikan rancangan klinik gigi Provenza Dental di browser dengan kualitas visual setara render Blender, tanpa membuat web berat. Pemakai: klien/penilai tugas, membuka dari laptop atau HP, sekali lihat, tanpa instalasi.

Berhasil bila:
- Tampilan di dalam ruang terlihat seperti foto render, bukan 3D game.
- Halaman pertama bisa dipakai dalam ≤ 3 detik pada koneksi biasa; transfer awal ≤ 3 MB.
- Jalan mulus di HP kelas menengah; deploy statis di Vercel Hobby.

Bukan tujuan: berjalan bebas di dalam ruang (free-walk), editor, animasi karakter, backend, analitik.

## 2. Prinsip teknis (gabungan A + B)

- **B — Tur 360°:** tiap ruang punya panorama equirectangular hasil render Cycles. Kualitas foto-realistis datang dari sini.
- **A — Maket 3D ringan:** model potongan tanpa atap dengan pencahayaan yang sudah di-bake ke tekstur, material *unlit*. Bisa diputar dan di-zoom; tanpa lampu dan bayangan real-time.
- **Denah 2D:** gambar denah tampak atas hasil render + lapisan SVG interaktif dari data yang sama.
- Satu sumber data: `public/data/tour.json`, dihasilkan dari `provenza-dental-blender/scripts/layout.py`.

## 3. Struktur halaman (satu halaman, 4 mode)

1. **Maket** (mode awal). Poster gambar `03-maket-potong` tampil seketika, lalu diganti maket 3D begitu GLB siap. Pin bernomor per ruang. Klik pin/ruang → kartu ruang (nama, luas, fungsi, isi) + tombol **Masuk 360°**. Toggle lapisan: Zona, Alur pasien, Alur instrumen.
2. **Denah.** Gambar denah + overlay SVG: ruang bisa diklik, legenda zona bisa dinyalakan/dimatikan, garis alur, kotak "≥ 1,0 m bebas" di belakang dental unit. Kartu ruang sama dengan mode Maket.
3. **Tur 360°.** Seret untuk menoleh, scroll/cubit untuk zoom (FOV 35–90°). Hotspot pindah (cincin di lantai/arah pintu) ke panorama tetangga. Hotspot info (titik kecil berlabel) 2–4 per ruang. Minimap denah dengan posisi + arah pandang; klik minimap untuk lompat. Tombol sebelumnya/berikutnya dan Keluar. Antarmuka seminimal mungkin.
4. **Galeri.** Render diam final dengan judul + keterangan satu kalimat; lightbox.

Panel samping (desktop) / lembar bawah (HP): identitas, pengalih mode, legenda, daftar ruang bernomor, bagian "Ketentuan ergonomi" (zona jam operator 7–12, statis 12–2, asisten 2–4, transfer 4–7; ≥ 1,0 m bebas di belakang sandaran kepala; jendela lebar bervitrase di sisi dental unit; dental unit lurus sejajar dinding), catatan "ukuran konseptual, bukan gambar konstruksi".

## 4. Daftar panorama

Tinggi mata 1,55 m. Koordinat = meter, X timur, Y utara, origin sudut barat-daya bangunan. Agen ekspor boleh menggeser ±0,5 m agar tidak menabrak perabot dan komposisinya enak; posisi final ditulis ke `tour.json`.

| id | ruang | posisi (x, y) |
| --- | --- | --- |
| luar-parkir | Tampak luar | (11.0, −8.0) |
| luar-pintu | Teras pintu masuk | (9.0, −2.0) |
| tunggu | Ruang tunggu | (4.6, 3.0) |
| resepsionis | Resepsionis & administrasi | (10.2, 2.6) |
| farmasi | Farmasi | (16.2, 3.0) |
| mushola | Mushola | (20.0, 1.8) |
| koridor-barat | Koridor | (5.5, 7.1) |
| koridor-timur | Koridor | (16.5, 7.1) |
| praktik-1 | Ruang praktik 1 | (3.3, 9.6) |
| praktik-2 | Ruang praktik 2 | (8.3, 9.6) |
| sterilisasi | Sterilisasi | (11.6, 9.4) |
| praktik-3 | Ruang praktik 3 | (16.5, 9.6) |
| radiologi | Radiologi panoramik | (20.1, 9.6) |

Toilet dan wudhu tidak diberi panorama (terlalu sempit); tetap ada di denah dan daftar ruang.

Sambungan (dua arah): luar-parkir ↔ luar-pintu ↔ resepsionis ↔ tunggu; resepsionis ↔ koridor-barat ↔ koridor-timur; koridor-barat ↔ praktik-1, praktik-2; koridor-timur ↔ sterilisasi, praktik-3, radiologi, farmasi (lewat loket), mushola. Yaw hotspot dihitung otomatis dari posisi.

Hotspot info wajib: di ruang praktik → "Dental unit modern berlayar", "Jendela lebar + vitrase di sisi DU", "Zona statis jam 12: kabinet + wastafel, ≥ 1,0 m bebas"; sterilisasi → "Kotor", "Bersih", "Area steril"; radiologi → "Unit panoramik", "Meja baca hasil"; resepsionis → "Poster edukasi gigi", "Akses farmasi"; tunggu → "Sudut baca", "Pojok mainan anak"; luar → "Parkir + petak difabel".

## 5. Kontrak berkas (ditulis agen ekspor ke `provenza-dental-web/public/`)

```
public/
  data/tour.json
  panos/<id>-preview.webp   2048×1024, q70   (±150 KB, tampil seketika)
  panos/<id>-mobile.webp    4096×2048, q80
  panos/<id>-full.webp      6144×3072, q82   (desktop)
  maket/maket.glb           ≤ 12 MB, meshopt + tekstur WebP, material unlit ber-bake
  maket/poster.webp         1600 px, dari 03-maket-potong
  plan/plan.webp            denah tampak atas TANPA lembar legenda, ≤ 600 KB
  gallery/<nama>.webp       1920 px sisi panjang, q82 (+ <nama>-thumb.webp 480 px)
```

`tour.json`:

```jsonc
{
  "building": { "width": 22.0, "depth": 13.6 },
  "zones":  [{ "id": "klinis", "label": "Klinis / ruang praktik", "color": "#…" }],
  "rooms":  [{ "id": "praktik-1", "no": 8, "name": "Ruang Praktik 1", "zone": "klinis",
               "area": 25.3, "rect": [x0, y0, w, d], "description": "…",
               "equipment": ["…"], "pano": "praktik-1" }],
  "flows":  [{ "id": "pasien", "label": "Alur pasien", "color": "#…", "dashed": false,
               "points": [[x, y], …] }],
  "clearances": [{ "room": "praktik-1", "rect": [x0, y0, w, d], "label": "≥ 1,0 m bebas" }],
  "plan":   { "image": "plan/plan.webp", "bounds": [xmin, ymin, xmax, ymax] },
  "maket":  { "file": "maket/maket.glb", "poster": "maket/poster.webp",
              "transform": "glTF Y-up; X = timur, −Z = utara; origin = sudut barat-daya" },
  "panos":  [{ "id": "praktik-1", "room": "praktik-1", "label": "Ruang Praktik 1",
               "position": [x, y, z],
               "northYawDeg": 0,            // yaw (derajat) di gambar tempat arah utara (+Y) berada; 0 = tengah gambar
               "files": { "preview": "…", "mobile": "…", "full": "…" },
               "links": [{ "to": "koridor-barat", "yawDeg": 0, "pitchDeg": -12 }],
               "info":  [{ "yawDeg": 0, "pitchDeg": 0, "title": "…", "text": "…" }] }],
  "gallery": [{ "file": "gallery/04-ruang-praktik.webp", "thumb": "…", "title": "…", "caption": "…" }]
}
```

Semua yaw: derajat, searah jarum jam dilihat dari atas, 0 = utara (+Y). Konvensi gambar equirect: tengah gambar = `northYawDeg`. Agen ekspor WAJIB menyertakan satu gambar uji bertanda arah (U/T/S/B) atau deskripsi terverifikasi supaya agen web tidak menebak orientasi.

## 6. Anggaran

| Hal | Batas |
| --- | --- |
| JS awal (tanpa three) | ≤ 60 kB gzip |
| three + viewer | chunk terpisah, dimuat lazy |
| Transfer sampai maket poster tampil | ≤ 1 MB |
| maket.glb | ≤ 12 MB, ≤ 400 rb segitiga, ≤ 60 draw call |
| Panorama | preview ≤ 200 KB; mobile ≤ 1,2 MB; full ≤ 2,8 MB |
| Total `dist` | ≤ 70 MB |
| Memori | hanya 1 panorama resolusi penuh di GPU; yang lama di-dispose |

Render on demand (tanpa loop saat diam), DPR ≤ 2 (1,5 di HP), HP memakai tier `mobile`, tetangga hanya di-preload tier `preview`. Tanpa dependensi selain `three` dan `vite`.

## 7. Arah visual

Identitas mengikuti interior: tenang, hangat, klinis-mewah. Bukan dashboard, bukan template AI.

- Warna: kertas hangat `#f6f3ee`, greige `#b7ab9c`, hijau botol `#17382c` (tinta utama + aksen, diambil dari marmer), kayu `#a8733f` (aksen kecil), krem urat `#d8c39a` (garis tipis). Kontras teks AA.
- Tipografi: satu serif display untuk judul/wordmark (senada signage fasad) + satu sans untuk teks; maksimal dua keluarga, `display=swap`.
- Viewer memenuhi layar; panel mengambang semi-transparan dengan blur tipis, sudut kecil, garis halus. Di mode 360° hanya: nama ruang, minimap, hotspot, keluar.
- Gerak: transisi antar-panorama cross-fade ≤ 400 ms; hormati `prefers-reduced-motion`.
- Aksesibilitas: semua kontrol bisa keyboard, fokus terlihat, hotspot punya label teks, daftar ruang tetap berfungsi tanpa WebGL (jatuh ke galeri + denah).
- Bahasa Indonesia, kalimat pendek, tanpa klaim berlebihan, tanpa emoji sebagai ikon.

## 8. Kriteria terima

- 13 panorama bisa dicapai lewat hotspot DAN lewat daftar ruang/minimap; arah hotspot benar (pintu ada di arah yang ditunjuk).
- Toggle zona/alur bekerja di Maket dan Denah, warnanya sama dengan lembar denah Blender.
- Lebar 375 px: tidak ada scroll horizontal, kontrol terjangkau jempol.
- Konsol bersih; `npm run build` lulus; satu tes Node memeriksa `tour.json` (tiap link dua arah, tiap berkas yang dirujuk ada, tiap ruang punya nomor unik).
- Ukuran sesuai anggaran §6, dilaporkan dengan angka.
