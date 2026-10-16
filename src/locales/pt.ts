import type { M3Locale } from '../composables/useLocale'

export const ptLocale: M3Locale = {
  lang: 'pt',

  // Common
  search: 'Pesquisar...',
  noResults: 'Sem resultados',
  close: 'Fechar',
  menu: 'Menu',
  cancel: 'Cancelar',
  confirm: 'Confirmar',
  loading: 'Carregando',

  // Navigation
  previous: 'Anterior',
  next: 'Próximo',
  today: 'Hoje',
  more: 'mais',

  // Tables
  selectedCount: 'selecionados',
  recordCount: 'registro',
  expand: 'Expandir',
  columns: 'Colunas',
  exportCsv: 'Exportar CSV',
  noGroup: 'Sem grupo',

  // Tour
  finish: 'Finalizar',

  // File upload
  dropText: 'Arraste arquivos aqui ou',
  selectText: 'procurar',
  maxSizePrefix: 'Máx.',
  remove: 'Remover',

  // Pickers
  selectDate: 'Selecionar data',
  selectTime: 'Selecionar hora',
  selectRange: 'Selecionar intervalo',
  pickStart: 'Selecionar início',
  pickEnd: 'Selecionar fim',
  previousMonth: 'Mês anterior',
  nextMonth: 'Próximo mês',
  selectColor: 'Selecionar cor',
  colorHue: 'Matiz',
  colorSaturation: 'Saturação',
  colorBrightness: 'Brilho',
  colorAlpha: 'Opacidade',
  colorEyedropper: 'Capturar uma cor da tela',
  colorOriginal: 'Cor original',
  colorFormat: 'Formato de cor',
  colorRecent: 'Recentes',
  colorPresets: 'Predefinidas',

  // Scheduler
  dayView: 'Dia',
  weekView: 'Semana',
  allDay: 'Dia inteiro',
  emojiSearch: 'Pesquisar emoji',
  emojiNoResults: 'Nenhum emoji encontrado',
  emojiRecent: 'Usados recentemente',
  emojiSkinTone: 'Tom de pele',
  emojiSkinTones: 'Padrão|Claro|Médio-claro|Médio|Médio-escuro|Escuro',
  emojiCategorySmileys: 'Carinhas',
  emojiCategoryGestures: 'Gestos',
  emojiCategoryPeople: 'Pessoas',
  emojiCategoryAnimals: 'Animais',
  emojiCategoryNature: 'Natureza',
  emojiCategoryFood: 'Comida e bebida',
  emojiCategoryActivities: 'Atividades',
  emojiCategoryTravel: 'Viagens e lugares',
  emojiCategoryObjects: 'Objetos',
  emojiCategorySymbols: 'Símbolos',
  emojiCategoryFlags: 'Bandeiras',

  // Transfer list
  available: 'Disponíveis',
  selected: 'Selecionados',
  noItems: 'Sem itens',
  moveAllRight: 'Mover todos para a direita',
  moveRight: 'Mover selecionados para a direita',
  moveLeft: 'Mover selecionados para a esquerda',
  moveAllLeft: 'Mover todos para a esquerda',

  // Command palette / Spotlight
  searchCommand: 'Pesquisar comando...',
  navigateHint: 'navegar',
  selectHint: 'selecionar',
  openHint: 'abrir',
  closeHint: 'fechar',

  // Infinite scroll
  loadingMore: 'Carregando...',
  noMoreItems: 'Não há mais itens',

  // Rich text editor
  bold: 'Negrito',
  italic: 'Itálico',
  underline: 'Sublinhado',
  strikethrough: 'Tachado',
  highlight: 'Realçar',
  bulletList: 'Lista com marcadores',
  orderedList: 'Lista ordenada',
  blockquote: 'Citação',
  code: 'Código',
  alignLeft: 'Alinhar à esquerda',
  alignCenter: 'Centralizar',
  alignRight: 'Alinhar à direita',
  undo: 'Desfazer',
  redo: 'Refazer',
  link: 'Link',
  image: 'Imagem',
  paragraph: 'Parágrafo',
  heading1: 'Título 1',
  heading2: 'Título 2',
  heading3: 'Título 3',
  insertLink: 'Inserir link',
  insertImage: 'Inserir imagem',
  imageUrlLabel: 'URL da imagem',
  insert: 'Inserir',

  // JSON editor
  jsonValid: 'Válido',
  jsonInvalid: 'Inválido',
  jsonFormat: 'Formatar',
  jsonMinify: 'Minificar',

  // JSON viewer
  jsonElements: 'elementos',
  jsonFields: 'campos',

  // Result
  resultSuccessTitle: 'Operação concluída',
  resultSuccessDesc: 'A ação foi concluída com sucesso.',
  resultErrorTitle: 'Algo deu errado',
  resultErrorDesc: 'Ocorreu um erro inesperado. Tente novamente.',
  resultWarningTitle: 'Atenção',
  resultWarningDesc: 'Há algo que requer sua atenção.',
  resultInfoTitle: 'Informação',
  resultInfoDesc: 'Há algo que você deve saber.',
  result404Title: 'Página não encontrada',
  result404Desc: 'A página que você procura não existe ou foi movida.',
  result403Title: 'Acesso negado',
  result403Desc: 'Você não tem permissão para ver este recurso.',
  result500Title: 'Erro do servidor',
  result500Desc: 'O servidor não conseguiu processar a solicitação.',

  // Chat bubble
  chatTyping: 'Digitando…',
  chatRecordingAudio: 'Gravando áudio…',

  // Drag & drop list ({pos}/{total} are replaced at runtime)
  reorderHandle: 'Reordenar',
  reorderGrabbed: 'Item selecionado, posição {pos} de {total}. Use as setas para movê-lo, Espaço para soltá-lo e Esc para cancelar.',
  reorderMoved: 'Movido para a posição {pos} de {total}.',
  reorderDropped: 'Item solto na posição {pos} de {total}.',
  reorderCancelled: 'Reordenação cancelada.',

  // Transfer list (panes)
  selectAll: 'Selecionar tudo',
  clearSearch: 'Limpar pesquisa',

  // Kanban ({column}/{pos}/{total} are replaced at runtime)
  kanbanMoved: 'Movido para {column}, posição {pos} de {total}.',
  windowMinimize: 'Minimizar',
  windowMaximize: 'Maximizar',
  windowRestore: 'Restaurar',
  // MPagination ({from}/{to}/{total} and {page}/{pages} are replaced at runtime)
  paginationRange: '{from}–{to} de {total}',
  paginationPage: 'Página {page} de {pages}',
  previousPage: 'Página anterior',
  nextPage: 'Próxima página',
  carousel: 'Carrossel',
  carouselItem: '{index} de {count}',
}
