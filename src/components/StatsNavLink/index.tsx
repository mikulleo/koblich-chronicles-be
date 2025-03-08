'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

const StatsNavLink: React.FC = () => {
  const pathname = usePathname();
  const isActive = pathname === '/admin/stats';

  return (
    <div className="nav-group">
      <h5 className="nav-group-label">Trading</h5>
      <div className="nav-items">
        <Link 
          href="/admin/stats" 
          className={`nav-item ${isActive ? 'active' : ''}`}
        >
          <span className="icon">📊</span>
          <span className="label">Statistics</span>
        </Link>
      </div>

      <style jsx>{`
        .nav-group {
          margin: 1rem 0;
          padding-top: 1rem;
          border-top: 1px solid var(--theme-elevation-100);
        }
        
        .nav-group-label {
          padding: 0 1rem;
          margin: 0 0 0.5rem 0;
          font-size: 0.7rem;
          font-weight: bold;
          text-transform: uppercase;
          color: var(--theme-elevation-500);
        }
        
        .nav-items {
          display: flex;
          flex-direction: column;
        }
        
        .nav-item {
          display: flex;
          align-items: center;
          padding: 0.5rem 1rem;
          margin: 0.125rem 0;
          color: var(--theme-elevation-800);
          text-decoration: none;
          border-radius: 4px;
          transition: background-color 0.2s;
        }
        
        .nav-item:hover {
          background-color: var(--theme-elevation-100);
        }
        
        .nav-item.active {
          background-color: var(--theme-elevation-150);
          color: var(--theme-text);
          font-weight: 500;
        }
        
        .icon {
          margin-right: 0.5rem;
          font-size: 1.2rem;
        }
        
        .label {
          font-size: 0.9rem;
        }
      `}</style>
    </div>
  );
};

export default StatsNavLink;