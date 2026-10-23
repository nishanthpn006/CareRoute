import { useState } from 'react';
import { NavLink, Link, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { EmergencySOSModal, SOSHeaderButton, SOSMobileFloatingButton } from '../components/EmergencySOSModal.jsx';
import { ThemeToggle } from '../components/ThemeToggle.jsx';
import { getSosTestAction } from '../utils/sos.js';

export function PublicLayout() {
  const { isAuthenticated, user } = useAuth();
  const [sosModalOpen, setSosModalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const sosAction = getSosTestAction();

  return (
    <div className="app-shell">
      {/* Public Header */}
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="brand" aria-label="CareRoute Home">
            <span className="brand-mark">CR</span>
            <span>
              <strong>CareRoute</strong>
              <small>Emergency care finder</small>
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="public-nav" aria-label="Main Navigation">
            <NavLink
              to="/"
              end
              className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}
            >
              Home
            </NavLink>
            <NavLink
              to="/find-hospitals"
              className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}
            >
              Find Hospitals
            </NavLink>
            <NavLink
              to="/emergency"
              className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}
            >
              Emergency Assistance
            </NavLink>
          </nav>

          <div className="topbar-actions">
            <SOSHeaderButton onClick={() => setSosModalOpen(true)} />
            {sosAction.isOverrideActive && (
              <button
                type="button"
                className="button button-quiet button-sm sos-modal-open-btn"
                onClick={() => setSosModalOpen(true)}
                title="View official emergency numbers 112 & 108"
                aria-label="View official emergency numbers 112 & 108"
              >
                112 / 108
              </button>
            )}

            {/* Application-Wide Light / Dark Theme Toggle */}
            <ThemeToggle variant="header" id="public-header-theme-toggle" />

            {isAuthenticated ? (
              <Link to="/staff" className="button button-outline staff-link-btn" title={`Signed in as ${user?.email}`}>
                Staff Portal ↗
              </Link>
            ) : (
              <Link to="/staff/login" className="button button-outline staff-link-btn">
                Staff Sign In
              </Link>
            )}

            {/* Mobile Menu Toggle Button */}
            <button
              type="button"
              className="mobile-menu-btn"
              onClick={() => setMobileMenuOpen((o) => !o)}
              aria-label="Toggle navigation menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer / Dropdown */}
        {mobileMenuOpen && (
          <nav className="mobile-nav-drawer" aria-label="Mobile Navigation">
            <NavLink
              to="/"
              end
              className={({ isActive }) => `mobile-nav-link ${isActive ? 'mobile-nav-active' : ''}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              Home
            </NavLink>
            <NavLink
              to="/find-hospitals"
              className={({ isActive }) => `mobile-nav-link ${isActive ? 'mobile-nav-active' : ''}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              Find Hospitals
            </NavLink>
            <NavLink
              to="/emergency"
              className={({ isActive }) => `mobile-nav-link ${isActive ? 'mobile-nav-active' : ''}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              Emergency Assistance
            </NavLink>
            <hr className="mobile-nav-divider" />
            <ThemeToggle
              variant="mobile"
              id="public-mobile-theme-toggle"
              onClick={() => setMobileMenuOpen(false)}
            />
            {isAuthenticated ? (
              <Link
                to="/staff"
                className="mobile-nav-link mobile-staff-link"
                onClick={() => setMobileMenuOpen(false)}
              >
                Staff Portal ({user?.email})
              </Link>
            ) : (
              <Link
                to="/staff/login"
                className="mobile-nav-link mobile-staff-link"
                onClick={() => setMobileMenuOpen(false)}
              >
                Staff Sign In
              </Link>
            )}
          </nav>
        )}
      </header>

      {/* Main Page Content */}
      <Outlet />

      {/* Public Footer */}
      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-brand-section">
            <Link to="/" className="brand" aria-label="CareRoute home">
              <span className="brand-mark">CR</span>
              <span>
                <strong>CareRoute</strong>
                <small>Emergency care finder</small>
              </span>
            </Link>
            <p className="footer-description">
              CareRoute Tiruchirappalli Pilot Prototype · Official facilities directory and capacity reporting. Verify availability directly with facilities before travel.
            </p>
          </div>
          <nav className="footer-links" aria-label="Footer Navigation">
            <Link to="/">Home</Link>
            <Link to="/find-hospitals">Find Hospitals</Link>
            <Link to="/emergency">Emergency SOS</Link>
            <Link to="/staff/login">Staff Portal</Link>
          </nav>
        </div>
      </footer>

      {/* Emergency SOS Modal (Always available) */}
      <EmergencySOSModal
        isOpen={sosModalOpen}
        onClose={() => setSosModalOpen(false)}
      />

      {/* Persistent floating SOS action on mobile */}
      <SOSMobileFloatingButton
        onClick={() => setSosModalOpen(true)}
      />
    </div>
  );
}
