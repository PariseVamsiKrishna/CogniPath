import { useEffect, useRef, useCallback } from 'react';
import { getIceServers } from '../components/pods/iceServers';

export function usePodWebRTC({ myClientId, localStreamRef, sendSignal }) {
  const peerConnectionsRef = useRef({});
  const iceCandidatesBufferRef = useRef({});

  const getOrCreatePeerConnection = useCallback((targetClientId, isInitiator = false) => {
    if (peerConnectionsRef.current[targetClientId]) {
      return peerConnectionsRef.current[targetClientId];
    }

    console.log(`[usePodWebRTC] Creating RTCPeerConnection for target: ${targetClientId}, initiator: ${isInitiator}`);
    const pc = new RTCPeerConnection({ iceServers: getIceServers() });

    // Candidate Buffer initialization
    if (!iceCandidatesBufferRef.current[targetClientId]) {
      iceCandidatesBufferRef.current[targetClientId] = [];
    }

    // Attach existing local tracks if available
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        try {
          pc.addTrack(track, localStreamRef.current);
        } catch (e) {
          console.warn(`[usePodWebRTC] addTrack error for ${track.kind}:`, e);
        }
      });
    }

    // Always ensure both audio & video transceivers exist (sendrecv)
    const existingTransceivers = pc.getTransceivers();
    const hasAudio = existingTransceivers.some((t) => t.receiver.track.kind === 'audio' || t.sender.track?.kind === 'audio');
    const hasVideo = existingTransceivers.some((t) => t.receiver.track.kind === 'video' || t.sender.track?.kind === 'video');
    if (!hasAudio) pc.addTransceiver('audio', { direction: 'sendrecv' });
    if (!hasVideo) pc.addTransceiver('video', { direction: 'sendrecv' });

    // ICE Candidate Generation
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal({
          type: 'SIGNAL_ICE',
          from_client: myClientId,
          to_client: targetClientId,
          candidate: event.candidate
        });
      }
    };

    // ICE Connection State Monitoring with Debounced Restart
    pc.onconnectionstatechange = () => {
      console.log(`[usePodWebRTC] Connection state with ${targetClientId}: ${pc.connectionState}`);
      if (pc.connectionState === 'failed') {
        console.warn(`[usePodWebRTC] Connection to ${targetClientId} failed. Restarting ICE...`);
        if (pc.restartIce) pc.restartIce();
      } else if (pc.connectionState === 'disconnected') {
        setTimeout(() => {
          if (pc && pc.connectionState === 'disconnected') {
            console.warn(`[usePodWebRTC] Connection to ${targetClientId} disconnected for 5s. Restarting ICE...`);
            if (pc.restartIce) pc.restartIce();
          }
        }, 5000);
      }
    };

    peerConnectionsRef.current[targetClientId] = pc;
    return pc;
  }, [myClientId, localStreamRef, sendSignal]);

  const processBufferedIceCandidates = useCallback(async (targetClientId, pc) => {
    const buffer = iceCandidatesBufferRef.current[targetClientId] || [];
    while (buffer.length > 0) {
      const candidate = buffer.shift();
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn(`[usePodWebRTC] Failed to add buffered ICE candidate for ${targetClientId}:`, e);
      }
    }
  }, []);

  const handleOffer = useCallback(async (data) => {
    const fromClient = data.from_client || data.sender_client_id;
    if (!fromClient || fromClient === myClientId) return;

    const pc = getOrCreatePeerConnection(fromClient, false);
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      await processBufferedIceCandidates(fromClient, pc);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      sendSignal({
        type: 'SIGNAL_ANSWER',
        from_client: myClientId,
        to_client: fromClient,
        sdp: pc.localDescription
      });
    } catch (e) {
      console.error(`[usePodWebRTC] Error handling offer from ${fromClient}:`, e);
    }
  }, [myClientId, getOrCreatePeerConnection, processBufferedIceCandidates, sendSignal]);

  const handleAnswer = useCallback(async (data) => {
    const fromClient = data.from_client || data.sender_client_id;
    if (!fromClient) return;

    const pc = peerConnectionsRef.current[fromClient];
    if (pc && pc.signalingState !== 'closed') {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        await processBufferedIceCandidates(fromClient, pc);
      } catch (e) {
        console.error(`[usePodWebRTC] Error setting remote description from answer of ${fromClient}:`, e);
      }
    }
  }, [processBufferedIceCandidates]);

  const handleIceCandidate = useCallback(async (data) => {
    const fromClient = data.from_client || data.sender_client_id;
    if (!fromClient || !data.candidate) return;

    const pc = peerConnectionsRef.current[fromClient];
    if (pc && pc.remoteDescription && pc.remoteDescription.type) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (e) {
        console.warn(`[usePodWebRTC] Error adding ICE candidate from ${fromClient}:`, e);
      }
    } else {
      if (!iceCandidatesBufferRef.current[fromClient]) {
        iceCandidatesBufferRef.current[fromClient] = [];
      }
      iceCandidatesBufferRef.current[fromClient].push(data.candidate);
    }
  }, []);

  const closePeer = useCallback((targetClientId) => {
    const pc = peerConnectionsRef.current[targetClientId];
    if (pc) {
      pc.close();
      delete peerConnectionsRef.current[targetClientId];
    }
    delete iceCandidatesBufferRef.current[targetClientId];
  }, []);

  const closeAllPeers = useCallback(() => {
    Object.keys(peerConnectionsRef.current).forEach((clientId) => {
      closePeer(clientId);
    });
  }, [closePeer]);

  useEffect(() => {
    return () => {
      closeAllPeers();
    };
  }, [closeAllPeers]);

  return {
    peerConnectionsRef,
    getOrCreatePeerConnection,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    closePeer,
    closeAllPeers
  };
}
