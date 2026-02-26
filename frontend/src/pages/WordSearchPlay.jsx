import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import WordSearchGame from '../components/games/WordSearchGame';
import api from '../services/api';

// Normalizar senha (minúsculas e sem acentos) - igual ao GameAccess
const normalizarSenha = (senha) => {
  if (!senha) return '';
  return senha
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ç/g, 'c')
    .replace(/Ç/g, 'c');
};

const WordSearchPlay = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const gameId = searchParams.get('game_id');
  const roomId = searchParams.get('room_id');
  const seed = searchParams.get('seed');
  const passwordParam = searchParams.get('password');
  const playerNameParam = searchParams.get('player_name');
  
  const [gameConfig, setGameConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [playerColor, setPlayerColor] = useState(null);
  const [myPlayerId, setMyPlayerId] = useState(null);
  const [authorized, setAuthorized] = useState(false);

  // PROTEÇÃO CRÍTICA - Executa IMEDIATAMENTE antes de qualquer renderização
  useEffect(() => {
    const checkAuth = async () => {
      const sessionId = localStorage.getItem('session_id');
      const token = localStorage.getItem('token');

      // BLOQUEIO 1: Se tentou acessar SEM game_id, bloquear
      if (!gameId) {
        alert('❌ Acesso negado!\n\nVocê precisa entrar pelo menu de jogos.');
        navigate('/games');
        return;
      }

      // Já tem autenticação válida (inclusive após redirect interno)
      if (sessionId || token) {
        setAuthorized(true);
        return;
      }

      // Sem autenticação, mas com senha e nome via GET params → entrar automaticamente
      if (passwordParam && playerNameParam) {
        try {
          let resolvedRoomId = roomId;
          let roomCode;

          if (resolvedRoomId) {
            // room_id fornecido: entrar direto nessa sala
            const roomInfoRes = await api.get(`/rooms/info-by-id/${resolvedRoomId}`);
            roomCode = roomInfoRes.data.room.room_code;
            localStorage.setItem('current_room_name', roomInfoRes.data.room.room_name || roomCode);
          } else {
            // Sem room_id: buscar salas do jogo e tentar a senha em cada uma
            const roomsRes = await api.get(`/rooms/by-game/${gameId}`);
            const activeRooms = roomsRes.data.filter(r => r.is_active);
            if (activeRooms.length === 0) {
              // Nenhuma sala ativa → modo solo
              setAuthorized(true);
              return;
            }
            let matched = null;
            for (const room of activeRooms) {
              try {
                const testRes = await api.post('/rooms/join-anonymous', {
                  room_code: room.room_code,
                  password: normalizarSenha(passwordParam),
                  player_name: playerNameParam,
                  existing_session_id: localStorage.getItem('session_id') || undefined,
                });
                matched = { room, joinData: testRes.data };
                break;
              } catch (_) { continue; }
            }
            if (!matched) {
              navigate(`/game?game_id=${gameId}`);
              return;
            }
            // Salvar sessão e redirecionar com room_id + seed na URL
            const { session_id, player_color, player_name } = matched.joinData;
            localStorage.setItem('session_id', session_id);
            localStorage.setItem('player_name', player_name);
            localStorage.setItem('player_color', player_color);
            localStorage.setItem('current_room_name', matched.room.room_name || matched.room.room_code);
            const roomSeed = matched.room.game_seed || matched.room.room_code;
            const params = new URLSearchParams({
              game_id: gameId,
              room_id: matched.joinData.room_id,
              seed: roomSeed,
              password: passwordParam,
              player_name: playerNameParam,
            });
            navigate(`/play/word-search?${params}`, { replace: true });
            return;
          }

          const existingSessionId = localStorage.getItem('session_id');
          const joinRes = await api.post('/rooms/join-anonymous', {
            room_code: roomCode,
            password: normalizarSenha(passwordParam),
            player_name: playerNameParam,
            existing_session_id: existingSessionId || undefined,
          });

          const { session_id, player_color, player_name } = joinRes.data;
          localStorage.setItem('session_id', session_id);
          localStorage.setItem('player_name', player_name);
          localStorage.setItem('player_color', player_color);

          setAuthorized(true);
        } catch (err) {
          // Senha incorreta ou erro → redirecionar para GameAccess
          navigate(`/game?game_id=${gameId}`);
        }
        return;
      }

      // Sem room_id e sem senha → modo solo
      if (!roomId) {
        setAuthorized(true);
        return;
      }

      // Tem room_id mas sem autenticação e sem senha → GameAccess
      navigate(`/game?game_id=${gameId}`);
    };

    checkAuth();
  }, [gameId, roomId, passwordParam, playerNameParam, navigate]);

  // Só carregar o jogo SE estiver autorizado
  useEffect(() => {
    if (authorized && gameId) {
      loadGame();
    }
  }, [authorized, gameId]);

  const loadGame = async () => {
    try {
      const [gameResponse, configResponse] = await Promise.all([
        api.get(`/games/${gameId}`),
        api.get(`/word-search/${gameId}`)
      ]);
      
      setGameConfig({
        ...gameResponse.data,
        ...configResponse.data
      });

      // Se estiver em uma sala, buscar a cor do jogador
      if (roomId) {
        try {
          // Verificar se é jogador anônimo ou autenticado
          const sessionId = localStorage.getItem('session_id');
          const playerColorStored = localStorage.getItem('player_color');
          
          // Se for jogador anônimo e já tiver a cor armazenada
          if (sessionId && playerColorStored) {
            setPlayerColor(playerColorStored);
            // Computar myPlayerId usando MESMA lógica do backend (hash do session_id)
            let hash = 0;
            for (let i = 0; i < sessionId.length; i++) {
              hash = (hash + sessionId.charCodeAt(i)) | 0;
            }
            setMyPlayerId((Math.abs(hash) % 1000000) + 1);
            console.log('Cor do jogador (anônimo):', playerColorStored);
          } else if (!sessionId) {
            // Jogador autenticado - buscar do backend
            const roomResponse = await api.get(`/protected/rooms/${roomId}`);
            
            // Obter user_id do token (campo 'sub' no JWT)
            const token = localStorage.getItem('token');
            if (token) {
              const payload = JSON.parse(atob(token.split('.')[1]));
              const currentUserId = payload.sub; // 'sub' é o campo correto
              setMyPlayerId(currentUserId);
              
              // Encontrar participante atual
              const participant = roomResponse.data.participants.find(p => p.user_id === currentUserId);
              if (participant && participant.player_color) {
                setPlayerColor(participant.player_color);
                console.log('Cor do jogador (autenticado):', participant.player_color);
              }
            }
          }
        } catch (error) {
          console.error('Erro ao buscar cor do jogador:', error);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar jogo:', error);
      alert('Erro ao carregar jogo');
      navigate('/games');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = () => {
    navigate('/games');
  };

  // BLOQUEIO VISUAL: Não renderizar NADA enquanto não estiver autorizado
  if (!authorized) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-600"></div>
          <p className="mt-4 text-white">Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-600"></div>
          <p className="mt-4 text-white">Carregando jogo...</p>
        </div>
      </div>
    );
  }

  if (!gameConfig) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-center text-white">
          <h2 className="text-2xl font-bold mb-4">Jogo não encontrado</h2>
          <button
            onClick={() => navigate('/games')}
            className="px-6 py-3 bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            Voltar para Jogos
          </button>
        </div>
      </div>
    );
  }

  return (
    <WordSearchGame 
      gameConfig={gameConfig} 
      gameSeed={seed}
      onComplete={handleComplete}
      roomId={roomId}
      playerColor={playerColor}
      myPlayerId={myPlayerId}
    />
  );
};

export default WordSearchPlay;

