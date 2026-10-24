import { THEME_KEY, storageKey } from './_storageKeys'
import { CONTRAST_KEY, CSS_KEY, PALETTE_KEY, STYLE_ID, type ContrastLevel, type PaletteId } from './useColorPalette'

export interface ThemeInitOptions {
  /** `createM3UI`'s `palette`: the first-visit default, or forced with `persistPalette: false`. */
  palette?: PaletteId | (string & {})
  /** `createM3UI`'s `contrast`, with the same rules as `palette`. */
  contrast?: ContrastLevel
  /** `createM3UI`'s `persistPalette`. */
  persistPalette?: boolean
  /** `createM3UI`'s `storagePrefix`. */
  storagePrefix?: string
}

/**
 * A script to inline in `<head>` of a server-rendered page (Nuxt, Vite SSR), so dark mode, the palette and the
 * contrast level are on `<html>` before the first paint instead of when the app's JS loads. It does what
 * `useTheme` and `useColorPalette` do when they load in the browser (the stored choice, or the given
 * `createM3UI` defaults; a choice only in a cookie, from `createM3UI({ cookies })`, counts too), so pass it the same
 * options as the plugin. A `seed` default can't be generated this
 * early: its first visit still shows the baseline until the app loads (later visits use the cached CSS).
 *
 * ```ts
 * useHead({ script: [{ innerHTML: themeInitScript({ palette: 'red' }) }] })
 * ```
 */
export function themeInitScript(options: ThemeInitOptions = {}): string {
  const config = JSON.stringify({
    keys: Object.fromEntries(Object.entries({ theme: THEME_KEY, palette: PALETTE_KEY, contrast: CONTRAST_KEY, css: CSS_KEY })
      .map(([name, key]) => [name, storageKey(key, options.storagePrefix ?? '')])),
    styleId: STYLE_ID,
    palette: options.palette ?? null,
    contrast: options.contrast ?? null,
    force: options.persistPalette === false,
  }).replace(/</g, '\\u003c')
  // Plain ES5, no dependencies: it runs before anything else. Storage can throw (blocked site data).
  return `(function(o){
var d=document.documentElement;
function cookie(k){var m=document.cookie.match(new RegExp('(?:^|; )'+k+'=([^;]*)'));try{return m?decodeURIComponent(m[1]):null}catch(e){return null}}
function get(k){var v=null;try{v=localStorage.getItem(k)}catch(e){}return v!=null||k===o.keys.css?v:cookie(k)}
function mq(q){return !!(window.matchMedia&&window.matchMedia(q).matches)}
var t=get(o.keys.theme)||'system';
d.classList.toggle('dark',t==='dark'||(t==='system'&&mq('(prefers-color-scheme: dark)')));
var saved=get(o.keys.palette);
var p=o.force&&o.palette?o.palette:(saved||o.palette);
if(p&&p===saved){try{var c=JSON.parse(get(o.keys.css));if(c&&c.id===p){var s=document.createElement('style');s.id=o.styleId;s.textContent=c.css;document.head.appendChild(s)}}catch(e){}}
if(p&&p!=='purple')d.setAttribute('data-palette',p);
var levels=['standard','medium','high','system'];
var stored=get(o.keys.contrast);
var l=o.force&&o.contrast?o.contrast:stored!=null?(levels.indexOf(stored)>-1?stored:'standard'):(o.contrast||'standard');
if(l==='system')l=mq('(prefers-contrast: more)')?'high':'standard';
if(l!=='standard')d.setAttribute('data-contrast',l);
})(${config})`
}
