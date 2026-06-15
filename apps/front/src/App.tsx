import { Routes, Route, Navigate } from "react-router-dom";

import { ProtectedRoute } from "@/components/auth/protected-route";
import AuthLayout from "@/components/layout/auth-layout";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { AuthProvider } from "@/contexts/auth.context";
import DashboardPage from "@/pages/dashboard";
import LoginPage from "@/pages/login";
import ProductsPage from "@/pages/products";
import RegisterPage from "@/pages/register";
import SalesPage from "@/pages/sales";
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
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="sales" element={<SalesPage />} />
            <Route path="suppliers" element={<SuppliersPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
