import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cubicBezier, motionDurations, motionEasings, motionSprings } from '../composables/motion'
import { DEFAULT_SPATIAL, FAST_SPATIAL, fastOutSlowIn } from '../composables/_useSpring'

describe('motion tokens', () => {
  it('evaluates cubic-bezier easings', () => {
    const linear = cubicBezier(...motionEasings.linear)
    expect(linear(0.3)).toBeCloseTo(0.3, 5)
    const emphasized = cubicBezier(...motionEasings.emphasized)
    expect(emphasized(0)).toBe(0)
    expect(emphasized(1)).toBe(1)
    // Front-loaded: well past halfway by the middle of the duration
    expect(emphasized(0.5)).toBeGreaterThan(0.85)
    expect(fastOutSlowIn(0.5)).toBeCloseTo(cubicBezier(0.4, 0, 0.2, 1)(0.5), 10)
  })

  it('keeps the internal spring shorthands on the Standard scheme', () => {
    expect(FAST_SPATIAL).toEqual(motionSprings.standard.fastSpatial)
    expect(DEFAULT_SPATIAL).toEqual({ dampingRatio: 0.9, stiffness: 700 })
    expect(motionSprings.expressive.fastSpatial).toEqual({ dampingRatio: 0.6, stiffness: 800 })
  })

  it('matches the CSS variables in theme.css', () => {
    const css = readFileSync(resolve(__dirname, '../styles/theme.css'), 'utf8')
    for (const [name, ms] of Object.entries(motionDurations)) {
      const cssName = name.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/(\d)$/, '-$1')
      expect(css).toContain(`--duration-${cssName}: ${ms}ms;`)
    }
    for (const [name, [x1, y1, x2, y2]] of Object.entries(motionEasings)) {
      if (name === 'linear') continue
      const cssName = name.replace(/([A-Z])/g, '-$1').toLowerCase()
      expect(css).toContain(`--ease-${cssName}: cubic-bezier(${x1}, ${y1}, ${x2}, ${y2});`)
    }
  })
})
