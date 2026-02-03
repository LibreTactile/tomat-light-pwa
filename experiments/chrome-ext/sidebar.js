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
      await connectToPeer(peers[0].peerId);
    } else {
      document.getElementById('status').textContent = 'No peers found. Retrying...';
      setTimeout(() => window.location.reload(), 5000);
    }
  } catch (error) {
    console.error('Failed to get peers:', error);
    document.getElementById('status').textContent = 'Failed to connect. Retrying...';
    setTimeout(() => window.location.reload(), 5000);
  }
});

async function connectToPeer(peerId) {
  try {
    document.getElementById('status').textContent = 'Connecting...';
    
    // Initialize WebRTC with proper callbacks
    webrtcManager = new WebRTCManager({
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
      setTimeout(() => window.location.reload(), 3000);
    };

    // Create and send offer
    const offer = await webrtcManager.createOffer();
    const response = await chrome.runtime.sendMessage({
      type: 'sendOffer',
      offer,
      peerId
    });

    if (response && response.sessionId) {
      currentSessionId = response.sessionId;
      document.getElementById('status').textContent = `Waiting for ${peerId} to accept...`;
      
      // Set up answer handler
      chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'answerReceived') {
          webrtcManager.handleAnswer(message.answer).then(() => {
            console.log('Answer processed successfully');
          }).catch((error) => {
            console.error('Failed to handle answer:', error);
            document.getElementById('status').textContent = 'Connection failed. Retrying...';
            setTimeout(() => window.location.reload(), 3000);
          });
        } else if (message.type === 'iceCandidateReceived') {
          webrtcManager.handleIceCandidate(message.candidate).catch((error) => {
            console.error('Failed to handle ICE candidate:', error);
          });
        }
      });
    } else {
      throw new Error('Failed to send offer - no session ID received');
    }

  } catch (error) {
    console.error('Connection failed:', error);
    document.getElementById('status').textContent = 'Connection failed. Retrying...';
    setTimeout(() => window.location.reload(), 5000);
  }
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
    }).catch(() => {});
  }
});