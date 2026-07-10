"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CITIES, distanceMeters } from "@tmp/shared";
import {
  AGENCIES,
  CITY_ASSIGNMENT_RADIUS_M,
  ISSUE_CATEGORIES,
  ISSUE_TYPES,
  isAgencySlug,
  type CivicIssue,
  type IssueCategory,
} from "@tmp/civic";

const CATEGORIES = Object.keys(ISSUE_CATEGORIES) as IssueCategory[];

const agoDays = (iso: string) =>
  Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));

export default function CivicExplorer({ issues }: { issues: CivicIssue[] }) {
  const [city, setCity] = useState<string>("");
  const [category, setCategory] = useState<IssueCategory | "">("");

  const filtered = useMemo(() => {
    const c = CITIES.find((x) => x.name === city);
    return issues.filter((i) => {
      if (
        c &&
        distanceMeters(i.lat, i.lng, c.lat, c.lng) > CITY_ASSIGNMENT_RADIUS_M
      )
        return false;
      if (category && ISSUE_TYPES[i.issueType].category !== category)
        return false;
      return true;
    });
  }, [issues, city, category]);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div className="chips">
        <button
          className={`chip${city === "" ? " on" : ""}`}
          onClick={() => setCity("")}
        >
          All India
        </button>
        {CITIES.map((c) => (
          <button
            key={c.name}
            className={`chip${city === c.name ? " on" : ""}`}
            onClick={() => setCity(c.name)}
          >
            {c.name}
          </button>
        ))}
      </div>
      <div className="chips">
        <button
          className={`chip${category === "" ? " on" : ""}`}
          onClick={() => setCategory("")}
        >
          All categories
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            className={`chip${category === c ? " on" : ""}`}
            onClick={() => setCategory(c)}
          >
            {ISSUE_CATEGORIES[c].label}
          </button>
        ))}
      </div>

      <div className="pump-grid">
        {filtered.map((issue) => {
          const def = ISSUE_TYPES[issue.issueType];
          const agency =
            issue.agencySlug && isAgencySlug(issue.agencySlug)
              ? AGENCIES[issue.agencySlug]
              : null;
          const days = agoDays(issue.lastReportedAt);
          return (
            <Link
              key={issue.id}
              href={`/civic/issue/${issue.id}`}
              className="pump-card"
            >
              <div className="top">
                <h3>
                  {def.label}
                  {def.safetyCritical ? " ⚠️" : ""}
                </h3>
                <span
                  className={
                    issue.status === "resolved" ? "badge-geo" : "badge-unv"
                  }
                >
                  {issue.status.replace("_", " ")}
                </span>
              </div>
              <div className="pump-meta">
                {issue.reportCount}{" "}
                {issue.reportCount === 1 ? "report" : "reports"}
                {issue.roadRef ? ` · ${issue.roadRef}` : ""}
                {days === 0 ? " · today" : ` · ${days} d ago`}
              </div>
              <div className="pump-meta">
                {agency ? agency.name : "Agency unresolved — CPGRAMS route"}
              </div>
            </Link>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p className="pump-meta">
          No civic issues reported{city ? ` around ${city}` : ""} yet — reports
          filed in the app appear here, routed to the responsible agency.
        </p>
      )}
    </div>
  );
}
