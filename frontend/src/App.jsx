import React from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import FieldWorker from './pages/FieldWorker';
import AdminDashboard from './pages/AdminDashboard';
import './index.css';

function App() {
  return (
    <BrowserRouter>
      <div className="app-container">
        <nav className="navbar">
          <div className="navbar-brand">🛡️ ResilSync Engine</div>
          <ul>
            <li>
              <NavLink 
                to="/" 
                className={({ isActive }) => isActive ? "active" : ""}
                end
              >
                Field Worker
              </NavLink>
            </li>
            <li>
              <NavLink 
                to="/admin" 
                className={({ isActive }) => isActive ? "active" : ""}
              >
                Admin Dashboard
              </NavLink>
            </li>
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
