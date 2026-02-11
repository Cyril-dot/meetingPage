# Quick Start Guide - WebRTC Video Conferencing

## 🚀 What Was Fixed
- ✅ Camera streams now visible to all participants
- ✅ Screen sharing now visible to all participants  
- ✅ Real-time peer-to-peer WebRTC connections
- ✅ Proper state synchronization (mute, video, screen share)

## 📁 Files Changed

### New Files
1. **`webrtc-handler.js`** - WebRTC connection manager (360 lines)
2. **`README.md`** - Complete documentation
3. **`CHANGES.md`** - Detailed change log

### Modified Files
1. **`meeting.html`** - Integrated WebRTC handler

## ⚙️ How to Use

### Option 1: With Full Backend (Recommended)
```bash
# 1. Make sure your backend has WebSocket signaling at:
wss://your-api/ws/meeting/{meetingId}

# 2. Update API URL in meeting.html:
const API_BASE_URL = 'https://your-api-url';

# 3. Serve the files:
npx serve .

# 4. Open http://localhost:3000/meeting.html
```

**✅ Result**: Full functionality with real peer-to-peer connections

### Option 2: Local Testing (No Backend)
```bash
# 1. Serve the files:
python -m http.server 8000

# 2. Open http://localhost:8000/meeting.html
```

**⚠️ Result**: Local camera works, but streams NOT shared with others

## 🔧 Backend WebSocket Server (Minimal Example)

Save as `signaling-server.js`:

```javascript
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

const meetings = new Map(); // meetingId -> Set<WebSocket>

wss.on('connection', (ws, req) => {
  const meetingId = req.url.match(/\/ws\/meeting\/(.+)/)?.[1];
  if (!meetingId) return ws.close();

  // Join meeting room
  if (!meetings.has(meetingId)) {
    meetings.set(meetingId, new Set());
  }
  const room = meetings.get(meetingId);
  room.add(ws);

  ws.userId = null; // Will be set when join message received

  ws.on('message', (data) => {
    const msg = JSON.parse(data);

    if (msg.type === 'join') {
      ws.userId = msg.userId;
      
      // Notify others
      broadcast(room, ws, {
        type: 'user-joined',
        userId: msg.userId,
        userName: msg.userName
      });
    } 
    else if (msg.to) {
      // Direct message (offer, answer, ice-candidate)
      sendToUser(room, msg.to, data);
    } 
    else {
      // Broadcast (media-state, screen-share, etc)
      broadcast(room, ws, msg);
    }
  });

  ws.on('close', () => {
    if (ws.userId) {
      broadcast(room, ws, {
        type: 'user-left',
        userId: ws.userId
      });
    }
    room.delete(ws);
  });
});

function broadcast(room, sender, msg) {
  const data = JSON.stringify(msg);
  room.forEach(client => {
    if (client !== sender && client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

function sendToUser(room, userId, data) {
  room.forEach(client => {
    if (client.userId === userId && client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

console.log('✅ Signaling server running on ws://localhost:8080');
```

Run it:
```bash
npm install ws
node signaling-server.js
```

## 🧪 Testing

### Test without other participants
```javascript
// In browser console:
addDemoParticipant()  // Adds a fake participant (no video)
```

### Test WebRTC connection
```javascript
// Check WebRTC handler exists
console.log(webrtcHandler ? '✅ WebRTC initialized' : '❌ No WebRTC');

// Check peer connections
console.log(`Peer connections: ${peerConnections.size}`);

// Check participants
console.log(`Participants: ${participants.size}`);
participants.forEach(p => console.log(`- ${p.name}: stream=${!!p.stream}`));
```

### Expected Console Output (with working backend)
```
Video meeting initialized successfully
WebRTC: WebSocket connected
[When another user joins]
WebRTC: User joined - User abc12345 (user-abc12345)
WebRTC: Received video track from user-abc12345
WebRTC: Received audio track from user-abc12345
Received remote stream from user-abc12345
WebRTC: Connection state with user-abc12345: connected
```

## 📋 Checklist for First Run

### Frontend Setup
- [ ] Files served over HTTP/HTTPS
- [ ] API_BASE_URL points to your backend
- [ ] Browser console shows no errors
- [ ] Camera permission granted

### Backend Setup  
- [ ] WebSocket server running
- [ ] JWT authentication working
- [ ] Meeting create/join endpoints working
- [ ] WebSocket accepts connections at `/ws/meeting/{id}`

### Testing
- [ ] Local camera visible ✅
- [ ] Controls work (mute, video, screen share) ✅
- [ ] WebSocket connection established ✅
- [ ] Second participant's video appears ✅
- [ ] Screen share visible to all ✅
- [ ] State changes synchronized ✅

## 🐛 Common Issues

### "WebRTC initialization failed"
**Cause**: WebSocket server not reachable  
**Fix**: Check WebSocket server is running and URL is correct

### Peer connection fails
**Cause**: Firewall or NAT blocking connections  
**Fix**: Add TURN servers to ICE_SERVERS in meeting.html:
```javascript
{
  urls: 'turn:your-turn-server.com:3478',
  username: 'user',
  credential: 'pass'
}
```

### Screen share doesn't show
**Cause**: Not using HTTPS  
**Fix**: Serve over HTTPS or use localhost (HTTPS not required for localhost)

### Remote video not appearing
**Cause**: Signaling messages not being relayed  
**Fix**: Check WebSocket server logs, verify broadcast() function

## 📊 Message Flow Diagram

```
┌─────────┐                         ┌──────────┐                        ┌─────────┐
│ User A  │                         │  Server  │                        │ User B  │
└────┬────┘                         └────┬─────┘                        └────┬────┘
     │                                   │                                    │
     │ 1. join {userId, userName}        │                                    │
     ├──────────────────────────────────►│                                    │
     │                                   │ 2. user-joined notification        │
     │                                   ├───────────────────────────────────►│
     │                                   │                                    │
     │                                   │ 3. offer {to: userA, sdp}          │
     │                                   │◄───────────────────────────────────┤
     │ 4. relay offer                    │                                    │
     │◄──────────────────────────────────┤                                    │
     │                                   │                                    │
     │ 5. answer {to: userB, sdp}        │                                    │
     ├──────────────────────────────────►│                                    │
     │                                   │ 6. relay answer                    │
     │                                   ├───────────────────────────────────►│
     │                                   │                                    │
     │ 7. ICE candidates ◄──────────────►│◄──────────────► ICE candidates    │
     │                                   │                                    │
     │ ════════════════════ WebRTC Direct Connection ══════════════════════►  │
     │                      (Audio/Video streams)                             │
```

## 🎯 Key Concepts

### RTCPeerConnection
- One connection per remote participant
- Handles audio/video streaming
- Manages ICE candidates for NAT traversal

### Signaling
- WebSocket for connection setup messages
- Exchanges SDP offers/answers
- Shares ICE candidates
- NOT used for media data

### Tracks vs Streams
- **Track**: Single media source (audio OR video)
- **Stream**: Collection of tracks
- Camera = 1 video track + 1 audio track
- Screen share = 1 video track (no audio usually)

## 🔐 Production Checklist

Before deploying:
- [ ] Use HTTPS/WSS (required!)
- [ ] Add TURN servers for NAT traversal
- [ ] Implement rate limiting on WebSocket
- [ ] Add JWT validation on WebSocket connection
- [ ] Set up monitoring/logging
- [ ] Add error boundaries and recovery
- [ ] Test with poor network conditions
- [ ] Limit max participants per meeting
- [ ] Add CORS headers appropriately
- [ ] Implement privacy controls

## 📚 Further Reading

- [WebRTC API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
- [Perfect Negotiation Pattern](https://w3c.github.io/webrtc-pc/#perfect-negotiation-example)
- [STUN/TURN Server Setup](https://github.com/coturn/coturn)
- [WebRTC Troubleshooting](https://webrtc.github.io/samples/)

## 💬 Support

**Issue**: Camera/screen not visible to others  
**Check**: 
1. WebSocket connected? (browser console)
2. Peer connections created? (`peerConnections.size`)
3. Tracks received? (check `ontrack` events)
4. Signaling server relaying messages?

**Still stuck?**
- Check `CHANGES.md` for detailed technical info
- Review `README.md` for architecture details  
- Enable verbose logging in webrtc-handler.js
- Use `chrome://webrtc-internals` for debugging

---

## Summary

✅ **What works now**: Full peer-to-peer video with camera and screen sharing visible to all participants

⚠️ **What you need**: Backend WebSocket signaling server (see minimal example above)

🚀 **Ready to test**: Start the signaling server and open the app in 2 browser windows
