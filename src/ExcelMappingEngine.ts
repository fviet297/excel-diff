import * as XLSX from 'xlsx-js-style';

export type FileKey = 'source1' | 'source2' | 'source3' | 'source4' | 'destination';

export interface RangeRef {
  sheet: string;
  range: string; // e.g., "A1:D10". For destination, you can also pass a single cell like "B5"
}

export interface MappingItem {
  sourceKey: Exclude<FileKey, 'destination'>;
  from: RangeRef; // from source file
  to: RangeRef;   // to destination file (sheet must exist). If to.range is a single cell, data will be pasted starting there.
}

export interface LoadedWorkbooks {
  source1?: XLSX.WorkBook;
  source2?: XLSX.WorkBook;
  source3?: XLSX.WorkBook;
  source4?: XLSX.WorkBook;
  destination?: XLSX.WorkBook;
}

export class ExcelMappingEngine {
  private books: LoadedWorkbooks = {};
  private mappings: MappingItem[] = [];
  private defaultSheets: Partial<Record<FileKey, string>> = {};

  setWorkbook(key: FileKey, wb: XLSX.WorkBook) {
    this.books[key] = wb;
  }

  setMappings(items: MappingItem[]) {
    this.mappings = items || [];
  }

  setDefaultSheets(sheets: Partial<Record<FileKey, string>>) {
    this.defaultSheets = sheets || {};
  }

  private ensureSheet(wb: XLSX.WorkBook | undefined, name: string): XLSX.WorkSheet | null {
    if (!wb) return null;
    const sheet = wb.Sheets[name];
    return sheet || null;
  }

  private parseRange(range: string): { s: XLSX.CellAddress; e: XLSX.CellAddress } {
    const r = XLSX.utils.decode_range(range);
    return r;
  }

  private isSingleCell(range: string): boolean {
    const r = XLSX.utils.decode_range(range);
    return r.s.r === r.e.r && r.s.c === r.e.c;
  }

  validate(): { ok: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!this.books.destination) errors.push('Chưa có file đích');

    for (const m of this.mappings) {
      const srcBook = this.books[m.sourceKey];
      if (!srcBook) {
        errors.push(`Thiếu file nguồn: ${m.sourceKey}`);
        continue;
      }
      const effSrcSheetName = m.from.sheet || this.defaultSheets[m.sourceKey] || '';
      const srcSheet = this.ensureSheet(srcBook, effSrcSheetName);
      if (!srcSheet) errors.push(`Không tìm thấy sheet "${effSrcSheetName}" trong ${m.sourceKey}`);

      const effDstSheetName = m.to.sheet || this.defaultSheets.destination || '';
      const dstSheet = this.ensureSheet(this.books.destination, effDstSheetName);
      if (!dstSheet) errors.push(`Không tìm thấy sheet "${effDstSheetName}" trong file đích`);

      try {
        this.parseRange(m.from.range);
      } catch {
        errors.push(`Range nguồn không hợp lệ: ${m.from.range}`);
      }
      try {
        this.parseRange(m.to.range);
      } catch {
        errors.push(`Range đích không hợp lệ: ${m.to.range}`);
      }
    }

    return { ok: errors.length === 0, errors };
  }

  apply(): XLSX.WorkBook {
    if (!this.books.destination) throw new Error('Chưa có file đích');
    // Edit in place on the destination workbook
    const dst = this.books.destination;

    for (const m of this.mappings) {
      const srcBook = this.books[m.sourceKey];
      if (!srcBook) continue;

      const effSrcSheetName = m.from.sheet || this.defaultSheets[m.sourceKey] || '';
      const effDstSheetName = m.to.sheet || this.defaultSheets.destination || '';
      const srcSheet = this.ensureSheet(srcBook, effSrcSheetName);
      const dstSheet = this.ensureSheet(dst, effDstSheetName);
      if (!srcSheet || !dstSheet) continue;

      const srcRange = this.parseRange(m.from.range);
      const dstRange = this.parseRange(m.to.range);

      // Read values from source range as 2D array
      const rows: any[][] = [];
      for (let r = srcRange.s.r; r <= srcRange.e.r; r++) {
        const row: any[] = [];
        for (let c = srcRange.s.c; c <= srcRange.e.c; c++) {
          const addr = XLSX.utils.encode_cell({ r, c });
          const cell = (srcSheet as any)[addr];
          row.push(cell ? cell.v : undefined);
        }
        rows.push(row);
      }

      // Determine destination top-left
      const startR = dstRange.s.r;
      const startC = dstRange.s.c;

      // Paste rows into destination: only modify target cells; preserve existing formatting by merging styles
      for (let i = 0; i < rows.length; i++) {
        for (let j = 0; j < rows[i].length; j++) {
          const r = startR + i;
          const c = startC + j;
          const addr = XLSX.utils.encode_cell({ r, c });
          const v = rows[i][j];
          if (v === undefined || v === null) continue;
          const existing = (dstSheet as any)[addr] || {};
          const existingStyle = { ...(existing.s || {}) };
          const mergedStyle = {
            ...existingStyle,
            fill: {
              patternType: 'solid',
              fgColor: { rgb: 'C6EFCE' }, // xanh lá nhạt
            },
          };

          const cellType = typeof v === 'number' ? 'n' : typeof v === 'boolean' ? 'b' : 's';

          (dstSheet as any)[addr] = {
            ...existing,
            t: cellType,
            v,
            s: mergedStyle,
          } as any;
        }
      }

      // Update sheet range (!ref): preserve current start, only expand end if needed
      const pastedEndR = startR + rows.length - 1;
      const pastedEndC = startC + (rows[0]?.length || 1) - 1;
      const curRefStr = (dstSheet as any)['!ref'];
      const curRef = curRefStr ? XLSX.utils.decode_range(curRefStr) : { s: { r: 0, c: 0 }, e: { r: 0, c: 0 } };
      const newEndR = Math.max(curRef.e.r, pastedEndR, dstRange.e.r);
      const newEndC = Math.max(curRef.e.c, pastedEndC, dstRange.e.c);
      const updatedRef = XLSX.utils.encode_range({ s: { r: curRef.s.r, c: curRef.s.c }, e: { r: newEndR, c: newEndC } });
      (dstSheet as any)['!ref'] = updatedRef;
    }

    return dst;
  }
}
