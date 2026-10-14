import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Lock, Mail, User, Shield, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const {
    signInWithEmail,
    signUpWithEmail,
    resetPassword,
    authError,
    clearAuthError,
    supabaseStatus,
  } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [city, setCity] = useState('Bengaluru');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAuthError();
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      if (mode === 'signin') {
        const res = await signInWithEmail(email, password);
        if (res.success) {
          onClose();
        }
      } else if (mode === 'signup') {
        const res = await signUpWithEmail(email, password, fullName, undefined, city);
        if (res.success) {
          setSuccessMessage(
            res.message || 'Registration complete. If email verification is active, check your inbox.'
          );
        }
      } else if (mode === 'forgot') {
        const res = await resetPassword(email);
        if (res.success) {
          setSuccessMessage(res.message || 'Password reset link sent to your email.');
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
      <div className="bg-white border border-stone-200 rounded-2xl max-w-md w-full p-6 sm:p-8 shadow-xl text-xs space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-stone-500 font-mono text-[11px] uppercase tracking-wider">
              <Shield className="w-3.5 h-3.5 text-stone-700" />
              <span>Decizy Secure Access</span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-stone-900 mt-1">
              {mode === 'signin' && 'Sign In to Decizy'}
              {mode === 'signup' && 'Create Account'}
              {mode === 'forgot' && 'Reset Password'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 text-lg p-1"
          >
            ✕
          </button>
        </div>

        {/* Configuration notice if Supabase is unconfigured */}
        {!supabaseStatus.isConfigured && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Local Demonstration Active:</span>
              <p className="mt-0.5 text-amber-800 text-[11px]">
                Supabase credentials are not detected in environment variables. You can continue evaluating the platform using the Persona Switcher in the top bar.
              </p>
            </div>
          </div>
        )}

        {authError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-900 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span className="text-[11px]">{authError}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span className="text-[11px]">{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                Full Name <span className="text-rose-600">*</span>
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Vikram Malhotra"
                  className="w-full pl-9 pr-3 py-2 border border-stone-300 rounded-lg text-xs"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block font-semibold text-stone-700 mb-1">
              Email Address <span className="text-rose-600">*</span>
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full pl-9 pr-3 py-2 border border-stone-300 rounded-lg text-xs"
              />
            </div>
          </div>

          {mode !== 'forgot' && (
            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                Password <span className="text-rose-600">*</span>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={6}
                  className="w-full pl-9 pr-3 py-2 border border-stone-300 rounded-lg text-xs"
                />
              </div>
            </div>
          )}

          {mode === 'signup' && (
            <div>
              <label className="block font-semibold text-stone-700 mb-1">City</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Bengaluru, Mumbai, Delhi"
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 bg-stone-900 text-white font-semibold rounded-lg hover:bg-stone-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
          >
            {isSubmitting ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <span>
                  {mode === 'signin' && 'Sign In'}
                  {mode === 'signup' && 'Register Profile'}
                  {mode === 'forgot' && 'Send Reset Link'}
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>

        <div className="pt-2 border-t border-stone-100 flex flex-wrap items-center justify-between text-[11px] text-stone-500">
          {mode === 'signin' && (
            <>
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  clearAuthError();
                  setSuccessMessage(null);
                }}
                className="hover:text-stone-900 underline"
              >
                Need an account? Register
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('forgot');
                  clearAuthError();
                  setSuccessMessage(null);
                }}
                className="hover:text-stone-900"
              >
                Forgot password?
              </button>
            </>
          )}

          {mode === 'signup' && (
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                clearAuthError();
                setSuccessMessage(null);
              }}
              className="hover:text-stone-900 underline"
            >
              Already registered? Sign in
            </button>
          )}

          {mode === 'forgot' && (
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                clearAuthError();
                setSuccessMessage(null);
              }}
              className="hover:text-stone-900 underline"
            >
              Back to sign in
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
