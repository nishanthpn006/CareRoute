import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const DEMO_PRESETS = [
  {
    label: 'Facility Reporter (MGM GH)',
    email: 'reporter.mgm@careroute.local',
    role: 'facility_reporter',
  },
  {
    label: 'Organization Admin (Trichy Health)',
    email: 'admin.trichy@careroute.local',
    role: 'organization_admin',
  },
  {
    label: 'Platform Verifier',
    email: 'verifier@careroute.local',
    role: 'platform_verifier',
  },
];

export function StaffLoginPage() {
  const { login, busy, error, isFirebaseMode, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState(() => (isFirebaseMode ? '' : 'admin.trichy@careroute.local'));
  const [password, setPassword] = useState(() => (isFirebaseMode ? '' : 'demo-password-123'));
  const [localError, setLocalError] = useState('');

  const destination = location.state?.from || '/staff';

  // If already authenticated, redirect immediately
  if (isAuthenticated) {
    navigate('/staff', { replace: true });
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLocalError('');
    try {
      await login(email, password);
      navigate(destination, { replace: true });
    } catch (err) {
      setLocalError(err.message || 'Login failed.');
    }
  }

  function applyPreset(preset) {
    setEmail(preset.email);
    setPassword('demo-password-123');
    setLocalError('');
  }

  return (
    <main className="page auth-page">
      <div className="admin-login">
        <span className="eyebrow">CareRoute Staff Portal</span>
        <h2>Authorized Personnel Sign In</h2>
        <p>
          Secure workspace for facility reporters, organization administrators, and platform verifiers.
        </p>

        {(error || localError) && (
          <div className="error-box" role="alert">
            {localError || error}
          </div>
        )}

        {/* Demo Mode Quick Credentials Selector */}
        {!isFirebaseMode && (
          <div className="demo-credentials-box">
            <span className="demo-credentials-title">Demo Mode Roles (Click to fill):</span>
            <div className="demo-presets-list">
              {DEMO_PRESETS.map((p) => (
                <button
                  key={p.email}
                  type="button"
                  className="button button-outline button-sm preset-btn"
                  onClick={() => applyPreset(p)}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <small className="hint">Password pre-filled: <code>demo-password-123</code></small>
          </div>
        )}

        <form onSubmit={handleSubmit} className="form-stack">
          <label>
            <span>Staff Email Address</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. reporter@hospital.gov.in"
              autoComplete="username"
            />
          </label>

          <label>
            <span>Password</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </label>

          <button
            type="submit"
            className="button button-primary submit-auth-btn"
            disabled={busy}
          >
            {busy ? 'Authenticating…' : 'Sign in to Staff Workspace'}
          </button>
        </form>

        <div className="auth-footer-note">
          <p className="muted">
            Authorization and facility tenancy are enforced cryptographically by the server. Only assigned facilities can be updated.
          </p>
        </div>
      </div>

      <div className="auth-page-back">
        <Link to="/find-hospitals" className="button button-quiet">
          ← Return to Public Hospital Finder
        </Link>
      </div>
    </main>
  );
}
