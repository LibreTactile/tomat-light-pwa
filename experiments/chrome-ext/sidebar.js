// WebRTCManager will be loaded as a global class from the script tag

let webrtcManager;
let signalingManager;
let publicIP;
let currentSessionId;

document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Get public IP and peers from background
    const response = await chrome.runtime.sendMessage({ type: 'getPeers' });
    const peers = response || [];

    if (peers.length > 0) {
      // Re-sort in sidebar to be absolutely sure (handling JSON serialization dates)
      peers.sort((a, b) => {
        const timeA = new Date(a.lastSeen).getTime();
        const timeB = new Date(b.lastSeen).getTime();
        return timeB - timeA;
      });

      const bestPeer = peers[0];
      console.log(`Connecting to most recent peer: ${bestPeer.peerId} (Last seen: ${new Date(bestPeer.lastSeen).toLocaleTimeString()})`);
      if (peers.length > 1) {
        console.log(`(Skipped ${peers.length - 1} older/stale peers)`);
      }

      await connectToPeer(bestPeer.peerId);
    } else {
      document.getElementById('status').textContent = 'No peers found. Retrying...';
      setTimeout(reconnect, 3000);
    }
  } catch (error) {
    console.error('Failed to get peers:', error);
    document.getElementById('status').textContent = 'Failed to connect. Retrying...';
    setTimeout(reconnect, 5000);
  }
});

async function connectToPeer(peerId) {
  try {
    document.getElementById('status').textContent = 'Connecting...';

    // Initialize WebRTC with proper callbacks
    webrtcManager = new WebRTCManager({
      signalingDelegate: {
        sendIceCandidate: async (candidate) => {
          if (currentSessionId) {
            try {
              await chrome.runtime.sendMessage({
                type: 'sendIceCandidate',
                candidate,
                sessionId: currentSessionId
              });
            } catch (error) {
              console.error('Failed to send ICE candidate:', error);
            }
          }
        }
      },
      onConnectionStateChange: (state) => {
        console.log('Sidebar: Connection state changed to:', state);
        if (state === 'failed' || state === 'disconnected' || state === 'closed') {
          document.getElementById('status').textContent = 'Connection lost. Reconnecting...';
          // Wait a bit then reconnect
          setTimeout(reconnect, 3000);
        }
      }
    });

    // Initialize peer connection
    webrtcManager.initializePeerConnection();

    // Create data channel (this is synchronous now)
    const dataChannel = webrtcManager.createDataChannel('vibration-control');

    // Set up data channel handlers
    dataChannel.onmessage = (event) => {
      console.log('Vibration command received:', event.data);
      // Handle vibration commands here
    };

    dataChannel.onopen = () => {
      console.log('Data channel opened - connection established!');
      document.getElementById('status').textContent = `Connected to ${peerId}`;
    };

    dataChannel.onerror = (error) => {
      console.error('Data channel error:', error);
      throw new Error('Data channel error: ' + error);
    };

    dataChannel.onclose = () => {
      console.log('Data channel closed');
      document.getElementById('status').textContent = 'Connection lost. Retrying...';
      setTimeout(reconnect, 3000);
    };

    // Set up answer handler first to avoid race condition
    const messageHandler = (message) => {
      if (message.type === 'answerReceived') {
        console.log('Answer received via background');
        webrtcManager.handleAnswer(message.answer).then(() => {
          console.log('Answer processed successfully');
          document.getElementById('status').textContent = 'Negotiating connection...';
        }).catch((error) => {
          console.error('Failed to handle answer:', error);
          document.getElementById('status').textContent = 'Connection failed. Retrying...';
          setTimeout(reconnect, 3000);
        });
      } else if (message.type === 'iceCandidateReceived') {
        console.log('ICE candidate received via background');
        webrtcManager.handleIceCandidate(message.candidate).catch((error) => {
          console.error('Failed to handle ICE candidate:', error);
        });
      }
    };

    // Remove any existing listeners to prevent duplicates if reconnecting
    chrome.runtime.onMessage.removeListener(messageHandler);
    chrome.runtime.onMessage.addListener(messageHandler);

    // Create and send offer
    console.log('Creating offer...');
    const offer = await webrtcManager.createOffer();

    console.log('Sending offer to background...');
    const response = await chrome.runtime.sendMessage({
      type: 'sendOffer',
      offer,
      peerId
    });

    if (response && response.sessionId) {
      currentSessionId = response.sessionId;
      console.log(`Offer sent, session ID: ${currentSessionId}`);
      document.getElementById('status').textContent = `Waiting for ${peerId} to accept...`;
    } else {
      throw new Error('Failed to send offer - no session ID received');
    }

  } catch (error) {
    console.error('Connection failed:', error);
    document.getElementById('status').textContent = 'Connection failed. Retrying...';
    setTimeout(reconnect, 5000);
  }
}

function reconnect() {
  if (webrtcManager) {
    webrtcManager.close();
    webrtcManager = null;
  }
  // Simple reload to reset state for now, but logged
  console.log('Triggering reload for reconnection...');
  window.location.reload();
}

// Handle sidebar closing
window.addEventListener('unload', () => {
  if (webrtcManager) {
    webrtcManager.close();
  }
  if (currentSessionId) {
    chrome.runtime.sendMessage({
      type: 'cleanupSession',
      sessionId: currentSessionId
    }).catch(() => { });
  }
});