'use client';

import { useState } from 'react';

interface FileUploadProps {
  onTransactionsParsed: (transactions: ParsedTransaction[]) => void;
  accounts: { id: string; name: string }[];
}

export interface ParsedTransaction {
  date: Date;
  amount: number;
  description: string;
  category?: string;
  accountId?: string;
}

export default function FileUpload({ onTransactionsParsed, accounts }: FileUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<string>('csv');
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');

  const supportedFormats = [
    { value: 'csv', label: 'CSV (Comma Separated Values)', extensions: '.csv' },
    { value: 'ofx', label: 'OFX (Open Financial Exchange)', extensions: '.ofx' },
    { value: 'qfx', label: 'QFX (Quicken Financial Exchange)', extensions: '.qfx' },
    { value: 'qbo', label: 'QBO (QuickBooks Online)', extensions: '.qbo' },
    { value: 'pdf', label: 'PDF Statement', extensions: '.pdf' },
  ];

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const parseCSV = (content: string): ParsedTransaction[] => {
    const lines = content.split('\n');
    const transactions: ParsedTransaction[] = [];

    // Try to detect header row and column positions
    const firstLine = lines[0]?.trim();
    if (!firstLine) return transactions;

    const headers = firstLine.split(',').map(h => h.trim().toLowerCase());
    const dateIndex = headers.findIndex(h => h.includes('date') || h.includes('dt'));
    const amountIndex = headers.findIndex(h => h.includes('amount') || h.includes('amt') || h.includes('value'));
    const descIndex = headers.findIndex(h => h.includes('description') || h.includes('desc') || h.includes('memo') || h.includes('reference'));
    const categoryIndex = headers.findIndex(h => h.includes('category') || h.includes('cat'));

    // Skip header row
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const columns = line.split(',');
      if (columns.length >= 3) {
        const dateStr = columns[dateIndex]?.trim();
        const amountStr = columns[amountIndex]?.trim();
        const descStr = columns[descIndex]?.trim();
        const categoryStr = columns[categoryIndex]?.trim();

        if (!dateStr || !amountStr || !descStr) continue;

        // Try multiple date formats
        let date: Date | null = null;
        const dateFormats = [
          // MM/DD/YYYY
          () => {
            const parts = dateStr.split('/');
            if (parts.length === 3) {
              return new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
            }
            return null;
          },
          // YYYY-MM-DD
          () => new Date(dateStr + 'T00:00:00'),
          // MM-DD-YYYY
          () => {
            const parts = dateStr.split('-');
            if (parts.length === 3) {
              return new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
            }
            return null;
          },
          // DD/MM/YYYY
          () => {
            const parts = dateStr.split('/');
            if (parts.length === 3) {
              return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
            }
            return null;
          }
        ];

        for (const formatFn of dateFormats) {
          date = formatFn();
          if (date && !isNaN(date.getTime())) break;
        }

        const amount = parseFloat(amountStr.replace(/[$,]/g, ''));

        if (date && !isNaN(date.getTime()) && !isNaN(amount)) {
          transactions.push({
            date,
            amount,
            description: descStr,
            category: categoryStr || undefined,
            accountId: selectedAccountId || undefined,
          });
        }
      }
    }

    return transactions;
  };

  const parseOFX = (content: string): ParsedTransaction[] => {
    // Basic OFX parsing - this would need to be more robust for production
    const transactions: ParsedTransaction[] = [];
    const transactionRegex = /<STMTTRN>[\s\S]*?<\/STMTTRN>/g;
    const matches = content.match(transactionRegex);

    if (matches) {
      matches.forEach(match => {
        const dateMatch = match.match(/<DTPOSTED>(.*?)<\/DTPOSTED>/);
        const amountMatch = match.match(/<TRNAMT>(.*?)<\/TRNAMT>/);
        const descMatch = match.match(/<MEMO>(.*?)<\/MEMO>/) || match.match(/<NAME>(.*?)<\/NAME>/);

        if (dateMatch && amountMatch && descMatch) {
          const dateStr = dateMatch[1].substring(0, 8); // YYYYMMDD format
          const date = new Date(
            parseInt(dateStr.substring(0, 4)),
            parseInt(dateStr.substring(4, 6)) - 1,
            parseInt(dateStr.substring(6, 8))
          );
          const amount = parseFloat(amountMatch[1]);
          const description = descMatch[1];

          transactions.push({
            date,
            amount,
            description,
          });
        }
      });
    }

    return transactions;
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);

    try {
      const content = await selectedFile.text();
      let transactions: ParsedTransaction[] = [];

      switch (fileType) {
        case 'csv':
          transactions = parseCSV(content);
          break;
        case 'ofx':
        case 'qfx':
          transactions = parseOFX(content);
          break;
        case 'qbo':
          // QBO parsing would be similar to OFX
          transactions = parseOFX(content);
          break;
        case 'pdf':
          // PDF parsing would require a PDF parsing library
          alert('PDF parsing is not yet implemented. Please use CSV or OFX format.');
          setIsProcessing(false);
          return;
        default:
          alert('Unsupported file format');
          setIsProcessing(false);
          return;
      }

      onTransactionsParsed(transactions);
      setSelectedFile(null);
      // Reset file input
      const fileInput = document.getElementById('file-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

    } catch (error) {
      console.error('Error parsing file:', error);
      alert('Error parsing file. Please check the format and try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Import Bank Transactions</h3>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            File Format
          </label>
          <select
            value={fileType}
            onChange={(e) => setFileType(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {supportedFormats.map((format) => (
              <option key={format.value} value={format.value}>
                {format.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select File
          </label>
          <input
            id="file-upload"
            type="file"
            accept={supportedFormats.find(f => f.value === fileType)?.extensions}
            onChange={handleFileChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {selectedFile && (
            <p className="mt-2 text-sm text-gray-600">
              Selected: {selectedFile.name}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Import to Account
          </label>
          <select
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="">Select an account...</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleUpload}
          disabled={!selectedFile || isProcessing || !selectedAccountId}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isProcessing ? 'Processing...' : 'Upload & Import'}
        </button>
      </div>

      <div className="mt-4 text-sm text-gray-600">
        <p className="font-medium mb-2">Supported formats:</p>
        <ul className="list-disc list-inside space-y-1">
          <li><strong>CSV:</strong> Date, Amount, Description columns</li>
          <li><strong>OFX/QFX:</strong> Standard bank export formats</li>
          <li><strong>QBO:</strong> QuickBooks Online format</li>
          <li><strong>PDF:</strong> Coming soon</li>
        </ul>
      </div>
    </div>
  );
}