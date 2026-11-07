import { createBrowserRouter, Navigate } from 'react-router-dom';
import { LandingPage } from '@/features/dashboard/LandingPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { MyProjectsPage } from '@/features/dashboard/MyProjectsPage';
import { WorkspacePage } from '@/features/workspace/WorkspacePage';
import { AppShell } from '@/components/layout/AppShell';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <LandingPage />,
  },
  {
    path: '/',
    element: <AppShell />,
    children: [
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'workspace/:projectId', element: <WorkspacePage /> },
      { path: 'projects', element: <MyProjectsPage /> },
      { path: 'settings', element: <div className="p-8 text-text-secondary">Settings — local-only storage in v1. Backend coming later.</div> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
