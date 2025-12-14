import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Play, Lock, User, AlertCircle } from 'lucide-react';

// Função para normalizar senha (minúsculas e sem acentos)
const normalizarSenha = (senha) => {
  if (!senha) return '';
  return senha
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/ç/g, 'c')
    .replace(/Ç/g, 'c');
};

function GameAccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const gameId = searchParams.get('game_id');
  
  const [game, setGame] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    password: '',
    playerName: localStorage.getItem('player_name') || '',
  });

  useEffect(() => {
    loadGameAndRooms();
  }, [gameId]);

  const loadGameAndRooms = async () => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';
      
      // Buscar informações do jogo
      const gameResponse = await axios.get(`${API_URL}/games/${gameId}`);
      setGame(gameResponse.data);

      // Buscar salas ativas para este jogo (endpoint público)
      try {
        const roomsResponse = await axios.get(`${API_URL}/rooms/by-game/${gameId}`);
        const activeRooms = roomsResponse.data.filter(room => room.is_active);
        setRooms(activeRooms);

        // Se houver apenas uma sala, preencher automaticamente o código
        if (activeRooms.length === 1) {
          setFormData(prev => ({
            ...prev,
            roomCode: activeRooms[0].room_code
          }));
        }
      } catch (err) {
        console.error('Erro ao buscar salas:', err);
        setRooms([]);
      }
    } catch (err) {
      console.error('Erro ao carregar jogo:', err);
      setError('Jogo não encontrado');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';
      
      // Tentar autenticar em todas as salas até encontrar a correta
      let authenticated = false;
      let roomData = null;

      for (const room of rooms) {
        try {
          // Verificar se já existe session_id para esta sala no localStorage
          const existingSessionId = localStorage.getItem('session_id');
          
          const response = await axios.post(`${API_URL}/rooms/join-anonymous`, {
            room_code: room.room_code,
            password: normalizarSenha(formData.password),
            player_name: formData.playerName,
            existing_session_id: existingSessionId || undefined,
          });

          // Encontrou a sala correta!
          roomData = response.data;
          authenticated = true;
          break;
        } catch (err) {
          // Senha não corresponde a esta sala, tentar próxima
          continue;
        }
      }

      if (!authenticated) {
        setError('Senha incorreta. Nenhuma sala encontrada com essa senha.');
        setSubmitting(false);
        return;
      }

      // Armazenar session_id no localStorage
      const { session_id, room_id, player_color, player_name, room_code } = roomData;
      localStorage.setItem('session_id', session_id);
      localStorage.setItem('player_name', player_name);
      localStorage.setItem('player_color', player_color);

      // Buscar detalhes da sala
      const roomResponse = await axios.get(`${API_URL}/rooms/info/${room_code}`);
      const { room } = roomResponse.data;
      const seed = room.game_seed || room_code;

      // Redirecionar para o jogo apropriado
      if (game.game_type === 'word_search') {
        navigate(`/play/word-search?game_id=${gameId}&room_id=${room_id}&seed=${seed}`);
      } else if (game.game_type === 'quiz') {
        navigate(`/play/quiz?game_id=${gameId}&room_id=${room_id}&seed=${seed}`);
      }
    } catch (err) {
      console.error('Erro ao entrar na sala:', err);
      if (err.response?.status === 403) {
        setError('Sala cheia');
      } else if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else {
        setError('Erro ao entrar na sala. Tente novamente.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
          <p className="mt-4 text-gray-600 dark:text-dark-text-secondary">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark-bg flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-dark-text-primary mb-2">
            Jogo não encontrado
          </h2>
          <button
            onClick={() => navigate('/')}
            className="mt-4 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Voltar ao Início
          </button>
        </div>
      </div>
    );
  }

  if (rooms.length === 0) {
    // Modo single player - sem salas, apenas diversão
    const handlePlayAlone = () => {
      const playerName = formData.playerName || 'Jogador';
      const randomColor = `#${Math.floor(Math.random()*16777215).toString(16)}`;
      
      localStorage.setItem('player_name', playerName);
      localStorage.setItem('player_color', randomColor);
      
      const seed = `solo-${Date.now()}`;
      
      // Redirecionar para o jogo sem room_id (modo single player)
      if (game.game_type === 'word_search') {
        navigate(`/play/word-search?game_id=${gameId}&seed=${seed}`);
      } else if (game.game_type === 'quiz') {
        navigate(`/play/quiz?game_id=${gameId}&seed=${seed}`);
      }
    };

    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark-bg flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-600 rounded-full mb-4">
              <Play className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-dark-text-primary mb-2">
              {game.name}
            </h1>
            <p className="text-gray-600 dark:text-dark-text-secondary mb-2">
              Modo Diversão - Jogue sozinho!
            </p>
            <div className="inline-block px-4 py-2 bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 rounded-lg text-sm">
              Sem salas ativas - modo single player
            </div>
          </div>

          <div className="bg-white dark:bg-dark-elevated rounded-2xl shadow-xl p-8">
            <form onSubmit={(e) => { e.preventDefault(); handlePlayAlone(); }} className="space-y-6">
              {/* Nome do Jogador */}
              <div>
                <label htmlFor="playerName" className="block text-sm font-medium text-gray-700 dark:text-dark-text-primary mb-2">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Seu Nome
                  </div>
                </label>
                <input
                  type="text"
                  id="playerName"
                  name="playerName"
                  value={formData.playerName}
                  onChange={handleChange}
                  placeholder="Digite seu nome"
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 dark:text-dark-text-primary"
                />
              </div>

              <button
                type="submit"
                className="w-full py-4 px-6 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
              >
                <Play className="w-5 h-5" />
                Jogar Agora
              </button>

              <button
                type="button"
                onClick={() => navigate('/')}
                className="w-full py-3 px-6 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-dark-text-primary font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Voltar ao Início
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
            <Play className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-dark-text-primary mb-2">
            {game.name}
          </h1>
          <p className="text-gray-600 dark:text-dark-text-secondary">
            Digite a senha e seu nome para entrar
          </p>
          {rooms.length === 1 && (
            <div className="mt-4 inline-block px-4 py-2 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-lg text-sm">
              1 sala disponível
            </div>
          )}
          {rooms.length > 1 && (
            <div className="mt-4 inline-block px-4 py-2 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-lg text-sm">
              {rooms.length} salas - você será direcionado automaticamente
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-dark-elevated rounded-2xl shadow-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Senha */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-dark-text-primary mb-2">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Senha da Sala
                </div>
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Digite a senha"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg \
                         focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-dark-text-primary"
                required
                autoFocus
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-dark-text-secondary">
                A sala correta será identificada automaticamente pela senha
              </p>
            </div>

            {/* Nome do Jogador */}
            <div>
              <label htmlFor="playerName" className="block text-sm font-medium text-gray-700 dark:text-dark-text-primary mb-2">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Seu Nome
                </div>
              </label>
              <input
                type="text"
                id="playerName"
                name="playerName"
                value={formData.playerName}
                onChange={handleChange}
                placeholder="Como deseja ser chamado?"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg 
                         focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-dark-text-primary"
                minLength={2}
                maxLength={50}
                required
              />
            </div>

            {/* Erro */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
              </div>
            )}

            {/* Botão */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg
                       transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  Entrando...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  Entrar e Jogar
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default GameAccess;
