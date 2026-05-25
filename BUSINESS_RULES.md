# Smart Allocation — Business Rules Reference

> This file exists to survive context compression. Always re-read this before modifying
> computeAssignment, mockData status fields, or VESSEL_SCHEDULES.

---

## 1. Pre-Assign 5-Step Logic (`computeAssignment`)

### Step 1 — Date Buffer Check
```
bufferWeeks = fobWeek - crdWeek   (both are WW/YY, compare week numbers)
```
| Condition | Result |
|---|---|
| `bufferWeeks < 0` (CRD is **later** than FOB) | **EXCEPTION** `exceptionAtStep:1, exceptionKey:'crdLaterThanFob'` |
| `bufferWeeks > 4` AND lot NOT in `EARLY_SHIPMENT_LOTS` | **ON_HOLD** `onHoldKey:'requestTooEarly'` |
| Otherwise | Continue to Step 2 |

⚠️ **Critical distinction**:
- ON_HOLD = CRD is **more than 4 weeks EARLIER** than FOB (shipment booked too far in advance)
- EXCEPTION Step 1 = CRD is **later** than FOB (logistically impossible)
- These are OPPOSITE conditions — do NOT confuse them

### Step 2 — BOOKING_MATRIX Lookup
- Filter `BOOKING_MATRIX` by `polCode === po.pol && podCode === po.pod`
- If no entries found → **EXCEPTION** `exceptionAtStep:2, exceptionKey:'noCarrier'`

### Step 3 — Allocation Check (Pre-assign)
- Pre-assign allows overcommit → all carriers pass through (no blocking)

### Step 4 — Vessel Schedule Lookup
- ETD window: `CRD + 12 days` to `CRD + 20 days`
- Carrier rank: derived from BOOKING_MATRIX array order for that lane
  - P1 = index 0 (first entry), P2 = index 1, P3 = index 2
  - Try P1 first; if no vessel in window, fall to P2, then P3
- Filter criteria: `polCode`, `podCode`, carrier in rank map, ETD in window, `eta ≤ ldd`, `peta ≤ ldd`
- Sort: by carrierRank ASC → eta ASC → etd DESC
- If 0 candidates → **EXCEPTION** `exceptionAtStep:4, exceptionKey:'noVoyage'`
- If top 2 candidates have same ETD AND same ETA → **EXCEPTION** `exceptionAtStep:4, exceptionKey:'voyageTie'`
  - Demo case: CNSWA→SIKOP TSHG+HLCU both ETD 2026-05-28 ETA 2026-07-02

### Step 5 — Assign
- Assign vessel from best candidate
- Look up FND rule from `FND_RULES` by carrier+dwh+pod → set `del` field

---

## 2. Carrier Schedule Constraints

### Tailwind (TSHG) — Bi-weekly
- Sails every **even ISO week only**: W02, W04, W06 … W24, W26, W28, W30 …
- `INITIAL_ALLOCATION` for TSHG has entries ONLY for even weeks
- VESSEL_SCHEDULES TSHG entries must have ETD in even ISO weeks
- If a LOT's ETD window falls entirely in an odd week → no TSHG vessel → fall to P2

### CMA CGM (CMDU) — Weekly
- Sails every week; INITIAL_ALLOCATION covers W20–W29 (all weeks)

### Hapag-Lloyd (HLCU), MSC (MSCU), COSCO (COSU) — Weekly
- Weekly sailings

---

## 3. Allocation Key Format
```
${carrierCode}|${polRegion}|${podRegion}|${etdWeek}
```
Examples:
- `CMDU|FAR EAST|NEU|28/26`
- `TSHG|BD|MED|26/26`
- `HLCU|FAR EAST|NEU|24/26`

ETD week = ISO week of vessel ETD date, in `WW/YY` format.

---

## 4. mockData Status Rules
Initial statuses set in mockData.ts must match the business logic:

| Status | When to use | Key fields |
|---|---|---|
| `NOT_STARTED` | Default, no carrier/vessel | — |
| `ASSIGNED` | Pre-assign completed | carrier, vessel, voyage, etd, eta, peta |
| `ON_HOLD` | bufferWeeks > 4 AND not in early shipment | onHoldKey: 'requestTooEarly' |
| `EXCEPTION` step 1 | CRD later than FOB (bufferWeeks < 0) | exceptionAtStep:1, exceptionKey:'crdLaterThanFob' |
| `EXCEPTION` step 2 | No entry in BOOKING_MATRIX for this lane | exceptionAtStep:2, exceptionKey:'noCarrier' |
| `EXCEPTION` step 4 | No vessel in ETD window | exceptionAtStep:4, exceptionKey:'noVoyage' |
| `EXCEPTION` step 4 | voyageTie — top 2 same ETD+ETA | exceptionAtStep:4, exceptionKey:'voyageTie' |

---

## 5. Carrier Code Mapping

| Display Name | SCAC (carrierCode) | FND_RULES code |
|---|---|---|
| CMA CGM | CMDU | CMA |
| Hapag-Lloyd | HLCU | HAPL |
| Tailwind | TSHG | TSHG |
| MSC | MSCU | MSC |
| COSCO | COSU | COSCO |
| Maersk | MAEU | MAEU |

---

## 6. Deployment Rules
- **DO NOT push to GitHub** unless user explicitly says to deploy
- Local dev server only; user will give the deploy command
- Branch: `fix/search-table-ux`
- Do NOT modify files in `Auto-Pre assign-Reference file` folder (original source files)
