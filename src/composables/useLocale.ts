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
  /** The date pickers' month/year button: opens the year grid */
  dateSwitchToYear: string
  /** The same button while the year grid is open: back to the days */
  dateSwitchToDay: string
  /** Calendar heatmap legend, low end */
  heatmapLess: string
  /** Calendar heatmap legend, high end */
  heatmapMore: string
  /** Meter group: what's left of max */
  meterRemaining: string
  /** Meter group header; {used} and {max} are replaced */
  meterUsedOf: string
  /** Phone input: the country selector */
  phoneCountry: string
  /** Phone input: the country search field */
  phoneSearchCountry: string
  /** Phone input: the number doesn't fit its country's length */
  phoneInvalid: string
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
  /** MMapCluster's bubble: `{count}` points under it; a click zooms in */
  mapClusterZoom: string
  mapDownload: string
  mapNoBaseLayer: string
  mapHoverInfo: string
  mapNoValue: string
  mapMeasureDistance: string
  mapMeasureArea: string
  mapClearMeasurements: string
  mapDeleteMeasurement: string
  mapDrawPoint: string
  mapDrawLine: string
  mapDrawPolygon: string
  mapDeleteFeature: string
  mapTotal: string
  mapSearchPlaces: string
  mapAddress: string
  mapPressEnterToSearch: string
  mapSearching: string
  mapNoPlaces: string
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
  pdfInkWidth: string
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
  flowDelete: string
  ganttChart: string
  ganttTask: string
  ganttStart: string
  ganttEnd: string
  ganttDuration: string
  ganttProgress: string
  ganttDays: string
  ganttHours: string
  ganttMilestone: string
  ganttQuarter: string
  ganttToday: string
  ganttZoomIn: string
  ganttZoomOut: string
  ganttExpandAll: string
  ganttCollapseAll: string
  ganttExpand: string
  ganttCollapse: string
  ganttUndo: string
  ganttRedo: string
  ganttScaleHour: string
  ganttScaleDay: string
  ganttScaleWeek: string
  ganttScaleMonth: string
  ganttScaleQuarter: string
  ganttScaleYear: string
  ganttMoved: string
  ganttProgressSet: string
  ganttLinked: string
  ganttUnlink: string
  ganttDeleted: string
  ganttDelete: string
  ganttReordered: string
  ganttSlack: string
  ganttCritical: string
  ganttBaseline: string
  ganttEmpty: string
  ganttResize: string
  ganttFit: string
  ganttShowList: string
  ganttHideList: string
  timelineResource: string
  timelineConflict: string
  timelineMoved: string
  timelineEmpty: string
  cropArea: string
  cropRotateLeft: string
  cropRotateRight: string
  cropFlip: string
  cropReset: string
  cropFree: string
  drawCanvas: string
  drawTools: string
  drawMore: string
  drawSelect: string
  drawPan: string
  drawPen: string
  drawBrush: string
  drawMarker: string
  drawHighlighter: string
  drawEraser: string
  drawStrokeEraser: string
  drawLine: string
  drawArrow: string
  drawRect: string
  drawEllipse: string
  drawText: string
  drawFill: string
  drawColor: string
  floorPlan: string
  floorSeats: string
  floorRotate: string
  floorTools: string
  floorMove: string
  floorDrawWall: string
  floorDrawZone: string
  floorAddTable: string
  floorAddDecor: string
  floorDuplicate: string
  floorDelete: string
  floorUndo: string
  floorRedo: string
  floorLabel: string
  floorSeatsField: string
  floorShape: string
  floorRound: string
  floorSquare: string
  floorLong: string
  floorAngle: string
  /** A door's button: hinge it on the other side */
  floorFlip: string
  floorZoomIn: string
  floorZoomOut: string
  floorZoomFit: string
  floorOverlaps: string
  floorSeatN: string
  floorDrawShape: string
  floorShapeHint: string
  floorColor: string
  floorThickness: string
  floorWidth: string
  floorHeight: string
  floorMerge: string
  floorSplit: string
  floorNothingPicked: string
  floorTablesPicked: string
  floorTableN: string
  floorZone: string
  floorWall: string
  floorDeleteCorner: string
  floorFinishWall: string
  floorCancel: string
  floorDecorDoor: string
  floorDecorWindow: string
  floorDecorPlant: string
  floorDecorColumn: string
  floorDecorRestroom: string
  floorDecorKitchen: string
  floorDecorRegister: string
  floorDecorStairs: string
  floorDecorLabel: string
  drawCustomColor: string
  drawSize: string
  drawUndo: string
  drawRedo: string
  drawDelete: string
  drawLayers: string
  drawLayer: string
  drawLayerName: string
  drawAddLayer: string
  drawDeleteLayer: string
  drawShowLayer: string
  drawHideLayer: string
  drawLockLayer: string
  drawUnlockLayer: string
  drawLayerUp: string
  drawLayerDown: string
  // MBeforeAfter
  compareBefore: string
  compareAfter: string
  compareSlider: string
  // MCreditCardInput
  cardNumber: string
  cardExpiry: string
  cardCvc: string
  cardName: string
  cardInvalidNumber: string
  cardInvalidExpiry: string
  cardInvalidCvc: string
  // MPosKeypad
  keypadDelete: string
  keypadClear: string
  keypadChange: string
  keypadRemaining: string
  // MSeatMap ({seat} is replaced at runtime)
  seatStage: string
  seatAvailable: string
  seatSelected: string
  seatOccupied: string
  seatLabel: string
  // MReceipt
  receiptSubtotal: string
  receiptTotal: string
  receiptPaid: string
  receiptChange: string
  // MProductConfigurator ({n} is replaced at runtime)
  configRequired: string
  configOptional: string
  configChooseUpTo: string
  configChooseAtLeast: string
  configChooseExactly: string
  configUnavailable: string
  configQuantity: string
  configIncrease: string
  configDecrease: string
  // MAvailabilityCalendar ({n} is replaced at runtime)
  availNight: string
  availNights: string
  availMinNights: string
  availCheckIn: string
  availCheckOut: string
  availSelectCheckIn: string
  availSelectCheckOut: string
  availUnavailable: string
  // MCandlestickChart
  chartOpen: string
  chartHigh: string
  chartLow: string
  chartClose: string
  chartVolume: string
  // MOrderBook
  bookPrice: string
  bookSize: string
  bookTotal: string
  bookSpread: string
  // MMortgageCalculator ({n} is replaced at runtime)
  mortgagePrice: string
  mortgageDown: string
  mortgageRate: string
  mortgageTerm: string
  mortgageYears: string
  mortgageLoan: string
  mortgageMonthly: string
  mortgageFirstPayment: string
  mortgageLastPayment: string
  mortgagePrincipal: string
  mortgageInterest: string
  mortgageTotal: string
  mortgageSchedule: string
  mortgageYear: string
  mortgageBalance: string
  // MBodyMap ({part} is replaced at runtime)
  bodyFront: string
  bodyBack: string
  bodyRight: string
  bodyLeft: string
  bodyRear: string
  bodyHead: string
  bodyNeck: string
  bodyChest: string
  bodyAbdomen: string
  bodyPelvis: string
  bodyShoulder: string
  bodyUpperArm: string
  bodyForearm: string
  bodyHand: string
  bodyThigh: string
  bodyKnee: string
  bodyLeg: string
  bodyFoot: string
  bodyUpperBack: string
  bodyLowerBack: string
  bodyGlute: string
  bodyCalf: string
  // MOdontogram ({n} is replaced at runtime)
  odontoTooth: string
  odontoUpper: string
  odontoLower: string
  odontoMesial: string
  odontoDistal: string
  odontoBuccal: string
  odontoLingual: string
  odontoOcclusal: string
  odontoCaries: string
  odontoFilling: string
  odontoSealant: string
  odontoCrown: string
  odontoRootCanal: string
  odontoImplant: string
  odontoMissing: string
  odontoExtraction: string
  odontoEraser: string
  // MVitalsChart
  vitalsNormal: string
  vitalsHigh: string
  vitalsLow: string
  vitalsNoData: string
  // MQuiz ({n}, {total}, {score}, {answer} are replaced at runtime)
  quizCheck: string
  quizNext: string
  quizFinish: string
  quizCorrect: string
  quizIncorrect: string
  quizCorrectAnswer: string
  quizQuestionOf: string
  quizScore: string
  quizPassed: string
  quizFailed: string
  quizRetry: string
  quizTrue: string
  quizFalse: string
  quizSelectAll: string
  quizOrderHint: string
  quizMoveUp: string
  quizMoveDown: string
  quizTypeAnswer: string
  quizTimeLeft: string
  quizReview: string
  // MCertificate
  certTitle: string
  certPresentedTo: string
  certDate: string
  certId: string
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
  dateSwitchToYear: 'Switch to selecting a year',
  dateSwitchToDay: 'Switch to selecting a day',
  heatmapLess: 'Less',
  heatmapMore: 'More',
  meterRemaining: 'Remaining',
  meterUsedOf: '{used} of {max}',
  phoneCountry: 'Country',
  phoneSearchCountry: 'Search country',
  phoneInvalid: 'Incomplete phone number',
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
  mapClusterZoom: '{count} places, zoom in',
  mapDownload: 'Download',
  mapNoBaseLayer: 'No base layer',
  mapHoverInfo: 'Info on hover',
  mapNoValue: 'Not available',
  mapMeasureDistance: 'Measure distance',
  mapMeasureArea: 'Measure area',
  mapClearMeasurements: 'Clear measurements',
  mapDeleteMeasurement: 'Delete measurement',
  mapDrawPoint: 'Draw a point',
  mapDrawLine: 'Draw a line',
  mapDrawPolygon: 'Draw a polygon',
  mapDeleteFeature: 'Delete the selected shape',
  mapTotal: 'Total',
  mapSearchPlaces: 'Search places',
  mapAddress: 'Address',
  mapPressEnterToSearch: 'Press Enter to search',
  mapSearching: 'Searching…',
  mapNoPlaces: 'No places found',
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
  pdfInkWidth: 'Line width {n} pt',
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
  flowDelete: 'Delete',
  ganttChart: 'Gantt chart',
  ganttTask: 'Task',
  ganttStart: 'Start',
  ganttEnd: 'End',
  ganttDuration: 'Duration',
  ganttProgress: 'Progress',
  ganttDays: '{n} d',
  ganttHours: '{n} h',
  ganttMilestone: 'Milestone',
  ganttQuarter: 'Q{n}',
  ganttToday: 'Today',
  ganttZoomIn: 'Zoom in',
  ganttZoomOut: 'Zoom out',
  ganttExpandAll: 'Expand all',
  ganttCollapseAll: 'Collapse all',
  ganttExpand: 'Expand',
  ganttCollapse: 'Collapse',
  ganttUndo: 'Undo',
  ganttRedo: 'Redo',
  ganttScaleHour: 'Hours',
  ganttScaleDay: 'Days',
  ganttScaleWeek: 'Weeks',
  ganttScaleMonth: 'Months',
  ganttScaleQuarter: 'Quarters',
  ganttScaleYear: 'Years',
  ganttMoved: '{name}: {start} to {end}',
  ganttProgressSet: '{name}: {progress}% done',
  ganttLinked: '{from} linked to {to}',
  ganttUnlink: 'Remove dependency',
  ganttDeleted: '{count} deleted',
  ganttDelete: 'Delete',
  ganttReordered: '{name} moved to row {pos}',
  ganttSlack: 'Slack: {n} d',
  ganttCritical: 'Critical',
  ganttBaseline: 'Baseline',
  ganttEmpty: 'No tasks yet',
  ganttResize: 'Resize the task list',
  ganttFit: 'Fit everything',
  ganttShowList: 'Show task list',
  ganttHideList: 'Hide task list',
  timelineResource: 'Resource',
  timelineConflict: 'Overlaps another booking',
  timelineMoved: '{title}: {resource}, {start} to {end}',
  timelineEmpty: 'No resources',
  cropArea: 'Crop area',
  cropRotateLeft: 'Rotate left',
  cropRotateRight: 'Rotate right',
  cropFlip: 'Flip horizontally',
  cropReset: 'Reset',
  cropFree: 'Free',
  drawCanvas: 'Drawing canvas',
  drawTools: 'Drawing tools',
  drawMore: 'More tools',
  drawSelect: 'Select',
  drawPan: 'Pan',
  drawPen: 'Pen',
  drawBrush: 'Brush',
  drawMarker: 'Marker',
  drawHighlighter: 'Highlighter',
  drawEraser: 'Eraser',
  drawStrokeEraser: 'Stroke eraser',
  drawLine: 'Line',
  drawArrow: 'Arrow',
  drawRect: 'Rectangle',
  drawEllipse: 'Ellipse',
  drawText: 'Text',
  drawFill: 'Fill',
  drawColor: 'Color',
  floorPlan: 'Floor plan',
  floorSeats: '{n} seats',
  floorRotate: 'Rotate',
  floorTools: 'Floor plan tools',
  floorMove: 'Move',
  floorDrawWall: 'Wall',
  floorDrawZone: 'Zone',
  floorAddTable: 'Add a table',
  floorAddDecor: 'Add decor',
  floorDuplicate: 'Duplicate',
  floorDelete: 'Delete',
  floorUndo: 'Undo',
  floorRedo: 'Redo',
  floorLabel: 'Label',
  floorSeatsField: 'Seats',
  floorShape: 'Shape',
  floorRound: 'Round',
  floorSquare: 'Square',
  floorLong: 'Long',
  floorAngle: 'Angle',
  floorFlip: 'Flip',
  floorZoomIn: 'Zoom in',
  floorZoomOut: 'Zoom out',
  floorZoomFit: 'Whole plan',
  floorOverlaps: 'Overlaps another table',
  floorSeatN: 'Seat {n}',
  floorDrawShape: 'Zone of any shape',
  floorShapeHint: 'Drag its corners; double-click an edge for a new corner, Delete removes the picked one',
  floorColor: 'Color',
  floorThickness: 'Thickness',
  floorWidth: 'Width',
  floorHeight: 'Height',
  floorMerge: 'Merge tables',
  floorSplit: 'Split',
  floorNothingPicked: 'Pick a table, a zone, a wall or decor to change it',
  floorTablesPicked: '{n} tables picked',
  floorTableN: 'Table {label}',
  floorZone: 'Zone',
  floorWall: 'Wall',
  floorDeleteCorner: 'Delete the corner',
  floorFinishWall: 'Finish the wall',
  floorCancel: 'Cancel',
  floorDecorDoor: 'Door',
  floorDecorWindow: 'Window',
  floorDecorPlant: 'Plant',
  floorDecorColumn: 'Column',
  floorDecorRestroom: 'Restroom',
  floorDecorKitchen: 'Kitchen',
  floorDecorRegister: 'Register',
  floorDecorStairs: 'Stairs',
  floorDecorLabel: 'Text',
  drawCustomColor: 'Custom color',
  drawSize: 'Size',
  drawUndo: 'Undo',
  drawRedo: 'Redo',
  drawDelete: 'Delete selection',
  drawLayers: 'Layers',
  drawLayer: 'Layer {n}',
  drawLayerName: 'Layer name',
  drawAddLayer: 'Add layer',
  drawDeleteLayer: 'Delete layer',
  drawShowLayer: 'Show layer',
  drawHideLayer: 'Hide layer',
  drawLockLayer: 'Lock layer',
  drawUnlockLayer: 'Unlock layer',
  drawLayerUp: 'Move layer up',
  drawLayerDown: 'Move layer down',
  compareBefore: 'Before',
  compareAfter: 'After',
  compareSlider: 'Comparison position',
  cardNumber: 'Card number',
  cardExpiry: 'Expiry (MM/YY)',
  cardCvc: 'CVC',
  cardName: 'Name on card',
  cardInvalidNumber: 'Invalid card number',
  cardInvalidExpiry: 'Invalid or expired date',
  cardInvalidCvc: 'Invalid security code',
  keypadDelete: 'Delete',
  keypadClear: 'Clear',
  keypadChange: 'Change',
  keypadRemaining: 'Remaining',
  seatStage: 'Screen',
  seatAvailable: 'Available',
  seatSelected: 'Selected',
  seatOccupied: 'Occupied',
  seatLabel: 'Seat {seat}',
  receiptSubtotal: 'Subtotal',
  receiptTotal: 'Total',
  receiptPaid: 'Paid',
  receiptChange: 'Change',
  configRequired: 'Required',
  configOptional: 'Optional',
  configChooseUpTo: 'Choose up to {n}',
  configChooseAtLeast: 'Choose at least {n}',
  configChooseExactly: 'Choose {n}',
  configUnavailable: 'Unavailable',
  configQuantity: 'Quantity',
  configIncrease: 'Add one',
  configDecrease: 'Remove one',
  availNight: '1 night',
  availNights: '{n} nights',
  availMinNights: 'Minimum stay: {n} nights',
  availCheckIn: 'Check-in',
  availCheckOut: 'Check-out',
  availSelectCheckIn: 'Select the check-in date',
  availSelectCheckOut: 'Select the check-out date',
  availUnavailable: 'Unavailable',
  chartOpen: 'Open',
  chartHigh: 'High',
  chartLow: 'Low',
  chartClose: 'Close',
  chartVolume: 'Volume',
  bookPrice: 'Price',
  bookSize: 'Size',
  bookTotal: 'Total',
  bookSpread: 'Spread',
  mortgagePrice: 'Property price',
  mortgageDown: 'Down payment',
  mortgageRate: 'Interest rate (yearly %)',
  mortgageTerm: 'Term',
  mortgageYears: '{n} years',
  mortgageLoan: 'Loan amount',
  mortgageMonthly: 'Monthly payment',
  mortgageFirstPayment: 'First payment',
  mortgageLastPayment: 'Last payment',
  mortgagePrincipal: 'Principal',
  mortgageInterest: 'Interest',
  mortgageTotal: 'Total paid',
  mortgageSchedule: 'Amortization schedule',
  mortgageYear: 'Year',
  mortgageBalance: 'Balance',
  bodyFront: 'Front',
  bodyBack: 'Back',
  bodyRight: '{part}, right',
  bodyLeft: '{part}, left',
  bodyRear: '{part} (back)',
  bodyHead: 'Head',
  bodyNeck: 'Neck',
  bodyChest: 'Chest',
  bodyAbdomen: 'Abdomen',
  bodyPelvis: 'Pelvis',
  bodyShoulder: 'Shoulder',
  bodyUpperArm: 'Upper arm',
  bodyForearm: 'Forearm',
  bodyHand: 'Hand',
  bodyThigh: 'Thigh',
  bodyKnee: 'Knee',
  bodyLeg: 'Lower leg',
  bodyFoot: 'Foot',
  bodyUpperBack: 'Upper back',
  bodyLowerBack: 'Lower back',
  bodyGlute: 'Buttock',
  bodyCalf: 'Calf',
  odontoTooth: 'Tooth {n}',
  odontoUpper: 'Upper',
  odontoLower: 'Lower',
  odontoMesial: 'Mesial',
  odontoDistal: 'Distal',
  odontoBuccal: 'Buccal',
  odontoLingual: 'Lingual',
  odontoOcclusal: 'Occlusal',
  odontoCaries: 'Caries',
  odontoFilling: 'Filling',
  odontoSealant: 'Sealant',
  odontoCrown: 'Crown',
  odontoRootCanal: 'Root canal',
  odontoImplant: 'Implant',
  odontoMissing: 'Missing',
  odontoExtraction: 'To extract',
  odontoEraser: 'Eraser',
  vitalsNormal: 'Normal range',
  vitalsHigh: 'High',
  vitalsLow: 'Low',
  vitalsNoData: 'No readings',
  quizCheck: 'Check',
  quizNext: 'Next',
  quizFinish: 'Finish',
  quizCorrect: 'Correct!',
  quizIncorrect: 'Not quite',
  quizCorrectAnswer: 'Correct answer: {answer}',
  quizQuestionOf: 'Question {n} of {total}',
  quizScore: '{score} of {total} points',
  quizPassed: 'Passed',
  quizFailed: 'Not passed',
  quizRetry: 'Try again',
  quizTrue: 'True',
  quizFalse: 'False',
  quizSelectAll: 'Select all that apply',
  quizOrderHint: 'Put these in the right order',
  quizMoveUp: 'Move up',
  quizMoveDown: 'Move down',
  quizTypeAnswer: 'Your answer',
  quizTimeLeft: 'Time left',
  quizReview: 'Review answers',
  certTitle: 'Certificate of completion',
  certPresentedTo: 'This certifies that',
  certDate: 'Date',
  certId: 'Certificate ID',
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
