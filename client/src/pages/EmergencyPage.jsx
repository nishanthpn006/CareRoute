import { Link } from 'react-router-dom';
import { getSosTestAction } from '../utils/sos.js';

export function EmergencyPage() {
  const sosAction = getSosTestAction();

  return (
    <main className="page emergency-page">
      {/* Emergency Alert Banner */}
      <section className="emergency-hero-banner" role="region" aria-label="Emergency Call Actions">
        <div className="emergency-hero-header">
          <span className="emergency-large-icon" aria-hidden="true">🚨</span>
          <div>
            <span className="emergency-kicker">Immediate Emergency Response</span>
            <h1>Life-Threatening Emergency Helpline</h1>
            <p className="emergency-lead">
              In a medical or trauma emergency, call official responders immediately. Do not wait for website updates or online triage.
            </p>
          </div>
        </div>

        {/* Primary and Secondary Call Cards */}
        <div className="emergency-cards-container">
          {/* Development Test Action (when active in dev mode) */}
          {sosAction.isOverrideActive && (
            <a
              href={sosAction.telLink}
              className="sos-call-card sos-test-card emergency-page-card"
              id="emergency-page-call-test"
              aria-label="Test call (development only)"
            >
              <div className="sos-card-content">
                <span className="sos-icon-circle sos-test-icon">🧪</span>
                <div className="sos-text">
                  <span className="sos-number">Test Call</span>
                  <span className="sos-label">Test call (development only)</span>
                  <span className="sos-desc">Opens configured test dialler to verify device telephony handling</span>
                </div>
              </div>
              <span className="emergency-call-cta">Test Call ↗</span>
            </a>
          )}

          {/* Primary Action: 112 */}
          <a
            href="tel:112"
            className="sos-call-card sos-primary-card emergency-page-card"
            id="emergency-page-call-112"
            aria-label="Call National Emergency Number 112 immediately"
          >
            <div className="sos-card-content">
              <span className="sos-icon-circle sos-primary-icon">📞</span>
              <div className="sos-text">
                <span className="sos-number">Call 112</span>
                <span className="sos-label">National Unified Emergency Helpline (India)</span>
                <span className="sos-desc">Connects directly to Medical, Police, and Fire rescue services</span>
              </div>
            </div>
            <span className="emergency-call-cta">Tap to Call ↗</span>
          </a>

          {/* Secondary Action: 108 */}
          <a
            href="tel:108"
            className="sos-call-card sos-secondary-card emergency-page-card"
            id="emergency-page-call-108"
            aria-label="Call Tamil Nadu Ambulance Service 108 immediately"
          >
            <div className="sos-card-content">
              <span className="sos-icon-circle sos-secondary-icon">🚑</span>
              <div className="sos-text">
                <span className="sos-number">Call 108 Ambulance</span>
                <span className="sos-label">Tamil Nadu Medical Emergency & Ambulance Response</span>
                <span className="sos-desc">Free government 24/7 ambulance dispatch & emergency transport</span>
              </div>
            </div>
            <span className="emergency-call-cta">Tap to Call ↗</span>
          </a>
        </div>
      </section>

      {/* Honest Prototype Legal & Safety Disclosure */}
      <section className="sos-safety-alert emergency-safety-box" role="alert" aria-label="Prototype notice">
        <strong>⚠️ College Prototype Notice & Limitations</strong>
        <p>
          CareRoute is an academic engineering prototype directory for Tiruchirappalli. It is <strong>not</strong> an emergency dispatch service. CareRoute <strong>cannot</strong> dispatch ambulances, place automatic emergency phone calls, or transmit your device location to first responders. All emergency phone numbers above connect to official government helplines.
        </p>
      </section>

      {/* Desktop Browser Dialer Guidance */}
      <section className="sos-desktop-notice emergency-desktop-box">
        <span className="sos-info-icon" aria-hidden="true">ℹ️</span>
        <div className="sos-desktop-notice-text">
          <strong>Calling from a desktop computer or laptop?</strong>
          <p>
            If your browser lacks a telephony handler, dial <span className="sos-dial-highlight">112</span> or <span className="sos-dial-highlight">108</span> directly on your mobile keypad.
          </p>
        </div>
      </section>

      {/* Additional Healthcare Helplines */}
      <section className="emergency-directory-section" aria-label="Official Helplines">
        <h2>Additional Official Healthcare Helplines</h2>
        <div className="emergency-helpline-grid">
          <div className="helpline-card">
            <strong>104</strong>
            <span>Tamil Nadu Health Helpline</span>
            <p>24/7 medical advice, blood bank assistance, and health information.</p>
            <a href="tel:104" className="helpline-link">Call 104 →</a>
          </div>

          <div className="helpline-card">
            <strong>1098</strong>
            <span>Childline India</span>
            <p>24/7 emergency response and healthcare support for children in distress.</p>
            <a href="tel:1098" className="helpline-link">Call 1098 →</a>
          </div>

          <div className="helpline-card">
            <strong>1077</strong>
            <span>District Disaster Control Room</span>
            <p>Tiruchirappalli district administration disaster & flood helpline.</p>
            <a href="tel:1077" className="helpline-link">Call 1077 →</a>
          </div>
        </div>
      </section>

      {/* Quick Link to Hospital Finder */}
      <section className="emergency-finder-shortcut">
        <div>
          <h3>Need to locate a facility with available ICU or Trauma care?</h3>
          <p>Search verified facilities in Tiruchirappalli with road travel estimates and live capacity.</p>
        </div>
        <Link to="/find-hospitals" className="button button-primary">
          Open Hospital Finder ↗
        </Link>
      </section>
    </main>
  );
}
