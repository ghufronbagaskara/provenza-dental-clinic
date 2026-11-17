// Maket 3D: GLB unlit ber-bake (tanpa lampu/bayangan), OrbitControls, render on demand.
// Sumbu glTF: Y atas, X = timur, -Z = utara, origin = sudut barat-daya. Layout (x, y) -> three (x, 0, -y).
// Bila GLB gagal dimuat, dibangun maket sederhana dari data denah (lantai + dinding rendah).
import {
  AmbientLight, BoxGeometry, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, LineBasicMaterial, LineLoop,
  Mesh, MeshBasicMaterial, MathUtils, PerspectiveCamera, PlaneGeometry, Plane, Raycaster, Scene, Spherical,
  SRGBColorSpace, NoToneMapping, Vector2, Vector3, WebGLRenderer, Group,
} from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { reducedMotion } from '../dom.js'
import { createPin } from '../pin.js'
import { url } from '../data.js'
import { captureCanvas, stampName } from '../snapshot.js'

const FOV = 32
const BG = '#e7e2d8'

// Pita datar (rata di lantai) mengikuti polyline; bergaris putus bila `dashed`.
function ribbon(points, { width = 0.18, y = 0.06, dashed = false, dash = 0.55, gap = 0.35 }) {
  const positions = []
  const quad = (a, b) => {
    const dx = b[0] - a[0]
    const dz = b[1] - a[1]
    const len = Math.hypot(dx, dz) || 1
    const nx = (-dz / len) * (width / 2)
    const nz = (dx / len) * (width / 2)
    const p = [[a[0] + nx, a[1] + nz], [a[0] - nx, a[1] - nz], [b[0] - nx, b[1] - nz], [b[0] + nx, b[1] + nz]]
    for (const i of [0, 1, 2, 0, 2, 3]) positions.push(p[i][0], y, p[i][1])
  }
  for (let i = 0; i < points.length - 1; i++) {
    const [a, b] = [points[i], points[i + 1]]
    const len = Math.hypot(b[0] - a[0], b[1] - a[1])
    if (!dashed) { quad(a, b); continue }
    for (let t = 0; t < len; t += dash + gap) {
      const t1 = Math.min(t + dash, len)
      const lerp = (s) => [a[0] + ((b[0] - a[0]) * s) / len, a[1] + ((b[1] - a[1]) * s) / len]
      quad(lerp(t), lerp(t1))
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  return geometry
}

const flat = (x, y, w, d, elevation, color, opacity) => {
  const mesh = new Mesh(
    new PlaneGeometry(w, d).rotateX(-Math.PI / 2),
    new MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  )
  mesh.position.set(x + w / 2, elevation, -(y + d / 2))
  mesh.renderOrder = 2
  return mesh
}

function outline([x, y, w, d], elevation, color) {
  const geometry = new BufferGeometry().setFromPoints([
    new Vector3(x, elevation, -y), new Vector3(x + w, elevation, -y),
    new Vector3(x + w, elevation, -(y + d)), new Vector3(x, elevation, -(y + d)),
  ])
  const line = new LineLoop(geometry, new LineBasicMaterial({ color }))
  line.renderOrder = 3
  return line
}

// Pengganti sederhana bila GLB belum ada.
function abstractMaket(tour) {
  const group = new Group()
  const { width, depth } = tour.building
  const ground = flat(-6, -6, width + 12, depth + 12, -0.02, '#d9d2c3', 1)
  ground.renderOrder = 0
  group.add(ground)
  const wallMat = new MeshBasicMaterial({ color: '#efe9de' })
  const edge = new LineBasicMaterial({ color: '#b7ab9c' })
  for (const room of tour.rooms) {
    const zone = tour.zoneById.get(room.zone)
    const [x, y, w, d] = room.rect
    const floor = flat(x, y, w, d, 0.01, new Color(zone?.color ?? '#ddd').lerp(new Color('#f1ece3'), 0.45), 1)
    floor.renderOrder = 1
    group.add(floor)
    const t = 0.12
    const h = 0.6
    for (const [wx, wz, ww, wd] of [[x, y, w, t], [x, y + d - t, w, t], [x, y, t, d], [x + w - t, y, t, d]]) {
      const wall = new Mesh(new BoxGeometry(ww, h, wd), wallMat)
      wall.position.set(wx + ww / 2, h / 2, -(wz + wd / 2))
      group.add(wall)
    }
    group.add(outline(room.rect, 0.02, edge.color))
  }
  return group
}

// Ganti material PBR (bila ada) menjadi unlit supaya warna bake tidak berubah.
function makeUnlit(root) {
  root.traverse((node) => {
    if (!node.isMesh) return
    const list = Array.isArray(node.material) ? node.material : [node.material]
    const next = list.map((m) => {
      if (m.isMeshBasicMaterial) return m
      const basic = new MeshBasicMaterial({
        color: m.color ?? 0xffffff, map: m.map ?? null, vertexColors: m.vertexColors, side: m.side,
        transparent: m.transparent, opacity: m.opacity, alphaTest: m.alphaTest,
      })
      basic.name = m.name
      m.dispose()
      return basic
    })
    node.material = Array.isArray(node.material) ? next : next[0]
    node.matrixAutoUpdate = false
    node.updateMatrix()
  })
}

export async function createMaket({ host, labelHost, tour, onSelect, onProgress = () => {}, getInsets = () => ({ left: 0, bottom: 0 }) }) {
  const renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, matchMedia('(pointer: coarse)').matches ? 1.5 : 2))
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = NoToneMapping // warna bake dipertahankan apa adanya
  const canvas = renderer.domElement
  const scene = new Scene()
  scene.background = new Color(BG)
  scene.add(new AmbientLight(0xffffff, 1)) // diabaikan material unlit; ada agar mesh lain tidak gelap

  // ---------- Model ----------
  let usedFallback = false
  let roofNode = null
  try {
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
    const gltf = await loader.loadAsync(url(tour.maket.file), (e) => e.total && onProgress(Math.min(e.loaded / e.total, 1)))
    makeUnlit(gltf.scene)
    roofNode = gltf.scene.getObjectByName('atap') ?? null
    scene.add(gltf.scene)
  } catch (error) {
    console.info('Provenza: maket.glb tidak dimuat, memakai maket sederhana.', error?.message ?? error)
    usedFallback = true
    scene.add(abstractMaket(tour))
  }
  onProgress(1)

  // ---------- Overlay ----------
  const overlays = new Group()
  scene.add(overlays)
  const zoneGroups = new Map()
  for (const zone of tour.zones) {
    const g = new Group()
    for (const [x, y, w, d] of tour.zoneRects.get(zone.id) ?? []) g.add(flat(x, y, w, d, 0.03, zone.color, 0.5))
    g.visible = false
    zoneGroups.set(zone.id, g)
    overlays.add(g)
  }
  const flowGroups = new Map()
  for (const flow of tour.flows) {
    const geometry = ribbon(flow.points.map(([x, y]) => [x, -y]), { dashed: flow.dashed })
    const mesh = new Mesh(geometry, new MeshBasicMaterial({ color: flow.color, side: DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }))
    mesh.renderOrder = 4
    mesh.visible = false
    flowGroups.set(flow.id, { mesh, group: flow.group })
    overlays.add(mesh)
  }
  const clearGroup = new Group()
  for (const c of tour.clearances) {
    clearGroup.add(flat(...c.rect, 0.07, '#a8733f', 0.45))
    clearGroup.add(outline(c.rect, 0.09, '#a8733f'))
  }
  clearGroup.visible = false
  overlays.add(clearGroup)
  const highlight = new Group()
  highlight.visible = false
  overlays.add(highlight)

  // ---------- Kamera ----------
  const camera = new PerspectiveCamera(FOV, 1, 0.5, 300)
  const center = new Vector3(tour.building.width / 2, 0, -tour.building.depth / 2)
  const controls = new OrbitControls(camera, canvas)
  controls.enableDamping = !reducedMotion
  controls.dampingFactor = 0.12
  controls.minDistance = 5
  controls.maxDistance = 70
  controls.minPolarAngle = 0.12
  controls.maxPolarAngle = 1.3
  controls.screenSpacePanning = false
  controls.zoomToCursor = true

  // ---------- Pin ----------
  const pins = tour.rooms.map((room) => {
    const el = createPin(room, onSelect)
    const [x, y, w, d] = room.rect
    labelHost.append(el)
    return { room, el, anchor: new Vector3(x + w / 2, 0.2, -(y + d / 2)) }
  })

  let width = 0
  let height = 0
  let active = false
  let raf = 0
  let tween = null
  let selected = null
  const tmp = new Vector3()

  function updatePins() {
    for (const pin of pins) {
      tmp.copy(pin.anchor).project(camera)
      const x = ((tmp.x + 1) / 2) * width
      const y = ((1 - tmp.y) / 2) * height
      const out = tmp.z > 1 || x < 8 || y < 8 || x > width - 8 || y > height - 8
      pin.el.classList.toggle('is-hidden', out)
      if (!out) pin.el.style.transform = `translate(${Math.round(x - 14)}px, ${Math.round(y - 14)}px)`
    }
  }

  function frame(now) {
    raf = 0
    if (!active || !width) return
    let moving = controls.update()
    if (tween) {
      const p = Math.min((now - tween.start) / tween.duration, 1)
      const e = p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2
      camera.position.lerpVectors(tween.p0, tween.p1, e)
      controls.target.lerpVectors(tween.t0, tween.t1, e)
      camera.lookAt(controls.target)
      if (p >= 1) tween = null
      moving = true
    }
    renderer.render(scene, camera)
    updatePins()
    if (moving) request()
  }
  function request() {
    if (active && !raf) raf = requestAnimationFrame(frame)
  }

  function applyInsets() {
    const { left, bottom } = getInsets()
    camera.setViewOffset(width, height, -left / 2, bottom / 2, width, height)
  }
  function resize() {
    width = host.clientWidth
    height = host.clientHeight
    if (!width || !height) return
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    applyInsets()
    camera.updateProjectionMatrix()
    request()
  }

  function defaultView() {
    const { left, bottom } = getInsets()
    const vAspect = Math.max(width - left, 200) / Math.max(height - bottom, 200)
    const vert = MathUtils.degToRad(FOV) / 2
    const horiz = Math.atan(Math.tan(vert) * vAspect)
    const radius = Math.hypot(tour.building.width, tour.building.depth) / 2 + 1.2
    const distance = (radius / Math.sin(Math.min(vert, horiz))) * 0.95
    const pos = new Vector3().setFromSphericalCoords(distance, 0.92, -0.42).add(center)
    return { p: pos, t: center.clone() }
  }
  function moveTo(view, animate = true) {
    if (!animate || reducedMotion) {
      tween = null
      camera.position.copy(view.p)
      controls.target.copy(view.t)
      camera.lookAt(view.t)
      controls.update()
    } else {
      tween = { start: performance.now(), duration: 750, p0: camera.position.clone(), p1: view.p, t0: controls.target.clone(), t1: view.t }
    }
    request()
  }

  controls.addEventListener('change', () => {
    controls.target.x = MathUtils.clamp(controls.target.x, -4, tour.building.width + 4)
    controls.target.z = MathUtils.clamp(controls.target.z, -tour.building.depth - 4, 4)
    controls.target.y = 0
    request()
  })
  controls.addEventListener('start', () => { tween = null; request() })

  canvas.tabIndex = 0
  canvas.setAttribute('aria-label', 'Maket 3D. Tombol panah memutar kamera, plus dan minus memperbesar atau memperkecil.')
  canvas.addEventListener('keydown', (e) => {
    const s = new Spherical().setFromVector3(camera.position.clone().sub(controls.target))
    if (e.key === '+' || e.key === '=') s.radius /= 1.15
    else if (e.key === '-' || e.key === '_') s.radius *= 1.15
    else if (e.key.startsWith('Arrow')) {
      s.theta += { ArrowLeft: -0.12, ArrowRight: 0.12 }[e.key] ?? 0
      s.phi += { ArrowUp: -0.08, ArrowDown: 0.08 }[e.key] ?? 0
    } else return
    e.preventDefault()
    s.radius = MathUtils.clamp(s.radius, controls.minDistance, controls.maxDistance)
    s.phi = MathUtils.clamp(s.phi, controls.minPolarAngle, controls.maxPolarAngle)
    camera.position.setFromSpherical(s).add(controls.target)
    camera.lookAt(controls.target)
    request()
  })

  // Ketuk lantai untuk memilih ruang.
  const raycaster = new Raycaster()
  const floor = new Plane(new Vector3(0, 1, 0), 0)
  let down = null
  canvas.addEventListener('pointerdown', (e) => { if (e.isPrimary && e.button === 0) down = [e.clientX, e.clientY] })
  canvas.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) { down = null; return }
    down = null
    const box = canvas.getBoundingClientRect()
    raycaster.setFromCamera(new Vector2(((e.clientX - box.left) / box.width) * 2 - 1, 1 - ((e.clientY - box.top) / box.height) * 2), camera)
    const hit = raycaster.ray.intersectPlane(floor, new Vector3())
    if (!hit) return
    const x = hit.x
    const y = -hit.z
    const room = tour.rooms
      .filter(({ rect: [rx, ry, rw, rd] }) => x >= rx && x <= rx + rw && y >= ry && y <= ry + rd)
      .sort((a, b) => a.rect[2] * a.rect[3] - b.rect[2] * b.rect[3])[0]
    if (room) onSelect(room.id)
  })

  host.append(canvas)
  new ResizeObserver(resize).observe(host)
  document.addEventListener('visibilitychange', () => { if (!document.hidden) request() })

  if (import.meta.env.DEV) window.__maket = { camera, controls, scene }
  let placed = false
  return {
    usedFallback,
    hasRoof: !!roofNode,
    resize,
    setActive(value) {
      active = value
      if (!active) return
      resize()
      if (!placed && width) { placed = true; moveTo(defaultView(), false) }
      request()
    },
    // Mengembalikan true bila gambar diambil.
    capture() {
      if (!active || !width) return false
      captureCanvas({
        renderer, width, height,
        name: stampName(`provenza-maket-${roofNode?.visible ? 'atap' : 'potong'}`),
        render: () => renderer.render(scene, camera),
      })
      request()
      return true
    },
    reset: () => moveTo(defaultView()),
    zoom(factor) {
      const offset = camera.position.clone().sub(controls.target)
      offset.setLength(MathUtils.clamp(offset.length() / factor, controls.minDistance, controls.maxDistance))
      camera.position.copy(controls.target).add(offset)
      request()
    },
    select(id) {
      selected = id
      highlight.clear()
      const room = tour.roomById.get(id)
      highlight.visible = !!room
      if (room) {
        highlight.add(flat(...room.rect, 0.05, '#a8733f', 0.22), outline(room.rect, 0.1, '#17382c'))
        const [x, y, w, d] = room.rect
        // Geser kamera ke ruang bila pin berada di luar layar.
        const target = new Vector3(x + w / 2, 0, -(y + d / 2))
        tmp.copy(target).project(camera)
        if (active && (Math.abs(tmp.x) > 0.9 || Math.abs(tmp.y) > 0.9)) {
          const offset = camera.position.clone().sub(controls.target)
          moveTo({ p: target.clone().add(offset), t: target })
        }
      }
      for (const pin of pins) pin.el.setAttribute('aria-pressed', String(pin.room.id === selected))
      request()
    },
    setLayers(layers) {
      for (const [id, g] of zoneGroups) g.visible = layers.zones.has(id)
      for (const { mesh, group } of flowGroups.values()) mesh.visible = layers.flows.has(group)
      clearGroup.visible = layers.clearance
      if (roofNode) roofNode.visible = layers.roof !== false
      request()
    },
  }
}
