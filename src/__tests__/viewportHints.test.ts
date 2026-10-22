// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { viewportFromHeaders, VIEWPORT_HINTS } from '../composables/viewportHints'

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const ANDROID_PHONE = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36'
const ANDROID_TABLET = 'Mozilla/5.0 (Linux; Android 15; SM-X910) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36'
const FIREFOX_DESKTOP = 'Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0'

describe('viewportFromHeaders', () => {
  it('prefers the cookie, then the viewport hints', () => {
    expect(viewportFromHeaders({ cookie: 'a=1; m3-viewport=1440x900', 'sec-ch-viewport-width': '390', 'user-agent': IPHONE }))
      .toEqual({ width: 1440, height: 900 })
    expect(viewportFromHeaders({ 'sec-ch-viewport-width': '390', 'sec-ch-viewport-height': '844', 'user-agent': FIREFOX_DESKTOP }))
      .toEqual({ width: 390, height: 844 })
    // Only the width (older Chromium): a height in proportion
    expect(viewportFromHeaders({ 'Sec-CH-Viewport-Width': '1600' })).toEqual({ width: 1600, height: 1000 })
  })

  it('guesses the kind of device on a first visit', () => {
    expect(viewportFromHeaders({ 'user-agent': IPHONE })!.width).toBeLessThan(600)
    expect(viewportFromHeaders({ 'user-agent': ANDROID_PHONE })!.width).toBeLessThan(600)
    const tablet = viewportFromHeaders({ 'user-agent': ANDROID_TABLET })!.width
    expect(tablet).toBeGreaterThanOrEqual(600)
    expect(tablet).toBeLessThan(840)
    expect(viewportFromHeaders({ 'user-agent': FIREFOX_DESKTOP })!.width).toBeGreaterThanOrEqual(1200)
    // Chromium's mobile hint, with a user agent that doesn't say
    expect(viewportFromHeaders({ 'sec-ch-ua-mobile': '?1', 'user-agent': 'Mozilla/5.0 (Linux; Android 10; K)' })!.width).toBeLessThan(600)
  })

  it('takes a Headers object, ignores bad values, and can skip the guess', () => {
    expect(viewportFromHeaders(new Headers({ cookie: 'm3-viewport=800x600' }))).toEqual({ width: 800, height: 600 })
    expect(viewportFromHeaders({ cookie: 'm3-viewport=wide', 'user-agent': FIREFOX_DESKTOP })!.width).toBe(1280)
    expect(viewportFromHeaders({ 'user-agent': IPHONE }, { guess: false })).toBeUndefined()
    expect(viewportFromHeaders({})).toBeUndefined()
  })

  it('names the hints for Accept-CH', () => {
    expect(VIEWPORT_HINTS).toBe('Sec-CH-Viewport-Width, Sec-CH-Viewport-Height')
  })
})
