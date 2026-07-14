'use client';

interface Account {
  id: string;
  name: string;
  type: 'checking' | 'savings' | 'credit_card' | 'mortgage' | 'investment' | 'loan';
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
  visibleCharts?: {
    incomeExpenses: boolean;
    budgetAlerts: boolean;
    assetsDebt: boolean;
    envelopeSpending: boolean;
    accountBalances: boolean;
    dailySpending: boolean;
  };
}

const assetTypes: Account['type'][] = ['checking', 'savings', 'investment'];
const debtTypes: Account['type'][] = ['credit_card', 'mortgage', 'loan'];

export default function DashboardCharts({ accounts, envelopes, transactions, visibleCharts = {
  incomeExpenses: true,
  budgetAlerts: true,
  assetsDebt: true,
  envelopeSpending: true,
  accountBalances: true,
  dailySpending: true,
} }: DashboardChartsProps) {
  // Separate accounts into assets and debt
  const assetAccounts = accounts.filter(acc => assetTypes.includes(acc.type));
  const debtAccounts = accounts.filter(acc => debtTypes.includes(acc.type));
  const totalAssets = assetAccounts.reduce((sum, acc) => sum + acc.balance, 0);
  const totalDebt = Math.abs(debtAccounts.reduce((sum, acc) => sum + acc.balance, 0));

  // Calculate spending by envelope
  const envelopeSpending = envelopes.map(env => ({
    name: env.name,
    spent: Math.abs(env.spent),
    allocated: env.allocated,
    color: env.color,
    percentage: env.allocated > 0 ? (Math.abs(env.spent) / env.allocated) * 100 : 0
  })).sort((a, b) => b.spent - a.spent);

  // Find envelopes with alerts (overspent or near limit >80%)
  const envelopeAlerts = envelopes.filter(env => {
    const percentage = env.allocated > 0 ? (Math.abs(env.spent) / env.allocated) * 100 : 0;
    return percentage >= 80;
  }).sort((a, b) => {
    const aPerc = a.allocated > 0 ? (Math.abs(a.spent) / a.allocated) * 100 : 0;
    const bPerc = b.allocated > 0 ? (Math.abs(b.spent) / b.allocated) * 100 : 0;
    return bPerc - aPerc;
  });

  // Calculate total balance across accounts
  const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
  const accountBalances = accounts.map(acc => ({
    name: acc.name,
    balance: acc.balance,
    color: acc.color,
    percentage: totalBalance > 0 ? (acc.balance / totalBalance) * 100 : 0
  }));

  // Calculate income vs expenses (this month)
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const monthTransactions = transactions.filter(t => {
    const txDate = t.date instanceof Date ? t.date : new Date(t.date);
    return txDate >= monthStart && txDate <= monthEnd;
  });

  const totalIncome = monthTransactions
    .filter(t => t.amount > 0 && !t.envelopeId)
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = monthTransactions
    .filter(t => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const netIncome = totalIncome - totalExpenses;

  // Calculate spending over time (last 30 days)
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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Income vs Expenses Card */}
      {visibleCharts.incomeExpenses && (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Income vs Expenses (This Month)</h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Income</span>
            <span className="text-xl font-bold text-green-600">${totalIncome.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Expenses</span>
            <span className="text-xl font-bold text-red-600">${totalExpenses.toFixed(2)}</span>
          </div>
          <div className="pt-3 border-t border-gray-200">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-gray-900">Net Income</span>
              <span className={`text-xl font-bold ${netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${netIncome.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Budget Alerts Card */}
      {visibleCharts.budgetAlerts && (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Budget Alerts</h3>
        {envelopeAlerts.length > 0 ? (
          <div className="space-y-2">
            {envelopeAlerts.slice(0, 5).map((env) => {
              const percentage = env.allocated > 0 ? (Math.abs(env.spent) / env.allocated) * 100 : 0;
              const isOverspent = percentage > 100;
              return (
                <div
                  key={env.id}
                  className={`p-3 rounded-lg border-l-4 ${
                    isOverspent
                      ? 'bg-red-50 border-red-500'
                      : 'bg-yellow-50 border-yellow-500'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className={`font-medium ${isOverspent ? 'text-red-900' : 'text-yellow-900'}`}>
                        {env.name}
                      </p>
                      <p className={`text-sm ${isOverspent ? 'text-red-700' : 'text-yellow-700'}`}>
                        {isOverspent
                          ? `Over budget by $${(Math.abs(env.spent) - env.allocated).toFixed(2)}`
                          : `${percentage.toFixed(0)}% of budget used`}
                      </p>
                    </div>
                    <span className={`text-sm font-semibold ${isOverspent ? 'text-red-600' : 'text-yellow-600'}`}>
                      {percentage.toFixed(0)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">✓ All envelopes are within budget</p>
        )}
      </div>
      )}

      {/* Assets & Debt Summary */}
      {visibleCharts.assetsDebt && (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Assets vs Debt</h3>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="font-medium text-gray-700">Total Assets</span>
              <span className="font-bold text-green-600">${totalAssets.toFixed(2)}</span>
            </div>
            <div className="text-xs text-gray-500 ml-1">
              {assetAccounts.map(acc => acc.name).join(', ') || 'None'}
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="font-medium text-gray-700">Total Debt</span>
              <span className="font-bold text-red-600">${totalDebt.toFixed(2)}</span>
            </div>
            <div className="text-xs text-gray-500 ml-1">
              {debtAccounts.map(acc => acc.name).join(', ') || 'None'}
            </div>
          </div>
          <div className="pt-3 border-t border-gray-200">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-gray-900">Net Worth</span>
              <span className={`text-lg font-bold ${totalAssets - totalDebt >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${(totalAssets - totalDebt).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Envelope Spending Chart */}
      {visibleCharts.envelopeSpending && (
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
      )}

      {/* Account Balances Chart */}
      {visibleCharts.accountBalances && (
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
      )}

      {/* Monthly Spending History (Last 6 Months) */}
      <div className="bg-white rounded-lg shadow-sm border p-6 lg:col-span-2">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Spending History (Last 6 Months)</h3>
        {(() => {
          const months = Array.from({ length: 6 }, (_, i) => {
            const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
            return { year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }) };
          });
          const monthlyData = months.map(m => {
            const start = new Date(m.year, m.month, 1);
            const end = new Date(m.year, m.month + 1, 0, 23, 59, 59);
            const income = transactions.filter(t => {
              const d = t.date instanceof Date ? t.date : new Date(t.date);
              return t.amount > 0 && !t.envelopeId && d >= start && d <= end;
            }).reduce((s, t) => s + t.amount, 0);
            const spent = transactions.filter(t => {
              const d = t.date instanceof Date ? t.date : new Date(t.date);
              return t.amount < 0 && d >= start && d <= end;
            }).reduce((s, t) => s + Math.abs(t.amount), 0);
            return { ...m, income, spent };
          });
          const maxVal = Math.max(...monthlyData.map(m => Math.max(m.income, m.spent)), 1);
          return monthlyData.some(m => m.income > 0 || m.spent > 0) ? (
            <div>
              <div className="flex items-end justify-between h-40 gap-3">
                {monthlyData.map(m => (
                  <div key={m.label} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex items-end gap-0.5 h-32">
                      <div className="flex-1 bg-green-400 rounded-t hover:bg-green-500 transition-colors relative group"
                        style={{ height: `${(m.income / maxVal) * 100}%`, minHeight: m.income > 0 ? '4px' : '0' }}>
                        {m.income > 0 && <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs py-0.5 px-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap">${m.income.toFixed(0)}</div>}
                      </div>
                      <div className="flex-1 bg-red-400 rounded-t hover:bg-red-500 transition-colors relative group"
                        style={{ height: `${(m.spent / maxVal) * 100}%`, minHeight: m.spent > 0 ? '4px' : '0' }}>
                        {m.spent > 0 && <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs py-0.5 px-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap">${m.spent.toFixed(0)}</div>}
                      </div>
                    </div>
                    <span className="text-xs text-gray-500">{m.label}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-4 mt-3 justify-center text-xs text-gray-600">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-400 inline-block" />Income</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-400 inline-block" />Expenses</span>
              </div>
            </div>
          ) : <p className="text-gray-500 text-sm">No data yet. Add transactions to see history.</p>;
        })()}
      </div>

      {/* Daily Spending Chart (Last 7 Days) */}
      {visibleCharts.dailySpending && (
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
      )}
    </div>
  );
}
