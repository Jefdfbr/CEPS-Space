import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Play, Lock, User } from 'lucide-react';

function JoinGame() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    password: '',
    playerName: '',
    gameId: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
    setLoading(true);

    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';
      
      // Buscar salas do jogo ou todas as salas ativas
      let rooms = [];
      if (formData.gameId) {
        const roomsResponse = await axios.get(`${API_URL}/rooms/by-game/${formData.gameId}`);
        rooms = roomsResponse.data;
      } else {
        const allRoomsResponse = await axios.get(`${API_URL}/rooms/active`);
        rooms = allRoomsResponse.data;
      }

      // Tentar autenticar em todas as salas até encontrar a correta
      let authenticated = false;
      let roomData = null;

      for (const room of rooms) {
        try {
          const response = await axios.post(`${API_URL}/rooms/join-anonymous`, {
            room_code: room.room_code,
            password: formData.password,
            player_name: formData.playerName,
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
        setLoading(false);
        return;
      }

      // Armazenar session_id no localStorage
      const { session_id, room_id, player_color, player_name, room_code } = roomData;
      localStorage.setItem('session_id', session_id);
      localStorage.setItem('player_name', player_name);
      localStorage.setItem('player_color', player_color);

      // Buscar detalhes da sala para saber qual jogo
      const roomResponse = await axios.get(`${API_URL}/rooms/info/${room_code}`);

      const { game, room } = roomResponse.data;
      const seed = room.game_seed || room_code;

      // Redirecionar para o jogo apropriado
      if (game.game_type === 'word_search') {
        navigate(`/play/word-search?game_id=${game.id}&room_id=${room_id}&seed=${seed}`);
      } else if (game.game_type === 'quiz') {
        navigate(`/play/quiz?game_id=${game.id}&room_id=${room_id}&seed=${seed}`);
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
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
            <Play className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-dark-text-primary mb-2">
            Entrar no Jogo
          </h1>
          <p className="text-gray-600 dark:text-dark-text-secondary">
            Digite a senha da sala e seu nome para jogar
          </p>
        </div>

        <div className="bg-white dark:bg-dark-elevated rounded-2xl shadow-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* ID do Jogo (opcional) */}
            <div>
              <label htmlFor="gameId" className="block text-sm font-medium text-gray-700 dark:text-dark-text-primary mb-2">
                ID do Jogo (opcional)
              </label>
              <input
                type="number"
                id="gameId"
                name="gameId"
                value={formData.gameId}
                onChange={handleChange}
                placeholder="Deixe em branco para buscar em todos os jogos"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg 
                         focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-dark-text-primary"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-dark-text-secondary">
                Se souber o ID do jogo, preencha para acelerar
              </p>
            </div>

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
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg 
                         focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-dark-text-primary"
                required
                autoFocus
              />
              <p className="mt-2 text-xs text-gray-500 dark:text-dark-text-secondary">
                A sala correta será identificada automaticamente
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
              disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg
                       transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
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

        <div className="text-center mt-6">
          <p className="text-sm text-gray-600 dark:text-dark-text-secondary">
            Não precisa criar conta! Basta ter o código da sala.
          </p>
        </div>
      </div>
    </div>
  );
}

export default JoinGame;
