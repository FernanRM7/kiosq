import { Routes, Route, Navigate } from "react-router-dom";

import { ProtectedRoute } from "@/components/auth/protected-route";
import AuthLayout from "@/components/layout/auth-layout";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { AuthProvider } from "@/contexts/auth.context";
import CategoriesPage from "@/pages/categories";
import DashboardPage from "@/pages/dashboard";
import LoginPage from "@/pages/login";
import OnboardingPage from "@/pages/onboarding";
import ProductsPage from "@/pages/products";
import RegisterPage from "@/pages/register";
import SalesPage from "@/pages/sales";
import SettingsPage from "@/pages/settings";
import SuppliersPage from "@/pages/suppliers";

function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public routes — accessible without a session */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        {/* Protected routes — require a valid wos-session cookie */}
        <Route element={<ProtectedRoute />}>
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="categories" element={<CategoriesPage />} />
            <Route path="sales" element={<SalesPage />} />
            <Route path="suppliers" element={<SuppliersPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
