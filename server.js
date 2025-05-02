const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const users = {};

// ➤ Créer le dossier uploads s’il n'existe pas
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// ➤ Configuration de multer avec conservation de l'extension
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const baseName = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, baseName + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }
});

// ➤ Route vers la page de connexion
app.get('/', (req, res) => {
  res.sendFile(path.resolve(__dirname, 'public', 'login.html'));
});

// ➤ Route vers la page de chat
app.get('/chat', (req, res) => {
  res.sendFile(path.resolve(__dirname, 'public', 'index.html'));
});

// ➤ Servir les fichiers statiques
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadDir));

// ➤ Route de réception des fichiers
app.post('/send-file', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('Aucun fichier sélectionné.');
  }

  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ fileUrl });
});

// ➤ Socket.io
io.on('connection', (socket) => {
  console.log('✅ Utilisateur connecté');

  socket.on('set_username', (name) => {
    users[socket.id] = name;
    console.log(`👤 Username: ${name}`);
    socket.broadcast.emit('receive_message', {
      message: `${name} a rejoint la conversation`,
      sender: 'System'
    });
  });

  socket.on('send_message', (data) => {
    const username = users[socket.id] || 'Anonyme';
    socket.broadcast.emit('receive_message', {
      message: data.message,
      sender: username
    });
  });

  socket.on('disconnect', () => {
    const username = users[socket.id];
    if (username) {
      socket.broadcast.emit('receive_message', {
        message: `${username} a quitté la conversation`,
        sender: 'System'
      });
      delete users[socket.id];
    }
    console.log('❌ Utilisateur déconnecté');
  });
});

// ➤ Démarrer le serveur
server.listen(3000, '0.0.0.0', () => {
  console.log('🚀 Serveur lancé sur http://0.0.0.0:3000');
});
