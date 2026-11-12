import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router';
import { AppLayout } from '@/components/layout/AppLayout';
import { FullPageLoader, HomeRedirect, RequireAuth } from './guards';

const LoginPage = lazy(() => import('@/pages/auth/LoginPage'));
const CheckInPage = lazy(() => import('@/pages/auth/CheckInPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));

const ManagerDashboardPage = lazy(() => import('@/pages/manager/ManagerDashboardPage'));
const ManagerLeadsPage = lazy(() => import('@/pages/manager/ManagerLeadsPage'));
const ReservoirPage = lazy(() => import('@/pages/manager/ReservoirPage'));
const DistributionPage = lazy(() => import('@/pages/manager/DistributionPage'));
const BrokersPage = lazy(() => import('@/pages/manager/BrokersPage'));
const PresencePage = lazy(() => import('@/pages/manager/PresencePage'));
const QrDisplayPage = lazy(() => import('@/pages/manager/QrDisplayPage'));
const HistoryPage = lazy(() => import('@/pages/manager/HistoryPage'));

const BrokerDashboardPage = lazy(() => import('@/pages/broker/BrokerDashboardPage'));
const BrokerLeadsPage = lazy(() => import('@/pages/broker/BrokerLeadsPage'));
const BrokerPresencePage = lazy(() => import('@/pages/broker/BrokerPresencePage'));

export function AppRoutes() {
  return (
    <Suspense fallback={<FullPageLoader />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<HomeRedirect />} />

        {/* Link do QR Code. Exige login; o redirecionamento preserva o token. */}
        <Route
          path="/presence/check-in"
          element={
            <RequireAuth>
              <CheckInPage />
            </RequireAuth>
          }
        />

        <Route
          path="/gestor/qrcode"
          element={
            <RequireAuth role="manager">
              <QrDisplayPage />
            </RequireAuth>
          }
        />

        <Route
          path="/gestor"
          element={
            <RequireAuth role="manager">
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route index element={<ManagerDashboardPage />} />
          <Route path="leads" element={<ManagerLeadsPage />} />
          <Route path="reservatorio" element={<ReservoirPage />} />
          <Route path="distribuicao" element={<DistributionPage />} />
          <Route path="corretores" element={<BrokersPage />} />
          <Route path="presenca" element={<PresencePage />} />
          <Route path="historico" element={<HistoryPage />} />
        </Route>

        <Route
          path="/corretor"
          element={
            <RequireAuth role="broker">
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route index element={<BrokerDashboardPage />} />
          <Route path="leads" element={<BrokerLeadsPage />} />
          <Route path="presenca" element={<BrokerPresencePage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
