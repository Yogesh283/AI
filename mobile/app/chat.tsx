import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { postChat } from "../lib/api";
import { NEO } from "../constants/theme";

type Msg = { role: "user" | "assistant"; content: string };

export default function Chat() {
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Good morning! Yeh aaj ka quick schedule hai — chahein toh reminders bhi set kar doon.",
    },
  ]);
  const [loading, setLoading] = useState(false);

  async function send() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    const next = [...msgs, { role: "user" as const, content: text }];
    setMsgs(next);
    setLoading(true);
    try {
      const data = await postChat(
        next.map((m) => ({ role: m.role, content: m.content })),
        "default"
      );
      setMsgs([...next, { role: "assistant", content: data.reply }]);
    } catch {
      setMsgs([
        ...next,
        {
          role: "assistant",
          content:
            "Backend connect nahi hua. PC par `backend/run_dev.ps1` ya `uvicorn` port 8010 par chalayein; same Wi‑Fi par `EXPO_PUBLIC_API_URL` set karein.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.root}>
      <LinearGradient colors={["#0B0E14", "#05070C"]} style={StyleSheet.absoluteFill} />
      <View style={styles.header}>
        <View style={styles.row}>
          <View style={styles.av}>
            <Text style={{ fontSize: 20 }}>🤖</Text>
          </View>
          <View>
            <Text style={styles.h1}>Chat with Neo</Text>
            <Text style={styles.online}>Online</Text>
          </View>
        </View>
        <View style={styles.row}>
          <Pressable style={styles.hBtn}>
            <Ionicons name="search-outline" size={20} color="rgba(255,255,255,0.65)" />
          </Pressable>
          <Pressable style={styles.hBtn}>
            <Ionicons name="grid-outline" size={20} color="rgba(255,255,255,0.65)" />
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.aiCard}>
          <Text style={styles.aiText}>{msgs[0]?.content}</Text>
          <View style={styles.scheduleBox}>
            <Text style={styles.schedTitle}>Schedule</Text>
            {[
              ["9:00 AM", "Gym"],
              ["11:00 AM", "Meeting"],
              ["2:00 PM", "Focus block"],
            ].map(([t, l]) => (
              <Text key={t} style={styles.schedLine}>
                ☐ {t} — {l}
              </Text>
            ))}
          </View>
        </View>
        {msgs.slice(1).map((m, i) => (
          <View
            key={i}
            style={[
              styles.bubble,
              m.role === "user" ? styles.user : styles.assistant,
            ]}
          >
            <Text style={styles.bubbleT}>{m.content}</Text>
          </View>
        ))}
        {loading ? <Text style={styles.think}>NeoXAI...</Text> : null}
      </ScrollView>

      <View style={styles.inputRow}>
        <Text style={{ opacity: 0.45, fontSize: 18 }}>🎙</Text>
        <TextInput
          style={styles.input}
          placeholder="Ask NeoXAI anything..."
          placeholderTextColor="rgba(255,255,255,0.3)"
          value={input}
          onChangeText={setInput}
          onSubmitEditing={send}
        />
        <Pressable onPress={send}>
          <LinearGradient colors={[NEO.cyan, NEO.magenta]} style={styles.send}>
            <Ionicons name="arrow-forward" size={22} color="#050912" />
          </LinearGradient>
        </Pressable>
      </View>
      <Pressable onPress={() => router.back()} style={styles.backHome}>
        <Text style={styles.backHomeT}>← Home</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: NEO.bg, paddingTop: 48 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  av: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: "#121a2e",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(0,212,255,0.2)",
  },
  h1: { fontSize: 16, fontWeight: "800", color: "#fff" },
  online: { fontSize: 11, color: "#34d399", fontWeight: "700" },
  hBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: NEO.glass,
    borderWidth: 1,
    borderColor: NEO.border,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  scroll: { padding: 16, paddingBottom: 120, gap: 12 },
  aiCard: {
    maxWidth: "96%",
    padding: 16,
    borderRadius: 22,
    backgroundColor: NEO.glass,
    borderWidth: 1,
    borderColor: NEO.border,
  },
  aiText: { color: "rgba(255,255,255,0.88)", fontSize: 14, lineHeight: 20 },
  scheduleBox: {
    marginTop: 14,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.3)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  schedTitle: {
    color: NEO.cyan,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    marginBottom: 8,
  },
  schedLine: { color: "rgba(255,255,255,0.7)", fontSize: 13, marginTop: 4 },
  bubble: { maxWidth: "92%", padding: 14, borderRadius: 20 },
  user: {
    alignSelf: "flex-end",
    backgroundColor: "rgba(13,58,92,0.9)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  assistant: {
    alignSelf: "flex-start",
    backgroundColor: NEO.glass,
    borderWidth: 1,
    borderColor: NEO.border,
  },
  bubbleT: { color: "rgba(255,255,255,0.9)", fontSize: 14, lineHeight: 20 },
  think: { color: "rgba(255,255,255,0.35)", fontSize: 12 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(6,9,16,0.96)",
  },
  input: {
    flex: 1,
    color: "#fff",
    fontSize: 14,
    paddingVertical: 10,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  backHome: { alignItems: "center", paddingBottom: 12 },
  backHomeT: { color: "rgba(255,255,255,0.35)", fontSize: 12 },
});
