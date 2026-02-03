# WebRTC implementation

## peers


## signaling server
For a simple solution we will use a real-time database as a signaling server (samples: [codelab](https://webrtc.org/getting-started/firebase-rtc-codelab), [fireship](https://fireship.io/lessons/webrtc-firebase-video-chat/)). Firebase will be used as it has static endpoint, a free tier and is part of the gcloud console that the project already uses. As a PoC the public IP of the network (both peers are on the same LAN) will be sent to the server to only match peers on the same LAN. One peer takes the role of "interface" and the other of "navigator", this role is also communicated to the database, so matches are only made between peers of two different roles in the same LAN. 

>WARNING: AS A POC THE RULES OF THE FIRESTORE DATABASE ARE NOT SET UP TO PREVENT ABUSE, THIS IS NOT SUITABLE FOR PRODUCTION.


### How It Works

#### Using Firebase

- **Signaling messages** (offer, answer, ICE candidates, presence/availability, peers public IP & "role") are stored as documents/records.
- The PWA registers itself as available by writing to the database using a **deterministic ID** based on its public IP and User Agent.
- The Chrome extension queries the database to find peers (the "discovery" phase) using **server-side timestamps** to filter out stale peers.
- Signaling data is exchanged using database updates until the WebRTC connection is established.
- No static IP or complex server maintenance required—just a Firebase project.

**Example:**

- Each session or call has a document or record with:
    - Offer/answer SDP descriptions as fields.
    - ICE candidates as subcollections or arrays.
    - IP address and role ("interface" or "navigator")
- Clients poll or subscribe to document changes for real-time signaling.


### Simplest Firebase Implementation

Firebase abstracts away most network and deployment concerns:

1. **Create a Firebase project** and enable Firestore (or Realtime Database) in test mode for development.
2. **Client A (PWA)** writes a record indicating it is available (e.g., adds itself to a `peers` collection), including its IP & Role ("interface").
3. **Client B (Chrome extension)** queries `peers` with the same IP and with a role of "interface", selects one, then writes the offer.
4. Each side listens for changes in the relevant document or messages.
5. Offers, answers, and ICE candidates are exchanged through writes and real-time updates.
6. Once connected, data channels are used for app data without the signaling server involved.

### Implementation Details & Best Practices

#### 1. Signaling Serialization
Firestore does not support direct storage of custom WebRTC objects like `RTCIceCandidate`. These must be serialized into plain JSON objects before being sent to the database.
```javascript
// Correct way to send ICE candidates
const candidateData = JSON.parse(JSON.stringify(candidate));
await db.collection('candidates').add(candidateData);
```

#### 2. Handshake Reliability
To avoid race conditions, the initiating peer (navigator) must set up listeners for the **answer** and **ICE candidates** *before* sending the offer to the signaling server. Failure to do so may result in missed signals if the remote peer responds extremely quickly.

#### 3. Connection Monitoring & UI Feedback
Monitoring `iceConnectionState` and `connectionState` is critical for identifying network issues. 
- **Dynamic UI**: Application states (like the "Send" button in the sidebar) should be bound to these connection states.
- **Auto-Cleanup**: Connection failures should trigger a standardized cleanup and retry logic to ensure the peer remains available for future attempts.

#### 4. Bidirectional Data Exchange
Beyond control commands, the WebRTC data channel is used for arbitrary string message exchange:
- **String Messaging**: Simple strings can be sent directly across the channel.
- **Echo Logic**: The PWA implements an "echo" listener that logs received strings and sends back an acknowledgment (e.g., `Echo: <message>`) to verify the link.

#### 5. Peer Identification & Cleanup
- **Deterministic IDs**: Peers generate IDs by hashing their Public IP + User Agent. This ensures that reloading the page or reopening the browser on the same device results in the same Peer ID, preventing duplicate "ghost" peers.
- **Server Timestamps**: All heartbeat (`lastSeen`) and registration timestamps use `serverTimestamp()` (Firestore server time) instead of client-side `new Date()`. This prevents clock skew from causing stale peers to appear online.