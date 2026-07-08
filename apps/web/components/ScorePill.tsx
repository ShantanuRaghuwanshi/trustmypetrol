import type { PumpScore } from "@tmp/shared";

export function ScorePill({ score }: { score: PumpScore }) {
  if (score.score === null) {
    return <span className="score-pill nodata">Not enough data</span>;
  }
  return (
    <span className={`score-pill ${score.verdict}`} title="Trust score, last 90 days">
      {score.score}
    </span>
  );
}
