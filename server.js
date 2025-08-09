const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const app = express();

app.use(express.json());

const users = [
  // Example seed: { id: 1, username: 'admin', passwordHash: ..., role: 'admin' }
];
const tools = [];

const SECRET = 'your_jwt_secret';

// Helper: Authenticate JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);
  jwt.verify(token, SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// Helper: Role check
function authorizeRoles(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) return res.sendStatus(403);
    next();
  };
}

// Register (admin or teamlead only)
app.post('/register', authenticateToken, authorizeRoles('admin', 'teamlead'), async (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password || !role) return res.status(400).send('Missing fields');
  const passwordHash = await bcrypt.hash(password, 10);
  users.push({ id: users.length + 1, username, passwordHash, role });
  res.status(201).send('User created');
});

// Login
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username);
  if (!user) return res.status(400).send('User not found');
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).send('Invalid credentials');
  const token = jwt.sign({ username: user.username, role: user.role }, SECRET);
  res.json({ token, role: user.role });
});

// Add tool (teamlead or admin only)
app.post('/tools', authenticateToken, authorizeRoles('admin', 'teamlead'), (req, res) => {
  const { name, expirationDate, purchaseDate, serialNumber } = req.body;
  if (!name || !expirationDate || !purchaseDate || !serialNumber) {
    return res.status(400).send('Missing fields');
  }
  tools.push({ id: tools.length + 1, name, expirationDate, purchaseDate, serialNumber });
  res.status(201).send('Tool added');
});

// List tools (all roles)
app.get('/tools', authenticateToken, (req, res) => {
  res.json(tools);
});

app.listen(3001, () => console.log('Server running on port 3001'));