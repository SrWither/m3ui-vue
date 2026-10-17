import type { M3Locale } from '../composables/useLocale'

export const esLocale: M3Locale = {
  lang: 'es',

  // Common
  search: 'Buscar...',
  noResults: 'Sin resultados',
  close: 'Cerrar',
  menu: 'Menú',
  cancel: 'Cancelar',
  confirm: 'Confirmar',
  loading: 'Cargando',

  // Navigation
  previous: 'Anterior',
  next: 'Siguiente',
  today: 'Hoy',
  more: 'más',

  // Tables
  selectedCount: 'seleccionados',
  recordCount: 'registro',
  expand: 'Expandir',
  columns: 'Columnas',
  exportCsv: 'Exportar CSV',
  noGroup: 'Sin grupo',

  // Tour
  finish: 'Finalizar',

  // File upload
  dropText: 'Arrastra archivos aquí o',
  selectText: 'explorar',
  maxSizePrefix: 'Máx.',
  remove: 'Eliminar',

  // Pickers
  selectDate: 'Seleccionar fecha',
  selectTime: 'Seleccionar hora',
  timeHourSelection: 'Seleccionar hora',
  timeMinuteSelection: 'Seleccionar minutos',
  timePeriodToggle: 'Seleccionar a. m. o p. m.',
  timeToggleKeyboard: 'Cambiar a entrada de texto',
  timeToggleDial: 'Cambiar a modo reloj',
  timeToggleScroll: 'Cambiar a modo desplazamiento',
  sheetExpand: 'Expandir hoja inferior',
  sheetCollapse: 'Contraer hoja inferior',
  sheetDismiss: 'Cerrar hoja inferior',
  selectRange: 'Seleccionar rango',
  pickStart: 'Seleccionar inicio',
  pickEnd: 'Seleccionar fin',
  previousMonth: 'Mes anterior',
  nextMonth: 'Mes siguiente',
  selectColor: 'Seleccionar color',
  colorHue: 'Tono',
  colorSaturation: 'Saturación',
  colorBrightness: 'Brillo',
  colorAlpha: 'Opacidad',
  colorEyedropper: 'Tomar un color de la pantalla',
  colorOriginal: 'Color original',
  colorFormat: 'Formato de color',
  colorRecent: 'Recientes',
  colorPresets: 'Predefinidos',

  // Scheduler
  dayView: 'Día',
  weekView: 'Semana',
  allDay: 'Todo el día',
  emojiSearch: 'Buscar emoji',
  emojiNoResults: 'No se encontraron emojis',
  emojiRecent: 'Usados recientemente',
  emojiSkinTone: 'Tono de piel',
  emojiSkinTones: 'Sin tono|Claro|Medio claro|Medio|Medio oscuro|Oscuro',
  emojiCategorySmileys: 'Caras',
  emojiCategoryGestures: 'Gestos',
  emojiCategoryPeople: 'Personas',
  emojiCategoryAnimals: 'Animales',
  emojiCategoryNature: 'Naturaleza',
  emojiCategoryFood: 'Comida y bebida',
  emojiCategoryActivities: 'Actividades',
  emojiCategoryTravel: 'Viajes y lugares',
  emojiCategoryObjects: 'Objetos',
  emojiCategorySymbols: 'Símbolos',
  emojiCategoryFlags: 'Banderas',

  // Transfer list
  available: 'Disponibles',
  selected: 'Seleccionados',
  noItems: 'Sin elementos',
  moveAllRight: 'Mover todos a la derecha',
  moveRight: 'Mover seleccionados a la derecha',
  moveLeft: 'Mover seleccionados a la izquierda',
  moveAllLeft: 'Mover todos a la izquierda',

  // Command palette / Spotlight
  searchCommand: 'Buscar comando...',
  navigateHint: 'navegar',
  selectHint: 'seleccionar',
  openHint: 'abrir',
  closeHint: 'cerrar',

  // Infinite scroll
  loadingMore: 'Cargando...',
  noMoreItems: 'No hay más elementos',

  // Rich text editor
  bold: 'Negrita',
  italic: 'Cursiva',
  underline: 'Subrayado',
  strikethrough: 'Tachado',
  highlight: 'Resaltar',
  bulletList: 'Lista con viñetas',
  orderedList: 'Lista ordenada',
  blockquote: 'Cita',
  code: 'Código',
  alignLeft: 'Alinear a la izquierda',
  alignCenter: 'Centrar',
  alignRight: 'Alinear a la derecha',
  undo: 'Deshacer',
  redo: 'Rehacer',
  link: 'Enlace',
  image: 'Imagen',
  paragraph: 'Párrafo',
  heading1: 'Encabezado 1',
  heading2: 'Encabezado 2',
  heading3: 'Encabezado 3',
  insertLink: 'Insertar enlace',
  insertImage: 'Insertar imagen',
  imageUrlLabel: 'URL de la imagen',
  insert: 'Insertar',

  // JSON editor
  jsonValid: 'Válido',
  jsonInvalid: 'Inválido',
  jsonFormat: 'Formatear',
  jsonMinify: 'Minificar',

  // JSON viewer
  jsonElements: 'elementos',
  jsonFields: 'campos',

  // Result
  resultSuccessTitle: 'Operación exitosa',
  resultSuccessDesc: 'La acción se completó correctamente.',
  resultErrorTitle: 'Algo salió mal',
  resultErrorDesc: 'Ocurrió un error inesperado. Inténtalo de nuevo.',
  resultWarningTitle: 'Atención',
  resultWarningDesc: 'Hay algo que requiere tu atención.',
  resultInfoTitle: 'Información',
  resultInfoDesc: 'Hay algo que deberías saber.',
  result404Title: 'Página no encontrada',
  result404Desc: 'La página que buscas no existe o fue movida.',
  result403Title: 'Acceso denegado',
  result403Desc: 'No tienes permisos para ver este recurso.',
  result500Title: 'Error del servidor',
  result500Desc: 'El servidor no pudo procesar la solicitud.',

  // Chat bubble
  chatTyping: 'Escribiendo…',
  chatRecordingAudio: 'Grabando audio…',

  // Drag & drop list ({pos}/{total} are replaced at runtime)
  reorderHandle: 'Reordenar',
  reorderGrabbed: 'Elemento tomado, posición {pos} de {total}. Usa las flechas para moverlo, Espacio para soltarlo y Escape para cancelar.',
  reorderMoved: 'Movido a la posición {pos} de {total}.',
  reorderDropped: 'Elemento soltado en la posición {pos} de {total}.',
  reorderCancelled: 'Reordenamiento cancelado.',

  // Transfer list (panes)
  selectAll: 'Seleccionar todo',
  clearSearch: 'Borrar búsqueda',

  // Kanban ({column}/{pos}/{total} are replaced at runtime)
  kanbanMoved: 'Movido a {column}, posición {pos} de {total}.',
  windowMinimize: 'Minimizar',
  windowMaximize: 'Maximizar',
  windowRestore: 'Restaurar',
  // MPagination ({from}/{to}/{total} and {page}/{pages} are replaced at runtime)
  paginationRange: '{from}–{to} de {total}',
  paginationPage: 'Página {page} de {pages}',
  previousPage: 'Página anterior',
  nextPage: 'Página siguiente',
  carousel: 'Carrusel',
  carouselItem: '{index} de {count}',
}
