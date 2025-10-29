# WhatsApp Summarizer - Backend API

Backend server for WhatsApp message summarizer with AI-powered chat analysis.

## 🚀 Features

- ✅ User authentication (username + password)
- ✅ JWT-based authorization
- ✅ WhatsApp connection via Baileys
- ✅ Real-time message caching
- ✅ Auto-delete messages after 24 hours (MongoDB TTL)
- ✅ AI-powered chat summaries (Gemini API)
- ✅ RESTful API design

## 📋 Prerequisites

- Node.js (v18 or higher)
- MongoDB Atlas account (free tier)
- Gemini API key (free from Google AI Studio)

## 🛠️ Installation

### 1. Clone the repository
```bash
git clone https://github.com/yourusername/whatsapp-summarizer-backend.git
cd whatsapp-summarizer-backend
```

### 2. Install dependencies
```bash
npm install
```

### 3. Set up environment variables
```bash
# Copy example env file
cp .env.example .env

# Edit .env and add your credentials
```

Required environment variables:
```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/whatsapp-db
JWT_SECRET=your-super-secret-random-string
GEMINI_API_KEY=your-gemini-api-key
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:3001
```

### 4. Start the server

**Development mode (auto-restart on changes):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

Server will run on `http://localhost:3000`

## 📚 API Documentation

### Authentication Endpoints

#### 1. Signup
```http
POST /api/auth/signup
Content-Type: application/json

{
  "username": "john_doe",
  "password": "password123",
  "phoneNumber": "+2348012345678"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Account created successfully!",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "67abc123...",
    "username": "john_doe",
    "phoneNumber": "+2348012345678",
    "whatsappConnected": false
  }
}
```

#### 2. Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "john_doe",
  "password": "password123"
}
```

#### 3. Get Current User (Protected)
```http
GET /api/auth/me
Authorization: Bearer YOUR_JWT_TOKEN
```

#### 4. Update Phone Number (Protected)
```http
PUT /api/auth/phone
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "phoneNumber": "+2348012345678"
}
```

### WhatsApp Endpoints (Coming Soon)
- `POST /api/whatsapp/connect` - Connect WhatsApp
- `GET /api/whatsapp/qr/:userId` - Get QR code
- `POST /api/whatsapp/disconnect` - Disconnect WhatsApp
- `GET /api/whatsapp/status` - Connection status

### Query Endpoints (Coming Soon)
- `POST /api/query` - Query and summarize chat
- `GET /api/query/chats` - Get all chats
- `GET /api/query/chats/:chatId` - Get specific chat messages

## 🗂️ Project Structure

```
src/
├── config/
│   ├── database.js          # MongoDB connection
│   └── env.js               # Environment variables
├── controllers/
│   ├── authController.js    # Auth logic
│   ├── whatsappController.js
│   └── queryController.js
├── middleware/
│   └── auth.js              # JWT verification
├── models/
│   ├── User.js              # User schema
│   └── Message.js           # Message schema (24h TTL)
├── routes/
│   ├── auth.js              # Auth routes
│   ├── whatsapp.js
│   └── query.js
├── services/
│   ├── whatsappService.js   # Baileys connection
│   ├── messageService.js    # Message CRUD
│   └── aiService.js         # Gemini AI
└── server.js                # Main entry point
```

## 🔒 Security Features

- ✅ Password hashing with bcrypt (10 rounds)
- ✅ JWT authentication with 7-day expiry
- ✅ CORS protection
- ✅ Input validation
- ✅ Mongoose schema validation
- ✅ Secure password requirements (min 6 chars)

## 📊 Database Schema

### Users Collection
```javascript
{
  username: String (unique, required),
  password: String (hashed, required),
  phoneNumber: String (optional),
  whatsappConnected: Boolean (default: false),
  lastLogin: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### Messages Collection (Auto-deletes after 24h)
```javascript
{
  userId: ObjectId (ref: User),
  chatId: String (WhatsApp chat ID),
  messageId: String (unique),
  sender: String,
  content: String,
  timestamp: Number (Unix timestamp),
  expiresAt: Date (TTL index),
  createdAt: Date,
  updatedAt: Date
}
```

## 🚀 Deployment

### Railway (Recommended)

1. Push code to GitHub
2. Go to [Railway.app](https://railway.app)
3. Create new project from GitHub repo
4. Add environment variables in Railway dashboard
5. Deploy automatically!

### Render

1. Push code to GitHub
2. Go to [Render.com](https://render.com)
3. Create new Web Service
4. Connect GitHub repo
5. Add environment variables
6. Deploy!

### Environment Variables for Production
```
MONGODB_URI=your-mongodb-atlas-uri
JWT_SECRET=your-production-secret
GEMINI_API_KEY=your-gemini-key
PORT=3000
NODE_ENV=production
CORS_ORIGIN=https://your-frontend-url.vercel.app
```

## 🧪 Testing

### Manual Testing with cURL

**Health Check:**
```bash
curl http://localhost:3000/
```

**Signup:**
```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"test1234"}'
```

**Login:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"test1234"}'
```

**Get Current User (replace TOKEN):**
```bash
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## 📝 Development Tips

- Use `npm run dev` for auto-restart during development
- Check MongoDB Atlas dashboard to see stored data
- Use Postman or Thunder Client for easier API testing
- Check `logs/` folder for error logs (if implemented)

## 🐛 Troubleshooting

### "MongoDB connection error"
- Check your `MONGODB_URI` in `.env`
- Ensure IP address is whitelisted in MongoDB Atlas
- Verify network connectivity

### "JWT_SECRET is not defined"
- Make sure `.env` file exists in root directory
- Check that `JWT_SECRET` is set in `.env`

### "Port already in use"
- Change `PORT` in `.env` to another port (e.g., 3001)
- Or kill the process using port 3000

### "Module not found"
- Run `npm install` to install dependencies
- Delete `node_modules` and `package-lock.json`, then `npm install` again

## 📄 License

MIT License - feel free to use this project for learning and personal projects.

## 👨‍💻 Author

Your Name - [GitHub](https://github.com/PerryAlex-hub)

## 🙏 Acknowledgments

- [Baileys](https://github.com/WhiskeySockets/Baileys) - WhatsApp Web API
- [Google Gemini](https://ai.google.dev/) - AI summarization
- [Express.js](https://expressjs.com/) - Web framework
- [MongoDB](https://www.mongodb.com/) - Database