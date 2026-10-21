import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { apiRequest } from '../api.js';

function formatTime(value) {
  if (!value) return 'Unknown';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Unknown';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(d);
}

export function StaffVerificationPage() {
  const { isAuthenticated, role, email } = useAuth();
  const [auditEvents, setAuditEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [verificationBusy, setVerificationBusy] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Facility verification form state
  const [facilityId, setFacilityId] = useState('');
  const [verificationStatus, setVerificationStatus] = useState('verified');
  const [publicationStatus, setPublicationStatus] = useState('published');
  const [notes, setNotes] = useState('Verified against official Tamil Nadu district directory.');

  const isVerifier = role === 'platform_verifier' || role === 'security_admin';

  const loadAuditEvents = useCallback(async () => {
    if (!isAuthenticated || !isVerifier) return;
    setLoading(true);
    setError('');
    try {
      const res = await apiRequest('/api/verifier/audit-events?limit=25');
      setAuditEvents(res.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load audit events.');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, isVerifier]);

  useEffect(() => {
    if (isVerifier) {
      loadAuditEvents();
    }
  }, [isVerifier, loadAuditEvents]);

  async function handleVerificationSubmit(e) {
    e.preventDefault();
    if (!isVerifier || !facilityId) return;
    setVerificationBusy(true);
    setError('');
    setSuccessMsg('');

    try {
      await apiRequest(`/api/verifier/facilities/${facilityId}/verification`, {
        method: 'POST',
        body: JSON.stringify({
          verificationStatus,
          publicationStatus,
          notes,
        }),
      });

      setSuccessMsg(`✓ Verification decision recorded for facility ${facilityId}.`);
      setFacilityId('');
      await loadAuditEvents();
    } catch (err) {
      setError(err.message || 'Verification update failed.');
    } finally {
      setVerificationBusy(false);
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="staff-page">
        <div className="empty-state">
          <h3>Authentication Required</h3>
          <p>Please sign in to access verification controls.</p>
          <Link to="/staff/login" className="button button-primary">Sign In</Link>
        </div>
      </div>
    );
  }

  // If user does not have verifier role, render honest workflow unavailable state
  if (!isVerifier) {
    return (
      <div className="staff-page">
        <div className="staff-page-header">
          <div>
            <span className="eyebrow">Platform Governance</span>
            <h1>Facility Verification & Audit Review</h1>
          </div>
        </div>

        <div className="demo-notice verifier-restricted-notice">
          <span className="notice-icon" aria-hidden="true">🛡️</span>
          <div>
            <strong>Role-Restricted Platform Workflow:</strong>
            <p>
              Facility publication verification and platform-wide audit review are strictly restricted to <strong>platform_verifier</strong> and <strong>security_admin</strong> roles to maintain strict separation of duties.
            </p>
            <p>
              Your current account (<strong>{email}</strong>) has the <strong>{role}</strong> role.
            </p>
            <div className="restricted-actions">
              <p>To test the verification workflow in this demo environment, sign in with the platform verifier account:</p>
              <Link to="/staff/login" className="button button-outline button-sm">
                Switch to Verifier Account (verifier@careroute.local)
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="staff-page">
      <div className="staff-page-header">
        <div>
          <span className="eyebrow">Platform Governance</span>
          <h1>Facility Verification & Audit Review</h1>
          <p className="muted">
            Independent reviewer workspace. Review facility drafts and inspect platform-wide mutation logs.
          </p>
        </div>
        <button type="button" className="button button-outline" onClick={loadAuditEvents} disabled={loading}>
          {loading ? 'Refreshing…' : '↻ Refresh Logs'}
        </button>
      </div>

      {error && <div className="error-box" role="alert">{error}</div>}
      {successMsg && <div className="success-box" role="status">{successMsg}</div>}

      {/* Decision Form */}
      <section className="staff-form-card">
        <h2>Submit Verification Decision</h2>
        <form onSubmit={handleVerificationSubmit} className="verification-form">
          <div className="form-grid">
            <label>
              <span>Target Facility ID</span>
              <input
                type="text"
                required
                value={facilityId}
                onChange={(e) => setFacilityId(e.target.value)}
                placeholder="e.g. fac-apollo-trichy"
                disabled={verificationBusy}
              />
            </label>

            <label>
              <span>Verification Status</span>
              <select
                value={verificationStatus}
                onChange={(e) => setVerificationStatus(e.target.value)}
                disabled={verificationBusy}
              >
                <option value="verified">Verified (Approved)</option>
                <option value="pending">Pending Review</option>
                <option value="rejected">Rejected</option>
              </select>
            </label>

            <label>
              <span>Publication Status</span>
              <select
                value={publicationStatus}
                onChange={(e) => setPublicationStatus(e.target.value)}
                disabled={verificationBusy}
              >
                <option value="published">Published to Public Directory</option>
                <option value="draft">Draft (Restricted to Org)</option>
                <option value="archived">Archived / Unpublished</option>
              </select>
            </label>

            <label className="field-wide">
              <span>Verifier Decision Notes</span>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Official source reference or review rationale"
                disabled={verificationBusy}
              />
            </label>
          </div>

          <div className="form-submit-row">
            <button type="submit" className="button button-primary" disabled={verificationBusy || !facilityId}>
              {verificationBusy ? 'Submitting…' : 'Record Verification Decision'}
            </button>
          </div>
        </form>
      </section>

      {/* System Audit Events Table */}
      <section className="staff-history-section">
        <div className="section-heading">
          <h2>Immutable System Audit Log</h2>
          <span className="result-count">{auditEvents.length} events loaded</span>
        </div>

        {loading ? (
          <div className="loading-state"><span className="loader" /> Loading audit trail…</div>
        ) : auditEvents.length === 0 ? (
          <div className="empty-state">
            <p>No audit events recorded yet.</p>
          </div>
        ) : (
          <div className="staff-facilities-table-wrapper">
            <table className="staff-facilities-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Action / Event</th>
                  <th>Actor UID</th>
                  <th>Target Facility</th>
                  <th>Outcome</th>
                </tr>
              </thead>
              <tbody>
                {auditEvents.map((ev, i) => (
                  <tr key={ev.id || i}>
                    <td>{formatTime(ev.timestamp || ev.createdAt)}</td>
                    <td><strong>{ev.action || ev.type}</strong></td>
                    <td><span className="table-source">{ev.actorUid || ev.actorEmail || 'system'}</span></td>
                    <td>{ev.facilityId || 'N/A'}</td>
                    <td>
                      <span className={ev.status === 'success' || !ev.status ? 'status-open' : 'status-closed'}>
                        {ev.status || 'logged'}
                      </span>
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
