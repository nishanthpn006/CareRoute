import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <main className="page not-found-page">
      <div className="empty-state not-found-card">
        <div className="not-found-icon">404</div>
        <h1>Page Not Found</h1>
        <p>
          The page or route you requested does not exist or may have been moved.
        </p>

        <div className="not-found-actions">
          <Link to="/" className="button button-primary">
            CareRoute Home
          </Link>
          <Link to="/find-hospitals" className="button button-outline">
            Find Hospitals & Map
          </Link>
          <Link to="/emergency" className="button button-quiet">
            Emergency Assistance
          </Link>
        </div>
      </div>
    </main>
  );
}
