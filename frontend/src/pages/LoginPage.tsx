import { useState } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { useLogin } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/auth';
import { apiError } from '@/lib/api';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const token = useAuthStore((s) => s.accessToken);
  const login = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const from = (location.state as { from?: string } | null)?.from ?? '/';

  if (token) return <Navigate to={from} replace />;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await login.mutateAsync({ email, password });
      navigate(from, { replace: true });
    } catch (err) {
      setError(apiError(err));
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 to-brand-50 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-lg font-bold text-white">
            DB
          </div>
          <h1 className="text-xl font-semibold text-slate-900">Backup Console</h1>
          <p className="text-sm text-slate-500">Sign in to manage your databases</p>
        </div>

        <form onSubmit={onSubmit} className="card space-y-4 p-6">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          <Input
            label="Email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            required
          />
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
          <Button type="submit" loading={login.isPending} className="w-full">
            Sign in
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-400">
          Enterprise Database Backup, Restore, Import &amp; Export Platform
        </p>
      </div>
    </div>
  );
}
