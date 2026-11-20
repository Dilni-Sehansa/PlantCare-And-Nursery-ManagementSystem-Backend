# 🌿 Plant Care and Nursery Management System – Backend

## 📌 Overview

The Plant Care and Nursery Management System Backend is a RESTful API developed to support the operations of a plant care and nursery management application.

It handles business logic, database operations, authentication, authorization, image uploads, email verification, order processing, stock management, and payment-related operations.

The backend is developed using Node.js, Express.js, TypeScript, and MongoDB.

## 🛠️ Technologies Used

- Node.js
- Express.js
- TypeScript
- MongoDB
- Mongoose
- JWT (JSON Web Token)
- Bcrypt.js
- Supabase
- Multer
- Nodemailer
- PDFKit

## ✨ Main Features

### 🔐 Authentication
- User registration and login.
- JWT-based authentication.
- Access token and refresh token management.
- Password hashing using Bcrypt.
- Protected API routes.
- Email verification.
- Password recovery functionality.

### 👥 User Management
- User management.
- User account handling.
- Role-based access control.
- Super Admin management.

### 🌱 Plant Management
- Plant information management.
- Plant type management.
- Plant image handling.

### 🛒 Product Management
- Product management.
- Product information handling.
- Product image uploads.

### 📦 Order Management
- Customer order processing.
- Order information management.
- Order status handling.

### 💳 Payment Management
- Payment-related operations.
- Payment information management.
- Payment document generation.

### 🏪 Inventory Management
- Internal stock management.
- Stock purchase management.
- Stock usage management.
- Product sales management.

### 🤝 Supplier Management
- Supplier information management.
- Supplier-related stock purchases.

### 📧 Email Services
- Email verification.
- Email notifications.

## 🏗️ Project Structure

```text
Plant-Care-Management-System-Backend/
│
├── src/
│   ├── config/
│   │   ├── database.ts
│   │   ├── database.test.ts
│   │   └── supabase.ts
│   │
│   ├── controllers/
│   │   ├── auth.controller.ts
│   │   ├── user.controller.ts
│   │   ├── plant.controller.ts
│   │   ├── product.controller.ts
│   │   ├── order.controller.ts
│   │   ├── payment.controller.ts
│   │   ├── supplier.controller.ts
│   │   ├── internalStock.controller.ts
│   │   ├── internalStockUsage.controller.ts
│   │   ├── stockPurchase.controller.ts
│   │   └── productSale.controller.ts
│   │
│   ├── middleware/
│   │   ├── auth.middleware.ts
│   │   ├── file-signature.ts
│   │   └── upload.ts
│   │
│   ├── models/
│   │   ├── user.model.ts
│   │   ├── plant.model.ts
│   │   ├── plantType.model.ts
│   │   ├── product.model.ts
│   │   ├── order.model.ts
│   │   ├── supplier.model.ts
│   │   ├── internalStock.model.ts
│   │   ├── internalStockUsage.model.ts
│   │   ├── stockPurchase.model.ts
│   │   ├── productSale.model.ts
│   │   └── counter.model.ts
│   │
│   ├── routes/
│   │   ├── auth.routes.ts
│   │   ├── user.routes.ts
│   │   ├── plant.routes.ts
│   │   ├── plantType.routes.ts
│   │   ├── product.routes.ts
│   │   ├── order.routes.ts
│   │   ├── payment.routes.ts
│   │   ├── supplier.routes.ts
│   │   ├── internalStock.routes.ts
│   │   ├── internalStockUsage.routes.ts
│   │   ├── stockPurchase.routes.ts
│   │   └── productSale.routes.ts
│   │
│   ├── service/
│   │   └── email.service.ts
│   │
│   ├── utils/
│   │   └── token.ts
│   │
│   ├── SCRIPTS/
│   │   └── createSuperAdmin.ts
│   │
│   ├── index.ts
│   └── server.ts
│
├── .example.env
├── package.json
└── tsconfig.json
```

## ⚙️ Installation and Setup

### 1. Clone the Repository

```bash
git clone YOUR_BACKEND_GITHUB_REPOSITORY_URL
```

Navigate into the backend folder:

```bash
cd Plant-Care-Management-System-Backend
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Variables

Create a `.env` file in the backend root directory.

Use the following configuration:

```env
MONGO_URI=your_mongodb_connection_string

JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_token_secret

SUPABASE_URL=your_supabase_url
SUPABASE_SECRET_KEY=your_supabase_secret_key

FRONTEND_URL=http://localhost:5173

PORT=5000

SUPABASE_BUCKET=your_storage_bucket
SUPABASE_PAYMENT_BUCKET=your_payment_bucket

SUPER_ADMIN_FIRST_NAME=Your_First_Name
SUPER_ADMIN_LAST_NAME=Your_Last_Name
SUPER_ADMIN_EMAIL=your_email
SUPER_ADMIN_PHONE=your_phone
SUPER_ADMIN_PASSWORD=your_password
```

**Important:** Use a MongoDB replica-set or sharded deployment because order transactions require transaction support.

### 4. Run the Backend

Start the development server:

```bash
npm run dev
```

The backend runs on:

```text
http://localhost:5000
```

### 5. Create Super Admin (Optional)

Configure the Super Admin environment variables and execute:

```bash
npm run create:super-admin
```

## 🧪 Testing

Run the available backend tests:

```bash
npm test
```

## 🏗️ Build

Compile TypeScript:

```bash
npm run build
```

## 📜 Available Scripts

| Command | Description |
|---|---|
| `npm install` | Install dependencies |
| `npm run dev` | Start development server |
| `npm run build` | Compile TypeScript |
| `npm start` | Start compiled server |
| `npm test` | Run backend tests |
| `npm run create:super-admin` | Create Super Admin |

## 🔒 Security

- JWT-based authentication.
- Password hashing.
- Protected API endpoints.
- Authentication middleware.
- Role-based access control.
- Environment variable configuration.
- File signature validation.

## ☁️ External Services

- MongoDB – Database management.
- Supabase – Image and file storage.
- Nodemailer – Email services.

## 👩‍💻 Author

Developed as part of the Plant Care and Nursery Management System project.

## 📄 License

This project is developed for educational and software development purposes.
