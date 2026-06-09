const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
dotenv.config();

const app = express();

// CORS – allow frontend origin
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/meetings', require('./routes/meetings'));
app.use('/api/documents', require('./routes/documents'));
app.use('/api/payments', require('./routes/payments'));

// User search endpoint (for meetings)
app.get('/api/users', async (req, res) => {
  const { email } = req.query;
  const User = require('./models/User');
  const users = await User.find({ email: { $regex: email, $options: 'i' } }).limit(5);
  res.json(users);
});

const PORT = process.env.PORT || 5000;
app.use("/uploads", express.static("uploads"));
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Socket.IO signaling for video calls
const http = require('http');
const socketIo = require('socket.io');
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: '*' } });
io.on('connection', (socket) => {
  socket.on('join-room', (roomId, userId) => {
    socket.join(roomId);
    socket.to(roomId).emit('user-connected', userId);
  });
});
app.use("/uploads", express.static("uploads"));
app.listen = function() { server.listen.apply(server, arguments); };
