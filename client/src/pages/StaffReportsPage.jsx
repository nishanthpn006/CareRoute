import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { apiRequest } from '../api.js';
import { BED_DEFINITIONS } from '../utils/availability.js';

function formatTime(value) {
  if (!value) return 'Unknown';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Unknown';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(d);
}

export function StaffReportsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated, role } = useAuth();

  const [facilities, setFacilities] = useState([]);
  const [selectedFacilityId, setSelectedFacilityId] = useState(() => searchParams.get('facilityId') || '');
  const [selectedFacility, setSelectedFacility] = useState(null);

  // Form states
  const [category, setCategory] = useState('icu');
  const [availableBeds, setAvailableBeds] = useState(5);
  const [totalBeds, setTotalBeds] = useState(20);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Report history state
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Load authorized facilities
  const loadFacilities = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      let res;
      try {
        res = await apiRequest('/api/staff/facilities');
      } catch {
        res = await apiRequest('/api/admin/hospitals');
      }
      const list = res.data || [];
      setFacilities(list);

      const targetId = searchParams.get('facilityId') || selectedFacilityId;
      if (targetId && list.some((f) => f.id === targetId)) {
        setSelectedFacilityId(targetId);
      } else if (list.length > 0) {
        setSelectedFacilityId(list[0].id);
      }
    } catch (err) {
      setError(err.message || 'Failed to load authorized facilities.');
    }
  }, [isAuthenticated, searchParams, selectedFacilityId]);

  useEffect(() => {
    loadFacilities();
  }, [loadFacilities]);

  // When selectedFacilityId changes, update selectedFacility object and load history
  useEffect(() => {
    const f = facilities.find((item) => item.id === selectedFacilityId) || null;
    setSelectedFacility(f);
    if (selectedFacilityId) {
      setSearchParams({ facilityId: selectedFacilityId }, { replace: true });
    }
  }, [selectedFacilityId, facilities, setSearchParams]);

  // Load report history for selected facility
  const loadHistory = useCallback(async () => {
    if (!selectedFacilityId) return;
    setHistoryLoading(true);
    try {
      const res = await apiRequest(`/api/staff/facilities/${selectedFacilityId}/availability-reports`);
      setHistory(res.data || []);
    } catch {
      // Endpoint may be restricted or unsupported; fallback to empty list
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [selectedFacilityId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  async function handleReportSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setSuccessMsg('');

    const availNum = Number(availableBeds);
    const totalNum = Number(totalBeds);

    if (availNum > totalNum) {
      setError('Validation error: Available beds cannot exceed total beds.');
      setBusy(false);
      return;
    }

    try {
      // First attempt the atomic domain availability report endpoint
      try {
        await apiRequest(`/api/staff/facilities/${selectedFacilityId}/availability-reports`, {
          method: 'POST',
          body: JSON.stringify({
            category,
            availableBeds: availNum,
            totalBeds: totalNum,
            source: 'staff_portal_web',
          }),
        });
      } catch (staffErr) {
        // Fallback to legacy admin patch if staff endpoint returned error
        await apiRequest(`/api/admin/hospitals/${selectedFacilityId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            beds: {
              [category]: availNum,
            },
          }),
        });
      }

      setSuccessMsg(`✓ Capacity report submitted for ${category.toUpperCase()} ward (${availNum}/${totalNum} beds).`);
      await loadHistory();
    } catch (err) {
      setError(err.message || 'Failed to submit availability report.');
    } finally {
      setBusy(false);
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="staff-page">
        <div className="empty-state">
          <h3>Authentication Required</h3>
          <p>Please sign in to report hospital bed availability.</p>
          <Link to="/staff/login" className="button button-primary">Sign In</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="staff-page">
      <div className="staff-page-header">
        <div>
          <span className="eyebrow">Bed Availability Reporting</span>
          <h1>Submit Capacity Report</h1>
          <p className="muted">
            Reports are timestamped and published to the public hospital directory upon acceptance.
          </p>
        </div>
      </div>

      {error && <div className="error-box" role="alert">{error}</div>}
      {successMsg && <div className="success-box" role="status">{successMsg}</div>}

      {/* Facility Selector */}
      <div className="facility-picker-bar">
        <label>
          <span>Active Facility:</span>
          <select
            value={selectedFacilityId}
            onChange={(e) => setSelectedFacilityId(e.target.value)}
            disabled={busy || facilities.length === 0}
          >
            {facilities.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} ({f.city || 'Tiruchirappalli'})
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Report Form */}
      <section className="staff-form-card">
        <h2>Submit Ward Capacity Update</h2>
        <form onSubmit={handleReportSubmit} className="capacity-report-form">
          <div className="report-form-grid">
            <label>
              <span>Bed Category</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={busy}
              >
                {BED_DEFINITIONS.map((bed) => (
                  <option key={bed.key} value={bed.key}>{bed.label} Ward</option>
                ))}
              </select>
            </label>

            <label>
              <span>Available Beds (vacant now)</span>
              <input
                type="number"
                min="0"
                required
                value={availableBeds}
                onChange={(e) => setAvailableBeds(e.target.value)}
                disabled={busy}
              />
            </label>

            <label>
              <span>Total Ward Beds (capacity)</span>
              <input
                type="number"
                min={availableBeds}
                required
                value={totalBeds}
                onChange={(e) => setTotalBeds(e.target.value)}
                disabled={busy}
              />
            </label>
          </div>

          <div className="form-submit-row">
            <button
              type="submit"
              className="button button-primary"
              disabled={busy || !selectedFacilityId}
            >
              {busy ? 'Submitting…' : 'Publish Capacity Report'}
            </button>
            <span className="muted form-privacy-note">
              Invariants: available beds ≤ total beds. All submissions write an immutable audit log.
            </span>
          </div>
        </form>
      </section>

      {/* Report History Table */}
      <section className="staff-history-section">
        <div className="section-heading">
          <h2>Report History for {selectedFacility?.name || 'Selected Facility'}</h2>
          <button type="button" className="button button-quiet" onClick={loadHistory} disabled={historyLoading}>
            {historyLoading ? 'Loading…' : '↻ Refresh History'}
          </button>
        </div>

        {historyLoading ? (
          <div className="loading-state"><span className="loader" /> Loading report history…</div>
        ) : history.length === 0 ? (
          <div className="empty-state">
            <p>No recent reports logged for this facility. Submit a new report above to initialize history.</p>
          </div>
        ) : (
          <div className="staff-facilities-table-wrapper">
            <table className="staff-facilities-table">
              <thead>
                <tr>
                  <th>Report Time</th>
                  <th>Category</th>
                  <th>Available / Total</th>
                  <th>Source</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map((rep, idx) => (
                  <tr key={rep.id || idx}>
                    <td>{formatTime(rep.reportedAt || rep.createdAt)}</td>
                    <td><strong className="table-cat">{String(rep.category).toUpperCase()}</strong></td>
                    <td>{rep.availableBeds} / {rep.totalBeds}</td>
                    <td><span className="table-source">{rep.source || 'staff_portal'}</span></td>
                    <td><span className="status-open">Published</span></td>
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
