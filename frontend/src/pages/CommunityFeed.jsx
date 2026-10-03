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
  Bookmark,
  Shield,
  Trash2,
  UserX,
  AlertTriangle,
  X,
  Plus,
  Search,
  Bell,
  Check,
  Megaphone,
  MessageCircle,
  Lock,
  ArrowRight
} from 'lucide-react';
import { communitiesAPI } from '../services/api';

export default function CommunityFeed({
  courseId,
  user,
  courses = [],
  enrolledCourses = [],
  onSelectCourse,
  onEnrollCourse,
  onUnenrollCourse
}) {
  const isEducator = user?.role === 'EDUCATOR';

  // Active courses list
  const allAvailableCourses = courses.length > 0 ? courses : [
    { id: 1, title: 'Data Structures and Algorithms', code: 'CS101', educator_id: 1, educator_name: 'Prof. Rajesh Ramanujan' },
    { id: 2, title: 'Database Management Systems', code: 'CS201', educator_id: 1, educator_name: 'Prof. Rajesh Ramanujan' },
    { id: 3, title: 'Web Development Fundamentals', code: 'CS301', educator_id: 2, educator_name: 'Dr. Aisha Khan' }
  ];

  // Community tab toggle

  const [communityTab, setCommunityTab] = useState('my');
  // Active selected community (course)
  const [selectedCourseId, setSelectedCourseId] = useState(() => {
    if (courseId && allAvailableCourses.some((c) => c.id === courseId)) {
      return courseId;
    }
    return allAvailableCourses[0]?.id || 1;
  });

  useEffect(() => {
    if (courseId && courseId !== selectedCourseId) {
      setSelectedCourseId(courseId);
    }
  }, [courseId]);

  const activeCourse = allAvailableCourses.find((c) => c.id === selectedCourseId) || allAvailableCourses[0];
  const isCommunityOwner = isEducator || (activeCourse && (activeCourse.educator_id === user?.id || user?.role === 'ADMIN'));

  // Joined communities tracking per user
  const [joinedCommunities, setJoinedCommunities] = useState(() => {
    const storageKey = `cognipath_joined_communities_${user?.id || user?.email}`;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) return JSON.parse(stored);
    } catch (e) {}

    // By default, only courses the student has explicitly enrolled in are joined
    if (enrolledCourses && enrolledCourses.length > 0) {
      return enrolledCourses.map((c) => c.id);
    }
    // Educators own all courses
    if (isEducator) {
      return allAvailableCourses.map((c) => c.id);
    }
    return [];
  });

  const isCurrentJoined = joinedCommunities.includes(activeCourse.id) || isCommunityOwner;

  const handleJoinCommunity = async (cId) => {
    const updated = [...new Set([...joinedCommunities, cId])];
    setJoinedCommunities(updated);
    try {
      localStorage.setItem(`cognipath_joined_communities_${user?.id || user?.email}`, JSON.stringify(updated));
    } catch (e) {}

    if (onEnrollCourse) {
      await onEnrollCourse(cId);
    }
  };

  const handleLeaveCommunity = async (cId) => {
    const updated = joinedCommunities.filter((id) => id !== cId);
    setJoinedCommunities(updated);
    try {
      localStorage.setItem(`cognipath_joined_communities_${user?.id || user?.email}`, JSON.stringify(updated));
    } catch (e) {}

    if (onUnenrollCourse) {
      await onUnenrollCourse(cId);
    }
  };


  // Channels & Messages State
  const [channels, setChannels] = useState([
    { id: 1, name: 'announcements', description: 'Official announcements from Community Owner' },
    { id: 2, name: 'discussion', description: 'Open peer questions, concept discussions & study' }
  ]);
  const [activeChannelName, setActiveChannelName] = useState('announcements'); // 'announcements' or 'discussion'
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [searchFilter, setSearchFilter] = useState('');

  // Owner Management Modals
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closeConfirmText, setCloseConfirmText] = useState('');
  const [isClosing, setIsClosing] = useState(false);
  const [memberRoster, setMemberRoster] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Load Channels & Messages for current active course
  useEffect(() => {
    fetchChannelsAndMessages();
  }, [activeCourse.id, activeChannelName]);

  const fetchChannelsAndMessages = async () => {
    // Default curated announcement + discussion messages
    const defaultAnnouncements = [
      {
        id: 101,
        author_name: activeCourse.educator_name || 'Prof. Rajesh Ramanujan',
        author_role: 'EDUCATOR',
        is_owner: true,
        channel_name: 'announcements',
        content: `📢 Welcome to the official ${activeCourse.title} Community!\n\nThis channel is reserved exclusively for homework milestones, lecture notes, exam alerts, and studio room codes. Ensure you check this space before weekly assessments.`,
        upvotes: 14,
        created_at: 'Yesterday'
      },
      {
        id: 102,
        author_name: activeCourse.educator_name || 'Prof. Rajesh Ramanujan',
        author_role: 'EDUCATOR',
        is_owner: true,
        channel_name: 'announcements',
        content: `🎯 **Quiz Milestone Alert:** Spaced Repetition Check 03 is now unlocked for this module. Review the tree balance proofs before attempting!`,
        upvotes: 9,
        created_at: '3 hours ago'
      }
    ];

    const defaultDiscussions = [
      {
        id: 201,
        author_name: 'Priya Patel',
        author_role: 'STUDENT',
        is_owner: false,
        channel_name: 'discussion',
        content: 'Can someone explain in simple terms why in-order traversal of a BST is always sorted?',
        upvotes: 5,
        is_solution: false,
        created_at: '2 hours ago'
      },
      {
        id: 202,
        author_name: 'Aarav Sharma',
        author_role: 'STUDENT',
        is_owner: false,
        channel_name: 'discussion',
        content: 'Because in a BST, all nodes in the left subtree are smaller than root, and all in right are larger. Visiting Left -> Root -> Right recursively guarantees ascending order without sorting overhead!',
        upvotes: 11,
        is_solution: true,
        created_at: '1 hour ago'
      }
    ];

    try {
      const chans = await communitiesAPI.listChannels(activeCourse.id);
      if (chans && chans.length > 0) {
        setChannels(chans);
        // fetch messages for current channel
        const activeChan = chans.find(c => c.name.toLowerCase() === activeChannelName) || chans[0];
        if (activeChan) {
          try {
            const msgs = await communitiesAPI.listMessages(activeChan.id);
            if (msgs && msgs.length > 0) {
              // add channel_name for frontend filtering
              setMessages(msgs.map(m => ({ ...m, channel_name: activeChan.name })));
              return;
            }
          } catch (e) {}
        }
      }
    } catch (err) {
      console.warn('API unavailable, using demo messages:', err);
    }
    // Fallback to demo messages only if API fails or returns empty
    setMessages([...defaultAnnouncements, ...defaultDiscussions]);
  };

  const currentChannelMessages = messages.filter((m) => {
    if (activeChannelName === 'announcements') {
      return m.channel_name === 'announcements' || m.author_role === 'EDUCATOR';
    }
    return m.channel_name === 'discussion' || m.channel_name !== 'announcements';
  });

  const handlePost = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || !isCurrentJoined) return;

    // Strict rule: only community owner can post in announcements!
    if (activeChannelName === 'announcements' && !isCommunityOwner) {
      alert('Only the Community Owner can post in Announcements.');
      return;
    }

    const content = inputMessage;
    setInputMessage('');

    const newMsg = {
      id: Date.now(),
      author_name: user?.full_name || (isCommunityOwner ? 'Community Owner' : 'Student'),
      author_role: user?.role || (isCommunityOwner ? 'EDUCATOR' : 'STUDENT'),
      is_owner: isCommunityOwner,
      channel_name: activeChannelName,
      content,
      upvotes: 0,
      created_at: 'Just now'
    };

    setMessages((prev) => [...prev, newMsg]);

    try {
      const activeChan = channels.find((c) => c.name.toLowerCase() === activeChannelName) || channels[0];
      if (activeChan) {
        await communitiesAPI.postMessage(activeChan.id, content);
        fetchChannelsAndMessages();
      }
    } catch (err) {
      // Handled cleanly with optimistic update
    }
  };

  const handleUpvote = (msgId) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, upvotes: (m.upvotes || 0) + 1 } : m))
    );
  };

  // Owner Member Management Actions
  const handleOpenMembers = async () => {
    if (!isCommunityOwner) return;
    setShowMembersModal(true);
    setLoadingMembers(true);
    try {
      const res = await communitiesAPI.getMembers(activeCourse.id);
      if (res && res.members) {
        setMemberRoster(res.members);
      }
    } catch (err) {
      // Fallback roster
      setMemberRoster([
        {
          user_id: activeCourse.educator_id || 1,
          full_name: activeCourse.educator_name || 'Prof. Rajesh Ramanujan',
          email: 'educator@cognipath.edu',
          role: 'EDUCATOR',
          is_owner: true,
          joined_at: '2026-09-01'
        },
        {
          user_id: 2,
          full_name: 'Priya Patel',
          email: 'priya@cognipath.edu',
          role: 'STUDENT',
          is_owner: false,
          joined_at: '2026-09-15'
        },
        {
          user_id: 3,
          full_name: 'Aarav Sharma',
          email: 'aarav@cognipath.edu',
          role: 'STUDENT',
          is_owner: false,
          joined_at: '2026-09-18'
        }
      ]);
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleKickMember = async (memberId) => {
    if (!confirm('Are you sure you want to kick this member out of the community?')) return;
    try {
      await communitiesAPI.kickMember(activeCourse.id, memberId);
    } catch (e) {
      console.warn('API kick member notice:', e);
    }
    setMemberRoster((prev) => prev.filter((m) => m.user_id !== memberId));
  };

  const handleCloseCommunityConfirm = async () => {
    if (closeConfirmText.trim().toLowerCase() !== 'delete') return;

    setIsClosing(true);
    try {
      await communitiesAPI.closeCommunity(activeCourse.id);
    } catch (e) {
      console.warn('API close community notice:', e);
    }

    setMessages([]);
    setShowCloseModal(false);
    setIsClosing(false);
    setCloseConfirmText('');
    alert(`Community for "${activeCourse.title}" has been permanently closed and all threads deleted.`);
  };

  // Filtered course communities
  const filteredCourses = allAvailableCourses.filter((c) => {
    const q = searchFilter.toLowerCase();
    // Match by: title, code, educator name, or just numbers (e.g. '101' matches 'CS101')
    return (
      `${c.title} ${c.code || ''} ${c.educator_name || ''}`.toLowerCase().includes(q) ||
      (q.match(/^\d+$/) && (c.code || '').includes(q)) // number-only filter
    );
  });

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-[#0A0D1C] overflow-hidden text-[#ECEDF7]">
      {/* ===================================================================== */}
      {/* LEFT SIDEBAR: Community List                                          */}
      {/* ===================================================================== */}
      <div className="w-80 sm:w-96 border-r border-[#262C4C] bg-[#12162B] flex flex-col shrink-0">
        {/* Communities Header */}
        <div className="p-4 border-b border-[#262C4C] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-[#25D366]/15 border border-[#25D366]/30 flex items-center justify-center text-[#25D366]">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <h2 className="font-heading text-base font-bold text-[#ECEDF7] leading-tight">
                  Course Communities
                </h2>
                <span className="text-[10px] text-[#8A90B4]">Course-Based Cohorts</span>
              </div>
            </div>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-3 top-3 text-[#8A90B4]" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search by name, code, or educator..."
              className="w-full bg-[#171C36] border border-[#262C4C] focus:border-[#25D366]/50 rounded-xl pl-9 pr-3 py-2 text-xs text-[#ECEDF7] placeholder-[#8A90B4]/60 focus:outline-none transition"
            />
          </div>
        </div>
        
        {/* Tab Header */}
        <div className="flex border-b border-[#262C4C]">
          <button onClick={() => setCommunityTab('my')}
            className={`flex-1 py-2.5 text-xs font-bold transition ${communityTab === 'my' ? 'text-[#25D366] border-b-2 border-[#25D366]' : 'text-[#8A90B4] hover:text-[#ECEDF7]'}`}>
            My Communities {joinedCommunities.length > 0 && `(${joinedCommunities.length})`}
          </button>
          <button onClick={() => setCommunityTab('discover')}
            className={`flex-1 py-2.5 text-xs font-bold transition ${communityTab === 'discover' ? 'text-[#8B7CFF] border-b-2 border-[#8B7CFF]' : 'text-[#8A90B4] hover:text-[#ECEDF7]'}`}>
            Discover
          </button>
        </div>

        {/* Communities List */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#262C4C]/40">
          {communityTab === 'my' && (
            filteredCourses.filter(c => joinedCommunities.includes(c.id) || c.educator_id === user?.id).length === 0 ? (
              <div className="p-6 text-center text-xs text-[#8A90B4]">
                No communities joined yet. Switch to Discover tab to find communities.
              </div>
            ) : (
              filteredCourses
                .filter(c => joinedCommunities.includes(c.id) || c.educator_id === user?.id)
                .map((c) => {
                  const isSelected = c.id === activeCourse.id;
                  const isOwner = (c.educator_id === user?.id) || isEducator;

                  return (
                    <div
                      key={c.id}
                      onClick={() => {
                        setSelectedCourseId(c.id);
                        if (onSelectCourse) onSelectCourse(c.id);
                      }}
                      className={`p-3.5 flex items-start gap-3 cursor-pointer transition relative group ${
                        isSelected
                          ? 'bg-[#171C36] text-[#ECEDF7]'
                          : 'hover:bg-[#171C36]/50 text-[#8A90B4]'
                      }`}
                    >
                      {/* Active Green Indicator */}
                      {isSelected && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#25D366] rounded-r" />
                      )}

                      {/* Community Avatar Badge */}
                      <div
                        className={`h-11 w-11 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 border shadow-sm ${
                          isSelected
                            ? 'bg-[#25D366]/20 border-[#25D366]/50 text-[#25D366]'
                            : 'bg-[#171C36] border-[#262C4C] text-[#8A90B4]'
                        }`}
                      >
                        {c.code ? c.code.slice(0, 3) : 'CS'}
                      </div>

                      {/* Community Meta Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <h4 className="text-xs font-bold text-[#ECEDF7] truncate">
                            {c.title}
                          </h4>
                          {isOwner && (
                            <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 shrink-0">
                              Owner
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-[#8A90B4] truncate leading-tight">
                          {c.code ? `${c.code} • ` : ''}
                          📢 Announcements & Discussion active
                        </p>
                      </div>
                    </div>
                  );
                })
            )
          )}

          {communityTab === 'discover' && (
            filteredCourses.filter(c => !joinedCommunities.includes(c.id) && c.educator_id !== user?.id).length === 0 ? (
              <div className="p-6 text-center text-xs text-[#8A90B4]">
                You've joined all available communities!
              </div>
            ) : (
              filteredCourses
                .filter(c => !joinedCommunities.includes(c.id) && c.educator_id !== user?.id)
                .map((c) => (
                  <div key={c.id} className="p-4 flex flex-col gap-3 hover:bg-[#171C36]/30 border-b border-[#262C4C]/40">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-11 w-11 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 border shadow-sm bg-[#171C36] border-[#262C4C] text-[#8A90B4]">
                          {c.code ? c.code.slice(0, 3) : 'CS'}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-[#ECEDF7] truncate">{c.title}</h4>
                          <span className="text-[10px] font-semibold text-[#8B7CFF]">{c.code}</span>
                          {c.educator_name && (
                            <p className="text-[10px] text-[#8A90B4] truncate mt-0.5">By {c.educator_name}</p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleJoinCommunity(c.id);
                          setCommunityTab('my');
                          setSelectedCourseId(c.id);
                          if (onSelectCourse) onSelectCourse(c.id);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-[#0A0D1C] text-xs font-bold transition flex items-center gap-1 shadow-md shadow-[#25D366]/20 shrink-0"
                      >
                        Join
                      </button>
                    </div>
                  </div>
                ))
            )
          )}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* RIGHT MAIN AREA: WhatsApp Community Channel Feed & Owner Controls    */}
      {/* ===================================================================== */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#0A0D1C] relative">
        {/* Top Community Header */}
        <div className="h-16 border-b border-[#262C4C] px-5 sm:px-6 flex items-center justify-between bg-[#12162B] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-[#25D366]/15 border border-[#25D366]/30 flex items-center justify-center text-[#25D366] font-bold text-xs shrink-0">
              {activeCourse.code || 'CS'}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-heading text-sm sm:text-base font-bold text-[#ECEDF7] truncate">
                  {activeCourse.title}
                </h3>
                {isCommunityOwner && (
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 shrink-0">
                    👑 Community Owner
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#8A90B4] truncate">
                {activeCourse.educator_name ? `Owner: ${activeCourse.educator_name} • ` : ''}
                {isCurrentJoined ? 'Joined Community' : 'Preview Mode'}
              </p>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-2">
            {/* Join / Leave Community Toggle (for non-owners) */}
            {!isCommunityOwner && (
              isCurrentJoined ? (
                <button
                  type="button"
                  onClick={() => handleLeaveCommunity(activeCourse.id)}
                  className="px-3 py-1.5 rounded-xl bg-[#171C36] hover:bg-red-950/40 text-[#8A90B4] hover:text-red-300 border border-[#262C4C] hover:border-red-500/30 text-xs font-semibold transition"
                  title="Leave this course community"
                >
                  Leave
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleJoinCommunity(activeCourse.id)}
                  className="px-4 py-1.5 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-[#0A0D1C] text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-[#25D366]/20"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Join Community</span>
                </button>
              )
            )}

            {/* STRICT OWNER ONLY TOOLS: Manage Members & Close Community */}
            {isCommunityOwner && (
              <>
                <button
                  type="button"
                  onClick={handleOpenMembers}
                  className="px-3 py-1.5 rounded-xl bg-[#171C36] hover:bg-[#202747] text-[#ECEDF7] border border-[#262C4C] hover:border-[#8B7CFF]/40 text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                  title="View full roster of joined members and moderate cohort"
                >
                  <Users className="h-3.5 w-3.5 text-[#8B7CFF]" />
                  <span>Members</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowCloseModal(true)}
                  className="p-2 rounded-xl bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-500/30 hover:border-red-500/50 transition shadow-sm"
                  title="Close and permanently delete this community"
                >
                  <Trash2 className="h-4 w-4 text-red-400" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* WhatsApp Channel Switcher Tabs (Announcements vs. Discussion) */}
        <div className="h-11 border-b border-[#262C4C] bg-[#171C36]/50 px-5 flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setActiveChannelName('announcements')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              activeChannelName === 'announcements'
                ? 'bg-[#25D366]/15 text-[#25D366] border border-[#25D366]/30'
                : 'text-[#8A90B4] hover:text-[#ECEDF7]'
            }`}
          >
            <Megaphone className="h-3.5 w-3.5" />
            <span>📢 Announcements</span>
            <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-[#12162B] text-[#8A90B4]">
              Owner Only
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveChannelName('discussion')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              activeChannelName === 'discussion'
                ? 'bg-[#8B7CFF]/15 text-[#8B7CFF] border border-[#8B7CFF]/30'
                : 'text-[#8A90B4] hover:text-[#ECEDF7]'
            }`}
          >
            <MessageCircle className="h-3.5 w-3.5" />
            <span>💬 Discussion & Doubts</span>
          </button>
        </div>

        {/* ===================================================================== */}
        {/* GATE: IF STUDENT IS NOT JOINED, SHOW JOIN PROMPT BANNER               */}
        {/* ===================================================================== */}
        {!isCurrentJoined ? (
          <div className="flex-1 flex items-center justify-center p-6 text-center">
            <div className="max-w-md bg-[#12162B] border border-[#262C4C] rounded-2xl p-8 space-y-5 shadow-2xl">
              <div className="h-16 w-16 rounded-2xl bg-[#25D366]/15 border border-[#25D366]/30 flex items-center justify-center text-[#25D366] mx-auto shadow-lg shadow-[#25D366]/10">
                <Lock className="h-8 w-8" />
              </div>
              <div className="space-y-2">
                <h3 className="font-heading text-lg font-bold text-[#ECEDF7]">
                  Join {activeCourse.title} Community
                </h3>
                <p className="text-xs text-[#8A90B4] leading-relaxed">
                  You are not currently a member of this course community. Join to receive official announcements directly from the educator and participate in peer doubt discussions.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleJoinCommunity(activeCourse.id)}
                className="w-full py-2.5 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-[#0A0D1C] font-bold text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-[#25D366]/20"
              >
                <Plus className="h-4 w-4" />
                <span>Join Community Now</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              {currentChannelMessages.length > 0 ? (
                currentChannelMessages.map((m) => {
                  const isOwnerMsg = m.is_owner || m.author_role === 'EDUCATOR';
                  const isMe = m.author_name === user?.full_name;

                  return (
                    <div
                      key={m.id}
                      className={`p-4 rounded-2xl border transition-all max-w-2xl ${
                        isOwnerMsg
                          ? 'bg-gradient-to-r from-[#25D366]/10 via-[#12162B] to-[#12162B] border-[#25D366]/35 shadow-md shadow-[#25D366]/5'
                          : 'bg-[#12162B] border-[#262C4C]'
                      }`}
                    >
                      {/* Message Author Header */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div
                            className={`h-7 w-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                              isOwnerMsg
                                ? 'bg-[#25D366] text-[#0A0D1C]'
                                : 'bg-[#8B7CFF]/20 text-[#8B7CFF]'
                            }`}
                          >
                            {m.author_name ? m.author_name.charAt(0) : 'U'}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs text-[#ECEDF7]">
                              {m.author_name}
                            </span>
                            {isOwnerMsg && (
                              <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/30">
                                👑 Owner
                              </span>
                            )}
                          </div>
                        </div>

                        <span className="text-[10px] text-[#8A90B4]">{m.created_at}</span>
                      </div>

                      {/* Content */}
                      <p className="text-xs text-[#ECEDF7] leading-relaxed whitespace-pre-wrap pl-9">
                        {m.content}
                      </p>

                      {/* Message Footer: Reactions / Upvotes */}
                      <div className="mt-3 pl-9 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleUpvote(m.id)}
                          className="px-2.5 py-1 rounded-lg bg-[#171C36] hover:bg-[#202747] border border-[#262C4C] hover:border-[#25D366]/40 text-[#8A90B4] hover:text-[#25D366] text-[11px] font-semibold transition flex items-center gap-1.5"
                        >
                          <ThumbsUp className="h-3 w-3" />
                          <span>{m.upvotes || 0}</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-12 text-[#8A90B4] text-xs">
                  No messages posted in this channel yet.
                </div>
              )}
            </div>

            {/* Bottom Message Input Bar */}
            <div className="p-3 sm:p-4 border-t border-[#262C4C] bg-[#12162B]">
              {/* WhatsApp Rule: If in announcements and user is not owner, show read-only notice */}
              {activeChannelName === 'announcements' && !isCommunityOwner ? (
                <div className="p-3 rounded-xl bg-[#171C36] border border-[#262C4C] text-center text-xs text-[#8A90B4] flex items-center justify-center gap-2">
                  <Lock className="h-3.5 w-3.5 text-[#25D366]" />
                  <span>Only the Community Owner can post announcements. Switch to Discussion to ask questions.</span>
                </div>
              ) : (
                <form onSubmit={handlePost} className="flex gap-2">
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder={
                      activeChannelName === 'announcements'
                        ? 'Broadcast an official announcement to all joined students...'
                        : 'Ask a doubt or share notes with peers...'
                    }
                    className="flex-1 bg-[#171C36] border border-[#262C4C] focus:border-[#25D366]/60 rounded-xl px-4 py-2.5 text-xs text-[#ECEDF7] placeholder-[#8A90B4]/60 focus:outline-none transition"
                  />
                  <button
                    type="submit"
                    disabled={!inputMessage.trim()}
                    className="px-4 py-2 rounded-xl bg-[#25D366] hover:bg-[#20ba59] disabled:opacity-40 text-[#0A0D1C] text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-[#25D366]/20"
                  >
                    <span>Send</span>
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </form>
              )}
            </div>
          </>
        )}
      </div>

      {/* ===================================================================== */}
      {/* OWNER ONLY: ROSTER MANAGEMENT MODAL & KICK PARTICIPANTS               */}
      {/* ===================================================================== */}
      {showMembersModal && isCommunityOwner && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-lg bg-[#12162B] border border-[#262C4C] rounded-2xl p-6 shadow-2xl relative space-y-4">
            <button
              type="button"
              onClick={() => setShowMembersModal(false)}
              className="absolute top-4 right-4 p-1 rounded-lg text-[#8A90B4] hover:text-[#ECEDF7] hover:bg-[#171C36] transition"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-[#8B7CFF]/15 border border-[#8B7CFF]/30 flex items-center justify-center text-[#8B7CFF]">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-heading text-base font-bold text-[#ECEDF7]">
                  Community Members Roster
                </h3>
                <p className="text-xs text-[#8A90B4]">
                  Owner Privacy View • {memberRoster.length} Members Enrolled
                </p>
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto divide-y divide-[#262C4C] pt-2">
              {loadingMembers ? (
                <div className="p-4 text-center text-xs text-[#8A90B4]">Loading members...</div>
              ) : (
                memberRoster.map((m) => (
                  <div key={m.user_id} className="py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-8 w-8 rounded-lg bg-[#171C36] border border-[#262C4C] flex items-center justify-center text-xs font-bold text-[#ECEDF7]">
                        {m.full_name?.charAt(0) || 'U'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-[#ECEDF7] truncate">{m.full_name}</span>
                          {m.is_owner && (
                            <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                              Owner
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-[#8A90B4] truncate block">{m.email}</span>
                      </div>
                    </div>

                    {!m.is_owner && (
                      <button
                        type="button"
                        onClick={() => handleKickMember(m.user_id)}
                        className="px-2.5 py-1 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-500/30 hover:border-red-500/50 text-xs font-semibold transition flex items-center gap-1 shrink-0"
                        title="Kick out this member"
                      >
                        <UserX className="h-3 w-3" />
                        <span>Kick Out</span>
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-[#262C4C] flex justify-end">
              <button
                type="button"
                onClick={() => setShowMembersModal(false)}
                className="px-4 py-2 rounded-xl bg-[#171C36] hover:bg-[#202747] text-xs font-bold text-[#ECEDF7] border border-[#262C4C] transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* OWNER ONLY: CLOSE COMMUNITY CONFIRMATION MODAL ("delete" check)       */}
      {/* ===================================================================== */}
      {showCloseModal && isCommunityOwner && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-md bg-[#12162B] border border-red-500/30 rounded-2xl p-6 shadow-2xl space-y-5">
            <div className="flex items-start gap-3.5">
              <div className="h-11 w-11 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-heading text-lg font-bold text-[#ECEDF7]">
                  Close Community Forever
                </h3>
                <p className="text-xs text-[#8A90B4] mt-0.5">
                  {activeCourse.title}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-500/30 text-xs text-red-200 leading-relaxed">
              This action is permanent and irreversible. All announcements, discussion threads, and student connections in this community will be lost forever.
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-[#8A90B4]">
                Type <span className="text-red-400 font-mono font-bold bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">delete</span> below to confirm closing:
              </label>
              <input
                type="text"
                autoFocus
                value={closeConfirmText}
                onChange={(e) => setCloseConfirmText(e.target.value)}
                placeholder='Type "delete"'
                className="w-full bg-[#171C36] border border-[#262C4C] focus:border-red-500/60 rounded-xl px-3.5 py-2.5 text-sm text-[#ECEDF7] font-mono focus:outline-none transition"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowCloseModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#8A90B4] hover:text-[#ECEDF7] hover:bg-[#171C36] transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCloseCommunityConfirm}
                disabled={closeConfirmText.trim().toLowerCase() !== 'delete' || isClosing}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                  closeConfirmText.trim().toLowerCase() === 'delete' && !isClosing
                    ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/30 cursor-pointer'
                    : 'bg-[#171C36] text-[#8A90B4]/40 border border-[#262C4C] cursor-not-allowed'
                }`}
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>{isClosing ? 'Closing...' : 'Close Community Forever'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
