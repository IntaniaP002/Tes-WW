import {
  AuditLogEntry,
  BaselineConfig,
  SpreadsheetIntegrationConfig,
  ThresholdConfig,
} from '../types';

export const DEFAULT_THRESHOLDS: ThresholdConfig = {
  nphrWWThreshold: 3.0, // Initial Historical-Based Threshold
  prWWThreshold: 3.0,
  p3WWThreshold: 3.0,
  powerWWThreshold: 4.0,
  nphrEarlyMonitoring: 1.7, // Early Monitoring boundary
};

export const DEFAULT_BASELINE: BaselineConfig = {
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

export const DEFAULT_SPREADSHEET_CONFIG: SpreadsheetIntegrationConfig = {
  webhookUrl: '',
  spreadsheetId: '',
  sheetName: 'GT_WW_Operational_Data',
  autoSync: false,
  lastSyncStatus: 'idle',
  lastSyncTime: null,
  lastSyncMessage: 'Google Spreadsheet integration ready for endpoint URL configuration.',
};

export const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: 'log_init',
    timestamp: new Date().toISOString(),
    parameter: 'System Initialized',
    oldValue: '-',
    newValue: 'Initial Historical-Based Thresholds loaded (3% NPHR, 3% PR, 3% P3.0, 4% Power, 1.7% Early Monitoring)',
    changedBy: 'System Administrator',
    reason: 'Initial setup of Water Washing monitoring project requirements',
  },
];
