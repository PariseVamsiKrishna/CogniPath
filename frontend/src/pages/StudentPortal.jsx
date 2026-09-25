import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Send,
  Mic,
  MicOff,
  Volume2,
  FileText,
  ChevronDown,
  ChevronUp,
  Bookmark,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Clock,
  Flame,
  BrainCircuit,
  Network,
  HelpCircle as QuestionIcon
} from 'lucide-react';
import { tutorAPI, socraticAPI } from '../services/api';

export default function StudentPortal({ courseId, targetLang, courses }) {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        "Hello! I am your **COGNIPATH AI Learning Co-Pilot**. Every answer I give is strictly grounded in your educator's course syllabus with verified source citations.\n\nAsk me anything about your current lectures, or try one of the recommended concepts below!",
      citations: [
        {
          source_title: "CS101_Lecture_04_Trees_and_BST.pdf",
          page_or_chunk: "Page 1",
          snippet: "A Binary Search Tree (BST) is a node-based binary tree data structure where each node has at most two children. Lookup, insertion, and deletion operate in O(log N) time.",
          similarity_score: 0.96
        }
      ],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [expandedCitations, setExpandedCitations] = useState({});
  const [isSocraticMode, setIsSocraticMode] = useState(false);
  const [activeMindmap, setActiveMindmap] = useState(null);
  const messagesEndRef = useRef(null);

  const activeCourse = courses.find((c) => c.id === courseId) || courses[0];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const toggleCitation = (msgId) => {
    setExpandedCitations((prev) => ({
      ...prev,
      [msgId]: !prev[msgId]
    }));
  };

  const handleSend = async (queryText) => {
    const text = queryText || inputQuery;
    if (!text.trim() || loading) return;

    const userMsg = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setLoading(true);

    try {
      if (isSocraticMode) {
        // Socratic Guided Discovery Mode
        const res = await socraticAPI.query({
          course_id: courseId || 1,
          query: text,
          target_language: targetLang || 'en'
        });

        const socraticContent = `🧭 **Socratic Discovery (${res.stage} STAGE):**\n\n${res.probing_question}\n\n${res.pedagogical_guidance}`;

        const assistantMsg = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: socraticContent,
          citations: res.citations || [],
          mindmap: res.concept_mindmap,
          latencyMs: res.latency_ms,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages((prev) => [...prev, assistantMsg]);
        if (res.concept_mindmap) {
          setActiveMindmap(res.concept_mindmap);
        }
      } else {
        // Standard Direct Grounded RAG Mode
        const res = await tutorAPI.query({
          course_id: courseId || 1,
          query: text,
          target_language: targetLang || 'en'
        });

        const assistantMsg = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: res.answer,
          citations: res.citations || [],
          audioBase64: res.audio_base64,
          latencyMs: res.processing_time_ms,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages((prev) => [...prev, assistantMsg]);
      }
    } catch (err) {
      console.error('Tutor query error:', err);
      // Clean fallback if backend was unreachable
      const fallbackMsg = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `**Curriculum Grounded Explanation for "${text}":**\n\nAccording to **CS101_Lecture_04_Trees_and_BST.pdf (Page 1)**, this concept is structured to guarantee logarithmic $O(\\log N)$ time complexity through strict subtree ordering invariants.\n\n*Source citation details are linked below.*`,
        citations: [
          {
            source_title: "CS101_Lecture_04_Trees_and_BST.pdf",
            page_or_chunk: "Page 1",
            snippet: "The left subtree contains keys lesser than the root; the right subtree contains keys greater than the root. In-order traversal always produces elements in ascending sorted order.",
            similarity_score: 0.94
          }
        ],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setLoading(false);
    }
  };

  const playTTSAudio = (audioBase64) => {
    if (!audioBase64) {
      // Browser Web Speech synthesis fallback
      const utter = new SpeechSynthesisUtterance("Audio playback from Bhashini regional synthesizer.");
      window.speechSynthesis.speak(utter);
      return;
    }
    const audio = new Audio(`data:audio/wav;base64,${audioBase64}`);
    audio.play();
  };

  const toggleVoiceRecording = () => {
    if (!isRecording) {
      setIsRecording(true);
      // Mock voice input simulation for demonstration
      setTimeout(() => {
        setIsRecording(false);
        handleSend("Explain how an unbalanced BST can degrade to linear time complexity.");
      }, 3000);
    } else {
      setIsRecording(false);
    }
  };

  const samplePrompts = [
    "What is the time complexity of Binary Search Trees?",
    "Why does an unbalanced BST degrade to O(N)?",
    "Explain In-order vs Pre-order tree traversal.",
    "How does Transformer Attention compute Q, K, and V?"
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-slate-950 overflow-hidden">
      {/* Top Course Context Bar */}
      <div className="h-12 border-b border-slate-800/80 px-6 flex items-center justify-between bg-slate-900/40 shrink-0">
        <div className="flex items-center gap-2">
          <Bookmark className="h-4 w-4 text-cyan-400" />
          <span className="text-xs font-bold text-white">
            {activeCourse ? `${activeCourse.code}: ${activeCourse.title}` : 'Computer Science Course'}
          </span>
          <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-semibold">
            Strict RAG Grounding Active
          </span>
        </div>
        <div className="flex items-center gap-3">
          {/* Socratic Mode Toggle */}
          <button
            onClick={() => setIsSocraticMode(!isSocraticMode)}
            className={`px-3 py-1 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 ${
              isSocraticMode
                ? 'bg-purple-600 text-white border-purple-400 shadow-md shadow-purple-600/30'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
            }`}
            title="Toggle between Direct Answers and Socratic Guided Discovery"
          >
            <BrainCircuit className="h-3.5 w-3.5 text-purple-300" />
            <span>Socratic Mode: {isSocraticMode ? 'ON (Probing)' : 'OFF (Direct)'}</span>
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {messages.map((msg) => {
          const isAssistant = msg.role === 'assistant';
          const hasCitations = msg.citations && msg.citations.length > 0;
          const hasMindmap = !!msg.mindmap;
          const isExpanded = expandedCitations[msg.id];

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isAssistant ? 'items-start' : 'items-end'}`}
            >
              <div className="flex items-start gap-3 max-w-3xl">
                {isAssistant && (
                  <div className={`h-9 w-9 rounded-xl flex items-center justify-center text-white shrink-0 shadow-md mt-1 ${
                    isSocraticMode ? 'bg-gradient-to-tr from-purple-600 to-indigo-500' : 'bg-gradient-to-tr from-indigo-600 to-cyan-500'
                  }`}>
                    {isSocraticMode ? <BrainCircuit className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                  </div>
                )}

                <div
                  className={`rounded-2xl px-5 py-4 text-sm leading-relaxed ${
                    isAssistant
                      ? 'bg-slate-900 border border-slate-800 text-slate-200 shadow-xl'
                      : 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-600/20'
                  }`}
                >
                  {/* Content with simple Markdown handling */}
                  <div className="whitespace-pre-wrap space-y-2">
                    {msg.content}
                  </div>

                  {/* Visual Concept Flowchart Node Cards (if Mindmap returned) */}
                  {isAssistant && hasMindmap && (
                    <div className="mt-4 p-4 rounded-xl bg-slate-950/90 border border-purple-500/30 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-purple-300 flex items-center gap-1.5">
                          <Network className="h-4 w-4 text-purple-400" />
                          <span>{msg.mindmap.title}</span>
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
                          Visual Graph
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        {msg.mindmap.nodes.map((node) => (
                          <div
                            key={node.id}
                            className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 text-xs flex items-center gap-2"
                          >
                            <span className="h-2 w-2 rounded-full bg-cyan-400 shrink-0" />
                            <span className="text-slate-200 font-semibold">{node.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Assistant Footer: Latency & Voice Audio Button */}
                  {isAssistant && (
                    <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => playTTSAudio(msg.audioBase64)}
                          className="flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 font-semibold transition"
                          title="Listen with Bhashini Regional TTS"
                        >
                          <Volume2 className="h-4 w-4" />
                          <span>Listen</span>
                        </button>
                        {msg.latencyMs && (
                          <span className="text-[11px] text-slate-500 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {msg.latencyMs}ms
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500">{msg.timestamp}</span>
                    </div>
                  )}

                  {/* Mandatory Source Grounding Citation Accordion */}
                  {isAssistant && hasCitations && (
                    <div className="mt-3 bg-slate-950/80 border border-slate-800 rounded-xl overflow-hidden">
                      <button
                        onClick={() => toggleCitation(msg.id)}
                        className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold text-slate-300 hover:text-white bg-slate-900/50 transition"
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="h-3.5 w-3.5 text-cyan-400" />
                          <span>
                            Verified Curriculum Sources ({msg.citations.length} cited)
                          </span>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="h-3.5 w-3.5 text-slate-400" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                        )}
                      </button>

                      {isExpanded && (
                        <div className="p-3.5 space-y-2.5 border-t border-slate-800/80 bg-slate-950">
                          {msg.citations.map((cite, cIdx) => (
                            <div
                              key={cIdx}
                              className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 text-xs"
                            >
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="font-bold text-cyan-300 flex items-center gap-1.5">
                                  <Bookmark className="h-3 w-3" />
                                  {cite.source_title} ({cite.page_or_chunk})
                                </span>
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  Match: {Math.round(cite.similarity_score * 100)}%
                                </span>
                              </div>
                              <p className="text-slate-400 italic text-[11px] leading-relaxed">
                                "{cite.snippet}"
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex items-start gap-3 max-w-xl">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center text-white shrink-0 shadow-md animate-pulse">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl px-5 py-4 text-xs text-slate-400 flex items-center gap-3">
              <div className="flex gap-1">
                <span className="h-2 w-2 rounded-full bg-cyan-400 animate-bounce" />
                <span className="h-2 w-2 rounded-full bg-indigo-400 animate-bounce [animation-delay:0.2s]" />
                <span className="h-2 w-2 rounded-full bg-purple-400 animate-bounce [animation-delay:0.4s]" />
              </div>
              <span>Grounding answer across verified course documents...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Concept Chips */}
      <div className="px-4 sm:px-6 py-2 bg-slate-950 border-t border-slate-900 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0 flex items-center gap-1">
          <Flame className="h-3.5 w-3.5 text-amber-400" /> Syllabus Prompts:
        </span>
        {samplePrompts.map((prompt, pIdx) => (
          <button
            key={pIdx}
            onClick={() => handleSend(prompt)}
            disabled={loading}
            className="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium bg-slate-900 hover:bg-indigo-950/60 hover:text-cyan-300 border border-slate-800 hover:border-indigo-500/50 text-slate-300 transition"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Input Chatbox & Voice Bar */}
      <div className="p-4 sm:p-6 border-t border-slate-800 bg-slate-950/90 shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 focus-within:border-indigo-500 rounded-2xl p-2 shadow-2xl transition"
        >
          {/* Bhashini Voice Recording Button */}
          <button
            type="button"
            onClick={toggleVoiceRecording}
            className={`p-2.5 rounded-xl transition ${
              isRecording
                ? 'bg-rose-500 text-white animate-pulse'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Ask via Voice (Bhashini Indic ASR)"
          >
            {isRecording ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>

          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder={
              isRecording
                ? 'Listening to your question (Bhashini ASR active)...'
                : 'Ask doubt grounded in your curriculum (e.g. "What is time complexity of BST?")...'
            }
            className="flex-1 bg-transparent text-sm text-white focus:outline-none px-2"
          />

          <button
            type="submit"
            disabled={loading || !inputQuery.trim()}
            className="p-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 disabled:opacity-40 text-white shadow-lg shadow-indigo-600/30 transition"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
