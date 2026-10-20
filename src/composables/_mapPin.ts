// Internal (not exported): MapLibre's default marker pin. Its SVG is 41px tall with the tip at the center of the
// shadow ellipse below it (y ≈ 34.8), so MapLibre places it by its center, offset [0, -14], and gives a popup it
// opens an offset per side (Marker.setPopup) so the popup meets the pin wherever it opens. Passing the pin an
// anchor of 'bottom' (plus that default offset) put the tip about 20px above its point.
import type * as Maplibre from 'maplibre-gl'

const HEIGHT = 41 - 5.8 / 2
const RADIUS = 13.5
const LINEAR = RADIUS / Math.SQRT2

/** The default pin's offset with its default (center) anchor */
export const PIN_OFFSET: [number, number] = [0, -14]

/** Offsets for a popup at a pin's point, per side, as MapLibre's Marker.setPopup gives them */
export const PIN_POPUP_OFFSET: Record<Maplibre.PositionAnchor, [number, number]> = {
  center: [0, 0],
  top: [0, 0],
  'top-left': [0, 0],
  'top-right': [0, 0],
  bottom: [0, -HEIGHT],
  'bottom-left': [LINEAR, (HEIGHT - RADIUS + LINEAR) * -1],
  'bottom-right': [-LINEAR, (HEIGHT - RADIUS + LINEAR) * -1],
  left: [RADIUS, (HEIGHT - RADIUS) * -1],
  right: [-RADIUS, (HEIGHT - RADIUS) * -1],
}
