# 🧪 Course Portal API Testing Guide

## 📋 Prerequisites

1. **Start the server:**
   ```bash
   cd course-portal-backend
   npm install
   npm start
   ```

2. **Set up environment variables** (create `.env` file):
   ```
   PORT=3000
   MONGODB_URI=mongodb://localhost:27017/course-portal
   JWT_SECRET=your-secret-key
   STRIPE_SECRET_KEY=sk_test_your_stripe_key
   STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
   ```

3. **Import Postman Collection:**
   - Open Postman
   - Import the `Postman_Collection.json` file
   - Set the `baseUrl` variable to `http://localhost:3000/api`

## 🚀 Testing Flow

### 1. **Health Check**
- **Endpoint:** `GET /api/health`
- **Purpose:** Verify server is running
- **Expected:** `200 OK` with success message

### 2. **Authentication Flow**

#### 2.1 Register User
```bash
POST /api/auth/register
Content-Type: application/json

{
  "username": "testuser",
  "email": "test@example.com",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+1234567890",
  "country": "USA"
}
```

#### 2.2 Register with Referral Code
```bash
POST /api/auth/register
Content-Type: application/json

{
  "username": "referreduser",
  "email": "referred@example.com",
  "password": "password123",
  "firstName": "Jane",
  "lastName": "Smith",
  "phone": "+1234567891",
  "country": "Canada",
  "referralCode": "AGENT123"
}
```

#### 2.3 Login
```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "password123"
}
```
**Note:** This will automatically set the `authToken` variable in Postman.

#### 2.4 Get Profile
```bash
GET /api/auth/profile
Authorization: Bearer {{authToken}}
```

#### 2.5 Update Profile
```bash
PUT /api/auth/profile
Authorization: Bearer {{authToken}}
Content-Type: application/json

{
  "firstName": "Updated John",
  "lastName": "Updated Doe",
  "phone": "+1234567899",
  "country": "UK"
}
```

### 3. **Course Management**

#### 3.1 Get All Courses
```bash
GET /api/courses
```

#### 3.2 Create Course (Admin Only)
```bash
POST /api/courses
Authorization: Bearer {{authToken}}
Content-Type: application/json

{
  "title": "Complete Web Development Course",
  "description": "Learn HTML, CSS, JavaScript, React, and Node.js",
  "price": 99.99,
  "duration": "20 hours",
  "level": "beginner",
  "category": "Web Development",
  "content": "Course content and materials...",
  "requirements": "Basic computer knowledge",
  "whatYouWillLearn": ["HTML5", "CSS3", "JavaScript", "React", "Node.js"]
}
```

#### 3.3 Get Course by ID
```bash
GET /api/courses/{{courseId}}
```

#### 3.4 Enroll in Course
```bash
POST /api/courses/enroll
Authorization: Bearer {{authToken}}
Content-Type: application/json

{
  "courseId": "{{courseId}}"
}
```

#### 3.5 Get Enrolled Courses
```bash
GET /api/courses/enrolled
Authorization: Bearer {{authToken}}
```

### 4. **Payment System**

#### 4.1 Create Payment Intent
```bash
POST /api/payments/create-payment-intent
Authorization: Bearer {{authToken}}
Content-Type: application/json

{
  "courseId": "{{courseId}}",
  "amount": 99.99,
  "currency": "usd",
  "paymentMethod": "card"
}
```

#### 4.2 Get User Payments
```bash
GET /api/payments/my-payments
Authorization: Bearer {{authToken}}
```

#### 4.3 Get Payment by ID
```bash
GET /api/payments/{{paymentId}}
Authorization: Bearer {{authToken}}
```

### 5. **Referral System**

#### 5.1 Get My Referral Code
```bash
GET /api/referrals/my-code
Authorization: Bearer {{authToken}}
```

#### 5.2 Become Agent
```bash
POST /api/referrals/become-agent
Authorization: Bearer {{authToken}}
Content-Type: application/json

{
  "firstName": "Agent",
  "lastName": "User",
  "phone": "+1234567890",
  "country": "USA",
  "bankDetails": {
    "accountNumber": "1234567890",
    "bankName": "Test Bank",
    "routingNumber": "123456789"
  }
}
```

#### 5.3 Get Agent Dashboard
```bash
GET /api/referrals/agent-dashboard
Authorization: Bearer {{authToken}}
```

#### 5.4 Get My Referrals
```bash
GET /api/referrals/my-referrals
Authorization: Bearer {{authToken}}
```

#### 5.5 Get Referral Stats
```bash
GET /api/referrals/stats
Authorization: Bearer {{authToken}}
```

#### 5.6 Request Payout
```bash
POST /api/referrals/request-payout
Authorization: Bearer {{authToken}}
Content-Type: application/json

{
  "amount": 50.00,
  "payoutMethod": "bank_transfer",
  "notes": "Monthly payout request"
}
```

### 6. **Admin Functions**

#### 6.1 Get Admin Dashboard
```bash
GET /api/admin/dashboard
Authorization: Bearer {{authToken}}
```

#### 6.2 Get All Users
```bash
GET /api/admin/users?page=1&limit=10
Authorization: Bearer {{authToken}}
```

#### 6.3 Update User Role
```bash
PUT /api/admin/users/{{userId}}/role
Authorization: Bearer {{authToken}}
Content-Type: application/json

{
  "role": "agent"
}
```

#### 6.4 Approve Agent
```bash
PUT /api/admin/users/{{userId}}/approve-agent
Authorization: Bearer {{authToken}}
```

#### 6.5 Get All Payments
```bash
GET /api/admin/payments?page=1&limit=10
Authorization: Bearer {{authToken}}
```

#### 6.6 Get All Commissions
```bash
GET /api/admin/commissions?page=1&limit=10
Authorization: Bearer {{authToken}}
```

#### 6.7 Update Commission Status
```bash
PUT /api/admin/commissions/{{commissionId}}/status
Authorization: Bearer {{authToken}}
Content-Type: application/json

{
  "status": "paid",
  "payoutMethod": "bank_transfer",
  "payoutNotes": "Processed via bank transfer"
}
```

#### 6.8 Process Bulk Payout
```bash
POST /api/admin/commissions/bulk-payout
Authorization: Bearer {{authToken}}
Content-Type: application/json

{
  "commissionIds": ["{{commissionId}}"],
  "payoutMethod": "bank_transfer",
  "payoutNotes": "Bulk payout processed"
}
```

#### 6.9 Get System Stats
```bash
GET /api/admin/stats/overview
Authorization: Bearer {{authToken}}
```

## 🔧 Testing Scenarios

### Scenario 1: Complete User Journey
1. Register a new user
2. Login and get token
3. Browse courses
4. Enroll in a course
5. Make a payment
6. Access course content

### Scenario 2: Referral System
1. Register an agent
2. Admin approves the agent
3. Agent gets referral code
4. New user registers with referral code
5. New user purchases course
6. Agent earns commission
7. Admin processes commission payout

### Scenario 3: Admin Management
1. Login as admin
2. View dashboard statistics
3. Manage users (approve agents, update roles)
4. View all payments and commissions
5. Process bulk payouts
6. Generate system reports

## 📊 Expected Responses

### Success Response Format
```json
{
  "success": true,
  "message": "Operation successful",
  "data": {
    // Response data
  }
}
```

### Error Response Format
```json
{
  "success": false,
  "message": "Error description",
  "statusCode": 400
}
```

## 🚨 Common Issues & Solutions

### 1. Authentication Errors
- **Issue:** `401 Unauthorized`
- **Solution:** Ensure valid JWT token in Authorization header

### 2. Permission Errors
- **Issue:** `403 Forbidden`
- **Solution:** Check user role (admin functions require admin role)

### 3. Validation Errors
- **Issue:** `400 Bad Request`
- **Solution:** Check request body format and required fields

### 4. Database Errors
- **Issue:** `500 Internal Server Error`
- **Solution:** Check MongoDB connection and environment variables

## 🔍 Testing Tips

1. **Use Postman Variables:** Set up variables for `authToken`, `userId`, `courseId`, etc.
2. **Test Error Cases:** Try invalid data, missing fields, wrong permissions
3. **Check Response Headers:** Verify content-type and status codes
4. **Test Pagination:** Use page and limit parameters for list endpoints
5. **Verify Data Integrity:** Check that related data is properly linked

## 📝 Test Checklist

- [ ] Health check endpoint
- [ ] User registration (with and without referral)
- [ ] User login and token generation
- [ ] Profile management
- [ ] Course CRUD operations
- [ ] Course enrollment
- [ ] Payment processing
- [ ] Referral system
- [ ] Agent management
- [ ] Commission tracking
- [ ] Admin dashboard
- [ ] User management
- [ ] Payment management
- [ ] Commission management
- [ ] Bulk operations
- [ ] System statistics

## 🎯 Performance Testing

For load testing, you can use tools like:
- **Apache JMeter**
- **Artillery**
- **k6**

Test scenarios:
- Multiple concurrent users
- Large data sets
- Payment processing under load
- Database query performance

## 🔐 Security Testing

- Test JWT token expiration
- Verify role-based access control
- Test input validation and sanitization
- Check for SQL injection vulnerabilities
- Verify payment data security

Happy Testing! 🚀 