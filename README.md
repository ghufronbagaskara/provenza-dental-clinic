# Provenza Dental — Tur Klinik Interaktif

Situs statis (Vite + three.js) untuk menampilkan rancangan klinik Provenza Dental dalam empat mode:

- **Maket**: poster tampil seketika, lalu maket 3D ber-bake (GLB unlit). Pin ruang bernomor, lapisan zona dan alur.
- **Denah**: gambar denah + overlay SVG (zona, alur, ruang bebas ≥ 1,0 m), ruang bisa diklik.
- **Tur 360°**: panorama equirectangular, hotspot pindah dan info, minimap dengan arah pandang.
- **Galeri**: render diam dengan lightbox.

Acuan tunggal: `PRD.md`.

## Perintah

```bash
npm install
npm run dev        # server pengembangan
npm test           # memeriksa public/data/tour.json (atau tour.sample.json bila belum ada)
npm run build      # keluaran di dist/
npm run sample     # membuat ulang public/data/tour.sample.json
```

## Struktur

```
index.html
src/
  main.js         shell, routing hash (#/maket, #/denah, #/tur/<id>, #/galeri), pemuatan lazy
  state.js        status, pub/sub, lapisan (zona/alur/ruang bebas)
  data.js         memuat data/tour.json, jatuh ke data/tour.sample.json
  panel.js        panel samping (desktop) / lembar bawah (HP)
  card.js         kartu ruang
  plan.js         Denah (img + SVG)
  gallery.js      Galeri + lightbox
  viewers/
    maket.js      three: GLB, OrbitControls, overlay (lazy)
    tour.js       three: bola panorama, hotspot HTML, cross-fade (lazy)
    minimap.js    minimap SVG
    procedural.js equirect uji prosedural bila berkas panorama belum ada
scripts/          tes data (node --test) + pembuat sampel
public/           data/, panos/, maket/, plan/, gallery/ (ditulis agen ekspor)
```

## Catatan teknis

- Denah dan Galeri tidak menarik three; chunk three dan penampil dimuat saat Maket / Tur dibuka.
- Konvensi yaw: derajat, searah jarum jam dari atas, 0 = utara (+Y). Di dunia three: utara = −Z, timur = +X.
  Layout (x, y) dipetakan ke three (x, 0, −y). Tengah gambar equirect = utara (`northYawDeg`).
- Bila berkas panorama gagal dimuat, viewer menggambar equirect uji (grid + huruf U/T/S/B). Bila `maket.glb`
  gagal dimuat, maket sederhana dibangun dari data denah dan pin tetap berfungsi.
- Tanpa WebGL: Maket dan Tur dinonaktifkan; Denah, Galeri, dan daftar ruang tetap bekerja.
- Deploy: Vercel (`vercel.json`), cache panjang untuk `/panos`, `/maket`, `/gallery`, `/plan`, `/assets`.
