class SignalingManager {
  constructor(publicIP, role) {
    this.publicIP = publicIP;
    this.role = role;
    this.db = null;
    this.peerId = null;
    this.unsubscribeCallbacks = [];
    
    // Firebase config (same as PWA)
    this.firebaseConfig = {
      apiKey: "AIzaSyBknXnuNOHOugfrHIhzVOmJFL1BoxiU0W0",
      authDomain: "tomat-webrtc.firebaseapp.com",
      projectId: "tomat-webrtc",
      storageBucket: "tomat-webrtc.appspot.com",
      messagingSenderId: "217646764307",
      appId: "1:217646764307:web:d69fb626ddd27ad3928ae6",
      measurementId: "G-2C9SKGR4T5"
    };
  }

  async init() {
    try {
      const firebaseApp = await import('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
      const firebaseFirestore = await import('https://www.gstatic.com/firebasejs/9.0.0/firebase-firestore-compat.js');
      
      if (!firebaseApp.default.apps.length) {
        firebaseApp.default.initializeApp(this.firebaseConfig);
      }
      
      this.db = firebaseFirestore.default.firestore();
      this.peerId = this.generatePeerId();
      
      console.log(`Signaling: Initialized with peer ID: ${this.peerId}`);
      
    } catch (error) {
      console.error('Signaling: Initialization failed:', error);
      throw error;
    }
  }

  
    initMockSignaling() {
        Utils.log('Signaling: Using mock signaling (Firebase not available)');
        this.db = new MockFirestore();
        this.peerId = this.generatePeerId();
    }

    generatePeerId() {
        return `${this.role}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    async registerPeer() {
        try {
            const peerData = {
                peerId: this.peerId,
                role: this.role,
                publicIP: this.publicIP,
                status: 'available',
                timestamp: new Date(),
                lastSeen: new Date()
            };

            await this.db.collection('peers').doc(this.peerId).set(peerData);
            
            // Set up periodic heartbeat
            this.startHeartbeat();
            
            // Listen for incoming offers (interface role)
            if (this.role === 'interface') {
                this.listenForOffers();
            }
            
            Utils.log('Signaling: Peer registered successfully');
            
        } catch (error) {
            console.error('Signaling: Failed to register peer:', error);
            throw error;
        }
    }

    startHeartbeat() {
        // Update lastSeen every 30 seconds
        this.heartbeatInterval = setInterval(async () => {
            try {
                await this.db.collection('peers').doc(this.peerId).update({
                    lastSeen: new Date()
                });
            } catch (error) {
                console.error('Signaling: Heartbeat failed:', error);
            }
        }, 30000);
    }

    listenForOffers() {
        const unsubscribe = this.db
            .collection('sessions')
            .where('targetPeer', '==', this.peerId)
            .where('type', '==', 'offer')
            .onSnapshot((snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    if (change.type === 'added') {
                        const data = change.doc.data();
                        Utils.log('Signaling: Received offer');
                        
                        if (this.onOfferReceived) {
                            this.onOfferReceived(data.offer, change.doc.id);
                        }
                        
                        // Listen for ICE candidates for this session
                        this.listenForIceCandidates(change.doc.id);
                    }
                });
            });
            
        this.unsubscribeCallbacks.push(unsubscribe);
    }

    listenForAnswers(sessionId) {
        const unsubscribe = this.db
            .collection('sessions')
            .doc(sessionId)
            .onSnapshot((doc) => {
                const data = doc.data();
                if (data && data.answer && this.onAnswerReceived) {
                    Utils.log('Signaling: Received answer');
                    this.onAnswerReceived(data.answer);
                }
            });
            
        this.unsubscribeCallbacks.push(unsubscribe);
    }

    listenForIceCandidates(sessionId) {
        const unsubscribe = this.db
            .collection('sessions')
            .doc(sessionId)
            .collection('candidates')
            .onSnapshot((snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    if (change.type === 'added') {
                        const data = change.doc.data();
                        if (data.peerId !== this.peerId && this.onIceCandidateReceived) {
                            Utils.log('Signaling: Received ICE candidate');
                            this.onIceCandidateReceived(data.candidate);
                        }
                    }
                });
            });
            
        this.unsubscribeCallbacks.push(unsubscribe);
    }

    async sendOffer(offer, targetPeerId) {
        try {
            const sessionData = {
                type: 'offer',
                offer: offer,
                fromPeer: this.peerId,
                targetPeer: targetPeerId,
                timestamp: new Date()
            };

            const sessionRef = await this.db.collection('sessions').add(sessionData);
            const sessionId = sessionRef.id;
            
            // Listen for answer
            this.listenForAnswers(sessionId);
            this.listenForIceCandidates(sessionId);
            
            Utils.log('Signaling: Offer sent');
            return sessionId;
            
        } catch (error) {
            console.error('Signaling: Failed to send offer:', error);
            throw error;
        }
    }

    async sendAnswer(answer, sessionId) {
        try {
            await this.db.collection('sessions').doc(sessionId).update({
                answer: answer,
                answerTimestamp: new Date()
            });
            
            Utils.log('Signaling: Answer sent');
            
        } catch (error) {
            console.error('Signaling: Failed to send answer:', error);
            throw error;
        }
    }

    async sendIceCandidate(candidate, sessionId) {
        try {
            await this.db
                .collection('sessions')
                .doc(sessionId)
                .collection('candidates')
                .add({
                    candidate: candidate,
                    peerId: this.peerId,
                    timestamp: new Date()
                });
                
            Utils.log('Signaling: ICE candidate sent');
            
        } catch (error) {
            console.error('Signaling: Failed to send ICE candidate:', error);
        }
    }

    async findAvailablePeers() {
        try {
            // Find peers with same public IP but different role
            const targetRole = this.role === 'interface' ? 'navigator' : 'interface';
            const cutoffTime = new Date(Date.now() - 60000); // 1 minute ago
            
            const snapshot = await this.db
                .collection('peers')
                .where('publicIP', '==', this.publicIP)
                .where('role', '==', targetRole)
                .where('status', '==', 'available')
                .where('lastSeen', '>', cutoffTime)
                .get();
                
            const peers = [];
            snapshot.forEach(doc => {
                peers.push({ id: doc.id, ...doc.data() });
            });
            
            Utils.log(`Signaling: Found ${peers.length} available peers`);
            return peers;
            
        } catch (error) {
            console.error('Signaling: Failed to find peers:', error);
            return [];
        }
    }

    cleanup() {
        // Clear heartbeat
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
        
        // Unsubscribe from all listeners
        this.unsubscribeCallbacks.forEach(unsubscribe => {
            try {
                unsubscribe();
            } catch (error) {
                console.error('Signaling: Error unsubscribing:', error);
            }
        });
        this.unsubscribeCallbacks = [];
        
        // Update peer status to offline
        if (this.db && this.peerId) {
            this.db.collection('peers').doc(this.peerId).update({
                status: 'offline',
                lastSeen: new Date()
            }).catch(error => {
                console.error('Signaling: Failed to update offline status:', error);
            });
        }
        
        Utils.log('Signaling: Cleanup completed');
    }
}

// Mock Firestore for development/testing
class MockFirestore {
    constructor() {
        this.collections = {};
        this.listeners = [];
    }

    collection(name) {
        if (!this.collections[name]) {
            this.collections[name] = {};
        }
        
        return {
            doc: (id) => ({
                set: async (data) => {
                    this.collections[name][id] = { id, ...data };
                    Utils.log(`Mock Firestore: Set document ${name}/${id}`);
                },
                update: async (data) => {
                    if (this.collections[name][id]) {
                        this.collections[name][id] = { ...this.collections[name][id], ...data };
                        Utils.log(`Mock Firestore: Updated document ${name}/${id}`);
                    }
                },
                collection: (subName) => this.collection(`${name}/${id}/${subName}`)
            }),
            add: async (data) => {
                const id = 'mock_' + Math.random().toString(36).substr(2, 9);
                this.collections[name][id] = { id, ...data };
                Utils.log(`Mock Firestore: Added document ${name}/${id}`);
                return { id };
            },
            where: () => ({
                where: () => ({
                    where: () => ({
                        where: () => ({
                            get: async () => ({
                                forEach: (callback) => {
                                    Object.values(this.collections[name] || {}).forEach(doc => {
                                        callback({ id: doc.id, data: () => doc });
                                    });
                                }
                            }),
                            onSnapshot: (callback) => {
                                // Mock real-time updates
                                setTimeout(() => {
                                    callback({
                                        docChanges: () => []
                                    });
                                }, 100);
                                return () => {}; // Unsubscribe function
                            }
                        })
                    })
                }),
                onSnapshot: (callback) => {
                    setTimeout(() => {
                        callback({
                            docChanges: () => []
                        });
                    }, 100);
                    return () => {};
                }
            })
        };
    }
}