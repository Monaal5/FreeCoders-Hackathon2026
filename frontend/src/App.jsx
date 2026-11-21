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

function ProtectedRoute({ children, allowedRoles }) {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user?.role?.toUpperCase())) {
    // Redirect to default page for their role
    if (user?.role === 'TECHNICIAN') {
      return <Navigate to="/surveys" replace />;
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
    return <Navigate to="/surveys" replace />;
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
