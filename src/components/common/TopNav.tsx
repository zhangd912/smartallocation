import React, { useState, useEffect, useRef } from 'react';
import { Lang } from '../../App';
import { t } from '../../i18n';
import { IconShip, IconDatabase, IconAlert, IconInbox, IconBell, IconChat, IconGlobe } from '../icons/index';

interface TopNavProps {
  lang: Lang;
  counts: { exception: number };
  setLang: (lang: Lang) => void;
  activeTab: 'preassign' | 'allocation' | 'booking';
  setActiveTab: (tab: 'preassign' | 'allocation' | 'booking') => void;
  activeSubTab: 'all' | 'exception';
  setActiveSubTab: (tab: 'all' | 'exception') => void;
}

const LANG_OPTIONS: { value: Lang; label: string; short: string }[] = [
  { value: 'en', label: 'English', short: 'EN' },
  { value: 'zh', label: '中文',    short: 'ZH' },
  { value: 'de', label: 'Deutsch', short: 'DE' },
];

export function TopNav({ lang, counts, setLang, activeTab, setActiveTab, activeSubTab, setActiveSubTab }: TopNavProps) {
  const [expandedTab, setExpandedTab] = useState<'preassign' | 'booking' | null>(null);
  const [langOpen, setLangOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const langRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setExpandedTab(null);
      }
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false);
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
        {/* Notifications and Messages — hidden until implemented */}
        <div ref={langRef} style={{ position: 'relative' }}>
          <button
            className="lang-switcher"
            onClick={() => setLangOpen(o => !o)}
          >
            <IconGlobe />
            {LANG_OPTIONS.find(o => o.value === lang)?.short ?? 'EN'}
          </button>
          {langOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 6px)', right: 0,
              background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8,
              boxShadow: '0 4px 12px rgba(0,0,0,0.12)', minWidth: 140, zIndex: 999, overflow: 'hidden'
            }}>
              {LANG_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => { setLang(opt.value); setLangOpen(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    width: '100%', padding: '9px 14px', border: 'none', cursor: 'pointer',
                    background: lang === opt.value ? '#F0F4F8' : '#fff',
                    color: '#1A2B3C', fontSize: 13, fontWeight: lang === opt.value ? 700 : 400,
                    textAlign: 'left'
                  }}
                >
                  <span style={{ width: 24, fontWeight: 700, color: '#004F7C' }}>{opt.short}</span>
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
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
