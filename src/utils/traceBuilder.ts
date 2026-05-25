import { PO, Lang } from '../App';
import { t } from '../i18n';
import { EARLY_SHIPMENT_LOTS, BOOKING_MATRIX, FND_RULES } from '../data/referenceData';

export interface TraceEntry {
  step: number;
  title: string;
  duration: number;
  result: 'PASS' | 'FAIL' | 'SKIPPED' | 'ON_HOLD';
  reason: string;
  rule: string;
  input: Record<string, string>;
  output: Record<string, string>;
}

/**
 * Builds the 6-step trace log for a PO pre-assign run.
 *
 * Step order matches the flowchart:
 *   1. Filter Available PO   — CRD/FOB date check + LDD/ETA delivery rules
 *   2. Match Candidate Carriers — query Booking Matrix for POL → POD lane
 *   3. Match Available Carriers — verify allocation quota > 0 in ETD week
 *   4. Filter Vessel Voyage1    — find vessels, confirm allocation in ETD week
 *   5. Filter Vessel Voyage2    — rank voyages, select unique best
 *   6. Automated Pre-Assign     — write record, set status ASSIGNED
 */
const CARRIER_DISPLAY_TO_CODE: Record<string, string> = {
  'Hapag-Lloyd': 'HLCU',
  'CMA CGM':     'CMDU',
  'Tailwind':    'TSHG',
  'MSC':         'MSCU',
  'Maersk':      'MAEU',
  'COSCO':       'COSU',
};

// Maps carrier display name → FND_RULES carrier code (different from SCAC)
const CARRIER_TO_FND_CODE: Record<string, string> = {
  'Hapag-Lloyd': 'HAPL',
  'CMA CGM':     'CMA',
  'Tailwind':    'TSHG',
  'MSC':         'MSC',
  'COSCO':       'COSCO',
  'Maersk':      'MAEU',
};

export function buildTraceLog(
  po: PO,
  lang: Lang,
  allocationUsage?: Record<string, { preassign: number; booked: number }>,
  initialAllocation?: Record<string, number>
): TraceEntry[] {
  const exAt = po.exceptionAtStep || 999;
  const isOnHold = po.status === 'ON_HOLD';
  const isAssigned = po.status === 'ASSIGNED' || po.status === 'BOOKED_EXACT' || po.status === 'BOOKED_UPDATED';
  // Pre-assign stage allows overcommit — Step 3 never blocks pre-assign.
  // Carrier Booking stage (po.srd present) applies hard allocation check at Step 3.
  const isBookingStage = !!po.srd;
  const r = (key: string, params?: Record<string, string | number>) => t(lang, 'step.reasons.' + key, params);
  const ttl = (n: number) => t(lang, 'step.titles.' + n);
  const rul = (n: number) => t(lang, 'step.rules.' + n);

  // ── Pass/fail cascade ────────────────────────────────────────────────────
  // Step 1: CB → "Verify SRD & Authorization" always passes (SRD = upstream approval).
  //         PA → "Filter Available PO" — ON_HOLD or EXCEPTION possible here.
  const s1Pass = isBookingStage ? true : (!isOnHold && exAt > 1);
  const s2Pass = s1Pass && exAt > 2;
  // Pre-assign: overcommit allowed → step 3 never fails. Booking: hard check applies.
  const s3Pass = s2Pass && (isBookingStage ? exAt > 3 : true);
  // Step 4 covers both vessel finding (old s4) and ranking/tie-break (old s5).
  const s4Pass = s3Pass && exAt > 4;
  const s5Pass = isAssigned;  // Automated Pre-Assign (was step 6)

  // ── Derived display values ───────────────────────────────────────────────
  const lane = `${po.pol} → ${po.pod}`;

  // ETD window: CRD + 12 ~ 20 days
  const etdEarlyDate = po.crd ? addDays(po.crd, 12) : '—';
  const etdLateDate  = po.crd ? addDays(po.crd, 20) : '—';
  const allWeekEarly = po.crd ? dateToISOWeek(addDays(po.crd, 12)) : po.crdWeek;
  const allWeekLate  = po.crd ? dateToISOWeek(addDays(po.crd, 20)) : po.crdWeek;
  const allocationWeek = allWeekEarly === allWeekLate ? allWeekEarly : `${allWeekEarly} ~ ${allWeekLate}`;
  const regionKey = `${po.polRegion ?? 'FAR EAST'} → ${po.podRegion ?? 'NEU'}`;

  // CRD / FOB buffer
  const bufferWeeks = (() => {
    const crdW = parseInt((po.crdWeek || '').split('/')[0]);
    const fobW = parseInt((po.fobWeek || '').split('/')[0]);
    return isNaN(crdW) || isNaN(fobW) ? 0 : fobW - crdW;
  })();

  // LDD/ETA delivery rule (per destination)
  const lddEtaRule = (() => {
    const pod = (po.pod || '').toUpperCase();
    if (pod === 'SIKOP') return 'LDD − ETA ≥ 5 days (BKaufland rule)';
    if (pod === 'BEANR') return 'ETA ≤ LDD, PETA ≤ LDD (BIFBK / BIFRA rule)';
    return 'ETA ≤ LDD and PETA ≤ LDD (standard rule)';
  })();

  // Carrier list for this lane — Step 2: dynamic lookup from BOOKING_MATRIX
  const laneEntries = BOOKING_MATRIX.filter(e => e.polCode === po.pol && e.podCode === po.pod);
  const carriersForLane = (s1Pass && !s2Pass) || laneEntries.length === 0
    ? 'none'
    : laneEntries.map((e, i) => `${e.carrier} (${e.service}) P${i + 1}`).join(', ');

  const carrierCount = carriersForLane === 'none' ? 0 : laneEntries.length;

  // ── Per-carrier allocation breakdown (Step 3) using real allocationUsage ──
  // Looks up each candidate carrier's actual available TEU across the ETD weeks.
  const step3AllocRows = (() => {
    if (carriersForLane === 'none' || !allocationUsage || !initialAllocation) return null;
    const polR = po.polRegion ?? 'FAR EAST';
    const podR = po.podRegion ?? 'NEU';
    const weeks = Array.from(new Set([allWeekEarly, allWeekLate]));
    const rows: Record<string, string> = {};
    for (const [name, code] of Object.entries(CARRIER_DISPLAY_TO_CODE)) {
      if (!carriersForLane.includes(name)) continue;
      let init = 0, booked = 0, pre = 0;
      for (const wk of weeks) {
        const key = `${code}|${polR}|${podR}|${wk}`;
        init += initialAllocation[key] ?? 0;
        const u = allocationUsage[key] ?? { preassign: 0, booked: 0 };
        booked += u.booked;
        pre += u.preassign;
      }
      if (init === 0) continue;
      const avail = init - booked - pre;
      const isOC = avail < 0 || avail < po.teu;
      rows[name] = isOC
        ? `${avail} TEU avail  (init ${init} · booked ${booked} · pre-assigned ${pre})  ⚠ OC`
        : `${avail} TEU avail  (init ${init} · booked ${booked} · pre-assigned ${pre})  ✓`;
    }
    return Object.keys(rows).length > 0 ? rows : null;
  })();

  // Fallback static strings when real data not available
  const carriersWithAlloc = !s3Pass
    ? 'none'
    : po.pod === 'SIKOP'
      ? 'TSHG: 25 TEU ✓, HLCU: 20 TEU ✓'
      : 'HLCU: 68 TEU ✓, CMDU: 42 TEU ✓, TSHG: 35 TEU ✓';

  // Step 4 compact carrier summary: "TSHG: 20 TEU ✓, HLCU: 28 TEU ✓"
  const step4CarrierSummary = (() => {
    if (!step3AllocRows) return carriersWithAlloc;
    return Object.entries(step3AllocRows)
      .map(([name, val]) => {
        const code = CARRIER_DISPLAY_TO_CODE[name] || name;
        const teu = parseInt(val);
        const isOC = val.includes('⚠ OC');
        return `${code}: ${teu} TEU ${isOC ? '⚠' : '✓'}`;
      })
      .join(', ');
  })();

  // Voyage info for step 4/5
  const isTie      = po.exceptionKey === 'voyageTie';
  const isNoVoyage = po.exceptionKey === 'noVoyage';
  const voyagesFound = isNoVoyage
    ? `none — no vessel scheduled on ${lane} within ETD window`
    : isTie
      ? 'PANDA 002/PD2620W (ETD 2026-05-28 ETA 2026-07-02), MAERSK ESSEX/ME619W (ETD 2026-05-28 ETA 2026-07-02)'
      : isAssigned
        ? `${po.vessel} / ${po.voyage} + 2 alternatives`
        : '3 voyages found in window';

  // FND lookup: use FND_RULES with carrier-to-FND-code mapping
  const fndCarrierCode = po.carrier ? (CARRIER_TO_FND_CODE[po.carrier] ?? null) : null;
  const fndRule = fndCarrierCode && po.dwh && po.pod
    ? FND_RULES.find(r => r.carrier === fndCarrierCode && r.dwh === po.dwh.toUpperCase() && r.pod === po.pod)
    : null;
  const fndResult = fndRule?.fnd ?? po.del ?? 'NLMOE';

  return [
    // ── Step 1 (CB): Verify SRD & Authorization ──────────────────────────
    // Carrier Booking stage: SRD = upstream business approval. Always PASS.
    // ── Step 1 (PA): Filter Available PO ─────────────────────────────────
    // Check CRD vs FOB week, CRD/FOB buffer range, and LDD/ETA delivery rules.
    // ON_HOLD: buffer > 4 weeks + not in Early Shipment List.
    // EXCEPTION: CRD after FOB, or LDD/ETA delivery rule violated.
    isBookingStage
    ? {
        step: 1,
        title: t(lang, 'stepTitles.cb1'),
        duration: 38,
        result: 'PASS' as const,
        reason: r('cbStep1Pass'),
        rule: 'Confirm SRD is present and LDD has not passed. SRD implies upstream business approval — shipment is cleared to proceed to carrier booking.',
        input: {
          'SRD': po.srd || '—',
          'LDD': po.ldd,
        },
        output: {
          'Status': 'AUTHORIZED',
          'SRD': po.srd || '—',
        },
      }
    : {
        step: 1,
        title: ttl(1),
        duration: 64,
        result: (isOnHold ? 'ON_HOLD'
              : po.exceptionKey === 'crdLaterThanFob' ? 'FAIL'
              : exAt === 1 ? 'FAIL'
              : 'PASS') as 'PASS' | 'FAIL' | 'ON_HOLD' | 'SKIPPED',
        reason: isOnHold
          ? (bufferWeeks > 4
              ? r('s1OnHoldTooEarly', { buffer: bufferWeeks, crdWeek: po.crdWeek, fobWeek: po.fobWeek })
              : r('s1OnHold', { buffer: bufferWeeks, crdWeek: po.crdWeek, fobWeek: po.fobWeek }))
          : po.exceptionKey === 'crdLaterThanFob'
            ? r('s1FailCrdLater', { crdWeek: po.crdWeek, fobWeek: po.fobWeek })
            : exAt === 1
              ? r('s1Fail')
              : bufferWeeks > 4
                ? r('s1PassEarlyShipment', { buffer: bufferWeeks })
                : r('s1Pass', { buffer: bufferWeeks }),
        rule: rul(1),
        input: {
          'CRD Week': po.crdWeek,
          'FOB Week': po.fobWeek,
          'Buffer (FOB − CRD)': bufferWeeks < 0
            ? `${Math.abs(bufferWeeks)} weeks (CRD is AFTER FOB → EXCEPTION)`
            : `${bufferWeeks} weeks`,
          'Allowed Range': '0–4 weeks | > 4 → Early Shipment List check',
          ...(bufferWeeks > 4 ? {
            'Early Shipment Check': EARLY_SHIPMENT_LOTS.has(po.lot.trim())
              ? '✓ LOT found in Early Shipment List'
              : '✗ LOT not found in Early Shipment List'
          } : {}),
          'LDD': po.ldd,
          'LDD / ETA Delivery Rule': lddEtaRule,
        },
        output: (() => {
          if (isOnHold && bufferWeeks > 4)
            return { 'Status': 'ON_HOLD', 'Reason': `Buffer ${bufferWeeks} wk > 4 wk max, LOT not in Early Shipment List`, 'Action': 'Request early shipment approval' };
          if (isOnHold)
            return { 'Status': 'ON_HOLD', 'Buffer': `${bufferWeeks} wk`, 'Action': 'Operations team review required' };
          if (po.exceptionKey === 'crdLaterThanFob')
            return { 'Status': 'EXCEPTION', 'Error': `CRD (${po.crdWeek}) is after FOB (${po.fobWeek}) — cargo not ready before departure` };
          if (exAt === 1)
            return { 'Status': 'EXCEPTION', 'Error': 'LDD/ETA delivery rule failed. Manual review required.' };
          if (bufferWeeks > 4)
            return { 'Status': 'ELIGIBLE', 'Buffer': `${bufferWeeks} wk (>4)`, 'Early Shipment': 'Approved in Early Shipment List', 'LDD / ETA': 'Pass ✓' };
          return { 'Status': 'ELIGIBLE', 'Buffer': `${bufferWeeks} wk`, 'LDD / ETA Check': 'Pass ✓' };
        })() as unknown as Record<string, string>,
      },

    // ── Step 2: Match Candidate Carriers ─────────────────────────────────
    // Query Booking Matrix for POL → POD lane to get initial carrier list.
    // Estimate ETD allocation week = CRD + 12 ~ 20 days.
    // EXCEPTION if no carrier is registered for this lane.
    {
      step: 2,
      title: ttl(2),
      duration: 42,
      result: !s1Pass ? 'SKIPPED' : s2Pass ? 'PASS' : 'FAIL',
      reason: !s1Pass
        ? r('skipped')
        : s2Pass
          ? r('s2Pass', { lane, count: carrierCount })
          : r('s2Fail', { lane }),
      rule: rul(2),
      input: {
        'POL': po.pol,
        'POD': po.pod,
        'CRD': po.crd || '—',
        'Est. ETD Window (CRD +12 ~ +20d)': `${etdEarlyDate} → ${etdLateDate}`,
        'Allocation Week(s)': allocationWeek,
      },
      output: s2Pass
        ? { 'Carrier Code List': carriersForLane, 'Matched Count': String(carrierCount) }
        : s1Pass
          ? { 'Result': 'EXCEPTION', 'Error': `No carrier registered in Booking Matrix for ${po.pol} → ${po.pod}` }
          : { '—': '—' }
    },

    // ── Step 3: Match Available Carriers ──────────────────────────────────
    // For each candidate carrier, check allocation.csv: pre_allocation > 0 in ETD week.
    // Remove carriers already blocked per Booking Matrix conflict rules.
    // EXCEPTION if no carrier has available allocation in the ETD week.
    {
      step: 3,
      title: ttl(3),
      duration: 118,
      result: !s2Pass ? 'SKIPPED' : s3Pass ? 'PASS' : 'FAIL',
      reason: !s2Pass
        ? r('skipped')
        : s3Pass
          ? (() => {
              // Check if any carrier in the real data is OC
              const hasOC = step3AllocRows && Object.values(step3AllocRows).some(v => v.includes('⚠ OC'));
              return hasOC
                ? r('s3PassOC', { week: allocationWeek, region: regionKey })
                : r('s3Pass', { week: allocationWeek, region: regionKey });
            })()
          : r('s3Fail', { teu: po.teu, week: allocationWeek }),
      rule: rul(3),
      input: {
        'Candidate Carriers (Step 2)': s2Pass ? carriersForLane : '—',
        'ETD Allocation Week': allocationWeek,
        'Region': regionKey,
        'Required TEU': String(po.teu),
      },
      output: s3Pass
        ? {
            ...(step3AllocRows ?? { 'Carriers w/ Allocation': carriersWithAlloc }),
            'Allocation Week': allocationWeek,
          }
        : s2Pass
          ? {
              ...(step3AllocRows ?? {}),
              'Result': 'EXCEPTION',
              'Error': `All carriers exhausted in week ${allocationWeek} — required ${po.teu} TEU`,
            }
          : { '—': '—' }
    },

    // ── Step 4: Match Vessel Voyage ────────────────────────────────────────
    // Query vessel schedules, filter by ETD window + ETA ≤ LDD, then rank by
    // Priority asc → ETA asc → ETD desc. Select unique best.
    // EXCEPTION if no voyage found, allocation exhausted, or tie on rank-1/2.
    {
      step: 4,
      title: ttl(4),
      duration: 216,
      result: !s3Pass ? 'SKIPPED' : s4Pass ? 'PASS' : 'FAIL',
      reason: !s3Pass
        ? r('skipped')
        : s4Pass
          ? r('s4Pass')
          : isNoVoyage
            ? r('s4FailNoVoyage', { lane, start: etdEarlyDate, end: etdLateDate })
            : isTie
              ? r('s4FailTie')  // was s5FailTie, now in merged step 4
              : r('s4FailNoAlloc', { week: allocationWeek }),
      rule: rul(4),
      input: {
        'Carrier Candidates': s3Pass ? step4CarrierSummary : '—',
        'CRD': po.crd || '—',
        'ETD': s4Pass ? (po.etd || etdEarlyDate) : `${etdEarlyDate} ~ ${etdLateDate}`,
        'ETA': s4Pass ? (po.eta || '—') : '—',
        'PETA': po.peta || '—',
        'LDD (ETA & PETA must ≤)': po.ldd,
        'Sort Rules': 'Priority asc → ETA asc → ETD desc',
      },
      output: s4Pass
        ? {
            'Best Vessel': po.vessel || '',
            'Best Voyage': po.voyage || '',
            'ETD / ETA': `${po.etd || ''} / ${po.eta || ''}`,
            'FND': fndResult,
          }
        : isNoVoyage
          ? { 'Vessels Found': '0', 'Result': `EXCEPTION — no vessel on ${lane} in window ${etdEarlyDate} → ${etdLateDate}` }
          : isTie
            ? {
                'Rank 1': 'PANDA 002 / PD2620W — ETD 2026-05-28  ETA 2026-07-02',
                'Rank 2': 'MAERSK ESSEX / ME619W — ETD 2026-05-28  ETA 2026-07-02',
                'Result': 'EXCEPTION — identical ETD & ETA, cannot auto-select unique best',
              }
            : s3Pass
              ? { 'Vessels Found': '≥ 1', 'Allocation in ETD Week': 'None', 'Result': `EXCEPTION — has vessel but no allocation in week ${allocationWeek}` }
              : { '—': '—' }
    },

    // ── Step 5: Automated Pre-Assign ───────────────────────────────────────
    // Link shipper booking info with the unique vessel voyage from Step 4.
    // Auto-fill Pre-assign module; set status → ASSIGNED.
    {
      step: 5,
      title: ttl(5),
      duration: 22,
      result: !s4Pass ? 'SKIPPED' : s5Pass ? 'PASS' : 'SKIPPED',
      reason: !s4Pass ? r('skipped') : s5Pass ? r('s5Pass') : r('skipped'),
      rule: rul(5),
      input: s5Pass
        ? {
            'PO Ref': po.moovRef || String(po.id),
            'Carrier': po.carrier || '',
            'Vessel / Voyage': `${po.vessel} / ${po.voyage}`,
            'ETD / ETA': `${po.etd} / ${po.eta}`,
            'FND': po.del || '—',
          }
        : { '—': '—' },
      output: s5Pass
        ? {
            'Pre-Assign ID': `PA-${String(po.id).padStart(8, '0')}`,
            'Status': 'ASSIGNED',
            'Completed At': new Date().toISOString().slice(0, 19) + 'Z',
          }
        : { 'Status': isOnHold ? 'ON_HOLD' : 'EXCEPTION' }
    }
  ];
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function dateToISOWeek(dateStr: string): string {
  const d = new Date(Date.UTC(
    parseInt(dateStr.slice(0, 4)),
    parseInt(dateStr.slice(5, 7)) - 1,
    parseInt(dateStr.slice(8, 10))
  ));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${String(week).padStart(2, '0')}/${String(d.getUTCFullYear()).slice(-2)}`;
}
