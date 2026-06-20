import React from 'react';
import { ApiClient } from '../utils/api-client'; // Using the central configured API utility

interface AppLayoutProps {
  children: React.ReactNode;
}

/**
 * Global application viewport wrapper element.
 * Migrates raw logout fetch trigger to use ApiClient, preserving multi-origin architecture compatibility.
 */
export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  
  const handleLogout = async () => {
    try {
      // ApiClient naturally appends VITE_API_BASE and safely handles credentials/headers cross-origin
      const response = await ApiClient.post<{ success: boolean }>('/auth/logout');
      
      if (response.data && response.data.success) {
        // Direct location rewrite or route push context on successful sign-out sync
        window.location.href = '/login';
      } else {
        console.error('Logout request was processed but state confirmation flagged invalid.');
      }
    } catch (err: any) {
      console.error('Failed to dispatch user sign-out session lifecycle action:', err.message);
    }
  };

  return (
    <div className="app-layout-container">
      <header className="app-navbar">
        <div className="nav-brand">Clinical Insight Engine</div>
        <button className="logout-action-btn" onClick={handleLogout}>
          Sign Out
        </button>
      </header>
      <main className="app-viewport-content">
        {children}
      </main>
    </div>
  );
};

export default AppLayout;
