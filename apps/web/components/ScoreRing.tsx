import type { PumpScore } from "@tmp/shared";

const VERDICT_COLOR: Record<string, string> = {
  good: "var(--good)",
  mixed: "var(--warn)",
  poor: "var(--bad)",
};

const VERDICT_LABEL: Record<string, string> = {
  good: "GOOD",
  mixed: "MIXED",
  poor: "POOR",
};

export function ScoreRing({
  score,
  size = 96,
}: {
  score: PumpScore;
  size?: number;
}) {
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const value = score.score ?? 0;

  return (
    <div className="score-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--line)"
          strokeWidth={stroke}
        />
        {score.score !== null && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={VERDICT_COLOR[score.verdict ?? "poor"]}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${(value / 100) * c} ${c}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </svg>
      <div className="score-ring-center">
        {score.score === null ? (
          <span className="nodata-label">
            NOT ENOUGH
            <br />
            DATA
          </span>
        ) : (
          <>
            <strong>{score.score}</strong>
            <span>{VERDICT_LABEL[score.verdict ?? "poor"]}</span>
          </>
        )}
      </div>
    </div>
  );
}
