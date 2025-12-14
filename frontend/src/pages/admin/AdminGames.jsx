import { useEffect, useState } from 'react';
import { Trash2, Search, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../../services/api';

const AdminGames = () => {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchGames();
  }, []);

  const fetchGames = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/games');
      setGames(response.data);
    } catch (err) {
      console.error('Erro ao carregar jogos:', err);
      setError('Erro ao carregar jogos');
    } finally {
      setLoading(false);
    }
  };

  const deleteGame = async (gameId, gameName) => {
    if (!confirm(`Deseja realmente excluir o jogo "${gameName}"? Esta ação não pode ser desfeita.`)) {
      return;
    }

    try {
      await api.delete(`/admin/games/${gameId}`);
      await fetchGames();
    } catch (err) {
      console.error('Erro ao excluir jogo:', err);
      alert('Erro ao excluir jogo');
    }
  };

  const filteredGames = games.filter((game) =>
    game.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    game.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getGameTypeLabel = (type) => {
    const types = {
      word_search: 'Caça-Palavras',
      quiz: 'Quiz',
    };
    return types[type] || type;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-dark-text-primary">
            Gerenciar Jogos
          </h1>
          <p className="text-gray-600 dark:text-dark-text-secondary mt-2">
            Total de {games.length} jogos cadastrados
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar jogos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full sm:w-64 bg-white dark:bg-dark-surface border border-gray-300 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredGames.map((game) => (
          <div
            key={game.id}
            className="bg-white dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-xl p-6 hover:shadow-lg transition-shadow"
          >
            <div className="flex justify-between items-start mb-4">
              <span className="inline-block px-3 py-1 bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-400 text-xs font-semibold rounded-full">
                {getGameTypeLabel(game.game_type)}
              </span>
              <button
                onClick={() => deleteGame(game.id, game.name)}
                className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                title="Excluir jogo"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>

            <h3 className="text-xl font-bold text-gray-900 dark:text-dark-text-primary mb-2">
              {game.name}
            </h3>

            <p className="text-gray-600 dark:text-dark-text-secondary text-sm mb-4 line-clamp-2">
              {game.description}
            </p>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-dark-text-secondary">Criado em:</span>
                <span className="text-gray-900 dark:text-dark-text-primary font-medium">
                  {new Date(game.created_at).toLocaleDateString('pt-BR')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-dark-text-secondary">Status:</span>
                <span className={`font-medium ${game.is_active ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {game.is_active ? 'Ativo' : 'Inativo'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredGames.length === 0 && (
        <div className="text-center py-12 bg-white dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-xl">
          <p className="text-gray-600 dark:text-dark-text-secondary mb-4">
            {searchTerm ? 'Nenhum jogo encontrado' : 'Nenhum jogo cadastrado'}
          </p>
        </div>
      )}
    </div>
  );
};

export default AdminGames;
