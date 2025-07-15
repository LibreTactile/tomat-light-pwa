# Tomat light
(Mobile Derivative of TOMAT Navigator)  
*A tactile pwa for nonlinear, accessible interaction*

**Tomat Light** is a PWA app paired with a 3D-printed tactile guide, designed to replicate the [TOMAT Navigator](https://github.com/LibreTactile/tomat) interaction experience on mobile devices. It enables **nonlinear, multimodal and contextual navigation** of apps, files, and settings through audio-tactile feedback, prioritizing accessibility for visually impaired users. Its a fork of the [Light Launcher](https://github.com/LibreTactile/light-launcher) developed with a different architecture. 

---

## Key Features  (planned)
**Core Interaction**  
- 🖐️ **Tactile and Contextual Interactions**: Use the 3D-printed grid or pair with TOMAT derivatives hardware for gesture-based navigation. 
- 📱 **Nonlinear Android Launcher**: Navigate apps/files in nonlinear hierarchies, extending traditional menus.  
- 🔍 **Multiscale Views**: Zoom between high-level overviews (e.g., app categories) and granular details (e.g., individual files, annotations).  

**Accessibility**  
- 🔊 **Screen Reader Integration**: Works seamlessly with NVDA & JAWS.  
- 🎮 **Gesture & Audio Feedback**: Double-tap, swipe, and press-and-hold gestures with contextual audio cues.  

**Advanced Tools**  
- 🕸️ **Graph-Based Modeling**: Visualize relationships between apps/files as interactive graphs. Use SPARQL to query "meaninfully search" the graph.  
- 🧩 **Custom Perspectives**: Create "viewports"/"windows" for workflows (e.g., "Work Mode," "Entertainment Mode").  

---

## Hardware + Software  
| Component              | Description                                                                 |  
|------------------------|-----------------------------------------------------------------------------|  
| **PWA App**            | Built with C# and webassembly.               |  
| **3D-Printed Grid**    | Tactile overlay for phones/tablets. [STL Files](hardware/3d-models) (first draft)         |  
| Peripherials| TOMAT;Wearable sensations; bluetooth/usb gamepad; hid devices, etc...  |

![3d printed tactile guide](hardware/3d-models/tomat-light-hw-1.png)

![use of tactile guide](hardware/3d-models/tomat-light-hw-2.png)


---

## Roadmap  

**Phase 1: Core Functionality (v0.1–v0.3)**  
- `v0.1`: Minimal PWA App  
  - `v0.1.1` websocket server 
  - `v0.1.2` buttons grid
  - `v0.1.3` vibration patterns from recieved model 
- `v0.2`: "Light TOMAT" mode (basic tactile i/o grid), connects with [TOMAT-Navi chrome extension](https://github.com/LibreTactile/tomat-navi-prototype/tree/com/websocket)  
- `v0.3`: Graph visualization of text and metadata annotations (basic gestures)  
- `v0.4`: Editable metadata tagging for media and markdown files 

**Phase 2: TOMAT Integration (v0.4–v0.6)**  
- `v0.5`: Hierarchy mode (group apps/files into custom clusters) to show different perspectives/windows  
- `v0.6`: Expose Android Accessibility features
- `v0.7`: Full TOMAT mode (advanced tactile patterns, AI-driven navigation, screen reader interaction)  

**Phase 3: Semantic Queries (v0.7–v0.10)**  
- `v0.8–v0.9`: App/file relationship graphs  
- `v0.10–v0.11`: SPARQL endpoint integration for natural language queries, linked open data and semantic web (i.e. europeana, gallica, semantic wikimedia)  

---


Not yet planned  

---

**Phase 4: Plugin Ecosystem**  
- Introduce **Light Plugins**—extend functionality via external repositories (e.g., custom gestures, app integrations, or accessibility tools).  

**Phase 5: Universal Accessibility Interface**  
- Expand compatibility to act as a **TOMAT Navigator for other devices** (e.g., PCs, smart TVs, IoT devices).  
- Develop a **Universal Accessibility Protocol** for operating systems, enabling apps to render processes, settings, and data accessible via nonlinear, multimodal navigation (e.g., tactile, audio, gesture).  
- Develop a fediverse browser (ie. mastodon, peertube, etc).

---

## Get Started  
1. **Install the PWA**: Visit the PWA website (pending link) and install the app.  
2. **Get the hardware (optional)**: Use [3D models](hardware/3d-models) to print the guide, or contact your local FabLab.  
3. **Connect to the Browser**: Install and connect chrome web browser extension of [TOMAT Navigator](https://github.com/LibreTactile/tomat-navi-prototype/tree/com/websocket)  (WebSocket version).

---

## License & Contribution  
- **License**: for now: CC BY-NC-SA 4.0 (non-commercial use only), but planning to migrate to a fully permissive open source license like MIT. see more about [TOMAT's IP strategy](https://github.com/LibreTactile/tomat-navi-prototype?tab=readme-ov-file#intellectual-property-strategy). 
- **Contributions**: Open to issues/PRs! Please follow libretactile contribution guidelines.  

---

## About TOMAT Navigator  
The [TOMAT Navigator](https://github.com/libretactile/tomat) is an open-source assistive device co-designed with visually impaired users. It combines AI, tactile grids, and screen readers to make web navigation intuitive. Light Launcher extends this philosophy to mobile.  

---

**Acknowledgments**: Developed with feedback from visually impaired testers. Supported by [Axelys](https://axelys.com) for ethical IP strategy.  Check out libretactile's partners.
