import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowRight, Users, BarChart3, Trophy, Clock } from 'lucide-react';
import api from '../services/api';
import { useRoomWebSocket } from '../hooks/useRoomWebSocket';

function KahootPresenter() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [players, setPlayers] = useState([]);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);

  // WebSocket para sincronização
  const handleWebSocketMessage = (message) => {
    if (message.type === 'KahootAnswer') {
      // Atualizar respostas em tempo real
      setAnswers(prev => ({
        ...prev,
        [message.session_id]: {
          option_id: message.option_id,
          player_name: message.player_name
        }
      }));
    } else if (message.type === 'PlayerJoined') {
      setPlayers(prev => {
        if (prev.find(p => p.session_id === message.session_id)) return prev;
        return [...prev, { session_id: message.session_id, username: message.username }];
      });
    } else if (message.type === 'PlayerLeft') {
      setPlayers(prev => prev.filter(p => p.session_id !== message.session_id));
    }
  };

  const { sendMessage, isConnected } = useRoomWebSocket(
    parseInt(gameId),
    handleWebSocketMessage
  );

  useEffect(() => {
    loadGame();
  }, [gameId]);

  const loadGame = async () => {
    try {
      const token = localStorage.getItem('token');
      const sessionId = localStorage.getItem('session_id');
      
      const gameResponse = await api.get(`/kahoot/games/${gameId}`, {
        headers: sessionId ? { 'X-Session-Id': sessionId } : { 'Authorization': `Bearer ${token}` }
      });
      
      setGame(gameResponse.data);
      setQuestions(gameResponse.data.questions || []);
      setCurrentQuestionIndex(gameResponse.data.current_question_index || 0);
      
      // Carregar jogadores conectados
      const playersResponse = await api.get(`/kahoot/games/${gameId}/players`, {
        headers: sessionId ? { 'X-Session-Id': sessionId } : {}
      });
      setPlayers(playersResponse.data || []);
      
    } catch (error) {
      alert('Erro ao carregar jogo');
      navigate('/my-games');
    } finally {
      setLoading(false);
    }
  };

  const handleNextQuestion = async () => {
    if (showResults) {
      // Avançar para próxima pergunta
      const nextIndex = currentQuestionIndex + 1;
      
      if (nextIndex < questions.length) {
        try {
          const sessionId = localStorage.getItem('session_id');
          await api.post(`/kahoot/games/${gameId}/advance`, {
            question_index: nextIndex
          }, {
            headers: { 'X-Session-Id': sessionId }
          });
          
          setCurrentQuestionIndex(nextIndex);
          setShowResults(false);
          setAnswers({});
          
          // Notificar todos via WebSocket
          sendMessage({
            type: 'KahootAdvance',
            question_index: nextIndex
          });
        } catch (error) {
          alert('Erro ao avançar');
        }
      } else {
        // Finalizar jogo
        handleFinishGame();
      }
    } else {
      // Mostrar resultados da pergunta atual
      setShowResults(true);
      
      sendMessage({
        type: 'KahootShowResults',
        question_index: currentQuestionIndex
      });
    }
  };

  const handleFinishGame = async () => {
    try {
      const sessionId = localStorage.getItem('session_id');
      await api.post(`/kahoot/games/${gameId}/finish`, {}, {
        headers: { 'X-Session-Id': sessionId }
      });
      
      sendMessage({
        type: 'KahootFinished'
      });
      
      navigate(`/kahoot/results/${gameId}`);
    } catch (error) {
      alert('Erro ao finalizar jogo');
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white text-xl">Carregando...</div>;
  }

  const currentQuestion = questions[currentQuestionIndex];
  const totalAnswers = Object.keys(answers).length;
  
  // Calcular estatísticas
  const stats = currentQuestion?.options.map(option => {
    const count = Object.values(answers).filter(a => a.option_id === option.id).length;
    const percentage = totalAnswers > 0 ? Math.round((count / totalAnswers) * 100) : 0;
    return {
      ...option,
      count,
      percentage
    };
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white">
      {/* Header */}
      <div className="bg-black/30 backdrop-blur-sm border-b border-white/10 p-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{game?.title}</h1>
            <p className="text-purple-200 mt-1">
              Pergunta {currentQuestionIndex + 1} de {questions.length}
            </p>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-lg">
              <Users className="w-5 h-5" />
              <span className="font-semibold">{players.length} jogadores</span>
            </div>
            {!showResults && (
              <div className="flex items-center gap-2 bg-green-500/20 px-4 py-2 rounded-lg">
                <BarChart3 className="w-5 h-5" />
                <span className="font-semibold">{totalAnswers} respostas</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Conteúdo Principal */}
      <div className="max-w-7xl mx-auto p-8">
        {!showResults ? (
          /* Mostrando Pergunta */
          <div className="space-y-8">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3 text-purple-200">
                  <Clock className="w-6 h-6" />
                  <span className="text-xl">{currentQuestion?.time_limit}s</span>
                </div>
                <div className="text-2xl font-bold text-yellow-300">
                  {currentQuestion?.points} pontos
                </div>
              </div>
              
              <h2 className="text-4xl font-bold text-center mb-12">
                {currentQuestion?.question_text}
              </h2>

              <div className="grid grid-cols-2 gap-6">
                {currentQuestion?.options.map((option, index) => {
                  const colors = ['bg-red-500', 'bg-blue-500', 'bg-yellow-500', 'bg-green-500'];
                  return (
                    <div
                      key={option.id}
                      className={`${colors[index]} rounded-xl p-6 text-center font-bold text-2xl shadow-lg`}
                    >
                      <div className="mb-2 text-sm opacity-80">
                        {String.fromCharCode(65 + index)}
                      </div>
                      {option.option_text}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="text-center">
              <p className="text-xl text-purple-200 mb-4">
                Aguardando respostas... ({totalAnswers}/{players.length})
              </p>
            </div>
          </div>
        ) : (
          /* Mostrando Resultados */
          <div className="space-y-8">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20">
              <h2 className="text-3xl font-bold text-center mb-8">
                {currentQuestion?.question_text}
              </h2>

              <div className="space-y-4">
                {stats?.map((option, index) => {
                  const colors = ['bg-red-500', 'bg-blue-500', 'bg-yellow-500', 'bg-green-500'];
                  return (
                    <div key={option.id} className="relative">
                      <div className={`${colors[index]} rounded-xl p-6 flex items-center justify-between overflow-hidden`}>
                        {/* Barra de progresso */}
                        <div
                          className="absolute inset-0 bg-white/20"
                          style={{ width: `${option.percentage}%` }}
                        />
                        
                        <div className="relative z-10 flex items-center gap-4">
                          <span className="font-bold text-2xl w-8">
                            {String.fromCharCode(65 + index)}
                          </span>
                          <span className="font-semibold text-xl">
                            {option.option_text}
                          </span>
                          {option.is_correct && (
                            <span className="ml-2 px-3 py-1 bg-green-400 text-green-900 rounded-full text-sm font-bold">
                              ✓ CORRETA
                            </span>
                          )}
                        </div>
                        
                        <div className="relative z-10 text-right">
                          <div className="text-3xl font-bold">{option.percentage}%</div>
                          <div className="text-sm opacity-80">{option.count} votos</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="text-center text-xl text-purple-200">
              Total de respostas: {totalAnswers}
            </div>
          </div>
        )}

        {/* Botão de Ação */}
        <div className="mt-12 text-center">
          <button
            onClick={handleNextQuestion}
            className="inline-flex items-center gap-3 px-12 py-4 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full font-bold text-2xl hover:from-purple-700 hover:to-blue-700 transition-all shadow-2xl hover:shadow-purple-500/50"
          >
            {!showResults ? (
              <>
                <BarChart3 className="w-8 h-8" />
                Ver Resultados
              </>
            ) : currentQuestionIndex < questions.length - 1 ? (
              <>
                Próxima Pergunta
                <ArrowRight className="w-8 h-8" />
              </>
            ) : (
              <>
                <Trophy className="w-8 h-8" />
                Finalizar Jogo
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default KahootPresenter;
