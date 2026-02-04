# tomat-light-pwa
Simulation of TOMAT navigator hardware built with PWA

**Mobile Derivative of TOMAT Navigator**
*A multimodal mobile interface for nonlinear, accessible interaction*

**TOMAT Light** brings the [TOMAT Navigator](https://github.com/LibreTactile/tomat) experience to smartphone through PWA. Paired with a tactile grid (3D-printed or printed on paper), it enables **nonlinear, multimodal navigation** through audio and haptic feedback —making apps, files, and settings more accessible to blind and visually impaired users.

Screen readers often force linear navigation. TOMAT Light offers a **spatial, touch-based alternative**, enabling users to explore and jump between elements intuitively.

> No TOMAT hardware? Just print the grid for your phone. Get TOMAT’s benefits—no extra equipment required.

---

## ✨ Key Features

### 🔁 Core Interaction

* **Tactile navigation** using tactile overlay and PWA-powered software
* **Multiscale views**: Zoom between categories and details (apps, files, links)

### ♿ Accessibility

* **Screen reader–compatible** (tested with NVDA)
* **Gesture & audio feedback**: Tap, double-tap, hold with contextual sounds

### 🛠️ Assistive UX Highlights

* **UI Grid**: 
  * Four horizontal element rows (4 data buttons + 1 Enter button each).
  * Dedicated navigation row at the bottom (`*`, `+`, `-`, `/\`, `\/`, `>`).
* **Haptic Feedback**:
  * **Interactive Pulse**: Instant 50ms vibration on every button press (`touchstart`/`mousedown`).
  * **Haptic states**:
    * `INACTIVE`: No feedback
    * `ACTIVE`: Continuous vibration
    * `PULSATING`: Rhythmic pulses
* **Multi-touch detection** with adaptive feedback
* **Real-time updates**: Remote apps can change button states live
* **Low-vision friendly**: Non-visual interaction model with audio/tactile cues

---

## 🔧 Hardware + Software

| Component        | Description                                                                |
| ---------------- | -------------------------------------------------------------------------- |
| **PWA**          | Comming soon
| **Tactile Grid** | Print on paper (paper print guide coming soon) or 3d-filament ([STL files](hardware/3d-models))                 |
| **Peripherals**  | Optional: TOMAT, wearables, gamepads, HID devices    (comming sooon)                      |



---

## 🚧 Roadmap

| Version  | Features                                                                                                                                          |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `v0.0.1`   | Minimal pwa test                                                                                                                                | 
| `v0.0.2` | WebRTC comm (data)                                                                                                                                  |
| `v0.0.3` | Button grid                                                                                                                                       |
| `v0.0.4` | Vibration from received model                                                                                                                              |
| `v0.1` | Connection to TOMAT-Navi extension ([WEBRTC branch](https://github.com/LibreTactile/tomat-navi-prototype/tree/com/webrtc)) |


---

## 🚀 Getting Started

1. **Install app**: (comming soon)
2. **Print the grid (optional)**: [STL files here](hardware/3d-models), (pdf for paper printing here) (coming soon)
3. **DOCS**: check out the quick start and build guide.

---

## 🤲 About TOMAT

The [TOMAT Navigator](https://github.com/libretactile/tomat) is an open-source assistive device co-designed with blind users. It provides **touchable web maps** that make navigation faster, more intuitive, and spatially meaningful.

* **Touch, listen, navigate**: Explore headings, links, and sections with your fingers and screen reader
* **Break linearity**: Skip directly to key areas
* **Designed with users**: Refined over six rounds of blind user feedback
* **Part of an ecosystem**: Browser extension, IDE tools, smart device support

---

## 📄 License & Contributions

- **License**: for now: CC BY-NC-SA 4.0 (non-commercial use only), but planning to migrate to a fully permissive open source license like MIT. see more about [TOMAT's IP strategy](https://github.com/LibreTactile/tomat-navi-prototype?tab=readme-ov-file#intellectual-property-strategy). 
- **Contributions**: Open to issues/PRs! Please follow libretactile contribution guidelines.
- **Docs**: dont forget to read ... coming soon
---

## 🙏 Acknowledgments

Developed with visually impaired testers. Supported by [Axelys](https://axelys.com) for ethical IP strategy. See [LibreTactile partners](https://libretactile.org).