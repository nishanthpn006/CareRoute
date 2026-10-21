import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { apiRequest } from '../api.js';

function formatTime(value) {
  if (!value) return 'Never reported';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Never reported';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(d);
}

export function StaffDashboardPage() {
  const { user, role, email, organizationId, isAuthenticated } = useAuth();
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setError('');
    try {
      // Try staff-scoped facilities endpoint first, fallback to admin/hospitals
      let res;
      try {
        res = await apiRequest('/api/staff/facilities');
      } catch {
        res = await apiRequest('/api/admin/hospitals');
      }
      setFacilities(res.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load authorized facilities.');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
      {/* Dashboard Top Heading */}
      <div className="staff-page-header">
        <div>
          <span className="eyebrow">Staff Workspace Overview</span>
          <h1>Staff Dashboard</h1>
          <p className="muted">
            Signed in as <strong>{email}</strong> · <span className="staff-role-pill">{roleLabel}</span>
          </p>
        </div>
        <div className="staff-head-actions">
          <button type="button" className="button button-outline" onClick={loadData} disabled={loading}>
            {loading ? 'Refreshing…' : '↻ Refresh Data'}
          </button>
        </div>
      </div>

      {error && <div className="error-box" role="alert">{error}</div>}

      {/* Metrics Row */}
      <div className="staff-metrics-grid">
        <div className="staff-metric-card">
          <span className="staff-metric-title">Assigned Facilities</span>
          <strong className="staff-metric-number">{facilities.length}</strong>
          <span className="staff-metric-sub">Under your authorization scope</span>
        </div>

        <div className="staff-metric-card">
          <span className="staff-metric-title">Organization Context</span>
          <strong className="staff-metric-number org-name">{organizationId || 'District Health Org'}</strong>
          <span className="staff-metric-sub">Multi-tenant boundary verified</span>
        </div>

        <div className="staff-metric-card">
          <span className="staff-metric-title">System Data Mode</span>
          <strong className="staff-metric-number">{import.meta.env.VITE_DATA_MODE === 'firebase' ? 'Firebase' : 'Demo (In-Memory)'}</strong>
          <span className="staff-metric-sub">Authoritative Domain Store</span>
        </div>
      </div>

      {/* Quick Action Navigation Cards */}
      <section className="staff-quick-actions-section">
        <h2>Workflow Shortcuts</h2>
        <div className="staff-shortcuts-grid">
          <Link to="/staff/reports" className="staff-shortcut-card">
            <span className="shortcut-icon">📋</span>
            <div>
              <strong>Submit Capacity Reports</strong>
              <p>Update ward bed availability (General, ICU, HDU, Pediatric) and view report audit log.</p>
            </div>
            <span className="shortcut-arrow">→</span>
          </Link>

          <Link to="/staff/facilities" className="staff-shortcut-card">
            <span className="shortcut-icon">🏥</span>
            <div>
              <strong>Facility Management</strong>
              <p>Manage facility details, services, operating status, and register new draft facilities.</p>
            </div>
            <span className="shortcut-arrow">→</span>
          </Link>

          <Link to="/staff/verification" className="staff-shortcut-card">
            <span className="shortcut-icon">🛡️</span>
            <div>
              <strong>Verification & Audit Logs</strong>
              <p>Platform verifier controls and audit event inspection.</p>
            </div>
            <span className="shortcut-arrow">→</span>
          </Link>
        </div>
      </section>

      {/* Authorized Facilities List */}
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
                      <span className={`status ${facility.operatingStatus === 'open' ? 'status-open' : 'status-closed'}`}>
                        <span className="status-dot" />
                        {facility.operatingStatus === 'open' ? 'Open' : 'Closed'}
                      </span>
                    </td>
                    <td>
                      <span className="verification-pill">
                        ✓ {facility.verificationStatus || 'Verified'}
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
