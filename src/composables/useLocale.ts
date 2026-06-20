import { inject, type InjectionKey } from 'vue'

export interface M3Locale {
  // Common
  search: string
  noResults: string
  close: string
  cancel: string
  confirm: string
  loading: string

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
}

export const defaultLocale: M3Locale = {
  search: 'Search...',
  noResults: 'No results',
  close: 'Close',
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
}

export const M3_LOCALE_KEY: InjectionKey<Partial<M3Locale>> = Symbol('m3-locale')

export function useLocale(): M3Locale {
  const provided = inject(M3_LOCALE_KEY, {})
  return { ...defaultLocale, ...provided }
}
