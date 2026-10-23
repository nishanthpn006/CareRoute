import { useEffect, useRef } from 'react';
import { getSosTestAction } from '../utils/sos.js';

/**
 * EmergencySOSModal — Patient-First Emergency SOS Modal
 * 
 * Direct emergency access to national (112) and ambulance (108) services,
 * with support for configured development-only test telephone numbers.
 * 
 * Strict Safety Invariants:
 * - Real tel: links (tel:112 and tel:108).
 * - When in development mode with VITE_SOS_TEST_NUMBER, provides a clearly labeled
 *   "Test Call — Personal Number" action without labeling private numbers as Call 112.
 * - In production builds, the private-number override is disabled and official 112/108 remain.
 * - Accessible before login, before search, and before location permission.
 * - Honest prototype disclaimer: CareRoute is an academic demonstration, not an emergency dispatch service.
 * - Does not auto-dial, simulate call success, dispatch ambulances, or track location on click.
 * - Explains desktop dialing requirements for devices without a default telephony handler.
 */
export function EmergencySOSModal({ isOpen, onClose }) {
  const modalRef = useRef(null);
  const primaryActionRef = useRef(null);
  const sosAction = getSosTestAction();

  // Keyboard accessibility: ESC key to close, and focus management
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    // Focus the primary action button for immediate keyboard accessibility
    const timer = setTimeout(() => {
      if (primaryActionRef.current) {
        primaryActionRef.current.focus();
      }
    }, 50);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timer);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="sos-modal-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="sos-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sos-modal-title"
        aria-describedby="sos-modal-desc"
        ref={modalRef}
      >
        <div className="sos-modal-header">
          <div className="sos-modal-title-group">
            <span className="sos-badge-icon" aria-hidden="true">🚨</span>
            <div>
              <h2 id="sos-modal-title" className="sos-modal-title">
                Immediate Emergency Assistance
              </h2>
              <span className="sos-modal-subtitle">Direct Emergency Phone Links</span>
            </div>
          </div>
          <button
            type="button"
            className="sos-close-btn"
            onClick={onClose}
            aria-label="Close emergency modal"
          >
            ✕
          </button>
        </div>

        {/* Prototype safety disclosure */}
        <div className="sos-safety-alert" role="alert">
          <strong>⚠️ College Demo / Prototype Notice</strong>
          <p id="sos-modal-desc">
            CareRoute is an academic prototype directory for Tiruchirappalli. It is <strong>not</strong> an emergency dispatch service and does <strong>not</strong> dispatch ambulances or transmit your location to first responders.
          </p>
        </div>

        {/* Emergency Call Actions */}
        <div className="sos-actions-group">
          {/* Development-Only Test Action (Rendered only when active) */}
          {sosAction.isOverrideActive && (
            <a
              ref={primaryActionRef}
              href={sosAction.telLink}
              className="sos-call-card sos-test-card"
              id="sos-call-test-btn"
              aria-label="Test call (development only)"
            >
              <div className="sos-card-content">
                <span className="sos-icon-circle sos-test-icon">🧪</span>
                <div className="sos-text">
                  <span className="sos-number">Test Call</span>
                  <span className="sos-label">Test call (development only)</span>
                  <span className="sos-desc">Opens configured test dialler to verify link handling</span>
                </div>
              </div>
              <span className="sos-arrow" aria-hidden="true">↗</span>
            </a>
          )}

          {/* Primary Action: 112 (Always available as official responder option) */}
          <a
            ref={!sosAction.isOverrideActive ? primaryActionRef : undefined}
            href="tel:112"
            className="sos-call-card sos-primary-card"
            id="sos-call-112-btn"
            aria-label="Call National Emergency Number 112 immediately"
          >
            <div className="sos-card-content">
              <span className="sos-icon-circle sos-primary-icon">📞</span>
              <div className="sos-text">
                <span className="sos-number">Call 112</span>
                <span className="sos-label">National Emergency Helpline (India)</span>
                <span className="sos-desc">Police · Fire · Medical Emergency Services</span>
              </div>
            </div>
            <span className="sos-arrow" aria-hidden="true">↗</span>
          </a>

          {/* Secondary Action: 108 (Always available as ambulance service option) */}
          <a
            href="tel:108"
            className="sos-call-card sos-secondary-card"
            id="sos-call-108-btn"
            aria-label="Call Medical Ambulance Service 108 immediately"
          >
            <div className="sos-card-content">
              <span className="sos-icon-circle sos-secondary-icon">🚑</span>
              <div className="sos-text">
                <span className="sos-number">Call 108 Ambulance</span>
                <span className="sos-label">Tamil Nadu Medical Emergency & Ambulance</span>
                <span className="sos-desc">Free government emergency response & patient transport</span>
              </div>
            </div>
            <span className="sos-arrow" aria-hidden="true">↗</span>
          </a>
        </div>

        {/* Desktop Browser Dialer Guidance */}
        <div className="sos-desktop-notice">
          <span className="sos-info-icon" aria-hidden="true">ℹ️</span>
          <div className="sos-desktop-notice-text">
            <strong>Calling from a desktop computer or laptop?</strong>
            <p>
              If your browser or device lacks a phone app, pick up your mobile phone and dial <span className="sos-dial-highlight">112</span> or <span className="sos-dial-highlight">108</span> directly.
            </p>
          </div>
        </div>

        <div className="sos-modal-footer">
          <button
            type="button"
            className="button button-quiet sos-dismiss-btn"
            onClick={onClose}
          >
            Return to hospital finder
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * SOSHeaderButton — Topbar SOS Trigger
 * 
 * In development mode with a test number configured, renders an anchor link
 * using `tel:<configured-number>` and labeled "Test call (development only)".
 * In production or without a valid test number, renders the official "SOS / Call 112"
 * button that triggers the emergency modal dialog.
 */
export function SOSHeaderButton({ onClick }) {
  const sosAction = getSosTestAction();

  if (sosAction.isOverrideActive) {
    return (
      <a
        href={sosAction.telLink}
        className="sos-header-trigger sos-header-test-trigger"
        id="header-sos-btn"
        aria-label="Test call (development only)"
      >
        <span className="sos-beacon sos-beacon-test" aria-hidden="true" />
        <span className="sos-btn-text">Test call (development only)</span>
      </a>
    );
  }

  return (
    <button
      type="button"
      className="sos-header-trigger"
      onClick={onClick}
      id="header-sos-btn"
      aria-label="Emergency SOS - Call 112 or 108"
      aria-haspopup="dialog"
    >
      <span className="sos-beacon" aria-hidden="true" />
      <span className="sos-btn-text">SOS / Call 112</span>
    </button>
  );
}

/**
 * SOSMobileFloatingButton — Persistent floating emergency button on small screens
 * 
 * Follows the same development-versus-production rules as the header action.
 */
export function SOSMobileFloatingButton({ onClick }) {
  const sosAction = getSosTestAction();

  if (sosAction.isOverrideActive) {
    return (
      <a
        href={sosAction.telLink}
        className="sos-floating-mobile-trigger sos-floating-test-trigger"
        id="mobile-floating-sos-btn"
        aria-label="Test call (development only)"
      >
        <span className="sos-floating-icon">🧪</span>
        <span className="sos-floating-label">Test Call</span>
      </a>
    );
  }

  return (
    <button
      type="button"
      className="sos-floating-mobile-trigger"
      onClick={onClick}
      id="mobile-floating-sos-btn"
      aria-label="Emergency SOS - Immediate emergency numbers"
      aria-haspopup="dialog"
    >
      <span className="sos-floating-icon">🚨</span>
      <span className="sos-floating-label">SOS 112</span>
    </button>
  );
}
