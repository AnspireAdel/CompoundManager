import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import ForceChangePasswordPage from './pages/ForceChangePasswordPage';
import DashboardPage from './pages/DashboardPage';
import ResidentsPage from './pages/ResidentsPage';
import BillsPage from './pages/BillsPage';
import TransactionsPage from './pages/TransactionsPage';
import ServicesPage from './pages/ServicesPage';
import NotificationsPage from './pages/NotificationsPage';
import ProfilePage from './pages/ProfilePage';
import RegistrationsPage from './pages/RegistrationsPage';
import PaymentsPage from './pages/PaymentsPage';
import ServiceTypesPage from './pages/ServiceTypesPage';
import UnitTypesPage from './pages/UnitTypesPage';
import SendNotificationsPage from './pages/SendNotificationsPage';
import ContactPage from './pages/ContactPage';
import ChatsPage from './pages/ChatsPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route
            path="/force-change-password"
            element={
              <ProtectedRoute>
                <ForceChangePasswordPage />
              </ProtectedRoute>
            }
          />
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/residents" element={<ResidentsPage />} />
            <Route path="/registrations" element={<RegistrationsPage />} />
            <Route path="/bills" element={<BillsPage />} />
            <Route path="/payments" element={<PaymentsPage />} />
            <Route path="/transactions" element={<TransactionsPage />} />
            <Route path="/services" element={<ServicesPage />} />
            <Route path="/service-types" element={<ServiceTypesPage />} />
            <Route path="/unit-types" element={<UnitTypesPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/send-notifications" element={<SendNotificationsPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/chats" element={<ChatsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
