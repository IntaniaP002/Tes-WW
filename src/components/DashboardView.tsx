import React, { useState } from 'react';
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  HelpCircle,
  ChevronRight,
  Info,
} from 'lucide-react';
import {
  BaselineConfig,
  OperationalRecord,
  ThresholdConfig,
  WaterWashEvent,
} from '../types';
import { WaterWashDetailModal } from './WaterWashDetailModal';

interface DashboardViewProps {
  latestRecord?: OperationalRecord;
  baseline: BaselineConfig;
  thresholds: ThresholdConfig;
  events: WaterWashEvent[];
  recordsCount: number;
  onNavigate: (tab: 'dashboard' | 'input' | 'trend') => void;
  onOpenImport?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  latestRecord,
  baseline,
  thresholds,
  events,
  recordsCount,
  onNavigate,
  onOpenImport,
}) => {
  const [selectedEvent, setSelectedEvent] = useState<WaterWashEvent | null>(null);

  const hasData = Boolean(latestRecord);
  const hasBaseline = baseline.isConfigured;

  // Compute status label for each parameter
  const getParamStatus = (
    det: number | null | undefined,
    thresh: number,
    isNphr: boolean = false,
    earlyBound: number = 1.7
  ): { label: 'Normal' | 'Monitoring' | 'Threshold Reached' | 'N/A'; colorClass: string } => {
    if (det === null || det === undefined || !hasBaseline) {
      return { label: 'N/A', colorClass: 'bg-slate-100 text-slate-600 border-slate-200' };
    }
    if (det >= thresh) {
      return { label: 'Threshold Reached', colorClass: 'bg-rose-50 text-rose-800 border-rose-300 font-semibold' };
    }
    if (isNphr && det >= earlyBound) {
      return { label: 'Monitoring', colorClass: 'bg-amber-50 text-amber-800 border-amber-300 font-medium' };
    }
    if (!isNphr && det >= thresh * 0.5) {
      return { label: 'Monitoring', colorClass: 'bg-amber-50 text-amber-800 border-amber-300 font-medium' };
    }
    return { label: 'Normal', colorClass: 'bg-emerald-50 text-emerald-800 border-emerald-300' };
  };

  const nphrStatus = getParamStatus(
    latestRecord?.nphrDeterioration,
    thresholds.nphrWWThreshold,
    true,
    thresholds.nphrEarlyMonitoring
  );
  const prStatus = getParamStatus(latestRecord?.prDeterioration, thresholds.prWWThreshold);
  const p3Status = getParamStatus(latestRecord?.p3Deterioration, thresholds.p3WWThreshold);
  const powerStatus = getParamStatus(latestRecord?.powerDeterioration, thresholds.powerWWThreshold);

  // Overall Recommendation determination
  const getRecommendation = () => {
    if (!hasData || !hasBaseline) {
      return {
        label: 'AWAITING DATA',
        boxStyle: 'bg-slate-50 border-slate-200 text-slate-700',
        badgeStyle: 'bg-slate-200 text-slate-700',
        icon: <HelpCircle className="w-6 h-6 text-slate-400" />,
        explanation: 'Operational data or baseline reference required to calculate condition.',
      };
    }

    const count = latestRecord?.thresholdsMetCount ?? 0;

    if (count >= 3) {
      return {
        label: 'RECOMMEND WATER WASH',
        boxStyle: 'bg-rose-50/70 border-rose-300 text-rose-950',
        badgeStyle: 'bg-rose-600 text-white',
        icon: <AlertTriangle className="w-6 h-6 text-rose-600" />,
        explanation: `${count} of 4 parameters reached the Water Wash threshold.`,
      };
    }

    if (count >= 1) {
      return {
        label: 'MONITORING',
        boxStyle: 'bg-amber-50/70 border-amber-300 text-amber-950',
        badgeStyle: 'bg-amber-600 text-white',
        icon: <Clock className="w-6 h-6 text-amber-600" />,
        explanation: `${count} of 4 parameters reached the Water Wash threshold.`,
      };
    }

    // 0 thresholds reached
    if (latestRecord?.nphrEarlyMonitoringReached) {
      return {
        label: 'MONITORING',
        boxStyle: 'bg-amber-50/70 border-amber-300 text-amber-950',
        badgeStyle: 'bg-amber-600 text-white',
        icon: <Clock className="w-6 h-6 text-amber-600" />,
        explanation: '0 of 4 parameters reached the Water Wash threshold (NPHR early monitoring).',
      };
    }

    return {
      label: 'NORMAL',
      boxStyle: 'bg-emerald-50/60 border-emerald-300 text-emerald-950',
      badgeStyle: 'bg-emerald-600 text-white',
      icon: <CheckCircle2 className="w-6 h-6 text-emerald-600" />,
      explanation: '0 of 4 parameters reached the Water Wash threshold.',
    };
  };

  const rec = getRecommendation();

  // Helper formatting
  const formatChange = (
    delta: number | null | undefined,
    pct: number | null | undefined,
    unit: string = '',
    reverse: boolean = false
  ) => {
    if (delta === null || delta === undefined || isNaN(delta)) return 'N/A';
    const sign = delta > 0 ? '+' : '';
    const pctStr = pct !== null && pct !== undefined && !isNaN(pct) ? ` (${sign}${pct.toFixed(2)}%)` : '';
    const isGood = reverse ? delta < 0 : delta > 0;
    const color = isGood ? 'text-emerald-700 font-semibold' : 'text-slate-800';

    return (
      <span className={color}>
        {sign}{delta.toFixed(2)}{unit ? ' ' + unit : ''}{pctStr}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Missing Baseline Notice */}
      {!hasBaseline && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Baseline reference values are not set. Input your first operational reading or import data to establish baseline.
            </span>
          </div>
          {onOpenImport && (
            <button
              type="button"
              onClick={onOpenImport}
              className="px-3 py-1 font-semibold text-xs bg-amber-700 text-white rounded hover:bg-amber-800 transition-colors"
            >
              Import Data
            </button>
          )}
        </div>
      )}

      {/* 1. TOP SECTION: CURRENT CONDITION & WATER WASH RECOMMENDATION */}
      <section className="bg-white rounded-md border border-slate-200 p-5 shadow-xs space-y-4">
        {/* Main Recommendation Banner */}
        <div className={`p-4 rounded border ${rec.boxStyle} flex flex-col sm:flex-row sm:items-center justify-between gap-3`}>
          <div className="flex items-center gap-3">
            {rec.icon}
            <div>
              <div className="text-[11px] font-bold tracking-wider uppercase opacity-75">
                Water Washing Recommendation
              </div>
              <div className="text-xl font-extrabold tracking-tight mt-0.5">
                {rec.label}
              </div>
            </div>
          </div>
          <div className="sm:text-right">
            <span className="text-xs font-medium block">
              {rec.explanation}
            </span>
            {latestRecord && (
              <span className="text-[11px] opacity-75 mt-0.5 block">
                Last reading: {latestRecord.date} {latestRecord.time}
              </span>
            )}
          </div>
        </div>

        {/* 4 Main Performance Parameters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          {/* NPHR */}
          <div className="bg-white border border-slate-200 rounded-md p-3.5 hover:border-slate-300 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">NPHR</span>
              <span className={`text-[11px] px-2 py-0.5 rounded border ${nphrStatus.colorClass}`}>
                {nphrStatus.label}
              </span>
            </div>
            <div className="mt-2.5">
              <div className="text-lg font-extrabold text-slate-900 tracking-tight">
                {latestRecord ? `${latestRecord.nphr.toLocaleString()} ` : '— '}
                <span className="text-xs font-normal text-slate-500">kcal/kWh</span>
              </div>
              <div className="mt-2 text-xs space-y-1 text-slate-600 border-t border-slate-100 pt-2">
                <div className="flex justify-between">
                  <span>Deterioration:</span>
                  <span className={`font-semibold ${latestRecord?.nphrDeterioration && latestRecord.nphrDeterioration >= thresholds.nphrWWThreshold ? 'text-rose-700' : 'text-slate-800'}`}>
                    {latestRecord?.nphrDeterioration !== null && latestRecord?.nphrDeterioration !== undefined
                      ? `${latestRecord.nphrDeterioration > 0 ? '+' : ''}${latestRecord.nphrDeterioration}%`
                      : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between text-slate-500 text-[11px]">
                  <span>Threshold:</span>
                  <span>≥ {thresholds.nphrWWThreshold}% (Early: {thresholds.nphrEarlyMonitoring}%)</span>
                </div>
              </div>
            </div>
          </div>

          {/* PR */}
          <div className="bg-white border border-slate-200 rounded-md p-3.5 hover:border-slate-300 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">PR</span>
              <span className={`text-[11px] px-2 py-0.5 rounded border ${prStatus.colorClass}`}>
                {prStatus.label}
              </span>
            </div>
            <div className="mt-2.5">
              <div className="text-lg font-extrabold text-slate-900 tracking-tight">
                {latestRecord ? latestRecord.pr.toFixed(4) : '—'}
              </div>
              <div className="mt-2 text-xs space-y-1 text-slate-600 border-t border-slate-100 pt-2">
                <div className="flex justify-between">
                  <span>Deterioration:</span>
                  <span className={`font-semibold ${latestRecord?.prDeterioration && latestRecord.prDeterioration >= thresholds.prWWThreshold ? 'text-rose-700' : 'text-slate-800'}`}>
                    {latestRecord?.prDeterioration !== null && latestRecord?.prDeterioration !== undefined
                      ? `-${latestRecord.prDeterioration}%`
                      : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between text-slate-500 text-[11px]">
                  <span>Threshold:</span>
                  <span>≥ {thresholds.prWWThreshold}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* P3.0 */}
          <div className="bg-white border border-slate-200 rounded-md p-3.5 hover:border-slate-300 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">P3.0</span>
              <span className={`text-[11px] px-2 py-0.5 rounded border ${p3Status.colorClass}`}>
                {p3Status.label}
              </span>
            </div>
            <div className="mt-2.5">
              <div className="text-lg font-extrabold text-slate-900 tracking-tight">
                {latestRecord ? `${latestRecord.P3_0.toFixed(2)} ` : '— '}
                <span className="text-xs font-normal text-slate-500">PSIA</span>
              </div>
              <div className="mt-2 text-xs space-y-1 text-slate-600 border-t border-slate-100 pt-2">
                <div className="flex justify-between">
                  <span>Deterioration:</span>
                  <span className={`font-semibold ${latestRecord?.p3Deterioration && latestRecord.p3Deterioration >= thresholds.p3WWThreshold ? 'text-rose-700' : 'text-slate-800'}`}>
                    {latestRecord?.p3Deterioration !== null && latestRecord?.p3Deterioration !== undefined
                      ? `-${latestRecord.p3Deterioration}%`
                      : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between text-slate-500 text-[11px]">
                  <span>Threshold:</span>
                  <span>≥ {thresholds.p3WWThreshold}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Real Power */}
          <div className="bg-white border border-slate-200 rounded-md p-3.5 hover:border-slate-300 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">Real Power</span>
              <span className={`text-[11px] px-2 py-0.5 rounded border ${powerStatus.colorClass}`}>
                {powerStatus.label}
              </span>
            </div>
            <div className="mt-2.5">
              <div className="text-lg font-extrabold text-slate-900 tracking-tight">
                {latestRecord ? `${latestRecord.realPower.toFixed(2)} ` : '— '}
                <span className="text-xs font-normal text-slate-500">MW</span>
              </div>
              <div className="mt-2 text-xs space-y-1 text-slate-600 border-t border-slate-100 pt-2">
                <div className="flex justify-between">
                  <span>Deterioration:</span>
                  <span className={`font-semibold ${latestRecord?.powerDeterioration && latestRecord.powerDeterioration >= thresholds.powerWWThreshold ? 'text-rose-700' : 'text-slate-800'}`}>
                    {latestRecord?.powerDeterioration !== null && latestRecord?.powerDeterioration !== undefined
                      ? `-${latestRecord.powerDeterioration}%`
                      : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between text-slate-500 text-[11px]">
                  <span>Threshold:</span>
                  <span>≥ {thresholds.powerWWThreshold}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. DIRECTLY BELOW: WATER WASH PERFORMANCE */}
      <section className="bg-white rounded-md border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Water Wash Performance</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Historical results comparing H-1 (before wash) to H+1 (after wash). Click a record to view details.
            </p>
          </div>
          <span className="text-xs font-medium text-slate-500">
            {events.length} {events.length === 1 ? 'wash event' : 'wash events'} recorded
          </span>
        </div>

        {events.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No Water Washing events recorded yet. You can mark Water Wash events when submitting readings in{' '}
            <button
              type="button"
              onClick={() => onNavigate('input')}
              className="text-sky-700 font-semibold underline hover:text-sky-900"
            >
              Input Data
            </button>
            .
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <tr>
                  <th className="py-3 px-4">WW Date</th>
                  <th className="py-3 px-4">NPHR Change</th>
                  <th className="py-3 px-4">Efficiency Change</th>
                  <th className="py-3 px-4">PR Change</th>
                  <th className="py-3 px-4">P3.0 Change</th>
                  <th className="py-3 px-4">Real Power Change</th>
                  <th className="py-3 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {events.map((evt) => (
                  <tr
                    key={evt.id}
                    onClick={() => setSelectedEvent(evt)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">
                      {evt.date}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {formatChange(evt.deltaNPHR, evt.deltaNPHRPercent, 'kcal/kWh', true)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {evt.deltaEfficiency !== null && evt.deltaEfficiency !== undefined
                        ? <span className="text-emerald-700 font-semibold">+{evt.deltaEfficiency.toFixed(2)}%</span>
                        : 'N/A'}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {formatChange(evt.deltaPR, evt.deltaPRPercent, '', false)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {formatChange(evt.deltaP3, evt.deltaP3Percent, 'PSIA', false)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {formatChange(evt.deltaPower, evt.deltaPowerPercent, 'MW', false)}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-400">
                      <ChevronRight className="w-4 h-4 inline-block" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Water Wash Detail Modal */}
      <WaterWashDetailModal
        isOpen={Boolean(selectedEvent)}
        onClose={() => setSelectedEvent(null)}
        event={selectedEvent}
      />
    </div>
  );
};
