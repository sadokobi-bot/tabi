import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import {
  CanvasTexture,
  CapsuleGeometry,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NeutralToneMapping,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  Scene,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  WebGLRenderer,
  type BufferGeometry,
  type Material,
} from 'three'
import { LuckyCat, type CatMood } from './LuckyCat'

/** Paw positions (cat space; y up, z toward the viewer) per mood. "right" is the cat's right, on our left. */
const PAWS: Record<CatMood, { right: Vector3; left: Vector3 }> = {
  wave: { right: new Vector3(-1.2, 2.05, 0.35), left: new Vector3(0.55, 0.5, 0.78) },
  cover: { right: new Vector3(-0.38, 1.8, 1.08), left: new Vector3(0.38, 1.8, 1.08) },
  peek: { right: new Vector3(-0.45, 1.38, 1.05), left: new Vector3(0.38, 1.8, 1.08) },
}
const SHOULDER_RIGHT = new Vector3(-0.66, 1.08, 0.25)
const SHOULDER_LEFT = new Vector3(0.66, 1.08, 0.25)
const ARM_RADIUS = 0.17
const UP = new Vector3(0, 1, 0)

/**
 * The sign-up guide in real 3D: a chubby maneki-neko built from soft shapes, lit like a
 * matte vinyl toy. It bobs, blinks and waves; covers its eyes while a password is typed and
 * peeks when it's shown; and hops when tapped. Falls back to the flat SVG cat without WebGL.
 */
export default function Cat3D({ mood, className }: { mood: CatMood; className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const moodRef = useRef(mood)
  const hopRef = useRef<number | null>(null)
  const [failed, setFailed] = useState(false)
  moodRef.current = mood

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    let renderer: WebGLRenderer
    try {
      renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' })
    } catch {
      setFailed(true)
      return
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.toneMapping = NeutralToneMapping
    renderer.toneMappingExposure = 1.05
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    renderer.domElement.style.display = 'block'
    host.appendChild(renderer.domElement)

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const scene = new Scene()
    const camera = new PerspectiveCamera(28, 1, 0.1, 50)
    camera.position.set(0, 1.5, 7.8)
    camera.lookAt(0, 1.2, 0)

    scene.add(new HemisphereLight('#fff6ee', '#d8b4ac', 1.5))
    const key = new DirectionalLight('#ffffff', 2.3)
    key.position.set(3, 5, 6)
    scene.add(key)
    const rim = new DirectionalLight('#ffd2bf', 1.4)
    rim.position.set(-4, 3, -4)
    scene.add(rim)

    // Everything we create, to dispose on unmount.
    const geometries: BufferGeometry[] = []
    const materials: Material[] = []
    const geo = <T extends BufferGeometry>(g: T) => (geometries.push(g), g)
    const mat = <T extends Material>(m: T) => (materials.push(m), m)

    const fur = mat(new MeshStandardMaterial({ color: '#fffaf2', roughness: 0.58 }))
    const ginger = mat(new MeshStandardMaterial({ color: '#f3a35a', roughness: 0.6 }))
    const pink = mat(new MeshStandardMaterial({ color: '#f7a8b6', roughness: 0.55 }))
    const cheek = mat(new MeshStandardMaterial({ color: '#ff9db0', roughness: 0.7, transparent: true, opacity: 0.55 }))
    const ink = mat(new MeshStandardMaterial({ color: '#2a1c16', roughness: 0.25 }))
    const shine = mat(new MeshBasicMaterial({ color: '#ffffff' }))
    const red = mat(new MeshStandardMaterial({ color: '#d8432b', roughness: 0.45 }))
    // Low metalness: with nothing around to reflect, metal renders dark olive instead of gold.
    const gold = mat(
      new MeshStandardMaterial({ color: '#f6c443', roughness: 0.32, metalness: 0.12, emissive: '#6b4300', emissiveIntensity: 0.18 }),
    )

    const sphere = geo(new SphereGeometry(1, 48, 32))
    const mesh = (geometry: BufferGeometry, material: Material, [x, y, z]: number[], [sx, sy, sz] = [1, 1, 1]) => {
      const m = new Mesh(geometry, material)
      m.position.set(x!, y!, z!)
      m.scale.set(sx!, sy!, sz!)
      return m
    }

    const cat = new Group()
    scene.add(cat)

    // Soft contact shadow under the cat.
    const shadowCanvas = document.createElement('canvas')
    shadowCanvas.width = shadowCanvas.height = 128
    const ctx = shadowCanvas.getContext('2d')!
    const gradient = ctx.createRadialGradient(64, 64, 4, 64, 64, 64)
    gradient.addColorStop(0, 'rgba(0,0,0,0.38)')
    gradient.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 128, 128)
    const shadowTexture = new CanvasTexture(shadowCanvas)
    const shadow = new Mesh(
      geo(new PlaneGeometry(2.8, 1.2)),
      mat(new MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false })),
    )
    shadow.rotation.x = -Math.PI / 2
    shadow.position.y = -0.24
    scene.add(shadow)

    // Body, feet, tail
    const body = new Group()
    cat.add(body)
    body.add(mesh(sphere, fur, [0, 0.62, 0], [0.96, 0.9, 0.86]))
    body.add(mesh(sphere, fur, [-0.42, -0.08, 0.5], [0.3, 0.2, 0.34]))
    body.add(mesh(sphere, fur, [0.42, -0.08, 0.5], [0.3, 0.2, 0.34]))
    const tail = mesh(geo(new TorusGeometry(0.42, 0.12, 16, 40, Math.PI * 1.15)), ginger, [0.72, 0.42, -0.62])
    tail.rotation.set(0.4, -0.6, -0.3)
    body.add(tail)

    // Collar and bell
    const collar = mesh(geo(new TorusGeometry(0.74, 0.085, 16, 72)), red, [0, 1.06, 0.02])
    collar.rotation.x = Math.PI / 2 - 0.12
    body.add(collar)
    body.add(mesh(sphere, gold, [0, 0.94, 0.76], [0.16, 0.16, 0.16]))
    body.add(mesh(geo(new CylinderGeometry(0.012, 0.012, 0.2, 8)), ink, [0, 0.9, 0.9]).rotateZ(Math.PI / 2))

    // Head
    const head = new Group()
    head.position.set(0, 1.78, 0)
    cat.add(head)
    head.add(mesh(sphere, fur, [0, 0, 0], [1.18, 0.98, 1]))
    const earGeometry = geo(new ConeGeometry(0.34, 0.62, 32))
    const innerEarGeometry = geo(new ConeGeometry(0.19, 0.38, 32))
    for (const side of [-1, 1]) {
      const ear = mesh(earGeometry, side > 0 ? ginger : fur, [side * 0.68, 0.8, -0.05])
      ear.rotation.z = -side * 0.42
      head.add(ear)
      const inner = mesh(innerEarGeometry, pink, [side * 0.66, 0.76, 0.1])
      inner.rotation.z = -side * 0.42
      head.add(inner)
    }

    // Face: eyes (they blink), nose, mouth, cheeks, whiskers
    const eyes = new Group()
    head.add(eyes)
    for (const side of [-1, 1]) {
      eyes.add(mesh(sphere, ink, [side * 0.38, 0.02, 0.9], [0.15, 0.19, 0.08]))
      eyes.add(mesh(sphere, shine, [side * 0.38 + 0.05, 0.09, 0.97], [0.045, 0.045, 0.02]))
      head.add(mesh(sphere, cheek, [side * 0.68, -0.2, 0.72], [0.18, 0.12, 0.06]))
      for (const tilt of [0.12, -0.08]) {
        const whisker = mesh(geo(new CylinderGeometry(0.012, 0.012, 0.5, 6)), ink, [side * 1.05, -0.14 + tilt * 0.5, 0.62])
        whisker.rotation.z = Math.PI / 2 + side * tilt
        whisker.rotation.y = -side * 0.35
        head.add(whisker)
      }
    }
    head.add(mesh(sphere, mat(new MeshStandardMaterial({ color: '#ec7d92', roughness: 0.4 })), [0, -0.16, 0.99], [0.085, 0.06, 0.05]))
    const mouthGeometry = geo(new TorusGeometry(0.075, 0.018, 8, 24, Math.PI))
    for (const side of [-1, 1]) {
      const mouth = mesh(mouthGeometry, ink, [side * 0.075, -0.25, 0.98])
      mouth.rotation.z = Math.PI
      head.add(mouth)
    }

    // Arms (capsules stretched from shoulder to paw every frame) and paws with pink pads
    const armGeometry = geo(new CapsuleGeometry(ARM_RADIUS, 1, 8, 16))
    const makePaw = () => {
      const paw = new Group()
      paw.add(mesh(sphere, fur, [0, 0, 0], [0.25, 0.26, 0.24]))
      paw.add(mesh(sphere, pink, [0, -0.02, 0.21], [0.09, 0.08, 0.04]))
      for (const dx of [-0.1, 0, 0.1]) paw.add(mesh(sphere, pink, [dx, 0.1, 0.19], [0.04, 0.04, 0.025]))
      cat.add(paw)
      return paw
    }
    const arms = { right: new Mesh(armGeometry, fur), left: new Mesh(armGeometry, fur) }
    cat.add(arms.right, arms.left)
    const paws = { right: makePaw(), left: makePaw() }
    const current = { right: PAWS.wave.right.clone(), left: PAWS.wave.left.clone() }

    // Koban coin, held while waving
    const coin = mesh(geo(new CylinderGeometry(0.34, 0.34, 0.06, 40)), gold, [0, 0, 0], [0.78, 1, 1])
    coin.rotation.x = Math.PI / 2
    cat.add(coin)

    const placeArm = (arm: Mesh, from: Vector3, to: Vector3) => {
      const direction = new Vector3().subVectors(to, from)
      const length = direction.length()
      arm.position.copy(from).addScaledVector(direction, 0.5)
      arm.quaternion.copy(new Quaternion().setFromUnitVectors(UP, direction.normalize()))
      arm.scale.set(1, Math.max(0.2, length / (1 + ARM_RADIUS * 2)), 1)
    }

    const resize = () => {
      const { width, height } = host.getBoundingClientRect()
      if (!width || !height) return
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(host)
    resize()

    let frame = 0
    let last = performance.now()
    let coinScale = 1
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick)
      if (document.visibilityState !== 'visible') return
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const t = now / 1000
      const m = moodRef.current
      const ease = 1 - Math.exp(-dt * 9)

      // Paws glide toward the mood's pose; the raised one waves.
      const target = PAWS[m]
      const wave = m === 'wave' && !reduceMotion ? new Vector3(Math.sin(t * 7) * 0.14, Math.cos(t * 14) * 0.05, 0) : new Vector3()
      current.right.lerp(target.right.clone().add(wave), ease)
      current.left.lerp(target.left, ease)
      paws.right.position.copy(current.right)
      paws.left.position.copy(current.left)
      paws.right.rotation.z = m === 'wave' && !reduceMotion ? Math.sin(t * 7) * 0.35 : 0
      placeArm(arms.right, SHOULDER_RIGHT, current.right)
      placeArm(arms.left, SHOULDER_LEFT, current.left)

      coinScale += ((m === 'wave' ? 1 : 0) - coinScale) * ease
      coin.position.copy(current.left).add(new Vector3(0.12, 0.28, 0.16))
      coin.scale.set(0.78 * coinScale, coinScale, coinScale)
      coin.visible = coinScale > 0.02

      // Idle life: bob, head tilt (a shy dip while covering, a curious tilt when peeking), blinks.
      const bob = reduceMotion ? 0 : Math.sin(t * 2.2) * 0.05
      let hop = 0
      if (hopRef.current != null) {
        const p = (now - hopRef.current) / 550
        if (p >= 1) hopRef.current = null
        else hop = Math.sin(p * Math.PI) * 0.55
      }
      cat.position.y = bob + hop
      cat.scale.set(1 + hop * 0.06, 1 - hop * 0.04, 1 + hop * 0.06)
      shadow.scale.setScalar(1 - hop * 0.5)
      const tiltTarget = m === 'peek' ? 0.14 : reduceMotion ? 0 : Math.sin(t * 1.3) * 0.05
      head.rotation.z += (tiltTarget - head.rotation.z) * ease
      head.rotation.x += ((m === 'cover' ? 0.14 : 0) - head.rotation.x) * ease
      cat.rotation.y += ((m === 'wave' && !reduceMotion ? Math.sin(t * 0.7) * 0.18 : 0) - cat.rotation.y) * ease
      const blinkPhase = t % 3.6
      eyes.scale.y = blinkPhase > 3.45 ? Math.max(0.1, Math.abs(blinkPhase - 3.525) / 0.075) : 1

      renderer.render(scene, camera)
    }
    frame = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      geometries.forEach((g) => g.dispose())
      materials.forEach((m) => m.dispose())
      shadowTexture.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [])

  if (failed) return <LuckyCat mood={mood} className={className} />

  return (
    <div
      ref={hostRef}
      role="img"
      aria-label="חתול המזל מנופף לשלום"
      onPointerDown={() => (hopRef.current = performance.now())}
      className={clsx('relative', className)}
    />
  )
}
