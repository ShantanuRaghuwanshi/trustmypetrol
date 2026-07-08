"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ALL_SIGNALS,
  distanceMeters,
  GEO_VERIFY_MAX_DISTANCE_M,
  SIGNALS,
  type Pump,
  type Signal,
} from "@tmp/shared";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";

interface Capture {
  file: File;
  previewUrl: string;
  lat?: number;
  lng?: number;
  capturedAt?: string;
  distanceM?: number;
}

/**
 * Web report flow. The file input uses capture="environment" so mobile
 * browsers open the camera directly; geolocation is read the moment the
 * photo lands. Verification is classified server-side by submit_report —
 * same path as the app.
 */
export default function ReportForm({ pump }: { pump: Pump }) {
  const supabase = getSupabaseBrowser();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [capture, setCapture] = useState<Capture | null>(null);
  const [selected, setSelected] = useState<Signal[]>([]);
  const [freeText, setFreeText] = useState("");
  const [litres, setLitres] = useState("");
  const [amount, setAmount] = useState("");
  const [odo, setOdo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ verification: string; distanceM?: number } | null>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth
      .getSession()
      .then(({ data }) => setSignedIn(Boolean(data.session)));
  }, [supabase]);

  if (!supabase) {
    return (
      <p className="pump-meta">
        Reporting isn&apos;t configured on this deployment.
      </p>
    );
  }

  function onPhoto(file: File | undefined) {
    setError(null);
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    const base: Capture = { file, previewUrl };
    setCapture(base);
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const d = distanceMeters(
          pos.coords.latitude,
          pos.coords.longitude,
          pump.lat,
          pump.lng,
        );
        setCapture({
          ...base,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          capturedAt: new Date().toISOString(),
          distanceM: d,
        });
      },
      () => {
        /* location denied → report files as unverified */
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  function toggle(s: Signal) {
    setSelected((prev) =>
      prev.includes(s)
        ? prev.filter((x) => x !== s)
        : prev.length < 6
          ? [...prev, s]
          : prev,
    );
  }

  async function submit() {
    if (!capture || selected.length === 0 || busy) return;
    setError(null);
    setBusy(true);
    try {
      const { data, error: rpcError } = await supabase!.rpc("submit_report", {
        in_pump_id: pump.id,
        in_signals: selected,
        in_free_text: freeText.trim() || null,
        in_litres: litres ? Number(litres) : null,
        in_amount_inr: amount ? Number(amount) : null,
        in_odo_km: odo ? Number(odo) : null,
        in_lat: capture.lat ?? null,
        in_lng: capture.lng ?? null,
        in_captured_at: capture.capturedAt ?? null,
        in_mock: false,
      });
      if (rpcError) throw new Error(rpcError.message);
      const row = Array.isArray(data) ? data[0] : data;

      const { data: userData } = await supabase!.auth.getUser();
      const uid = userData.user?.id;
      if (uid) {
        await supabase!.storage
          .from("evidence")
          .upload(`${uid}/${row.report_id}.jpg`, capture.file, {
            contentType: capture.file.type || "image/jpeg",
          })
          .catch(() => undefined); // evidence is best-effort
      }
      setDone({
        verification: String(row.verification),
        distanceM: row.distance_m == null ? undefined : Number(row.distance_m),
      });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (signedIn === false) {
    return (
      <div className="panel" style={{ display: "grid", gap: 12 }}>
        <p style={{ margin: 0 }}>
          Sign in to file a report — one account per person is what keeps pump
          scores honest.
        </p>
        <Link
          href={`/auth?next=/report/${pump.id}`}
          className="btn-primary"
          style={{ textAlign: "center" }}
        >
          Sign in to continue
        </Link>
      </div>
    );
  }

  if (done) {
    const verified = done.verification === "geo_verified";
    return (
      <div className="panel" style={{ display: "grid", gap: 12 }}>
        <h2 style={{ margin: 0 }}>Report filed ✓</h2>
        <p style={{ margin: 0 }}>
          {verified
            ? `Geo-verified ${Math.round(done.distanceM ?? 0)} m from the pump.`
            : "Filed as unverified (location was unavailable or didn't match). It still counts, with lower weight."}
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href={`/complaint/${pump.id}`} className="btn-primary">
            File formal complaint
          </Link>
          <Link href={`/pump/${pump.id}`} className="btn-outline">
            Back to pump record
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="capture-box">
        {capture ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={capture.previewUrl} alt="Your evidence photo" />
            <span
              className={`badge-${capture.distanceM != null && capture.distanceM <= GEO_VERIFY_MAX_DISTANCE_M ? "geo" : "unv"} capture-chip`}
            >
              {capture.distanceM == null
                ? "Location unavailable"
                : capture.distanceM <= GEO_VERIFY_MAX_DISTANCE_M
                  ? `✓ GPS locked · ${Math.round(capture.distanceM)} m from pump`
                  : `${Math.round(capture.distanceM)} m from pump — will file unverified`}
            </span>
            <button
              className="link-btn retake"
              onClick={() => {
                setCapture(null);
                if (fileRef.current) fileRef.current.value = "";
              }}
            >
              Retake
            </button>
          </>
        ) : (
          <button
            className="capture-cta"
            onClick={() => fileRef.current?.click()}
            type="button"
          >
            📷 Take a live photo at the pump
            <span>
              Camera opens directly on phones. Location is read at capture —
              that&apos;s what makes your report evidence.
            </span>
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => onPhoto(e.target.files?.[0])}
        />
      </div>

      <div>
        <div className="section-label" style={{ marginTop: 0 }}>
          What did you observe? Pick all that apply
        </div>
        <div className="chips">
          {ALL_SIGNALS.filter((s) => s !== "blend_update").map((s) => (
            <button
              key={s}
              type="button"
              className={`chip-toggle${selected.includes(s) ? " on" : ""}`}
              onClick={() => toggle(s)}
            >
              {SIGNALS[s].label}
            </button>
          ))}
        </div>
      </div>

      <div className="fill-row">
        <label>
          Litres
          <input
            className="field"
            inputMode="decimal"
            value={litres}
            onChange={(e) => setLitres(e.target.value)}
            placeholder="—"
          />
        </label>
        <label>
          Amount ₹
          <input
            className="field"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="—"
          />
        </label>
        <label>
          Odo km
          <input
            className="field"
            inputMode="numeric"
            value={odo}
            onChange={(e) => setOdo(e.target.value)}
            placeholder="—"
          />
        </label>
      </div>

      <textarea
        className="field"
        rows={3}
        placeholder="Anything else? (optional, max 500 chars)"
        value={freeText}
        onChange={(e) => setFreeText(e.target.value.slice(0, 500))}
      />

      <button
        className="btn-primary"
        onClick={submit}
        disabled={!capture || selected.length === 0 || busy}
      >
        {busy
          ? "Filing…"
          : !capture
            ? "Take a photo first"
            : selected.length === 0
              ? "Select at least one signal"
              : "File report"}
      </button>
      {error && <p className="error-note">{error}</p>}
    </div>
  );
}
