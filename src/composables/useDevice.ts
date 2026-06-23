import { ref, onMounted, onUnmounted } from 'vue'

const MOBILE_BREAKPOINT = 768

const isMobile = ref(false)
let listeners = 0

function update() {
  isMobile.value = window.innerWidth < MOBILE_BREAKPOINT
}

export function useDevice() {
  onMounted(() => {
    if (listeners === 0) {
      update()
      window.addEventListener('resize', update)
    }
    listeners++
  })

  onUnmounted(() => {
    listeners--
    if (listeners === 0) {
      window.removeEventListener('resize', update)
    }
  })

  return { isMobile }
}
