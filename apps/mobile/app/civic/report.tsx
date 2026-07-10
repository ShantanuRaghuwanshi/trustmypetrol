import { useEffect, useState } from "react";
import { useRef } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Location from "expo-location";
import {
  AGENCIES,
  ALL_ISSUE_TYPES,
  CIVIC_GEO_MAX_ACCURACY_M,
  ISSUE_CATEGORIES,
  ISSUE_SEVERITIES,
  ISSUE_TYPES,
  isAgencySlug,
  type IssueCategory,
  type IssueSeverity,
  type IssueType,
} from "@tmp/civic";
import { useCivicStore, type CivicCaptureInput } from "@/lib/civicStore";
import { colors } from "@/lib/theme";

interface Capture extends CivicCaptureInput {
  photoUri: string;
}

const CATEGORIES = Object.keys(ISSUE_CATEGORIES) as IssueCategory[];

/**
 * Evidence by construction, same as the fuel flow: the camera is the flow,
 * no gallery picker. For civic reports the capture location IS the subject,
 * so GPS is mandatory — the shutter is disabled until there's a fix.
 *
 * Confirm mode (?confirmIssueId=…&issueType=…): the community "is it
 * actually fixed?" flow — same live capture, type locked to the issue,
 * submitted as a resolved_confirmation.
 */
export default function CivicReportScreen() {
  const { submitReport, isLive, session } = useCivicStore();
  const params = useLocalSearchParams<{
    confirmIssueId?: string;
    issueType?: string;
  }>();
  const confirmMode = !!params.confirmIssueId;
  const confirmType =
    confirmMode && params.issueType && params.issueType in ISSUE_TYPES
      ? (params.issueType as IssueType)
      : null;
  const [submitting, setSubmitting] = useState(false);

  const cameraRef = useRef<CameraView>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [capture, setCapture] = useState<Capture | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [category, setCategory] = useState<IssueCategory>("roads");
  const [issueType, setIssueType] = useState<IssueType | null>(null);
  const [severity, setSeverity] = useState<IssueSeverity | null>(null);
  const [description, setDescription] = useState("");

  // Live GPS-accuracy chip on the viewfinder.
  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 3 },
        (pos) => setAccuracy(pos.coords.accuracy ?? null),
      );
    })();
    return () => sub?.remove();
  }, []);

  async function takePhoto() {
    if (capturing) return;
    setCapturing(true);
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Location required",
          "A civic report is about a place — the capture location is the report. Allow location to continue.",
        );
        return;
      }
      const [photo, position] = await Promise.all([
        cameraRef.current?.takePictureAsync({ quality: 0.7 }),
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        }),
      ]);
      if (!photo || !position) return;
      setCapture({
        photoUri: photo.uri,
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracyM: position.coords.accuracy ?? 9999,
        capturedAt: new Date(position.timestamp).toISOString(),
        mockLocation: position.mocked ?? false,
      });
    } finally {
      setCapturing(false);
    }
  }

  async function submit() {
    const effectiveType = confirmType ?? issueType;
    if (!capture || !effectiveType || submitting) return;
    if (isLive && !session) {
      router.push("/auth");
      return;
    }
    setSubmitting(true);
    try {
      const result = await submitReport({
        issueType: effectiveType,
        kind: confirmMode ? "resolved_confirmation" : "report",
        severity: confirmMode ? undefined : (severity ?? undefined),
        description: description.trim() || undefined,
        capture,
        photoUri: capture.photoUri,
      });
      if (confirmMode) {
        Alert.alert(
          "Thanks for confirming",
          "Your on-the-spot confirmation is recorded. The issue closes once enough neighbours confirm the fix.",
          [{ text: "Done", onPress: () => router.back() }],
        );
        return;
      }
      const agencyName =
        result.agencySlug && isAgencySlug(result.agencySlug)
          ? AGENCIES[result.agencySlug].name
          : null;
      Alert.alert(
        "Report filed",
        agencyName
          ? `Routed to ${agencyName}. You can escalate it into a formal complaint from the issue page.`
          : "Filed. We couldn't attribute this location to an agency yet — CPGRAMS is the filing path, from the issue page.",
        [
          { text: "Done", onPress: () => router.back() },
          {
            text: "File complaint",
            onPress: () =>
              router.replace({
                pathname: "/civic/issue/[id]",
                params: { id: result.issueId },
              }),
          },
        ],
      );
    } catch (e) {
      Alert.alert(
        "Couldn't file report",
        e instanceof Error ? e.message : "Something went wrong — try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!cameraPermission?.granted) {
    return (
      <View style={{ padding: 20, gap: 14 }}>
        <Text style={{ fontSize: 15, lineHeight: 22 }}>
          Civic reports carry weight because photos are taken live, at the
          spot. That needs the camera.
        </Text>
        <Pressable style={primaryBtn} onPress={requestCameraPermission}>
          <Text style={primaryBtnText}>Allow camera</Text>
        </Pressable>
      </View>
    );
  }

  const gpsOk = accuracy != null && accuracy <= CIVIC_GEO_MAX_ACCURACY_M;
  const typesInCategory = ALL_ISSUE_TYPES.filter(
    (t) => ISSUE_TYPES[t].category === category,
  );

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
      {!capture ? (
        <View style={{ borderRadius: 16, overflow: "hidden", height: 380 }}>
          <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" />
          <View style={gpsChip}>
            <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>
              {accuracy == null
                ? "Waiting for GPS…"
                : gpsOk
                  ? `GPS locked · ±${Math.round(accuracy)} m`
                  : `GPS coarse · ±${Math.round(accuracy)} m`}
            </Text>
          </View>
          <Pressable
            style={[shutter, accuracy == null && { opacity: 0.4 }]}
            disabled={accuracy == null || capturing}
            onPress={takePhoto}
          >
            <View style={shutterInner} />
          </Pressable>
        </View>
      ) : (
        <View style={{ gap: 14 }}>
          <View style={{ borderRadius: 16, overflow: "hidden" }}>
            <Image
              source={{ uri: capture.photoUri }}
              style={{ width: "100%", height: 200 }}
            />
            <Pressable
              style={retake}
              onPress={() => setCapture(null)}
            >
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 12 }}>
                Retake
              </Text>
            </Pressable>
          </View>

          {confirmMode && confirmType && (
            <View
              style={{
                backgroundColor: colors.geoBg,
                borderRadius: 12,
                padding: 12,
              }}
            >
              <Text style={{ color: colors.geoText, fontSize: 13, lineHeight: 19 }}>
                <Text style={{ fontWeight: "800" }}>Confirming a fix: </Text>
                {ISSUE_TYPES[confirmType].label.toLowerCase()}. Your live photo
                and GPS verify the repair — the issue closes once enough
                neighbours confirm.
              </Text>
            </View>
          )}

          {!confirmMode && (
          <>
          <Text style={label}>What is it?</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {CATEGORIES.map((c) => (
              <Pressable
                key={c}
                style={[chip, category === c && chipOn]}
                onPress={() => {
                  setCategory(c);
                  setIssueType(null);
                }}
              >
                <Text style={[chipText, category === c && chipTextOn]}>
                  {ISSUE_CATEGORIES[c].label}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={{ gap: 8 }}>
            {typesInCategory.map((t) => (
              <Pressable
                key={t}
                style={[typeRow, issueType === t && typeRowOn]}
                onPress={() => setIssueType(t)}
              >
                <Text
                  style={{
                    fontWeight: "700",
                    fontSize: 14,
                    color: issueType === t ? "#fff" : colors.ink,
                  }}
                >
                  {ISSUE_TYPES[t].label}
                  {ISSUE_TYPES[t].safetyCritical ? "  ⚠️" : ""}
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    marginTop: 2,
                    color: issueType === t ? "#D8ECEA" : colors.muted,
                  }}
                >
                  {ISSUE_TYPES[t].hint}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={label}>How bad is it?</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {ISSUE_SEVERITIES.map((s) => (
              <Pressable
                key={s}
                style={[chip, severity === s && chipOn]}
                onPress={() => setSeverity(severity === s ? null : s)}
              >
                <Text style={[chipText, severity === s && chipTextOn]}>
                  {s}
                </Text>
              </Pressable>
            ))}
          </View>
          </>
          )}

          <TextInput
            placeholder="Anything the photo doesn't show (optional, 500 chars)"
            value={description}
            onChangeText={setDescription}
            maxLength={500}
            multiline
            style={textArea}
          />

          <Pressable
            style={[
              primaryBtn,
              ((!confirmType && !issueType) || submitting) && { opacity: 0.5 },
            ]}
            disabled={(!confirmType && !issueType) || submitting}
            onPress={submit}
          >
            <Text style={primaryBtnText}>
              {submitting
                ? "Filing…"
                : confirmMode
                  ? "Confirm it's fixed"
                  : "File civic report"}
            </Text>
          </Pressable>
          {!confirmMode && (
            <Text style={{ fontSize: 12, color: colors.muted, lineHeight: 17 }}>
              Your report is routed to the responsible agency automatically —
              municipal corporation inside city limits, state PWD on the
              outskirts, NHAI on national highways.
            </Text>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const label = {
  fontSize: 11,
  letterSpacing: 1.4,
  textTransform: "uppercase" as const,
  color: colors.muted,
  fontWeight: "700" as const,
};

const chip = {
  borderColor: colors.line,
  borderWidth: 1,
  borderRadius: 20,
  paddingHorizontal: 14,
  paddingVertical: 7,
  backgroundColor: colors.card,
} as const;
const chipOn = { backgroundColor: colors.petrol, borderColor: colors.petrol };
const chipText = { fontSize: 13, color: colors.ink, fontWeight: "600" as const };
const chipTextOn = { color: "#fff" };

const typeRow = {
  backgroundColor: colors.card,
  borderColor: colors.line,
  borderWidth: 1,
  borderRadius: 12,
  padding: 12,
} as const;
const typeRowOn = { backgroundColor: colors.petrol, borderColor: colors.petrol };

const textArea = {
  backgroundColor: colors.card,
  borderColor: colors.line,
  borderWidth: 1,
  borderRadius: 12,
  padding: 12,
  minHeight: 70,
  fontSize: 13,
  textAlignVertical: "top" as const,
};

const retake = {
  position: "absolute" as const,
  top: 10,
  right: 10,
  backgroundColor: "rgba(33,42,44,0.75)",
  borderRadius: 14,
  paddingHorizontal: 12,
  paddingVertical: 6,
};

const gpsChip = {
  position: "absolute" as const,
  top: 12,
  left: 12,
  backgroundColor: "rgba(14,107,114,0.9)",
  borderRadius: 16,
  paddingHorizontal: 12,
  paddingVertical: 6,
};

const shutter = {
  position: "absolute" as const,
  bottom: 18,
  alignSelf: "center" as const,
  width: 64,
  height: 64,
  borderRadius: 32,
  borderWidth: 4,
  borderColor: "#fff",
  alignItems: "center" as const,
  justifyContent: "center" as const,
};
const shutterInner = {
  width: 48,
  height: 48,
  borderRadius: 24,
  backgroundColor: "#fff",
};

const primaryBtn = {
  backgroundColor: colors.petrol,
  borderRadius: 12,
  paddingVertical: 14,
} as const;
const primaryBtnText = {
  color: "#fff",
  fontWeight: "700" as const,
  textAlign: "center" as const,
  fontSize: 15,
};
