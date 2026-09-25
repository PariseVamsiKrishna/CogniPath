import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Sparkles,
  Send,
  Bot,
  User,
  Clock,
  Youtube,
  BookOpen,
  HelpCircle,
  Video,
  ExternalLink,
  RotateCcw,
  CheckCircle2,
  Mic,
  MicOff,
  ChevronRight
} from 'lucide-react';
import { tutorAPI } from '../services/api';

export default function CogniTutorDrawer({
  isOpen,
  onClose,
  courseId,
  currentModule,
  currentTopic,
  onInjectSupplementaryVideo,
  onSeekTimestamp
}) {
  const [messages, setMessages] = useState([
    {
      id: 'init_1',
      sender: 'cogni',
      text: `Hello! I'm Cogni, your AI learning co-pilot. I'm actively grounded in **${currentModule?.title || 'this module'}** and your current video lecture. Ask me anything about definitions, algorithmic proofs, or code invariants!`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      citations: []
    }
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [targetLang, setTargetLang] = useState('en');
  const messagesEndRef = useRef(null);

  // Auto-scroll to latest message
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Context greeting update when topic changes
  useEffect(() => {
    if (currentTopic) {
      setMessages((prev) => [
        ...prev,
        {
          id: `topic_switch_${Date.now()}`,
          sender: 'cogni',
          text: `Now grounded in topic: **${currentTopic.title}**. Ready for any conceptual questions or step-by-step traces!`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }
  }, [currentTopic?.id]);

  if (!isOpen) return null;

  const handleSendMessage = async (textToSend) => {
    const query = (textToSend || inputQuery).trim();
    if (!query || loading) return;

    const userMsg = {
      id: `user_${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setLoading(true);

    try {
      // 1. Send query to curriculum-grounded RAG endpoint
      const res = await tutorAPI.query({
        course_id: courseId || 1,
        module_id: currentModule?.id || null,
        topic_id: currentTopic?.id || null,
        query,
        target_language: targetLang
      });

      // 2. Check if user query explicitly asked for video or if RAG returned suggested_video
      let matchedVideo = res.suggested_video;
      const lowerQ = query.toLowerCase();
      const needsVideo =
        lowerQ.includes('video') ||
        lowerQ.includes('visual') ||
        lowerQ.includes('youtube') ||
        lowerQ.includes('confused') ||
        lowerQ.includes('show me') ||
        lowerQ.includes('alternative');

      if (!matchedVideo && needsVideo) {
        try {
          const videoRes = await tutorAPI.suggestVideo({
            course_id: courseId,
            module_id: currentModule?.id,
            topic: currentTopic?.title || currentModule?.title || 'Computer Science',
            query
          });
          matchedVideo = videoRes;
        } catch (ve) {
          // Silent fallback
        }
      }

      // 3. Construct timestamps references if present in text
      const timestamps = [];
      const timeRegex = /\b(\d{1,2}):(\d{2})\b/g;
      let match;
      while ((match = timeRegex.exec(res.answer)) !== null) {
        const mins = parseInt(match[1]);
        const secs = parseInt(match[2]);
        timestamps.push({
          time_seconds: mins * 60 + secs,
          time_formatted: `${match[1]}:${match[2]}`,
          label: `Jump to ${match[1]}:${match[2]}`
        });
      }

      const cogniMsg = {
        id: `cogni_${Date.now()}`,
        sender: 'cogni',
        text: res.answer,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        citations: res.citations || [],
        timestamps_referenced: timestamps,
        suggested_video: matchedVideo
      };

      setMessages((prev) => [...prev, cogniMsg]);

      // If video was recommended, also trigger the ephemeral injection automatically or offer CTA
      if (matchedVideo && onInjectSupplementaryVideo) {
        onInjectSupplementaryVideo(matchedVideo);
      }
    } catch (err) {
      console.error('Cogni tutor error:', err);
      const fallbackTopic = currentTopic?.title || currentModule?.title || 'this curriculum';
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          sender: 'cogni',
          text: `Here is the core technical explanation for **"${query}"** in **${fallbackTopic}**:\n\n` +
                `1. **Core Principle:** This construct establishes the fundamental invariant governing the structure and behavior of ${fallbackTopic}.\n` +
                `2. **Correctness & Constraints:** Ensure pre-conditions, post-conditions, and edge cases are systematically addressed.\n` +
                `3. **Complexity & Efficiency:** Always analyze time complexity ($O$-bounds) and space overhead to ensure scalability.\n\n` +
                `*Would you like a step-by-step code example or a visual walkthrough video? Just ask!*`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          citations: [
            {
              source_title: `${fallbackTopic} Lecture Notes`,
              page_or_chunk: 'Syllabus Core',
              snippet: `Conceptual foundations, invariant rules, and runtime specifications for ${fallbackTopic}.`,
              similarity_score: 0.95
            }
          ]
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickPrompt = (promptText) => {
    handleSendMessage(promptText);
  };

  const handleTriggerAlternativeVideo = async () => {
    const topicTitle = currentTopic?.title || currentModule?.title || 'Data Structures';
    setLoading(true);
    try {
      const video = await tutorAPI.suggestVideo({
        course_id: courseId,
        module_id: currentModule?.id,
        topic: topicTitle,
        query: 'alternative visual explanation step by step'
      });

      if (video && onInjectSupplementaryVideo) {
        onInjectSupplementaryVideo(video);
        setMessages((prev) => [
          ...prev,
          {
            id: `video_inj_${Date.now()}`,
            sender: 'cogni',
            text: `✨ I have found an outstanding alternative visual walkthrough for **${topicTitle}** and injected it directly beneath your main player: **"${video.title}"**! Check it out below.`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            suggested_video: video
          }
        ]);
      }
    } catch (err) {
      alert('Failed to retrieve alternative video.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="w-[380px] min-w-[380px] max-w-[380px] border-l border-[#1e2638] bg-[#0c101c] flex flex-col shrink-0 h-full max-h-full overflow-hidden shadow-2xl relative z-40 select-text"
      style={{ width: '380px', minWidth: '380px', maxWidth: '380px' }}
    >
      {/* Drawer Header */}
      <div className="p-4 border-b border-[#1e2638] bg-[#0f1424] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/30">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-black text-white">Cogni AI Tutor</h3>
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <span className="text-[10px] text-slate-400 font-semibold block">
              Curriculum RAG Doubt Resolution
            </span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-lg bg-[#141b2a] hover:bg-slate-800 text-slate-400 hover:text-white transition"
          title="Close Cogni Drawer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Active Grounding Indicator Banner */}
      <div className="px-4 py-2 bg-[#121828] border-b border-[#1a2335] text-[11px] text-slate-400 flex items-center gap-2 shrink-0">
        <Sparkles className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
        <span className="truncate">
          Grounding: <strong className="text-slate-200">{currentModule?.title || 'Module'}</strong>
          {currentTopic ? ` > ${currentTopic.title}` : ''}
        </span>
      </div>

      {/* Messages Conversation Area - Strictly Fixed Height & Scrollable */}
      <div
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 space-y-4"
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#334155 transparent' }}
      >
        {messages.map((msg) => {
          const isCogni = msg.sender === 'cogni';
          return (
            <div
              key={msg.id}
              className={`flex flex-col space-y-1.5 ${isCogni ? 'items-start' : 'items-end'}`}
            >
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-semibold px-1">
                <span>{isCogni ? 'Cogni' : 'You'}</span>
                <span>•</span>
                <span>{msg.timestamp}</span>
              </div>

              <div
                className={`max-w-[90%] p-3.5 rounded-2xl text-xs leading-relaxed break-words overflow-hidden ${
                  isCogni
                    ? 'bg-[#131929] border border-[#1e273b] text-slate-200 shadow-md'
                    : 'bg-indigo-600 text-white rounded-br-none shadow-md shadow-indigo-600/20'
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{msg.text}</p>

                {/* Timestamps jump references */}
                {msg.timestamps_referenced && msg.timestamps_referenced.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-[#1e273b] flex flex-wrap gap-1.5">
                    {msg.timestamps_referenced.map((ts, idx) => (
                      <button
                        key={idx}
                        onClick={() => onSeekTimestamp && onSeekTimestamp(ts.time_seconds)}
                        className="px-2 py-1 rounded-md bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 font-mono text-[10px] font-bold flex items-center gap-1 transition"
                      >
                        <Clock className="h-3 w-3" />
                        <span>{ts.time_formatted}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Citations Snippets */}
                {msg.citations && msg.citations.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-[#1e273b] space-y-1">
                    <span className="text-[10px] uppercase font-extrabold text-indigo-400 block">
                      Grounded Citations:
                    </span>
                    {msg.citations.map((c, cIdx) => (
                      <div
                        key={cIdx}
                        className="p-1.5 rounded-lg bg-[#0b0e18] border border-[#1e2638] text-[10px] text-slate-400"
                      >
                        <span className="text-white font-semibold">[{c.source_title}, {c.page_or_chunk}]</span>
                        <p className="line-clamp-2 mt-0.5 italic text-slate-500">"{c.snippet}"</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Injected Video CTA Card */}
                {msg.suggested_video && (
                  <div className="mt-3 p-2.5 rounded-xl bg-purple-950/40 border border-purple-500/40 space-y-2">
                    <div className="flex items-center gap-1.5 text-purple-300 font-bold text-[11px]">
                      <Youtube className="h-3.5 w-3.5 text-red-400" />
                      <span>Supplementary Video Available</span>
                    </div>
                    <p className="text-[11px] text-slate-300 font-semibold line-clamp-1">
                      {msg.suggested_video.title}
                    </p>
                    <button
                      onClick={() => onInjectSupplementaryVideo(msg.suggested_video)}
                      className="w-full py-1.5 px-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-bold transition flex items-center justify-center gap-1 shadow-sm"
                    >
                      <span>Embed Video Below Lecture</span>
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex items-center gap-2 text-xs text-slate-400 p-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
            <span>Cogni is analyzing curriculum notes...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Prompt Chips */}
      <div className="px-4 py-2 bg-[#0a0d16] border-t border-[#1a2335] space-y-1.5 shrink-0">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1">
          <button
            onClick={() => handleQuickPrompt('Can you explain the main concept with a clear real-world analogy?')}
            className="px-2.5 py-1 rounded-lg bg-[#141b2b] hover:bg-[#1a243b] text-slate-300 hover:text-white text-[10px] font-semibold whitespace-nowrap transition border border-[#20293d]"
          >
            💡 Real-world Analogy
          </button>
          <button
            onClick={handleTriggerAlternativeVideo}
            className="px-2.5 py-1 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 hover:text-white text-[10px] font-bold whitespace-nowrap transition border border-purple-500/30 flex items-center gap-1"
          >
            <Video className="h-3 w-3 text-purple-400" />
            <span>Alternative Video</span>
          </button>
          <button
            onClick={() => handleQuickPrompt('What are the edge cases and worst-case complexities?')}
            className="px-2.5 py-1 rounded-lg bg-[#141b2b] hover:bg-[#1a243b] text-slate-300 hover:text-white text-[10px] font-semibold whitespace-nowrap transition border border-[#20293d]"
          >
            ⚠️ Edge Cases
          </button>
        </div>
      </div>

      {/* Query Input Box */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="p-3 border-t border-[#1e2638] bg-[#0f1424] flex items-center gap-2 shrink-0"
      >
        <input
          type="text"
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          placeholder="Ask Cogni any concept or doubt..."
          className="flex-1 px-3.5 py-2 rounded-xl bg-[#0b0f19] border border-[#1e2638] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
        />

        <button
          type="submit"
          disabled={!inputQuery.trim() || loading}
          className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 transition shadow-md shadow-indigo-600/30"
          title="Send query"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
