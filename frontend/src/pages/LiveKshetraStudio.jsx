import React, { useState, useEffect, useRef } from 'react';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Plus,
  ArrowRight,
  ShieldCheck,
  Copy,
  Check,
  Clock,
  Sparkles,
  Users,
  Radio,
  ExternalLink,
  Lock,
  ChevronRight,
  BookOpen
} from 'lucide-react';
import LiveKshetraNative from '../components/pods/LiveKshetraNative';

export default function LiveKshetraStudio({
  user,
  courseId,
  initialMeetingCode = null,
  onNavigateTab
}) {
  const [activeMeetingCode, setActiveMeetingCode] = useState(() => {
    // Check URL query param or hash for direct meeting code
    try {
      const params = new URLSearchParams(window.location.search);
      const qRoom = params.get('room') || params.get('meetingCode');
      if (qRoom) return qRoom.trim().toLowerCase();

      const hash = window.location.hash;
      if (hash && hash.includes('join=')) {
        return hash.split('join=')[1].trim().toLowerCase();
      }
    } catch (e) {}
    return initialMeetingCode;
  });

  const [enteredCode, setEnteredCode] = useState('');
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduledCode, setScheduledCode] = useState('');
  const [isMeetingCreator, setIsMeetingCreator] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Pre-join Green Room Device Preview
  const [previewVideoOn, setPreviewVideoOn] = useState(true);
  const [previewAudioOn, setPreviewAudioOn] = useState(true);
  const [previewAudioLevel, setPreviewAudioLevel] = useState(0);
  const previewVideoRef = useRef(null);
  const previewStreamRef = useRef(null);
  const animFrameRef = useRef(null);

  const isEducator = user?.role === 'EDUCATOR';
  const userName = user?.full_name || 'Learner';

  // Generate Google Meet-style clean hyphenated room code
  const generateMeetingCode = () => {
    const p1 = Math.random().toString(36).substring(2, 5);
    const p2 = Math.random().toString(36).substring(2, 6);
    const p3 = Math.random().toString(36).substring(2, 5);
    return `${p1}-${p2}-${p3}`;
  };

  // Pre-join Camera & Mic preview in Green Room
  useEffect(() => {
    let isMounted = true;
    if (activeMeetingCode) return; // Skip preview if already in a call

    async function setupPreview() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 360 } },
          audio: true
        });
        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        previewStreamRef.current = stream;
        if (previewVideoRef.current) {
          previewVideoRef.current.srcObject = stream;
        }

        // Audio level analyser
        try {
          const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 32;
          const source = audioCtx.createMediaStreamSource(stream);
          source.connect(analyser);

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const updateLevel = () => {
            if (!isMounted) return;
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
            const avg = sum / dataArray.length;
            setPreviewAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
            animFrameRef.current = requestAnimationFrame(updateLevel);
          };
          updateLevel();
        } catch (e) {}
      } catch (err) {
        console.warn('Green room camera preview notice:', err);
        if (isMounted) setPreviewVideoOn(false);
      }
    }

    setupPreview();

    return () => {
      isMounted = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (previewStreamRef.current) {
        previewStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [activeMeetingCode]);

  const togglePreviewVideo = () => {
    const next = !previewVideoOn;
    setPreviewVideoOn(next);
    if (previewStreamRef.current) {
      previewStreamRef.current.getVideoTracks().forEach((t) => (t.enabled = next));
    }
  };

  const togglePreviewAudio = () => {
    const next = !previewAudioOn;
    setPreviewAudioOn(next);
    if (previewStreamRef.current) {
      previewStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = next));
    }
  };

  // Instant meeting handler
  const handleStartInstantMeeting = () => {
    const code = generateMeetingCode();
    // Stop green room preview stream before entering call
    if (previewStreamRef.current) {
      previewStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    setIsMeetingCreator(true);
    setActiveMeetingCode(code);
  };

  // Schedule for later
  const handleCreateMeetingForLater = () => {
    const code = generateMeetingCode();
    setScheduledCode(code);
    setShowScheduleModal(true);
  };

  // Join with entered code or URL
  const handleJoinEntered = (e) => {
    e?.preventDefault();
    if (!enteredCode.trim()) return;

    let clean = enteredCode.trim().toLowerCase();
    // Support pasting full URL like https://...join/abc-def-ghi or #join=abc-def-ghi
    if (clean.includes('/join/')) {
      clean = clean.split('/join/')[1].split('?')[0];
    } else if (clean.includes('join=')) {
      clean = clean.split('join=')[1].split('&')[0];
    } else if (clean.includes('room=')) {
      clean = clean.split('room=')[1].split('&')[0];
    }
    clean = clean.replace(/[^a-z0-9-]/g, '');

    if (!clean) {
      alert('Please enter a valid meeting code or link.');
      return;
    }

    if (previewStreamRef.current) {
      previewStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    setIsMeetingCreator(false);
    setActiveMeetingCode(clean);
  };

  // Copy helper
  const copyScheduledCode = () => {
    navigator.clipboard.writeText(scheduledCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const copyScheduledLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?room=${scheduledCode}#join=${scheduledCode}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // ===========================================================================
  // IF IN AN ACTIVE MEETING: RENDER FULL NATIVE CONFERENCE STUDIO
  // ===========================================================================
  if (activeMeetingCode) {
    return (
      <div className="h-full w-full bg-[#0b0f19]">
        <LiveKshetraNative
          meetingCode={activeMeetingCode}
          podTitle={`Learning Pod • ${activeMeetingCode}`}
          user={user}
          isHost={isEducator || isMeetingCreator}
          onClose={() => {
            setActiveMeetingCode(null);
            setIsMeetingCreator(false);
          }}
        />
      </div>
    );
  }

  // ===========================================================================
  // OTHERWISE: RENDER LIVE KSHETRA LOBBY & DEVICE GREEN ROOM
  // ===========================================================================
  return (
    <div className="min-h-full ambient-canvas p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8 select-none">
      {/* Top Banner Ribbon */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#262C4C] pb-6">
        <div className="flex items-center gap-3.5">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-[#FF9933] to-[#FF6F9C] flex items-center justify-center text-[#0A0D1C] font-black text-lg shadow-xl shadow-[#FF9933]/20">
            LK
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="font-heading text-2xl sm:text-3xl font-bold text-[#ECEDF7] tracking-tight">
                Learning Pods
              </h1>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#FF9933]/15 text-[#FF9933] border border-[#FF9933]/30 font-bold uppercase tracking-wider">
                Studio
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[#8A90B4] font-medium mt-1">
              Zero-trust WebRTC video classrooms, collaborative whiteboards, and interactive learning pods.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#12162B] border border-[#262C4C] text-xs text-[#5FE3B0]">
            <ShieldCheck className="h-4 w-4" />
            <span className="font-semibold">STUN Mesh Encrypted</span>
          </div>
        </div>
      </div>

      {/* Main 2-Column Split: Action Cards + Device Green Room Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Meeting Actions (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="space-y-2">
            <h2 className="font-heading text-xl sm:text-2xl font-bold text-[#ECEDF7] leading-snug">
              Secure, high-definition video conferencing for students and educators.
            </h2>
            <p className="text-xs sm:text-sm text-[#8A90B4] leading-relaxed">
              Connect in real-time, draw on shared whiteboards, share screens, ask @Tutor Socratic questions, and record sessions.
            </p>
          </div>

          {/* Action Button Row */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleStartInstantMeeting}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-[#FF9933] to-[#FF6F9C] hover:from-[#ffaa4d] hover:to-[#ff8cb1] text-[#0A0D1C] font-heading font-bold text-xs uppercase tracking-wider shadow-lg shadow-[#FF9933]/30 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Video className="h-4 w-4" />
              <span>New Meeting</span>
            </button>

            <button
              type="button"
              onClick={handleCreateMeetingForLater}
              className="px-5 py-3 rounded-2xl bg-[#171C36] hover:bg-[#262C4C] text-[#ECEDF7] border border-[#262C4C] font-heading font-bold text-xs transition flex items-center gap-2 cursor-pointer"
            >
              <Clock className="h-4 w-4 text-[#8B7CFF]" />
              <span>Create for Later</span>
            </button>
          </div>

          {/* Join with Code or Link Form */}
          <form
            onSubmit={handleJoinEntered}
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-4"
          >
            <div className="relative flex-1">
              <input
                type="text"
                value={enteredCode}
                onChange={(e) => setEnteredCode(e.target.value)}
                placeholder="Enter room code or link (e.g. sih-math-101)..."
                className="w-full bg-[#12162B] border border-[#262C4C] focus:border-[#FF9933] rounded-2xl px-4 py-3 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none transition shadow-inner font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={!enteredCode.trim()}
              className="px-6 py-3 rounded-2xl bg-[#171C36] hover:bg-[#262C4C] disabled:opacity-40 text-[#ECEDF7] border border-[#262C4C] font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
            >
              <span>Join Room</span>
              <ArrowRight className="h-4 w-4 text-[#FF9933]" />
            </button>
          </form>

          {/* Feature Highlights Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-4">
            <div className="p-4 rounded-2xl bg-[#12162B] border border-[#262C4C] space-y-1.5">
              <div className="h-8 w-8 rounded-xl bg-[#FF9933]/15 text-[#FF9933] flex items-center justify-center">
                <Users className="h-4 w-4" />
              </div>
              <h3 className="font-heading font-bold text-xs text-white">Zero Account Needed</h3>
              <p className="text-[11px] text-slate-400">Join instantly using room links or passcodes.</p>
            </div>

            <div className="p-4 rounded-2xl bg-[#12162B] border border-[#262C4C] space-y-1.5">
              <div className="h-8 w-8 rounded-xl bg-[#5FE3B0]/15 text-[#5FE3B0] flex items-center justify-center">
                <Radio className="h-4 w-4" />
              </div>
              <h3 className="font-heading font-bold text-xs text-white">Built-in Recording</h3>
              <p className="text-[11px] text-slate-400">1-click WebM video export right to your device.</p>
            </div>

            <div className="p-4 rounded-2xl bg-[#12162B] border border-[#262C4C] space-y-1.5">
              <div className="h-8 w-8 rounded-xl bg-[#8B7CFF]/15 text-[#8B7CFF] flex items-center justify-center">
                <Sparkles className="h-4 w-4" />
              </div>
              <h3 className="font-heading font-bold text-xs text-white">Socratic AI Co-Pilot</h3>
              <p className="text-[11px] text-slate-400">Type @tutor in chat for instant concept answers.</p>
            </div>
          </div>
        </div>

        {/* Right Column: Pre-Join Green Room Device Preview (5 Cols) */}
        <div className="lg:col-span-5 bg-[#12162B] border border-[#262C4C] rounded-3xl p-5 sm:p-6 space-y-5 shadow-2xl relative overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#262C4C] pb-3">
            <div>
              <h3 className="font-heading font-bold text-sm text-white">Device Green Room</h3>
              <p className="text-[11px] text-slate-400">Check camera and microphone before joining</p>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Ready</span>
            </div>
          </div>

          {/* Video Preview Frame */}
          <div className="relative aspect-video rounded-2xl bg-[#090d16] border border-[#1e2638] overflow-hidden flex items-center justify-center shadow-inner">
            <video
              ref={previewVideoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover scale-x-[-1] ${previewVideoOn ? 'block' : 'hidden'}`}
            />

            {!previewVideoOn && (
              <div className="flex flex-col items-center justify-center space-y-2">
                <div className="h-16 w-16 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-lg font-bold text-slate-400">
                  {userName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'ME'}
                </div>
                <span className="text-xs text-slate-500 font-semibold">Camera is off</span>
              </div>
            )}

            {/* Quick Toggle Overlay on Video */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#0A0D1C]/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 shadow-lg">
              <button
                type="button"
                onClick={togglePreviewAudio}
                className={`p-2 rounded-full transition ${
                  previewAudioOn ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-rose-500 text-white'
                }`}
                title={previewAudioOn ? 'Mute' : 'Unmute'}
              >
                {previewAudioOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
              </button>

              <button
                type="button"
                onClick={togglePreviewVideo}
                className={`p-2 rounded-full transition ${
                  previewVideoOn ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-rose-500 text-white'
                }`}
                title={previewVideoOn ? 'Turn off camera' : 'Turn on camera'}
              >
                {previewVideoOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Audio Visualizer Level Bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold">
              <span>Microphone input level:</span>
              <span className={previewAudioLevel > 15 ? 'text-emerald-400' : 'text-slate-500'}>
                {previewAudioOn ? (previewAudioLevel > 15 ? 'Receiving Audio' : 'Speak to test') : 'Muted'}
              </span>
            </div>
            <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-[#FF9933] transition-all duration-75"
                style={{ width: previewAudioOn ? `${previewAudioLevel}%` : '0%' }}
              />
            </div>
          </div>

          {/* Quick Launch Button */}
          <button
            type="button"
            onClick={handleStartInstantMeeting}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-[#FF9933] to-[#FF6F9C] hover:from-[#ffaa4d] hover:to-[#ff8cb1] text-[#0A0D1C] font-heading font-bold text-xs uppercase tracking-wider shadow-lg shadow-[#FF9933]/25 transition"
          >
            Launch Instant Meeting
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* SCHEDULED MEETING MODAL                                               */}
      {/* ===================================================================== */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#12162B] border border-[#262C4C] rounded-3xl p-6 sm:p-7 max-w-md w-full space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-[#262C4C] pb-3">
              <h3 className="font-heading font-bold text-base text-white flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#FF9933]" />
                <span>Here's your joining info</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowScheduleModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Send this link or meeting code to your students, peers, or colleagues. Anyone with the code can join your Live Kshetra classroom.
            </p>

            <div className="p-4 rounded-2xl bg-[#0b0f19] border border-[#262C4C] space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-slate-500 uppercase font-bold">Meeting Code</p>
                  <p className="text-sm font-mono font-bold text-[#5FE3B0]">{scheduledCode}</p>
                </div>
                <button
                  type="button"
                  onClick={copyScheduledCode}
                  className="px-3 py-1.5 rounded-xl bg-[#171C36] hover:bg-[#262C4C] text-xs font-semibold text-slate-300 flex items-center gap-1.5 transition"
                >
                  {copiedCode ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-400 truncate max-w-[220px]">
                  {`${window.location.origin}?room=${scheduledCode}`}
                </span>
                <button
                  type="button"
                  onClick={copyScheduledLink}
                  className="text-xs font-bold text-[#FF9933] hover:underline"
                >
                  {copiedLink ? 'Copied Link' : 'Copy link'}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowScheduleModal(false);
                  setIsMeetingCreator(true);
                  setActiveMeetingCode(scheduledCode);
                }}
                className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-[#FF9933] to-[#FF6F9C] text-[#0A0D1C] font-heading font-bold text-xs uppercase tracking-wider shadow-md transition"
              >
                Join Now
              </button>
              <button
                type="button"
                onClick={() => setShowScheduleModal(false)}
                className="px-5 py-3 rounded-2xl bg-[#171C36] hover:bg-[#262C4C] text-slate-300 text-xs font-semibold transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
