importScripts(
  'lib/firebase/firebase-app-compat.js',
  'lib/firebase/firebase-firestore-compat.js',
  'lib/signaling-manager.js',
  'lib/utils.js'
);

let signalingManager;
let publicIP = '';
let isInitialized = false;

// Initialize signaling
chrome.runtime.onInstalled.addListener(initialize);
chrome.runtime.onStartup.addListener(initialize);

async function initialize() {
  if (isInitialized) return;
  
  try {
    await waitForFirebase();
    publicIP = await Utils.getPublicIP();
    
    signalingManager = new SignalingManager(publicIP, 'navigator');
    
    // Set up signaling callbacks
    signalingManager.onAnswerReceived = (answer) => {
      // Forward answer to sidebar if needed
      chrome.runtime.sendMessage({
        type: 'answerReceived',
        answer
      }).catch(() => {
        // Sidebar might not be open, that's ok
      });
    };

    signalingManager.onIceCandidateReceived = (candidate) => {
      // Forward ICE candidate to sidebar if needed
      chrome.runtime.sendMessage({
        type: 'iceCandidateReceived',
        candidate
      }).catch(() => {
        // Sidebar might not be open, that's ok
      });
    };

    await signalingManager.init();
    await signalingManager.registerPeer();
    
    isInitialized = true;
    console.log('Background script initialized successfully');
  } catch (error) {
    console.error('Initialization failed:', error);
    isInitialized = false;
    // Retry initialization after delay
    setTimeout(initialize, 5000);
  }
}

// Handle messages from sidebar
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  handleMessage(request, sender, sendResponse);
  return true; // Required for async sendResponse
});

async function handleMessage(request, sender, sendResponse) {
  try {
    if (!signalingManager) {
      sendResponse({ error: 'Signaling manager not initialized' });
      return;
    }

    switch (request.type) {
      case 'getPeers':
        const peers = await signalingManager.findAvailablePeers();
        sendResponse(peers);
        break;

      case 'sendOffer':
        const sessionId = await signalingManager.sendOffer(request.offer, request.peerId);
        sendResponse({ sessionId });
        break;

      case 'sendAnswer':
        await signalingManager.sendAnswer(request.answer, request.sessionId);
        sendResponse({ success: true });
        break;

      case 'sendIceCandidate':
        await signalingManager.sendIceCandidate(request.candidate, request.sessionId);
        sendResponse({ success: true });
        break;

      default:
        sendResponse({ error: 'Unknown message type' });
    }
  } catch (error) {
    console.error('Error handling message:', error);
    sendResponse({ error: error.message });
  }
}

// Cleanup on extension shutdown
chrome.runtime.onSuspend.addListener(() => {
  if (signalingManager) {
    signalingManager.cleanup();
  }
});

// Helper to ensure Firebase is loaded
function waitForFirebase() {
  return new Promise((resolve, reject) => {
    if (typeof firebase !== 'undefined') {
      return resolve();
    }
    
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds max wait
    
    const checkInterval = setInterval(() => {
      attempts++;
      if (typeof firebase !== 'undefined') {
        clearInterval(checkInterval);
        resolve();
      } else if (attempts >= maxAttempts) {
        clearInterval(checkInterval);
        reject(new Error('Firebase failed to load within timeout'));
      }
    }, 100);
  });
}