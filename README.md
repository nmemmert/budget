# Envelope Budgeting App

A modern web-based envelope budgeting application built with Next.js, TypeScript, and Tailwind CSS. This app helps you manage your finances using the traditional envelope budgeting method in a digital format.

## Features

- **Envelope Management**: Create and manage budget envelopes for different spending categories
- **Visual Progress Tracking**: See spending progress with color-coded progress bars
- **Transaction History**: Track and view recent transactions
- **Data Input Options**:
  - **Manual Entry**: Add individual transactions with amount, description, date, and envelope assignment
  - **File Import**: Import transactions from bank exports (CSV, OFX, QFX, QBO formats)
- **Transaction Editing**: Edit existing transactions with full details
- **Envelope Creation**: Add new budget envelopes with custom colors and allocations
- **Data Export**: Export all data to CSV or JSON formats for backup or analysis
- **Budget Overview**: Monitor total allocated, spent, and remaining amounts
- **Responsive Design**: Works seamlessly on desktop and mobile devices

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

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:7654](http://localhost:7654) in your browser.

## Available Scripts

- `npm run dev` - Start the development server
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

- **Next.js 16** - React framework with App Router
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS** - Utility-first CSS framework
- **React 19** - UI library
- **ESLint** - Code linting

## How to Use

1. **View Dashboard**: The main page shows your budget overview and envelope cards
2. **Add Transactions**:
   - **Manual Entry**: Click "Manual Entry" and fill in transaction details
   - **File Import**: Click "Import from File", select your bank export format, and upload the file
3. **Monitor Envelopes**: Each envelope displays allocated amount, spent amount, and remaining balance
4. **Track Progress**: Visual progress bars show spending percentage for each envelope
5. **View Transactions**: Recent transactions are listed with envelope associations

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
