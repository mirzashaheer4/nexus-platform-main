import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';

// Read a cookie value by name from document.cookie
function getCookie(name) {
  const match = document.cookie.split('; ').find(row => row.startsWith(name + '='));
  return match ? decodeURIComponent(match.split('=')[1]) : null;
}

const SOCKET_URL = `${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}`.replace('/api', '');

export default function VideoCall() {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const [remoteStream, setRemoteStream] = useState(null);
  const [micEnabled, setMicEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [connected, setConnected] = useState(false);

  const localVideoRef = useRef();
  const remoteVideoRef = useRef();
  const peerRef = useRef();
  const streamRef = useRef();
  const socketRef = useRef();

  useEffect(() => {
    let active = true;

    const start = async () => {
      try {
        // 1. Get local media stream
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (!active) { stream.getTracks().forEach(t => t.stop()); return; }

        streamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        // 2. Read non-httpOnly socket token from cookie, pass in handshake auth
        const socketToken = getCookie('_st');

        // 3. Connect to /video namespace with auth.token (checklist requirement)
        const socket = io(`${SOCKET_URL}/video`, {
          auth: { token: socketToken },
          withCredentials: true,        // also sends cookies for the fallback path
          transports: ['websocket'],
        });
        socketRef.current = socket;

        // 4. Configure RTCPeerConnection with two STUN servers before any offer/answer
        const peerConnection = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        });
        peerRef.current = peerConnection;

        // 5. Add local tracks to connection
        stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));

        // 6. ICE candidate relay
        peerConnection.onicecandidate = (e) => {
          if (e.candidate && socket.connected) {
            socket.emit('ice-candidate', e.candidate, roomId);
          }
        };

        // 7. Remote track handler
        peerConnection.ontrack = (e) => {
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0];
          setRemoteStream(e.streams[0]);
          setConnected(true);
        };

        // ─── Signaling events ────────────────────────────────────────────────
        socket.emit('join-room', roomId, socket.id);

        // First peer: receive user-connected → create offer → emit offer
        socket.on('user-connected', async () => {
          if (!peerRef.current) return;
          try {
            const offer = await peerRef.current.createOffer();
            await peerRef.current.setLocalDescription(offer);
            socket.emit('offer', offer, roomId);
          } catch (err) {
            console.error('[WebRTC] Error creating offer:', err);
          }
        });

        // Second peer: receive offer → create answer → emit answer
        socket.on('offer', async (offer) => {
          if (!peerRef.current) return;
          try {
            await peerRef.current.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await peerRef.current.createAnswer();
            await peerRef.current.setLocalDescription(answer);
            socket.emit('answer', answer, roomId);
          } catch (err) {
            console.error('[WebRTC] Error handling offer:', err);
          }
        });

        // Both: receive answer
        socket.on('answer', async (answer) => {
          if (!peerRef.current) return;
          try {
            await peerRef.current.setRemoteDescription(new RTCSessionDescription(answer));
          } catch (err) {
            console.error('[WebRTC] Error setting answer:', err);
          }
        });

        // Both: exchange ICE candidates
        socket.on('ice-candidate', async (candidate) => {
          if (!peerRef.current) return;
          try {
            await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (err) {
            console.error('[WebRTC] Error adding ICE candidate:', err);
          }
        });

        // Room full — show message, redirect
        socket.on('room-full', () => {
          setErrorMessage('This call room is full. Only 1-on-1 calls are supported.');
          setTimeout(() => navigate('/meetings'), 3500);
        });

        // Peer left
        socket.on('peer-disconnected', () => {
          setConnected(false);
          setRemoteStream(null);
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
        });

      } catch (err) {
        console.error('[VideoCall] Media error:', err);
        setErrorMessage('Failed to access camera or microphone. Please check your browser permissions.');
      }
    };

    start();

    return () => {
      active = false;
      // Remove socket listeners and emit leave
      if (socketRef.current) {
        socketRef.current.emit('leave-room', roomId);
        socketRef.current.off('user-connected');
        socketRef.current.off('offer');
        socketRef.current.off('answer');
        socketRef.current.off('ice-candidate');
        socketRef.current.off('room-full');
        socketRef.current.off('peer-disconnected');
        socketRef.current.disconnect();
      }
      // Stop all media tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (peerRef.current) {
        peerRef.current.close();
      }
    };
  }, [roomId, navigate]);

  // ─── Controls ────────────────────────────────────────────────────────────────

  const toggleMic = () => {
    const audioTrack = streamRef.current?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setMicEnabled(audioTrack.enabled);
    }
  };

  const toggleCamera = () => {
    const videoTrack = streamRef.current?.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setVideoEnabled(videoTrack.enabled);
    }
  };

  const endCall = () => {
    navigate('/meetings');
  };

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="relative min-h-screen bg-slate-950 flex flex-col text-white overflow-hidden">

      {/* Header */}
      <header className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/70 to-transparent flex justify-between items-center z-10">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Secure Video Room</h2>
          <p className="text-xs text-slate-400 font-mono">Room: {roomId}</p>
        </div>
        {connected ? (
          <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-xs font-semibold">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            Connected
          </span>
        ) : (
          <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 text-amber-400 rounded-full text-xs font-semibold">
            <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
            Waiting for peer…
          </span>
        )}
      </header>

      {/* Main area */}
      <main className="flex-1 flex items-center justify-center p-4 pt-16 pb-28 relative">

        {/* Error banner */}
        {errorMessage && (
          <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/60">
            <div className="bg-slate-900 border border-rose-800 p-6 rounded-2xl text-center max-w-sm shadow-2xl">
              <div className="text-3xl mb-3">⚠️</div>
              <p className="text-sm font-semibold text-rose-400">{errorMessage}</p>
              <p className="text-xs text-slate-500 mt-2">Redirecting to meetings…</p>
            </div>
          </div>
        )}

        {/* Remote video (full area) */}
        <div className="w-full h-full max-h-[80vh] rounded-3xl overflow-hidden bg-slate-900 border border-slate-800 flex items-center justify-center relative">
          {remoteStream ? (
            <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
          ) : (
            <div className="text-center space-y-4">
              <div className="h-14 w-14 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mx-auto" />
              <p className="text-sm text-slate-400">Waiting for the other participant…</p>
            </div>
          )}
        </div>

        {/* Local video PIP — bottom-right overlay */}
        <div className="absolute bottom-6 right-6 w-36 sm:w-48 aspect-video rounded-2xl overflow-hidden bg-slate-800 border-2 border-indigo-500/50 shadow-2xl z-20">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover scale-x-[-1]"
          />
          <span className="absolute bottom-1.5 left-2 text-[9px] text-white/70 bg-black/50 px-1.5 py-0.5 rounded">
            You{!videoEnabled ? ' (off)' : ''}
          </span>
        </div>
      </main>

      {/* Controls bar */}
      <footer className="absolute bottom-0 left-0 right-0 pb-6 flex justify-center gap-4 bg-gradient-to-t from-black/80 to-transparent pt-6 z-10">

        {/* Mic toggle */}
        <button
          onClick={toggleMic}
          title={micEnabled ? 'Mute microphone' : 'Unmute microphone'}
          className={`h-12 w-12 rounded-full flex items-center justify-center transition shadow-lg border ${
            micEnabled ? 'bg-slate-800 hover:bg-slate-700 border-slate-700' : 'bg-rose-600 hover:bg-rose-700 border-rose-700'
          }`}
        >
          {micEnabled ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" clipRule="evenodd" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            </svg>
          )}
        </button>

        {/* Camera toggle */}
        <button
          onClick={toggleCamera}
          title={videoEnabled ? 'Stop camera' : 'Start camera'}
          className={`h-12 w-12 rounded-full flex items-center justify-center transition shadow-lg border ${
            videoEnabled ? 'bg-slate-800 hover:bg-slate-700 border-slate-700' : 'bg-rose-600 hover:bg-rose-700 border-rose-700'
          }`}
        >
          {videoEnabled ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          )}
        </button>

        {/* End call */}
        <button
          onClick={endCall}
          title="Leave call"
          className="h-12 px-6 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-semibold flex items-center gap-2 transition shadow-lg"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
          </svg>
          Leave Call
        </button>
      </footer>
    </div>
  );
}
