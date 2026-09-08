import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  FileText,
  Info,
  Sparkles,
  Upload,
  X,
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
  const [parseError, setParseError] = useState<string | null>(null);
  const [previewRows, setPreviewRows] = useState<OperationalInput[]>([]);
  const [autoSetBaseline, setAutoSetBaseline] = useState(true);

  if (!isOpen) return null;

  const handleParse = () => {
    setParseError(null);
    if (!csvText.trim()) {
      setParseError('Please paste CSV text or select a file first.');
      return;
    }

    try {
      const lines = csvText
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
      const wwIdx = findIdx(['ww', 'wash', 'water_wash', 'event']);

      if (t17Idx === -1 || p17Idx === -1 || p30Idx === -1 || powerIdx === -1 || nphrIdx === -1) {
        setParseError(
          `Could not map all required columns. Missing one of: T1.7, P1.7, P3.0, Real Power, NPHR. Found headers: ${headers.join(
            ', '
          )}`
        );
        return;
      }

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
        const isWw = wwIdx !== -1 && Boolean(cols[wwIdx] && cols[wwIdx].toLowerCase() !== 'false' && cols[wwIdx] !== '0');

        parsed.push({
          date: dateStr,
          time: timeStr,
          T1_7: tVal,
          P1_7: p1Val,
          P3_0: p3Val,
          realPower: pwVal,
          nphr: hrVal,
          isWaterWashEvent: isWw,
          notes: isWw ? 'Historical Water Wash Event' : undefined,
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      setCsvText(text);
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = () => {
    if (previewRows.length > 0) {
      onImportData(previewRows, autoSetBaseline);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-lg border border-slate-300 shadow-xl max-w-3xl w-full p-6 space-y-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-sky-700" />
            <h3 className="text-base font-bold text-slate-900">Import Operational Dataset</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="text-xs text-slate-500 space-y-1">
          <p>
            Paste CSV data or select a CSV/text file containing your actual historical operating
            records. The system will automatically map the fields, calculate Pressure Ratio (PR =
            P3.0 / P1.7), evaluate deteriorations, and analyze Water Wash events.
          </p>
          <p className="font-semibold text-slate-700">
            Expected fields: Date, Time, T1.7 (°F), P1.7 (PSIA), P3.0 (PSIA), Real Power (MW), NPHR (kcal/kWh)
          </p>
        </div>

        {/* Input Area */}
        <div className="space-y-3 flex-1 overflow-y-auto">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700">Paste CSV / TSV Data</label>
              <input
                type="file"
                accept=".csv,.txt,.tsv"
                onChange={handleFileUpload}
                className="text-xs text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100"
              />
            </div>
            <textarea
              rows={6}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="Date,Time,T1.7,P1.7,P3.0,RealPower,NPHR&#10;2025-01-10,08:00,72.4,14.65,242.1,155.2,2430.5&#10;2025-01-11,08:00,73.1,14.64,241.5,154.8,2442.0"
              className="w-full p-2.5 font-mono text-xs border border-slate-300 rounded bg-slate-50 text-slate-900 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={handleParse}
              className="px-3.5 py-1.5 text-xs font-semibold bg-sky-700 text-white rounded hover:bg-sky-800 shadow-xs"
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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-300 rounded hover:bg-slate-200"
              title="Load representative engineering test dataset to preview calculations and recovery charts"
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

          {/* Preview Table */}
          {previewRows.length > 0 && (
            <div className="space-y-2 border border-slate-200 rounded p-3 bg-slate-50">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-emerald-800 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Successfully parsed {previewRows.length} operational rows
                </span>
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-700">
                  <input
                    type="checkbox"
                    checked={autoSetBaseline}
                    onChange={(e) => setAutoSetBaseline(e.target.checked)}
                    className="rounded text-sky-600"
                  />
                  <span>Set 1st record as Initial Baseline</span>
                </label>
              </div>

              <div className="overflow-x-auto max-h-40 border border-slate-200 rounded bg-white">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-100 text-slate-600 border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="py-1.5 px-2">Date</th>
                      <th className="py-1.5 px-2">Time</th>
                      <th className="py-1.5 px-2">T1.7</th>
                      <th className="py-1.5 px-2">P1.7</th>
                      <th className="py-1.5 px-2">P3.0</th>
                      <th className="py-1.5 px-2">Power</th>
                      <th className="py-1.5 px-2">NPHR</th>
                      <th className="py-1.5 px-2">WW Tag</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewRows.slice(0, 5).map((r, idx) => (
                      <tr key={idx}>
                        <td className="py-1 px-2">{r.date}</td>
                        <td className="py-1 px-2">{r.time}</td>
                        <td className="py-1 px-2">{r.T1_7}</td>
                        <td className="py-1 px-2">{r.P1_7}</td>
                        <td className="py-1 px-2">{r.P3_0}</td>
                        <td className="py-1 px-2">{r.realPower}</td>
                        <td className="py-1 px-2">{r.nphr}</td>
                        <td className="py-1 px-2">{r.isWaterWashEvent ? 'YES' : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {previewRows.length > 5 && (
                <div className="text-[10px] text-slate-500 text-right">
                  + {previewRows.length - 5} more rows...
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={previewRows.length === 0}
            onClick={handleConfirmImport}
            className="px-4 py-2 text-xs font-bold text-white bg-sky-700 rounded hover:bg-sky-800 disabled:opacity-50 shadow-xs"
          >
            Import {previewRows.length} Records
          </button>
        </div>
      </div>
    </div>
  );
};
