import React, { useState, useEffect } from 'react';
import {
  Compass,
  Zap,
  Flame,
  Award,
  CheckCircle2,
  Clock,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  BookOpen,
  Video,
  MessageSquare,
  Sparkles
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { roadmapAPI } from '../services/api';

export default function LearningRoadmapView({ courseId, onNavigateTab }) {
  const [roadmap, setRoadmap] = useState({
    total_xp: 480,
    streak_days: 3,
    current_level: "Level 4: Algorithmic Explorer",
    skills: [
      { topic: "Binary Search Trees", mastery_percentage: 45.0, status: "AT_RISK", review_due: true },
      { topic: "Tree Invariants & Rotations", mastery_percentage: 42.0, status: "AT_RISK", review_due: true },
      { topic: "Transformer Attention Mechanism", mastery_percentage: 78.5, status: "IN_PROGRESS", review_due: false },
      { topic: "Asymptotic Complexity (Big-O)", mastery_percentage: 85.0, status: "MASTERED", review_due: false },
      { topic: "Graph Traversal (BFS & DFS)", mastery_percentage: 90.0, status: "MASTERED", review_due: false }
    ],
    next_best_actions: [
      {
        id: "act_1",
        title: "Review 5-Min Concept Note: Unbalanced BST Degeneracy",
        topic: "Binary Search Trees",
        action_type: "READ_RECAP",
        estimated_mins: 5,
        xp_reward: 35,
        is_completed: false,
        action_url_target: "tutor"
      },
      {
        id: "act_2",
        title: "Retake 2-Question SM-2 Retention Micro-Quiz",
        topic: "Tree Invariants & Rotations",
        action_type: "RETRY_QUIZ",
        estimated_mins: 4,
        xp_reward: 50,
        is_completed: false,
        action_url_target: "quizzes"
      },
      {
        id: "act_3",
        title: "Join Live Learning Pod: Tree Traversal Peer Discussion",
        topic: "Binary Search Trees",
        action_type: "WATCH_POD",
        estimated_mins: 12,
        xp_reward: 75,
        is_completed: false,
        action_url_target: "pods"
      },
      {
        id: "act_4",
        title: "Share a Tree Traversal Doubt in #doubts-and-qa",
        topic: "Community Engagement",
        action_type: "PRACTICE_PROBLEMS",
        estimated_mins: 3,
        xp_reward: 25,
        is_completed: false,
        action_url_target: "community"
      }
    ]
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchRoadmap();
  }, [courseId]);

  const fetchRoadmap = async () => {
    try {
      const data = await roadmapAPI.get(courseId || 1);
      if (data) setRoadmap(data);
    } catch (err) {
      console.log('Using simulated adaptive roadmap.');
    }
  };

  const handleCompleteAction = async (action) => {
    confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
    setRoadmap((prev) => ({
      ...prev,
      total_xp: prev.total_xp + action.xp_reward,
      next_best_actions: prev.next_best_actions.map((a) =>
        a.id === action.id ? { ...a, is_completed: true } : a
      )
    }));

    try {
      await roadmapAPI.completeAction(action.id);
    } catch (err) {
      // Quietly handled
    }
  };

  const handleStartActivity = (action) => {
    if (onNavigateTab) {
      onNavigateTab(action.action_url_target);
    }
  };

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-8">
      {/* Top Banner with XP & Streaks */}
      <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-cyan-950 border border-indigo-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs uppercase tracking-wider mb-2">
            <Compass className="h-4 w-4" />
            <span>Personalized AI Learning Navigator</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Your Adaptive Curriculum Roadmap
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm mt-1 max-w-xl leading-relaxed">
            COGNIPATH analyzes your real-time quiz performance and doubt queries to prescribe your optimal next study steps.
          </p>
        </div>

        {/* Gamification Stats */}
        <div className="flex items-center gap-3 sm:gap-4 shrink-0">
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-center min-w-[100px]">
            <div className="flex items-center justify-center gap-1 text-amber-400 font-extrabold text-xl">
              <Flame className="h-5 w-5 fill-amber-400" />
              <span>{roadmap.streak_days}</span>
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mt-0.5">
              Day Streak
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-center min-w-[120px]">
            <div className="flex items-center justify-center gap-1 text-cyan-400 font-extrabold text-xl">
              <Zap className="h-5 w-5 fill-cyan-400" />
              <span>{roadmap.total_xp}</span>
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mt-0.5">
              Total XP Earned
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/80 border border-indigo-500/30 text-center min-w-[140px] hidden sm:block">
            <div className="flex items-center justify-center gap-1 text-indigo-300 font-extrabold text-sm">
              <Award className="h-5 w-5 text-indigo-400" />
              <span>{roadmap.current_level}</span>
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mt-0.5">
              Mastery Tier
            </span>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Next Best Actions & Mastery Radar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Next Best Action Priority Queue (2 Cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-extrabold text-white flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-400" />
              <span>Personalized "Next Best Action" Queue</span>
            </h3>
            <span className="text-xs text-slate-400">Prioritized by Knowledge Gap Heuristics</span>
          </div>

          <div className="space-y-3">
            {roadmap.next_best_actions.map((act) => {
              const isDone = act.is_completed;
              return (
                <div
                  key={act.id}
                  className={`p-5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    isDone
                      ? 'bg-slate-950/50 border-slate-900 opacity-60'
                      : 'bg-slate-900/80 border-slate-800 hover:border-indigo-500/50 shadow-xl'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                        {act.topic}
                      </span>
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {act.estimated_mins} mins
                      </span>
                      <span className="text-xs font-bold text-amber-400 flex items-center gap-0.5">
                        <Zap className="h-3 w-3" /> +{act.xp_reward} XP
                      </span>
                    </div>
                    <h4 className={`text-sm font-bold ${isDone ? 'line-through text-slate-500' : 'text-white'}`}>
                      {act.title}
                    </h4>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                    {!isDone ? (
                      <>
                        <button
                          onClick={() => handleStartActivity(act)}
                          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1.5"
                        >
                          <span>Start</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleCompleteAction(act)}
                          className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Done (+{act.xp_reward} XP)</span>
                        </button>
                      </>
                    ) : (
                      <span className="px-3 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 text-xs font-bold flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Completed
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Knowledge Gap & Skill Mastery Radar (1 Col) */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-cyan-400" />
              <span>Syllabus Mastery Map</span>
            </h3>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Real-time</span>
          </div>

          <div className="space-y-4">
            {roadmap.skills.map((skill, sIdx) => {
              const isAtRisk = skill.status === "AT_RISK";
              const isMastered = skill.status === "MASTERED";

              return (
                <div key={sIdx} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-200">{skill.topic}</span>
                    <div className="flex items-center gap-1.5">
                      {isAtRisk && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1">
                          <AlertTriangle className="h-2.5 w-2.5" /> At-Risk
                        </span>
                      )}
                      {isMastered && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Mastered
                        </span>
                      )}
                      <strong className="text-white font-extrabold">{skill.mastery_percentage}%</strong>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isAtRisk
                          ? 'bg-gradient-to-r from-rose-500 to-amber-500'
                          : isMastered
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                          : 'bg-gradient-to-r from-indigo-500 to-cyan-400'
                      }`}
                      style={{ width: `${skill.mastery_percentage}%` }}
                    />
                  </div>

                  {skill.review_due && (
                    <span className="text-[10px] text-amber-400 font-semibold block pt-0.5">
                      • Spaced repetition review recommended
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 text-xs space-y-2">
            <span className="font-bold text-indigo-300 block">Personalized Adaptive Logic</span>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Topics with mastery &lt; 60% automatically generate micro-review flashcards and push intervention alerts to your educator.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
