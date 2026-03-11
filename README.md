# Capsule by NeCloud

A modern, privacy-focused envelope budgeting application built with Next.js, TypeScript, and Tailwind CSS. Capsule helps you manage your finances using the traditional envelope budgeting method in a beautiful, digital format with complete control over your data.

**🔒 Privacy-First Design**: All your financial data is stored locally on your server in encrypted files. No cloud services, no data sharing, complete control over your information.

## Features

### 🎨 Customizable Dashboard
- **Drag & Drop Sections**: Rearrange dashboard sections exactly how you want them
- **Show/Hide Controls**: Toggle visibility of dashboard components
- **5 Summary Cards**: Quick view of Assets, Debt, Balance, Envelopes, and Transactions
- **Analytics Charts**: Income vs Expenses, Budget Alerts, Assets vs Debt breakdown
- **Quick Actions**: One-click access to common tasks
- **Budget Progress**: Visual tracking of monthly spending against budget

### 🔐 Security & Privacy
- **Secure Local Storage**: File-based storage with AES-GCM encryption
- **User Authentication**: Secure sign-up and login with password hashing
- **No Cloud Dependencies**: Your data never leaves your server

### 💰 Smart Money Management
- **Envelope Budgeting**: Create and manage budget envelopes for different spending categories
- **Multiple Account Support**: Track checking, savings, credit cards, mortgages, loans, and investments
- **Account Normalization**: Liabilities (credit cards, loans) automatically display as negative balances
- **Net Worth Tracking**: Automatic calculation of assets minus debt
- **Get Paid Feature**: Automatically distribute income across envelopes

### 📊 Transaction Management
- **Multiple Input Methods**:
  - **Manual Entry**: Add individual transactions with full details
  - **File Import**: Import from bank exports (CSV, OFX, QFX, QBO)
  - **Get Paid**: Record income with automatic envelope distribution
- **Transaction Editing**: Full edit capabilities with real-time updates
- **Recent History**: Quick view of latest transactions
- **Smart Filtering**: View transactions by account, envelope, or date range

### 📈 Analytics & Insights
- **Income vs Expenses**: Monthly income and spending comparison
- **Budget Alerts**: Notifications for envelopes over 80% or overspent
- **Daily Spending Chart**: 7-day spending visualization
- **Envelope Progress**: Color-coded spending progress for each category
- **Account Balances**: Visual breakdown of all account balances

### 🎨 Beautiful Design
- **Capsule Branding**: Modern cloud-themed design with professional color palette
- **Responsive Layout**: Seamless experience on desktop, tablet, and mobile
- **Customizable Colors**: Choose colors for envelopes and visual organization
- **Interactive Elements**: Clickable cards, hover effects, and smooth transitions
- **Data Export**: Export to CSV or JSON formats for backup or analysis

## Brand Colors

- **Primary Blue**: #1E73BE - Main brand color
- **Finance Green**: #28A745 - Positive balances and income
- **Cloud Blue**: #A7D8F8 - Secondary accents
- **Dark Navy**: #0F2C4C - Text and headers
- **Neutral Gray**: #F4F4F4 - Backgrounds

## Getting Started

### Container Installation (Recommended for Rocky Linux + Cockpit)

**Option 1: Clone and Deploy** (works for private/public repos)

```bash
git clone https://github.com/nmemmert/budget.git capsule-budget
cd capsule-budget
./deploy.sh
```

**Option 2: One-Line Install** (public repos only)

```bash
curl -fsSL https://raw.githubusercontent.com/nmemmert/budget/master/install.sh | bash
```

**Access at:** `http://localhost:7654` or `http://your-device-ip:7654`

### Rocky Linux + Cockpit + Podman

```bash
sudo dnf install -y podman podman-compose cockpit cockpit-podman git
sudo systemctl enable --now cockpit.socket

git clone https://github.com/nmemmert/budget.git capsule-budget
cd capsule-budget
./deploy.sh
```

Manage the container in Cockpit at `https://your-server:9090` under **Podman Containers**.

### Manual Installation (Development)

If you want to run from source:

1. Clone the repository:
```bash
git clone https://github.com/nmemmert/budget.git
cd budget
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:7654](http://localhost:7654) in your browser

### First Time Setup

1. **Create Account**: Click "Sign Up" to create your secure account
2. **Setup Wizard**: Complete the guided setup:
   - Add your first account (checking, savings, etc.)
   - Create initial budget envelopes with default budgets
   - Configure income allocation rules
3. **Customize Dashboard**: Click the ⚙️ Customize button to:
   - Drag and drop sections to rearrange
   - Show or hide dashboard components
   - Create your perfect financial overview

## Dashboard Customization

### Available Sections

1. **Summary Cards** - Quick overview of total assets, debt, balance, envelope count, and transaction count
2. **Analytics Charts** - Six detailed charts including income/expenses, alerts, and spending patterns
3. **Budget Progress** - Visual progress bar showing monthly budget utilization
4. **Quick Actions** - Fast access buttons for common tasks
5. **Recent Transactions** - Latest 5 transactions with edit/delete options

### How to Customize

- Click **⚙️ Customize** at the top of the dashboard
- **Drag & Drop**: Click and hold the ⋮⋮ handle to drag sections
- **Up/Down Arrows**: Use ▲ ▼ buttons for precise positioning
- **Toggle Visibility**: Check/uncheck boxes to show or hide sections
- Your preferences are automatically saved

## Storage System

This application uses a **local file-based storage system** instead of cloud databases:

- All user data stored in `/data` directory as encrypted JSON files
- User credentials hashed with SHA-256
- Budget data encrypted with AES-GCM encryption
- Complete data portability and privacy

For detailed information about the storage system, see [FILE_STORAGE.md](./FILE_STORAGE.md).

## Available Scripts

- `npm run dev` - Start the development server on port 7654
- `npm run build` - Build the project for production
- `npm run start` - Start the production server
- `npm run lint` - Run ESLint for code quality checks

## Project Structure

```
src/
├── app/
│   ├── layout.tsx           # Root layout with Capsule branding
│   ├── page.tsx             # Main dashboard with customization
│   ├── globals.css          # Global styles with brand colors
│   └── api/
│       ├── auth/            # Authentication endpoints
│       └── data/            # Data persistence endpoints
├── components/
│   ├── AccountManagement.tsx    # Account CRUD operations
│   ├── DashboardCharts.tsx      # Analytics visualizations
│   ├── DataInput.tsx            # Transaction entry forms
│   ├── EnvelopeCreate.tsx       # Envelope creation
│   ├── EnvelopeEdit.tsx         # Envelope editing
│   ├── GetPaid.tsx              # Income distribution
│   ├── SetupWizard.tsx          # First-time setup flow
│   ├── TransactionEdit.tsx      # Transaction editing
│   └── ...                      # Additional components
├── lib/
│   ├── authService.ts       # Authentication logic
│   ├── dataService.ts       # Data persistence layer
│   ├── fileStorage.ts       # Encrypted file storage
│   └── crypto.ts            # Encryption utilities
data/                         # User data storage (gitignored)
public/
├── capsule-icon.svg         # App favicon
└── images/
    └── capsule-logo.svg     # Brand logo
```

## Technologies Used

- **Next.js 16** - React framework with App Router and Turbopack
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS 4** - Utility-first CSS framework with custom properties
- **React 19** - UI library with modern hooks
- **Node.js Crypto** - AES-GCM encryption and SHA-256 password hashing
- **ESLint** - Code quality and consistency

## Key Features in Detail

### Envelope Budgeting System
The envelope method divides your income into categories (envelopes), each with a budget allocation. When you spend money, it's deducted from the appropriate envelope, helping you stay within your budget limits.

### Automatic Income Distribution
The "Get Paid" feature automatically splits your paycheck across envelopes based on percentages you set during setup. For example:
- Rent: 40%
- Groceries: 15%
- Savings: 20%
- etc.

### Visual Progress Tracking
Each envelope shows:
- Allocated amount (your budget)
- Spent amount (what you've used)
- Remaining balance
- Progress bar with color coding (green → yellow → red as you approach limits)

### Smart Alerts
Get notified when:
- An envelope reaches 80% of its budget
- An envelope is overspent
- Your daily spending exceeds normal patterns

## How to Use

### Dashboard Navigation

The dashboard provides a complete overview of your finances:

- **Summary Cards**: Click any card to navigate to the detailed view
  - Assets → View all asset accounts
  - Debt → View all liability accounts
  - Balance → View all accounts
  - Envelopes → Manage budget envelopes
  - Transactions → View transaction history

- **Analytics**: Monitor your financial health with real-time charts
  - Income vs Expenses (current month)
  - Budget Alerts (overspent or near-limit envelopes)
  - Assets vs Debt breakdown with Net Worth
  - Envelope spending progress
  - Account balance distribution
  - Daily spending trends (last 7 days)

### Managing Money

1. **Record Income**:
   - Click "💰 Get Paid" button
   - Enter amount and select deposit account
   - Funds are automatically distributed to envelopes based on allocation percentages

2. **Track Expenses**:
   - Use "Manual Entry" for individual transactions
   - Import bank files for bulk transaction entry
   - Assign each expense to an envelope for tracking

3. **Monitor Budgets**:
   - View envelope spending progress in real-time
   - Get alerts when approaching or exceeding budget limits
   - Track monthly spending against allocated amounts

### Account Types

Capsule supports multiple account types with automatic balance normalization:

- **Assets** (positive balances):
  - Checking accounts
  - Savings accounts
  - Investment accounts

- **Liabilities** (negative balances):
  - Credit cards
  - Mortgages
  - Loans

Your Net Worth is automatically calculated as: Total Assets - Total Debt

## Data Import

### Supported File Formats

- **CSV**: Comma-separated values with columns: Date, Amount, Description, Category (optional)
- **OFX/QFX**: Standard bank export formats from most financial institutions
- **QBO**: QuickBooks Online format
- **PDF**: Coming soon (statement parsing)

### CSV Format Example
```csv
Date,Amount,Description,Category
2024-01-15,-25.50,Weekly groceries,Groceries
2024-01-16,-12.00,Gas station,Transportation
2024-01-17,1500.00,Salary deposit,Income
```

## Advanced Features

### Transaction Editing
- Click the edit icon (pencil) next to any transaction to modify its details
- Update amount, description, date, and envelope assignment
- Changes automatically update envelope spending calculations

### Envelope Management
- Click "Add Envelope" to create new budget categories
- Choose from multiple colors for visual organization
- Set custom budget allocations for each envelope

### Data Export
- Export all transactions and envelopes to CSV for spreadsheet analysis
- Export to JSON format for data backup or integration
- Includes complete transaction history and envelope details

## Deployment

### Self-Hosted Deployment (Recommended)

Capsule is designed for self-hosted deployment on Rocky Linux, ZimaOS, and similar platforms.

**Quick Deploy:**
```bash
./deploy.sh
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed Podman/Docker deployment instructions.

**Features:**
- Podman/Docker containerization for easy deployment
- Persistent data storage in `./data` directory
- Health checks and auto-restart
- Encrypted local storage (no cloud required)

**Access:**
- Default port: 7654
- Local: `http://localhost:7654`
- Network: `http://your-device-ip:7654`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

This project is licensed under the MIT License.
