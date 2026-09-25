import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  Sparkles,
  ShieldCheck,
  Video,
  FileText,
  Brain,
  Layers,
  Users,
  Award,
  ArrowRight,
  CheckCircle2,
  Play,
  FileCheck,
  Cpu,
  Lock,
  Zap,
  Globe,
  ChevronRight,
  ExternalLink,
  Code2,
  Database,
  Server,
  UserCheck,
  X,
  Compass,
  MessageSquare,
  BarChart3,
  HelpCircle,
  Clock,
  Mic,
  Maximize2
} from 'lucide-react';

export default function LandingPage({ onOpenLogin, onQuickLogin }) {
  const [activePreviewTab, setActivePreviewTab] = useState('course-player');
  const [showArchModal, setShowArchModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);

  // Smooth scroll helper
  const scrollToSection = (id) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 selection:bg-indigo-600 selection:text-white relative overflow-x-hidden">
      {/* Dynamic Background Ambient Light Gradients */}
      <div className="fixed top-0 left-1/4 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="fixed top-1/3 right-10 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="fixed bottom-10 left-10 w-[500px] h-[500px] bg-cyan-600/10 rounded-full blur-[140px] pointer-events-none -z-10" />

      {/* ========================================================================= */}
      {/* 1. HEADER & TOP NAVIGATION BAR */}
      {/* ========================================================================= */}
      <header className="sticky top-0 z-40 bg-[#0b0f19]/80 backdrop-blur-xl border-b border-[#1e2638]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Left: Brand Identity & SIH 2026 Badge */}
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-500 p-0.5 shadow-lg shadow-indigo-600/30 flex items-center justify-center">
              <div className="w-full h-full bg-[#0b0f19] rounded-[10px] flex items-center justify-center">
                <GraduationCap className="h-6 w-6 text-indigo-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black tracking-tight text-white">
                  COGNIPATH
                </span>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-gradient-to-r from-indigo-500/20 to-cyan-500/20 text-cyan-300 border border-cyan-500/30 tracking-wide uppercase">
                  SIH 2026 • AI Track
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium hidden sm:block">
                Problem Statement: SIH262070/500
              </p>
            </div>
          </div>

          {/* Center Navigation Links (Desktop) */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-300">
            <button
              onClick={() => scrollToSection('features')}
              className="hover:text-indigo-400 transition-colors"
            >
              Features
            </button>
            <button
              onClick={() => scrollToSection('ai-engine')}
              className="hover:text-indigo-400 transition-colors"
            >
              AI Tutor & Assessment
            </button>
            <button
              onClick={() => scrollToSection('learning-pods')}
              className="hover:text-indigo-400 transition-colors"
            >
              Learning Pods
            </button>
            <button
              onClick={() => scrollToSection('architecture')}
              className="hover:text-indigo-400 transition-colors"
            >
              Architecture
            </button>
          </nav>

          {/* Top-Right Action: Login / Get Started & Quick Demo Logins */}
          <div className="hidden sm:flex items-center gap-3">
            <button
              onClick={() => onQuickLogin('student@cognipath.edu', 'STUDENT')}
              className="px-3 py-1.5 rounded-lg bg-[#121826] hover:bg-[#1a2336] border border-[#1e2638] text-xs font-semibold text-slate-300 hover:text-white transition flex items-center gap-1.5"
              title="Quick demo access as Alex Kumar (Student)"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Student Demo</span>
            </button>

            <button
              onClick={() => onQuickLogin('teacher@cognipath.edu', 'EDUCATOR')}
              className="px-3 py-1.5 rounded-lg bg-[#121826] hover:bg-[#1a2336] border border-[#1e2638] text-xs font-semibold text-amber-300 hover:text-amber-200 transition flex items-center gap-1.5"
              title="Quick demo access as Prof. Ramanujan (Educator)"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Educator Demo</span>
            </button>

            <button
              onClick={() => setShowRoleModal(true)}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-indigo-600/30 hover:shadow-indigo-600/50 transition-all flex items-center gap-1.5"
            >
              <span>Get Started</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Mobile Hamburger Button */}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={() => setShowRoleModal(true)}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 text-xs font-bold text-white"
            >
              Login
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg bg-[#121826] border border-[#1e2638] text-slate-400"
            >
              <div className="w-5 h-4 flex flex-col justify-between">
                <span className="w-full h-0.5 bg-slate-300 rounded" />
                <span className="w-full h-0.5 bg-slate-300 rounded" />
                <span className="w-full h-0.5 bg-slate-300 rounded" />
              </div>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-[#121826] border-b border-[#1e2638] px-4 pt-3 pb-5 space-y-3">
            <button
              onClick={() => scrollToSection('features')}
              className="block w-full text-left text-sm font-semibold text-slate-300 py-1.5"
            >
              Features
            </button>
            <button
              onClick={() => scrollToSection('ai-engine')}
              className="block w-full text-left text-sm font-semibold text-slate-300 py-1.5"
            >
              AI Tutor & Assessment
            </button>
            <button
              onClick={() => scrollToSection('learning-pods')}
              className="block w-full text-left text-sm font-semibold text-slate-300 py-1.5"
            >
              Learning Pods
            </button>
            <button
              onClick={() => scrollToSection('architecture')}
              className="block w-full text-left text-sm font-semibold text-slate-300 py-1.5"
            >
              Architecture
            </button>
            <div className="pt-2 border-t border-[#1e2638] grid grid-cols-2 gap-2">
              <button
                onClick={() => onQuickLogin('student@cognipath.edu', 'STUDENT')}
                className="p-2 rounded-lg bg-[#1a2336] text-xs font-semibold text-center text-slate-200"
              >
                Student Demo
              </button>
              <button
                onClick={() => onQuickLogin('teacher@cognipath.edu', 'EDUCATOR')}
                className="p-2 rounded-lg bg-amber-500/10 text-xs font-semibold text-center text-amber-300 border border-amber-500/20"
              >
                Educator Demo
              </button>
            </div>
          </div>
        )}
      </header>

      {/* ========================================================================= */}
      {/* 2. HERO SECTION */}
      {/* ========================================================================= */}
      <section className="relative pt-16 pb-20 lg:pt-24 lg:pb-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center max-w-4xl mx-auto">
          {/* Eyebrow Pill */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/25 text-indigo-300 text-xs font-semibold mb-6 shadow-inner">
            <Sparkles className="h-3.5 w-3.5 text-indigo-400 animate-spin-slow" />
            <span>Smart India Hackathon 2026 Prototype • Full-Stack LMS</span>
          </div>

          {/* Hero Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-tight">
            Reimagining Education with{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400">
              Generative AI
            </span>
            , Adaptive Assessments &amp; Real-Time Collaboration
          </h1>

          {/* 2-Sentence Subheadline */}
          <p className="mt-6 text-base sm:text-lg text-slate-300 max-w-3xl mx-auto leading-relaxed font-normal">
            COGNIPATH unifies YouTube-curated hierarchical curricula, tamper-proof view-only lecture notes, and dual-mode RAG assessments with instant Gemini rubric grading. Experience seamless multi-peer WebRTC Learning Pods with strict educator host moderation in an all-in-one cognitive ecosystem.
          </p>

          {/* Dual CTAs */}
          <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => setShowRoleModal(true)}
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white font-extrabold text-sm uppercase tracking-wider shadow-xl shadow-indigo-600/30 hover:shadow-indigo-600/50 transition-all flex items-center justify-center gap-2 group"
            >
              <span>Explore Platform</span>
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </button>

            <button
              onClick={() => setShowArchModal(true)}
              className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-[#121826] hover:bg-[#1a2336] border border-[#1e2638] text-slate-200 hover:text-white font-bold text-sm transition-all flex items-center justify-center gap-2"
            >
              <Cpu className="h-4 w-4 text-cyan-400" />
              <span>Watch Architecture Breakdown</span>
            </button>
          </div>

          {/* Quick Metrics Bar */}
          <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto text-left">
            <div className="p-3.5 rounded-xl bg-[#121826]/70 border border-[#1e2638]">
              <div className="text-2xl font-black text-white">100%</div>
              <div className="text-xs text-slate-400 mt-0.5">Grounded RAG Accuracy</div>
            </div>
            <div className="p-3.5 rounded-xl bg-[#121826]/70 border border-[#1e2638]">
              <div className="text-2xl font-black text-indigo-400">&lt; 150ms</div>
              <div className="text-xs text-slate-400 mt-0.5">WebRTC Video Mesh Latency</div>
            </div>
            <div className="p-3.5 rounded-xl bg-[#121826]/70 border border-[#1e2638]">
              <div className="text-2xl font-black text-cyan-400">SHA-256</div>
              <div className="text-xs text-slate-400 mt-0.5">Tamper-Proof Credentials</div>
            </div>
            <div className="p-3.5 rounded-xl bg-[#121826]/70 border border-[#1e2638]">
              <div className="text-2xl font-black text-purple-400">Zero-Leak</div>
              <div className="text-xs text-slate-400 mt-0.5">Canvas View-Only DRM</div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* INTERACTIVE LIVE PRODUCT PREVIEW WIDGET */}
        {/* ========================================================================= */}
        <div className="mt-14 max-w-5xl mx-auto">
          <div className="rounded-2xl bg-[#121826] border border-[#1e2638] shadow-2xl overflow-hidden">
            {/* Widget Window Top Bar with Navigation Tabs */}
            <div className="px-4 py-3 bg-[#0e1320] border-b border-[#1e2638] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-rose-500/80" />
                <span className="w-3 h-3 rounded-full bg-amber-500/80" />
                <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
                <span className="text-xs font-mono text-slate-400 ml-2">cognipath-demo.app</span>
              </div>

              {/* Preview Mode Selector Pills */}
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#0b0f19] border border-[#1e2638]">
                <button
                  onClick={() => setActivePreviewTab('course-player')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    activePreviewTab === 'course-player'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Video className="h-3 w-3" />
                  <span>Course Player &amp; DRM</span>
                </button>
                <button
                  onClick={() => setActivePreviewTab('exam-studio')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    activePreviewTab === 'exam-studio'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Layers className="h-3 w-3" />
                  <span>Dual Exam Studio</span>
                </button>
                <button
                  onClick={() => setActivePreviewTab('ai-tutor')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    activePreviewTab === 'ai-tutor'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Brain className="h-3 w-3" />
                  <span>Socratic RAG Tutor</span>
                </button>
                <button
                  onClick={() => setActivePreviewTab('learning-pods')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    activePreviewTab === 'learning-pods'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Users className="h-3 w-3" />
                  <span>Learning Pods</span>
                </button>
              </div>
            </div>

            {/* Widget Stage Content */}
            <div className="p-4 sm:p-6 bg-[#0b0f19]/60 min-h-[360px] flex flex-col justify-center">
              {/* TAB 1: COURSE PLAYER & SECURE CANVAS DRM */}
              {activePreviewTab === 'course-player' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  {/* Left: Video & Canvas Viewer Mockup */}
                  <div className="lg:col-span-8 space-y-3">
                    <div className="aspect-video bg-black rounded-xl overflow-hidden border border-[#1e2638] relative flex items-center justify-center group shadow-inner">
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-10 pointer-events-none" />
                      <div className="text-center z-20">
                        <div className="h-14 w-14 rounded-full bg-indigo-600/90 hover:bg-indigo-500 text-white flex items-center justify-center mx-auto shadow-xl shadow-indigo-600/50 cursor-pointer transition transform group-hover:scale-110">
                          <Play className="h-6 w-6 ml-1 fill-white" />
                        </div>
                        <p className="text-xs font-bold text-slate-200 mt-2">
                          Stanford CS106B: Binary Search Trees Invariants
                        </p>
                        <span className="text-[10px] text-cyan-400 font-mono">
                          YouTube ID: qH6clASSS54 • 1080p Zero Latency
                        </span>
                      </div>
                    </div>

                    {/* Watermark DRM Notice */}
                    <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-500/30 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 text-cyan-300">
                        <Lock className="h-4 w-4" />
                        <span>
                          <strong>HTML5 Canvas DRM Active:</strong> Text select, right-click, and print disabled.
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                        Watermark: Aarav Sharma (ID: #ST-8921)
                      </span>
                    </div>
                  </div>

                  {/* Right: Course Hierarchy Tree */}
                  <div className="lg:col-span-4 bg-[#121826] border border-[#1e2638] rounded-xl p-3.5 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-[#1e2638]">
                      <span className="text-xs font-bold text-white uppercase tracking-wider">
                        Curriculum Hierarchy
                      </span>
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-bold">
                        3 Modules
                      </span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="p-2.5 rounded-lg bg-indigo-600/15 border border-indigo-500/30 text-indigo-200">
                        <div className="font-bold flex items-center justify-between">
                          <span>M1: Foundations of BSTs</span>
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        </div>
                        <div className="mt-1.5 pl-2 border-l border-indigo-500/40 text-[11px] text-slate-300 space-y-1">
                          <p className="flex items-center gap-1.5 text-white font-medium">
                            <Play className="h-2.5 w-2.5 text-cyan-400" /> 1.1 Invariants &amp; Lookup
                          </p>
                          <p className="flex items-center gap-1.5 text-slate-400">
                            <FileText className="h-2.5 w-2.5 text-purple-400" /> Lecture 04 Notes (PDF)
                          </p>
                        </div>
                      </div>

                      <div className="p-2.5 rounded-lg bg-[#0e1320] border border-[#1e2638] text-slate-400">
                        <div className="font-semibold">M2: AVL Balancing Rotations</div>
                        <span className="text-[10px] text-slate-500">2 Topics • 1 Exam</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: DUAL EXAM STUDIO */}
              {activePreviewTab === 'exam-studio' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Left Column: Active Exam Questions */}
                  <div className="bg-[#121826] border border-[#1e2638] rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-[#1e2638]">
                      <div>
                        <h4 className="text-xs font-bold text-white">Active Exam: CS101 Final</h4>
                        <p className="text-[10px] text-slate-400">Pass mark: 70% • 5 Questions</p>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        Drag-and-Drop Enabled
                      </span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="p-2.5 rounded-lg bg-[#0b0f19] border border-indigo-500/30 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-bold text-indigo-400">Q1 [Order 1]</span>
                          <p className="text-slate-200 font-medium">What is the worst-case search complexity of an un-balanced BST?</p>
                        </div>
                        <button className="text-rose-400 hover:text-rose-300 font-bold text-xs px-2 py-1 bg-rose-500/10 rounded">
                          - Drop
                        </button>
                      </div>

                      <div className="p-2.5 rounded-lg bg-[#0b0f19] border border-[#1e2638] flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-bold text-indigo-400">Q2 [Order 2]</span>
                          <p className="text-slate-200 font-medium">Which traversal yields sorted keys in a Binary Search Tree?</p>
                        </div>
                        <button className="text-rose-400 hover:text-rose-300 font-bold text-xs px-2 py-1 bg-rose-500/10 rounded">
                          - Drop
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Right Drawer: Dynamic Gemini RAG Suggestion Drawer */}
                  <div className="bg-gradient-to-br from-[#121826] to-[#151c2e] border border-purple-500/30 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-purple-500/20">
                      <div className="flex items-center gap-1.5 text-purple-300 font-bold text-xs">
                        <Sparkles className="h-4 w-4" />
                        <span>Gemini 3.5 AI Suggestion Drawer</span>
                      </div>
                      <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded font-mono">
                        RAG Grounded
                      </span>
                    </div>

                    <div className="p-3 rounded-lg bg-[#0b0f19] border border-purple-500/20 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-amber-400 font-bold uppercase">Hard • Bloom: Analysis</span>
                        <button className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1">
                          <span>+ Push to Exam</span>
                        </button>
                      </div>
                      <p className="text-slate-200">
                        In an AVL tree with balance factor +2 after left-child insertion, what rotation restores height invariant?
                      </p>
                      <p className="text-[10px] text-slate-400 italic">
                        Context source: CS101_Lecture_04_Trees.pdf (Chunk #2)
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: SOCRATIC AI TUTOR */}
              {activePreviewTab === 'ai-tutor' && (
                <div className="max-w-2xl mx-auto space-y-3">
                  <div className="p-3 rounded-xl bg-[#121826] border border-[#1e2638] flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                        <Brain className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-bold text-white">Socratic Context Tutor</div>
                        <div className="text-[10px] text-slate-400">Curriculum Grounded • Zero Hallucination Mode</div>
                      </div>
                    </div>
                    <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded font-mono">
                      ChromaDB Vectors
                    </span>
                  </div>

                  {/* Student Question */}
                  <div className="flex gap-2.5 text-xs justify-end">
                    <div className="p-3 rounded-2xl bg-indigo-600 text-white max-w-md shadow-md">
                      How does an AVL tree know when to perform a Double Left-Right (LR) rotation?
                    </div>
                  </div>

                  {/* AI Tutor Response with Citation & Socratic Probing */}
                  <div className="flex gap-2.5 text-xs">
                    <div className="p-3.5 rounded-2xl bg-[#121826] border border-purple-500/30 text-slate-200 max-w-lg space-y-2">
                      <p className="text-slate-100">
                        An <strong>LR rotation</strong> is triggered when the left subtree has a balance factor of <code className="bg-slate-900 px-1 py-0.5 rounded text-amber-300">+2</code> and the left child itself has a negative balance factor (<code className="bg-slate-900 px-1 py-0.5 rounded text-cyan-300">-1</code>).
                      </p>
                      <div className="p-2 rounded-lg bg-[#0b0f19] border border-[#1e2638] text-[11px] text-indigo-300 flex items-center gap-2">
                        <FileCheck className="h-3.5 w-3.5 text-emerald-400" />
                        <span>
                          <strong>Citation:</strong> Module 1 Lecture Notes (p. 4, § Invariant Violations)
                        </span>
                      </div>
                      <div className="p-2 rounded-lg bg-purple-950/30 border border-purple-500/20 text-[11px] text-purple-200">
                        <strong>Socratic Probe:</strong> What would happen to the in-order traversal ordering if you executed a single Left rotation instead of LR?
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: REAL-TIME COLLABORATIVE LEARNING PODS */}
              {activePreviewTab === 'learning-pods' && (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-[#121826] border border-[#1e2638] flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                      <span className="font-bold text-white">Pod #401: Algorithms Live Study Pod</span>
                      <span className="text-[10px] text-slate-400 hidden sm:inline">Passcode: ••••</span>
                    </div>
                    {/* Educator Quota Indicator */}
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="text-slate-400">Host Quota:</span>
                      <span className="text-indigo-400 font-bold bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                        1/3 Today • 1/12 Weekly
                      </span>
                    </div>
                  </div>

                  {/* Video Grid & Moderation HUD Mockup */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="aspect-video bg-[#0b0f19] rounded-xl border border-indigo-500/40 relative flex items-center justify-center p-2 text-center">
                      <div className="text-center">
                        <div className="h-10 w-10 rounded-full bg-indigo-600/30 border border-indigo-500 text-indigo-300 flex items-center justify-center mx-auto text-xs font-bold">
                          RR
                        </div>
                        <span className="text-xs font-bold text-white block mt-1">Prof. Ramanujan (Host)</span>
                        <span className="text-[9px] text-emerald-400 font-mono">1080p • 60fps</span>
                      </div>
                      <div className="absolute top-2 right-2 flex gap-1">
                        <span className="p-1 rounded bg-indigo-600 text-[10px] text-white">HOST</span>
                      </div>
                    </div>

                    <div className="aspect-video bg-[#0b0f19] rounded-xl border border-[#1e2638] relative flex items-center justify-center p-2 text-center">
                      <div className="text-center">
                        <div className="h-10 w-10 rounded-full bg-purple-600/30 border border-purple-500 text-purple-300 flex items-center justify-center mx-auto text-xs font-bold">
                          AK
                        </div>
                        <span className="text-xs font-bold text-white block mt-1">Alex Kumar (Student)</span>
                        <span className="text-[9px] text-slate-400 font-mono">WebRTC Active</span>
                      </div>
                      {/* Host Moderation Controls */}
                      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-center gap-1.5 opacity-90">
                        <button className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold border border-amber-500/30">
                          Mute
                        </button>
                        <button className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[9px] font-bold border border-rose-500/30">
                          Kick &amp; Blacklist
                        </button>
                      </div>
                    </div>

                    <div className="aspect-video bg-[#0b0f19] rounded-xl border border-[#1e2638] relative flex items-center justify-center p-2 text-center hidden sm:flex">
                      <div className="text-center">
                        <div className="h-10 w-10 rounded-full bg-cyan-600/30 border border-cyan-500 text-cyan-300 flex items-center justify-center mx-auto text-xs font-bold">
                          PP
                        </div>
                        <span className="text-xs font-bold text-white block mt-1">Priya Patel</span>
                        <span className="text-[9px] text-slate-400 font-mono">Whiteboard Pen</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. CORE FEATURE SHOWCASE GRID (5 USPs) */}
      {/* ========================================================================= */}
      <section id="features" className="py-20 bg-[#0e1320] border-y border-[#1e2638] relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-extrabold uppercase tracking-widest text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
              Architectural Highlights
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white mt-4 tracking-tight">
              Engineered for Deep Retention &amp; Integrity
            </h2>
            <p className="mt-3 text-slate-400 text-sm sm:text-base">
              Explore the five integrated pillars built specifically for the Smart India Hackathon educational standards.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* CARD 1: SMART COURSE ENGINE & SECURE CONTENT */}
            <div className="rounded-2xl bg-[#121826] border border-[#1e2638] p-6 hover:border-indigo-500/40 transition-all group flex flex-col justify-between">
              <div>
                <div className="h-12 w-12 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-5 group-hover:scale-105 transition-transform">
                  <Video className="h-6 w-6" />
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-bold text-white">Smart Course Engine &amp; DRM</h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                    Pillar 1
                  </span>
                </div>
                <p className="text-slate-400 text-xs leading-relaxed mb-4">
                  Multi-tiered hierarchical curriculum structure supporting zero-latency video delivery and high-security document rights management.
                </p>
                <ul className="space-y-2 text-xs text-slate-300">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Hierarchical Structure:</strong> Courses &rarr; Modules &rarr; Topics with regex YouTube ID extraction.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>View-Only Canvas DRM:</strong> In-browser PDF notes viewer with text select, right-click, and print disabled.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Dynamic Watermarking:</strong> Personal student identifier grid rendered directly onto the HTML5 canvas.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Verifiable Credentials:</strong> SHA-256 digital completion badges with public ledger verification.</span>
                  </li>
                </ul>
              </div>
              <div className="mt-5 pt-4 border-t border-[#1e2638] flex items-center justify-between text-[11px] text-slate-400">
                <span>Native YouTube Iframe</span>
                <span className="text-indigo-400 font-bold">Zero Storage Cost</span>
              </div>
            </div>

            {/* CARD 2: DUAL-ENGINE ASSESSMENT SUITE */}
            <div className="rounded-2xl bg-[#121826] border border-[#1e2638] p-6 hover:border-purple-500/40 transition-all group flex flex-col justify-between">
              <div>
                <div className="h-12 w-12 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-5 group-hover:scale-105 transition-transform">
                  <Layers className="h-6 w-6" />
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-bold text-white">Dual-Engine Assessment Suite</h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">
                    Pillar 2
                  </span>
                </div>
                <p className="text-slate-400 text-xs leading-relaxed mb-4">
                  Blends educator exam crafting with dynamic, curriculum-grounded AI question suggestions and celebratory test-taking.
                </p>
                <ul className="space-y-2 text-xs text-slate-300">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Two-Column Builder:</strong> Left-column active exam with Right-drawer AI suggestion feed.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>1-Click Manipulation:</strong> <code>+</code> Push to exam, <code>-</code> Drop, and instant drag reordering.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>RAG Context Grounding:</strong> Questions pulled directly from indexed module PDF lecture chunks.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Confetti Auto-Scoring:</strong> Timed student test interface with instant scoring and certificate minting.</span>
                  </li>
                </ul>
              </div>
              <div className="mt-5 pt-4 border-t border-[#1e2638] flex items-center justify-between text-[11px] text-slate-400">
                <span>Bloom's Taxonomy Levels</span>
                <span className="text-purple-400 font-bold">Auto Badge Minting</span>
              </div>
            </div>

            {/* CARD 3: CONTEXT-AWARE AI TUTOR (RAG) */}
            <div id="ai-engine" className="rounded-2xl bg-[#121826] border border-[#1e2638] p-6 hover:border-cyan-500/40 transition-all group flex flex-col justify-between">
              <div>
                <div className="h-12 w-12 rounded-xl bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-5 group-hover:scale-105 transition-transform">
                  <Brain className="h-6 w-6" />
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-bold text-white">Context-Aware Socratic Tutor</h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300">
                    Pillar 3
                  </span>
                </div>
                <p className="text-slate-400 text-xs leading-relaxed mb-4">
                  RAG-powered conversational engine that guides students with exact textbook citations and Socratic inquiry.
                </p>
                <ul className="space-y-2 text-xs text-slate-300">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Strict Grounding:</strong> Resolves student doubts using ChromaDB embeddings of lecture notes.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Socratic Guidance:</strong> Formulates probing questions rather than dumping direct answers.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Curated Video Fallback:</strong> Recommends timestamped YouTube videos for abstract concepts.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Bhashini ULCA:</strong> Multilingual support across 10 Indian regional languages.</span>
                  </li>
                </ul>
              </div>
              <div className="mt-5 pt-4 border-t border-[#1e2638] flex items-center justify-between text-[11px] text-slate-400">
                <span>Google Gemini 3.5</span>
                <span className="text-cyan-400 font-bold">Zero Hallucination</span>
              </div>
            </div>

            {/* CARD 4: AI ASSIGNMENT AUTO-EVALUATION */}
            <div className="rounded-2xl bg-[#121826] border border-[#1e2638] p-6 hover:border-emerald-500/40 transition-all group flex flex-col justify-between">
              <div>
                <div className="h-12 w-12 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-5 group-hover:scale-105 transition-transform">
                  <FileCheck className="h-6 w-6" />
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-bold text-white">AI Assignment Auto-Evaluator</h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                    Pillar 4
                  </span>
                </div>
                <p className="text-slate-400 text-xs leading-relaxed mb-4">
                  Multi-criteria rubric scoring for descriptive student PDF submissions and technical text solutions.
                </p>
                <ul className="space-y-2 text-xs text-slate-300">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Criterion-by-Criterion Grading:</strong> Automatically maps student text to educator rubrics.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>PDF Text Extraction:</strong> Ingests typed solutions and assignment submissions via <code>pypdf</code>.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Actionable Feedback:</strong> Highlights concrete strengths, gaps, and targeted tips for improvement.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Gemini 3.5 Flash-Lite:</strong> High-speed reasoning with transparent evaluation summaries.</span>
                  </li>
                </ul>
              </div>
              <div className="mt-5 pt-4 border-t border-[#1e2638] flex items-center justify-between text-[11px] text-slate-400">
                <span>Weighted Rubric Matrix</span>
                <span className="text-emerald-400 font-bold">Instant Feedback</span>
              </div>
            </div>

            {/* CARD 5: LIVE COLLABORATIVE LEARNING PODS */}
            <div id="learning-pods" className="rounded-2xl bg-[#121826] border border-[#1e2638] p-6 hover:border-amber-500/40 transition-all group flex flex-col justify-between lg:col-span-2">
              <div>
                <div className="h-12 w-12 rounded-xl bg-amber-600/20 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-5 group-hover:scale-105 transition-transform">
                  <Users className="h-6 w-6" />
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-bold text-white">Live Collaborative Learning Pods</h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
                    Pillar 5
                  </span>
                </div>
                <p className="text-slate-400 text-xs leading-relaxed mb-4">
                  Multi-peer WebRTC video rooms paired with collaborative digital whiteboards, anti-abuse quotas, and Host Moderation HUD.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <ul className="space-y-2 text-xs text-slate-300">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span><strong>WebRTC Video Mesh:</strong> Low-latency peer-to-peer audio and video communication.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span><strong>Passcode Gate:</strong> Secure 4-digit room access codes with server authorization.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span><strong>Educator Pod Quotas:</strong> Strict limits (3 pods/day, 12 pods/week) to avoid resource exhaustion.</span>
                    </li>
                  </ul>
                  <ul className="space-y-2 text-xs text-slate-300">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span><strong>Host Moderation HUD:</strong> Remote mute, remote camera toggle, and 1-click Kick &amp; Blacklist.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span><strong>Collaborative Canvas:</strong> Real-time synchronized whiteboard for algorithmic sketching.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span><strong>Abuse Prevention:</strong> Expelled participants are permanently blacklisted by user ID and token.</span>
                    </li>
                  </ul>
                </div>
              </div>
              <div className="mt-5 pt-4 border-t border-[#1e2638] flex items-center justify-between text-[11px] text-slate-400">
                <span>WebSocket Signaling Gateway</span>
                <span className="text-amber-400 font-bold">Host Moderation Protocol</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. IMPACT & HACKATHON VALUE PROPOSITION SECTION */}
      {/* ========================================================================= */}
      <section id="architecture" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs font-extrabold uppercase tracking-widest text-cyan-400 bg-cyan-500/10 px-3 py-1 rounded-full border border-cyan-500/20">
            System Design &amp; Impact
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-white mt-4 tracking-tight">
            Addressing Key Challenges in Modern Digital Learning
          </h2>
          <p className="mt-3 text-slate-400 text-sm sm:text-base">
            How COGNIPATH bridges the gap between passive video streaming and active cognitive mastery.
          </p>
        </div>

        {/* 3 Value Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          <div className="p-6 rounded-2xl bg-[#121826] border border-[#1e2638] relative overflow-hidden">
            <div className="h-10 w-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-4">
              <Compass className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">Passive vs. Active Synthesis</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Standard LMS platforms rely on passive video watching without checks. COGNIPATH interleaves concept micro-quizzes, Socratic inquiry questions, and rubric-graded assignments at the point of ingestion.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#121826] border border-[#1e2638] relative overflow-hidden">
            <div className="h-10 w-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-4">
              <Lock className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">Academic DRM &amp; Integrity</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Educator lecture notes are protected through a sandboxed HTML5 canvas renderer with copy, print, and download prevention, backed by SHA-256 tamper-proof credential ledger hashing.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#121826] border border-[#1e2638] relative overflow-hidden">
            <div className="h-10 w-10 rounded-xl bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-4">
              <Zap className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">Scalable &amp; Token-Efficient</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Leverages ChromaDB vector indexing and Gemini 3.5 Flash-Lite with minimal token overhead. Educator pod creation quotas prevent cloud compute exhaustion.
            </p>
          </div>
        </div>

        {/* VISUAL ARCHITECTURE PIPELINE */}
        <div className="rounded-2xl bg-[#121826] border border-[#1e2638] p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#1e2638]">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>End-to-End System Pipeline</span>
                <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded font-mono">
                  Production Verified
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Dataflow architecture connecting ingestion, vector retrieval, LLM reasoning, and real-time mesh.
              </p>
            </div>
            <button
              onClick={() => setShowArchModal(true)}
              className="px-4 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 hover:text-white text-xs font-bold transition flex items-center gap-1.5 self-start sm:self-auto"
            >
              <span>Inspect Architecture Specs</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Flowchart Diagram */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4 relative">
            {/* Step 1 */}
            <div className="p-4 rounded-xl bg-[#0b0f19] border border-[#1e2638] space-y-2 relative">
              <div className="text-[10px] font-bold text-indigo-400 font-mono">STAGE 01</div>
              <h4 className="text-xs font-bold text-white">Course &amp; Resource Ingestion</h4>
              <p className="text-[11px] text-slate-400">
                Educators upload course syllabus and PDF notes. YouTube regex parser extracts high-res video streams.
              </p>
              <div className="pt-2 flex flex-wrap gap-1">
                <span className="text-[9px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">pypdf</span>
                <span className="text-[9px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">YouTube Embed</span>
              </div>
            </div>

            {/* Step 2 */}
            <div className="p-4 rounded-xl bg-[#0b0f19] border border-indigo-500/30 space-y-2 relative">
              <div className="text-[10px] font-bold text-purple-400 font-mono">STAGE 02</div>
              <h4 className="text-xs font-bold text-white">Semantic Chunking &amp; Vectors</h4>
              <p className="text-[11px] text-slate-400">
                Notes are split into 500-token chunks and embedded with Google Gemini embeddings into ChromaDB vector collections.
              </p>
              <div className="pt-2 flex flex-wrap gap-1">
                <span className="text-[9px] bg-purple-900/40 text-purple-300 px-1.5 py-0.5 rounded">gemini-embedding-001</span>
                <span className="text-[9px] bg-purple-900/40 text-purple-300 px-1.5 py-0.5 rounded">ChromaDB</span>
              </div>
            </div>

            {/* Step 3 */}
            <div className="p-4 rounded-xl bg-[#0b0f19] border border-cyan-500/30 space-y-2 relative">
              <div className="text-[10px] font-bold text-cyan-400 font-mono">STAGE 03</div>
              <h4 className="text-xs font-bold text-white">RAG Reasoner &amp; Rubrics</h4>
              <p className="text-[11px] text-slate-400">
                Gemini 3.5 Flash-Lite evaluates assignments against rubrics and suggests Bloom's taxonomy exam questions.
              </p>
              <div className="pt-2 flex flex-wrap gap-1">
                <span className="text-[9px] bg-cyan-900/40 text-cyan-300 px-1.5 py-0.5 rounded">gemini-3.5-flash-lite</span>
                <span className="text-[9px] bg-cyan-900/40 text-cyan-300 px-1.5 py-0.5 rounded">FastAPI</span>
              </div>
            </div>

            {/* Step 4 */}
            <div className="p-4 rounded-xl bg-[#0b0f19] border border-emerald-500/30 space-y-2 relative">
              <div className="text-[10px] font-bold text-emerald-400 font-mono">STAGE 04</div>
              <h4 className="text-xs font-bold text-white">Real-Time Mesh &amp; DRM Delivery</h4>
              <p className="text-[11px] text-slate-400">
                WebRTC mesh connects students in collaborative study pods with WebSocket signaling and canvas DRM protections.
              </p>
              <div className="pt-2 flex flex-wrap gap-1">
                <span className="text-[9px] bg-emerald-900/40 text-emerald-300 px-1.5 py-0.5 rounded">WebRTC</span>
                <span className="text-[9px] bg-emerald-900/40 text-emerald-300 px-1.5 py-0.5 rounded">HTML5 Canvas</span>
              </div>
            </div>
          </div>
        </div>

        {/* TECH STACK STRIP */}
        <div className="mt-12 text-center">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-6">
            Powered by Modern Enterprise &amp; Open-Source Technologies
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            <span className="px-3.5 py-2 rounded-xl bg-[#121826] border border-[#1e2638] text-xs font-semibold text-slate-300 flex items-center gap-2">
              <Server className="h-3.5 w-3.5 text-indigo-400" />
              <span>FastAPI (Python 3.12)</span>
            </span>
            <span className="px-3.5 py-2 rounded-xl bg-[#121826] border border-[#1e2638] text-xs font-semibold text-slate-300 flex items-center gap-2">
              <Code2 className="h-3.5 w-3.5 text-cyan-400" />
              <span>React 18 + Vite</span>
            </span>
            <span className="px-3.5 py-2 rounded-xl bg-[#121826] border border-[#1e2638] text-xs font-semibold text-slate-300 flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-purple-400" />
              <span>Google Gemini 3.5 Flash-Lite</span>
            </span>
            <span className="px-3.5 py-2 rounded-xl bg-[#121826] border border-[#1e2638] text-xs font-semibold text-slate-300 flex items-center gap-2">
              <Database className="h-3.5 w-3.5 text-emerald-400" />
              <span>ChromaDB Vector Store</span>
            </span>
            <span className="px-3.5 py-2 rounded-xl bg-[#121826] border border-[#1e2638] text-xs font-semibold text-slate-300 flex items-center gap-2">
              <Video className="h-3.5 w-3.5 text-rose-400" />
              <span>WebRTC Peer Mesh</span>
            </span>
            <span className="px-3.5 py-2 rounded-xl bg-[#121826] border border-[#1e2638] text-xs font-semibold text-slate-300 flex items-center gap-2">
              <Globe className="h-3.5 w-3.5 text-amber-400" />
              <span>Bhashini ULCA Multilingual</span>
            </span>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. ROLE SELECTION / AUTHENTICATION MODAL */}
      {/* ========================================================================= */}
      {showRoleModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#131927] border border-[#1e2638] rounded-2xl p-6 sm:p-8 shadow-2xl relative">
            <button
              onClick={() => setShowRoleModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="text-center mb-6">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-600 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-indigo-600/30">
                <GraduationCap className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white">Select Your Portal</h3>
              <p className="text-xs text-slate-400 mt-1">
                Choose a pre-configured demo account or sign in with custom credentials.
              </p>
            </div>

            {/* Quick Demo Logins */}
            <div className="space-y-3 mb-6">
              <button
                onClick={() => {
                  setShowRoleModal(false);
                  onQuickLogin('student@cognipath.edu', 'STUDENT');
                }}
                className="w-full p-4 rounded-xl bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/30 transition text-left flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-indigo-600/30 flex items-center justify-center text-indigo-300">
                    <GraduationCap className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white group-hover:text-indigo-300 transition">
                      Continue as Student Learner
                    </div>
                    <div className="text-[11px] text-slate-400">Alex Kumar (CS101 Enrolled)</div>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-indigo-400 group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                onClick={() => {
                  setShowRoleModal(false);
                  onQuickLogin('teacher@cognipath.edu', 'EDUCATOR');
                }}
                className="w-full p-4 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition text-left flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-amber-500/30 flex items-center justify-center text-amber-300">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white group-hover:text-amber-300 transition">
                      Continue as Course Educator
                    </div>
                    <div className="text-[11px] text-slate-400">Prof. Rajesh Ramanujan</div>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-amber-400 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            <div className="pt-4 border-t border-[#1e2638] text-center">
              <button
                onClick={() => {
                  setShowRoleModal(false);
                  onOpenLogin();
                }}
                className="text-xs font-semibold text-slate-400 hover:text-white transition"
              >
                Enter with custom email / register &rarr;
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. ARCHITECTURE BREAKDOWN MODAL */}
      {/* ========================================================================= */}
      {showArchModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-3xl max-h-[90vh] bg-[#121826] border border-[#1e2638] rounded-2xl p-6 sm:p-8 shadow-2xl overflow-y-auto relative space-y-6">
            <button
              onClick={() => setShowArchModal(false)}
              className="absolute top-5 right-5 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="h-5 w-5" />
            </button>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 bg-cyan-500/10 px-2.5 py-0.5 rounded border border-cyan-500/20">
                Technical Specification
              </span>
              <h2 className="text-2xl font-black text-white mt-2">
                COGNIPATH LMS Full-Stack Architecture
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Verified implementation details for Smart India Hackathon 2026 evaluators.
              </p>
            </div>

            <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
              <div className="p-4 rounded-xl bg-[#0b0f19] border border-[#1e2638]">
                <h4 className="font-bold text-white mb-1.5 flex items-center gap-2">
                  <Database className="h-4 w-4 text-indigo-400" />
                  <span>1. Database &amp; Vector Pipeline</span>
                </h4>
                <p>
                  Built with SQLAlchemy ORM over SQLite/PostgreSQL with automatic migration for hierarchical courses, modules, topics, module resources, and cryptographic completion badges. Documents are processed using <code>pypdf</code>, sectionally chunked, and embedded into local ChromaDB collections with Google Gemini Embedding-001.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#0b0f19] border border-[#1e2638]">
                <h4 className="font-bold text-white mb-1.5 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-400" />
                  <span>2. Dual-Engine Assessment &amp; Gemini Grading</span>
                </h4>
                <p>
                  Exams feature a two-column builder where educators drag-and-drop questions while querying the Gemini AI suggestion drawer. Suggestions read retrieved context chunks from course notes. Student assignment PDF submissions are parsed and graded criterion-by-criterion using Google Gemini 3.5 Flash-Lite against educator rubrics.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#0b0f19] border border-[#1e2638]">
                <h4 className="font-bold text-white mb-1.5 flex items-center gap-2">
                  <Lock className="h-4 w-4 text-cyan-400" />
                  <span>3. In-Browser Canvas DRM &amp; Anti-Leak Security</span>
                </h4>
                <p>
                  Protected course notes are rendered using an HTML5 canvas layer dynamically fetched via PDF.js. Right-click context menus are suppressed, text selection is blocked via CSS, print media queries blank out the document, and a dynamic diagonal watermark containing the student's name, email, and timestamp is permanently rendered on the canvas.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#0b0f19] border border-[#1e2638]">
                <h4 className="font-bold text-white mb-1.5 flex items-center gap-2">
                  <Users className="h-4 w-4 text-amber-400" />
                  <span>4. WebRTC Video Mesh &amp; Host Moderation HUD</span>
                </h4>
                <p>
                  Collaborative Learning Pods utilize peer-to-peer WebRTC mesh for video/audio combined with a real-time collaborative HTML5 whiteboard. Educators have daily (3) and weekly (12) creation quotas, 4-digit passcode protection, and host moderation tools to remotely mute, disable video, or kick and blacklist disruptive participants.
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-[#1e2638] flex items-center justify-between">
              <span className="text-[11px] text-slate-500 font-mono">Status: All 5 Pillars 100% Tested</span>
              <button
                onClick={() => {
                  setShowArchModal(false);
                  setShowRoleModal(true);
                }}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 text-white font-bold text-xs uppercase"
              >
                Launch Demo Portal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. FOOTER */}
      {/* ========================================================================= */}
      <footer className="bg-[#080c14] border-t border-[#1e2638] py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-slate-400">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold">
              <GraduationCap className="h-4 w-4" />
            </div>
            <div>
              <span className="font-black text-white text-sm">COGNIPATH</span>
              <p className="text-[11px] text-slate-500">
                Next-Gen AI-Powered LMS • Smart India Hackathon 2026
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-slate-400">
            <button onClick={() => scrollToSection('features')} className="hover:text-white transition">
              Features
            </button>
            <button onClick={() => scrollToSection('ai-engine')} className="hover:text-white transition">
              AI Tutor
            </button>
            <button onClick={() => scrollToSection('learning-pods')} className="hover:text-white transition">
              Learning Pods
            </button>
            <button onClick={() => setShowArchModal(true)} className="hover:text-white transition">
              Architecture Docs
            </button>
            <button onClick={() => setShowRoleModal(true)} className="hover:text-white transition">
              Sign In
            </button>
          </div>

          <div className="text-center md:text-right text-[11px] text-slate-500">
            <div>Problem Statement ID: <strong>SIH262070/500</strong></div>
            <div className="mt-0.5">© 2026 COGNIPATH Team. All rights reserved.</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
