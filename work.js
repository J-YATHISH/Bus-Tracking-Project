// ======================
// 1. Import Required Tools
// ======================
const express = require('express');          // Web framework
const http = require('http');               // HTTP server
const socketIo = require('socket.io');      // Real-time communication
const cors = require('cors');               // Cross-origin access
const { Pool } = require('pg');             // PostgreSQL connection

// ======================
// 2. Initialize the Server
// ======================
const app = express();
app.use(cors());                            // Allow Flutter app to connect
app.use(express.json());                    // Parse JSON requests

const server = http.createServer(app);
const io = socketIo(server, { 
  cors: { origin: '*' }                     // Allow all frontend connections
});

// ======================
// 3. Database Connection
// ======================
const pool = new Pool({
  user: 'your_db_username',
  host: 'localhost',
  database: 'bus_tracking',
  password: 'your_password',
  port: 5432,
});

// ======================
// 4. Real-Time Socket.io Setup
// ======================
io.on('connection', (socket) => {
  console.log(' New client connected');

  // Handle driver location updates
  socket.on('driver-update', async (data) => {
    try {
      // Save to PostgreSQL
      await pool.query(
        `INSERT INTO buses (id, lat, lon, crowd_level) 
         VALUES ($1, $2, $3, $4) 
         ON CONFLICT (id) 
         DO UPDATE SET lat = $2, lon = $3, crowd_level = $4, updated_at = NOW()`,
        [data.id, data.lat, data.lon, data.crowd_level]
      );
      
      // Broadcast to all students
      io.emit('bus-location', data);
    } catch (err) {
      console.error(' DB Error:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log(' Client disconnected');
  });
});

// ======================
// 5. REST API Endpoints
// ======================
// Get all active buses
app.get('/api/buses', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM buses WHERE updated_at > NOW() - INTERVAL '5 minutes'`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// Driver manual location update (HTTP fallback)
app.post('/api/location', async (req, res) => {
  const { id, lat, lon, crowd_level } = req.body;
  try {
    await pool.query(
      `INSERT INTO buses (id, lat, lon, crowd_level) 
       VALUES ($1, $2, $3, $4) 
       ON CONFLICT (id) 
       DO UPDATE SET lat = $2, lon = $3, crowd_level = $4`,
      [id, lat, lon, crowd_level]
    );
    res.status(200).send('Location updated');
  } catch (err) {
    res.status(500).send('Update failed');
  }
});

// ======================
// 6. Start the Server
// ======================
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});