import React, { useEffect, useMemo, useState } from 'react';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { OperatorInputView } from './components/OperatorInputView';
import { PerformanceTrendView } from './components/PerformanceTrendView';
import { DatasetImportModal } from './components/DatasetImportModal';
import { SpreadsheetConfigModal } from './components/SpreadsheetConfigModal';
import { BaselineConfigModal } from './components/BaselineConfigModal';
import {
  ActiveNavTab,
  BaselineConfig,
  OperationalInput,
  OperationalRecord,
  SpreadsheetIntegrationConfig,
  ThresholdConfig,
} from './types';
import {
  DEFAULT_BASELINE,
  DEFAULT_SPREADSHEET_CONFIG,
  DEFAULT_THRESHOLDS,
} from './data/initialData';
import { REFERENCE_HISTORICAL_DATASET } from './data/referenceDataset';
import {
  deriveWaterWashEvents,
  evaluateOperationalRecord,
} from './utils/calculations';
import { sendRecordToSpreadsheet } from './utils/spreadsheetSync';

const STORAGE_KEYS = {
  RECORDS: 'gt_ww_records_v3',
  BASELINE: 'gt_ww_baseline_v3',
  THRESHOLDS: 'gt_ww_thresholds_v3',
  SPREADSHEET: 'gt_ww_spreadsheet_v3',
  ACTIVE_TAB: 'gt_ww_active_tab_v3',
};

export default function App() {
  // Navigation State - strictly 3 pages: 'dashboard' | 'input' | 'trend'
  const [activeTab, setActiveTab] = useState<ActiveNavTab>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB);
    if (saved === 'dashboard' || saved === 'input' || saved === 'trend') {
      return saved;
    }
    return 'dashboard';
  });

  // Thresholds State
  const [thresholds, setThresholds] = useState<ThresholdConfig>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.THRESHOLDS);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_THRESHOLDS,
          ...parsed,
          prWWThreshold: parsed.prWWThreshold === 3.0 ? 2.5 : (parsed.prWWThreshold ?? 2.5),
          p3WWThreshold: parsed.p3WWThreshold === 3.0 ? 2.5 : (parsed.p3WWThreshold ?? 2.5),
        };
      } catch {
        /* fallback */
      }
    }
    return DEFAULT_THRESHOLDS;
  });

  // Baseline State - starts unconfigured if no saved baseline
  const [baseline, setBaseline] = useState<BaselineConfig>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.BASELINE);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        /* fallback */
      }
    }
    return DEFAULT_BASELINE;
  });

  // Spreadsheet Integration State
  const [spreadsheetConfig, setSpreadsheetConfig] = useState<SpreadsheetIntegrationConfig>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SPREADSHEET);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        /* fallback */
      }
    }
    return DEFAULT_SPREADSHEET_CONFIG;
  });

  // Records State - starts completely EMPTY by default for real operator data
  const [records, setRecords] = useState<OperationalRecord[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.RECORDS);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        /* fallback */
      }
    }
    return [];
  });

  // Modals State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSpreadsheetModalOpen, setIsSpreadsheetModalOpen] = useState(false);
  const [isBaselineModalOpen, setIsBaselineModalOpen] = useState(false);

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, activeTab);
  }, [activeTab]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.THRESHOLDS, JSON.stringify(thresholds));
  }, [thresholds]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.BASELINE, JSON.stringify(baseline));
  }, [baseline]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SPREADSHEET, JSON.stringify(spreadsheetConfig));
  }, [spreadsheetConfig]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(records));
  }, [records]);

  // Derived Analytics & Dynamic Evaluation against current thresholds
  const evaluatedRecords = useMemo(() => {
    if (records.length === 0) return [];
    if (!baseline.isConfigured) return records;
    return records.map((r) => evaluateOperationalRecord(r, r.id, baseline, thresholds));
  }, [records, baseline, thresholds]);

  const derivedEvents = useMemo(() => {
    return deriveWaterWashEvents(evaluatedRecords);
  }, [evaluatedRecords]);

  const latestRecord = useMemo(() => {
    if (evaluatedRecords.length === 0) return null;
    const sorted = [...evaluatedRecords].sort((a, b) => b.timestamp - a.timestamp);
    return sorted[0];
  }, [evaluatedRecords]);

  // Record Submission Handler
  const handleRecordSubmitted = async (
    input: OperationalInput,
    setAsBaseline?: boolean
  ): Promise<{ success: boolean; message: string }> => {
    let activeBaseline = baseline;

    // Automatically configure or update baseline if requested or if none exists
    if (setAsBaseline || !baseline.isConfigured) {
      const pr = input.P1_7 > 0 ? Number((input.P3_0 / input.P1_7).toFixed(4)) : null;
      activeBaseline = {
        isConfigured: true,
        T1_7: input.T1_7,
        P1_7: input.P1_7,
        P3_0: input.P3_0,
        PR: pr,
        realPower: input.realPower,
        nphr: input.nphr,
        referenceDescription: `Operational baseline established on ${input.date}`,
        setAt: new Date().toISOString(),
      };
      setBaseline(activeBaseline);
    }

    const newId = `rec-${Date.now()}`;
    const evaluated = evaluateOperationalRecord(input, newId, activeBaseline, thresholds);

    const updated = [...records, evaluated];
    setRecords(updated);

    // Auto-sync to Google Spreadsheet if enabled
    if (spreadsheetConfig.autoSync && spreadsheetConfig.webhookUrl) {
      sendRecordToSpreadsheet(evaluated, spreadsheetConfig).catch((err) => {
        console.warn('Background sync failed:', err);
      });
    }

    return { success: true, message: 'Data successfully recorded and saved.' };
  };

  // Clear all data handler
  const handleClearData = () => {
    if (window.confirm('Are you sure you want to clear all data and start completely fresh?')) {
      setRecords([]);
      setBaseline(DEFAULT_BASELINE);
      localStorage.removeItem(STORAGE_KEYS.RECORDS);
      localStorage.removeItem(STORAGE_KEYS.BASELINE);
    }
  };

  // Load sample demo data handler
  const handleLoadSampleData = () => {
    const sampleBaseline: BaselineConfig = {
      isConfigured: true,
      T1_7: 68.0,
      P1_7: 14.65,
      P3_0: 245.0,
      PR: 16.7235,
      realPower: 156.0,
      nphr: 2420.0,
      referenceDescription: 'Clean condition baseline reference',
      setAt: '2024-01-01T08:00:00Z',
    };
    setBaseline(sampleBaseline);
    const evaluated = REFERENCE_HISTORICAL_DATASET.map((input, idx) =>
      evaluateOperationalRecord(input, `ref-${idx + 1}`, sampleBaseline, thresholds)
    );
    setRecords(evaluated);
  };

  // Import dataset handler
  const handleImportData = (newInputs: OperationalInput[], setAsBaseline?: boolean) => {
    let activeBaseline = baseline;

    if (setAsBaseline && newInputs.length > 0) {
      const first = newInputs[0];
      const p1 = first.P1_7;
      const p3 = first.P3_0;
      const pr = p1 > 0 ? Number((p3 / p1).toFixed(4)) : null;

      activeBaseline = {
        isConfigured: true,
        T1_7: first.T1_7,
        P1_7: p1,
        P3_0: p3,
        PR: pr,
        realPower: first.realPower,
        nphr: first.nphr,
        referenceDescription: `Imported baseline (${first.date} ${first.time})`,
        setAt: new Date().toISOString(),
      };
      setBaseline(activeBaseline);
    }

    const evaluated = newInputs.map((input, idx) =>
      evaluateOperationalRecord(input, `imp-${Date.now()}-${idx}`, activeBaseline, thresholds)
    );

    setRecords(evaluated);
    setActiveTab('dashboard');
  };

  // Toggle Water Wash status of an existing record
  const handleToggleWaterWashRecord = (recordId: string) => {
    setRecords((prev) =>
      prev.map((r) => {
        if (r.id !== recordId) return r;
        const nextWW = !r.isWaterWashEvent;
        return {
          ...r,
          isWaterWashEvent: nextWW,
          notes: nextWW ? 'Water Wash Event' : undefined,
        };
      })
    );
  };

  // Delete a specific record
  const handleDeleteRecord = (recordId: string) => {
    if (window.confirm('Are you sure you want to delete this operational reading?')) {
      setRecords((prev) => prev.filter((r) => r.id !== recordId));
    }
  };

  // Set an existing operational record as the active baseline
  const handleSetBaselineRecord = (record: OperationalRecord) => {
    const p1 = record.P1_7;
    const p3 = record.P3_0;
    const pr = p1 > 0 ? Number((p3 / p1).toFixed(4)) : null;

    const newBaseline: BaselineConfig = {
      isConfigured: true,
      sourceRecordId: record.id,
      date: record.date,
      time: record.time,
      T1_7: record.T1_7,
      P1_7: p1,
      P3_0: p3,
      PR: pr,
      realPower: record.realPower,
      nphr: record.nphr,
      referenceDescription: `Operational baseline established from record on ${record.date} ${record.time}`,
      setAt: new Date().toISOString(),
    };

    setBaseline(newBaseline);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans antialiased">
      {/* Top Application Header */}
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        latestRecord={latestRecord ?? undefined}
        recordsCount={evaluatedRecords.length}
        onClearData={handleClearData}
        onLoadSampleData={handleLoadSampleData}
        onOpenImport={() => setIsImportModalOpen(true)}
        onOpenSpreadsheetConfig={() => setIsSpreadsheetModalOpen(true)}
        onOpenBaselineConfig={() => setIsBaselineModalOpen(true)}
      />

      {/* Main Content Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {activeTab === 'dashboard' && (
          <DashboardView
            latestRecord={latestRecord ?? undefined}
            baseline={baseline}
            thresholds={thresholds}
            events={derivedEvents}
            recordsCount={evaluatedRecords.length}
            onNavigate={setActiveTab}
            onOpenImport={() => setIsImportModalOpen(true)}
            onOpenBaselineConfig={() => setIsBaselineModalOpen(true)}
          />
        )}

        {activeTab === 'input' && (
          <OperatorInputView
            onRecordSubmitted={handleRecordSubmitted}
            baseline={baseline}
            thresholds={thresholds}
            records={evaluatedRecords}
            onNavigate={setActiveTab}
            onToggleWaterWash={handleToggleWaterWashRecord}
            onDeleteRecord={handleDeleteRecord}
            onSetBaselineRecord={handleSetBaselineRecord}
            onOpenBaselineConfig={() => setIsBaselineModalOpen(true)}
          />
        )}

        {activeTab === 'trend' && (
          <PerformanceTrendView
            records={evaluatedRecords}
            thresholds={thresholds}
          />
        )}
      </main>

      {/* Google Spreadsheet Integration Settings Modal */}
      <SpreadsheetConfigModal
        isOpen={isSpreadsheetModalOpen}
        onClose={() => setIsSpreadsheetModalOpen(false)}
        config={spreadsheetConfig}
        onSaveConfig={setSpreadsheetConfig}
      />

      {/* Baseline Reference Calibration Modal */}
      <BaselineConfigModal
        isOpen={isBaselineModalOpen}
        onClose={() => setIsBaselineModalOpen(false)}
        baseline={baseline}
        currentBaseline={baseline}
        records={evaluatedRecords}
        onUpdateBaseline={setBaseline}
        onSaveBaseline={setBaseline}
      />

      {/* Dataset Import Modal */}
      <DatasetImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportData={handleImportData}
        onLoadReferenceCase={handleLoadSampleData}
      />

      {/* Engineering Footer */}
      <footer className="border-t border-slate-200 bg-white py-3.5 px-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            Water Washing Monitoring • Decision Logic: 3-out-of-4 Parameter Rule
          </span>
          <div className="flex items-center gap-3 text-slate-400 text-[11px]">
            <span>Thresholds: NPHR ≥ 3% | PR ≥ 2.5% | P3.0 ≥ 2.5% | Real Power ≥ 4%</span>
            <span>•</span>
            <span>Early Monitoring: NPHR 1.7%</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
