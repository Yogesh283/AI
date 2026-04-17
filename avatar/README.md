# 3D avatar (`model.fbx`)

This folder holds the **main 3D character** (FBX) for use in **DCC tools** (Blender, Maya, etc.) or game engines that import FBX.

| File        | Purpose                    |
| ----------- | -------------------------- |
| `model.fbx` | Rigged mesh / avatar asset |

## 3D प्लेटफॉर्म विकल्प (Unity के अलावा)

Unity ज़रूरी नहीं — अवतार और एनीमेशन के लिए आप ये दिशाएँ ले सकते हो:

| विकल्प | कब उपयोगी |
| ------ | --------- |
| **[Unreal Engine](https://www.unrealengine.com/)** | हाई-एंड गेम्स / सिनेमैटिक 3D, मजबूत रिग और एनीमेशन टूलचेन। FBX/अन्य फॉर्मैट इम्पोर्ट। |
| **[Three.js](https://threejs.org/)** (WebGL) | वेब पर रियल-टाइम 3D। इस रिपो में **`/avatar-3d`** पर React Three Fiber + आसान प्रिमिटिव अवतार + `postChat` → **Speech Synthesis** बोलते समय मोशन। |
| **[Babylon.js](https://www.babylonjs.com/)** (WebGL) | वेब पर 3D सीन, फिज़िक्स/इनपुट ज़्यादा चाहिए तो। |
| **[Ready Player Me](https://readyplayer.me/)** | नो-कोड / कम-कोड 3D अवतार, **API** से अपने ऐप में एम्बेड; कस्टमाइज़ेशन vs तेज़ इंटीग्रेशन का अच्छा बैलेंस। |

**चुनाव** इस पर निर्भर करता है: कितना कस्टम मॉडल/रिग चाहिए, और अवतार **कहाँ** दिखाना है — डेस्कटॉप गेम (Unreal), ब्राउज़र (Three/Babylon), या तैयार अवतार सेवा (Ready Player Me / MetaPerson)।

## Web app (browser)

The Next.js app uses **2D/SVG avatars** under `/avatars` — it does **not** load this FBX directly.

**MetaPerson Creator (Avatar SDK)** is integrated at **`/avatars/metaperson`**: iframe + `postMessage` auth. Set **`METAPERSON_CLIENT_ID`** and **`METAPERSON_CLIENT_SECRET`** in **`web/.env.local`** (server-only). See Avatar SDK docs for plans and export rules.

Web utility: **`web/src/lib/metapersonUtils.ts`** — tracks credential checks and a **6-hour** routine re-check window (sessionStorage); the MetaPerson page has **Test credentials** + **Integration check** panel.

### MetaPerson REST API (Enterprise)

Avatar SDK also documents a **REST API** for MetaPerson (photo → pipeline → export mesh, haircuts, outfits, blendshapes, GLB, PBR textures, etc.). That path is for **custom UI / platforms** where the iframe is not enough. It is **Enterprise-only** per their docs; see [api.avatarsdk.com](https://api.avatarsdk.com/) (sections on haircuts, outfits, blendshapes, export). This repo does **not** ship a server integration for that API — add your own backend calls with an Enterprise key if you need it. Questions: **support@avatarsdk.com**.

**Built-in demo:** **`/avatar-3d`** — Three.js (via `@react-three/fiber`), same **`/api/chat`** (OpenAI) as the rest of the app, browser **Speech Synthesis** for voice, primitive mesh animation while speaking. Swap in a **GLB** later with `useGLTF` if you want.
