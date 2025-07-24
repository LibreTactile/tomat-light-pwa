# WebRTC implementation

## peers


## signaling server
For a simple solution we will use a real-time database as a signaling server (samples: [codelab](https://webrtc.org/getting-started/firebase-rtc-codelab), [fireship](https://fireship.io/lessons/webrtc-firebase-video-chat/)). Firebase will be used as it has static endpoint, a free tier and is part of the gcloud console that the project already uses. As a PoC the public IP of the network (both peers are on the same LAN) will be sent to the server to only match peers on the same LAN. One peer takes the role of "interface" and the other of "navigator", this role is also communicated to the database, so matches are only made between peers of two different roles in the same LAN. 


### How It Works

#### Using Firebase

- **Signaling messages** (offer, answer, ICE candidates, presence/availability, peers public IP & "role") are stored as documents/records.
- The PWA registers itself as available by writing to the database.
- The Chrome extension queries the database to find peers (the "discovery" phase).
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