// const { spawn } = require('child_process');
// const express = require('express');
// const fs = require('fs-extra');
// const path = require('path');

// const app = express();
// const port = 3000;

// // Diretório para salvar vídeos
// const videosDir = path.join(__dirname, 'videos');
// fs.ensureDirSync(videosDir);

// // Armazena processos de gravação por câmera
// const recordingProcesses = {};

// // Função para listar as câmeras disponíveis
// function listCameras() {
//   const cameras = [];
//   const ffmpeg = spawn('ffmpeg', ['-list_devices', 'true', '-f', 'dshow', '-i', 'dummy']);
  
//   ffmpeg.stdout.on('data', (data) => {
//     const output = data.toString();
//     const lines = output.split('\n');
//     lines.forEach((line) => {
//       const match = line.match(/"(.+)"/);
//       if (match) {
//         cameras.push(match[1]);
//       }
//     });
//   });

//   ffmpeg.stderr.on('data', (data) => console.error(`FFmpeg stderr: ${data}`));

//   ffmpeg.on('close', () => {
//     // Após a execução do FFmpeg, retorna a lista de câmeras
//     app.locals.cameras = cameras;
//   });
// }

// // Função para iniciar gravação de uma webcam
// function startRecording(cameraId, duration = 5) {
//   const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
//   const outputFile = path.join(videosDir, `camera-${cameraId}-${timestamp}.mp4`);

//   // Aqui usamos o nome alternativo da câmera
//   const ffmpeg = spawn('ffmpeg', [
//     '-f', 'dshow',
//     '-i', `video=${cameraId}`, // Agora use o nome correto ou alternativo
//     '-t', duration,
//     '-c:v', 'libx264',
//     '-preset', 'ultrafast',
//     '-y',
//     outputFile,
//   ]);

//   ffmpeg.stderr.on('data', (data) => console.error(`FFmpeg: ${data}`));
//   ffmpeg.on('close', (code) => {
//     if (code === 0) {
//       console.log(`Gravação salva: ${outputFile}`);
//     } else {
//       console.error(`Erro ao gravar: Código ${code}`);
//     }
//     delete recordingProcesses[cameraId];
//   });

//   recordingProcesses[cameraId] = ffmpeg;
//   return outputFile;
// }

// // Função para parar gravação
// function stopRecording(cameraId) {
//   const process = recordingProcesses[cameraId];
//   if (process) {
//     process.kill('SIGINT'); // Envia sinal para parar o FFmpeg
//     delete recordingProcesses[cameraId];
//     return true;
//   }
//   return false;
// }

// // Rota para listar câmeras
// app.get('/', (req, res) => {
//   // A lista de câmeras estará disponível após o processamento do FFmpeg
//   if (app.locals.cameras) {
//     const cameras = app.locals.cameras;
//     res.send(`
//       <h1>Câmeras Disponíveis</h1>
//       <ul>
//         ${cameras.map((camera, index) => `
//           <li>
//             ${camera}
//             <br>
//             <a href="/view/${camera}">Visualizar</a> |
//             <a href="/start/${camera}">Gravar</a> |
//             <a href="/stop/${camera}">Pausar</a>
//           </li>
//         `).join('')}
//       </ul>
//     `);
//   } else {
//     res.send('Aguardando câmeras...');
//   }
// });

// // Rota para iniciar gravação
// app.get('/start/:cameraId', (req, res) => {
//   const cameraId = req.params.cameraId;
//   if (recordingProcesses[cameraId]) {
//     return res.status(400).send(`Câmera ${cameraId} já está gravando.`);
//   }
//   const file = startRecording(cameraId);
//   res.send(`Gravação iniciada para a câmera ${cameraId}. Arquivo: ${file}`);
// });

// // Rota para parar gravação
// app.get('/stop/:cameraId', (req, res) => {
//   const cameraId = req.params.cameraId;
//   const stopped = stopRecording(cameraId);
//   if (stopped) {
//     res.send(`Gravação da câmera ${cameraId} pausada.`);
//   } else {
//     res.status(400).send(`Câmera ${cameraId} não está gravando.`);
//   }
// });

// // Rota para visualizar a câmera
// app.get('/view/:cameraId', (req, res) => {
//   const cameraId = req.params.cameraId;
//   res.send(`
//     <h1>Visualizando: ${cameraId}</h1>
//     <video width="640" height="480" controls autoplay>
//       <source src="http://localhost:3000/stream/${cameraId}" type="video/mp4">
//       Seu navegador não suporta o elemento de vídeo.
//     </video>
//     <br>
//     <a href="/">Voltar à listagem de câmeras</a>
//   `);
// });

// // Iniciar o servidor e listar câmeras
// app.listen(port, () => {
//   console.log(`Servidor rodando em: http://localhost:${port}`);
//   listCameras(); // Carregar câmeras ao iniciar o servidor
// });
