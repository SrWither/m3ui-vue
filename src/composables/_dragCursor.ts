// While a pointer drag runs (a pan, a resize, a splitter), its cursor stays whatever the pointer passes over, even
// outside the element it started on, and no text gets selected. The `.m3-drag-cursor` rule lives in MGantt.vue's
// <style> (all component CSS ships in one stylesheet).
export function holdDragCursor(cursor: string) {
  const b = document.body
  b.style.cursor = cursor
  b.style.userSelect = 'none'
  b.classList.add('m3-drag-cursor')
}
export function releaseDragCursor() {
  const b = document.body
  b.style.cursor = ''
  b.style.userSelect = ''
  b.classList.remove('m3-drag-cursor')
}
