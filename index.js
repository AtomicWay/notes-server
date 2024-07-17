const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5003;

const corsOptions = {
  origin: 'https://notes-client-roan.vercel.app'
};

app.use(cors(corsOptions));

// Middleware
app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('Connected to MongoDB'))
.catch((err) => console.error('MongoDB connection error:', err));

// File model
const File = require('./models/File');

// Firebase Admin SDK initialization
const serviceAccount = require('./path/to/your/serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET
});

const bucket = admin.storage().bucket();

const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB file size limit
});

// Routes
app.get('/', (req, res) => {
  res.send('Hello, MERN File Sharing!');
});

app.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    console.error('No file uploaded');
    return res.status(400).json({ message: 'No file uploaded' });
  }

  const file = bucket.file(Date.now().toString() + path.extname(req.file.originalname));
  const stream = file.createWriteStream({
    metadata: {
      contentType: req.file.mimetype,
    }
  });

  stream.on('error', (err) => {
    console.error('Error uploading file:', err);
    res.status(500).json({ message: 'Error uploading file' });
  });

  stream.on('finish', async () => {
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${file.name}`;
    const newFile = new File({
      filename: file.name,
      url: publicUrl
    });

    try {
      const savedFile = await newFile.save();
      res.status(201).json(savedFile);
    } catch (err) {
      console.error('Error saving file:', err);
      res.status(400).json({ message: err.message });
    }
  });

  stream.end(req.file.buffer);
});

app.get('/files', async (req, res) => {
  try {
    const files = await File.find();
    res.status(200).json(files);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
