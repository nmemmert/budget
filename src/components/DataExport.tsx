'use client';

import { useState } from 'react';

interface Envelope {
  id: string;
  name: string;
  allocated: number;
  spent: number;
  color: string;
}

interface Transaction {
  id: string;
  envelopeId?: string;
  amount: number;
  description: string;
  date: Date;
}

interface DataExportProps {
  envelopes: Envelope[];
  transactions: Transaction[];
}

export default function DataExport({ envelopes, transactions }: DataExportProps) {
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');

  const exportToCSV = () => {
    // Export transactions
    const transactionHeaders = ['Date', 'Description', 'Amount', 'Envelope', 'Type'];
    const transactionRows = transactions.map(t => {
      const envelope = envelopes.find(e => e.id === t.envelopeId);
      return [
        t.date.toISOString().split('T')[0],
        t.description,
        t.amount.toFixed(2),
        envelope?.name || 'Unassigned',
        t.amount >= 0 ? 'Income' : 'Expense'
      ];
    });

    // Export envelopes
    const envelopeHeaders = ['Name', 'Allocated', 'Spent', 'Remaining', 'Color'];
    const envelopeRows = envelopes.map(e => [
      e.name,
      e.allocated.toFixed(2),
      e.spent.toFixed(2),
      (e.allocated - e.spent).toFixed(2),
      e.color
    ]);

    const csvContent = [
      'TRANSACTIONS',
      transactionHeaders.join(','),
      ...transactionRows.map(row => row.map(cell => `"${cell}"`).join(',')),
      '',
      'ENVELOPES',
      envelopeHeaders.join(','),
      ...envelopeRows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    downloadFile(csvContent, 'budget-data.csv', 'text/csv');
  };

  const exportToJSON = () => {
    const data = {
      exportDate: new Date().toISOString(),
      envelopes,
      transactions: transactions.map(t => ({
        ...t,
        date: t.date.toISOString()
      }))
    };

    const jsonContent = JSON.stringify(data, null, 2);
    downloadFile(jsonContent, 'budget-data.json', 'application/json');
  };

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExport = () => {
    if (exportFormat === 'csv') {
      exportToCSV();
    } else {
      exportToJSON();
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Export Data</h3>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Export Format
          </label>
          <div className="flex space-x-4">
            <label className="flex items-center">
              <input
                type="radio"
                checked={exportFormat === 'csv'}
                onChange={() => setExportFormat('csv')}
                className="mr-2"
              />
              <span className="text-sm text-gray-700">CSV (Spreadsheet)</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                checked={exportFormat === 'json'}
                onChange={() => setExportFormat('json')}
                className="mr-2"
              />
              <span className="text-sm text-gray-700">JSON (Data)</span>
            </label>
          </div>
        </div>

        <div className="bg-blue-50 p-4 rounded-md">
          <h4 className="text-sm font-medium text-blue-800 mb-2">What gets exported:</h4>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• All transactions with dates, amounts, and descriptions</li>
            <li>• Envelope assignments for each transaction</li>
            <li>• All envelope details (allocated amounts, spending, colors)</li>
            <li>• Export timestamp for reference</li>
          </ul>
        </div>

        <button
          onClick={handleExport}
          className="w-full bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          Export Data ({exportFormat.toUpperCase()})
        </button>
      </div>

      <div className="mt-4 text-sm text-gray-600">
        <p className="font-medium mb-2">File formats:</p>
        <ul className="list-disc list-inside space-y-1">
          <li><strong>CSV:</strong> Compatible with Excel, Google Sheets, and most spreadsheet applications</li>
          <li><strong>JSON:</strong> Structured data format for developers or data analysis tools</li>
        </ul>
      </div>
    </div>
  );
}