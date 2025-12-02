'use client';

import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { Upload, AlertCircle, CheckCircle, XCircle, Download, FileSpreadsheet } from 'lucide-react';
import AppFooter from './AppFooter';

interface CardRow {
  card: string;
  status: string;
  sheet: string;
  file: string;
}

interface ValidationResult {
  type: 'error' | 'fail' | 'pass';
  message: string;
  details?: string[];
}

interface SheetInfo {
  name: string;
  selected: boolean;
}

export default function App() {
  const [file1, setFile1] = useState<File | null>(null);
  const [file2, setFile2] = useState<File | null>(null);
  const [file1Sheets, setFile1Sheets] = useState<SheetInfo[]>([]);
  const [results, setResults] = useState<ValidationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Đọc file Excel với tùy chọn lọc sheet và cấu hình header
  const readExcelFile = (
    file: File,
    includeData: boolean = false,
    options?: {
      sheetFilter?: Set<string>; // Chỉ đọc các sheet trong tập này (nếu cung cấp)
      cardHeaderIncludes?: string[]; // Các từ khóa (lowercase) để tìm cột mã thẻ
      statusHeaderIncludes?: string[]; // Các từ khóa (lowercase) để tìm cột trạng thái
    }
  ): Promise<{ sheets: string[]; data?: CardRow[] }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const validSheets: string[] = [];
        const rows: CardRow[] = [];

        workbook.SheetNames.forEach((sheetName) => {
          // Bỏ qua sheet nếu có filter và sheet không nằm trong danh sách
          if (options?.sheetFilter && !options.sheetFilter.has(sheetName)) return;
          // if (!/^T-Pass\s+\w+-\d{4}$/.test(sheetName)) return;

          validSheets.push(sheetName);

          if (!includeData) return;

          const worksheet = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

          if (json.length === 0) return;

          const header = json[0].map((h: string) => h.toString().trim().toLowerCase());
          const cardKeywords = (options?.cardHeaderIncludes ?? ['temp pass']).map(s => s.toLowerCase());
          const statusKeywords = (options?.statusHeaderIncludes ?? ['status']).map(s => s.toLowerCase());
          const cardCol = header.findIndex((h) => cardKeywords.some(k => h.includes(k)));
          const statusCol = header.findIndex((h) => statusKeywords.some(k => h.includes(k)));

          if (cardCol === -1 || statusCol === -1) return;

          json.slice(1).forEach((row: any[]) => {
            const card = row[cardCol]?.toString().trim();
            const status = row[statusCol]?.toString().trim();
            if (card && status) {
              rows.push({ card, status, sheet: sheetName, file: file.name });
            }
          });
        });

        resolve({ sheets: validSheets, data: includeData ? rows : undefined });
      };
      reader.onerror = reject;
      reader.readAsBinaryString(file);
    });
  };

  // Xử lý chọn File 1
  const handleFile1Change = async (file: File | null) => {
    setFile1(file);
    setFile1Sheets([]);
    setResults([]);
    setError(null);

    if (!file) return;

    try {
      const { sheets } = await readExcelFile(file, false);
      setFile1Sheets(sheets.map(name => ({ name, selected: true })));
    } catch (err) {
      setError('Không thể đọc File 1. Vui lòng kiểm tra định dạng.');
    }
  };

  // Toggle sheet
  const toggleSheet = (name: string) => {
    setFile1Sheets(prev =>
      prev.map(s => s.name === name ? { ...s, selected: !s.selected } : s)
    );
  };

  // Chọn/bỏ chọn tất cả
  const toggleAllSheets = () => {
    const allSelected = file1Sheets.every(s => s.selected);
    setFile1Sheets(prev => prev.map(s => ({ ...s, selected: !allSelected })));
  };

  // Kiểm tra
  const validate = async () => {
    if (!file1 || !file2) {
      setError('Vui lòng upload cả 2 file!');
      return;
    }

    const selectedSheetNames = file1Sheets.filter(s => s.selected).map(s => s.name);
    if (selectedSheetNames.length === 0) {
      setError('Vui lòng chọn ít nhất 1 sheet từ File 1!');
      return;
    }

    setLoading(true);
    setResults([]);
    setError(null);

    try {
      const selectedSet = new Set(selectedSheetNames);
      const resp1 = await readExcelFile(file1, true, {
        sheetFilter: selectedSet,
        cardHeaderIncludes: ['temp pass'],
        statusHeaderIncludes: ['status'],
      });
      const data1: CardRow[] = resp1.data ?? [];

      const resp2 = await readExcelFile(file2, true, {
        cardHeaderIncludes: ['first name'],
        statusHeaderIncludes: ['card status'],
      });
      const data2: CardRow[] = resp2.data ?? [];

      const errors: ValidationResult[] = [];

      const notYetMap = new Map<string, CardRow[]>();
      data1.forEach((row) => {
        if (row.status.toLowerCase().includes('not yet')) {
          if (!notYetMap.has(row.card)) notYetMap.set(row.card, []);
          notYetMap.get(row.card)!.push(row);
        }
      });

      notYetMap.forEach((rows, card) => {
        if (rows.length > 1) {
          errors.push({
            type: 'error',
            message: `Thẻ ${card} có ${rows.length} dòng "Not yet returned"`,
            details: rows.map(r => r.sheet),
          });
        }
      });

      const file2StatusMap = new Map<string, Set<string>>();
      data2.forEach((row) => {
        if (!file2StatusMap.has(row.card)) file2StatusMap.set(row.card, new Set());
        file2StatusMap.get(row.card)!.add(row.status);
      });

      data1.forEach((row1) => {
        const statusesInFile2 = file2StatusMap.get(row1.card);
        if (!statusesInFile2) return;

        const norm1 = row1.status.toLowerCase();
        const isReturned1 = norm1.includes('returned');
        const isNotYet1 = norm1.includes('not yet');
        const hasReturned2 = [...statusesInFile2].some(s => s.toLowerCase().includes('returned'));

        // if (isReturned1 && !hasReturned2) {
        //   errors.push({
        //     type: 'fail',
        //     message: `Thẻ ${row1.card}: File 1 "Returned" → File 2 không có "Returned"`,
        //     details: [`Sheet: ${row1.sheet}`, `File 2: ${[...statusesInFile2].join(', ')}`],
        //   });
        // }

        if (isNotYet1 && hasReturned2) {
          errors.push({
            type: 'fail',
            message: `Thẻ ${row1.card}: File 1 "Not Yet Returned" → File 2 có "Returned"`,
            details: [`Sheet: ${row1.sheet}`, `File 2: ${[...statusesInFile2].join(', ')}`],
          });
        }
      });

      const file1NotYetCards = new Set<string>();
      data1.forEach((row) => {
        if (row.status.toLowerCase().includes('not yet')) {
          file1NotYetCards.add(row.card);
        }
      });

      data2.forEach((row2) => {
        if (row2.status.toLowerCase() === 'active') {
          if (!file1NotYetCards.has(row2.card)) {
            errors.push({
              type: 'fail',
              message: `Thẻ ${row2.card} đang "Active" trong File 2 nhưng chưa có "Not Yet Returned" trong File 1`,
              details: [
                `Sheet File 2: ${row2.sheet}`,
                `Không tìm thấy trong các sheet đã chọn của File 1`
              ],
            });
          }
        }
      });

      if (errors.length === 0) {
        setResults([{
          type: 'pass',
          message: `Tất cả kiểm tra đều PASS! (${data1.length} dòng từ ${selectedSheetNames.length} sheet)`,
        }]);
      } else {
        setResults(errors);
      }
    } catch (err) {
      setError('Lỗi xử lý file: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Xuất báo cáo (tùy chọn)
  const exportReport = () => {
    const report = results.map(r => `${r.type.toUpperCase()}: ${r.message}${r.details ? '\n  - ' + r.details.join('\n  - ') : ''}`).join('\n\n');
    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Report-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
  };

  return (
    <>
      <div className="min-h-[85vh] bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col">
        {/* Main Content */}
        <div className="flex-1 py-2 px-6">

          <div className="max-w-7xl mx-auto">
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-gray-800 mb-2 flex items-center justify-center gap-2">
                  <FileSpreadsheet className="w-8 h-8 text-indigo-600" />
                 Report Checker
                </h1>
                <p className="text-gray-600">Upload 2 file → Chọn sheet → Kiểm tra trạng thái</p>
              </div>

              {/* Upload Files */}
              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${file1 ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-gray-400'}`}>
                  <Upload className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <label className="block font-medium text-gray-700 mb-2">File Report 1</label>
                  <input
                    type="file"
                    accept=".xlsx"
                    onChange={(e) => handleFile1Change(e.target.files?.[0] || null)}
                    className="hidden"
                    id="file1"
                  />
                  <label htmlFor="file1" className="cursor-pointer inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                    Upload
                  </label>
                  {file1 && <p className="mt-2 text-sm text-green-700 font-medium">{file1.name}</p>}
                </div>

                <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${file2 ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-gray-400'}`}>
                  <Upload className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <label className="block font-medium text-gray-700 mb-2">File Report 2</label>
                  <input
                    type="file"
                    accept=".xlsx"
                    onChange={(e) => setFile2(e.target.files?.[0] || null)}
                    className="hidden"
                    id="file2"
                  />
                  <label htmlFor="file2" className="cursor-pointer inline-block px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm">
                    Upload
                  </label>
                  {file2 && <p className="mt-2 text-sm text-green-700 font-medium">{file2.name}</p>}
                </div>
              </div>
              {/* Sheet Selector – Dropdown (Select) */}
              {file1Sheets.length > 0 && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 mb-6 border">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-800">Chọn sheet từ File 1</h3>

                  </div>

                  {/* Dropdown đơn lựa chọn */}
                  <select
                    value={file1Sheets.find(s => s.selected)?.name || ""}
                    onChange={(e) => {
                      const name = e.target.value;
                      setFile1Sheets(prev => prev.map(s => ({ ...s, selected: s.name === name })));
                    }}
                    className="w-full p-3 bg-white border rounded-lg text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="" disabled>Chọn một sheet...</option>
                    {file1Sheets.map(sheet => (
                      <option key={sheet.name} value={sheet.name} className="py-1">
                        {sheet.name}
                      </option>
                    ))}
                  </select>

                  <p className="mt-3 text-sm text-gray-600">
                    Đã chọn: <strong>{file1Sheets.filter(s => s.selected).length}</strong> / {file1Sheets.length} sheet
                  </p>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500" />
                  <span className="text-red-700">{error}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-4 justify-center mb-8">
                <button
                  onClick={validate}
                  disabled={loading || !file1 || !file2 || file1Sheets.filter(s => s.selected).length === 0}
                  className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg transition-all"
                >
                  {loading ? (
                    <>Đang kiểm tra...</>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      Check
                    </>
                  )}
                </button>

                {results.length > 0 && results[0].type !== 'pass' && (
                  <button
                    onClick={exportReport}
                    className="px-6 py-3 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 flex items-center gap-2 shadow-lg transition-all"
                  >
                    <Download className="w-5 h-5" />
                    Tải báo cáo
                  </button>
                )}
              </div>

              {/* Results */}
              {results.length > 0 && (
                <div className="space-y-4">
                  {results.map((res, i) => (
                    <div
                      key={i}
                      className={`rounded-lg p-5 border-l-4 shadow-md ${res.type === 'pass'
                        ? 'bg-green-50 border-green-500'
                        : res.type === 'error'
                          ? 'bg-red-50 border-red-500'
                          : 'bg-yellow-50 border-yellow-500'
                        }`}
                    >
                      <div className="flex items-start gap-3">
                        {res.type === 'pass' ? (
                          <CheckCircle className="w-6 h-6 text-green-600 mt-0.5" />
                        ) : res.type === 'error' ? (
                          <XCircle className="w-6 h-6 text-red-600 mt-0.5" />
                        ) : (
                          <AlertCircle className="w-6 h-6 text-yellow-600 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <p className={`font-semibold ${res.type === 'pass' ? 'text-green-800' : res.type === 'error' ? 'text-red-800' : 'text-yellow-800'}`}>
                            {res.message}
                          </p>
                          {res.details && res.details.length > 0 && (
                            <ul className="mt-2 ml-6 list-disc text-sm text-gray-700">
                              {res.details.map((d, j) => (
                                <li key={j}>{d}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        
      </div>
    </>
  );
}
