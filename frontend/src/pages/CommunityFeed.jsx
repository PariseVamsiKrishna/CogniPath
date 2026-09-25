import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Hash,
  ThumbsUp,
  CheckCircle2,
  Send,
  Sparkles,
  Users,
  Award,
  Share2,
  Bookmark
} from 'lucide-react';
import { communitiesAPI } from '../services/api';

export default function CommunityFeed({ courseId, user }) {
  const [channels, setChannels] = useState([
    { id: 1, name: 'general', description: 'General course discussion and tips' },
    { id: 2, name: 'doubts-and-qa', description: 'Peer and educator doubt clarification' },
    { id: 3, name: 'exam-prep', description: 'Collaborative revision and concept exchanges' }
  ]);
  const [activeChannelId, setActiveChannelId] = useState(2);
  const [messages, setMessages] = useState([
    {
      id: 1,
      author_name: 'Priya Patel',
      author_role: 'STUDENT',
      content: 'Can someone explain in simple terms why in-order traversal of a BST is always sorted?',
      upvotes: 3,
      is_solution: false,
      created_at: '2 hours ago'
    },
    {
      id: 2,
      author_name: 'Aarav Sharma',
      author_role: 'STUDENT',
      content: 'Because by definition in a BST, all nodes in the left subtree are smaller than the root, and all in the right are larger. Visiting (Left -> Root -> Right) recursively guarantees ascending order without sorting overhead!',
      upvotes: 8,
      is_solution: true,
      created_at: '1 hour ago'
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchChannels();
  }, [courseId]);

  useEffect(() => {
    if (activeChannelId) {
      fetchMessages(activeChannelId);
    }
  }, [activeChannelId]);

  const fetchChannels = async () => {
    try {
      const data = await communitiesAPI.listChannels(courseId || 1);
      if (data && data.length > 0) {
        setChannels(data);
        setActiveChannelId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load channels:', err);
    }
  };

  const fetchMessages = async (channelId) => {
    try {
      const data = await communitiesAPI.listMessages(channelId);
      if (data && data.length > 0) {
        setMessages(data);
      }
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  };

  const handlePost = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    const content = inputMessage;
    setInputMessage('');

    try {
      const res = await communitiesAPI.postMessage(activeChannelId, content);
      setMessages((prev) => [...prev, res]);
    } catch (err) {
      // Offline fallback
      const mockMsg = {
        id: Date.now(),
        author_name: user?.full_name || 'Student',
        author_role: user?.role || 'STUDENT',
        content: content,
        upvotes: 0,
        is_solution: false,
        created_at: 'Just now'
      };
      setMessages((prev) => [...prev, mockMsg]);
    }
  };

  const handleUpvote = async (msgId) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, upvotes: m.upvotes + 1 } : m))
    );
    try {
      await communitiesAPI.upvote(msgId);
    } catch (err) {
      // Quietly handled
    }
  };

  const activeChannel = channels.find((c) => c.id === activeChannelId) || channels[0];

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-wider mb-1">
          <MessageSquare className="h-4 w-4" />
          <span>Native In-App Community Hub</span>
        </div>
        <h2 className="text-2xl font-black text-white">Course Discussion &amp; Peer Q&amp;A</h2>
        <p className="text-slate-400 text-xs sm:text-sm mt-1">
          Connect with peers and educators inside dedicated course channels without relying on external messaging apps.
        </p>
      </div>

      {/* Main Channel Layout */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 h-[640px]">
        {/* Channels Sidebar (1 Col) */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-xl">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block px-2 mb-3">
              Course Channels
            </span>
            <div className="space-y-1.5">
              {channels.map((chan) => {
                const isActive = chan.id === activeChannelId;
                return (
                  <button
                    key={chan.id}
                    onClick={() => setActiveChannelId(chan.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <Hash className="h-4 w-4 text-cyan-400 shrink-0" />
                    <span className="truncate">{chan.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] text-slate-400 space-y-1">
            <span className="font-bold text-white block">Peer Helpfulness Badges</span>
            <p>Upvote answers to flag verified solutions for the whole cohort.</p>
          </div>
        </div>

        {/* Message Thread Feed (3 Cols) */}
        <div className="md:col-span-3 bg-slate-900/90 border border-slate-800 rounded-2xl flex flex-col justify-between shadow-2xl overflow-hidden">
          {/* Channel Header */}
          <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
            <div className="flex items-center gap-2">
              <Hash className="h-5 w-5 text-cyan-400" />
              <div>
                <h3 className="text-sm font-extrabold text-white">#{activeChannel?.name}</h3>
                <p className="text-[11px] text-slate-400">{activeChannel?.description}</p>
              </div>
            </div>
            <span className="text-xs text-slate-500 font-medium">Cohort Peer Room</span>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 p-5 overflow-y-auto space-y-4">
            {messages.map((m) => {
              const isEducator = m.author_role === 'EDUCATOR';
              return (
                <div
                  key={m.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    m.is_solution
                      ? 'bg-gradient-to-r from-emerald-500/10 via-slate-900 to-slate-900 border-emerald-500/30'
                      : 'bg-slate-950 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-gradient-to-tr from-indigo-500 to-cyan-500 flex items-center justify-center text-xs font-bold text-white">
                        {m.author_name.charAt(0)}
                      </div>
                      <span className="font-bold text-white text-xs">{m.author_name}</span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                          isEducator
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                        }`}
                      >
                        {m.author_role}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      {m.is_solution && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Verified Solution
                        </span>
                      )}
                      <span className="text-[10px] text-slate-500">{m.created_at}</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap pl-9">
                    {m.content}
                  </p>

                  <div className="mt-3 pl-9 flex items-center gap-3">
                    <button
                      onClick={() => handleUpvote(m.id)}
                      className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-indigo-950/60 border border-slate-800 hover:border-indigo-500/40 text-slate-400 hover:text-indigo-300 text-[11px] font-semibold transition flex items-center gap-1.5"
                    >
                      <ThumbsUp className="h-3.5 w-3.5" />
                      <span>{m.upvotes || 0} Helpful</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* New Post Input */}
          <form onSubmit={handlePost} className="p-3 border-t border-slate-800 bg-slate-950 flex gap-2">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder={`Share a doubt or tip in #${activeChannel?.name}...`}
              className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 transition"
            />
            <button
              type="submit"
              disabled={!inputMessage.trim()}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-bold uppercase tracking-wider shadow-md transition flex items-center gap-1.5"
            >
              <span>Post</span>
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
