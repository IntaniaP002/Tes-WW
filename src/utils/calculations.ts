/**
 * Water Washing Optimization & Calculation Engine
 * Strictly follows engineering logic without invented formulas
 */

import {
  BaselineConfig,
  OperationalInput,
  OperationalRecord,
  OverallWaterWashStatus,
  ThresholdConfig,
  WaterWashCycleDeterioration,
  WaterWashEvent,
} from '../types';

/**
 * Standard Pressure Ratio Calculation:
 * PR = P3.0 / P1.7
 * Note: No invented temperature correction is applied to retain raw calculated pressure ratio.
 */
export function calculatePressureRatio(P3_0: number, P1_7: number): number {
  if (!P1_7 || P1_7 <= 0 || !P3_0 || P3_0 <= 0) {
    return 0;
  }
  return Number((P3_0 / P1_7).toFixed(4));
}

/**
 * Net Plant Thermal Efficiency from NPHR:
 * Standard thermodynamic conversion: 1 kWh = 859.845 kcal (commonly rounded to 860 kcal/kWh)
 * Efficiency (%) = (859.845 / NPHR) * 100
 */
export function calculateEfficiencyFromNPHR(nphr: number | null | undefined): number | null {
  if (!nphr || nphr <= 0) return null;
  return Number(((859.845 / nphr) * 100).toFixed(2));
}

/**
 * Deterioration Calculations:
 * The calculation direction must reflect whether higher or lower values represent better performance.
 *
 * For NPHR:
 * Higher NPHR = worse performance.
 * Deterioration % = ((Current - Baseline) / Baseline) * 100%
 *
 * For PR:
 * Lower PR = worse compressor performance.
 * Deterioration % = ((Baseline - Current) / Baseline) * 100%
 *
 * For P3.0:
 * Lower P3.0 = worse compressor performance.
 * Deterioration % = ((Baseline - Current) / Baseline) * 100%
 *
 * For Real Power:
 * Lower Real Power = worse output performance.
 * Deterioration % = ((Baseline - Current) / Baseline) * 100%
 */
export function calculateDeteriorationPercent(
  current: number,
  baseline: number | null | undefined,
  direction: 'higher_is_worse' | 'lower_is_worse'
): number | null {
  if (baseline === null || baseline === undefined || baseline <= 0 || current <= 0) {
    return null;
  }

  if (direction === 'higher_is_worse') {
    // For NPHR: Increase is deterioration
    const det = ((current - baseline) / baseline) * 100;
    return Number(det.toFixed(2));
  } else {
    // For PR, P3.0, Real Power: Decrease is deterioration
    const det = ((baseline - current) / baseline) * 100;
    return Number(det.toFixed(2));
  }
}

/**
 * Evaluates record against thresholds and applies the 3-out-of-4 Water Wash recommendation rule.
 */
export function evaluateOperationalRecord(
  input: OperationalInput,
  id: string,
  baseline: BaselineConfig,
  thresholds: ThresholdConfig
): OperationalRecord {
  const pr = calculatePressureRatio(input.P3_0, input.P1_7);

  // Parse ISO date-time into timestamp
  const dateTimeStr = `${input.date}T${input.time.length === 5 ? input.time + ':00' : input.time}`;
  const parsedDate = new Date(dateTimeStr);
  const timestamp = !isNaN(parsedDate.getTime()) ? parsedDate.getTime() : Date.now();

  // Baseline values
  const hasBaseline = baseline.isConfigured;

  // Calculate deteriorations (positive indicates deterioration)
  const nphrDeterioration = hasBaseline
    ? calculateDeteriorationPercent(input.nphr, baseline.nphr, 'higher_is_worse')
    : null;

  const prDeterioration = hasBaseline
    ? calculateDeteriorationPercent(pr, baseline.PR, 'lower_is_worse')
    : null;

  const p3Deterioration = hasBaseline
    ? calculateDeteriorationPercent(input.P3_0, baseline.P3_0, 'lower_is_worse')
    : null;

  const powerDeterioration = hasBaseline
    ? calculateDeteriorationPercent(input.realPower, baseline.realPower, 'lower_is_worse')
    : null;

  // Evaluate threshold conditions
  const nphrThresholdReached =
    nphrDeterioration !== null ? nphrDeterioration >= thresholds.nphrWWThreshold : null;

  const nphrEarlyMonitoringReached =
    nphrDeterioration !== null
      ? nphrDeterioration >= thresholds.nphrEarlyMonitoring &&
        nphrDeterioration < thresholds.nphrWWThreshold
      : null;

  const prThresholdReached =
    prDeterioration !== null ? prDeterioration >= thresholds.prWWThreshold : null;

  const p3ThresholdReached =
    p3Deterioration !== null ? p3Deterioration >= thresholds.p3WWThreshold : null;

  const powerThresholdReached =
    powerDeterioration !== null ? powerDeterioration >= thresholds.powerWWThreshold : null;

  // Count thresholds met
  const validEvaluations = [
    nphrThresholdReached,
    prThresholdReached,
    p3ThresholdReached,
    powerThresholdReached,
  ].filter((val) => val !== null) as boolean[];

  const evaluatedIndicatorsCount = validEvaluations.length;
  const thresholdsMetCount = validEvaluations.filter(Boolean).length;

  let overallStatus: OverallWaterWashStatus = 'INSUFFICIENT DATA';
  let statusExplanation = '';

  if (evaluatedIndicatorsCount < 3) {
    overallStatus = 'INSUFFICIENT DATA';
    statusExplanation = 'Reference baseline required for deterioration calculation.';
  } else if (thresholdsMetCount >= 3) {
    // 3 or 4 indicators meet threshold
    overallStatus = 'RECOMMEND WATER WASH';
    statusExplanation = `${thresholdsMetCount} of 4 parameters reached the Water Wash threshold.`;
  } else if (thresholdsMetCount >= 1) {
    // 1 or 2 indicators meet threshold
    overallStatus = 'MONITORING';
    statusExplanation = `${thresholdsMetCount} of 4 parameters reached the Water Wash threshold. Continue monitoring.`;
  } else {
    // 0 indicators meet threshold
    if (nphrEarlyMonitoringReached) {
      overallStatus = 'EARLY MONITORING';
      statusExplanation = `0 of 4 parameters reached the Water Wash threshold (NPHR early monitoring active).`;
    } else {
      overallStatus = 'NORMAL';
      statusExplanation = '0 of 4 parameters reached the Water Wash threshold.';
    }
  }

  return {
    ...input,
    id,
    timestamp,
    pr,
    nphrDeterioration,
    prDeterioration,
    p3Deterioration,
    powerDeterioration,
    nphrThresholdReached,
    nphrEarlyMonitoringReached,
    prThresholdReached,
    p3ThresholdReached,
    powerThresholdReached,
    thresholdsMetCount,
    evaluatedIndicatorsCount,
    overallStatus,
    statusExplanation,
  };
}

/**
 * Re-evaluates an entire list of records using current baseline and thresholds
 */
export function reevaluateRecords(
  records: OperationalInput[] | OperationalRecord[],
  baseline: BaselineConfig,
  thresholds: ThresholdConfig
): OperationalRecord[] {
  return records
    .map((record, idx) => {
      const id = 'id' in record ? record.id : `rec_${idx + 1}_${Date.now()}`;
      return evaluateOperationalRecord(record, id, baseline, thresholds);
    })
    .sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Water Wash Performance Recovery Analysis:
 * Compares performance immediately before (H-1) and after (H+1) each Water Wash event.
 * H-1: ~1 day before WW
 * H+1: ~1 day after WW
 */
export function calculateWaterWashRecovery(
  events: WaterWashEvent[],
  records: OperationalRecord[]
): WaterWashEvent[] {
  if (!records.length || !events.length) return events;

  const sortedRecords = [...records].sort((a, b) => a.timestamp - b.timestamp);

  return events.map((event) => {
    const eventTime = new Date(event.date + 'T12:00:00').getTime();
    const oneDayMs = 24 * 60 * 60 * 1000;

    // Find record closest to H-1 (between 12h and 48h before WW)
    const preRecords = sortedRecords.filter(
      (r) => r.timestamp < eventTime && eventTime - r.timestamp <= 2.5 * oneDayMs
    );
    const preRecord = preRecords.length > 0 ? preRecords[preRecords.length - 1] : undefined;

    // Find record closest to H+1 (between 12h and 48h after WW)
    const postRecords = sortedRecords.filter(
      (r) => r.timestamp > eventTime && r.timestamp - eventTime <= 2.5 * oneDayMs
    );
    const postRecord = postRecords.length > 0 ? postRecords[0] : undefined;

    if (!preRecord || !postRecord) {
      return {
        ...event,
        preRecord,
        postRecord,
        deltaNPHR: null,
        deltaNPHRPercent: null,
        deltaEfficiency: null,
        deltaP3: null,
        deltaP3Percent: null,
        deltaPR: null,
        deltaPRPercent: null,
        deltaPower: null,
        deltaPowerPercent: null,
      };
    }

    // Delta = Post - Pre
    // For NPHR: negative delta means lower heat rate = recovery
    const deltaNPHR = Number((postRecord.nphr - preRecord.nphr).toFixed(2));
    const deltaNPHRPercent = Number(
      (((postRecord.nphr - preRecord.nphr) / preRecord.nphr) * 100).toFixed(2)
    );

    const preEff = calculateEfficiencyFromNPHR(preRecord.nphr);
    const postEff = calculateEfficiencyFromNPHR(postRecord.nphr);
    const deltaEfficiency =
      preEff !== null && postEff !== null ? Number((postEff - preEff).toFixed(2)) : null;

    // For P3.0, PR, Power: positive delta means increase = recovery
    const deltaP3 = Number((postRecord.P3_0 - preRecord.P3_0).toFixed(2));
    const deltaP3Percent = Number(
      (((postRecord.P3_0 - preRecord.P3_0) / preRecord.P3_0) * 100).toFixed(2)
    );

    const deltaPR = Number((postRecord.pr - preRecord.pr).toFixed(4));
    const deltaPRPercent = Number((((postRecord.pr - preRecord.pr) / preRecord.pr) * 100).toFixed(2));

    const deltaPower = Number((postRecord.realPower - preRecord.realPower).toFixed(2));
    const deltaPowerPercent = Number(
      (((postRecord.realPower - preRecord.realPower) / preRecord.realPower) * 100).toFixed(2)
    );

    return {
      ...event,
      preRecordId: preRecord.id,
      postRecordId: postRecord.id,
      preRecord,
      postRecord,
      deltaNPHR,
      deltaNPHRPercent,
      deltaEfficiency,
      deltaP3,
      deltaP3Percent,
      deltaPR,
      deltaPRPercent,
      deltaPower,
      deltaPowerPercent,
    };
  });
}

/**
 * Deterioration Between Water Wash Cycles:
 * Evaluates how performance deteriorated from the period immediately after one WW event (H+1)
 * to the period immediately before the next WW event (H-1).
 * H+1 after previous WW -> H-1 before next WW.
 */
export function calculateCycleDeterioration(
  events: WaterWashEvent[]
): WaterWashCycleDeterioration[] {
  if (events.length < 2) return [];

  // Sort events chronologically
  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const cycles: WaterWashCycleDeterioration[] = [];

  for (let i = 0; i < sortedEvents.length - 1; i++) {
    const prevEvt = sortedEvents[i];
    const nextEvt = sortedEvents[i + 1];

    const prevDate = new Date(prevEvt.date).getTime();
    const nextDate = new Date(nextEvt.date).getTime();
    const intervalDays = Math.round((nextDate - prevDate) / (24 * 60 * 60 * 1000));

    // Clean state: post-WW of prev event (H+1)
    const startRecord = prevEvt.postRecord;
    // Fouled state: pre-WW of next event (H-1)
    const endRecord = nextEvt.preRecord;

    if (!startRecord || !endRecord) {
      cycles.push({
        id: `cycle_${i + 1}`,
        cycleNumber: i + 1,
        prevEventNumber: prevEvt.eventNumber,
        nextEventNumber: nextEvt.eventNumber,
        prevEventDate: prevEvt.date,
        nextEventDate: nextEvt.date,
        intervalDays,
        startRecord,
        endRecord,
        nphrDeteriorationPercent: null,
        efficiencyDeteriorationPercent: null,
        prDeteriorationPercent: null,
        p3DeteriorationPercent: null,
        powerDeteriorationPercent: null,
      });
      continue;
    }

    // NPHR deterioration (% increase):
    const nphrDet = Number(
      (((endRecord.nphr - startRecord.nphr) / startRecord.nphr) * 100).toFixed(2)
    );

    // Efficiency deterioration (% decrease):
    const startEff = calculateEfficiencyFromNPHR(startRecord.nphr);
    const endEff = calculateEfficiencyFromNPHR(endRecord.nphr);
    const effDet =
      startEff && endEff ? Number((((startEff - endEff) / startEff) * 100).toFixed(2)) : null;

    // PR deterioration (% decrease):
    const prDet = Number((((startRecord.pr - endRecord.pr) / startRecord.pr) * 100).toFixed(2));

    // P3.0 deterioration (% decrease):
    const p3Det = Number((((startRecord.P3_0 - endRecord.P3_0) / startRecord.P3_0) * 100).toFixed(2));

    // Real Power deterioration (% decrease):
    const powerDet = Number(
      (((startRecord.realPower - endRecord.realPower) / startRecord.realPower) * 100).toFixed(2)
    );

    cycles.push({
      id: `cycle_${i + 1}`,
      cycleNumber: i + 1,
      prevEventNumber: prevEvt.eventNumber,
      nextEventNumber: nextEvt.eventNumber,
      prevEventDate: prevEvt.date,
      nextEventDate: nextEvt.date,
      intervalDays,
      startRecord,
      endRecord,
      nphrDeteriorationPercent: nphrDet,
      efficiencyDeteriorationPercent: effDet,
      prDeteriorationPercent: prDet,
      p3DeteriorationPercent: p3Det,
      powerDeteriorationPercent: powerDet,
    });
  }

  return cycles;
}

/**
 * Derives WaterWashEvent list directly from operational records
 * and computes H-1 vs H+1 recovery metrics.
 */
export function deriveWaterWashEvents(records: OperationalRecord[]): WaterWashEvent[] {
  const wwRecords = records
    .filter((r) => r.isWaterWashEvent)
    .sort((a, b) => a.timestamp - b.timestamp);

  const initialEvents: WaterWashEvent[] = wwRecords.map((r, idx) => ({
    id: `ww_evt_${r.id}`,
    eventNumber: r.waterWashEventNumber || idx + 1,
    date: r.date,
    notes: r.notes || `Water Washing Event #${r.waterWashEventNumber || idx + 1}`,
  }));

  return calculateWaterWashRecovery(initialEvents, records);
}

/**
 * Derives cycle deterioration between consecutive Water Wash events (H+1 -> H-1)
 */
export function deriveCycleDeteriorations(
  events: WaterWashEvent[]
): WaterWashCycleDeterioration[] {
  return calculateCycleDeterioration(events);
}
