'use client';

interface Account {
  id: string;
  name: string;
  balance: number;
  color: string;
}

interface Envelope {
  id: string;
  name: string;
  allocated: number;
  spent: number;
  color: string;
}

interface Transaction {
  id: string;
  amount: number;
  date: Date;
  envelopeId?: string;
}

interface DashboardChartsProps {
  accounts: Account[];
  envelopes: Envelope[];
  transactions: Transaction[];
}

export default function DashboardCharts({ accounts, envelopes, transactions }: DashboardChartsProps) {
  // Calculate spending by envelope
  const envelopeSpending = envelopes.map(env => ({
    name: env.name,
    spent: Math.abs(env.spent),
    allocated: env.allocated,
    color: env.color,
    percentage: env.allocated > 0 ? (Math.abs(env.spent) / env.allocated) * 100 : 0
  })).sort((a, b) => b.spent - a.spent);

  // Calculate total balance across accounts
  const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
  const accountBalances = accounts.map(acc => ({
    name: acc.name,
    balance: acc.balance,
    color: acc.color,
    percentage: totalBalance > 0 ? (acc.balance / totalBalance) * 100 : 0
  }));

  // Calculate spending over time (last 30 days)
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  const recentTransactions = transactions.filter(t => {
    const txDate = t.date instanceof Date ? t.date : new Date(t.date);
    return txDate >= thirtyDaysAgo;
  });

  const dailySpending: { [key: string]: number } = {};
  recentTransactions.forEach(t => {
    const txDate = t.date instanceof Date ? t.date : new Date(t.date);
    const dateKey = txDate.toISOString().split('T')[0];
    if (t.amount < 0) {
      dailySpending[dateKey] = (dailySpending[dateKey] || 0) + Math.abs(t.amount);
    }
  });

  const spendingData = Object.entries(dailySpending)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-7); // Last 7 days

  const maxDailySpending = Math.max(...spendingData.map(([_, amount]) => amount), 1);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      {/* Envelope Spending Chart */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Envelope Spending</h3>
        {envelopeSpending.length > 0 ? (
          <div className="space-y-3">
            {envelopeSpending.slice(0, 5).map((env) => (
              <div key={env.name}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-gray-700">{env.name}</span>
                  <span className="text-gray-600">
                    ${env.spent.toFixed(2)} / ${env.allocated.toFixed(2)}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className={`h-2.5 rounded-full transition-all ${env.color} ${
                      env.percentage > 100 ? 'bg-red-500' : ''
                    }`}
                    style={{ width: `${Math.min(env.percentage, 100)}%` }}
                  ></div>
                </div>
                {env.percentage > 100 && (
                  <p className="text-xs text-red-600 mt-1">Over budget by ${(env.spent - env.allocated).toFixed(2)}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">No envelope spending data yet.</p>
        )}
      </div>

      {/* Account Balances Chart */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Account Balances</h3>
        {accountBalances.length > 0 ? (
          <div className="space-y-3">
            {accountBalances.map((acc) => (
              <div key={acc.name}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-gray-700">{acc.name}</span>
                  <span className={`font-semibold ${acc.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${acc.balance.toFixed(2)}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className={`h-2.5 rounded-full ${acc.color}`}
                    style={{ width: `${Math.abs(acc.percentage)}%` }}
                  ></div>
                </div>
              </div>
            ))}
            <div className="pt-3 border-t border-gray-200 mt-4">
              <div className="flex justify-between">
                <span className="font-semibold text-gray-900">Total Balance</span>
                <span className={`font-bold text-lg ${totalBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${totalBalance.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-gray-500 text-sm">No account data yet.</p>
        )}
      </div>

      {/* Daily Spending Chart (Last 7 Days) */}
      <div className="bg-white rounded-lg shadow-sm border p-6 lg:col-span-2">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Spending (Last 7 Days)</h3>
        {spendingData.length > 0 ? (
          <div className="flex items-end justify-between h-48 gap-2">
            {spendingData.map(([date, amount]) => {
              const height = (amount / maxDailySpending) * 100;
              const dateObj = new Date(date);
              const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
              
              return (
                <div key={date} className="flex-1 flex flex-col items-center">
                  <div className="w-full flex items-end justify-center h-40">
                    <div
                      className="w-full bg-blue-500 rounded-t hover:bg-blue-600 transition-colors relative group"
                      style={{ height: `${height}%`, minHeight: '8px' }}
                    >
                      <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        ${amount.toFixed(2)}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-600 mt-2">{dayName}</div>
                  <div className="text-xs text-gray-400">{dateObj.getDate()}</div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">No spending data for the last 7 days.</p>
        )}
      </div>
    </div>
  );
}
