import { inject, reactive, watchEffect, toValue, type InjectionKey, type MaybeRef } from 'vue'

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
  selectTime: string
  selectRange: string
  pickStart: string
  pickEnd: string
  previousMonth: string
  nextMonth: string

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
  columns: 'Columns',
  exportCsv: 'Export CSV',
  noGroup: 'No group',

  finish: 'Finish',

  dropText: 'Drop files here or',
  selectText: 'browse',
  maxSizePrefix: 'Max.',
  remove: 'Remove',

  selectDate: 'Select date',
  selectTime: 'Select time',
  selectRange: 'Select range',
  pickStart: 'Select start',
  pickEnd: 'Select end',
  previousMonth: 'Previous month',
  nextMonth: 'Next month',

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
}

export const M3_LOCALE_KEY: InjectionKey<MaybeRef<Partial<M3Locale>>> = Symbol('m3-locale')

export function useLocale(): M3Locale {
  const provided = inject(M3_LOCALE_KEY, {})
  const locale = reactive({ ...defaultLocale }) as M3Locale

  watchEffect(() => {
    Object.assign(locale, defaultLocale, toValue(provided))
  })

  return locale
}
