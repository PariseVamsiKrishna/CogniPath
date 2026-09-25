import React, { useState } from 'react';
import { GraduationCap, Brain, Sparkles, User, ShieldCheck, ArrowRight, ArrowLeft, BookOpen } from 'lucide-react';
import { authAPI } from '../services/api';

export default function Login({ onLoginSuccess, onBackToHome, initialRole = 'STUDENT' }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState(initialRole || 'STUDENT');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegister) {
        await authAPI.register({
          email,
          password,
          full_name: fullName,
          role
        });
      }
      const data = await authAPI.login(email, password);
      onLoginSuccess(data.user);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = async (demoEmail, demoRole) => {
    setError('');
    setLoading(true);
    try {
      const data = await authAPI.login(demoEmail, 'password123');
      onLoginSuccess(data.user);
    } catch (err) {
      // Local demo fallback if backend is starting up
      const mockUser = {
        id: demoRole === 'EDUCATOR' ? 1 : 2,
        email: demoEmail,
        full_name: demoRole === 'EDUCATOR' ? 'Prof. Rajesh Ramanujan' : 'Aarav Sharma',
        role: demoRole,
        university: demoRole === 'EDUCATOR' ? 'Indian Institute of Technology Bombay (IIT Bombay)' : 'Birla Institute of Technology & Science (BITS Pilani)',
        department: 'Computer Science & Engineering (CSE)',
        institutional_email: demoRole === 'EDUCATOR' ? 'rajesh.cs@iitb.ac.in' : 'aarav.2022@pilani.bits-pilani.ac.in',
        student_year: '3rd Year',
        highest_qualification: 'Ph.D. / Doctorate',
        designation: 'Professor',
        profile_completed: true
      };
      localStorage.setItem('cognipath_token', 'mock_token_sih2026');
      localStorage.setItem('cognipath_user', JSON.stringify(mockUser));
      onLoginSuccess(mockUser);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] flex flex-col justify-center items-center px-4 relative overflow-hidden">
      {/* Back to Home Button */}
      {onBackToHome && (
        <button
          onClick={onBackToHome}
          className="absolute top-6 left-6 z-20 flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#121826] hover:bg-[#1a2336] border border-[#1e2638] text-xs font-semibold text-slate-300 hover:text-white transition shadow-lg"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Platform Overview</span>
        </button>
      )}

      {/* Dynamic Background Glows */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-purple-600/15 rounded-full blur-[120px] pointer-events-none" />

      {/* Brand Header */}
      <div className="flex flex-col items-center mb-8 text-center z-10">
        <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center mb-4 shadow-2xl shadow-indigo-600/40">
          <GraduationCap className="h-9 w-9 text-white" />
        </div>
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-black tracking-tight text-white">
            SmartLearn
          </h1>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase">
            COGNIPATH
          </span>
        </div>
        <p className="text-slate-400 text-sm mt-1 max-w-sm font-medium">
          AI-Powered Learning • Smart India Hackathon 2026
        </p>
      </div>

      {/* Main Authentication Card */}
      <div className="w-full max-w-md bg-[#131927] border border-[#1e2638] rounded-2xl p-6 sm:p-8 shadow-2xl z-10">
        {/* One-Click Demo Access Bar */}
        <div className="mb-6">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
            Quick One-Click Demo Login
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => quickLogin('student@cognipath.edu', 'STUDENT')}
              disabled={loading}
              className="flex flex-col items-center justify-center p-3 rounded-xl bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/30 transition group text-left"
            >
              <div className="flex items-center gap-1.5 text-indigo-300 font-bold text-xs">
                <User className="h-3.5 w-3.5" />
                <span>Student Portal</span>
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5">Alex Kumar</span>
            </button>

            <button
              type="button"
              onClick={() => quickLogin('teacher@cognipath.edu', 'EDUCATOR')}
              disabled={loading}
              className="flex flex-col items-center justify-center p-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition group text-left"
            >
              <div className="flex items-center gap-1.5 text-amber-300 font-bold text-xs">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Educator Portal</span>
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5">Prof. Ramanujan</span>
            </button>
          </div>
        </div>

        <div className="relative flex items-center justify-center mb-6">
          <div className="border-t border-[#1e2638] w-full" />
          <span className="bg-[#131927] px-3 text-[11px] text-slate-500 font-semibold uppercase tracking-wider absolute">
            or sign in with email
          </span>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
            {error}
          </div>
        )}

        {/* Credentials Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Full Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Priya Patel"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Account Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition"
                >
                  <option value="STUDENT">Student Learner</option>
                  <option value="EDUCATOR">Educator / Professor</option>
                </select>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@cognipath.edu"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 font-bold text-xs uppercase tracking-wider text-white shadow-lg shadow-indigo-600/30 transition flex items-center justify-center gap-2"
          >
            <span>{loading ? 'Authenticating...' : isRegister ? 'Create Account' : 'Sign In'}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => setIsRegister(!isRegister)}
            className="text-xs text-indigo-400 hover:text-indigo-300 transition"
          >
            {isRegister
              ? 'Already have an account? Sign in here'
              : "Don't have an account? Register now"}
          </button>
        </div>
      </div>
    </div>
  );
}
