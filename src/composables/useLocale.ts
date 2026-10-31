import { inject, reactive, shallowRef, watchEffect, toValue, type InjectionKey, type MaybeRef } from 'vue'

export interface M3Locale {
  /** BCP-47 language tag (e.g. 'en', 'es', 'pt') — read by locale-aware components (MRelativeTime) that use Intl formatting. */
  lang: string

  // Common
  search: string
  noResults: string
  close: string
  cancel: string
  confirm: string
  loading: string
  menu: string

  // Navigation
  previous: string
  next: string
  today: string
  more: string

  // Tables
  selectedCount: string
  recordCount: string
  expand: string
  /** Collapses an expanded item (the opposite of `expand`) */
  collapse: string
  /** Clears a field's value (the × at its end) */
  clear: string
  columns: string
  exportCsv: string
  noGroup: string

  // Tour
  finish: string

  // File upload
  dropText: string
  selectText: string
  maxSizePrefix: string
  remove: string

  // Pickers
  selectDate: string
  ok: string
  dateToggleInput: string
  dateToggleCalendar: string
  dateInputLabel: string
  selectTime: string
  timeHourSelection: string
  timeMinuteSelection: string
  timePeriodToggle: string
  timeToggleKeyboard: string
  timeToggleDial: string
  timeToggleScroll: string
  sheetExpand: string
  sheetCollapse: string
  sheetDismiss: string
  seekBar: string
  seekBarValue: string
  seekBarShowRemaining: string
  seekBarShowDuration: string
  selectRange: string
  pickStart: string
  pickEnd: string
  previousMonth: string
  nextMonth: string

  // Color picker
  selectColor: string
  colorHue: string
  colorSaturation: string
  colorBrightness: string
  colorAlpha: string
  colorEyedropper: string
  colorOriginal: string
  colorFormat: string
  colorRecent: string
  colorPresets: string

  // Scheduler
  dayView: string
  weekView: string
  allDay: string
  emojiSearch: string
  emojiNoResults: string
  emojiRecent: string
  emojiSkinTone: string
  emojiSkinTones: string
  emojiCategorySmileys: string
  emojiCategoryGestures: string
  emojiCategoryPeople: string
  emojiCategoryAnimals: string
  emojiCategoryNature: string
  emojiCategoryFood: string
  emojiCategoryActivities: string
  emojiCategoryTravel: string
  emojiCategoryObjects: string
  emojiCategorySymbols: string
  emojiCategoryFlags: string

  // Transfer list
  available: string
  selected: string
  noItems: string
  moveAllRight: string
  moveRight: string
  moveLeft: string
  moveAllLeft: string

  // Command palette / Spotlight
  searchCommand: string
  navigateHint: string
  selectHint: string
  openHint: string
  closeHint: string

  // Infinite scroll
  loadingMore: string
  noMoreItems: string

  // Rich text editor
  bold: string
  italic: string
  underline: string
  strikethrough: string
  highlight: string
  bulletList: string
  orderedList: string
  blockquote: string
  code: string
  alignLeft: string
  alignCenter: string
  alignRight: string
  undo: string
  redo: string
  link: string
  image: string
  paragraph: string
  heading1: string
  heading2: string
  heading3: string
  insertLink: string
  insertImage: string
  imageUrlLabel: string
  insert: string

  // JSON editor
  jsonValid: string
  jsonInvalid: string
  jsonFormat: string
  jsonMinify: string

  // JSON viewer
  jsonElements: string
  jsonFields: string

  // Result
  resultSuccessTitle: string
  resultSuccessDesc: string
  resultErrorTitle: string
  resultErrorDesc: string
  resultWarningTitle: string
  resultWarningDesc: string
  resultInfoTitle: string
  resultInfoDesc: string
  result404Title: string
  result404Desc: string
  result403Title: string
  result403Desc: string
  result500Title: string
  result500Desc: string

  // Chat bubble
  chatTyping: string
  chatRecordingAudio: string

  // Drag & drop list ({pos}/{total} are replaced at runtime)
  reorderHandle: string
  reorderGrabbed: string
  reorderMoved: string
  reorderDropped: string
  reorderCancelled: string

  // Transfer list (panes)
  selectAll: string
  clearSearch: string

  // Kanban ({column}/{pos}/{total} are replaced at runtime)
  kanbanMoved: string
  // MWindow title bar buttons
  windowMinimize: string
  windowMaximize: string
  windowRestore: string
  // MPagination ({from}/{to}/{total} and {page}/{pages} are replaced at runtime)
  paginationRange: string
  paginationPage: string
  previousPage: string
  nextPage: string
  carousel: string
  carouselItem: string
  /** MSparkline's summary for screen readers: {first}, {last}, {min}, {max} */
  sparklineSummary: string
  /** MSlider range: its two thumbs */
  sliderRangeStart: string
  sliderRangeEnd: string
  // MMap (maplibre controls)
  mapTitle: string
  mapMarker: string
  mapZoomIn: string
  mapZoomOut: string
  mapResetBearing: string
  mapFindMyLocation: string
  mapLocationNotAvailable: string
  mapEnterFullscreen: string
  mapExitFullscreen: string
  mapToggleAttribution: string
  mapFeedback: string
  mapCtrlScroll: string
  mapCmdScroll: string
  mapTwoFingers: string
  mapLayers: string
  mapSearchLayers: string
  mapNoLayers: string
  mapShowLayer: string
  mapHideLayer: string
  mapOpacity: string
  mapDownload: string
  mapNoBaseLayer: string
  mapHoverInfo: string
  mapNoValue: string
  mapMeasureDistance: string
  mapMeasureArea: string
  mapClearMeasurements: string
  mapDeleteMeasurement: string
  mapTotal: string
  mapSearchPlaces: string
  /** MTimeline's button past `limit`; `{count}` is how many entries are hidden */
  timelineShowMore: string
  timelineShowLess: string
  // Media players (MVideoPlayer, MAudioPlayer); `{seconds}` is the skip length
  mediaPlayer: string
  mediaPlay: string
  mediaPause: string
  mediaReplay: string
  mediaSeekBack: string
  mediaSeekForward: string
  mediaSeconds: string
  mediaMute: string
  mediaUnmute: string
  mediaVolume: string
  mediaFullscreen: string
  mediaExitFullscreen: string
  mediaPictureInPicture: string
  mediaSettings: string
  mediaSpeed: string
  mediaSpeedNormal: string
  mediaSubtitles: string
  mediaSubtitlesOff: string
  mediaQuality: string
  mediaQualityAuto: string
  mediaLive: string
  mediaError: string
  mediaRepeat: string
  mediaRepeatOne: string
  mediaShuffle: string
  // MPdfViewer; `{current}`/`{total}` count search matches
  pdfViewer: string
  pdfThumbnails: string
  pdfOutline: string
  pdfPage: string
  pdfZoom: string
  pdfZoomIn: string
  pdfZoomOut: string
  pdfFitWidth: string
  pdfFitPage: string
  pdfSearch: string
  pdfSearchPrevious: string
  pdfSearchNext: string
  pdfMatchCount: string
  pdfNoMatches: string
  pdfMore: string
  pdfRotate: string
  pdfDownload: string
  pdfPrint: string
  pdfFullscreen: string
  pdfExitFullscreen: string
  pdfPassword: string
  pdfPasswordLabel: string
  pdfWrongPassword: string
  pdfOpen: string
  pdfError: string
  pdfLoading: string
  pdfAnnotate: string
  pdfSelect: string
  pdfHighlight: string
  pdfNote: string
  pdfDraw: string
  pdfEraser: string
  pdfColor: string
  pdfUndo: string
  pdfCopy: string
  pdfDelete: string
  pdfNotePlaceholder: string
  pdfAddComment: string
  flowCanvas: string
  flowNode: string
  flowEdge: string
  flowZoomIn: string
  flowZoomOut: string
  flowFitView: string
  flowLock: string
  flowUnlock: string
  flowUndo: string
  flowRedo: string
  flowMinimap: string
  flowMoved: string
  flowConnected: string
  flowDeleted: string
  flowDeleteEdge: string
}

export const defaultLocale: M3Locale = {
  lang: 'en',

  search: 'Search...',
  noResults: 'No results',
  close: 'Close',
  menu: 'Menu',
  cancel: 'Cancel',
  confirm: 'Confirm',
  loading: 'Loading',

  previous: 'Previous',
  next: 'Next',
  today: 'Today',
  more: 'more',

  selectedCount: 'selected',
  recordCount: 'record',
  expand: 'Expand',
  collapse: 'Collapse',
  clear: 'Clear',
  columns: 'Columns',
  exportCsv: 'Export CSV',
  noGroup: 'No group',

  finish: 'Finish',

  dropText: 'Drop files here or',
  selectText: 'browse',
  maxSizePrefix: 'Max.',
  remove: 'Remove',

  selectDate: 'Select date',
  ok: 'OK',
  dateToggleInput: 'Switch to text input',
  dateToggleCalendar: 'Switch to calendar',
  dateInputLabel: 'Date',
  selectTime: 'Select time',
  timeHourSelection: 'Select hour',
  timeMinuteSelection: 'Select minutes',
  timePeriodToggle: 'Select AM or PM',
  timeToggleKeyboard: 'Switch to text input mode',
  timeToggleDial: 'Switch to clock mode',
  timeToggleScroll: 'Switch to scroll mode',
  sheetExpand: 'Expand bottom sheet',
  sheetCollapse: 'Collapse bottom sheet',
  sheetDismiss: 'Dismiss bottom sheet',
  seekBar: 'Seek',
  seekBarValue: '{position} of {duration}',
  seekBarShowRemaining: 'Show remaining time',
  seekBarShowDuration: 'Show total time',
  selectRange: 'Select range',
  pickStart: 'Select start',
  pickEnd: 'Select end',
  previousMonth: 'Previous month',
  nextMonth: 'Next month',
  selectColor: 'Select color',
  colorHue: 'Hue',
  colorSaturation: 'Saturation',
  colorBrightness: 'Brightness',
  colorAlpha: 'Opacity',
  colorEyedropper: 'Pick a color from the screen',
  colorOriginal: 'Original color',
  colorFormat: 'Color format',
  colorRecent: 'Recent',
  colorPresets: 'Presets',

  dayView: 'Day',
  weekView: 'Week',
  allDay: 'All day',
  emojiSearch: 'Search emoji',
  emojiNoResults: 'No emoji found',
  emojiRecent: 'Recently used',
  emojiSkinTone: 'Skin tone',
  emojiSkinTones: 'No skin tone|Light|Medium-light|Medium|Medium-dark|Dark',
  emojiCategorySmileys: 'Smileys',
  emojiCategoryGestures: 'Gestures',
  emojiCategoryPeople: 'People',
  emojiCategoryAnimals: 'Animals',
  emojiCategoryNature: 'Nature',
  emojiCategoryFood: 'Food & drink',
  emojiCategoryActivities: 'Activities',
  emojiCategoryTravel: 'Travel & places',
  emojiCategoryObjects: 'Objects',
  emojiCategorySymbols: 'Symbols',
  emojiCategoryFlags: 'Flags',

  available: 'Available',
  selected: 'Selected',
  noItems: 'No items',
  moveAllRight: 'Move all right',
  moveRight: 'Move selected right',
  moveLeft: 'Move selected left',
  moveAllLeft: 'Move all left',

  searchCommand: 'Search command...',
  navigateHint: 'navigate',
  selectHint: 'select',
  openHint: 'open',
  closeHint: 'close',

  loadingMore: 'Loading...',
  noMoreItems: 'No more items',

  bold: 'Bold',
  italic: 'Italic',
  underline: 'Underline',
  strikethrough: 'Strikethrough',
  highlight: 'Highlight',
  bulletList: 'Bullet list',
  orderedList: 'Ordered list',
  blockquote: 'Blockquote',
  code: 'Code',
  alignLeft: 'Align left',
  alignCenter: 'Align center',
  alignRight: 'Align right',
  undo: 'Undo',
  redo: 'Redo',
  link: 'Link',
  image: 'Image',
  paragraph: 'Paragraph',
  heading1: 'Heading 1',
  heading2: 'Heading 2',
  heading3: 'Heading 3',
  insertLink: 'Insert link',
  insertImage: 'Insert image',
  imageUrlLabel: 'Image URL',
  insert: 'Insert',

  jsonValid: 'Valid',
  jsonInvalid: 'Invalid',
  jsonFormat: 'Format',
  jsonMinify: 'Minify',

  jsonElements: 'elements',
  jsonFields: 'fields',

  // Result
  resultSuccessTitle: 'Success',
  resultSuccessDesc: 'The action was completed successfully.',
  resultErrorTitle: 'Something went wrong',
  resultErrorDesc: 'An unexpected error occurred. Please try again.',
  resultWarningTitle: 'Warning',
  resultWarningDesc: 'Something needs your attention.',
  resultInfoTitle: 'Information',
  resultInfoDesc: 'Here is something you should know.',
  result404Title: 'Page not found',
  result404Desc: 'The page you are looking for does not exist or has been moved.',
  result403Title: 'Access denied',
  result403Desc: 'You don\'t have permission to view this resource.',
  result500Title: 'Server error',
  result500Desc: 'The server could not process the request.',

  // Chat bubble
  chatTyping: 'Typing…',
  chatRecordingAudio: 'Recording audio…',

  // Drag & drop list ({pos}/{total} are replaced at runtime)
  reorderHandle: 'Reorder',
  reorderGrabbed: 'Item grabbed, position {pos} of {total}. Use the arrow keys to move it, Space to drop it, Escape to cancel.',
  reorderMoved: 'Moved to position {pos} of {total}.',
  reorderDropped: 'Item dropped at position {pos} of {total}.',
  reorderCancelled: 'Reorder cancelled.',

  // Transfer list (panes)
  selectAll: 'Select all',
  clearSearch: 'Clear search',

  // Kanban ({column}/{pos}/{total} are replaced at runtime)
  kanbanMoved: 'Moved to {column}, position {pos} of {total}.',
  windowMinimize: 'Minimize',
  windowMaximize: 'Maximize',
  windowRestore: 'Restore',
  // MPagination ({from}/{to}/{total} and {page}/{pages} are replaced at runtime)
  paginationRange: '{from}–{to} of {total}',
  paginationPage: 'Page {page} of {pages}',
  previousPage: 'Previous page',
  nextPage: 'Next page',
  carousel: 'Carousel',
  carouselItem: '{index} of {count}',
  sparklineSummary: 'From {first} to {last}, low {min}, high {max}',
  sliderRangeStart: 'Range start',
  sliderRangeEnd: 'Range end',
  // MMap (maplibre controls)
  mapTitle: 'Map',
  mapMarker: 'Map marker',
  mapZoomIn: 'Zoom in',
  mapZoomOut: 'Zoom out',
  mapResetBearing: 'Reset bearing to north',
  mapFindMyLocation: 'Find my location',
  mapLocationNotAvailable: 'Location not available',
  mapEnterFullscreen: 'Enter fullscreen',
  mapExitFullscreen: 'Exit fullscreen',
  mapToggleAttribution: 'Toggle attribution',
  mapFeedback: 'Map feedback',
  mapCtrlScroll: 'Use Ctrl + scroll to zoom the map',
  mapCmdScroll: 'Use ⌘ + scroll to zoom the map',
  mapTwoFingers: 'Use two fingers to move the map',
  mapLayers: 'Layers',
  mapSearchLayers: 'Search layers',
  mapNoLayers: 'No layers',
  mapShowLayer: 'Show layer',
  mapHideLayer: 'Hide layer',
  mapOpacity: 'Opacity',
  mapDownload: 'Download',
  mapNoBaseLayer: 'No base layer',
  mapHoverInfo: 'Info on hover',
  mapNoValue: 'Not available',
  mapMeasureDistance: 'Measure distance',
  mapMeasureArea: 'Measure area',
  mapClearMeasurements: 'Clear measurements',
  mapDeleteMeasurement: 'Delete measurement',
  mapTotal: 'Total',
  mapSearchPlaces: 'Search places',
  timelineShowMore: 'Show {count} more',
  timelineShowLess: 'Show less',
  mediaPlayer: 'Media player',
  mediaPlay: 'Play',
  mediaPause: 'Pause',
  mediaReplay: 'Replay',
  mediaSeekBack: 'Back {seconds} seconds',
  mediaSeekForward: 'Forward {seconds} seconds',
  mediaSeconds: '{seconds} seconds',
  mediaMute: 'Mute',
  mediaUnmute: 'Unmute',
  mediaVolume: 'Volume',
  mediaFullscreen: 'Full screen',
  mediaExitFullscreen: 'Exit full screen',
  mediaPictureInPicture: 'Picture-in-picture',
  mediaSettings: 'Settings',
  mediaSpeed: 'Playback speed',
  mediaSpeedNormal: 'Normal',
  mediaSubtitles: 'Subtitles',
  mediaSubtitlesOff: 'Off',
  mediaQuality: 'Quality',
  mediaQualityAuto: 'Auto',
  mediaLive: 'Live',
  mediaError: 'This media can\'t be played',
  mediaRepeat: 'Repeat',
  mediaRepeatOne: 'Repeat one',
  mediaShuffle: 'Shuffle',
  pdfViewer: 'PDF viewer',
  pdfThumbnails: 'Pages',
  pdfOutline: 'Contents',
  pdfPage: 'Page',
  pdfZoom: 'Zoom',
  pdfZoomIn: 'Zoom in',
  pdfZoomOut: 'Zoom out',
  pdfFitWidth: 'Fit to width',
  pdfFitPage: 'Fit page',
  pdfSearch: 'Find in document',
  pdfSearchPrevious: 'Previous match',
  pdfSearchNext: 'Next match',
  pdfMatchCount: '{current} of {total}',
  pdfNoMatches: 'No matches',
  pdfMore: 'More options',
  pdfRotate: 'Rotate',
  pdfDownload: 'Download',
  pdfPrint: 'Print',
  pdfFullscreen: 'Full screen',
  pdfExitFullscreen: 'Exit full screen',
  pdfPassword: 'This document is password protected',
  pdfPasswordLabel: 'Password',
  pdfWrongPassword: 'Wrong password',
  pdfOpen: 'Open',
  pdfError: 'This PDF can\'t be opened',
  pdfLoading: 'Loading document',
  pdfAnnotate: 'Annotate',
  pdfSelect: 'Select',
  pdfHighlight: 'Highlight',
  pdfNote: 'Note',
  pdfDraw: 'Draw',
  pdfEraser: 'Eraser',
  pdfColor: 'Color',
  pdfUndo: 'Undo',
  pdfCopy: 'Copy',
  pdfDelete: 'Delete',
  pdfNotePlaceholder: 'Write a note',
  pdfAddComment: 'Add a comment',
  flowCanvas: 'Diagram',
  flowNode: 'node',
  flowEdge: 'Connection from {source} to {target}',
  flowZoomIn: 'Zoom in',
  flowZoomOut: 'Zoom out',
  flowFitView: 'Fit view',
  flowLock: 'Lock',
  flowUnlock: 'Unlock',
  flowUndo: 'Undo',
  flowRedo: 'Redo',
  flowMinimap: 'Mini map',
  flowMoved: '{label} moved',
  flowConnected: 'Connected {source} to {target}',
  flowDeleted: '{count} deleted',
  flowDeleteEdge: 'Delete connection',
}

export const M3_LOCALE_KEY: InjectionKey<MaybeRef<Partial<M3Locale>>> = Symbol('m3-locale')

/**
 * The locale given to `createM3UI()`, for components rendered outside the app that installed it:
 * `useToast()` and `useNotification()` mount their hosts with an app of their own, where the
 * plugin's `provide` doesn't reach. Inside the user's app the provided locale still wins.
 */
// Wrapped in an object: a shallowRef holding a ref directly gets that ref unwrapped in its type.
const appLocale = shallowRef<{ locale: MaybeRef<Partial<M3Locale>> } | null>(null)

/** @internal Called by `createM3UI()`; not exported from the package. */
export function __setAppLocale(locale: MaybeRef<Partial<M3Locale>> | null) {
  appLocale.value = locale ? { locale } : null
}

export function useLocale(): M3Locale {
  const provided = inject(M3_LOCALE_KEY, null)
  const locale = reactive({ ...defaultLocale }) as M3Locale

  watchEffect(() => {
    Object.assign(locale, defaultLocale, toValue(provided ?? appLocale.value?.locale ?? {}))
  })

  return locale
}
