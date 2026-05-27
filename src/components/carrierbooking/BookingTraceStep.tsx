import React, { useState } from 'react';
import { Lang } from '../../App';
import { TraceEntry } from '../../utils/traceBuilder';
import { t } from '../../i18n';
import { IconCheck, IconX, IconChevron } from '../icons/index';

interface BookingTraceStepProps {
  entry: TraceEntry;
  currentStep: number | null;
  lang: Lang;
}

export function BookingTraceStep({ entry, currentStep, lang }: BookingTraceStepProps) {
  const [expanded, setExpanded] = useState(false);

  let visualState: 'completed' | 'failed' | 'on_hold' | 'running' | 'skipped' | 'pending';
  if (currentStep === null) {
    visualState = entry.result === 'PASS' ? 'completed'
      : entry.result === 'FAIL' ? 'failed'
      : entry.result === 'ON_HOLD' ? 'on_hold'
      : 'skipped';
  } else if (entry.step < currentStep) {
    visualState = entry.result === 'PASS' ? 'completed'
      : entry.result === 'FAIL' ? 'failed'
      : entry.result === 'ON_HOLD' ? 'on_hold'
      : 'skipped';
  } else if (entry.step === currentStep) {
    visualState = 'running';
  } else {
    visualState = 'pending';
  }

  if (visualState === 'pending') {
    return (
      <div className="step pending">
        <div className="step-num">{entry.step}</div>
        <div className="step-body">
          <div className="step-title-row">
            <span className="step-title" style={{ color: 'var(--text3)' }}>{entry.title}</span>
          </div>
          <div className="step-result" style={{ color: 'var(--text3)', fontStyle: 'italic' }}>
            {t(lang, 'step.waiting')}
          </div>
        </div>
      </div>
    );
  }

  const resultText = entry.result === 'PASS' ? t(lang, 'step.pass')
    : entry.result === 'FAIL' ? t(lang, 'step.fail')
    : entry.result === 'ON_HOLD' ? t(lang, 'step.onHold')
    : t(lang, 'step.skipped');
  const resultClass = entry.result === 'PASS' ? 'pass'
    : (entry.result === 'FAIL' || entry.result === 'ON_HOLD') ? 'fail'
    : '';

  const canExpand = visualState !== 'skipped' && visualState !== 'running';

  return (
    <div className={`step ${visualState} fade-in`}>
      <div className="step-num">
        {visualState === 'completed' && <IconCheck />}
        {(visualState === 'failed' || visualState === 'on_hold') && <IconX />}
        {(visualState === 'running' || visualState === 'skipped') && entry.step}
      </div>
      <div className="step-body">
        <div className="step-title-row">
          <span className="step-title">{entry.title}</span>
          <span className="step-time mono">{entry.duration}ms</span>
        </div>
        {visualState === 'running' ? (
          <div className="step-result" style={{ color: 'var(--text3)', fontStyle: 'italic' }}>
            {t(lang, 'step.processing')}
          </div>
        ) : (
          <div className={`step-result ${resultClass}`}>
            <strong>{resultText}:</strong> {entry.reason}
          </div>
        )}
        {canExpand && (
          <>
            <div
              className={`step-toggle ${expanded ? 'expanded' : ''}`}
              onClick={() => setExpanded(!expanded)}
            >
              <IconChevron />
              <span>{expanded ? t(lang, 'step.collapse') : t(lang, 'step.expand')}</span>
            </div>
            {expanded && (
              <div className="step-detail fade-in">
                {/* Judgment Rule */}
                <div className="step-detail-section" style={{ background: 'rgba(0,79,124,0.04)', borderLeft: '3px solid #004F7C', padding: '8px 10px', marginBottom: 8, borderRadius: '0 4px 4px 0' }}>
                  <h4 style={{ color: '#004F7C' }}>{t(lang, 'step.ruleHeading')}</h4>
                  <div className="detail-row" style={{ marginTop: 4 }}>
                    <span className="detail-val" style={{ fontFamily: 'inherit', fontSize: 11, lineHeight: 1.5, color: '#0F1E2E' }}>{entry.rule}</span>
                  </div>
                </div>
                {/* Input Parameters */}
                <div className="step-detail-section">
                  <h4>{t(lang, 'step.inputHeading')}</h4>
                  {Object.entries(entry.input).map(([k, v]) => (
                    <div className="detail-row" key={k}>
                      <span className="detail-label">{k}</span>
                      <span className="detail-val">{v}</span>
                    </div>
                  ))}
                </div>
                {/* Output Data */}
                <div className="step-detail-section">
                  <h4>{t(lang, 'step.outputHeading')}</h4>
                  {Object.entries(entry.output).map(([k, v]) => (
                    <div className="detail-row" key={k}>
                      <span className="detail-label">{k}</span>
                      <span className="detail-val">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
