class SignalingManager {
    constructor(publicIP, role) {
        this.publicIP = publicIP;
        this.role = role;
        this.db = null;
        this.peerId = null;
        this.unsubscribeCallbacks = [];
        this.heartbeatInterval = null; // Add missing property
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
            // Check if Firebase is already loaded globally (it should be now)
            if (typeof firebase === 'undefined' || !firebase.initializeApp) {
                 console.warn('Signaling: Firebase SDK not found globally, falling back to mock.');
                 this.initMockSignaling();
                 return; // Exit early if using mock
                // throw new Error('Firebase SDK not loaded');
            }

            // Initialize Firebase App
            if (!firebase.apps.length) {
                this.firebaseApp = firebase.initializeApp(this.firebaseConfig);
            } else {
                // Use the default app if it exists
                this.firebaseApp = firebase.app();
            }
            // Get Firestore instance
            this.db = firebase.firestore();
            this.peerId = this.generatePeerId();
            console.log(`Signaling: Initialized with peer ID: ${this.peerId}`);
        } catch (error) {
            console.error('Signaling: Initialization failed:', error);
            throw error;
        }
    }

    // Remove the duplicate generatePeerId method found later in the file
    // Keep this one:
    generatePeerId() {
        return `${this.role}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // loadFirebaseScripts() { ... } // Optional: Remove this method if no longer used elsewhere

    initMockSignaling() {
        Utils.log('Signaling: Using mock signaling (Firebase not available)');
        this.db = new MockFirestore();
        this.peerId = this.generatePeerId();
    }


    async registerPeer() {
        try {
            const peerData = {
                peerId: this.peerId,
                role: this.role,
                publicIP: this.publicIP,
                status: 'available',  // Make sure status is set to available initially
                timestamp: new Date(),
                lastSeen: new Date()
            };
            await this.db.collection('peers').doc(this.peerId).set(peerData);
            this.startHeartbeat();  // Start heartbeat after successful registration
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
        // Clear any existing interval first
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        
        // Initial update
        this.updateLastSeen().catch(error => {
            console.error('Signaling: Initial heartbeat failed:', error);
        });
        
        // Set up periodic updates every 30 seconds
        this.heartbeatInterval = setInterval(() => {
            this.updateLastSeen().catch(error => {
                console.error('Signaling: Heartbeat failed:', error);
            });
        }, 30000);
    }

    async updateLastSeen() {
    if (!this.db || !this.peerId) {
        throw new Error('Cannot update lastSeen: db or peerId not initialized');
    }
    await this.db.collection('peers').doc(this.peerId).update({
        lastSeen: new Date()
    });
}

    listenForOffers() {
        if (!this.db) return; // Guard if db not initialized
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
            }, (error) => { // Add error handler for listener
                console.error("Signaling: Error listening for offers:", error);
            });
        this.unsubscribeCallbacks.push(unsubscribe);
    }

    listenForAnswers(sessionId) {
        if (!this.db) return;
        const unsubscribe = this.db
            .collection('sessions')
            .doc(sessionId)
            .onSnapshot((doc) => {
                const data = doc.data();
                if (data && data.answer && this.onAnswerReceived) {
                    Utils.log('Signaling: Received answer');
                    this.onAnswerReceived(data.answer);
                }
            }, (error) => {
                 console.error("Signaling: Error listening for answer:", error);
            });
        this.unsubscribeCallbacks.push(unsubscribe);
    }

    listenForIceCandidates(sessionId) {
        if (!this.db) return;
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
            }, (error) => {
                 console.error("Signaling: Error listening for ICE candidates:", error);
            });
        this.unsubscribeCallbacks.push(unsubscribe);
    }

    async sendOffer(offer, targetPeerId) {
        try {
            if (!this.db) throw new Error("Firestore not initialized");
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
             if (!this.db) throw new Error("Firestore not initialized");
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
             if (!this.db) throw new Error("Firestore not initialized");
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
            // Don't throw, as this might be non-fatal
        }
    }

    async findAvailablePeers() {
        try {
             if (!this.db) return [];
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
            return []; // Return empty array on error
        }
    }

    cleanup() {
        // Clear heartbeat
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        
        // Unsubscribe from all listeners
        while(this.unsubscribeCallbacks.length > 0) {
            const unsubscribe = this.unsubscribeCallbacks.pop();
            if (typeof unsubscribe === 'function') {
                try {
                    unsubscribe();
                } catch (error) {
                    console.error('Signaling: Error unsubscribing listener:', error);
                }
            }
        }
        
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

    async cleanupSession(sessionId) {
        try {
            if (!this.db) return;
            // Remove the session document
            await this.db.collection('sessions').doc(sessionId).delete();
            // Also remove any ICE candidates
            const candidates = await this.db.collection('sessions')
                .doc(sessionId)
                .collection('candidates')
                .get();
            const batch = this.db.batch();
            candidates.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();
        } catch (error) {
            console.error('Signaling: Failed to cleanup session:', error);
        }
    }
}

// Mock Firestore for development/testing
// (This part remains the same)
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