import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { Users, Lock, Copy, Check, Play, X, Trophy, Clock } from 'lucide-react';

function RoomDetails() {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const [room, setRoom] = useState(null);
  const [game, setGame] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [isParticipant, setIsParticipant] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [results, setResults] = useState([]);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    fetchRoomDetails();
    const interval = setInterval(fetchRoomDetails, 5000); // Atualiza a cada 5 segundos
    return () => clearInterval(interval);
  }, [roomCode]);

  const fetchRoomDetails = async () => {
    try {
      const response = await api.get(`/protected/rooms/${roomCode}`);
      setRoom(response.data.room);
      setGame(response.data.game);
      setParticipants(response.data.participants);
      setIsParticipant(response.data.is_participant);
      setIsHost(response.data.is_host);

      // Se for host, buscar resultados
      if (response.data.is_host && room) {
        fetchResults();
      }
    } catch (error) {
      console.error('Erro ao buscar detalhes da sala:', error);
      if (error.response?.status === 404) {
        alert('Sala não encontrada');
        navigate('/rooms');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchResults = async () => {
    if (!room) return;
    try {
      const response = await api.get(`/protected/rooms/${room.id}/answers`);
      setResults(response.data);
    } catch (error) {
      console.error('Erro ao buscar resultados:', error);
    }
  };

  const handleJoinRoom = async () => {
    try {
      const payload = {
        room_code: roomCode,
        password: password || null,
      };

      await api.post('/protected/rooms/join', payload);
      setShowPasswordModal(false);
      setPassword('');
      fetchRoomDetails();
    } catch (error) {
      console.error('Erro ao entrar na sala:', error);
      if (error.response?.status === 401) {
        alert('Senha incorreta');
      } else if (error.response?.status === 403) {
        alert('Sala cheia');
      } else {
        alert('Erro ao entrar na sala');
      }
    }
  };

  const handleCloseRoom = async () => {
    if (!confirm('Tem certeza que deseja fechar esta sala? Ela não poderá mais ser acessada.')) {
      return;
    }

    try {
      await api.post(`/protected/rooms/${room.id}/close`);
      alert('Sala fechada com sucesso');
      navigate('/rooms');
    } catch (error) {
      console.error('Erro ao fechar sala:', error);
      alert('Erro ao fechar sala');
    }
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePlayGame = () => {
    if (!isParticipant) {
      if (room.password_hash) {
        setShowPasswordModal(true);
      } else {
        handleJoinRoom();
      }
    } else {
      // Redirecionar para o jogo passando game_id, room_id e seed
      const seed = room.game_seed || room.room_code;
      if (game.game_type === 'word_search') {
        navigate(`/play/word-search?game_id=${game.id}&room_id=${room.id}&seed=${seed}`);
      } else if (game.game_type === 'quiz') {
        navigate(`/play/quiz?game_id=${game.id}&room_id=${room.id}&seed=${seed}`);
      }
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-600"></div>
          <p className="mt-4 text-gray-600">Carregando sala...</p>
        </div>
      </div>
    );
  }

  if (!room || !game) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Sala não encontrada</h2>
        <button
          onClick={() => navigate('/rooms')}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Voltar para Salas
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      {/* Cabeçalho da Sala */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
              {room.password_hash && <Lock className="w-6 h-6 text-gray-400" />}
              {room.room_name}
            </h1>
            <p className="text-gray-600 mt-1">Jogo: {game.name}</p>
          </div>
          {isHost && (
            <button
              onClick={handleCloseRoom}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Fechar Sala
            </button>
          )}
        </div>

        {/* Código da Sala */}
        <div className="flex items-center gap-4 mb-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Código da Sala
            </label>
            <div className="flex gap-2">
              <div className="flex-1 font-mono bg-gray-100 px-4 py-3 rounded-lg text-2xl font-bold text-blue-600 text-center">
                {roomCode}
              </div>
              <button
                onClick={copyRoomCode}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                title="Copiar código"
              >
                {copied ? <Check className="w-5 h-5 text-green-600" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Informações */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="flex items-center gap-2 text-gray-600">
            <Users className="w-4 h-4" />
            <span>{participants.length} / {room.max_players}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-600">
            <Clock className="w-4 h-4" />
            <span>{formatTimeRemaining(room.expires_at)}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-600">
            <span className={`px-2 py-1 rounded text-xs font-medium ${
              game.game_type === 'word_search' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
            }`}>
              {game.game_type === 'word_search' ? 'Caça-Palavras' : 'Quiz'}
            </span>
          </div>
        </div>
      </div>

      {/* Participantes e Ações */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Participantes */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5" />
            Participantes ({participants.length})
          </h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {participants.map((participant) => (
              <div
                key={participant.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <span className="font-medium text-gray-800">{participant.name}</span>
                {participant.is_host && (
                  <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded">
                    Host
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Ações */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Ações</h2>
          <div className="space-y-3">
            <button
              onClick={handlePlayGame}
              className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
            >
              <Play className="w-5 h-5" />
              {isParticipant ? 'Jogar Agora' : 'Entrar e Jogar'}
            </button>

            {isHost && (
              <button
                onClick={() => {
                  setShowResults(!showResults);
                  if (!showResults) fetchResults();
                }}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <Trophy className="w-5 h-5" />
                {showResults ? 'Ocultar Resultados' : 'Ver Resultados'}
              </button>
            )}

            <button
              onClick={() => navigate('/rooms')}
              className="w-full px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Voltar para Salas
            </button>
          </div>
        </div>
      </div>

      {/* Resultados (apenas para host) */}
      {isHost && showResults && (
        <div className="bg-white rounded-lg shadow-md p-6 mt-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            Resultados
          </h2>
          {results.length === 0 ? (
            <p className="text-gray-500 text-center py-4">
              Nenhum resultado ainda. Os resultados aparecerão aqui quando os participantes terminarem o jogo.
            </p>
          ) : (
            <div className="space-y-2">
              {results.map((result, index) => (
                <div
                  key={result.id}
                  className={`flex items-center justify-between p-4 rounded-lg ${
                    index === 0 ? 'bg-yellow-50 border-2 border-yellow-400' :
                    index === 1 ? 'bg-gray-50 border-2 border-gray-400' :
                    index === 2 ? 'bg-orange-50 border-2 border-orange-400' :
                    'bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold text-gray-400">
                      {index + 1}º
                    </span>
                    <span className="font-medium text-gray-800">{result.user_name}</span>
                  </div>
                  <span className="text-xl font-bold text-blue-600">
                    {result.score} pts
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal de Senha */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Sala Protegida
            </h3>
            <p className="text-gray-600 mb-4">
              Esta sala requer uma senha para entrar
            </p>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Digite a senha"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
              onKeyPress={(e) => e.key === 'Enter' && handleJoinRoom()}
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setPassword('');
                }}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Cancelar
              </button>
              <button
                onClick={handleJoinRoom}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Entrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RoomDetails;
