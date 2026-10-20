import type { M3Locale } from '../composables/useLocale'

export const zhLocale: M3Locale = {
  lang: 'zh',

  // Common
  search: '搜索...',
  noResults: '无结果',
  close: '关闭',
  menu: '菜单',
  cancel: '取消',
  confirm: '确认',
  loading: '加载中',

  // Navigation
  previous: '上一个',
  next: '下一个',
  today: '今天',
  more: '更多',

  // Tables
  selectedCount: '已选择',
  recordCount: '条记录',
  expand: '展开',
  columns: '列',
  exportCsv: '导出 CSV',
  noGroup: '无分组',

  // Tour
  finish: '完成',

  // File upload
  dropText: '将文件拖放到此处或',
  selectText: '浏览',
  maxSizePrefix: '最大',
  remove: '移除',

  // Pickers
  selectDate: '选择日期',
  selectTime: '选择时间',
  timeHourSelection: '选择小时',
  timeMinuteSelection: '选择分钟',
  timePeriodToggle: '选择上午或下午',
  timeToggleKeyboard: '切换到文本输入模式',
  timeToggleDial: '切换到时钟模式',
  timeToggleScroll: '切换到滚动模式',
  sheetExpand: '展开底部动作条',
  sheetCollapse: '收起底部动作条',
  sheetDismiss: '关闭底部动作条',
  selectRange: '选择范围',
  pickStart: '选择开始',
  pickEnd: '选择结束',
  previousMonth: '上个月',
  nextMonth: '下个月',
  selectColor: '选择颜色',
  colorHue: '色相',
  colorSaturation: '饱和度',
  colorBrightness: '亮度',
  colorAlpha: '不透明度',
  colorEyedropper: '从屏幕取色',
  colorOriginal: '原始颜色',
  colorFormat: '颜色格式',
  colorRecent: '最近使用',
  colorPresets: '预设',

  // Scheduler
  dayView: '日',
  weekView: '周',
  allDay: '全天',
  emojiSearch: '搜索表情',
  emojiNoResults: '未找到表情',
  emojiRecent: '最近使用',
  emojiSkinTone: '肤色',
  emojiSkinTones: '默认|浅|中浅|中等|中深|深',
  emojiCategorySmileys: '笑脸',
  emojiCategoryGestures: '手势',
  emojiCategoryPeople: '人物',
  emojiCategoryAnimals: '动物',
  emojiCategoryNature: '自然',
  emojiCategoryFood: '食物和饮料',
  emojiCategoryActivities: '活动',
  emojiCategoryTravel: '旅行和地点',
  emojiCategoryObjects: '物品',
  emojiCategorySymbols: '符号',
  emojiCategoryFlags: '旗帜',

  // Transfer list
  available: '可用',
  selected: '已选',
  noItems: '无项目',
  moveAllRight: '全部移至右侧',
  moveRight: '将选中项移至右侧',
  moveLeft: '将选中项移至左侧',
  moveAllLeft: '全部移至左侧',

  // Command palette / Spotlight
  searchCommand: '搜索命令...',
  navigateHint: '导航',
  selectHint: '选择',
  openHint: '打开',
  closeHint: '关闭',

  // Infinite scroll
  loadingMore: '加载中...',
  noMoreItems: '没有更多项目',

  // Rich text editor
  bold: '粗体',
  italic: '斜体',
  underline: '下划线',
  strikethrough: '删除线',
  highlight: '高亮',
  bulletList: '无序列表',
  orderedList: '有序列表',
  blockquote: '引用',
  code: '代码',
  alignLeft: '左对齐',
  alignCenter: '居中对齐',
  alignRight: '右对齐',
  undo: '撤销',
  redo: '重做',
  link: '链接',
  image: '图片',
  paragraph: '段落',
  heading1: '标题 1',
  heading2: '标题 2',
  heading3: '标题 3',
  insertLink: '插入链接',
  insertImage: '插入图片',
  imageUrlLabel: '图片 URL',
  insert: '插入',

  // JSON editor
  jsonValid: '有效',
  jsonInvalid: '无效',
  jsonFormat: '格式化',
  jsonMinify: '压缩',

  // JSON viewer
  jsonElements: '个元素',
  jsonFields: '个字段',

  // Result
  resultSuccessTitle: '操作成功',
  resultSuccessDesc: '操作已成功完成。',
  resultErrorTitle: '出错了',
  resultErrorDesc: '发生意外错误，请重试。',
  resultWarningTitle: '注意',
  resultWarningDesc: '有需要您注意的事项。',
  resultInfoTitle: '信息',
  resultInfoDesc: '这里有一些您需要了解的信息。',
  result404Title: '页面未找到',
  result404Desc: '您要查找的页面不存在或已被移动。',
  result403Title: '访问被拒绝',
  result403Desc: '您没有权限查看此资源。',
  result500Title: '服务器错误',
  result500Desc: '服务器无法处理该请求。',

  // Chat bubble
  chatTyping: '正在输入…',
  chatRecordingAudio: '正在录音…',

  // Drag & drop list ({pos}/{total} are replaced at runtime)
  reorderHandle: '重新排序',
  reorderGrabbed: '已选中项目，位置 {pos}/{total}。使用方向键移动，按空格键放下，按 Esc 取消。',
  reorderMoved: '已移至位置 {pos}/{total}。',
  reorderDropped: '项目已放在位置 {pos}/{total}。',
  reorderCancelled: '已取消重新排序。',

  // Transfer list (panes)
  selectAll: '全选',
  clearSearch: '清除搜索',

  // Kanban ({column}/{pos}/{total} are replaced at runtime)
  kanbanMoved: '已移至 {column}，位置 {pos}/{total}。',
  windowMinimize: '最小化',
  windowMaximize: '最大化',
  windowRestore: '还原',
  // MPagination ({from}/{to}/{total} and {page}/{pages} are replaced at runtime)
  paginationRange: '第 {from}–{to} 项，共 {total} 项',
  paginationPage: '第 {page} 页，共 {pages} 页',
  previousPage: '上一页',
  nextPage: '下一页',
  carousel: '轮播',
  carouselItem: '第 {index} 项，共 {count} 项',  // MMap (maplibre controls)
  mapTitle: '地图',
  mapMarker: '地图标记',
  mapZoomIn: '放大',
  mapZoomOut: '缩小',
  mapResetBearing: '重置为正北方向',
  mapFindMyLocation: '查找我的位置',
  mapLocationNotAvailable: '位置不可用',
  mapEnterFullscreen: '进入全屏',
  mapExitFullscreen: '退出全屏',
  mapToggleAttribution: '切换署名信息',
  mapFeedback: '地图反馈',
  mapCtrlScroll: '按住 Ctrl 并滚动以缩放地图',
  mapCmdScroll: '按住 ⌘ 并滚动以缩放地图',
  mapTwoFingers: '使用两根手指移动地图',
  mapLayers: '图层',
  mapSearchLayers: '搜索图层',
  mapNoLayers: '没有图层',
  mapShowLayer: '显示图层',
  mapHideLayer: '隐藏图层',
  mapOpacity: '不透明度',
  mapDownload: '下载',
  mapNoBaseLayer: '无底图',
  mapHoverInfo: '悬停显示信息',
  mapNoValue: '不可用',
}
