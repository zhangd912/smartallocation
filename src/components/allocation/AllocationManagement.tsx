import React, { useState, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Upload, X, History } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Lang } from '../App';
import { t } from '../i18n';
import { VersionHistory } from './VersionHistory';

interface BookingMatrixRecord {
  id: string;
  originArea: string;
  originCountry: string;
  polCode: string;
  pol: string;
  destinationArea: string;
  podCode: string;
  pod: string;
  delCode: string;
  delCountry: string;
  delName: string;
  service: string;
  carrier: string;
  mot: string;
  serviceName: string;
  tsPort: string;
  transitTime: number;
  ctrType: string;
  award: number;
  assignment: number;
  keyLane: string;
  keyLaneType: string;
  keyLaneCtrSize: string;
  prio: number;
}

interface FNDRule {
  carrier: string;
  dwh: string;
  pod: string;
  fnd: string;
}

interface AllocationManagementProps {
  lang: Lang;
  bookingMatrixVersions: any[];
  setBookingMatrixVersions: (data: any[]) => void;
  fndRulesVersions: any[];
  setFndRulesVersions: (data: any[]) => void;
  earlyShipmentVersions: any[];
  setEarlyShipmentVersions: (data: any[]) => void;
  allocationUsage: Record<string, { preassign: number; booked: number }>;
  initialAllocation: Record<string, number>;
}

const tradeLanes = ['FEWB', 'TP', 'Short Sea', 'Export EU', 'Latam'];

export function AllocationManagement({
  lang,
  bookingMatrixVersions,
  setBookingMatrixVersions,
  fndRulesVersions,
  setFndRulesVersions,
  earlyShipmentVersions,
  setEarlyShipmentVersions,
  allocationUsage,
  initialAllocation
}: AllocationManagementProps) {
  const [activeTab, setActiveTab] = useState<'matrix' | 'fnd' | 'quota' | 'early'>('quota');
  const [selectedLane, setSelectedLane] = useState<string>('All');
  const [showImportModal, setShowImportModal] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [filterCarrier, setFilterCarrier] = useState('ALL');
  const [filterMonth, setFilterMonth] = useState('ALL');
  const [filterWeek, setFilterWeek] = useState('ALL');
  const bar2BaseState = 'available' as const;

  const currentMatrix = bookingMatrixVersions.length > 0 ? bookingMatrixVersions[bookingMatrixVersions.length - 1].data : [];
  const currentFnd = fndRulesVersions.length > 0 ? fndRulesVersions[fndRulesVersions.length - 1].data : [];
  const currentEarly = earlyShipmentVersions.length > 0 ? earlyShipmentVersions[earlyShipmentVersions.length - 1].data : [];

  const tabs = [
    { key: 'quota', label: 'Allocation Available' },
    { key: 'matrix', label: 'Booking Matrix' },
    { key: 'fnd', label: 'FND Rules' },
    { key: 'early', label: 'Early Shipment' },
  ];

  const getQuotaColor = (value: number) => {
    if (value > 70) return { bg: '#D1FAE5', text: '#065F46' };
    if (value > 30) return { bg: '#FEF3C7', text: '#92400E' };
    return { bg: '#FEE2E2', text: '#991B1B' };
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[];
        if (jsonData.length < 2) {
          setUploadError('File is empty or invalid format.');
          return;
        }
        const headers = jsonData[0] as string[];
        const rows = jsonData.slice(1);
        const getValue = (row: any[], headerName: string) => {
          const index = headers.findIndex(h => h?.toString().trim() === headerName);
          return index >= 0 ? row[index] : undefined;
        };
        const records: BookingMatrixRecord[] = rows.slice(0, 100).map((row: any, index: number) => ({
          id: `bm-${Date.now()}-${index}`,
          originArea: getValue(row, 'Origin Area') || '',
          originCountry: getValue(row, 'Origin Country') || '',
          polCode: getValue(row, 'POL Code') || '',
          pol: getValue(row, 'POL') || '',
          destinationArea: getValue(row, 'Destination Area') || '',
          podCode: getValue(row, 'POD Code') || '',
          pod: getValue(row, 'POD') || '',
          delCode: getValue(row, 'DEL Code') || '',
          delCountry: getValue(row, 'DEL Country') || '',
          delName: getValue(row, 'DEL Name') || '',
          service: getValue(row, 'Service') || '',
          carrier: getValue(row, 'Carrier') || '',
          mot: getValue(row, 'MoT') || '',
          serviceName: getValue(row, 'Service Name') || '',
          tsPort: getValue(row, 'T/S Port') || '',
          transitTime: Number(getValue(row, 'Transit Time')) || 0,
          ctrType: getValue(row, 'Ctr Type') || '',
          award: Number(getValue(row, 'Award')) || 0,
          assignment: Number(getValue(row, 'Assignment')) || 0,
          keyLane: getValue(row, 'Key Lane') || '',
          keyLaneType: getValue(row, 'Key Lane + Type') || '',
          keyLaneCtrSize: getValue(row, 'Key Lane incl Ctr Size') || '',
          prio: Number(getValue(row, 'Prio')) || 0,
        }));
        const newVersion = {
          id: `v-${Date.now()}`,
          version: bookingMatrixVersions.length + 1,
          filename: file.name,
          uploader: 'z.dorothy',
          timestamp: new Date().toLocaleString(),
          data: records
        };
        setBookingMatrixVersions([...bookingMatrixVersions, newVersion]);
        setShowImportModal(false);
        setUploadError('');
        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (err) {
        setUploadError('Failed to parse Excel file.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFNDFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[];
        if (jsonData.length < 2) {
          setUploadError('File is empty or invalid format.');
          return;
        }
        const headers = jsonData[0] as string[];
        const rows = jsonData.slice(1);
        const getValue = (row: any[], headerName: string) => {
          const index = headers.findIndex(h => h?.toString().trim() === headerName);
          return index >= 0 ? row[index] : undefined;
        };
        const records = rows.slice(0, 100).map((row: any) => ({
          carrier: getValue(row, 'CARRIER') || '',
          dwh: getValue(row, 'DWH') || '',
          pod: getValue(row, 'POD') || '',
          fnd: getValue(row, 'FND') || '',
        })).filter(r => r.carrier && r.dwh && r.pod && r.fnd);
        const newVersion = {
          id: `v-${Date.now()}`,
          version: fndRulesVersions.length + 1,
          filename: file.name,
          uploader: 'z.dorothy',
          timestamp: new Date().toLocaleString(),
          data: records
        };
        setFndRulesVersions([...fndRulesVersions, newVersion]);
        setShowImportModal(false);
        setUploadError('');
        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (err) {
        setUploadError('Failed to parse Excel file.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleEarlyShipmentFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[];
        if (jsonData.length < 2) {
          setUploadError('File is empty or invalid format.');
          return;
        }
        const headers = jsonData[0] as string[];
        const rows = jsonData.slice(1);
        // Convert rows to array of objects for full rendering
        const fullData = rows.slice(0, 100).map((row: any) => {
          const obj: any = {};
          headers.forEach((header, index) => {
            obj[header] = row[index];
          });
          return obj;
        });
        const newVersion = {
          id: `v-${Date.now()}`,
          version: earlyShipmentVersions.length + 1,
          filename: file.name,
          uploader: 'z.dorothy',
          timestamp: new Date().toLocaleString(),
          data: fullData
        };
        setEarlyShipmentVersions([...earlyShipmentVersions, newVersion]);
        setShowImportModal(false);
        setUploadError('');
        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (err) {
        setUploadError('Failed to parse Excel file.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (activeTab === 'fnd') {
      handleFNDFileUpload(e);
    } else if (activeTab === 'early') {
      handleEarlyShipmentFileUpload(e);
    } else {
      handleFileUpload(e);
    }
  };

  const filteredMatrixData = useMemo(() => {
    if (selectedLane === 'All') return currentMatrix;
    return currentMatrix.filter(row => {
      const keyLaneUpper = row.keyLane?.toUpperCase() || '';
      if (selectedLane === 'FEWB') return keyLaneUpper.includes('FEWB') || keyLaneUpper.includes('CNSHA');
      if (selectedLane === 'TP') return keyLaneUpper.includes('TP') || keyLaneUpper.includes('LAX');
      if (selectedLane === 'Short Sea') return keyLaneUpper.includes('SHORT') || keyLaneUpper.includes('SIN');
      if (selectedLane === 'Export EU') return keyLaneUpper.includes('EU') || keyLaneUpper.includes('EXPORT');
      if (selectedLane === 'Latam') return keyLaneUpper.includes('LATAM') || keyLaneUpper.includes('BR');
      return true;
    });
  }, [currentMatrix, selectedLane]);

  return (
    <div className="page" style={{ paddingTop: '24px' }}>
      <div className="mb-6">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>Allocation Management</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text2)' }}>Manage Booking Matrix, FND rules, allocation quotas</p>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-2">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === tab.key
                  ? 'btn-primary'
                  : 'btn'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {activeTab === 'matrix' && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowImportModal(true)}
              className="btn flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              Import
            </button>
            <button
              onClick={() => setShowVersionHistory(true)}
              className="btn flex items-center gap-2"
            >
              <History className="w-4 h-4" />
              History
            </button>
            <button
              onClick={() => setBookingMatrixVersions([])}
              className="btn"
            >
              Clear
            </button>
          </div>
        )}
        {activeTab === 'fnd' && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowImportModal(true)}
              className="btn flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              Import FND Rules
            </button>
            <button
              onClick={() => setShowVersionHistory(true)}
              className="btn flex items-center gap-2"
            >
              <History className="w-4 h-4" />
              History
            </button>
            <button
              onClick={() => setFndRulesVersions([])}
              className="btn"
            >
              Clear
            </button>
          </div>
        )}
        {activeTab === 'early' && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowImportModal(true)}
              className="btn flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              Import Early Shipment
            </button>
            <button
              onClick={() => setShowVersionHistory(true)}
              className="btn flex items-center gap-2"
            >
              <History className="w-4 h-4" />
              History
            </button>
            <button
              onClick={() => setEarlyShipmentVersions([])}
              className="btn"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {activeTab === 'matrix' && (
        <div className="table-wrap" style={{ maxHeight: 'calc(100vh - 280px)', overflow: 'auto' }}>
          <div className="p-4 border-b flex gap-2" style={{ borderColor: 'var(--border)' }}>
            <button
              onClick={() => setSelectedLane('All')}
              className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                selectedLane === 'All' ? 'btn-primary' : 'btn btn-sm'
              }`}
            >
              All
            </button>
            {tradeLanes.map(lane => (
              <button
                key={lane}
                onClick={() => setSelectedLane(lane)}
                className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                  selectedLane === lane ? 'btn-primary' : 'btn btn-sm'
                }`}
              >
                {lane}
              </button>
            ))}
          </div>
          <table>
            <thead>
              <tr>
                <th>Origin Area</th>
                <th>Origin Country</th>
                <th>POL Code</th>
                <th>POL</th>
                <th>Destination Area</th>
                <th>POD Code</th>
                <th>POD</th>
                <th>Carrier</th>
                <th>Service</th>
                <th>MoT</th>
                <th>Ctr Type</th>
                <th>Award</th>
                <th>Assignment</th>
                <th>Key Lane</th>
              </tr>
            </thead>
            <tbody>
              {filteredMatrixData.length === 0 ? (
                <tr><td colSpan={14} className="empty">{currentMatrix.length === 0 ? 'No data imported' : 'No records match this trade lane'}</td></tr>
              ) : (
                filteredMatrixData.map((row) => (
                  <tr key={row.id}>
                    <td>{row.originArea}</td>
                    <td>{row.originCountry}</td>
                    <td className="mono">{row.polCode}</td>
                    <td>{row.pol}</td>
                    <td>{row.destinationArea}</td>
                    <td className="mono">{row.podCode}</td>
                    <td>{row.pod}</td>
                    <td>{row.carrier}</td>
                    <td>{row.service}</td>
                    <td>{row.mot}</td>
                    <td>{row.ctrType}</td>
                    <td className="mono">{row.award}</td>
                    <td className="mono">{row.assignment}</td>
                    <td className="mono">{row.keyLane}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'fnd' && (
        <div className="table-wrap" style={{ maxHeight: 'calc(100vh - 280px)', overflow: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>CARRIER</th>
                <th>DWH</th>
                <th>POD</th>
                <th>FND</th>
              </tr>
            </thead>
            <tbody>
              {currentFnd.length === 0 ? (
                <tr><td colSpan={4} className="empty">No FND rules imported</td></tr>
              ) : (
                currentFnd.map((rule, i) => (
                  <tr key={i}>
                    <td className="mono">{rule.carrier}</td>
                    <td className="mono">{rule.dwh}</td>
                    <td className="mono">{rule.pod}</td>
                    <td className="mono">{rule.fnd}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'quota' && (() => {
        // Derive month→weeks mapping dynamically from available initialAllocation keys
        const isoWeekToMonth = (weekStr: string): string => {
          const [wPart, yPart] = weekStr.split('/');
          const week = parseInt(wPart);
          const year = 2000 + parseInt(yPart);
          const jan4 = new Date(Date.UTC(year, 0, 4));
          const dow = jan4.getUTCDay() || 7;
          const monday = new Date(jan4);
          monday.setUTCDate(jan4.getUTCDate() - dow + 1 + (week - 1) * 7);
          const thursday = new Date(monday);
          thursday.setUTCDate(monday.getUTCDate() + 3);
          return thursday.toLocaleString('en-US', { month: 'short' });
        };

        const allAvailWeeks = Array.from(new Set(
          Object.keys(initialAllocation).map(k => k.split('|')[3])
        )).sort((a, b) => {
          const [wa, ya] = a.split('/'); const [wb, yb] = b.split('/');
          return (parseInt(ya) * 100 + parseInt(wa)) - (parseInt(yb) * 100 + parseInt(wb));
        });

        const MONTH_WEEKS: Record<string, string[]> = {};
        const MONTHS: string[] = [];
        allAvailWeeks.forEach(w => {
          const m = isoWeekToMonth(w);
          if (!MONTH_WEEKS[m]) { MONTH_WEEKS[m] = []; MONTHS.push(m); }
          MONTH_WEEKS[m].push(w);
        });
        const CARRIER_LABEL: Record<string, string> = {
          HLCU: 'Hapag-Lloyd', CMDU: 'CMA CGM', TSHG: 'Tailwind', MSCU: 'MSC', MAEU: 'Maersk',
          COSU: 'COSCO', ONEY: 'ONE',
        };

        const rowSet = new Set<string>();
        Object.keys(initialAllocation).forEach(k => {
          const parts = k.split('|');
          if (parts.length === 4) rowSet.add(`${parts[0]}|${parts[1]}|${parts[2]}`);
        });
        const allRows = Array.from(rowSet).sort();
        const allCarriers = Array.from(new Set(allRows.map(r => r.split('|')[0]))).sort();
        const filteredRows = filterCarrier === 'ALL' ? allRows : allRows.filter(r => r.split('|')[0] === filterCarrier);

        const viewLevel = filterMonth === 'ALL' ? 1 : filterWeek === 'ALL' ? 2 : 3;
        const weekOptions = filterMonth !== 'ALL' ? MONTH_WEEKS[filterMonth] || [] : [];

        const getWeekData = (rowKey: string, week: string) => {
          const allocKey = `${rowKey}|${week}`;
          const initial = initialAllocation[allocKey] || 0;
          const usage = allocationUsage[allocKey] || { preassign: 0, booked: 0 };
          const hardAvailable = Math.max(0, initial - usage.booked);
          const preassignAvail = initial - usage.booked - usage.preassign;
          return {
            initial, preassign: usage.preassign, booked: usage.booked,
            hardAvailable, preassignAvail,
            isOvercommit: preassignAvail < 0,
            healthPct: initial > 0 ? hardAvailable / initial : null,
          };
        };

        const getAggData = (rowKey: string, weeks: string[]) => {
          let initial = 0, preassign = 0, booked = 0;
          weeks.forEach(w => {
            const d = getWeekData(rowKey, w);
            initial += d.initial; preassign += d.preassign; booked += d.booked;
          });
          const hardAvailable = Math.max(0, initial - booked);
          const preassignAvail = initial - booked - preassign;
          return {
            initial, preassign, booked, hardAvailable, preassignAvail,
            isOvercommit: preassignAvail < 0,
            healthPct: initial > 0 ? hardAvailable / initial : null,
          };
        };

        const heatColor = (healthPct: number | null) => {
          if (healthPct === null) return { bg: 'transparent', text: 'var(--text3)' };
          if (healthPct >= 0.5) return { bg: '#D1FAE5', text: '#065F46' };
          if (healthPct >= 0.2) return { bg: '#FEF3C7', text: '#92400E' };
          return { bg: '#FEE2E2', text: '#991B1B' };
        };

        type CellData = ReturnType<typeof getWeekData>;

        const mkTooltip = (label: string, d: CellData) => {
          const used = d.preassign + d.booked;
          return `${label}\n──────────────────────\nInitial quota     ${d.initial} TEU\nPre-assign        ${d.preassign} TEU\nCarrier Booking   ${d.booked} TEU\nUsed (total)      ${used} TEU\nRemaining         ${d.preassignAvail} TEU${d.isOvercommit ? '  ⚠ Overcommit' : ''}`;
        };

        const renderHeatCell = (d: CellData, tt: string) => {
          if (d.initial === 0) return <span style={{ color: 'var(--text3)', fontSize: 11 }}>—</span>;
          const colors = d.isOvercommit ? { bg: '#FEE2E2', text: '#991B1B' } : heatColor(d.healthPct);
          return (
            <div
              style={{ background: colors.bg, color: colors.text, borderRadius: 5, padding: '3px 8px', fontSize: 11, fontFamily: 'monospace', display: 'inline-flex', alignItems: 'center', gap: 2, cursor: 'default', minWidth: 70 }}
              title={tt}
            >
              <span>{d.preassign + d.booked}</span>
              <span style={{ opacity: 0.5, fontSize: 10 }}>/{d.preassignAvail}</span>
              {d.isOvercommit && <span style={{ fontSize: 9, fontWeight: 700, color: '#DC2626', marginLeft: 2 }}>⚠OC</span>}
            </div>
          );
        };

        const renderDualBars = (rowKey: string, week: string) => {
          const d = getWeekData(rowKey, week);
          if (d.initial === 0) return <span style={{ color: 'var(--text3)', fontSize: 11 }}>—</span>;
          const bookedPct = d.initial > 0 ? Math.min(100, (d.booked / d.initial) * 100) : 0;
          const base2 = bar2BaseState === 'available' ? d.hardAvailable : d.initial;
          const preassignPct = d.isOvercommit ? 100 : (base2 > 0 ? Math.min(100, (d.preassign / base2) * 100) : 0);
          return (
            <div style={{ padding: '6px 0', minWidth: 260 }}>
              {/* Bar 1: Carrier Booking vs initial */}
              <div style={{ marginBottom: 6 }}>
                <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 2 }}>Carrier Booking vs Initial quota</div>
                <div style={{ display: 'flex', height: 16, borderRadius: 3, overflow: 'hidden', background: '#E5E7EB' }}>
                  {d.booked > 0 && (
                    <div style={{ width: `${bookedPct}%`, background: '#1E40AF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {bookedPct > 15 && <span style={{ fontSize: 9, color: '#fff', fontWeight: 600 }}>{d.booked}</span>}
                    </div>
                  )}
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 4 }}>
                    {(100 - bookedPct) > 12 && <span style={{ fontSize: 9, color: '#6B7280' }}>{d.hardAvailable}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text3)', marginTop: 1 }}>
                  <span>{d.booked > 0 ? `${d.booked} booked` : 'none booked'} / {d.initial} quota</span>
                  <span>{d.hardAvailable} available</span>
                </div>
              </div>
              {/* Bar 2: Pre-assign vs available or initial */}
              <div>
                <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 2 }}>
                  Pre-assign vs {bar2BaseState === 'available' ? 'Available' : 'Initial quota'}
                </div>
                <div style={{ display: 'flex', height: 16, borderRadius: 3, overflow: 'hidden', background: '#FED7AA' }}>
                  <div style={{
                    width: `${preassignPct}%`,
                    background: d.isOvercommit
                      ? 'repeating-linear-gradient(45deg, #F97316, #F97316 4px, #FED7AA 4px, #FED7AA 8px)'
                      : '#F97316',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {preassignPct > 15 && <span style={{ fontSize: 9, color: d.isOvercommit ? '#7C2D12' : '#fff', fontWeight: 600 }}>{d.preassign}</span>}
                  </div>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 4 }}>
                    {!d.isOvercommit && preassignPct < 88 && <span style={{ fontSize: 9, color: '#92400E' }}>{d.preassignAvail} pre-assign avail</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text3)', marginTop: 1 }}>
                  <span>
                    {d.preassign} pre-assigned
                    {d.isOvercommit && <span style={{ color: '#DC2626', fontWeight: 700 }}> ⚠ OC (+{Math.abs(d.preassignAvail)} over)</span>}
                  </span>
                  {!d.isOvercommit && <span>{d.preassignAvail} pre-assign avail</span>}
                </div>
              </div>
            </div>
          );
        };

        return (
          <div>
            {/* Fixed legend */}
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', padding: '8px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 12, flexWrap: 'wrap', fontSize: 11, color: 'var(--text2)' }}>
              <span style={{ fontWeight: 600, color: 'var(--text)', marginRight: 2 }}>Legend:</span>
              <span>
                <span style={{ display: 'inline-block', width: 10, height: 10, background: '#1E40AF', borderRadius: 2, marginRight: 4, verticalAlign: 'middle' }}></span>
                Carrier Booking — confirmed hard bookings with carrier
              </span>
              <span>
                <span style={{ display: 'inline-block', width: 10, height: 10, background: '#F97316', borderRadius: 2, marginRight: 4, verticalAlign: 'middle' }}></span>
                Pre-assign — system soft-bookings, not yet confirmed
              </span>
              <span>
                <span style={{ display: 'inline-block', width: 10, height: 10, background: '#E5E7EB', border: '1px solid #D1D5DB', borderRadius: 2, marginRight: 4, verticalAlign: 'middle' }}></span>
                Available — Initial quota minus Carrier Booking
              </span>
              <span style={{ color: '#DC2626' }}>
                <span style={{ fontWeight: 700, marginRight: 4 }}>⚠ OC</span>
                Pre-assign exceeds Available — allowed in pre-assign stage
              </span>
            </div>

            {/* Filter bar */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text2)' }}>
                Carrier
                <select className="pagination-select" value={filterCarrier} onChange={e => setFilterCarrier(e.target.value)}>
                  <option value="ALL">All</option>
                  {allCarriers.map(c => <option key={c} value={c}>{CARRIER_LABEL[c] || c}</option>)}
                </select>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text2)' }}>
                Month
                <select className="pagination-select" value={filterMonth} onChange={e => { setFilterMonth(e.target.value); setFilterWeek('ALL'); }}>
                  <option value="ALL">All</option>
                  {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: filterMonth === 'ALL' ? 'var(--text3)' : 'var(--text2)' }}>
                Week
                <select className="pagination-select" value={filterWeek} onChange={e => setFilterWeek(e.target.value)} disabled={filterMonth === 'ALL'}>
                  <option value="ALL">All</option>
                  {weekOptions.map(w => <option key={w} value={w}>W{w.split('/')[0]}</option>)}
                </select>
              </label>
            </div>

            {/* Subtitle */}
            <p style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 10, fontStyle: 'italic' }}>
              {viewLevel === 1 && 'Year overview — cells show Carrier Booking available TEU aggregated per month. Color reflects hard availability (Initial − Carrier Booking). ⚠ OC = Pre-assign exceeds available space (normal and expected in pre-assign stage).'}
              {viewLevel === 2 && `${filterMonth} breakdown — each column is one allocation week. Figures show available TEU (Initial − Carrier Booking). Color reflects Carrier Booking utilization only; Pre-assign does not affect color.`}
              {viewLevel === 3 && `Week W${filterWeek.split('/')[0]} detail — Bar 1: Carrier Booking against initial quota. Bar 2: Pre-assign soft-booking against available space (Initial − Carrier Booking).`}
            </p>

            {/* Table */}
            <div className="table-wrap" style={{ maxHeight: 'calc(100vh - 380px)', overflow: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ minWidth: 140 }}>Carrier</th>
                    <th style={{ minWidth: 110 }}>POL Region</th>
                    <th style={{ minWidth: 110 }}>POD Region</th>
                    {viewLevel === 1 && MONTHS.map(m => (
                      <th key={m} className="text-center" style={{ minWidth: 110 }}>
                        {m}
                        <div style={{ fontSize: 9, fontWeight: 400, color: 'var(--text3)', marginTop: 2 }}>Used / Remaining</div>
                      </th>
                    ))}
                    {viewLevel === 2 && weekOptions.map(w => (
                      <th key={w} className="text-center" style={{ minWidth: 100 }}>
                        W{w.split('/')[0]}
                        <div style={{ fontSize: 9, fontWeight: 400, color: 'var(--text3)', marginTop: 2 }}>Used / Remaining</div>
                      </th>
                    ))}
                    {viewLevel === 3 && <th style={{ minWidth: 300 }}>W{filterWeek.split('/')[0]} — Allocation Detail</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 ? (
                    <tr><td colSpan={viewLevel === 1 ? 6 : viewLevel === 2 ? 3 + weekOptions.length : 4} className="empty">No allocation data</td></tr>
                  ) : filteredRows.map(rowKey => {
                    const [carrier, polReg, podReg] = rowKey.split('|');
                    return (
                      <tr key={rowKey}>
                        <td style={{ fontWeight: 500 }}>{CARRIER_LABEL[carrier] || carrier}</td>
                        <td style={{ fontSize: 11, color: 'var(--text2)' }}>{polReg}</td>
                        <td style={{ fontSize: 11, color: 'var(--text2)' }}>{podReg}</td>
                        {viewLevel === 1 && MONTHS.map(m => {
                          const d = getAggData(rowKey, MONTH_WEEKS[m]);
                          return (
                            <td key={m} style={{ textAlign: 'center', padding: '4px 6px' }}>
                              {renderHeatCell(d, mkTooltip(`${CARRIER_LABEL[carrier] || carrier} · ${polReg} → ${podReg} · ${m}`, d))}
                            </td>
                          );
                        })}
                        {viewLevel === 2 && weekOptions.map(w => {
                          const d = getWeekData(rowKey, w);
                          return (
                            <td key={w} style={{ textAlign: 'center', padding: '4px 6px' }}>
                              {renderHeatCell(d, mkTooltip(`${CARRIER_LABEL[carrier] || carrier} · ${polReg} → ${podReg} · W${w.split('/')[0]}`, d))}
                            </td>
                          );
                        })}
                        {viewLevel === 3 && (
                          <td style={{ padding: '2px 12px' }}>
                            {renderDualBars(rowKey, filterWeek)}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {activeTab === 'early' && (
        <div className="table-wrap" style={{ maxHeight: 'calc(100vh - 280px)', overflow: 'auto' }}>
          <table>
            <thead>
              <tr>
                {currentEarly.length > 0 && Object.keys(currentEarly[0]).map((key) => (
                  <th key={key}>{key}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {currentEarly.length === 0 ? (
                <tr><td colSpan={10} className="empty">No early shipment lots imported</td></tr>
              ) : (
                currentEarly.map((row, i) => (
                  <tr key={i}>
                    {Object.values(row).map((val: any, j) => (
                      <td key={j} className="mono">{val}</td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {showImportModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'rgba(0,0,0,0.3)' }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl p-6 w-[500px] shadow-lg"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold">Import Excel File</h3>
              <button onClick={() => setShowImportModal(false)} style={{ color: 'var(--text2)' }}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div
              className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer"
              style={{ borderColor: 'var(--border)' }}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text3)' }} />
              <p className="text-sm mb-1" style={{ color: 'var(--text2)' }}>Click to upload Excel file</p>
              <p className="text-xs" style={{ color: 'var(--text3)' }}>Supports .xlsx format</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileSelect}
              className="hidden"
            />
            {uploadError && (
              <p className="text-sm mt-3 text-center" style={{ color: 'var(--danger)' }}>{uploadError}</p>
            )}
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowImportModal(false)}
                className="btn"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {showVersionHistory && (
        <VersionHistory
          versions={
            activeTab === 'matrix' ? bookingMatrixVersions :
            activeTab === 'fnd' ? fndRulesVersions :
            earlyShipmentVersions
          }
          onClose={() => setShowVersionHistory(false)}
          onRestore={(version) => {
            if (activeTab === 'matrix') {
              setBookingMatrixVersions(prev => [...prev.filter(v => v.version <= version.version), version]);
            } else if (activeTab === 'fnd') {
              setFndRulesVersions(prev => [...prev.filter(v => v.version <= version.version), version]);
            } else {
              setEarlyShipmentVersions(prev => [...prev.filter(v => v.version <= version.version), version]);
            }
            setShowVersionHistory(false);
          }}
        />
      )}
    </div>
  );
}
