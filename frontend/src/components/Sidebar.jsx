import {
  LayoutDashboard,
  BookOpen,
  Bot,
  ClipboardCheck,
  BarChart3,
  Layers,
  FileText,
  Video,
  MessageSquare,
  Settings,
  Globe,
  ShieldCheck,
  Sparkles,
  PanelLeftClose
} from 'lucide-react';

export default function Sidebar({
  activeTab,
  setActiveTab,
  userRole,
  onOpenLangModal,
  isOpen = true,
  onClose
}) {
  const isEducator = userRole === 'EDUCATOR';

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, color: 'text-[#8B7CFF]' },
    { id: 'course-player', label: 'Course Player', icon: BookOpen, color: 'text-[#8B7CFF]', badge: 'Syllabus', badgeColor: 'violet' },
    { id: 'exam-studio', label: 'Exam & Quiz Studio', icon: ClipboardCheck, color: 'text-[#FFC15E]', badge: 'Alert', badgeColor: 'amber' },
    { id: 'assignments', label: 'AI Assignments', icon: FileText, color: 'text-[#5FE3B0]', badge: 'Auto', badgeColor: 'mint' },
    { id: 'tutor', label: 'AI Tutor', icon: Bot, color: 'text-[#8B7CFF]' },
    { id: 'quizzes', label: 'Spaced Quizzes', icon: ClipboardCheck, color: 'text-[#FFC15E]' },
    { id: 'roadmap', label: 'Progress Roadmap', icon: BarChart3, color: 'text-[#5FE3B0]' },
    { id: 'pods', label: 'Learning Pods', icon: Video, color: 'text-[#5FE3B0]', badge: 'Live', badgeColor: 'mint' },
    { id: 'community', label: 'Community Hub', icon: MessageSquare, color: 'text-[#8B7CFF]' },
    { id: 'landing', label: 'Platform Overview', icon: Sparkles, color: 'text-[#FF6F9C]', badge: 'SIH 2026', badgeColor: 'pink' },
    { id: 'flashcards', label: 'Flashcards', icon: Layers, color: 'text-[#8B7CFF]' },
    { id: 'settings', label: 'Settings', icon: Settings, color: 'text-[#8A90B4]' },
  ];

  if (isEducator) {
    navItems.unshift({
      id: 'analytics',
      label: 'Educator Analytics',
      icon: ShieldCheck,
      color: 'text-[#FFC15E]',
      badge: 'Alert',
      badgeColor: 'amber'
    });
  }

  const getBadgeClass = (badgeColor) => {
    switch (badgeColor) {
      case 'violet':
        return 'bg-[#8B7CFF]/15 text-[#8B7CFF] border-[#8B7CFF]/30';
      case 'amber':
        return 'bg-[#FFC15E]/15 text-[#FFC15E] border-[#FFC15E]/30';
      case 'mint':
        return 'bg-[#5FE3B0]/15 text-[#5FE3B0] border-[#5FE3B0]/30';
      case 'pink':
        return 'bg-[#FF6F9C]/15 text-[#FF6F9C] border-[#FF6F9C]/30';
      default:
        return 'bg-[#171C36] text-[#8A90B4] border-[#262C4C]';
    }
  };

  return (
    <aside
      className={`border-r border-[#262C4C] bg-[#12162B] flex flex-col justify-between shrink-0 overflow-y-auto transition-all duration-300 ease-in-out ${
        isOpen
          ? 'w-64 max-[980px]:w-16 p-3 sm:p-4 opacity-100'
          : 'w-0 p-0 border-r-0 opacity-0 pointer-events-none -translate-x-full overflow-hidden'
      }`}
    >
      <div>
        {/* Sidebar Header with Close Toggle */}
        <div className="flex items-center justify-between pb-3 mb-2 border-b border-[#262C4C] max-[980px]:hidden">
          <span className="text-[11px] font-heading font-bold text-[#8A90B4] uppercase tracking-wider">
            Navigation
          </span>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-[#8A90B4] hover:text-[#ECEDF7] hover:bg-[#171C36] transition flex items-center justify-center"
              title="Collapse sidebar"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          )}
        </div>
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                title={item.label}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 group relative ${
                  isActive
                    ? 'bg-[#171C36] text-[#ECEDF7] font-bold shadow-sm'
                    : 'text-[#8A90B4] hover:text-[#ECEDF7] hover:bg-[#171C36]/50'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Small glowing mint dot on the left for active item */}
                  <div className="w-2 flex items-center justify-center shrink-0">
                    {isActive ? (
                      <span
                        className="h-2 w-2 rounded-full bg-[#5FE3B0] shadow-[0_0_8px_#5FE3B0] block animate-pulse"
                        title="Active section"
                      />
                    ) : (
                      <span className="h-2 w-2 rounded-full bg-transparent block" />
                    )}
                  </div>

                  <Icon className={`h-4 w-4 shrink-0 transition-colors ${isActive ? 'text-[#5FE3B0]' : item.color}`} />
                  <span className="truncate max-[980px]:hidden">{item.label}</span>
                </div>

                {/* Pill Badges in violet/amber/mint/pink */}
                {item.badge && (
                  <span
                    className={`max-[980px]:hidden text-[9px] font-extrabold px-2 py-0.5 rounded-full border uppercase tracking-wider shrink-0 ml-1.5 ${getBadgeClass(
                      item.badgeColor
                    )}`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Learn in your language Bhashini Card (collapses gracefully under 980px) */}
      <div className="p-3.5 rounded-2xl bg-[#171C36] border border-[#262C4C] space-y-2 mt-4 shadow-[0_18px_34px_-18px_rgba(0,0,0,0.55)] max-[980px]:p-2 max-[980px]:space-y-0">
        <div className="flex items-center gap-2 text-xs font-bold text-[#ECEDF7] max-[980px]:justify-center">
          <Globe className="h-4 w-4 text-[#8B7CFF] shrink-0" />
          <span className="max-[980px]:hidden font-heading text-xs">Learn in your language</span>
        </div>
        <p className="text-[11px] text-[#8A90B4] leading-relaxed max-[980px]:hidden">
          Study in Hindi, Tamil, Telugu and more via Bhashini.
        </p>
        <button
          onClick={onOpenLangModal}
          className="w-full mt-1 py-1.5 px-3 rounded-full bg-[#12162B] hover:bg-[#262C4C] border border-[#262C4C] text-[#5FE3B0] text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-sm"
          title="Change language"
        >
          <Globe className="h-3.5 w-3.5 shrink-0" />
          <span className="max-[980px]:hidden">Change</span>
        </button>
      </div>
    </aside>
  );
}

