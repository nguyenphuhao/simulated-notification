'use client';

import { useState, useEffect } from 'react';
import { Sidebar } from './sidebar';
import { Header } from './header';

// Helper function to safely get initial state from localStorage
function getInitialSidebarState(): boolean {
  if (typeof window === 'undefined') {
    return false; // Default for SSR
  }
  try {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved !== null ? JSON.parse(saved) : false;
  } catch {
    return false; // Default if parsing fails
  }
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Initialize state from localStorage immediately
  const [sidebarCollapsed, setSidebarCollapsed] = useState(getInitialSidebarState);
  const [isMounted, setIsMounted] = useState(false);

  // Mark component as mounted (client-side only)
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Save sidebar state to localStorage when it changes (only on client)
  useEffect(() => {
    if (isMounted) {
      try {
        localStorage.setItem('sidebarCollapsed', JSON.stringify(sidebarCollapsed));
      } catch (error) {
        console.error('Failed to save sidebar state to localStorage:', error);
      }
    }
  }, [sidebarCollapsed, isMounted]);

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header sidebarCollapsed={sidebarCollapsed} onToggleSidebar={toggleSidebar} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}

