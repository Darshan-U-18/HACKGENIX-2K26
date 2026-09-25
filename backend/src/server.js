require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

// Connect to database
connectDB();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/incidents', require('./routes/incidents'));
const { getConflicts } = require('./controllers/incidentController');
app.get('/api/conflicts', getConflicts);
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: "ResilSync API is running"
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
