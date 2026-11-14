import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from '@/components/ui';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const HomePage = lazy(() => import('@/pages/HomePage'));
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const ImportPage = lazy(() => import('@/code-import/ImportPage'));
const EditorPage = lazy(() => import('@/editor/EditorPage'));
const PresentPage = lazy(() => import('@/presentation/PresentPage'));
const PromptCenterPage = lazy(() => import('@/prompts/PromptCenterPage'));
const DocsPage = lazy(() => import('@/pages/DocsPage'));
const LoginPage = lazy(() => import('@/pages/LoginPage'));
const SharePage = lazy(() => import('@/pages/SharePage'));

function Loading() {
  return <div className="flex h-full items-center justify-center text-sm text-ink-400"><div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" /></div>;
}

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/import" element={<ImportPage />} />
            <Route path="/editor/:id" element={<EditorPage />} />
            <Route path="/present/:id" element={<PresentPage />} />
            <Route path="/prompts" element={<PromptCenterPage />} />
            <Route path="/docs" element={<DocsPage />} />
            <Route path="/docs/:topic" element={<DocsPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/share/:shareId" element={<SharePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
      <Toaster />
    </BrowserRouter>
  );
}
