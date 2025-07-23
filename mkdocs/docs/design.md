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
  - Service discovery server (for connection handshake).  

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
