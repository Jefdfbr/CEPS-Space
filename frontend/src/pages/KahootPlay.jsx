import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Clock, Check } from 'lucide-react';
import api from '../services/api';
import { useRoomWebSocket } from '../hooks/useRoomWebSocket';

function KahootPlay() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(null);

  // WebSocket para sincronização
  const handleWebSocketMessage = (message) => {
    if (message.type === 'KahootAdvance') {
      // Apresentador avançou para próxima pergunta
      setCurrentQuestionIndex(message.question_index);
      setSelectedOption(null);
      setHasAnswered(false);
      loadQuestion(message.question_index);
    } else if (message.type === 'KahootFinished') {
      // Jogo finalizado
      navigate(`/kahoot/results/${gameId}`);
    }
  };

  const { sendMessage, isConnected } = useRoomWebSocket(
    parseInt(gameId),
    handleWebSocketMessage
  );

  useEffect(() => {
    loadGame();
  }, [gameId]);

  useEffect(() => {
    if (currentQuestion && !hasAnswered) {
      setTimeLeft(currentQuestion.time_limit);
      
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            handleTimeUp();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [currentQuestion, hasAnswered]);

  const loadGame = async () => {
    try {
      const sessionId = localStorage.getItem('session_id');
      
      const gameResponse = await api.get(`/kahoot/games/${gameId}`, {
        headers: { 'X-Session-Id': sessionId }
      });
      
      setGame(gameResponse.data);
      setCurrentQuestionIndex(gameResponse.data.current_question_index || 0);
      await loadQuestion(gameResponse.data.current_question_index || 0);
      
    } catch (error) {
      alert('Erro ao carregar jogo');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const loadQuestion = async (questionIndex) => {
    try {
      const sessionId = localStorage.getItem('session_id');
      
      const response = await api.get(`/kahoot/games/${gameId}/questions/${questionIndex}`, {
        headers: { 'X-Session-Id': sessionId }
      });
      
      setCurrentQuestion(response.data);
    } catch (error) {
      // Pergunta não encontrada
    }
  };

  const handleSelectOption = async (optionId) => {
    if (hasAnswered) return;

    setSelectedOption(optionId);
    setHasAnswered(true);

    try {
      const sessionId = localStorage.getItem('session_id');
      const playerName = localStorage.getItem('player_name');
      
      await api.post(`/kahoot/games/${gameId}/answer`, {
        question_id: currentQuestion.id,
        option_id: optionId,
        response_time: currentQuestion.time_limit - (timeLeft || 0)
      }, {
        headers: { 'X-Session-Id': sessionId }
      });

      // Notificar apresentador via WebSocket
      sendMessage({
        type: 'KahootAnswer',
        question_id: currentQuestion.id,
        option_id: optionId,
        player_name: playerName,
        session_id: sessionId
      });

    } catch (error) {
      alert('Erro ao enviar resposta');
      setHasAnswered(false);
    }
  };

  const handleTimeUp = () => {
    if (!hasAnswered) {
      setHasAnswered(true);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
        <div className="text-white text-2xl font-bold">Carregando...</div>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-dark-elevated rounded-2xl p-8 text-center max-w-md">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-dark-text-primary mb-4">
            Aguardando o apresentador...
          </h2>
          <p className="text-gray-600 dark:text-dark-text-secondary">
            O jogo começará em breve!
          </p>
        </div>
      </div>
    );
  }

  const colors = [
    { bg: 'bg-red-500', hover: 'hover:bg-red-600', ring: 'ring-red-400' },
    { bg: 'bg-blue-500', hover: 'hover:bg-blue-600', ring: 'ring-blue-400' },
    { bg: 'bg-yellow-500', hover: 'hover:bg-yellow-600', ring: 'ring-yellow-400' },
    { bg: 'bg-green-500', hover: 'hover:bg-green-600', ring: 'ring-green-400' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white">
      {/* Header */}
      <div className="bg-black/30 backdrop-blur-sm border-b border-white/10 p-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{game?.title}</h1>
            <p className="text-purple-200">
              Pergunta {currentQuestionIndex + 1}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {timeLeft !== null && !hasAnswered && (
              <div className="flex items-center gap-2 bg-red-500/20 px-4 py-2 rounded-lg animate-pulse">
                <Clock className="w-5 h-5" />
                <span className="font-bold text-xl">{timeLeft}s</span>
              </div>
            )}
            <div className="px-4 py-2 bg-yellow-500/20 rounded-lg">
              <span className="font-bold">{currentQuestion.points} pts</span>
            </div>
          </div>
        </div>
      </div>

      {/* Conteúdo Principal */}
      <div className="max-w-4xl mx-auto p-6 lg:p-12">
        {!hasAnswered ? (
          <div className="space-y-8">
            {/* Pergunta */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 text-center">
              <h2 className="text-3xl lg:text-4xl font-bold mb-4">
                {currentQuestion.question_text}
              </h2>
            </div>

            {/* Opções */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {currentQuestion.options?.map((option, index) => {
                const colorScheme = colors[index];
                return (
                  <button
                    key={option.id}
                    onClick={() => handleSelectOption(option.id)}
                    className={`${colorScheme.bg} ${colorScheme.hover} rounded-2xl p-8 text-center font-bold text-2xl shadow-2xl transition-all transform hover:scale-105 active:scale-95`}
                  >
                    <div className="mb-3 text-sm opacity-80">
                      {String.fromCharCode(65 + index)}
                    </div>
                    <div>{option.option_text}</div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          /* Resposta Enviada */
          <div className="flex flex-col items-center justify-center py-20">
            <div className="bg-white/10 backdrop-blur-md rounded-full p-12 mb-8 border-4 border-green-400">
              <Check className="w-24 h-24 text-green-400" />
            </div>
            <h2 className="text-4xl font-bold mb-4">Resposta enviada!</h2>
            <p className="text-xl text-purple-200">
              Aguarde o apresentador avançar para a próxima pergunta...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default KahootPlay;
