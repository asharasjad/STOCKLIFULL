# InventoryPro - Complete Inventory Management System

A full-stack inventory management and Point of Sale (POS) application built with Electron, Express.js, SQLite, and Tailwind CSS. This application provides a complete solution for small to medium businesses to manage their inventory, process sales, and track business operations.

## Features

- 🏪 **Point of Sale System** - Complete transaction processing with cart management
- 📦 **Inventory Management** - Product catalog, stock tracking, and category management
- 👥 **User Authentication** - Secure JWT-based authentication with role management
- 📊 **Real-time Analytics** - Sales reporting and inventory analytics
- 💻 **Cross-platform** - Runs as desktop app (Electron) or web application
- 🗄️ **SQLite Database** - Lightweight, serverless database with automatic setup
- 🎨 **Modern UI** - Responsive design built with Tailwind CSS

## Prerequisites

Before installing, ensure you have the following installed on your system:

- **Node.js** (version 16.0 or higher) - [Download here](https://nodejs.org/)
- **Git** (for cloning the repository) - [Download here](https://git-scm.com/)
- **Modern web browser** (Chrome, Firefox, Safari, or Edge)

## Installation

### 1. Download the Application

**Option A: Clone with Git (Recommended)**
```bash
git clone [your-repository-url]
cd STOCKLI-Design-1
```

**Option B: Download ZIP**
1. Download the ZIP file from the repository
2. Extract to your desired location
3. Navigate to the extracted folder

### 2. Install Dependencies

```bash
npm install
```

This will install all required packages including:
- Electron (desktop framework)
- Express.js (API server)
- SQLite3 (database)
- Tailwind CSS (styling)
- Security and authentication packages

### 3. Build the Application

```bash
npm run build:css
```

This compiles the Tailwind CSS styles required for the UI.

## Running the Application

### Desktop Application (Recommended)

Start the complete Electron desktop application:

```bash
npm start
```

This will:
- Start the API server on `http://localhost:3001`
- Initialize the SQLite database with sample data
- Launch the desktop application window
- Enable hot-reload for CSS changes

### Development Mode

For development with additional debugging:

```bash
npm run dev
```

### Web Browser Only

To run just the API server and access via web browser:

```bash
npm run server:start
```

Then open your browser and navigate to:
- **Main Application**: `http://localhost:3001`
- **Inventory Demo**: Open `src/demo-inventory.html`
- **POS Demo**: Open `src/demo-pos.html`

## Default Login Credentials

The application comes with pre-configured admin credentials:

- **Email**: `admin@inventorypro.com`
- **Password**: `admin123`

## Application Structure

```
STOCKLI-Design-1/
├── src/
│   ├── api/                    # Express.js backend API
│   │   ├── routes/            # API route handlers
│   │   ├── middleware/        # Authentication & error handling
│   │   └── server.js          # Main API server
│   ├── database/              # SQLite database files
│   │   ├── inventory.sqlite   # Main database file
│   │   ├── schema.sql         # Database schema
│   │   └── db.js              # Database manager
│   ├── demo-inventory.html    # Inventory management interface
│   ├── demo-pos.html          # Point of Sale interface
│   └── pages/                 # Additional HTML pages
├── electron/                  # Electron desktop app configuration
├── package.json              # Dependencies and scripts
└── README.md                 # This file
```

## Key Features & Usage

### Point of Sale System
- **Access**: Open `src/demo-pos.html` or use the desktop app
- **Features**:
  - Product menu with categories
  - Shopping cart management
  - Multiple payment methods
  - Transaction processing
  - Receipt generation
  - Real-time inventory updates

### Inventory Management
- **Access**: Open `src/demo-inventory.html` or use the desktop app
- **Features**:
  - Product catalog management
  - Stock level tracking
  - Category organization
  - Low stock alerts
  - Inventory value reporting

### User Management
- Role-based access control (Admin, Manager, Staff)
- Secure JWT authentication
- Session management
- User activity logging

## API Endpoints

The application provides a REST API accessible at `http://localhost:3001/api/`:

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/profile` - Get user profile

### Inventory
- `GET /api/inventory/products` - List all products
- `POST /api/inventory/products` - Create new product
- `GET /api/inventory/categories` - List categories
- `POST /api/inventory/categories` - Create category

### Point of Sale
- `GET /api/pos/menu` - Get POS menu items
- `POST /api/pos/transaction` - Process transaction
- `GET /api/pos/payment-methods` - List payment methods

## Database

The application uses SQLite with the following key tables:
- `users` - User accounts and authentication
- `products` - Product catalog
- `categories` - Product categories
- `sales_transactions` - Transaction records
- `transaction_items` - Individual transaction items
- `payment_methods` - Available payment methods

The database is automatically created and seeded with sample data on first run.

## Configuration

### Port Configuration
To change the API server port, edit `src/api/server.js`:
```javascript
const PORT = process.env.PORT || 3001; // Change 3001 to your preferred port
```

### Database Location
Database files are stored in `src/database/`. The main database is `inventory.sqlite`.

## Troubleshooting

### Port Already in Use
If you see "Port 3001 is already in use":
```bash
# Kill processes using port 3001
lsof -ti:3001 | xargs kill -9
# Or change the port in src/api/server.js
```

### Electron Won't Start
If Electron fails to launch:
1. Try running just the web version: `npm run server:start`
2. Check if all dependencies are installed: `npm install`
3. Ensure Node.js version is 16+: `node --version`

### Database Issues
If you encounter database errors:
1. Delete `src/database/inventory.sqlite`
2. Restart the application - database will be recreated
3. Check file permissions in the `src/database/` directory

### CSS Not Loading
If styles appear broken:
```bash
npm run build:css
```

### Login Issues
- Ensure you're using the correct credentials
- Check browser console for error messages
- Verify the API server is running on port 3001

## Development

### Adding New Features
1. API routes go in `src/api/routes/`
2. Database schema changes in `src/database/schema.sql`
3. Frontend pages in `src/pages/`
4. Shared styles in `src/styles.css`

### Running Tests
```bash
# Install development dependencies
npm install --dev
# Run tests (if implemented)
npm test
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License. See LICENSE file for details.

## Support

For issues and questions:
1. Check the troubleshooting section above
2. Review the application logs in `src/logs/`
3. Open an issue in the repository

---

**InventoryPro** - Your complete inventory management solution 🚀