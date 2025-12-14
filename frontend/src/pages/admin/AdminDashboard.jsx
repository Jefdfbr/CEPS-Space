import { useEffect, useState } from 'react';
import { Users, Trophy, PlayCircle, BarChart3 } from 'lucide-react';
import api from '../../services/api';

const AdminDashboard = () => {
  const [stats, setStats] = useState({
    total_users: 0,
    total_games: 0,
    total_sessions: 0,
    total_results: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/dashboard');
      setStats(response.data);
    } catch (err) {
      console.error('Erro ao carregar estatísticas:', err);
      setError('Erro ao carregar estatísticas');
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Total de Usuários',
      value: stats.total_users,
      icon: Users,
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      iconColor: 'text-blue-600 dark:text-blue-400',
    },
    {
      title: 'Total de Jogos',
      value: stats.total_games,
      icon: Trophy,
      color: 'from-yellow-500 to-yellow-600',
      bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
      iconColor: 'text-yellow-600 dark:text-yellow-400',
    },
    {
      title: 'Sessões Criadas',
      value: stats.total_sessions,
      icon: PlayCircle,
      color: 'from-green-500 to-green-600',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      iconColor: 'text-green-600 dark:text-green-400',
    },
    {
      title: 'Resultados Registrados',
      value: stats.total_results,
      icon: BarChart3,
      color: 'from-purple-500 to-purple-600',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20',
      iconColor: 'text-purple-600 dark:text-purple-400',
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-dark-text-primary">
          Dashboard Administrativo
        </h1>
        <p className="text-gray-600 dark:text-dark-text-secondary mt-2">
          Visão geral da plataforma de jogos educativos
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card, index) => (
          <div
            key={index}
            className="bg-white dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-xl p-6 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-dark-text-secondary mb-1">
                  {card.title}
                </p>
                <p className="text-3xl font-bold text-gray-900 dark:text-dark-text-primary">
                  {card.value}
                </p>
              </div>
              <div className={`${card.bgColor} p-3 rounded-lg`}>
                <card.icon className={`w-8 h-8 ${card.iconColor}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-xl p-6">
          <h3 className="text-xl font-bold text-gray-900 dark:text-dark-text-primary mb-4">
            Atividade Recente
          </h3>
          <p className="text-gray-600 dark:text-dark-text-secondary">
            Em breve: Lista de atividades recentes
          </p>
        </div>

        <div className="bg-white dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-xl p-6">
          <h3 className="text-xl font-bold text-gray-900 dark:text-dark-text-primary mb-4">
            Jogos Populares
          </h3>
          <p className="text-gray-600 dark:text-dark-text-secondary">
            Em breve: Lista de jogos mais jogados
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
