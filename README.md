# Course Portal Backend API

A comprehensive course portal backend with user management, course enrollment, payment processing with Stripe integration, and a complete referral system for visa agents.

## 🎯 Project Summary

This API supports a simple online portal where users can purchase a course with an optional referral mechanism, especially for visa agents, allowing them to earn commissions when users sign up through their referral and complete a purchase.

## 👤 User Roles

- **Regular User (Learner)**: Can register, make payments, and access the course
- **Referral Agent (e.g., Visa Agent)**: Refers users and earns a commission on successful purchases
- **Admin/Owner**: Manages users, payments, referrals, and commissions

## 🔐 Core Features

### 1. User Registration & Login
- Secure registration and login system with JWT authentication
- Optional referral code field during signup (linked to agent)
- Profile management with additional fields (firstName, lastName, phone, country)

### 2. Course Purchase
- One main course available for purchase
- Users gain course access only after successful payment
- Stripe integration for secure payment processing

### 3. Referral Tracking & Commission
- If a user signs up using a referral code and purchases the course:
  - A commission is credited to the respective referral agent
  - 10% commission rate on successful purchases
  - Commission tracking with status (pending/paid/cancelled)

## 📊 Referral Agent Dashboard

Referral agents can log in and access their own dashboard with:
- Total number of successful referrals
- Commission earned (total, pending, paid)
- List of referred users with purchase status
- Monthly performance tracking
- Bank details management
- Payout request functionality

## 🛠 Admin Dashboard

Admin can:
- View all users and course purchases
- Track purchases made through referral codes
- Monitor commission per agent
- Approve/reject agent applications
- Handle withdrawal/payouts manually to agents
- Bulk operations for efficiency

## 💳 Payment Integration

- **Stripe Integration**: Complete payment processing with webhooks
- Payment intent creation for secure transactions
- Automatic course enrollment upon successful payment
- Refund processing capabilities
- Commission calculation and tracking

## 📦 API Routes

### Authentication Routes (`/api/auth`)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/register` | Register a new user with optional referral code | Public |
| POST | `/login` | Login user with JWT token | Public |
| GET | `/profile` | Get user profile | Private |
| PUT | `/profile` | Update user profile | Private |

### Course Routes (`/api/courses`)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/` | Get all courses with pagination and search | Public |
| GET | `/:id` | Get course by ID | Public |
| POST | `/` | Create a new course | Admin |
| PUT | `/:id` | Update a course | Admin |
| DELETE | `/:id` | Delete a course | Admin |
| POST | `/:id/enroll` | Enroll in a course | Private |
| GET | `/enrolled` | Get user's enrolled courses | Private |
| GET | `/:id/content` | Get course content (enrolled users only) | Private |

### Payment Routes (`/api/payments`)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/create-payment-intent` | Create Stripe payment intent | Private |
| POST | `/webhook` | Stripe webhook for payment confirmation | Public |
| GET | `/` | Get user's payment history | Private |
| GET | `/:id` | Get payment by ID | Private |
| GET | `/stats/overview` | Get payment statistics | Admin |
| GET | `/commissions` | Get user's commission earnings | Agent |
| POST | `/refund` | Process refund (Admin only) | Admin |

### Referral Routes (`/api/referrals`)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/code` | Get user's referral code | Private |
| GET | `/my-referrals` | Get user's referrals with purchase status | Private |
| GET | `/validate/:code` | Validate a referral code | Public |
| GET | `/stats` | Get referral statistics | Agent |
| GET | `/top-agents` | Get top performing agents | Admin |
| POST | `/become-agent` | Request to become an agent | Private |
| PUT | `/agent-profile` | Update agent profile and bank details | Agent |
| GET | `/agent-dashboard` | Get agent dashboard data | Agent |
| POST | `/request-payout` | Request payout for pending commissions | Agent |

### Admin Routes (`/api/admin`)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/dashboard` | Get admin dashboard data | Admin |
| GET | `/users` | Get all users with filtering | Admin |
| PUT | `/users/:id/role` | Update user role | Admin |
| PUT | `/users/:id/approve-agent` | Approve agent application | Admin |
| DELETE | `/users/:id` | Delete user | Admin |
| GET | `/payments` | Get all payments with filtering | Admin |
| GET | `/commissions` | Get all commissions | Admin |
| PUT | `/commissions/:id/status` | Update commission status | Admin |
| POST | `/commissions/bulk-payout` | Process bulk commission payouts | Admin |
| GET | `/stats/overview` | Get comprehensive system statistics | Admin |
| POST | `/bulk-actions` | Perform bulk actions | Admin |

## 🔧 Environment Variables

Create a `.env` file with the following variables:

```env
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
FRONTEND_URL=http://localhost:3000
NODE_ENV=development
PORT=5000
```

## 🚀 Installation & Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables (see above)

3. Start the server:
```bash
npm start
```

## 💰 Commission System

- **Commission Rate**: 10% on successful course purchases
- **Commission Status**: pending → paid/cancelled
- **Payout Methods**: bank_transfer, stripe_payout, manual
- **Agent Approval**: Admin must approve agents before they can earn commissions
- **Payout Tracking**: Complete audit trail for all payouts

## 🔐 Security Features

- Password hashing with bcrypt
- JWT token authentication
- Input validation with express-validator
- MongoDB injection protection
- CORS configuration
- Helmet security headers
- Rate limiting (100 requests per 15 minutes)

## 📊 Testing Examples

### User Registration with Referral Code
```bash
POST /api/auth/register
Content-Type: application/json

{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe",
  "referralCode": "ABC123"
}
```

### Create Payment Intent
```bash
POST /api/payments/create-payment-intent
Authorization: Bearer <token>
Content-Type: application/json

{
  "courseId": "course_id_here"
}
```

### Become an Agent
```bash
POST /api/referrals/become-agent
Authorization: Bearer <token>
Content-Type: application/json

{
  "firstName": "Jane",
  "lastName": "Smith",
  "phone": "+1234567890",
  "country": "United States"
}
```

### Approve Agent (Admin)
```bash
PUT /api/admin/users/:id/approve-agent
Authorization: Bearer <admin_token>
```

## 📈 Dashboard Features

### Agent Dashboard
- Total referrals and commission earned
- Recent referrals with purchase status
- Monthly performance tracking
- Pending vs paid commission breakdown
- Bank details management

### Admin Dashboard
- User management with role filtering
- Payment tracking with referral filtering
- Commission management with bulk operations
- System-wide statistics and trends
- Agent approval workflow

## 🔄 Webhook Integration

The system includes Stripe webhook handling for:
- Payment confirmation
- Automatic course enrollment
- Commission calculation
- Referral tracking

## 📝 Error Handling

All routes return consistent error responses:

```json
{
  "success": false,
  "message": "Error description"
}
```

Successful responses include:

```json
{
  "success": true,
  "data": {...}
}
```

## 🎯 Complete Project Coverage

This API fully supports your project requirements:

✅ **User Registration & Login** with referral code support  
✅ **Course Purchase** with Stripe integration  
✅ **Referral Tracking** with complete commission system  
✅ **Agent Dashboard** with earnings and referral tracking  
✅ **Admin Dashboard** with full management capabilities  
✅ **Payment Integration** with Stripe webhooks  
✅ **Commission Management** with payout processing  
✅ **Agent Approval System** with admin controls  
✅ **Bulk Operations** for efficient management  
✅ **Comprehensive Statistics** and reporting  

The API is ready for production use and includes all necessary endpoints for your course portal with referral system. 