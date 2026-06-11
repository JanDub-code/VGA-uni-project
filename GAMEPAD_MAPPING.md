## Gamepad Mapping

Source of truth: current code in `src/services/gamepadService.js` and `src/services/gamepadNavService.js`.

Controller tested: 8BitDo Ultimate 2C in D-input mode on macOS.

## Known Axes

- `axes[0]`: left stick X, left -1 to right +1
- `axes[1]`: left stick Y, up -1 to down +1
- `axes[2]`: right stick X
- `axes[3]`: right trigger / RT axis, raw -1 to +1, converted to 0..1 as `forwardThrottle`
- `axes[4]`: left trigger / LT axis, raw -1 to +1, converted to 0..1 as `reverseThrottle`
- `axes[5]`: right stick Y
- `axes[9]`: D-pad hat switch

Notes:
- Hat neutral can report a value above the normal -1..+1 range on this controller.
- Code treats values above `hatNeutralThreshold = 2.0` as neutral.

## Code Layout

These labels are the current `DEFAULT_LAYOUT` in `gamepadService.js`.

- `B0` / `south`: confirm, primary action, fire
- `B1` / `east`: back, cancel
- `B2` / `west`: secondary face action
- `B3` / `north`: top face action
- `B4` / `lb`: fallback shoulder button
- `B5` / `rb`: fallback shoulder button
- `B6` / `lb`: primary left shoulder / drift in Glacies
- `B7` / `rb`: primary right shoulder / boost in Glacies
- `B8` / `select`: select
- `B9` / `start`: pause fallback
- `B10` / `l3`: left stick press
- `B11` / `r3`: pause fallback
- `B12`: pilot menu / system menu button on the tested controller

Current brake/interact shoulder group in code:

- `brakeButtons: [6, 7, 4, 5]`

This intentionally accepts both observed shoulder pairs/fallbacks. Keep this unless a physical controller test proves one pair should be removed.

Current pause group in code:

- `pauseButtons: [11, 9]`
- `systemMenuButtons: [12]`
- `pauseButtons: [11]` (no longer uses `B9`/Start for pause)

## Universal Rules

- Left stick: gameplay movement.
- D-pad: gameplay movement fallback and UI navigation.
- `B0`: confirm / primary action / fire.
- `B1`: back / cancel / close panel.
- Pause group `[12, 11, 9]`: pause or system menu.
- RT/LT are thrust only where the mission supports speed control.
- Anomaly does not use RT/LT speed control.

## UI Navigation

Handled by `gamepadNavService`.

- D-pad hat has priority.
- Left stick is fallback navigation.
- `B0`: click focused item.
- `B1`: back / pop current navigation layer.
- `linear: true` is used for simple vertical overlays such as game over and victory screens.

## Per-Scene Mapping

### Galaxy

- Left stick / D-pad: steer and vertical movement.
- RT: forward thrust.
- LT: reverse thrust.
- Shoulder group `[6, 7, 4, 5]`: brake.
- `B0`: confirm when UI panel is focused.
- `B1`: close mission/station panel.
- `B12`: pilot menu.

### Zephyr

- Left stick / D-pad: character movement and turning.
- RT: sprint.
- LT: unused.
- `B0`: primary action, melee or fire depending on weapon state.
- `B1`: back / close active UI through `gamepadNavService`.
- `B2`: toggle weapon.
- `B3`: jump.
- Shoulder group `[6, 7, 4, 5]`: activate nearest beacon / interact.
- Pause group: system menu.

### Ignis

- Left stick / D-pad: aim turret.
- `B0`: fire.
- RT/LT: unused for speed.
- Shoulder group: unused.
- Pause group: pause mission.

### Glacies

- Left stick / D-pad: steer ship.
- RT: forward thrust.
- LT: reverse thrust.
- `B6` / LB: drift hold.
- `B7` / RB: boost.
- Shoulder fallback group `[4, 5]`: extra shoulder support used for the existing brake/drift handling on alternate controller mappings.
- `B0`: fire.
- Pause group: pause/system menu behavior.

### Anomalie

- Left stick / D-pad: move ship in the boss/corridor plane.
- `B0`: fire.
- RT/LT: intentionally unused for speed.
- Shoulder group: currently unused.
- Pause group: pause mission.

## Runtime Config

Optional overrides:

- `window.gamepadConfig.gameplay`: `deadzone`, `fireMode`, `pauseButtons`, `systemMenuButtons`, `brakeButtons`
- `window.gamepadConfig.layout`: axis/button layout overrides used by `gamepadService`
- `window.gamepadConfig.nav`: UI navigation deadzone/repeat/confirm/back overrides

Default gameplay config:

- `deadzone = 0.18`
- `fireMode = 'button'`
- `fireThreshold = 0.1`
- `hatNeutralThreshold = 2.0`

## Debug

1. Open browser devtools console.
2. Set `gamepadService.debug = true`.
3. The service logs buttons as `[GP btns] B0:0.00 ...`.
4. The service logs axes as `[GP axes] A0:0.000 ...`.
5. Press each physical button and compare with this file.

## Verify Later

- Confirm the physical labels for `B2`, `B3`, `B4`, `B5`, `B6`, and `B7` on the exact classroom/test controller.
- If the physical shoulders are consistently only one pair, decide whether to keep or narrow `brakeButtons`.
- Keep `B12` as the visible player-facing pilot menu button; use `B9`/Start for sprint/run, and `B11` only as the fallback pause button where a mission has its own pause state.
