const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

app.get('/api/config', (req, res) => {
  res.json({
    firebaseConfig: {
      apiKey: process.env.FIREBASE_API_KEY,
      authDomain: "ket-training-9b88d.firebaseapp.com",
      projectId: "ket-training-9b88d",
      storageBucket: "ket-training-9b88d.firebasestorage.app",
      messagingSenderId: "1048640604545",
      appId: "1:1048640604545:web:97763f7dec221ca9eac080"
    }
  });
});

app.use(express.static(__dirname));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});
