import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../services/api';
import { Users, Lock, Clock, GamepadIcon, CheckCircle } from 'lucide-react';

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

function CreateRoom() {
  const navigate = useNavigate();
  const location = useLocation();
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [useSameAsName, setUseSameAsName] = useState(false);
  const [formData, setFormData] = useState({
    game_id: location.state?.gameId || '',
    room_name: '',
    password: '',
    max_players: 50,
    duration_hours: 24,
  });

  useEffect(() => {
    fetchMyGames();
  }, []);

  const fetchMyGames = async () => {
    try {
      const response = await api.get('/protected/games/my');
      setGames(response.data);
    } catch (error) {
      console.error('Erro ao buscar jogos:', error);
    }
  };

  const handleUseSameAsName = (checked) => {
    setUseSameAsName(checked);
    if (checked) {
      setFormData(prev => ({ ...prev, password: normalizarSenha(prev.room_name) }));
    } else {
      setFormData(prev => ({ ...prev, password: '' }));
    }
  };

  const handleRoomNameChange = (name) => {
    if (useSameAsName) {
      setFormData(prev => ({ ...prev, room_name: name, password: normalizarSenha(name) }));
    } else {
      setFormData(prev => ({ ...prev, room_name: name }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.game_id) {
      alert('Selecione um jogo');
      return;
    }

    if (formData.room_name.length < 3) {
      alert('Nome da sala deve ter pelo menos 3 caracteres');
      return;
    }

    if (!formData.password || formData.password.length < 3) {
      alert('Senha é obrigatória e deve ter pelo menos 3 caracteres');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        game_id: parseInt(formData.game_id),
        room_name: formData.room_name,
        password: normalizarSenha(formData.password),
        max_players: formData.max_players,
        duration_hours: formData.duration_hours,
      };

      const response = await api.post('/protected/rooms', payload);
      
      // Mostrar toast de sucesso
      setShowSuccessToast(true);
      
      // Redirecionar para Meus Jogos após 1.5 segundos
      setTimeout(() => {
        navigate('/my-games');
      }, 1500);
    } catch (error) {
      console.error('Erro ao criar sala:', error);
      const errorMessage = error.response?.data?.error || 'Erro ao criar sala. Tente novamente.';
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg py-8 px-4 pt-24">
      <div className="container mx-auto max-w-2xl">
        <div className="bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl shadow-lg p-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-dark-text-primary mb-6 flex items-center gap-2">
            <Users className="w-8 h-8" />
            Criar Sala de Jogo
          </h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Selecionar Jogo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-primary mb-2">
                <GamepadIcon className="inline w-4 h-4 mr-1" />
                Selecione um Jogo *
              </label>
              <select
                value={formData.game_id}
                onChange={(e) => setFormData({ ...formData, game_id: e.target.value })}
                className="w-full px-4 py-2 bg-white dark:bg-dark-elevated border border-gray-300 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-dark-text-primary"
                required
              >
                <option value="">Selecione um jogo...</option>
                {games.map((game) => (
                  <option key={game.id} value={game.id}>
                    {game.name} ({game.game_type === 'word_search' ? 'Caça-Palavras' : 'Quiz'})
                  </option>
                ))}
              </select>
              {games.length === 0 && (
                <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
                  Você ainda não criou nenhum jogo.{' '}
                  <button
                    type="button"
                    onClick={() => navigate('/create')}
                    className="underline hover:text-amber-700 dark:hover:text-amber-300"
                  >
                    Criar jogo agora
                  </button>
                </p>
              )}
            </div>

            {/* Nome da Sala */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-primary mb-2">
                Nome da Sala *
              </label>
              <input
                type="text"
                value={formData.room_name}
                onChange={(e) => handleRoomNameChange(e.target.value)}
                placeholder="Ex: Sala do 5º Ano A"
                className="w-full px-4 py-2 bg-white dark:bg-dark-elevated border border-gray-300 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-dark-text-primary placeholder-gray-400 dark:placeholder-gray-500"
                required
                minLength={3}
                maxLength={100}
              />
            </div>

            {/* Senha (Obrigatória) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-primary mb-2">
                <Lock className="inline w-4 h-4 mr-1" />
                Senha *
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Digite a senha da sala"
                className="w-full px-4 py-2 bg-white dark:bg-dark-elevated border border-gray-300 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-dark-text-primary placeholder-gray-400 dark:placeholder-gray-500"
                required
                minLength={3}
                disabled={useSameAsName}
              />
              
              
              {/* Checkbox para usar mesmo nome */}
              <div className="mt-3 flex items-center">
                <input
                  type="checkbox"
                  id="useSameAsName"
                  checked={useSameAsName}
                  onChange={(e) => handleUseSameAsName(e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
                />
                <label htmlFor="useSameAsName" className="ml-2 text-sm text-gray-700 dark:text-dark-text-primary cursor-pointer">
                  Usar o nome da sala como senha
                </label>
              </div>
              
              <p className="mt-2 text-xs text-gray-500 dark:text-dark-text-secondary">
                A senha é obrigatória para garantir que apenas alunos autorizados entrem na sala
              </p>
            </div>

            {/* Máximo de Jogadores */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-primary mb-2">
                <Users className="inline w-4 h-4 mr-1" />
                Máximo de Participantes: {formData.max_players}
              </label>
              <input
                type="range"
                min="2"
                max="100"
                value={formData.max_players}
                onChange={(e) => setFormData({ ...formData, max_players: parseInt(e.target.value) })}
                className="w-full accent-blue-600 dark:accent-blue-500"
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-dark-text-secondary">
                <span>2</span>
                <span>50</span>
                <span>100</span>
              </div>
            </div>

            {/* Duração */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-primary mb-2">
                <Clock className="inline w-4 h-4 mr-1" />
                Duração da Sala
              </label>
              <select
                value={formData.duration_hours}
                onChange={(e) => setFormData({ ...formData, duration_hours: parseInt(e.target.value) })}
                className="w-full px-4 py-2 bg-white dark:bg-dark-elevated border border-gray-300 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-dark-text-primary"
              >
                <option value={1}>1 hora</option>
                <option value={2}>2 horas</option>
                <option value={4}>4 horas</option>
                <option value={8}>8 horas</option>
                <option value={24}>24 horas (1 dia)</option>
                <option value={72}>72 horas (3 dias)</option>
                <option value={168}>168 horas (7 dias)</option>
              </select>
              <p className="mt-1 text-xs text-gray-500 dark:text-dark-text-secondary">
                A sala será fechada automaticamente após este período
              </p>
            </div>

            {/* Botões */}
            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={() => navigate('/my-games')}
                className="flex-1 px-6 py-3 bg-gray-100 dark:bg-dark-elevated text-gray-700 dark:text-dark-text-primary rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading || games.length === 0}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed"
              >
                {loading ? 'Criando...' : 'Criar Sala'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Toast de Sucesso */}
      {showSuccessToast && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in-right">
          <div className="bg-green-600 text-white px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 min-w-[300px]">
            <div className="flex-shrink-0">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="font-bold text-lg">Sala criada com sucesso!</p>
              <p className="text-sm text-green-100">Redirecionando...</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CreateRoom;
