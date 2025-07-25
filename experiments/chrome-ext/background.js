importScripts('lib/utils.js', 'lib/signaling-manager.js', 'lib/webrtc-manager.js');

let signalingManager;
let webrtcManager;
let publicIP = '';

// Initialize when extension starts
chrome.runtime.onStartup.addListener(initialize);

async function initialize() {
  try {
    // Get public IP (simplified - in production you might want to use an API)
    publicIP = await Utils.getPublicIP();
    
    // Initialize signaling
    signalingManager = new SignalingManager(publicIP, 'navigator');
    await signalingManager.init();
    await signalingManager.registerPeer();
    
    // Initialize WebRTC
    webrtcManager = new WebRTCManager(signalingManager);
    
    // Start peer discovery
    findAndConnectToInterface();
    
  } catch (error) {
    console.error('Initialization failed:', error);
  }
}

async function findAndConnectToInterface() {
  try {
    const peers = await signalingManager.findAvailablePeers();
    
    if (peers.length > 0) {
      // Connect to first available interface
      const interfacePeer = peers[0];
      console.log(`Found interface peer: ${interfacePeer.peerId}`);
      
      // Create data channel
      const dataChannel = await webrtcManager.createDataChannel('vibration-control');
      
      // Set up data channel handlers
      dataChannel.onmessage = (event) => {
        console.log('Received vibration command:', event.data);
        // Here you would handle the vibration commands
      };
      
      // Initiate connection
      await webrtcManager.connectToPeer(interfacePeer.peerId);
      
    } else {
      console.log('No interface peers found. Retrying in 5 seconds...');
      setTimeout(findAndConnectToInterface, 5000);
    }
  } catch (error) {
    console.error('Peer discovery failed:', error);
    setTimeout(findAndConnectToInterface, 5000);
  }
}

// Clean up when extension is unloaded
chrome.runtime.onSuspend.addListener(() => {
  if (signalingManager) signalingManager.cleanup();
  if (webrtcManager) webrtcManager.cleanup();
});

function getConnectionStatus() {
  return {
    connected: webrtcManager?.peerConnection?.connectionState === 'connected',
    peerId: signalingManager?.currentPeerId || null,
    publicIP: publicIP,
    role: 'navigator'
  };
}

// Handle messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'getConnectionStatus') {
    sendResponse(getConnectionStatus());
  } else if (request.type === 'reconnect') {
    findAndConnectToInterface();
    sendResponse({ success: true });
  }
});

// Send updates to popup when connection changes
function sendStatusUpdate() {
  chrome.runtime.sendMessage({
    type: 'connectionUpdate',
    status: getConnectionStatus()
  }).catch(error => {
    console.error('Failed to send status update:', error);
  });
}