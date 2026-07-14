'use client';

import { useState } from 'react';

interface FileUploadProps {
  onTransactionsParsed: (transactions: ParsedTransaction[]) => void;
  accounts: { id: string; name: string }[];
  existingTransactions?: { description: string; date: Date | string; amount: number }[];
}

export interface ParsedTransaction {
  date: Date;
  amount: number;
  description: string;
  category?: string;
  accountId?: string;
}

interface CsvRow { [key: string]: string }

export default function FileUpload({ onTransactionsParsed, accounts, existingTransactions = [] }: FileUploadProps) {
  const [selectedAccountId, setSelectedAccountId] = useState(accounts?.[0]?.id || '');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [dateCol, setDateCol] = useState('');
  const [descCol, setDescCol] = useState('');
  const [amtCol, setAmtCol] = useState('');
  const [amtInCol, setAmtInCol] = useState('');
  const [amtOutCol, setAmtOutCol] = useState('');
  const [splitAmounts, setSplitAmounts] = useState(false);
  const [negateAmt, setNegateAmt] = useState(false);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [fileType, setFileType] = useState<'csv' | 'ofx'>('csv');

  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let cur = '';
    let inQuote = false;
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote; }
      else if (ch === ',' && !inQuote) { result.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }
    result.push(cur.trim());
    return result;
  };

  const handleFile = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    const isOfx = ['ofx', 'qfx', 'qbo'].includes(ext);
    setFileType(isOfx ? 'ofx' : 'csv');
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      if (isOfx) {
        const txns = parseOFX(text);
        onTransactionsParsed(txns.map(t => ({ ...t, accountId: selectedAccountId || undefined })));
        return;
      }
      // CSV flow
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) return;
      const headers = parseRow(lines[0]);
      const rows: CsvRow[] = lines.slice(1).map(line => {
        const vals = parseRow(line);
        const row: CsvRow = {};
        headers.forEach((h, i) => { row[h] = vals[i] ?? ''; });
        return row;
      });
      setCsvHeaders(headers);
      setCsvRows(rows);

      // Auto-detect columns
      const find = (...candidates: string[]) =>
        headers.find(h => candidates.some(c => h.toLowerCase().includes(c))) ?? '';
      const d = find('date', 'posted', 'transaction date');
      const desc = find('description', 'desc', 'memo', 'payee', 'name');
      const amt = find('amount', 'amt', 'transaction amount');
      const inC = find('credit', 'deposit', 'money in');
      const outC = find('debit', 'withdrawal', 'money out');
      const hasSplit = !amt && !!(inC || outC);
      setDateCol(d); setDescCol(desc); setAmtCol(amt);
      setAmtInCol(inC); setAmtOutCol(outC); setSplitAmounts(hasSplit);
    };
    reader.readAsText(file);
  };

  const parseOFX = (text: string): ParsedTransaction[] => {
    const txns: ParsedTransaction[] = [];
    const matches = text.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) ?? [];
    matches.forEach(m => {
      const dateM = m.match(/<DTPOSTED>(.*?)</i);
      const amtM = m.match(/<TRNAMT>(.*?)</i);
      const descM = m.match(/<MEMO>(.*?)</i) ?? m.match(/<NAME>(.*?)</i);
      if (!dateM || !amtM || !descM) return;
      const ds = dateM[1].substring(0, 8);
      txns.push({
        date: new Date(parseInt(ds.slice(0,4)), parseInt(ds.slice(4,6))-1, parseInt(ds.slice(6,8))),
        amount: parseFloat(amtM[1]),
        description: descM[1],
      });
    });
    return txns;
  };

  const parseAmt = (s: string) => parseFloat((s ?? '').replace(/[$,\s]/g, '').replace(/\((.+)\)/, '-$1')) || 0;

  const buildPreview = (): { date: string; desc: string; amt: number }[] =>
    csvRows.slice(0, 5).map(row => {
      const amt = splitAmounts
        ? parseAmt(row[amtInCol] ?? '') - Math.abs(parseAmt(row[amtOutCol] ?? ''))
        : negateAmt ? -parseAmt(row[amtCol]) : parseAmt(row[amtCol]);
      return { date: row[dateCol] ?? '', desc: row[descCol] ?? '', amt };
    });

  const isDuplicate = (desc: string, dateStr: string, amt: number) => {
    if (!skipDuplicates) return false;
    const d = new Date(dateStr).toDateString();
    return existingTransactions.some(t =>
      t.description === desc &&
      Math.abs(t.amount - amt) < 0.01 &&
      new Date(t.date).toDateString() === d
    );
  };

  const handleImport = () => {
    if (!dateCol || !descCol || (!splitAmounts && !amtCol) || (splitAmounts && !amtInCol && !amtOutCol)) {
      alert('Please map Date, Description, and Amount columns.');
      return;
    }
    let skipped = 0;
    const txns: ParsedTransaction[] = [];
    csvRows.forEach(row => {
      const amt = splitAmounts
        ? parseAmt(row[amtInCol] ?? '') - Math.abs(parseAmt(row[amtOutCol] ?? ''))
        : negateAmt ? -parseAmt(row[amtCol]) : parseAmt(row[amtCol]);
      if (amt === 0) return;
      const rawDate = row[dateCol] ?? '';
      let date: Date;
      try { date = new Date(rawDate); if (isNaN(date.getTime())) return; }
      catch { return; }
      const desc = row[descCol] ?? 'Imported transaction';
      if (isDuplicate(desc, rawDate, amt)) { skipped++; return; }
      txns.push({ date, amount: amt, description: desc, accountId: selectedAccountId || undefined });
    });
    onTransactionsParsed(txns);
    if (skipped > 0) alert(`Imported ${txns.length} transactions. Skipped ${skipped} duplicates.`);
    setCsvHeaders([]); setCsvRows([]); setFileName('');
  };

  const colOpts = ['', ...csvHeaders];
  const preview = csvHeaders.length && dateCol && descCol ? buildPreview() : [];

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6 space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Import Bank Transactions</h3>

      {/* Account selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Import to Account</label>
        <select value={selectedAccountId} onChange={e => setSelectedAccountId(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Select an account…</option>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>

      {/* File upload */}
      {!csvHeaders.length ? (
        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 bg-gray-50 transition-colors">
          <div className="text-3xl mb-1">📁</div>
          <p className="text-sm font-medium text-gray-600">Click to upload CSV / OFX / QFX</p>
          <input type="file" accept=".csv,.ofx,.qfx,.qbo,text/csv" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        </label>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
            <span className="text-sm font-medium text-green-800">✓ {fileName} — {csvRows.length} rows</span>
            <button onClick={() => { setCsvHeaders([]); setCsvRows([]); setFileName(''); }}
              className="text-xs text-red-600 hover:text-red-800">Remove</button>
          </div>

          {/* Column mapping */}
          <div>
            <p className="text-sm font-semibold text-gray-800 mb-2">Column Mapping</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Date <span className="text-red-500">*</span></label>
                <select value={dateCol} onChange={e => setDateCol(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {colOpts.map(c => <option key={c} value={c}>{c || '-- select --'}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Description <span className="text-red-500">*</span></label>
                <select value={descCol} onChange={e => setDescCol(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {colOpts.map(c => <option key={c} value={c}>{c || '-- select --'}</option>)}
                </select>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-3">
              <span className="text-xs font-medium text-gray-700">Amount:</span>
              {(['single', 'split'] as const).map(m => (
                <button key={m} onClick={() => setSplitAmounts(m === 'split')}
                  className={`px-3 py-1 text-xs rounded-full border ${(m === 'split') === splitAmounts ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'}`}>
                  {m === 'single' ? 'Single column' : 'Debit/Credit columns'}
                </button>
              ))}
            </div>

            {!splitAmounts ? (
              <div className="mt-2 grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Amount column <span className="text-red-500">*</span></label>
                  <select value={amtCol} onChange={e => setAmtCol(e.target.value)}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {colOpts.map(c => <option key={c} value={c}>{c || '-- select --'}</option>)}
                  </select>
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={negateAmt} onChange={e => setNegateAmt(e.target.checked)} className="rounded" />
                    Negate (flip +/−)
                  </label>
                </div>
              </div>
            ) : (
              <div className="mt-2 grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Credit / Money In</label>
                  <select value={amtInCol} onChange={e => setAmtInCol(e.target.value)}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {colOpts.map(c => <option key={c} value={c}>{c || '-- select --'}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Debit / Money Out</label>
                  <select value={amtOutCol} onChange={e => setAmtOutCol(e.target.value)}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {colOpts.map(c => <option key={c} value={c}>{c || '-- select --'}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Options */}
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={skipDuplicates} onChange={e => setSkipDuplicates(e.target.checked)} className="rounded" />
            Skip duplicates (same date, description, and amount)
          </label>

          {/* Preview */}
          {preview.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-gray-800 mb-2">Preview (first 5 rows)</p>
              <div className="overflow-x-auto rounded border border-gray-200">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 py-1.5 text-left text-gray-600 font-medium">Date</th>
                      <th className="px-2 py-1.5 text-left text-gray-600 font-medium">Description</th>
                      <th className="px-2 py-1.5 text-right text-gray-600 font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-2 py-1.5 text-gray-700">{row.date}</td>
                        <td className="px-2 py-1.5 text-gray-700 max-w-[200px] truncate">{row.desc}</td>
                        <td className={`px-2 py-1.5 text-right font-medium ${row.amt >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {row.amt >= 0 ? '+' : ''}${Math.abs(row.amt).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-500 mt-1">{csvRows.length} total transactions</p>
            </div>
          )}

          <button onClick={handleImport}
            className="w-full bg-blue-600 text-white py-2.5 px-4 rounded-lg hover:bg-blue-700 font-medium text-sm">
            Import {csvRows.length} Transactions
          </button>
        </div>
      )}
    </div>
  );
}
