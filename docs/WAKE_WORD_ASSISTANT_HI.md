# वेक वर्ड असिस्टेंट — योजना व दिशा (हिंदी)

इस ऐप में यूज़र असिस्टेंट को नाम से बुलाता है: **Neo / नियो** (और वैकल्पिक रूप से NeoXAI) — यही वेक वर्ड है। आपके प्रोजेक्ट को इस नाम सुनकर सक्रिय होना है और फिर विभिन्न कार्रवाइयों (जैसे कॉल या मैसेज) को ट्रिगर करना है। इसके लिए आपको कुछ मुख्य घटक जोड़ने होंगे। सबसे पहले, वॉइस कमांड के लिए एक स्पीच रिकग्निशन लाइब्रेरी (जैसे Web Speech API फ्रंटएंड पर या किसी क्लाउड स्पीच-टू-टेक्स्ट API) का उपयोग करें, ताकि नाम बोलने पर ऐप “जाग” सके। फिर, इवेंट हैंडलर्स बनाएं जो उस पहचाने गए कमांड के आधार पर संबंधित कार्य (जैसे किसी API को कॉल, वॉट्सऐप का लिंक खोलना, या कॉल शुरू करना) ट्रिगर करें। सुरक्षा पर ध्यान देते हुए, आप यूज़र को सेफ्टी प्रम्प्ट भी दे सकते हैं। इस तरह, आपका प्रोजेक्ट एक तरह के “वेक वर्ड” असिस्टेंट की तरह काम करेगा।

---

## Technical pointers (codebase)

| Piece | Location |
|--------|----------|
| Speech recognition (browser STT) | `web/src/lib/voiceChat.ts` — `createSpeechRecognition`, Web Speech API |
| Wake phrase helpers (Neo / नियो / NeoXAI — strip / match) | `web/src/lib/wakeWord.ts` — `buildWakePhrases()` |
| “Open WhatsApp” → opens [web.whatsapp.com](https://web.whatsapp.com) in a new tab | `web/src/lib/whatsappOpenCommand.ts` — voice + text chat (no wake phrase required) |

**Safety:** Never auto-dial or open payment links without explicit user confirmation; prefer showing a confirmation step for calls, SMS, and external URLs.

**Cloud STT:** For always-on or custom wake-word models, consider streaming to a cloud speech API; the Web Speech API is good for turn-based chat but is not a dedicated wake-word engine.
