# Missed-session dates — 14 October 2026

## Delivered behaviour

Today offers Plans changed alongside an active programme. A local unfinished workout or a started
next session blocks opening the date editor. The user chooses a later date for the next session;
the preview applies the same delay to each later unstarted session, preserving their spacing.
Fixed sessions are labelled, and a proposal that would reverse the order around one is rejected.
Other planned sessions on the proposed dates are shown before Apply. Failure to read those plans
blocks Apply and offers Retry. Cancel and Escape close without writing and restore button focus.

Apply rechecks the assignment position, every remaining session's effective date, schedule revision,
personal revision and started state, plus planned clashes. It saves the whole batch in one database
transaction. Pending programme-plan dates follow the approved dates; source prescriptions, approved
strength-week targets, personal revisions, start date, current programme position and training
history are retained. A failure partway through the writes rolls back earlier date/plan updates.

Immediately after a successful save, Undo date change offers another exact date preview and clash
check. Restoration uses the newly written revisions and rejects stale or newly started work. This
Undo offer belongs to the current Today view; it is not a persistent editing-history feature.

Date overrides are read consistently by Today offers, the programme calendar in Plan, the personal
programme editor and strength-week previews. A subsequent explicit personal date edit replaces its
override; an ordinary prescription edit retains the effective date. Source dates remain available
for review matching and restart, so moving dates does not cancel approved strength targets.

JSON backups now use schema version 2 and include person-scoped programme_session_dates with their
assignment/workout references. v1 backups are accepted and upgraded with an empty date collection.
Missing date data in v2 is rejected. Export and reconstruction tests include an actual revised date,
exclude another person's override and validate all foreign keys before committing restoration.

## Verification

- 30 unit checks passed across rescheduling, native/personal strength review, adaptive strength and
  backup compatibility.
- 42 component checks passed across the date dialog, Today, programme offers/calendar, personal
  strength persistence/review, Base Strength levels, data export and database-backed reconstruction.
- Isolated PostgreSQL tests covered the new date RPC's five scenarios, the existing personal
  programme lifecycle and personal strength-review lifecycle. All executed; none skipped. Cases
  include wrong-person/anonymous access, stale snapshots, partial batches, unseen clashes, injected
  late-write rollback, pending-plan updates, Undo, newly started sessions and preservation/start of
  the exact approved strength prescription.
- Local Chromium used the actual Today and dialog components with synthetic cached data and mocked
  saves. Preview, keyboard cancellation/focus, Apply, Undo and reload passed at 390, 768 and 1,440
  pixels with no horizontal overflow, page errors or external data requests. Screenshots and scripts
  are in the ignored programme-reschedule.local folder.
- TypeScript and production client/server build passed. Repository lint passed with eight existing
  Fast Refresh warnings in unchanged modules. Generated route ordering churn was excluded.

## Database and release state

Migration 20261014202016_programme_schedule_shifts.sql was created through the CLI, tested locally
and applied alone in a transaction to linked project dvcdghmcqqfvlbzufpyy. The connected MCP needed
reauthentication, so the existing working CLI connection was used. A generic db push dry run found
older remote-only migration versions; those entries were left intact. Only the new version was
recorded as applied through the CLI after its successful schema transaction.

All 58 existing public/app_private tables retained exactly the same counts and whole-row
fingerprints. The new table contains zero rows. Read-only verification found zero effective-date
differences from the pre-feature baselines, enabled RLS, two date indexes, an invoker RPC executable
by authenticated users but not anon, and the new migration record. Security advisor output was
unchanged. No production training dates or training records were created, edited or deleted.

The repository frontend still needs user-managed GitHub push, Lovable synchronization/publication
and a signed-in published check. Browser fixtures and isolated database tests do not establish a
published end-to-end date-change journey. A live date-change test needs separate user authorization.
