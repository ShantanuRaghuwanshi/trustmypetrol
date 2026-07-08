import { useRef, useState } from "react";
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
}

/**
 * Evidence by construction: the camera is the flow. No gallery picker —
 * GPS, mock-location flag, and timestamp are read when the shutter fires,
 * and the capture is classified against the pump location on the spot.
 */
export default function ReportScreen() {
  const { pumpId } = useLocalSearchParams<{ pumpId: string }>();
  const { pumps, addReport } = useStore();
  const pump = pumps.find((p) => p.id === pumpId);

  const cameraRef = useRef<CameraView>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [capture, setCapture] = useState<Capture | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [selected, setSelected] = useState<Signal[]>([]);
  const [freeText, setFreeText] = useState("");
  const [litres, setLitres] = useState("");
  const [amount, setAmount] = useState("");

  if (!pump) return <Text style={{ padding: 20 }}>Pump not found.</Text>;

  async function takePhoto() {
    if (!pump || capturing) return;
    setCapturing(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Location needed",
          "Your location at capture time is what makes a report verifiable. You can still file without it — the report will show as unverified.",
        );
      }
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
        setCapture({ photoUri: photo.uri, verification, distanceM });
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

  function submit() {
    if (!pump || !capture || selected.length === 0) return;
    addReport({
      pumpId: pump.id,
      signals: selected,
      freeText: freeText.trim() || undefined,
      litres: litres ? Number(litres) : undefined,
      amountInr: amount ? Number(amount) : undefined,
      verification: capture.verification,
      distanceToPumpM:
        capture.verification === "geo_verified" ? capture.distanceM : undefined,
      photoUri: capture.photoUri,
    });
    Alert.alert(
      "Report filed",
      capture.verification === "geo_verified"
        ? `Geo-verified ${Math.round(capture.distanceM)} m from the pump. You can escalate it into a formal complaint from the pump page.`
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
      <View
        style={{ borderRadius: 16, overflow: "hidden", height: 300 }}
      >
        {capture ? (
          <View style={{ flex: 1 }}>
            <Image
              source={{ uri: capture.photoUri }}
              style={{ flex: 1 }}
              resizeMode="cover"
            />
            <View
              style={{
                position: "absolute",
                top: 10,
                left: 10,
                backgroundColor:
                  capture.verification === "geo_verified"
                    ? colors.geoBg
                    : "#F0EDE6",
                borderRadius: 999,
                paddingHorizontal: 10,
                paddingVertical: 3,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "700",
                  color:
                    capture.verification === "geo_verified"
                      ? colors.geoText
                      : "#8A7A4E",
                }}
              >
                {capture.verification === "geo_verified"
                  ? `✓ GPS locked · ${Math.round(capture.distanceM)} m from pump`
                  : capture.verification === "location_mismatch"
                    ? `Location mismatch · ${Math.round(capture.distanceM)} m away`
                    : "Location unavailable"}
              </Text>
            </View>
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
        <TextInput
          placeholder="Litres"
          keyboardType="decimal-pad"
          value={litres}
          onChangeText={setLitres}
          style={input}
        />
        <TextInput
          placeholder="Amount ₹"
          keyboardType="number-pad"
          value={amount}
          onChangeText={setAmount}
          style={input}
        />
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
        disabled={!capture || selected.length === 0}
        style={[
          primaryBtn,
          (!capture || selected.length === 0) && { opacity: 0.4 },
        ]}
      >
        <Text style={primaryBtnText}>
          {capture
            ? selected.length
              ? "File report"
              : "Select at least one signal"
            : "Take a photo first"}
        </Text>
      </Pressable>
      <Text
        style={{
          fontSize: 11.5,
          color: colors.muted,
          textAlign: "center",
        }}
      >
        Photos are captured live in-app. Location and time are recorded at
        capture — that's what makes your report evidence.
      </Text>
    </ScrollView>
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
  flex: 1,
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
