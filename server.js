require('dotenv').config();
const os = require("os");
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const port = process.env.PORT || 4000;
const host = '0.0.0.0';

// 0.0.0.0 is not a clickable address, so list the real lan ips
function lanIPs() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((i) => i.family === "IPv4" && !i.internal)
    .map((i) => i.address);
}

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/products', require('./routes/products'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 50 }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/files', require('./routes/files'));


mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Mongo connected'))
  .catch(err => console.error(err));

if (require.main === module) {
  app.listen(port, host, () => {
    console.log(`Connected:\nListen on: http://localhost:${port}`);
    for (const ip of lanIPs()) console.log(`Network: http://${ip}:${port}`);
  });
}

module.exports = app;