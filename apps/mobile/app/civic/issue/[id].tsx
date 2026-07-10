import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  AGENCIES,
  dlpEndDate,
  dlpStatusOf,
  draftCivicGrievance,
  draftRtiApplication,
  escalationLadder,
  formatInrCompact,
  isAgencySlug,
  isSlaLapsed,
  ISSUE_TYPES,
  nextEscalation,
  rtiDueDate,
  rtiPortalFor,
  slaDueDate,
  type CivicAgency,
  type CivicComplaint,
  type CivicWork,
} from "@tmp/civic";
import { useCivicStore } from "@/lib/civicStore";
import { colors } from "@/lib/theme";

const dateIN = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", {
    dateStyle: "medium",
    timeZone: "Asia/Kolkata",
  });

/**
 * The issue page: what it is, who owns it, and the filing ladder.
 * Prepare, don't submit — we draft and deep-link; the citizen files, then
 * pastes the registration number back so the SLA timer can nudge them.
 */
export default function CivicIssueScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    issueById,
    myReportFor,
    complaintsFor,
    startComplaint,
    markFiled,
    markEscalated,
    loadWorksFor,
    myRtiRequests,
    startRti,
    markRtiFiled,
  } = useCivicStore();
  const [refNo, setRefNo] = useState("");
  const [rtiRefNo, setRtiRefNo] = useState("");
  const [busy, setBusy] = useState(false);
  const [works, setWorks] = useState<CivicWork[] | null>(null);

  const issue = issueById(id);
  const myReport = issue ? myReportFor(issue.id) : undefined;
  const complaints = issue ? complaintsFor(issue.id) : [];
  const active: CivicComplaint | undefined = complaints.find(
    (c) => c.status === "drafted" || c.status === "filed",
  );

  const agency: CivicAgency | null =
    issue?.agencySlug && isAgencySlug(issue.agencySlug)
      ? AGENCIES[issue.agencySlug]
      : null;

  const draft = useMemo(
    () =>
      issue
        ? draftCivicGrievance({ issue, report: myReport, agency })
        : "",
    [issue, myReport, agency],
  );

  // Works registry lookup: which contract covers this spot?
  useEffect(() => {
    if (!issue) return;
    let cancelled = false;
    loadWorksFor(issue)
      .then((w) => !cancelled && setWorks(w))
      .catch(() => !cancelled && setWorks([]));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issue?.id]);

  const work = works?.[0];
  const rtiDraft = useMemo(
    () =>
      issue
        ? draftRtiApplication({ issue, agency, work: work ?? undefined })
        : "",
    [issue, agency, work],
  );
  const myRti = issue
    ? myRtiRequests.find(
        (r) =>
          r.issueId === issue.id &&
          (r.status === "drafted" || r.status === "filed"),
      )
    : undefined;

  if (!issue) return <Text style={{ padding: 20 }}>Issue not found.</Text>;

  const def = ISSUE_TYPES[issue.issueType];
  const ladder = escalationLadder(agency);
  const activeStep =
    ladder.find((s) => s.channel === active?.channel) ?? ladder[0]!;

  async function beginFiling() {
    if (busy || !issue) return;
    setBusy(true);
    try {
      await startComplaint(
        issue.id,
        activeStep.channel,
        agency?.slug ?? null,
      );
    } catch (e) {
      Alert.alert("Couldn't start", e instanceof Error ? e.message : "Retry.");
    } finally {
      setBusy(false);
    }
  }

  async function saveReference() {
    if (!active || refNo.trim().length < 4 || busy) return;
    setBusy(true);
    try {
      await markFiled(active.id, refNo.trim());
      setRefNo("");
    } catch (e) {
      Alert.alert("Couldn't save", e instanceof Error ? e.message : "Retry.");
    } finally {
      setBusy(false);
    }
  }

  async function escalate() {
    if (!active || busy || !issue) return;
    const next = nextEscalation(active.channel, agency);
    if (!next) return;
    setBusy(true);
    try {
      await markEscalated(active.id);
      await startComplaint(issue.id, next.channel, agency?.slug ?? null, active.id);
    } catch (e) {
      Alert.alert("Couldn't escalate", e instanceof Error ? e.message : "Retry.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
      {/* ── What & who ─────────────────────────────────────────────── */}
      <View style={card}>
        <Text style={{ fontSize: 18, fontWeight: "800", color: colors.ink }}>
          {def.label}
          {def.safetyCritical ? "  ⚠️" : ""}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 12.5, marginTop: 3 }}>
          {issue.reportCount}{" "}
          {issue.reportCount === 1 ? "report" : "reports"} · first{" "}
          {dateIN(issue.firstReportedAt)} · last {dateIN(issue.lastReportedAt)}
          {issue.roadRef ? ` · ${issue.roadRef}` : ""}
        </Text>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
          <View style={statusPill}>
            <Text style={statusPillText}>{issue.status.replace("_", " ")}</Text>
          </View>
        </View>
        {issue.status !== "resolved" ? (
          <Pressable
            style={[btn, { marginTop: 12, backgroundColor: colors.good }]}
            onPress={() =>
              router.push({
                pathname: "/civic/report",
                params: { confirmIssueId: issue.id, issueType: issue.issueType },
              })
            }
          >
            <Text style={btnText}>
              Fixed already? Confirm on the spot 📸
            </Text>
          </Pressable>
        ) : (
          <Text style={{ fontSize: 12.5, color: colors.geoText, marginTop: 10 }}>
            Community-confirmed resolved
            {issue.resolvedAt ? ` on ${dateIN(issue.resolvedAt)}` : ""}. If it's
            back, file a fresh report — that reopens this issue.
          </Text>
        )}
      </View>

      <View style={card}>
        <Text style={label}>Responsible agency</Text>
        {agency ? (
          <>
            <Text style={{ fontWeight: "700", fontSize: 15 }}>
              {agency.name}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12.5, marginTop: 2 }}>
              {agency.kind === "ulb"
                ? "Municipal limits — corporation asset"
                : agency.kind === "nhai"
                  ? "National Highway — NHAI asset"
                  : "Outside municipal limits — state PWD"}
              {agency.portal?.helpline
                ? ` · helpline ${agency.portal.helpline}`
                : ""}
            </Text>
          </>
        ) : (
          <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>
            We couldn't attribute this location to a specific agency yet.
            CPGRAMS routes grievances internally — file there.
          </Text>
        )}
      </View>

      {/* ── Accountability: who built it, is the DLP running? ─────── */}
      <View style={card}>
        <Text style={label}>Who built this — works registry</Text>
        {works === null ? (
          <Text style={{ color: colors.muted, fontSize: 13 }}>
            Checking the works registry…
          </Text>
        ) : work ? (
          <>
            <Text style={{ fontWeight: "700", fontSize: 14.5 }}>
              {work.title}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12.5, marginTop: 3 }}>
              {work.contractorName ?? "Contractor not on record"}
              {work.costInr ? ` · ${formatInrCompact(work.costInr)}` : ""}
              {work.completionDate
                ? ` · completed ${dateIN(work.completionDate)}`
                : ""}
              {work.workOrderNo ? ` · WO ${work.workOrderNo}` : ""}
            </Text>
            {dlpStatusOf(work) === "inside" ? (
              <View
                style={{
                  backgroundColor: colors.geoBg,
                  borderRadius: 10,
                  padding: 10,
                  marginTop: 8,
                }}
              >
                <Text style={{ color: colors.geoText, fontSize: 12.5, lineHeight: 18 }}>
                  <Text style={{ fontWeight: "800" }}>
                    Inside the defect liability period
                  </Text>{" "}
                  (until {dateIN(dlpEndDate(work)!.toISOString())}). Under the
                  contract's defect liability clause, this repair is the
                  contractor's cost — cite this when you file.
                </Text>
              </View>
            ) : dlpStatusOf(work) === "expired" ? (
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 6 }}>
                Defect liability period ended{" "}
                {dateIN(dlpEndDate(work)!.toISOString())}.
              </Text>
            ) : (
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 6 }}>
                DLP dates not on record — the RTI below asks for exactly that.
              </Text>
            )}
            <Text style={{ color: colors.muted, fontSize: 11, marginTop: 6 }}>
              Source: {work.source.replace("_", " ")}
              {work.verified ? " · cross-verified" : " · single source"}
            </Text>
          </>
        ) : (
          <>
            <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>
              No works contract on record for this spot yet. Walk past a
              project board here? One photo builds the registry.
            </Text>
            <Pressable
              style={[btn, { marginTop: 10 }]}
              onPress={() => router.push("/civic/board")}
            >
              <Text style={btnText}>Snap the project board 📸</Text>
            </Pressable>
          </>
        )}
      </View>

      {/* ── RTI: get the contract on the record ────────────────────── */}
      <View style={card}>
        <Text style={label}>RTI — get the contract on record</Text>
        <Text style={{ color: colors.muted, fontSize: 12.5, lineHeight: 18, marginBottom: 8 }}>
          A ₹10 RTI application gets the work order, contractor name, and
          defect liability clause for this location — 30-day statutory
          deadline. Drafted for you below.
        </Text>
        {!myRti ? (
          <Pressable
            style={btn}
            disabled={busy}
            onPress={async () => {
              setBusy(true);
              try {
                await Share.share({ message: rtiDraft });
                await startRti({
                  issueId: issue.id,
                  workId: work?.id,
                  agencySlug: agency?.slug ?? null,
                  applicationText: rtiDraft,
                });
              } catch (e) {
                Alert.alert(
                  "Couldn't start",
                  e instanceof Error ? e.message : "Retry.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <Text style={btnText}>Draft RTI application</Text>
          </Pressable>
        ) : myRti.status === "drafted" ? (
          <>
            <Text style={{ fontSize: 12.5, color: colors.muted, marginBottom: 8 }}>
              File it{" "}
              {rtiPortalFor(agency)
                ? `at ${rtiPortalFor(agency)!.name}`
                : "with the agency's Public Information Officer (by post or in person)"}
              , then save the registration number.
            </Text>
            {rtiPortalFor(agency)?.url && (
              <Pressable
                style={[btn, { marginBottom: 8 }]}
                onPress={() => Linking.openURL(rtiPortalFor(agency)!.url!)}
              >
                <Text style={btnText}>
                  Open {rtiPortalFor(agency)!.name} →
                </Text>
              </Pressable>
            )}
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextInput
                placeholder="RTI registration no."
                value={rtiRefNo}
                onChangeText={setRtiRefNo}
                autoCapitalize="characters"
                style={input}
              />
              <Pressable
                style={[btn, { paddingHorizontal: 16 }]}
                disabled={busy || rtiRefNo.trim().length < 4}
                onPress={async () => {
                  setBusy(true);
                  try {
                    await markRtiFiled(myRti.id, rtiRefNo.trim());
                    setRtiRefNo("");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Text style={btnText}>Filed ✓</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <Text style={{ fontSize: 13, lineHeight: 20 }}>
            <Text style={{ fontWeight: "800" }}>{myRti.referenceNo}</Text>
            {myRti.filedAt && (
              <Text style={{ color: colors.muted }}>
                {"  ·  response due "}
                {dateIN(rtiDueDate(myRti.filedAt).toISOString())} (statutory
                30 days)
              </Text>
            )}
          </Text>
        )}
      </View>

      {/* ── Draft ──────────────────────────────────────────────────── */}
      <View style={card}>
        <Text style={label}>Drafted grievance · ready to paste</Text>
        <Text style={{ fontSize: 13, lineHeight: 20, color: "#4A5A5C" }}>
          {draft}
        </Text>
        <Pressable
          style={[btn, { marginTop: 12 }]}
          onPress={() => Share.share({ message: draft })}
        >
          <Text style={btnText}>Copy / share draft</Text>
        </Pressable>
      </View>

      {/* ── Filing ladder ──────────────────────────────────────────── */}
      <Text style={label}>Where to file</Text>
      {ladder.map((step, i) => {
        const isActive = step.channel === activeStep.channel;
        return (
          <Pressable
            key={step.channel}
            style={[
              card,
              isActive && { borderColor: colors.petrol, borderWidth: 1.5 },
            ]}
            onPress={() => step.portal.url && Linking.openURL(step.portal.url)}
          >
            <Text style={{ fontWeight: "700", fontSize: 15 }}>
              {i + 1}. {step.portal.name}
              {step.portal.appName ? ` · ${step.portal.appName} app` : ""}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12.5, marginTop: 2 }}>
              {step.channel === "cpgrams"
                ? "Universal backstop · 30-day SLA, appeals after"
                : step.channel === "state_portal"
                  ? "State grievance portal — escalation when the agency stalls"
                  : "The agency's own complaint channel — first stop"}
              {step.portal.url ? " →" : ""}
            </Text>
          </Pressable>
        );
      })}

      {/* ── Track & escalate ───────────────────────────────────────── */}
      <View style={card}>
        <Text style={label}>Your filing</Text>
        {!active ? (
          <Pressable style={btn} disabled={busy} onPress={beginFiling}>
            <Text style={btnText}>
              Start filing at {activeStep.portal.name}
            </Text>
          </Pressable>
        ) : active.status === "drafted" ? (
          <>
            <Text style={{ fontSize: 12.5, color: colors.muted, marginBottom: 8 }}>
              Paste the draft into {activeStep.portal.name}, then save the
              registration number here — that starts the 30-day timer.
            </Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextInput
                placeholder="Registration / token no."
                value={refNo}
                onChangeText={setRefNo}
                autoCapitalize="characters"
                style={input}
              />
              <Pressable
                style={[btn, { paddingHorizontal: 16 }]}
                disabled={busy}
                onPress={saveReference}
              >
                <Text style={btnText}>Filed ✓</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <Text style={{ fontSize: 13, lineHeight: 20 }}>
              <Text style={{ fontWeight: "800" }}>{active.referenceNo}</Text>
              {"  ·  filed "}
              {active.filedAt ? dateIN(active.filedAt) : ""}
            </Text>
            {active.filedAt && (
              <Text
                style={{
                  fontSize: 12.5,
                  marginTop: 4,
                  color: isSlaLapsed(active.filedAt)
                    ? colors.bad
                    : colors.muted,
                }}
              >
                {isSlaLapsed(active.filedAt)
                  ? "30-day window lapsed — escalate up the ladder."
                  : `Response due by ${dateIN(slaDueDate(active.filedAt).toISOString())} (30-day window).`}
              </Text>
            )}
            {active.filedAt &&
              isSlaLapsed(active.filedAt) &&
              nextEscalation(active.channel, agency) && (
                <Pressable
                  style={[btn, { marginTop: 10, backgroundColor: colors.bad }]}
                  disabled={busy}
                  onPress={escalate}
                >
                  <Text style={btnText}>
                    Escalate to{" "}
                    {nextEscalation(active.channel, agency)!.portal.name}
                  </Text>
                </Pressable>
              )}
          </>
        )}
        {complaints.length > 1 && (
          <View style={{ marginTop: 12, gap: 4 }}>
            {complaints.map((c) => (
              <Text key={c.id} style={{ fontSize: 12, color: colors.muted }}>
                {c.channel.replace("_", " ")} · {c.status}
                {c.referenceNo ? ` · ${c.referenceNo}` : ""} ·{" "}
                {dateIN(c.createdAt)}
              </Text>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const card = {
  backgroundColor: colors.card,
  borderColor: colors.line,
  borderWidth: 1,
  borderRadius: 14,
  padding: 14,
} as const;

const label = {
  fontSize: 11,
  letterSpacing: 1.4,
  textTransform: "uppercase" as const,
  color: colors.muted,
  fontWeight: "700" as const,
  marginBottom: 8,
};

const statusPill = {
  backgroundColor: colors.geoBg,
  borderRadius: 12,
  paddingHorizontal: 10,
  paddingVertical: 3,
} as const;
const statusPillText = {
  color: colors.geoText,
  fontSize: 11.5,
  fontWeight: "700" as const,
  textTransform: "capitalize" as const,
};

const btn = {
  backgroundColor: colors.petrol,
  borderRadius: 10,
  paddingVertical: 10,
  paddingHorizontal: 12,
} as const;
const btnText = {
  color: "#fff",
  fontWeight: "700" as const,
  textAlign: "center" as const,
  fontSize: 13,
};

const input = {
  flex: 1,
  borderColor: colors.line,
  borderWidth: 1,
  borderStyle: "dashed" as const,
  borderRadius: 10,
  paddingHorizontal: 12,
  paddingVertical: 9,
  fontSize: 13,
};
