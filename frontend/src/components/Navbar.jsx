import { GraduationCap, LogOut, Globe, PanelLeftClose, PanelLeft } from 'lucide-react';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'hi', name: 'हिंदी (Hindi)' },
  { code: 'te', name: 'తెలుగు (Telugu)' },
  { code: 'ta', name: 'தமிழ் (Tamil)' },
  { code: 'kn', name: 'ಕನ್ನಡ (Kannada)' },
  { code: 'bn', name: 'বাংলা (Bengali)' },
  { code: 'mr', name: 'मराठी (Marathi)' }
];

export default function Navbar({
  user,
  targetLang,
  onChangeLang,
  onLogout,
  onSelectTab,
  isSidebarOpen = true,
  onToggleSidebar,
  onOpenProfile
}) {
  const getInitials = (name) => {
    if (!name) return 'AK';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <header className="sticky top-0 z-50 h-16 border-b border-[#262C4C] bg-[#12162B]/95 backdrop-blur-md px-3 sm:px-4 lg:px-6 flex items-center justify-between">
      {/* Left: Sidebar Toggle + Brand */}
      <div className="flex items-center gap-3">
        {/* Closable Sidebar Toggle Button */}
        <button
          type="button"
          onClick={onToggleSidebar}
          className="p-2 rounded-xl text-[#8A90B4] hover:text-[#ECEDF7] hover:bg-[#171C36] border border-transparent hover:border-[#262C4C] transition flex items-center justify-center shrink-0"
          title={isSidebarOpen ? 'Collapse sidebar' : 'Open sidebar'}
        >
          {isSidebarOpen ? (
            <PanelLeftClose className="h-5 w-5" />
          ) : (
            <PanelLeft className="h-5 w-5 text-[#5FE3B0]" />
          )}
        </button>

        {/* Brand: Gradient Badge + SmartLearn */}
        <button
          onClick={() => onSelectTab && onSelectTab(user?.role === 'EDUCATOR' ? 'analytics' : 'dashboard')}
          className="flex items-center gap-2.5 text-left focus:outline-none group"
        >
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-[#8B7CFF] to-[#FF6F9C] flex items-center justify-center shadow-lg shadow-[#8B7CFF]/25 shrink-0 group-hover:scale-105 transition-transform">
            <GraduationCap className="h-5 w-5 text-[#0A0D1C]" />
          </div>
          <div>
            <div className="font-heading font-bold text-lg tracking-tight text-[#ECEDF7] flex items-center gap-2">
              <span>SmartLearn</span>
              <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-[#8B7CFF]/15 text-[#8B7CFF] border border-[#8B7CFF]/30 uppercase tracking-wider">
                SIH 2026
              </span>
            </div>
            <p className="text-[11px] text-[#8A90B4] font-medium">AI-Powered Learning</p>
          </div>
        </button>
      </div>

      {/* Right Controls: Only Language Selector Chip and User Avatar/Name */}
      <div className="flex items-center gap-3">
        {/* Language Selector Chip */}
        <div className="flex items-center gap-1.5 bg-[#171C36] border border-[#262C4C] rounded-full px-3 py-1.5 shadow-sm">
          <Globe className="h-3.5 w-3.5 text-[#8B7CFF] shrink-0" />
          <select
            value={targetLang}
            onChange={(e) => onChangeLang(e.target.value)}
            className="bg-transparent text-xs font-semibold text-[#ECEDF7] focus:outline-none cursor-pointer"
            title="Bhashini Regional Language"
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code} className="bg-[#12162B] text-[#ECEDF7]">
                {lang.name}
              </option>
            ))}
          </select>
        </div>

        {/* User Info & Interactive Profile Avatar */}
        <div className="flex items-center gap-2 pl-2 border-l border-[#262C4C]">
          <button
            type="button"
            onClick={onOpenProfile}
            className="flex items-center gap-2.5 p-1.5 rounded-2xl hover:bg-[#171C36] transition group text-left"
            title="Edit Academic Profile"
          >
            <div className="relative">
              <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-[#8B7CFF] to-[#FF6F9C] flex items-center justify-center font-bold text-[#0A0D1C] text-xs shadow-md ring-2 ring-[#8B7CFF]/20 group-hover:scale-105 transition-transform">
                {getInitials(user?.full_name)}
              </div>
              {/* Profile completed indicator */}
              <span
                className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#12162B] ${
                  user?.profile_completed ? 'bg-[#5FE3B0]' : 'bg-[#FFC15E] animate-pulse'
                }`}
                title={user?.profile_completed ? 'Academic Profile Complete' : 'Profile Needs Completion'}
              />
            </div>
            <div className="hidden sm:block text-left">
              <div className="font-heading text-xs font-bold text-[#ECEDF7] leading-tight group-hover:text-[#8B7CFF] transition">
                {user?.full_name || 'Alex Kumar'}
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-medium text-[#8A90B4]">
                <span>{user?.role === 'EDUCATOR' ? 'Educator' : 'Student'}</span>
                {user?.university && (
                  <>
                    <span>•</span>
                    <span className="truncate max-w-[110px] text-[#8B7CFF]">
                      {user.university.replace(/\(.*?\)/g, '').trim()}
                    </span>
                  </>
                )}
              </div>
            </div>
          </button>

          <button
            onClick={onLogout}
            className="p-1.5 text-[#8A90B4] hover:text-[#FF6F9C] rounded-full transition hover:bg-[#FF6F9C]/10 ml-0.5"
            title="Sign Out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}

