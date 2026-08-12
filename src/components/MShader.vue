<script setup lang="ts">
/// <reference types="@webgpu/types" />
import { ref, shallowRef, onMounted, onBeforeUnmount, watch } from 'vue'
import MSpinner from './MSpinner.vue'

/** Thrown when a backend can't run at all in this browser (no API, no adapter, no context) — as
 *  opposed to a shader authoring error — so the component can show #fallback instead of #error. */
class UnsupportedError extends Error {}

export type ShaderRenderer = 'auto' | 'webgpu' | 'webgl'
export type ShaderStatus = 'loading' | 'ready' | 'error' | 'fallback'

const props = withDefaults(
  defineProps<{
    /** GLSL fragment shader body (Shadertoy-style): must define `mainImage(out vec4 fragColor, in vec2 fragCoord)`.
     *  Runs on WebGL2. Always required as the compatible baseline. */
    code: string
    /** Optional WGSL fragment shader module, e.g. `@fragment fn fs_main(@builtin(position) pos: vec4f) -> @location(0) vec4f`.
     *  Runs on WebGPU when available. Must declare its own bindings — see docs for the required uniform buffer layout. */
    wgsl?: string
    /** Which backend to use. 'auto' picks WebGPU when `wgsl` is set and supported, else WebGL2. */
    renderer?: ShaderRenderer
    /** Custom uniforms. Keys/shape are locked in at mount time; only values are reactive per frame. */
    uniforms?: Record<string, number | number[]>
    paused?: boolean
    /** Device pixel ratio to render at. Defaults to devicePixelRatio, capped at 2 for performance. */
    pixelRatio?: number
  }>(),
  { renderer: 'auto' },
)

const emit = defineEmits<{
  ready: [renderer: 'webgpu' | 'webgl']
  error: [message: string]
}>()

const containerRef = ref<HTMLDivElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)

const status = ref<ShaderStatus>('loading')
const errorMessage = ref('')
const activeRenderer = shallowRef<'webgpu' | 'webgl' | null>(null)

interface MouseState {
  x: number
  y: number
  clickX: number
  clickY: number
  down: boolean
}
const mouse: MouseState = { x: 0, y: 0, clickX: 0, clickY: 0, down: false }

interface ShaderBackend {
  init(canvas: HTMLCanvasElement): Promise<void>
  resize(width: number, height: number): void
  render(time: number, frame: number): void
  /** `final` is true only on component unmount — the canvas won't be reused, so it's safe to force
   *  the context to release its GPU resources immediately instead of waiting on garbage collection. */
  destroy(final: boolean): void
  /** Raw context/device for power users who want to go beyond the declarative props. */
  raw(): WebGL2RenderingContext | GPUDevice | null
}

let backend: ShaderBackend | null = null
let resizeObserver: ResizeObserver | null = null
let intersectionObserver: IntersectionObserver | null = null
let rafId = 0
let running = false
let visible = true
let startTime = 0
let pausedElapsed = 0
let frameCount = 0
let uniformKeys: string[] = []

function effectivePixelRatio() {
  return props.pixelRatio ?? Math.min(window.devicePixelRatio || 1, 2)
}

function uniformType(value: number | number[]): 'float' | 'vec2' | 'vec3' | 'vec4' {
  if (typeof value === 'number') return 'float'
  if (value.length === 2) return 'vec2'
  if (value.length === 3) return 'vec3'
  return 'vec4'
}

function currentUniformValues() {
  return props.uniforms ?? {}
}

/* ── WebGL2 backend ───────────────────────────────────────────────────── */

function createWebGLBackend(): ShaderBackend {
  let gl: WebGL2RenderingContext | null = null
  let program: WebGLProgram | null = null
  let locITime: WebGLUniformLocation | null = null
  let locIResolution: WebGLUniformLocation | null = null
  let locIMouse: WebGLUniformLocation | null = null
  let locIFrame: WebGLUniformLocation | null = null
  const customLocations = new Map<string, WebGLUniformLocation>()

  const VERTEX_SRC = `#version 300 es
void main() {
  vec2 pos = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(pos * 2.0 - 1.0, 0.0, 1.0);
}`

  function buildFragmentSource() {
    const declarations = uniformKeys
      .map((key) => `uniform ${uniformType(currentUniformValues()[key] ?? 0)} ${key};`)
      .join('\n')
    return `#version 300 es
precision highp float;
uniform float iTime;
uniform vec3 iResolution;
uniform vec4 iMouse;
uniform int iFrame;
${declarations}
out vec4 fragColor;
${props.code}
void main() {
  mainImage(fragColor, gl_FragCoord.xy);
}`
  }

  function compileShader(source: string, type: number) {
    const gl2 = gl!
    const shader = gl2.createShader(type)!
    gl2.shaderSource(shader, source)
    gl2.compileShader(shader)
    if (!gl2.getShaderParameter(shader, gl2.COMPILE_STATUS)) {
      const log = gl2.getShaderInfoLog(shader) || 'unknown compile error'
      gl2.deleteShader(shader)
      throw new Error(`${type === gl2.VERTEX_SHADER ? 'Vertex' : 'Fragment'} shader failed to compile:\n${log}`)
    }
    return shader
  }

  function buildProgram() {
    const gl2 = gl!
    const vs = compileShader(VERTEX_SRC, gl2.VERTEX_SHADER)
    const fs = compileShader(buildFragmentSource(), gl2.FRAGMENT_SHADER)
    const prog = gl2.createProgram()!
    gl2.attachShader(prog, vs)
    gl2.attachShader(prog, fs)
    gl2.linkProgram(prog)
    gl2.deleteShader(vs)
    gl2.deleteShader(fs)
    if (!gl2.getProgramParameter(prog, gl2.LINK_STATUS)) {
      const log = gl2.getProgramInfoLog(prog) || 'unknown link error'
      gl2.deleteProgram(prog)
      throw new Error(`Shader program failed to link:\n${log}`)
    }
    program = prog
    locITime = gl2.getUniformLocation(prog, 'iTime')
    locIResolution = gl2.getUniformLocation(prog, 'iResolution')
    locIMouse = gl2.getUniformLocation(prog, 'iMouse')
    locIFrame = gl2.getUniformLocation(prog, 'iFrame')
    customLocations.clear()
    for (const key of uniformKeys) {
      const loc = gl2.getUniformLocation(prog, key)
      if (loc) customLocations.set(key, loc)
    }
  }

  return {
    async init(canvas) {
      gl = canvas.getContext('webgl2', { antialias: true, alpha: true })
      if (!gl) throw new UnsupportedError('WebGL2 is not supported in this browser.')
      buildProgram()
    },
    resize(width, height) {
      gl?.viewport(0, 0, width, height)
    },
    render(time) {
      const gl2 = gl
      if (!gl2 || !program) return
      gl2.useProgram(program)
      gl2.uniform1f(locITime, time)
      gl2.uniform3f(locIResolution, gl2.drawingBufferWidth, gl2.drawingBufferHeight, effectivePixelRatio())
      gl2.uniform4f(
        locIMouse,
        mouse.x,
        mouse.y,
        mouse.down ? mouse.clickX : -mouse.clickX,
        mouse.down ? mouse.clickY : -mouse.clickY,
      )
      gl2.uniform1i(locIFrame, frameCount)
      const values = currentUniformValues()
      for (const key of uniformKeys) {
        const loc = customLocations.get(key)
        if (!loc) continue
        const v = values[key] ?? 0
        if (typeof v === 'number') gl2.uniform1f(loc, v)
        else if (v.length === 2) gl2.uniform2f(loc, v[0]!, v[1]!)
        else if (v.length === 3) gl2.uniform3f(loc, v[0]!, v[1]!, v[2]!)
        else gl2.uniform4f(loc, v[0]!, v[1]!, v[2]!, v[3]!)
      }
      gl2.drawArrays(gl2.TRIANGLES, 0, 3)
    },
    destroy(final) {
      if (program) gl?.deleteProgram(program)
      // Only force-lose the context on final unmount: the canvas is reused across restart()/prop
      // rebuilds, and a canvas only ever gets one context instance per type — losing it here would
      // permanently break every future getContext('webgl2') call on the same element.
      if (final) gl?.getExtension('WEBGL_lose_context')?.loseContext()
      gl = null
      program = null
    },
    raw: () => gl,
  }
}

/* ── WebGPU backend ───────────────────────────────────────────────────── */

function createWebGPUBackend(): ShaderBackend {
  let context: GPUCanvasContext | null = null
  let device: GPUDevice | null = null
  let pipeline: GPURenderPipeline | null = null
  let bindGroup: GPUBindGroup | null = null
  let builtinBuffer: GPUBuffer | null = null
  let customBuffer: GPUBuffer | null = null
  const builtinData = new Float32Array(12)
  let customData: Float32Array | null = null
  let format: GPUTextureFormat = 'bgra8unorm'

  const VERTEX_SRC = `@vertex
fn vs_main(@builtin(vertex_index) idx: u32) -> @builtin(position) vec4f {
  var pos = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  return vec4f(pos[idx], 0.0, 1.0);
}`

  return {
    async init(canvas) {
      if (!navigator.gpu) throw new UnsupportedError('WebGPU is not supported in this browser.')
      const adapter = await navigator.gpu.requestAdapter()
      if (!adapter) throw new UnsupportedError('No WebGPU adapter available.')
      device = await adapter.requestDevice()
      context = canvas.getContext('webgpu')
      if (!context) throw new UnsupportedError('Failed to acquire a WebGPU canvas context.')
      format = navigator.gpu.getPreferredCanvasFormat()
      context.configure({ device, format, alphaMode: 'opaque' })

      device.addEventListener('uncapturederror', (ev) => {
        const message = (ev as GPUUncapturedErrorEvent).error.message
        errorMessage.value = message
        status.value = 'error'
        emit('error', message)
        stopLoop()
      })
      device.lost.then((info) => {
        if (info.reason === 'destroyed') return
        errorMessage.value = `WebGPU device was lost: ${info.message}`
        status.value = 'error'
        emit('error', errorMessage.value)
        stopLoop()
      })

      const vsModule = device.createShaderModule({ code: VERTEX_SRC })
      const fsModule = device.createShaderModule({ code: props.wgsl! })
      const info = await fsModule.getCompilationInfo()
      const compileErrors = info.messages.filter((m) => m.type === 'error')
      if (compileErrors.length) {
        throw new Error(compileErrors.map((m) => `${m.lineNum}:${m.linePos}: ${m.message}`).join('\n'))
      }

      device.pushErrorScope('validation')

      const entries: GPUBindGroupLayoutEntry[] = [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
      ]
      if (uniformKeys.length) {
        entries.push({ binding: 1, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } })
      }
      const bindGroupLayout = device.createBindGroupLayout({ entries })
      const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] })

      pipeline = device.createRenderPipeline({
        layout: pipelineLayout,
        vertex: { module: vsModule, entryPoint: 'vs_main' },
        fragment: { module: fsModule, entryPoint: 'fs_main', targets: [{ format }] },
        primitive: { topology: 'triangle-list' },
      })

      builtinBuffer = device.createBuffer({
        size: builtinData.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      })

      const bindGroupEntries: GPUBindGroupEntry[] = [{ binding: 0, resource: { buffer: builtinBuffer } }]
      if (uniformKeys.length) {
        customData = new Float32Array(uniformKeys.length * 4)
        customBuffer = device.createBuffer({
          size: customData.byteLength,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        })
        bindGroupEntries.push({ binding: 1, resource: { buffer: customBuffer } })
      }
      bindGroup = device.createBindGroup({ layout: bindGroupLayout, entries: bindGroupEntries })

      const validationError = await device.popErrorScope()
      if (validationError) throw new Error(validationError.message)
    },
    resize(width, height) {
      // canvas backing store resize is enough; WebGPU reconfigure not required per-frame
      void width
      void height
    },
    render(time) {
      if (!device || !context || !pipeline || !bindGroup || !builtinBuffer) return
      const canvas = context.canvas as HTMLCanvasElement
      builtinData[0] = time
      builtinData[2] = canvas.width
      builtinData[3] = canvas.height
      builtinData[4] = mouse.x
      builtinData[5] = mouse.y
      builtinData[6] = mouse.down ? mouse.clickX : -mouse.clickX
      builtinData[7] = mouse.down ? mouse.clickY : -mouse.clickY
      builtinData[8] = frameCount
      device.queue.writeBuffer(builtinBuffer, 0, builtinData)

      if (customBuffer && customData) {
        const values = currentUniformValues()
        uniformKeys.forEach((key, i) => {
          const v = values[key] ?? 0
          const base = i * 4
          if (typeof v === 'number') {
            customData![base] = v
          } else {
            customData![base] = v[0] ?? 0
            customData![base + 1] = v[1] ?? 0
            customData![base + 2] = v[2] ?? 0
            customData![base + 3] = v[3] ?? 0
          }
        })
        device.queue.writeBuffer(customBuffer, 0, customData)
      }

      const encoder = device.createCommandEncoder()
      const view = context.getCurrentTexture().createView()
      const pass = encoder.beginRenderPass({
        colorAttachments: [{ view, clearValue: { r: 0, g: 0, b: 0, a: 1 }, loadOp: 'clear', storeOp: 'store' }],
      })
      pass.setPipeline(pipeline)
      pass.setBindGroup(0, bindGroup)
      pass.draw(3)
      pass.end()
      device.queue.submit([encoder.finish()])
    },
    destroy() {
      builtinBuffer?.destroy()
      customBuffer?.destroy()
      device?.destroy()
      context = null
      device = null
      pipeline = null
      bindGroup = null
    },
    raw: () => device,
  }
}

/* ── lifecycle / render loop ─────────────────────────────────────────── */

function pickRenderer(): 'webgpu' | 'webgl' {
  if (props.renderer === 'webgl') return 'webgl'
  if (props.renderer === 'webgpu') return 'webgpu'
  return typeof navigator !== 'undefined' && !!navigator.gpu && props.wgsl ? 'webgpu' : 'webgl'
}

function tick(now: number) {
  if (!running || !visible) return
  const time = (now - startTime) / 1000 + pausedElapsed
  frameCount++
  backend?.render(time, frameCount)
  rafId = requestAnimationFrame(tick)
}

function startLoop() {
  if (rafId || !running || !visible || status.value !== 'ready') return
  startTime = performance.now()
  rafId = requestAnimationFrame(tick)
}

function stopLoop(keepElapsed = true) {
  if (rafId) cancelAnimationFrame(rafId)
  rafId = 0
  if (keepElapsed && startTime) {
    pausedElapsed += (performance.now() - startTime) / 1000
  }
}

async function setup() {
  const canvas = canvasRef.value
  const container = containerRef.value
  if (!canvas || !container) return

  status.value = 'loading'
  uniformKeys = Object.keys(props.uniforms ?? {})

  const wanted = pickRenderer()
  if (wanted === 'webgpu' && !props.wgsl) {
    status.value = 'error'
    errorMessage.value = 'renderer="webgpu" was forced but no `wgsl` prop was provided.'
    emit('error', errorMessage.value)
    return
  }

  backend = wanted === 'webgpu' ? createWebGPUBackend() : createWebGLBackend()

  async function finish(name: 'webgpu' | 'webgl') {
    activeRenderer.value = name
    resize()
    status.value = 'ready'
    running = !props.paused
    startLoop()
    emit('ready', name)
  }

  try {
    await backend.init(canvas)
    await finish(wanted)
  } catch (err) {
    // Only silently downgrade when WebGPU itself is unavailable in 'auto' mode — a broken WGSL
    // shader should surface as an error, not get quietly masked by a fallback render.
    if (wanted === 'webgpu' && props.renderer === 'auto' && err instanceof UnsupportedError) {
      backend = createWebGLBackend()
      try {
        await backend.init(canvas)
        await finish('webgl')
        return
      } catch (fallbackErr) {
        setFailure(fallbackErr)
        return
      }
    }
    setFailure(err)
  }
}

function setFailure(err: unknown) {
  errorMessage.value = err instanceof Error ? err.message : String(err)
  status.value = err instanceof UnsupportedError ? 'fallback' : 'error'
  emit('error', errorMessage.value)
}

function resize() {
  const canvas = canvasRef.value
  const container = containerRef.value
  if (!canvas || !container) return
  const ratio = effectivePixelRatio()
  const width = Math.max(1, Math.round(container.clientWidth * ratio))
  const height = Math.max(1, Math.round(container.clientHeight * ratio))
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
    backend?.resize(width, height)
  }
}

function teardown(final = false) {
  stopLoop(false)
  backend?.destroy(final)
  backend = null
  activeRenderer.value = null
}

function onPointerMove(e: PointerEvent) {
  const canvas = canvasRef.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  const ratio = effectivePixelRatio()
  mouse.x = (e.clientX - rect.left) * ratio
  mouse.y = (rect.height - (e.clientY - rect.top)) * ratio
}
function onPointerDown(e: PointerEvent) {
  onPointerMove(e)
  mouse.down = true
  mouse.clickX = mouse.x
  mouse.clickY = mouse.y
}
function onPointerUp() {
  mouse.down = false
}

onMounted(async () => {
  const canvas = canvasRef.value!
  canvas.addEventListener('pointermove', onPointerMove)
  canvas.addEventListener('pointerdown', onPointerDown)
  window.addEventListener('pointerup', onPointerUp)

  resizeObserver = new ResizeObserver(() => resize())
  resizeObserver.observe(containerRef.value!)

  intersectionObserver = new IntersectionObserver(([entry]) => {
    visible = !!entry?.isIntersecting
    if (visible) startLoop()
    else stopLoop()
  })
  intersectionObserver.observe(containerRef.value!)

  await setup()
})

onBeforeUnmount(() => {
  const canvas = canvasRef.value
  canvas?.removeEventListener('pointermove', onPointerMove)
  canvas?.removeEventListener('pointerdown', onPointerDown)
  window.removeEventListener('pointerup', onPointerUp)
  resizeObserver?.disconnect()
  intersectionObserver?.disconnect()
  teardown(true)
})

watch(
  [() => props.code, () => props.wgsl, () => props.renderer],
  async () => {
    teardown()
    await setup()
  },
)

watch(
  () => props.paused,
  (isPaused) => {
    running = !isPaused
    if (running) startLoop()
    else stopLoop()
  },
)

defineExpose({
  canvas: canvasRef,
  /** 'webgpu' | 'webgl' | null — which backend is actually driving the canvas right now. */
  renderer: activeRenderer,
  status,
  /** Raw WebGL2RenderingContext or GPUDevice, for consumers who want to go beyond the props API. */
  context: () => backend?.raw() ?? null,
  pause: () => {
    running = false
    stopLoop()
  },
  play: () => {
    running = true
    startLoop()
  },
  restart: async () => {
    pausedElapsed = 0
    frameCount = 0
    teardown()
    await setup()
  },
})
</script>

<template>
  <div ref="containerRef" class="relative h-full w-full overflow-hidden">
    <canvas ref="canvasRef" class="block h-full w-full touch-none" />

    <div v-if="status === 'loading'" class="absolute inset-0 flex items-center justify-center">
      <slot name="loading">
        <MSpinner />
      </slot>
    </div>

    <div v-else-if="status === 'fallback'" class="absolute inset-0 flex items-center justify-center p-4">
      <slot name="fallback">
        <p class="text-center text-body-medium text-on-surface-variant">
          Shaders are not supported in this browser.
        </p>
      </slot>
    </div>

    <div v-else-if="status === 'error'" class="absolute inset-0 flex items-center justify-center overflow-auto p-4">
      <slot name="error" :message="errorMessage">
        <pre class="max-h-full w-full overflow-auto whitespace-pre-wrap text-body-small text-error">{{ errorMessage }}</pre>
      </slot>
    </div>
  </div>
</template>
