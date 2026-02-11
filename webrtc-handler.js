// WebRTC Handler for Meeting Application
// This module handles all WebRTC peer-to-peer connections

class WebRTCHandler {
    constructor(meetingId, userId, userName, localStream) {
        this.meetingId = meetingId;
        this.userId = userId;
        this.userName = userName;
        this.localStream = localStream;

        this.peerConnections = new Map();
        this.ws = null;
        this.onParticipantUpdate = null;
        this.onRemoteStream = null;

        this.ICE_SERVERS = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:stun3.l.google.com:19302' }
            ]
        };
    }

    // Initialize WebSocket signaling
    initialize(wsUrl) {
        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(wsUrl);

                this.ws.onopen = () => {
                    console.log('WebRTC: WebSocket connected');
                    // Announce our presence
                    this.sendSignal({
                        type: 'join',
                        userId: this.userId,
                        userName: this.userName
                    });
                    resolve();
                };

                this.ws.onmessage = async (event) => {
                    const message = JSON.parse(event.data);
                    await this.handleSignalingMessage(message);
                };

                this.ws.onerror = (error) => {
                    console.error('WebRTC: WebSocket error:', error);
                    reject(error);
                };

                this.ws.onclose = () => {
                    console.log('WebRTC: WebSocket disconnected');
                };
            } catch (error) {
                reject(error);
            }
        });
    }

    sendSignal(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                ...data,
                from: this.userId
            }));
        }
    }

    async handleSignalingMessage(message) {
        console.log('WebRTC: Received signaling message:', message.type);

        switch (message.type) {
            case 'user-joined':
                await this.handleUserJoined(message);
                break;

            case 'user-left':
                this.handleUserLeft(message);
                break;

            case 'offer':
                await this.handleOffer(message);
                break;

            case 'answer':
                await this.handleAnswer(message);
                break;

            case 'ice-candidate':
                await this.handleIceCandidate(message);
                break;
        }
    }

    async handleUserJoined(message) {
        const { userId, userName } = message;

        if (userId === this.userId) return; // Ignore self

        console.log(`WebRTC: User joined - ${userName} (${userId})`);

        // Create peer connection
        const pc = this.createPeerConnection(userId);

        // Add local streams to the connection
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                pc.addTrack(track, this.localStream);
            });
        }

        // Create and send offer
        try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            this.sendSignal({
                type: 'offer',
                to: userId,
                sdp: offer
            });
        } catch (error) {
            console.error(`WebRTC: Error creating offer for ${userId}:`, error);
        }
    }

    handleUserLeft(message) {
        const { userId } = message;

        console.log(`WebRTC: User left - ${userId}`);

        // Close peer connection
        const pc = this.peerConnections.get(userId);
        if (pc) {
            pc.close();
            this.peerConnections.delete(userId);
        }
    }

    async handleOffer(message) {
        const { from, sdp } = message;

        console.log(`WebRTC: Received offer from ${from}`);

        // Create peer connection if it doesn't exist
        let pc = this.peerConnections.get(from);
        if (!pc) {
            pc = this.createPeerConnection(from);

            // Add local streams
            if (this.localStream) {
                this.localStream.getTracks().forEach(track => {
                    pc.addTrack(track, this.localStream);
                });
            }
        }

        try {
            // Set remote description
            await pc.setRemoteDescription(new RTCSessionDescription(sdp));

            // Create and send answer
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            this.sendSignal({
                type: 'answer',
                to: from,
                sdp: answer
            });
        } catch (error) {
            console.error(`WebRTC: Error handling offer from ${from}:`, error);
        }
    }

    async handleAnswer(message) {
        const { from, sdp } = message;

        console.log(`WebRTC: Received answer from ${from}`);

        const pc = this.peerConnections.get(from);
        if (pc) {
            try {
                await pc.setRemoteDescription(new RTCSessionDescription(sdp));
            } catch (error) {
                console.error(`WebRTC: Error setting remote description from ${from}:`, error);
            }
        }
    }

    async handleIceCandidate(message) {
        const { from, candidate } = message;

        const pc = this.peerConnections.get(from);
        if (pc && candidate) {
            try {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (error) {
                console.error(`WebRTC: Error adding ICE candidate from ${from}:`, error);
            }
        }
    }

    createPeerConnection(userId) {
        const pc = new RTCPeerConnection(this.ICE_SERVERS);

        // Handle ICE candidates
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                this.sendSignal({
                    type: 'ice-candidate',
                    to: userId,
                    candidate: event.candidate
                });
            }
        };

        // Handle incoming tracks
        pc.ontrack = (event) => {
            console.log(`WebRTC: Received ${event.track.kind} track from ${userId}`);

            if (this.onRemoteStream) {
                this.onRemoteStream(userId, event.streams[0], event.track);
            }
        };

        // Handle connection state changes
        pc.onconnectionstatechange = () => {
            console.log(`WebRTC: Connection state with ${userId}: ${pc.connectionState}`);
        };

        pc.oniceconnectionstatechange = () => {
            console.log(`WebRTC: ICE connection state with ${userId}: ${pc.iceConnectionState}`);
        };

        this.peerConnections.set(userId, pc);
        return pc;
    }

    // Add screen share track to all peer connections
    async addScreenShareTrack(track, stream) {
        console.log('WebRTC: Adding screen share track to all peers');

        for (const [userId, pc] of this.peerConnections.entries()) {
            try {
                // Add track
                const sender = pc.addTrack(track, stream);

                // Renegotiate
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);

                this.sendSignal({
                    type: 'offer',
                    to: userId,
                    sdp: offer
                });
            } catch (error) {
                console.error(`WebRTC: Error adding screen share for ${userId}:`, error);
            }
        }

        // Notify others that we're screen sharing
        this.sendSignal({
            type: 'screen-share-started',
            userId: this.userId
        });
    }

    // Remove screen share track from all peer connections
    async removeScreenShareTrack(track) {
        console.log('WebRTC: Removing screen share track from all peers');

        for (const [userId, pc] of this.peerConnections.entries()) {
            try {
                // Find and remove the sender for this track
                const senders = pc.getSenders();
                const sender = senders.find(s => s.track === track);

                if (sender) {
                    pc.removeTrack(sender);

                    // Renegotiate
                    const offer = await pc.createOffer();
                    await pc.setLocalDescription(offer);

                    this.sendSignal({
                        type: 'offer',
                        to: userId,
                        sdp: offer
                    });
                }
            } catch (error) {
                console.error(`WebRTC: Error removing screen share for ${userId}:`, error);
            }
        }

        // Notify others that we stopped screen sharing
        this.sendSignal({
            type: 'screen-share-stopped',
            userId: this.userId
        });
    }

    // Update local stream (e.g., when muting/unmuting)
    updateLocalStream(stream) {
        this.localStream = stream;
    }

    // Send media state change notification
    notifyMediaStateChange(isMuted, isVideoOff) {
        this.sendSignal({
            type: 'media-state-change',
            userId: this.userId,
            isMuted: isMuted,
            isVideoOff: isVideoOff
        });
    }

    // Close all connections
    close() {
        console.log('WebRTC: Closing all connections');

        // Close all peer connections
        for (const [userId, pc] of this.peerConnections.entries()) {
            pc.close();
        }
        this.peerConnections.clear();

        // Close WebSocket
        if (this.ws) {
            this.sendSignal({
                type: 'leave',
                userId: this.userId
            });
            this.ws.close();
            this.ws = null;
        }
    }
}

// Export for use in meeting.html
if (typeof window !== 'undefined') {
    window.WebRTCHandler = WebRTCHandler;
}
