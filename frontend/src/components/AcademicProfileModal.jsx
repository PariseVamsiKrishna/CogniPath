import React, { useState, useEffect, useMemo } from 'react';
import {
  GraduationCap,
  User,
  Mail,
  Building2,
  BookOpen,
  Award,
  Briefcase,
  Sparkles,
  Check,
  X,
  ChevronDown,
  Search,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  School,
  Hash
} from 'lucide-react';
import { authAPI } from '../services/api';

const POPULAR_UNIVERSITIES = [
  'Indian Institute of Technology Bombay (IIT Bombay)',
  'Indian Institute of Technology Delhi (IIT Delhi)',
  'Indian Institute of Technology Madras (IIT Madras)',
  'Indian Institute of Technology Kharagpur (IIT Kharagpur)',
  'Indian Institute of Technology Kanpur (IIT Kanpur)',
  'Indian Institute of Technology Roorkee (IIT Roorkee)',
  'Birla Institute of Technology & Science (BITS Pilani)',
  'National Institute of Technology Tiruchirappalli (NIT Trichy)',
  'National Institute of Technology Karnataka (NIT Surathkal)',
  'International Institute of Information Technology Hyderabad (IIIT Hyderabad)',
  'Delhi Technological University (DTU)',
  'Netaji Subhas University of Technology (NSUT)',
  'Vellore Institute of Technology (VIT Vellore)',
  'SRM Institute of Science & Technology',
  'Anna University, Chennai',
  'University of Delhi (DU)',
  'Visvesvaraya Technological University (VTU)',
  'Jadavpur University, Kolkata',
  'Manipal Academy of Higher Education (MAHE)',
  'Amrita Vishwa Vidyapeetham',
  'Other / Enter manually...'
];

const COMMON_DEPARTMENTS = [
  'Computer Science & Engineering (CSE)',
  'Electronics & Communication Engineering (ECE)',
  'Information Technology (IT)',
  'Artificial Intelligence & Data Science (AI & DS)',
  'Electrical & Electronics Engineering (EEE)',
  'Mechanical Engineering (ME)',
  'Civil Engineering (CE)',
  'Chemical Engineering (ChE)',
  'Biotechnology & Biochemical Engineering',
  'Mathematics & Computing',
  'Robotics & Automation',
  'Other / Custom Department...'
];

const STUDENT_YEARS = [
  '1st Year',
  '2nd Year',
  '3rd Year',
  '4th Year',
  'Postgraduate / Masters',
  'PhD Scholar'
];

const EDUCATOR_QUALIFICATIONS = [
  'B.Tech / B.E.',
  'M.Tech / M.E. / M.S.',
  'Ph.D. / Doctorate',
  'Post-Doctoral Fellow'
];

const EDUCATOR_DESIGNATIONS = [
  'Assistant Professor',
  'Associate Professor',
  'Professor',
  'HOD',
  'Visiting Faculty',
  'Industry Instructor'
];

export default function AcademicProfileModal({
  isOpen,
  onClose,
  user,
  onProfileUpdated,
  isOnboarding = false
}) {
  // Primary State
  const [role, setRole] = useState(user?.role === 'EDUCATOR' ? 'EDUCATOR' : 'STUDENT');
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [personalEmail, setPersonalEmail] = useState(user?.email || '');
  
  // University State with search and custom fallback
  const [selectedUniversity, setSelectedUniversity] = useState(() => {
    if (!user?.university) return '';
    return POPULAR_UNIVERSITIES.includes(user.university) ? user.university : 'Other / Enter manually...';
  });
  const [customUniversity, setCustomUniversity] = useState(() => {
    if (!user?.university) return '';
    return POPULAR_UNIVERSITIES.includes(user.university) ? '' : user.university;
  });
  const [univSearchQuery, setUnivSearchQuery] = useState('');
  const [isUnivDropdownOpen, setIsUnivDropdownOpen] = useState(false);

  // Department State with custom fallback
  const [selectedDepartment, setSelectedDepartment] = useState(() => {
    if (!user?.department) return '';
    return COMMON_DEPARTMENTS.includes(user.department) ? user.department : 'Other / Custom Department...';
  });
  const [customDepartment, setCustomDepartment] = useState(() => {
    if (!user?.department) return '';
    return COMMON_DEPARTMENTS.includes(user.department) ? '' : user.department;
  });

  // Student-specific fields
  const [studentEmail, setStudentEmail] = useState(user?.role === 'STUDENT' ? (user?.institutional_email || '') : '');
  const [studentYear, setStudentYear] = useState(user?.student_year || '2nd Year');
  const [studentIdNum, setStudentIdNum] = useState(user?.student_id_num || '');

  // Educator-specific fields
  const [facultyEmail, setFacultyEmail] = useState(user?.role === 'EDUCATOR' ? (user?.institutional_email || '') : '');
  const [highestQualification, setHighestQualification] = useState(user?.highest_qualification || 'Ph.D. / Doctorate');
  const [designation, setDesignation] = useState(user?.designation || 'Assistant Professor');

  // UI status
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Sync initial state if user prop changes
  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setPersonalEmail(user.email || '');
      if (user.role) setRole(user.role);
      if (user.university) {
        if (POPULAR_UNIVERSITIES.includes(user.university)) {
          setSelectedUniversity(user.university);
          setCustomUniversity('');
        } else {
          setSelectedUniversity('Other / Enter manually...');
          setCustomUniversity(user.university);
        }
      }
      if (user.department) {
        if (COMMON_DEPARTMENTS.includes(user.department)) {
          setSelectedDepartment(user.department);
          setCustomDepartment('');
        } else {
          setSelectedDepartment('Other / Custom Department...');
          setCustomDepartment(user.department);
        }
      }
      if (user.institutional_email) {
        if (user.role === 'EDUCATOR') setFacultyEmail(user.institutional_email);
        else setStudentEmail(user.institutional_email);
      }
      if (user.student_year) setStudentYear(user.student_year);
      if (user.student_id_num) setStudentIdNum(user.student_id_num);
      if (user.highest_qualification) setHighestQualification(user.highest_qualification);
      if (user.designation) setDesignation(user.designation);
    }
  }, [user]);

  // Filtered universities for searchable dropdown
  const filteredUniversities = useMemo(() => {
    if (!univSearchQuery.trim()) return POPULAR_UNIVERSITIES;
    const q = univSearchQuery.toLowerCase();
    const matches = POPULAR_UNIVERSITIES.filter(u => u.toLowerCase().includes(q));
    if (!matches.includes('Other / Enter manually...')) {
      matches.push('Other / Enter manually...');
    }
    return matches;
  }, [univSearchQuery]);

  // Validation logic
  const validateForm = () => {
    if (!fullName.trim()) return 'Full Name is required.';
    if (!personalEmail.trim() || !personalEmail.includes('@')) return 'A valid personal email is required.';

    const univ = selectedUniversity === 'Other / Enter manually...' ? customUniversity.trim() : selectedUniversity;
    if (!univ) return 'Please select or enter your University / College Name.';

    const dept = selectedDepartment === 'Other / Custom Department...' ? customDepartment.trim() : selectedDepartment;
    if (!dept) return 'Please select or enter your Department / Branch.';

    if (role === 'STUDENT') {
      if (studentEmail.trim() && !studentEmail.includes('@')) {
        return 'Please enter a valid Student College Email format.';
      }
      if (!studentYear) return 'Please select your Year of Study.';
    } else {
      if (!facultyEmail.trim() || !facultyEmail.includes('@')) {
        return 'Official Faculty / Institutional Email is required for educator verification.';
      }
      if (!highestQualification) return 'Please select your Highest Qualification.';
      if (!designation) return 'Please select your Designation / Title.';
    }

    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const validationError = validateForm();
    if (validationError) {
      setErrorMsg(validationError);
      return;
    }

    const finalUniversity = selectedUniversity === 'Other / Enter manually...'
      ? customUniversity.trim()
      : selectedUniversity;

    const finalDepartment = selectedDepartment === 'Other / Custom Department...'
      ? customDepartment.trim()
      : selectedDepartment;

    const payload = {
      full_name: fullName.trim(),
      email: personalEmail.trim(),
      role: role,
      university: finalUniversity,
      department: finalDepartment,
      institutional_email: role === 'STUDENT' ? studentEmail.trim() : facultyEmail.trim(),
      student_year: role === 'STUDENT' ? studentYear : null,
      student_id_num: role === 'STUDENT' ? (studentIdNum.trim() || null) : null,
      highest_qualification: role === 'EDUCATOR' ? highestQualification : null,
      designation: role === 'EDUCATOR' ? designation : null,
    };

    setLoading(true);
    try {
      const updated = await authAPI.updateProfile(payload);
      setSuccessMsg('Academic Profile completed successfully!');
      if (onProfileUpdated) {
        onProfileUpdated(updated);
      }
      setTimeout(() => {
        if (onClose) onClose();
      }, 900);
    } catch (err) {
      console.error(err);
      setErrorMsg(err.response?.data?.detail || 'Failed to update academic profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#0A0D1C]/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      {/* Outer Card with Glassmorphic Lighting and Borders */}
      <div
        style={{
          boxShadow: '0 24px 60px -12px rgba(0, 0, 0, 0.75), 0 0 40px rgba(139, 124, 255, 0.12)'
        }}
        className="relative w-full max-w-2xl bg-[#12162B] border border-[#262C4C] rounded-3xl p-6 sm:p-8 my-auto text-[#ECEDF7] transition-all"
      >
        {/* Soft Radial Gradient Accents */}
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-[#8B7CFF]/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-[#FF6F9C]/15 rounded-full blur-3xl pointer-events-none" />

        {/* Close button (allowed if not strict first-time onboarding or if dismissible) */}
        {!isOnboarding && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full text-[#8A90B4] hover:text-[#ECEDF7] hover:bg-[#171C36] border border-transparent hover:border-[#262C4C] transition"
          >
            <X className="h-5 w-5" />
          </button>
        )}

        {/* Header Title & Platform Badging */}
        <div className="flex items-start gap-4 mb-6">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-[#8B7CFF] to-[#FF6F9C] flex items-center justify-center text-[#0A0D1C] shadow-lg shadow-[#8B7CFF]/25 shrink-0">
            <GraduationCap className="h-6 w-6 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#8B7CFF]/20 text-[#8B7CFF] border border-[#8B7CFF]/30 tracking-wide uppercase">
                {isOnboarding ? 'First-Time Onboarding' : 'Academic Profile'}
              </span>
              <span className="text-[10px] font-semibold text-[#8A90B4]">
                SIH 2026 • SmartLearn
              </span>
            </div>
            <h2 className="font-heading font-bold text-xl sm:text-2xl text-[#ECEDF7] mt-1">
              Complete Your Academic Identity
            </h2>
            <p className="text-xs text-[#8A90B4] mt-0.5 leading-relaxed">
              Personalize your adaptive AI learning experience, university peer pods, and curriculum benchmarks.
            </p>
          </div>
        </div>

        {/* Prominent Segmented Role Switcher */}
        <div className="mb-6 p-1.5 rounded-2xl bg-[#171C36] border border-[#262C4C] flex gap-1.5 shadow-inner">
          <button
            type="button"
            onClick={() => setRole('STUDENT')}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-heading font-bold flex items-center justify-center gap-2 transition-all ${
              role === 'STUDENT'
                ? 'bg-[#8B7CFF] text-[#0A0D1C] shadow-[0_4px_16px_rgba(139,124,255,0.4)]'
                : 'text-[#8A90B4] hover:text-[#ECEDF7] hover:bg-[#12162B]/60'
            }`}
          >
            <span>🎓</span>
            <span>Student</span>
            {role === 'STUDENT' && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#0A0D1C]/25 text-[#0A0D1C] font-extrabold ml-1">
                Active
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setRole('EDUCATOR')}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-heading font-bold flex items-center justify-center gap-2 transition-all ${
              role === 'EDUCATOR'
                ? 'bg-[#5FE3B0] text-[#0A0D1C] shadow-[0_4px_16px_rgba(95,227,176,0.4)]'
                : 'text-[#8A90B4] hover:text-[#ECEDF7] hover:bg-[#12162B]/60'
            }`}
          >
            <span>👨‍🏫</span>
            <span>Educator</span>
            {role === 'EDUCATOR' && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#0A0D1C]/25 text-[#0A0D1C] font-extrabold ml-1">
                Active
              </span>
            )}
          </button>
        </div>

        {/* Feedback Banners */}
        {errorMsg && (
          <div className="mb-5 p-3 rounded-xl bg-[#FF6F9C]/10 border border-[#FF6F9C]/30 text-[#FF6F9C] text-xs flex items-center gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="font-medium">{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-5 p-3 rounded-xl bg-[#5FE3B0]/10 border border-[#5FE3B0]/30 text-[#5FE3B0] text-xs flex items-center gap-2.5">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span className="font-bold">{successMsg}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Section A: Core Identity Fields (Shared) */}
          <div className="p-4 rounded-2xl bg-[#171C36]/70 border border-[#262C4C] space-y-3.5">
            <div className="flex items-center gap-2 pb-1 border-b border-[#262C4C]/60 text-[11px] font-bold uppercase tracking-wider text-[#8B7CFF]">
              <User className="h-3.5 w-3.5" />
              <span>Core Identity Details (Shared)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold text-[#8A90B4] mb-1.5">
                  Full Name <span className="text-[#FF6F9C]">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-[#8A90B4]" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Aarav Sharma"
                    className="w-full bg-[#12162B] border border-[#262C4C] rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-[#ECEDF7] placeholder-[#8A90B4]/60 focus:outline-none focus:border-[#8B7CFF] focus:ring-1 focus:ring-[#8B7CFF] transition"
                  />
                </div>
              </div>

              {/* Personal / Primary Email */}
              <div>
                <label className="block text-xs font-semibold text-[#8A90B4] mb-1.5">
                  Personal / Primary Email <span className="text-[#FF6F9C]">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-[#8A90B4]" />
                  <input
                    type="email"
                    required
                    value={personalEmail}
                    onChange={(e) => setPersonalEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full bg-[#12162B] border border-[#262C4C] rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-[#ECEDF7] placeholder-[#8A90B4]/60 focus:outline-none focus:border-[#8B7CFF] focus:ring-1 focus:ring-[#8B7CFF] transition"
                  />
                </div>
              </div>
            </div>

            {/* University / College Name (Searchable dropdown with manual fallback) */}
            <div>
              <label className="block text-xs font-semibold text-[#8A90B4] mb-1.5">
                University / College Name <span className="text-[#FF6F9C]">*</span>
              </label>
              <div className="relative">
                <School className="absolute left-3 top-3 h-4 w-4 text-[#8A90B4]" />
                <button
                  type="button"
                  onClick={() => setIsUnivDropdownOpen(!isUnivDropdownOpen)}
                  className="w-full bg-[#12162B] border border-[#262C4C] rounded-xl pl-9 pr-9 py-2 text-xs font-medium text-left text-[#ECEDF7] flex items-center justify-between focus:outline-none focus:border-[#8B7CFF] transition"
                >
                  <span className="truncate">
                    {selectedUniversity || 'Select your institution...'}
                  </span>
                  <ChevronDown className="h-4 w-4 text-[#8A90B4] shrink-0" />
                </button>

                {/* Dropdown Menu */}
                {isUnivDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-[#12162B] border border-[#262C4C] rounded-xl shadow-2xl p-2 max-h-56 overflow-y-auto">
                    <div className="relative mb-2">
                      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#8A90B4]" />
                      <input
                        type="text"
                        value={univSearchQuery}
                        onChange={(e) => setUnivSearchQuery(e.target.value)}
                        placeholder="Search universities..."
                        className="w-full bg-[#171C36] border border-[#262C4C] rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-[#ECEDF7] placeholder-[#8A90B4]/60 focus:outline-none focus:border-[#8B7CFF]"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div className="space-y-0.5">
                      {filteredUniversities.map((univ) => (
                        <button
                          key={univ}
                          type="button"
                          onClick={() => {
                            setSelectedUniversity(univ);
                            setIsUnivDropdownOpen(false);
                            setUnivSearchQuery('');
                          }}
                          className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center justify-between ${
                            selectedUniversity === univ
                              ? 'bg-[#8B7CFF]/20 text-[#8B7CFF] font-semibold'
                              : 'text-[#ECEDF7] hover:bg-[#171C36]'
                          }`}
                        >
                          <span className="truncate">{univ}</span>
                          {selectedUniversity === univ && <Check className="h-3.5 w-3.5 text-[#8B7CFF]" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Inline Manual Fallback Input */}
              {selectedUniversity === 'Other / Enter manually...' && (
                <div className="mt-2.5">
                  <input
                    type="text"
                    required
                    value={customUniversity}
                    onChange={(e) => setCustomUniversity(e.target.value)}
                    placeholder="Enter full University / College name..."
                    className="w-full bg-[#12162B] border border-[#8B7CFF]/50 rounded-xl px-3 py-2 text-xs font-medium text-[#ECEDF7] placeholder-[#8A90B4]/60 focus:outline-none focus:border-[#8B7CFF] focus:ring-1 focus:ring-[#8B7CFF] transition animate-fadeIn"
                  />
                </div>
              )}
            </div>

            {/* Department / Branch */}
            <div>
              <label className="block text-xs font-semibold text-[#8A90B4] mb-1.5">
                Department / Branch <span className="text-[#FF6F9C]">*</span>
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-3 h-4 w-4 text-[#8A90B4]" />
                <select
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  className="w-full bg-[#12162B] border border-[#262C4C] rounded-xl pl-9 pr-8 py-2 text-xs font-medium text-[#ECEDF7] focus:outline-none focus:border-[#8B7CFF] transition appearance-none cursor-pointer"
                >
                  <option value="" disabled className="bg-[#12162B] text-[#8A90B4]">
                    Select Department / Branch...
                  </option>
                  {COMMON_DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept} className="bg-[#12162B] text-[#ECEDF7]">
                      {dept}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-3 h-4 w-4 text-[#8A90B4] pointer-events-none" />
              </div>

              {/* Inline Manual Fallback for Department */}
              {selectedDepartment === 'Other / Custom Department...' && (
                <div className="mt-2.5">
                  <input
                    type="text"
                    required
                    value={customDepartment}
                    onChange={(e) => setCustomDepartment(e.target.value)}
                    placeholder="Enter Department / Branch name..."
                    className="w-full bg-[#12162B] border border-[#8B7CFF]/50 rounded-xl px-3 py-2 text-xs font-medium text-[#ECEDF7] placeholder-[#8A90B4]/60 focus:outline-none focus:border-[#8B7CFF] focus:ring-1 focus:ring-[#8B7CFF] transition animate-fadeIn"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Section B: Conditional Dynamic Fields by Role */}
          {role === 'STUDENT' ? (
            /* Student Conditional Fields */
            <div className="p-4 rounded-2xl bg-[#171C36]/70 border border-[#8B7CFF]/30 space-y-3.5 animate-fadeIn">
              <div className="flex items-center justify-between pb-1 border-b border-[#262C4C]/60">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#8B7CFF]">
                  <GraduationCap className="h-3.5 w-3.5" />
                  <span>Student Academic Credentials</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#8B7CFF]/15 text-[#8B7CFF]">
                  Learner Mode
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Student College Email */}
                <div>
                  <label className="block text-xs font-semibold text-[#8A90B4] mb-1.5">
                    Student College Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-[#8A90B4]" />
                    <input
                      type="email"
                      value={studentEmail}
                      onChange={(e) => setStudentEmail(e.target.value)}
                      placeholder="e.g. rollnumber@university.edu.in"
                      className="w-full bg-[#12162B] border border-[#262C4C] rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-[#ECEDF7] placeholder-[#8A90B4]/60 focus:outline-none focus:border-[#8B7CFF] transition"
                    />
                  </div>
                  <p className="text-[10px] text-[#8A90B4] mt-1 flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3 text-[#5FE3B0]" />
                    <span>Domain (.edu, .edu.in, .ac.in) unlocks verified student credits</span>
                  </p>
                </div>

                {/* Student ID / Roll Number (Optional) */}
                <div>
                  <label className="block text-xs font-semibold text-[#8A90B4] mb-1.5">
                    Student ID / Roll Number <span className="text-[10px] text-[#8A90B4] font-normal">(Optional)</span>
                  </label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-3 h-4 w-4 text-[#8A90B4]" />
                    <input
                      type="text"
                      value={studentIdNum}
                      onChange={(e) => setStudentIdNum(e.target.value)}
                      placeholder="e.g. 2023BCSE0142"
                      className="w-full bg-[#12162B] border border-[#262C4C] rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-[#ECEDF7] placeholder-[#8A90B4]/60 focus:outline-none focus:border-[#8B7CFF] transition"
                    />
                  </div>
                  <p className="text-[10px] text-[#8A90B4] mt-1">
                    Used for internal batch tracking & college leaderboard rank.
                  </p>
                </div>
              </div>

              {/* Year of Study (Segmented Radio Pills) */}
              <div>
                <label className="block text-xs font-semibold text-[#8A90B4] mb-2">
                  Year of Study <span className="text-[#FF6F9C]">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {STUDENT_YEARS.map((yr) => {
                    const isSelected = studentYear === yr;
                    return (
                      <button
                        key={yr}
                        type="button"
                        onClick={() => setStudentYear(yr)}
                        className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                          isSelected
                            ? 'bg-[#8B7CFF] text-[#0A0D1C] font-bold shadow-[0_2px_10px_rgba(139,124,255,0.35)]'
                            : 'bg-[#12162B] text-[#8A90B4] hover:text-[#ECEDF7] hover:bg-[#171C36] border border-[#262C4C]'
                        }`}
                      >
                        {isSelected && <Check className="h-3 w-3 text-[#0A0D1C] stroke-[3]" />}
                        <span>{yr}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            /* Educator Conditional Fields */
            <div className="p-4 rounded-2xl bg-[#171C36]/70 border border-[#5FE3B0]/30 space-y-3.5 animate-fadeIn">
              <div className="flex items-center justify-between pb-1 border-b border-[#262C4C]/60">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#5FE3B0]">
                  <Award className="h-3.5 w-3.5" />
                  <span>Faculty & Academic Position Details</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#5FE3B0]/15 text-[#5FE3B0]">
                  Educator Mode
                </span>
              </div>

              {/* Official Faculty / Institutional Email */}
              <div>
                <label className="block text-xs font-semibold text-[#8A90B4] mb-1.5">
                  Official Faculty / Institutional Email <span className="text-[#FF6F9C]">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-[#8A90B4]" />
                  <input
                    type="email"
                    required
                    value={facultyEmail}
                    onChange={(e) => setFacultyEmail(e.target.value)}
                    placeholder="e.g. name.dept@university.ac.in"
                    className="w-full bg-[#12162B] border border-[#262C4C] rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-[#ECEDF7] placeholder-[#8A90B4]/60 focus:outline-none focus:border-[#5FE3B0] transition"
                  />
                </div>
                <div className="mt-1.5 p-2 rounded-lg bg-[#5FE3B0]/10 border border-[#5FE3B0]/20 flex items-center gap-2 text-[11px] text-[#5FE3B0]">
                  <Sparkles className="h-3.5 w-3.5 shrink-0" />
                  <span>Used for verified educator status and course author privileges.</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Highest Qualification (Chips / Select) */}
                <div>
                  <label className="block text-xs font-semibold text-[#8A90B4] mb-1.5">
                    Highest Qualification <span className="text-[#FF6F9C]">*</span>
                  </label>
                  <div className="relative">
                    <BookOpen className="absolute left-3 top-3 h-4 w-4 text-[#8A90B4]" />
                    <select
                      value={highestQualification}
                      onChange={(e) => setHighestQualification(e.target.value)}
                      className="w-full bg-[#12162B] border border-[#262C4C] rounded-xl pl-9 pr-8 py-2 text-xs font-medium text-[#ECEDF7] focus:outline-none focus:border-[#5FE3B0] transition appearance-none cursor-pointer"
                    >
                      {EDUCATOR_QUALIFICATIONS.map((qual) => (
                        <option key={qual} value={qual} className="bg-[#12162B] text-[#ECEDF7]">
                          {qual}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-3 h-4 w-4 text-[#8A90B4] pointer-events-none" />
                  </div>
                </div>

                {/* Designation / Title */}
                <div>
                  <label className="block text-xs font-semibold text-[#8A90B4] mb-1.5">
                    Designation / Title <span className="text-[#FF6F9C]">*</span>
                  </label>
                  <div className="relative">
                    <Briefcase className="absolute left-3 top-3 h-4 w-4 text-[#8A90B4]" />
                    <select
                      value={designation}
                      onChange={(e) => setDesignation(e.target.value)}
                      className="w-full bg-[#12162B] border border-[#262C4C] rounded-xl pl-9 pr-8 py-2 text-xs font-medium text-[#ECEDF7] focus:outline-none focus:border-[#5FE3B0] transition appearance-none cursor-pointer"
                    >
                      {EDUCATOR_DESIGNATIONS.map((desig) => (
                        <option key={desig} value={desig} className="bg-[#12162B] text-[#ECEDF7]">
                          {desig}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-3 h-4 w-4 text-[#8A90B4] pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-3 flex items-center justify-end gap-3">
            {!isOnboarding && (
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl bg-[#171C36] hover:bg-[#262C4C] border border-[#262C4C] text-xs font-semibold text-[#8A90B4] hover:text-[#ECEDF7] transition"
              >
                Cancel
              </button>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`px-7 py-2.5 rounded-xl text-xs sm:text-sm font-heading font-bold text-[#0A0D1C] flex items-center gap-2 shadow-lg transition-all ${
                role === 'STUDENT'
                  ? 'bg-gradient-to-r from-[#8B7CFF] to-[#7964FF] hover:brightness-110 shadow-[#8B7CFF]/30'
                  : 'bg-gradient-to-r from-[#5FE3B0] to-[#45CB98] hover:brightness-110 shadow-[#5FE3B0]/30'
              } ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-[#0A0D1C] border-t-transparent" />
                  <span>Saving Profile...</span>
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 stroke-[3]" />
                  <span>{isOnboarding ? 'Complete Onboarding & Enter' : 'Save Profile Changes'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
