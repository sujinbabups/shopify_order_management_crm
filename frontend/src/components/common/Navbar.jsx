import React from 'react';
import { useAuth } from '../../hooks/useAuth';

export const Navbar = () => {
  const { user, logout } = useAuth();

  return (
    <header className="navbar">
      <div className="navbar-brand">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/>
          <path d="M3 6h18"/>
          <path d="M16 10a4 4 0 0 1-8 0"/>
        </svg>
        <span>Mini Order Management CRM</span>
      </div>

      <div className="navbar-actions">
        {user && (
          <div className="user-badge">
            <span className="user-name">{user.name}</span>
            <span className={`role-pill ${user.role === 'ADMIN' ? 'role-admin' : 'role-staff'}`}>
              {user.role}
            </span>
          </div>
        )}
        <button onClick={logout} className="btn-secondary" title="Sign out of CRM">
          Logout
        </button>
      </div>
    </header>
  );
};
