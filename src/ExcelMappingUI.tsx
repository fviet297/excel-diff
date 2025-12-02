import React, { useEffect, useMemo, useState } from 'react';
import { Upload, Plus, Trash2, Download, AlertCircle, CheckCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { ExcelMappingEngine, type FileKey, type MappingItem } from './ExcelMappingEngine';

interface LoadedFile {
  key: FileKey;
  file?: File | null;
  wb?: XLSX.WorkBook;
  sheetNames: string[];
}

const LS_KEY_MAPPINGS = 'excelMappingUI.mappings.v1';

export default function ExcelMappingUI() {
  const [files, setFiles] = useState<Record<FileKey, LoadedFile>>({
    source1: { key: 'source1', sheetNames: [] },
    source2: { key: 'source2', sheetNames: [] },
    source3: { key: 'source3', sheetNames: [] },
    destination: { key: 'destination', sheetNames: [] },
  });

  const [mappings, setMappings] = useState<MappingItem[]>(() => {
    try {
      const saved = localStorage.getItem(LS_KEY_MAPPINGS);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        sourceKey: 'source1',
        from: { sheet: '', range: 'A1:A10' },
        to: { sheet: '', range: 'A1' },
      },
    ];
  });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    try { localStorage.setItem(LS_KEY_MAPPINGS, JSON.stringify(mappings)); } catch {}
  }, [mappings]);

  const canRun = useMemo(() => !!files.destination.wb && (files.source1.wb || files.source2.wb || files.source3.wb), [files]);

  const readFileToWorkbook = (file: File): Promise<XLSX.WorkBook> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const wb = XLSX.read(data, { type: 'array' });
          resolve(wb);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  const onChooseFile = async (key: FileKey, f: File | null) => {
    setError(null);
    setSuccess(null);
    if (!f) {
      setFiles(prev => ({ ...prev, [key]: { key, file: null, wb: undefined, sheetNames: [] } }));
      return;
    }
    try {
      const wb = await readFileToWorkbook(f);
      setFiles(prev => ({ ...prev, [key]: { key, file: f, wb, sheetNames: wb.SheetNames || [] } }));
    } catch (e: any) {
      setError(`Không đọc được file ${f.name}: ${e?.message || e}`);
    }
  };

  const updateMappingField = (idx: number, field: keyof MappingItem | 'from.sheet' | 'from.range' | 'to.sheet' | 'to.range', value: any) => {
    setMappings(prev => prev.map((m, i) => {
      if (i !== idx) return m;
      if (field === 'from.sheet') return { ...m, from: { ...m.from, sheet: value } };
      if (field === 'from.range') return { ...m, from: { ...m.from, range: value } };
      if (field === 'to.sheet') return { ...m, to: { ...m.to, sheet: value } };
      if (field === 'to.range') return { ...m, to: { ...m.to, range: value } };
      return { ...m, [field]: value } as MappingItem;
    }));
  };

  const addRow = () => {
    setMappings(prev => ([...prev, { sourceKey: 'source1', from: { sheet: '', range: 'A1:A10' }, to: { sheet: '', range: 'A1' } }]));
  };

  const removeRow = (idx: number) => {
    setMappings(prev => prev.filter((_, i) => i !== idx));
  };

  const onRun = async () => {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const engine = new ExcelMappingEngine();
      for (const k of Object.keys(files) as FileKey[]) {
        const item = files[k];
        if (item.wb) engine.setWorkbook(k, item.wb);
      }
      engine.setMappings(mappings);
      const v = engine.validate();
      if (!v.ok) {
        setError(v.errors.join('\n'));
        return;
      }
      const out = engine.apply();
      XLSX.writeFile(out, 'mapped_output.xlsx');
      setSuccess('Đã tạo file mapped_output.xlsx');
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const renderFilePicker = (label: string, key: FileKey) => (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-2">{label}</label>
      <input type="file" accept=".xlsx,.xls" className="hidden" id={`file-${key}`} onChange={(e) => onChooseFile(key, e.target.files?.[0] || null)} />
      <label htmlFor={`file-${key}`} className="flex items-center justify-between w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-indigo-500 hover:bg-indigo-50 transition-all">
        <span className="flex items-center text-gray-700">
          <Upload className="w-5 h-5 mr-2" />
          {files[key].file ? files[key].file?.name : 'Chọn file Excel'}
        </span>
        <span className="text-xs text-gray-500">{files[key].sheetNames.length ? `${files[key].sheetNames.length} sheets` : 'Chưa đọc sheet'}</span>
      </label>
    </div>
  );

  return (
    <div className="min-h-[85vh] bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-2xl font-bold text-gray-800 mb-1">Mapping dữ liệu giữa các file Excel</h1>
          <p className="text-gray-600 mb-6">Upload tối đa 3 file nguồn và 1 file đích. Cài đặt các vùng copy và vị trí dán trong file đích, sau đó nhấn Update.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {renderFilePicker('Nguồn 1', 'source1')}
            {renderFilePicker('Nguồn 2', 'source2')}
            {renderFilePicker('Nguồn 3', 'source3')}
            {renderFilePicker('File đích', 'destination')}
          </div>

          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">Cấu hình Mapping</h2>
            <button onClick={addRow} className="inline-flex items-center px-3 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
              <Plus className="w-4 h-4 mr-1" /> Thêm hàng
            </button>
          </div>

          <div className="space-y-3">
            {mappings.map((m, idx) => (
              <div key={idx} className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end p-3 rounded-lg border">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">File nguồn</label>
                  <select value={m.sourceKey} onChange={(e) => updateMappingField(idx, 'sourceKey', e.target.value as any)} className="w-full border rounded-md px-2 py-2 text-sm">
                    <option value="source1">source1</option>
                    <option value="source2">source2</option>
                    <option value="source3">source3</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-1">Sheet nguồn</label>
                  <input list={`sheets-src-${idx}`} value={m.from.sheet} onChange={(e) => updateMappingField(idx, 'from.sheet', e.target.value)} className="w-full border rounded-md px-2 py-2 text-sm" placeholder="Tên sheet" />
                  <datalist id={`sheets-src-${idx}`}>
                    {(files[m.sourceKey].sheetNames || []).map(s => <option key={s} value={s} />)}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-1">Vùng nguồn (A1:D10)</label>
                  <input value={m.from.range} onChange={(e) => updateMappingField(idx, 'from.range', e.target.value)} className="w-full border rounded-md px-2 py-2 text-sm" placeholder="A1:D10" />
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-1">Sheet đích</label>
                  <input list={`sheets-dst-${idx}`} value={m.to.sheet} onChange={(e) => updateMappingField(idx, 'to.sheet', e.target.value)} className="w-full border rounded-md px-2 py-2 text-sm" placeholder="Tên sheet" />
                  <datalist id={`sheets-dst-${idx}`}>
                    {(files.destination.sheetNames || []).map(s => <option key={s} value={s} />)}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-1">Vị trí đích (A1 hoặc A1:D10)</label>
                  <input value={m.to.range} onChange={(e) => updateMappingField(idx, 'to.range', e.target.value)} className="w-full border rounded-md px-2 py-2 text-sm" placeholder="A1" />
                </div>

                <div className="flex justify-end">
                  <button onClick={() => removeRow(idx)} className="inline-flex items-center justify-center w-full md:w-auto px-3 py-2 border rounded-md text-red-600 hover:bg-red-50">
                    <Trash2 className="w-4 h-4 mr-1" /> Xóa
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <button onClick={onRun} disabled={!canRun || busy} className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-semibold py-3 px-6 rounded-lg hover:from-indigo-700 hover:to-blue-700 disabled:opacity-50">
              {busy ? 'Đang cập nhật...' : (
                <span className="flex items-center justify-center"><Download className="w-5 h-5 mr-2" /> Update</span>
              )}
            </button>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border-l-4 border-red-500 rounded-r">
              <div className="flex items-start">
                <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
                <pre className="whitespace-pre-wrap text-red-800 text-sm">{error}</pre>
              </div>
            </div>
          )}

          {success && (
            <div className="mt-4 p-3 bg-green-50 border-l-4 border-green-500 rounded-r">
              <div className="flex items-start">
                <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                <div className="text-green-800 text-sm">{success}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
