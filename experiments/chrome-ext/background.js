importScripts(
  'lib/firebase/firebase-app-compat.js',     // Load Firebase App first
  'lib/firebase/firebase-firestore-compat.js' // Load Firestore second
);
importScripts(
  'lib/utils.js',
  'lib/signaling-manager.js', // This will now find 'firebase' globally
  'lib/webrtc-manager.js'
);

// Declare global variables
let signalingManager;
let webrtcManager;
let publicIP = '';

// --- Helper to ensure Firebase is loaded ---
// The compat scripts might take a tick to attach to 'self'
function waitForFirebase() {
  return new Promise((resolve, reject) => {
    if (typeof self.firebase !== 'undefined' && self.firebase.apps) {
       // Firebase seems to be there already
       resolve();
       return;
    }

    // If not immediately available, wait a short time
    // This handles the case where the script is loaded but hasn't executed yet
    // or attached to 'self'. A simple timeout is often sufficient.
    const checkInterval = setInterval(() => {
        if (typeof self.firebase !== 'undefined' && self.firebase.apps) {
            clearInterval(checkInterval);
            resolve();
        }
    }, 10); // Check every 10ms

    // Set a timeout to prevent hanging forever
    setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error("Firebase failed to load within timeout"));
    }, 5000); // 5 second timeout
  });
}
// ---

// Initialize when extension starts
chrome.runtime.onInstalled.addListener(initialize);
chrome.runtime.onStartup.addListener(initialize);

async function initialize() {
  try {
    // Ensure Firebase is available globally before proceeding
    await waitForFirebase();
    console.log("Firebase is ready:", typeof self.firebase);

    // Get public IP
    publicIP = await Utils.getPublicIP(); // Assuming Utils is loaded via import
    // Initialize signaling
    signalingManager = new SignalingManager(publicIP, 'navigator');
    // The SignalingManager.init() should now find 'firebase' globally
    // and NOT try to use importScripts to load it again.
    // Modify SignalingManager.init() to remove the importScripts part.
    await signalingManager.init();
    await signalingManager.registerPeer();
    // Initialize WebRTC
    webrtcManager = new WebRTCManager(signalingManager);
    // Start peer discovery
    findAndConnectToInterface();
  } catch (error) {
    console.error('Initialization failed:', error);
    // Retry after delay if needed
    setTimeout(initialize, 5000);
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
    peerId: signalingManager?.peerId || null, // Use peerId from signalingManager instance
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

// Send updates to popup when connection changes (if used)
// function sendStatusUpdate() {
//   chrome.runtime.sendMessage({
//     type: 'connectionUpdate',
//     status: getConnectionStatus()
//   }).catch(error => {
//     console.error('Failed to send status update:', error);
//   });
// }
