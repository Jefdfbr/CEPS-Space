import { useState, useEffect, useRef } from 'react';
import { Clock, Star, CheckCircle, ChevronDown, ChevronLeft, ChevronRight, ZoomIn, Trophy } from 'lucide-react';
import { useRoomWebSocket } from '../../hooks/useRoomWebSocket';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

// Criar instância do axios com configuração
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para adicionar token/session_id automaticamente
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  const sessionId = localStorage.getItem('session_id');
  
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  } else if (sessionId) {
    config.headers['X-Session-Id'] = sessionId;
  }
  
  return config;
});

// Gerador de números pseudo-aleatórios com seed (Mulberry32)
const seededRandom = (seed) => {
  let state = 0;
  for (let i = 0; i < seed.length; i++) {
    state = (state + seed.charCodeAt(i)) | 0;
  }
  
  return function() {
    state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const WordSearchGame = ({ gameConfig, gameSeed, onComplete, roomId, playerColor }) => {
  const [grid, setGrid] = useState([]);
  const [words, setWords] = useState([]);
  const [foundWords, setFoundWords] = useState(new Set()); // Todas as palavras encontradas (todos os jogadores)
  const [myFoundWords, setMyFoundWords] = useState(new Set()); // Apenas minhas palavras
  const [otherPlayersWords, setOtherPlayersWords] = useState([]); // [{word, cells, playerColor}]
  const [selectedCells, setSelectedCells] = useState([]);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionDirection, setSelectionDirection] = useState(null); // Para travar direção
  const [time, setTime] = useState(0);
  const [finalTime, setFinalTime] = useState(0); // Tempo quando o jogo finaliza
  const [roomStartedAt, setRoomStartedAt] = useState(null);
  const [totalPauseDuration, setTotalPauseDuration] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameFinished, setGameFinished] = useState(false);
  const [showFinalScreen, setShowFinalScreen] = useState(false);
  const [score, setScore] = useState(0);
  const [roomScores, setRoomScores] = useState([]);
  const [totalRoomScore, setTotalRoomScore] = useState(0);
  const [expandedConcept, setExpandedConcept] = useState(null);
  const [loadingResult, setLoadingResult] = useState(true); // Flag para carregar resultado antes
  const [onlinePlayers, setOnlinePlayers] = useState([]); // Lista de jogadores online
  const [showHowToPlay, setShowHowToPlay] = useState(true); // Modal Como Jogar ao iniciar
  
  const gridRef = useRef(null);
  const timerRef = useRef(null);
  const randomRef = useRef(null);
  const gameFinishedRef = useRef(false); // Flag para evitar múltiplas chamadas de finishGame
  const [zoomLevel, setZoomLevel] = useState(1); // Zoom padrão normal para mobile (1x)
  const touchStartPosRef = useRef(null); // Posição inicial do toque

  // WebSocket para multiplayer
  const handleWebSocketMessage = (message) => {
    
    if (message.type === 'WordFound') {
      // Ignorar mensagens do próprio jogador (comparar pela cor e pelo player_id)
      const myPlayerId = localStorage.getItem('player_id');
      const isOwnMessage = (message.player_color === playerColor) || 
                           (message.player_id && myPlayerId && message.player_id.toString() === myPlayerId);
      
      if (!isOwnMessage) {
        
        // Adicionar palavra ao foundWords global
        setFoundWords(prev => {
          const updated = new Set([...prev, message.word.toUpperCase()]);
          return updated;
        });
        
        // Adicionar palavra encontrada por outro jogador
        setOtherPlayersWords(prev => {
          // Evitar duplicatas da mesma palavra pelo mesmo jogador
          const exists = prev.some(w => w.word === message.word && w.playerColor === message.player_color);
          if (exists) {
            return prev;
          }
          
          const updated = [
            ...prev,
            {
              word: message.word,
              cells: message.cells,
              playerColor: message.player_color,
              playerId: message.player_id,
              playerName: message.player_name
            }
          ];
          return updated;
        });
      }
    } else if (message.type === 'PlayerJoined') {
      setOnlinePlayers(prev => {
        // Evitar duplicatas
        if (prev.some(p => p.player_id === message.player_id)) {
          return prev;
        }
        return [...prev, { player_id: message.player_id, username: message.username }];
      });
    } else if (message.type === 'PlayerLeft') {
      setOnlinePlayers(prev => {
        const filtered = prev.filter(p => p.player_id !== message.player_id);
        return filtered;
      });
    } else if (message.type === 'PlayersList') {
      // Substituir completamente a lista (não mesclar)
      setOnlinePlayers(message.players || []);
    } else if (message.type === 'RoomReset') {
      console.log('🔄 Sala resetada, limpando tudo...');
      // Limpar todos os states
      setFoundWords(new Set());
      setMyFoundWords(new Set());
      setOtherPlayersWords([]);
      setOnlinePlayers([]);
      setScores([]);
      foundWordsLoadedRef.current = false;
      
      // Recarregar palavras do servidor (agora vazias)
      if (roomId) {
        fetch(`${import.meta.env.VITE_API_BASE_URL}/rooms/${roomId}/found-words`)
          .then(res => res.json())
          .then(data => {
            console.log('✅ Palavras recarregadas após reset (deve estar vazio):', data);
          })
          .catch(err => console.error('Erro ao recarregar palavras:', err));
      }
      
      // Forçar reload após 500ms para garantir que tudo foi limpo
      setTimeout(() => {
        window.location.reload();
      }, 500);
    }
  };

  const { isConnected, sendMessage } = useRoomWebSocket(roomId, handleWebSocketMessage);

  // Flag para evitar recarregar palavras múltiplas vezes
  const foundWordsLoadedRef = useRef(false);

  useEffect(() => {
    // SEMPRE recarregar ao montar o componente (grid mudou ou roomId mudou)
    if (roomId && grid.length > 0) {
      // Resetar flag ao entrar na sala
      foundWordsLoadedRef.current = true;
      const loadFoundWords = async () => {
        try {
          const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';
          const response = await fetch(`${API_URL}/rooms/${roomId}/found-words`);
          if (response.ok) {
            const foundWordsData = await response.json();
            const myColor = localStorage.getItem('player_color');
            
            // Criar novo grid com células marcadas
            const newGrid = grid.map(row => row.map(cell => ({ ...cell })));
            
            const otherWords = foundWordsData.filter(w => w.player_color !== myColor);
            setOtherPlayersWords(otherWords.map(w => {
              // Marcar células de outros jogadores no grid
              w.cells.forEach(({ row, col }, index) => {
                if (newGrid[row] && newGrid[row][col]) {
                  newGrid[row][col].isFound = true;
                  newGrid[row][col].foundBy = w.found_by_name;
                  newGrid[row][col].foundByColor = w.player_color;
                  newGrid[row][col].isFirstCell = index === 0; // Primeira célula da palavra
                }
              });
              return {
                word: w.word,
                cells: w.cells,
                playerColor: w.player_color,
                playerId: 0
              };
            }));
            
            const myWords = foundWordsData.filter(w => w.player_color === myColor);
            
            // Adicionar TODAS as palavras encontradas (minhas e de outros) ao Set foundWords
            const allFoundWords = new Set(foundWordsData.map(w => w.word.toUpperCase()));
            setFoundWords(allFoundWords);
            
            // Adicionar apenas MINHAS palavras ao Set myFoundWords
            const myFoundWordsSet = new Set(myWords.map(w => w.word.toUpperCase()));
            setMyFoundWords(myFoundWordsSet);
            
            if (myWords.length > 0) {
              // Marcar células das minhas próprias palavras no grid
              myWords.forEach(w => {
                w.cells.forEach(({ row, col }, index) => {
                  if (newGrid[row] && newGrid[row][col]) {
                    newGrid[row][col].isFound = true;
                    newGrid[row][col].foundBy = w.found_by_name;
                    newGrid[row][col].foundByColor = w.player_color;
                    newGrid[row][col].isFirstCell = index === 0;
                  }
                });
              });
            }
            
            // Atualizar grid com todas as células marcadas
            setGrid(newGrid);
          }
        } catch (error) {
          // Erro ao carregar palavras
        }
      };
      loadFoundWords();
    }
  }, [roomId, grid.length]);

  // Marcar células quando palavras de outros jogadores chegarem via WebSocket
  useEffect(() => {
    if (otherPlayersWords.length === 0 || grid.length === 0) return;

    setGrid(prevGrid => {
      const newGrid = prevGrid.map(row => row.map(cell => ({ ...cell })));
      
      otherPlayersWords.forEach(wordData => {
        wordData.cells.forEach(({ row, col }, index) => {
          if (newGrid[row] && newGrid[row][col]) {
            // Marcar célula independente se já foi encontrada (pode ser outra palavra)
            newGrid[row][col].isFound = true;
            newGrid[row][col].foundBy = wordData.playerName;
            newGrid[row][col].foundByColor = wordData.playerColor;
            newGrid[row][col].isFirstCell = index === 0;
          }
        });
      });
      
      return newGrid;
    });
  }, [otherPlayersWords]);

  // Carregar started_at da sala para sincronizar timer
  useEffect(() => {
    if (roomId) {
      const loadRoomTimer = async () => {
        try {
          const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';
          const response = await fetch(`${API_URL}/rooms/info-by-id/${roomId}`);
          if (response.ok) {
            const data = await response.json();
            if (data.room && data.room.started_at) {
              setRoomStartedAt(new Date(data.room.started_at));
              setTotalPauseDuration(data.room.total_pause_duration || 0);
            }
          }
        } catch (error) {
          // Erro ao carregar timer da sala
        }
      };
      
      // Carregar imediatamente
      loadRoomTimer();
      
      // Recarregar a cada 5 segundos para garantir sincronização
      const interval = setInterval(loadRoomTimer, 5000);
      
      return () => clearInterval(interval);
    }
  }, [roomId]);

  // Atualizar grid quando outros jogadores encontram palavras (via WebSocket em tempo real)
  useEffect(() => {
    if (otherPlayersWords.length > 0 && grid.length > 0) {
      const lastWord = otherPlayersWords[otherPlayersWords.length - 1];
      if (lastWord && lastWord.cells) {
        const newGrid = grid.map(row => row.map(cell => ({ ...cell })));
        
        lastWord.cells.forEach(({ row, col }, index) => {
          if (newGrid[row] && newGrid[row][col] && !newGrid[row][col].isFound) {
            newGrid[row][col].isFound = true;
            newGrid[row][col].foundByColor = lastWord.playerColor;
            newGrid[row][col].foundBy = lastWord.playerName || 'Jogador';
            newGrid[row][col].isFirstCell = index === 0;
          }
        });
        
        setGrid(newGrid);
        
        // Adicionar palavra à lista de encontradas (para todos os jogadores)
        setFoundWords(prev => new Set([...prev, lastWord.word.toUpperCase()]));
      }
    }
  }, [otherPlayersWords.length]);

  // Carregar pontuações da sala
  useEffect(() => {
    if (roomId) {
      const loadScores = async () => {
        try {
          const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';
          const response = await fetch(`${API_URL}/rooms/${roomId}/scores`);
          if (response.ok) {
            const scores = await response.json();
            setRoomScores(scores);
            
            // Calcular pontuação total da sala
            const total = scores.reduce((sum, player) => sum + player.total_score, 0);
            setTotalRoomScore(total);
            
            // Atualizar minha pontuação
            const mySessionId = localStorage.getItem('session_id');
            const myScore = scores.find(s => s.session_id === mySessionId);
            if (myScore) {
              setScore(myScore.total_score);
            }
          }
        } catch (error) {
          // Erro ao carregar pontuações
        }
      };
      
      // Carregar imediatamente
      loadScores();
      
      // Recarregar a cada 3 segundos
      const interval = setInterval(loadScores, 3000);
      
      return () => clearInterval(interval);
    }
  }, [roomId]);

  // Carregar resultado salvo do banco (para persistir tempo após refresh)
  // ESTE DEVE SER O PRIMEIRO useEffect A EXECUTAR
  useEffect(() => {
    const loadSavedResult = async () => {
      if (!gameConfig?.id && !gameConfig?.game_id) {
        setLoadingResult(false);
        return;
      }
      
      try {
        const gameId = gameConfig.game_id || gameConfig.id;
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';
        const url = roomId 
          ? `${API_URL}/game-results/${gameId}/${roomId}`
          : `${API_URL}/game-results/${gameId}`;
        
        const token = localStorage.getItem('token');
        const sessionId = localStorage.getItem('session_id');
        
        const headers = {
          'Content-Type': 'application/json',
        };
        
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        } else if (sessionId) {
          headers['X-Session-Id'] = sessionId;
        }
        
        const response = await fetch(url, { headers });
        
        if (response.ok) {
          const result = await response.json();
          
          // Restaurar estado do jogo finalizado
          setFinalTime(result.time_seconds);
          setTime(result.time_seconds);
          setScore(result.score);
          setGameFinished(true);
          setShowFinalScreen(false); // Mostrar navbar
          gameFinishedRef.current = true; // Marcar como já finalizado
          
          // Parar timer se estiver rodando
          if (timerRef.current) {
            clearInterval(timerRef.current);
          }
        } else if (response.status === 404) {
          // 404 é esperado se o jogo ainda não foi concluído ou foi resetado
          // Silenciosamente aceitar (não logar para não poluir console)
        }
      } catch (error) {
        // Erro ao carregar resultado salvo (network, etc)
        if (error.name !== 'AbortError') {
          console.log('⚠️ Erro ao carregar resultado:', error.message);
        }
      } finally {
        setLoadingResult(false); // Libera para continuar
      }
    };
    
    loadSavedResult();
  }, [gameConfig, roomId]);

  useEffect(() => {
    // Aguardar carregamento do resultado antes de iniciar qualquer coisa
    if (loadingResult) {
      return;
    }
    
    if (gameConfig) {
      // REGRA: 
      // - SEM SALA (roomId): Grid aleatório a cada carregamento (sem seed fixo)
      // - COM SALA (roomId): Grid fixo por sala (usa gameSeed da sala)
      if (roomId && gameSeed) {
        // Multiplayer: usar seed fixo da sala para posicionamento consistente
        randomRef.current = seededRandom(gameSeed);
      } else {
        // Solo ou sem seed: usar Math.random para grid aleatório a cada vez
        randomRef.current = Math.random;
      }
      
      generateGrid();
      setWords(gameConfig.words || []);
      
      // Só marcar como iniciado se não estiver finalizado
      if (!gameFinishedRef.current) {
        setGameStarted(true);
      }
    }
  }, [gameConfig, gameSeed, roomId, loadingResult]);

  useEffect(() => {
    // Não iniciar timer se o jogo já foi finalizado
    if (gameFinishedRef.current) {
      return;
    }
    
    if (gameStarted && !gameFinished) {
      timerRef.current = setInterval(() => {
        if (roomId) {
          // Modo multiplayer - SEMPRE usar timer sincronizado
          if (roomStartedAt) {
            const elapsed = Math.floor((Date.now() - roomStartedAt.getTime()) / 1000);
            const currentTime = Math.max(0, elapsed - totalPauseDuration);
            setTime(currentTime);
          }
        } else {
          // Timer local (modo solo)
          setTime((prev) => prev + 1);
        }
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [gameStarted, gameFinished, roomId, roomStartedAt, totalPauseDuration]);

  useEffect(() => {
    // No modo solo (sem roomId), finalizar quando encontrar todas as palavras
    if (!roomId) {
      if (foundWords.size === words.length && words.length > 0 && !gameFinished) {
        finishGame();
      }
    } else {
      // No modo multiplayer (com roomId), finalizar quando TODAS as palavras forem encontradas por QUALQUER jogador
      if (foundWords.size === words.length && words.length > 0 && !gameFinished) {
        finishGame();
      }
    }
  }, [foundWords, myFoundWords, words, roomId, gameFinished]);

  // Bloquear scroll apenas quando a tela final estiver aberta
  useEffect(() => {
    if (showFinalScreen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showFinalScreen]);

  // Inicializar primeira palavra com conceito como expandida
  useEffect(() => {
    if (gameConfig?.words && gameConfig?.concepts && expandedConcept === null) {
      const firstWordWithConcept = gameConfig.words.find(word => {
        const wordUpper = word.toUpperCase();
        return gameConfig.concepts[wordUpper];
      });
      
      if (firstWordWithConcept) {
        setExpandedConcept(firstWordWithConcept.toUpperCase());
      }
    }
  }, [gameConfig, expandedConcept]);

  const generateGrid = () => {
    const size = gameConfig.grid_size || 15;
    const newGrid = Array(size).fill(null).map((_, i) =>
      Array(size).fill(null).map((_, j) => ({
        letter: '',
        row: i,
        col: j,
        isFound: false,
        isSelected: false,
        foundBy: null,        // Nome do jogador que encontrou
        foundByColor: null,   // Cor do jogador que encontrou
        isFirstCell: false,   // Se é a primeira célula da palavra
      }))
    );
    
    // Inserir palavras na grade
    const wordsToPlace = gameConfig.words || [];
    
    // Mapear direções permitidas do banco de dados
    const directionMap = {
      right: { dx: 0, dy: 1 },      // horizontal direita →
      left: { dx: 0, dy: -1 },      // horizontal esquerda ←
      down: { dx: 1, dy: 0 },       // vertical baixo ↓
      up: { dx: -1, dy: 0 },        // vertical cima ↑
      downRight: { dx: 1, dy: 1 },  // diagonal ↘
      downLeft: { dx: 1, dy: -1 },  // diagonal ↙
      upRight: { dx: -1, dy: 1 },   // diagonal ↗
      upLeft: { dx: -1, dy: -1 },   // diagonal ↖
    };
    
    // Usar apenas direções permitidas ou todas por padrão
    const allowedDirectionKeys = gameConfig.allowed_directions || 
      ['right', 'left', 'down', 'up', 'downRight', 'downLeft', 'upRight', 'upLeft'];
    
    const directions = allowedDirectionKeys
      .map(key => directionMap[key])
      .filter(dir => dir !== undefined);

    wordsToPlace.forEach(word => {
      const wordUpper = word.toUpperCase();
      let placed = false;
      let attempts = 0;
      const maxAttempts = 100;

      while (!placed && attempts < maxAttempts) {
        attempts++;
        const direction = directions[Math.floor(randomRef.current() * directions.length)];
        const startRow = Math.floor(randomRef.current() * size);
        const startCol = Math.floor(randomRef.current() * size);

        if (canPlaceWord(newGrid, wordUpper, startRow, startCol, direction, size)) {
          placeWord(newGrid, wordUpper, startRow, startCol, direction);
          placed = true;
        }
      }

      if (!placed) {
        // Não foi possível colocar a palavra
      }
    });

    // Preencher células vazias com letras aleatórias
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        if (!newGrid[i][j].letter) {
          newGrid[i][j].letter = getRandomLetter();
        }
      }
    }
    
    setGrid(newGrid);
  };

  const canPlaceWord = (grid, word, startRow, startCol, direction, size) => {
    const endRow = startRow + direction.dx * (word.length - 1);
    const endCol = startCol + direction.dy * (word.length - 1);

    if (endRow < 0 || endRow >= size || endCol < 0 || endCol >= size) {
      return false;
    }

    for (let i = 0; i < word.length; i++) {
      const row = startRow + direction.dx * i;
      const col = startCol + direction.dy * i;
      const cell = grid[row][col];
      
      if (cell.letter && cell.letter !== word[i]) {
        return false;
      }
    }

    return true;
  };

  const placeWord = (grid, word, startRow, startCol, direction) => {
    for (let i = 0; i < word.length; i++) {
      const row = startRow + direction.dx * i;
      const col = startCol + direction.dy * i;
      grid[row][col].letter = word[i];
    }
  };

  const getRandomLetter = () => {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    return letters[Math.floor(randomRef.current() * letters.length)];
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCellMouseDown = (row, col) => {
    if (gameFinished) return;
    setIsSelecting(true);
    setSelectedCells([{ row, col }]);
    setSelectionDirection(null); // Resetar direção
  };

  const handleCellMouseEnter = (row, col) => {
    if (!isSelecting || gameFinished) return;
    
    if (selectedCells.length === 0) return;
    
    const firstCell = selectedCells[0];
    const lastCell = selectedCells[selectedCells.length - 1];
    
    // Se já existe direção travada, usar ela
    if (selectionDirection) {
      const { dx, dy } = selectionDirection;
      
      // Verificar se a célula está na linha da direção
      const expectedRow = firstCell.row + dx * selectedCells.length;
      const expectedCol = firstCell.col + dy * selectedCells.length;
      
      if (row === expectedRow && col === expectedCol) {
        setSelectedCells(prev => [...prev, { row, col }]);
      }
    } else if (selectedCells.length === 1) {
      // Primeira célula após o início - determinar direção
      const dx = Math.sign(row - firstCell.row);
      const dy = Math.sign(col - firstCell.col);
      
      // Verificar se é uma direção válida (horizontal, vertical ou diagonal)
      const isHorizontal = dx === 0 && dy !== 0;
      const isVertical = dx !== 0 && dy === 0;
      const isDiagonal = Math.abs(dx) === 1 && Math.abs(dy) === 1;
      
      if (isHorizontal || isVertical || isDiagonal) {
        setSelectionDirection({ dx, dy });
        setSelectedCells(prev => [...prev, { row, col }]);
      }
    }
  };

  const handleCellMouseUp = () => {
    if (!isSelecting || gameFinished) return;
    setIsSelecting(false);
    setSelectionDirection(null);
    checkWord();
    setSelectedCells([]);
  };

  const checkWord = () => {
    if (selectedCells.length < 2) return;

    const selectedWord = selectedCells
      .map(({ row, col }) => grid[row][col].letter)
      .join('');

    const reversedWord = selectedWord.split('').reverse().join('');

    const matchingWord = words.find(
      (word) => 
        word.toUpperCase() === selectedWord || 
        word.toUpperCase() === reversedWord
    );

    if (matchingWord && !foundWords.has(matchingWord.toUpperCase())) {
      const wordUpper = matchingWord.toUpperCase();
      setFoundWords((prev) => new Set([...prev, wordUpper]));
      setMyFoundWords((prev) => new Set([...prev, wordUpper]));
      markFoundCells();
      
      // Enviar via WebSocket para outros jogadores (se em uma sala)
      // A pontuação é calculada no backend quando a palavra é salva
      if (roomId && sendMessage) {
        sendMessage({
          type: 'WordFound',
          word: matchingWord.toUpperCase(),
          cells: selectedCells,
          foundAt: time  // Tempo em segundos quando a palavra foi encontrada
        });
      }
    }
  };

  const markFoundCells = () => {
    const newGrid = [...grid];
    const playerName = localStorage.getItem('player_name') || 'Você';
    
    selectedCells.forEach(({ row, col }, index) => {
      newGrid[row][col].isFound = true;
      newGrid[row][col].foundBy = playerName;
      newGrid[row][col].foundByColor = playerColor;
      newGrid[row][col].isFirstCell = index === 0;
    });
    setGrid(newGrid);
  };

  const finishGame = async () => {
    // Evitar múltiplas chamadas
    if (gameFinishedRef.current) {
      return;
    }
    
    gameFinishedRef.current = true;
    
    // Captura e congela o tempo final
    const currentFinalTime = roomStartedAt 
      ? Math.floor((Date.now() - roomStartedAt.getTime()) / 1000 - totalPauseDuration)
      : time;
    
    setFinalTime(currentFinalTime);
    setTime(currentFinalTime); // Congela o cronômetro no tempo final
    
    setGameFinished(true);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    // Salvar resultado no banco de dados APENAS se não existir
    try {
      const gameId = gameConfig.game_id || gameConfig.id;
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';
      
      // Verificar se já existe resultado salvo
      const checkUrl = roomId 
        ? `${API_URL}/game-results/${gameId}/${roomId}`
        : `${API_URL}/game-results/${gameId}`;
      
      const token = localStorage.getItem('token');
      const sessionId = localStorage.getItem('session_id');
      
      const headers = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      } else if (sessionId) {
        headers['X-Session-Id'] = sessionId;
      }
      
      const checkResponse = await fetch(checkUrl, { headers });
      
      if (checkResponse.status === 404) {
        // Não existe resultado ainda - tentar salvar (backend verifica de novo)
        const resultData = {
          game_id: gameId,
          room_id: roomId ? parseInt(roomId) : null,
          time_seconds: currentFinalTime,
          score: 0, // Backend calculará o score
          completed: true
        };
        
        const saveResponse = await api.post('/game-results', resultData);
        
        if (saveResponse.data.already_exists) {
          // Backend retornou que já existe - usar tempo e score existentes
          setFinalTime(saveResponse.data.time_seconds);
          setTime(saveResponse.data.time_seconds);
          setScore(saveResponse.data.score);
        } else {
          // Novo resultado salvo - usar o score calculado pelo backend
          setScore(saveResponse.data.score);
        }
      } else if (checkResponse.ok) {
        // Já existe resultado - usar o existente
        const existingResult = await checkResponse.json();
        
        // Usar o tempo e score salvos ao invés do atual
        setFinalTime(existingResult.time_seconds);
        setTime(existingResult.time_seconds);
        setScore(existingResult.score);
      }
    } catch (error) {
      // Não bloqueia o jogo se falhar ao salvar
    }
    
    // Não chamar onComplete no modo multiplayer para não sair do jogo
    // if (onComplete) {
    //   onComplete({ score, time, foundWords: foundWords.size });
    // }
  };

  const isCellSelected = (row, col) => {
    return selectedCells.some(cell => cell.row === row && cell.col === col);
  };

  const getOtherPlayerCellColor = (row, col) => {
    // Verifica se esta célula foi encontrada por outro jogador
    for (const playerWord of otherPlayersWords) {
      const isInWord = playerWord.cells.some(cell => cell.row === row && cell.col === col);
      if (isInWord) {
        return playerWord.playerColor;
      }
    }
    return null;
  };

  if (!gameConfig) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-500"></div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-dark-bg py-8 px-4 ${gameFinished && !showFinalScreen ? 'pt-24' : ''}`}>
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Game Grid */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-xl p-6 h-fit">
              {/* Cabeçalho - Responsivo */}
              <div className="mb-6">
                {/* Título */}
                <h2 className="text-2xl font-bold text-gray-900 dark:text-dark-text-primary mb-4 md:mb-0">
                  {gameConfig.name || 'Caça-Palavras'}
                </h2>
                
                {/* Stats - Empilhadas no mobile, inline no desktop */}
                <div className="flex flex-wrap gap-2 md:gap-4">
                  {roomId && (
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                      isConnected 
                        ? 'bg-green-50 dark:bg-green-900/20' 
                        : 'bg-red-50 dark:bg-red-900/20'
                    }`}>
                      <div className={`w-2 h-2 rounded-full ${
                        isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                      }`}></div>
                      <span className={`text-xs font-medium ${
                        isConnected 
                          ? 'text-green-700 dark:text-green-400' 
                          : 'text-red-700 dark:text-red-400'
                      }`}>
                        {isConnected ? `${onlinePlayers.length} online` : 'Desconectado'}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 px-3 md:px-4 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <Clock className="w-4 h-4 md:w-5 md:h-5 text-blue-600 dark:text-blue-400" />
                    <span className="font-mono text-base md:text-lg font-bold text-blue-600 dark:text-blue-400">
                      {formatTime(time)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 px-3 md:px-4 py-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                    <Star className="w-4 h-4 md:w-5 md:h-5 text-yellow-600 dark:text-yellow-400" fill="currentColor" />
                    <span className="font-mono text-base md:text-lg font-bold text-yellow-600 dark:text-yellow-400">
                      {score}
                    </span>
                  </div>
                </div>
              </div>

              {/* Controles Mobile (Zoom + Navegação) */}
              <div className="md:hidden flex justify-between items-center gap-2 mb-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const scrollContainer = document.querySelector('.grid-scroll-container');
                      if (scrollContainer) {
                        scrollContainer.scrollBy({ left: -150, behavior: 'smooth' });
                      }
                    }}
                    className="px-3 py-2 bg-white dark:bg-dark-elevated border border-gray-300 dark:border-gray-700 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => {
                      const scrollContainer = document.querySelector('.grid-scroll-container');
                      if (scrollContainer) {
                        scrollContainer.scrollBy({ left: 150, behavior: 'smooth' });
                      }
                    }}
                    className="px-3 py-2 bg-white dark:bg-dark-elevated border border-gray-300 dark:border-gray-700 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
                <button
                  onClick={() => setZoomLevel(prev => prev === 1 ? 1.4 : prev === 1.4 ? 1.8 : 1)}
                  className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-dark-elevated border border-gray-300 dark:border-gray-700 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300"
                >
                  <ZoomIn className="w-4 h-4" />
                  <span className="text-sm">{zoomLevel === 1 ? 'Normal' : zoomLevel === 1.4 ? 'Médio' : 'Grande'}</span>
                </button>
              </div>

              <div className="w-full overflow-x-auto overflow-y-visible md:overflow-visible grid-scroll-container" style={{ scrollBehavior: 'smooth' }}>
                <div className="flex justify-start md:justify-center">
                <div
                  ref={gridRef}
                  className="inline-block select-none"
                  onMouseUp={handleCellMouseUp}
                  onMouseLeave={handleCellMouseUp}
                  onTouchEnd={(e) => {
                    touchStartPosRef.current = null;
                    handleCellMouseUp();
                  }}
                  onTouchCancel={(e) => {
                    touchStartPosRef.current = null;
                    handleCellMouseUp();
                  }}
                  onTouchMove={(e) => {
                    if (!e.touches || e.touches.length !== 1) return;

                    const touch = e.touches[0];

                    // Sempre prevenir scroll durante movimento de toque
                    e.preventDefault();
                    
                    const el = document.elementFromPoint(touch.clientX, touch.clientY);
                    if (!el) return;
                    
                    let node = el;
                    while (node && node !== gridRef.current) {
                      if (node.dataset && node.dataset.row !== undefined && node.dataset.col !== undefined) {
                        const r = parseInt(node.dataset.row, 10);
                        const c = parseInt(node.dataset.col, 10);
                        if (!Number.isNaN(r) && !Number.isNaN(c)) {
                          handleCellMouseEnter(r, c);
                        }
                        break;
                      }
                      node = node.parentElement;
                    }
                  }}
                  onTouchStart={(e) => {
                    if (e.touches && e.touches.length === 1) {
                      // Salvar posição inicial
                      touchStartPosRef.current = {
                        x: e.touches[0].clientX,
                        y: e.touches[0].clientY
                      };
                    }
                  }}
                  style={{ 
                    scrollBehavior: 'smooth',
                    touchAction: 'none',
                    overscrollBehavior: 'contain',
                    transform: `scale(${zoomLevel})`,
                    transformOrigin: 'center top',
                    transition: 'transform 0.2s ease'
                  }}
                >
                <div className="grid gap-0.5 bg-gray-200 dark:bg-dark-elevated p-1 rounded-lg">
                  {grid.map((row, rowIndex) => (
                    <div key={rowIndex} className="flex gap-0.5">
                      {row.map((cell, colIndex) => {
                        const otherPlayerColor = getOtherPlayerCellColor(rowIndex, colIndex);
                        const isSelected = isCellSelected(rowIndex, colIndex);
                        
                        // Tamanho adaptativo baseado no grid size
                        const gridSize = grid.length;
                        const cellSizeClass = gridSize > 15 
                          ? 'w-6 h-6 md:w-8 md:h-8 text-xs md:text-sm' 
                          : 'w-8 h-8 md:w-10 md:h-10 text-sm md:text-base';
                        
                        return (
                          <div
                            key={`${rowIndex}-${colIndex}`}
                            className={`
                              ${cellSizeClass} flex items-center justify-center
                              font-bold cursor-pointer transition-all
                              relative
                              ${
                                cell.isFound
                                  ? 'text-white dark:text-dark-text-primary'
                                  : otherPlayerColor
                                  ? 'text-white dark:text-dark-text-primary'
                                  : isSelected
                                  ? 'bg-yellow-200 dark:bg-yellow-900/40 text-yellow-900 dark:text-yellow-300'
                                  : 'bg-white dark:bg-dark-surface text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800'
                              }
                            `}
                            style={{
                              backgroundColor: cell.isFound 
                                ? (cell.foundByColor || playerColor || '#10B981')
                                : otherPlayerColor 
                                ? otherPlayerColor 
                                : undefined,
                              opacity: otherPlayerColor ? 0.7 : 1
                            }}
                            data-row={rowIndex}
                            data-col={colIndex}
                            onMouseDown={() => handleCellMouseDown(rowIndex, colIndex)}
                            onMouseEnter={() => handleCellMouseEnter(rowIndex, colIndex)}
                            onTouchStart={(e) => { e.preventDefault(); handleCellMouseDown(rowIndex, colIndex); }}
                          >
                            {cell.letter}
                            {cell.isFirstCell && cell.foundBy && (
                              <div 
                                className="absolute -top-1 -left-1 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white border-2 border-white"
                                style={{ backgroundColor: cell.foundByColor || '#10B981' }}
                                title={`Encontrado por ${cell.foundBy}`}
                              >
                                {cell.foundBy.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
              </div>
              </div>
            </div>
          </div>

          {/* Words List */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-xl p-6 lg:sticky lg:top-24">
              <h3 className="text-xl font-bold text-gray-900 dark:text-dark-text-primary mb-4">
                Palavras ({foundWords.size}/{words.length})
              </h3>
              <div className="space-y-2">
                {words.map((word, index) => {
                  const wordUpper = word.toUpperCase();
                  const isFound = foundWords.has(wordUpper);
                  const hasConcept = gameConfig.concepts && gameConfig.concepts[wordUpper];
                  const isExpanded = expandedConcept === wordUpper;
                  
                  return (
                    <div
                      key={index}
                      className={`rounded-lg transition-all ${
                        isFound
                          ? 'bg-green-100 dark:bg-green-900/20'
                          : 'bg-gray-50 dark:bg-dark-surface'
                      }`}
                    >
                      <div
                        className={`px-4 py-3 ${
                          hasConcept ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800' : ''
                        }`}
                        onClick={() => hasConcept && setExpandedConcept(isExpanded ? null : wordUpper)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`font-medium ${
                              isFound
                                ? 'text-green-700 dark:text-green-400 line-through'
                                : 'text-gray-900 dark:text-gray-100'
                            }`}>
                              {word}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {isFound && (
                              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                            )}
                            {hasConcept && (
                              <ChevronDown 
                                className={`w-4 h-4 text-gray-500 transition-transform ${
                                  isExpanded ? 'rotate-180' : ''
                                }`}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {hasConcept && isExpanded && (
                        <div className="px-4 pb-3 pt-1">
                          <div className="text-sm text-gray-600 dark:text-dark-text-secondary bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border-l-4 border-blue-500">
                            {gameConfig.concepts[wordUpper]}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Pontuações Multiplayer */}
              {roomId && roomScores.length > 0 && (
                <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <h4 className="font-bold text-blue-900 dark:text-blue-300 mb-3 flex items-center justify-between">
                    <span className="flex items-center gap-2"><Trophy className="w-5 h-5" /> Pontuações</span>
                    <span className="text-sm bg-blue-200 dark:bg-blue-800 px-2 py-1 rounded font-semibold">
                      Sala: {totalRoomScore} pts
                    </span>
                  </h4>
                  <div className="space-y-2">
                    {/* Mostrar apenas jogadores que têm score no banco (roomScores) */}
                    {roomScores
                      .sort((a, b) => (b.total_score || 0) - (a.total_score || 0))
                      .map((player, index) => {
                      const isMe = player.session_id === localStorage.getItem('session_id');
                      return (
                        <div
                          key={player.session_id}
                          className={`flex items-center justify-between p-3 rounded-lg ${
                            isMe 
                              ? 'bg-yellow-100/70 dark:bg-yellow-900/40 border-2 border-yellow-400 dark:border-yellow-600' 
                              : 'bg-white/60 dark:bg-white/10'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-700 dark:text-dark-text-primary w-6">
                              #{index + 1}
                            </span>
                            <div 
                              className="w-5 h-5 rounded-full border-2 border-white shadow-md" 
                              style={{ backgroundColor: player.player_color }}
                            />
                            <span className={`text-sm font-medium text-gray-900 dark:text-dark-text-primary ${isMe ? 'font-bold' : ''}`}>
                              {player.player_name} {isMe && '(Você)'}
                            </span>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-blue-900 dark:text-blue-300 text-base">
                              {player.total_score} pts
                            </div>
                            <div className="text-xs text-gray-600 dark:text-dark-text-secondary font-medium">
                              {player.words_found} palavra{player.words_found !== 1 ? 's' : ''}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <h4 className="font-bold text-blue-900 dark:text-blue-300 mb-2">
                  Como Jogar:
                </h4>
                <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
                  <li>• Clique e arraste para selecionar palavras</li>
                  <li>• Palavras podem estar em qualquer direção</li>
                  <li>• Quanto mais rápido, mais pontos!</li>
                  {gameConfig?.concepts && Object.keys(gameConfig.concepts).length > 0 && (
                    <li>• Clique nas palavras encontradas para ver os conceitos e aprender mais</li>
                  )}
                  <li>• Quando você e sua equipe encontrarem todas as palavras, aparecerá uma barra verde no topo da tela para continuar</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navbar de Jogo Finalizado */}
      {gameFinished && !showFinalScreen && (
        <div className="fixed top-0 left-0 right-0 bg-green-600 shadow-lg z-50">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-white" />
              <span className="text-white font-bold text-lg">Jogo Finalizado</span>
            </div>
            <button
              onClick={() => setShowFinalScreen(true)}
              className="px-6 py-2 bg-white text-green-600 rounded-lg font-bold hover:bg-gray-100 transition-colors shadow-md"
            >
              Finalizar
            </button>
          </div>
        </div>
      )}

      {/* Modal de Conclusão - Tela Final */}
      {gameFinished && showFinalScreen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-2xl max-w-2xl w-full mx-auto border-4 border-green-500 dark:border-green-600 animate-in fade-in duration-300">
            <div className="p-8">
              <div className="flex items-center justify-center gap-4 mb-6">
                <CheckCircle className="w-16 h-16 text-green-600 dark:text-green-400" />
                <h2 className="text-4xl font-bold text-green-900 dark:text-green-300">
                  Parabéns!
                </h2>
              </div>
              
              <div className="text-center space-y-4 mb-6">
                <p className="text-xl text-gray-700 dark:text-dark-text-primary">
                  Você encontrou todas as palavras!
                </p>
                
                <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-200 dark:border-blue-800">
                    <div className="text-sm text-blue-600 dark:text-blue-400 mb-1">Tempo</div>
                    <div className="text-2xl font-bold text-blue-900 dark:text-blue-300">
                      {formatTime(finalTime)}
                    </div>
                  </div>
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-xl border border-yellow-200 dark:border-yellow-800">
                    <div className="text-sm text-yellow-600 dark:text-yellow-400 mb-1">Pontuação</div>
                    <div className="text-2xl font-bold text-yellow-900 dark:text-yellow-300">{score} pts</div>
                  </div>
                </div>
              </div>
              
              {gameConfig.end_screen_text && (
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-6 rounded-xl border border-green-200 dark:border-green-800 mb-6">
                  <p className="text-lg text-green-900 dark:text-green-300 font-medium text-center">
                    {gameConfig.end_screen_text}
                  </p>
                </div>
              )}
              
              {gameConfig.end_screen_button_text && gameConfig.end_screen_button_url ? (
                <div className="flex justify-center">
                  <a
                    href={gameConfig.end_screen_button_url}
                    target={gameConfig.end_screen_button_new_tab !== false ? "_blank" : "_self"}
                    rel={gameConfig.end_screen_button_new_tab !== false ? "noopener noreferrer" : undefined}
                    className="px-8 py-4 bg-green-600 hover:bg-green-700 text-white text-lg font-bold rounded-xl transition-all transform hover:scale-105 shadow-lg"
                  >
                    {gameConfig.end_screen_button_text}
                  </a>
                </div>
              ) : (
                <div className="flex gap-4 justify-center">
                  <button
                    onClick={() => window.location.reload()}
                    className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white text-lg font-bold rounded-xl transition-all transform hover:scale-105 shadow-lg"
                  >
                    Jogar Novamente
                  </button>
                  <button
                    onClick={() => window.location.href = 'https://clubevip.space/games'}
                    className="px-8 py-4 bg-green-600 hover:bg-green-700 text-white text-lg font-bold rounded-xl transition-all transform hover:scale-105 shadow-lg"
                  >
                    Mais Jogos
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Como Jogar - Exibido ao iniciar o jogo */}
      {showHowToPlay && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-2xl max-w-lg w-full mx-auto border-4 border-blue-500 dark:border-blue-600 animate-in fade-in duration-300">
            <div className="p-8">
              <div className="flex items-center justify-center gap-3 mb-6">
                <Star className="w-12 h-12 text-blue-600 dark:text-blue-400" />
                <h2 className="text-3xl font-bold text-blue-900 dark:text-blue-300">
                  Como Jogar
                </h2>
              </div>
              
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 mb-6">
                <ul className="text-base text-blue-700 dark:text-blue-400 space-y-3">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 dark:text-blue-400 font-bold">•</span>
                    <span>Clique e arraste para selecionar palavras</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 dark:text-blue-400 font-bold">•</span>
                    <span>Palavras podem estar em qualquer direção</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 dark:text-blue-400 font-bold">•</span>
                    <span>Quanto mais rápido, mais pontos!</span>
                  </li>
                  {gameConfig?.concepts && Object.keys(gameConfig.concepts).length > 0 && (
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 dark:text-blue-400 font-bold">•</span>
                      <span>Clique nas palavras encontradas para ver os conceitos e aprender mais</span>
                    </li>
                  )}
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 dark:text-blue-400 font-bold">•</span>
                    <span>Quando você e sua equipe encontrarem todas as palavras, aparecerá uma barra verde no topo da tela para continuar</span>
                  </li>
                </ul>
              </div>

              <button
                onClick={() => setShowHowToPlay(false)}
                className="w-full px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white text-lg font-bold rounded-xl transition-all transform hover:scale-105 shadow-lg"
              >
                Entendi, Começar!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WordSearchGame;
