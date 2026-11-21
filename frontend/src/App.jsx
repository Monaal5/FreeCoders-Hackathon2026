import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import PublicEnquiry from './pages/PublicEnquiry';
import LeadInbox from './pages/LeadInbox';
import LeadDetail from './pages/LeadDetail';
import TechnicianSurveys from './pages/TechnicianSurveys';
import SurveyForm from './pages/SurveyForm';
import QuoteBuilder from './pages/QuoteBuilder';
import QuoteView from './pages/QuoteView';
import OrdersList from './pages/OrdersList';
import OrderDetail from './pages/OrderDetail';
import WarehouseScan from './pages/WarehouseScan';
import InventoryPage from './pages/InventoryPage';
import CrewSchedule from './pages/CrewSchedule';
import QrLabels from './pages/QrLabels';
import FieldToday from './pages/FieldToday';
import InstallJob from './pages/InstallJob';
import RevenueDashboard from './pages/RevenueDashboard';
import CustomerPortal from './pages/CustomerPortal';

function ProtectedRoute({ children, allowedRoles }) {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user?.role?.toUpperCase())) {
    // Redirect to default page for their role
    if (user?.role === 'TECHNICIAN') {
      return <Navigate to="/today" replace />;
    }
    return <Navigate to="/leads" replace />;
  }

  return children;
}

function RootRedirect() {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  if (user?.role === 'TECHNICIAN') {
    return <Navigate to="/today" replace />;
  }
  return <Navigate to="/leads" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
          <Navbar />
          <main className="flex-1">
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/enquiry" element={<PublicEnquiry />} />
              <Route path="/portal/:orderNumber" element={<CustomerPortal />} />
              <Route path="/track/:orderNumber" element={<CustomerPortal />} />

              {/* Revenue & Profitability Analytics */}
              <Route
                path="/admin/revenue"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'STAFF']}>
                    <RevenueDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/revenue"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'STAFF']}>
                    <RevenueDashboard />
                  </ProtectedRoute>
                }
              />

              {/* Protected Staff & Admin Lead Management Routes */}
              <Route
                path="/leads"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'STAFF']}>
                    <LeadInbox />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/leads/:id"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'STAFF']}>
                    <LeadDetail />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/leads/:leadId/quote"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'STAFF']}>
                    <QuoteBuilder />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/quotes/:id"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'STAFF']}>
                    <QuoteView />
                  </ProtectedRoute>
                }
              />

              {/* Phase 2: Order, Inventory & Dispatch Routes */}
              <Route
                path="/orders"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'STAFF']}>
                    <OrdersList />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/orders/:id"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'STAFF', 'TECHNICIAN']}>
                    <OrderDetail />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/orders/:id/scan"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'STAFF']}>
                    <WarehouseScan />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/inventory"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'STAFF']}>
                    <InventoryPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/inventory/labels"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'STAFF']}>
                    <QrLabels />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/jobs"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'STAFF', 'TECHNICIAN']}>
                    <CrewSchedule />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/schedule"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'STAFF', 'TECHNICIAN']}>
                    <CrewSchedule />
                  </ProtectedRoute>
                }
              />

              {/* Technician Routes (also accessible to admin/staff for review) */}
              <Route
                path="/surveys"
                element={
                  <ProtectedRoute allowedRoles={['TECHNICIAN', 'ADMIN', 'STAFF']}>
                    <TechnicianSurveys />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/surveys/:id/execute"
                element={
                  <ProtectedRoute allowedRoles={['TECHNICIAN', 'ADMIN', 'STAFF']}>
                    <SurveyForm />
                  </ProtectedRoute>
                }
              />

              {/* Phase 3: on-site installation (phone screens) */}
              <Route
                path="/today"
                element={
                  <ProtectedRoute allowedRoles={['TECHNICIAN']}>
                    <FieldToday />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/field/jobs/:id"
                element={
                  <ProtectedRoute allowedRoles={['TECHNICIAN', 'ADMIN']}>
                    <InstallJob />
                  </ProtectedRoute>
                }
              />

              {/* Fallback Root */}
              <Route path="/" element={<RootRedirect />} />
              <Route path="*" element={<RootRedirect />} />
            </Routes>
          </main>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}
