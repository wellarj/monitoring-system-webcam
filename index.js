const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const ffmpeg = require('fluent-ffmpeg');
const app = express();
const port = 3000;
const { spawn } = require('child_process');
const activeStreams = {};

let isRecording = false;  // Variável para verificar se a gravação está em andamento
let recordingStream = null;  // Controlar o estado de gravação

// Configuração para servir arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Caminho do arquivo JSON
const camerasFilePath = path.join(__dirname, 'cameras.json');

// Configuração para rodar o servidor em todas as interfaces
app.listen(port, '0.0.0.0', () => {
  console.log(`Servidor rodando em http://192.168.100.118:${port}`);
});

// Diretório para salvar vídeos
const videosDir = path.join(__dirname, 'videos');
const streamDir = path.join(__dirname, 'stream');


fs.ensureDirSync(videosDir);
fs.ensureDirSync(streamDir); // Cria o diretório para os arquivos de stream

function startStream(cameraId) {
  const cameraStreamPath = path.join(streamDir, cameraId);

  // Verifica se o diretório da câmera existe e limpa os arquivos antigos
  if (fs.existsSync(cameraStreamPath)) {
    fs.emptyDirSync(cameraStreamPath); // Remove todos os arquivos antigos
  }
  fs.ensureDirSync(cameraStreamPath); // Recria o diretório se necessário

  console.log(`Iniciando transmissão da câmera: ${cameraId}`);

  // Ajuste para resolução e qualidade máximas
  const resolution = '1920x1080'; // Substitua pela resolução máxima suportada
  const framerate = '30'; // Substitua pela taxa de quadros máxima suportada

  // Inicia a transmissão com FFmpeg
  const ffmpegProcess = spawn('ffmpeg', [
    '-f', 'dshow',
    // '-framerate', framerate,
    // '-video_size', resolution,
    '-i', `video=${cameraId}`,
    '-c:v', 'libx264',
    '-preset', 'ultrafast',         // Codificação rápida
    '-tune', 'zerolatency',        // Otimização para transmissão ao vivo
    '-crf', '18',                  // Qualidade do vídeo
    '-f', 'hls',
    '-hls_time', '1',              // Cada segmento terá 1 segundo
    '-hls_list_size', '2',         // Apenas os 2 segmentos mais recentes
    '-hls_flags', 'delete_segments+omit_endlist', // Remove antigos e evita buffer adicional
    '-hls_segment_filename', path.join(cameraStreamPath, 'segment-%03d.ts'),
    path.join(cameraStreamPath, 'index.m3u8')
  ]);

  ffmpegProcess.stdout.on('data', (data) => {
    console.log(`[${cameraId}] FFmpeg stdout: ${data}`);
  });

  ffmpegProcess.stderr.on('data', (data) => {
    console.error(`[${cameraId}] FFmpeg stderr: ${data}`);
  });

  ffmpegProcess.on('close', (code) => {
    if (code !== 0) {
      console.error(`[${cameraId}] FFmpeg process exited with code ${code}`);
    } else {
      console.log(`[${cameraId}] Transmissão finalizada`);
    }
  });

  // Salva o processo na lista de transmissões ativas
  activeStreams[cameraId] = ffmpegProcess;

  return ffmpegProcess;
}

// Função para carregar câmeras do arquivo cameras.json e iniciar as transmissões
function startAllStreams() {
  if (!fs.existsSync(camerasFilePath)) {
    console.error('O arquivo cameras.json não foi encontrado.');
    return;
  }

  const cameras = JSON.parse(fs.readFileSync(camerasFilePath, 'utf-8'));
  if (!Array.isArray(cameras) || cameras.length === 0) {
    console.error('Nenhuma câmera configurada no arquivo cameras.json.');
    return;
  }

  // Inicia a transmissão para cada câmera
  cameras.forEach(cameraId => {
    startStream(cameraId);
  });
}

// Inicia todas as transmissões ao iniciar o servidor
startAllStreams();

// Serve os arquivos da transmissão (HLS) diretamente
app.use('/stream', express.static(streamDir));

// Rota para fornecer a lista de reprodução HLS
app.get('/stream/:cameraId', (req, res) => {
  const cameraId = req.params.cameraId;
  const m3u8Path = path.join(streamDir, cameraId, 'index.m3u8');
  
  // Verifica se o arquivo .m3u8 existe
  if (fs.existsSync(m3u8Path)) {
    res.sendFile(m3u8Path); // Serve o arquivo .m3u8
  } else {
    res.status(404).send('Transmissão não encontrada.');
  }
});

// Armazena processos de gravação por câmera
const recordingProcesses = {};

// Função para iniciar a gravação
function startRecording(cameraId, duration = 5) {
  if (isRecording) {
    console.log('A gravação já está em andamento.');
    return;
  }

  isRecording = true; // Marca que a gravação iniciou

  function record() {
    if (!isRecording) {
      console.log('Gravação pausada.');
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputFile = path.join(videosDir, `camera-${cameraId}-${timestamp}.mp4`);

    // Inicia o processo do FFmpeg
    const ffmpeg = spawn('ffmpeg', [
      '-f', 'dshow', // Usado para webcams no Windows
      '-i', `video=${cameraId}`, // Nome da câmera
      '-t', duration, // Duração de 5 segundos
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

      // Inicia uma nova gravação após 5 segundos (loop)
      if (isRecording) {
        record(); // Chama a função novamente para continuar gravando
      }
    });

    // Salva o processo FFmpeg para poder ser usado na pausa
    currentRecordingProcess = ffmpeg;
  }

  // Inicia a primeira gravação
  record();
}

// Função para pausar a gravação
function stopRecording() {
  if (isRecording) {
    isRecording = false;
    if (currentRecordingProcess) {
      currentRecordingProcess.kill(); // Finaliza o processo do FFmpeg
      console.log('Gravação pausada.');
    }
  } else {
    console.log('Não há gravação em andamento.');
  }
}

// Rota para iniciar gravação
app.get('/start/:cameraId', (req, res) => {
  const cameraId = req.params.cameraId;

  if (recordingProcesses[cameraId]) {
    return res.status(400).send(`Câmera ${cameraId} já está gravando.`);
  }

  const file = startRecording(cameraId);
  res.send(`Iniciando gravação da câmera ${cameraId} em: ${file}`);
});

// Rota para parar gravação
app.get('/stop/:cameraId', (req, res) => {
  const cameraId = req.params.cameraId;

  const stopped = stopRecording(cameraId);
  if (stopped) {
    res.send(`Gravação da câmera ${cameraId} parada.`);
  } else {
    res.status(400).send(`Câmera ${cameraId} não está gravando.`);
  }
});

// Rota para exibir a página inicial (listagem de câmeras)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rota para exibir a página de visualização (passando o ID da câmera)
app.get('/view', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'view.html'));
});

// Rota para exibir videos gravados
app.get('/videos-get', (req, res) => {  
  fs.readdir(videosDir, (err, files) => {
    if (err) {
      return res.status(500).send('Erro ao ler arquivos.');
    }
    
    // Filtra arquivos de vídeo
    const videoFiles = files.filter(file => file.endsWith('.mp4'));

    res.json(videoFiles); // Retorna a lista de vídeos como JSON
  });
});

// Rota para assistir vídeo
app.get('/assistir', (req, res) => {
  const videoName = req.query.video;
  if (!videoName) {
    return res.status(400).send('Nome do vídeo não fornecido.');
  }

  // Verifica se o vídeo existe
  const videoPath = path.join(videosDir, videoName);
  fs.access(videoPath, fs.constants.F_OK, (err) => {
    if (err) {
      return res.status(404).send('Vídeo não encontrado.');
    }

    // Renderiza a página de visualização de vídeo
    res.sendFile(path.join(__dirname, 'public', 'assistir.html'));
  });
});

// Rota para exibir videos gravados
app.get('/gravacoes', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'gravacoes.html'));
});

// Serve vídeos diretamente da pasta 'videos'
app.use('/videos', express.static(videosDir));

// Rota para listar as câmeras
app.get('/api/cameras', (req, res) => {
  Webcam.list((list) => {
    res.json(list); // Envia a lista de câmeras como resposta
  });
});

// Rota para servir o arquivo cameras.json
app.get('/cameras', (req, res) => {
  fs.readFile(path.join(__dirname, 'cameras.json'), 'utf8', (err, data) => {
    if (err) {
      return res.status(500).send('Erro ao ler o arquivo de câmeras');
    }
    res.json(JSON.parse(data)); // Retorna o conteúdo do cameras.json como resposta
  });
});

// Iniciar o servidor
app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});