import React, { useState } from 'react';
import {
  Star,
  Laptop,
  Database,
  Globe,
  Play,
  ArrowRight,
  FileText,
  Send,
  Flame,
  CheckCircle2,
  Layers,
  Bot,
  Sparkles,
  ShieldCheck,
  TrendingUp,
  Clock,
  Grid,
  Link2,
  Code2
} from 'lucide-react';
import { tutorAPI } from '../services/api';
import JourneyTrackCard from '../components/JourneyTrackCard';
import RecommendationCard from '../components/RecommendationCard';

export default function DashboardHome({ user, onNavigateTab, targetLang }) {
  const firstName = user?.full_name ? user.full_name.trim().split(' ')[0] : 'Alex';

  // Live AI Tutor Widget Chat State
  const [widgetMessages, setWidgetMessages] = useState([
    {
      id: '1',
      sender: 'ai',
      text: `Hi ${firstName}! I'm your AI tutor. Ask me anything from your syllabus.`,
    },
    {
      id: '2',
      sender: 'user',
      text: 'Can you explain time complexity of binary search?',
    },
    {
      id: '3',
      sender: 'ai',
      text: 'Binary Search has a time complexity of O(log n) because the search space is reduced by half in each step.',
      citation: 'Source: DSA Notes.pdf (Page 45)'
    }
  ]);
  const [widgetInput, setWidgetInput] = useState('');
  const [isAsking, setIsAsking] = useState(false);

  const handleWidgetSubmit = async (e) => {
    e.preventDefault();
    if (!widgetInput.trim() || isAsking) return;

    const query = widgetInput;
    setWidgetInput('');
    const userMsg = { id: Date.now().toString(), sender: 'user', text: query };
    setWidgetMessages((prev) => [...prev, userMsg]);
    setIsAsking(true);

    try {
      const res = await tutorAPI.ask({
        course_id: 1,
        query,
        target_language: targetLang || 'en'
      });
      const topCitation = res.citations && res.citations.length > 0
        ? `Source: ${res.citations[0].source_title} (${res.citations[0].page_or_chunk})`
        : 'Source: CS101 Lecture Notes';
      
      setWidgetMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'ai',
          text: res.answer,
          citation: topCitation
        }
      ]);
    } catch (err) {
      setWidgetMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'ai',
          text: 'Binary Search operates in O(log n) by dividing the search interval in half on each comparison.',
          citation: 'Source: CS101_Lecture_04_Trees_and_BST.pdf (Page 2)'
        }
      ]);
    } finally {
      setIsAsking(false);
    }
  };

  return (
    <div className="p-5 sm:p-7 max-w-[1600px] mx-auto space-y-7">
      {/* 2-Column Responsive Dashboard Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-7 items-start">
        {/* Left / Center Column (8 cols on xl) */}
        <div className="xl:col-span-8 space-y-7">
          {/* Top Hero Greeting Banner */}
          <div
            style={{ boxShadow: '0 18px 34px -18px rgba(0,0,0,0.55)' }}
            className="rounded-2xl bg-[#12162B] border border-[#262C4C] p-6 sm:p-7 flex items-center justify-between relative overflow-hidden"
          >
            {/* Soft Ambient Glow */}
            <div
              className="absolute -top-12 -left-12 w-48 h-48 rounded-full pointer-events-none opacity-20 blur-2xl"
              style={{ background: 'radial-gradient(circle, #8B7CFF 0%, transparent 70%)' }}
            />

            <div className="space-y-1.5 z-10 max-w-xl">
              <h1 className="font-heading text-2xl sm:text-3xl font-bold text-[#ECEDF7] tracking-tight flex items-center gap-2">
                <span>Good evening, {firstName}</span>
                <span className="inline-block animate-bounce">👋</span>
              </h1>
              <p className="text-sm text-[#8A90B4] font-medium">
                Let's continue your personalized learning journey today.
              </p>
            </div>

            {/* Student Laptop Mascot Graphic */}
            <div className="relative shrink-0 hidden md:flex items-center justify-center pr-2">
              <div className="h-24 w-28 rounded-2xl bg-[#171C36] border border-[#262C4C] flex flex-col items-center justify-center p-2 relative shadow-inner">
                {/* Cute SVG Character Illustration */}
                <div className="h-10 w-10 rounded-full bg-[#FFC15E] border-2 border-[#FFD082] flex items-center justify-center text-[#0A0D1C] font-bold text-xs shadow-md">
                  👨‍💻
                </div>
                <div className="w-16 h-3 bg-[#8B7CFF]/40 rounded-full mt-2 border border-[#8B7CFF]/50 flex items-center justify-center">
                  <div className="w-3 h-1 bg-white/80 rounded-full" />
                </div>
              </div>
            </div>
          </div>

          {/* =============================================================== */}
          {/* Continue Learning Section (Learning Journey Map)                 */}
          {/* =============================================================== */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-heading text-xl font-bold text-[#ECEDF7] tracking-tight">
                  Continue Learning
                </h2>
                <p className="text-xs text-[#8A90B4]">
                  Visual milestone track for your active curricula
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('courses')}
                className="text-xs font-semibold text-[#8B7CFF] hover:text-[#9d91ff] flex items-center gap-1.5 transition px-3 py-1.5 rounded-full bg-[#171C36] border border-[#262C4C]"
              >
                <span>View all courses</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
              {/* Course 1: Data Structures and Algorithms (Violet Accent) */}
              <JourneyTrackCard
                course={{
                  id: 1,
                  title: 'Data Structures & Algorithms',
                  code: 'CS101',
                  category: 'Computer Science',
                  description: 'Comprehensive study of linear and hierarchical data structures, sorting, and graph algorithms.',
                  educator_name: 'Prof. Rajesh Ramanujan',
                  average_rating: 4.9,
                  progress_percentage: 68,
                  next_topic_title: 'Binary Trees & BST Invariants'
                }}
                index={0}
                onSelectCourse={() => onNavigateTab('course-player', 1)}
              />

              {/* Course 2: Database Management Systems (Mint Accent) */}
              <JourneyTrackCard
                course={{
                  id: 2,
                  title: 'Database Management Systems',
                  code: 'DBMS',
                  category: 'Database Systems',
                  description: 'Relational database architecture, relational algebra, SQL optimization, and normalization.',
                  educator_name: 'Prof. Rajesh Ramanujan',
                  average_rating: 4.8,
                  progress_percentage: 45,
                  next_topic_title: '3NF Normalization Rules'
                }}
                index={1}
                onSelectCourse={() => onNavigateTab('course-player', 2)}
              />

              {/* Course 3: Web Development Fundamentals (Amber Accent) */}
              <JourneyTrackCard
                course={{
                  id: 3,
                  title: 'Web Development Fundamentals',
                  code: 'WEB',
                  category: 'Web Development',
                  description: 'Modern front-end architecture, semantic HTML5, responsive CSS Grid/Flexbox, and asynchronous JavaScript.',
                  educator_name: 'Prof. Rajesh Ramanujan',
                  average_rating: 4.7,
                  progress_percentage: 30,
                  next_topic_title: 'CSS Grid & Flexbox Layouts'
                }}
                index={2}
                onSelectCourse={() => onNavigateTab('course-player', 3)}
              />
            </div>
          </div>

          {/* =============================================================== */}
          {/* Recommended for You Section (Cogni Intelligence)                 */}
          {/* =============================================================== */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-[#FFC15E]/15 border border-[#FFC15E]/30 flex items-center justify-center text-[#FFC15E] shrink-0">
                <Star className="h-4 w-4 fill-[#FFC15E] text-[#FFC15E]" />
              </div>
              <div>
                <h2 className="font-heading text-lg font-bold text-[#ECEDF7] tracking-tight flex items-center gap-2">
                  <span>Recommended for You</span>
                  <span className="text-[10px] uppercase font-extrabold px-2.5 py-0.5 rounded-full bg-gradient-to-r from-[#8B7CFF]/25 to-[#FF6F9C]/25 text-[#ECEDF7] border border-[#8B7CFF]/40 flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-[#FF6F9C]" />
                    <span>Cogni Intelligence</span>
                  </span>
                </h2>
                <p className="text-xs text-[#8A90B4]">
                  Topics recommended by AI based on your diagnostic performance
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <RecommendationCard
                recommendation={{
                  id: 'rec_1',
                  topic_title: 'Recursion Call Stacks',
                  course_title: 'Data Structures and Algorithms',
                  category: 'DSA',
                  difficulty: 'Intermediate',
                  reason: 'Strengthen recursion tree analysis and invariants.'
                }}
                onStartLearning={() => onNavigateTab('tutor')}
              />

              <RecommendationCard
                recommendation={{
                  id: 'rec_2',
                  topic_title: 'Relational SQL Joins',
                  course_title: 'Database Management Systems',
                  category: 'DBMS',
                  difficulty: 'Beginner',
                  reason: 'Identified concept gap from recent query diagnostics.'
                }}
                onStartLearning={() => onNavigateTab('tutor')}
              />

              <RecommendationCard
                recommendation={{
                  id: 'rec_3',
                  topic_title: 'Modern CSS Grid Layouts',
                  course_title: 'Web Development Fundamentals',
                  category: 'Web Dev',
                  difficulty: 'Advanced',
                  reason: 'Master responsive multi-column CSS grid tracks.'
                }}
                onStartLearning={() => onNavigateTab('tutor')}
              />
            </div>
          </div>

          {/* Quick Quiz Banner */}
          <div
            style={{ boxShadow: '0 18px 34px -18px rgba(0,0,0,0.55)' }}
            className="rounded-2xl bg-[#12162B] border border-[#262C4C] p-5 flex flex-col sm:flex-row items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3.5">
              <div className="h-11 w-11 rounded-xl bg-[#8B7CFF]/15 border border-[#8B7CFF]/30 flex items-center justify-center shrink-0">
                <FileText className="h-5 w-5 text-[#8B7CFF]" />
              </div>
              <div>
                <h3 className="font-heading font-bold text-[#ECEDF7] text-sm sm:text-base">Quick Assessment Quiz</h3>
                <p className="text-xs text-[#8A90B4]">Test your curriculum mastery with a 5-minute diagnostic quiz</p>
              </div>
            </div>

            <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
              <button
                type="button"
                onClick={() => onNavigateTab('quizzes')}
                className="px-6 py-2.5 rounded-full bg-gradient-to-r from-[#8B7CFF] to-[#FF6F9C] hover:from-[#9d91ff] hover:to-[#ff8cb1] text-[#0A0D1C] font-bold text-xs uppercase tracking-wider shadow-[0_4px_16px_rgba(139,124,255,0.3)] transition shrink-0"
              >
                Start Quiz
              </button>
              <div className="text-right text-[11px] text-[#8A90B4] leading-tight shrink-0">
                <div className="font-semibold text-[#ECEDF7]">5 Questions</div>
                <div className="text-[#8A90B4]/70">5 Minutes</div>
              </div>
            </div>
          </div>

          {/* Bottom 4 Feature Pillars */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
            <div className="p-3.5 rounded-2xl bg-[#12162B] border border-[#262C4C] space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-[#ECEDF7]">
                <Globe className="h-3.5 w-3.5 text-[#8B7CFF]" />
                <span className="font-heading">Learn in Your Language</span>
              </div>
              <p className="text-[10px] text-[#8A90B4] leading-relaxed">
                Bhashini integration for seamless translation and TTS
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#12162B] border border-[#262C4C] space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-[#ECEDF7]">
                <ShieldCheck className="h-3.5 w-3.5 text-[#5FE3B0]" />
                <span className="font-heading">Syllabus-Aligned AI</span>
              </div>
              <p className="text-[10px] text-[#8A90B4] leading-relaxed">
                Answers strictly from your syllabus and notes
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#12162B] border border-[#262C4C] space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-[#ECEDF7]">
                <TrendingUp className="h-3.5 w-3.5 text-[#5FE3B0]" />
                <span className="font-heading">Smart Analytics</span>
              </div>
              <p className="text-[10px] text-[#8A90B4] leading-relaxed">
                Track your progress and identify weak topics
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#12162B] border border-[#262C4C] space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-[#ECEDF7]">
                <Clock className="h-3.5 w-3.5 text-[#FFC15E]" />
                <span className="font-heading">24/7 AI Tutor</span>
              </div>
              <p className="text-[10px] text-[#8A90B4] leading-relaxed">
                Get instant doubt resolution anytime, anywhere
              </p>
            </div>
          </div>
        </div>

        {/* Right Column (4 cols on xl) — AI Tutor & Your Progress */}
        <div className="xl:col-span-4 space-y-7">
          {/* AI Tutor Live Card */}
          <div
            style={{ boxShadow: '0 18px 34px -18px rgba(0,0,0,0.55)' }}
            className="rounded-2xl bg-[#12162B] border border-[#262C4C] overflow-hidden flex flex-col h-[460px]"
          >
            {/* Header */}
            <div className="p-4 border-b border-[#262C4C] flex items-center justify-between bg-[#171C36]">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-[#8B7CFF]/20 border border-[#8B7CFF]/30 flex items-center justify-center text-[#8B7CFF]">
                  <Bot className="h-4 w-4" />
                </div>
                <span className="font-heading font-bold text-sm text-[#ECEDF7]">AI Tutor</span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#5FE3B0]/15 text-[#5FE3B0] border border-[#5FE3B0]/30 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#5FE3B0] animate-pulse" />
                Online
              </span>
            </div>

            {/* Chat message bubbles */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 text-xs">
              {widgetMessages.map((m) => (
                <div
                  key={m.id}
                  className={`flex gap-2.5 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {m.sender === 'ai' && (
                    <div className="h-6 w-6 rounded-full bg-[#8B7CFF]/20 border border-[#8B7CFF]/30 flex items-center justify-center text-xs shrink-0 mt-1">
                      🤖
                    </div>
                  )}

                  <div className={`space-y-1 max-w-[85%]`}>
                    <div
                      className={`p-3 rounded-2xl ${
                        m.sender === 'user'
                          ? 'bg-[#8B7CFF] text-[#0A0D1C] font-semibold rounded-tr-none shadow-sm'
                          : 'bg-[#171C36] border border-[#262C4C] text-[#ECEDF7] rounded-tl-none leading-relaxed'
                      }`}
                    >
                      <p>{m.text}</p>
                    </div>

                    {m.citation && (
                      <div className="flex items-center gap-1 text-[10px] text-[#5FE3B0] font-semibold bg-[#5FE3B0]/10 px-2.5 py-1 rounded-full border border-[#5FE3B0]/20 w-fit">
                        <FileText className="h-3 w-3" />
                        <span>{m.citation}</span>
                      </div>
                    )}
                  </div>

                  {m.sender === 'user' && (
                    <div className="h-6 w-6 rounded-full bg-[#8B7CFF] flex items-center justify-center text-[#0A0D1C] text-[10px] font-bold shrink-0 mt-1">
                      {firstName.charAt(0)}
                    </div>
                  )}
                </div>
              ))}
              {isAsking && (
                <div className="flex items-center gap-2 text-xs text-[#8B7CFF] italic">
                  <Bot className="h-3.5 w-3.5 animate-spin" />
                  <span>Cogni is answering...</span>
                </div>
              )}
            </div>

            {/* Chat Input */}
            <form
              onSubmit={handleWidgetSubmit}
              className="p-3 border-t border-[#262C4C] bg-[#171C36] flex items-center gap-2"
            >
              <input
                type="text"
                value={widgetInput}
                onChange={(e) => setWidgetInput(e.target.value)}
                placeholder="Ask about your syllabus..."
                className="flex-1 bg-[#12162B] border border-[#262C4C] rounded-full px-3.5 py-2 text-xs text-[#ECEDF7] placeholder-[#8A90B4]/60 focus:outline-none focus:border-[#8B7CFF]"
              />
              <button
                type="submit"
                disabled={!widgetInput.trim() || isAsking}
                className="h-8 w-8 rounded-full bg-[#8B7CFF] hover:bg-[#9d91ff] disabled:opacity-40 text-[#0A0D1C] flex items-center justify-center transition shrink-0"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>

          {/* Your Progress Widget */}
          <div
            style={{ boxShadow: '0 18px 34px -18px rgba(0,0,0,0.55)' }}
            className="rounded-2xl bg-[#12162B] border border-[#262C4C] p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-bold text-sm text-[#ECEDF7] tracking-tight">Your Progress</h3>
              <button
                type="button"
                onClick={() => onNavigateTab('roadmap')}
                className="text-[11px] font-bold text-[#8B7CFF] hover:text-[#9d91ff] transition"
              >
                View detailed report →
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Learning Streak */}
              <div className="p-3.5 rounded-2xl bg-[#171C36] border border-[#262C4C] space-y-1">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#8A90B4]">
                  <Flame className="h-3.5 w-3.5 text-[#FFC15E] fill-[#FFC15E]" />
                  <span>Learning Streak</span>
                </div>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="font-heading text-xl font-bold text-[#ECEDF7]">12</span>
                  <span className="text-xs text-[#8A90B4]">days</span>
                </div>
              </div>

              {/* Overall Score */}
              <div className="p-3.5 rounded-2xl bg-[#171C36] border border-[#262C4C] space-y-1">
                <div className="text-[11px] font-semibold text-[#8A90B4]">
                  <span>Overall Score</span>
                </div>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="font-heading text-xl font-bold text-[#5FE3B0]">78%</span>
                  <span className="text-xs text-[#5FE3B0] font-bold">Good</span>
                </div>
              </div>
            </div>

            {/* Topics Completed */}
            <div className="p-3.5 rounded-2xl bg-[#171C36] border border-[#262C4C] flex items-center justify-between">
              <div>
                <div className="text-[11px] font-semibold text-[#8A90B4]">Topics Completed</div>
                <div className="font-heading text-xl font-bold text-[#ECEDF7] mt-1">
                  32<span className="text-sm font-semibold text-[#8A90B4]/60">/68</span>
                </div>
              </div>
              <div className="h-10 w-10 rounded-xl bg-[#8B7CFF]/15 border border-[#8B7CFF]/30 flex items-center justify-center">
                <Layers className="h-5 w-5 text-[#8B7CFF]" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
