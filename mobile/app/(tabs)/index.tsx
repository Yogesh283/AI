import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import * as Speech from "expo-speech";
import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PersonaArjunIllustration } from "../../components/PersonaArjunIllustration";
import {
  normalizeVoicePersonaId,
  type VoicePersonaId,
  VOICE_PERSONA_STORAGE_KEY,
} from "../../constants/voicePersonas";
import { getStoredUser } from "../../lib/auth";
import { postChat, transcribeRecording } from "../../lib/api";

type Msg = { role: "user" | "assistant"; content: string };

const L = {
  bg: "#F7F7F8",
  surface: "#FFFFFF",
  text: "#0d0d0d",
  muted: "#6e6e80",
  border: "#E5E5E5",
  green: "#10a37f",
  placeholder: "#8e8ea0",
};

const WELCOME: Msg = {
  role: "assistant",
  content:
    "Namaste! Main NeoXAI hoon — Hindi ya English mein poochho; yahin type karke bhi bhej sakte ho, ya mic se bolo.",
};

const SUGGESTIONS: {
  label: string;
  prompt: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}[] = [
  { label: "Create image", prompt: "I want to create an image. Guide me.", icon: "image-outline", color: "#16a34a" },
  { label: "Help me write", prompt: "Help me write something clear and concise.", icon: "create-outline", color: "#9333ea" },
  { label: "Get advice", prompt: "I need practical advice on a decision.", icon: "school-outline", color: "#2563eb" },
  { label: "Analyze images", prompt: "How should I analyze or describe images?", icon: "eye-outline", color: "#4f46e5" },
];

export default function AssistantHome() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ new?: string }>();
  const [msgs, setMsgs] = useState<Msg[]>([WELCOME]);
  const msgsRef = useRef(msgs);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceExpanded, setVoiceExpanded] = useState(false);
  const [voicePersonaId, setVoicePersonaId] = useState<VoicePersonaId>("sara");
  const [err, setErr] = useState<string | null>(null);

  const recordingRef = useRef<Audio.Recording | null>(null);

  useEffect(() => {
    msgsRef.current = msgs;
  }, [msgs]);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        try {
          const u = await getStoredUser();
          if (u?.voice_persona_id) {
            const id = normalizeVoicePersonaId(u.voice_persona_id);
            setVoicePersonaId(id);
            await AsyncStorage.setItem(VOICE_PERSONA_STORAGE_KEY, id);
            return;
          }
        } catch {
          /* ignore */
        }
        const raw = await AsyncStorage.getItem(VOICE_PERSONA_STORAGE_KEY);
        setVoicePersonaId(normalizeVoicePersonaId(raw));
      })();
    }, []),
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
          language: "en-US",
          rate: 0.88,
          onDone: () => resolve(),
          onStopped: () => resolve(),
        });
      }),
    [],
  );

  const deliverFromApi = useCallback(
    async (next: Msg[], manageThinking: boolean, source: "chat" | "voice") => {
      if (manageThinking) setThinking(true);
      Speech.stop();
      try {
        const u = await getStoredUser();
        const uid = u?.id ?? "default";
        const { reply } = await postChat(
          next.map((m) => ({ role: m.role, content: m.content })),
          uid,
          { source },
        );
        const withReply = [...next, { role: "assistant" as const, content: reply }];
        setMsgs(withReply);
        if (source === "voice") {
          setSpeaking(true);
          await speak(reply);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Chat failed";
        setErr(msg);
        setMsgs([
          ...next,
          {
            role: "assistant",
            content:
              "Backend connect nahi hua. PC par API port 8010; same Wi‑Fi par EXPO_PUBLIC_API_URL set karein.",
          },
        ]);
      } finally {
        if (manageThinking) setThinking(false);
        setSpeaking(false);
      }
    },
    [speak],
  );

  async function sendText() {
    const text = input.trim();
    if (!text || loading || thinking || speaking) return;
    setInput("");
    setErr(null);
    const prev = msgsRef.current;
    const next = [...prev, { role: "user" as const, content: text }];
    setMsgs(next);
    setLoading(true);
    try {
      await deliverFromApi(next, false, "chat");
    } finally {
      setLoading(false);
    }
  }

  async function sendPrompt(prompt: string) {
    if (loading || thinking || speaking || listening) return;
    setErr(null);
    const prev = msgsRef.current;
    const next = [...prev, { role: "user" as const, content: prompt }];
    setMsgs(next);
    setLoading(true);
    try {
      await deliverFromApi(next, false, "chat");
    } finally {
      setLoading(false);
    }
  }

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
          setErr("Transcription khali — zor se bolo.");
          return;
        }
        const prev = msgsRef.current;
        const next = [...prev, { role: "user" as const, content: text }];
        setMsgs(next);
        await deliverFromApi(next, false, "voice");
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
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      recordingRef.current = recording;
      setListening(true);
      setVoiceExpanded(true);
    } catch {
      setErr("Recording start nahi ho payi.");
    }
  }, [listening, thinking, speaking, deliverFromApi]);

  const resetConversation = useCallback(() => {
    Speech.stop();
    setMsgs([WELCOME]);
    setErr(null);
    setInput("");
  }, []);

  useEffect(() => {
    if (params.new !== "1") return;
    resetConversation();
    router.setParams({ new: undefined });
  }, [params.new, resetConversation]);

  const busy = loading || thinking;
  const showHero = msgs.length <= 1;

  return (
    <View style={styles.root}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: 120 + insets.bottom },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {showHero ? (
            <>
              <Text style={styles.heroTitle}>What can I help with?</Text>
              <Text style={styles.heroSub}>{msgs[0]?.content}</Text>
            </>
          ) : null}

          {voiceExpanded ? (
            <View style={styles.voiceHero}>
              <LinearGradient
                colors={["rgba(0, 168, 204, 0.14)", "rgba(109, 40, 217, 0.1)", "rgba(5, 8, 14, 0.95)"]}
                style={styles.voiceGlow}
              />
              <View style={styles.voiceHeroFrame}>
                {voicePersonaId === "arjun" ? (
                  <PersonaArjunIllustration />
                ) : (
                  <Image
                    source={require("../../assets/voice-care-hero.png")}
                    style={StyleSheet.absoluteFillObject}
                    resizeMode="cover"
                    accessibilityIgnoresInvertColors
                  />
                )}
              </View>
              <Text style={styles.voiceHint}>
                {listening
                  ? "Listening… tap mic again to send"
                  : thinking
                    ? "Thinking…"
                    : speaking
                      ? "Speaking…"
                      : "Tap mic to speak, or type below"}
              </Text>
            </View>
          ) : null}

          {showHero ? (
            <View style={styles.grid2}>
              {SUGGESTIONS.map((s) => (
                <Pressable
                  key={s.label}
                  style={[styles.suggestion, busy && styles.suggestionOff]}
                  disabled={busy || listening}
                  onPress={() => void sendPrompt(s.prompt)}
                >
                  <View style={[styles.sugIcon, { borderColor: s.color + "44" }]}>
                    <Ionicons name={s.icon} size={22} color={s.color} />
                  </View>
                  <Text style={styles.sugText}>{s.label}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {!showHero
            ? msgs.slice(1).map((m, i) => (
                <View
                  key={i}
                  style={[
                    styles.bubblePad,
                    m.role === "user" ? styles.userOuter : styles.asstOuter,
                  ]}
                >
                  {m.role === "assistant" ? (
                    <View style={styles.bubbleAsst}>
                      <Text style={styles.bubbleT}>{m.content}</Text>
                    </View>
                  ) : (
                    <View style={styles.bubbleUser}>
                      <Text style={styles.bubbleT}>{m.content}</Text>
                    </View>
                  )}
                </View>
              ))
            : null}

          {busy && !listening ? (
            <View style={styles.typing}>
              <View style={styles.dot} />
              <View style={[styles.dot, { opacity: 0.7 }]} />
              <View style={[styles.dot, { opacity: 0.45 }]} />
            </View>
          ) : null}

          {err ? (
            <Text style={styles.err} accessibilityRole="alert">
              {err}
            </Text>
          ) : null}

          {!voiceExpanded ? (
            <Pressable
              style={styles.memoryLink}
              onPress={() => router.push("/(tabs)/memory")}
            >
              <Ionicons name="library-outline" size={18} color={L.muted} />
              <Text style={styles.memoryLinkT}>Memory</Text>
            </Pressable>
          ) : null}
        </ScrollView>

        <View style={[styles.composerWrap, { paddingBottom: 10 + insets.bottom }]}>
          <View style={styles.composer}>
            <Pressable style={styles.plusBtn} hitSlop={8} accessibilityLabel="Attach">
              <Ionicons name="add" size={26} color={L.text} />
            </Pressable>
            <TextInput
              style={styles.input}
              placeholder="Ask NeoXAI"
              placeholderTextColor={L.placeholder}
              value={input}
              onChangeText={setInput}
              onSubmitEditing={() => void sendText()}
              editable={!busy && !listening}
              returnKeyType="send"
            />
            <Pressable
              onPress={() => void toggleMic()}
              disabled={busy && !listening}
              style={styles.micSide}
              hitSlop={8}
            >
              <Ionicons
                name="mic-outline"
                size={24}
                color={listening ? L.green : L.muted}
              />
            </Pressable>
            <Pressable
              style={[styles.voiceModeBtn, voiceExpanded && styles.voiceModeOn]}
              onPress={() => setVoiceExpanded((v) => !v)}
              accessibilityLabel="Voice mode"
            >
              <Ionicons name="pulse-outline" size={22} color={voiceExpanded ? "#fff" : L.green} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: L.bg },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 16, paddingTop: 8 },
  heroTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: L.text,
    textAlign: "center",
    marginTop: 12,
    marginBottom: 10,
  },
  heroSub: {
    fontSize: 15,
    lineHeight: 22,
    color: L.muted,
    textAlign: "center",
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  grid2: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "space-between",
    marginBottom: 20,
  },
  suggestion: {
    width: "48%",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: L.border,
    backgroundColor: L.surface,
  },
  suggestionOff: { opacity: 0.45 },
  sugIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.02)",
  },
  sugText: { flex: 1, color: L.text, fontSize: 14, fontWeight: "600" },
  voiceHero: {
    alignItems: "center",
    marginBottom: 20,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#05080e",
  },
  voiceGlow: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    opacity: 1,
    top: -40,
    alignSelf: "center",
  },
  voiceHeroFrame: {
    width: "100%",
    maxWidth: 320,
    aspectRatio: 3 / 4,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "#0a0f18",
    alignSelf: "center",
    overflow: "hidden",
  },
  voiceHint: { marginTop: 12, fontSize: 12, color: "rgba(255,255,255,0.45)", textAlign: "center" },
  bubblePad: { maxWidth: "100%" },
  userOuter: { alignSelf: "flex-end" },
  asstOuter: { alignSelf: "flex-start" },
  bubbleAsst: {
    maxWidth: "92%",
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: L.border,
    backgroundColor: L.surface,
  },
  bubbleUser: {
    maxWidth: "92%",
    padding: 14,
    borderRadius: 18,
    backgroundColor: "rgba(16,163,127,0.15)",
    borderWidth: 1,
    borderColor: "rgba(16,163,127,0.35)",
  },
  bubbleT: { color: L.text, fontSize: 15, lineHeight: 22 },
  typing: { flexDirection: "row", gap: 6, paddingVertical: 8 },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: L.green,
  },
  err: { marginTop: 8, color: "#b45309", fontSize: 13 },
  memoryLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "center",
    marginTop: 16,
    paddingVertical: 8,
  },
  memoryLinkT: { fontSize: 13, color: L.muted, fontWeight: "600" },
  composerWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    backgroundColor: L.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: L.border,
  },
  composer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: L.border,
    backgroundColor: L.surface,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  plusBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: L.text,
    paddingVertical: 10,
    maxHeight: 120,
  },
  micSide: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  voiceModeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: L.green,
    backgroundColor: L.surface,
  },
  voiceModeOn: {
    backgroundColor: L.green,
    borderColor: L.green,
  },
});
