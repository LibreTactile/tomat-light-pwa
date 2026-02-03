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
        
        // Callbacks
        this.onConnectionChange = onConnectionChange || (() => {});
        this.onDataReceived = onDataReceived || (() => {});
        
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
            await this.registerAsPeer();
            
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
                this.onConnectionChange(this.isConnected, state);
                
                if (state === 'failed' || state === 'disconnected' || state === 'closed') {
                    this.cleanup();
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
            this.onConnectionChange(true, 'connected');
        };
        
        this.dataChannel.onclose = () => {
            Utils.log('WebRTC: Data channel closed');
            this.onConnectionChange(false, 'closed');
        };
        
        this.dataChannel.onerror = (error) => {
            console.error('WebRTC: Data channel error:', error);
        };
        
        this.dataChannel.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                Utils.log('WebRTC: Received data:', data);
                this.onDataReceived(data);
            } catch (error) {
                console.error('WebRTC: Failed to parse received data:', error);
            }
        };
    }

    async handleOffer(offer, sessionId) {
        try {
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
            sessionId: this.sessionId,
            publicIP: this.publicIP
        };
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