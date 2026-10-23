import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { apiRequest } from '../api.js';

function formatShortTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCategory(cat) {
  if (!cat) return 'General';
  return cat.charAt(0).toUpperCase() + cat.slice(1);
}

export function StaffDashboardPage() {
  const { user, role, email, organizationId, isAuthenticated } = useAuth();
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [recentReports, setRecentReports] = useState([]);

  const loadData = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setError('');
    try {
      let res;
      try {
        res = await apiRequest('/api/staff/facilities');
      } catch {
        res = await apiRequest('/api/admin/hospitals');
      }
      const facs = res.data || [];
      setFacilities(facs);

      // Load real report history for the first assigned facility
      if (facs.length > 0) {
        try {
          const reportRes = await apiRequest(`/api/staff/facilities/${facs[0].id}/availability-reports?limit=8`);
          setRecentReports(reportRes.data || []);
        } catch {
          setRecentReports([]);
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to load authorized facilities.');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /* ── derived metrics strictly from real authorized data ── */
  const metrics = useMemo(() => {
    const openCount = facilities.filter((f) => f.operatingStatus === 'open').length;
    const verifiedCount = facilities.filter(
      (f) => (f.verificationStatus || 'verified') === 'verified'
    ).length;
    const totalReports = recentReports.length;
    return { openCount, verifiedCount, totalReports };
  }, [facilities, recentReports]);

  if (!isAuthenticated) {
    return (
      <div className="staff-page">
        <div className="empty-state">
          <h3>Authentication Required</h3>
          <p>You must sign in with an authorized staff account to view this dashboard.</p>
          <Link to="/staff/login" className="button button-primary">
            Sign In to Staff Portal
          </Link>
        </div>
      </div>
    );
  }

  const roleLabel = {
    organization_admin: 'Organization Administrator',
    facility_reporter: 'Facility Reporter',
    platform_verifier: 'Platform Verifier',
    security_admin: 'Security Administrator',
  }[role] || role;

  return (
    <div className="staff-page">
      {/* ───── Page Title Row ───── */}
      <div className="staff-page-header">
        <div>
          <span className="eyebrow">Staff Workspace Overview</span>
          <h1>Staff Dashboard</h1>
          <p className="muted">
            Signed in as <strong>{email}</strong> · <span className="staff-role-pill">{roleLabel}</span>
          </p>
        </div>
        <div className="staff-head-actions">
          <button
            type="button"
            className="button button-outline"
            onClick={loadData}
            disabled={loading}
            title="Refresh data"
          >
            {loading ? 'Refreshing…' : '↻ Refresh Data'}
          </button>
        </div>
      </div>

      {error && <div className="bed-alert-box error" role="alert">{error}</div>}

      {/* ───── Four Metric Cards Row ───── */}
      <div className="staff-metrics-grid">
        {/* Card 1: Operating Facilities */}
        <div className="staff-metric-card">
          <span className="staff-metric-title">Operating Facilities</span>
          <strong className="staff-metric-number">{metrics.openCount} / {facilities.length}</strong>
          <span className="staff-metric-sub">
            {metrics.openCount === facilities.length
              ? `All ${facilities.length} assigned facilities currently open.`
              : `${metrics.openCount} of ${facilities.length} assigned facilities currently open.`}
          </span>
        </div>

        {/* Card 2: Platform Verification */}
        <div className="staff-metric-card">
          <span className="staff-metric-title">Platform Verification</span>
          <strong className="staff-metric-number">{metrics.verifiedCount} / {facilities.length}</strong>
          <span className="staff-metric-sub">
            {metrics.verifiedCount === facilities.length
              ? 'All assigned facilities verified under platform governance.'
              : `${metrics.verifiedCount} of ${facilities.length} assigned facilities verified.`}
          </span>
        </div>

        {/* Card 3: Recent Capacity Reports */}
        <div className="staff-metric-card">
          <span className="staff-metric-title">Recent Capacity Reports</span>
          <strong className="staff-metric-number">{metrics.totalReports}</strong>
          <span className="staff-metric-sub">
            {metrics.totalReports === 0
              ? `No reports on record for ${facilities[0]?.name ? facilities[0].name.split('/')[0].trim() : 'assigned facilities'}.`
              : `${metrics.totalReports} report${metrics.totalReports === 1 ? '' : 's'} on record for ${facilities[0]?.name ? facilities[0].name.split('/')[0].trim() : 'assigned facility'}.`}
          </span>
        </div>

        {/* Card 4: Organization Scope */}
        <div className="staff-metric-card">
          <span className="staff-metric-title">Organization Scope</span>
          <strong className="staff-metric-number org-name">{organizationId || 'District Health Org'}</strong>
          <span className="staff-metric-sub">
            {role === 'organization_admin'
              ? 'Organization administrative scope'
              : role === 'facility_reporter'
              ? `${facilities.length} assigned ${facilities.length === 1 ? 'facility' : 'facilities'} on record`
              : 'Platform governance scope'}
          </span>
        </div>
      </div>

      {/* ───── Facility Activity & Report History (Compact Honest State) ───── */}
      <section className="staff-activity-section">
        <div className="staff-activity-card">
          <div className="staff-activity-header">
            <h2>Recent Facility Capacity Reports</h2>
            <span className="staff-activity-count">
              {recentReports.length > 0 ? `${recentReports.length} recorded` : 'No history yet'}
            </span>
          </div>

          {recentReports.length === 0 ? (
            <div className="staff-empty-activity">
              <p>No recent capacity reports recorded for {facilities[0]?.name ? facilities[0].name.split('/')[0].trim() : 'assigned facilities'}.</p>
              <Link to="/staff/reports" className="button button-outline button-sm">
                Submit Capacity Report →
              </Link>
            </div>
          ) : (
            <div className="staff-activity-table-wrapper">
              <table className="staff-facilities-table">
                <thead>
                  <tr>
                    <th>Report ID</th>
                    <th>Ward Category</th>
                    <th>Available Beds</th>
                    <th>Total Beds</th>
                    <th>Reported Time</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentReports.map((report) => (
                    <tr key={report.reportId || report.id}>
                      <td>
                        <code>{(report.reportId || report.id || '').slice(0, 8)}</code>
                      </td>
                      <td>
                        <strong>{formatCategory(report.category)}</strong>
                      </td>
                      <td>
                        <span className="table-count-strong">{report.availableBeds}</span>
                      </td>
                      <td>
                        <span className="table-count-total">{report.totalBeds}</span>
                      </td>
                      <td>
                        <small className="table-subtext">{formatShortTime(report.reportedAt || report.receivedAt || report.timestamp)}</small>
                      </td>
                      <td>
                        <span className="table-status-published">
                          {report.status === 'accepted' ? '✓ Accepted' : report.status || 'Logged'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* ───── Quick Action Shortcuts ───── */}
      <section className="staff-quick-actions-section">
        <div className="section-heading">
          <h2>Workflow Shortcuts</h2>
        </div>
        <div className="staff-shortcuts-grid">
          <Link to="/staff/reports" className="staff-shortcut-card">
            <span className="shortcut-icon">📋</span>
            <div>
              <strong>Submit Capacity Reports</strong>
              <p>
                {role === 'facility_reporter'
                  ? 'Update ward bed availability (General, ICU, HDU, Pediatric) for your assigned facilities.'
                  : 'Update ward bed availability across organization facilities and inspect audit logs.'}
              </p>
            </div>
            <span className="shortcut-arrow">→</span>
          </Link>

          <Link to="/staff/facilities" className="staff-shortcut-card">
            <span className="shortcut-icon">🏥</span>
            <div>
              <strong>{role === 'organization_admin' ? 'Facility Management' : 'Assigned Facilities'}</strong>
              <p>
                {role === 'organization_admin'
                  ? 'Manage facility details, services, operating status, and register new draft facilities.'
                  : 'View facility details, contact info, and operating status for your assigned facilities.'}
              </p>
            </div>
            <span className="shortcut-arrow">→</span>
          </Link>

          {(role === 'platform_verifier' || role === 'security_admin') && (
            <Link to="/staff/verification" className="staff-shortcut-card">
              <span className="shortcut-icon">🛡️</span>
              <div>
                <strong>Verification & Audit Logs</strong>
                <p>Platform verifier controls and audit event inspection.</p>
              </div>
              <span className="shortcut-arrow">→</span>
            </Link>
          )}
        </div>
      </section>

      {/* ───── Assigned Facilities Table ───── */}
      <section className="staff-facilities-section">
        <div className="section-heading">
          <h2>Assigned Facilities</h2>
          <span className="result-count">{facilities.length} assigned</span>
        </div>

        {loading ? (
          <div className="loading-state"><span className="loader" /> Loading facility list…</div>
        ) : facilities.length === 0 ? (
          <div className="empty-state">
            <p>No authorized facilities assigned to this account.</p>
          </div>
        ) : (
          <div className="staff-facilities-table-wrapper">
            <table className="staff-facilities-table">
              <thead>
                <tr>
                  <th>Facility Name</th>
                  <th>Locality</th>
                  <th>Operating Status</th>
                  <th>Verification</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {facilities.map((facility) => (
                  <tr key={facility.id}>
                    <td>
                      <strong>{facility.name}</strong>
                      <small className="table-subtext">{facility.address}</small>
                    </td>
                    <td>{facility.city || facility.district || 'Tiruchirappalli'}</td>
                    <td>
                      <span className={`status-pill ${facility.operatingStatus === 'open' ? 'status-open' : 'status-closed'}`}>
                        <span className="status-dot" />
                        {facility.operatingStatus === 'open' ? 'Open' : 'Closed'}
                      </span>
                    </td>
                    <td>
                      <span className={`verification-pill verification-pill-${(facility.verificationStatus || 'unverified').toLowerCase()}`}>
                        {facility.verificationStatus === 'verified'
                          ? '✓ Verified'
                          : facility.verificationStatus === 'pending'
                          ? '⏳ Pending'
                          : (facility.verificationStatus || 'Unverified')}
                      </span>
                    </td>
                    <td>
                      <div className="table-actions">
                        <Link
                          to={`/staff/reports?facilityId=${facility.id}`}
                          className="button button-outline button-sm"
                        >
                          Report Capacity →
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
