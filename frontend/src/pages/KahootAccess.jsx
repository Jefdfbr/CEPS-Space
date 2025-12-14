import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Lock, Play, Eye } from 'lucide-react';
import api from '../services/api';

function KahootAccess() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleJoin = async (e) => {
    e.preventDefault();

    if (!playerName.trim()) {
      alert('Por favor, digite seu nome');
      return;
    }

    if (!password.trim()) {
      alert('Por favor, digite a senha');
      return;
    }

    setLoading(true);

    try {
      const response = await api.post(`/kahoot/games/${gameId}/join`, {
        password,
        player_name: playerName
      });

      const { role, session_id } = response.data;

      // Salvar informações na sessão
      localStorage.setItem('session_id', session_id);
      localStorage.setItem('player_name', playerName);

      if (role === 'presenter') {
        // Apresentador vai para tela de controle
        navigate(`/kahoot/presenter/${gameId}`);
      } else {
        // Jogador vai para tela de jogo
        navigate(`/kahoot/play/${gameId}`);
      }
    } catch (error) {
      alert('Erro ao entrar: ' + (error.response?.data?.error || 'Senha incorreta'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-700 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-dark-elevated rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-block p-4 bg-purple-100 dark:bg-purple-900/20 rounded-full mb-4">
            <Play className="w-12 h-12 text-purple-600 dark:text-purple-400" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-dark-text-primary mb-2">
            Entrar no Jogo
          </h1>
          <p className="text-gray-600 dark:text-dark-text-secondary">
            Digite seu nome e a senha para participar
          </p>
        </div>

        <form onSubmit={handleJoin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-2">
              Seu Nome
            </label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-dark-surface dark:text-dark-text-primary text-lg"
              placeholder="Digite seu nome"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-2 flex items-center gap-2">
              <Lock className="w-4 h-4" />
              Senha
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-dark-surface dark:text-dark-text-primary text-lg"
              placeholder="Digite a senha"
            />
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Use a senha de jogador ou apresentador
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-semibold text-lg hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 transition-all shadow-lg hover:shadow-xl"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-dark-border">
          <div className="flex items-start gap-3 text-sm text-gray-600 dark:text-dark-text-secondary">
            <Eye className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium mb-1">Duas formas de participar:</p>
              <ul className="space-y-1 text-xs">
                <li><strong>Senha de Jogador:</strong> Responda as perguntas</li>
                <li><strong>Senha de Apresentador:</strong> Controle o jogo</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default KahootAccess;
