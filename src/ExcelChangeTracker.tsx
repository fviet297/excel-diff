import React, { useState } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, Download, CheckCircle, XCircle, Edit } from 'lucide-react';
import * as XLSX from 'xlsx';

const ExcelChangeTracker = () => {
  const [originalFile, setOriginalFile] = useState(null);
  const [modifiedFile, setModifiedFile] = useState(null);
  const [changes, setChanges] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const readExcelFile = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheets = {};
          
          workbook.SheetNames.forEach(sheetName => {
            const worksheet = workbook.Sheets[sheetName];
            sheets[sheetName] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
          });
          
          resolve(sheets);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  const compareSheets = (original, modified) => {
    const allSheets = new Set([...Object.keys(original), ...Object.keys(modified)]);
    const sheetChanges = {};

    allSheets.forEach(sheetName => {
      const origSheet = original[sheetName] || [];
      const modSheet = modified[sheetName] || [];
      const sheetChange = {
        added: [],
        deleted: [],
        modified: [],
        unchanged: 0
      };

      if (!original[sheetName]) {
        sheetChange.info = 'Sheet mới được thêm';
        sheetChange.added = modSheet.map((row, idx) => ({ rowIndex: idx, data: row }));
      } else if (!modified[sheetName]) {
        sheetChange.info = 'Sheet đã bị xóa';
        sheetChange.deleted = origSheet.map((row, idx) => ({ rowIndex: idx, data: row }));
      } else {
        const maxRows = Math.max(origSheet.length, modSheet.length);
        
        for (let i = 0; i < maxRows; i++) {
          const origRow = origSheet[i] || [];
          const modRow = modSheet[i] || [];
          
          if (i >= origSheet.length) {
            sheetChange.added.push({ rowIndex: i, data: modRow });
          } else if (i >= modSheet.length) {
            sheetChange.deleted.push({ rowIndex: i, data: origRow });
          } else {
            const rowDiff = [];
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
				  cardNo: origRow[2]
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
      }

      sheetChanges[sheetName] = sheetChange;
    });

    return sheetChanges;
  };

  const handleCompare = async () => {
    if (!originalFile || !modifiedFile) {
      setError('Vui lòng upload cả 2 file để so sánh');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const origData = await readExcelFile(originalFile);
      const modData = await readExcelFile(modifiedFile);
      const comparison = compareSheets(origData, modData);
      setChanges(comparison);
    } catch (err) {
      setError('Lỗi khi đọc file: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const exportChanges = () => {
    if (!changes) return;

    const report = [];
    report.push('=== BÁO CÁO THAY ĐỔI FILE EXCEL ===\n');
    report.push(`File gốc: ${originalFile.name}`);
    report.push(`File thay đổi: ${modifiedFile.name}`);
    report.push(`Thời gian: ${new Date().toLocaleString('vi-VN')}\n`);

    Object.entries(changes).forEach(([sheetName, change]) => {
      report.push(`\n${'='.repeat(50)}`);
      report.push(`SHEET: ${sheetName}`);
      report.push('='.repeat(50));

      if (change.info) {
        report.push(`\n${change.info}\n`);
      }

      if (change.added.length > 0) {
        report.push(`\n[+] DÒNG MỚI THÊM: ${change.added.length}`);
        change.added.forEach(item => {
          report.push(`  Dòng ${item.rowIndex + 1}: ${JSON.stringify(item.data)}`);
        });
      }

      if (change.deleted.length > 0) {
        report.push(`\n[-] DÒNG BỊ XÓA: ${change.deleted.length}`);
        change.deleted.forEach(item => {
          report.push(`  Dòng ${item.rowIndex + 1}: ${JSON.stringify(item.data)}`);
        });
      }

      if (change.modified.length > 0) {
        report.push(`\n[~] DÒNG BỊ SỬA: ${change.modified.length}`);
        change.modified.forEach(item => {
          report.push(`  Dòng ${item.rowIndex + 1}:`);
          item.changes.forEach(c => {
            report.push(`    Cột ${c.column}: "${c.oldValue}" → "${c.newValue}"`);
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
    a.download = `change_report_${new Date().getTime()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const FileUploadBox = ({ label, file, onChange, color }) => (
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
            onChange={onChange}
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

  const getTotalChanges = () => {
    if (!changes) return 0;
    return Object.values(changes).reduce((sum, change) => 
      sum + change.added.length + change.deleted.length + change.modified.length, 0
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              Theo Dõi Thay Đổi File Excel
            </h1>
            <p className="text-gray-600">Upload 2 file Excel để xem chi tiết các thay đổi</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <FileUploadBox
              label="Upload File Gốc"
              file={originalFile}
              onChange={(e) => setOriginalFile(e.target.files[0])}
              color={originalFile ? 'border-green-300 bg-green-50' : 'border-gray-300'}
            />
            <FileUploadBox
              label="Upload File Đã Thay Đổi"
              file={modifiedFile}
              onChange={(e) => setModifiedFile(e.target.files[0])}
              color={modifiedFile ? 'border-green-300 bg-green-50' : 'border-gray-300'}
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <span className="text-red-700">{error}</span>
            </div>
          )}

          <div className="flex gap-4 justify-center mb-8">
            <button
              onClick={handleCompare}
              disabled={!originalFile || !modifiedFile || loading}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg"
            >
              <Upload className="w-5 h-5" />
              {loading ? 'Đang so sánh...' : 'So Sánh File'}
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

          {changes && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg p-6 shadow-lg">
                <h2 className="text-2xl font-bold mb-2">Tổng Quan Thay Đổi</h2>
                <div className="text-lg">
                  Tổng số thay đổi: <span className="font-bold">{getTotalChanges()}</span> thay đổi
                </div>
              </div>

              {Object.entries(changes).map(([sheetName, change]) => (
                <div key={sheetName} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-100 px-6 py-4 border-b">
                    <h3 className="text-xl font-bold text-gray-800">Sheet: {sheetName}</h3>
                    {change.info && (
                      <p className="text-sm text-gray-600 mt-1">{change.info}</p>
                    )}
                  </div>

                  <div className="p-6 space-y-4">
                    {change.added.length > 0 && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <h4 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
                          <CheckCircle className="w-5 h-5" />
                          Dòng mới thêm ({change.added.length})
                        </h4>
                        {change.added.slice(0, 5).map((item, idx) => (
                          <div key={idx} className="text-sm text-gray-700 mb-1">
                            Dòng {item.rowIndex + 1}: {JSON.stringify(item.data).substring(0, 100)}...
                          </div>
                        ))}
                        {change.added.length > 5 && (
                          <div className="text-sm text-gray-500 mt-2">
                            ... và {change.added.length - 5} dòng khác
                          </div>
                        )}
                      </div>
                    )}

                    {change.deleted.length > 0 && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <h4 className="font-semibold text-red-800 mb-3 flex items-center gap-2">
                          <XCircle className="w-5 h-5" />
                          Dòng bị xóa ({change.deleted.length})
                        </h4>
                        {change.deleted.slice(0, 5).map((item, idx) => (
                          <div key={idx} className="text-sm text-gray-700 mb-1">
                            Dòng {item.rowIndex + 1}: {JSON.stringify(item.data).substring(0, 100)}...
                          </div>
                        ))}
                        {change.deleted.length > 5 && (
                          <div className="text-sm text-gray-500 mt-2">
                            ... và {change.deleted.length - 5} dòng khác
                          </div>
                        )}
                      </div>
                    )}

                    {change.modified.length > 0 && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <h4 className="font-semibold text-yellow-800 mb-3 flex items-center gap-2">
                          <Edit className="w-5 h-5" />
                          Dòng bị sửa ({change.modified.length})
                        </h4>
                        {change.modified.slice(0, 5).map((item, idx) => (
                          <div key={idx} className="mb-3 pb-3 border-b border-yellow-100 last:border-0">
                            <div className="font-medium text-sm text-gray-800 mb-1">
                              Dòng {item.rowIndex + 1}:
                            </div>
                            {item.changes.map((c, cidx) => (
                              <div key={cidx} className="text-sm text-gray-700 ml-4">
                                {c.cardNo}: <span className="text-red-600 line-through">"{c.oldValue}"</span> → <span className="text-green-600 font-medium">"{c.newValue}"</span>
                              </div>
                            ))}
                          </div>
                        ))}
                        {change.modified.length > 5 && (
                          <div className="text-sm text-gray-500 mt-2">
                            ... và {change.modified.length - 5} dòng khác
                          </div>
                        )}
                      </div>
                    )}

                    {change.unchanged > 0 && (
                      <div className="text-sm text-gray-600">
                        Không thay đổi: {change.unchanged} dòng
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExcelChangeTracker;