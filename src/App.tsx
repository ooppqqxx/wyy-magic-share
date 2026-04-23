/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Admin from './pages/Admin';
import Spectator from './pages/Spectator';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/admin" replace />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/s/:sessionId" element={<Spectator />} />
      </Routes>
    </BrowserRouter>
  );
}
