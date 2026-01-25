import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { Layout } from "./components/Layout";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { CompetitionsPage } from "./pages/CompetitionsPage";
import { CompetitionDetailPage } from "./pages/CompetitionDetailPage";
import { CreateCompetitionPage } from "./pages/CreateCompetitionPage";
import { CompetitionDaysPage } from "./pages/CompetitionDaysPage";
import { CreateCompetitionDayPage } from "./pages/CreateCompetitionDayPage";
import { CompetitionDayDetailPage } from "./pages/CompetitionDayDetailPage";
import { AnalysisPage } from "./pages/AnalysisPage";
import { RunLibraryPage } from "./pages/RunLibraryPage";
import { PenaltiesPage } from "./pages/PenaltiesPage";
import { AdminPage } from "./pages/AdminPage";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminRoute } from "./components/AdminRoute";

function CompetitionRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/app/competitions/${id}`} replace />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/app/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="competitions">
            <Route index element={<CompetitionsPage />} />
            <Route path="new" element={<CreateCompetitionPage />} />
            <Route path=":id" element={<CompetitionDetailPage />} />
          </Route>
          <Route path="competition-days">
            <Route index element={<CompetitionDaysPage />} />
            <Route path="new" element={<CreateCompetitionDayPage />} />
            <Route path=":id" element={<CompetitionDayDetailPage />} />
          </Route>
          <Route path="analysis" element={<AnalysisPage />} />
          <Route path="run-library" element={<RunLibraryPage />} />
          <Route path="penalties" element={<PenaltiesPage />} />
          <Route
            path="admin"
            element={
              <AdminRoute>
                <AdminPage />
              </AdminRoute>
            }
          />
        </Route>
        {/* Redirect old routes to new /app structure */}
        <Route path="/dashboard" element={<Navigate to="/app/dashboard" replace />} />
        <Route path="/competitions/new" element={<Navigate to="/app/competitions/new" replace />} />
        <Route 
          path="/competitions/:id" 
          element={<CompetitionRedirect />} 
        />
        <Route path="/competitions" element={<Navigate to="/app/competitions" replace />} />
        <Route path="/analysis" element={<Navigate to="/app/analysis" replace />} />
        <Route path="/run-library" element={<Navigate to="/app/run-library" replace />} />
        <Route path="/penalties" element={<Navigate to="/app/penalties" replace />} />
        <Route path="/admin" element={<Navigate to="/app/admin" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
