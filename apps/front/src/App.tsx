import { Routes, Route, Navigate } from "react-router-dom";

import AuthLayout from "@/components/layout/auth-layout";
import DashboardLayout from "@/components/layout/dashboard-layout";
import DashboardPage from "@/pages/dashboard";
import LoginPage from "@/pages/login";
import OnboardingPage from "@/pages/onboarding";
import ProductsPage from "@/pages/products";
import RegisterPage from "@/pages/register";
import SalesPage from "@/pages/sales";
import SuppliersPage from "@/pages/suppliers";

function App() {
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>
      <Route path="/dashboard" element={<DashboardLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="sales" element={<SalesPage />} />
        <Route path="suppliers" element={<SuppliersPage />} />
      </Route>
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;
