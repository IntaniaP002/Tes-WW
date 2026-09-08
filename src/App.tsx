import React, { useEffect, useMemo, useState } from 'react';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { OperatorInputView } from './components/OperatorInputView';
import { PerformanceTrendView } from './components/PerformanceTrendView';
import { DatasetImportModal } from './components/DatasetImportModal';
import { SpreadsheetConfigModal } from './components/SpreadsheetConfigModal';
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
  RECORDS: 'gt_ww_records_v2',
  BASELINE: 'gt_ww_baseline_v2',
  THRESHOLDS: 'gt_ww_thresholds_v2',
  SPREADSHEET: 'gt_ww_spreadsheet_v2',
  ACTIVE_TAB: 'gt_ww_active_tab_v2',
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
        return JSON.parse(saved);
      } catch {
        /* fallback */
      }
    }
    return DEFAULT_THRESHOLDS;
  });

  // Baseline State
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

  // Records State
  const [records, setRecords] = useState<OperationalRecord[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.RECORDS);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        /* fallback */
      }
    }
    // Initialize with Reference Historical Dataset so the application is immediately verifiable
    return REFERENCE_HISTORICAL_DATASET.map((input, idx) =>
      evaluateOperationalRecord(input, `ref-${idx + 1}`, DEFAULT_BASELINE, DEFAULT_THRESHOLDS)
    );
  });

  // Modals State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSpreadsheetModalOpen, setIsSpreadsheetModalOpen] = useState(false);

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

  // Derived Analytics
  const derivedEvents = useMemo(() => {
    return deriveWaterWashEvents(records);
  }, [records]);

  const latestRecord = useMemo(() => {
    if (records.length === 0) return null;
    const sorted = [...records].sort((a, b) => b.timestamp - a.timestamp);
    return sorted[0];
  }, [records]);

  // Record Submission Handler
  const handleRecordSubmitted = async (input: OperationalInput): Promise<{ success: boolean; message: string }> => {
    const newId = `rec-${Date.now()}`;
    const evaluated = evaluateOperationalRecord(input, newId, baseline, thresholds);

    const updated = [...records, evaluated];
    setRecords(updated);

    // Auto-sync to Google Spreadsheet if enabled
    if (spreadsheetConfig.autoSync && spreadsheetConfig.webhookUrl) {
      sendRecordToSpreadsheet(evaluated, spreadsheetConfig).catch((err) => {
        console.warn('Background sync failed:', err);
      });
    }

    return { success: true, message: 'Data successfully recorded and evaluated.' };
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

  // Load Reference Case handler
  const handleLoadReferenceCase = () => {
    const evaluated = REFERENCE_HISTORICAL_DATASET.map((input, idx) =>
      evaluateOperationalRecord(input, `ref-${idx + 1}`, DEFAULT_BASELINE, DEFAULT_THRESHOLDS)
    );
    setBaseline(DEFAULT_BASELINE);
    setThresholds(DEFAULT_THRESHOLDS);
    setRecords(evaluated);
    setActiveTab('dashboard');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans antialiased">
      {/* Top Application Header */}
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        latestRecord={latestRecord ?? undefined}
        onOpenImport={() => setIsImportModalOpen(true)}
        onOpenSpreadsheetConfig={() => setIsSpreadsheetModalOpen(true)}
      />

      {/* Main Content Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {activeTab === 'dashboard' && (
          <DashboardView
            latestRecord={latestRecord ?? undefined}
            baseline={baseline}
            thresholds={thresholds}
            events={derivedEvents}
            recordsCount={records.length}
            onNavigate={setActiveTab}
            onOpenImport={() => setIsImportModalOpen(true)}
          />
        )}

        {activeTab === 'input' && (
          <OperatorInputView
            onRecordSubmitted={handleRecordSubmitted}
            baseline={baseline}
            thresholds={thresholds}
            records={records}
            onNavigate={setActiveTab}
          />
        )}

        {activeTab === 'trend' && (
          <PerformanceTrendView
            records={records}
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

      {/* Dataset Import Modal */}
      <DatasetImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportData={handleImportData}
        onLoadReferenceCase={handleLoadReferenceCase}
      />

      {/* Engineering Footer */}
      <footer className="border-t border-slate-200 bg-white py-3.5 px-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            Gas Turbine Compressor Water Washing Monitoring • Decision Logic: 3-out-of-4 Parameter Rule
          </span>
          <div className="flex items-center gap-3 text-slate-400 text-[11px]">
            <span>Thresholds: NPHR ≥ 3% | PR ≥ 3% | P3.0 ≥ 3% | Real Power ≥ 4%</span>
            <span>•</span>
            <span>Early Monitoring: NPHR 1.7%</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
