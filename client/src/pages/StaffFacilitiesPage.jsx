import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { apiRequest } from '../api.js';

export function StaffFacilitiesPage() {
  const { isAuthenticated, role } = useAuth();
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // New facility form state (only for organization_admin)
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('Tiruchirappalli');
  const [phone, setPhone] = useState('');
  const [latitude, setLatitude] = useState('10.8050');
  const [longitude, setLongitude] = useState('78.6856');
  const [services, setServices] = useState('Emergency, Emergency Trauma Care, ICU');

  const isOrgAdmin = role === 'organization_admin';

  const loadFacilities = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setError('');
    try {
      const res = await apiRequest('/api/admin/hospitals');
      setFacilities(res.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load facility list.');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadFacilities();
  }, [loadFacilities]);

  async function handleCreateFacility(e) {
    e.preventDefault();
    if (!isOrgAdmin) return;
    setBusy(true);
    setError('');
    setSuccessMsg('');

    try {
      const payload = {
        name: name.trim(),
        address: address.trim(),
        city: city.trim(),
        phone: phone.trim(),
        latitude: Number(latitude),
        longitude: Number(longitude),
        services: services.split(',').map((s) => s.trim()).filter(Boolean),
      };

      await apiRequest('/api/admin/hospitals', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setSuccessMsg(`✓ Facility "${name}" registered as draft. Pending platform verification.`);
      setName('');
      setAddress('');
      setPhone('');
      await loadFacilities();
    } catch (err) {
      setError(err.message || 'Failed to register facility.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDeactivate(facility) {
    if (!window.confirm(`Deactivate ${facility.name}? This removes the facility from public views while preserving history.`)) {
      return;
    }
    setBusy(true);
    setError('');
    setSuccessMsg('');
    try {
      await apiRequest(`/api/admin/hospitals/${facility.id}`, { method: 'DELETE' });
      setSuccessMsg(`✓ Facility "${facility.name}" deactivated.`);
      await loadFacilities();
    } catch (err) {
      setError(err.message || 'Failed to deactivate facility.');
    } finally {
      setBusy(false);
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="staff-page">
        <div className="empty-state">
          <h3>Authentication Required</h3>
          <p>Please sign in to manage facilities.</p>
          <Link to="/staff/login" className="button button-primary">Sign In</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="staff-page">
      <div className="staff-page-header">
        <div>
          <span className="eyebrow">Facility Governance</span>
          <h1>Facility Management</h1>
          <p className="muted">
            Manage profile details, contact information, and registration drafts within your organization.
          </p>
        </div>
        <button type="button" className="button button-outline" onClick={loadFacilities} disabled={loading || busy}>
          {loading ? 'Refreshing…' : '↻ Refresh'}
        </button>
      </div>

      {error && <div className="error-box" role="alert">{error}</div>}
      {successMsg && <div className="success-box" role="status">{successMsg}</div>}

      {/* Role restriction notice for non-admin staff */}
      {!isOrgAdmin && (
        <div className="info-notice">
          <span className="notice-icon" aria-hidden="true">i</span>
          <div>
            <strong>Reporting Role Active:</strong>
            <p>
              Your current account has <strong>facility_reporter</strong> privileges. You can inspect facility profiles and submit bed availability reports. Facility registration and deactivation require <strong>organization_admin</strong> privileges.
            </p>
          </div>
        </div>
      )}

      {/* Facility Registration Form (Organization Admin only) */}
      {isOrgAdmin && (
        <section className="staff-form-card">
          <h2>Register Facility Draft</h2>
          <p className="muted form-subtitle">
            Draft facilities are isolated to your organization and require Platform Verifier review before public directory publication.
          </p>

          <form onSubmit={handleCreateFacility} className="facility-create-form">
            <div className="form-grid">
              <label>
                <span>Facility Name</span>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Srirangam Government Hospital"
                  disabled={busy}
                />
              </label>

              <label>
                <span>Phone / Contact</span>
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0431-2460123"
                  disabled={busy}
                />
              </label>

              <label className="field-wide">
                <span>Street Address</span>
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street name, locality"
                  disabled={busy}
                />
              </label>

              <label>
                <span>City / District</span>
                <input
                  type="text"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  disabled={busy}
                />
              </label>

              <label>
                <span>Coordinates (Latitude, Longitude)</span>
                <div className="coords-input-group">
                  <input
                    type="number"
                    step="any"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    placeholder="Lat"
                    disabled={busy}
                  />
                  <input
                    type="number"
                    step="any"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                    placeholder="Lng"
                    disabled={busy}
                  />
                </div>
              </label>

              <label className="field-wide">
                <span>Clinical Capabilities (comma-separated)</span>
                <input
                  type="text"
                  value={services}
                  onChange={(e) => setServices(e.target.value)}
                  disabled={busy}
                />
              </label>
            </div>

            <div className="form-submit-row">
              <button type="submit" className="button button-primary" disabled={busy}>
                {busy ? 'Registering Draft…' : 'Register Draft Facility'}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Facilities List */}
      <section className="staff-facilities-list-section">
        <h2>Facilities within Organization Scope</h2>
        {loading ? (
          <div className="loading-state"><span className="loader" /> Loading facilities…</div>
        ) : facilities.length === 0 ? (
          <div className="empty-state">
            <p>No facilities registered in this organization.</p>
          </div>
        ) : (
          <div className="staff-facilities-grid">
            {facilities.map((facility) => (
              <div key={facility.id} className="staff-facility-card">
                <div className="facility-card-header">
                  <div>
                    <h3>{facility.name}</h3>
                    <p className="muted">{facility.address}, {facility.city}</p>
                  </div>
                  <span className={`status ${facility.operatingStatus === 'open' ? 'status-open' : 'status-closed'}`}>
                    {facility.operatingStatus === 'open' ? 'Active' : 'Closed'}
                  </span>
                </div>

                <div className="facility-card-meta">
                  <div className="meta-pill">Phone: {facility.phone || 'N/A'}</div>
                  <div className="meta-pill">Status: {facility.verificationStatus || 'Verified'}</div>
                </div>

                <div className="facility-card-actions">
                  <Link
                    to={`/staff/reports?facilityId=${facility.id}`}
                    className="button button-primary button-sm"
                  >
                    Report Bed Capacity
                  </Link>
                  {isOrgAdmin && (
                    <button
                      type="button"
                      className="button button-quiet button-sm danger-text"
                      onClick={() => handleDeactivate(facility)}
                      disabled={busy}
                    >
                      Deactivate
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
