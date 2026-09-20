# Changelog

All notable changes to `@m3ui-vue/m3ui-vue` are documented here.
This project adheres to [Semantic Versioning](https://semver.org/).

---

## [0.8.0] - 2026-09-18

### Fixed
- Text-field-shaped components — `MTextField`, `MSelect`, `MAutocomplete`, `MMultiSelect`, `MMultiAutocomplete`, `MNumberField`, `MMaskField`, `MTagInput`, `MPinInput`, and the trigger fields of `MDatePicker`/`MDateRangePicker`/`MTimePicker`/`MColorPicker` (plus `MDatePickerModal`/`MColorPickerModal`'s manual-entry inputs) — all shared the same hand-copied deviations from `FilledTextFieldTokens`/`OutlinedTextFieldTokens`, now fixed everywhere:
  - Corner radius was `8px` (this project's `--radius-sm`), spec's `ContainerShape`/`MenuTokens.ContainerShape` is `CornerExtraSmall` (`4px`, `--radius-xs`) — also fixed on `MSelect`/`MAutocomplete`'s dropdown/menu panels
  - Leading icon was `20px`, spec's `LeadingIconSize`/`TrailingIconSize` is `24dp`
  - Disabled state used one blanket `opacity-[0.38]` on the whole field instead of the spec's split values: text/label/icon/border at on-surface 38%, but the *filled* container background only 4% and the *outlined* border only 12% — the old blanket opacity made filled fields look far more washed-out and outlined borders far more visible than spec. The floating `<label>` now actually dims when disabled too — it didn't before, since it sat outside the old opacity class. `MMultiSelect`/`MTagInput` had no disabled styling at all before this, not even the old blanket opacity
  - No `caret-color` — the text cursor now tints `primary`/`error` (`CaretColor`/`ErrorFocusCaretColor`) instead of the browser default, on every real `<input>`/`<textarea>`
- `MSelect`'s empty-dropdown state ("Sin opciones") was hardcoded in Spanish, ignoring the `useLocale()` composable already used elsewhere in the same file — now uses a new `noResultsText` prop with the existing `noResults` locale key as fallback, matching the pattern `MAutocomplete` already had
- `MMultiSelect`/`MMultiAutocomplete`'s per-chip remove button wasn't gated by `disabled` — a disabled multi-select still let you remove individual chips. The button no longer renders at all when the field is disabled
- `MNavigationBar`/`MNavigationRail`'s active item's label was tinted the same color as its icon (`on-secondary-container`); M3's `ItemActiveLabelTextColor` is `secondary`, a *different* color from `ItemActiveIconColor`. Also removed an active-label bold-weight toggle neither token file defines (only color changes)
- `MNavigationBar` had no `shadow-elevation-2` on the bar itself (`ContainerElevation = Level2`)
- `MNavigationDrawer`: default width was `288px`, spec's `ContainerWidth` is `360px`; the modal variant used `surface-container` + elevation level 3, spec's `ModalContainerColor`/`ModalContainerElevation` are `surface-container-low` + level 1 (far less shadow); active item row height was ~`44px` against the `56dp` `ActiveIndicatorHeight`; the far edge (opposite the screen edge) had no corner rounding against `ContainerShape = CornerLargeEnd`/`BottomContainerShape = CornerLargeTop`
- `MTabs`: label typography was `label-large`, spec's `LabelTextFont` is `title-small` in both variants — not just a size difference, a different type-scale entirely; icon size was `20px`/`18px` (primary/secondary) against the spec's `24dp` in both; primary's icon+label tab height was `56px` against `IconAndLabelTextContainerHeight = 64dp`; secondary's indicator was `2px` thick against the real `3dp` (confirmed via `TabRow.kt` — there's no separate lower value for the underline style despite the "Secondary" naming)
- `MMenu`/`MMenuItem`/`MContextMenu`'s dropdown/submenu panels used `16px` corner radius against `MenuTokens.ContainerShape = CornerExtraSmall` (`4px`) — same bug as the text-field dropdown panels above, independently hand-copied
- `MMenuItem` had no visible keyboard focus indicator at all (only a hover background) — added a `focus-visible` ring using `MenuTokens.FocusIndicatorColor = secondary`
- `MDialog` (and `MConfirmDialog`, which wraps it): bottom padding below the actions row was `16px`, spec's `AlertDialogDefaults.dialogPadding` is `24dp` on all four sides; default `maxWidth` was `max-w-md` (448px) against `AlertDialogDefaults.DialogMaxWidth = 560dp`, and there was no `min-width` at all against `DialogMinWidth = 280dp`
- `MButton`'s `size` prop (`xs`/`sm`/`md`/`lg`/`xl`) is implementing M3's newer 5-tier "expressive" button sizing (`Button{XSmall,Small,Medium,Large,XLarge}Tokens.kt`), and several tiers had the wrong values: `xs` used a `16px` icon and `label-medium` text against the real `20dp`/`label-large`; `md` used a `20px` icon against `24dp`; `lg` and `xl` were especially far off since the real jump to those tiers is large by design — `lg` was `64px` tall with a `22px` icon and `title-large` text against the real `96px`/`32dp`/`headline-small`, and `xl` was `80px` with a `24px` icon and `headline-small` text against the real `136px`/`40dp`/`headline-large`. The icon-label gap was a flat `8px` for every size; real spec varies it (`4/8/8/12/16dp` for xs→xl). Horizontal padding was also off at most tiers, and previously had a separate (wrong) reduced value for when an icon was present — the real tokens use the *same* padding whether or not there's an icon at every tier, so that split was removed. `shape="squared"`'s corner radius was a flat `12px` for every size; now scales per tier (`12px` xs/sm, `16px` md, `28px` lg/xl, matching each tier's own `ContainerShapeSquare`)
- `MButton`'s `variant="outlined"` border was `border-outline`; `OutlinedButtonTokens.OutlineColor` is actually `OutlineVariant`, a different (more subtle) color role — fixed to `border-outline-variant`
- `MButton`'s disabled container/border opacity was `12%` (`disabled:bg-on-surface/12` / `disabled:border-on-surface/12`) for filled/tonal/elevated/outlined; spec's `DisabledContainerOpacity = 0.1f` (`10%`) — also, the outlined variant's disabled border was tinted `on-surface`, but per the fix above it should follow its own (`outline-variant`, or `error` for the error color) border color rather than on-surface
- `MIconButton` has the same 5-tier size system as `MButton` (`{XSmall,Small,Medium,Large,XLarge}IconButtonTokens.kt`), with the same kind of deviations: `md`/`lg`/`xl` container sizes were `48/56/64px` against the real `56/96/136px` (again, `lg`/`xl` are a genuinely large jump in the real spec), `xs`/`sm`/`lg`/`xl` icon sizes were off by a few px each, and `shape="squared"`'s corner radius was a flat `12px` instead of scaling per tier (12/12/16/28/28px). `variant="outlined"`'s border was `border-outline`; the real (non-"vibrant") `outlinedIconButtonBorder` actually tracks the button's own content color (`LocalContentColor`, i.e. `on-surface-variant`) rather than a fixed border token, so it's now `border-current` — which also means its disabled state no longer needs a separate class, since it dims automatically along with the icon's own `disabled:text-on-surface/38`. `disabled:bg-on-surface/12` → `/10` for filled/tonal, matching `DisabledContainerOpacity`. Filled/tonal variants also had a `hover:shadow-elevation-1` that doesn't exist in the real spec at all (`IconButton.kt` has zero elevation tokens for any variant) — removed, and replaced with an actual state-layer overlay (an 8%/12% `before:bg-current` layer on hover/press, the same technique `MButton` already uses) since filled/tonal previously had no hover/press feedback whatsoever besides that incorrect shadow
- `MCard` (`clickable`): hover/pressed elevation was the same `hover:shadow-elevation-2`/`active:shadow-elevation-1` for all three variants, copied from `elevated`'s own values — `Filled{,Elevated,Outlined}CardTokens` actually differ per variant: only `elevated` reaches Level2 on hover and stays elevated (Level1) while pressed; `filled`/`outlined` only reach Level1 on hover and drop back flat (Level0) while pressed
- `MCheckbox`: the touch/state-layer target was `48px` (`h-12 w-12`) against `CheckboxTokens.StateLayerSize = 40dp`; the check icon was `14px` against `IconSize = 18dp` (it should fill the whole 18px box, not sit inside it with visible padding); corner radius was `3px` against `ContainerShape`'s `2dp`
- Fixed a real regression introduced while adding `MCheckbox`'s hover/focus state layer below: the hidden (`sr-only`) checkbox `<input>` had been hoisted up to be a direct child of `<label>`, away from any nearby `position: relative` ancestor. Clicking it made the browser's native "scroll the newly focused element into view" behavior treat a distant unrelated `overflow: hidden` ancestor (in the consuming app's own layout, not anything in this library) as a real scroll container and scroll it to its maximum — visually blowing the whole page off-screen. Moved the input back to being nested inside the same `relative` span as before (a true sibling of the state-layer/focus-ring spans, so `peer-*` styling still works) — this is exactly how `MSwitch`'s input is nested, which never had the bug
- `MChip`: corner radius was a flat `rounded-sm` (8px) at every state; spec's `ChipsTokens.UnselectedShape`/`SelectedShape` are `CornerMedium` (12dp) unselected but `CornerFull` (a full pill) once selected — chips now morph shape when `selected` toggles, not just color. The neutral/unselected border was `border-outline`; spec's `UnselectedOutlineColor` is `OutlineVariant` (same mixup `MButton` had). Disabled neutral/unselected border opacity was `12%`; spec's `UnselectedDisabledOutlineOpacity` is `10%` (the disabled-and-filled/selected case was already correctly `12%`, matching `SelectedDisabledContainerOpacity` — only the outline case was off)
- `MRadio`: same missing-interactivity gaps `MCheckbox` had before its own fix — touch/state-layer target was `48px` against `RadioButtonTokens.StateLayerSize = 40dp`; the unselected ring+dot stayed a fixed `on-surface-variant` instead of darkening to `on-surface` on hover/focus/press (`Unselected{Hover,Focus,Pressed}IconColor`)
- `MSwitch`: the on-check icon color used the raw `color` prop tone (`text-primary` etc.) instead of `SwitchTokens.SelectedIconColor`, which is the *container* variant of that tone (`on-primary-container` etc. — a different role from the handle's own `on-primary` fill it sits on top of). Neither the track outline nor the handle changed color on interaction the way the real tokens define (`Unselected{Hover,Focus,Pressed}HandleColor` = `on-surface-variant` instead of the resting `outline`; `Selected{Hover,Focus,Pressed}HandleColor` = `{color}-container` instead of the resting `on-{color}`). The handle also didn't grow to `28dp` while pressed (`Pressed{Handle}Width/Height`, the same for both selected/unselected)
- `MBadge`: dot badge was `10px` against `BadgeTokens.Size = 6dp`; the labeled/large badge was `20px` against `LargeSize = 16dp` (including the "99+" case's `min-width` floor); label typography was a raw `10px` instead of the semantic `text-label-small` (`LabelSmall` = `11px`/`16px` line-height in this project's own type scale) every other text role in the library already uses
- `MListItem`: container height wasn't enforced against `ItemOneLineContainerHeight`/`TwoLine`/`ThreeLine` (`56`/`72`/`88dp`, a real `max(minHeight, contentHeight)` floor, not just padding) — 1-line rows landed around `40px`, 2-line around `60px`. The selected-state `SecondaryContainer`/`OnSecondaryContainer` treatment (`ItemSelectedContainerColor`, which applies to any selected list item per spec) was only wired up for `nav`/`segmented` contexts — a plain selectable list item fell back to a flat `on-surface/8` tint with no text/icon recolor at all, and even the nav/segmented branches never actually recolored the leading/trailing icons or title/subtitle/description, which stayed hardcoded regardless of state
- `MTooltip` (plain variant): had a `shadow-elevation-2`, real default elevation is `0dp`; padding was `12px`/`6px` against `PlainTooltipContentPadding`'s `8px`/`4px`; max-width was `220px` against `plainTooltipMaxWidth = 200dp`; the `24dp`/`40dp` min-height/min-width floor (`TooltipMinHeight`/`TooltipMinWidth`) wasn't enforced; the anchor gap was `8px` against `SpacingBetweenTooltipAndAnchor = 4dp`; typography was `text-label-medium` instead of the real `BodySmall` role (pixel-identical in this project's scale, but semantically wrong)
- `MTooltip` (rich variant): elevation was `shadow-elevation-3` against `RichTooltipTokens.ContainerElevation = Level2`; the subhead/title color was `on-surface` against `SubheadColor = OnSurfaceVariant`; dropped a `ring-1 ring-outline-variant` border with no backing token in `RichTooltipTokens` (elevation + `SurfaceContainer` alone differentiate it per spec)
- `MSnackbar`/`MNotificationHost`: structural tokens brought in line with `SnackbarTokens` — shape `rounded-2xl` (16px) against `ContainerShape = CornerExtraSmall` (4dp); elevation `shadow-elevation-2` against `ContainerElevation = Level3`; icon size `20px` against `IconSize = 24dp`; action-button typography `label-medium` against `ActionLabelTextFont = LabelLarge`; no `48dp` single-line height floor (`SingleLineContainerHeight`). The color-variant/badge-count/progress-bar toast system has no equivalent in the real (single-color) Snackbar spec and was deliberately left as a library extension
- `MSegmentedButton`: disabled state applied one blanket `opacity-[0.38]` to the whole button; real `SegmentedButtonColors` differentiates content (`OnSurface` at 38%) from the border/divider (`Outline` at only 12%) — the divider read far more prominent than the content when disabled. Also fixed `color="primary"` being a dead option that fell through to the exact same `bg-secondary-container` treatment as `color="secondary"` — now maps to `bg-primary-container`/`text-on-primary-container`, making all 3 declared color options actually distinct (**this changes the default appearance**, since `color` defaults to `'primary'`)
- `MSplitButton`: `lg`/`xl` container height was stuck at the same undersized `64px`/`80px` `MButton` had before its own expressive-tier fix (real `SplitButtonLargeTokens`/`XLargeTokens.ContainerHeight` = `96dp`/`136dp`) — carries the identical correction, plus the outer pill radius scaling with it. Icon sizes (main + trailing arrow) were off across all 5 tiers, not just `lg`/`xl`. Horizontal padding was short on `md`/`lg`/`xl` in the same proportion as the height bug. Resting inner-corner radius (where the two buttons meet) corrected on `sm`/`md`/`lg`/`xl`. Disabled state now splits content (`on-surface` 38%) from container (`on-surface`/`outline-variant` 10%) opacity instead of a blanket 38% on everything
- `MButtonGroup`: real M3 `ButtonGroup` only defines one size tier (`Small`, `40dp`) — there is no official `Medium`/`Large`/`XLarge`/`XSmall`, unlike `Button`/`SplitButton`. On the spec-verified `sm` tier: standard variant's gap between buttons was `6px` against `ButtonGroupSmallTokens.BetweenSpace = 12dp`; connected variant's resting inner-corner radius was a hardcoded `6px` against `ConnectedButtonGroupSmallTokens.InnerCornerCornerSize = CornerValueSmall` (`8dp`)
- `MBottomSheet`: corners were `rounded-t-xl` (12px) against `SheetBottomTokens.DockedContainerShape = CornerExtraLargeTop` (28dp); elevation was `shadow-elevation-3` against `DockedModalContainerElevation = Level1`; there was no `640dp` max-width cap (`BottomSheetDefaults.SheetMaxWidth`) at all, so the sheet always spanned the full viewport width even on wide/desktop screens; the drag handle was tinted `on-surface-variant` at 40% opacity against the real full-opacity `DockedDragHandleColor`; the handle's touch-target row was `36px` against the real `48dp` (`DragHandleVerticalPadding` 22dp top+bottom around the 4dp handle)
- Library-wide: the scrim overlay used by 16 components (`MDialog`, `MNavigationDrawer`, `MNavigationRail`, `MSideSheet`, `MSelect`/`MMultiSelect`, `MAutocomplete`/`MMultiAutocomplete`, `MDatePickerModal`/`MDateRangePickerModal`/`MTimePickerModal`/`MColorPickerModal`, `MFab`, `MCommandPalette`, `MTour`, `MBottomSheet`) was `bg-scrim/40`; real `ScrimTokens.ContainerOpacity = 0.32f`, now `bg-scrim/32` everywhere. `MOverlay`/`MSpotlightSearch` use a distinct `bg-scrim/50` not covered by this token, left as-is
- `MToolbar`: never enforced the real `64dp` container thickness (`FloatingToolbarTokens`/`DockedToolbarTokens.ContainerHeight`) on either variant, sizing purely off content + padding; floating variant's shape was `rounded-2xl` (16px) against `ContainerShape = CornerFull` (a true pill); floating variant always had a `shadow-elevation-2`, but the real default elevation is `0` (`ContainerExpandedElevation = Level0`) — only bumping to `Level1` when a FAB is attached; leading/trailing padding didn't differ by variant (both `12px`) against the real `8dp` (floating) vs `16dp` (docked)
- `MDialog`'s title was pushed off-center when both the `#icon` slot and the close button were showing (the default `closable`): centering (`text-center`) combined with a right-only `pr-10` (reserved to clear the close button) shifts the visual center left of the dialog's actual midpoint. Now uses symmetric `px-10` in that combination, keeping the title truly centered under the icon

### Added
- `MTabs` gained a `scrollable` prop (default `false`) matching M3's two separate `TabRow` composables: `false` (new default) evenly distributes tabs across the available width with no scrolling (M3's *Fixed* `TabRow`, meant for 2-5 tabs); `true` restores the previous natural-width + horizontal-scroll-on-overflow behavior (M3's *Scrollable* `TabRow`). **This changes the default visual behavior** for any existing usage with more tabs than comfortably fit — pass `scrollable` to keep the old look
- `MMenu`/`MContextMenu` now support keyboard navigation: opening a menu focuses its first item automatically, and ArrowUp/ArrowDown move focus between items (wrapping at both ends) — previously only Escape-to-close was handled
- `MNavigationRail` gained an `expanded` prop, mirroring M3's `WideNavigationRail`: items switch from a narrow centered icon-only pill (`NavigationItemIconPosition.Top`) to a full-width pill with the icon and a `text-label-large` label side by side (`NavigationItemIconPosition.Start`), and the rail itself widens from 80px to 220px (`NavigationRailCollapsedTokens.NarrowContainerWidth`/`NavigationRailExpandedTokens.ContainerWidthMinimum`). Every item row keeps a constant 64dp height in both states (`NavigationRailBaselineItemTokens.ContainerHeight`) so toggling never reflows sibling items, and the icon's horizontal position never moves — only the pill grows around it. The label reveals through a `overflow-hidden` box whose width (and opacity) animates left-to-right from the icon's edge, rather than a plain fade or the real component's hard position-snap-at-alpha-zero (verified against `NavigationItem.kt`'s `placeAnimatedLabelAndIcon` — the literal Compose behavior doesn't slide/reveal the label at all, this is a deliberate simplification for the CSS-transition-based approach used here). Does **not** implement the real `WideNavigationRail`'s draggable resize handle (220-360dp) — scoped down to match the simpler boolean-toggle pattern `MNavigationDrawer.collapsed` already uses. Expanded pill width was initially implemented as `w-full` (stretched to the rail's own width); fixed to hug its content instead (`ActiveIndicatorLeadingSpace`/`TrailingSpace` = 16dp each) like the real `WideNavigationRailItem`, leaving empty space in the rail after a short label rather than a full-bleed bar
- `MNavigationRail` gained a `modal` prop mirroring M3's `ModalWideNavigationRail` (default `hideOnCollapse = false` behavior): the collapsed rail stays on screen and never reflows the app's layout, while `expanded` instead opens a Teleported, scrim-backed panel flush against the screen edge (`ModalContainerColor` = surface-container, `ModalContainerElevation` = Level2), closable via the scrim, Escape, or picking an item, and emitting `update:expanded`. The panel's open/close is a real width spring (rAF, semi-implicit Euler) using `MotionSchemeKeyTokens.FastSpatial` (dampingRatio 0.9, stiffness 1400 — the literal token `WideNavigationRailLayout` uses for the modal variant), producing the spec's slight overshoot/bounce on open; items animate through the same collapsed → expanded transition as the non-modal rail rather than mounting pre-expanded
- `MDialog` gained an `#icon` slot mirroring `AlertDialog`'s optional `icon` param (`IconColor = Secondary`, expects 24dp content, `IconPadding` bottom `16dp`) — its presence also centers the title, per spec ("Align the title to the center when an icon is present"). Also gained a `closable` prop (default `true`) to opt out of the header close ("X") button, which isn't actually part of the `AlertDialog` spec (the spec expects only Cancel/Confirm text buttons in the actions row) — kept as a library addition but now toggleable. The actions row now wraps (`flex-wrap`) instead of overflowing when button labels are too long to fit on one line, approximating `AlertDialogFlowRow`. `MConfirmDialog` (which wraps `MDialog`) got the same `closable` prop, passed straight through
- `MCard` gained a `disabled` prop, matching M3's per-variant disabled container tokens: `elevated` swaps to a plain `surface` background, `filled` to `surface-variant`, both at 38% container opacity (applied via a `/38` color-opacity modifier on the background color itself, not a blanket `opacity-*` on the whole element — Compose's real disabled Card only dims the container, not its content/text); `outlined` instead keeps its background and only dims its border, to `outline` at 12% (not the resting `outline-variant`, and a much lighter fade than the other two variants' 38%). `clickable` cards also gained real keyboard accessibility they never had before — `role="button"`, `tabindex`, and Enter/Space triggering the same click a mouse would (there was previously no way to reach or activate a clickable card without a mouse) — plus a `focus-visible` indicator (a `secondary` ring for elevated/filled, matching `FocusIndicatorColor`; the border itself darkening to `on-surface` for outlined, matching `FocusOutlineColor`, rather than a separate ring on top of the border it already has). `disabled` combined with `clickable` blocks all of this (mouse via `pointer-events-none`, keyboard via removing `tabindex` and no-op'ing the Enter/Space handler)
- `MCheckbox` gained real hover/press/focus feedback it never had before: a circular state-layer overlay (8%/12%, tinted with the checkbox's own indicator color) using `group-hover`/`group-active` off the `<label>` so hovering the row's text also triggers it, not just the 18px glyph; a `focus-visible` ring (`secondary`, matching `CheckboxTokens.FocusIndicatorColor`) via a `peer`-based input; and the unselected border now darkens from `on-surface-variant` to `on-surface` on hover/press, matching `Unselected{Hover,Pressed}OutlineColor` (previously a fixed color at every state)
- `MChip`'s `clickable` chips gained a `focus-visible` ring (`secondary`, matching `ChipsTokens.FocusedIndicatorColor`) and a real hover/press state layer (the `before:`-overlay technique used elsewhere in the library, now including a proper `active`/press state which didn't exist before) — the previous hover feedback was a direct `hover:bg-on-surface/8` that would have replaced, not overlaid on top of, a filled/selected chip's own background color
- `MRadio` gained the same kind of hover/press/focus-visible state-layer feedback as `MCheckbox`, tracking `RadioButtonTokens`' real per-state icon colors (`Unselected{Hover,Focus,Pressed}IconColor`) — but *without* a focus ring, since real `RadioButtonTokens` has no `FocusIndicatorColor` at all, unlike `MCheckbox`/`MChip`
- `MSwitch` gained a `focus-visible` ring (`secondary`, matching `SwitchTokens.FocusIndicatorColor`) and a `StateLayerSize` 40dp state-layer circle that — unlike `MCheckbox`/`MRadio`'s static one — tracks the thumb's own animated position, since the switch's interactive point moves; the handle now also grows to `28dp` while pressed (`Pressed{Handle}Width/Height`), via the same `scale()` technique already used for the 16dp unselected size, driven by real pointerdown/up tracking since the transform is JS-computed and CSS `active:` can't reach into it. The handle and track now also recolor correctly on hover/focus/press per `Unselected{Hover,Focus,Pressed}HandleColor`/`Selected{Hover,Focus,Pressed}HandleColor`
- `MSwitch` gained an `icon` prop (default `true`, preserving this component's existing look) for M3's second official Switch variant — Compose's `Switch` composable actually defaults to *no* icon at all (`thumbContent = null`); the checkmark-in-thumb look is the opt-in variant, not the baseline. Pass `icon="false"` for the plain variant
- `MListItem` gained an `overline` prop + `#overline` slot, the real M3 list item's third text region (above the headline, `LabelSmall`/`OnSurfaceVariant`) that was previously missing entirely — folded into the existing line-count auto-detection (`overline` alone counts as 2-line, `overline`+`subtitle` as 3-line, matching the real "two-line has either supporting OR overline" rule)
- `MFab` gained a `medium` size tier (`size="medium"`, 80dp container / 28dp icon / 20dp corner radius), the newer expressive M3 FAB size that sits between `regular`(56dp) and `large`(96dp) — the library previously only had 3 of the real 4 size tiers
- `MDialog` gained the optional divider from M3's official dialog anatomy (there's no reference implementation in Compose's `AlertDialog.kt` to port — this is a spec element with no built-in Material3 behavior to copy): shown automatically above the actions row only while the content has more to scroll to, hidden once scrolled to the bottom. No new prop
- `MDialog` gained a `maxHeight` prop mirroring the existing `maxWidth` (default `max-h-[90vh]`, matching the value that was previously hardcoded) — `AlertDialogDefaults` has no max-height token at all, so there's no spec value being matched here, just a configurable version of the library's own existing cap
- `MTopAppBar`: edge padding was `16px` against `TopAppBarHorizontalPadding = 4dp`; medium/large title bottom padding was a flat `12px` for both against the real (and different per tier) `MediumTitleBottomPadding = 24dp`/`LargeTitleBottomPadding = 28dp`; the `elevated` prop only added a shadow, but real `AppBarTokens` swap container color *and* elevation together when scrolled (`Surface`→`SurfaceContainer` + `Level0`→`Level2`); the navigation icon inherited `MIconButton`'s default `on-surface-variant` tone, but real `LeadingIconColor = OnSurface` is a different, more prominent role than the trailing/action icons' `OnSurfaceVariant`
- `MSelect`/`MAutocomplete`: the selected option (in both the dropdown and the mobile fullscreen modal) used a translucent `bg-primary/8`/`text-primary` wash; real `MenuTokens.ListItemSelectedContainerColor`/`ListItemSelectedLabelTextColor` are a solid `SecondaryContainer`/`OnSecondaryContainer` fill, matching the same selected-state treatment `MListItem` now uses
- `MDatePicker`/`MDateRangePicker` (dropdown): panel was `320px`/`8px`-radius/`surface-container` against real `DatePickerModalTokens.ContainerWidth=360dp`/`ContainerShape=CornerExtraLarge`(28dp)/`ContainerColor=SurfaceContainerHigh` — their Modal siblings already had these right. Day cells were `36px` against `DateContainerHeight=40dp`. Weekday header (`WeekdaysLabelTextFont`/`Color`=`BodyLarge`/`OnSurface`) was wrong in all 4 picker files (dropdown + Modal, both Date and DateRange), and `MDatePickerModal`'s header supporting text/big date headline were off in typography (and, for the headline, color too — real `HeaderHeadlineColor=OnSurfaceVariant`)
- `MTimePickerModal`: time-selector digit boxes were `72px` against real `TimeSelectorContainerHeight=80dp` with `DisplayMedium` typography against `DisplayLarge`; box/period-selector radius was `16px` against `CornerSmall`(8dp); the AM/PM period selector was `label-large` against `TitleMedium`; clock-dial number labels were `body-medium` against `BodyLarge`; the drag handle's end circle was `40px` against `ClockDialSelectorHandleContainerSize=48dp`. `MTimePicker` (dropdown)'s outer shell had the same color/shape bug as the DatePicker dropdown siblings, fixed to `SurfaceContainerHigh`/`CornerExtraLarge`
- `MFab`: elevation was wrong at every interaction state — resting `shadow-elevation-1` against real `ContainerElevation=Level3`, hover `shadow-elevation-2` against `HoveredContainerElevation=Level4` (required adding a new `--shadow-elevation-4` token to `theme.css`, the project's elevation scale previously stopped at Level3), and pressed dropped *below* resting instead of staying at `PressedContainerElevation=Level3`. `size="small"`'s icon was `20px` against real `24dp` and its shape was `16px` against `CornerMedium`(12dp); `size="large"`'s icon was `36px` against real `32dp`. The `items` speed-dial's mini-FAB buttons had the same elevation bug, fixed identically
- `MFabMenu`'s item rows had the same resting-elevation bug MFab had: `shadow-elevation-1` against real `FabMenuBaselineTokens.ListItemContainerElevation=Level3`
- `MLoadingIndicator`: the bare (non-contained) shape filled its whole container with no inset, against real `ActiveSize=38dp` vs `ContainerHeight/Width=48dp`; the `contained` variant kept the bare `ActiveIndicatorColor` tone instead of switching to `ContainedActiveColor` (`OnXContainer`, a different role meant to read against the colored circle behind it)

## [0.7.1] - 2026-09-18

### Added
- New `--color-scrim` design token in `theme.css`. M3 defines `scrim` as a role distinct from `shadow`, even though both resolve to black in the baseline scheme — previously only `shadow` was exposed. 17 components that render a backdrop now use `bg-scrim` instead of a hardcoded `bg-black/40`/`bg-black/50`: `MDialog`, `MBottomSheet`, `MSideSheet`, `MNavigationDrawer`, `MOverlay`, `MFab`, `MTour`, `MCommandPalette`, `MSpotlightSearch`, `MColorPickerModal`, `MDatePickerModal`, `MDateRangePickerModal`, `MTimePickerModal`, `MSelect`, `MAutocomplete`, `MMultiSelect`, `MMultiAutocomplete`. `MLightbox`'s black backgrounds were left untouched — they're the viewer's own persistent chrome (fullscreen backdrop, control pills), not a scrim over other page content
- `MCheckbox`/`MSwitch` gained a `color` prop (`'primary' | 'secondary' | 'tertiary' | 'error'`, default `'primary'`), matching the prop `MRadio` already had — the checked/on-state fill, border, and check icon now follow it instead of being hardcoded to primary

### Fixed
- `MCheckbox`, `MRadio`, `MSwitch` now have an invisible 48×48px hit area centered on their visual control (18px/20px/32px respectively, via negative-margin wrappers), matching M3's minimum touch target. Previously the visible control itself was the only clickable/hoverable area, well under the minimum
- Disabled state on `MButton`, `MIconButton`, `MChip`, `MCheckbox` no longer applies a single blanket `opacity-[0.38]` to the whole element, which just rendered each variant's own color as translucent (a disabled filled-primary button still read as visibly blue). Now matches M3's actual token split: content (label/icon) at on-surface 38% opacity, container (background for filled/tonal/elevated, border for outlined) at on-surface 12%
- `MCard`'s `clickable` state now shows an M3 state-layer overlay (8% hover / 12% pressed, over `on-surface`) in addition to the elevation change it already had, matching the pattern already used by `MButton`/`MIconButton`/`MFab`/`MListItem`/`MChip`
- `MFab`'s extended (icon+label) layout used symmetric 16px padding on both sides; now matches the real `ExtendedFloatingActionButton` composable exactly — 16dp leading / 12dp icon-to-label gap (already correct) / 20dp trailing — plus the missing 80dp minimum width (`ExtendedFabMinimumWidth`)
- `MSlider`'s inactive track and stop-indicator color no longer derives from the active/`color` prop's own container tone (e.g. `color="tertiary"` tinting the unfilled track tertiary-container). M3's `SliderTokens` fix `InactiveTrackColor`/`StopIndicatorColor` to `secondary-container` regardless of the active color
- `MSlider`'s disabled state is no longer a single blanket opacity — active track/handle at on-surface 38%, inactive track at on-surface 12%, matching `SliderTokens.DisabledActiveTrackOpacity`/`DisabledInactiveTrackOpacity`
- `MSlider` had no visible focus indicator at all when tabbed to via keyboard (`outline-none` with nothing in its place). It now narrows the handle to 2dp on focus — the same treatment it already had for an active pointer drag, matching `SliderTokens.FocusHandleWidth`/`PressedHandleWidth` — plus a visible ring around the handle for keyboard navigation
- `MSlider`'s default (`xs`) size corrected against `SliderTokens`/`Slider.kt`: handle height 32px → 44dp (`HandleHeight`), the pressed/focused narrow ratio ×0.6 → the exact ×0.5 (`PressedHandleWidth`/`FocusHandleWidth` = 2dp), thumb-to-track gap 7px → 6dp (`ActiveHandleLeadingSpace`). The touch-target height (`hitArea`) was bumped from 38 to 46px as a consequence, so the now-taller handle stays contained instead of overflowing it

## [0.7.0] - 2026-09-17

### Fixed
- `MTabs` `primary`/`secondary` indicator animation ported from `androidx.compose.material3.TabRow`'s `TabIndicatorOffsetNode`: the offset and width are now two independent spring simulations (dampingRatio 0.9, stiffness 700, M3's `DefaultSpatial` motion token) driven by a real per-frame rAF physics step, not a hand-choreographed CSS "expand-to-union-box, hold 150ms, then snap" — the natural "stretch" look comes from the two springs covering different distances under identical physics, not from manual bounding-box math, and switching tabs again mid-animation now carries velocity over smoothly instead of restarting
- `MTabs`' separate `tabs`-prop watcher (for reacting to the tab list itself changing) was re-snapping the indicator with no animation on every change, including a plain reference swap with identical content — which raced with, and could silently cancel, an in-flight `modelValue`-triggered animation (most visibly if a consumer passes an inline `:tabs="[...]"` array literal, recreated on every unrelated re-render). It now animates too, which is a no-op when the target hasn't actually moved

### Added
- New component: `MLoadingIndicator` — M3 Expressive loading indicator that continuously morphs through a cycle of rounded shapes (soft burst, cookie, pentagon, pill, sunny, cookie, oval) while rotating. Timing/physics mirror `androidx.compose.material3.LoadingIndicator`: an underdamped spring (dampingRatio 0.6, stiffness 200, ~650ms per shape) drives both the morph and a synced +90° rotation swing on top of a slow constant spin, so the turn visually carries the shape change instead of the two reading as separate animations
- `MLoadingIndicator` `contained` prop wraps the active shape in a filled container circle (M3's "contained" variant)
- `MLoadingIndicator` `size` (default `48`) and `color` (`'primary' | 'secondary' | 'tertiary' | 'error'`, default `'primary'`) props, matching the conventions of `MProgressBar`/`MCircleProgressBar`
- New component (beta): `MPullToRefresh` — wraps its own scrollable container and lets the user drag down from the top (mouse or touch, via Pointer Events) past a `threshold` to trigger a refresh; shows an `MLoadingIndicator` (contained variant) that scales/fades in with the pull and settles in place, inside the container with a gap from its edge, while `refreshing` is true. Controlled the same way as `MInfiniteScroll`'s `loading`/`load`: a `refreshing` prop the caller flips on in its `@refresh` handler and back off once the fetch resolves. Mainly relevant for a scroll container that isn't the page/window itself (the browser's native pull-to-refresh never fires inside a nested `overflow-y: auto` element) or for app shells (Capacitor/Electron/installed PWAs) where the OS/browser gesture may not fire at all. **Beta**: reliable on desktop and in Capacitor/Electron-style shells; in an actual mobile browser tab the touch drag can occasionally lose the race against the browser's own scroll/overscroll gesture recognition and release early — a known hard problem with drag-based pull-to-refresh on the open mobile web
- New component: `MFabMenu` — the M3 "FAB Menu": a thin wrapper around `MFab`'s `#content` slot rather than a separate implementation, so opening/closing, the trigger icon's 45° morph, outside-click/scroll-away closing, and `persistent` are all inherited from `MFab` for free. Renders each `items` entry as a full icon+label pill (distinct from `MFab`'s existing `items`-driven speed dial, which uses small circular buttons). The reveal animation is ported from `androidx.compose.material3.FloatingActionButtonMenuItem`: each row wipes in via `clip-path` from the FAB's side (approximating its width-growth spring, dampingRatio 0.6/stiffness 800) while fading in faster and without bounce (approximating its dampingRatio 1.0/stiffness 3800 alpha spring), staggered starting from the item closest to the FAB. Rows are rendered through a `<TransitionGroup>` so closing also animates (a simultaneous fade for all rows, rather than a reverse stagger) instead of just vanishing
- `MFabMenu` `color` prop applies the same role/container pairing to every item row (`bg-{color}-container text-on-{color}-container`, matching `androidx.compose.material3.FloatingActionButtonMenuItem`'s default `primaryContainer` tone) in addition to the trigger FAB, instead of a fixed neutral surface color; a `FabMenuItem`'s own `color` overrides the menu's for just that row (e.g. calling out a destructive action)
- `MFabMenu` `label` prop shows the trigger as an extended FAB (icon + text) instead of icon-only, same as `MFab`'s own `label`
- `MFabMenu` `itemSize` prop (`'small' | 'regular' | 'large'`, default `'large'`) scales the menu item rows' padding/icon/text — independent from the trigger FAB's own `size`, so e.g. a small trigger can open into larger, easier-to-tap rows. Defaults to `'large'` to match the real `FabMenuBaselineTokens`: 56dp row height, 24dp icon, `titleMedium` text
- `MFabMenu` `scrim` prop (default `true`) dims the rest of the screen while open; set to `false` for a lighter inline reveal with no dimming
- `MFab` gained an `align` prop (`'start' | 'end'`, default `'start'`) for its `up`/`down` `#content` panel positioning — `'end'` anchors the panel's right edge to the FAB's right edge instead of the left edges, which keeps a panel wider than the FAB (like `MFabMenu`'s item list) from running off-screen when the FAB sits in a bottom-right corner, a common placement
- `MFab` gained a `scrim` prop (default `false`) — renders as a plain sibling of the `#content` panel with its own independent opacity fade, not nested inside the panel's own enter/leave transition (which would otherwise visually shrink/lag it along with the panel's transform). `MFabMenu` uses this internally instead of rendering its own scrim
- `MFab` gained a `contentTransition` prop (`'scale' | 'fade' | 'none'`, default `'scale'`, matching prior behavior) controlling how the `#content` panel itself animates open/closed — `'fade'` drops the scale for content that already animates its own entrance (like `MFabMenu`'s rows), while still giving Vue a real transition duration to wait on before removing the panel from the DOM, so the content's own close animation has time to play instead of being cut off. `MFabMenu` uses `'fade'`
- New component: `MSearchBar` — the M3 search bar. Collapses to a 56dp pill (matching `SearchBarTokens`); expanding grows it into either a `'docked'` panel anchored below the bar (28dp corners, matching `SearchViewTokens.DockedContainerShape`, click-outside/scroll-away/Escape to collapse — same Teleport + positioning convention as `MAutocomplete`'s dropdown) or a `'fullscreen'` overlay with a 72dp header and a back button (matching `SearchViewTokens.FullScreenContainerShape`/`FullScreenHeaderContainerHeight`). It's a plain standalone component with no special host awareness needed — drop it in `MTopAppBar`'s `#title` slot for the common "search bar embedded in the app bar" layout
- `MSearchBar` `modelValue` (v-model), `expanded` (v-model:expanded, also works uncontrolled), `variant`, `leadingIcon`, `loading`, `clearable`, `disabled` props; `#leading`/`#trailing` slots and a default slot for results/suggestions content; emits `search` on Enter
- `MSearchBar` `iconPosition` (`'start' | 'end'`, default `'start'`) moves the leading icon to the end of the collapsed bar — the expanded panel's back button always stays at the start regardless, matching the near-universal "go back" convention
- `MSearchBar` `textAlign` (`'start' | 'center'`, default `'start'`) centers the input/placeholder text (an iOS-style look) instead of the M3-standard start alignment

### Fixed
- `MTopAppBar`'s navigation icon button had a hardcoded Spanish aria-label (`"Navegación"`) regardless of the active locale — now uses a new `menu` locale key (translated across all seven shipped locales), overridable via a new `navigationLabel` prop for when `navigationIcon` is a back arrow rather than a drawer toggle
- `MTopAppBar` `medium`/`large` variants now use the exact M3 container heights (112dp/152dp total, i.e. 48px/88px added below the 64px top row) instead of an approximation that came out a bit short

## [0.6.4] - 2026-09-16

### Fixed
- `MSlider` `centered` and `range` variants: fill edges next to a real draggable thumb now anchor to that thumb's clamped (thumbInset-aware) position instead of the raw value percentage — previously, near 0%/100%, the fill could creep past a thumb pinned by `thumbInset` and swallow the gap that's supposed to stay visible there. `standard` already had this fix (`fillActiveSize`/`fillInactiveSize`); `centered`/`range` were still using raw `pctLo`/`pctHi`/`centerPct`
- `MSlider` `centered` and `range` variants' fill segment corners now match `standard`'s official M3 track-segment shape: the end touching the real track edge stays a rounded cap, the end facing a thumb/gap goes square. A segment flanked by a thumb-gap on *both* sides (range's middle segment between the two thumbs; centered's active segment, which never touches a real track end) is now square on every corner instead of using a uniform full-pill radius
- `MSlider` outer fill-corner radius (the track-end cap, all variants) nudged slightly rounder/softer than the plain shape-scale token

## [0.6.3] - 2026-09-15

### Fixed
- `MWindow`'s internal bring-to-front z-index counter is now module-scoped and truly shared across every instance — previously each window kept its own independent counter (despite a comment claiming otherwise), so with 3+ windows open, clicking one to bring it to the front could tie with another window's z-index and fail to actually come to the top
- `MWindow`'s z-index range now starts at `10` instead of `100`, keeping it below the app-level overlay scale (`MDialog` and every `*Modal` picker, `MSelect`/`MAutocomplete`/`MMultiSelect`/`MMultiAutocomplete`, `MSpotlightSearch`, `MCommandPalette` all use `z-50`) — windows no longer render on top of a real modal/spotlight/command palette
- `MTerminal`: the last line of the initial `lines` prop (and of any later update to it) is now written without a trailing newline, so the cursor sits right after that line's content instead of dropping to an empty line below it — matters for building an interactive shell-style demo where the last line is a prompt

## [0.6.2] - 2026-09-14

### Added
- New component: `MPageProgress` — thin top loading bar for page/route transitions (YouTube/NProgress style), fixed to the top of the viewport with a trickle-then-complete animation
- `MPageProgress` auto-detects vue-router (via `$router` on the current app instance, without adding `vue-router` as a dependency) and wires itself to `beforeEach`/`afterEach`/`onError` automatically — drop it once in your app layout and it just works if a router is present
- New composable `usePageProgress()` — shared, module-level `progress`/`isActive` state with `start()`, `set(pct)`, and `done()`, the same API `MPageProgress` uses internally, so it can also be driven by hand (a manual fetch, an app without vue-router, or on top of the router auto-wiring) instead of or alongside route navigation
- `MPageProgress` `auto` prop (default `true`) — set to `false` to disable the vue-router auto-wiring and drive it entirely through `usePageProgress()`
- `MPageProgress` `position` prop (`'top' | 'bottom'`, default `'top'`) — pins the bar to either edge of the viewport
- New component: `MBar` — a draggable Electron title bar (`-webkit-app-region: drag`, with `no-drag` carved out around interactive areas), for frameless (`frame: false`) Electron windows. `icon`/`title` (or `#icon`/`#title` slots), `titleAlign` (`'start' | 'center'`), and `#trailing`/default slots for extra content before the window controls
- `MBar` `platform` prop (`'windows' | 'macos'`, default `'windows'`) — on `'macos'` it reserves space for the OS's native traffic lights and hides the drawn controls by default (still overridable via `controls`)
- `MBar` `icon` accepts an image src (URL, data URI, or a path with a file extension) as well as a Material Symbol name — auto-detected, so an app logo works without a separate prop
- `MBar` draws minimize/maximize/close buttons matching native title bar conventions (full-height, close turns error-red on hover) and emits `minimize`/`maximize`/`close` events — it has no way to actually control the OS window itself, the host app wires these to its Electron main-process IPC; a `maximized` prop (driven by that same IPC state) swaps the maximize icon for restore. `minimizable`/`maximizable`/`closable` toggle each button independently; double-clicking empty drag space emits `maximize` by default (`doubleClickMaximize` to disable)
- `MSlider`: corner "stop" dots (start/end) now truly hide once the fill has passed them instead of just swapping tint; `standard` variant no longer shows a start indicator at all (matches the official M3 slider — only the far/unreached end is ever marked)
- `MSlider` thumb now keeps a real, constant margin from the track ends — it never touches the very edge, and the fill keeps a matching gap around it even at 0%/100% (previously the gap could visually disappear at the extremes)
- `MSlider` `standard` variant's fill pill corners: the outer end (away from the thumb) stays fully rounded, the end facing the thumb goes square, matching the official M3 slider's track segments
- `MSlider` gained `fillColor`/`thumbColor` props — custom CSS colors (hex, `rgb()`, a var…) for the filled track/dot and the thumb respectively, independent from `color` and not limited to the four M3 roles; the unfilled shade for a custom `fillColor` is derived automatically via `color-mix()`
- `MSlider` gained a `thumbIcon` prop to replace the draggable bar thumb with a Material Symbol icon (own size, grows slightly on press instead of pinching thin)
- `MSlider`'s corner `icon` prop now sits at its own edge inset (scaled to the thumb, not the tiny plain-dot inset) and is naturally covered by the thumb when it's on top of it, instead of a fragile percentage-based hide threshold
- `MSlider` `stops` variant: the dot for the step currently under the thumb now hides (checked against both thumbs in `range`)

---

## [0.6.1] - 2026-09-13

### Added
- New component: `MLightbox` — Material 3 fullscreen image lightbox with prev/next arrow navigation, keyboard arrow-key navigation, and swipe/drag-to-navigate via Pointer Events (mouse and touch)
- `MLightbox` auto-detects `<img>` elements rendered in its default slot (opt an image out with `data-lightbox="false"`) and wires click-to-open automatically, so wrapping arbitrary content — including `MMarkdown` output — makes every image in it clickable without building an `items` array by hand; pass an explicit `items` array instead for full programmatic control (`modelValue`/`index` v-models, `open()`/`close()`/`next()`/`prev()` exposed via template ref)
- `MLightbox` opens with a Discord-style animation: when opened from a detected/clicked thumbnail, the image visibly expands from that thumbnail's on-screen position and size to fullscreen; falls back to a plain scale-up when there's no originating element (e.g. opened programmatically without a source click)
- `MLightbox` `showThumbnails` prop (default `false`) shows a row of clickable thumbnails at the bottom for jumping directly to an image
- `MLightbox` `rounded` prop (default `true`) rounds the corners of the main opened image
- `MLightbox` `loop` prop (default `true`) controls whether navigating past the first/last image wraps around
- `createM3UI` gained a `persistPalette` option (default `true`, matching prior behavior) — set to `false` to make `palette` a hard default that always wins on boot regardless of what's already stored in `localStorage`, and to stop later `useColorPalette().set()` calls from persisting either (they still apply live)
- `useColorPalette()` gained `setPersistPalette(enabled)` to toggle `localStorage` persistence at runtime, plus a `persistPalette` ref reflecting the current state

---

## [0.6.0] - 2026-09-09

### Added
- New component: `MPinInput` — OTP/PIN code input with one box per character, auto-advance on type, smart backspace, arrow-key navigation, and full-code paste support
- `MPinInput` `type` prop (`'numeric' | 'alphanumeric'`) and `masked` prop (password-style dots) for PIN vs. verification-code use cases
- `MPinInput` `groups` prop (segment sizes, e.g. `[2, 4, 2, 3, 1, 3]`) with a configurable `separator` for license/activation-key style layouts — `length` is derived as the sum of the groups
- `MPinInput` `complete` event, fired once with the full value as soon as every box is filled
- `material-symbols` listed as an optional peer dependency, and documented as a self-hosted/offline alternative to the Google Fonts CDN for Material Symbols Outlined (see README "Fonts" section)
- New component: `MCopyButton` — copy-to-clipboard icon button with temporary success feedback, `copied`/`error` events
- New component: `MPasswordMeter` — password strength meter (length + character variety heuristic), 5 levels with customizable labels, emits `score`
- New component: `MRelativeTime` — auto-updating "3 minutes ago" / "in 2 hours" text using the native `Intl.RelativeTimeFormat`, with an adaptive refresh cadence
- `M3Locale` gained a `lang` field (BCP-47 tag, e.g. `'es'`) set by every packaged locale — `MRelativeTime` reads it via `useLocale()` to auto-match the app's configured locale (from `createM3UI({ locale })`) without needing a `locale` prop on every instance; the prop still overrides it when set
- New component: `MQRCode` — QR code generator rendered as inline SVG, available from the `@m3ui-vue/m3ui-vue/qrcode` entry point with `qrcode-generator` as an optional peer dependency (follows the same dedicated-entry pattern as `MChart`/`MMarkdown`)
- `MQRCode` `rounded` prop (default `true`) rounds the outer container corners for a softer, more M3-like frame — independent of the scannable pattern itself
- `MQRCode` `moduleStyle` prop (`'square' | 'dots'`, default `'square'`): `'dots'` rounds each module's corners individually based on its neighbors, so connected runs (the finder-pattern squares especially) merge into smooth shapes instead of showing notches; both styles scan identically
- New component: `MExportButton` — exports an array of objects to CSV or JSON with one click (triggers a real browser download), `exported`/`error` events, no dependencies
- New component: `MSignaturePad` — canvas signature capture with pointer events, `clear()`/`undo()`/`isEmpty()`/`toDataURL()` exposed via template ref, `begin`/`end`/`change` events
- New component: `MKbd` — keyboard-shortcut hint chip; accepts a `'+'`-delimited string or an array of keys, with a customizable `separator`
- New component: `MBarcode` — barcode generator (Code128, EAN13, UPC, CODE39, and other symbologies) rendered as inline SVG, available from the `@m3ui-vue/m3ui-vue/barcode` entry point with `jsbarcode` as an optional peer dependency (same dedicated-entry pattern as `MChart`/`MQRCode`), with an `error` slot for values invalid in the given format

---

## [0.5.10] - 2026-09-09

### Changed
- Bumped `vue` devDependency to `^3.5.42` and `vue-tsc` to `^3.3.11` (latest stable)
- `typescript` devDependency stays pinned at `~6.0.3` — TypeScript 7 (the new native/Go-based compiler) drops the classic JS Compiler API (`typescript/lib/tsc`) that `vue-tsc` relies on for `.vue` type-checking, so `pnpm build:types` fails against it until Vue tooling catches up

---

## [0.5.9] - 2026-08-19

### Added
- New component: `MShader` — renders a Shadertoy-style GLSL fragment shader (`code` prop) on WebGL2, with an optional WGSL module (`wgsl` prop) rendered on WebGPU when available (`renderer: 'auto' | 'webgpu' | 'webgl'`)
- `MShader` custom `uniforms` prop alongside the built-in `iTime`, `iResolution`, `iMouse`, and `iFrame` uniforms
- `MShader` `paused` and `pixelRatio` props, `#loading` / `#fallback` / `#error` slots, and `ready` / `error` events

---

## [0.5.8] - 2026-07-30

### Fixed
- `MDataTable`: the `#row-actions` and `#row-expand` slots are now re-evaluated on every render instead of being cached in a `computed` — Vue doesn't make `slots` reactive, so adding or removing either slot dynamically (e.g. `v-if` around `#row-actions`) no longer left the actions/expand column stuck showing (or hiding) stale state until a full remount

---

## [0.5.7] - 2026-07-30

### Added
- `MTimePicker`: picking an hour now emits `update:modelValue` immediately using the currently selected minute, instead of waiting until a minute is also picked

### Fixed
- `createM3UI({ palette })` no longer overwrites a palette the user already chose via `useColorPalette().set()` on every app boot — `palette` is now applied only as the first-visit default

---

## [0.5.6] - 2026-07-21

### Changed
- `MDataTable` `minHeight` no longer defaults to `20rem` — tables use their natural, content-driven height unless a caller explicitly passes `minHeight` to opt into a reserved floor (e.g. a day-agenda table that's often near-empty and shouldn't look tiny while filtering)
- `MDataTable` skeleton row count falls back to `perPage` when `minHeight` isn't set, and only fills it dynamically when a caller opts in

### Fixed
- `MDataTable` empty state now reserves a 200px minimum height by default even without `minHeight`, so "no results" no longer renders as a squashed one-line sliver

---

## [0.5.5] - 2026-07-21

### Changed
- `MDataTable` skeleton row count while loading is now sized to fill `minHeight` (rows needed to reach it, capped at `perPage`) instead of always rendering `perPage` rows — avoids a visible height jump when a table with a `minHeight` floor (e.g. a mostly-empty day agenda) finishes loading
- `MDataTable` empty-state message ("no results") is now vertically centered within the reserved height instead of sitting flush at the top; `minHeight` is applied only to the table's wrapper, not the `<table>` itself, avoiding inconsistent header growth across browsers

---

## [0.5.4] - 2026-07-18

### Fixed
- `MNavigationDrawer` static section titles no longer get compressed when the drawer runs short on vertical space

---

## [0.5.3] - 2026-07-18

### Fixed
- `MNavigationDrawer` long content no longer overflows its scrollable sections — flex children now shrink correctly (`min-height: 0`) instead of forcing the drawer taller

---

## [0.5.2] - 2026-07-09

### Fixed
- `MJsonEditor` and `MJsonViewer`: UI strings (valid/invalid badge, format/minify buttons, element/field counts) now come from the locale system instead of being hardcoded in Spanish
- `MJsonEditor`: formatting or minifying no longer gets immediately overwritten by a stale `modelValue` resync — the editor now only resyncs from outside when the actual data changes, not just its formatting
- `MCodeEditor`: text selection is now visibly highlighted
- `MCircleProgressBar` wavy variant: wave crest now travels right-to-left along the ring, matching Material's motion spec (was reversed)

---

## [0.5.1] - 2026-07-01

### Fixed
- `MContextMenu` now closes when the page is scrolled instead of staying anchored to a stale position
- Toast and notification duplicate-count badge no longer gets clipped mid-animation when the item is dismissed, and now fades out in sync with the item instead of popping off abruptly
- `MColorPicker` and `MColorPickerModal`: dragging on the saturation/brightness area past its edge no longer triggers native text selection on the surrounding page

---

## [0.5.0] - 2026-06-30

### Added
- New component: `MMenuDivider` — horizontal divider for use inside `MMenu` and `MContextMenu`
- `shortcut` prop on `MMenuItem` — displays a keyboard shortcut label aligned to the right of the item
- `MContextMenu` fully rewritten to slot-based composition — uses `MMenuItem` and `#children` slots just like `MMenu`, replacing the old `items: ContextMenuItem[]` prop
- `MTreeTable` expand/collapse animation — height + opacity JS transition hooks matching `MTree` and `MExpansionPanel`
- `errorLabel` prop on all input components — separates the error message string from the boolean `error` state

### Changed
- `error` prop on all input components (`MTextField`, `MNumberField`, `MMaskField`, `MSelect`, `MAutocomplete`, `MMultiAutocomplete`, `MMultiSelect`, `MTagInput`, `MTimePicker`, `MDatePicker`, `MDateRangePicker`, `MColorPicker`) changed from `string` to `boolean`; use new `errorLabel` for the message
- `MAbsolute` now defaults to `top: 8px; left: 8px` when no position props are provided
- `MWindow` corner resize handles enlarged from 12 px to 20 px and edge handles from 5 px to 8 px for easier grabbing

### Fixed
- `MSlider` range variant: moving one thumb past the other and then clicking near the crossed position caused the wrong thumb to jump — now tracks array index instead of logical position
- `MCircleProgressBar` indeterminate: trailing end trembled/shook at minimum arc size — fixed by animating `stroke-dashoffset` alongside `stroke-dasharray` so both ends never converge

### Removed
- `ContextMenuItem` type export (replaced by slot-based API)

---

## [0.4.7] - 2026-06-30

### Added
- New component: `MCircleProgressBar` — animated ring progress with `wavy` (bumpy wave) and `circle` (smooth arc) variants
- `MCircleProgressBar` default slot — embed any content (icon, image, text) centered inside the ring; hides the percentage label automatically
- `MCircleProgressBar` indeterminate state — M3-style spinning arc with subtle grow/shrink breathing animation
- `thickness` prop for both `MCircleProgressBar` and `MProgressBar` to control stroke width (defaults: 3 for wavy/circle, 4 for linear)
- `MProgressBar` wavy variant — wave smoothly appears when progress crosses 10 % and fades out at 100 %, with margin that appears/disappears in sync
- Toast and notification deduplication — identical messages stack into a single item showing a count badge instead of flooding the UI
- `icon: null` option in `useToast` and `useNotification` to suppress the icon entirely

### Fixed
- `MColorPicker` and `MColorPickerModal`: drag-to-pick not working on mobile/touch (added `touch-action: none`)
- `MCircleProgressBar`: edge gap between wave and track now scales sub-linearly with `thickness` to stay proportional at large values
- `MProgressBar` wavy variant: inactive track bar was overlapping the wave due to a Vue reactive style / rAF conflict on `left`

---

## [0.4.6] - 2026-06-25

### Fixed
- Flex1 in drawer modal not filling available height

---

## [0.4.5] - 2026-06-25

### Fixed
- Drawer custom content slot (`#default`) not stretching to use all available space

---

## [0.4.4] - 2026-06-24

### Added
- `MNavigationDrawer` item click event (`@item-click`) support

---

## [0.4.3] - 2026-06-24

### Added
- Debounced prop for text inputs — `MTextField` and other text-based inputs now accept a `debounce` prop

---

## [0.4.2] - 2026-06-24

### Added
- Dynamic locale switching at runtime

### Fixed
- Slider lag/jank on mobile devices

---

## [0.4.1] - 2026-06-24

### Fixed
- Modal variant broken in `MAutocomplete` and `MMultiAutocomplete`

---

## [0.4.0] - 2026-06-23

### Added
- New component: `MSplitButton` — button with a primary action and a dropdown secondary action
- New component: `MButtonGroup` — groups related buttons into a cohesive unit
- New component: `MToolbar` — horizontal toolbar container
- Button size variants: `xs`, `sm`, `md`, `lg`, `xl` on `MButton` and `MSplitButton`
- Ripple effect in `MIconButton` with matching size variants
- Segmented style variant for list components
- Dialog fullscreen variant
- Carousel improvements (beta)
- Rich tooltip: arbitrary content inside `MTooltip`
- `useNotification` composable and `MNotification` component for persistent app notifications
- `useDevice` composable exposing device/viewport info
- FAB auto-close on scroll
- FAB custom expand content via `#expand` slot
- Docked input variant auto-closes on scroll
- Modal variant for `MDatePicker` and `MTimePicker`
- Modal variant for `MColorPicker`
- Modal variant for `MSelect`, `MAutocomplete`, `MMultiAutocomplete`, and `MMultiSelect`
- Improved toast system with richer API

### Fixed
- Slider centered variant gap
- Expansion panel open/close animation regression
- Tag input (`MTagInput`) on mobile

---

## [0.3.1] - 2026-06-22

### Added
- New component: `MChatBubble` — speech-bubble style message display

### Fixed
- `MWindow` clamp-to-content behavior
- Touch event handling in `MWindow`
- `MWindow` vertical resize delay

---

## [0.3.0] - 2026-06-21

### Added
- New component: `MWindow` — draggable and resizable floating window
- New component: `MMultiAutocomplete` — multi-value autocomplete input
- `MAutocomplete` and `MTagInput` general improvements
- `hideSelected` option in `MSelect` and `MMultiSelect` to hide already-selected options
- Expand chips inline in `MMultiSelect`
- Custom value data support in `MSelect` and `MMultiSelect`

### Fixed
- Icons alignment in input fields (outline and filled variants)
- `MTopAppBar` / AppBar height adjustment

---

## [0.2.7] - 2026-06-21

### Added
- `MNavigationDrawer` default slot for placing arbitrary custom content

---

## [0.2.6] - 2026-06-21

### Added
- New header/footer slots in `MNavigationDrawer`

---

## [0.2.5] - 2026-06-21

### Added
- Right drawer support in `MAppLayout`
- Drawer position variants: `left`, `right`, `top`, `bottom`
- `MFooter` layout component
- `x` / `y` offset props on `MAbsolute` and `MFixed`
- Navigation slot in `MTopAppBar`

---

## [0.2.4] - 2026-06-21

### Added
- Configurable `width` prop on `MNavigationDrawer`
- `MAvatar` image fallback (shows initials when image fails to load)

### Fixed
- `MAppLayout` drawer width not reflecting custom width prop

---

## [0.2.3] - 2026-06-21

### Fixed
- Invisible custom scrollbar in WebKit-based browsers (Safari, Chrome on iOS)

---

## [0.2.2] - 2026-06-21

### Fixed
- Incorrect locale entry keys
- Test files incorrectly included in `tsconfig` compilation

---

## [0.2.1] - 2026-06-20

### Added
- Unit test suite

---

## [0.2.0] - 2026-06-20

### Added
- **i18n** — full internationalization support with `createM3UI({ locale })` and `useLocale()`
- Preset locale bundles (EN, ES, FR, DE, PT, and more)
- 10 new color palettes
- New component: `MCarousel` — image/content carousel
- `MDataTable` server-side pagination and sorting support
- New input types and variants
- Children item dividers in `MNavigationDrawer` with smooth transition animation
- Improved collapsed-variant children rendering in `MNavigationDrawer`

### Fixed
- Icons and placeholder alignment in input fields
- Input outline icon vertical alignment

---

## [0.1.11] - 2026-06-19

### Fixed
- Excess padding in drawer modal header

---

## [0.1.10] - 2026-06-19

### Added
- New components: `MEmoji`, `MEmojiButton`, `MEmojiSelector`
- Improved `MBadge` styling and variants
- Improved `MMarkdown` renderer
- `MIconButton` label is now optional

### Fixed
- `MMarkdown` and `MRichTextEditor` rendering issues
- `MTour` overflow on mobile
- `MFab` click not firing on mobile

---

## [0.1.9] - 2026-06-19

### Added
- New display and layout components: `MText`, `MTitle`, `MSubtitle`, `MSection`, `MRelative`, `MSticky`, `MCenter`, `MBox`
- Improved absolute/fixed positioning components and list layouts
- New props in `MAppLayout` and `MFab`

---

## [0.1.8] - 2026-06-18

### Added
- Drawer full-close animation
- `MDataTable` row expand/collapse animation
- Improved label rendering

### Fixed
- Minor Vue prop-type warnings
- `MIconButton` no longer requires a visible label

---

## [0.1.7] - 2026-06-18

### Fixed
- Dropdown element size on expand

---

## [0.1.6] - 2026-06-18

### Added
- Improved `MCard` variants and surface styling

---

## [0.1.5] - 2026-06-18

### Added
- Router-aware navigation components with `to` prop support; various minor fixes

---

## [0.1.4] - 2026-06-18

### Fixed
- `MTour` z-index stacking issue

---

## [0.1.3] - 2026-06-18

### Fixed
- Context menu children positioning

---

## [0.1.2] - 2026-06-18

### Added
- Vue language syntax highlighting in `MCodeEditor`
- Copy-to-clipboard icon in `MCodeEditor`
- Code editor general improvements
- Tailwind CSS source file entry point

### Fixed
- CSS styles import ordering
- `MFab` expand overflow clipping
- `MSelect` placeholder spacing when an option is selected
- Tooltip auto-close on scroll

---

## [0.1.1] - 2026-06-18

### Fixed
- NPM publish workflow and CI pipeline setup

---

## [0.1.0] - 2026-06-18

### Added
- Initial release of `@m3ui-vue/m3ui-vue`
- 80+ components across: Buttons, Inputs, Data Display, Feedback, Navigation, Layout, Overlays, Tables, Utility, Editors, and Advanced
- Full TypeScript support with exported types
- Tailwind CSS v4 integration via `@tailwindcss/vite`
- Material Design 3 theming with 20 built-in color palettes
- Dark / light / system theme switching
- Composables: `useToast`, `useTheme`, `useColorPalette`, `useLocale`
