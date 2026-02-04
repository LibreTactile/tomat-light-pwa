/**
 * WebRTCManager - Handles WebRTC peer-to-peer connections
 * PWA acts as "interface" role, Chrome extension as "navigator" role
 */

class WebRTCManager {
    constructor(onConnectionChange, onDataReceived) {
        this.role = 'interface'; // PWA is always the interface
        this.peerConnection = null;
        this.dataChannel = null;
        this.signalingManager = null;
        this.publicIP = null;
        this.sessionId = null;
        this.isConnected = false;
        this.signalingState = 'initializing';
        this.isProcessingOffer = false;

        // Callbacks
        this.onConnectionChange = onConnectionChange || (() => { });
        this.onDataReceived = onDataReceived || (() => { });

        // WebRTC configuration
        this.rtcConfig = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };

        this.init();
    }

    async init() {
        try {
            // Get public IP first
            this.publicIP = await this.getPublicIP();
            Utils.log(`WebRTC: Public IP detected: ${this.publicIP}`);

            // Initialize signaling
            this.signalingManager = new SignalingManager(this.publicIP, this.role);
            await this.signalingManager.init();

            // Register as available peer
            this.setSignalingState('registering');
            await this.registerAsPeer();
            this.setSignalingState('waiting');

            // Listen for connection requests
            this.signalingManager.onOfferReceived = (offer, sessionId) => {
                this.handleOffer(offer, sessionId);
            };

            this.signalingManager.onAnswerReceived = (answer) => {
                this.handleAnswer(answer);
            };

            this.signalingManager.onIceCandidateReceived = (candidate) => {
                this.handleIceCandidate(candidate);
            };

            Utils.log('WebRTC: Manager initialized successfully');

        } catch (error) {
            console.error('WebRTC: Initialization failed:', error);
        }
    }

    async getPublicIP() {
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            return data.ip;
        } catch (error) {
            console.error('Failed to get public IP:', error);
            return 'unknown';
        }
    }

    async registerAsPeer() {
        try {
            await this.signalingManager.registerPeer();
            Utils.log('WebRTC: Registered as available peer');
        } catch (error) {
            console.error('WebRTC: Failed to register peer:', error);
        }
    }

    async createPeerConnection() {
        try {
            this.peerConnection = new RTCPeerConnection(this.rtcConfig);

            // Handle ICE candidates
            this.peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    Utils.log('WebRTC: Sending ICE candidate');
                    this.signalingManager.sendIceCandidate(event.candidate, this.sessionId);
                }
            };

            // Handle connection state changes
            this.peerConnection.onconnectionstatechange = () => {
                const state = this.peerConnection.connectionState;
                Utils.log(`WebRTC: Connection state: ${state}`);

                this.isConnected = state === 'connected';
                this.onConnectionChange(this.isConnected, state, this.signalingState);

                if (state === 'failed' || state === 'disconnected' || state === 'closed') {
                    // Only trigger if we were previously connected or if it's a failure during connection
                    Utils.log('WebRTC: Connection lost, attempting to reconnect...');
                    this.setSignalingState('reconnecting');

                    // Delay restart to avoid rapid cycles and allow UI update
                    setTimeout(() => {
                        this.restart();
                    }, 3000);
                }
            };

            this.peerConnection.oniceconnectionstatechange = () => {
                const iceState = this.peerConnection.iceConnectionState;
                Utils.log(`WebRTC: ICE connection state: ${iceState}`);
                if (iceState === 'failed' || iceState === 'disconnected') {
                    Utils.log('WebRTC: ICE connection lost, attempting to reconnect...');
                    this.setSignalingState('reconnecting');
                    setTimeout(() => {
                        this.restart();
                    }, 3000);
                }
            };

            // Handle incoming data channel (from navigator)
            this.peerConnection.ondatachannel = (event) => {
                const channel = event.channel;
                this.setupDataChannel(channel);
                Utils.log('WebRTC: Data channel received from peer');
            };

            Utils.log('WebRTC: Peer connection created');

        } catch (error) {
            console.error('WebRTC: Failed to create peer connection:', error);
            throw error;
        }
    }

    setupDataChannel(channel) {
        this.dataChannel = channel;

        this.dataChannel.onopen = () => {
            Utils.log('WebRTC: Data channel opened');
            this.onConnectionChange(true, 'connected', this.signalingState);
        };

        this.dataChannel.onclose = () => {
            Utils.log('WebRTC: Data channel closed');
            this.onConnectionChange(false, 'closed', this.signalingState);
        };

        this.dataChannel.onerror = (error) => {
            console.error('WebRTC: Data channel error:', error);
        };

        this.dataChannel.onmessage = (event) => {
            try {
                // Try to parse as JSON first
                const data = JSON.parse(event.data);
                Utils.log('WebRTC: Received JSON data:', data);
                this.onDataReceived(data);
            } catch (error) {
                // If parsing fails, it might be a raw string message
                Utils.log('WebRTC: Received raw data:', event.data);
                this.onDataReceived(event.data);
            }
        };
    }

    async handleOffer(offer, sessionId) {
        if (this.isProcessingOffer) {
            Utils.log(`WebRTC: Refusing offer for ${sessionId} - already processing ${this.sessionId}`);
            return;
        }

        // Lock immediately before any async work or cleanup
        this.isProcessingOffer = true;

        if (this.sessionId === sessionId && this.isConnected) {
            Utils.log(`WebRTC: Ignoring redundant offer for already connected session ${sessionId}`);
            this.isProcessingOffer = false;
            return;
        }

        try {
            // If we have an existing connection for a different session, clean it up first
            if (this.sessionId && this.sessionId !== sessionId) {
                Utils.log(`WebRTC: Session mismatch (New: ${sessionId}, Old: ${this.sessionId}), cleaning up old connection`);
                this.cleanup();
                // Ensure we reset state after cleanup but keep the lock
                this.isProcessingOffer = true;
                this.sessionId = sessionId;
            }

            this.setSignalingState('received_offer');
            this.sessionId = sessionId;

            if (!this.peerConnection) {
                await this.createPeerConnection();
            }

            Utils.log('WebRTC: Handling offer from navigator');

            await this.peerConnection.setRemoteDescription(offer);
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);

            // Send answer back
            await this.signalingManager.sendAnswer(answer, sessionId);

            Utils.log('WebRTC: Answer sent');

        } catch (error) {
            console.error('WebRTC: Failed to handle offer:', error);
        } finally {
            this.isProcessingOffer = false;
        }
    }

    async handleAnswer(answer) {
        try {
            if (this.peerConnection && this.peerConnection.signalingState === 'have-local-offer') {
                await this.peerConnection.setRemoteDescription(answer);
                Utils.log('WebRTC: Answer processed');
            }
        } catch (error) {
            console.error('WebRTC: Failed to handle answer:', error);
        }
    }

    async handleIceCandidate(candidate) {
        try {
            if (this.peerConnection && candidate) {
                await this.peerConnection.addIceCandidate(candidate);
                Utils.log('WebRTC: ICE candidate added');
            }
        } catch (error) {
            console.error('WebRTC: Failed to add ICE candidate:', error);
        }
    }

    // Send data to connected peer
    sendData(data) {
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
            try {
                this.dataChannel.send(JSON.stringify(data));
                Utils.log('WebRTC: Data sent to peer:', data);
                return true;
            } catch (error) {
                console.error('WebRTC: Failed to send data:', error);
                return false;
            }
        } else {
            Utils.log('WebRTC: Cannot send data - channel not open');
            return false;
        }
    }

    // Get connection status
    getConnectionStatus() {
        return {
            isConnected: this.isConnected,
            hasDataChannel: !!this.dataChannel,
            connectionState: this.peerConnection?.connectionState || 'new',
            signalingState: this.signalingState,
            sessionId: this.sessionId,
            peerId: this.signalingManager?.peerId,
            publicIP: this.publicIP
        };
    }

    setSignalingState(state) {
        this.signalingState = state;
        Utils.log(`WebRTC: Signaling state: ${state}`);
        this.onConnectionChange(this.isConnected, this.peerConnection?.connectionState || 'new', state);
    }

    // Cleanup connections
    cleanup() {
        if (this.dataChannel) {
            this.dataChannel.close();
            this.dataChannel = null;
        }

        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }

        if (this.signalingManager) {
            this.signalingManager.cleanup();
        }

        this.isConnected = false;
        this.sessionId = null;

        Utils.log('WebRTC: Cleanup completed');
    }

    // Restart connection
    async restart() {
        this.cleanup();
        await this.init();
    }
}