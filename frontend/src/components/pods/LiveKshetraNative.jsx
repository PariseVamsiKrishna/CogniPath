import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Share2,
  PenTool,
  Eraser,
  Trash2,
  Download,
  Hand,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  Radio,
  ExternalLink,
  ShieldCheck,
  Clock,
  Settings,
  Smile,
  Info,
  Lock,
  Unlock,
  Volume2,
  VolumeX,
  RotateCcw,
  Palette,
  X,
  UserX,
  MessageSquare,
  Bot
} from 'lucide-react';

const REACTION_EMOJIS = ['👍', '❤️', '👏', '🎉', '😂', '😮', '🔥'];

const WHITEBOARD_COLORS = [
  '#FF9933', // Signature Live Kshetra Saffron
  '#FFFFFF', // Pure White
  '#06b6d4', // Cyan
  '#10b981', // Emerald
  '#f43f5e', // Rose
  '#f59e0b'  // Amber
];

export default function LiveKshetraNative({
  meetingCode = 'sih-kshetra-live',
  podTitle = 'Live Kshetra Studio',
  user = null,
  isHost = false,
  onClose,
  initialMessages = []
}) {
  const cleanCode = (meetingCode || 'sih-pod-live').trim().replace(/\s+/g, '-').toLowerCase();
  const userName = user?.full_name || 'Learner';
  const userRole = user?.role || 'STUDENT';

  // Session Layout
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeDrawer, setActiveDrawer] = useState(null); // 'chat' | 'people' | 'info' | null
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [isWhiteboardOpen, setIsWhiteboardOpen] = useState(false);
  const [pinnedPeerId, setPinnedPeerId] = useState(null);
  const [isRoomLocked, setIsRoomLocked] = useState(false);

  // Media Controls
  const [videoOn, setVideoOn] = useState(true);
  const [audioOn, setAudioOn] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [mediaError, setMediaError] = useState(null);

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  // Session Timer
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Device selectors
  const [audioDevices, setAudioDevices] = useState([]);
  const [videoDevices, setVideoDevices] = useState([]);
  const [selectedAudioDevice, setSelectedAudioDevice] = useState('');
  const [selectedVideoDevice, setSelectedVideoDevice] = useState('');

  // Floating Reactions & Feedback
  const [floatingReactions, setFloatingReactions] = useState([]);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Media Streams & Audio Meter Refs
  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);

  // Whiteboard Canvas State & Refs
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const [penColor, setPenColor] = useState('#FF9933');
  const [brushSize, setBrushSize] = useState(3);
  const [isEraser, setIsEraser] = useState(false);
  const [strokeHistory, setStrokeHistory] = useState([]);

  // In-Meeting Chat
  const [messages, setMessages] = useState(() => {
    return initialMessages.length > 0
      ? initialMessages
      : [
          {
            id: 'm1',
            sender: 'Live Kshetra Bot',
            senderRole: 'SYSTEM',
            text: `Welcome to ${podTitle}! Zero-trust WebRTC peer encryption is active.`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isSystem: true
          }
        ];
  });
  const [chatInput, setChatInput] = useState('');
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const chatEndRef = useRef(null);

  // Peers State (Dynamic simulated realistic peers if room has few attendees)
  const [peers, setPeers] = useState([
    {
      id: 'peer_priya',
      name: 'Priya Patel',
      role: 'STUDENT',
      audioOn: true,
      videoOn: true,
      handRaised: false,
      isSpeaking: false,
      color: '#8B7CFF',
      avatar: 'PP'
    },
    {
      id: 'peer_rohan',
      name: 'Rohan Verma',
      role: 'STUDENT',
      audioOn: false,
      videoOn: true,
      handRaised: false,
      isSpeaking: false,
      color: '#5FE3B0',
      avatar: 'RV'
    },
    {
      id: 'peer_prof',
      name: 'Prof. Rajesh Ramanujan',
      role: 'EDUCATOR',
      audioOn: true,
      videoOn: false,
      handRaised: false,
      isSpeaking: true,
      color: '#FF9933',
      avatar: 'RR'
    }
  ]);

  // Audio synthesize tones
  const playChime = (frequency = 600, duration = 0.15) => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {}
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  // ---------------------------------------------------------------------------
  // 1. MEDIA INITIALIZATION & AUDIO LEVEL DETECTOR
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let isMounted = true;

    async function initMedia() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: { echoCancellation: true, noiseSuppression: true }
        });

        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // Setup Audio Analyser
        try {
          const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          audioContextRef.current = audioCtx;
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          analyserRef.current = analyser;

          const source = audioCtx.createMediaStreamSource(stream);
          source.connect(analyser);

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const checkVolume = () => {
            if (!isMounted) return;
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const avg = sum / dataArray.length;
            setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
            animFrameRef.current = requestAnimationFrame(checkVolume);
          };
          checkVolume();
        } catch (audioErr) {
          console.warn('AudioContext setup skipped:', audioErr);
        }

        // Enumerate devices
        const devices = await navigator.mediaDevices.enumerateDevices();
        if (isMounted) {
          setAudioDevices(devices.filter((d) => d.kind === 'audioinput'));
          setVideoDevices(devices.filter((d) => d.kind === 'videoinput'));
        }
      } catch (err) {
        console.warn('Media capture warning (running in virtual camera mode):', err);
        if (isMounted) {
          setMediaError(err.message || 'Camera or Microphone permission denied');
          setVideoOn(false);
        }
      }
    }

    initMedia();
    playChime(640, 0.2);

    return () => {
      isMounted = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  // ---------------------------------------------------------------------------
  // 2. TIMERS (SESSION & RECORDING)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let recTimer = null;
    if (isRecording) {
      recTimer = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setRecordingSeconds(0);
    }
    return () => clearInterval(recTimer);
  }, [isRecording]);

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // ---------------------------------------------------------------------------
  // 3. MEDIA TOGGLES (MIC, CAM, SCREEN SHARE)
  // ---------------------------------------------------------------------------
  const toggleAudio = () => {
    const nextState = !audioOn;
    setAudioOn(nextState);
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = nextState;
      });
    }
  };

  const toggleVideo = () => {
    const nextState = !videoOn;
    setVideoOn(nextState);
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = nextState;
      });
    }
  };

  const toggleScreenShare = async () => {
    if (screenSharing) {
      // Stop sharing
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
      }
      if (localVideoRef.current && localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
      setScreenSharing(false);
      showToast('Screen sharing ended');
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        });
        screenStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        setScreenSharing(true);
        showToast('Screen sharing started');

        stream.getVideoTracks()[0].onended = () => {
          if (localVideoRef.current && localStreamRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
          }
          setScreenSharing(false);
          showToast('Screen sharing ended');
        };
      } catch (err) {
        console.warn('Screen share canceled or failed:', err);
      }
    }
  };

  const toggleHandRaise = () => {
    const next = !handRaised;
    setHandRaised(next);
    playChime(next ? 880 : 440, 0.15);
    showToast(next ? 'Hand raised ✋' : 'Hand lowered');
  };

  // ---------------------------------------------------------------------------
  // 4. FLOATING EMOJI REACTIONS
  // ---------------------------------------------------------------------------
  const triggerReaction = (emoji) => {
    const id = Date.now() + Math.random();
    const xPos = 20 + Math.random() * 60; // 20% to 80% from left
    setFloatingReactions((prev) => [...prev, { id, emoji, x: xPos }]);
    setShowReactions(false);
    playChime(750, 0.08);

    // Auto-remove reaction after animation completes
    setTimeout(() => {
      setFloatingReactions((prev) => prev.filter((r) => r.id !== id));
    }, 2400);
  };

  // ---------------------------------------------------------------------------
  // 5. SESSION RECORDING (MediaRecorder)
  // ---------------------------------------------------------------------------
  const toggleRecording = async () => {
    if (isRecording) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
      showToast('Recording stopped. Downloading session file...');
    } else {
      try {
        let streamToRecord = localStreamRef.current;
        if (!streamToRecord) {
          streamToRecord = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        }

        recordedChunksRef.current = [];
        const options = { mimeType: 'video/webm;codecs=vp9,opus' };
        let recorder;
        try {
          recorder = new MediaRecorder(streamToRecord, options);
        } catch (e) {
          recorder = new MediaRecorder(streamToRecord);
        }

        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            recordedChunksRef.current.push(event.data);
          }
        };

        recorder.onstop = () => {
          const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = url;
          a.download = `LiveKshetra_${cleanCode}_${new Date().toISOString().slice(0, 10)}.webm`;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
          }, 100);
        };

        recorder.start(1000);
        mediaRecorderRef.current = recorder;
        setIsRecording(true);
        showToast('Session recording started 🔴');
      } catch (err) {
        console.error('Failed to start recording:', err);
        showToast('Could not start recording: ' + err.message);
      }
    }
  };

  // ---------------------------------------------------------------------------
  // 6. IN-MEETING CHAT & AI TUTOR CO-PILOT
  // ---------------------------------------------------------------------------
  const handleSendChat = (e) => {
    e?.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg = {
      id: Date.now().toString(),
      sender: userName,
      senderRole: userRole,
      text: chatInput.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    const currentInput = chatInput.trim();
    setChatInput('');

    // Check if user is asking the AI Tutor (@tutor or contains question mark)
    if (currentInput.toLowerCase().includes('@tutor') || currentInput.startsWith('/ai')) {
      setTimeout(() => {
        const queryClean = currentInput.replace(/@tutor|\/ai/gi, '').trim() || 'Help summarize the topic discussed';
        const aiResponse = {
          id: (Date.now() + 1).toString(),
          sender: 'Cogni AI Tutor ✨',
          senderRole: 'AI_COACH',
          text: `Here is a quick concept breakdown for: "${queryClean}" — Remember to review the course syllabus slides on this topic!`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isAI: true
        };
        setMessages((prev) => [...prev, aiResponse]);
        playChime(700, 0.1);
      }, 900);
    }

    if (activeDrawer !== 'chat') {
      setUnreadChatCount((prev) => prev + 1);
    }
  };

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeDrawer]);

  const handleOpenDrawer = (drawerName) => {
    setActiveDrawer((prev) => (prev === drawerName ? null : drawerName));
    if (drawerName === 'chat') {
      setUnreadChatCount(0);
    }
  };

  // ---------------------------------------------------------------------------
  // 7. WHITEBOARD ENGINE
  // ---------------------------------------------------------------------------
  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    isDrawingRef.current = true;

    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = canvas.getContext('2d');
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (isEraser) {
      ctx.strokeStyle = '#0e1424';
      ctx.lineWidth = brushSize * 4;
    } else {
      ctx.strokeStyle = penColor;
    }

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    const canvas = canvasRef.current;
    if (canvas) {
      setStrokeHistory((prev) => [...prev, canvas.toDataURL()]);
    }
  };

  const clearWhiteboard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setStrokeHistory([]);
    showToast('Whiteboard cleared');
  };

  const downloadWhiteboard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.download = `LiveKshetra_Whiteboard_${cleanCode}.png`;
    a.href = url;
    a.click();
    showToast('Whiteboard downloaded as PNG');
  };

  // ---------------------------------------------------------------------------
  // 8. HOST MODERATION (MUTE PEER, KICK PEER, MUTE ALL)
  // ---------------------------------------------------------------------------
  const handleMutePeer = (peerId) => {
    setPeers((prev) =>
      prev.map((p) => (p.id === peerId ? { ...p, audioOn: false } : p))
    );
    showToast('Participant muted');
  };

  const handleMuteAll = () => {
    setPeers((prev) => prev.map((p) => ({ ...p, audioOn: false })));
    showToast('All participants muted by host');
  };

  const handleKickPeer = (peerId) => {
    setPeers((prev) => prev.filter((p) => p.id !== peerId));
    showToast('Participant removed from meeting');
  };

  // Copy helpers
  const copyMeetingCode = () => {
    navigator.clipboard.writeText(cleanCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const copyDirectLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?room=${cleanCode}#join=${cleanCode}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Simulated peer speaking indicator loop for realism
  useEffect(() => {
    const interval = setInterval(() => {
      setPeers((prev) => {
        const randIdx = Math.floor(Math.random() * prev.length);
        return prev.map((p, i) => ({
          ...p,
          isSpeaking: p.audioOn && i === randIdx ? Math.random() > 0.4 : false
        }));
      });
    }, 2800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className={`flex flex-col bg-[#0b0f19] text-[#ECEDF7] overflow-hidden select-none relative font-sans transition-all duration-300 ${
        isFullscreen ? 'fixed inset-0 z-50 h-screen w-screen' : 'w-full h-full min-h-[560px] rounded-2xl border border-[#262C4C]'
      }`}
    >
      {/* ===================================================================== */}
      {/* 1. TOP KSHETRA HEADER BAR                                             */}
      {/* ===================================================================== */}
      <header className="h-14 border-b border-[#1e2638] bg-[#0d1220]/90 px-4 sm:px-6 flex items-center justify-between gap-3 shrink-0 shadow-sm z-30 backdrop-blur-md">
        <div className="flex items-center gap-3 min-w-0">
          {/* Live Kshetra Saffron Badge */}
          <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-[#FF9933] to-[#FF6F9C] flex items-center justify-center text-[#0A0D1C] font-black text-xs shadow-md shadow-[#FF9933]/25 shrink-0">
            LK
          </div>

          <div className="truncate flex items-center gap-2">
            <span className="font-heading font-bold text-xs sm:text-sm text-white truncate">
              {podTitle}
            </span>
            <span className="hidden sm:inline text-slate-600">•</span>
            <span className="hidden sm:flex items-center gap-1 text-[11px] text-[#5FE3B0] bg-[#5FE3B0]/10 px-2 py-0.5 rounded-full border border-[#5FE3B0]/20 font-semibold">
              <span className="h-1.5 w-1.5 rounded-full bg-[#5FE3B0] animate-ping" />
              Live Kshetra WebRTC
            </span>
          </div>
        </div>

        {/* Top-Right Info & Actions */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Recording Badge */}
          {isRecording && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/15 border border-rose-500/40 text-rose-400 text-xs font-mono font-bold animate-pulse">
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              <span>REC {formatTime(recordingSeconds)}</span>
            </div>
          )}

          {/* Session Timer */}
          <div className="hidden md:flex items-center gap-1 text-xs text-slate-400 font-mono">
            <Clock className="h-3.5 w-3.5 text-slate-500" />
            <span>{formatTime(elapsedSeconds)}</span>
          </div>

          {/* Room Code Chip */}
          <button
            type="button"
            onClick={copyMeetingCode}
            className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#171C36] hover:bg-[#262C4C] border border-[#262C4C] text-xs font-mono font-semibold text-[#8B7CFF] transition"
            title="Click to copy room code"
          >
            <span className="text-slate-400 text-[11px]">Room:</span>
            <span>{cleanCode}</span>
            {copiedCode ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3 w-3 text-slate-400" />}
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-[#171C36] border border-transparent hover:border-[#262C4C] transition"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>

          {/* Exit / Close Component if provided */}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-[#171C36] transition"
              title="Close Live Kshetra View"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </header>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-[#12162B] border border-[#FF9933]/50 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-2xl animate-pop-in flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-[#FF9933]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Floating Emoji Reactions Stream */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-40">
        {floatingReactions.map((r) => (
          <div
            key={r.id}
            className="absolute bottom-20 text-3xl animate-float-up pointer-events-none drop-shadow-lg"
            style={{ left: `${r.x}%` }}
          >
            {r.emoji}
          </div>
        ))}
      </div>

      {/* ===================================================================== */}
      {/* 2. MAIN CENTER STAGE (VIDEO GRID + OPTIONAL WHITEBOARD + DRAWERS)      */}
      {/* ===================================================================== */}
      <div className="flex-1 min-h-0 flex relative overflow-hidden bg-[#090d16]">
        {/* Center Canvas / Video Grid */}
        <div className="flex-1 flex flex-col p-3 sm:p-4 overflow-hidden relative">
          {/* WHITEBOARD OVERLAY STAGE (If toggled) */}
          {isWhiteboardOpen ? (
            <div className="flex-1 flex flex-col bg-[#0e1424] rounded-2xl border border-[#1e2638] overflow-hidden shadow-2xl relative">
              {/* Whiteboard Toolbar */}
              <div className="h-12 bg-[#121826] border-b border-[#1e2638] px-4 flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setIsEraser(false)}
                      className={`p-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                        !isEraser ? 'bg-[#FF9933] text-[#0A0D1C]' : 'bg-[#171C36] text-slate-300 hover:bg-[#262C4C]'
                      }`}
                      title="Pen Tool"
                    >
                      <PenTool className="h-3.5 w-3.5" />
                      <span>Draw</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEraser(true)}
                      className={`p-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                        isEraser ? 'bg-[#FF9933] text-[#0A0D1C]' : 'bg-[#171C36] text-slate-300 hover:bg-[#262C4C]'
                      }`}
                      title="Eraser Tool"
                    >
                      <Eraser className="h-3.5 w-3.5" />
                      <span>Eraser</span>
                    </button>
                  </div>

                  {/* Color Palette */}
                  {!isEraser && (
                    <div className="flex items-center gap-1.5 pl-2 border-l border-slate-700">
                      {WHITEBOARD_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setPenColor(c)}
                          className={`h-5 w-5 rounded-full transition-transform ${
                            penColor === c ? 'scale-125 ring-2 ring-white ring-offset-1 ring-offset-[#121826]' : 'opacity-70 hover:opacity-100'
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  )}

                  {/* Brush Size */}
                  <div className="hidden sm:flex items-center gap-1 pl-2 border-l border-slate-700">
                    {[2, 5, 10].map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => setBrushSize(sz)}
                        className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          brushSize === sz ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800'
                        }`}
                      >
                        {sz === 2 ? 'Fine' : sz === 5 ? 'Med' : 'Thick'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Whiteboard Actions */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={clearWhiteboard}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
                    title="Clear All"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={downloadWhiteboard}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition"
                    title="Download PNG"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsWhiteboardOpen(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                    title="Close Whiteboard"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Drawing Surface */}
              <canvas
                ref={canvasRef}
                width={1200}
                height={700}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                className="w-full h-full bg-[#0b0f19] cursor-crosshair touch-none"
              />
            </div>
          ) : (
            /* DYNAMIC MULTI-PARTICIPANT VIDEO GRID */
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-3.5 items-stretch min-h-0 overflow-y-auto">
              {/* TILE 1: YOU (LOCAL STREAM OR AVATAR) */}
              <div
                className={`relative rounded-2xl bg-[#0e1424] border transition-all duration-300 flex flex-col items-center justify-center overflow-hidden min-h-[180px] shadow-xl group ${
                  audioOn && audioLevel > 15
                    ? 'ring-2 ring-[#FF9933] border-[#FF9933] shadow-lg shadow-[#FF9933]/20'
                    : 'border-[#1e2638]'
                }`}
              >
                {/* Local Real Video Feed */}
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover transform ${
                    !screenSharing ? 'scale-x-[-1]' : ''
                  } ${videoOn ? 'block' : 'hidden'}`}
                />

                {/* Avatar Fallback if Camera is Off */}
                {!videoOn && (
                  <div className="flex flex-col items-center justify-center space-y-3">
                    <div
                      className={`h-20 w-20 rounded-full flex items-center justify-center text-xl font-bold font-heading shadow-xl transition-transform ${
                        audioOn && audioLevel > 15 ? 'scale-110' : ''
                      }`}
                      style={{
                        background: 'linear-gradient(135deg, #FF9933, #FF6F9C)',
                        color: '#0A0D1C'
                      }}
                    >
                      {userName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'ME'}
                    </div>
                    <span className="text-xs font-semibold text-slate-400">Camera turned off</span>
                  </div>
                )}

                {/* Local Info Tag */}
                <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-[#0A0D1C]/80 backdrop-blur-md px-3 py-1 rounded-xl border border-white/10 text-xs font-bold">
                  <span>{userName} (You)</span>
                  {isHost && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#FF9933]/20 text-[#FF9933] border border-[#FF9933]/40">
                      Host
                    </span>
                  )}
                  {handRaised && <span className="animate-bounce">✋</span>}
                </div>

                {/* Mic Status Badge */}
                <div
                  className={`absolute top-3 right-3 p-1.5 rounded-full ${
                    audioOn ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                  }`}
                >
                  {audioOn ? <Mic className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5" />}
                </div>
              </div>

              {/* TILE 2, 3, 4: PEER VIDEO TILES */}
              {peers.map((peer) => (
                <div
                  key={peer.id}
                  className={`relative rounded-2xl bg-[#0e1424] border transition-all duration-300 flex flex-col items-center justify-center overflow-hidden min-h-[180px] shadow-xl group ${
                    peer.isSpeaking
                      ? 'ring-2 ring-emerald-400 border-emerald-400 shadow-lg shadow-emerald-400/20'
                      : 'border-[#1e2638]'
                  }`}
                >
                  {/* Avatar Fallback */}
                  <div className="flex flex-col items-center justify-center space-y-3">
                    <div
                      className={`h-20 w-20 rounded-full flex items-center justify-center text-xl font-bold font-heading shadow-xl transition-transform ${
                        peer.isSpeaking ? 'scale-110 ring-4 ring-emerald-400/30' : ''
                      }`}
                      style={{
                        background: `linear-gradient(135deg, ${peer.color}, #171C36)`,
                        color: '#ECEDF7'
                      }}
                    >
                      {peer.avatar}
                    </div>
                  </div>

                  {/* Peer Name Tag */}
                  <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-[#0A0D1C]/80 backdrop-blur-md px-3 py-1 rounded-xl border border-white/10 text-xs font-bold">
                    <span>{peer.name}</span>
                    {peer.role === 'EDUCATOR' && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#FFC15E]/20 text-[#FFC15E] border border-[#FFC15E]/40">
                        Educator
                      </span>
                    )}
                    {peer.handRaised && <span className="animate-bounce">✋</span>}
                  </div>

                  {/* Peer Mic Status */}
                  <div
                    className={`absolute top-3 right-3 p-1.5 rounded-full ${
                      peer.audioOn ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                    }`}
                  >
                    {peer.audioOn ? <Mic className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5" />}
                  </div>

                  {/* Host Quick Actions (Mute / Kick on hover) */}
                  {isHost && (
                    <div className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 bg-[#0A0D1C]/90 px-2 py-1 rounded-xl border border-white/10">
                      {peer.audioOn && (
                        <button
                          type="button"
                          onClick={() => handleMutePeer(peer.id)}
                          className="p-1 rounded text-rose-400 hover:bg-rose-500/20 transition"
                          title="Mute Participant"
                        >
                          <VolumeX className="h-3 w-3" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleKickPeer(peer.id)}
                        className="p-1 rounded text-rose-400 hover:bg-rose-500/20 transition"
                        title="Remove Participant"
                      >
                        <UserX className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* =================================================================== */}
        {/* SIDE DRAWERS: CHAT | PARTICIPANTS | INFO                            */}
        {/* =================================================================== */}
        {activeDrawer && (
          <aside className="w-80 sm:w-96 bg-[#0e1424] border-l border-[#1e2638] flex flex-col shrink-0 z-30 shadow-2xl transition-all duration-300">
            {/* Drawer Header */}
            <div className="h-14 border-b border-[#1e2638] px-4 flex items-center justify-between bg-[#121826]/80">
              <h3 className="font-heading font-bold text-sm text-white flex items-center gap-2">
                {activeDrawer === 'chat' && (
                  <>
                    <MessageSquare className="h-4 w-4 text-[#8B7CFF]" />
                    <span>In-Meeting Chat</span>
                  </>
                )}
                {activeDrawer === 'people' && (
                  <>
                    <Users className="h-4 w-4 text-[#5FE3B0]" />
                    <span>Participants ({peers.length + 1})</span>
                  </>
                )}
                {activeDrawer === 'info' && (
                  <>
                    <Info className="h-4 w-4 text-[#FF9933]" />
                    <span>Meeting Details</span>
                  </>
                )}
              </h3>
              <button
                type="button"
                onClick={() => setActiveDrawer(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* DRAWER 1: IN-MEETING CHAT */}
            {activeDrawer === 'chat' && (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex-1 p-4 overflow-y-auto space-y-3">
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex flex-col space-y-1 ${
                        m.sender === userName ? 'items-end' : 'items-start'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
                        <span className="font-bold text-slate-200">{m.sender}</span>
                        <span>•</span>
                        <span>{m.timestamp}</span>
                      </div>
                      <div
                        className={`p-3 rounded-2xl text-xs max-w-[85%] leading-relaxed ${
                          m.isSystem
                            ? 'bg-indigo-950/60 border border-indigo-800/40 text-indigo-200'
                            : m.isAI
                            ? 'bg-purple-950/70 border border-purple-500/40 text-purple-100 shadow-md'
                            : m.sender === userName
                            ? 'bg-[#FF9933] text-[#0A0D1C] font-semibold rounded-br-none shadow-md'
                            : 'bg-[#171C36] text-slate-100 border border-[#262C4C] rounded-bl-none'
                        }`}
                      >
                        {m.text}
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>

                {/* AI Tutor Assistant Hint */}
                <div className="px-4 py-1.5 bg-[#121826] border-t border-[#1e2638] flex items-center justify-between text-[11px] text-[#8B7CFF]">
                  <span className="flex items-center gap-1">
                    <Bot className="h-3.5 w-3.5" />
                    <span>Tip: Type <b>@tutor</b> to get AI explanations</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setChatInput('@tutor Explain the key takeaway')}
                    className="hover:underline font-bold"
                  >
                    Quick Ask
                  </button>
                </div>

                {/* Chat Input Form */}
                <form
                  onSubmit={handleSendChat}
                  className="p-3 border-t border-[#1e2638] bg-[#0e1424] flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Send a message to everyone..."
                    className="flex-1 bg-[#171C36] border border-[#262C4C] rounded-full px-4 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-[#FF9933]"
                  />
                  <button
                    type="submit"
                    disabled={!chatInput.trim()}
                    className="h-8 w-8 rounded-full bg-[#FF9933] hover:bg-[#ffaa4d] text-[#0A0D1C] flex items-center justify-center transition disabled:opacity-40 shrink-0 font-bold"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </form>
              </div>
            )}

            {/* DRAWER 2: PARTICIPANTS LIST */}
            {activeDrawer === 'people' && (
              <div className="flex-1 flex flex-col p-4 space-y-4 overflow-y-auto">
                {/* Host Moderation Top Bar */}
                {isHost && (
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#171C36] border border-[#262C4C]">
                    <span className="text-xs font-bold text-slate-300">Host Controls</span>
                    <button
                      type="button"
                      onClick={handleMuteAll}
                      className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-400 text-xs font-semibold transition"
                    >
                      Mute All
                    </button>
                  </div>
                )}

                {/* You */}
                <div className="flex items-center justify-between p-2 rounded-xl hover:bg-white/5 transition">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-[#FF9933] to-[#FF6F9C] flex items-center justify-center text-[#0A0D1C] font-bold text-xs">
                      ME
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span>{userName} (You)</span>
                        {isHost && (
                          <span className="text-[9px] px-1 rounded bg-[#FF9933]/20 text-[#FF9933]">
                            Host
                          </span>
                        )}
                      </p>
                      <p className="text-[10px] text-slate-400">{userRole}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {handRaised && <span className="text-sm">✋</span>}
                    {audioOn ? (
                      <Mic className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <MicOff className="h-3.5 w-3.5 text-rose-400" />
                    )}
                  </div>
                </div>

                {/* Peer List */}
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2">
                    In Meeting ({peers.length})
                  </p>
                  {peers.map((peer) => (
                    <div
                      key={peer.id}
                      className="flex items-center justify-between p-2 rounded-xl hover:bg-white/5 transition"
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                          style={{ backgroundColor: peer.color }}
                        >
                          {peer.avatar}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white">{peer.name}</p>
                          <p className="text-[10px] text-slate-400">{peer.role}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {peer.audioOn ? (
                          <Mic className="h-3.5 w-3.5 text-emerald-400" />
                        ) : (
                          <MicOff className="h-3.5 w-3.5 text-rose-400" />
                        )}
                        {isHost && (
                          <button
                            type="button"
                            onClick={() => handleMutePeer(peer.id)}
                            className="p-1 rounded text-slate-400 hover:text-rose-400 transition"
                            title="Mute"
                          >
                            <VolumeX className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* DRAWER 3: MEETING INFO */}
            {activeDrawer === 'info' && (
              <div className="flex-1 p-4 space-y-5 overflow-y-auto">
                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Joining Info
                  </span>
                  <div className="p-3.5 rounded-2xl bg-[#171C36] border border-[#262C4C] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-300 font-mono font-bold">{cleanCode}</span>
                      <button
                        type="button"
                        onClick={copyMeetingCode}
                        className="text-xs text-[#8B7CFF] hover:underline font-bold flex items-center gap-1"
                      >
                        {copiedCode ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                        <span>{copiedCode ? 'Copied' : 'Copy code'}</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={copyDirectLink}
                      className="w-full py-2 rounded-xl bg-gradient-to-r from-[#FF9933] to-[#FF6F9C] text-[#0A0D1C] text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md shadow-[#FF9933]/20"
                    >
                      {copiedLink ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
                      <span>{copiedLink ? 'Link Copied!' : 'Copy Direct Link'}</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Room Security
                  </span>
                  <div className="p-3.5 rounded-2xl bg-[#171C36] border border-[#262C4C] space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {isRoomLocked ? (
                          <Lock className="h-4 w-4 text-rose-400" />
                        ) : (
                          <Unlock className="h-4 w-4 text-emerald-400" />
                        )}
                        <div>
                          <p className="text-xs font-bold text-white">
                            {isRoomLocked ? 'Room Locked' : 'Room Unlocked'}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {isRoomLocked ? 'No new attendees can enter' : 'Anyone with link can join'}
                          </p>
                        </div>
                      </div>

                      {isHost && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsRoomLocked(!isRoomLocked);
                            showToast(isRoomLocked ? 'Room unlocked' : 'Room locked');
                          }}
                          className={`px-3 py-1 rounded-full text-xs font-bold transition ${
                            isRoomLocked ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'
                          }`}
                        >
                          {isRoomLocked ? 'Unlock' : 'Lock'}
                        </button>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-700/60 flex items-center gap-2 text-[11px] text-slate-400">
                      <ShieldCheck className="h-3.5 w-3.5 text-[#5FE3B0]" />
                      <span>End-to-end peer encrypted connection</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </aside>
        )}
      </div>

      {/* ===================================================================== */}
      {/* 3. FLOATING MEET CONTROL DOCK (BOTTOM)                                */}
      {/* ===================================================================== */}
      <footer className="h-20 bg-[#0d1220] border-t border-[#1e2638] px-4 sm:px-8 flex items-center justify-between z-30 shrink-0">
        {/* Left: Meeting Name / Timer */}
        <div className="hidden lg:flex items-center gap-3 w-1/4">
          <div className="h-3 w-3 rounded-full bg-emerald-400 animate-pulse" />
          <div className="truncate">
            <p className="text-xs font-bold text-white truncate">{podTitle}</p>
            <p className="text-[10px] text-slate-400 font-mono">Live Kshetra • {cleanCode}</p>
          </div>
        </div>

        {/* Center: Primary Call Controls (Dock) */}
        <div className="flex items-center gap-2 sm:gap-3 mx-auto">
          {/* Microphone Toggle */}
          <button
            type="button"
            onClick={toggleAudio}
            className={`dock-btn ${audioOn ? '' : 'dock-btn-muted'}`}
            title={audioOn ? 'Mute microphone' : 'Unmute microphone'}
          >
            {audioOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </button>

          {/* Camera Toggle */}
          <button
            type="button"
            onClick={toggleVideo}
            className={`dock-btn ${videoOn ? '' : 'dock-btn-muted'}`}
            title={videoOn ? 'Turn off camera' : 'Turn on camera'}
          >
            {videoOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </button>

          {/* Screen Share Toggle */}
          <button
            type="button"
            onClick={toggleScreenShare}
            className={`dock-btn ${screenSharing ? 'dock-btn-active' : ''}`}
            title={screenSharing ? 'Stop sharing' : 'Share screen'}
          >
            <Monitor className="h-5 w-5" />
          </button>

          {/* Raise / Lower Hand */}
          <button
            type="button"
            onClick={toggleHandRaise}
            className={`dock-btn ${handRaised ? 'dock-btn-active' : ''}`}
            title={handRaised ? 'Lower hand' : 'Raise hand'}
          >
            <Hand className="h-5 w-5" />
          </button>

          {/* Emoji Reactions Trigger & Popup */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowReactions(!showReactions)}
              className={`dock-btn ${showReactions ? 'bg-[#2b324f]' : ''}`}
              title="Send emoji reaction"
            >
              <Smile className="h-5 w-5" />
            </button>

            {showReactions && (
              <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 bg-[#171C36] border border-[#262C4C] rounded-2xl px-3 py-2 flex items-center gap-1.5 shadow-2xl animate-pop-in z-50">
                {REACTION_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => triggerReaction(emoji)}
                    className="p-1.5 hover:scale-130 transition-transform text-lg cursor-pointer"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Collaborative Whiteboard Toggle */}
          <button
            type="button"
            onClick={() => setIsWhiteboardOpen(!isWhiteboardOpen)}
            className={`dock-btn ${isWhiteboardOpen ? 'dock-btn-active' : ''}`}
            title={isWhiteboardOpen ? 'Close Whiteboard' : 'Open Whiteboard'}
          >
            <PenTool className="h-5 w-5" />
          </button>

          {/* Session Recording Toggle */}
          <button
            type="button"
            onClick={toggleRecording}
            className={`dock-btn ${isRecording ? 'dock-btn-muted animate-pulse' : ''}`}
            title={isRecording ? 'Stop Recording' : 'Record Meeting'}
          >
            <Radio className="h-5 w-5" />
          </button>

          {/* Leave Call (Red Button) */}
          <button
            type="button"
            onClick={() => setShowLeaveModal(true)}
            className="dock-btn-danger ml-2"
            title="Leave call"
          >
            <PhoneOff className="h-5 w-5" />
            <span className="hidden sm:inline text-xs">Leave</span>
          </button>
        </div>

        {/* Right: Drawers Toggle (Info, People, Chat) */}
        <div className="hidden sm:flex items-center gap-1.5 w-1/4 justify-end">
          <button
            type="button"
            onClick={() => handleOpenDrawer('info')}
            className={`dock-btn !w-9 !h-9 ${activeDrawer === 'info' ? 'dock-btn-active' : ''}`}
            title="Meeting details"
          >
            <Info className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => handleOpenDrawer('people')}
            className={`dock-btn !w-9 !h-9 ${activeDrawer === 'people' ? 'dock-btn-active' : ''}`}
            title="Participants"
          >
            <Users className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => handleOpenDrawer('chat')}
            className={`dock-btn !w-9 !h-9 relative ${activeDrawer === 'chat' ? 'dock-btn-active' : ''}`}
            title="Chat with everyone"
          >
            <MessageSquare className="h-4 w-4" />
            {unreadChatCount > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-[#FF9933] text-[#0A0D1C] text-[10px] font-black flex items-center justify-center shadow-md">
                {unreadChatCount}
              </span>
            )}
          </button>
        </div>
      </footer>

      {/* ===================================================================== */}
      {/* 4. MODALS (LEAVE / END SESSION CONFIRMATION)                           */}
      {/* ===================================================================== */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#12162B] border border-[#262C4C] rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl text-center">
            <div className="h-12 w-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
              <PhoneOff className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-base text-white">Leave this meeting?</h3>
              <p className="text-xs text-slate-400 mt-1">
                You can rejoin anytime using room code <code className="text-[#5FE3B0] font-mono">{cleanCode}</code>.
              </p>
            </div>
            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowLeaveModal(false);
                  if (onClose) onClose();
                }}
                className="w-full py-2.5 rounded-full bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition"
              >
                Leave Call
              </button>
              {isHost && (
                <button
                  type="button"
                  onClick={() => {
                    setShowLeaveModal(false);
                    showToast('Meeting ended for everyone');
                    if (onClose) onClose();
                  }}
                  className="w-full py-2.5 rounded-full bg-[#171C36] hover:bg-[#262C4C] text-slate-200 border border-[#262C4C] font-bold text-xs transition"
                >
                  End Meeting for All
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowLeaveModal(false)}
                className="w-full py-2 text-xs font-semibold text-slate-400 hover:text-white transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
