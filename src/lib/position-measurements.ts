export const POSITION_MEASUREMENT_GUIDES = [
  { value: "", label: "None" },
  { value: "foam_cork_blocks", label: "Foam & cork blocks" },
] as const;

export type PositionMeasurementGuide = (typeof POSITION_MEASUREMENT_GUIDES)[number]["value"];

export const POSITION_MEASUREMENT_DIRECTIONS = [
  { value: "lower", label: "Lower is better" },
  { value: "higher", label: "Higher is better" },
  { value: "neutral", label: "Neutral / contextual" },
] as const;

export type PositionMeasurementDirection =
  (typeof POSITION_MEASUREMENT_DIRECTIONS)[number]["value"];

export const BLOCK_HEIGHT_OPTIONS = [
  { heightCm: 5, setup: "1× FB (flat)" },
  { heightCm: 7, setup: "1× CB (flat)" },
  { heightCm: 10, setup: "2× FB (flat)" },
  { heightCm: 12, setup: "1× FB (flat) + 1× CB (flat)" },
  { heightCm: 14, setup: "2× CB (flat)" },
  { heightCm: 14.5, setup: "1× CB (edge)" },
  { heightCm: 17, setup: "1× CB (flat) + 2× FB (flat)" },
  { heightCm: 19.5, setup: "1× FB (flat) + 1× CB (edge)" },
  { heightCm: 20.5, setup: "1× FB (edge)" },
  { heightCm: 21.5, setup: "2× FB (flat) + 1× CB (edge)" },
  { heightCm: 22, setup: "2× CB (flat) + 2× FB (flat)" },
  { heightCm: 23.5, setup: "1× FB (flat) + 1× CB (flat) + 1× CB (edge)" },
  { heightCm: 25.5, setup: "1× FB (flat) + 1× FB (edge)" },
  { heightCm: 27.5, setup: "1× CB (flat) + 1× FB (edge)" },
  { heightCm: 28.5, setup: "1× CB (flat) + 2× FB (flat) + 1× CB (edge)" },
  { heightCm: 30.5, setup: "2× FB (flat) + 1× FB (edge)" },
  { heightCm: 32.5, setup: "1× FB (flat) + 1× CB (flat) + 1× FB (edge)" },
  { heightCm: 34.5, setup: "2× CB (flat) + 1× FB (edge)" },
  { heightCm: 37.5, setup: "2× CB (flat) + 1× FB (flat) + 1× FB (edge)" },
] as const;

export function blockHeightOption(height: string, setup = "") {
  const numericHeight = Number(height);
  if (!Number.isFinite(numericHeight)) return null;
  return (
    BLOCK_HEIGHT_OPTIONS.find(
      (option) =>
        option.heightCm === numericHeight &&
        (!setup || option.setup.toLowerCase() === setup.toLowerCase()),
    ) ??
    BLOCK_HEIGHT_OPTIONS.find((option) => option.heightCm === numericHeight) ??
    null
  );
}

export function formatPositionMeasurementDirection(direction: string) {
  return (
    POSITION_MEASUREMENT_DIRECTIONS.find((option) => option.value === direction)?.label ??
    "Neutral / contextual"
  );
}
