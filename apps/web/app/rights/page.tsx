import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Know your rights at the petrol pump",
  description:
    "The 5-litre measure check, filter-paper density test, blend labelling, and price display — checks every customer is entitled to at any petrol pump in India.",
};

const RIGHTS = [
  {
    title: "5-litre measure check",
    body: "Every pump must keep a stamped 5-litre measure. You can ask for a check anytime, free of charge. Short delivery beyond 25 ml per 5 litres is a violation.",
  },
  {
    title: "Filter-paper density test",
    body: "Pumps must keep filter paper and the day's density chart. A drop of petrol should evaporate without leaving a dark stain, and measured density must match the chart within tolerance.",
  },
  {
    title: "Blend labelling",
    body: "Dispensers selling E20 must display blend labelling. Missing or unclear labelling is reportable — it's one of the signal chips on a JanSetu report.",
  },
  {
    title: "Price display",
    body: "The board price must match what you're charged. Every pump must also display the complaint book and the supply company's contact details.",
  },
  {
    title: "If the pump refuses",
    body: "Refusing a density or measure check is itself a violation of the Marketing Discipline Guidelines. Note the time, take a live photo from the app, and file — refusal is a signal chip too.",
  },
];

export default function RightsPage() {
  return (
    <>
      <section className="hero">
        <h1>Know your rights at the pump</h1>
        <p>
          These checks are your right at any petrol pump in India. Most drivers
          don&apos;t know them — pumps count on that.
        </p>
      </section>
      <div style={{ display: "grid", gap: 14, maxWidth: 640 }}>
        {RIGHTS.map((r) => (
          <div key={r.title} className="panel">
            <h3 style={{ margin: "0 0 6px" }}>{r.title}</h3>
            <p style={{ margin: 0, color: "var(--muted)", fontSize: 15 }}>
              {r.body}
            </p>
          </div>
        ))}
        <p className="pump-meta">
          Sources: Motor Spirit &amp; High Speed Diesel (Regulation of Supply,
          Distribution and Prevention of Malpractices) Order, 2005; OMC
          Marketing Discipline Guidelines. General information, not legal
          advice.
        </p>
      </div>
    </>
  );
}
