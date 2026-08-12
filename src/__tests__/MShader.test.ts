import { describe, it, expect } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import MShader from '../components/MShader.vue'

const BASIC_CODE = `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  fragColor = vec4(fragCoord / iResolution.xy, 0.0, 1.0);
}`

describe('MShader', () => {
  it('shows the fallback slot when neither WebGL2 nor WebGPU is available', async () => {
    // happy-dom returns null from canvas.getContext('webgl2') and has no navigator.gpu,
    // so this exercises the same "unsupported browser" path real old browsers hit.
    const wrapper = mount(MShader, { props: { code: BASIC_CODE } })
    await flushPromises()

    expect(wrapper.text()).toContain('Shaders are not supported in this browser')
    expect(wrapper.emitted('error')).toBeTruthy()
    expect(wrapper.emitted('ready')).toBeFalsy()
  })

  it('renders a custom #fallback slot', async () => {
    const wrapper = mount(MShader, {
      props: { code: BASIC_CODE },
      slots: { fallback: '<p>custom fallback</p>' },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('custom fallback')
  })

  it('errors immediately when renderer="webgpu" is forced without a wgsl prop', async () => {
    const wrapper = mount(MShader, { props: { code: BASIC_CODE, renderer: 'webgpu' } })
    await flushPromises()

    const errors = wrapper.emitted('error')
    expect(errors).toBeTruthy()
    expect(errors![0]![0]).toContain('no `wgsl` prop was provided')
  })

  it('exposes canvas, status and imperative controls', async () => {
    const wrapper = mount(MShader, { props: { code: BASIC_CODE } })
    await flushPromises()

    expect(wrapper.vm.canvas).toBeTruthy()
    expect(wrapper.vm.status).toBe('fallback')
    expect(typeof wrapper.vm.pause).toBe('function')
    expect(typeof wrapper.vm.play).toBe('function')
    expect(typeof wrapper.vm.restart).toBe('function')
  })
})
