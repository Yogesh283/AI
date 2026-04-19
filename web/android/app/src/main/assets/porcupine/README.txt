Picovoice Porcupine (streaming wake)
===================================

1. Create a free access key: https://console.picovoice.ai/
2. Train a custom wake phrase (e.g. "Hello Neo") for the Android platform and download the .ppn file.
3. Rename/copy it to: hello_neo.ppn in this folder (path: assets/porcupine/hello_neo.ppn).
4. Set Gradle property PV_ACCESS_KEY in ~/.gradle/gradle.properties or web/android/gradle.properties (uncomment the line), or set environment variable PV_ACCESS_KEY before building.
5. In the app, enable streaming wake: NeoPrefs.setWakePorcupineStreamEnabled(context, true) — Capacitor bridge: NeoNativeRouter.setWakePorcupineStream({ enabled: true }).

Hindi "हेलो नियो": train the phrase in Console with the Hindi language option and add the matching .pv model to assets if Picovoice requires it; set NeoPrefs.setPorcupineKeywordAssetPath if your filename differs.

Default remains SpeechRecognizer until the toggle and assets + key are present.
