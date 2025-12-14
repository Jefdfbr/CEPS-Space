import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getGames } from '../services/api';
import { Target, Brain, Play } from 'lucide-react';

const Games = () => {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadGames();
  }, []);

  const loadGames = async () => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';
      
      // Buscar todos os jogos
      const gamesResponse = await getGames();
      const allGames = gamesResponse.data;
      
      // Buscar todas as salas ativas para filtrar jogos que possuem sala
      const roomsResponse = await fetch(`${API_URL}/rooms/active`);
      const rooms = await roomsResponse.json();
      
      // Criar set de game_ids que possuem salas
      const gameIdsWithRooms = new Set(rooms.map(room => room.game_id));
      
      // Filtrar apenas jogos SEM salas
      const gamesWithoutRooms = allGames.filter(game => !gameIdsWithRooms.has(game.id));
      
      setGames(gamesWithoutRooms);
    } catch (err) {
      console.error('Erro ao carregar jogos:', err);
      setError('Erro ao carregar jogos');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-dark-bg flex items-center justify-center pt-20">
        <div className="text-xl text-gray-700 dark:text-dark-text-primary">Carregando jogos...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-dark-bg py-8 pt-24">
      <div className="container mx-auto px-4">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-dark-text-primary mb-8">
          Jogos Disponíveis
        </h1>

        {error && (
          <div className="bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {games.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-xl text-gray-600 dark:text-dark-text-secondary mb-4">
              Nenhum jogo disponível ainda.
            </p>
            <Link
              to="/my-games"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              Crie o primeiro jogo!
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {games.map((game) => {
              const GameIcon = game.game_type === 'word_search' ? Target : Brain;
              return (
                <div
                  key={game.id}
                  className="bg-white dark:bg-dark-bg rounded-lg shadow-lg p-6 hover:shadow-xl transition-all duration-300 border dark:border-dark-border hover:border-purple-500 dark:hover:border-purple-500 group"
                >
                  <GameIcon className="w-12 h-12 mb-3 text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform" />
                  <h3 className="text-xl font-bold text-gray-900 dark:text-dark-text-primary mb-2">
                    {game.name}
                  </h3>
                  <p className="text-gray-600 dark:text-dark-text-secondary mb-4">
                    {game.description || 'Sem descrição'}
                  </p>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500 dark:text-gray-500">
                      {game.game_type === 'word_search' ? 'Caça-Palavras' : 'Quiz'}
                    </span>
                    <Link
                      to={`/game?game_id=${game.id}`}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                    >
                      <Play className="w-4 h-4" />
                      Jogar
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Games;
