import React, { useState, useEffect, useRef } from 'react';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Monitor,
  PhoneOff,
  Users,
  Send,
  Sparkles,
  Plus,
  MessageSquare,
  Bookmark,
  Share2,
  PenTool,
  Eraser,
  Trash2,
  Download,
  Camera,
  Layers,
  Hand,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  Radio,
  ExternalLink,
  ShieldCheck,
  Clock,
  AlertTriangle,
  Zap
} from 'lucide-react';
import { podsAPI } from '../services/api';
import LiveKshetraFrame from '../components/pods/LiveKshetraFrame';
import AudioControlButton from '../components/pods/AudioControlButton';
import UnmuteConsentModal from '../components/pods/UnmuteConsentModal';
import HostRequestNotification from '../components/pods/HostRequestNotification';
import {
  POD_PERM_TYPES,
  createForceMutePayload,
  createRequestUnmutePayload,
  createGrantUnmutePayload,
  createDenyUnmutePayload
} from '../components/pods/podPermissionProtocol';

function RemotePeerVideo({
  stream,
  peerName,
  peerId,
  isMuted,
  isHost,
  isSpeaking,
  canModerate,
  onMute
}) {
  const videoRef = useRef(null);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => setAutoplayBlocked(false))
          .catch((err) => {
            console.warn('[WebRTC] Autoplay restricted by browser policy:', err);
            setAutoplayBlocked(true);
          });
      }
    }
  }, [stream]);

  // Ensure remote audio track reflects muted state in hardware/playback
  useEffect(() => {
    if (stream) {
      stream.getAudioTracks().forEach((track) => {
        track.enabled = !isMuted;
      });
    }
    if (videoRef.current) {
      videoRef.current.muted = Boolean(isMuted);
    }
  }, [isMuted, stream]);

  const handleManualPlay = () => {
    if (videoRef.current) {
      videoRef.current.play().then(() => setAutoplayBlocked(false)).catch(console.error);
    }
  };

  return (
    <div
      className={`relative rounded-2xl bg-slate-950 border transition-all duration-300 flex flex-col items-center justify-center overflow-hidden h-full min-h-[190px] group ${
        isSpeaking && !isMuted
          ? 'ring-2 ring-emerald-400 border-emerald-500 shadow-lg shadow-emerald-500/20'
          : 'border-slate-800'
      }`}
    >
      {autoplayBlocked && (
        <button
          onClick={handleManualPlay}
          className="absolute inset-0 z-20 bg-black/75 flex flex-col items-center justify-center p-3 text-center cursor-pointer hover:bg-black/60 transition"
        >
          <Volume2 className="h-7 w-7 text-indigo-400 mb-1.5 animate-bounce" />
          <span className="text-xs font-bold text-white">Click to Play Stream</span>
          <span className="text-[10px] text-slate-300 mt-0.5">Browser blocked unmuted autoplay</span>
        </button>
      )}

      {/* Host Quick Mute Overlay Button directly on Video Tile (Google Meet / Zoom Style) */}
      {canModerate && onMute && peerId && (
        <div className="absolute top-2.5 right-2.5 z-20 flex items-center gap-1 opacity-90 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onMute(peerId);
            }}
            className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-lg transition ${
              isMuted
                ? 'bg-indigo-600/80 hover:bg-indigo-500 text-white border border-indigo-400/50 shadow-indigo-600/30'
                : 'bg-slate-900/90 hover:bg-rose-600 text-slate-200 hover:text-white border border-slate-700/80'
            }`}
            title={isMuted ? `Ask ${peerName} to Unmute` : `Force Mute ${peerName}`}
          >
            {isMuted ? (
              <>
                <Radio className="h-3 w-3 text-cyan-300 animate-pulse" />
                <span>Ask to Unmute</span>
              </>
            ) : (
              <>
                <VolumeX className="h-3 w-3 text-rose-400 group-hover:text-white" />
                <span>Mute</span>
              </>
            )}
          </button>
        </div>
      )}

      {stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={Boolean(isMuted)}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-tr from-slate-900 via-indigo-950/40 to-slate-900 flex flex-col items-center justify-center">
          <div className="h-16 w-16 rounded-full bg-indigo-600/30 border border-indigo-500/50 flex items-center justify-center text-white text-xl font-bold shadow-md">
            {peerName?.charAt(0) || 'P'}
          </div>
          <span className="text-xs text-slate-300 font-semibold mt-2.5">{peerName}</span>
        </div>
      )}

      {/* Floating Name & Status Badge */}
      <div className="absolute bottom-3 left-3 bg-slate-950/85 backdrop-blur border border-slate-800 px-2.5 py-1 rounded-lg text-[10px] font-bold text-white flex items-center gap-1.5 shadow-md">
        {isMuted ? (
          <span className="flex items-center gap-1 text-rose-400">
            <MicOff className="h-3 w-3" />
            <span className="text-[9px] uppercase px-1 py-0.2 rounded bg-rose-500/20 border border-rose-500/30">
              Muted
            </span>
          </span>
        ) : (
          <Mic className="h-3 w-3 text-emerald-400" />
        )}
        <span className="truncate max-w-[120px]">{peerName}</span>
        {isHost && (
          <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold border border-amber-500/30">
            Host
          </span>
        )}
      </div>

      {isSpeaking && !isMuted && (
        <div className="absolute top-3 left-3 bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 rounded-full text-[9px] font-bold text-emerald-300 flex items-center gap-1 animate-pulse">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Speaking
        </div>
      )}
    </div>
  );
}

export default function LearningPods({ courseId, user }) {
  const [pods, setPods] = useState([
    {
      id: 1,
      title: "Tree Traversal & Rotation Study Pod",
      course_id: courseId || 1,
      topic: "BST Invariants & Tree Rotations",
      is_active: true,
      max_peers: 6,
      host_name: "Prof. Rajesh Ramanujan"
    },
    {
      id: 2,
      title: "Transformer Attention Architecture Pod",
      course_id: courseId || 1,
      topic: "Multi-Head Attention & Scaled Dot-Product",
      is_active: true,
      max_peers: 6,
      host_name: "Alex Kumar"
    }
  ]);
  const [activePod, setActivePod] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [cameraOn, setCameraOn] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [mediaError, setMediaError] = useState(null);
  const [handRaised, setHandRaised] = useState(false);
  const [handRaisedUsers, setHandRaisedUsers] = useState([]);
  const [copiedLink, setCopiedLink] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  // Layout and Sidebar State
  const [viewMode, setViewMode] = useState('kshetra'); // 'kshetra' | 'video' | 'whiteboard' | 'split'
  const [sideTab, setSideTab] = useState('chat'); // 'chat' | 'participants' | 'kshetra'
  const [newPodTitle, setNewPodTitle] = useState('');
  const [newPodTopic, setNewPodTopic] = useState('');
  const [newPodAgenda, setNewPodAgenda] = useState('');
  const [newPodPasscode, setNewPodPasscode] = useState('');
  const [newPodKshetraCode, setNewPodKshetraCode] = useState('');
  const [kshetraCodeInput, setKshetraCodeInput] = useState('');
  const [copiedPodCode, setCopiedPodCode] = useState(null);
  const [copiedInviteMessage, setCopiedInviteMessage] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPasscodeModal, setShowPasscodeModal] = useState(false);
  const [targetPodForJoin, setTargetPodForJoin] = useState(null);
  const [enteredPasscode, setEnteredPasscode] = useState('');
  const [passcodeError, setPasscodeError] = useState('');
  const [educatorQuota, setEducatorQuota] = useState(null);
  const [connectedPeers, setConnectedPeers] = useState([]);
  const [moderationToast, setModerationToast] = useState('');
  const [mutedPeers, setMutedPeers] = useState({});
  const [isForceMutedByHost, setIsForceMutedByHost] = useState(false);
  const [unmuteRequestPending, setUnmuteRequestPending] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [consentHostName, setConsentHostName] = useState('Pod Host');
  const [pendingUnmuteRequests, setPendingUnmuteRequests] = useState([]);

  // Pod Duration & Lifecycle State
  const [newPodDuration, setNewPodDuration] = useState(45);
  const [customDuration, setCustomDuration] = useState('');
  const [remainingSeconds, setRemainingSeconds] = useState(null);
  const [timeWarningToast, setTimeWarningToast] = useState('');
  const [showHostLeaveModal, setShowHostLeaveModal] = useState(false);
  const [hostGraceCountdown, setHostGraceCountdown] = useState(null);
  const [sessionSummary, setSessionSummary] = useState(null);

  // Collaborative Whiteboard State
  const [penColor, setPenColor] = useState('#06b6d4');
  const [brushSize, setBrushSize] = useState(3);
  const [isEraser, setIsEraser] = useState(false);
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });

  // WebRTC & Media Stream Refs
  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const peerConnectionsRef = useRef({});
  const [remoteStreams, setRemoteStreams] = useState({});
  const audioContextRef = useRef(null);
  const audioIntervalRef = useRef(null);

  const wsRef = useRef(null);
  const pingTimerRef = useRef(null);
  const chatEndRef = useRef(null);
  const myClientId = useRef(`peer_${Math.random().toString(36).substring(2, 9)}`).current;

  // Host & Moderation Permissions
  const isHost = Boolean(
    activePod &&
      ((user?.id && activePod.host_id && String(user.id) === String(activePod.host_id)) ||
        user?.role === 'EDUCATOR' ||
        (user?.full_name && activePod.host_name && user.full_name === activePod.host_name))
  );
  const canModerate = isHost;

  // Unified participant list (real peers or interactive simulated peers)
  const displayPeers =
    connectedPeers.length > 0
      ? connectedPeers
      : isHost
      ? [
          { client_id: 'demo_priya', name: 'Priya Patel', role: 'STUDENT' },
          { client_id: 'demo_rohan', name: 'Rohan Verma', role: 'STUDENT' }
        ]
      : [
          { client_id: 'demo_host', name: 'Prof. Rajesh Ramanujan', role: 'EDUCATOR' },
          { client_id: 'demo_priya', name: 'Priya Patel', role: 'STUDENT' }
        ];

  useEffect(() => {
    fetchPods();
    if (user?.role === 'EDUCATOR') {
      fetchEducatorQuota();
    }
    return () => {
      leavePod();
    };
  }, [courseId, user]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Format seconds to MM:SS or H:MM:SS
  const formatTime = (totalSecs) => {
    if (totalSecs == null || isNaN(totalSecs)) return '00:00';
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Synchronized countdown ticker for active pod
  useEffect(() => {
    if (!activePod || remainingSeconds === null) return;
    if (remainingSeconds <= 0) return;

    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [activePod, remainingSeconds !== null]);

  // Host disconnect grace period countdown ticker
  useEffect(() => {
    if (hostGraceCountdown === null || hostGraceCountdown <= 0) return;

    const timer = setInterval(() => {
      setHostGraceCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [hostGraceCountdown]);

  const fetchEducatorQuota = async () => {
    try {
      const q = await podsAPI.getQuota();
      setEducatorQuota(q);
    } catch (e) {
      console.log('Quota fetch info');
    }
  };

  const fetchPods = async () => {
    try {
      const data = await podsAPI.list(courseId || 1);
      if (data && data.length > 0) setPods(data);
    } catch (err) {
      console.error('Failed to load pods:', err);
    }
  };

  // Start Real Browser Media (Webcam & Microphone)
  const startLocalMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: true
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      setCameraOn(true);
      setMicOn(true);
      setMediaError(null);
      setupAudioMeter(stream);
      return stream;
    } catch (err) {
      console.warn('Camera/Mic permission unavailable or denied:', err);
      setMediaError(
        err.name === 'NotAllowedError'
          ? 'Camera/microphone permission was denied. Switched to avatar audio mode.'
          : 'Webcam device not found. Operating in audio/avatar mode.'
      );
      setCameraOn(false);

      // Try audio-only if video failed
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStreamRef.current = audioStream;
        setupAudioMeter(audioStream);
        setMicOn(true);
        return audioStream;
      } catch (audioErr) {
        setMicOn(false);
        return null;
      }
    }
  };

  // Setup Web Audio Volume Meter to detect active speaking
  const setupAudioMeter = (stream) => {
    try {
      const audioTracks = stream.getAudioTracks();
      if (!audioTracks.length) return;

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;

      const audioCtx = new AudioContextClass();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      audioContextRef.current = { audioCtx, analyser };

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      audioIntervalRef.current = setInterval(() => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;
        setAudioLevel(avg);
      }, 120);
    } catch (e) {
      console.warn('Audio metering init notice:', e);
    }
  };

  // Stop All Camera & Microphone Tracks on Leave
  const stopAllMedia = () => {
    if (audioIntervalRef.current) {
      clearInterval(audioIntervalRef.current);
      audioIntervalRef.current = null;
    }
    if (audioContextRef.current?.audioCtx) {
      audioContextRef.current.audioCtx.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    Object.values(peerConnectionsRef.current).forEach((pc) => {
      try {
        pc.close();
      } catch (e) {}
    });
    peerConnectionsRef.current = {};
    setRemoteStreams({});
    setScreenSharing(false);
    setCameraOn(false);
  };

  // WebRTC Peer Connection Factory
  const getOrCreatePeerConnection = (targetClientId, isInitiator = false) => {
    if (peerConnectionsRef.current[targetClientId]) {
      return peerConnectionsRef.current[targetClientId];
    }

    const iceServers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' }
    ];
    if (import.meta.env.VITE_TURN_URL) {
      iceServers.push({
        urls: import.meta.env.VITE_TURN_URL,
        username: import.meta.env.VITE_TURN_USERNAME || '',
        credential: import.meta.env.VITE_TURN_CREDENTIAL || ''
      });
    }

    const pc = new RTCPeerConnection({ iceServers });

    pc.oniceconnectionstatechange = () => {
      console.log(`[WebRTC] Peer ${targetClientId} ICE state: ${pc.iceConnectionState}`);
    };
    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Peer ${targetClientId} Connection state: ${pc.connectionState}`);
    };

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (remoteStream) {
        setRemoteStreams((prev) => ({
          ...prev,
          [targetClientId]: remoteStream
        }));
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'SIGNAL_ICE',
            from_client: myClientId,
            to_client: targetClientId,
            candidate: event.candidate
          })
        );
      }
    };

    peerConnectionsRef.current[targetClientId] = pc;

    if (isInitiator) {
      pc.onnegotiationneeded = async () => {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(
              JSON.stringify({
                type: 'SIGNAL_OFFER',
                from_client: myClientId,
                to_client: targetClientId,
                sdp: pc.localDescription
              })
            );
          }
        } catch (e) {
          console.error('Error creating WebRTC offer:', e);
        }
      };
    }

    return pc;
  };

  const joinPod = async (pod) => {
    setActivePod(pod);
    if (pod.remaining_seconds !== undefined && pod.remaining_seconds !== null) {
      setRemainingSeconds(pod.remaining_seconds);
    } else if (pod.expires_at) {
      const diffSecs = Math.max(0, Math.floor((new Date(pod.expires_at).getTime() - Date.now()) / 1000));
      setRemainingSeconds(diffSecs);
    } else {
      setRemainingSeconds((pod.scheduled_duration_minutes || 45) * 60);
    }
    setHostGraceCountdown(null);
    setTimeWarningToast('');

    setMessages([
      {
        id: 'welcome',
        sender_name: 'COGNIPATH Meeting Host',
        content: `🟢 Welcome to "${pod.title}". Live WebRTC video conference active. Mention "@tutor <question>" in chat anytime for syllabus-grounded AI doubt resolution with citations.`,
        is_ai_tutor: true,
        timestamp: 'Just now'
      }
    ]);

    // Start Real Camera Media
    const stream = await startLocalMedia();

    // Connect WebSocket Signaling
    let wsUrl = '';
    const apiBase = import.meta.env.VITE_API_BASE_URL;
    if (apiBase && (apiBase.startsWith('http://') || apiBase.startsWith('https://'))) {
      const parsed = new URL(apiBase);
      const wsProto = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${wsProto}//${parsed.host}/api/v1/pods/ws/${pod.id}?client_id=${myClientId}&user_name=${encodeURIComponent(
        user?.full_name || 'Alex Kumar'
      )}&user_id=${user?.id || ''}&role=${user?.role || 'STUDENT'}`;
    } else {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      wsUrl = `${protocol}//${host}/api/v1/pods/ws/${pod.id}?client_id=${myClientId}&user_name=${encodeURIComponent(
        user?.full_name || 'Alex Kumar'
      )}&user_id=${user?.id || ''}&role=${user?.role || 'STUDENT'}`;
    }

    try {
      const ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        console.log('[WebSocket] Pod signaling connected to:', wsUrl);
        if (pingTimerRef.current) clearInterval(pingTimerRef.current);
        pingTimerRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'PING', timestamp: Date.now() }));
          }
        }, 25000);
      };
      ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'CHAT_MESSAGE') {
            setMessages((prev) => [
              ...prev,
              {
                id: Date.now().toString() + Math.random(),
                sender_name: data.sender_name,
                content: data.content,
                is_ai_tutor: data.is_ai_tutor,
                citations: data.citations,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              }
            ]);
          } else if (data.type === 'PEER_JOINED') {
            if (data.participants) {
              setConnectedPeers(data.participants.filter((p) => p.client_id !== myClientId));
            }
            if (data.client_id !== myClientId) {
              // Initiate WebRTC call to newly joined peer
              const pc = getOrCreatePeerConnection(data.client_id, true);
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              ws.send(
                JSON.stringify({
                  type: 'SIGNAL_OFFER',
                  from_client: myClientId,
                  to_client: data.client_id,
                  sdp: pc.localDescription
                })
              );
            }
          } else if (data.type === 'KICKED_BY_HOST') {
            alert(`You have been removed from this pod by the meeting host: ${data.reason || 'Host moderation removal'}`);
            leavePod();
          } else if (data.type === 'FORCE_MUTE_PARTICIPANT' || data.type === 'REMOTE_MUTE') {
            if (localStreamRef.current) {
              localStreamRef.current.getAudioTracks().forEach((t) => {
                t.enabled = false;
              });
            }
            setMicOn(false);
            setIsForceMutedByHost(true);
            setUnmuteRequestPending(false);
            setModerationToast('You were muted by the pod host. Click the lock to request unmute.');
            setTimeout(() => setModerationToast(''), 6000);
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              wsRef.current.send(
                JSON.stringify({
                  type: 'MEDIA_STATE_CHANGE',
                  client_id: myClientId,
                  mic_on: false,
                  camera_on: cameraOn
                })
              );
            }
          } else if (data.type === 'UNMUTE_PERMISSION_REQUESTED') {
            // Host receives participant's request to unmute
            const reqSenderId = data.sender_client_id || data.sender_id;
            const reqSenderName = data.sender_name || 'Participant';
            if (canModerate && reqSenderId !== myClientId) {
              setPendingUnmuteRequests((prev) => [
                ...prev.filter((r) => r.senderId !== reqSenderId),
                {
                  id: reqSenderId,
                  senderId: reqSenderId,
                  senderName: reqSenderName,
                  timestamp: data.timestamp || new Date().toLocaleTimeString()
                }
              ]);
              setModerationToast(`🔔 ${reqSenderName} requested permission to unmute.`);
              setTimeout(() => setModerationToast(''), 5000);
            }
          } else if (data.type === 'EVENT_UNMUTE_PERMISSION_GRANTED') {
            // Participant receives host's invitation to unmute -> opens consent modal
            setUnmuteRequestPending(false);
            setConsentHostName(data.host_name || 'The Pod Host');
            setShowConsentModal(true);
          } else if (data.type === 'EVENT_UNMUTE_PERMISSION_DENIED') {
            setUnmuteRequestPending(false);
            setModerationToast(`Host declined your unmute request (${data.reason || 'Wait for Q&A section'}).`);
            setTimeout(() => setModerationToast(''), 5000);
          } else if (data.type === 'HOST_MUTED_PEER') {
            setMutedPeers((prev) => ({ ...prev, [data.client_id]: true }));
            const remoteStream = remoteStreams[data.client_id];
            if (remoteStream) {
              remoteStream.getAudioTracks().forEach((t) => {
                t.enabled = false;
              });
            }
          } else if (data.type === 'HOST_UNMUTED_PEER') {
            setMutedPeers((prev) => ({ ...prev, [data.client_id]: false }));
            const remoteStream = remoteStreams[data.client_id];
            if (remoteStream) {
              remoteStream.getAudioTracks().forEach((t) => {
                t.enabled = true;
              });
            }
          } else if (data.type === 'ALL_PEERS_MUTED') {
            if (data.muted_by !== myClientId) {
              if (localStreamRef.current) {
                localStreamRef.current.getAudioTracks().forEach((t) => {
                  t.enabled = false;
                });
              }
              setMicOn(false);
              setModerationToast('All participants have been muted by the host.');
              setTimeout(() => setModerationToast(''), 4000);
            }
            setMutedPeers((prev) => {
              const updated = { ...prev };
              connectedPeers.forEach((p) => {
                if (p.client_id !== data.muted_by) updated[p.client_id] = true;
              });
              return updated;
            });
          } else if (data.type === 'MEDIA_STATE_CHANGE') {
            if (data.mic_on !== undefined) {
              setMutedPeers((prev) => ({ ...prev, [data.client_id]: !data.mic_on }));
            }
          } else if (data.type === 'REMOTE_DISABLE_VIDEO') {
            if (localStreamRef.current) {
              localStreamRef.current.getVideoTracks().forEach((t) => {
                t.enabled = false;
              });
            }
            setCameraOn(false);
            setModerationToast('Your video camera was remotely disabled by the meeting host.');
            setTimeout(() => setModerationToast(''), 4000);
          } else if (data.type === 'PARTICIPANT_KICKED') {
            setConnectedPeers((prev) => prev.filter((p) => p.client_id !== data.client_id));
            setMessages((prev) => [
              ...prev,
              {
                id: Date.now().toString() + Math.random(),
                sender_name: 'Pod Security HUD',
                content: `🚨 A participant was removed and blacklisted from this pod (${data.reason}).`,
                is_ai_tutor: false,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              }
            ]);
          } else if (data.type === 'SIGNAL_OFFER' && data.to_client === myClientId) {
            const pc = getOrCreatePeerConnection(data.from_client, false);
            await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            ws.send(
              JSON.stringify({
                type: 'SIGNAL_ANSWER',
                from_client: myClientId,
                to_client: data.from_client,
                sdp: pc.localDescription
              })
            );
          } else if (data.type === 'SIGNAL_ANSWER' && data.to_client === myClientId) {
            const pc = peerConnectionsRef.current[data.from_client];
            if (pc) {
              await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
            }
          } else if (data.type === 'SIGNAL_ICE' && data.to_client === myClientId) {
            const pc = peerConnectionsRef.current[data.from_client];
            if (pc && data.candidate) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
              } catch (e) {
                console.error('ICE candidate handling error:', e);
              }
            }
          } else if (data.type === 'PEER_LEFT') {
            const pc = peerConnectionsRef.current[data.client_id];
            if (pc) {
              pc.close();
              delete peerConnectionsRef.current[data.client_id];
            }
            setRemoteStreams((prev) => {
              const updated = { ...prev };
              delete updated[data.client_id];
              return updated;
            });
            setConnectedPeers((prev) => prev.filter((p) => p.client_id !== data.client_id));
            setMutedPeers((prev) => {
              const updated = { ...prev };
              delete updated[data.client_id];
              return updated;
            });
          } else if (data.type === 'HAND_RAISE') {
            setHandRaisedUsers((prev) =>
              data.raised
                ? [...prev.filter((u) => u !== data.user_name), data.user_name]
                : prev.filter((u) => u !== data.user_name)
            );
          } else if (data.type === 'WHITEBOARD_DRAW') {
            drawLine(data.x0, data.y0, data.x1, data.y1, data.color, data.size, data.isEraser);
          } else if (data.type === 'WHITEBOARD_CLEAR') {
            const canvas = canvasRef.current;
            if (canvas) {
              const ctx = canvas.getContext('2d');
              ctx.fillStyle = '#0b0f19';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
          } else if (data.type === 'POD_TIME_WARNING') {
            setTimeWarningToast(data.message || `⚠️ Only ${data.minutes_remaining}m remaining in this session!`);
            if (data.remaining_seconds != null) {
              setRemainingSeconds(data.remaining_seconds);
            }
            setTimeout(() => setTimeWarningToast(''), 8000);
          } else if (data.type === 'HOST_LEFT_TEMPORARILY') {
            setHostGraceCountdown(data.grace_period_seconds || 180);
            setMessages((prev) => [
              ...prev,
              {
                id: Date.now().toString() + Math.random(),
                sender_name: 'Pod System Notice',
                content: `⚠️ Meeting host disconnected. A ${Math.round((data.grace_period_seconds || 180) / 60)}-minute grace period is active for host reconnection.`,
                is_ai_tutor: false,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              }
            ]);
          } else if (data.type === 'HOST_RECONNECTED') {
            setHostGraceCountdown(null);
            setMessages((prev) => [
              ...prev,
              {
                id: Date.now().toString() + Math.random(),
                sender_name: 'Pod System Notice',
                content: `🟢 Host has reconnected to the room. Grace period cleared.`,
                is_ai_tutor: false,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              }
            ]);
          } else if (data.type === 'EVENT_ROOM_CLOSED') {
            stopAllMedia();
            if (pingTimerRef.current) {
              clearInterval(pingTimerRef.current);
              pingTimerRef.current = null;
            }
            if (wsRef.current) {
              wsRef.current.close();
              wsRef.current = null;
            }
            setSessionSummary({
              podTitle: activePod?.title || data.title || 'Learning Pod',
              topic: activePod?.topic || data.topic || 'General Session',
              status: data.status || 'COMPLETED',
              reason: data.reason || 'Scheduled meeting duration concluded.',
              durationMinutes: data.duration_minutes || activePod?.scheduled_duration_minutes || 45,
              totalParticipants: data.total_participants || (connectedPeers.length + 1),
              endedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });
            setActivePod(null);
            setHandRaised(false);
            setHandRaisedUsers([]);
            setRemainingSeconds(null);
            setHostGraceCountdown(null);
            fetchPods();
          }
        } catch (e) {
          console.error(e);
        }
      };

      wsRef.current = ws;
    } catch (err) {
      console.warn('WebSocket signaling connection fallback.');
    }
  };

  const leavePod = () => {
    stopAllMedia();
    if (pingTimerRef.current) {
      clearInterval(pingTimerRef.current);
      pingTimerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setActivePod(null);
    setHandRaised(false);
    setHandRaisedUsers([]);
    setRemainingSeconds(null);
    setHostGraceCountdown(null);
    setTimeWarningToast('');
    setShowHostLeaveModal(false);
    setMutedPeers({});
    setIsForceMutedByHost(false);
    setUnmuteRequestPending(false);
    setShowConsentModal(false);
    setPendingUnmuteRequests([]);
  };

  const handleEndPodForEveryone = async () => {
    if (!activePod) return;
    const currentPod = activePod;
    setShowHostLeaveModal(false);

    try {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'END_POD_FOR_ALL',
            reason: 'Host terminated session for everyone'
          })
        );
      }
      const res = await podsAPI.endPod(currentPod.id, 'Host terminated session for everyone');
      setSessionSummary({
        podTitle: currentPod.title,
        topic: currentPod.topic,
        status: res.status || 'TERMINATED_BY_HOST',
        reason: res.reason || 'Meeting ended by host for all participants',
        durationMinutes: res.duration_minutes || currentPod.scheduled_duration_minutes || 45,
        totalParticipants: res.total_participants || (connectedPeers.length + 1),
        endedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
    } catch (err) {
      console.error('Failed to end pod for everyone:', err);
    } finally {
      leavePod();
      fetchPods();
    }
  };

  // Toggle Microphone
  const toggleMic = () => {
    const nextMic = !micOn;
    if (localStreamRef.current) {
      const tracks = localStreamRef.current.getAudioTracks();
      tracks.forEach((track) => {
        track.enabled = nextMic;
      });
    }
    setMicOn(nextMic);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'MEDIA_STATE_CHANGE',
          client_id: myClientId,
          mic_on: nextMic,
          camera_on: cameraOn
        })
      );
    }
  };

  // Toggle Camera
  const toggleCamera = async () => {
    if (!localStreamRef.current) {
      await startLocalMedia();
      return;
    }
    const nextCamera = !cameraOn;
    const tracks = localStreamRef.current.getVideoTracks();
    if (tracks.length > 0) {
      tracks.forEach((track) => {
        track.enabled = nextCamera;
      });
      setCameraOn(nextCamera);
    } else {
      const stream = await startLocalMedia();
      if (stream) setCameraOn(true);
    }
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'MEDIA_STATE_CHANGE',
          client_id: myClientId,
          mic_on: micOn,
          camera_on: nextCamera
        })
      );
    }
  };

  // Toggle Screen Sharing (Google Meet / Zoom style)
  const toggleScreenShare = async () => {
    if (screenSharing) {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
      }
      if (localVideoRef.current && localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
      setScreenSharing(false);

      // Revert video track on all peer connections
      if (localStreamRef.current) {
        const camTrack = localStreamRef.current.getVideoTracks()[0];
        if (camTrack) {
          Object.values(peerConnectionsRef.current).forEach((pc) => {
            const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
            if (sender) sender.replaceTrack(camTrack);
          });
        }
      }
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: 'always' },
          audio: true
        });
        screenStreamRef.current = screenStream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }
        setScreenSharing(true);

        const screenTrack = screenStream.getVideoTracks()[0];
        Object.values(peerConnectionsRef.current).forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
          if (sender) {
            sender.replaceTrack(screenTrack);
          }
        });

        screenTrack.onended = () => {
          if (localVideoRef.current && localStreamRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
            const camTrack = localStreamRef.current.getVideoTracks()[0];
            if (camTrack) {
              Object.values(peerConnectionsRef.current).forEach((pc) => {
                const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
                if (sender) sender.replaceTrack(camTrack);
              });
            }
          }
          setScreenSharing(false);
        };
      } catch (err) {
        console.warn('Screen share cancelled or unsupported:', err);
      }
    }
  };

  // Toggle Hand Raise
  const toggleHandRaise = () => {
    const nextState = !handRaised;
    setHandRaised(nextState);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'HAND_RAISE',
          user_name: user?.full_name || 'Alex Kumar',
          raised: nextState
        })
      );
    }
  };

  // Copy Meeting Link
  const copyMeetingLink = () => {
    const link = `${window.location.origin}/?pod=${activePod?.id || 1}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Canvas drawing utilities for Collaborative Whiteboard
  const drawLine = (x0, y0, x1, y1, color, size, eraser) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.strokeStyle = eraser ? '#0b0f19' : color;
    ctx.lineWidth = eraser ? size * 4 : size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.restore();
  };

  const getCanvasCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e) => {
    isDrawingRef.current = true;
    lastPosRef.current = getCanvasCoordinates(e);
  };

  const draw = (e) => {
    if (!isDrawingRef.current) return;
    const newPos = getCanvasCoordinates(e);
    const stroke = {
      x0: lastPosRef.current.x,
      y0: lastPosRef.current.y,
      x1: newPos.x,
      y1: newPos.y,
      color: penColor,
      size: brushSize,
      isEraser
    };
    drawLine(stroke.x0, stroke.y0, stroke.x1, stroke.y1, stroke.color, stroke.size, stroke.isEraser);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'WHITEBOARD_DRAW',
          ...stroke
        })
      );
    }
    lastPosRef.current = newPos;
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
  };

  const handleClearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0b0f19';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'WHITEBOARD_CLEAR' }));
    }
  };

  const handleShareSnapshot = () => {
    const msg = `[Whiteboard Snapshot Shared] Concept board on "${activePod?.topic || 'Curriculum'}" posted to pod chat!`;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'CHAT_MESSAGE',
          sender_name: user?.full_name || 'Alex Kumar',
          content: msg
        })
      );
    }
  };

  useEffect(() => {
    if ((viewMode === 'whiteboard' || viewMode === 'split') && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#0b0f19';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }, [viewMode, activePod]);

  const sendPodChat = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userText = chatInput;
    setChatInput('');

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'CHAT_MESSAGE',
          sender_name: user?.full_name || 'Alex Kumar',
          content: userText
        })
      );
    } else {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          sender_name: user?.full_name || 'Alex Kumar',
          content: userText,
          is_ai_tutor: false,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }
  };

  const handleCreatePod = async (e) => {
    e.preventDefault();
    if (!newPodTitle) return;
    try {
      const durationVal = customDuration ? parseInt(customDuration, 10) : parseInt(newPodDuration, 10);
      const created = await podsAPI.create({
        title: newPodTitle,
        course_id: courseId || 1,
        topic: newPodTopic || 'General Study',
        agenda: newPodAgenda || null,
        passcode: newPodPasscode || null,
        kshetra_meeting_code: newPodKshetraCode.trim() || undefined,
        max_peers: 6,
        scheduled_duration_minutes: durationVal || 45
      });
      setPods((prev) => [created, ...prev]);
      setShowCreateModal(false);
      setNewPodTitle('');
      setNewPodTopic('');
      setNewPodAgenda('');
      setNewPodPasscode('');
      setNewPodKshetraCode('');
      setNewPodDuration(45);
      setCustomDuration('');
      if (user?.role === 'EDUCATOR') {
        fetchEducatorQuota();
      }
      joinPod(created);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to create pod');
    }
  };

  const cleanKshetraCode = (input) => {
    if (!input) return '';
    let code = input.trim();
    if (code.includes('/join/')) {
      code = code.split('/join/')[1];
    }
    if (code.includes('?')) {
      code = code.split('?')[0];
    }
    if (code.includes('#')) {
      code = code.split('#')[0];
    }
    return code.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
  };

  const handleQuickJoinKshetra = async (customCode) => {
    const rawCode = customCode || kshetraCodeInput;
    const cleanCode = cleanKshetraCode(rawCode);
    if (!cleanCode) {
      alert('Please enter a valid Live Kshetra meeting code or URL (e.g. sih-tree-rotations or https://live-kshetra.vercel.app/join/sih-math-101)');
      return;
    }

    // Check if pod exists in state
    const existingPod = pods.find(
      (p) =>
        (p.kshetra_meeting_code && p.kshetra_meeting_code.toLowerCase() === cleanCode) ||
        `sih-pod-${p.id}` === cleanCode
    );

    if (existingPod) {
      setViewMode('kshetra');
      handleJoinClick(existingPod);
      setKshetraCodeInput('');
      return;
    }

    // Otherwise create on-the-fly and join
    try {
      const created = await podsAPI.create({
        title: `Live Kshetra: ${cleanCode}`,
        course_id: courseId || 1,
        topic: 'Live Kshetra Conference',
        agenda: `Direct session bridged with Live Kshetra code [${cleanCode}]`,
        kshetra_meeting_code: cleanCode,
        max_peers: 8,
        scheduled_duration_minutes: 60
      });
      setPods((prev) => [created, ...prev]);
      setViewMode('kshetra');
      setKshetraCodeInput('');
      joinPod(created);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to initialize Live Kshetra pod');
    }
  };

  const handleInstantKshetraPod = async () => {
    const randomSuffix = Math.random().toString(36).substring(2, 7);
    const instantCode = `sih-live-${randomSuffix}`;
    try {
      const created = await podsAPI.create({
        title: `Live Kshetra Pod #${randomSuffix.toUpperCase()}`,
        course_id: courseId || 1,
        topic: 'Live Kshetra Video Conference',
        agenda: 'Instant live conference via Live Kshetra bridge',
        kshetra_meeting_code: instantCode,
        max_peers: 8,
        scheduled_duration_minutes: 60
      });
      setPods((prev) => [created, ...prev]);
      setViewMode('kshetra');
      joinPod(created);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to start instant Live Kshetra pod');
    }
  };

  const handleCopyKshetraCode = (code, e) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedPodCode(code);
    setTimeout(() => setCopiedPodCode(null), 2500);
  };

  const handleJoinClick = (pod) => {
    if (pod.has_passcode) {
      setTargetPodForJoin(pod);
      setEnteredPasscode('');
      setPasscodeError('');
      setShowPasscodeModal(true);
    } else {
      joinPod(pod);
    }
  };

  const handleVerifyAndJoin = async (e) => {
    e.preventDefault();
    if (!targetPodForJoin) return;
    try {
      const res = await podsAPI.verifyPasscode(targetPodForJoin.id, enteredPasscode);
      if (res.is_blacklisted) {
        setPasscodeError('Access Denied: You have been permanently blacklisted from this pod by the meeting host.');
        return;
      }
      if (!res.verified) {
        setPasscodeError(res.message || 'Incorrect passcode');
        return;
      }
      setShowPasscodeModal(false);
      joinPod(targetPodForJoin);
    } catch (err) {
      setPasscodeError('Failed to verify passcode.');
    }
  };

  const handleHostMute = (targetClientId) => {
    const isCurrentlyMuted = !!mutedPeers[targetClientId];
    const peerObj = displayPeers.find((p) => p.client_id === targetClientId);
    const peerName =
      peerObj?.name ||
      (targetClientId === 'demo_priya'
        ? 'Priya Patel'
        : targetClientId === 'demo_rohan'
        ? 'Rohan Verma'
        : `Peer ${targetClientId.substring(0, 6)}`);

    if (isCurrentlyMuted) {
      // STRICT PRIVACY RULE: Host CANNOT force unmute.
      // Host sends an un-mute invitation / permission grant to the participant.
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify(
            createGrantUnmutePayload(targetClientId, user?.id || myClientId, user?.full_name || 'Host')
          )
        );
      }
      setModerationToast(`Invited ${peerName} to unmute their microphone.`);
      setTimeout(() => setModerationToast(''), 4500);
      return;
    }

    // 1. Host forcibly mutes participant:
    setMutedPeers((prev) => ({
      ...prev,
      [targetClientId]: true
    }));

    // 2. Silence incoming WebRTC audio track locally
    const remoteStream = remoteStreams[targetClientId];
    if (remoteStream) {
      remoteStream.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });
    }

    // 3. User feedback toast
    setModerationToast(`Muted ${peerName}'s microphone.`);
    setTimeout(() => setModerationToast(''), 4000);

    // 4. Send FORCE_MUTE_PARTICIPANT over WebSocket
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify(
          createForceMutePayload(targetClientId, user?.id || myClientId, 'Muted by host')
        )
      );
    }
  };

  const handleMuteAll = () => {
    const updated = { ...mutedPeers };
    displayPeers.forEach((p) => {
      updated[p.client_id] = true;
    });
    setMutedPeers(updated);

    // Silence all active remote audio tracks locally
    Object.values(remoteStreams).forEach((st) => {
      if (st) {
        st.getAudioTracks().forEach((t) => {
          t.enabled = false;
        });
      }
    });

    setModerationToast('All participant microphones have been muted by host.');
    setTimeout(() => setModerationToast(''), 4000);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'MUTE_ALL' }));
    }
  };

  const handleRequestUnmutePermission = () => {
    setUnmuteRequestPending(true);
    setModerationToast('Requested host permission to unmute your microphone.');
    setTimeout(() => setModerationToast(''), 4500);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify(
          createRequestUnmutePayload(myClientId, user?.full_name || 'Participant')
        )
      );
    } else {
      // In demo mode or if WS is disconnected, simulate host review after 2.5 seconds
      setTimeout(() => {
        setUnmuteRequestPending(false);
        setConsentHostName('Prof. Rajesh Ramanujan (Host)');
        setShowConsentModal(true);
      }, 2500);
    }
  };

  const handleAllowUnmuteRequest = (requestId, senderId) => {
    setPendingUnmuteRequests((prev) => prev.filter((r) => r.id !== requestId && r.senderId !== senderId));
    const peerObj = displayPeers.find((p) => p.client_id === senderId);
    const peerName = peerObj?.name || 'Participant';
    setModerationToast(`Granted unmute permission to ${peerName}.`);
    setTimeout(() => setModerationToast(''), 4000);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify(
          createGrantUnmutePayload(senderId, user?.id || myClientId, user?.full_name || 'Host')
        )
      );
    }
  };

  const handleDenyUnmuteRequest = (requestId, senderId, reason = 'Please wait for the Q&A section') => {
    setPendingUnmuteRequests((prev) => prev.filter((r) => r.id !== requestId && r.senderId !== senderId));
    setModerationToast('Declined unmute request.');
    setTimeout(() => setModerationToast(''), 4000);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify(
          createDenyUnmutePayload(senderId, reason)
        )
      );
    }
  };

  const handleAllowAllUnmuteRequests = () => {
    pendingUnmuteRequests.forEach((req) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify(
            createGrantUnmutePayload(req.senderId, user?.id || myClientId, user?.full_name || 'Host')
          )
        );
      }
    });
    setPendingUnmuteRequests([]);
    setModerationToast('Granted unmute permission to all requesting participants.');
    setTimeout(() => setModerationToast(''), 4000);
  };

  const handleConfirmConsentUnmute = () => {
    setShowConsentModal(false);
    setIsForceMutedByHost(false);
    setUnmuteRequestPending(false);
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = true;
      });
    }
    setMicOn(true);
    setModerationToast('Microphone unmuted successfully.');
    setTimeout(() => setModerationToast(''), 4000);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'MEDIA_STATE_CHANGE',
          client_id: myClientId,
          mic_on: true,
          camera_on: cameraOn
        })
      );
    }
  };

  const handleDismissConsentModal = () => {
    setShowConsentModal(false);
  };

  const handleHostDisableVideo = (targetClientId) => {
    const peerObj = displayPeers.find((p) => p.client_id === targetClientId);
    const peerName = peerObj?.name || 'Participant';
    setModerationToast(`Disabled video stream for ${peerName}.`);
    setTimeout(() => setModerationToast(''), 4000);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'DISABLE_VIDEO',
          target_client_id: targetClientId
        })
      );
    }
  };

  const handleHostKick = (peer) => {
    if (!window.confirm(`Kick and permanently blacklist ${peer.name} from this study pod?`)) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'KICK_PARTICIPANT',
        target_client_id: peer.client_id,
        target_user_id: peer.user_id,
        reason: 'Host moderation removal'
      }));
    }
  };

  const isUserSpeaking = micOn && audioLevel > 18;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-wider mb-1">
            <Radio className="h-4 w-4 text-emerald-400 animate-pulse" />
            <span>Live Peer Video Conferencing</span>
          </div>
          <h2 className="text-2xl font-black text-white flex items-center gap-2.5">
            <span>Learning Pods & Collaborative Rooms</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold">
              Meet & Zoom Compatible WebRTC
            </span>
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Real-time peer video, screen sharing, live synchronized whiteboard, and instant @Tutor curriculum co-pilot.
          </p>
          {educatorQuota && (
            <div className="mt-2.5 inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold">
              <span>Educator Pod Quota:</span>
              <span className="text-white font-extrabold">Daily {educatorQuota.daily_created}/{educatorQuota.daily_limit} ({educatorQuota.daily_remaining} left)</span>
              <span>•</span>
              <span className="text-white font-extrabold">Weekly {educatorQuota.weekly_created}/{educatorQuota.weekly_limit}</span>
            </div>
          )}
        </div>

        {!activePod && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-indigo-600/30 transition flex items-center gap-2 shrink-0 self-start sm:self-auto"
          >
            <Plus className="h-4 w-4" />
            <span>Start Study Pod</span>
          </button>
        )}
      </div>

      {moderationToast && (
        <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs font-bold flex items-center gap-2 animate-bounce">
          <span>🛡️ Host Moderation: {moderationToast}</span>
        </div>
      )}

      {/* Pod List View (when outside a room) */}
      {!activePod ? (
        <div className="space-y-6">
          {/* Live Kshetra Hero Hub & Quick Join Card */}
          <div className="p-6 rounded-3xl bg-gradient-to-br from-[#12162B] via-[#171C36] to-[#0A0D1C] border border-[#262C4C] shadow-2xl relative overflow-hidden">
            {/* Decorative Glows */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-[#FF9933]/15 via-[#FF6F9C]/10 to-transparent rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-gradient-to-tr from-[#8B7CFF]/15 to-transparent rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-2 max-w-xl">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#FF9933]/20 text-[#FF9933] border border-[#FF9933]/30 flex items-center gap-1.5 shadow-sm">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#FF9933] animate-ping" />
                    Live Kshetra Integrated
                  </span>
                  <span className="text-[11px] text-[#8A90B4] flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5 text-[#5FE3B0]" />
                    P2P Encrypted Mesh
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-[#ECEDF7] font-heading tracking-tight">
                  Connect to Any Live Kshetra Meeting
                </h2>
                <p className="text-xs text-[#8A90B4] leading-relaxed">
                  Enter any Live Kshetra room code or meeting link to join immediately, or spin up an instant collaborative pod with integrated whiteboard and @Tutor AI assistance.
                </p>
              </div>

              {/* Quick Join and Instant Launch Controls */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="relative flex-1 sm:w-80">
                  <input
                    type="text"
                    value={kshetraCodeInput}
                    onChange={(e) => setKshetraCodeInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleQuickJoinKshetra();
                      }
                    }}
                    placeholder="Enter code or paste join link..."
                    className="w-full bg-[#0A0D1C] border border-[#262C4C] focus:border-[#FF9933] rounded-2xl px-4 py-3 text-xs text-[#ECEDF7] placeholder-[#8A90B4] font-mono focus:outline-none transition shadow-inner"
                  />
                  {kshetraCodeInput && (
                    <button
                      type="button"
                      onClick={() => setKshetraCodeInput('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleQuickJoinKshetra()}
                  disabled={!kshetraCodeInput.trim()}
                  className="px-5 py-3 rounded-2xl bg-gradient-to-r from-[#FF9933] to-[#FF6F9C] hover:from-[#e8892a] hover:to-[#e85b88] disabled:opacity-40 text-[#0A0D1C] font-heading font-black text-xs uppercase tracking-wider shadow-lg shadow-[#FF9933]/25 transition flex items-center justify-center gap-2 shrink-0 cursor-pointer"
                >
                  <span>Join Room</span>
                </button>

                <button
                  type="button"
                  onClick={handleInstantKshetraPod}
                  className="px-4 py-3 rounded-2xl bg-[#171C36] hover:bg-[#262C4C] border border-[#8B7CFF]/40 text-[#ECEDF7] hover:text-white font-heading font-bold text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 shrink-0 shadow-sm cursor-pointer"
                  title="Create an instant Live Kshetra pod with a random room code"
                >
                  <Zap className="h-4 w-4 text-[#FFC15E]" />
                  <span>Instant Pod</span>
                </button>
              </div>
            </div>
          </div>

          {/* Pod Grid Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pods.map((pod) => {
              const podKshetraCode = pod.kshetra_meeting_code || `sih-pod-${pod.id}`;
              const kshetraExternalUrl = `https://live-kshetra.vercel.app/join/${podKshetraCode}`;
              return (
                <div
                  key={pod.id}
                  className="p-6 rounded-2xl bg-[#12162B] border border-[#262C4C] hover:border-[#8B7CFF]/50 shadow-xl transition space-y-4 flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#5FE3B0]/15 text-[#5FE3B0] border border-[#5FE3B0]/30 flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-[#5FE3B0] animate-ping" />
                          Live Kshetra
                        </span>
                        {pod.has_passcode && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-[#FFC15E]/15 text-[#FFC15E] border border-[#FFC15E]/30 flex items-center gap-1">
                            🔒 Passkey
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#8B7CFF]/15 text-[#8B7CFF] border border-[#8B7CFF]/30 flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />
                          {pod.scheduled_duration_minutes || 45}m
                        </span>
                      </div>
                      <span className="text-xs text-[#8A90B4] flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        Max {pod.max_peers || 6}
                      </span>
                    </div>

                    <h3 className="font-extrabold text-[#ECEDF7] text-lg group-hover:text-[#8B7CFF] transition">
                      {pod.title}
                    </h3>
                    <p className="text-xs text-[#5FE3B0] font-semibold mt-1.5 flex items-center gap-1">
                      <Bookmark className="h-3.5 w-3.5" /> Focus: {pod.topic}
                    </p>
                    {pod.agenda && (
                      <p className="text-[11px] text-[#8A90B4] mt-1 line-clamp-1 italic">
                        Agenda: {pod.agenda}
                      </p>
                    )}
                    {pod.host_name && (
                      <p className="text-[11px] text-[#8A90B4] mt-1">Host: {pod.host_name}</p>
                    )}

                    {/* Kshetra Meeting Code Chip */}
                    <div className="mt-3.5 p-2 rounded-xl bg-[#0A0D1C] border border-[#262C4C] flex items-center justify-between">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[10px] text-[#8A90B4] uppercase font-bold tracking-wider">Room Code:</span>
                        <code className="text-xs font-mono font-bold text-[#FF9933] truncate">
                          {podKshetraCode}
                        </code>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => handleCopyKshetraCode(podKshetraCode, e)}
                          className="p-1 rounded-lg text-[#8A90B4] hover:text-[#ECEDF7] hover:bg-[#171C36] transition"
                          title="Copy Meeting Code"
                        >
                          {copiedPodCode === podKshetraCode ? (
                            <Check className="h-3.5 w-3.5 text-[#5FE3B0]" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <a
                          href={kshetraExternalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-1 rounded-lg text-[#8A90B4] hover:text-[#FF9933] hover:bg-[#171C36] transition"
                          title="Open Live Kshetra in external tab"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-[#262C4C] flex items-center justify-between gap-2">
                    <span className="text-[11px] text-[#8A90B4]">Live Video • Whiteboard • @Tutor</span>
                    <button
                      onClick={() => {
                        setViewMode('kshetra');
                        handleJoinClick(pod);
                      }}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#FF9933] to-[#FF6F9C] hover:from-[#e8892a] hover:to-[#e85b88] text-[#0A0D1C] font-heading font-black text-xs uppercase tracking-wider shadow-md transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Video className="h-3.5 w-3.5" />
                      <span>{pod.has_passcode ? 'Enter Passkey' : 'Join Kshetra'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* INSIDE ACTIVE VIDEO CONFERENCING ROOM */
        <div className="flex flex-col space-y-4">
          {/* Top Meeting Header Bar */}
          <div className="flex flex-wrap items-center justify-between p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="h-3 w-3 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <div>
                <h3 className="font-black text-white text-sm sm:text-base truncate flex items-center gap-2">
                  <span>{activePod.title}</span>
                  <span className="text-[11px] font-normal text-slate-400">({activePod.topic})</span>
                </h3>
                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3" /> End-to-End WebRTC Encrypted
                  </span>
                  <span>•</span>
                  <span>Pod ID: #{activePod.id}</span>
                </div>
              </div>
            </div>

            {/* Synchronized Countdown Timer Badge */}
            {remainingSeconds !== null && (
              <div
                className={`px-3 py-1.5 rounded-xl border font-mono font-black text-xs flex items-center gap-1.5 transition-all shadow-sm ${
                  remainingSeconds <= 60
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 animate-pulse'
                    : remainingSeconds <= 300
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                    : 'bg-slate-950 text-emerald-400 border-slate-800'
                }`}
                title="Scheduled Session Remaining Time"
              >
                <Clock
                  className={`h-3.5 w-3.5 ${
                    remainingSeconds <= 60
                      ? 'text-rose-400'
                      : remainingSeconds <= 300
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                  }`}
                />
                <span>{formatTime(remainingSeconds)}</span>
                {remainingSeconds <= 60 && (
                  <span className="text-[10px] uppercase font-bold text-rose-400 tracking-wider">Closing Soon</span>
                )}
              </div>
            )}

            {/* Hand Raised Banner */}
            {handRaisedUsers.length > 0 && (
              <div className="bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs px-3 py-1 rounded-xl flex items-center gap-1.5 animate-bounce">
                <span>✋</span>
                <span className="font-semibold">{handRaisedUsers.join(', ')} raised hand!</span>
              </div>
            )}

            {/* View Mode Switcher */}
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-slate-950 border border-slate-800 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setViewMode('kshetra')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                    viewMode === 'kshetra'
                      ? 'bg-gradient-to-r from-[#FF9933] to-[#FF6F9C] text-[#0A0D1C] shadow-md shadow-[#FF9933]/20 font-black'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="h-2 w-2 rounded-full bg-orange-400 animate-pulse" />
                  <span>Live Kshetra</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('video')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                    viewMode === 'video' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Video className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">Mesh Grid</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('whiteboard')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                    viewMode === 'whiteboard' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <PenTool className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">Whiteboard</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('split')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                    viewMode === 'split' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Layers className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">Split View</span>
                </button>
              </div>

              {/* Copy Invite Link */}
              <button
                type="button"
                onClick={copyMeetingLink}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1.5 transition border border-slate-700"
                title="Copy Meeting Link"
              >
                {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">{copiedLink ? 'Copied!' : 'Copy Link'}</span>
              </button>
            </div>
          </div>

          {/* Host Disconnect Grace Period Alert Banner */}
          {hostGraceCountdown !== null && (
            <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-400 animate-bounce shrink-0" />
                <span>
                  <strong>Host Disconnected:</strong> Reconnection grace period in effect. Room will auto-terminate in{' '}
                  <span className="font-mono font-black text-amber-200 underline">
                    {formatTime(hostGraceCountdown)}
                  </span>{' '}
                  if host does not return.
                </span>
              </div>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/30">
                Grace Active
              </span>
            </div>
          )}

          {/* Scheduled In-Pod Time Warning Toast */}
          {timeWarningToast && (
            <div className="p-3 rounded-xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-200 text-xs flex items-center gap-2.5 shadow-xl">
              <Clock className="h-4 w-4 text-indigo-400 shrink-0" />
              <span className="font-semibold">{timeWarningToast}</span>
            </div>
          )}

          {/* Media Permission Warning if applicable */}
          {mediaError && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between">
              <span>⚠️ {mediaError}</span>
              <button
                onClick={startLocalMedia}
                className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 font-bold uppercase text-[10px] tracking-wider"
              >
                Retry Camera Access
              </button>
            </div>
          )}

          {/* Main Stage Grid: Video/Whiteboard + Side Panel */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[640px]">
            {/* Main Center Video Area (2 Cols) */}
            <div className="lg:col-span-2 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-2xl overflow-hidden relative">
              {/* LIVE KSHETRA EMBEDDED STAGE */}
              {viewMode === 'kshetra' && (
                <div className="my-1 flex-1 w-full h-full min-h-[460px] rounded-xl overflow-hidden flex flex-col">
                  <LiveKshetraFrame
                    meetingCode={activePod.kshetra_meeting_code || `sih-pod-${activePod.id}`}
                    podTitle={activePod.title}
                    isHost={isHost}
                  />
                </div>
              )}

              {/* VIDEO GRID VIEW */}
              {viewMode === 'video' && (
                <div className="grid grid-cols-2 gap-3.5 my-2 flex-1 overflow-y-auto">
                  {/* Tile 1: YOU (Real Live Local Webcam Video or Screen Share) */}
                  <div
                    className={`relative rounded-2xl bg-slate-950 border transition-all duration-300 flex flex-col items-center justify-center overflow-hidden min-h-[190px] ${
                      isUserSpeaking
                        ? 'ring-2 ring-emerald-400 border-emerald-500 shadow-lg shadow-emerald-500/20'
                        : 'border-slate-800'
                    }`}
                  >
                    {/* Live Video Element */}
                    <video
                      ref={localVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className={`w-full h-full object-cover transition-opacity duration-300 ${
                        cameraOn || screenSharing ? 'opacity-100 scale-x-[-1]' : 'opacity-0 absolute'
                      }`}
                    />

                    {/* Avatar Fallback if Camera Muted */}
                    {!cameraOn && !screenSharing && (
                      <div className="w-full h-full bg-gradient-to-tr from-slate-900 via-indigo-950/60 to-slate-900 flex flex-col items-center justify-center p-4">
                        <div className="relative">
                          <div className="h-20 w-20 rounded-full bg-indigo-600/30 border border-indigo-500/50 flex items-center justify-center text-white text-2xl font-black shadow-xl">
                            {user?.full_name?.charAt(0) || 'A'}
                          </div>
                          {isUserSpeaking && (
                            <span className="absolute inset-0 rounded-full border-2 border-emerald-400 animate-ping" />
                          )}
                        </div>
                        <span className="text-xs text-slate-300 font-semibold mt-3">
                          {user?.full_name || 'You'} (Camera Off)
                        </span>
                      </div>
                    )}

                    {/* User Status Bar */}
                    <div className="absolute bottom-3 left-3 bg-slate-950/85 backdrop-blur border border-slate-800 px-2.5 py-1 rounded-lg text-[10px] font-bold text-white flex items-center gap-2 shadow-md">
                      {micOn ? (
                        <span className="flex items-center gap-1">
                          <Mic className="h-3 w-3 text-emerald-400" />
                          {isUserSpeaking && (
                            <span className="flex gap-0.5 items-end h-2.5">
                              <span className="w-0.5 h-1.5 bg-emerald-400 animate-bounce" />
                              <span className="w-0.5 h-2.5 bg-emerald-400 animate-bounce" />
                              <span className="w-0.5 h-1 bg-emerald-400 animate-bounce" />
                            </span>
                          )}
                        </span>
                      ) : (
                        <MicOff className="h-3 w-3 text-rose-400" />
                      )}
                      <span>{user?.full_name || 'You'} (Local)</span>
                      {screenSharing && (
                        <span className="bg-cyan-500/20 text-cyan-300 px-1 rounded text-[9px]">Presenting</span>
                      )}
                    </div>

                    {handRaised && (
                      <div className="absolute top-3 left-3 bg-amber-500/20 border border-amber-500/50 px-2 py-0.5 rounded-full text-[10px] font-bold text-amber-300 flex items-center gap-1 animate-bounce">
                        <span>✋</span> Hand Raised
                      </div>
                    )}
                  </div>

                  {/* Tile 2: Connected Remote Peer or Peer 1 */}
                  {Object.entries(remoteStreams).length > 0 ? (
                    Object.entries(remoteStreams).map(([peerId, stream]) => {
                      const peerObj = connectedPeers.find((p) => p.client_id === peerId);
                      const pName = peerObj?.name || `Peer ${peerId.substring(0, 6)}`;
                      const pIsHost = peerObj?.role === 'EDUCATOR' || (activePod && activePod.host_id && peerObj?.user_id === activePod.host_id);
                      return (
                        <RemotePeerVideo
                          key={peerId}
                          peerId={peerId}
                          stream={stream}
                          peerName={pName}
                          isMuted={Boolean(mutedPeers[peerId])}
                          isHost={pIsHost}
                          isSpeaking={!mutedPeers[peerId]}
                          canModerate={canModerate}
                          onMute={handleHostMute}
                        />
                      );
                    })
                  ) : (
                    /* High-Fidelity Interactive Peer: Priya Patel */
                    <RemotePeerVideo
                      peerId="demo_priya"
                      stream={null}
                      peerName="Priya Patel"
                      isMuted={Boolean(mutedPeers['demo_priya'])}
                      isHost={false}
                      isSpeaking={!mutedPeers['demo_priya']}
                      canModerate={canModerate}
                      onMute={handleHostMute}
                    />
                  )}

                  {/* Tile 3: When host, render interactive student Rohan Verma; when student, render Host Prof. Ramanujan */}
                  {isHost ? (
                    <RemotePeerVideo
                      peerId="demo_rohan"
                      stream={null}
                      peerName="Rohan Verma"
                      isMuted={Boolean(mutedPeers['demo_rohan'])}
                      isHost={false}
                      isSpeaking={!mutedPeers['demo_rohan']}
                      canModerate={canModerate}
                      onMute={handleHostMute}
                    />
                  ) : (
                    <RemotePeerVideo
                      peerId="demo_host"
                      stream={null}
                      peerName="Prof. Rajesh Ramanujan"
                      isMuted={Boolean(mutedPeers['demo_host'])}
                      isHost={true}
                      isSpeaking={!mutedPeers['demo_host']}
                      canModerate={false}
                      onMute={handleHostMute}
                    />
                  )}

                  {/* Tile 4: COGNIPATH AI Tutor Co-Pilot Presence Tile */}
                  <div className="relative rounded-2xl bg-slate-950 border border-indigo-500/40 flex flex-col items-center justify-center overflow-hidden min-h-[190px]">
                    <div className="w-full h-full bg-gradient-to-br from-indigo-950/80 via-slate-950 to-slate-900 flex flex-col items-center justify-center p-4 text-center">
                      <div className="h-16 w-16 rounded-2xl bg-indigo-600/30 border border-indigo-400/50 flex items-center justify-center text-cyan-300 mb-2 shadow-lg shadow-indigo-500/20">
                        <Sparkles className="h-8 w-8 animate-pulse" />
                      </div>
                      <span className="text-xs font-bold text-white">COGNIPATH AI Co-Pilot</span>
                      <span className="text-[10px] text-indigo-300 mt-1">Listening for @Tutor mentions in chat</span>
                    </div>
                    <span className="absolute bottom-3 left-3 bg-indigo-950/90 border border-indigo-500/30 px-2.5 py-1 rounded-lg text-[10px] font-bold text-cyan-300">
                      ⚡ Active AI Assistant
                    </span>
                  </div>
                </div>
              )}

              {/* COLLABORATIVE WHITEBOARD VIEW */}
              {viewMode === 'whiteboard' && (
                <div className="my-2 flex-1 flex flex-col justify-between overflow-hidden">
                  {/* Whiteboard Toolbar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800 mb-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsEraser(false)}
                        className={`p-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                          !isEraser ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <PenTool className="h-3.5 w-3.5" />
                        <span>Pen</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEraser(true)}
                        className={`p-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                          isEraser ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <Eraser className="h-3.5 w-3.5" />
                        <span>Eraser</span>
                      </button>
                      <div className="flex items-center gap-1 ml-2">
                        {['#06b6d4', '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#ffffff'].map((color) => (
                          <button
                            key={color}
                            type="button"
                            onClick={() => {
                              setPenColor(color);
                              setIsEraser(false);
                            }}
                            className={`h-5 w-5 rounded-full border-2 transition ${
                              penColor === color && !isEraser ? 'border-white scale-110' : 'border-transparent'
                            }`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleClearCanvas}
                        className="p-2 rounded-lg bg-slate-800 hover:bg-rose-900/50 text-slate-300 hover:text-rose-300 text-xs font-semibold flex items-center gap-1 transition"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Clear</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleShareSnapshot}
                        className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1 transition shadow"
                      >
                        <Share2 className="h-3.5 w-3.5" />
                        <span>Post to Chat</span>
                      </button>
                    </div>
                  </div>

                  {/* Synchronized HTML5 Canvas */}
                  <div className="relative flex-1 bg-[#0b0f19] rounded-xl border border-slate-800 overflow-hidden shadow-inner">
                    <canvas
                      ref={canvasRef}
                      width={800}
                      height={450}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                      className="w-full h-full cursor-crosshair touch-none select-none"
                    />
                    <div className="absolute bottom-3 right-3 flex items-center gap-2 bg-slate-950/85 backdrop-blur border border-slate-800 px-3 py-1.5 rounded-xl text-[10px] text-slate-300 pointer-events-none">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span>Live WebSocket Canvas Synced</span>
                    </div>
                  </div>
                </div>
              )}

              {/* SPLIT VIEW (Top Live Kshetra Video + Bottom Canvas) */}
              {viewMode === 'split' && (
                <div className="my-2 flex-1 flex flex-col gap-3 overflow-hidden">
                  <div className="h-56 w-full rounded-xl overflow-hidden border border-slate-800 shrink-0">
                    <LiveKshetraFrame
                      meetingCode={activePod.kshetra_meeting_code || `sih-pod-${activePod.id}`}
                      podTitle={activePod.title}
                      isHost={isHost}
                    />
                  </div>
                  <div className="relative flex-1 bg-[#0b0f19] rounded-xl border border-slate-800 overflow-hidden">
                    <canvas
                      ref={canvasRef}
                      width={800}
                      height={320}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      className="w-full h-full cursor-crosshair"
                    />
                  </div>
                </div>
              )}

              {/* GOOGLE MEET / ZOOM BOTTOM CONTROL BAR */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/95 border border-slate-800 shadow-2xl mt-2">
                <div className="flex items-center gap-2 text-xs text-slate-400 font-semibold pl-2">
                  <span className="text-white hidden sm:inline">{activePod.title}</span>
                </div>

                {/* Primary Action Buttons */}
                <div className="flex items-center gap-2 sm:gap-3">
                  {/* Microphone Toggle with Host Lock & Privacy Handshake */}
                  <AudioControlButton
                    micOn={micOn}
                    isForceMutedByHost={isForceMutedByHost}
                    unmuteRequestPending={unmuteRequestPending}
                    onToggleMic={toggleMic}
                    onRequestUnmute={handleRequestUnmutePermission}
                  />

                  {/* Camera Toggle */}
                  <button
                    type="button"
                    onClick={toggleCamera}
                    className={`p-3 rounded-2xl font-bold transition-all ${
                      cameraOn
                        ? 'bg-slate-800 hover:bg-slate-700 text-white'
                        : 'bg-rose-500 hover:bg-rose-600 text-white ring-4 ring-rose-500/20'
                    }`}
                    title={cameraOn ? 'Turn Off Camera' : 'Turn On Camera'}
                  >
                    {cameraOn ? <Video className="h-5 w-5 text-indigo-400" /> : <VideoOff className="h-5 w-5" />}
                  </button>

                  {/* Screen Sharing Toggle */}
                  <button
                    type="button"
                    onClick={toggleScreenShare}
                    className={`p-3 rounded-2xl font-bold transition-all ${
                      screenSharing
                        ? 'bg-cyan-500 text-slate-950 ring-4 ring-cyan-500/20 shadow-lg shadow-cyan-500/30'
                        : 'bg-slate-800 hover:bg-slate-700 text-white'
                    }`}
                    title={screenSharing ? 'Stop Screen Sharing' : 'Share Screen'}
                  >
                    <Monitor className="h-5 w-5" />
                  </button>

                  {/* Hand Raise Button */}
                  <button
                    type="button"
                    onClick={toggleHandRaise}
                    className={`p-3 rounded-2xl font-bold transition-all ${
                      handRaised
                        ? 'bg-amber-500 text-slate-950 ring-4 ring-amber-500/20'
                        : 'bg-slate-800 hover:bg-slate-700 text-white'
                    }`}
                    title={handRaised ? 'Lower Hand' : 'Raise Hand'}
                  >
                    <Hand className="h-5 w-5" />
                  </button>

                  {/* Leave Meeting Button */}
                  <button
                    type="button"
                    onClick={() => {
                      const isHost =
                        activePod &&
                        ((user?.id && activePod.host_id && user.id === activePod.host_id) ||
                          user?.role === 'EDUCATOR' ||
                          (user?.full_name && activePod.host_name && user.full_name === activePod.host_name));
                      if (isHost) {
                        setShowHostLeaveModal(true);
                      } else {
                        leavePod();
                      }
                    }}
                    className="px-4 py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-rose-600/30"
                    title="Leave Pod Meeting"
                  >
                    <PhoneOff className="h-4 w-4" />
                    <span className="hidden sm:inline">Leave Room</span>
                  </button>
                </div>

                <div className="flex items-center gap-2 pr-2">
                  <span className="text-xs text-slate-400 hidden sm:inline">
                    {connectedPeers.length + 1} Connected
                  </span>
                </div>
              </div>
            </div>

            {/* SIDEBAR: Live Pod Chat & Participants (1 Col) */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl flex flex-col justify-between shadow-2xl overflow-hidden">
              {/* Sidebar Tabs */}
              <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
                <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
                  <button
                    onClick={() => setSideTab('chat')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                      sideTab === 'chat' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Live Chat
                  </button>
                  <button
                    onClick={() => setSideTab('participants')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                      sideTab === 'participants' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Peers ({displayPeers.length + 1})
                  </button>
                  <button
                    onClick={() => setSideTab('kshetra')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                      sideTab === 'kshetra' ? 'bg-gradient-to-r from-[#FF9933] to-[#FF6F9C] text-[#0A0D1C] font-black' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Kshetra Room
                  </button>
                </div>

                <span className="text-[10px] text-cyan-400 font-semibold bg-cyan-500/10 px-2.5 py-1 rounded-full border border-cyan-500/20">
                  @tutor ready
                </span>
              </div>

              {sideTab === 'chat' ? (
                <>
                  {/* Chat message feed */}
                  <div className="flex-1 p-4 overflow-y-auto space-y-3.5">
                    {messages.map((m) => (
                      <div
                        key={m.id}
                        className={`p-3 rounded-2xl text-xs space-y-1 ${
                          m.is_ai_tutor
                            ? 'bg-gradient-to-br from-indigo-950/80 to-slate-950 border border-indigo-500/40 text-slate-200'
                            : m.sender_name === (user?.full_name || 'Alex Kumar')
                            ? 'bg-indigo-600/20 border border-indigo-500/30 text-white ml-3'
                            : 'bg-slate-950/90 border border-slate-800 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`font-bold flex items-center gap-1 ${
                              m.is_ai_tutor ? 'text-cyan-300' : 'text-indigo-400'
                            }`}
                          >
                            {m.is_ai_tutor && <Sparkles className="h-3 w-3" />}
                            {m.sender_name}
                          </span>
                          <span className="text-[10px] text-slate-500">{m.timestamp}</span>
                        </div>
                        <p className="leading-relaxed whitespace-pre-wrap">{m.content}</p>
                        {m.citations && m.citations.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-indigo-500/20 text-[10px] text-cyan-400 space-y-1">
                            <span className="font-bold">📄 Grounded Citations:</span>
                            {m.citations.map((c, i) => (
                              <div key={i} className="truncate">
                                • {c.source_title} ({c.page_or_chunk})
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Chat Input Bar */}
                  <form onSubmit={sendPodChat} className="p-3 bg-slate-950/90 border-t border-slate-800 flex gap-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Type a message or @tutor <question>..."
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                    />
                    <button
                      type="submit"
                      disabled={!chatInput.trim()}
                      className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white transition shrink-0"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </form>
                </>
              ) : (
                /* Participants List Tab */
                <div className="flex-1 p-4 overflow-y-auto space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="text-xs font-bold text-slate-300">
                      In Pod ({displayPeers.length + 1})
                    </span>
                    {canModerate && (
                      <button
                        type="button"
                        onClick={handleMuteAll}
                        className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-[10px] font-bold flex items-center gap-1.5 transition"
                        title="Mute all participant microphones"
                      >
                        <VolumeX className="h-3 w-3" />
                        <span>Mute All</span>
                      </button>
                    )}
                  </div>

                  {/* You / Self */}
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-full bg-indigo-600/30 text-white font-bold flex items-center justify-center text-xs">
                        {user?.full_name?.charAt(0) || 'Y'}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-1.5">
                          <span>{user?.full_name || 'You'}</span>
                          <span className="text-[10px] text-indigo-400">(You)</span>
                          {isHost && (
                            <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-bold border border-amber-500/30">
                              Host
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400">{user?.role || (isHost ? 'Educator' : 'Student')}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {handRaised && <span className="text-sm">✋</span>}
                      {micOn ? (
                        <span className="flex items-center gap-1 text-emerald-400 text-[10px] font-bold">
                          <Mic className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Active</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-rose-400 text-[10px] font-bold">
                          <MicOff className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Muted</span>
                        </span>
                      )}
                      {cameraOn ? <Video className="h-3.5 w-3.5 text-indigo-400" /> : <VideoOff className="h-3.5 w-3.5 text-slate-500" />}
                    </div>
                  </div>

                  {/* Unified Peer List (Connected Peers or Interactive Demo Peers) */}
                  {displayPeers.map((peer, idx) => {
                    const isPeerMuted = Boolean(mutedPeers[peer.client_id]);
                    const isEducator = peer.role === 'EDUCATOR';
                    return (
                      <div key={peer.client_id || idx} className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className={`h-8 w-8 rounded-full font-bold flex items-center justify-center text-xs ${
                              isEducator ? 'bg-purple-600/30 text-purple-300' : 'bg-cyan-600/30 text-cyan-300'
                            }`}>
                              {peer.name?.charAt(0) || 'P'}
                            </div>
                            <div>
                              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                                <span>{peer.name}</span>
                                {isEducator && (
                                  <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-bold border border-amber-500/30">
                                    Host
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400">{peer.role === 'EDUCATOR' ? 'Educator' : 'Peer Student'}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {isPeerMuted ? (
                              <span className="flex items-center gap-1 text-rose-400 text-[10px] font-bold">
                                <MicOff className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">Muted</span>
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-emerald-400 text-[10px] font-bold">
                                <Mic className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">Active</span>
                              </span>
                            )}
                            <Video className="h-3.5 w-3.5 text-indigo-400" />
                          </div>
                        </div>

                        {/* Host Moderation Controls */}
                        {canModerate && (
                          <div className="pt-2 border-t border-slate-900 flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleHostMute(peer.client_id)}
                              className={`px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 transition ${
                                isPeerMuted
                                  ? 'bg-indigo-600/30 hover:bg-indigo-600/50 text-cyan-300 border border-indigo-500/40'
                                  : 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40'
                              }`}
                              title={isPeerMuted ? 'Ask participant to unmute' : 'Force mute participant'}
                            >
                              {isPeerMuted ? (
                                <>
                                  <Radio className="h-3 w-3 text-cyan-300 animate-pulse" /> Ask to Unmute
                                </>
                              ) : (
                                <>
                                  <VolumeX className="h-3 w-3 text-rose-400" /> Mute
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleHostDisableVideo(peer.client_id)}
                              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-300 flex items-center gap-1 transition"
                              title="Turn Off Video"
                            >
                              <VideoOff className="h-3 w-3 text-amber-400" /> Cam Off
                            </button>
                            {!peer.client_id.startsWith('demo_') && (
                              <button
                                type="button"
                                onClick={() => handleHostKick(peer)}
                                className="px-2 py-1 rounded bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800 text-[10px] font-bold flex items-center gap-1 transition"
                                title="Kick & Blacklist"
                              >
                                <Trash2 className="h-3 w-3" /> Kick
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/30 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-xl bg-indigo-600/40 text-cyan-300 font-bold flex items-center justify-center text-xs">
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">COGNIPATH AI Co-Pilot</div>
                        <span className="text-[10px] text-cyan-400">Auto Doubt Assistant</span>
                      </div>
                    </div>
                    <span className="text-[10px] text-emerald-400 font-bold">Online</span>
                  </div>
                </div>
              )}

              {/* Live Kshetra Room Info & Invite Tab */}
              {sideTab === 'kshetra' && (
                <div className="flex-1 p-4 overflow-y-auto space-y-4">
                  {/* Meeting Code Box */}
                  <div className="p-4 rounded-2xl bg-[#0A0D1C] border border-[#262C4C] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-[#8A90B4] font-bold uppercase tracking-wider">
                        Live Kshetra Room Code
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#5FE3B0]/15 text-[#5FE3B0] border border-[#5FE3B0]/30">
                        Active P2P Room
                      </span>
                    </div>

                    <div className="flex items-center justify-between bg-[#12162B] p-2.5 rounded-xl border border-[#262C4C]">
                      <code className="text-sm font-mono font-bold text-[#FF9933]">
                        {activePod.kshetra_meeting_code || `sih-pod-${activePod.id}`}
                      </code>
                      <button
                        type="button"
                        onClick={(e) =>
                          handleCopyKshetraCode(activePod.kshetra_meeting_code || `sih-pod-${activePod.id}`, e)
                        }
                        className="px-3 py-1.5 rounded-lg bg-[#171C36] hover:bg-[#262C4C] text-[#ECEDF7] text-xs font-bold flex items-center gap-1.5 border border-[#262C4C] transition cursor-pointer"
                      >
                        {copiedPodCode === (activePod.kshetra_meeting_code || `sih-pod-${activePod.id}`) ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-[#5FE3B0]" />
                            <span className="text-[#5FE3B0]">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Direct Link & Popout */}
                  <div className="p-4 rounded-2xl bg-[#0A0D1C] border border-[#262C4C] space-y-3">
                    <span className="text-[10px] text-[#8A90B4] font-bold uppercase tracking-wider block">
                      Direct WebRTC Join Link
                    </span>
                    <p className="text-xs text-[#ECEDF7] font-mono break-all p-2.5 rounded-xl bg-[#12162B] border border-[#262C4C]">
                      {`https://live-kshetra.vercel.app/join/${activePod.kshetra_meeting_code || `sih-pod-${activePod.id}`}`}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const link = `https://live-kshetra.vercel.app/join/${
                            activePod.kshetra_meeting_code || `sih-pod-${activePod.id}`
                          }`;
                          navigator.clipboard.writeText(link);
                          setCopiedLink(true);
                          setTimeout(() => setCopiedLink(false), 2000);
                        }}
                        className="flex-1 py-2 px-3 rounded-xl bg-[#171C36] hover:bg-[#262C4C] text-[#ECEDF7] text-xs font-bold flex items-center justify-center gap-1.5 border border-[#262C4C] transition cursor-pointer"
                      >
                        {copiedLink ? <Check className="h-3.5 w-3.5 text-[#5FE3B0]" /> : <Copy className="h-3.5 w-3.5" />}
                        <span>{copiedLink ? 'Link Copied!' : 'Copy Direct Link'}</span>
                      </button>
                      <a
                        href={`https://live-kshetra.vercel.app/join/${
                          activePod.kshetra_meeting_code || `sih-pod-${activePod.id}`
                        }`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-2 px-3 rounded-xl bg-gradient-to-r from-[#FF9933] to-[#FF6F9C] text-[#0A0D1C] font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md shadow-[#FF9933]/20"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span>Popout ↗</span>
                      </a>
                    </div>
                  </div>

                  {/* Ready-to-Send Social Invite Message */}
                  <div className="p-4 rounded-2xl bg-[#0A0D1C] border border-[#262C4C] space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-[#8A90B4] font-bold uppercase tracking-wider">
                        One-Click Invitation Template
                      </span>
                      <Share2 className="h-3.5 w-3.5 text-[#8B7CFF]" />
                    </div>
                    <p className="text-xs text-[#8A90B4]">
                      Copy formatted text with code and direct link for WhatsApp, Discord, or Email:
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        const code = activePod.kshetra_meeting_code || `sih-pod-${activePod.id}`;
                        const inviteText = `🎓 Join our SmartLearn Live Kshetra Pod!\n📌 Topic: ${activePod.title}\n🔑 Meeting Code: ${code}\n🔗 Direct Link: https://live-kshetra.vercel.app/join/${code}\n(Zero-trust video mesh, real-time collaborative whiteboard & @Tutor AI assistance included!)`;
                        navigator.clipboard.writeText(inviteText);
                        setCopiedInviteMessage(true);
                        setTimeout(() => setCopiedInviteMessage(false), 2500);
                      }}
                      className="w-full py-2.5 rounded-xl bg-[#8B7CFF]/15 hover:bg-[#8B7CFF]/25 border border-[#8B7CFF]/40 text-[#8B7CFF] text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
                    >
                      {copiedInviteMessage ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-[#5FE3B0]" />
                          <span className="text-[#5FE3B0]">Invite Copied to Clipboard!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>Copy WhatsApp / Email Invite</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Passcode Verification Modal */}
      {showPasscodeModal && targetPodForJoin && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <div>
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center mb-2">
                🔒
              </div>
              <h3 className="text-base font-extrabold text-white">Passcode Required</h3>
              <p className="text-xs text-slate-400 mt-1">
                "{targetPodForJoin.title}" is protected by the host. Enter the meeting passkey to enter.
              </p>
            </div>

            <form onSubmit={handleVerifyAndJoin} className="space-y-3">
              <div>
                <input
                  type="password"
                  placeholder="Enter Pod Passcode"
                  required
                  value={enteredPasscode}
                  onChange={(e) => setEnteredPasscode(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 font-mono tracking-widest focus:outline-none focus:border-indigo-500"
                />
                {passcodeError && (
                  <p className="text-[11px] font-bold text-rose-400 mt-1.5">{passcodeError}</p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPasscodeModal(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow"
                >
                  Verify & Join
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Start New Pod Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Video className="h-5 w-5 text-indigo-400" />
                <span>Launch New Study Pod</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Create a live WebRTC audio/video room with host moderation and security controls.
              </p>
            </div>

            <form onSubmit={handleCreatePod} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Study Pod Title</label>
                <input
                  type="text"
                  value={newPodTitle}
                  onChange={(e) => setNewPodTitle(e.target.value)}
                  placeholder="e.g. Graph Algorithms & Dijkstra Study Group"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Syllabus Topic Focus</label>
                <input
                  type="text"
                  value={newPodTopic}
                  onChange={(e) => setNewPodTopic(e.target.value)}
                  placeholder="e.g. Greedy choice proofs and relaxation logic"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Session Agenda</label>
                <input
                  type="text"
                  value={newPodAgenda}
                  onChange={(e) => setNewPodAgenda(e.target.value)}
                  placeholder="e.g. Walkthrough tree rotation proofs and review quiz"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-indigo-400" />
                  <span>Scheduled Session Duration</span>
                </label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {[15, 30, 45, 60].map((dur) => (
                    <button
                      key={dur}
                      type="button"
                      onClick={() => {
                        setNewPodDuration(dur);
                        setCustomDuration('');
                      }}
                      className={`py-2 px-1 rounded-xl text-xs font-bold border transition ${
                        newPodDuration === dur && !customDuration
                          ? 'bg-indigo-600 border-indigo-500 text-white shadow-md'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                      }`}
                    >
                      {dur}m
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="5"
                    max="240"
                    value={customDuration}
                    onChange={(e) => {
                      setCustomDuration(e.target.value);
                      if (e.target.value) setNewPodDuration(parseInt(e.target.value, 10));
                    }}
                    placeholder="Or enter custom minutes (5 - 240)..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                  {customDuration && (
                    <span className="text-xs text-indigo-400 font-semibold shrink-0">min</span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Pod auto-terminates when duration finishes, with advance alerts at 5m and 1m remaining.
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[#FF9933]" />
                    <span>Live Kshetra Room Code (Optional)</span>
                  </label>
                  <span className="text-[10px] text-[#FF9933] font-medium">Auto-generated if blank</span>
                </div>
                <input
                  type="text"
                  value={newPodKshetraCode}
                  onChange={(e) => setNewPodKshetraCode(e.target.value)}
                  placeholder="e.g. sih-tree-rotations or paste live-kshetra URL"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-[#FF9933] rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 font-mono focus:outline-none"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Custom room on <a href="https://live-kshetra.vercel.app/" target="_blank" rel="noreferrer" className="text-[#FF9933] hover:underline">live-kshetra.vercel.app</a>. Participants can join inside LMS or externally.
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Meeting Passcode (Optional)</label>
                <input
                  type="text"
                  value={newPodPasscode}
                  onChange={(e) => setNewPodPasscode(e.target.value)}
                  placeholder="Leave empty for public pod or enter 4-digit code"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider shadow"
                >
                  Launch Room
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Host Leave Modal: Leave Temporarily vs End Pod for Everyone */}
      {showHostLeaveModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Host Session Exit</h3>
                <p className="text-xs text-slate-400 mt-1">
                  You are the host of this Learning Pod. Choose how you would like to exit:
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowHostLeaveModal(false);
                  leavePod();
                }}
                className="w-full text-left p-3.5 rounded-xl border border-slate-800 bg-slate-950 hover:border-amber-500/40 hover:bg-slate-900 transition group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-300 group-hover:text-amber-200">
                    🟡 Leave Temporarily (180s Grace Period)
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Participants remain in the room. You have a 3-minute grace window to switch networks or rejoin before auto-termination.
                </p>
              </button>

              <button
                type="button"
                onClick={handleEndPodForEveryone}
                className="w-full text-left p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 hover:border-rose-500/50 transition group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-rose-300 group-hover:text-rose-200">
                    🔴 End Pod for Everyone (Immediate Teardown)
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Immediately concludes the meeting, revokes WebRTC streams, disconnects all attendees, and marks the session COMPLETED.
                </p>
              </button>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowHostLeaveModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
              >
                Stay in Room
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Session Exit & Summary Modal */}
      {sessionSummary && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="text-center space-y-2">
              <div className="inline-flex p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <Check className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-black text-white">Learning Pod Concluded</h3>
              <p className="text-xs text-slate-400">{sessionSummary.reason}</p>
            </div>

            <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 space-y-2.5 text-xs">
              <div className="flex justify-between items-center text-slate-400">
                <span>Pod Title</span>
                <span className="font-bold text-white max-w-[200px] truncate">{sessionSummary.podTitle}</span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>Syllabus Focus</span>
                <span className="font-semibold text-cyan-300 max-w-[200px] truncate">{sessionSummary.topic}</span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>Scheduled Duration</span>
                <span className="font-bold text-indigo-300">{sessionSummary.durationMinutes} mins</span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>Total Attendees</span>
                <span className="font-bold text-white">{sessionSummary.totalParticipants}</span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>Session Status</span>
                <span className="px-2 py-0.5 rounded font-extrabold text-[10px] bg-slate-800 text-slate-200 border border-slate-700">
                  {sessionSummary.status}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>Concluded At</span>
                <span className="font-mono text-slate-300">{sessionSummary.endedAt}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSessionSummary(null)}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg transition"
            >
              Return to Pods Lobby
            </button>
          </div>
        </div>
      )}

      {/* Unmute Permission Consent Dialog for Participants */}
      <UnmuteConsentModal
        isOpen={showConsentModal}
        hostName={consentHostName}
        onConfirmUnmute={handleConfirmConsentUnmute}
        onDismiss={handleDismissConsentModal}
      />

      {/* Host Incoming Unmute Permission Requests Queue */}
      {canModerate && (
        <HostRequestNotification
          requests={pendingUnmuteRequests}
          onAllow={handleAllowUnmuteRequest}
          onDeny={handleDenyUnmuteRequest}
          onAllowAll={handleAllowAllUnmuteRequests}
        />
      )}
    </div>
  );
}

