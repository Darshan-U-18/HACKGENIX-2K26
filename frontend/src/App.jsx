import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import FieldWorker from './pages/FieldWorker';
import AdminDashboard from './pages/AdminDashboard';
import './index.css';

function App() {
  return (
    <BrowserRouter>
      <div className="app-container">
        <nav className="navbar">
          <ul>
            <li><Link to="/">Field Worker</Link></li>
            <li><Link to="/admin">Admin Dashboard</Link></li>
          </ul>
        </nav>
        <main className="content">
          <Routes>
            <Route path="/" element={<FieldWorker />} />
            <Route path="/admin" element={<AdminDashboard />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
