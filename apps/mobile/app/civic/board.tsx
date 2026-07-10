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
import { router } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Location from "expo-location";
import { parseBoardText, parseInrAmount } from "@tmp/civic";
import { useCivicStore, type CivicCaptureInput } from "@/lib/civicStore";
import { colors } from "@/lib/theme";

interface Capture extends CivicCaptureInput {
  photoUri: string;
}

/**
 * "Snap the project board": work sites must display a board with the
 * project name, cost, dates, and contractor. One photo + transcription
 * seeds the asset→contract registry — the cheapest real source of
 * contractor accountability data there is. Submissions land in a
 * moderation queue; only reviewed records enter the public registry.
 */
export default function BoardSnapScreen() {
  const { submitBoardSnap, isLive, session } = useCivicStore();
  const cameraRef = useRef<CameraView>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [capture, setCapture] = useState<Capture | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [gpsReady, setGpsReady] = useState(false);

  // Transcription fields — prefilled by the parser, corrected by the citizen.
  const [rawText, setRawText] = useState("");
  const [title, setTitle] = useState("");
  const [contractor, setContractor] = useState("");
  const [cost, setCost] = useState("");
  const [workOrderNo, setWorkOrderNo] = useState("");
  const [startDate, setStartDate] = useState("");
  const [completionDate, setCompletionDate] = useState("");
  const [dlpMonths, setDlpMonths] = useState("");

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setGpsReady(status === "granted");
    })();
  }, []);

  function prefillFromText(text: string) {
    setRawText(text);
    const p = parseBoardText(text);
    if (p.contractorName && !contractor) setContractor(p.contractorName);
    if (p.costInr && !cost) setCost(String(p.costInr));
    if (p.workOrderNo && !workOrderNo) setWorkOrderNo(p.workOrderNo);
    if (p.startDate && !startDate) setStartDate(p.startDate);
    if (p.completionDate && !completionDate)
      setCompletionDate(p.completionDate);
    if (p.dlpMonths && !dlpMonths) setDlpMonths(String(p.dlpMonths));
  }

  async function takePhoto() {
    if (capturing || !gpsReady) return;
    setCapturing(true);
    try {
      const [photo, position] = await Promise.all([
        cameraRef.current?.takePictureAsync({ quality: 0.8 }),
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
    if (!capture || submitting) return;
    if (isLive && !session) {
      router.push("/auth");
      return;
    }
    const isoDate = /^\d{4}-\d{2}-\d{2}$/;
    if (startDate && !isoDate.test(startDate)) {
      Alert.alert("Check the start date", "Use YYYY-MM-DD.");
      return;
    }
    if (completionDate && !isoDate.test(completionDate)) {
      Alert.alert("Check the completion date", "Use YYYY-MM-DD.");
      return;
    }
    setSubmitting(true);
    try {
      await submitBoardSnap({
        capture,
        photoUri: capture.photoUri,
        rawText: rawText.trim() || undefined,
        title: title.trim() || undefined,
        contractorName: contractor.trim() || undefined,
        costInr: cost ? (parseInrAmount(cost) ?? undefined) : undefined,
        workOrderNo: workOrderNo.trim() || undefined,
        startDate: startDate || undefined,
        completionDate: completionDate || undefined,
        dlpMonths: dlpMonths ? Number(dlpMonths) || undefined : undefined,
      });
      Alert.alert(
        "Board submitted",
        "Thanks — after review it joins the public works registry, so every issue on this stretch shows who built it and whether the defect liability period is still running.",
        [{ text: "Done", onPress: () => router.back() }],
      );
    } catch (e) {
      Alert.alert(
        "Couldn't submit",
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
          Project boards are photographed live at the site — that's what makes
          the registry trustworthy.
        </Text>
        <Pressable style={primaryBtn} onPress={requestCameraPermission}>
          <Text style={primaryBtnText}>Allow camera</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      {!capture ? (
        <View style={{ borderRadius: 16, overflow: "hidden", height: 360 }}>
          <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" />
          <Pressable
            style={[shutter, !gpsReady && { opacity: 0.4 }]}
            disabled={!gpsReady || capturing}
            onPress={takePhoto}
          >
            <View style={shutterInner} />
          </Pressable>
          <View style={hint}>
            <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>
              {gpsReady
                ? "Frame the whole board, text readable"
                : "Waiting for location permission…"}
            </Text>
          </View>
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          <Image
            source={{ uri: capture.photoUri }}
            style={{ width: "100%", height: 180, borderRadius: 16 }}
          />
          <Pressable onPress={() => setCapture(null)}>
            <Text style={{ color: colors.petrol, fontWeight: "700", fontSize: 13 }}>
              ↺ Retake photo
            </Text>
          </Pressable>

          <Text style={label}>Board text (paste or type — auto-fills below)</Text>
          <TextInput
            placeholder="e.g. Name of Contractor : … / Cost : ₹ … / DLP : … years"
            value={rawText}
            onChangeText={prefillFromText}
            multiline
            maxLength={4000}
            style={[textArea, { minHeight: 90 }]}
          />

          <Text style={label}>Details (only what the board shows)</Text>
          <TextInput placeholder="Project / work name" value={title} onChangeText={setTitle} style={input} />
          <TextInput placeholder="Contractor name" value={contractor} onChangeText={setContractor} style={input} />
          <TextInput placeholder="Cost (e.g. ₹4.25 crore or 42500000)" value={cost} onChangeText={setCost} style={input} />
          <TextInput placeholder="Work order no." value={workOrderNo} onChangeText={setWorkOrderNo} autoCapitalize="characters" style={input} />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextInput placeholder="Start (YYYY-MM-DD)" value={startDate} onChangeText={setStartDate} style={[input, { flex: 1 }]} />
            <TextInput placeholder="Completion (YYYY-MM-DD)" value={completionDate} onChangeText={setCompletionDate} style={[input, { flex: 1 }]} />
          </View>
          <TextInput
            placeholder="Defect liability period (months)"
            value={dlpMonths}
            onChangeText={setDlpMonths}
            keyboardType="number-pad"
            style={input}
          />

          <Pressable
            style={[primaryBtn, submitting && { opacity: 0.5 }]}
            disabled={submitting}
            onPress={submit}
          >
            <Text style={primaryBtnText}>
              {submitting ? "Submitting…" : "Submit to works registry"}
            </Text>
          </Pressable>
          <Text style={{ fontSize: 12, color: colors.muted, lineHeight: 17 }}>
            Submissions are reviewed before entering the public registry.
            Leave unknown fields blank — a blank is better than a guess.
          </Text>
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

const input = {
  backgroundColor: colors.card,
  borderColor: colors.line,
  borderWidth: 1,
  borderRadius: 12,
  paddingHorizontal: 12,
  paddingVertical: 10,
  fontSize: 13,
};

const textArea = {
  ...input,
  textAlignVertical: "top" as const,
};

const hint = {
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
