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
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "@/lib/supabase";
import { colors } from "@/lib/theme";

WebBrowser.maybeCompleteAuthSession();

/**
 * Email OTP sign-in: zero-config on Supabase and enough identity to anchor
 * rate limits. Phone OTP slots in here once an SMS provider is configured.
 */
export default function AuthScreen() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);

  async function signInWithGoogle() {
    if (!supabase || busy) return;
    setBusy(true);
    try {
      // exp://…/auth in Expo Go, trustmypetrol://auth in standalone builds —
      // both must be listed under Supabase → Auth → URL Configuration.
      const redirectTo = Linking.createURL("auth");
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error || !data.url) {
        Alert.alert("Couldn't start Google sign-in", error?.message ?? "");
        return;
      }
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectTo,
      );
      if (result.type !== "success") return; // user cancelled
      const params = Linking.parse(result.url).queryParams ?? {};
      const code = typeof params.code === "string" ? params.code : null;
      if (!code) {
        Alert.alert(
          "Sign-in incomplete",
          "Google didn't return a session code. Check that this redirect URL is allowed in Supabase: " +
            redirectTo,
        );
        return;
      }
      const { error: exchangeError } =
        await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) {
        Alert.alert("Couldn't sign in", exchangeError.message);
        return;
      }
      router.back();
    } finally {
      setBusy(false);
    }
  }

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

      <Pressable
        style={[btnOutline, busy && { opacity: 0.4 }]}
        disabled={busy}
        onPress={signInWithGoogle}
      >
        <Text style={btnOutlineText}>Continue with Google</Text>
      </Pressable>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.line }} />
        <Text style={{ color: colors.muted, fontSize: 12 }}>
          or use an email code
        </Text>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.line }} />
      </View>

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

const btnOutline = {
  backgroundColor: colors.card,
  borderColor: colors.petrol,
  borderWidth: 1.5,
  borderRadius: 12,
  padding: 13,
} as const;

const btnOutlineText = {
  color: colors.petrol,
  fontWeight: "700" as const,
  textAlign: "center" as const,
  fontSize: 15,
};

const btnText = {
  color: "#fff",
  fontWeight: "700" as const,
  textAlign: "center" as const,
  fontSize: 15,
};
