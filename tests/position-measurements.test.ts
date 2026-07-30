import assert from "node:assert/strict";
import test from "node:test";

import {
  BLOCK_HEIGHT_OPTIONS,
  blockHeightOption,
  formatPositionMeasurementDirection,
} from "../src/lib/position-measurements.ts";

test("block height guide retains every configured setup in ascending order", () => {
  assert.equal(BLOCK_HEIGHT_OPTIONS.length, 19);
  assert.deepEqual(
    BLOCK_HEIGHT_OPTIONS.map((option) => option.heightCm),
    [
      5, 7, 10, 12, 14, 14.5, 17, 19.5, 20.5, 21.5, 22, 23.5, 25.5, 27.5, 28.5, 30.5, 32.5, 34.5,
      37.5,
    ],
  );
});

test("block height lookup preserves the physical setup and rejects custom values", () => {
  assert.deepEqual(blockHeightOption("12"), {
    heightCm: 12,
    setup: "1× FB (flat) + 1× CB (flat)",
  });
  assert.equal(blockHeightOption("8.5"), null);
  assert.equal(blockHeightOption(""), null);
});

test("measurement direction has a safe contextual fallback", () => {
  assert.equal(formatPositionMeasurementDirection("lower"), "Lower is better");
  assert.equal(formatPositionMeasurementDirection("unexpected"), "Neutral / contextual");
});
