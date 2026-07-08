import { useEffect, useRef, useState } from "react";
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
  ALL_SIGNALS,
  classifyCapture,
  distanceMeters,
  GEO_VERIFY_MAX_DISTANCE_M,
  SIGNALS,
  type Signal,
  type Verification,
} from "@tmp/shared";
import { useStore } from "@/lib/store";
import { colors } from "@/lib/theme";

interface Capture {
  photoUri: string;
  verification: Verification;
  distanceM: number;
  lat?: number;
  lng?: number;
  capturedAt?: string;
  mockLocation?: boolean;
}

interface GpsFix {
  distanceM: number;
  inRange: boolean;
}

/**
 * Evidence by construction: the camera is the flow. No gallery picker —
 * GPS, mock-location flag, and timestamp are read when the shutter fires,
 * and the capture is classified against the pump location on the spot.
 */
export default function ReportScreen() {
  const { pumpId } = useLocalSearchParams<{ pumpId: string }>();
  const { pumps, addReport, isLive, session } = useStore();
  const pump = pumps.find((p) => p.id === pumpId);
  const [submitting, setSubmitting] = useState(false);

  const cameraRef = useRef<CameraView>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [gpsFix, setGpsFix] = useState<GpsFix | null>(null);
  const [capture, setCapture] = useState<Capture | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [selected, setSelected] = useState<Signal[]>([]);
  const [freeText, setFreeText] = useState("");
  const [litres, setLitres] = useState("");
  const [amount, setAmount] = useState("");
  const [odo, setOdo] = useState("");

  // Live GPS chip on the viewfinder, like the mockup's "GPS locked · 38 m".
  useEffect(() => {
    if (!pump) return;
    let sub: Location.LocationSubscription | null = null;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 5 },
        (pos) => {
          const d = distanceMeters(
            pos.coords.latitude,
            pos.coords.longitude,
            pump.lat,
            pump.lng,
          );
          setGpsFix({ distanceM: d, inRange: d <= GEO_VERIFY_MAX_DISTANCE_M });
        },
      );
    })();
    return () => sub?.remove();
  }, [pump]);

  if (!pump) return <Text style={{ padding: 20 }}>Pump not found.</Text>;

  const step = capture ? (selected.length > 0 ? 3 : 2) : 1;

  async function takePhoto() {
    if (!pump || capturing) return;
    setCapturing(true);
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      const [photo, position] = await Promise.all([
        cameraRef.current?.takePictureAsync({ quality: 0.7 }),
        status === "granted"
          ? Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.High,
            })
          : Promise.resolve(null),
      ]);
      if (!photo) return;

      if (position) {
        const capturedAt = new Date(position.timestamp).toISOString();
        const { verification, distanceM } = classifyCapture(
          {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            capturedAt,
            receivedAt: new Date().toISOString(),
            mockLocation: position.mocked ?? false,
          },
          pump.lat,
          pump.lng,
        );
        setCapture({
          photoUri: photo.uri,
          verification,
          distanceM,
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          capturedAt,
          mockLocation: position.mocked ?? false,
        });
      } else {
        setCapture({
          photoUri: photo.uri,
          verification: "unverified",
          distanceM: 0,
        });
      }
    } finally {
      setCapturing(false);
    }
  }

  function toggleSignal(s: Signal) {
    setSelected((prev) =>
      prev.includes(s)
        ? prev.filter((x) => x !== s)
        : prev.length < 6
          ? [...prev, s]
          : prev,
    );
  }

  async function submit() {
    if (!pump || !capture || selected.length === 0 || submitting) return;
    if (isLive && !session) {
      router.push("/auth");
      return;
    }
    setSubmitting(true);
    try {
      const result = await addReport({
        pumpId: pump.id,
        signals: selected,
        freeText: freeText.trim() || undefined,
        litres: litres ? Number(litres) : undefined,
        amountInr: amount ? Number(amount) : undefined,
        odoKm: odo ? Number(odo) : undefined,
        capture:
          capture.lat != null && capture.lng != null && capture.capturedAt
            ? {
                lat: capture.lat,
                lng: capture.lng,
                capturedAt: capture.capturedAt,
                mockLocation: capture.mockLocation ?? false,
              }
            : undefined,
        verification: capture.verification,
        distanceToPumpM:
          capture.verification === "geo_verified"
            ? capture.distanceM
            : undefined,
        photoUri: capture.photoUri,
      });
      Alert.alert(
        "Report filed",
        result.verification === "geo_verified"
          ? `Geo-verified ${Math.round(result.distanceM ?? 0)} m from the pump. You can escalate it into a formal complaint from the You tab.`
          : "Filed as unverified (location was unavailable or didn't match). It still counts, with lower weight.",
        [
          { text: "Done", onPress: () => router.back() },
          {
            text: "File formal complaint",
            onPress: () =>
              router.replace({
                pathname: "/complaint/[pumpId]",
                params: { pumpId: pump.id },
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
          Reports on TrustMyPetrol carry weight because photos are taken live,
          at the pump. That needs the camera.
        </Text>
        <Pressable style={primaryBtn} onPress={requestCameraPermission}>
          <Text style={primaryBtnText}>Allow camera</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
      {/* step progress, as in the mockup */}
      <View style={{ gap: 6 }}>
        <Text style={{ fontSize: 12, color: colors.muted }}>
          Report · {pump.name}
        </Text>
        <View style={{ flexDirection: "row", gap: 5 }}>
          {[1, 2, 3].map((i) => (
            <View
              key={i}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                backgroundColor: i <= step ? colors.petrol : colors.line,
              }}
            />
          ))}
        </View>
      </View>

      <View style={{ borderRadius: 16, overflow: "hidden", height: 300 }}>
        {capture ? (
          <View style={{ flex: 1 }}>
            <Image
              source={{ uri: capture.photoUri }}
              style={{ flex: 1 }}
              resizeMode="cover"
            />
            <StatusChip
              positive={capture.verification === "geo_verified"}
              text={
                capture.verification === "geo_verified"
                  ? `✓ GPS locked · ${Math.round(capture.distanceM)} m from pump`
                  : capture.verification === "location_mismatch"
                    ? `Location mismatch · ${Math.round(capture.distanceM)} m away`
                    : "Location unavailable"
              }
            />
            <Pressable
              onPress={() => setCapture(null)}
              style={{
                position: "absolute",
                bottom: 10,
                right: 10,
                backgroundColor: "rgba(0,0,0,.55)",
                borderRadius: 999,
                paddingHorizontal: 12,
                paddingVertical: 6,
              }}
            >
              <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>
                Retake
              </Text>
            </Pressable>
          </View>
        ) : (
          <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back">
            <StatusChip
              positive={gpsFix?.inRange ?? false}
              text={
                gpsFix
                  ? gpsFix.inRange
                    ? `✓ GPS locked · ${Math.round(gpsFix.distanceM)} m from pump`
                    : `${Math.round(gpsFix.distanceM)} m from pump — move closer`
                  : "Locating…"
              }
            />
            <View
              style={{
                flex: 1,
                justifyContent: "flex-end",
                alignItems: "center",
                paddingBottom: 14,
              }}
            >
              <Pressable
                onPress={takePhoto}
                disabled={capturing}
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: 29,
                  borderWidth: 4,
                  borderColor: "#fff",
                  backgroundColor: "rgba(255,255,255,.25)",
                  opacity: capturing ? 0.5 : 1,
                }}
              />
            </View>
          </CameraView>
        )}
      </View>

      <Text style={sectionLabel}>What did you observe? Pick all that apply</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
        {ALL_SIGNALS.filter((s) => s !== "blend_update").map((s) => {
          const on = selected.includes(s);
          return (
            <Pressable
              key={s}
              onPress={() => toggleSignal(s)}
              style={{
                backgroundColor: on ? colors.petrol : "#EDF3F2",
                borderRadius: 999,
                paddingHorizontal: 12,
                paddingVertical: 6,
              }}
            >
              <Text
                style={{
                  color: on ? "#fff" : "#33484A",
                  fontSize: 12.5,
                  fontWeight: "600",
                }}
              >
                {SIGNALS[s].label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={sectionLabel}>Fill details (optional)</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <LabeledInput label="Litres" value={litres} onChange={setLitres} decimal />
        <LabeledInput label="Amount ₹" value={amount} onChange={setAmount} />
        <LabeledInput label="Odo km" value={odo} onChange={setOdo} />
      </View>
      <TextInput
        placeholder="Anything else? (optional, max 500 chars)"
        value={freeText}
        onChangeText={(t) => setFreeText(t.slice(0, 500))}
        multiline
        style={[input, { minHeight: 70, textAlignVertical: "top" }]}
      />

      <Pressable
        onPress={submit}
        disabled={!capture || selected.length === 0 || submitting}
        style={[
          primaryBtn,
          (!capture || selected.length === 0 || submitting) && {
            opacity: 0.4,
          },
        ]}
      >
        <Text style={primaryBtnText}>
          {submitting
            ? "Filing…"
            : capture
              ? selected.length
                ? isLive && !session
                  ? "Sign in & file report"
                  : "File report"
                : "Select at least one signal"
              : "Take a photo first"}
        </Text>
      </Pressable>
      <Text style={{ fontSize: 11.5, color: colors.muted, textAlign: "center" }}>
        Photos are captured live in-app. Location and time are recorded at
        capture — that's what makes your report evidence.
      </Text>
    </ScrollView>
  );
}

function StatusChip({ positive, text }: { positive: boolean; text: string }) {
  return (
    <View
      style={{
        position: "absolute",
        top: 10,
        left: 10,
        backgroundColor: positive
          ? "rgba(226,241,232,.95)"
          : "rgba(240,237,230,.95)",
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 3,
        zIndex: 2,
      }}
    >
      <Text
        style={{
          fontSize: 11,
          fontWeight: "700",
          color: positive ? colors.geoText : "#8A7A4E",
        }}
      >
        {text}
      </Text>
    </View>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  decimal,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  decimal?: boolean;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.card,
        borderColor: colors.line,
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
        gap: 2,
      }}
    >
      <Text
        style={{
          fontSize: 9.5,
          letterSpacing: 1.2,
          textTransform: "uppercase",
          color: colors.muted,
          fontWeight: "700",
        }}
      >
        {label}
      </Text>
      <TextInput
        keyboardType={decimal ? "decimal-pad" : "number-pad"}
        value={value}
        onChangeText={onChange}
        placeholder="—"
        style={{ fontSize: 14, fontWeight: "700", padding: 0 }}
      />
    </View>
  );
}

const sectionLabel = {
  fontSize: 11,
  letterSpacing: 1.4,
  textTransform: "uppercase" as const,
  color: colors.muted,
  fontWeight: "700" as const,
};

const input = {
  backgroundColor: colors.card,
  borderColor: colors.line,
  borderWidth: 1,
  borderRadius: 12,
  paddingHorizontal: 12,
  paddingVertical: 10,
  fontSize: 14,
} as const;

const primaryBtn = {
  backgroundColor: colors.petrol,
  borderRadius: 12,
  padding: 14,
} as const;

const primaryBtnText = {
  color: "#fff",
  fontWeight: "700" as const,
  textAlign: "center" as const,
  fontSize: 15,
};
