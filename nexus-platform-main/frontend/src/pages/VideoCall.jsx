import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import io from 'socket.io-client';

const socket = io('https://YOUR_BACKEND_URL');

export default function VideoCall() {
  const { roomId } = useParams();
  const [localStream, setLocalStream] = useState(null);
  const localVideoRef = useRef();
  const remoteVideoRef = useRef();
  const peerRef = useRef();

  useEffect(() => {
    const start = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      localVideoRef.current.srcObject = stream;

      socket.emit('join-room', roomId, socket.id);

      const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
      const pc = new RTCPeerConnection(configuration);
      peerRef.current = pc;

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.onicecandidate = e => e.candidate && socket.emit('candidate', e.candidate, roomId);
      pc.ontrack = e => {
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0];
      };

      socket.on('user-connected', async userId => {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('offer', offer, roomId, userId);
      });

      socket.on('offer', async (offer, fromId) => {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('answer', answer, roomId, fromId);
      });

      socket.on('answer', answer => pc.setRemoteDescription(new RTCSessionDescription(answer)));
      socket.on('candidate', candidate => pc.addIceCandidate(new RTCIceCandidate(candidate)));
    };
    start();
  }, [roomId]);

  const toggleMute = () => {
    if (localStream) localStream.getAudioTracks()[0].enabled = !localStream.getAudioTracks()[0].enabled;
  };
  const toggleVideo = () => {
    if (localStream) localStream.getVideoTracks()[0].enabled = !localStream.getVideoTracks()[0].enabled;
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Video Room: {roomId}</h1>
      <div className="flex gap-4 mt-4">
        <video ref={localVideoRef} autoPlay muted className="w-1/2 border rounded" />
        <video ref={remoteVideoRef} autoPlay className="w-1/2 border rounded" />
      </div>
      <div className="mt-4 space-x-2">
        <button onClick={toggleMute} className="bg-gray-600 text-white px-4 py-2 rounded">Mute/Unmute</button>
        <button onClick={toggleVideo} className="bg-gray-600 text-white px-4 py-2 rounded">Stop Video</button>
      </div>
    </div>
  );
}
