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

> "AI को निर्देश दीजिए कि वॉयस कमांड या वॉयस चैट (ऑन-स्क्रीन और ऑफ-स्क्रीन दोनों) पूरी तरह निष्क्रिय रहे जब तक यूज़र स्पष्ट रूप से 'Hello Neo' न बोले। वेक-वर्ड से पहले किसी भी तरह की आवाज, बीप, टोन, संकेत, UI प्रतिक्रिया, या टेक्स्ट प्रतिक्रिया नहीं होनी चाहिए; सिस्टम ऐसा लगे जैसे पूरी तरह पैसिव है। केवल 'Hello Neo' सुनने पर ही Active Mode में जाएं, सुनना शुरू करें, कमांड प्रोसेस करें और प्रतिक्रिया दें। अगर वेक-वर्ड पहचाने जाने में संदेह हो तो fail-safe रूप से passive ही रहें। यह wake-word gating policy सभी सामान्य voice rules से higher priority पर लागू हो।"

## 9) Voice Command Execution Directive (Hindi)

Use the following as the official AI/dev instruction for voice-command handling quality:

> "AI को निर्देश दें कि यूज़र के बोले हुए हर कमांड को समझकर, तुरंत उसे पूरा करें। जब यूज़र बोले 'WhatsApp खोलो', 'YouTube खोलो', 'मेरा कॉन्टैक्ट खोलो', या 'इस गाने को प्ले करो', तो AI बिना दोहराए और बिना सवाल किए, दिए गए निर्देशों को समझकर उन्हें पूरा करे। किसी भी ऐप खोलना, किसी को कॉल लगाना, गाना प्ले करना, सभी कमांड्स यूज़र के बोले अनुसार ही हों। AI का लक्ष्य यह हो कि यूज़र को हर बार सहज, स्वाभाविक और सटीक प्रतिक्रिया मिले, ताकि वे बिना किसी बाधा के जो चाहें, वह तुरंत हासिल कर सकें।"

Execution notes:
- If intent is clear and safe, execute first, then give a short confirmation.
- Ask follow-up only when command is ambiguous or blocked (missing app, missing contact, permission denied).
- Avoid long re-prompts and avoid repeating user sentence unless needed for disambiguation.

## 10) Foreground-only & silence policy (Hindi)

Official product instruction:

> "AI को निर्देश दें कि वॉयस कमांड केवल तभी सक्रिय हो जब यूज़र आपकी AI असिस्टेंट ऐप खोलें। ऐप बंद होने या बैकग्राउंड में होने पर, कोई वॉयस कमांड न सुनें और न ही प्रतिक्रिया दें। यदि कोई अन्य ऐप या मीडिया चल रहा हो, तो कोई भी आवाज न आए। स्क्रीन ऑफ हो तो भी, केवल तब वॉयस चैट चालू हो जब यूज़र स्पष्ट रूप से 'Hello Neo' कहें। अन्यथा, किसी भी परिस्थिति में, कोई माफ़ी, कोई रिपीट अनुरोध, या कोई अन्य प्रतिक्रिया न दें। ऐप के बाहर सिस्टम एकदम शांत और निष्क्रिय रहे।"

Implementation pointers:

- APK: **`MainActivity.onUserLeaveHint`** → stop wake when user leaves Neo for another app; **`onStop`** stops wake only if screen-off listen and wake voice-chat are both off (lock / screen-off + Hello Neo path preserved when those toggles are on).
- Bridge: **`ignoreWebVisibilityWhen`** in `neoWakeNative.ts` so screen-off does not incorrectly `stopWakeListener` while native policy keeps the FGS.
- **`speakCommandNotUnderstood`** does not speak (no apology / repeat prompt).
- **`AudioManager.isMusicActive()`**: defer wake mic handling + block assistant `speak()` while external media plays.

## 11) In-app voice + lock-screen Hello Neo & tone (Hindi)

Official product instruction:

> "AI को इस तरह निर्देश दें कि वॉयस कमांड केवल उसी ऐप के अंदर सक्रिय हो जहाँ इसे बनाया गया है—उदाहरण के लिए, जब यूज़र Neo AI Assistant ऐप खोलें, तब ही वॉयस कमांड सुनें और पूरा करें। जब फोन लॉक हो या स्क्रीन ऑफ हो, तब 'Hello Neo' वेक-वर्ड के बाद वॉयस चैट सुचारु रूप से चले। सिस्टम को ऐसा बनाया जाए कि वह मानव जैसा सहज, दोस्ताना और समझदार हो। जब यूज़र बोले, तो कोशिश हो कि हर इनपुट समझा जाए और उसी के आधार पर जवाब दिया जाए। पूरी बातचीत और कमांड प्रोसेसिंग स्मूद, बिना बाधा और स्पष्ट हो, ताकि यूज़र को हमेशा एक भरोसेमंद और सहज अनुभव मिले।"

Backend voice tone: `backend/app/routers/voice.py` (Realtime instructions) and `backend/app/routers/chat.py` (`voice` source system prompt) include concise “friendly, smooth, grounded in user words” guidance.

