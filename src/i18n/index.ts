export type Lang = 'en' | 'zh';

export const I18N = {
  en: {
    nav: { preAssign: 'Pre-Assign', allocationMgmt: 'Allocation Management', exception: 'Exception', carrierBooking: 'Carrier Booking', carrierBookingException: 'Exception', phase2: 'P2' },
    page: { title: 'Pre-Assign', subtitle: 'PO Import & Auto Pre-Assignment', heroTitle: 'The PO board, ', heroTitleAccent: 'automated.', heroBody: 'Pulls PO list from BI in real-time, then runs the 5-step logic to match the optimal carrier, service and vessel voyage. Click any row to view the full trace log; select rows to trigger batch pre-assignment.' },
    bookingPage: { title: 'Carrier Booking', subtitle: 'Actual Booking Execution' },
    meta: { activeMatrix: 'Active Matrix', triggeredToday: 'Triggered Today', lastSynced: 'Last synced', minAgo: '2 min ago', poUnit: 'POs' },
    stats: { total: 'Total POs', not_started: 'Not Started', assigned: 'Assigned', on_hold: 'On Hold', exception: 'Exception', trend: { total: 'All imported', not_started: '+4 in last hour', assigned: 'Avg 1.8s per PO', on_hold: 'Need supplier action', exception: 'Need human review' } },
    bookingStats: { total: 'Total Requests', not_started: 'Not Started', booked: 'Booked', exception: 'Exception', accuracy: 'Pre-assign Accuracy', trend: { total: 'All LOTs with SRD', not_started: 'Awaiting booking run', booked: 'Carrier confirmed', exception: 'Action required', accuracy: 'Exact pre-assign match' } },
    bookingStatus: { ASSIGNED: 'Booked', NOT_STARTED: 'Not Started', ON_HOLD: 'On Hold', EXCEPTION: 'Exception', RUNNING: 'Running…', BOOKED_EXACT: 'Booked · Exact Match', BOOKED_UPDATED: 'Booked · Updated' },
    search: { placeholder: 'Search PO, Lot, IAN, POL, POD…' },
    filter: { ALL: 'All', NOT_STARTED: 'Not Started', ASSIGNED: 'Pre-Assigned', ON_HOLD: 'On Hold', EXCEPTION: 'Exception', BOOKED: 'Booked' },
    btn: { syncFromBi: 'Sync from BI', runAll: 'Run All Not-Started', runSelected: 'Run Pre-Assign · {n} POs', running: 'Running…', runSingle: 'Run', review: 'Review', trace: 'Trace', close: 'Close', rerun: 'Re-run', gotoException: '→ Go to Exception Handling', resolve: 'Resolve' },
    resolve: { title: 'Resolve Exception / 解决异常', traceTitle: 'Execution Trace Log', commentLabel: 'Comment', commentPlaceholder: 'Describe how you resolved this exception...', commentRequired: 'A comment is required before submitting.', submitBtn: 'Submit / 提交' },
    selection: '{n} selected',
    table: {
      moovRef: "MOOV's Ref / LOT", poLot: 'PO / Lot', article: 'Article',
      pol: 'POL', pod: 'POD',
      container: 'Planned TEU', teu: 'Planned TEU', ctrType: 'Ctr Type',
      crdFob: 'CRD · FOB · LDD',
      carrier: 'Carrier / Vessel / Voyage', etdEta: 'ETD / ETA / PETA',
      status: 'Status', empty: 'No POs match the current filter.',
      ianSupplier: 'IAN {ian} · {supplier}', noCarrier: '—'
    },
    status: { ASSIGNED: 'Pre-Assigned', NOT_STARTED: 'Not Started', ON_HOLD: 'On Hold', EXCEPTION: 'Exception', RUNNING: 'Running…' },
    drawer: { title: 'Pre-Assign Trace Log', lane: 'Lane', container: 'Planned TEU', crdFob: 'CRD / FOB', ldd: 'LDD', pipeline: '5-Step Execution Pipeline', progress: 'Step {current}/5 · {pct}%', completed: '5/5 · 100%' },
    step: {
      pass: '✓ Pass', fail: '✗ Fail', skipped: '— Skipped', onHold: '⏸ On Hold', waiting: 'Waiting…', processing: 'Running logic check…',
      expand: 'Expand Input / Output / Rule', collapse: 'Collapse Input / Output / Rule',
      inputHeading: 'Input Parameters', outputHeading: 'Output Data', ruleHeading: 'Judgment Rule',
      titles: {
        1: 'Filter Available PO',
        2: 'Match Candidate Carriers',
        3: 'Match Available Carriers',
        4: 'Match Vessel Voyage',
        5: 'Automated Pre-Assign'
      },
      rules: {
        1: '① CRD week > FOB week → EXCEPTION (cargo not ready before departure). ② FOB − CRD > 4 weeks + LOT not in Early Shipment List → ON_HOLD (request too early). ③ FOB − CRD > 4 weeks + LOT in Early Shipment List → PASS. ④ 0 ≤ buffer ≤ 4 weeks → check LDD/ETA/PETA delivery rules per destination (e.g. BKaufland: LDD−ETA ≥ 5d; standard: ETA ≤ LDD). EXCEPTION if delivery rule fails.',
        2: 'Query BOOKING_MATRIX[POL → POD] → initial carrier list. Estimate ETD allocation week = CRD + 12 ~ 20 days (ISO week). EXCEPTION if no carrier is registered for this lane.',
        3: 'Check each candidate carrier\'s available allocation in the matched ETD week(s) using real-time data from the Allocation Available tab.',
        4: 'Query VESSEL_SCHEDULES where ETD ∈ [CRD+12d, CRD+20d] and ETA ≤ LDD; resolve FND via FND_RULES[carrier][DWH][POD]; EXCEPTION if no voyage found. Then sort by Priority asc → ETA asc → ETD desc; EXCEPTION if rank-1 and rank-2 share identical ETD and ETA.',
        5: 'Link shipper booking info with the unique vessel voyage from Step 4. Auto-fill Pre-assign module. Write record to t_pre_assign (poId, carrier, vessel, voyage, etd, eta, fnd). Update PO status → ASSIGNED.'
      },
      reasons: {
        s1Pass: 'CRD/FOB buffer is {buffer} weeks (within 0–4 week range). LDD/ETA delivery rule passed. PO is eligible.',
        s1PassEarlyShipment: 'CRD/FOB buffer is {buffer} weeks (>4 weeks). LOT found in Early Shipment List and approved — PO is eligible.',
        s1OnHold: 'CRD ({crdWeek}) is {buffer} week(s) before FOB ({fobWeek}). Scheduling constraint triggered. PO placed ON_HOLD — operations team review required.',
        s1OnHoldTooEarly: 'CRD ({crdWeek}) is {buffer} weeks before FOB ({fobWeek}) — exceeds 4-week maximum. LOT not found in Early Shipment List. ON_HOLD: request too early.',
        s1FailCrdLater: 'CRD week ({crdWeek}) is later than FOB week ({fobWeek}) — cargo will not be ready before vessel departure. EXCEPTION: needs human to resolve.',
        s1Fail: 'PO failed Step 1 validation — LDD/ETA delivery rule violation or date constraint. EXCEPTION: needs human to resolve.',
        s2Pass: 'Booking Matrix matched {count} carrier(s) for {lane}. Proceeding to allocation check.',
        s2Fail: 'No carrier registered in Booking Matrix for {lane}. This origin–destination pair is not covered by any active carrier.',
        s3Pass: 'Allocation check passed for week {week} ({region}): carriers with available quota confirmed.',
        s3PassOC: 'Allocation check passed for week {week} ({region}). ⚠ Note: pre-assign TEU has exceeded available space on one or more carriers (overcommit) — permitted in pre-assign stage.',
        s3Fail: 'Allocation week {week}: all carriers exhausted — none have available allocation ≥ {teu} TEU in this week.',
        s4Pass: 'Found and ranked voyage(s) within ETD window; unique best selected. FND resolved.',
        s4FailNoVoyage: 'No vessel scheduled on {lane} within ETD window [{start} → {end}] with ETA ≤ LDD.',
        s4FailNoAlloc: 'Vessel(s) found on lane but no allocation available in week {week}. EXCEPTION: has vessel voyage, no available allocation.',
        s4FailTie: 'After ranking, rank-1 and rank-2 voyages share identical ETD and ETA — cannot automatically select unique best. Manual review required.',
        s5Pass: 'Pre-assignment completed. Record written to t_pre_assign. PO status updated to ASSIGNED.',
        skipped: 'Previous step failed or PO is on hold — step skipped.',
        cbStep1Pass: 'SRD confirmed. Shipment authorized for carrier booking.'
      }
    },
    result: { assignedTitle: 'Pre-Assignment Completed', onHoldTitle: 'On Hold', exceptionTitle: 'Exception · Manual Review Required', failedAtStep: 'Failed at Step {n}: ', carrier: 'Carrier', service: 'Service', vesselVoyage: 'Vessel / Voyage', etd: 'ETD', eta: 'ETA' },
    onHoldReasons: {
      crdSameWeek: 'CRD and FOB are in the same week (buffer = 0). Supplier must push CRD or request early shipment approval.',
      crdBuffer2: 'CRD/FOB buffer is only 2 weeks (< 4-week minimum). Supplier must adjust the cargo ready date.',
      crdBuffer1: 'CRD/FOB buffer is only 1 week (< 4-week minimum). Supplier must push CRD forward.',
      crdLater: 'CRD is later than FOB Week, enters VDDL and cannot be scheduled.',
      notInList7: 'CRD is 7 weeks earlier than FOB (>4 weeks) and not in Early Shipment List.',
      requestTooEarly: 'CRD is more than 4 weeks before FOB and the LOT is not in the Early Shipment List. Request too early — not ready to pre-assign.',
      batchCheck: 'Detected during batch validation: PO CRD/FOB buffer below minimum threshold.'
    },
    exceptionReasons: {
      noCarrier: 'No carrier is registered in the Booking Matrix for this origin port (POL). Lane not covered.',
      noAllocation: 'All candidate carriers have insufficient allocation quota for the required TEU this week.',
      noVoyage: 'No vessel voyage found within the CRD+12d to CRD+20d ETD window with ETA ≤ LDD.',
      voyageTie: 'After sorting in Step 4, rank-1 and rank-2 voyages share identical ETD and ETA. Cannot pick a unique best.',
      noSpace: 'All candidate carriers have insufficient actual space.',
      batchNoVoyage: 'No available voyage within the CRD-to-ETD window (detected during batch run).',
      crdLaterThanFob: 'CRD week is later than FOB week — the cargo ready date falls after the planned FOB departure. Needs human to resolve.',
    },
    pagination: { perPage: '{n} / page', showing: 'Showing {from}–{to} of {total}' },
    stepTitles: { cb1: 'Verify SRD & Authorization' },
    toast: { batchStart: 'Starting batch pre-assign for {n} POs…', batchDone: '✓ Batch pre-assign completed ({n} POs processed)', singleDone: '✓ {po} pre-assigned successfully', singleOnHold: '⏸ {po} — placed on hold (CRD too early)', singleException: '⚠ {po} — exception at step {n}', noEligible: 'No eligible POs to run', resolveSuccess: '✓ {po} resolved and moved to Pre-Assign list' },
    user: { name: 'z.dorothy', email: 'z.dorothy@moovlogistics.com' },
    misc: { langLabel: 'EN' }
  },
  zh: {
    nav: { preAssign: '预排船', allocationMgmt: '配额管理', exception: '异常处理', carrierBooking: '订舱执行', carrierBookingException: '异常', phase2: '阶段二' },
    page: { title: '预排船', subtitle: 'PO 导入与自动预排船', heroTitle: 'PO 排船看板，', heroTitleAccent: '已自动化。', heroBody: '从 BI 实时拉取 PO 列表，按 5 步逻辑自动匹配最优船公司、航线与航次。点击任意行可查看完整 trace log；选中后批量触发预排船。' },
    bookingPage: { title: '订舱执行', subtitle: '实际订舱操作' },
    meta: { activeMatrix: '当前 Matrix', triggeredToday: '今日已触发', lastSynced: '最后同步', minAgo: '2 分钟前', poUnit: '条 PO' },
    stats: { total: 'PO 总数', not_started: '未启动', assigned: '已预排船', on_hold: '已暂缓', exception: '异常', trend: { total: '已全部导入', not_started: '过去 1 小时 +4', assigned: '平均 1.8 秒/PO', on_hold: '需供应商响应', exception: '需人工介入' } },
    bookingStats: { total: '订舱总数', not_started: '未启动', booked: '已订舱', exception: '异常', accuracy: '预排准确率', trend: { total: '含 SRD 的 LOT 总数', not_started: '待执行订舱', booked: '船司已确认', exception: '需人工介入', accuracy: '预排完全命中' } },
    bookingStatus: { ASSIGNED: '已订舱', NOT_STARTED: '未启动', ON_HOLD: '已暂缓', EXCEPTION: '异常', RUNNING: '执行中…', BOOKED_EXACT: '已订舱 · 完全命中', BOOKED_UPDATED: '已订舱 · 已更新' },
    search: { placeholder: '搜索 PO、Lot、IAN、POL、POD…' },
    filter: { ALL: '全部', NOT_STARTED: '未启动', ASSIGNED: '已预排船', ON_HOLD: '已暂缓', EXCEPTION: '异常', BOOKED: '已订舱' },
    btn: { syncFromBi: '从 BI 同步', runAll: '执行所有未启动', runSelected: '执行预排船 · {n} 条', running: '执行中…', runSingle: '执行', review: '审核', trace: '查看日志', close: '关闭', rerun: '重新执行', gotoException: '→ 转至异常处理', resolve: '解决' },
    resolve: { title: '解决异常 / Resolve Exception', traceTitle: '执行追踪日志', commentLabel: '备注', commentPlaceholder: '描述您是如何解决这个异常的...', commentRequired: '提交前必须填写备注。', submitBtn: '提交 / Submit' },
    selection: '已选 {n} 条',
    table: {
      moovRef: "MOOV's Ref / LOT", poLot: 'PO / Lot', article: '商品',
      pol: '起运港', pod: '目的港',
      container: '计划 TEU', teu: '计划 TEU', ctrType: '箱型',
      crdFob: 'CRD · FOB · LDD',
      carrier: '船公司 / 船舶 / 航次', etdEta: 'ETD / ETA / PETA',
      status: '状态', empty: '无符合当前筛选条件的 PO。',
      ianSupplier: 'IAN {ian} · {supplier}', noCarrier: '—'
    },
    status: { ASSIGNED: '已预排船', NOT_STARTED: '未启动', ON_HOLD: '已暂缓', EXCEPTION: '异常', RUNNING: '执行中…' },
    drawer: { title: '预排船执行日志', lane: '航线', container: '计划 TEU', crdFob: 'CRD / FOB', ldd: 'LDD', pipeline: '5 步执行流水线', progress: '步骤 {current}/5 · {pct}%', completed: '5/5 · 100%' },
    step: {
      pass: '✓ 通过', fail: '✗ 失败', skipped: '— 跳过', onHold: '⏸ 暂缓', waiting: '等待中…', processing: '逻辑判断中…',
      expand: '展开输入 / 输出 / 判断规则', collapse: '收起输入 / 输出 / 判断规则',
      inputHeading: '输入参数', outputHeading: '输出数据', ruleHeading: '判断规则',
      titles: {
        1: '筛选可用 PO',
        2: '匹配候选船公司',
        3: '匹配可用船公司',
        4: '匹配航次',
        5: '自动预排船'
      },
      rules: {
        1: '① CRD 周 > FOB 周 → EXCEPTION（货物未备好）。② FOB − CRD > 4 周且 LOT 不在 Early Shipment List → ON_HOLD（请求过早）。③ FOB − CRD > 4 周且 LOT 在 Early Shipment List → PASS。④ 0 ≤ buffer ≤ 4 周 → 检查 LDD/ETA/PETA 交货规则（如 BKaufland：LDD−ETA ≥ 5d；标准：ETA ≤ LDD）。',
        2: '查询 BOOKING_MATRIX[POL → POD]，获取初始船公司列表。预估 ETD 配额周 = CRD + 12 ~ 20 天（ISO 周）。若无船公司注册则 EXCEPTION。',
        3: '在配额管理的 Allocation Available 中，实时查询各候选船公司在对应 ETD 周是否有可用仓位。',
        4: '查询 VESSEL_SCHEDULES，筛选 ETD ∈ [CRD+12d, CRD+20d] 且 ETA ≤ LDD 的航次；通过 FND_RULES[carrier][DWH][POD] 解析 FND；若无符合航次则 EXCEPTION。按 Priority 升 → ETA 升 → ETD 降排序；若第 1 名与第 2 名 ETD+ETA 完全相同则 EXCEPTION。',
        5: '将托运人订舱信息与步骤 4 确定的唯一航次关联。自动填入预排船模块，写入 t_pre_assign 记录。更新 PO 状态为 ASSIGNED。'
      },
      reasons: {
        s1Pass: 'CRD/FOB 间隔为 {buffer} 周（在 0–4 周范围内），LDD/ETA 交货规则通过，PO 符合条件。',
        s1PassEarlyShipment: 'CRD/FOB 间隔为 {buffer} 周（>4 周）。LOT 已在 Early Shipment List 批准，PO 符合条件。',
        s1OnHold: 'CRD（{crdWeek}）比 FOB（{fobWeek}）早 {buffer} 周，排船日程约束触发。PO 转为 ON_HOLD，需运营团队介入。',
        s1OnHoldTooEarly: 'CRD（{crdWeek}）比 FOB（{fobWeek}）早 {buffer} 周，超出 4 周上限且 LOT 不在 Early Shipment List 中。ON_HOLD：请求过早。',
        s1FailCrdLater: 'CRD 周（{crdWeek}）晚于 FOB 周（{fobWeek}）——货物备货日期在计划 FOB 出发日期之后。EXCEPTION：需人工处理。',
        s1Fail: 'PO 步骤 1 验证失败——LDD/ETA 交货规则不符或日期约束问题。EXCEPTION：需人工处理。',
        s2Pass: '订舱矩阵为 {lane} 匹配到 {count} 家船公司，继续执行配额检查。',
        s2Fail: '订舱矩阵中 {lane} 无注册船公司，该起运港至目的港航线无承运商覆盖。',
        s3Pass: '配额周 {week}（{region}）：确认存在可用仓位的船公司。',
        s3PassOC: '配额周 {week}（{region}）通过。⚠ 注意：一个或多个船公司的预排 TEU 已超出可用仓位（超定），预排船阶段允许继续。',
        s3Fail: '配额周 {week}：所有船公司可用余量均不足，无法接受 {teu} TEU。',
        s4Pass: '在 ETD 窗口内找到并排序了航次，唯一最优航次已选定，FND 已解析。',
        s4FailNoVoyage: '在 {lane} 的 ETD 窗口 [{start} → {end}] 内（ETA ≤ LDD）未找到任何航次。',
        s4FailNoAlloc: '找到航次但 ETD 周 {week} 配额已耗尽。EXCEPTION：有船无仓。',
        s4FailTie: '排序后第 1 名与第 2 名航次 ETD 和 ETA 完全相同——无法自动选出唯一最优，需人工介入。',
        s5Pass: '预排船完成。记录已写入 t_pre_assign，PO 状态更新为 ASSIGNED。',
        skipped: '前一步失败或 PO 已暂缓——跳过此步骤。',
        cbStep1Pass: 'SRD 已确认，货物已授权进行舱位预订。'
      }
    },
    result: { assignedTitle: '预排船完成', onHoldTitle: '已暂缓', exceptionTitle: '异常 · 需要人工介入', failedAtStep: '失败于步骤 {n}：', carrier: '船公司', service: '航线服务', vesselVoyage: '船舶 / 航次', etd: 'ETD', eta: 'ETA' },
    onHoldReasons: {
      crdSameWeek: 'CRD 与 FOB 在同一周（间隔为 0 周）。供应商需推迟 CRD 或申请早装审批。',
      crdBuffer2: 'CRD/FOB 间隔仅 2 周（低于 4 周最低要求）。供应商需调整 CRD。',
      crdBuffer1: 'CRD/FOB 间隔仅 1 周（低于 4 周最低要求）。供应商需将 CRD 前移。',
      crdLater: 'CRD 晚于 FOB Week，进入 VDDL，无法排船。',
      notInList7: 'CRD 比 FOB 早 7 周（>4 周），且不在 Early Shipment List 中。',
      requestTooEarly: 'CRD 比 FOB 早超过 4 周，且 LOT 不在 Early Shipment List 中。请求过早，暂不可预排船。',
      batchCheck: '批量验证发现 PO 的 CRD/FOB 间隔低于最低要求。'
    },
    exceptionReasons: {
      noCarrier: '订舱矩阵中该起运港（POL）无注册船公司，航线未覆盖。',
      noAllocation: '本周所有候选船公司配额不足，无法接受所需 TEU。',
      noVoyage: '在 CRD+12d 至 CRD+35d 的 ETD 窗口内，且 ETA ≤ LDD 的航次未找到。',
      voyageTie: 'Step 4 排序后第 1 名与第 2 名 ETD 和 ETA 完全相同，无法自动选出唯一最优。',
      noSpace: '所有候选船公司实际舱位不足。',
      batchNoVoyage: '批量执行发现 CRD 到 ETD 窗口内无可用航次。',
      crdLaterThanFob: 'CRD 周晚于 FOB 周——货物备货日期在计划 FOB 出发日期之后，需人工处理。',
    },
    pagination: { perPage: '{n} 条/页', showing: '显示第 {from}–{to} 条，共 {total} 条' },
    stepTitles: { cb1: '验证 SRD 及授权' },
    toast: { batchStart: '开始批量执行 {n} 条 PO 的预排船…', batchDone: '✓ 批量预排船完成（共处理 {n} 条）', singleDone: '✓ {po} 预排船完成', singleOnHold: '⏸ {po} — 已暂缓（CRD 时间过早）', singleException: '⚠ {po} — 第 {n} 步发生异常', noEligible: '没有可执行的 PO', resolveSuccess: '✓ {po} 已解决并移回预排船列表' },
    user: { name: 'z.dorothy', email: 'z.dorothy@moovlogistics.com' },
    misc: { langLabel: '中' }
  }
};

export function t(lang: Lang, path: string, params?: Record<string, string | number>): string {
  const parts = path.split('.');
  let v: any = I18N[lang];
  for (const p of parts) {
    if (v == null) return path;
    v = v[p];
  }
  if (typeof v !== 'string') return path;
  if (params) {
    for (const [k, val] of Object.entries(params)) {
      v = v.replace(new RegExp('\\{' + k + '\\}', 'g'), String(val));
    }
  }
  return v;
}
