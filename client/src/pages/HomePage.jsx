import { Link } from 'react-router-dom';

function TraumaIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M12 8v8" />
      <path d="M8 12h8" />
    </svg>
  );
}

function CardiacIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      <path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h4.27" />
    </svg>
  );
}

function CriticalCareIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect width="20" height="14" x="2" y="3" rx="2" />
      <path d="M6 10h2l2-3 3 6 2-3h3" />
      <path d="M12 17v4" />
      <path d="M8 21h8" />
    </svg>
  );
}

function SurgeryIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m18 2 4 4" />
      <path d="m14 6 4 4" />
      <path d="M16 4 6.7 13.3a3 3 0 0 0-.9 1.7L5 19l4-.8a3 3 0 0 0 1.7-.9L20 8" />
      <path d="M4 20h2" />
    </svg>
  );
}

function PediatricIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 12h.01" />
      <path d="M15 12h.01" />
      <path d="M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5" />
      <path d="M19 6.3a9 9 0 0 1 1.8 3.9 2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5 1.1 3.5 2.5s-.9 2.5-2 2.5c-.8 0-1.5-.4-1.5-1" />
    </svg>
  );
}

function BreathingIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 4v7" />
      <path d="M12 11c-2-2-4.5-3-7-3-1.7 0-3 1.3-3 3 0 4 3 9 7 9 1.5 0 2.5-.5 3-1.5" />
      <path d="M12 11c2-2 4.5-3 7-3 1.7 0 3 1.3 3 3 0 4-3 9-7 9-1.5 0-2.5-.5-3-1.5" />
    </svg>
  );
}

const EMERGENCY_SERVICES = [
  {
    id: 'trauma',
    label: 'Accidents & Serious Injuries',
    desc: 'Road accidents, major injuries and trauma care',
    query: 'service=Emergency+Trauma+Care',
    iconClass: 'home-cat-icon-trauma',
    Icon: TraumaIcon,
  },
  {
    id: 'cardiac',
    label: 'Heart-Related Emergencies',
    desc: 'Chest pain and suspected heart problems',
    query: 'service=Cardiac+Catheterization',
    iconClass: 'home-cat-icon-cardiac',
    Icon: CardiacIcon,
  },
  {
    id: 'icu',
    label: 'Critical Care',
    desc: 'Severe illness requiring intensive monitoring',
    query: 'bedType=icu',
    iconClass: 'home-cat-icon-icu',
    Icon: CriticalCareIcon,
  },
  {
    id: 'surgery',
    label: 'Urgent Surgical Care',
    desc: 'Emergency assessment for conditions that may require surgery',
    query: 'service=Emergency+Surgical+Suite',
    iconClass: 'home-cat-icon-surgery',
    Icon: SurgeryIcon,
  },
  {
    id: 'pediatric',
    label: 'Child Emergencies',
    desc: 'Urgent medical care for infants and children',
    query: 'bedType=pediatric',
    iconClass: 'home-cat-icon-pediatric',
    Icon: PediatricIcon,
  },
  {
    id: 'oxygen',
    label: 'Breathing Difficulties',
    desc: 'Breathing emergencies and oxygen-support needs',
    query: 'service=Oxygen+Support',
    iconClass: 'home-cat-icon-oxygen',
    Icon: BreathingIcon,
  },
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
            <h2>What kind of emergency care is needed?</h2>
          </div>
          <Link to="/find-hospitals" className="home-section-link">
            View All Facilities →
          </Link>
        </div>
        <div className="home-categories-grid">
          {EMERGENCY_SERVICES.map((cat) => {
            const Icon = cat.Icon;
            return (
              <Link
                key={cat.id}
                to={`/find-hospitals?${cat.query}`}
                className="home-category-card"
                aria-label={`${cat.label}: ${cat.desc}`}
              >
                <div className={`home-cat-icon ${cat.iconClass}`} aria-hidden="true">
                  <Icon />
                </div>
                <div className="home-cat-content">
                  <strong>{cat.label}</strong>
                  <p>{cat.desc}</p>
                </div>
              </Link>
            );
          })}
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
