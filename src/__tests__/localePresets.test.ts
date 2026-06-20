import { describe, it, expect } from 'vitest'
import { defaultLocale } from '../composables/useLocale'
import type { M3Locale } from '../composables/useLocale'
import { esLocale } from '../locales/es'
import { frLocale } from '../locales/fr'
import { ptLocale } from '../locales/pt'
import { deLocale } from '../locales/de'
import { jaLocale } from '../locales/ja'
import { zhLocale } from '../locales/zh'
import { koLocale } from '../locales/ko'

const allLocales: [string, M3Locale][] = [
  ['es', esLocale],
  ['fr', frLocale],
  ['pt', ptLocale],
  ['de', deLocale],
  ['ja', jaLocale],
  ['zh', zhLocale],
  ['ko', koLocale],
]

const defaultKeys = Object.keys(defaultLocale) as (keyof M3Locale)[]

describe('locale presets', () => {
  it.each(allLocales)('%s has all keys from defaultLocale', (_name, locale) => {
    for (const key of defaultKeys) {
      expect(locale[key], `missing key: ${key}`).toBeTruthy()
    }
  })

  it.each(allLocales)('%s has no extra keys', (_name, locale) => {
    const localeKeys = Object.keys(locale)
    for (const key of localeKeys) {
      expect(defaultKeys).toContain(key)
    }
  })

  it.each(allLocales)('%s differs from English defaults', (_name, locale) => {
    let diffs = 0
    for (const key of defaultKeys) {
      if (locale[key] !== defaultLocale[key]) diffs++
    }
    expect(diffs).toBeGreaterThan(defaultKeys.length / 2)
  })
})
