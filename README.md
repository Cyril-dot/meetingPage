# Meeting Page - WebRTC Video Conferencing

## Overview
This is a real-time video conferencing application with support for:
- ✅ **Multi-participant video calls** with camera streams visible to all
- ✅ **Screen sharing** visible to all participants
- ✅ **Audio/Video controls** (mute/unmute, camera on/off)
- ✅ **Real-time peer-to-peer connections** using WebRTC
- ✅ **Responsive UI** with modern design

## Recent Fixes (2026-02-11)

### Issue Resolved
**Screen sharing and camera view not visible to all participants**

### Root Cause
The original implementation was local-only - it did not use WebRTC peer-to-peer connections to transmit video/audio streams between participants. There was no signaling mechanism to establish connections between users.

### Solution Implemented
1. **Created WebRTC Handler** (`webrtc-handler.js`)
   - Manages RTCPeerConnection for each participant
   - Handles WebSocket signaling for connection establishment
   - Broadcasts camera and screen share streams to all peers
   - Receives and displays remote streams from other participants

2. **Integrated WebRTC into Meeting Flow**
   - Initialize WebRTC handler when joining/creating meetings
   - Add local camera stream to all peer connections
   - Broadcast screen share tracks when sharing  
   - Notify participants of media state changes (mute/unmute, video on/off)
   - Properly clean up connections when leaving

3. **Key Changes in `meeting.html`**
   - Added WebRTC handler script import
   - Updated `initializeMeeting()` to establish peer connections
   - Modified `toggleScreenShare()` to add screen tracks to all peers
   - Updated `toggleMute()` and `toggleVideo()` to broadcast state changes
   - Enhanced `leaveMeeting()` to close all peer connections

## Architecture

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────┐
│ Participant │ ◄─────► │ Signaling Server │ ◄─────► │ Participant │
│      A      │         │   (WebSocket)    │         │      B      │
└─────────────┘         └──────────────────┘         └─────────────┘
      │                                                       │
      │                                                       │
      └───────────────────────────────────────────────────────┘
                    WebRTC Peer Connection
                 (Direct Audio/Video Streams)
```

### How It Works

1. **Signaling Phase** (via WebSocket):
   - Participant A joins meeting → sends "join" message
   - Server notifies Participant B → "user-joined" message  
   - Participants exchange SDP offers/answers and ICE candidates
   - Direct peer connection is established

2. **Media Streaming Phase** (via WebRTC):
   - Camera streams flow directly between participants
   - Screen share tracks added to existing connections
   - No media data goes through server (efficient!)

3. **State Synchronization** (via WebSocket):
   - Mute/unmute notifications
   - Video on/off notifications
   - Screen share start/stop notifications
   - Participant join/leave events

## Backend Requirements

### You Need a Signaling Server

This frontend requires a **WebSocket signaling server** at:
```
wss://your-api-url/ws/meeting/{meetingId}
```

The signaling server must handle these message types:

#### Incoming Messages (from client):
```javascript
{
  "type": "join",
  "userId": "user123",
  "userName": "John Doe",
  "from": "user123"
}

{
  "type": "offer",
  "from": "user123",
  "to": "user456",
  "sdp": { /* RTCSessionDescription */ }
}

{
  "type": "answer",
  "from": "user456",
  "to": "user123",
  "sdp": { /* RTCSessionDescription */ }
}

{
  "type": "ice-candidate",
  "from": "user123",
  "to": "user456",
  "candidate": { /* RTCIceCandidate */ }
}

{
  "type": "media-state-change",
  "userId": "user123",
  "isMuted": true,
  "isVideoOff": false
}

{
  "type": "screen-share-started",
  "userId": "user123"
}

{
  "type": "screen-share-stopped",
  "userId": "user123"
}

{
  "type": "leave",
  "userId": "user123"
}
```

#### Outgoing Messages (to clients):
```javascript
{
  "type": "user-joined",
  "userId": "user456",
  "userName": "Jane Smith"
}

{
  "type": "user-left",
  "userId": "user456"
}

// Plus relay of offer, answer, ice-candidate messages
```

### Example Signaling Server (Node.js)

```javascript
const WebSocket = require('ws');

const meetings = new Map(); // meetingId -> Set of WebSocket connections

const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', (ws, req) => {
  const meetingId = req.url.split('/').pop();
  
  // Add to meeting room
  if (!meetings.has(meetingId)) {
    meetings.set(meetingId, new Set());
  }
  meetings.get(meetingId).add(ws);

  ws.on('message', (data) => {
    const message = JSON.parse(data);
    const room = meetings.get(meetingId);

    if (message.type === 'join') {
      // Notify all others in room
      room.forEach(client => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'user-joined',
            userId: message.userId,
            userName: message.userName
          }));
        }
      });
    } else if (message.to) {
      // Direct message to specific user
      room.forEach(client => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          // In production, you'd match by userId stored per connection
          client.send(data);
        }
      });
    } else {
      // Broadcast to all in room
      room.forEach(client => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(data);
        }
      });
    }
  });

  ws.on('close', () => {
    meetings.get(meetingId)?.delete(ws);
  });
});
```

## Files

### Main Files
- **`meeting.html`** - Main application (2400+ lines)
  - UI components and styling
  - Meeting logic and state management
  - WebRTC integration
  - Media controls

- **`webrtc-handler.js`** - WebRTC Connection Manager
  - RTCPeerConnection lifecycle
  - WebSocket signaling
  - Track management
  - Error handling

### Other Files
- **`index.html`** - Landing/home page
- **`logger.js`** - Logging utilities

## Usage

### 1. Start Your Backend
Make sure your backend API is running with:
- JWT authentication endpoint
- Meeting creation/join endpoints
- **WebSocket signaling server** (see above)

### 2. Update API URL
In `meeting.html`, set your API URL:
```javascript
const API_BASE_URL = 'https://your-api-url';
```

### 3. Open the Application
```bash
# Serve the files (any web server works)
python -m http.server 8000
# or
npx serve .
```

Open `http://localhost:8000/meeting.html`

### 4. Create or Join Meeting
1. Enter your JWT token
2. Either:
   - **Create Meeting**: Set title and options
   - **Join Meeting**: Enter numeric meeting ID
3. Allow camera/microphone access

### 5. Controls
- **M** - Toggle mute
- **V** - Toggle video
- **S** - Toggle screen share
- **ESC** - Stop screen sharing

## Testing Without WebSocket Server

If you don't have a WebSocket server yet, the app will:
- ✅ Still function with local camera/video
- ✅ Show UI and controls
- ❌ NOT transmit streams to other participants
- ℹ️ Show console message: "Running in local-only mode"

## Browser Support

- ✅ Chrome 74+
- ✅ Firefox 66+
- ✅ Edge 79+
- ✅ Safari 12.1+
- ⚠️ Mobile browsers (limited screen share support)

## STUN Servers

Currently using Google's public STUN servers:
```javascript
{ urls: 'stun:stun.l.google.com:19302' }
```

For production, consider:
- Adding TURN servers for NAT traversal
- Using your own STUN/TURN infrastructure  
- Services like Twilio, Xirsys, or AWS

## Troubleshooting

### Streams not visible to participants?
1. ✅ Check WebSocket connection in browser console
2. ✅ Verify signaling server is running
3. ✅ Check firewall/NAT settings
4. ✅ Add TURN servers for restrictive networks

### Connection fails?
1. ✅ Check browser console for errors
2. ✅ Verify ICE candidates are exchanged
3. ✅ Test STUN server connectivity
4. ✅ Check WebRTC peer connection state

### Screen share not working?
1. ✅ Use HTTPS (required for screen capture)
2. ✅ Check browser permissions
3. ✅ Verify WebRTC handler is initialized
4. ✅ Check console for track addition errors

## Security Considerations

1. **Always use HTTPS** in production
2. **Validate JWT tokens** on backend
3. **Rate limit** WebSocket messages
4. **Sanitize user inputs** (names, messages)
5. **Implement meeting passwords** for sensitive calls
6. **Add participant limits** per meeting

## Next Steps

### Recommended Enhancements
1. **Chat functionality** - Text messaging between participants
2. **Recording** - Server-side recording of meetings
3. **Virtual backgrounds** - Canvas-based background replacement
4. **Reactions** - Emoji reactions during calls
5. **Breakout rooms** - Split participants into sub-groups
6. **Bandwidth adaptation** - Adjust quality based on network

### Production Checklist
- [ ] Set up redundant STUN/TURN servers
- [ ] Implement reconnection logic
- [ ] Add connection quality indicators
- [ ] Set up monitoring and analytics
- [ ] Add privacy policy and consent flows
- [ ] Implement end-to-end encryption (if required)
- [ ] Load test signaling server
- [ ] Set up Docker containers for easy deployment

## License

[Your License Here]

## Support

For issues or questions:
- Check browser console for errors
- Review WebSocket server logs
- Test with demo participants: `addDemoParticipant()`
- Check WebRTC connection states
