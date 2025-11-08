import React, { useState } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, Download, CheckCircle, XCircle, Edit, ChevronDown, Minus, Plus, Mail, Phone, Linkedin, Github } from 'lucide-react';
import * as XLSX from 'xlsx';

const ExcelChangeTracker = () => {
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [modifiedFile, setModifiedFile] = useState<File | null>(null);
  const [originalSheets, setOriginalSheets] = useState<string[]>([]);
  const [modifiedSheets, setModifiedSheets] = useState<string[]>([]);
  const [selectedOrigSheet, setSelectedOrigSheet] = useState<string>('');
  const [selectedModSheet, setSelectedModSheet] = useState<string>('');
  const [changes, setChanges] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');  // Đọc CHỈ danh sách sheet
  const readSheetNames = async (file: File): Promise<string[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target!.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          resolve(workbook.SheetNames);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  // Đọc dữ liệu của MỘT sheet đã chọn
  const readSheetData = async (file: File, sheetName: string): Promise<any[][]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target!.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const worksheet = workbook.Sheets[sheetName];
          if (!worksheet) return resolve([]);
          const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];
          resolve(rows);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };


  // Xử lý khi upload file
  const handleFileUpload = async (file: File | null, isOriginal: boolean) => {
    if (!file) {
      if (isOriginal) {
        setOriginalFile(null);
        setOriginalSheets([]);
        setSelectedOrigSheet('');
      } else {
        setModifiedFile(null);
        setModifiedSheets([]);
        setSelectedModSheet('');
      }
      setChanges(null);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const sheets = await readSheetNames(file);
      if (isOriginal) {
        setOriginalFile(file);
        setOriginalSheets(sheets);
        setSelectedOrigSheet(sheets[0] || '');
      } else {
        setModifiedFile(file);
        setModifiedSheets(sheets);
        setSelectedModSheet(sheets[0] || '');
      }
    } catch (err: any) {
      setError('Lỗi đọc file: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Tính max columns cho header
  const getMaxCols = (origData: any[][], modData: any[][]) => {
    return Math.max(
      ...origData.map(row => row.length),
      ...modData.map(row => row.length)
    );
  };

  // Render header bảng
  const renderHeader = (maxCols: number) => {
    return (
      <thead>
        <tr className="bg-gray-100">
          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-r">#</th>
          {Array.from({ length: maxCols }, (_, j) => (
            <th key={j} className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-r">
              {String.fromCharCode(65 + j)}
            </th>
          ))}
        </tr>
      </thead>
    );
  };

  // Render cell với diff
  const renderCell = (value: string, type: 'old' | 'new' | 'unchanged') => {
    const baseClass = "px-3 py-1 text-sm border-r whitespace-nowrap overflow-hidden text-ellipsis max-w-xs";
    if (type === 'old') return <td className={`${baseClass} bg-red-100 text-red-800 line-through`}>{value}</td>;
    if (type === 'new') return <td className={`${baseClass} bg-green-100 text-green-800 font-medium`}>{value}</td>;
    return <td className={`${baseClass} bg-white`}>{value}</td>;
  };

  // Render một row diff kiểu Git
  const renderDiffRow = (item: any, maxCols: number, isAdded: boolean, isDeleted: boolean) => {
    const rowIndex = item.rowIndex + 1;
    if (isAdded) {
      return (
        <tr key={`added-${item.rowIndex}`} className="bg-green-50">
          <td className="px-3 py-1 text-sm font-medium text-green-700 border-r flex items-center gap-1">
            <Plus className="w-4 h-4" /> {rowIndex}
          </td>
          {item.data.map((cell: any, j: number) => renderCell(String(cell || ''), 'new'))}
          {Array.from({ length: maxCols - item.data.length }, (_, j) => (
            <td key={`empty-new-${j}`} className="px-3 py-1 text-sm border-r bg-green-100"></td>
          ))}
        </tr>
      );
    }

    if (isDeleted) {
      return (
        <tr key={`deleted-${item.rowIndex}`} className="bg-red-50">
          <td className="px-3 py-1 text-sm font-medium text-red-700 border-r flex items-center gap-1">
            <Minus className="w-4 h-4" /> {rowIndex}
          </td>
          {item.data.map((cell: any, j: number) => renderCell(String(cell || ''), 'old'))}
          {Array.from({ length: maxCols - item.data.length }, (_, j) => (
            <td key={`empty-old-${j}`} className="px-3 py-1 text-sm border-r bg-red-100"></td>
          ))}
        </tr>
      );
    }

    // Modified
    const changesMap = new Map(item.changes.map((c: any) => [c.colIndex, c]));
    return (
      <tr key={`mod-${item.rowIndex}`} className="border-t-2 border-yellow-300">
        <td className="px-3 py-1 text-sm font-medium text-yellow-700 border-r flex items-center gap-1">
          <Edit className="w-4 h-4" /> {rowIndex}
        </td>
        {Array.from({ length: maxCols }, (_, j) => {
          const change = changesMap.get(j);
          if (change) {
            return (
              <td key={j} className="px-3 py-1 text-sm border-r">
                <div className="flex flex-col">
                  <span className="bg-red-100 text-red-800 line-through">{change.oldValue}</span>
                  <span className="bg-green-100 text-green-800 font-medium">{change.newValue}</span>
                </div>
              </td>
            );
          }
          const val = String(item.originalRow[j] || '');
          return renderCell(val, 'unchanged');
        })}
      </tr>
    );
  };

  // So sánh 2 sheet đã chọn
  const compareSheets = (origData: any, modData: any, origSheet: string, modSheet: string) => {
    const sheetChange: any = {
      added: [],
      deleted: [],
      modified: [],
      unchanged: 0,
      origSheetName: origSheet,
      modSheetName: modSheet
    };

    const origSheetData = origData[origSheet] || [];
    const modSheetData = modData[modSheet] || [];

    const maxRows = Math.max(origSheetData.length, modSheetData.length);

    for (let i = 0; i < maxRows; i++) {
      const origRow = origSheetData[i] || [];
      const modRow = modSheetData[i] || [];

      if (i >= origSheetData.length) {
        sheetChange.added.push({ rowIndex: i, data: modRow });
      } else if (i >= modSheetData.length) {
        sheetChange.deleted.push({ rowIndex: i, data: origRow });
      } else {
        const rowDiff: any[] = [];
        const maxCols = Math.max(origRow.length, modRow.length);
        let hasChanges = false;

        for (let j = 0; j < maxCols; j++) {
          const origVal = String(origRow[j] || '');
          const modVal = String(modRow[j] || '');

          if (origVal !== modVal) {
            hasChanges = true;
            rowDiff.push({
              colIndex: j,
              column: String.fromCharCode(65 + j),
              oldValue: origVal,
              newValue: modVal,
              cardNo: origRow[2] || ''
            });
          }
        }

        if (hasChanges) {
          sheetChange.modified.push({
            rowIndex: i,
            changes: rowDiff,
            originalRow: origRow,
            modifiedRow: modRow
          });
        } else {
          sheetChange.unchanged++;
        }
      }
    }

    return { [modSheet]: sheetChange };
  };

  const handleCompare = async () => {
    if (!originalFile || !modifiedFile || !selectedOrigSheet || !selectedModSheet) {
      setError('Vui lòng chọn đầy đủ 2 file và 2 sheet để so sánh');
      return;
    }

    setLoading(true);
    setError('');
    setChanges(null);

    try {
            const origRows = await readSheetData(originalFile, selectedOrigSheet);
      const modRows = await readSheetData(modifiedFile, selectedModSheet);
      const origData: any = { [selectedOrigSheet]: origRows };
      const modData: any = { [selectedModSheet]: modRows };
      const comparison = compareSheets(origData, modData, selectedOrigSheet, selectedModSheet);
      setChanges(comparison);
    } catch (err: any) {
      setError('Lỗi khi so sánh: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const exportChanges = () => {
    if (!changes || !originalFile || !modifiedFile) return;

    const report: string[] = [];
    report.push('=== BÁO CÁO THAY ĐỔI FILE EXCEL ===\n');
    report.push(`File 1: ${originalFile.name}`);
    report.push(`File 2: ${modifiedFile.name}`);
    report.push(`So sánh sheet: "${selectedOrigSheet}" vs "${selectedModSheet}"`);
    report.push(`Thời gian: ${new Date().toLocaleString('vi-VN')}\n`);

    Object.entries(changes).forEach(([sheetName, change]: [string, any]) => {
      report.push(`\n${'='.repeat(50)}`);
      report.push(`SHEET: ${change.origSheetName} → ${change.modSheetName}`);
      report.push('='.repeat(50));

      if (change.added.length > 0) {
        report.push(`\n[+] DÒNG MỚI THÊM: ${change.added.length}`);
        change.added.forEach((item: any) => {
          report.push(`  Dòng ${item.rowIndex + 1}: ${JSON.stringify(item.data)}`);
        });
      }

      if (change.deleted.length > 0) {
        report.push(`\n[-] DÒNG BỊ XÓA: ${change.deleted.length}`);
        change.deleted.forEach((item: any) => {
          report.push(`  Dòng ${item.rowIndex + 1}: ${JSON.stringify(item.data)}`);
        });
      }

      if (change.modified.length > 0) {
        report.push(`\n[~] DÒNG BỊ SỬA: ${change.modified.length}`);
        change.modified.forEach((item: any) => {
          report.push(`  Dòng ${item.rowIndex + 1}:`);
          item.changes.forEach((c: any) => {
            report.push(`    Cột ${c.column} (${c.cardNo}): "${c.oldValue}" → "${c.newValue}"`);
          });
        });
      }

      if (change.unchanged > 0) {
        report.push(`\n[=] DÒNG KHÔNG THAY ĐỔI: ${change.unchanged}`);
      }
    });

    const blob = new Blob([report.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diff_${selectedOrigSheet}_vs_${selectedModSheet}_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const FileUploadBox = ({ label, file, onChange, color, isOriginal }: any) => (
    <div className={`border-2 border-dashed rounded-lg p-6 ${color} transition-all`}>
      <div className="flex flex-col items-center gap-3">
        <FileSpreadsheet className="w-12 h-12 text-gray-400" />
        <label className="cursor-pointer">
          <span className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 inline-block">
            {label}
          </span>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => onChange(e.target.files?.[0] || null, isOriginal)}
            className="hidden"
          />
        </label>
        {file && (
          <div className="text-sm text-green-600 font-medium flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            {file.name}
          </div>
        )}
      </div>
    </div>
  );

  const SheetSelector = ({ sheets, selected, onChange, label }: any) => (
    <div className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="relative">
        <select
          value={selected}
          onChange={(e) => onChange(e.target.value)}
          disabled={!sheets.length}
          className="w-full appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
        >
          {sheets.length === 0 ? (
            <option value="">Không có sheet</option>
          ) : (
            sheets.map((sheet: string) => (
              <option key={sheet} value={sheet}>{sheet}</option>
            ))
          )}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
      </div>
    </div>
  );

  const getTotalChanges = () => {
    if (!changes) return 0;
    return Object.values(changes).reduce((sum: number, change: any) =>
      sum + change.added.length + change.deleted.length + change.modified.length, 0
    );
  };

  return (
    <div className="min-h-[85vh] bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col">
      {/* Main Content */}
        <div className="flex-1 py-2 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-800 mb-2">
                Git Diff Style
              </h1>
              <p className="text-gray-600">Upload 2 file → Chọn sheet → Check diff</p>
            </div>

            {/* Upload Files */}
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <FileUploadBox
                label="Upload File 1"
                file={originalFile}
                onChange={handleFileUpload}
                color={originalFile ? 'border-green-300 bg-green-50' : 'border-gray-300'}
                isOriginal={true}
              />
              <FileUploadBox
                label="Upload File 2"
                file={modifiedFile}
                onChange={handleFileUpload}
                color={modifiedFile ? 'border-green-300 bg-green-50' : 'border-gray-300'}
                isOriginal={false}
              />
            </div>

            {/* Sheet Selectors */}
            {(originalSheets.length > 0 || modifiedSheets.length > 0) && (
              <div className="grid md:grid-cols-2 gap-6 mb-6 p-6 bg-gray-50 rounded-xl border">
                <SheetSelector
                  sheets={originalSheets}
                  selected={selectedOrigSheet}
                  onChange={setSelectedOrigSheet}
                  label="Chọn sheet từ file 1"
                />
                <SheetSelector
                  sheets={modifiedSheets}
                  selected={selectedModSheet}
                  onChange={setSelectedModSheet}
                  label="Chọn sheet từ file 2"
                />
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
                onClick={handleCompare}
                disabled={!originalFile || !modifiedFile || !selectedOrigSheet || !selectedModSheet || loading}
                className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg"
              >
                <Upload className="w-5 h-5" />
                {loading ? 'Đang so sánh...' : 'So Sánh'}
              </button>

              {changes && (
                <button
                  onClick={exportChanges}
                  className="px-6 py-3 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 flex items-center gap-2 shadow-lg"
                >
                  <Download className="w-5 h-5" />
                  Tải Báo Cáo
                </button>
              )}
            </div>

            {/* Results - Git Diff Style Table */}
            {changes && (
              <div className="space-y-8">
                <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg p-6 shadow-lg">
                  <h2 className="text-2xl font-bold mb-2">Kết Quả So Sánh (Git Diff)</h2>
                  <div className="text-lg">
                    <span className="font-medium">{selectedOrigSheet}</span> → <span className="font-medium">{selectedModSheet}</span>
                    <br />
                    Tổng thay đổi: <span className="font-bold">{getTotalChanges()}</span> thay đổi
                    {' | '} Không thay đổi: <span className="font-bold">{Object.values(changes)[0].unchanged}</span> dòng
                  </div>
                </div>

                {Object.entries(changes).map(([sheetName, change]: [string, any]) => {
                  const origData = change.deleted.length > 0 ? change.deleted[0].data : []; // Để tính maxCols
                  const modData = change.added.length > 0 ? change.added[0].data : [];
                  const allRows = [...change.deleted.map((d: any) => d.originalRow || d.data), ...change.modified.map((m: any) => m.originalRow), ...change.added.map((a: any) => a.data)];
                  const maxCols = Math.max(getMaxCols(allRows, allRows), 1); // Ít nhất 1 cột

                  return (
                    <div key={sheetName} className="border border-gray-300 rounded-lg overflow-hidden shadow-md">
                      <div className="bg-gray-100 px-6 py-3 border-b flex items-center justify-between">
                        <h3 className="text-xl font-bold text-gray-800">
                          {change.origSheetName} → {change.modSheetName}
                        </h3>
                        <div className="text-sm text-gray-600">
                          +{change.added.length}  -{change.deleted.length}  ~{change.modified.length}
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-300 text-xs font-mono">
                          {renderHeader(maxCols)}
                          <tbody className="bg-white divide-y divide-gray-200">
                            {/* Deleted rows */}
                            {change.deleted.map((item: any) => renderDiffRow(item, maxCols, false, true))}

                            {/* Modified & Added rows (interleaved by rowIndex) */}
                            {[...change.modified, ...change.added].sort((a: any, b: any) => a.rowIndex - b.rowIndex).map((item: any) => 
                              renderDiffRow(item, maxCols, 'data' in item, false)
                            )}
                          </tbody>
                        </table>
                        {change.unchanged > 0 && (
                          <div className="px-6 py-3 text-sm text-gray-600 bg-gray-50">
                            ... và {change.unchanged} dòng không thay đổi (đã ẩn để tập trung vào diff)
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExcelChangeTracker;