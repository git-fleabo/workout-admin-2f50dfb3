# Base Strength preview verification

## Scope

Volume/Intensity and Bullmastiff now have selectable review previews on `/programmes`, independent of loading saved database templates. They display the base-to-peak outline, each week's sessions, source page references, optional phase-specific estimated 1RMs, load rounding, and progression explanations. The first session opens automatically; the other sessions can be expanded.

This milestone is a preview. There is no assignment creation, activation, logging, database migration, automatic adjustment of an existing programme, or verified live publication in this change. The signed-in programme lifecycle is for the next milestone.

## Source and choices

Source: Alex Bromley, *Base Strength: Program Design Blueprint*, Kindle ASIN B08R5J58F8, pp. 83–85 and 93–97, read in the preceding catalogue review.

- Volume/Intensity has two base prescriptions and a peak prescription. Initial base waves can repeat two or three times. The preview defaults to two initial waves, one heavier base wave and three peak waves, with a 3% reference-max increase between repeats. The heavier-base repeat count and exact increase are clearly labelled as preview choices. The supported preview range is one to three heavier base waves and three to four peak waves; these bounds are app choices, not source restrictions. Longer repeats need a further max/recovery review instead of accumulating percentages indefinitely.
- Bullmastiff follows the nine-week base and nine-week peak tables. Weeks two and three of each wave have a performance-dependent main-lift load; the preview does not invent numerical weights for them.
- The Bullmastiff calculator adds 1% of estimated 1RM per extra final-set rep within the wave, then rounds. At the wave boundary it resets to the next starting percentage. Base-to-peak transitions require a separate reassessed max. Missing or inconsistent performance requests review.
- Main lifts and variations use separate max references. Phase estimates are separate and initially blank. RPE top sets remain effort-based; the preview does not convert RPE to an invented percentage.
- Source accessory exercises are displayed as editable starting choices. Volume/Intensity accessory targets are left open. Bullmastiff's source accessory table prints two waves; the preview marks third-wave base and peak accessory targets for personal review instead of inventing a complete table.
- Inputs are temporary component state. The illustrative 100 kg calculator example is not a workout log.

## Verification

- 13 pure-model tests: complete wave/phase structure, exposure mapping, configurable repeat counts, percentage bounds, distinct variation references, open accessory targets, percentage rounding, use of reference 1RM in the plus-set formula, missing/invalid/inconsistent inputs, holding a load, wave resets, phase-max reassessment and run completion.
- Four component tests: programme selection, phase-specific estimates, unresolved future loads, variation max separation, calculator interaction, clearing stale performance when selecting another week, and entering a peak max at the transition.
- TypeScript and focused lint checks passed.
- Production client/server build passed.
- Browser verification of the actual preview component in a local isolated review page: both programme selections, 100 kg to 55 kg Volume/Intensity loading, blank peak estimates after phase selection, RPE-guided peak prescriptions, and the Bullmastiff 70 kg / 11-rep example producing a 75 kg next load. Both the 1280 px background view and the 445 px visible app panel had no horizontal overflow; the visible panel was also inspected in a screenshot.

The isolated review page uses the real component and app styles, with no account data or Supabase calls. It verifies the component's presentation and controls; it is not evidence of the full signed-in route or live deployment. Temporary review files are in the ignored `base-strength-review.local/` folder.

## Next milestone

Personal setup should map source movement slots to the exercise library, resolve every open accessory target, confirm max references and schedules, and save a paused personal version for review. Activation should remain explicit. Native source progression needs persisted wave state and a reviewable proposal based on linked completed logs before it can be used in a running programme.

## Personal setup follow-up

Personal setup, paused saving and linked Bullmastiff progression are now implemented in the repository. See [personal programme verification](base-strength-personal-programmes-verification-2026-10-10.md) for final behaviour, safeguards and the pending live database update.
