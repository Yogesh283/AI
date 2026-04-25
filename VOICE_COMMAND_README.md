# Neo Voice Command Stack (Web + Android APK)

This document explains:
- which libraries are used for voice commands
- what each part does
- where the code lives
- how to test and debug

## 1) Libraries Used

### Web / TypeScript
- `@capacitor/core`  
  Used to detect native platform and call custom native plugin (`NeoNativeRouter`).
- `@capacitor-community/speech-recognition`  
  Native speech capture fallback inside Capacitor WebView when browser STT is limited.
- Browser Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`)  
  Main STT path on web.
- Browser `speechSynthesis`  
  TTS replies on web.

### Android / Native (Java)
- Android `SpeechRecognizer` + `RecognizerIntent`  
  Command tail capture after wake.
- Android `TextToSpeech`  
  Assistant spoken responses (can be suppressed in silent wake routing).
- Android `AudioManager` + `AudioFocusRequest`  
  Audio focus handling and media-aware listening pauses.
- Android `ContentResolver` + `ContactsContract`  
  Contact lookup for call/message by person name.
- Android `Intent.ACTION_VIEW` / package intents  
  Open WhatsApp/Telegram/YouTube/Contacts/Phone and deep links.
- `ai.picovoice:porcupine-android:4.0.0`  
  Wake-word engine (`Hello Neo`) via raw audio stream mode.

### Build/Platform
- Capacitor Android bridge  
  Connects TS code and Java plugin methods.
- Next.js (web shell/UI)  
  Hosts voice UI and command orchestration logic.

## 2) Core Voice Command Files

### Web command pipeline
- `web/src/lib/neoVoiceCommands.ts`  
  Main command parser and intent/action mapper (`processNeoCommandLine`, `runNeoIntents`, `executeNeoActions`).
- `web/src/lib/neoVoiceSession.ts`  
  Follow-up session window after wake phrase.
- `web/src/lib/voiceChat.ts`  
  STT/TTS helpers for browser and native speech plugin fallback.
- `web/src/lib/neoWakeNative.ts`  
  Syncs profile toggles with native wake foreground service.
- `web/src/lib/neoNativeRouter.ts`  
  TS interface for native plugin calls.

### Android native pipeline
- `web/android/app/src/main/java/com/neo/assistant/WakeWordForegroundService.java`  
  Foreground wake listener lifecycle, relisten timing, mic guards, media-aware backoff.
- `web/android/app/src/main/java/com/neo/assistant/PorcupineStreamWake.java`  
  Porcupine wake-word audio loop.
- `web/android/app/src/main/java/com/neo/assistant/NeoCommandRouter.java`  
  Native command execution (open apps, call/message by name, contacts lookup, follow-up prompts).
- `web/android/app/src/main/java/com/neo/assistant/NeoNativeRouterPlugin.java`  
  Capacitor plugin methods: start/stop wake, route command, deep links, app path navigation.
- `web/android/app/src/main/java/com/neo/assistant/NeoPrefs.java`  
  Persistent flags (wake screen-off mode, context, etc.).

## 3) What Is Implemented (Use Cases)

- Wake phrase handling: `Neo`, `Hello Neo`, `नियो`, etc.
- Follow-up flow after wake (user can speak next command without wake again).
- Open apps:
  - WhatsApp, Telegram, YouTube, music app, contacts, profile route
- Calling:
  - Direct by number
  - By contact name (native contacts lookup)
- Messaging:
  - Open WhatsApp/Telegram and compose/send flows for supported patterns
- Time intent and utility intents
- Safety filters and confirmation prompts for risky actions (for example call/send)
- Silent/low-noise routing improvements:
  - guarded mic restarts
  - delayed relisten
  - media playback detection
  - optional screen-off wake behavior

## 4) OpenAI Usage Clarification

Voice command execution (open app/call/message routing) is primarily rule-based + native intents.

- Voice command path: `neoVoiceCommands` + `NeoCommandRouter`
- OpenAI is used in separate conversational voice/chat layers, not as the primary executor for native command routing.

## 5) Permissions and Runtime Gates

Important Android permissions used by voice-command features:
- `RECORD_AUDIO` (speech capture)
- `READ_CONTACTS` (contact name resolution for call/message)

The native plugin requests permissions at runtime when required.

## 6) Test Commands

From `web` directory:

- Voice command smoke tests:
  - `npm run test:voice`
- Production web build:
  - `npm run build`
- APK builds:
  - `npm run apk:release` (requires `web/android/keystore.properties`)
  - `npm run apk:dev` (debug-signing allowed)

## 7) Debug Tips

- Web command parser verification:
  - start with `npm run test:voice`
- Android runtime verification:
  - check `adb logcat` around `NeoCommandRouter`, `NeoWakeService`, `Capacitor`
- If deep links show invalid link in WebView:
  - use native deep-link path via `NeoNativeRouter.openDeepLink`

## 8) Implementation Directive (Hindi)

Use the following as the official AI/dev instruction for Android mic + wake behavior:

> "AI को निर्देश दीजिए कि एंड्रॉयड एप में माइक्रोफ़ोन केवल तब एक्टिव हो जब यूज़र 'Hello Neo' बोले, और यह ऑफ-स्क्रीन में भी ठीक से हो। बाकी समय माइक्रोफ़ोन पूरी तरह बंद रहे। वेक-वर्ड डिटेक्शन के लिए पेसिव लिसनिंग और लो-पावर मोड का उपयोग करें। जब 'Hello Neo' पहचाना जाए, तब कमांड प्रोसेसिंग के दौरान माइक चालू करें, और कमांड पूरा होते ही माइक बंद कर दें। स्क्रीन ऑफ या ऑन, दोनों स्थितियों में वेक-वर्ड डिटेक्शन सक्रिय रहे, लेकिन अन्य ऐप्स या मीडिया पर कोई असर न पड़े। बैकग्राउंड ऑडियो फोकस, मीडिया डिटेक्शन, और परमीशन मैनेजमेंट को ध्यान में रखते हुए यह लॉजिक कोड में लागू किया जाए।"

