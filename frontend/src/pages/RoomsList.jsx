import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { Users, Lock, Clock, Plus, Search } from 'lucide-react';

function RoomsList() {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchCode, setSearchCode] = useState('');

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      const response = await api.get('/protected/rooms');
      setRooms(response.data);
    } catch (error) {
      console.error('Erro ao buscar salas:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchByCode = () => {
    if (searchCode.length === 6) {
      navigate(`/room/${searchCode.toUpperCase()}`);
    } else {
      alert('Código da sala deve ter 6 caracteres');
    }
  };

  const formatTimeRemaining = (expiresAt) => {
    if (!expiresAt) return 'Sem limite';
    
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diff = expiry - now;
    
    if (diff < 0) return 'Expirada';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days} dia${days > 1 ? 's' : ''}`;
    if (hours > 0) return `${hours} hora${hours > 1 ? 's' : ''}`;
    return 'Menos de 1 hora';
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-dark-text-primary mb-4 flex items-center gap-2">
          <Users className="w-8 h-8" />
          Salas de Jogo
        </h1>
        <p className="text-gray-600 dark:text-dark-text-secondary mb-6">
          Visualize as salas criadas e gerencie suas partidas
        </p>

        <button
          onClick={() => navigate('/create-room')}
          className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Criar Nova Sala
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-200 dark:border-dark-border border-t-blue-600"></div>
          <p className="mt-4 text-gray-600 dark:text-dark-text-secondary">Carregando salas...</p>
        </div>
      ) : rooms.length === 0 ? (
        <div className="bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-lg shadow-md p-12 text-center">
          <Users className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 dark:text-dark-text-primary mb-2">
            Nenhuma sala ativa
          </h3>
          <p className="text-gray-500 dark:text-dark-text-secondary mb-6">
            Crie uma nova sala para começar a jogar
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rooms.map((room) => (
            <div
              key={room.id}
              className="bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-lg shadow-md hover:shadow-lg hover:border-gray-300 dark:hover:border-gray-700 transition-all p-6 cursor-pointer"
              onClick={() => navigate(`/room/${room.room_code}`)}
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-dark-text-primary flex-1">
                  {room.room_name}
                </h3>
                {room.password_hash && (
                  <Lock className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                )}
              </div>

              <div className="space-y-2 text-sm text-gray-600 dark:text-dark-text-secondary">
                <div className="flex items-center gap-2">
                  <span className="font-mono bg-gray-100 dark:bg-dark-elevated px-3 py-1 rounded text-lg font-bold text-blue-600 dark:text-blue-400">
                    {room.room_code}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  <span>Até {room.max_players} participantes</span>
                </div>

                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span>{formatTimeRemaining(room.expires_at)}</span>
                </div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/room/${room.room_code}`);
                }}
                className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Entrar na Sala
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default RoomsList;
