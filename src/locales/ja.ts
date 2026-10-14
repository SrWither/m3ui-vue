import type { M3Locale } from '../composables/useLocale'

export const jaLocale: M3Locale = {
  lang: 'ja',

  // Common
  search: '検索...',
  noResults: '結果なし',
  close: '閉じる',
  menu: 'メニュー',
  cancel: 'キャンセル',
  confirm: '確認',
  loading: '読み込み中',

  // Navigation
  previous: '前へ',
  next: '次へ',
  today: '今日',
  more: '件',

  // Tables
  selectedCount: '件選択中',
  recordCount: '件',
  expand: '展開',
  columns: '列',
  exportCsv: 'CSV エクスポート',
  noGroup: 'グループなし',

  // Tour
  finish: '完了',

  // File upload
  dropText: 'ここにファイルをドロップ、または',
  selectText: '参照',
  maxSizePrefix: '最大',
  remove: '削除',

  // Pickers
  selectDate: '日付を選択',
  selectTime: '時刻を選択',
  selectRange: '範囲を選択',
  pickStart: '開始を選択',
  pickEnd: '終了を選択',
  previousMonth: '前月',
  nextMonth: '翌月',

  // Scheduler
  dayView: '日',
  weekView: '週',

  // Transfer list
  available: '利用可能',
  selected: '選択済み',
  noItems: '項目なし',
  moveAllRight: 'すべて右へ移動',
  moveRight: '選択項目を右へ移動',
  moveLeft: '選択項目を左へ移動',
  moveAllLeft: 'すべて左へ移動',

  // Command palette / Spotlight
  searchCommand: 'コマンドを検索...',
  navigateHint: '移動',
  selectHint: '選択',
  openHint: '開く',
  closeHint: '閉じる',

  // Infinite scroll
  loadingMore: '読み込み中...',
  noMoreItems: 'これ以上の項目はありません',

  // Rich text editor
  bold: '太字',
  italic: '斜体',
  underline: '下線',
  strikethrough: '取り消し線',
  highlight: 'ハイライト',
  bulletList: '箇条書きリスト',
  orderedList: '番号付きリスト',
  blockquote: '引用',
  code: 'コード',
  alignLeft: '左揃え',
  alignCenter: '中央揃え',
  alignRight: '右揃え',
  undo: '元に戻す',
  redo: 'やり直し',
  link: 'リンク',
  image: '画像',
  paragraph: '段落',
  heading1: '見出し 1',
  heading2: '見出し 2',
  heading3: '見出し 3',
  insertLink: 'リンクを挿入',
  insertImage: '画像を挿入',
  imageUrlLabel: '画像 URL',
  insert: '挿入',

  // JSON editor
  jsonValid: '有効',
  jsonInvalid: '無効',
  jsonFormat: '整形',
  jsonMinify: '圧縮',

  // JSON viewer
  jsonElements: '要素',
  jsonFields: 'フィールド',

  // Result
  resultSuccessTitle: '完了しました',
  resultSuccessDesc: '操作は正常に完了しました。',
  resultErrorTitle: '問題が発生しました',
  resultErrorDesc: '予期しないエラーが発生しました。もう一度お試しください。',
  resultWarningTitle: '注意',
  resultWarningDesc: '確認が必要な項目があります。',
  resultInfoTitle: 'お知らせ',
  resultInfoDesc: '知っておくべき情報があります。',
  result404Title: 'ページが見つかりません',
  result404Desc: 'お探しのページは存在しないか、移動されました。',
  result403Title: 'アクセスが拒否されました',
  result403Desc: 'このリソースを表示する権限がありません。',
  result500Title: 'サーバーエラー',
  result500Desc: 'サーバーがリクエストを処理できませんでした。',

  // Chat bubble
  chatTyping: '入力中…',
  chatRecordingAudio: '音声を録音中…',

  // Drag & drop list ({pos}/{total} are replaced at runtime)
  reorderHandle: '並べ替え',
  reorderGrabbed: '項目を選択しました（{total} 件中 {pos} 番目）。矢印キーで移動、スペースで確定、Escape でキャンセルします。',
  reorderMoved: '{total} 件中 {pos} 番目に移動しました。',
  reorderDropped: '{total} 件中 {pos} 番目に配置しました。',
  reorderCancelled: '並べ替えをキャンセルしました。',

  // Transfer list (panes)
  selectAll: 'すべて選択',
  clearSearch: '検索をクリア',
}
