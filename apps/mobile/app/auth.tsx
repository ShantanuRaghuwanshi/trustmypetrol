import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { colors } from "@/lib/theme";

/**
 * Email OTP sign-in: zero-config on Supabase and enough identity to anchor
 * rate limits. Phone OTP slots in here once an SMS provider is configured.
 */
export default function AuthScreen() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);

  async function sendCode() {
    if (!supabase || busy) return;
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    });
    setBusy(false);
    if (error) {
      Alert.alert("Couldn't send code", error.message);
      return;
    }
    setStage("code");
  }

  async function verifyCode() {
    if (!supabase || busy) return;
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "email",
    });
    setBusy(false);
    if (error) {
      Alert.alert("Couldn't verify", error.message);
      return;
    }
    router.back();
  }

  return (
    <View style={{ padding: 20, gap: 14 }}>
      <Text style={{ fontSize: 15, lineHeight: 22 }}>
        Sign in to file reports. One account per person is what keeps pump
        scores honest — we only use your email to send a sign-in code.
      </Text>

      {stage === "email" ? (
        <>
          <TextInput
            placeholder="you@example.com"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            style={input}
          />
          <Pressable
            style={[btn, (!email.includes("@") || busy) && { opacity: 0.4 }]}
            disabled={!email.includes("@") || busy}
            onPress={sendCode}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={btnText}>Send sign-in code</Text>
            )}
          </Pressable>
        </>
      ) : (
        <>
          <Text style={{ color: colors.muted, fontSize: 13 }}>
            Enter the 6-digit code sent to {email.trim()}
          </Text>
          <TextInput
            placeholder="123456"
            keyboardType="number-pad"
            value={code}
            onChangeText={setCode}
            maxLength={6}
            style={[input, { letterSpacing: 6, fontWeight: "700" }]}
          />
          <Pressable
            style={[btn, (code.length !== 6 || busy) && { opacity: 0.4 }]}
            disabled={code.length !== 6 || busy}
            onPress={verifyCode}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={btnText}>Verify & sign in</Text>
            )}
          </Pressable>
          <Pressable onPress={() => setStage("email")}>
            <Text style={{ color: colors.petrol, fontWeight: "600", fontSize: 13 }}>
              Use a different email
            </Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const input = {
  backgroundColor: colors.card,
  borderColor: colors.line,
  borderWidth: 1,
  borderRadius: 12,
  paddingHorizontal: 14,
  paddingVertical: 12,
  fontSize: 15,
} as const;

const btn = {
  backgroundColor: colors.petrol,
  borderRadius: 12,
  padding: 14,
} as const;

const btnText = {
  color: "#fff",
  fontWeight: "700" as const,
  textAlign: "center" as const,
  fontSize: 15,
};
