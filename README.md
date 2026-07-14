# Capsule by NeCloud

A privacy-focused envelope budgeting app built with Next.js, TypeScript, and Tailwind CSS. All data is stored encrypted on your own server — no cloud, no tracking, no subscriptions.

## Quick Install

One command on any Linux cloud server (Ubuntu, Debian, Rocky, RHEL):

```bash
curl -fsSL https://raw.githubusercontent.com/nmemmert/budget/master/install.sh | sudo bash
```

This will:
- Install Node.js 20 if needed (via NodeSource)
- Clone the repo to `/opt/capsule`
- Build the app
- Create and start a `capsule` systemd service on port **7654**

Re-run the same command to upgrade in place.

**After install, open:** `http://your-server-ip:7654`

### Useful commands

```bash
systemctl status capsule       # check if running
systemctl restart capsule      # restart
journalctl -u capsule -f       # view logs
```

---

## Features

### Security & Privacy
- **Encrypted local storage** — AES-GCM encryption, data never leaves your server
- **bcrypt password hashing** — cost factor 12
- **Two-factor authentication (TOTP)** — enable in Settings → Password & Security; works with Google Authenticator, Authy, or any TOTP app
- **Session tokens** — secure session management

### Envelope Budgeting
- Create envelopes for spending categories with budget limits
- Overspend warnings (red ring + banner when over budget)
- Color-coded progress bars (green → yellow → red)
- Auto-categorization rules — keyword-based, with a "Run Rules Now" button to apply to existing transactions

### Accounts & Transactions
- Multiple account types: checking, savings, credit cards, mortgages, loans, investments
- Liabilities display as negative balances; net worth calculated automatically
- Import from CSV, OFX, QFX, or QBO bank exports (with duplicate detection)
- Manual entry and recurring transactions
- Edit, delete, and filter transactions

### Get Paid
- Record income and auto-distribute across envelopes by percentage
- Paycheck schedule with next payday preview (weekly, biweekly, semi-monthly, monthly)

### Backup & Restore
- **Settings → Backup & Restore**
- Download a `.tar.gz` of all server data (users, sessions, all budget data)
- Upload a backup to restore — works for migrating to a new server
- Previous data is kept as `.bak` before any restore

### Account Sharing
- Share individual accounts with other registered users (read-only view)

### Dashboard
- Customizable layout (drag & drop, show/hide sections)
- Income vs Expenses, Budget Alerts, Net Worth, Envelope Spending charts
- Mobile bottom tab bar

---

## Migrating to a New Server

1. On the old server: **Settings → Backup & Restore → Download Backup**
2. On the new server: run the install command above
3. Sign in, then go to **Settings → Backup & Restore → Choose Backup File** and upload the `.tar.gz`
4. You'll be signed out — sign back in with your original credentials

---

## Data Storage

Everything lives in `/opt/capsule/data/`:

| File | Contents |
|------|----------|
| `users.json` | Email + hashed passwords, 2FA secrets |
| `sessions.json` | Active login sessions |
| `{userId}.json` | Each user's budget data (AES-GCM encrypted) |
| `shares.json` | Account sharing records |

Back up this directory to protect your data. No external database required.

---

## Development

```bash
git clone https://github.com/nmemmert/budget.git
cd budget
npm install
npm run dev        # http://localhost:7654
```

```bash
npm run build      # production build
npm run start      # production server
npm run lint       # ESLint
```

---

## Tech Stack

- **Next.js** (App Router) + **TypeScript**
- **Tailwind CSS v4**
- **Node.js `crypto`** — AES-GCM encryption, TOTP (no external crypto deps)
- **bcryptjs** — password hashing

---

## License

MIT
