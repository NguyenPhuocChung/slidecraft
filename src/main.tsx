import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
<<<<<<< HEAD
import { RouterProvider } from 'react-router-dom';
import { router } from '@/app/router';
import '@/styles/globals.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
=======
import 'katex/dist/katex.min.css';
import './index.css';
import App from './App';
import { initDesktop } from './desktop';

void initDesktop().finally(() => createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
));
>>>>>>> origin/master
