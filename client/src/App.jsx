import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { PublicLayout } from './layouts/PublicLayout.jsx';
import { StaffLayout } from './layouts/StaffLayout.jsx';

import { HomePage } from './pages/HomePage.jsx';
import { FindHospitalsPage } from './pages/FindHospitalsPage.jsx';
import { HospitalDetailPage } from './pages/HospitalDetailPage.jsx';
import { EmergencyPage } from './pages/EmergencyPage.jsx';
import { StaffLoginPage } from './pages/StaffLoginPage.jsx';
import { StaffDashboardPage } from './pages/StaffDashboardPage.jsx';
import { StaffReportsPage } from './pages/StaffReportsPage.jsx';
import { StaffFacilitiesPage } from './pages/StaffFacilitiesPage.jsx';
import { StaffVerificationPage } from './pages/StaffVerificationPage.jsx';
import { NotFoundPage } from './pages/NotFoundPage.jsx';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
        <Routes>
          {/* Public Patient & Visitor Facing Routes */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/find-hospitals" element={<FindHospitalsPage />} />
            <Route path="/hospitals" element={<FindHospitalsPage />} />
            <Route path="/hospitals/:facilityId" element={<HospitalDetailPage />} />
            <Route path="/emergency" element={<EmergencyPage />} />
            <Route path="/staff/login" element={<StaffLoginPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>

          {/* Authenticated Staff Workspace Routes */}
          <Route element={<StaffLayout />}>
            <Route path="/staff" element={<StaffDashboardPage />} />
            <Route path="/staff/reports" element={<StaffReportsPage />} />
            <Route path="/staff/facilities" element={<StaffFacilitiesPage />} />
            <Route path="/staff/verification" element={<StaffVerificationPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </ThemeProvider>
  );
}
