/**
 * Gas Turbine Compressor Water Washing Monitoring & Recommendation System
 * Core Data Models and Types
 */

export interface OperationalInput {
  date: string; // YYYY-MM-DD
  time: string; // HH:MM or HH:MM:SS
  T1_7: number; // Compressor Inlet Temperature (°F)
  P1_7: number; // Compressor Inlet Pressure (PSIA)
  P3_0: number; // Compressor Discharge Pressure (PSIA)
  realPower: number; // Gas Turbine Real Power (MW)
  nphr: number; // Net Plant Heat Rate (kcal/kWh)
  notes?: string;
  isWaterWashEvent?: boolean; // Tagged if Water Wash occurred on this date
  waterWashEventNumber?: number;
}

export type OverallWaterWashStatus =
  | 'NORMAL'
  | 'EARLY MONITORING'
  | 'MONITORING'
  | 'RECOMMEND WATER WASH'
  | 'INSUFFICIENT DATA';

export interface ParameterEvaluation {
  currentValue: number;
  baselineValue: number | null;
  deteriorationPercent: number | null; // Positive value = performance deteriorated
  threshold: number;
  isThresholdReached: boolean | null;
  unit: string;
  name: string;
  role: 'compressor' | 'plant_performance';
}

export interface OperationalRecord extends OperationalInput {
  id: string;
  timestamp: number; // Epoch ms for chronological sorting
  pr: number; // Pressure Ratio = P3_0 / P1_7

  // Deteriorations (% - positive means worse performance)
  nphrDeterioration: number | null;
  prDeterioration: number | null;
  p3Deterioration: number | null;
  powerDeterioration: number | null;

  // Threshold evaluations
  nphrThresholdReached: boolean | null;
  nphrEarlyMonitoringReached: boolean | null;
  prThresholdReached: boolean | null;
  p3ThresholdReached: boolean | null;
  powerThresholdReached: boolean | null;

  // Water Washing 3-out-of-4 Rule metrics
  thresholdsMetCount: number; // 0 to 4
  evaluatedIndicatorsCount: number; // How many indicators had valid baseline
  overallStatus: OverallWaterWashStatus;
  statusExplanation: string;

  // Synced to external spreadsheet
  syncedToSpreadsheet?: boolean;
  syncTimestamp?: string;
}

export interface ThresholdConfig {
  nphrWWThreshold: number; // Default: 3.0 (%)
  prWWThreshold: number; // Default: 3.0 (%)
  p3WWThreshold: number; // Default: 3.0 (%)
  powerWWThreshold: number; // Default: 4.0 (%)
  nphrEarlyMonitoring: number; // Default: 1.7 (%)
}

export interface BaselineConfig {
  isConfigured: boolean;
  T1_7: number | null; // °F
  P1_7: number | null; // PSIA
  P3_0: number | null; // PSIA
  PR: number | null; // P3.0 / P1.7
  realPower: number | null; // MW
  nphr: number | null; // kcal/kWh
  referenceDescription?: string;
  setAt?: string;
}

export interface WaterWashEvent {
  id: string;
  eventNumber: number;
  date: string; // YYYY-MM-DD
  preRecordId?: string; // H-1
  postRecordId?: string; // H+1
  preRecord?: OperationalRecord;
  postRecord?: OperationalRecord;
  deltaNPHR?: number | null; // Post - Pre (negative is improvement)
  deltaNPHRPercent?: number | null;
  deltaEfficiency?: number | null; // Post - Pre (positive is improvement)
  deltaP3?: number | null; // Post - Pre (positive is improvement)
  deltaP3Percent?: number | null;
  deltaPR?: number | null; // Post - Pre (positive is improvement)
  deltaPRPercent?: number | null;
  deltaPower?: number | null; // Post - Pre (positive is improvement)
  deltaPowerPercent?: number | null;
  notes?: string;
}

export interface WaterWashCycleDeterioration {
  id: string;
  cycleNumber: number;
  prevEventNumber: number;
  nextEventNumber: number;
  prevEventDate: string;
  nextEventDate: string;
  intervalDays: number;
  startRecord?: OperationalRecord; // H+1 after previous WW
  endRecord?: OperationalRecord; // H-1 before next WW
  nphrDeteriorationPercent?: number | null;
  efficiencyDeteriorationPercent?: number | null;
  prDeteriorationPercent?: number | null;
  p3DeteriorationPercent?: number | null;
  powerDeteriorationPercent?: number | null;
}

export interface SpreadsheetIntegrationConfig {
  webhookUrl: string;
  spreadsheetId: string;
  sheetName: string;
  autoSync: boolean;
  lastSyncStatus: 'idle' | 'connected' | 'syncing' | 'error';
  lastSyncTime: string | null;
  lastSyncMessage: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  parameter: string;
  oldValue: string;
  newValue: string;
  changedBy: string;
  reason?: string;
}

export type ActiveNavTab = 'dashboard' | 'input' | 'trend';
