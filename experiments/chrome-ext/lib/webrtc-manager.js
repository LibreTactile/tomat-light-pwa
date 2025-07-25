class WebRTCManager {
  constructor(signalingManager) {
    this.signalingManager = signalingManager;
    this.peerConnection = null;
    this.dataChannels = {};
    
    // Configure ICE servers (using free STUN servers)
    this.iceServers = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };
  }

  async createDataChannel(label) {
    if (!this.peerConnection) {
      this.peerConnection = new RTCPeerConnection(this.iceServers);
      this.setupConnectionHandlers();
    }
    
    const dataChannel = this.peerConnection.createDataChannel(label);
    this.dataChannels[label] = dataChannel;
    
    return new Promise((resolve) => {
      dataChannel.onopen = () => resolve(dataChannel);
    });
  }

  setupConnectionHandlers() {
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.signalingManager.sendIceCandidate(event.candidate, this.currentSessionId);
      }
    };
    
    this.peerConnection.ondatachannel = (event) => {
      const dataChannel = event.channel;
      this.dataChannels[dataChannel.label] = dataChannel;
      
      dataChannel.onmessage = (event) => {
        console.log('Received data:', event.data);
      };
    };

    // Call sendStatusUpdate whenever connection state changes
    // Add this to your WebRTC connection handlers in webrtc-manager.js
    this.peerConnection.onconnectionstatechange = () => {
    sendStatusUpdate();
    };
  }
  

  async connectToPeer(targetPeerId) {
    try {
      this.peerConnection = new RTCPeerConnection(this.iceServers);
      this.setupConnectionHandlers();
      
      // Create offer
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);
      
      // Send offer through signaling
      this.currentSessionId = await this.signalingManager.sendOffer(offer, targetPeerId);
      
      // Listen for answer
      this.signalingManager.onAnswerReceived = async (answer) => {
        await this.peerConnection.setRemoteDescription(answer);
      };
      
      // Listen for ICE candidates
      this.signalingManager.onIceCandidateReceived = (candidate) => {
        this.peerConnection.addIceCandidate(candidate);
      };
      
    } catch (error) {
      console.error('Failed to connect to peer:', error);
      throw error;
    }
  }

  cleanup() {
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    this.dataChannels = {};
  }
}
