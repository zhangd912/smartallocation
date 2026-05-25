"""
extract_lots.py  —  One-time script to curate 50 real LOTs from LOTlist_orignal.csv
Outputs: src/data/mockData.ts

Run: python scripts/extract_lots.py
"""

import csv, re, random, sys
from datetime import datetime

random.seed(42)

CSV_PATH  = r'C:\Users\z.dorothy\OneDrive - 荷瑞国际物流（上海）有限公司\桌面\Auto-Pre assign-Reference file\LOTlist_orignal.csv'
OUT_PATH  = r'C:\Users\z.dorothy\OneDrive - 荷瑞国际物流（上海）有限公司\桌面\smart allocation\src\data\mockData.ts'

# ---------------------------------------------------------------------------
# Static reference data (mirrors referenceData.ts)
# ---------------------------------------------------------------------------
# (polCode, podCode) → [(carrier_display, carrierCode, service), ...]  P1 first
BOOKING_MATRIX = {
    ('CNTAO','NLRTM'): [('Hapag-Lloyd','HAPL','NE2'),   ('CMA CGM','CMA','FAL3'), ('Tailwind','TSHG','AEX')],
    ('CNNBO','NLRTM'): [('Hapag-Lloyd','HAPL','NE2'),   ('CMA CGM','CMA','FAL3'), ('Tailwind','TSHG','AEX')],
    ('CNXMN','NLRTM'): [('Hapag-Lloyd','HAPL','NE2'),   ('CMA CGM','CMA','FAL3')],
    ('BDCGP','SIKOP'): [('Tailwind','TSHG','SILK'),     ('Hapag-Lloyd','HAPL','NE2')],
    ('CNTAO','SIKOP'): [('Tailwind','TSHG','PAX/DEX'),  ('Hapag-Lloyd','HAPL','NE2')],
    ('CNSHA','BEANR'): [('CMA CGM','CMA','FAL3'),       ('Hapag-Lloyd','HAPL','NE2'), ('MSC','MSC','SILKWAY')],
    ('CNSHA','ESBCN'): [('CMA CGM','CMA','FAL3'),       ('Maersk','MAEU','AEX')],
    ('CNNBO','ESBCN'): [('CMA CGM','CMDU','MEX'),       ('Tailwind','TSHG','PAX')],
    ('CNNBO','SIKOP'): [('CMA CGM','CMDU','BEX2'),      ('Tailwind','TSHG','PAX')],
    ('CNNBO','BEANR'): [('CMA CGM','CMDU','FAL3'),      ('MSC','MSCU','SILK SERVICE')],
    ('BDCGP','ESBCN'): [('CMA CGM','CMDU','CBS/MEDEX'), ('Tailwind','TSHG','TEX/PAX')],
    ('BDCGP','NLRTM'): [('CMA CGM','CMDU','FAL3'),      ('MSC','MSCU','CHITTAGONG FEEDER')],
    ('BDCGP','BEANR'): [('Tailwind','TSHG','TEX/PAX')],
    ('CNYTN','NLRTM'): [('Hapag-Lloyd','HAPL','NE2'),   ('CMA CGM','CMA','FAL3')],
    ('CNYTN','SIKOP'): [('Tailwind','TSHG','PAX/DEX'),  ('Hapag-Lloyd','HAPL','NE2')],
    ('CNYTN','ESBCN'): [('CMA CGM','CMA','FAL3'),       ('Tailwind','TSHG','PAX')],
    ('CNYTN','BEANR'): [('CMA CGM','CMA','FAL3'),       ('MSC','MSC','SILKWAY')],
    ('CNSHA','NLRTM'): [('CMA CGM','CMA','FAL3'),       ('Hapag-Lloyd','HAPL','NE2')],
    ('CNSHA','SIKOP'): [('Tailwind','TSHG','PAX/DEX'),  ('Hapag-Lloyd','HAPL','NE2')],
    ('CNTAO','ESBCN'): [('CMA CGM','CMA','FAL3'),       ('Tailwind','TSHG','PAX')],
    ('CNTAO','BEANR'): [('CMA CGM','CMA','FAL3'),       ('Hapag-Lloyd','HAPL','NE2')],
    ('CNXMN','SIKOP'): [('Tailwind','TSHG','PAX/DEX'),  ('Hapag-Lloyd','HAPL','NE2')],
    ('CNXMN','ESBCN'): [('CMA CGM','CMA','FAL3'),       ('Tailwind','TSHG','PAX')],
    ('CNXMN','BEANR'): [('CMA CGM','CMA','FAL3'),       ('MSC','MSC','SILK SERVICE')],
}

# Best vessel per lane (for ASSIGNED records)
VESSEL_MAP = {
    ('CNTAO','NLRTM'): dict(carrier='Hapag-Lloyd', service='NE2',  vessel='AL ZUBARA',          voyage='AZ618W',    etd='2026-05-18', eta='2026-06-23', peta='2026-06-27'),
    ('CNNBO','NLRTM'): dict(carrier='CMA CGM',     service='FAL3', vessel='CMA CGM TROCADERO',   voyage='0FFXPE2MA', etd='2026-05-16', eta='2026-06-22', peta='2026-06-26'),
    ('CNXMN','NLRTM'): dict(carrier='Hapag-Lloyd', service='NE2',  vessel='BRUSSELS EXPRESS',    voyage='BX619W',    etd='2026-06-10', eta='2026-07-16', peta='2026-07-20'),
    ('CNTAO','SIKOP'): dict(carrier='Tailwind',    service='PAX/DEX',vessel='TAILWIND PIONEER',  voyage='TW2620N',   etd='2026-05-19', eta='2026-06-30', peta='2026-07-04'),
    ('BDCGP','SIKOP'): dict(carrier='Hapag-Lloyd', service='NE2',  vessel='BRUSSELS EXPRESS',    voyage='AZ620W',    etd='2026-06-01', eta='2026-07-10', peta='2026-07-14'),
    ('CNSHA','BEANR'): dict(carrier='CMA CGM',     service='FAL3', vessel='CMA CGM MONTMARTRE',  voyage='0FFYPE3MA', etd='2026-06-15', eta='2026-07-20', peta='2026-07-24'),
    ('BDCGP','NLRTM'): dict(carrier='CMA CGM',     service='FAL3', vessel='CMA CGM EIFFEL',      voyage='0FG2PE1MA', etd='2026-06-08', eta='2026-07-18', peta='2026-07-22'),
    ('CNNBO','ESBCN'): dict(carrier='CMA CGM',     service='MEX',  vessel='CMA CGM MONTMARTRE',  voyage='0FFYPE4MA', etd='2026-06-10', eta='2026-07-10', peta='2026-07-14'),
    ('CNNBO','SIKOP'): dict(carrier='CMA CGM',     service='BEX2', vessel='CMA CGM TROCADERO',   voyage='0FFXPE3MA', etd='2026-06-05', eta='2026-07-12', peta='2026-07-16'),
    ('CNNBO','BEANR'): dict(carrier='CMA CGM',     service='FAL3', vessel='CMA CGM EIFFEL',      voyage='0FG1PE1MA', etd='2026-06-12', eta='2026-07-14', peta='2026-07-18'),
    ('CNSHA','NLRTM'): dict(carrier='CMA CGM',     service='FAL3', vessel='CMA CGM MONTMARTRE',  voyage='0FFYPE2MA', etd='2026-06-18', eta='2026-07-23', peta='2026-07-27'),
    ('BDCGP','ESBCN'): dict(carrier='CMA CGM',     service='CBS/MEDEX',vessel='CMA CGM EIFFEL',  voyage='0FG3PE1MA', etd='2026-06-15', eta='2026-07-25', peta='2026-07-29'),
    ('CNYTN','NLRTM'): dict(carrier='Hapag-Lloyd', service='NE2',  vessel='MAERSK STOCKHOLM',    voyage='MS622W',    etd='2026-06-20', eta='2026-07-25', peta='2026-07-29'),
    ('CNYTN','SIKOP'): dict(carrier='Tailwind',    service='PAX/DEX',vessel='TAILWIND PIONEER',  voyage='TW2621N',   etd='2026-06-22', eta='2026-08-01', peta='2026-08-05'),
    ('CNSHA','SIKOP'): dict(carrier='Tailwind',    service='PAX/DEX',vessel='TAILWIND PIONEER',  voyage='TW2622N',   etd='2026-06-08', eta='2026-07-18', peta='2026-07-22'),
    ('CNTAO','ESBCN'): dict(carrier='CMA CGM',     service='FAL3', vessel='CMA CGM TROCADERO',   voyage='0FFXPE4MA', etd='2026-05-28', eta='2026-07-02', peta='2026-07-06'),
    ('CNTAO','BEANR'): dict(carrier='CMA CGM',     service='FAL3', vessel='CMA CGM EIFFEL',      voyage='0FG4PE1MA', etd='2026-06-05', eta='2026-07-08', peta='2026-07-12'),
}

DWH_FND = {
    'MOE':'NLMOE','RTM':'NLRTM','WDF':'SIKOP','KOP':'SIKOP',
    'BCN':'ESBCN','ANR':'BEANR','LGG':'BELGG','OOS':'NLOOS',
    'MOO':'NLMOE','VEN':'NLMOE',
}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def parse_date(s):
    s = s.strip()
    for fmt in ('%Y/%m/%d','%Y-%m-%d','%m/%d/%Y'):
        try: return datetime.strptime(s,fmt)
        except: pass
    return None

def fmt_d(dt): return dt.strftime('%Y-%m-%d') if dt else ''

def iso_week_str(dt):
    if dt is None: return ''
    c = dt.isocalendar()
    return f'{c[1]:02d}/{str(c[0])[2:]}'

def fob2wk(s):
    m = re.match(r'(\d{4})-(\d{1,2})$',s.strip())
    if not m: return ''
    return f'{int(m.group(2)):02d}/{m.group(1)[2:]}'

def wknum(s):
    try: return int(s.split('/')[0])
    except: return 0

def clean(s):
    """Remove/replace chars that break TS string literals"""
    if s is None: return ''
    s = str(s).strip()
    # replace problematic unicode with ASCII approximations
    s = s.replace('�','?').replace("'","\\'").replace('\\','\\\\')
    # remove remaining non-printable chars
    s = re.sub(r'[\x00-\x1f\x7f]','',s)
    return s

def fnd_for(dwh, pod):
    f = DWH_FND.get((dwh or '').strip().upper())
    if f: return f
    return {'NLRTM':'NLMOE','SIKOP':'SIKOP','ESBCN':'ESBCN','BEANR':'BEANR'}.get(pod, pod)

# ---------------------------------------------------------------------------
# Load CSV
# ---------------------------------------------------------------------------
VALID_POLS = {'CNNBO','CNSHA','BDCGP','CNTAO','CNXMN','CNYTN'}
VALID_PODS = {'NLRTM','SIKOP','ESBCN','BEANR'}

pre_pool, book_pool = [], []

with open(CSV_PATH, encoding='utf-8-sig', errors='replace') as f:
    for row in csv.DictReader(f):
        pol  = row.get('origin_pol','').strip()
        pod  = row.get('origin_pod','').strip()
        crd  = row.get('cargo_ready_date','').strip()
        fob  = row.get('fob_week','').strip()
        teus = row.get('planned_teu','').strip()
        srd  = row.get('shipment_released_date','').strip()
        if not (crd and fob and teus and pol and pod): continue
        if pol not in VALID_POLS or pod not in VALID_PODS: continue
        m = re.match(r'2026-(\d{1,2})$', fob)
        if not m: continue
        wk = int(m.group(1))
        if not (20 <= wk <= 28): continue
        try: teu = int(float(teus))
        except: continue
        crd_dt = parse_date(crd)
        if crd_dt is None: continue
        if not srd and teu >= 2:
            pre_pool.append(row)
        elif srd and teu >= 1:
            book_pool.append(row)

print(f'Pool: pre={len(pre_pool)}, booking={len(book_pool)}', file=sys.stderr)

# ---------------------------------------------------------------------------
# Curate records
# ---------------------------------------------------------------------------
def buf(row):
    """fob_wk minus crd_wk; negative = CRD after FOB"""
    fob_wk = wknum(fob2wk(row.get('fob_week','')))
    crd_dt = parse_date(row.get('cargo_ready_date',''))
    crd_wk = crd_dt.isocalendar()[1] if crd_dt else 0
    return fob_wk - crd_wk

# EXCEPTION (a): use specific lot 514440-BCN-1 → noVoyage (CNSHA→ESBCN has no vessel schedule)
exc_no_voyage = next((r for r in pre_pool if r.get('order_number','').strip()=='514440-BCN-1'), None)
if exc_no_voyage is None:
    exc_no_voyage = next((r for r in pre_pool if r.get('origin_pol','')=='CNSHA' and r.get('origin_pod','')=='ESBCN'), None)

# EXCEPTION (b): crdLaterThanFob — pick the most extreme negative buf
neg_buf_rows = sorted((r for r in pre_pool if buf(r) < -4), key=lambda r: buf(r))
exc_crd_later = neg_buf_rows[0] if neg_buf_rows else None
# Fallback: any negative buf
if exc_crd_later is None:
    neg_buf_rows = sorted((r for r in pre_pool if buf(r) < -1), key=lambda r: buf(r))
    exc_crd_later = neg_buf_rows[0] if neg_buf_rows else None

exc_lots = {r.get('order_number','') for r in [exc_no_voyage, exc_crd_later] if r}
print(f'Exception lots: {exc_lots}', file=sys.stderr)

# ON_HOLD: pick 4 with buf < 0 (CRD after FOB), excluding exceptions
on_hold_cands = [r for r in pre_pool if buf(r) < -1 and r.get('order_number','') not in exc_lots]
random.shuffle(on_hold_cands)
on_hold_sel = on_hold_cands[:4]
on_hold_lots = {r.get('order_number','') for r in on_hold_sel}
print(f'ON_HOLD lots: {on_hold_lots}', file=sys.stderr)

# ASSIGNED: lanes with vessel schedules — target 8
assigned_lanes = set(VESSEL_MAP.keys())
assigned_cands = [r for r in pre_pool
                  if (r.get('origin_pol','').strip(), r.get('origin_pod','').strip()) in assigned_lanes
                  and r.get('order_number','') not in exc_lots | on_hold_lots]
random.shuffle(assigned_cands)
assigned_sel, used_lanes = [], set()
for r in assigned_cands:
    lane = (r.get('origin_pol','').strip(), r.get('origin_pod','').strip())
    if lane not in used_lanes:
        assigned_sel.append(r); used_lanes.add(lane)
    if len(assigned_sel) >= 8: break
for r in assigned_cands:                        # fill if needed
    if r not in assigned_sel: assigned_sel.append(r)
    if len(assigned_sel) >= 8: break
assigned_lots = {r.get('order_number','') for r in assigned_sel}
print(f'ASSIGNED: {len(assigned_sel)}', file=sys.stderr)

# NOT_STARTED: 35 records, diversified by lane
excluded = exc_lots | on_hold_lots | assigned_lots
ns_cands = [r for r in pre_pool if r.get('order_number','') not in excluded]
random.shuffle(ns_cands)
ns_sel, lane_cnt = [], {}
for r in ns_cands:
    lane = (r.get('origin_pol','').strip(), r.get('origin_pod','').strip())
    if lane_cnt.get(lane,0) < 5:
        ns_sel.append(r); lane_cnt[lane] = lane_cnt.get(lane,0)+1
    if len(ns_sel) >= 36: break

# Booking: 50 records — status distribution: 30 NS + 12 BOOKED_EXACT + 5 BOOKED_UPDATED + 3 EXCEPTION
# Sort so records with VESSEL_MAP lanes come first (needed for BOOKED_* statuses)
lanes_with_vessels = set(VESSEL_MAP.keys())
book_vessel = [r for r in book_pool if (r.get('origin_pol','').strip(), r.get('origin_pod','').strip()) in lanes_with_vessels]
book_other  = [r for r in book_pool if (r.get('origin_pol','').strip(), r.get('origin_pod','').strip()) not in lanes_with_vessels]
# 30 NS first (any lane), then vessel-map lanes for BOOKED_* statuses
book_ns_pool     = (book_other + book_vessel)[:30]
book_booked_pool = (book_vessel + book_other)    # vessel-map lanes first
book_exact_sel   = book_booked_pool[:12]
book_upd_sel     = book_booked_pool[12:17]
book_exc_sel     = book_booked_pool[17:20]
# ensure we don't exceed 50 total
book_ns_sel      = book_ns_pool[:30]

print(f'Final: NS={len(ns_sel)}, ASSIGNED={len(assigned_sel)}, ON_HOLD={len(on_hold_sel)}, EXC={sum(1 for x in [exc_crd_later, exc_no_voyage] if x)}', file=sys.stderr)

# ---------------------------------------------------------------------------
# Build TS object string for one row
# ---------------------------------------------------------------------------
def ts_po(row, id_num, status, exc_key=None, exc_step=None, oh_key=None):
    pol   = row.get('origin_pol','').strip()
    pod   = row.get('origin_pod','').strip()
    ian   = row.get('itemnumber','').strip()
    lot   = clean(row.get('order_number','').strip())
    art   = clean(row.get('ohaname','').strip() or row.get('commodity_name','').strip() or row.get('suppliername','').strip() or 'UNKNOWN')
    sup   = clean(row.get('suppliername','').strip() or art)
    batch = clean(row.get('batch','').strip() or '2601')
    dwh   = row.get('delivery_location_code','').strip()
    del_  = clean(row.get('origin_fnd','').strip() or fnd_for(dwh, pod))
    fob   = fob2wk(row.get('fob_week','').strip())
    crd_dt = parse_date(row.get('cargo_ready_date','').strip())
    ldd_dt = parse_date(row.get('latest_delivery_date','').strip())
    srd_dt = parse_date(row.get('shipment_released_date','').strip())
    teu   = int(float(row.get('planned_teu','1').strip()))
    pol_r = row.get('pol_region','').strip() or 'FAR EAST'
    pod_r = row.get('pod_region','').strip() or 'NEU'
    crd   = fmt_d(crd_dt)
    crd_wk= iso_week_str(crd_dt)
    ldd   = fmt_d(ldd_dt)
    srd   = fmt_d(srd_dt)
    mr    = 'MB' + ian.zfill(9)

    L = ['  {']
    L += [f"    id: {id_num},"]
    L += [f"    moovRef: '{clean(mr)}',"]
    L += [f"    lot: '{lot}',"]
    L += [f"    ian: '{clean(ian)}',"]
    L += [f"    article: '{art}',"]
    L += [f"    supplier: '{sup}',"]
    L += [f"    batch: '{batch}',"]
    L += [f"    teu: {teu},"]
    L += [f"    ctr: '40 HC',"]
    L += [f"    ctrType: '40 HC',"]
    L += [f"    pol: '{pol}',"]
    L += [f"    pod: '{pod}',"]
    L += [f"    del: '{del_}',"]
    L += [f"    dwh: '{clean(dwh)}',"]
    L += [f"    crd: '{crd}',"]
    L += [f"    crdWeek: '{crd_wk}',"]
    L += [f"    fobWeek: '{fob}',"]
    L += [f"    ldd: '{ldd}',"]
    L += [f"    polRegion: '{clean(pol_r)}',"]
    L += [f"    podRegion: '{clean(pod_r)}',"]
    L += [f"    status: '{status}',"]

    if srd:
        L += [f"    srd: '{srd}',"]

    if status in ('ASSIGNED', 'BOOKED_EXACT', 'BOOKED_UPDATED'):
        lane = (pol, pod)
        vm   = VESSEL_MAP.get(lane, {})
        voyage_val = vm.get('voyage','')
        if status == 'BOOKED_UPDATED':
            voyage_val = voyage_val + 'U'  # suffix 'U' signals an updated voyage
        if status == 'ASSIGNED':
            L += [f"    priority: 1,"]
        L += [f"    carrier: '{clean(vm.get('carrier','Hapag-Lloyd'))}',"]
        L += [f"    service: '{clean(vm.get('service','NE2'))}',"]
        L += [f"    vessel: '{clean(vm.get('vessel',''))}',"]
        L += [f"    voyage: '{clean(voyage_val)}',"]
        L += [f"    etd: '{vm.get('etd','')}',"]
        L += [f"    eta: '{vm.get('eta','')}',"]
        if vm.get('peta'):
            L += [f"    peta: '{vm['peta']}',"]

    if status == 'EXCEPTION' and exc_key:
        L += [f"    exceptionAtStep: {exc_step},"]
        L += [f"    exceptionKey: '{exc_key}',"]

    if status == 'ON_HOLD' and oh_key:
        L += [f"    onHoldKey: '{oh_key}',"]

    L += ['  }']
    return '\n'.join(L)

# ---------------------------------------------------------------------------
# Assemble output
# ---------------------------------------------------------------------------
lines = []
lines.append("import { PO } from '../App';\n")
lines.append("export const MOCK_POS: PO[] = [")

id_ = 1

# NOT_STARTED (28)
for r in ns_sel:
    lines.append(ts_po(r, id_, 'NOT_STARTED') + ',')
    id_ += 1

# ASSIGNED (7)
for r in assigned_sel:
    lines.append(ts_po(r, id_, 'ASSIGNED') + ',')
    id_ += 1

# ON_HOLD (3)
for r in on_hold_sel:
    lines.append(ts_po(r, id_, 'ON_HOLD', oh_key='crdLater') + ',')
    id_ += 1

# EXCEPTION crdLaterThanFob
if exc_crd_later:
    lines.append(ts_po(exc_crd_later, id_, 'EXCEPTION', exc_key='crdLaterThanFob', exc_step=1) + ',')
    id_ += 1

# EXCEPTION noVoyage
if exc_no_voyage:
    lines.append(ts_po(exc_no_voyage, id_, 'EXCEPTION', exc_key='noVoyage', exc_step=4) + ',')
    id_ += 1

lines.append("];\n")

# BOOKING_MOCK_POS — 30 NOT_STARTED + 12 BOOKED_EXACT + 5 BOOKED_UPDATED + 3 EXCEPTION
lines.append("export const BOOKING_MOCK_POS: PO[] = [")
bid = 101

# 30 NOT_STARTED
for r in book_ns_sel:
    lines.append(ts_po(r, bid, 'NOT_STARTED') + ',')
    bid += 1

# 12 BOOKED_EXACT
for r in book_exact_sel:
    lines.append(ts_po(r, bid, 'BOOKED_EXACT') + ',')
    bid += 1

# 5 BOOKED_UPDATED
for r in book_upd_sel:
    lines.append(ts_po(r, bid, 'BOOKED_UPDATED') + ',')
    bid += 1

# 3 EXCEPTION (noSpace at step 3)
for r in book_exc_sel:
    lines.append(ts_po(r, bid, 'EXCEPTION', exc_key='noSpace', exc_step=3) + ',')
    bid += 1

lines.append("];\n")

# Allocation usage seed (empty — computed live from pos/bookingPos state)
lines.append("// Demo seed for allocation baseline (empty — usage computed live from state)")
lines.append("export const DEMO_ALLOCATION_USAGE: Record<string, { preassign: number; booked: number }> = {};\n")

# Write file
output = '\n'.join(lines)
with open(OUT_PATH, 'w', encoding='utf-8') as f:
    f.write(output)

print(f'Written to {OUT_PATH}', file=sys.stderr)
