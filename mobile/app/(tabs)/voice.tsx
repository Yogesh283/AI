import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as Speech from "expo-speech";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { getNeoAvatar, readStoredAvatarId, type NeoAvatar } from "../../constants/avatars";
import { NEO } from "../../constants/theme";
import { postChat, transcribeRecording } from "../../lib/api";

export default function VoiceTab() {
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [avatar, setAvatar] = useState<NeoAvatar>(() => getNeoAvatar(null));
  const [err, setErr] = useState<string | null>(null);
  const [lastUser, setLastUser] = useState("");
  const [lastReply, setLastReply] = useState(
    "Mic dabao → record → dubara dabao bhejne ke liye (Whisper + GPT)."
  );
  const [lang, setLang] = useState<"en-IN" | "hi-IN">("en-IN");

  const recordingRef = useRef<Audio.Recording | null>(null);
  const historyRef = useRef<{ role: "user" | "assistant"; content: string }[]>([]);

  useFocusEffect(
    useCallback(() => {
      readStoredAvatarId().then((id) => {
        setAvatar(getNeoAvatar(id));
      });
    }, [])
  );

  useEffect(() => {
    void Audio.requestPermissionsAsync();
    void Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
    return () => {
      Speech.stop();
      const r = recordingRef.current;
      recordingRef.current = null;
      if (r) {
        r.stopAndUnloadAsync().catch(() => undefined);
      }
    };
  }, []);

  const speak = useCallback(
    (text: string) =>
      new Promise<void>((resolve) => {
        const cleaned = text
          .replace(/https?:\/\/\S+/gi, " ")
          .replace(/\p{Extended_Pictographic}/gu, " ")
          .replace(/[\uFE0F\u200D]/g, "")
          .replace(/\s+/g, " ")
          .trim();
        if (!cleaned) {
          resolve();
          return;
        }
        Speech.speak(cleaned, {
          language: lang === "hi-IN" ? "hi-IN" : "en-US",
          rate: 0.88,
          onDone: () => resolve(),
          onStopped: () => resolve(),
        });
      }),
    [lang]
  );

  /** When manageThinking is true, this function toggles thinking around GPT+TTS (quick prompts). */
  const deliverAssistant = useCallback(
    async (userText: string, manageThinking: boolean) => {
      const trimmed = userText.trim();
      if (!trimmed) return;
      setErr(null);
      setLastUser(trimmed);
      if (manageThinking) setThinking(true);
      Speech.stop();
      try {
        const msgs = [
          ...historyRef.current,
          { role: "user" as const, content: trimmed },
        ];
        const { reply } = await postChat(msgs, "default", { source: "voice" });
        const next = [...msgs, { role: "assistant" as const, content: reply }];
        historyRef.current = next;
        setLastReply(reply);
        setSpeaking(true);
        await speak(reply);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Chat failed";
        setErr(msg);
        setLastReply(
          "Backend: EXPO_PUBLIC_API_URL + PC par API (8010). OPENAI_API_KEY Whisper ke liye."
        );
      } finally {
        if (manageThinking) setThinking(false);
        setSpeaking(false);
      }
    },
    [speak]
  );

  const toggleMic = useCallback(async () => {
    if (thinking || speaking) return;

    if (listening) {
      const rec = recordingRef.current;
      recordingRef.current = null;
      setListening(false);
      if (!rec) return;
      setThinking(true);
      setErr(null);
      try {
        await rec.stopAndUnloadAsync();
        const uri = rec.getURI();
        if (!uri) {
          setErr("Recording save nahi hui.");
          return;
        }
        const text = await transcribeRecording(uri);
        if (!text) {
          setErr("Transcription khali — zor se bolo / thodi der record karein.");
          return;
        }
        await deliverAssistant(text, false);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Voice pipeline failed");
      } finally {
        setThinking(false);
      }
      return;
    }

    setErr(null);
    const { granted } = await Audio.requestPermissionsAsync();
    if (!granted) {
      setErr("Settings se mic allow karein.");
      return;
    }
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
    });
    try {
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setListening(true);
    } catch {
      setErr("Recording start nahi ho payi.");
    }
  }, [listening, thinking, speaking, deliverAssistant]);

  const busy = thinking || speaking;
  const pulse = listening || speaking;

  return (
    <View style={styles.root}>
      <LinearGradient colors={["#0B0E14", "#05070C"]} style={StyleSheet.absoluteFill} />
      <View style={styles.top}>
        <Pressable style={styles.iconBtn} onPress={() => router.push("/(tabs)")}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </Pressable>
        <Text style={styles.title}>Voice Mode</Text>
        <View style={styles.langRow}>
          <Pressable
            onPress={() => setLang("en-IN")}
            style={[styles.langChip, lang === "en-IN" && styles.langChipOn]}
          >
            <Text style={styles.langT}>EN</Text>
          </Pressable>
          <Pressable
            onPress={() => setLang("hi-IN")}
            style={[styles.langChip, lang === "hi-IN" && styles.langChipOn]}
          >
            <Text style={styles.langT}>HI</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.status}>
        <View style={[styles.dot, pulse && { opacity: 1 }]} />
        <Text style={styles.statusT}>
          {thinking
            ? "Soch rahi hoon…"
            : speaking
              ? "Bol rahi hoon…"
              : listening
                ? "Record… (dubara dabao stop)"
                : "Mic dabao — start / dubara dabao — bhejo"}
        </Text>
      </View>
      {err ? (
        <Text style={styles.err} accessibilityRole="alert">
          {err}
        </Text>
      ) : null}

      <View style={styles.avatarWrap}>
        <LinearGradient
          colors={["rgba(0,212,255,0.35)", "rgba(189,0,255,0.25)"]}
          style={styles.avatarGlow}
        />
        <View style={styles.avatar}>
          <Text style={styles.emoji}>{avatar.emoji}</Text>
          <Text style={styles.avatarName}>{avatar.name}</Text>
        </View>
      </View>

      <View style={styles.wave}>
        {Array.from({ length: 24 }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.bar,
              {
                height: pulse ? 8 + (i % 5) * 4 : 6,
                opacity: pulse ? 1 : 0.35,
              },
            ]}
          />
        ))}
      </View>

      <View style={styles.transcript}>
        {lastUser ? <Text style={styles.tu}>Aap: {lastUser}</Text> : null}
        <Text style={styles.tneo}>NeoXAI: {lastReply}</Text>
      </View>

      <Text style={styles.qc}>Quick</Text>
      <View style={styles.pills}>
        {["Aaj weather?", "Kal schedule", "Short note", "Code tip"].map((x) => (
          <Pressable
            key={x}
            disabled={busy || listening}
            onPress={() => void deliverAssistant(x, true)}
            style={[styles.pill, (busy || listening) && styles.pillOff]}
          >
            <Text style={styles.pillT}>{x}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        onPress={() => void toggleMic()}
        disabled={busy && !listening}
        style={styles.micOut}
      >
        <LinearGradient colors={[NEO.cyan, NEO.magenta]} style={styles.mic}>
          <Ionicons name="mic" size={36} color="#050912" />
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: NEO.bg, paddingTop: 48, paddingHorizontal: 20 },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: NEO.glass,
    borderWidth: 1,
    borderColor: NEO.border,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 16, fontWeight: "800", color: "#fff" },
  langRow: { flexDirection: "row", gap: 6 },
  langChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  langChipOn: { borderColor: "rgba(0,212,255,0.5)", backgroundColor: "rgba(0,212,255,0.12)" },
  langT: { fontSize: 11, fontWeight: "800", color: "rgba(255,255,255,0.85)" },
  status: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: NEO.glass,
    borderWidth: 1,
    borderColor: "rgba(0,212,255,0.2)",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: NEO.cyan,
  },
  statusT: { color: NEO.cyan, fontWeight: "700", fontSize: 12, flex: 1 },
  err: {
    marginTop: 10,
    color: "#fbbf24",
    fontSize: 12,
    textAlign: "center",
    paddingHorizontal: 8,
  },
  avatarWrap: {
    marginTop: 20,
    alignItems: "center",
    justifyContent: "center",
    height: 220,
  },
  avatarGlow: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 120,
    opacity: 0.9,
  },
  avatar: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "#0c1528",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 8,
    shadowColor: NEO.cyan,
    shadowOpacity: 0.4,
    shadowRadius: 40,
  },
  emoji: { fontSize: 64, lineHeight: 72 },
  avatarName: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "700",
    color: "rgba(255,255,255,0.55)",
  },
  wave: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 3,
    height: 44,
    marginTop: 4,
  },
  bar: {
    width: 3,
    borderRadius: 2,
    backgroundColor: NEO.cyan,
  },
  transcript: {
    marginTop: 16,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    maxHeight: 100,
  },
  tu: { color: "rgba(255,255,255,0.65)", fontSize: 12, marginBottom: 6 },
  tneo: { color: "rgba(255,255,255,0.9)", fontSize: 13, lineHeight: 18 },
  qc: {
    marginTop: 16,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
    color: "rgba(255,255,255,0.35)",
  },
  pills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 10,
    justifyContent: "center",
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  pillOff: { opacity: 0.45 },
  pillT: { color: "rgba(255,255,255,0.75)", fontWeight: "700", fontSize: 12 },
  micOut: { alignItems: "center", marginTop: 20, marginBottom: 24 },
  mic: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: NEO.cyan,
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 16,
  },
});
