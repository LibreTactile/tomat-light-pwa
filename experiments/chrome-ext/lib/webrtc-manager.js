class WebRTCManager {
  constructor(signalingDelegate) {
    this.peerConnection = null;
    this.dataChannels = {};
    this.signalingDelegate = signalingDelegate;
    this.connectionState = 'new';
    
    this.iceServers = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };
  }

  initializePeerConnection() {
    if (this.peerConnection) {
      this.peerConnection.close();
    }

    this.peerConnection = new RTCPeerConnection(this.iceServers);
    this.setupConnectionHandlers();
  }

  createDataChannel(label) {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }
    
    const dataChannel = this.peerConnection.createDataChannel(label, {
      ordered: true
    });
    
    this.dataChannels[label] = dataChannel;
    
    // Set up immediate event handlers
    dataChannel.onopen = () => {
      console.log(`Data channel ${label} opened`);
    };

    dataChannel.onerror = (error) => {
      console.error(`Data channel ${label} error:`, error);
    };

    dataChannel.onclose = () => {
      console.log(`Data channel ${label} closed`);
    };
    
    return dataChannel;
  }

  setupConnectionHandlers() {
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.signalingDelegate.sendIceCandidate) {
        console.log('Sending ICE candidate');
        this.signalingDelegate.sendIceCandidate(event.candidate);
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      this.connectionState = this.peerConnection.connectionState;
      console.log('Connection state changed:', this.connectionState);
      
      if (this.connectionState === 'failed') {
        console.error('WebRTC connection failed');
        // Trigger reconnection logic if needed
      }
    };

    this.peerConnection.onicegatheringstatechange = () => {
      console.log('ICE gathering state:', this.peerConnection.iceGatheringState);
    };

    this.peerConnection.ondatachannel = (event) => {
      const channel = event.channel;
      console.log('Received data channel:', channel.label);
      
      channel.onopen = () => {
        console.log('Received data channel opened:', channel.label);
      };
      
      channel.onmessage = (event) => {
        console.log('Received message on channel:', event.data);
      };
      
      this.dataChannels[channel.label] = channel;
    };
  }

  async createOffer() {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    try {
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false
      });
      
      await this.peerConnection.setLocalDescription(offer);
      console.log('Offer created and local description set');
      
      return offer;
    } catch (error) {
      console.error('Failed to create offer:', error);
      throw error;
    }
  }

  async handleAnswer(answer) {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    try {
      await this.peerConnection.setRemoteDescription(answer);
      console.log('Answer handled successfully');
    } catch (error) {
      console.error('Failed to handle answer:', error);
      throw error;
    }
  }

  async handleIceCandidate(candidate) {
    if (!this.peerConnection) {
      console.warn('Cannot handle ICE candidate: peer connection not initialized');
      return;
    }

    try {
      await this.peerConnection.addIceCandidate(candidate);
      console.log('ICE candidate added successfully');
    } catch (error) {
      console.error('Failed to add ICE candidate:', error);
      // Don't throw, as this might be recoverable
    }
  }

  sendMessage(channelLabel, message) {
    const channel = this.dataChannels[channelLabel];
    if (channel && channel.readyState === 'open') {
      channel.send(message);
      return true;
    } else {
      console.warn(`Cannot send message: channel ${channelLabel} not open`);
      return false;
    }
  }

  close() {
    Object.values(this.dataChannels).forEach(channel => {
      if (channel.readyState !== 'closed') {
        channel.close();
      }
    });
    
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    
    this.dataChannels = {};
    this.connectionState = 'closed';
    console.log('WebRTC connection closed');
  }

  getConnectionState() {
    return this.connectionState;
  }
}

// No export needed - class is globally available