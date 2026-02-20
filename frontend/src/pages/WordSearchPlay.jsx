import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import WordSearchGame from '../components/games/WordSearchGame';
import api from '../services/api';

const WordSearchPlay = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const gameId = searchParams.get('game_id');
  const roomId = searchParams.get('room_id');
  const seed = searchParams.get('seed');
  
  const [gameConfig, setGameConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [playerColor, setPlayerColor] = useState(null);
  const [myPlayerId, setMyPlayerId] = useState(null);
  const [authorized, setAuthorized] = useState(false);

  // PROTEÇÃO CRÍTICA - Executa IMEDIATAMENTE antes de qualquer renderização
  useEffect(() => {
    console.log('🔒 VERIFICAÇÃO DE SEGURANÇA - WordSearchPlay');
    console.log('gameId:', gameId);
    console.log('roomId:', roomId);
    
    const sessionId = localStorage.getItem('session_id');
    const token = localStorage.getItem('token');
    
    console.log('session_id:', sessionId ? 'EXISTS' : 'NULL');
    console.log('token:', token ? 'EXISTS' : 'NULL');

    // BLOQUEIO 1: Se tentou acessar SEM game_id, bloquear
    if (!gameId) {
      console.error('❌ BLOQUEADO: Sem game_id');
      alert('❌ Acesso negado!\n\nVocê precisa entrar pelo menu de jogos.');
      navigate('/games');
      return;
    }

    // BLOQUEIO 2: Se tem room_id mas não tem autenticação, bloquear
    if (roomId && !sessionId && !token) {
      console.error('❌ BLOQUEADO: Tentou entrar em sala sem autenticação');
      navigate(`/game?game_id=${gameId}`);
      return;
    }
    
    // Se passou por TODAS as verificações, autorizar
    console.log('✅ ACESSO AUTORIZADO');
    setAuthorized(true);
  }, [gameId, roomId, navigate]);

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

