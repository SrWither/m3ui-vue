// Storage keys shared with modules that must not load useTheme (it applies the theme to <html> when it loads)
export const THEME_KEY = 'm3-theme'
// The <style> useColorPalette writes a generated palette's CSS into
export const STYLE_ID = 'm3-dynamic-palette'
// The window's size, a cookie only (createM3UI({ cookies: true })): `<width>x<height>`
export const VIEWPORT_KEY = 'm3-viewport'
