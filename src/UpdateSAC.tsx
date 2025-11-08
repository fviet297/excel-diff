import React, { useState } from 'react';
import { Upload, Download, CheckCircle, AlertCircle, Settings } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function ExcelMerger() {
  const [file1, setFile1] = useState(null);
  const [file2, setFile2] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  
  // Tên cột có thể tùy chỉnh
  const [columns, setColumns] = useState({
    file1Source: 'Event Source',
    file1Target: 'Remark',
    file2Code: 'Code',
    file2Value: 'Cam No'
  });

  const [showSettings, setShowSettings] = useState(false);

  const handleFileUpload = (e, fileNumber) => {
    const file = e.target.files[0];
    if (file) {
      if (fileNumber === 1) {
        setFile1(file);
      } else {
        setFile2(file);
      }
      setResult(null);
      setError(null);
    }
  };

  const handleColumnChange = (key, value) => {
    setColumns(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const readExcelFile = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);
          resolve(jsonData);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  const processFiles = async () => {
    if (!file1 || !file2) {
      setError('Vui lòng chọn cả 2 file Excel');
      return;
    }

    setProcessing(true);
    setError(null);
    setResult(null);

    try {
      // Đọc cả 2 file
      const data1 = await readExcelFile(file1);
      const data2 = await readExcelFile(file2);

      // Kiểm tra cột tồn tại
      if (data1.length > 0 && !data1[0].hasOwnProperty(columns.file1Source)) {
        throw new Error(`Không tìm thấy cột "${columns.file1Source}" trong File 1`);
      }
      if (data2.length > 0 && !data2[0].hasOwnProperty(columns.file2Code)) {
        throw new Error(`Không tìm thấy cột "${columns.file2Code}" trong File 2`);
      }
      if (data2.length > 0 && !data2[0].hasOwnProperty(columns.file2Value)) {
        throw new Error(`Không tìm thấy cột "${columns.file2Value}" trong File 2`);
      }

      // Tạo map từ file 2 để tra cứu nhanh
      const codeMap = {};
      data2.forEach(row => {
        if (row[columns.file2Code] !== undefined && row[columns.file2Value] !== undefined) {
          codeMap[row[columns.file2Code]] = row[columns.file2Value];
        }
      });

      // Xử lý file 1
      let matchCount = 0;
      let noMatchCount = 0;

      const processedData = data1.map(row => {
        const sourceValue = row[columns.file1Source];
        
        if (sourceValue !== undefined && codeMap[sourceValue] !== undefined) {
          row[columns.file1Target] = codeMap[sourceValue];
          matchCount++;
        } else {
          noMatchCount++;
        }
        
        return row;
      });

      // Tạo file Excel mới
      const ws = XLSX.utils.json_to_sheet(processedData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
      
      // Xuất file
      XLSX.writeFile(wb, 'file_da_chinh_sua.xlsx');

      setResult({
        total: data1.length,
        matched: matchCount,
        notMatched: noMatchCount
      });
    } catch (err) {
      setError(`Lỗi xử lý file: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-[85vh] bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl font-bold text-gray-800">
              Công cụ chỉnh sửa Excel
            </h1>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Cài đặt tên cột"
            >
              <Settings className={`w-6 h-6 ${showSettings ? 'text-blue-600' : 'text-gray-600'}`} />
            </button>
          </div>
          <p className="text-gray-600 mb-8">
            Ghép dữ liệu từ 2 file Excel
          </p>

          {/* Settings Panel */}
          {showSettings && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">
                Tùy chỉnh tên cột
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    File 1 - Cột nguồn (để tìm kiếm)
                  </label>
                  <input
                    type="text"
                    value={columns.file1Source}
                    onChange={(e) => handleColumnChange('file1Source', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Event Source"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    File 1 - Cột đích (để ghi kết quả)
                  </label>
                  <input
                    type="text"
                    value={columns.file1Target}
                    onChange={(e) => handleColumnChange('file1Target', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Remark"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    File 2 - Cột mã (để khớp)
                  </label>
                  <input
                    type="text"
                    value={columns.file2Code}
                    onChange={(e) => handleColumnChange('file2Code', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Code"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    File 2 - Cột giá trị (để lấy)
                  </label>
                  <input
                    type="text"
                    value={columns.file2Value}
                    onChange={(e) => handleColumnChange('file2Value', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Cam No"
                  />
                </div>
              </div>
            </div>
          )}

          {/* File 1 Upload */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              File 1 (Chứa cột "{columns.file1Source}" và "{columns.file1Target}")
            </label>
            <div className="relative">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => handleFileUpload(e, 1)}
                className="hidden"
                id="file1"
              />
              <label
                htmlFor="file1"
                className="flex items-center justify-center w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all"
              >
                <Upload className="w-5 h-5 mr-2 text-gray-500" />
                <span className="text-gray-600">
                  {file1 ? file1.name : 'Chọn file Excel đầu tiên'}
                </span>
              </label>
            </div>
          </div>

          {/* File 2 Upload */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              File 2 (Chứa cột "{columns.file2Code}" và "{columns.file2Value}")
            </label>
            <div className="relative">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => handleFileUpload(e, 2)}
                className="hidden"
                id="file2"
              />
              <label
                htmlFor="file2"
                className="flex items-center justify-center w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all"
              >
                <Upload className="w-5 h-5 mr-2 text-gray-500" />
                <span className="text-gray-600">
                  {file2 ? file2.name : 'Chọn file Excel thứ hai'}
                </span>
              </label>
            </div>
          </div>

          {/* Process Button */}
          <button
            onClick={processFiles}
            disabled={!file1 || !file2 || processing}
            className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold py-3 px-6 rounded-lg hover:from-blue-600 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
          >
            {processing ? (
              <span className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Đang xử lý...
              </span>
            ) : (
              <span className="flex items-center justify-center">
                <Download className="w-5 h-5 mr-2" />
                Xử lý và Tải xuống
              </span>
            )}
          </button>

          {/* Error Message */}
          {error && (
            <div className="mt-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg">
              <div className="flex items-start">
                <AlertCircle className="w-5 h-5 text-red-500 mr-3 mt-0.5 flex-shrink-0" />
                <p className="text-red-700">{error}</p>
              </div>
            </div>
          )}

          {/* Success Message */}
          {result && (
            <div className="mt-6 p-4 bg-green-50 border-l-4 border-green-500 rounded-r-lg">
              <div className="flex items-start">
                <CheckCircle className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-green-700 font-semibold mb-2">
                    Xử lý thành công!
                  </p>
                  <div className="text-sm text-green-600 space-y-1">
                    <p>• Tổng số dòng: {result.total}</p>
                    <p>• Tìm thấy và cập nhật: {result.matched}</p>
                    <p>• Không tìm thấy: {result.notMatched}</p>
                  </div>
                  <p className="text-sm text-green-600 mt-2">
                    File đã được tải xuống với tên "file_da_chinh_sua.xlsx"
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="mt-8 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              Hướng dẫn sử dụng:
            </h3>
            <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
              <li>Nhấn biểu tượng <Settings className="w-3 h-3 inline" /> để tùy chỉnh tên cột nếu cần</li>
              <li>Chọn File 1 có cột nguồn và cột đích</li>
              <li>Chọn File 2 có cột mã và cột giá trị</li>
              <li>Nhấn "Xử lý và Tải xuống"</li>
              <li>Công cụ sẽ tìm giá trị trong cột nguồn, khớp với cột mã, và điền giá trị vào cột đích</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}