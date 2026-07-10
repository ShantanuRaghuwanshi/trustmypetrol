import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { CITIES, distanceMeters, formatDistance } from "@tmp/shared";
import {
  AGENCIES,
  CITY_ASSIGNMENT_RADIUS_M,
  ISSUE_TYPES,
  isAgencySlug,
  type CivicIssue,
} from "@tmp/civic";
import { CityChips } from "@/components/CityChips";
import { useCivicStore } from "@/lib/civicStore";
import { colors, elevation, shape, type } from "@/lib/theme";

const agoDays = (iso: string) =>
  Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));

function IssueRow({ issue }: { issue: CivicIssue }) {
  const def = ISSUE_TYPES[issue.issueType];
  const agency =
    issue.agencySlug && isAgencySlug(issue.agencySlug)
      ? AGENCIES[issue.agencySlug]
      : null;
  const days = agoDays(issue.lastReportedAt);
  return (
    <Pressable
      style={row}
      onPress={() =>
        router.push({ pathname: "/civic/issue/[id]", params: { id: issue.id } })
      }
    >
      <View style={{ flex: 1 }}>
        <Text style={{ ...type.titleMedium, color: colors.ink }}>
          {def.label}
          {def.safetyCritical ? "  ⚠️" : ""}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
          {issue.reportCount} {issue.reportCount === 1 ? "report" : "reports"}
          {agency ? ` · ${agency.name}` : " · agency unresolved"}
          {issue.roadRef ? ` · ${issue.roadRef}` : ""}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 1 }}>
          {days === 0 ? "reported today" : `last report ${days} d ago`}
        </Text>
      </View>
      <View
        style={[
          pill,
          issue.status === "resolved" && { backgroundColor: colors.geoBg },
        ]}
      >
        <Text
          style={[
            pillText,
            issue.status === "resolved" && { color: colors.geoText },
          ]}
        >
          {issue.status.replace("_", " ")}
        </Text>
      </View>
    </Pressable>
  );
}

export default function CivicTab() {
  const { issues, loading, isLive } = useCivicStore();
  const [city, setCity] = useState("Pune");

  const filtered = useMemo(() => {
    if (!city) return issues;
    const c = CITIES.find((x) => x.name === city);
    if (!c) return issues;
    return issues.filter(
      (i) =>
        distanceMeters(i.lat, i.lng, c.lat, c.lng) <= CITY_ASSIGNMENT_RADIUS_M,
    );
  }, [issues, city]);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 14, gap: 10 }}>
        <CityChips city={city} onChange={setCity} />
        <Pressable
          style={reportBtn}
          onPress={() => router.push("/civic/report")}
        >
          <Ionicons name="camera" size={17} color="#fff" />
          <Text style={reportBtnText}>Report a civic issue</Text>
        </Pressable>
        <Pressable
          style={boardBtn}
          onPress={() => router.push("/civic/board")}
        >
          <Ionicons name="clipboard-outline" size={16} color={colors.petrol} />
          <Text style={boardBtnText}>
            Snap a project board — log who built it
          </Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: 14, paddingTop: 0, gap: 9 }}>
        {filtered.map((i) => (
          <IssueRow key={i.id} issue={i} />
        ))}
        {filtered.length === 0 && (
          <Text
            style={{
              color: colors.muted,
              fontSize: 13,
              lineHeight: 19,
              paddingTop: 8,
            }}
          >
            {loading
              ? "Loading issues…"
              : `No civic issues reported${city ? ` around ${city}` : ""} yet. ` +
                "Spotted a pothole, choked drain, or dead streetlight? " +
                "Report it — it gets routed to the responsible agency." +
                (isLive
                  ? ""
                  : "\n\n(Offline demo mode — reports stay on this device.)")}
          </Text>
        )}
        {filtered.length > 0 && (
          <Text style={{ color: colors.muted, fontSize: 11.5, paddingTop: 6 }}>
            {city
              ? `Issues within ${formatDistance(CITY_ASSIGNMENT_RADIUS_M)} of ${city}.`
              : "All reported issues."}{" "}
            Boundaries data © OpenStreetMap contributors.
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const row = {
  backgroundColor: colors.card,
  borderColor: colors.line,
  borderWidth: 1,
  borderRadius: shape.lg,
  padding: 14,
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 10,
  ...elevation[1],
};

const pill = {
  backgroundColor: "#F0E9DC",
  borderRadius: 12,
  paddingHorizontal: 10,
  paddingVertical: 3,
} as const;
const pillText = {
  color: "#8A6D2F",
  fontSize: 11,
  fontWeight: "700" as const,
  textTransform: "capitalize" as const,
};

const reportBtn = {
  backgroundColor: colors.petrol,
  borderRadius: 12,
  paddingVertical: 12,
  flexDirection: "row" as const,
  gap: 8,
  alignItems: "center" as const,
  justifyContent: "center" as const,
};
const reportBtnText = {
  color: "#fff",
  fontWeight: "700" as const,
  fontSize: 14,
};

const boardBtn = {
  backgroundColor: colors.card,
  borderColor: colors.petrol,
  borderWidth: 1,
  borderRadius: 12,
  paddingVertical: 10,
  flexDirection: "row" as const,
  gap: 8,
  alignItems: "center" as const,
  justifyContent: "center" as const,
};
const boardBtnText = {
  color: colors.petrol,
  fontWeight: "700" as const,
  fontSize: 13,
};
