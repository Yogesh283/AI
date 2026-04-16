import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useCallback, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PersonaArjunIllustration } from "../components/PersonaArjunIllustration";
import {
  normalizeVoicePersonaId,
  type VoicePersonaId,
  VOICE_PERSONA_STORAGE_KEY,
} from "../constants/voicePersonas";
import { neoUi } from "../constants/neoUi";
import { NEO } from "../constants/theme";
import { getStoredToken, getStoredUser, patchVoicePersona } from "../lib/auth";

const CHOICES: { id: VoicePersonaId; title: string; subtitle: string }[] = [
  { id: "sara", title: "Sara", subtitle: "Woman · human style" },
  { id: "arjun", title: "Arjun", subtitle: "Man · human style" },
];

export default function VoicePersonaScreen() {
  const insets = useSafeAreaInsets();
  const [active, setActive] = useState<VoicePersonaId>("sara");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const u = await getStoredUser();
        if (u?.voice_persona_id) {
          setActive(normalizeVoicePersonaId(u.voice_persona_id));
          return;
        }
        const raw = await AsyncStorage.getItem(VOICE_PERSONA_STORAGE_KEY);
        setActive(normalizeVoicePersonaId(raw));
      })();
    }, []),
  );

  async function select(id: VoicePersonaId) {
    if (busy || id === active) return;
    setErr(null);
    setBusy(true);
    try {
      await AsyncStorage.setItem(VOICE_PERSONA_STORAGE_KEY, id);
      setActive(id);
      const token = await getStoredToken();
      if (token) {
        await patchVoicePersona(id);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={neoUi.screen}>
      <LinearGradient colors={["#0B0E14", "#05070C"]} style={StyleSheet.absoluteFill} />
      <ScrollView
        contentContainerStyle={[
          neoUi.padScreen,
          { paddingBottom: 48 + insets.bottom, paddingTop: 12 + insets.top },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={() => router.back()}
          style={styles.back}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.85)" />
          <Text style={styles.backT}>Back</Text>
        </Pressable>

        <Text style={neoUi.h1Sm}>Voice face</Text>
        <Text style={neoUi.sub}>Choose man or woman for voice mode.</Text>

        <View style={styles.grid}>
          {CHOICES.map((c) => {
            const on = active === c.id;
            return (
              <Pressable
                key={c.id}
                onPress={() => void select(c.id)}
                disabled={busy}
                style={[styles.card, on && styles.cardOn]}
              >
                <View style={styles.preview}>
                  {c.id === "arjun" ? (
                    <PersonaArjunIllustration />
                  ) : (
                    <Image
                      source={require("../assets/voice-care-hero.png")}
                      style={StyleSheet.absoluteFillObject}
                      resizeMode="cover"
                    />
                  )}
                </View>
                <Text style={styles.cardTitle}>{c.title}</Text>
                <Text style={styles.cardSub}>{c.subtitle}</Text>
                {on ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeT}>Selected</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        {err ? (
          <Text style={styles.err} accessibilityRole="alert">
            {err}
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 16,
    alignSelf: "flex-start",
  },
  backT: { color: "rgba(255,255,255,0.8)", fontSize: 16, fontWeight: "600" },
  grid: { marginTop: 20, gap: 14 },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 12,
    overflow: "hidden",
  },
  cardOn: {
    borderColor: `${NEO.cyan}88`,
    backgroundColor: "rgba(0,212,255,0.08)",
  },
  preview: {
    aspectRatio: 3 / 4,
    width: "100%",
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#0a0f18",
    marginBottom: 10,
  },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#fff" },
  cardSub: { marginTop: 4, fontSize: 12, color: "rgba(255,255,255,0.45)" },
  badge: {
    position: "absolute",
    right: 14,
    top: 14,
    backgroundColor: NEO.cyan,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeT: { fontSize: 10, fontWeight: "800", color: "#0a0d12" },
  err: { marginTop: 12, color: "#fbbf24", fontSize: 13 },
});
