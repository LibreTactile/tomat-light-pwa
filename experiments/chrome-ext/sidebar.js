// WebRTCManager will be loaded as a global class from the script tag

let webrtcManager;
let signalingManager;
let publicIP;
let currentSessionId;
let dataChannel;
let messageInput;
let sendBtn;
let logArea;
let currentTargetPeerId;

// Move message listener to global scope and add once
const backgroundMessageHandler = (message) => {
  if (message.type === 'answerReceived') {
    console.log('Background: Received answer for potential processing');
    if (webrtcManager && message.answer) {
      webrtcManager.handleAnswer(message.answer).then(() => {
        console.log('Handshake: Answer processed successfully');
        const statusEl = document.getElementById('status');
        if (statusEl) statusEl.textContent = 'Negotiating connection...';
      }).catch((error) => {
        console.error('Handshake: Failed to handle answer:', error);
      });
    }
  } else if (message.type === 'iceCandidateReceived') {
    console.log('Background: Received ICE candidate');
    if (webrtcManager && message.candidate) {
      webrtcManager.handleIceCandidate(message.candidate).catch((error) => {
        console.error('Handshake: Failed to handle ICE candidate:', error);
      });
    }
  }
};

chrome.runtime.onMessage.addListener(backgroundMessageHandler);

function updateUIState(connected) {
  if (!messageInput || !sendBtn) return;
  messageInput.disabled = !connected;
  sendBtn.disabled = !connected;
  if (connected) {
    messageInput.focus();
  }
}

function addToLog(message, type = 'received') {
  if (!logArea) return;
  const time = new Date().toLocaleTimeString();
  const entry = `[${time}] ${type === 'sent' ? 'OUT: ' : 'IN:  '} ${message}\n`;
  logArea.textContent += entry;
  logArea.scrollTop = logArea.scrollHeight;
}

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize UI elements
  messageInput = document.getElementById('message-input');
  sendBtn = document.getElementById('send-btn');
  logArea = document.getElementById('log');

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
      console.log(`Connection: Initiating with ${bestPeer.peerId}`);
      currentTargetPeerId = bestPeer.peerId;
      await connectToPeer(bestPeer.peerId);
    } else {
      const statusEl = document.getElementById('status');
      if (statusEl) statusEl.textContent = 'No peers found. Retrying...';
      updateUIState(false);
      setTimeout(reconnect, 3000);
    }

    // Set up send button listener
    if (sendBtn) {
      sendBtn.addEventListener('click', () => {
        const msg = messageInput?.value?.trim();
        if (msg && dataChannel && dataChannel.readyState === 'open') {
          dataChannel.send(msg);
          addToLog(msg, 'sent');
          if (messageInput) messageInput.value = '';
        }
      });
    }

    // Also send on Enter key
    if (messageInput) {
      messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && sendBtn) {
          sendBtn.click();
        }
      });
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
          updateUIState(false);
          // Wait a bit then reconnect
          setTimeout(reconnect, 3000);
        }
      }
    });

    // Initialize peer connection
    webrtcManager.initializePeerConnection();

    // Create data channel (this is synchronous now)
    dataChannel = webrtcManager.createDataChannel('vibration-control');

    // Set up data channel handlers
    dataChannel.onmessage = (event) => {
      console.log('Message received:', event.data);
      // Log string messages
      addToLog(event.data, 'received');

      // Keep existing vibration logic if it was JSON (though it wasn't implemented)
      try {
        const data = JSON.parse(event.data);
        console.log('Vibration command received:', data);
      } catch (e) {
        // Not JSON, just a string message
      }
    };

    dataChannel.onopen = () => {
      console.log('Data channel opened - connection established!');
      document.getElementById('status').textContent = `Connected to ${peerId}`;
      updateUIState(true);
    };

    dataChannel.onerror = (error) => {
      console.error('Data channel error:', error);
      document.getElementById('status').textContent = 'Data channel error. Reconnecting...';
      updateUIState(false);
      setTimeout(reconnect, 3000);
    };

    dataChannel.onclose = () => {
      console.log('Data Channel: Closed');
      const statusEl = document.getElementById('status');
      if (statusEl) statusEl.textContent = 'Connection lost. Retrying...';
      updateUIState(false);
      setTimeout(reconnect, 3000);
    };

    // Create and send offer
    console.log('Handshake: Creating offer...');
    const offer = await webrtcManager.createOffer();

    console.log('Handshake: Sending offer to background...');
    const response = await chrome.runtime.sendMessage({
      type: 'sendOffer',
      offer,
      peerId
    });

    if (response && response.sessionId) {
      currentSessionId = response.sessionId;
      console.log(`Handshake: Offer sent, Session ID: ${currentSessionId}`);
      const statusEl = document.getElementById('status');
      if (statusEl) statusEl.textContent = `Waiting for ${peerId}...`;
    } else {
      throw new Error('Failed to send offer - no session ID received');
    }

  } catch (error) {
    console.error('Connection failed:', error);
    document.getElementById('status').textContent = 'Connection failed. Retrying...';
    updateUIState(false);
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