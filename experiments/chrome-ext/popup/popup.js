document.addEventListener('DOMContentLoaded', () => {
  const connectionStatus = document.getElementById('connectionStatus');
  const reconnectBtn = document.getElementById('reconnectBtn');
  const peerInfo = document.getElementById('peerInfo');

  // Initialize with default status
  let currentStatus = {
    connected: false,
    peerId: null,
    publicIP: '',
    role: 'navigator'
  };

  // Update UI with current status
  updateUI(currentStatus);

  // Get initial connection status from background
  chrome.runtime.sendMessage({ type: 'getConnectionStatus' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Error getting connection status:', chrome.runtime.lastError);
      return;
    }
    if (response) {
      currentStatus = {
        ...currentStatus,
        ...response
      };
      updateUI(currentStatus);
    }
  });

  // Reconnect button
  reconnectBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'reconnect' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Reconnect failed:', chrome.runtime.lastError);
      }
    });
  });

  // Listen for updates from background
  chrome.runtime.onMessage.addListener((message) => {
    if (message && message.type === 'connectionUpdate') {
      currentStatus = {
        ...currentStatus,
        ...message.status
      };
      updateUI(currentStatus);
    }
  });

  function updateUI(status) {
    if (!status) {
      console.error('Status is undefined');
      status = {
        connected: false,
        peerId: null,
        publicIP: '',
        role: 'navigator'
      };
    }

    // Ensure required fields exist
    status.connected = status.connected || false;
    status.peerId = status.peerId || null;
    status.publicIP = status.publicIP || '';
    status.role = status.role || 'navigator';

    connectionStatus.textContent = status.connected 
      ? `Connected to ${status.peerId || 'unknown peer'}` 
      : 'Disconnected';
    
    peerInfo.innerHTML = status.connected
      ? `<p>Public IP: ${status.publicIP}</p><p>Role: ${status.role}</p>`
      : '<p>Searching for interface peer...</p>';
    
    reconnectBtn.style.display = status.connected ? 'none' : 'block';
  }
});