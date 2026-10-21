import { useState } from 'react';
import { NavLink, Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export function StaffLayout() {
  const { user, isAuthenticated, role, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  async function handleLogout() {
    await logout();
    navigate('/staff/login');
  }

  // Format human-friendly role name
  const roleDisplay = {
    organization_admin: 'Organization Administrator',
    facility_reporter: 'Facility Reporter',
    platform_verifier: 'Platform Verifier',
    security_admin: 'Security Administrator',
  }[role] || role || 'Authorized Staff';

  return (
    <div className="staff-workspace">
      {/* Staff Workspace Desktop Sidebar */}
      <aside className="staff-sidebar">
        <div className="staff-sidebar-header">
          <Link to="/" className="brand" aria-label="CareRoute Home">
            <span className="brand-mark staff-brand-mark">CR</span>
            <span>
              <strong>CareRoute</strong>
              <small className="staff-portal-label">Staff Portal</small>
            </span>
          </Link>
        </div>

        {/* User Context Card */}
        {isAuthenticated ? (
          <div className="staff-user-card">
            <div className="staff-user-avatar">{user.email?.[0]?.toUpperCase() || 'U'}</div>
            <div className="staff-user-meta">
              <strong className="staff-user-email" title={user.email}>{user.email}</strong>
              <span className="staff-role-badge">{roleDisplay}</span>
              {user.organizationId && (
                <small className="staff-org-label">Org: {user.organizationId}</small>
              )}
            </div>
          </div>
        ) : (
          <div className="staff-user-card unauth-card">
            <p>You are viewing the staff workspace in unauthenticated mode.</p>
            <Link to="/staff/login" className="button button-primary button-sm">
              Sign in to manage
            </Link>
          </div>
        )}

        {/* Sidebar Navigation */}
        <nav className="staff-sidebar-nav" aria-label="Staff Navigation">
          <NavLink
            to="/staff"
            end
            className={({ isActive }) => `staff-nav-item ${isActive ? 'active' : ''}`}
          >
            <span className="staff-nav-icon">📊</span>
            <span>Dashboard Overview</span>
          </NavLink>
          <NavLink
            to="/staff/reports"
            className={({ isActive }) => `staff-nav-item ${isActive ? 'active' : ''}`}
          >
            <span className="staff-nav-icon">📋</span>
            <span>Availability Reports</span>
          </NavLink>
          <NavLink
            to="/staff/facilities"
            className={({ isActive }) => `staff-nav-item ${isActive ? 'active' : ''}`}
          >
            <span className="staff-nav-icon">🏥</span>
            <span>Facility Management</span>
          </NavLink>
          <NavLink
            to="/staff/verification"
            className={({ isActive }) => `staff-nav-item ${isActive ? 'active' : ''}`}
          >
            <span className="staff-nav-icon">🛡️</span>
            <span>Verification & Audit</span>
          </NavLink>
        </nav>

        {/* Sidebar Footer Actions */}
        <div className="staff-sidebar-footer">
          <Link to="/find-hospitals" className="staff-nav-item public-return-link">
            <span className="staff-nav-icon">↗</span>
            <span>Public Hospital Finder</span>
          </Link>
          {isAuthenticated && (
            <button
              type="button"
              className="staff-nav-item staff-logout-btn"
              onClick={handleLogout}
            >
              <span className="staff-nav-icon">🚪</span>
              <span>Sign Out</span>
            </button>
          )}
        </div>
      </aside>

      {/* Staff Workspace Main Content Area */}
      <div className="staff-main-area">
        {/* Mobile Header for Staff Layout */}
        <header className="staff-mobile-topbar">
          <div className="staff-mobile-topbar-inner">
            <Link to="/" className="brand" aria-label="CareRoute Home">
              <span className="brand-mark staff-brand-mark">CR</span>
              <span>
                <strong>CareRoute</strong>
                <small className="staff-portal-label">Staff Portal</small>
              </span>
            </Link>
            <button
              type="button"
              className="mobile-menu-btn"
              onClick={() => setMobileMenuOpen((o) => !o)}
              aria-label="Toggle staff menu"
            >
              {mobileMenuOpen ? '✕' : '☰'}
            </button>
          </div>

          {mobileMenuOpen && (
            <nav className="staff-mobile-menu" aria-label="Mobile Staff Navigation">
              {isAuthenticated && (
                <div className="staff-mobile-user">
                  <strong>{user.email}</strong>
                  <span>{roleDisplay}</span>
                </div>
              )}
              <NavLink
                to="/staff"
                end
                className={({ isActive }) => `staff-mobile-nav-link ${isActive ? 'active' : ''}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                Dashboard Overview
              </NavLink>
              <NavLink
                to="/staff/reports"
                className={({ isActive }) => `staff-mobile-nav-link ${isActive ? 'active' : ''}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                Availability Reports
              </NavLink>
              <NavLink
                to="/staff/facilities"
                className={({ isActive }) => `staff-mobile-nav-link ${isActive ? 'active' : ''}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                Facility Management
              </NavLink>
              <NavLink
                to="/staff/verification"
                className={({ isActive }) => `staff-mobile-nav-link ${isActive ? 'active' : ''}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                Verification & Audit
              </NavLink>
              <hr className="mobile-nav-divider" />
              <Link
                to="/find-hospitals"
                className="staff-mobile-nav-link"
                onClick={() => setMobileMenuOpen(false)}
              >
                Public Hospital Finder
              </Link>
              {isAuthenticated ? (
                <button
                  type="button"
                  className="staff-mobile-nav-link staff-logout-text"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleLogout();
                  }}
                >
                  Sign Out
                </button>
              ) : (
                <Link
                  to="/staff/login"
                  className="staff-mobile-nav-link"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Sign In
                </Link>
              )}
            </nav>
          )}
        </header>

        {/* Content Outlet */}
        <main className="staff-content-outlet">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
