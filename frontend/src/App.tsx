import { Navigate, Route, Routes } from 'react-router-dom';
import { useMe } from '@/hooks/useAuth';
import { Layout } from '@/components/Layout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { ServersPage } from '@/pages/ServersPage';
import { BackupsPage } from '@/pages/BackupsPage';
import { JobsPage } from '@/pages/JobsPage';
import { SchedulesPage } from '@/pages/SchedulesPage';
import { ImportExportPage } from '@/pages/ImportExportPage';
import { AuditPage } from '@/pages/AuditPage';
import { UsersPage } from '@/pages/UsersPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

export default function App() {
  // Hydrate the current user / permissions when a token is present.
  useMe();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="servers" element={<ServersPage />} />
        <Route path="backups" element={<BackupsPage />} />
        <Route path="jobs" element={<JobsPage />} />
        <Route path="schedules" element={<SchedulesPage />} />
        <Route path="import-export" element={<ImportExportPage />} />
        <Route
          path="audit"
          element={
            <ProtectedRoute permission="audit:read">
              <AuditPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="users"
          element={
            <ProtectedRoute permission="user:manage">
              <UsersPage />
            </ProtectedRoute>
          }
        />
        <Route path="404" element={<NotFoundPage />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Route>
    </Routes>
  );
}
