/*
 * Portions Copyright The Android Open Source Project, licensed under the Apache License, Version 2.0
 * (dist/THIRD_PARTY_LICENSES.md). Translated from Kotlin to TypeScript and modified for this library.
 *
 * Port of the Compose Material3 carousel engine (androidx compose/material3/carousel:
 * Arrangement.kt, KeylineList.kt, Keylines.kt, Strategy.kt, KeylineSnapPosition.kt), kept close to
 * the original so it can be diffed against upstream. Pure functions, no DOM: MCarousel feeds it the
 * container size and reads back where each item goes and how much of it is visible.
 *
 * Vocabulary (same as upstream): a keyline is a slot along the main axis with a size. Items are
 * all laid out at the same size (the focal size) end to end; each one is masked to the size of the
 * keyline it sits on and translated so masked items touch. Anchors are small keylines just outside
 * the container that items shrink into as they leave.
 */

export interface Keyline {
  size: number
  offset: number
  unadjustedOffset: number
  isFocal: boolean
  isAnchor: boolean
  isPivot: boolean
  cutoff: number
}

export const MIN_SMALL_ITEM_SIZE = 40
export const MAX_SMALL_ITEM_SIZE = 56
const ANCHOR_SIZE = 10
const MEDIUM_LARGE_ITEM_DIFF_THRESHOLD = 0.85
const MEDIUM_ITEM_FLEX_PERCENTAGE = 0.1

const lerpN = (a: number, b: number, t: number) => a + (b - a) * t

// ── KeylineList ─────────────────────────────────────────────────────────────────────────────

export class KeylineList {
  readonly minSize: number
  readonly maxSize: number
  readonly pivotIndex: number
  readonly firstNonAnchorIndex: number
  readonly lastNonAnchorIndex: number
  readonly firstFocalIndex: number
  readonly lastFocalIndex: number

  constructor(readonly keylines: Keyline[]) {
    let min = Number.MAX_VALUE
    let max = 0
    for (const k of keylines) {
      if (k.size < min) min = k.size
      if (k.size > max) max = k.size
    }
    this.minSize = min
    this.maxSize = max
    this.pivotIndex = keylines.findIndex((k) => k.isPivot)
    this.firstNonAnchorIndex = keylines.findIndex((k) => !k.isAnchor)
    this.lastNonAnchorIndex = findLastIndex(keylines, (k) => !k.isAnchor)
    this.firstFocalIndex = keylines.findIndex((k) => k.isFocal)
    this.lastFocalIndex = findLastIndex(keylines, (k) => k.isFocal)
  }

  get length() { return this.keylines.length }
  get isEmpty() { return this.keylines.length === 0 }
  at(i: number): Keyline { return this.keylines[i]! }
  get first() { return this.at(0) }
  get last() { return this.at(this.length - 1) }
  get lastIndex() { return this.length - 1 }
  get pivot() { return this.at(this.pivotIndex) }
  get firstNonAnchor() { return this.at(this.firstNonAnchorIndex) }
  get lastNonAnchor() { return this.at(this.lastNonAnchorIndex) }
  get firstFocal() { return this.at(this.firstFocalIndex) }
  get lastFocal() { return this.at(this.lastFocalIndex) }
  get focalCount() { return this.lastFocalIndex - this.firstFocalIndex + 1 }

  isFirstFocalItemAtStartOfContainer() {
    const firstFocalLeft = this.firstFocal.offset - this.firstFocal.size / 2
    return firstFocalLeft >= 0 && this.firstFocal === this.firstNonAnchor
  }

  isLastFocalItemAtEndOfContainer(carouselMainAxisSize: number) {
    const lastFocalRight = this.lastFocal.offset + this.lastFocal.size / 2
    return lastFocalRight <= carouselMainAxisSize && this.lastFocal === this.lastNonAnchor
  }

  firstIndexAfterFocalRangeWithSize(size: number) {
    for (let i = this.lastFocalIndex; i <= this.lastIndex; i++) if (this.at(i).size === size) return i
    return this.lastIndex
  }

  lastIndexBeforeFocalRangeWithSize(size: number) {
    for (let i = this.firstFocalIndex - 1; i >= 0; i--) if (this.at(i).size === size) return i
    return 0
  }

  getKeylineBefore(unadjustedOffset: number): Keyline {
    for (let i = this.lastIndex; i >= 0; i--) {
      const k = this.at(i)
      if (k.unadjustedOffset < unadjustedOffset) return k
    }
    return this.first
  }

  getKeylineAfter(unadjustedOffset: number): Keyline {
    return this.keylines.find((k) => k.unadjustedOffset >= unadjustedOffset) ?? this.last
  }
}

function findLastIndex<T>(arr: T[], pred: (t: T) => boolean) {
  for (let i = arr.length - 1; i >= 0; i--) if (pred(arr[i]!)) return i
  return -1
}

const EMPTY = new KeylineList([])

type Alignment = 'start' | 'center' | 'end'
interface TmpKeyline { size: number; isAnchor: boolean }

class KeylineListBuilder {
  private firstFocalIndex = -1
  private focalItemSize = 0
  readonly tmp: TmpKeyline[] = []

  add(size: number, isAnchor = false) {
    this.tmp.push({ size, isAnchor })
    // The first focal item is the first index of the largest item added.
    if (!isAnchor && size > this.focalItemSize) {
      this.firstFocalIndex = this.tmp.length - 1
      this.focalItemSize = size
    }
  }

  private findLastFocalIndex() {
    if (this.firstFocalIndex < 0) return -1
    let last = this.firstFocalIndex
    while (last < this.tmp.length - 1 && this.tmp[last + 1]!.size === this.focalItemSize) last++
    return last
  }

  createWithPivot(carouselMainAxisSize: number, itemSpacing: number, pivotIndex: number, pivotOffset: number) {
    return new KeylineList(createKeylinesWithPivot(
      pivotIndex, pivotOffset, this.firstFocalIndex, this.findLastFocalIndex(),
      this.focalItemSize, carouselMainAxisSize, itemSpacing, this.tmp,
    ))
  }

  createWithAlignment(carouselMainAxisSize: number, itemSpacing: number, alignment: Alignment) {
    const lastFocalIndex = this.findLastFocalIndex()
    const focalItemCount = lastFocalIndex - this.firstFocalIndex
    const pivotIndex = this.firstFocalIndex
    let pivotOffset: number
    if (alignment === 'center') {
      // With an even number of keylines the item spacing sits in the middle of the container.
      const itemSpacingSplit = itemSpacing === 0 || focalItemCount % 2 === 0 ? 0 : itemSpacing / 2
      const itemSpaceCounts = Math.trunc(focalItemCount / 2) * itemSpacing
      pivotOffset = carouselMainAxisSize / 2 - (this.focalItemSize / 2) * focalItemCount - itemSpacingSplit - itemSpaceCounts
    } else if (alignment === 'end') {
      pivotOffset = carouselMainAxisSize - this.focalItemSize / 2
    } else {
      pivotOffset = this.focalItemSize / 2
    }
    return new KeylineList(createKeylinesWithPivot(
      pivotIndex, pivotOffset, this.firstFocalIndex, lastFocalIndex,
      this.focalItemSize, carouselMainAxisSize, itemSpacing, this.tmp,
    ))
  }
}

function keylineListOf(carouselMainAxisSize: number, itemSpacing: number, alignment: Alignment, build: (b: KeylineListBuilder) => void) {
  const b = new KeylineListBuilder()
  build(b)
  return b.createWithAlignment(carouselMainAxisSize, itemSpacing, alignment)
}

function keylineListWithPivot(carouselMainAxisSize: number, itemSpacing: number, pivotIndex: number, pivotOffset: number, build: (b: KeylineListBuilder) => void) {
  const b = new KeylineListBuilder()
  build(b)
  return b.createWithPivot(carouselMainAxisSize, itemSpacing, pivotIndex, pivotOffset)
}

const isCutoffLeft = (size: number, offset: number) => offset - size / 2 < 0 && offset + size / 2 > 0
const isCutoffRight = (size: number, offset: number, mainAxis: number) =>
  offset - size / 2 < mainAxis && offset + size / 2 > mainAxis

function createKeylinesWithPivot(
  pivotIndex: number, pivotOffset: number, firstFocalIndex: number, lastFocalIndex: number,
  itemMainAxisSize: number, carouselMainAxisSize: number, itemSpacing: number, tmp: TmpKeyline[],
): Keyline[] {
  if (tmp.length === 0 || pivotIndex < 0 || pivotIndex >= tmp.length) return []
  const pivot = tmp[pivotIndex]!
  const isFocal = (i: number) => i >= firstFocalIndex && i <= lastFocalIndex
  const pivotCutoff = isCutoffLeft(pivot.size, pivotOffset)
    ? pivotOffset - pivot.size / 2
    : isCutoffRight(pivot.size, pivotOffset, carouselMainAxisSize)
      ? pivotOffset + pivot.size / 2 - carouselMainAxisSize
      : 0
  const keylines: Keyline[] = [{
    size: pivot.size, offset: pivotOffset, unadjustedOffset: pivotOffset,
    isFocal: isFocal(pivotIndex), isAnchor: pivot.isAnchor, isPivot: true, cutoff: pivotCutoff,
  }]

  let offset = pivotOffset - itemMainAxisSize / 2 - itemSpacing
  let unadjustedOffset = pivotOffset - itemMainAxisSize / 2 - itemSpacing
  for (let i = pivotIndex - 1; i >= 0; i--) {
    const t = tmp[i]!
    const tmpOffset = offset - t.size / 2
    const tmpUnadjustedOffset = unadjustedOffset - itemMainAxisSize / 2
    const cutoff = isCutoffLeft(t.size, tmpOffset) ? Math.abs(tmpOffset - t.size / 2) : 0
    keylines.unshift({
      size: t.size, offset: tmpOffset, unadjustedOffset: tmpUnadjustedOffset,
      isFocal: isFocal(i), isAnchor: t.isAnchor, isPivot: false, cutoff,
    })
    offset -= t.size + itemSpacing
    unadjustedOffset -= itemMainAxisSize + itemSpacing
  }

  offset = pivotOffset + itemMainAxisSize / 2 + itemSpacing
  unadjustedOffset = pivotOffset + itemMainAxisSize / 2 + itemSpacing
  for (let i = pivotIndex + 1; i < tmp.length; i++) {
    const t = tmp[i]!
    const tmpOffset = offset + t.size / 2
    const tmpUnadjustedOffset = unadjustedOffset + itemMainAxisSize / 2
    const cutoff = isCutoffRight(t.size, tmpOffset, carouselMainAxisSize)
      ? tmpOffset + t.size / 2 - carouselMainAxisSize
      : 0
    keylines.push({
      size: t.size, offset: tmpOffset, unadjustedOffset: tmpUnadjustedOffset,
      isFocal: isFocal(i), isAnchor: t.isAnchor, isPivot: false, cutoff,
    })
    offset += t.size + itemSpacing
    unadjustedOffset += itemMainAxisSize + itemSpacing
  }
  return keylines
}

function lerpKeyline(a: Keyline, b: Keyline, t: number): Keyline {
  return {
    size: lerpN(a.size, b.size, t),
    offset: lerpN(a.offset, b.offset, t),
    unadjustedOffset: lerpN(a.unadjustedOffset, b.unadjustedOffset, t),
    isFocal: t < 0.5 ? a.isFocal : b.isFocal,
    isAnchor: t < 0.5 ? a.isAnchor : b.isAnchor,
    isPivot: t < 0.5 ? a.isPivot : b.isPivot,
    cutoff: lerpN(a.cutoff, b.cutoff, t),
  }
}

function lerpKeylineList(from: KeylineList, to: KeylineList, t: number) {
  return new KeylineList(from.keylines.map((k, i) => lerpKeyline(k, to.at(i), t)))
}

// ── Arrangement ─────────────────────────────────────────────────────────────────────────────

export interface Arrangement {
  priority: number
  smallSize: number
  smallCount: number
  mediumSize: number
  mediumCount: number
  largeSize: number
  largeCount: number
}

const itemCount = (a: Arrangement) => a.largeCount + a.mediumCount + a.smallCount

function isValidArrangement(a: Arrangement) {
  if (a.largeCount > 0 && a.smallCount > 0 && a.mediumCount > 0) return a.largeSize > a.mediumSize && a.mediumSize > a.smallSize
  if (a.largeCount > 0 && a.smallCount > 0) return a.largeSize > a.smallSize
  return true
}

function arrangementCost(a: Arrangement, targetLargeSize: number) {
  if (!isValidArrangement(a)) return Number.MAX_VALUE
  return Math.abs(targetLargeSize - a.largeSize) * a.priority
}

export function findLowestCostArrangement(o: {
  availableSpace: number; itemSpacing: number
  targetSmallSize: number; minSmallSize: number; maxSmallSize: number; smallCounts: number[]
  targetMediumSize: number; mediumCounts: number[]
  targetLargeSize: number; largeCounts: number[]
}): Arrangement | null {
  let lowest: Arrangement | null = null
  let priority = 1
  for (const largeCount of o.largeCounts) {
    for (const mediumCount of o.mediumCounts) {
      for (const smallCount of o.smallCounts) {
        const a = fit(priority, o.availableSpace, o.itemSpacing, smallCount, o.targetSmallSize, o.minSmallSize, o.maxSmallSize, mediumCount, o.targetMediumSize, largeCount, o.targetLargeSize)
        if (lowest === null || arrangementCost(a, o.targetLargeSize) < arrangementCost(lowest, o.targetLargeSize)) {
          lowest = a
          // Arrangements come in priority order, so a zero-cost one can't be beaten.
          if (arrangementCost(lowest, o.targetLargeSize) === 0) return lowest
        }
        priority++
      }
    }
  }
  return lowest
}

function fit(
  priority: number, availableSpace: number, itemSpacing: number,
  smallCount: number, smallSize: number, minSmallSize: number, maxSmallSize: number,
  mediumCount: number, mediumSize: number, largeCount: number, largeSize: number,
): Arrangement {
  const totalItemCount = largeCount + mediumCount + smallCount
  const availableSpaceWithoutSpacing = availableSpace - (totalItemCount - 1) * itemSpacing
  let arrangedSmallSize = Math.min(Math.max(smallSize, minSmallSize), maxSmallSize)
  let arrangedMediumSize = mediumSize
  let arrangedLargeSize = largeSize
  const totalSpaceTaken = arrangedLargeSize * largeCount + arrangedMediumSize * mediumCount + arrangedSmallSize * smallCount
  const delta = availableSpaceWithoutSpacing - totalSpaceTaken
  // First resize small items within their min-max range.
  if (smallCount > 0 && delta > 0) arrangedSmallSize += Math.min(delta / smallCount, maxSmallSize - arrangedSmallSize)
  else if (smallCount > 0 && delta < 0) arrangedSmallSize += Math.max(delta / smallCount, minSmallSize - arrangedSmallSize)
  arrangedSmallSize = smallCount > 0 ? arrangedSmallSize : 0
  arrangedLargeSize = (availableSpaceWithoutSpacing - (smallCount + mediumCount / 2) * arrangedSmallSize) / (largeCount + mediumCount / 2)
  arrangedMediumSize = (arrangedLargeSize + arrangedSmallSize) / 2
  // If the large size moved away from its target, win some of it back from the medium items.
  if (mediumCount > 0 && arrangedLargeSize !== largeSize) {
    const targetAdjustment = (largeSize - arrangedLargeSize) * largeCount
    const availableMediumFlex = arrangedMediumSize * MEDIUM_ITEM_FLEX_PERCENTAGE * mediumCount
    const distribute = Math.min(Math.abs(targetAdjustment), availableMediumFlex)
    if (targetAdjustment > 0) {
      arrangedMediumSize -= distribute / mediumCount
      arrangedLargeSize += distribute / largeCount
    } else {
      arrangedMediumSize += distribute / mediumCount
      arrangedLargeSize -= distribute / largeCount
    }
  }
  return { priority, smallSize: arrangedSmallSize, smallCount, mediumSize: arrangedMediumSize, mediumCount, largeSize: arrangedLargeSize, largeCount }
}

// ── Keyline lists per carousel type (Keylines.kt) ───────────────────────────────────────────

function createLeftAlignedKeylineList(carouselMainAxisSize: number, itemSpacing: number, leftAnchorSize: number, rightAnchorSize: number, a: Arrangement) {
  return keylineListOf(carouselMainAxisSize, itemSpacing, 'start', (b) => {
    b.add(leftAnchorSize, true)
    for (let i = 0; i < a.largeCount; i++) b.add(a.largeSize)
    for (let i = 0; i < a.mediumCount; i++) b.add(a.mediumSize)
    for (let i = 0; i < a.smallCount; i++) b.add(a.smallSize)
    b.add(rightAnchorSize, true)
  })
}

function createCenterAlignedKeylineList(carouselMainAxisSize: number, itemSpacing: number, leftAnchorSize: number, rightAnchorSize: number, a: Arrangement) {
  return keylineListOf(carouselMainAxisSize, itemSpacing, 'center', (b) => {
    b.add(leftAnchorSize, true)
    for (let i = 0; i < Math.trunc(a.smallCount / 2); i++) b.add(a.smallSize)
    for (let i = 0; i < Math.trunc(a.mediumCount / 2); i++) b.add(a.mediumSize)
    for (let i = 0; i < a.largeCount; i++) b.add(a.largeSize)
    for (let i = 0; i < Math.trunc(a.mediumCount / 2); i++) b.add(a.mediumSize)
    for (let i = 0; i < Math.trunc(a.smallCount / 2); i++) b.add(a.smallSize)
    b.add(rightAnchorSize, true)
  })
}

export function multiBrowseKeylineList(
  carouselMainAxisSize: number, preferredItemSize: number, itemSpacing: number, count: number,
  minSmallItemSize = MIN_SMALL_ITEM_SIZE, maxSmallItemSize = MAX_SMALL_ITEM_SIZE,
): KeylineList {
  if (carouselMainAxisSize === 0 || preferredItemSize === 0) return EMPTY
  let smallCounts = [1]
  const mediumCounts = [1, 0]
  const targetLargeSize = Math.min(preferredItemSize, carouselMainAxisSize)
  // A small item is ideally 1/3 of the large one, clamped to the min-max range.
  const targetSmallSize = Math.min(Math.max(targetLargeSize / 3, minSmallItemSize), maxSmallItemSize)
  const targetMediumSize = (targetLargeSize + targetSmallSize) / 2
  if (carouselMainAxisSize < minSmallItemSize * 2) smallCounts = [0]
  const minAvailableLargeSpace = carouselMainAxisSize - targetMediumSize * Math.max(...mediumCounts) - maxSmallItemSize * Math.max(...smallCounts)
  const minLargeCount = Math.max(1, Math.floor(minAvailableLargeSpace / targetLargeSize))
  const maxLargeCount = Math.ceil(carouselMainAxisSize / targetLargeSize)
  const largeCounts = Array.from({ length: maxLargeCount - minLargeCount + 1 }, (_, i) => maxLargeCount - i)
  const base = { availableSpace: carouselMainAxisSize, itemSpacing, targetSmallSize, minSmallSize: minSmallItemSize, maxSmallSize: maxSmallItemSize, targetMediumSize, targetLargeSize, largeCounts }
  let arrangement = findLowestCostArrangement({ ...base, smallCounts, mediumCounts })

  if (arrangement !== null && itemCount(arrangement) > count) {
    let surplus = itemCount(arrangement) - count
    let smallCount = arrangement.smallCount
    let mediumCount = arrangement.mediumCount
    while (surplus > 0) {
      if (smallCount > 0) smallCount -= 1
      // Keep at least one medium so the large items don't fill the whole carousel.
      else if (mediumCount > 1) mediumCount -= 1
      surplus -= 1
    }
    arrangement = findLowestCostArrangement({ ...base, smallCounts: [smallCount], mediumCounts: [mediumCount] })
  }
  if (arrangement === null) return EMPTY
  return createLeftAlignedKeylineList(carouselMainAxisSize, itemSpacing, ANCHOR_SIZE, ANCHOR_SIZE, arrangement)
}

export function uncontainedKeylineList(carouselMainAxisSize: number, itemSize: number, itemSpacing: number): KeylineList {
  if (carouselMainAxisSize === 0 || itemSize === 0) return EMPTY
  const largeItemSize = Math.min(itemSize + itemSpacing, carouselMainAxisSize)
  const largeCount = Math.max(1, Math.floor(carouselMainAxisSize / largeItemSize))
  const remainingSpace = carouselMainAxisSize - largeCount * largeItemSize
  const mediumCount = remainingSpace > 0 ? 1 : 0
  const mediumItemSize = calculateMediumChildSize(ANCHOR_SIZE, largeItemSize, remainingSpace)
  const arrangement: Arrangement = { priority: 0, smallSize: 0, smallCount: 0, mediumSize: mediumItemSize, mediumCount, largeSize: largeItemSize, largeCount }
  const xSmallSize = Math.min(ANCHOR_SIZE, itemSize)
  // Half the cut-off item's size on the left makes the motion there closer to the right side's.
  const leftAnchorSize = Math.max(xSmallSize, mediumItemSize * 0.5)
  return createLeftAlignedKeylineList(carouselMainAxisSize, itemSpacing, leftAnchorSize, ANCHOR_SIZE, arrangement)
}

export function heroKeylineList(
  carouselMainAxisSize: number, preferredItemSize: number | null, itemSpacing: number, count: number,
  isCentered: boolean, minSmallItemSize = MIN_SMALL_ITEM_SIZE, maxSmallItemSize = MAX_SMALL_ITEM_SIZE,
): KeylineList {
  if (carouselMainAxisSize === 0) return EMPTY
  // Fewer than 3 items can't be centered.
  const shouldCenter = isCentered && count >= 3
  let smallCounts = count <= 1 ? [0] : shouldCenter ? [2] : [1]
  const targetLargeSize = Math.min(preferredItemSize ?? carouselMainAxisSize, carouselMainAxisSize)
  const targetSmallSize = Math.min(Math.max(targetLargeSize / 3, minSmallItemSize), maxSmallItemSize)
  // Room for the small items plus a large item at least 25% bigger than them.
  const fullscreenThreshold = minSmallItemSize * Math.max(...smallCounts) + minSmallItemSize * 1.25
  if (carouselMainAxisSize < fullscreenThreshold) smallCounts = [0]
  const minAvailableLargeSpace = carouselMainAxisSize - minSmallItemSize * Math.max(...smallCounts)
  const minLargeCount = Math.max(1, Math.floor(minAvailableLargeSpace / targetLargeSize))
  const maxLargeCount = Math.ceil(carouselMainAxisSize / targetLargeSize)
  const largeCounts = Array.from({ length: maxLargeCount - minLargeCount + 1 }, (_, i) => maxLargeCount - i)
  const arrangement = findLowestCostArrangement({
    availableSpace: carouselMainAxisSize, itemSpacing, targetSmallSize, minSmallSize: minSmallItemSize, maxSmallSize: maxSmallItemSize,
    smallCounts, targetMediumSize: 0, mediumCounts: [0], targetLargeSize, largeCounts,
  })
  if (arrangement === null) return EMPTY
  return shouldCenter && count >= itemCount(arrangement)
    ? createCenterAlignedKeylineList(carouselMainAxisSize, itemSpacing, ANCHOR_SIZE, ANCHOR_SIZE, arrangement)
    : createLeftAlignedKeylineList(carouselMainAxisSize, itemSpacing, ANCHOR_SIZE, ANCHOR_SIZE, arrangement)
}

/** MDC-Android's FullScreenCarouselStrategy: one large item filling the container. */
export function fullScreenKeylineList(carouselMainAxisSize: number, itemSpacing: number): KeylineList {
  if (carouselMainAxisSize === 0) return EMPTY
  const arrangement: Arrangement = { priority: 0, smallSize: 0, smallCount: 0, mediumSize: 0, mediumCount: 0, largeSize: carouselMainAxisSize, largeCount: 1 }
  return createLeftAlignedKeylineList(carouselMainAxisSize, itemSpacing, ANCHOR_SIZE, ANCHOR_SIZE, arrangement)
}

function calculateMediumChildSize(minimumMediumSize: number, largeItemSize: number, remainingSpace: number) {
  // Ideally a third of the medium item is cut off, so it's 1.5x the remaining space.
  let mediumItemSize = Math.max(remainingSpace * 1.5, minimumMediumSize)
  // Too close to the large size gives too little motion between them.
  const largeItemThreshold = largeItemSize * MEDIUM_LARGE_ITEM_DIFF_THRESHOLD
  if (mediumItemSize > largeItemThreshold) {
    const sizeWithFifthCutOff = remainingSpace * 1.2
    mediumItemSize = Math.min(Math.max(largeItemThreshold, sizeWithFifthCutOff), largeItemSize)
  }
  return mediumItemSize
}

// ── Strategy ────────────────────────────────────────────────────────────────────────────────

export class Strategy {
  readonly startKeylineSteps: KeylineList[]
  readonly endKeylineSteps: KeylineList[]
  readonly minItemSize: number
  readonly maxItemSize: number
  private readonly startShiftDistance: number
  private readonly endShiftDistance: number
  private readonly startShiftPoints: number[]
  private readonly endShiftPoints: number[]
  private lastStartAndEndSteps: KeylineList[] | null = null

  constructor(
    readonly defaultKeylines: KeylineList,
    readonly availableSpace: number,
    readonly itemSpacing: number,
    readonly beforeContentPadding: number,
    readonly afterContentPadding: number,
  ) {
    this.startKeylineSteps = getStartKeylineSteps(defaultKeylines, availableSpace, itemSpacing, beforeContentPadding)
    this.endKeylineSteps = getEndKeylineSteps(defaultKeylines, availableSpace, itemSpacing, afterContentPadding)
    let min = defaultKeylines.minSize
    let max = defaultKeylines.maxSize
    for (const step of [...this.startKeylineSteps, ...this.endKeylineSteps]) {
      if (step.minSize < min) min = step.minSize
      if (step.maxSize > max) max = step.maxSize
    }
    this.minItemSize = min
    this.maxItemSize = max
    this.startShiftDistance = getStartShiftDistance(this.startKeylineSteps, beforeContentPadding)
    this.endShiftDistance = getEndShiftDistance(this.endKeylineSteps, afterContentPadding)
    this.startShiftPoints = getStepInterpolationPoints(this.startShiftDistance, this.startKeylineSteps, true)
    this.endShiftPoints = getStepInterpolationPoints(this.endShiftDistance, this.endKeylineSteps, false)
  }

  get itemMainAxisSize() { return this.defaultKeylines.isEmpty ? 0 : this.defaultKeylines.firstFocal.size }

  get isValid() { return !this.defaultKeylines.isEmpty && this.availableSpace !== 0 && this.itemMainAxisSize !== 0 }

  getKeylineListForScrollOffset(scrollOffset: number, maxScrollOffset: number, roundToNearestStep = false): KeylineList {
    const positiveScrollOffset = Math.max(0, scrollOffset)
    const startShiftOffset = this.startShiftDistance
    const endShiftOffset = Math.max(0, maxScrollOffset - this.endShiftDistance)
    if (positiveScrollOffset >= startShiftOffset && positiveScrollOffset <= endShiftOffset) return this.defaultKeylines

    let interpolation = lerpRange(1, 0, 0, startShiftOffset, positiveScrollOffset)
    let shiftPoints = this.startShiftPoints
    let steps = this.startKeylineSteps
    if (positiveScrollOffset > endShiftOffset) {
      interpolation = lerpRange(0, 1, endShiftOffset, maxScrollOffset, positiveScrollOffset)
      shiftPoints = this.endShiftPoints
      steps = this.endKeylineSteps
      // End shifting from offset 0: go straight from the last start step to the last end step.
      if (endShiftOffset < 0.01 && this.startKeylineSteps.length === 2 && this.endKeylineSteps.length === 2) {
        this.lastStartAndEndSteps ??= [this.startKeylineSteps[1]!, this.endKeylineSteps[1]!]
        steps = this.lastStartAndEndSteps
      }
    }

    let fromStepIndex = 0
    let toStepIndex = 0
    let steppedInterpolation = 0
    let lowerBounds = shiftPoints[0] ?? 0
    for (let i = 1; i < steps.length; i++) {
      const upperBounds = shiftPoints[i]!
      if (interpolation <= upperBounds) {
        fromStepIndex = i - 1
        toStepIndex = i
        steppedInterpolation = lerpRange(0, 1, lowerBounds, upperBounds, interpolation)
        break
      }
      lowerBounds = upperBounds
    }
    if (roundToNearestStep) return steps[Math.round(steppedInterpolation) === 0 ? fromStepIndex : toStepIndex]!
    return lerpKeylineList(steps[fromStepIndex]!, steps[toStepIndex]!, steppedInterpolation)
  }
}

function lerpRange(outputMin: number, outputMax: number, inputMin: number, inputMax: number, value: number) {
  if (value <= inputMin) return outputMin
  if (value >= inputMax) return outputMax
  return lerpN(outputMin, outputMax, (value - inputMin) / (inputMax - inputMin))
}

function getStartShiftDistance(steps: KeylineList[], beforeContentPadding: number) {
  if (steps.length === 0) return 0
  return Math.max(steps[steps.length - 1]!.first.unadjustedOffset - steps[0]!.first.unadjustedOffset, beforeContentPadding)
}

function getEndShiftDistance(steps: KeylineList[], afterContentPadding: number) {
  if (steps.length === 0) return 0
  return Math.max(steps[0]!.last.unadjustedOffset - steps[steps.length - 1]!.last.unadjustedOffset, afterContentPadding)
}

function getStartKeylineSteps(defaultKeylines: KeylineList, mainAxis: number, itemSpacing: number, beforeContentPadding: number): KeylineList[] {
  if (defaultKeylines.isEmpty) return []
  const steps = [defaultKeylines]
  if (defaultKeylines.isFirstFocalItemAtStartOfContainer()) {
    if (beforeContentPadding !== 0) {
      steps.push(createShiftedKeylineListForContentPadding(defaultKeylines, mainAxis, itemSpacing, beforeContentPadding, defaultKeylines.firstFocal, defaultKeylines.firstFocalIndex))
    }
    return steps
  }
  const startIndex = defaultKeylines.firstNonAnchorIndex
  const endIndex = defaultKeylines.firstFocalIndex
  const numberOfSteps = endIndex - startIndex
  if (numberOfSteps <= 0 && defaultKeylines.firstFocal.cutoff > 0) {
    steps.push(moveKeylineAndCreateShiftedKeylineList(defaultKeylines, 0, 0, mainAxis, itemSpacing))
    return steps
  }
  for (let i = 0; i < numberOfSteps; i++) {
    const prevStep = steps[steps.length - 1]!
    const originalItemIndex = startIndex + i
    let dstIndex = defaultKeylines.lastIndex
    if (originalItemIndex > 0) {
      const originalNeighborBeforeSize = defaultKeylines.at(originalItemIndex - 1).size
      dstIndex = prevStep.firstIndexAfterFocalRangeWithSize(originalNeighborBeforeSize) - 1
    }
    steps.push(moveKeylineAndCreateShiftedKeylineList(prevStep, defaultKeylines.firstNonAnchorIndex, dstIndex, mainAxis, itemSpacing))
  }
  if (beforeContentPadding !== 0) {
    const last = steps[steps.length - 1]!
    steps[steps.length - 1] = createShiftedKeylineListForContentPadding(last, mainAxis, itemSpacing, beforeContentPadding, last.firstFocal, last.firstFocalIndex)
  }
  return steps
}

function getEndKeylineSteps(defaultKeylines: KeylineList, mainAxis: number, itemSpacing: number, afterContentPadding: number): KeylineList[] {
  if (defaultKeylines.isEmpty) return []
  const steps = [defaultKeylines]
  if (defaultKeylines.isLastFocalItemAtEndOfContainer(mainAxis)) {
    if (afterContentPadding !== 0) {
      steps.push(createShiftedKeylineListForContentPadding(defaultKeylines, mainAxis, itemSpacing, -afterContentPadding, defaultKeylines.lastFocal, defaultKeylines.lastFocalIndex))
    }
    return steps
  }
  const startIndex = defaultKeylines.lastFocalIndex
  const endIndex = defaultKeylines.lastNonAnchorIndex
  const numberOfSteps = endIndex - startIndex
  if (numberOfSteps <= 0 && defaultKeylines.lastFocal.cutoff > 0) {
    steps.push(moveKeylineAndCreateShiftedKeylineList(defaultKeylines, 0, 0, mainAxis, itemSpacing))
    return steps
  }
  for (let i = 0; i < numberOfSteps; i++) {
    const prevStep = steps[steps.length - 1]!
    const originalItemIndex = endIndex - i
    let dstIndex = 0
    if (originalItemIndex < defaultKeylines.lastIndex) {
      const originalNeighborAfterSize = defaultKeylines.at(originalItemIndex + 1).size
      dstIndex = prevStep.lastIndexBeforeFocalRangeWithSize(originalNeighborAfterSize) + 1
    }
    steps.push(moveKeylineAndCreateShiftedKeylineList(prevStep, defaultKeylines.lastNonAnchorIndex, dstIndex, mainAxis, itemSpacing))
  }
  if (afterContentPadding !== 0) {
    const last = steps[steps.length - 1]!
    steps[steps.length - 1] = createShiftedKeylineListForContentPadding(last, mainAxis, itemSpacing, -afterContentPadding, last.lastFocal, last.lastFocalIndex)
  }
  return steps
}

function createShiftedKeylineListForContentPadding(from: KeylineList, mainAxis: number, itemSpacing: number, contentPadding: number, pivot: Keyline, pivotIndex: number) {
  const numberOfNonAnchorKeylines = from.keylines.filter((k) => !k.isAnchor).length
  const sizeReduction = contentPadding / numberOfNonAnchorKeylines
  const newKeylines = keylineListWithPivot(mainAxis, itemSpacing, pivotIndex, pivot.offset - sizeReduction / 2 + contentPadding, (b) => {
    for (const k of from.keylines) b.add(k.size - Math.abs(sizeReduction), k.isAnchor)
  })
  // Items are still laid out end to end at the original size, so keep the original unadjusted offsets.
  return new KeylineList(newKeylines.keylines.map((k, i) => ({ ...k, unadjustedOffset: from.at(i).unadjustedOffset })))
}

function moveKeylineAndCreateShiftedKeylineList(from: KeylineList, srcIndex: number, dstIndex: number, mainAxis: number, itemSpacing: number) {
  const pivotDir = srcIndex > dstIndex ? 1 : -1
  const pivotDelta = (from.at(srcIndex).size - from.at(srcIndex).cutoff + itemSpacing) * pivotDir
  const newPivotIndex = from.pivotIndex + pivotDir
  const newPivotOffset = from.pivot.offset + pivotDelta
  const moved = [...from.keylines]
  const [k] = moved.splice(srcIndex, 1)
  moved.splice(dstIndex, 0, k!)
  return keylineListWithPivot(mainAxis, itemSpacing, newPivotIndex, newPivotOffset, (b) => {
    for (const m of moved) b.add(m.size, m.isAnchor)
  })
}

function getStepInterpolationPoints(totalShiftDistance: number, steps: KeylineList[], isShiftingLeft: boolean) {
  const points = [0]
  if (totalShiftDistance === 0 || steps.length === 0) return points
  for (let i = 1; i < steps.length; i++) {
    const prev = steps[i - 1]!
    const curr = steps[i]!
    const distanceShifted = isShiftingLeft
      ? curr.first.unadjustedOffset - prev.first.unadjustedOffset
      : prev.last.unadjustedOffset - curr.last.unadjustedOffset
    const stepPercentage = distanceShifted / totalShiftDistance
    points.push(i === steps.length - 1 ? 1 : points[i - 1]! + stepPercentage)
  }
  return points
}

// ── Scroll geometry (Carousel.kt / KeylineSnapPosition.kt) ──────────────────────────────────

export function maxScrollOffset(strategy: Strategy, count: number) {
  const total = strategy.itemMainAxisSize * count + strategy.itemSpacing * (count - 1)
  return Math.max(total - strategy.availableSpace, 0)
}

/** Where item `index` sits, in pager terms, when it's the snapped item. */
export function snapPositionOffset(strategy: Strategy, index: number, count: number) {
  if (!strategy.isValid) return 0
  let offset = Math.round(strategy.defaultKeylines.firstFocal.unadjustedOffset - strategy.itemMainAxisSize / 2)
  const startSteps = strategy.startKeylineSteps
  if (index <= startSteps.length - 1) {
    const stepIndex = clamp(startSteps.length - 1 - index, 0, startSteps.length - 1)
    offset = Math.round(startSteps[stepIndex]!.firstFocal.unadjustedOffset - strategy.itemMainAxisSize / 2)
  }
  const endSteps = strategy.endKeylineSteps
  const lastItemIndex = count - 1
  if (index >= lastItemIndex - (endSteps.length - 1) && count > strategy.defaultKeylines.focalCount) {
    const stepIndex = clamp(endSteps.length - 1 - (lastItemIndex - index), 0, endSteps.length - 1)
    offset = Math.round(endSteps[stepIndex]!.lastFocal.unadjustedOffset - strategy.itemMainAxisSize / 2)
  }
  return offset
}

/** The scroll offset at which item `index` is snapped. */
export function snapScrollOffset(strategy: Strategy, index: number, count: number) {
  const stride = strategy.itemMainAxisSize + strategy.itemSpacing
  return clamp(index * stride - snapPositionOffset(strategy, index, count), 0, maxScrollOffset(strategy, count))
}

export interface ItemPlacement {
  /** Translation of the item along the main axis, from the container's start edge. */
  offset: number
  /** Visible (masked) size along the main axis. */
  maskSize: number
  /** Start of the mask inside the item, which is `strategy.itemMainAxisSize` long. */
  maskStart: number
}

/** Modifier.carouselItem's layout block: where item `index` goes and how much of it shows. */
export function placeItem(strategy: Strategy, index: number, scrollOffset: number, maxScroll: number): ItemPlacement {
  const size = strategy.itemMainAxisSize
  const keylines = strategy.getKeylineListForScrollOffset(scrollOffset, maxScroll)
  const stride = size + strategy.itemSpacing
  const unadjustedCenter = index * stride + size / 2 - scrollOffset
  const before = keylines.getKeylineBefore(unadjustedCenter)
  const after = keylines.getKeylineAfter(unadjustedCenter)
  const progress = before === after ? 1 : (unadjustedCenter - before.unadjustedOffset) / (after.unadjustedOffset - before.unadjustedOffset)
  const k = lerpKeyline(before, after, progress)
  let translation = k.offset - unadjustedCenter
  if (before === after) {
    // Beyond the first or last keyline: keep offsetting by the item's masked size.
    translation += (unadjustedCenter - k.unadjustedOffset) / k.size
  }
  return {
    offset: index * stride - scrollOffset + translation,
    maskSize: k.size,
    maskStart: size / 2 - k.size / 2,
  }
}

function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max)
}
