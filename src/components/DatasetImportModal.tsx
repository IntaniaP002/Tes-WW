import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Sparkles,
  Upload,
  X,
  Droplets,
  Check,
  RotateCcw,
} from 'lucide-react';
import { OperationalInput } from '../types';

interface DatasetImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportData: (records: OperationalInput[], setAsBaseline?: boolean) => void;
  onLoadReferenceCase: () => void;
}

export const DatasetImportModal: React.FC<DatasetImportModalProps> = ({
  isOpen,
  onClose,
  onImportData,
  onLoadReferenceCase,
}) => {
  const [csvText, setCsvText] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [previewRows, setPreviewRows] = useState<OperationalInput[]>([]);
  const [autoSetBaseline, setAutoSetBaseline] = useState(true);

  if (!isOpen) return null;

  const parseCsvContent = (text: string, fileName?: string | null) => {
    setParseError(null);
    if (!text.trim()) {
      setParseError('Please paste CSV text or select a file first.');
      return;
    }

    try {
      const lines = text
        .trim()
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);

      if (lines.length < 2) {
        setParseError('CSV must have at least a header line and one data row.');
        return;
      }

      // Parse header
      const headerLine = lines[0].toLowerCase();
      const headers = headerLine.split(/,|\t/).map((h) => h.replace(/["']/g, '').trim());

      // Identify column indices
      const findIdx = (patterns: string[]) =>
        headers.findIndex((h) => patterns.some((p) => h.includes(p)));

      const dateIdx = findIdx(['date', 'tanggal', 'timestamp', 'time_stamp']);
      const timeIdx = findIdx(['time', 'jam', 'waktu']);
      const t17Idx = findIdx(['t1.7', 't17', 't1_7', 'tinlet', 'inlet_temp', 'inlet temp']);
      const p17Idx = findIdx(['p1.7', 'p17', 'p1_7', 'pinlet', 'inlet_press', 'inlet press']);
      const p30Idx = findIdx(['p3.0', 'p30', 'p3_0', 'pdisch', 'discharge_press', 'discharge']);
      const powerIdx = findIdx(['power', 'mw', 'real_power', 'real power', 'output', 'load']);
      const nphrIdx = findIdx(['nphr', 'heat_rate', 'heat rate']);
      const wwIdx = findIdx(['ww', 'wash', 'water_wash', 'waterwash', 'event', 'is_ww', 'isww']);

      if (t17Idx === -1 || p17Idx === -1 || p30Idx === -1 || powerIdx === -1 || nphrIdx === -1) {
        setParseError(
          `Could not map all required columns. Missing one of: T1.7, P1.7, P3.0, Real Power, NPHR. Found headers: ${headers.join(
            ', '
          )}`
        );
        return;
      }

      // Check if the filename hints that these are WW dates (e.g. PA_WW1_Evaluasi_dariWW.csv)
      const fileLower = (fileName || uploadedFileName || '').toLowerCase();
      const filenameSuggestsWW = fileLower.includes('ww') || fileLower.includes('wash');

      const parsed: OperationalInput[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;
        const cols = line.split(/,|\t/).map((c) => c.replace(/["']/g, '').trim());

        const tVal = parseFloat(cols[t17Idx]);
        const p1Val = parseFloat(cols[p17Idx]);
        const p3Val = parseFloat(cols[p30Idx]);
        const pwVal = parseFloat(cols[powerIdx]);
        const hrVal = parseFloat(cols[nphrIdx]);

        if (isNaN(tVal) || isNaN(p1Val) || isNaN(p3Val) || isNaN(pwVal) || isNaN(hrVal)) {
          continue; // Skip invalid row
        }

        const dateStr = dateIdx !== -1 && cols[dateIdx] ? cols[dateIdx] : new Date().toISOString().slice(0, 10);
        const timeStr = timeIdx !== -1 && cols[timeIdx] ? cols[timeIdx] : '12:00';

        let isWw = false;
        if (wwIdx !== -1 && cols[wwIdx]) {
          const colVal = cols[wwIdx].toLowerCase().trim();
          isWw = colVal === 'yes' || colVal === 'y' || colVal === 'true' || colVal === '1' || colVal === 'ww' || colVal.includes('wash');
        } else if (filenameSuggestsWW) {
          // If the file explicitly has WW in its name, default them to true
          isWw = true;
        }

        parsed.push({
          date: dateStr,
          time: timeStr,
          T1_7: tVal,
          P1_7: p1Val,
          P3_0: p3Val,
          realPower: pwVal,
          nphr: hrVal,
          isWaterWashEvent: isWw,
          notes: isWw ? 'Water Wash Event' : undefined,
        });
      }

      if (parsed.length === 0) {
        setParseError('No valid data rows could be extracted. Please check the number formats.');
        return;
      }

      setPreviewRows(parsed);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Failed to parse CSV.';
      setParseError(`Parse error: ${errMsg}`);
    }
  };

  const handleParse = () => {
    parseCsvContent(csvText, uploadedFileName);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      setCsvText(text);
      parseCsvContent(text, file.name);
    };
    reader.readAsText(file);
  };

  // Toggle WW tag for a specific row
  const toggleRowWW = (index: number) => {
    setPreviewRows((prev) =>
      prev.map((row, idx) => {
        if (idx !== index) return row;
        const nextState = !row.isWaterWashEvent;
        return {
          ...row,
          isWaterWashEvent: nextState,
          notes: nextState ? 'Water Wash Event' : undefined,
        };
      })
    );
  };

  // Mark all rows as WW or unmark all
  const setAllWW = (status: boolean) => {
    setPreviewRows((prev) =>
      prev.map((row) => ({
        ...row,
        isWaterWashEvent: status,
        notes: status ? 'Water Wash Event' : undefined,
      }))
    );
  };

  const wwCount = previewRows.filter((r) => r.isWaterWashEvent).length;

  const handleConfirmImport = () => {
    if (previewRows.length > 0) {
      onImportData(previewRows, autoSetBaseline);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-lg border border-slate-300 shadow-2xl max-w-3xl w-full p-6 space-y-4 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-sky-700" />
            <h3 className="text-base font-bold text-slate-900">Import Operational Dataset</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="text-xs text-slate-500 space-y-1">
          <p>
            Upload your operational or Water Wash CSV records. You can directly mark any or all rows as Water Wash events below.
          </p>
          <div className="flex items-center gap-2 flex-wrap text-slate-700 font-medium">
            <span>Expected columns:</span>
            <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px] text-slate-800">Date</code>
            <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px] text-slate-800">Time</code>
            <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px] text-slate-800">T1.7</code>
            <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px] text-slate-800">P1.7</code>
            <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px] text-slate-800">P3.0</code>
            <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px] text-slate-800">RealPower</code>
            <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px] text-slate-800">NPHR</code>
            <span className="text-slate-400">Optional:</span>
            <code className="bg-sky-50 px-1.5 py-0.5 rounded text-[11px] text-sky-800 border border-sky-200">WW / IsWaterWash</code>
          </div>
        </div>

        {/* Input Area */}
        <div className="space-y-3 flex-1 overflow-y-auto">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                <span>Select or Paste CSV Data</span>
                {uploadedFileName && (
                  <span className="text-sky-700 font-normal">({uploadedFileName})</span>
                )}
              </label>
              <input
                type="file"
                accept=".csv,.txt,.tsv"
                onChange={handleFileUpload}
                className="text-xs text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100 cursor-pointer"
              />
            </div>
            <textarea
              rows={4}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="Date,Time,T1.7,P1.7,P3.0,RealPower,NPHR&#10;2024-11-05,20:00,79,14.58,243.8,23.4,3447.1&#10;2025-01-16,20:00,79,14.57,241.4,22.8,3438.7"
              className="w-full p-2.5 font-mono text-xs border border-slate-300 rounded bg-slate-50 text-slate-900 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={handleParse}
              className="px-3.5 py-1.5 text-xs font-semibold bg-sky-700 text-white rounded hover:bg-sky-800 shadow-xs transition-colors"
            >
              Parse & Preview Rows
            </button>

            {/* Quick Demo Case Button */}
            <button
              type="button"
              onClick={() => {
                onLoadReferenceCase();
                onClose();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 border border-slate-300 rounded hover:bg-slate-200 transition-colors"
              title="Load demo reference case"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Load Reference Validation Dataset</span>
            </button>
          </div>

          {parseError && (
            <div className="p-3 bg-rose-50 border border-rose-300 rounded text-xs text-rose-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{parseError}</span>
            </div>
          )}

          {/* Preview Table & WW Tag Controls */}
          {previewRows.length > 0 && (
            <div className="space-y-3 border border-slate-200 rounded-md p-3.5 bg-slate-50">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-bold text-xs text-slate-900">
                    Parsed {previewRows.length} operational rows
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-sky-100 text-sky-800">
                    {wwCount} marked as Water Wash
                  </span>
                </div>

                {/* Quick actions for WW tags */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAllWW(true)}
                    className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold bg-sky-700 text-white rounded hover:bg-sky-800 shadow-2xs transition-colors"
                    title="Mark all imported rows as Water Wash events"
                  >
                    <Droplets className="w-3 h-3" />
                    <span>Tag All as WW</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllWW(false)}
                    className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium bg-white text-slate-600 border border-slate-300 rounded hover:bg-slate-100 transition-colors"
                    title="Clear all WW tags"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Clear WW Tags</span>
                  </button>
                </div>
              </div>

              {/* Baseline Option */}
              <div className="flex items-center justify-between text-xs px-1">
                <label className="flex items-center gap-2 cursor-pointer text-slate-700 font-medium">
                  <input
                    type="checkbox"
                    checked={autoSetBaseline}
                    onChange={(e) => setAutoSetBaseline(e.target.checked)}
                    className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 w-4 h-4"
                  />
                  <span>Set 1st record as Initial Baseline (Clean condition)</span>
                </label>
                <span className="text-[11px] text-slate-500">
                  Tip: Click on the <strong>WW Tag</strong> below to toggle any row
                </span>
              </div>

              <div className="overflow-x-auto max-h-56 border border-slate-200 rounded bg-white shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 sticky top-0 font-semibold text-[11px]">
                    <tr>
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3">Time</th>
                      <th className="py-2 px-3">T1.7</th>
                      <th className="py-2 px-3">P1.7</th>
                      <th className="py-2 px-3">P3.0</th>
                      <th className="py-2 px-3">Power</th>
                      <th className="py-2 px-3">NPHR</th>
                      <th className="py-2 px-3 text-center">Water Wash Event?</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[11px]">
                    {previewRows.map((r, idx) => (
                      <tr key={idx} className={r.isWaterWashEvent ? 'bg-sky-50/50' : 'hover:bg-slate-50'}>
                        <td className="py-1.5 px-3 font-medium text-slate-900 whitespace-nowrap">{r.date}</td>
                        <td className="py-1.5 px-3 text-slate-600 whitespace-nowrap">{r.time}</td>
                        <td className="py-1.5 px-3 text-slate-800">{r.T1_7}</td>
                        <td className="py-1.5 px-3 text-slate-800">{r.P1_7}</td>
                        <td className="py-1.5 px-3 text-slate-800">{r.P3_0}</td>
                        <td className="py-1.5 px-3 text-slate-800">{r.realPower}</td>
                        <td className="py-1.5 px-3 text-slate-800">{r.nphr}</td>
                        <td className="py-1.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => toggleRowWW(idx)}
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold transition-all shadow-2xs ${
                              r.isWaterWashEvent
                                ? 'bg-sky-600 text-white hover:bg-sky-700 ring-1 ring-sky-700'
                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-300'
                            }`}
                            title="Click to toggle Water Wash event tag"
                          >
                            {r.isWaterWashEvent ? (
                              <>
                                <Check className="w-3 h-3 stroke-[3]" />
                                <span>WATER WASH</span>
                              </>
                            ) : (
                              <span>— Regular</span>
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
          <span className="text-xs text-slate-500">
            {previewRows.length > 0
              ? `${previewRows.length} rows ready • ${wwCount} Water Wash event(s)`
              : 'Paste or upload CSV to begin'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={previewRows.length === 0}
              onClick={handleConfirmImport}
              className="px-4 py-2 text-xs font-bold text-white bg-sky-700 rounded hover:bg-sky-800 disabled:opacity-50 shadow-xs transition-colors"
            >
              Import {previewRows.length} Records
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
