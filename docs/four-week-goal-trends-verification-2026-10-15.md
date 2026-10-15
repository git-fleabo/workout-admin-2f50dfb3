# Four-week goal trends

Implemented and verified locally, 15 October 2026. The published app is a separate state.

## Behaviour

The existing goal cards in Weekly Review now offer an optional **Four-week trend** disclosure.
The chart is created when opened, using the goal evidence already loaded by the card. No new
requests, saved preferences or database writes are needed.

- The four calendar weeks end at the selected review week. The final week ends at the review date
  and is labelled **So far** when fewer than seven days are available.
- Performance/duration goals show the best fresh measurement from each week using the existing
  metric rules. Values are not cumulative personal bests. A missing week is a gap, never a carried
  result or a measured zero. Source logs with a missing selected metric are disclosed.
- Consistency goals show that week's completed sessions, distinct active dates or recorded minutes.
  A loaded week with no sessions can legitimately show zero recorded activity. A week containing
  untimed sessions is labelled incomplete; if all session times are missing, it shows **Time not
  recorded** rather than zero. A partly known time total is labelled **At least**.
- Weekly comparisons span month/quarter/year boundaries without truncating a week to the goal's
  target period. The existing summary continues to show goal-period progress and current targets;
  the trend never divides a monthly/yearly target into an invented weekly target.
- Manual/legacy check-ins have a labelled count trend and do not imply performance achievement.
  Manual milestones retain their existing confirmation flow and have no numeric trend.
- Each week is a keyboard-operable button with an accessible date/value label and selected state.
  Selecting it reveals its sources, with direct session links to History and a link to the week's
  best source even if that source is not among the latest six listed records.
- The selected week resets to the review week when the review window changes. A page loading
  another review may close disclosures; reopening defaults to the newly reviewed week.
- Zero bars sit on the baseline; absent measurements use a dashed gap. Values are labelled directly.
  The chart warns that an unfinished week is not directly comparable with a full week. It makes no
  forecasts or claims of readiness, sustained improvement or decline.

Current saved goal settings and current source records are used, as in the existing goal review.
Past goal settings/status are not versioned; editing an old record can change the recomputed trend.
Different loads, repetitions or assistance conditions are not newly normalised by this view.

## Verification

- 25 unit checks across the goal review/trend suites passed. New cases cover week boundaries,
  calendar year rollover, fresh weekly results, missing versus zero measurements, current/past
  cutoffs, evidence identity, monthly targets, active-day deduplication, untimed sessions and
  manual goals.
- 23 component checks across the trend, weekly goal review and source-History suites passed.
  Coverage includes optional rendering, keyboard selection, exact source links, missing-metric
  prompts, selection reset, manual goals, no additional reads when opening a trend and existing
  goal summary/error/refresh behaviour. No tests were skipped in this selection.
- TypeScript, production client/server build and ESLint passed. The eight existing Fast Refresh
  warnings remain in unchanged UI/weekly-plan modules; there are no new lint errors or warnings.
- Playwright exercised Weekly Review and History at 390, 768 and 1440 pixels with fixture-backed
  reads. Four-week display, missing-week selection, keyboard selection, older source-session
  navigation, review-week navigation, selected-week reset and refresh passed with no horizontal
  overflow, browser runtime errors or external data requests. Phone and desktop card screenshots
  were visually inspected.

The ignored `goal-review.local/` directory holds the browser fixture, logs and screenshots. The
fixture's dates are fixed for repeatable checks and are not production records.

No database/schema change, production read test or user-data write was performed. GitHub push,
Lovable sync/publication and a signed-in check of the published build remain separate user-managed
steps.
