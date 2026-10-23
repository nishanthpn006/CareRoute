import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const DEMO_PRESETS = [
  {
    label: 'Facility Reporter (MGM GH)',
    email: 'reporter@mgmgh.local',
    role: 'facility_reporter',
  },
  {
    label: 'Org Admin (Govt Hospitals)',
    email: 'admin@careroute.local',
    role: 'organization_admin',
  },
  {
    label: 'Org Admin (Apollo Trichy)',
    email: 'admin@apollo-trichy.local',
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

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRoleEmail, setSelectedRoleEmail] = useState('');
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
    setSelectedRoleEmail(preset.email);
    setLocalError('');
  }

  return (
    <main className="page auth-page">
      <div className="admin-login">
        <span className="eyebrow">CareRoute Staff Portal</span>
        <h2>Authorized Personnel Sign In</h2>
        <p className="auth-description">
          Secure workspace for facility reporters, organization administrators, and platform verifiers.
        </p>

        {(error || localError) && (
          <div className="error-box" role="alert">
            {localError || error}
          </div>
        )}

        {/* Demo Mode Quick Credentials Selector */}
        {!isFirebaseMode && (
          <>
            <div className="demo-credentials-box">
              <span className="demo-credentials-title">Demo Mode Roles (Click to fill email):</span>
              <div className="demo-presets-grid" role="group" aria-label="Demo role quick selection">
                {DEMO_PRESETS.map((p) => {
                  const isSelected = selectedRoleEmail === p.email && email === p.email;
                  return (
                    <button
                      key={p.email}
                      type="button"
                      className={`preset-btn ${isSelected ? 'preset-btn-selected' : ''}`}
                      onClick={() => applyPreset(p)}
                      aria-pressed={isSelected}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
              <p className="demo-credentials-hint">
                Choose a demo role to fill the email field. Enter the password supplied for your demo environment.
              </p>
            </div>

            <div className="demo-password-row" aria-label="Demo environment credentials">
              <span className="demo-password-label">Demo Password:</span>
              <code className="demo-password-val" title="Selectable demo password">demo-password-123</code>
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} className="auth-form-stack">
          <label className="auth-field-label" htmlFor="staff-email">
            <span className="field-label-text">Staff Email Address</span>
            <input
              id="staff-email"
              type="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (selectedRoleEmail && e.target.value !== selectedRoleEmail) {
                  setSelectedRoleEmail('');
                }
              }}
              placeholder="e.g. reporter@mgmgh.local"
              autoComplete="username"
              className="auth-input"
            />
          </label>

          <label className="auth-field-label" htmlFor="staff-password">
            <span className="field-label-text">Password</span>
            <input
              id="staff-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              className="auth-input"
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
            Your access is limited by your role and assigned facilities.
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
