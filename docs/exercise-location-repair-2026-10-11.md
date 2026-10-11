# Exercise location repair — 11 October 2026

Ring Dip required the same Gymnastic rings equipment record assigned to Home and The Font, but its imported personal exercise setting was Gym only. The logger attributed this rejection to missing equipment. The same default blocked 18 ring and 20 TRX movements at Home.

## Changes

- Applied `20261011140404_fix_suspension_exercise_location_scopes.sql` to the Train & Track database. It changes those 38 enabled Gym-only ring/TRX settings to Both only when an active Home location has every structured requirement. It targets Noam's active profile using existing catalogue relationships, without generated IDs.
- Preserved TRX Body Saw's older Home-only preference, disabled exercises, other exercise preferences, location inventories, programme assignments, and training history.
- Added a shared scope/equipment availability check for Library, Log, climbing logging, Today recommendations, and Plan/circuit eligibility. Other locations bypass the Home/Gym preference while retaining equipment requirements. Progress history filters remain unchanged.
- Library location results now include equipment IDs, so consumers can use the same check.
- Logger warnings and disabled picker results distinguish a Home/Gym restriction from missing equipment, and identify the missing items.

## Verification

- Captured all 56 public-table fingerprints and all 337 personal exercise settings before the database repair.
- Exactly 38 personal exercise settings changed from Gym to Both, plus their update timestamps; all other fields and records match the baseline. All other 55 public-table fingerprints are unchanged.
- Live query confirms Ring Dip, Ring Row, and TRX Row are available at Home and The Font; TRX Body Saw remains Home only.
- A disposable local PostgreSQL test verifies bounded updates, preservation of disabled/inactive/unrelated exercises and other profiles, equipment prerequisites, and idempotence.
- 270 Node/database tests and 92 component tests passed, with no skips.
- Typecheck, scoped ESLint, diff whitespace check, and production build passed.
- Component regressions cover Ring Dip selection at Home, rejection after switching to a location without rings, restriction-specific warnings in both the workout and picker, and Gym-scoped exercise selection at an equipped Other location.

The database repair is live. Frontend publication has not been performed or verified; the repository changes are ready for user-managed Lovable synchronization.

## Manual editing follow-up

The shared Edit/Create form now includes Training location next to Required equipment, with Both (Home + Gym), Home only, and Gym only options. Editing restores the current preference and Save persists it through the existing personal exercise setter. Creating uses the chosen preference, defaulting to Both. Calls that omit the new optional field preserve existing preferences. No live settings were changed for this UI follow-up.

Five focused component and persistence checks passed, including changing and reopening the preference, saving it on create/edit, preserving preferences when omitted, and Library/Log availability consistency. Typecheck, scoped lint, and build passed.

## Remaining audit findings

The earlier read-only audit found 18 active exercises without any equipped saved location (10 enabled), 30 unenabled JACKED imports with equipment text but no structured equipment links, and an extra Bike requirement on Air Bike. Weighted Dip names Dip bars, which is absent from the equipment catalogue. These were outside the approved ring/TRX and shared-validation repair. Resolving inventory gaps requires confirming where the equipment actually exists.
