import React, { useState, useEffect, useRef } from 'react';
import { Lang } from '../../App';
import { t } from '../../i18n';
import { IconShip, IconDatabase, IconAlert, IconInbox, IconBell, IconChat, IconGlobe } from '../icons/index';

interface TopNavProps {
  lang: Lang;
  counts: { exception: number };
  toggleLang: () => void;
  activeTab: 'preassign' | 'allocation' | 'booking';
  setActiveTab: (tab: 'preassign' | 'allocation' | 'booking') => void;
  activeSubTab: 'all' | 'exception';
  setActiveSubTab: (tab: 'all' | 'exception') => void;
}

export function TopNav({ lang, counts, toggleLang, activeTab, setActiveTab, activeSubTab, setActiveSubTab }: TopNavProps) {
  const [expandedTab, setExpandedTab] = useState<'preassign' | 'booking' | null>(null);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setExpandedTab(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <nav className="topnav" ref={navRef}>
      <div className="topnav-logo">
        <img
          src={new URL('../../../assets/MOOV_Logo_白橙.png', import.meta.url).href}
          alt="MOOV"
          style={{ height: '30px', width: 'auto' }}
        />
      </div>
      <div className="topnav-tabs">
        <div className="nav-tab-group">
          <button
            className={`nav-tab ${activeTab === 'preassign' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('preassign');
              setActiveSubTab('all');
              setExpandedTab(null);
            }}
          >
            <IconShip /> {t(lang, 'nav.preAssign')}
            <span
              style={{ marginLeft: '4px', fontSize: '10px', padding: '0 2px' }}
              onClick={(e) => {
                e.stopPropagation();
                setActiveTab('preassign');
                setExpandedTab(expandedTab === 'preassign' ? null : 'preassign');
              }}
            >
              {activeTab === 'preassign' && expandedTab === 'preassign' ? '▲' : '▼'}
            </span>
          </button>
          {activeTab === 'preassign' && expandedTab === 'preassign' && (
            <div className="nav-submenu">
              <button
                className={`nav-tab nav-subtab ${activeSubTab === 'exception' ? 'active' : ''}`}
                onClick={() => {
                  setActiveSubTab('exception');
                  setExpandedTab(null);
                }}
              >
                <IconAlert /> Exception
                <span className="nav-badge error">{counts.exception}</span>
              </button>
            </div>
          )}
        </div>
        <div className="nav-tab-group">
          <button
            className={`nav-tab ${activeTab === 'booking' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('booking');
              setActiveSubTab('all');
              setExpandedTab(null);
            }}
          >
            <IconInbox /> {t(lang, 'nav.carrierBooking')}
            <span
              style={{ marginLeft: '4px', fontSize: '10px', padding: '0 2px' }}
              onClick={(e) => {
                e.stopPropagation();
                setActiveTab('booking');
                setExpandedTab(expandedTab === 'booking' ? null : 'booking');
              }}
            >
              {activeTab === 'booking' && expandedTab === 'booking' ? '▲' : '▼'}
            </span>
          </button>
          {activeTab === 'booking' && expandedTab === 'booking' && (
            <div className="nav-submenu">
              <button
                className={`nav-tab nav-subtab ${activeSubTab === 'exception' ? 'active' : ''}`}
                onClick={() => {
                  setActiveSubTab('exception');
                  setExpandedTab(null);
                }}
              >
                <IconAlert /> Exception
                <span className="nav-badge error">{counts.exception}</span>
              </button>
            </div>
          )}
        </div>
        <button
          className={`nav-tab ${activeTab === 'allocation' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('allocation');
            setExpandedTab(null);
          }}
        >
          <IconDatabase /> {t(lang, 'nav.allocationMgmt')}
        </button>
      </div>
      <div className="topnav-right">
        <button className="topnav-icon-btn" title="Notifications">
          <IconBell />
          <span className="dot"></span>
        </button>
        <button className="topnav-icon-btn" title="Messages">
          <IconChat />
        </button>
        <button className="lang-switcher" onClick={toggleLang}>
          <IconGlobe /> {t(lang, 'misc.langLabel')}
        </button>
        <div className="topnav-divider"></div>
        <div className="topnav-user">
          <div className="topnav-user-text">
            <div className="topnav-user-name">{t(lang, 'user.name')}</div>
            <div className="topnav-user-email">{t(lang, 'user.email')}</div>
          </div>
          <div className="topnav-avatar">Z</div>
        </div>
      </div>
    </nav>
  );
}
