# Envelope Budgeting App

A modern web-based envelope budgeting application built with Next.js, TypeScript, and Tailwind CSS. This app helps you manage your finances using the traditional envelope budgeting method in a digital format.

**🔒 Privacy-First Design**: All your financial data is stored locally on your server in encrypted files. No cloud services, no data sharing, complete control over your information.

## Features

- **🔐 Secure Local Storage**: File-based storage with AES-GCM encryption
- **👤 User Authentication**: Secure sign-up and login with password hashing
- **💰 Envelope Management**: Create and manage budget envelopes for different spending categories
- **📊 Visual Progress Tracking**: See spending progress with color-coded progress bars
- **💳 Account Management**: Support for multiple accounts (checking, savings, credit cards, etc.)
- **📝 Transaction History**: Track and view recent transactions
- **📥 Data Input Options**:
  - **Manual Entry**: Add individual transactions with amount, description, date, and envelope assignment
  - **File Import**: Import transactions from bank exports (CSV, OFX, QFX, QBO formats)
- **✏️ Transaction Editing**: Edit existing transactions with full details
- **🎨 Envelope Creation**: Add new budget envelopes with custom colors and allocations
- **💸 Get Paid Feature**: Automatically distribute income across envelopes
- **📤 Data Export**: Export all data to CSV or JSON formats for backup or analysis
- **📈 Budget Overview**: Monitor total allocated, spent, and remaining amounts
- **📱 Responsive Design**: Works seamlessly on desktop and mobile devices

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd budget
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.local.example .env.local
```

4. Generate a secure encryption key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

5. Update `.env.local` with your encryption key:
```bash
ENCRYPTION_KEY=your-generated-key-here
```

6. Run the development server:
```bash
npm run dev
```

7. Open [http://localhost:7654](http://localhost:7654) in your browser.

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
│   ├── layout.tsx      # Root layout component
│   ├── page.tsx        # Main budgeting dashboard
│   └── globals.css     # Global styles
public/                 # Static assets
```

## Technologies Used

- **Next.js 16** - React framework with App Router and API routes
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS 4** - Utility-first CSS framework
- **React 19** - UI library
- **Node.js Crypto** - Encryption and password hashing
- **ESLint** - Code linting

## How to Use

### First Time Setup

1. **Create Account**: Open the app and click "Sign Up" to create your account
2. **Setup Wizard**: Follow the guided setup to:
   - Add your first account (checking, savings, etc.)
   - Create initial budget envelopes
   - Set income allocation rules
3. **Start Budgeting**: Begin tracking your income and expenses

### Daily Use

1. **View Dashboard**: The main page shows your budget overview and envelope cards
2. **Add Transactions**:
   - **Manual Entry**: Click "Manual Entry" and fill in transaction details
   - **File Import**: Click "Import from File", select your bank export format, and upload the file
   - **Get Paid**: Use the "Get Paid" feature to record income and automatically distribute to envelopes
3. **Monitor Envelopes**: Each envelope displays allocated amount, spent amount, and remaining balance
4. **Track Progress**: Visual progress bars show spending percentage for each envelope
5. **View Transactions**: Recent transactions are listed with envelope associations
6. **Manage Accounts**: Switch between different accounts to track multiple bank accounts, credit cards, etc.

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

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

This project is licensed under the MIT License.
