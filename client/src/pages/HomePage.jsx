import { Link } from 'react-router-dom';

const EMERGENCY_SERVICES = [
  { id: 'trauma', label: 'Trauma & Casualty', desc: 'Accident trauma care & 24/7 triage', query: 'service=Emergency+Trauma+Care' },
  { id: 'cardiac', label: 'Cardiac Emergency', desc: 'Cath lab & acute coronary intervention', query: 'service=Cardiac+Catheterization' },
  { id: 'icu', label: 'ICU / Critical Care', desc: 'Intensive care units with ventilator support', query: 'bedType=icu' },
  { id: 'surgery', label: 'Emergency Surgery', desc: 'Operating suites & emergency surgeon coverage', query: 'service=Emergency+Surgical+Suite' },
  { id: 'pediatric', label: 'Pediatric Care', desc: 'Dedicated child emergency & pediatric beds', query: 'bedType=pediatric' },
  { id: 'oxygen', label: 'Oxygen Support', desc: 'High-flow oxygen beds & respiratory support', query: 'service=Oxygen+Support' },
];

export function HomePage() {
  return (
    <main className="page home-page">
      {/* 3. Compact Home Hero */}
      <section className="home-hero-card" aria-label="CareRoute Welcome">
        <div className="home-hero-badge-row">
          <span className="hero-kicker">
            <span className="hero-pulse" />Tiruchirappalli Pilot Directory
          </span>
          <span className="verified-badge">✓ Verified Healthcare Pilot</span>
        </div>
        <h1>Smart Emergency Hospital Finder & Bed Availability</h1>
        <p className="home-hero-lead">
          CareRoute connects patients and responders in Tiruchirappalli with verified facility capabilities, timestamped ward availability reports, and open-source road routing estimates.
        </p>

        {/* Primary and Secondary Action Buttons */}
        <div className="home-hero-actions">
          <Link to="/find-hospitals" className="button button-primary home-btn-main">
            🔍 Find Hospitals & View Map
          </Link>
          <Link to="/emergency" className="button home-btn-emergency">
            🚨 Emergency Assistance (Call 112 / 108)
          </Link>
        </div>
      </section>

      {/* College Prototype Safety Disclosure */}
      <section className="demo-notice home-prototype-notice" role="note" aria-label="Pilot disclaimer">
        <span className="notice-icon" aria-hidden="true">i</span>
        <div>
          <strong>Tiruchirappalli District Pilot Prototype — Academic Engineering Demonstration</strong>
          <p>
            CareRoute is a capstone engineering prototype for Tiruchirappalli district. Facility profiles and coordinates are verified against official district listings. Bed counts are staff-reported and must be confirmed directly with the facility. CareRoute is <strong>not</strong> an ambulance dispatch service and does not transmit location to emergency responders.
          </p>
        </div>
      </section>

      {/* Quick Emergency Care Categories */}
      <section className="home-section" aria-label="Quick Emergency Care Selection">
        <div className="home-section-header">
          <div>
            <span className="eyebrow">Immediate Needs</span>
            <h2>Emergency Care Categories</h2>
          </div>
          <Link to="/find-hospitals" className="home-section-link">
            View All Facilities →
          </Link>
        </div>
        <div className="home-categories-grid">
          {EMERGENCY_SERVICES.map((cat) => (
            <Link
              key={cat.id}
              to={`/find-hospitals?${cat.query}`}
              className="home-category-card"
            >
              <div className="home-cat-icon">⚡</div>
              <div>
                <strong>{cat.label}</strong>
                <p>{cat.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Availability Reporting & Freshness Lifecycle Explanation */}
      <section className="home-section" aria-label="How CareRoute Availability Works">
        <div className="home-section-header">
          <div>
            <span className="eyebrow">Clinical Accuracy</span>
            <h2>Availability & Report Freshness Lifecycle</h2>
          </div>
        </div>
        <p className="muted home-freshness-intro">
          To prevent misleading patients during medical emergencies, CareRoute never presents unconfirmed or stale capacity as confirmed availability. Every capacity figure is strictly qualified by its report timestamp.
        </p>

        <div className="freshness-explainer-grid">
          <div className="freshness-card freshness-card-fresh">
            <span className="freshness-badge-large fresh-badge">● Fresh (≤15 min)</span>
            <h4>Confirmed Recent Report</h4>
            <p>Reported by verified hospital staff within the last 15 minutes. Displays exact available and total ward counts.</p>
          </div>

          <div className="freshness-card freshness-card-overdue">
            <span className="freshness-badge-large overdue-badge">▲ Overdue (15–60 min)</span>
            <h4>Report Pending Update</h4>
            <p>Past the recommended update window. Historical counts are displayed with an overdue indicator; capacity is not guaranteed.</p>
          </div>

          <div className="freshness-card freshness-card-stale">
            <span className="freshness-badge-large stale-badge">! Stale (&gt;60 min)</span>
            <h4>Unconfirmed Availability</h4>
            <p>Report is over 1 hour old. Any historical count is visibly flagged as unconfirmed and strictly excluded from confirmed available bed tallies.</p>
          </div>

          <div className="freshness-card freshness-card-unknown">
            <span className="freshness-badge-large unknown-badge">○ Unknown</span>
            <h4>Not Reported</h4>
            <p>No recent report on file. Displayed honestly as "Not reported", never misrepresented as a verified count of zero.</p>
          </div>
        </div>
      </section>

      {/* Open-Source Road Travel Note */}
      <section className="method-note home-method-note">
        <div className="method-symbol">🗺️</div>
        <div>
          <strong>Open-Source Map and Road Travel Estimates</strong>
          <p>
            CareRoute relies on OpenStreetMap contributors data and calculates driving route paths, distances, and duration estimates via Project OSRM. Driving travel times are modeled estimates based on road networks, not live traffic dispatch. Where road routing is unavailable, approximate straight-line distance is computed and explicitly labeled.
          </p>
        </div>
      </section>
    </main>
  );
}
