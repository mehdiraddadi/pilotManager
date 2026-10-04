import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { CompanyGate } from './components/CompanyGate';
import { AuthProvider } from './context/AuthContext';
import { Clients } from './pages/Clients';
import { Company } from './pages/Company';
import { Dashboard } from './pages/Dashboard';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { VerifyEmail } from './pages/VerifyEmail';
import { Resources } from './pages/Resources';
import { Projects } from './pages/Projects';
import { Intermediaries } from './pages/Intermediaries';
import { Timesheets } from './pages/Timesheets';
import { Invoices } from './pages/Invoices';
import { Team } from './pages/Team';

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Layout>
                <CompanyGate>
                  <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/company" element={<Company />} />
                      <Route path="/clients" element={<Clients />} />
                      <Route path="/projects" element={<Projects />} />
                      <Route path="/intermediaries" element={<Intermediaries />} />
                      <Route path="/resources" element={<Resources />} />
                      <Route path="*" element={<Navigate to="/" replace />} />
                      <Route path="/timesheets" element={<Timesheets />} />
                      <Route path="/invoices" element={<Invoices />} />
                      <Route path="/team" element={<Team />} />
                  </Routes>
                </CompanyGate>
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </AuthProvider>
  );
}

export default App;
