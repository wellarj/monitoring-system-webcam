const { spawn } = require('child_process');
const express = require('express');
const fs = require('fs-extra');
const path = require('path');

const app = express();
const port = 3000;

// Diretório para salvar vídeos
const videosDir = path.join(__dirname, 'videos');
fs.ensureDirSync(videosDir);

// Função para iniciar gravação de uma webcam
function startRecording(cameraId, duration = 300) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputFile = path.join(videosDir, `camera-${cameraId}-${timestamp}.mp4`);

  const ffmpeg = spawn('ffmpeg', [
    '-f', 'dshow', // Usado para webcams no Windows
    '-i', `video=${cameraId}`, // Nome da câmera
    '-t', duration, // Duração em segundos
    '-c:v', 'libx264', // Codec de vídeo
    '-preset', 'ultrafast', // Configuração rápida
    '-y', // Sobrescrever arquivos
    outputFile,
  ]);

  ffmpeg.stderr.on('data', (data) => console.error(`FFmpeg: ${data}`));
  ffmpeg.on('close', (code) => {
    if (code === 0) {
      console.log(`Gravação salva: ${outputFile}`);
    } else {
      console.error(`Erro ao gravar: Código ${code}`);
    }
  });

  return outputFile;
}

// Rota para iniciar gravação
app.get('/start/:cameraId', (req, res) => {
  const cameraId = req.params.cameraId;
  const file = startRecording(cameraId);
  res.send(`Gravando câmera ${cameraId} em: ${file}`);
});

// Iniciar o servidor
app.listen(port, () => {
  console.log(`Servidor rodando em: http://localhost:${port}`);
});