import React, { useId, useMemo, useState } from 'react';
import {
  Calendar,
  Clock,
  CheckCircle2,
  Download,
  AlertCircle,
  Save,
  Trash2,
  Droplets,
  Check,
  Star,
  Compass,
  Sliders,
} from 'lucide-react';
import {
  BaselineConfig,
  OperationalInput,
  OperationalRecord,
  ThresholdConfig,
} from '../types';
import { calculatePressureRatio } from '../utils/calculations';
import { exportOperationalRecordsCSV } from '../utils/export';

interface OperatorInputViewProps {
  onRecordSubmitted: (record: OperationalInput, setAsBaseline?: boolean) => Promise<{ success: boolean; message: string }>;
  baseline: BaselineConfig;
  thresholds: ThresholdConfig;
  records: OperationalRecord[];
  onNavigate: (tab: 'dashboard' | 'input' | 'trend') => void;
  onToggleWaterWash?: (recordId: string) => void;
  onDeleteRecord?: (recordId: string) => void;
  onSetBaselineRecord?: (record: OperationalRecord) => void;
  onOpenBaselineConfig?: () => void;
}

export const OperatorInputView: React.FC<OperatorInputViewProps> = ({
  onRecordSubmitted,
  baseline,
  records,
  onNavigate,
  onToggleWaterWash,
  onDeleteRecord,
  onSetBaselineRecord,
  onOpenBaselineConfig,
}) => {
  const today = new Date().toISOString().slice(0, 10);
  const nowTime = new Date().toTimeString().slice(0, 5);

  const [date, setDate] = useState(today);
  const [time, setTime] = useState(nowTime);
  const [T1_7, setT1_7] = useState<string>('');
  const [P1_7, setP1_7] = useState<string>('');
  const [P3_0, setP3_0] = useState<string>('');
  const [realPower, setRealPower] = useState<string>('');
  const [nphr, setNphr] = useState<string>('');
  const [isWaterWashEvent, setIsWaterWashEvent] = useState<boolean>(false);
  const [setAsBaseline, setSetAsBaseline] = useState<boolean>(!baseline.isConfigured);
  const [notes, setNotes] = useState<string>('');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitMessage, setSubmitMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Automatic calculation of PR = P3.0 / P1.7
  const calculatedPR = useMemo(() => {
    const p3 = parseFloat(P3_0);
    const p1 = parseFloat(P1_7);
    if (!isNaN(p3) && !isNaN(p1) && p1 > 0 && p3 > 0) {
      return calculatePressureRatio(p3, p1);
    }
    return null;
  }, [P3_0, P1_7]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    if (!date) errs.date = 'Date is required';
    if (!time) errs.time = 'Time is required';

    const t = parseFloat(T1_7);
    if (isNaN(t) || t < -40 || t > 160) {
      errs.T1_7 = 'T1.7 must be between -40 and 160 °F';
    }

    const p1 = parseFloat(P1_7);
    if (isNaN(p1) || p1 <= 0 || p1 > 30) {
      errs.P1_7 = 'P1.7 must be between 1 and 30 PSIA';
    }

    const p3 = parseFloat(P3_0);
    if (isNaN(p3) || p3 <= 0 || p3 > 500) {
      errs.P3_0 = 'P3.0 must be between 10 and 500 PSIA';
    }

    const pw = parseFloat(realPower);
    if (isNaN(pw) || pw <= 0 || pw > 1000) {
      errs.realPower = 'Real Power must be between 1 and 1000 MW';
    }

    const hr = parseFloat(nphr);
    if (isNaN(hr) || hr <= 500 || hr > 10000) {
      errs.nphr = 'NPHR must be between 500 and 10000 kcal/kWh';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const isRecordActiveBaseline = (r: OperationalRecord) => {
    if (!baseline?.isConfigured) return false;
    if (baseline.sourceRecordId && baseline.sourceRecordId === r.id) return true;
    if (baseline.date === r.date && baseline.time === r.time) return true;
    if (
      baseline.P3_0 !== null &&
      baseline.P3_0 !== undefined &&
      baseline.realPower !== null &&
      baseline.realPower !== undefined &&
      Math.abs(baseline.P3_0 - r.P3_0) < 0.001 &&
      Math.abs(baseline.realPower - r.realPower) < 0.001 &&
      Math.abs((baseline.nphr ?? 0) - r.nphr) < 0.001
    ) {
      return true;
    }
    return false;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    setSubmitMessage(null);

    const inputData: OperationalInput = {
      date,
      time,
      T1_7: parseFloat(T1_7),
      P1_7: parseFloat(P1_7),
      P3_0: parseFloat(P3_0),
      realPower: parseFloat(realPower),
      nphr: parseFloat(nphr),
      isWaterWashEvent,
      notes: notes.trim() || undefined,
    };

    try {
      const res = await onRecordSubmitted(inputData, setAsBaseline);
      if (res.success) {
        setSubmitMessage({
          type: 'success',
          text: setAsBaseline
            ? 'Data recorded and successfully calibrated as baseline reference.'
            : 'Data successfully recorded.',
        });
        // Reset reading inputs
        setT1_7('');
        setP1_7('');
        setP3_0('');
        setRealPower('');
        setNphr('');
        setNotes('');
        setIsWaterWashEvent(false);
        setSetAsBaseline(false);
        setErrors({});
      } else {
        setSubmitMessage({ type: 'error', text: res.message || 'Failed to save data.' });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Submission failed.';
      setSubmitMessage({ type: 'error', text: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* 1. TOP SECTION: OPERATOR INPUT FORM */}
      <section className="bg-white rounded-md border border-slate-200 p-6 shadow-xs">
        <div className="border-b border-slate-200 pb-3 mb-5">
          <h2 className="text-base font-bold text-slate-900 tracking-tight">Input Data</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Enter verified operational readings. Pressure Ratio (PR = P3.0 / P1.7) is calculated automatically.
          </p>
        </div>

        {submitMessage && (
          <div
            className={`p-3.5 rounded-md mb-5 text-xs font-medium flex items-center justify-between ${
              submitMessage.type === 'success'
                ? 'bg-emerald-50 border border-emerald-300 text-emerald-900'
                : 'bg-rose-50 border border-rose-300 text-rose-900'
            }`}
          >
            <div className="flex items-center gap-2">
              {submitMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{submitMessage.text}</span>
            </div>
            {submitMessage.type === 'success' && (
              <button
                type="button"
                onClick={() => onNavigate('dashboard')}
                className="text-xs font-semibold text-emerald-800 underline hover:text-emerald-950"
              >
                View Dashboard
              </button>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Row 1: Date & Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="input-date" className="block text-xs font-semibold text-slate-700 mb-1">
                Date
              </label>
              <input
                id="input-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-sky-500 focus:border-sky-500 bg-white"
              />
              {errors.date && <p className="text-[11px] text-rose-600 mt-1">{errors.date}</p>}
            </div>

            <div>
              <label htmlFor="input-time" className="block text-xs font-semibold text-slate-700 mb-1">
                Time
              </label>
              <input
                id="input-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-sky-500 focus:border-sky-500 bg-white"
              />
              {errors.time && <p className="text-[11px] text-rose-600 mt-1">{errors.time}</p>}
            </div>
          </div>

          {/* Row 2: Compressor Measurements */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
            <div>
              <label htmlFor="input-t17" className="block text-xs font-semibold text-slate-700 mb-1">
                T1.7 (°F)
              </label>
              <input
                id="input-t17"
                type="number"
                step="0.1"
                value={T1_7}
                onChange={(e) => setT1_7(e.target.value)}
                placeholder="e.g. 70.2"
                required
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-sky-500 focus:border-sky-500 bg-white"
              />
              {errors.T1_7 && <p className="text-[11px] text-rose-600 mt-1">{errors.T1_7}</p>}
            </div>

            <div>
              <label htmlFor="input-p17" className="block text-xs font-semibold text-slate-700 mb-1">
                P1.7 (PSIA)
              </label>
              <input
                id="input-p17"
                type="number"
                step="0.01"
                value={P1_7}
                onChange={(e) => setP1_7(e.target.value)}
                placeholder="e.g. 14.65"
                required
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-sky-500 focus:border-sky-500 bg-white"
              />
              {errors.P1_7 && <p className="text-[11px] text-rose-600 mt-1">{errors.P1_7}</p>}
            </div>

            <div>
              <label htmlFor="input-p30" className="block text-xs font-semibold text-slate-700 mb-1">
                P3.0 (PSIA)
              </label>
              <input
                id="input-p30"
                type="number"
                step="0.1"
                value={P3_0}
                onChange={(e) => setP3_0(e.target.value)}
                placeholder="e.g. 245.0"
                required
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-sky-500 focus:border-sky-500 bg-white"
              />
              {errors.P3_0 && <p className="text-[11px] text-rose-600 mt-1">{errors.P3_0}</p>}
            </div>
          </div>

          {/* Automatic PR Banner */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded flex items-center justify-between text-xs">
            <span className="text-slate-600">
              Calculated Pressure Ratio (PR = P3.0 / P1.7):
            </span>
            <span className="font-mono font-bold text-slate-900 text-sm">
              {calculatedPR !== null ? calculatedPR.toFixed(4) : '— (Auto-calculated)'}
            </span>
          </div>

          {/* Row 3: Output and Heat Rate */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="input-power" className="block text-xs font-semibold text-slate-700 mb-1">
                Real Power (MW)
              </label>
              <input
                id="input-power"
                type="number"
                step="0.1"
                value={realPower}
                onChange={(e) => setRealPower(e.target.value)}
                placeholder="e.g. 154.5"
                required
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-sky-500 focus:border-sky-500 bg-white"
              />
              {errors.realPower && <p className="text-[11px] text-rose-600 mt-1">{errors.realPower}</p>}
            </div>

            <div>
              <label htmlFor="input-nphr" className="block text-xs font-semibold text-slate-700 mb-1">
                NPHR (kcal/kWh)
              </label>
              <input
                id="input-nphr"
                type="number"
                step="1"
                value={nphr}
                onChange={(e) => setNphr(e.target.value)}
                placeholder="e.g. 2435"
                required
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-sky-500 focus:border-sky-500 bg-white"
              />
              {errors.nphr && <p className="text-[11px] text-rose-600 mt-1">{errors.nphr}</p>}
            </div>
          </div>

          {/* Optional Water Wash tag */}
          <div className="pt-2 space-y-2.5 border-t border-slate-100">
            {/* Water Wash Event Checkbox */}
            <div className="flex items-center gap-2">
              <input
                id="input-is-ww"
                type="checkbox"
                checked={isWaterWashEvent}
                onChange={(e) => setIsWaterWashEvent(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
              />
              <label htmlFor="input-is-ww" className="text-xs font-medium text-slate-700 cursor-pointer">
                Water Wash performed on this date
              </label>
            </div>

            {/* Baseline Reference Checkbox */}
            <div className="flex items-start gap-2">
              <input
                id="input-is-baseline"
                type="checkbox"
                checked={setAsBaseline}
                onChange={(e) => setSetAsBaseline(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 mt-0.5"
              />
              <div>
                <label htmlFor="input-is-baseline" className="text-xs font-semibold text-slate-800 cursor-pointer">
                  Set this reading as Baseline Reference (Clean condition)
                </label>
                <p className="text-[11px] text-slate-500">
                  {baseline.isConfigured
                    ? 'Check if this reading represents a newly calibrated clean condition post-wash or overhaul.'
                    : 'Recommended for your first real reading: Future readings will calculate deterioration % against this baseline.'}
                </p>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2 flex justify-end">
            <button
              id="btn-submit-data"
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-slate-900 rounded hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-xs"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Recording...' : 'Submit Reading'}</span>
            </button>
          </div>
        </form>
      </section>

      {/* 2. DIRECTLY BELOW: INPUT HISTORY */}
      <section className="bg-white rounded-md border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Input History</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Chronological log of verified operational readings. Active baseline is highlighted below.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onOpenBaselineConfig && (
              <button
                type="button"
                onClick={onOpenBaselineConfig}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 transition-colors shadow-xs"
                title="Configure or calibrate baseline values"
              >
                <Sliders className="w-3.5 h-3.5 text-slate-500" />
                <span>Baseline Settings</span>
              </button>
            )}
            <button
              id="btn-download-history"
              type="button"
              onClick={() => exportOperationalRecordsCSV(records)}
              disabled={records.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-xs"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Download Data</span>
            </button>
          </div>
        </div>

        {/* Current Active Baseline Info Bar */}
        <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Compass className="w-3.5 h-3.5 text-sky-600 shrink-0" />
            <span className="font-semibold text-slate-700">Active Baseline:</span>
            <span className="text-slate-900 font-medium">
              {baseline?.isConfigured
                ? (baseline.referenceDescription || `${baseline.date || ''} ${baseline.time || ''}`)
                : 'None set (Click "Set as Baseline" on any row below)'}
            </span>
          </div>
          {baseline?.isConfigured && (
            <div className="text-[11px] text-slate-500 font-mono flex flex-wrap gap-x-3 gap-y-1">
              <span>Power: {baseline.realPower?.toFixed(2)} MW</span>
              <span>PR: {baseline.PR?.toFixed(4)}</span>
              <span>P3.0: {baseline.P3_0?.toFixed(2)} PSIA</span>
              <span>NPHR: {baseline.nphr?.toLocaleString()} kcal</span>
            </div>
          )}
        </div>

        {records.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No input records recorded yet. Submit your first reading above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Time</th>
                  <th className="py-3 px-4">T1.7 (°F)</th>
                  <th className="py-3 px-4">P1.7 (PSIA)</th>
                  <th className="py-3 px-4">P3.0 (PSIA)</th>
                  <th className="py-3 px-4">PR</th>
                  <th className="py-3 px-4">Real Power (MW)</th>
                  <th className="py-3 px-4">NPHR (kcal/kWh)</th>
                  <th className="py-3 px-4 text-center">Baseline Reference</th>
                  <th className="py-3 px-4 text-center">WW Status</th>
                  {onDeleteRecord && <th className="py-3 px-2 text-center">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...records].reverse().map((r) => {
                  const isActive = isRecordActiveBaseline(r);
                  return (
                    <tr
                      key={r.id}
                      className={`hover:bg-slate-50 transition-colors ${
                        isActive ? 'bg-emerald-50/50' : r.isWaterWashEvent ? 'bg-sky-50/40' : ''
                      }`}
                    >
                      <td className="py-2.5 px-4 font-medium text-slate-900 whitespace-nowrap">
                        {r.date}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600 whitespace-nowrap">{r.time}</td>
                      <td className="py-2.5 px-4 text-slate-800 whitespace-nowrap">{r.T1_7.toFixed(1)}</td>
                      <td className="py-2.5 px-4 text-slate-800 whitespace-nowrap">{r.P1_7.toFixed(2)}</td>
                      <td className="py-2.5 px-4 text-slate-800 whitespace-nowrap">{r.P3_0.toFixed(2)}</td>
                      <td className="py-2.5 px-4 font-mono font-semibold text-slate-900 whitespace-nowrap">
                        {r.pr.toFixed(4)}
                      </td>
                      <td className="py-2.5 px-4 text-slate-800 whitespace-nowrap">{r.realPower.toFixed(2)}</td>
                      <td className="py-2.5 px-4 text-slate-800 whitespace-nowrap">{r.nphr.toLocaleString()}</td>
                      
                      {/* Baseline Column */}
                      <td className="py-2.5 px-4 text-center whitespace-nowrap">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-extrabold bg-emerald-600 text-white shadow-2xs">
                            <Star className="w-2.5 h-2.5 fill-white" />
                            <span>ACTIVE BASELINE</span>
                          </span>
                        ) : onSetBaselineRecord ? (
                          <button
                            type="button"
                            onClick={() => onSetBaselineRecord(r)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 transition-colors shadow-2xs"
                            title="Click to set this reading as the active baseline reference"
                          >
                            <Compass className="w-3 h-3 text-slate-400" />
                            <span>Set as Baseline</span>
                          </button>
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </td>

                      <td className="py-2.5 px-4 text-center whitespace-nowrap">
                        {onToggleWaterWash ? (
                          <button
                            type="button"
                            onClick={() => onToggleWaterWash(r.id)}
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold transition-colors shadow-2xs ${
                              r.isWaterWashEvent
                                ? 'bg-sky-600 text-white hover:bg-sky-700'
                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-300'
                            }`}
                            title="Click to toggle Water Wash event status"
                          >
                            {r.isWaterWashEvent ? (
                              <>
                                <Check className="w-3 h-3 stroke-[3]" />
                                <span>WW EVENT</span>
                              </>
                            ) : (
                              <span>+ Tag WW</span>
                            )}
                          </button>
                        ) : (
                          r.isWaterWashEvent && (
                            <span className="px-2 py-0.5 text-[10px] font-bold bg-sky-100 text-sky-800 rounded">
                              WW
                            </span>
                          )
                        )}
                      </td>
                      {onDeleteRecord && (
                        <td className="py-2.5 px-2 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => onDeleteRecord(r.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                            title="Delete this reading"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
