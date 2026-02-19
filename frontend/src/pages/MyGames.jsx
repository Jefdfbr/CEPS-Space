import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Trash2, Eye, Edit, PlayCircle, Users, X, ChevronDown, ChevronUp, Copy, CheckCircle, RotateCcw } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const MyGames = () => {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showScoresModal, setShowScoresModal] = useState(false);
  const [showRoomsModal, setShowRoomsModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [roomToReset, setRoomToReset] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDeleteRoomModal, setShowDeleteRoomModal] = useState(false);
  const [gameToDelete, setGameToDelete] = useState(null);
  const [roomToDelete, setRoomToDelete] = useState(null);
  const [selectedGame, setSelectedGame] = useState(null);
  const [gameRooms, setGameRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [roomScores, setRoomScores] = useState([]);
  const [loadingScores, setLoadingScores] = useState(false);
  const [expandedRooms, setExpandedRooms] = useState(new Set());
  const [sortBy, setSortBy] = useState('id'); // 'id', 'name', 'score'
  const [showCopyToast, setShowCopyToast] = useState(false);
  const [showDeleteRoomToast, setShowDeleteRoomToast] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();

  useEffect(() => {
    // Aguarda o AuthContext terminar de carregar antes de verificar autenticação
    if (authLoading) return;
    
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    fetchMyGames();

    // Cleanup: garantir que o overflow seja restaurado ao desmontar
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isAuthenticated, authLoading, navigate]);

  const fetchMyGames = async () => {
    try {
      setLoading(true);
      const response = await api.get('/protected/games/my');
      setGames(response.data);
    } catch (error) {
      console.error('Erro ao carregar jogos:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteGame = async (gameId, gameName, gameType) => {
    setGameToDelete({ id: gameId, name: gameName, game_type: gameType });
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!gameToDelete) return;

    setDeleting(true);
    try {
      if (gameToDelete.game_type === 'kahoot') {
        await api.delete(`/protected/kahoot/games/${gameToDelete.id}`);
      } else if (gameToDelete.game_type === 'open_question') {
        await api.delete(`/protected/open-question/games/${gameToDelete.id}`);
      } else {
        await api.delete(`/protected/games/${gameToDelete.id}`);
      }
      await fetchMyGames();
      setShowDeleteModal(false);
      setGameToDelete(null);
    } catch (error) {
      console.error('Erro ao excluir jogo:', error);
      alert('Erro ao excluir jogo');
    } finally {
      setDeleting(false);
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setGameToDelete(null);
  };

    // Função para copiar o link do jogo
  const copyGameLink = (game) => {
    let gameUrl;
    
    // Gerar URL correta baseada no tipo de jogo
    if (game.game_type === 'kahoot') {
      gameUrl = `https://ceps.space/kahoot/access/${game.id}`;
    } else if (game.game_type === 'open_question') {
      gameUrl = `https://ceps.space/open-question/play/${game.id}`;
    } else {
      gameUrl = `https://ceps.space/game?game_id=${game.id}`;
    }
    
    navigator.clipboard.writeText(gameUrl).then(() => {
      setShowCopyToast(true);
      setTimeout(() => setShowCopyToast(false), 3000);
    }).catch(err => {
      console.error('Erro ao copiar link:', err);
      alert('Erro ao copiar link');
    });
  };

  const viewGameRooms = async (game) => {
    setSelectedGame(game);
    setShowRoomsModal(true);
    setLoadingRooms(true);
    
    // Bloquear scroll da página
    document.body.style.overflow = 'hidden';

    try {
      // Buscar salas do jogo
      const response = await api.get(`/rooms/by-game/${game.id}`);
      setGameRooms(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar salas:', error);
      setGameRooms([]);
    } finally {
      setLoadingRooms(false);
    }
  };

  const closeRoomsModal = () => {
    setShowRoomsModal(false);
    setSelectedGame(null);
    setGameRooms([]);
    // Restaurar scroll da página
    document.body.style.overflow = 'unset';
  };

  const deleteRoom = async (roomId, roomName) => {
    setRoomToDelete({ id: roomId, name: roomName });
    setShowDeleteRoomModal(true);
  };

  const confirmDeleteRoom = async () => {
    if (!roomToDelete) return;

    setDeleting(true);
    try {
      await api.delete(`/protected/rooms/by-id/${roomToDelete.id}`);
      // Recarregar salas
      const response = await api.get(`/rooms/by-game/${selectedGame.id}`);
      setGameRooms(response.data || []);
      setShowDeleteRoomModal(false);
      setRoomToDelete(null);
      // Mostrar toast de sucesso
      setShowDeleteRoomToast(true);
      setTimeout(() => setShowDeleteRoomToast(false), 3000);
    } catch (error) {
      console.error('Erro ao excluir sala:', error);
      alert('Erro ao excluir sala');
    } finally {
      setDeleting(false);
    }
  };

  const cancelDeleteRoom = () => {
    setShowDeleteRoomModal(false);
    setRoomToDelete(null);
  };

  const viewGameScores = async (game) => {
    setSelectedGame(game);
    setShowScoresModal(true);
    setLoadingScores(true);
    setExpandedRooms(new Set());
    
    // Bloquear scroll da página
    document.body.style.overflow = 'hidden';

    try {
      // Buscar salas do jogo
      const response = await api.get(`/rooms/by-game/${game.id}`);
      const rooms = response.data;

      // Para cada sala, buscar as pontuações
      const roomsWithScores = await Promise.all(
        rooms.map(async (room) => {
          try {
            const scoresResponse = await api.get(`/rooms/${room.id}/scores`);
            return {
              ...room,
              scores: scoresResponse.data || [],
              totalScore: scoresResponse.data?.reduce((sum, score) => sum + (score.total_score || 0), 0) || 0
            };
          } catch (error) {
            console.error(`Erro ao carregar scores da sala ${room.id}:`, error);
            return {
              ...room,
              scores: [],
              totalScore: 0
            };
          }
        })
      );

      setRoomScores(roomsWithScores);
    } catch (error) {
      console.error('Erro ao carregar salas:', error);
      alert('Erro ao carregar pontuações');
    } finally {
      setLoadingScores(false);
    }
  };

  const closeScoresModal = () => {
    setShowScoresModal(false);
    // Restaurar scroll da página
    document.body.style.overflow = 'unset';
  };

  const resetRoom = async (roomId, roomName) => {
    setRoomToReset({ id: roomId, name: roomName });
    setShowResetModal(true);
  };

  const confirmResetRoom = async () => {
    if (!roomToReset) return;

    try {
      await api.post(`/protected/rooms/by-id/${roomToReset.id}/reset`);
      toast.success('Sala resetada com sucesso!');
      setShowResetModal(false);
      setRoomToReset(null);
      
      // Recarregar as pontuações se o modal estiver aberto
      if (showScoresModal && selectedGame) {
        await viewGameScores(selectedGame);
      }
    } catch (error) {
      console.error('Erro ao resetar sala:', error);
      toast.error('Erro ao resetar sala');
    }
  };

  const toggleRoom = (roomId) => {
    const newExpanded = new Set(expandedRooms);
    if (newExpanded.has(roomId)) {
      newExpanded.delete(roomId);
    } else {
      newExpanded.add(roomId);
    }
    setExpandedRooms(newExpanded);
  };

  const sortRooms = (rooms) => {
    const sorted = [...rooms];
    switch (sortBy) {
      case 'name':
        return sorted.sort((a, b) => {
          const nameA = (a.room_name || a.room_code).toLowerCase();
          const nameB = (b.room_name || b.room_code).toLowerCase();
          return nameA.localeCompare(nameB);
        });
      case 'score':
        return sorted.sort((a, b) => b.totalScore - a.totalScore);
      case 'id':
      default:
        return sorted.sort((a, b) => a.id - b.id);
    }
  };

  const getGameTypeLabel = (type) => {
    const types = {
      word_search: 'Caça-Palavras',
      quiz: 'Quiz',
      kahoot: 'Kahoot',
      open_question: 'Pergunta Aberta',
    };
    return types[type] || type;
  };

  const getGameTypeColor = (type) => {
    const colors = {
      word_search: 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-400',
      quiz: 'bg-purple-100 dark:bg-purple-900/20 text-purple-800 dark:text-purple-400',
      kahoot: 'bg-pink-100 dark:bg-pink-900/20 text-pink-800 dark:text-pink-400',
      open_question: 'bg-orange-100 dark:bg-orange-900/20 text-orange-800 dark:text-orange-400',
    };
    return colors[type] || 'bg-gray-100 dark:bg-dark-elevated text-gray-800 dark:text-dark-text-primary';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-dark-surface">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-dark-surface py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-dark-text-primary mb-2">
              Meus Jogos
            </h1>
            <p className="text-gray-600 dark:text-dark-text-secondary">
              {games.length} {games.length === 1 ? 'jogo criado' : 'jogos criados'}
            </p>
          </div>

          <Link
            to="/create"
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black rounded-lg hover:from-yellow-400 hover:to-yellow-500 transition-all font-bold shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            <Plus className="w-5 h-5" />
            Criar Novo Jogo
          </Link>
        </div>

        {games.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {games.map((game) => (
              <div
                key={game.id}
                className="bg-white dark:bg-dark-elevated border border-gray-200 dark:border-dark-border rounded-xl p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex justify-between items-start mb-4">
                  <span className={`inline-block px-3 py-1 text-xs font-semibold rounded-full ${getGameTypeColor(game.game_type)}`}>
                    {getGameTypeLabel(game.game_type)}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => copyGameLink(game)}
                      className="flex items-center gap-1 px-3 py-2 bg-yellow-500 hover:bg-yellow-600 text-black rounded-lg transition-colors text-xs font-bold"
                      title="Copiar link do jogo"
                    >
                      <Copy className="w-3 h-3" />
                      Copiar
                    </button>
                    <button
                      onClick={() => deleteGame(game.id, game.name, game.game_type)}
                      className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title="Excluir jogo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <h3 className="text-xl font-bold text-gray-900 dark:text-dark-text-primary mb-2">
                  {game.name}
                </h3>

                <p className="text-gray-600 dark:text-dark-text-secondary text-sm mb-4 line-clamp-2">
                  {game.description}
                </p>

                <div className="flex items-center justify-between text-sm mb-4">
                  <span className="text-gray-600 dark:text-dark-text-secondary">
                    Criado em {new Date(game.created_at).toLocaleDateString('pt-BR')}
                  </span>
                  <span className={`font-medium ${game.is_active ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {game.is_active ? 'Ativo' : 'Inativo'}
                  </span>
                </div>

                <div className="flex gap-2">
                  {game.game_type === 'kahoot' ? (
                    <a
                      href={`https://ceps.space/kahoot/access/${game.id}`}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-yellow-500 text-black rounded-lg hover:bg-yellow-400 transition-colors font-medium"
                    >
                      <PlayCircle className="w-4 h-4" />
                      Acessar
                    </a>
                  ) : game.game_type === 'open_question' ? (
                    <a
                      href={`https://ceps.space/open-question/play/${game.id}`}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-yellow-500 text-black rounded-lg hover:bg-yellow-400 transition-colors font-medium"
                    >
                      <PlayCircle className="w-4 h-4" />
                      Acessar
                    </a>
                  ) : (
                    <a
                      href={`https://ceps.space/game?game_id=${game.id}`}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-yellow-500 text-black rounded-lg hover:bg-yellow-400 transition-colors font-medium"
                    >
                      <PlayCircle className="w-4 h-4" />
                      Jogar
                    </a>
                  )}
                  <Link
                    to={game.game_type === 'kahoot' ? `/edit/kahoot/${game.id}` : game.game_type === 'open_question' ? `/edit/open-question/${game.id}` : game.game_type === 'word_search' ? `/edit/word-search/${game.id}` : `/edit/quiz/${game.id}`}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-dark-text-primary rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center justify-center"
                    title="Editar jogo"
                  >
                    <Edit className="w-5 h-5" />
                  </Link>
                  <button
                    onClick={() => {
                      if (game.game_type === 'open_question' || game.game_type === 'kahoot') {
                        toast.error('Salas não são permitidas para este tipo de jogo');
                      } else {
                        viewGameRooms(game);
                      }
                    }}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-dark-text-primary rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center justify-center"
                    title={game.game_type === 'open_question' || game.game_type === 'kahoot' ? 'Salas não permitidas para este jogo' : 'Salas de jogo'}
                  >
                    <Users className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => viewGameScores(game)}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-dark-text-primary rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center justify-center"
                    title="Ver pontuações das salas"
                  >
                    <Eye className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-white dark:bg-dark-elevated border border-gray-200 dark:border-dark-border rounded-xl">
            <div className="mb-4">
              <PlayCircle className="w-16 h-16 text-gray-400 mx-auto" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-dark-text-primary mb-2">
              Nenhum jogo criado ainda
            </h3>
            <p className="text-gray-600 dark:text-dark-text-secondary mb-6">
              Comece criando seu primeiro jogo educativo!
            </p>
            <Link
              to="/create"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black rounded-lg hover:from-yellow-400 hover:to-yellow-500 transition-all font-bold shadow-lg"
            >
              <Plus className="w-5 h-5" />
              Criar Meu Primeiro Jogo
            </Link>
          </div>
        )}
      </div>

      {/* Modal de Salas */}
      {showRoomsModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-dark-elevated rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-dark-border">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-dark-text-primary">
                  Salas de Jogo
                </h2>
                <p className="text-sm text-gray-600 dark:text-dark-text-secondary mt-1">
                  {selectedGame?.name}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  to="/create-room"
                  state={{ gameId: selectedGame?.id }}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black rounded-lg hover:from-yellow-400 hover:to-yellow-500 transition-all font-bold text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Criar Sala
                </Link>
                <button
                  onClick={closeRoomsModal}
                  className="text-gray-500 hover:text-gray-700 dark:text-dark-text-secondary dark:hover:text-gray-200 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {loadingRooms ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mb-4"></div>
                  <p className="text-gray-600 dark:text-dark-text-secondary">Carregando salas...</p>
                </div>
              ) : gameRooms.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-xl text-gray-600 dark:text-dark-text-secondary mb-2">
                    Nenhuma sala criada ainda
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-500 mb-6">
                    Crie uma sala para começar a jogar com outras pessoas
                  </p>
                  <Link
                    to="/create-room"
                    state={{ gameId: selectedGame?.id }}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black rounded-lg hover:from-yellow-400 hover:to-yellow-500 transition-all font-bold"
                  >
                    <Plus className="w-5 h-5" />
                    Criar Primeira Sala
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {gameRooms.map((room) => (
                    <div
                      key={room.id}
                      className="bg-gray-50 dark:bg-dark-surface/50 rounded-lg p-5 border border-gray-200 dark:border-dark-border"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="text-lg font-bold text-gray-900 dark:text-dark-text-primary">
                            {room.room_name}
                          </h3>
                        </div>
                        <div className="flex items-center gap-2">
                          {(() => {
                            const isExpired = room.expires_at && new Date(room.expires_at) < new Date();
                            const isClosed = !room.is_active || isExpired;
                            return (
                              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                isClosed
                                  ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' 
                                  : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                              }`}>
                                {isClosed ? 'Fechada' : 'Ativa'}
                              </span>
                            );
                          })()}
                          <Link
                            to={`/edit-room/${room.id}`}
                            className="p-2 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                            title="Editar sala"
                          >
                            <Edit className="w-4 h-4" />
                          </Link>
                          <button
                            onClick={() => deleteRoom(room.id, room.room_name || room.room_code)}
                            className="p-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Excluir sala"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600 dark:text-dark-text-secondary">Capacidade:</span>
                          <span className="ml-2 font-semibold text-gray-900 dark:text-dark-text-primary">
                            {room.max_players} jogadores
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-dark-text-secondary">Criada em:</span>
                          <span className="ml-2 font-semibold text-gray-900 dark:text-dark-text-primary">
                            {new Date(room.created_at).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Pontuações */}
      {showScoresModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-dark-elevated rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-dark-border">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-dark-text-primary">
                  {selectedGame?.name}
                </h2>
                <p className="text-sm text-gray-600 dark:text-dark-text-secondary mt-1">
                  Pontuações das Salas
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600 dark:text-dark-text-secondary">
                    Ordenar por:
                  </label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-dark-text-primary text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="id">ID da Sala</option>
                    <option value="name">Nome</option>
                    <option value="score">Pontuação</option>
                  </select>
                </div>
                <button
                  onClick={closeScoresModal}
                  className="text-gray-500 hover:text-gray-700 dark:text-dark-text-secondary dark:hover:text-gray-200 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {loadingScores ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                </div>
              ) : roomScores.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-600 dark:text-dark-text-secondary">
                    Nenhuma sala encontrada para este jogo.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sortRooms(roomScores).map((room) => (
                    <div
                      key={room.id}
                      className="border border-gray-200 dark:border-dark-border rounded-lg overflow-hidden"
                    >
                      {/* Room Header */}
                      <div className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-dark-surface/50">
                        <button
                          onClick={() => toggleRoom(room.id)}
                          className="flex-1 flex items-center gap-4 hover:opacity-80 transition-opacity text-left"
                        >
                          <div>
                            <h3 className="font-semibold text-gray-900 dark:text-dark-text-primary">
                              {room.room_name}
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-dark-text-secondary">
                              {room.scores.length} {room.scores.length === 1 ? 'jogador' : 'jogadores'}
                            </p>
                          </div>
                        </button>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              resetRoom(room.id, room.room_name);
                            }}
                            className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors flex items-center justify-center"
                            title="Resetar sala (limpar pontuações, palavras, jogadores e cronômetro)"
                          >
                            <RotateCcw className="w-5 h-5" />
                          </button>
                          <div className="text-right">
                            <p className="text-sm text-gray-600 dark:text-dark-text-secondary">
                              Pontuação Total
                            </p>
                            <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                              {room.totalScore}
                            </p>
                          </div>
                          <button onClick={() => toggleRoom(room.id)} className="p-1">
                            {expandedRooms.has(room.id) ? (
                              <ChevronUp className="w-5 h-5 text-gray-500" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-gray-500" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Player Scores - Accordion */}
                      {expandedRooms.has(room.id) && (
                        <div className="border-t border-gray-200 dark:border-dark-border">
                          {room.scores.length > 0 ? (
                            <div className="divide-y divide-gray-200 dark:divide-gray-700">
                              {room.scores.map((score, index) => (
                                <div
                                  key={index}
                                  className="flex items-center justify-between p-4 bg-white dark:bg-dark-elevated"
                                >
                                  <div className="flex items-center gap-3">
                                    <div
                                      className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
                                      style={{ backgroundColor: score.player_color || '#3B82F6' }}
                                    >
                                      {(score.player_name || 'Jogador')[0].toUpperCase()}
                                    </div>
                                    <div>
                                      <p className="font-medium text-gray-900 dark:text-dark-text-primary">
                                        {score.player_name || 'Jogador Anônimo'}
                                      </p>
                                      <p className="text-xs text-gray-500 dark:text-dark-text-secondary">
                                        {score.words_found || 0} {score.words_found === 1 ? 'palavra encontrada' : 'palavras encontradas'}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-lg font-bold text-gray-900 dark:text-dark-text-primary">
                                      {score.total_score || 0}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-dark-text-secondary">
                                      pontos
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="p-4 text-center text-gray-500 dark:text-dark-text-secondary">
                              Nenhum jogador nesta sala ainda.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 dark:border-dark-border p-4">
              <button
                onClick={closeScoresModal}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão de Sala */}
      {showDeleteRoomModal && roomToDelete && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-dark-elevated rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-dark-text-primary">
                Confirmar Exclusão
              </h3>
            </div>

            <p className="text-gray-700 dark:text-dark-text-primary mb-2">
              Deseja realmente excluir a sala:
            </p>
            <p className="text-lg font-bold text-gray-900 dark:text-dark-text-primary mb-6 bg-gray-100 dark:bg-dark-surface/50 p-3 rounded-lg">
              "{roomToDelete.name}"
            </p>
            <p className="text-sm text-red-600 dark:text-red-400 mb-6">
              Esta ação não pode ser desfeita. Todas as pontuações associadas também serão excluídas.
            </p>

            <div className="flex gap-3">
              <button
                onClick={cancelDeleteRoom}
                disabled={deleting}
                className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-dark-text-primary rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeleteRoom}
                disabled={deleting}
                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {deleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Excluindo...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Excluir
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão de Jogo */}
      {showDeleteModal && gameToDelete && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-dark-elevated rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="flex-shrink-0 w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-dark-text-primary">
                  Confirmar Exclusão
                </h3>
              </div>
            </div>

            <p className="text-gray-700 dark:text-dark-text-primary mb-2">
              Deseja realmente excluir o jogo:
            </p>
            <p className="text-lg font-bold text-gray-900 dark:text-dark-text-primary mb-6 bg-gray-100 dark:bg-dark-surface/50 p-3 rounded-lg">
              "{gameToDelete.name}"
            </p>
            <p className="text-sm text-red-600 dark:text-red-400 mb-6">
              Esta ação não pode ser desfeita. Todas as salas e pontuações associadas também serão excluídas.
            </p>

            <div className="flex gap-3">
              <button
                onClick={cancelDelete}
                disabled={deleting}
                className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-dark-text-primary rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {deleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Excluindo...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Excluir
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação - Resetar Sala */}
      {showResetModal && roomToReset && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-dark-elevated rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="flex-shrink-0 w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
                <RotateCcw className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-dark-text-primary">
                  Confirmar Reset
                </h3>
              </div>
            </div>

            <p className="text-gray-700 dark:text-dark-text-primary mb-2">
              Deseja realmente resetar a sala:
            </p>
            <p className="text-lg font-bold text-gray-900 dark:text-dark-text-primary mb-4 bg-gray-100 dark:bg-dark-surface/50 p-3 rounded-lg">
              "{roomToReset.name}"
            </p>
            <p className="text-sm text-orange-600 dark:text-orange-400 mb-6">
              Esta ação irá limpar todas as pontuações, palavras encontradas, jogadores conectados e resetar o cronômetro. Esta ação não pode ser desfeita.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowResetModal(false);
                  setRoomToReset(null);
                }}
                className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-dark-text-primary rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={confirmResetRoom}
                className="flex-1 px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-bold flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Resetar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast de Link Copiado */}
      {showCopyToast && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in-right">
          <div className="bg-green-600 text-white px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 min-w-[300px]">
            <div className="flex-shrink-0">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="font-bold text-lg">Link copiado!</p>
              <p className="text-sm text-green-100">O link foi copiado para a área de transferência</p>
            </div>
          </div>
        </div>
      )}

      {/* Toast de Sala Excluída */}
      {showDeleteRoomToast && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in-right">
          <div className="bg-green-600 text-white px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 min-w-[300px]">
            <div className="flex-shrink-0">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="font-bold text-lg">Sala excluída!</p>
              <p className="text-sm text-green-100">A sala foi excluída com sucesso</p>
            </div>
          </div>
        </div>
      )}

      {/* Toaster para notificações */}
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#333',
            color: '#fff',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
    </div>
  );
};

export default MyGames;
