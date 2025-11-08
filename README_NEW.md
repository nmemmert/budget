# Envelope Budgeting App

A modern, secure envelope budgeting application built with Next.js, React, Firebase, and Tailwind CSS. This app helps you manage your finances using the envelope budgeting method with support for multiple accounts, automatic income allocation, and secure data encryption.

## ✨ Features

- 🏦 **Multi-Account Support**: Track checking, savings, credit cards, mortgages, investments, and loans
- 💰 **Envelope Budgeting**: Allocate funds to different spending categories (envelopes)
- 📊 **Transaction Management**: Import from CSV/OFX files or enter manually
- 💵 **Automated Income Allocation**: Set up rules to automatically distribute income to envelopes
- 🔐 **Secure Data Storage**: All data encrypted using AES-GCM encryption
- 🔄 **Real-time Sync**: Data synced to Firebase Firestore
- 📱 **Responsive Design**: Works on desktop, tablet, and mobile devices
- 📥 **Data Export**: Export your data to CSV or JSON format
- 🎨 **Customizable**: Color-code your accounts and envelopes

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn/pnpm
- A Firebase project with Firestore enabled
- Modern web browser with JavaScript enabled

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd budget
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up Firebase**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Create a new project or use an existing one
   - Enable Firebase Authentication (Email/Password provider)
   - Enable Firestore Database
   - Get your Firebase configuration from Project Settings > General

4. **Configure environment variables**
```bash
cp .env.local.example .env.local
```

Edit `.env.local` and add your Firebase configuration:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_ENCRYPTION_KEY=your_secure_random_key_here
```

**Generate a strong encryption key:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

5. **Deploy Firestore security rules**
```bash
firebase deploy --only firestore:rules
```

6. **Run the development server**
```bash
npm run dev
```

Open [http://localhost:7654](http://localhost:7654) in your browser.

## 📖 Usage Guide

### First-Time Setup

1. **Sign Up**: Create an account using email and password
2. **Setup Wizard**: Follow the guided setup to:
   - Add your financial accounts
   - Create budget envelopes
   - Set up income allocation rules
   - Configure default paycheck amounts

### Managing Accounts

- Navigate to **Accounts** tab
- Add accounts with starting balances
- Accounts automatically update based on transactions
- Mark accounts as active/inactive

### Creating Envelopes

- Navigate to **Envelopes** tab
- Create envelopes for different spending categories
- Set monthly budget allocations
- Assign envelopes to specific accounts
- Configure automatic income allocation (percentage or fixed amount)

### Recording Transactions

**Manual Entry**:
- Use the transaction form on the dashboard
- Enter amount, description, date
- Assign to envelope and account
- Mark as income or expense

**File Import**:
- Support for CSV, OFX, QFX, QBO formats
- Automatic parsing of date, amount, and description
- Bulk import for bank statements

**Get Paid Feature**:
- Quick paycheck entry with one click
- Automatic distribution to envelopes based on rules
- Choose proportional, equal, or custom distribution
- Save default paycheck amounts for faster entry

## 🏗️ Project Structure

```
budget/
├── src/
│   ├── app/
│   │   ├── globals.css          # Global styles
│   │   ├── layout.tsx           # Root layout with error boundary
│   │   └── page.tsx             # Main dashboard component
│   ├── components/
│   │   ├── AccountManagement.tsx # Account CRUD operations
│   │   ├── AuthModal.tsx         # Authentication UI
│   │   ├── DataExport.tsx        # Export functionality
│   │   ├── DataInput.tsx         # Transaction input selector
│   │   ├── EnvelopeCreate.tsx    # Create new envelopes
│   │   ├── EnvelopeEdit.tsx      # Edit/delete envelopes
│   │   ├── ErrorBoundary.tsx     # Error handling component
│   │   ├── FileUpload.tsx        # File import functionality
│   │   ├── GetPaid.tsx           # Paycheck recording
│   │   ├── ManualEntry.tsx       # Manual transaction entry
│   │   ├── SetupWizard.tsx       # First-time setup flow
│   │   └── TransactionEdit.tsx   # Edit transactions
│   └── lib/
│       ├── crypto.ts             # Encryption utilities
│       ├── dataService.ts        # Firestore data layer
│       └── firebase.ts           # Firebase initialization
├── .env.local.example            # Environment variables template
├── firestore.rules               # Firestore security rules
└── package.json                  # Dependencies and scripts
```

## 🔧 Technology Stack

- **Next.js 16**: React framework with App Router
- **React 19**: UI library
- **Firebase**: Authentication and Firestore database
- **Tailwind CSS 4**: Utility-first CSS framework
- **TypeScript**: Type-safe JavaScript
- **Web Crypto API**: Client-side encryption

## 🔒 Security Features

- 🔐 **Client-Side Encryption**: All sensitive data encrypted before sending to Firestore
- 🔑 **Secure Authentication**: Firebase Authentication with email/password
- 🛡️ **Firestore Security Rules**: Server-side access control
- 🚫 **No Plain Text Storage**: Financial data never stored unencrypted
- 🔒 **User-Specific Keys**: Each user's encryption key is separate

## 🛠️ Development

### Available Scripts

```bash
npm run dev      # Start development server on port 7654
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

### Docker Support

Build and run with Docker:
```bash
docker-compose up --build
```

## 🐛 Troubleshooting

### TypeScript Errors

```bash
npm install --save-dev @types/node @types/react @types/react-dom
```

### Firebase Connection Issues

- Verify environment variables are set correctly
- Check Firebase project configuration
- Ensure Firestore is enabled
- Verify authentication provider is enabled

### Build Errors

```bash
rm -rf .next
npm run build
```

## 📝 Recent Improvements

- ✅ Fixed transaction date serialization for Firestore
- ✅ Implemented automatic envelope spending calculation
- ✅ Added transaction delete functionality with confirmations
- ✅ Fixed transaction ID generation to prevent collisions
- ✅ Removed duplicate UI elements in GetPaid component
- ✅ Added error boundary for graceful error handling
- ✅ Fixed orphaned transactions when envelopes are deleted
- ✅ Added envelope delete confirmation with warning
- ✅ Improved date handling across components

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is private and not licensed for public use.

## 📧 Support

For issues or questions, please contact the repository owner.
