// Where MFlowControls / MFlowMinimap (or a panel of yours) sit over MFlow's canvas
export type FlowPanelPosition = 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right' | 'center-left' | 'center-right'

export const panelPositionClass: Record<FlowPanelPosition, string> = {
  'top-left': 'top-0 left-0',
  'top-center': 'top-0 left-1/2 -translate-x-1/2',
  'top-right': 'top-0 right-0',
  'bottom-left': 'bottom-0 left-0',
  'bottom-center': 'bottom-0 left-1/2 -translate-x-1/2',
  'bottom-right': 'bottom-0 right-0',
  'center-left': 'top-1/2 left-0 -translate-y-1/2',
  'center-right': 'top-1/2 right-0 -translate-y-1/2',
}
