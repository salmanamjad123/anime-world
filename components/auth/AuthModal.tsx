/**
 * Auth Modal
 * Login, Register, and Forgot Password in a clean popup modal
 */

'use client';

import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, LogIn, UserPlus, Mail, Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { signIn, signUp, resetPassword } from '@/lib/firebase/auth';
import { useUserStore } from '@/store/useUserStore';
import { isFirebaseConfigured } from '@/lib/firebase/config';
import { cn } from '@/lib/utils';

type AuthView = 'login' | 'register' | 'forgot' | 'verify';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultView?: AuthView;
}

export function AuthModal({ isOpen, onClose, defaultView = 'login' }: AuthModalProps) {
  const { user } = useUserStore();
  const [view, setView] = useState<AuthView>(defaultView);
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (isOpen && defaultView) {
      setView(defaultView);
      if (defaultView === 'verify' && user?.email) {
        setEmail(user.email);
        // Auto-send verification code when opening for unverified user
        fetch('/api/auth/send-verification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: user.email }),
        })
          .then((res) => res.ok && setSuccess('Verification code sent to your email.'))
          .catch(() => {});
      }
    }
  }, [isOpen, defaultView, user?.email]);
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setDisplayName('');
    setVerificationCode('');
    setError('');
    setSuccess('');
  };

  const switchView = (newView: AuthView) => {
    setView(newView);
    setError('');
    setSuccess('');
    if (newView === 'forgot') setPassword('');
    if (newView === 'verify') setVerificationCode('');
  };

  const handleClose = () => {
    resetForm();
    setView(defaultView);
    onClose();
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('Please enter email and password.');
      return;
    }
    setIsLoading(true);
    try {
      await signIn(email.trim(), password);
      handleClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed. Please try again.';
      const cleanMsg = msg.replace('Firebase: ', '').replace('auth/', '');
      if (msg.includes('verify your email first')) {
        // Unverified user: switch to verify view and send new code
        setView('verify');
        const res = await fetch('/api/auth/send-verification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim() }),
        });
        if (res.ok) {
          setError('');
          setSuccess('We sent a new verification code to your email.');
        } else {
          const data = await res.json();
          setError(data.error || 'Failed to send code. Please try again.');
        }
      } else {
        setError(cleanMsg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('Please enter email and password.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (!displayName.trim()) {
      setError('Please enter a display name.');
      return;
    }
    setIsLoading(true);
    try {
      await signUp(email.trim(), password, displayName.trim());
      // Send verification code
      const res = await fetch('/api/auth/send-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send verification code');
      setView('verify');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed. Please try again.';
      setError(msg.replace('Firebase: ', '').replace('auth/', ''));
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const code = verificationCode.replace(/\D/g, '');
    if (code.length !== 6) {
      setError('Please enter the 6-digit code from your email.');
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed');
      handleClose();
      // Reload so AuthProvider re-runs and picks up the new Firestore user doc
      window.location.reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    setError('');
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/send-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send code');
      setSuccess('New code sent to your email.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to resend.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    setIsLoading(true);
    try {
      await resetPassword(email.trim());
      setSuccess('Check your email for a password reset link.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send reset email.';
      setError(msg.replace('Firebase: ', '').replace('auth/', ''));
    } finally {
      setIsLoading(false);
    }
  };

  const firebaseReady = isFirebaseConfigured();

  return (
    <AnimatePresence>
      {isOpen && (
      <div key="auth-modal" className="fixed inset-0 z-[200] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={handleClose}
          aria-hidden
        />

        {/* Modal */}
        <motion.div
          className="relative w-full max-w-md bg-gray-900 rounded-2xl shadow-2xl border border-gray-700 overflow-hidden"
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="auth-modal-title"
        >
          {/* Close button */}
          <button
            type="button"
            onClick={handleClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors z-10"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header tabs - hide when verifying */}
          {view !== 'verify' && (
          <div className="flex border-b border-gray-800">
            <button
              type="button"
              onClick={() => switchView('login')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-4 text-sm font-medium transition-colors',
                view === 'login'
                  ? 'text-blue-500 border-b-2 border-blue-500 bg-gray-800/50'
                  : 'text-gray-400 hover:text-white'
              )}
            >
              <LogIn className="w-4 h-4" />
              Login
            </button>
            <button
              type="button"
              onClick={() => switchView('register')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-4 text-sm font-medium transition-colors',
                view === 'register'
                  ? 'text-blue-500 border-b-2 border-blue-500 bg-gray-800/50'
                  : 'text-gray-400 hover:text-white'
              )}
            >
              <UserPlus className="w-4 h-4" />
              Register
            </button>
          </div>
          )}

          {/* Content */}
          <div className="p-6">
            <h2 id="auth-modal-title" className="sr-only">
              {view === 'login' && 'Login'}
              {view === 'register' && 'Create account'}
              {view === 'forgot' && 'Reset password'}
              {view === 'verify' && 'Verify email'}
            </h2>

            {!firebaseReady ? (
              <div className="text-center py-8">
                <p className="text-gray-400">Authentication is not configured.</p>
                <p className="text-sm text-gray-500 mt-2">Please set up Firebase to enable login.</p>
              </div>
            ) : (
              <>
                {/* Login */}
                {view === 'login' && (
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                      <label htmlFor="login-email" className="block text-sm font-medium text-gray-300 mb-2">
                        Email
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <Input
                          id="login-email"
                          type="email"
                          placeholder="you@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="pl-10"
                          autoComplete="email"
                        />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="login-password" className="block text-sm font-medium text-gray-300 mb-2">
                        Password
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <Input
                          id="login-password"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="pl-10 pr-10"
                          autoComplete="current-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => switchView('forgot')}
                      className="text-sm text-blue-400 hover:text-blue-300"
                    >
                      Forgot password?
                    </button>
                    {error && <p className="text-sm text-red-400">{error}</p>}
                    <Button type="submit" variant="primary" className="w-full" isLoading={isLoading}>
                      Sign In
                    </Button>
                  </form>
                )}

                {/* Register */}
                {view === 'register' && (
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div>
                      <label htmlFor="reg-email" className="block text-sm font-medium text-gray-300 mb-2">
                        Email
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <Input
                          id="reg-email"
                          type="email"
                          placeholder="you@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="pl-10"
                          autoComplete="email"
                        />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="reg-name" className="block text-sm font-medium text-gray-300 mb-2">
                        Display name
                      </label>
                      <div className="relative">
                        <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <Input
                          id="reg-name"
                          type="text"
                          placeholder="Your name"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          className="pl-10"
                          autoComplete="name"
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="reg-password" className="block text-sm font-medium text-gray-300 mb-2">
                        Password <span className="text-gray-500">(min 6 characters)</span>
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <Input
                          id="reg-password"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="pl-10 pr-10"
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    {error && <p className="text-sm text-red-400">{error}</p>}
                    <Button type="submit" variant="primary" className="w-full" isLoading={isLoading}>
                      Create Account
                    </Button>
                  </form>
                )}

                {/* Verify Code - after registration */}
                {view === 'verify' && (
                  <form onSubmit={handleVerifyCode} className="space-y-4">
                    <div className="text-center mb-4">
                      <ShieldCheck className="w-12 h-12 text-blue-500 mx-auto mb-2" />
                      <p className="text-gray-300">We sent a 6-digit code to</p>
                      <p className="font-medium text-white">{email}</p>
                      <p className="text-sm text-gray-500 mt-1">Enter it below to verify your account.</p>
                    </div>
                    <div>
                      <label htmlFor="verify-code" className="block text-sm font-medium text-gray-300 mb-2">
                        Verification code
                      </label>
                      <Input
                        id="verify-code"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        placeholder="000000"
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                        className="text-center text-lg tracking-[0.5em] font-mono"
                        autoComplete="one-time-code"
                      />
                    </div>
                    {error && <p className="text-sm text-red-400">{error}</p>}
                    {success && <p className="text-sm text-green-400">{success}</p>}
                    <Button type="submit" variant="primary" className="w-full" isLoading={isLoading}>
                      Verify & Continue
                    </Button>
                    <button
                      type="button"
                      onClick={handleResendCode}
                      className="w-full text-sm text-blue-400 hover:text-blue-300"
                    >
                      Resend code
                    </button>
                  </form>
                )}

                {/* Forgot Password */}
                {view === 'forgot' && (
                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <p className="text-gray-400 text-sm">
                      Enter your email and we&apos;ll send you a link to reset your password.
                    </p>
                    <div>
                      <label htmlFor="forgot-email" className="block text-sm font-medium text-gray-300 mb-2">
                        Email
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <Input
                          id="forgot-email"
                          type="email"
                          placeholder="you@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="pl-10"
                          autoComplete="email"
                        />
                      </div>
                    </div>
                    {error && <p className="text-sm text-red-400">{error}</p>}
                    {success && <p className="text-sm text-green-400">{success}</p>}
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        className="flex-1"
                        onClick={() => switchView('login')}
                      >
                        Back
                      </Button>
                      <Button type="submit" variant="primary" className="flex-1" isLoading={isLoading}>
                        Send Reset Link
                      </Button>
                    </div>
                  </form>
                )}
              </>
            )}
          </div>
        </motion.div>
      </div>
      )}
    </AnimatePresence>
  );
}
