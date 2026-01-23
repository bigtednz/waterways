import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { CompetitionsPage } from "./pages/CompetitionsPage";
import { CompetitionDetailPage } from "./pages/CompetitionDetailPage";
import { AnalysisPage } from "./pages/AnalysisPage";
import { RunLibraryPage } from "./pages/RunLibraryPage";
import { PenaltiesPage } from "./pages/PenaltiesPage";
import { ProtectedRoute } from "./components/ProtectedRoute";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="competitions" element={<CompetitionsPage />} />
          <Route path="competitions/:id" element={<CompetitionDetailPage />} />
          <Route path="analysis" element={<AnalysisPage />} />
          <Route path="run-library" element={<RunLibraryPage />} />
          <Route path="penalties" element={<PenaltiesPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
