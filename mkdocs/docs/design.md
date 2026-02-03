# **TOMAT Light Design Document**  

## **1. Introduction**  
TOMAT Light is a smartphone alternative to the **TOMAT hardware device** (a "remote control" for the internet). It replicates TOMAT’s core functionality while eliminating hardware barriers (cost, distribution, maintenance) by leveraging smartphones and web technologies.  

**Key Advantage:**  
- Instant distribution via Progressive Web App (PWA), no app stores required.  

## **2. User Needs**  
### **Core Requirements:**  
1. **Real-time pairing** with the *TOMAT Navigator* Chrome extension.  
2. **Screen-based simulation** of TOMAT’s interface:  
   - **Output**: Haptic feedback (vibration matrix).  
   - **Input**: Touchscreen buttons.  
3. **Tactile feedback** emulating physical components:  
   - **Haptic states**:  
     - `INACTIVE`: No feedback.  
     - `ACTIVE`: Continuous vibration.  
     - `PULSING`: Rhythmic pulses.  
4. **Screen-reader compatibility** for accessibility.  

## **3. System Overview**  
### **Components:**  
- **TOMAT Light PWA** (smartphone app).  
- **External Services**:  
  - *TOMAT Navigator* Chrome extension.
  - **Firestore Signaling System**: Handles peer discovery, handshakes, and presence (acts as the "discovery server").
  

### **Architecture Decisions:**  
- **PWA**: Simplifies development/distribution vs. native apps.  
- **WebRTC**: Used for peer-to-peer communication (avoids LAN IP restrictions of WebSockets).  

### **PWA Modules:**  
1. **Communications**:  
   - Manages WebRTC connections/data channels with peers.  
2. **Interface Manager**:  
   - Simulated vibrator array (haptic feedback).  
   - Simulated buttons (sends `down`/`up` events).  
   - Quit button (exits app).  

### **4. Technical Implementation Notes**
- **Serialization**: All signaling data (SDP, ICE candidates) is serialized to JSON before transmission via Firestore.
- **State Management**: Heartbeats are used to track peer availability. Offline peers are automatically filtered by the discovery logic after 60 seconds of inactivity.
- **Handshake**: Initiators use a "listen-before-offer" pattern to prevent race conditions.
