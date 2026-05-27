import React, { useState, useMemo } from 'react';
import { TopNav } from './components/common/TopNav';
import { PageHeader } from './components/common/PageHeader';
import { StatsGrid } from './components/common/StatsGrid';
import { BookingStatsGrid } from './components/common/BookingStatsGrid';
import { Toolbar } from './components/common/Toolbar';
import { POTable } from './components/preassign/POTable';
import { Drawer } from './components/preassign/Drawer';
import { BookingTable } from './components/carrierbooking/BookingTable';
import { BookingDrawer } from './components/carrierbooking/BookingDrawer';
import { BookingExceptionDashboard } from './components/carrierbooking/BookingExceptionDashboard';
import { BookingResolveModal } from './components/carrierbooking/BookingResolveModal';
import { ToastContainer } from './components/common/ToastContainer';
import { AllocationManagement } from './components/allocation/AllocationManagement';
import { ExceptionDashboard } from './components/exception/ExceptionDashboard';
import { ResolveModal } from './components/exception/ResolveModal';
import { MOCK_POS, BOOKING_MOCK_POS, DEMO_ALLOCATION_USAGE } from './data/mockData';
import { INITIAL_ALLOCATION, EARLY_SHIPMENT_LOTS, BOOKING_MATRIX, VESSEL_SCHEDULES, FND_RULES } from './data/referenceData';
import { I18N, t } from './i18n';

const CARRIER_TO_CODE: Record<string, string> = {
  'Hapag-Lloyd': 'HLCU',
  'CMA CGM': 'CMDU',
  'Tailwind': 'TSHG',
  'MSC': 'MSCU',
  'Maersk': 'MAEU',
  'COSCO': 'COSU',
};

function etdToAllocWeek(etd: string): string {
  const d = new Date(Date.UTC(
    parseInt(etd.slice(0, 4)),
    parseInt(etd.slice(5, 7)) - 1,
    parseInt(etd.slice(8, 10))
  ));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${String(week).padStart(2, '0')}/${String(d.getUTCFullYear()).slice(-2)}`;
}

function addDaysStr(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const CARRIER_TO_FND_CODE_APP: Record<string, string> = {
  'Hapag-Lloyd': 'HAPL',
  'CMA CGM':     'CMA',
  'Tailwind':    'TSHG',
  'MSC':         'MSC',
  'COSCO':       'COSCO',
  'Maersk':      'MAEU',
};

function computeAssignment(po: PO): PO {
  // Step 1: date buffer check
  const fobW = parseInt(po.fobWeek.split('/')[0]);
  const crdW = parseInt(po.crdWeek.split('/')[0]);
  const bufferWeeks = fobW - crdW;
  if (bufferWeeks < 0)
    return { ...po, status: 'EXCEPTION', exceptionAtStep: 1, exceptionKey: 'crdLaterThanFob' };
  if (bufferWeeks > 4 && !EARLY_SHIPMENT_LOTS.has(po.lot.trim()))
    return { ...po, status: 'ON_HOLD', onHoldKey: 'requestTooEarly' };

  // Step 2: booking matrix lookup
  const laneEntries = BOOKING_MATRIX.filter(e => e.polCode === po.pol && e.podCode === po.pod);
  if (laneEntries.length === 0)
    return { ...po, status: 'EXCEPTION', exceptionAtStep: 2, exceptionKey: 'noCarrier' };

  // Step 3: pre-assign allows overcommit — all carriers pass through

  // Step 4: vessel schedule lookup
  const etdEarly = addDaysStr(po.crd, 12);
  const etdLate  = addDaysStr(po.crd, 20);
  // Carrier rank from BOOKING_MATRIX order: P1=0, P2=1, P3=2...
  const carrierRank = new Map(laneEntries.map((e, i) => [e.carrierCode, i]));

  const candidates = VESSEL_SCHEDULES.filter(v =>
    v.polCode === po.pol &&
    v.podCode === po.pod &&
    carrierRank.has(v.carrierCode) &&
    v.etd >= etdEarly && v.etd <= etdLate &&
    v.eta <= po.ldd &&
    v.peta <= po.ldd
  ).sort((a, b) => {
    const ra = carrierRank.get(a.carrierCode)!;
    const rb = carrierRank.get(b.carrierCode)!;
    if (ra !== rb) return ra - rb;
    return a.eta.localeCompare(b.eta) || b.etd.localeCompare(a.etd);
  });

  if (candidates.length === 0)
    return { ...po, status: 'EXCEPTION', exceptionAtStep: 4, exceptionKey: 'noVoyage' };
  if (candidates.length >= 2 &&
      candidates[0].etd === candidates[1].etd &&
      candidates[0].eta === candidates[1].eta)
    return { ...po, status: 'EXCEPTION', exceptionAtStep: 4, exceptionKey: 'voyageTie' };

  // Step 5: assign best vessel + FND lookup
  const best = candidates[0];
  const fndCode = CARRIER_TO_FND_CODE_APP[best.carrier];
  const fndRule = fndCode && po.dwh
    ? FND_RULES.find(r => r.carrier === fndCode && r.dwh === po.dwh.toUpperCase() && r.pod === po.pod)
    : null;

  return {
    ...po,
    status: 'ASSIGNED',
    carrier: best.carrier,
    service: best.service,
    vessel: best.vessel,
    voyage: best.voyage,
    etd: best.etd,
    eta: best.eta,
    peta: best.peta,
    del: fndRule?.fnd ?? po.del,
    priority: best.priority,
  };
}

import './styles/index.css';

export type Lang = 'en' | 'zh';
export type POStatus = 'ASSIGNED' | 'NOT_STARTED' | 'ON_HOLD' | 'EXCEPTION' | 'RUNNING' | 'BOOKED_EXACT' | 'BOOKED_UPDATED';

export interface PreassignSnapshot {
  executedAt: string;
  carrier: string;
  service: string;
  vessel: string;
  voyage: string;
  etd: string;
  eta: string;
}

export interface PO {
  id: number;
  moovRef?: string;
  bookingRef?: string;
  poNo?: string;
  lot: string;
  ian: string;
  article: string;
  batch: string;
  teu: number;
  ctr: string;
  ctrType?: string;
  pol: string;
  pod: string;
  por?: string;
  fnd?: string;
  del: string;
  dwh: string;
  crd: string;
  crdWeek: string;
  fobWeek: string;
  ldd: string;
  srd?: string;
  status: POStatus;
  carrier?: string;
  service?: string;
  vessel?: string;
  voyage?: string;
  etd?: string;
  eta?: string;
  peta?: string;
  priority?: number;
  supplier: string;
  onHoldKey?: string;
  exceptionAtStep?: number;
  exceptionKey?: string;
  polRegion?: string;
  podRegion?: string;
  preassignSnapshot?: PreassignSnapshot;
}

export interface Toast {
  id: number;
  msg: string;
  kind?: string;
}

function App() {
  const [lang, setLang] = useState<Lang>('en');
  const [activeTab, setActiveTab] = useState<'preassign' | 'allocation' | 'booking'>('preassign');
  const [activeSubTab, setActiveSubTab] = useState<'all' | 'exception'>('all');

  // Pre-Assign State
  const [pos, setPos] = useState<PO[]>(MOCK_POS);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [drawerPo, setDrawerPo] = useState<PO | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [runningStep, setRunningStep] = useState<number | null>(null);
  const [isLiveRun, setIsLiveRun] = useState(false);
  const [batchRunning, setBatchRunning] = useState(false);
  const [resolvePo, setResolvePo] = useState<PO | null>(null);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Carrier Booking State
  const [bookingPos, setBookingPos] = useState<PO[]>(BOOKING_MOCK_POS);
  const [bookingSelectedIds, setBookingSelectedIds] = useState<Set<number>>(new Set());
  const [bookingFilter, setBookingFilter] = useState<string>('ALL');
  const [bookingSearchQuery, setBookingSearchQuery] = useState('');
  const [bookingDrawerPo, setBookingDrawerPo] = useState<PO | null>(null);
  const [bookingDrawerOpen, setBookingDrawerOpen] = useState(false);
  const [bookingRunningStep, setBookingRunningStep] = useState<number | null>(null);
  const [bookingIsLiveRun, setBookingIsLiveRun] = useState(false);
  const [bookingBatchRunning, setBookingBatchRunning] = useState(false);
  const [bookingResolvePo, setBookingResolvePo] = useState<PO | null>(null);
  const [bookingResolveOpen, setBookingResolveOpen] = useState(false);

  // Allocation Management State
  interface VersionRecord {
    id: string;
    version: number;
    uploader: string;
    timestamp: string;
    data: any[];
  }
  const [bookingMatrixVersions, setBookingMatrixVersions] = useState<VersionRecord[]>([]);
  const [fndRulesVersions, setFndRulesVersions] = useState<VersionRecord[]>([]);
  const [earlyShipmentVersions, setEarlyShipmentVersions] = useState<VersionRecord[]>([]);

  // Pre-Assign Logic
  const counts = useMemo(() => ({
    total: pos.length,
    not_started: pos.filter(p => p.status === 'NOT_STARTED').length,
    assigned: pos.filter(p => p.status === 'ASSIGNED').length,
    on_hold: pos.filter(p => p.status === 'ON_HOLD').length,
    exception: pos.filter(p => p.status === 'EXCEPTION').length
  }), [pos]);

  const filtered = useMemo(() => {
    let list = pos;
    if (filter !== 'ALL') list = list.filter(p => p.status === filter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p =>
        (p.poNo || '').toLowerCase().includes(q) ||
        (p.moovRef || '').toLowerCase().includes(q) ||
        p.lot.toLowerCase().includes(q) ||
        p.article.toLowerCase().includes(q) ||
        (p.pol || '').toLowerCase().includes(q) ||
        (p.pod || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [pos, filter, searchQuery]);

  const showToast = (msg: string, kind?: string) => {
    const id = Date.now() + Math.random();
    setToasts(arr => [...arr, { id, msg, kind }]);
    setTimeout(() => setToasts(arr => arr.filter(x => x.id !== id)), 3500);
  };

  const openDrawer = (po: PO) => {
    setDrawerPo(po);
    setIsLiveRun(false);
    setRunningStep(null);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setTimeout(() => {
      setDrawerPo(null);
      setIsLiveRun(false);
      setRunningStep(null);
    }, 300);
  };

  const runPreAssignLive = (po: PO) => {
    // Compute real result FIRST so each step shows its true state during animation
    const updated = computeAssignment(po);

    // Stop animation at the step that decided the outcome — no need to run further
    const failStep = updated.status === 'ON_HOLD' ? 1
      : updated.status === 'EXCEPTION' ? (updated.exceptionAtStep ?? 4)
      : 5; // ASSIGNED → all 5 steps animate

    // Set drawerPo to the real result before animation starts
    // TraceStep reads entry.result from this PO, so each completed step immediately
    // shows its true PASS / FAIL / ON_HOLD state as the animation progresses
    setDrawerPo(updated);
    setDrawerOpen(true);
    setIsLiveRun(true);
    setRunningStep(1);

    let cur = 1;
    const interval = setInterval(() => {
      cur++;
      if (cur > failStep) {
        clearInterval(interval);
        setRunningStep(null);
        setIsLiveRun(false);
        // Persist result to table — filter stays unchanged so user can
        // keep running remaining LOTs in the same tab (e.g. NOT_STARTED)
        setPos(prev => prev.map(p => p.id === po.id ? updated : p));
        // Show result-specific toast
        const label = po.moovRef || po.lot;
        if (updated.status === 'ASSIGNED') {
          showToast(t(lang, 'toast.singleDone', { po: label }), 'success');
        } else if (updated.status === 'ON_HOLD') {
          showToast(t(lang, 'toast.singleOnHold', { po: label }), 'warning');
        } else {
          showToast(t(lang, 'toast.singleException', { po: label, n: updated.exceptionAtStep ?? 1 }), 'error');
        }
      } else {
        setRunningStep(cur);
      }
    }, 800);
  };

  const handleBatchRun = () => {
    const targets = selectedIds.size > 0
      ? pos.filter(p => selectedIds.has(p.id) && p.status === 'NOT_STARTED')
      : pos.filter(p => p.status === 'NOT_STARTED');

    if (targets.length === 0) {
      showToast(t(lang, 'toast.noEligible'));
      return;
    }

    setBatchRunning(true);
    showToast(t(lang, 'toast.batchStart', { n: targets.length }));

    targets.forEach((po, idx) => {
      setTimeout(() => {
        const updated = computeAssignment(po);

        setPos(prev => prev.map(p => p.id === po.id ? updated : p));

        if (idx === targets.length - 1) {
          setBatchRunning(false);
          showToast(t(lang, 'toast.batchDone', { n: targets.length }), 'success');
          setSelectedIds(new Set());
        }
      }, (idx + 1) * 400);
    });
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const eligibleIds = filtered.filter(p => p.status === 'NOT_STARTED').map(p => p.id);
    if (selectedIds.size === eligibleIds.length && eligibleIds.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(eligibleIds));
    }
  };

  // Carrier Booking Logic
  const BOOKED_STATUSES: POStatus[] = ['BOOKED_EXACT', 'BOOKED_UPDATED', 'ASSIGNED'];

  const bookingCounts = useMemo(() => {
    const exactMatch = bookingPos.filter(p => p.status === 'BOOKED_EXACT').length;
    const bookedTotal = bookingPos.filter(
      p => p.status === 'BOOKED_EXACT' || p.status === 'BOOKED_UPDATED'
    ).length;
    return {
      total: bookingPos.length,
      not_started: bookingPos.filter(p => p.status === 'NOT_STARTED').length,
      booked: bookingPos.filter(p => BOOKED_STATUSES.includes(p.status as POStatus)).length,
      exception: bookingPos.filter(p => p.status === 'EXCEPTION').length,
      exactMatch,
      withSnapshot: bookedTotal,
      accuracy: bookedTotal > 0 ? Math.round(exactMatch / bookedTotal * 100) : 0,
    };
  }, [bookingPos]);

  const allocationUsage = useMemo(() => {
    const usage: Record<string, { preassign: number; booked: number }> = {};
    // Merge demo seed baseline
    for (const [k, v] of Object.entries(DEMO_ALLOCATION_USAGE)) {
      usage[k] = { preassign: v.preassign, booked: v.booked };
    }
    const accumulate = (p: PO, type: 'preassign' | 'booked') => {
      if (!p.etd || !p.carrier || !p.polRegion || !p.podRegion) return;
      const code = CARRIER_TO_CODE[p.carrier];
      if (!code) return;
      const week = etdToAllocWeek(p.etd);
      const key = `${code}|${p.polRegion}|${p.podRegion}|${week}`;
      if (!usage[key]) usage[key] = { preassign: 0, booked: 0 };
      usage[key][type] += p.teu;
    };
    pos.filter(p => p.status === 'ASSIGNED').forEach(p => accumulate(p, 'preassign'));
    bookingPos.filter(p => p.status === 'BOOKED_EXACT' || p.status === 'BOOKED_UPDATED').forEach(p => accumulate(p, 'booked'));
    return usage;
  }, [pos, bookingPos]);

  const bookingFiltered = useMemo(() => {
    let list = bookingPos;
    if (bookingFilter === 'BOOKED') {
      list = list.filter(p => BOOKED_STATUSES.includes(p.status as POStatus));
    } else if (bookingFilter !== 'ALL') {
      list = list.filter(p => p.status === bookingFilter);
    }
    if (bookingSearchQuery) {
      const q = bookingSearchQuery.toLowerCase();
      list = list.filter(p =>
        (p.poNo || '').toLowerCase().includes(q) ||
        (p.moovRef || '').toLowerCase().includes(q) ||
        p.lot.toLowerCase().includes(q) ||
        p.article.toLowerCase().includes(q) ||
        (p.pol || '').toLowerCase().includes(q) ||
        (p.pod || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [bookingPos, bookingFilter, bookingSearchQuery]);

  const openBookingDrawer = (po: PO) => {
    setBookingDrawerPo(po);
    setBookingIsLiveRun(false);
    setBookingRunningStep(null);
    setBookingDrawerOpen(true);
  };

  const closeBookingDrawer = () => {
    setBookingDrawerOpen(false);
    setTimeout(() => {
      setBookingDrawerPo(null);
      setBookingIsLiveRun(false);
      setBookingRunningStep(null);
    }, 300);
  };

  const runBookingLive = (po: PO) => {
    setBookingDrawerPo(po);
    setBookingDrawerOpen(true);
    setBookingIsLiveRun(true);
    setBookingRunningStep(1);
    let cur = 1;
    const interval = setInterval(() => {
      cur++;
      if (cur > 5) {
        clearInterval(interval);
        setBookingRunningStep(null);
        setBookingIsLiveRun(false);
        const hasSnapshot = !!po.preassignSnapshot;
        const updated: PO = {
          ...po,
          status: hasSnapshot ? 'BOOKED_EXACT' : 'BOOKED_UPDATED',
          carrier: 'Hapag-Lloyd',
          service: 'NE2',
          vessel: hasSnapshot && po.preassignSnapshot!.vessel === 'MAERSK STOCKHOLM'
            ? 'MAERSK STOCKHOLM' : 'AL ZUBARA',
          voyage: 'AZ622W',
          etd: '2026-06-08',
          eta: '2026-07-15',
          priority: 1
        };
        setBookingPos(prev => prev.map(p => p.id === po.id ? updated : p));
        setBookingDrawerPo(updated);
        showToast(t(lang, 'toast.singleDone', { po: po.moovRef || po.lot}), 'success');
      } else {
        setBookingRunningStep(cur);
      }
    }, 800);
  };

  const handleBookingBatchRun = () => {
    const targets = bookingSelectedIds.size > 0
      ? bookingPos.filter(p => bookingSelectedIds.has(p.id) && p.status === 'NOT_STARTED')
      : bookingPos.filter(p => p.status === 'NOT_STARTED');

    if (targets.length === 0) {
      showToast(t(lang, 'toast.noEligible'));
      return;
    }

    setBookingBatchRunning(true);
    showToast(t(lang, 'toast.batchStart', { n: targets.length }));

    targets.forEach((po, idx) => {
      setTimeout(() => {
        const rand = Math.random();
        let extras: Partial<PO> = {};

        if (rand < 0.7) {
          const choices = [
            { c: 'CMA CGM', s: 'FAL3', v: 'CMA CGM CHRISTOPHE COLOMB', vo: '0FAYPE1MA' },
            { c: 'Hapag-Lloyd', s: 'NE2', v: 'AL ZUBARA', vo: 'AZ618W' },
            { c: 'MSC', s: 'SILK SERVICE', v: 'MSC GULSUN', vo: 'FW618R' },
            { c: 'Tailwind', s: 'PAX', v: 'TAILWIND HARMONY', vo: 'TW2618N' }
          ];
          const p = choices[Math.floor(Math.random() * choices.length)];
          extras = {
            status: 'ASSIGNED',
            carrier: p.c,
            service: p.s,
            vessel: p.v,
            voyage: p.vo,
            etd: '2026-05-' + String(2 + Math.floor(Math.random() * 10)).padStart(2, '0'),
            eta: '2026-06-' + String(10 + Math.floor(Math.random() * 10)).padStart(2, '0'),
            priority: 1
          };
        } else if (rand < 0.85) {
          extras = { status: 'EXCEPTION', exceptionAtStep: 4, exceptionKey: 'batchNoVoyage' };
        } else {
          extras = { status: 'ON_HOLD', onHoldKey: 'batchCheck' };
        }

        setBookingPos(prev => prev.map(p => p.id === po.id ? { ...p, ...extras } : p));

        if (idx === targets.length - 1) {
          setBookingBatchRunning(false);
          showToast(t(lang, 'toast.batchDone', { n: targets.length }), 'success');
          setBookingSelectedIds(new Set());
        }
      }, (idx + 1) * 400);
    });
  };

  const toggleBookingSelect = (id: number) => {
    setBookingSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleBookingSelectAll = () => {
    const eligibleIds = bookingFiltered.filter(p => p.status === 'NOT_STARTED').map(p => p.id);
    if (bookingSelectedIds.size === eligibleIds.length && eligibleIds.length > 0) {
      setBookingSelectedIds(new Set());
    } else {
      setBookingSelectedIds(new Set(eligibleIds));
    }
  };

  return (
    <>
      <TopNav
        lang={lang}
        counts={counts}
        setLang={setLang}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeSubTab={activeSubTab}
        setActiveSubTab={setActiveSubTab}
      />
      {activeTab === 'preassign' && activeSubTab !== 'exception' && (
        <>
          <PageHeader lang={lang} />
          <div className="page">
            <StatsGrid
              lang={lang}
              counts={counts}
              filter={filter}
              setFilter={setFilter}
            />
            <Toolbar
              lang={lang}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              filter={filter}
              setFilter={setFilter}
              selectedIds={selectedIds}
              batchRunning={batchRunning}
              handleBatchRun={handleBatchRun}
            />
            <POTable
              lang={lang}
              filtered={filtered}
              selectedIds={selectedIds}
              toggleSelect={toggleSelect}
              toggleSelectAll={toggleSelectAll}
              openDrawer={openDrawer}
              runPreAssignLive={runPreAssignLive}
            />
          </div>
        </>
      )}
      {activeTab === 'preassign' && activeSubTab === 'exception' && (
        <ExceptionDashboard
          lang={lang}
          exceptionPOs={pos.filter(p => p.status === 'EXCEPTION')}
          openDrawer={openDrawer}
          onResolve={(po) => {
            setResolvePo(po);
            setResolveOpen(true);
          }}
        />
      )}
      {activeTab === 'booking' && activeSubTab !== 'exception' && (
        <>
          <PageHeader lang={lang} titleKey="bookingPage.title" subtitleKey="bookingPage.subtitle" />
          <div className="page">
            <BookingStatsGrid
              lang={lang}
              counts={bookingCounts}
              filter={bookingFilter}
              setFilter={setBookingFilter}
            />
            <Toolbar
              lang={lang}
              searchQuery={bookingSearchQuery}
              setSearchQuery={setBookingSearchQuery}
              filter={bookingFilter}
              setFilter={setBookingFilter}
              selectedIds={bookingSelectedIds}
              batchRunning={bookingBatchRunning}
              handleBatchRun={handleBookingBatchRun}
              isBooking
            />
            <BookingTable
              lang={lang}
              filtered={bookingFiltered}
              selectedIds={bookingSelectedIds}
              toggleSelect={toggleBookingSelect}
              toggleSelectAll={toggleBookingSelectAll}
              openDrawer={openBookingDrawer}
              runBookingLive={runBookingLive}
            />
          </div>
        </>
      )}
      {activeTab === 'booking' && activeSubTab === 'exception' && (
        <BookingExceptionDashboard
          lang={lang}
          exceptionPOs={bookingPos.filter(p => p.status === 'EXCEPTION')}
          openDrawer={openBookingDrawer}
          onResolve={(po) => {
            setBookingResolvePo(po);
            setBookingResolveOpen(true);
          }}
        />
      )}
      {activeTab === 'allocation' && (
        <AllocationManagement
          lang={lang}
          bookingMatrixVersions={bookingMatrixVersions}
          setBookingMatrixVersions={setBookingMatrixVersions}
          fndRulesVersions={fndRulesVersions}
          setFndRulesVersions={setFndRulesVersions}
          earlyShipmentVersions={earlyShipmentVersions}
          setEarlyShipmentVersions={setEarlyShipmentVersions}
          allocationUsage={allocationUsage}
          initialAllocation={INITIAL_ALLOCATION}
        />
      )}

      {/* Pre-Assign Modals */}
      <Drawer
        po={drawerPo}
        open={drawerOpen}
        onClose={closeDrawer}
        runningStep={runningStep}
        isLiveRun={isLiveRun}
        onRerun={() => drawerPo && runPreAssignLive(drawerPo)}
        lang={lang}
        onGoToException={() => {
          closeDrawer();
          setResolvePo(drawerPo);
          setResolveOpen(true);
        }}
        allocationUsage={allocationUsage}
        initialAllocation={INITIAL_ALLOCATION}
      />
      <ResolveModal
        po={resolvePo}
        open={resolveOpen}
        onClose={() => setResolveOpen(false)}
        onSubmit={(comment) => {
          if (resolvePo) {
            setPos(prev => prev.map(p =>
              p.id === resolvePo.id
                ? { ...p, status: 'NOT_STARTED', exceptionAtStep: undefined, exceptionKey: undefined }
                : p
            ));
            showToast(t(lang, 'toast.resolveSuccess', { po: resolvePo.moovRef || resolvePo.lot }), 'success');
          }
        }}
        lang={lang}
      />

      {/* Carrier Booking Modals */}
      <BookingDrawer
        po={bookingDrawerPo}
        open={bookingDrawerOpen}
        onClose={closeBookingDrawer}
        runningStep={bookingRunningStep}
        isLiveRun={bookingIsLiveRun}
        onRerun={() => bookingDrawerPo && runBookingLive(bookingDrawerPo)}
        lang={lang}
        onGoToException={() => {
          closeBookingDrawer();
          setBookingResolvePo(bookingDrawerPo);
          setBookingResolveOpen(true);
        }}
      />
      <BookingResolveModal
        po={bookingResolvePo}
        open={bookingResolveOpen}
        onClose={() => setBookingResolveOpen(false)}
        onSubmit={(comment) => {
          if (bookingResolvePo) {
            setBookingPos(prev => prev.map(p =>
              p.id === bookingResolvePo.id
                ? { ...p, status: 'NOT_STARTED', exceptionAtStep: undefined, exceptionKey: undefined }
                : p
            ));
            showToast(t(lang, 'toast.resolveSuccess', { po: bookingResolvePo.moovRef || bookingResolvePo.lot }), 'success');
          }
        }}
        lang={lang}
      />

      <ToastContainer toasts={toasts} />
    </>
  );
}

export default App;
