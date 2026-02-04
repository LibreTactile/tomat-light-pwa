/**
 * SignalingManager - Handles Firebase signaling for WebRTC
 * Manages peer discovery and signaling message exchange
 */

class SignalingManager {
    constructor(publicIP, role) {
        this.publicIP = publicIP;
        this.role = role; // 'interface' or 'navigator'
        this.db = null;
        this.peerId = null;
        this.unsubscribeCallbacks = [];

        // Callbacks for WebRTC events
        this.onIceCandidateReceived = null;
        this.startTime = new Date();

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
            // Initialize Firebase (assuming Firebase SDK is loaded)
            if (!window.firebase) {
                throw new Error('Firebase SDK not loaded');
            }

            if (!window.firebase.apps.length) {
                window.firebase.initializeApp(this.firebaseConfig);
            }

            this.db = window.firebase.firestore();

            // Try to recover existing peer ID from localStorage
            const savedPeerId = localStorage.getItem('tomat_peer_id_' + this.role);
            if (savedPeerId) {
                this.peerId = savedPeerId;
                Utils.log(`Signaling: Recovered existing peer ID: ${this.peerId}`);
            } else {
                this.peerId = this.generatePeerId();
                localStorage.setItem('tomat_peer_id_' + this.role, this.peerId);
                Utils.log(`Signaling: Generated new peer ID: ${this.peerId}`);
            }

        } catch (error) {
            console.error('Signaling: Initialization failed:', error);
            // Fallback to mock signaling for development
            this.initMockSignaling();
        }
    }

    initMockSignaling() {
        Utils.log('Signaling: Using mock signaling (Firebase not available)');
        this.db = new MockFirestore();
        this.peerId = this.generatePeerId();
    }

    generatePeerId() {
        // Create a simple hash from publicIP and userAgent to ensure static ID for device/network
        const fingerprint = `${this.publicIP}_${navigator.userAgent}`;
        let hash = 0;
        for (let i = 0; i < fingerprint.length; i++) {
            const char = fingerprint.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        const hashStr = Math.abs(hash).toString(16);
        return `${this.role}_${hashStr}`;
    }

    async registerPeer() {
        try {
            Utils.log('Signaling: Registering peer...');
            const peerData = {
                peerId: this.peerId,
                role: this.role,
                publicIP: this.publicIP,
                status: 'available',
                timestamp: window.firebase.firestore.FieldValue.serverTimestamp(),
                lastSeen: window.firebase.firestore.FieldValue.serverTimestamp()
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
        // Update lastSeen every 10 seconds (optimized from 30s)
        this.heartbeatInterval = setInterval(async () => {
            try {
                await this.db.collection('peers').doc(this.peerId).update({
                    lastSeen: window.firebase.firestore.FieldValue.serverTimestamp()
                });
            } catch (error) {
                console.error('Signaling: Heartbeat failed:', error);
            }
        }, 10000);
    }

    listenForOffers() {
        const unsubscribe = this.db
            .collection('sessions')
            .where('targetPeer', '==', this.peerId)
            .where('type', '==', 'offer')
            .onSnapshot((snapshot) => {
                // Collect all valid added offers in this snapshot
                const addedOffers = [];
                snapshot.docChanges().forEach((change) => {
                    if (change.type === 'added') {
                        const data = change.doc.data();

                        // Ignore truly stale offers (older than 10 minutes before app start)
                        const gracePeriod = 10 * 60 * 1000;
                        const offerTime = data.timestamp?.toDate ? data.timestamp.toDate() : new Date(data.timestamp);

                        if (offerTime >= (this.startTime - gracePeriod)) {
                            addedOffers.push({ id: change.doc.id, data, time: offerTime });
                        } else {
                            Utils.log(`Signaling: Ignoring ancient offer (Session: ${change.doc.id}, Age: ${Math.round((this.startTime - offerTime) / 1000)}s)`);
                        }
                    }
                });

                // If we have offers in this batch, only process the latest one
                if (addedOffers.length > 0) {
                    addedOffers.sort((a, b) => b.time - a.time);
                    const latest = addedOffers[0];

                    Utils.log(`Signaling: Processing latest offer in batch (Session: ${latest.id}, Total in batch: ${addedOffers.length})`);

                    if (this.onOfferReceived) {
                        this.onOfferReceived(latest.data.offer, latest.id);
                    }

                    // Listen for ICE candidates for this session
                    this.listenForIceCandidates(latest.id);

                    // Log skipped ones for debugging
                    for (let i = 1; i < addedOffers.length; i++) {
                        Utils.log(`Signaling: Skipping concurrent older offer (Session: ${addedOffers[i].id})`);
                    }
                }
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
                    candidate: JSON.parse(JSON.stringify(candidate)),
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
            // Cutoff: 60 seconds ago (more lenient for clock skew)
            const cutoffTime = new Date(Date.now() - 60000);

            const snapshot = await this.db
                .collection('peers')
                .where('publicIP', '==', this.publicIP)
                .where('role', '==', targetRole)
                .where('status', '==', 'available')
                .where('lastSeen', '>', cutoffTime)
                .get();

            Utils.log(`Signaling: Querying peers with IP: ${this.publicIP}, Role: ${targetRole}, Cutoff: ${cutoffTime.toISOString()}`);

            const peers = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                // Serialize Firestore Timestamp to ISO string to avoid 'Invalid Date' and serialization issues
                if (data.lastSeen && data.lastSeen.toDate) {
                    data.lastSeen = data.lastSeen.toDate().toISOString();
                } else if (data.lastSeen instanceof Date) {
                    data.lastSeen = data.lastSeen.toISOString();
                }
                peers.push({ id: doc.id, ...data });
            });

            // Sort by lastSeen descending to prefer most recently active peer
            peers.sort((a, b) => {
                const timeA = new Date(a.lastSeen).getTime();
                const timeB = new Date(b.lastSeen).getTime();
                return timeB - timeA;
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
                lastSeen: window.firebase.firestore.FieldValue.serverTimestamp()
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
                                return () => { }; // Unsubscribe function
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
                    return () => { };
                }
            })
        };
    }
}