import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./lib/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Contacts from "./pages/Contacts";
import Templates from "./pages/Templates";
import ComingSoon from "./components/ComingSoon";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Navigate to="/contacts" replace />} />
            <Route path="/contacts" element={<Contacts />} />
            <Route
              path="/campaigns"
              element={
                <ComingSoon
                  title="Campaigns"
                  note="Campaign + sequence builder is next up — manual contact assignment, configurable step timing, and timezone-aware sending rules."
                />
              }
            />
            <Route path="/templates" element={<Templates />} />
            <Route
              path="/analytics"
              element={<ComingSoon title="Analytics" note="Populates once campaigns start sending." />}
            />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
