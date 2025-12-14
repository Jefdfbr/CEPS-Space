import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Clock, CheckCircle, XCircle, ArrowRight, Users, FileDown } from 'lucide-react';
import api from '../services/api';
import { useRoomWebSocket } from '../hooks/useRoomWebSocket';

function QuizPlay() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const gameId = searchParams.get('game_id');
  const roomId = searchParams.get('room_id');

  const [game, setGame] = useState(null);
  const [quizConfig, setQuizConfig] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [answerTimes, setAnswerTimes] = useState({}); // Armazena o tempo em que cada resposta foi dada
  const [showResults, setShowResults] = useState(false);
  const [showFinalScreen, setShowFinalScreen] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [authorized, setAuthorized] = useState(false);
  
  // Estados para sincronização multiplayer
  const [votes, setVotes] = useState({}); // { questionIndex: { 'A': [player1, player2], 'B': [...] } }
  const [connectedPlayers, setConnectedPlayers] = useState([]);
  const myPlayerIdRef = useRef(null);
  const [elapsedTime, setElapsedTime] = useState(0); // Timer crescente em segundos
  const questionStartTimeRef = useRef(0); // Tempo em que a questão atual começou

  // PROTEÇÃO CRÍTICA - Executa IMEDIATAMENTE antes de qualquer renderização
  useEffect(() => {
    const sessionId = localStorage.getItem('session_id');
    const token = localStorage.getItem('token');

    // BLOQUEIO 1: Se tentou acessar SEM game_id, bloquear
    if (!gameId) {
      alert('❌ Acesso negado!\n\nVocê precisa entrar pelo menu de jogos.');
      navigate('/games');
      return;
    }

    // PERMITIR: Jogar sem sala (modo solo)
    if (!roomId) {
      setAuthorized(true);
      return;
    }
    
    // BLOQUEIO 2: Se tem room_id mas não tem autenticação, bloquear
    if (roomId && !sessionId && !token) {
      navigate(`/game?game_id=${gameId}`);
      return;
    }
    
    // Se passou por TODAS as verificações, autorizar
    setAuthorized(true);
  }, [gameId, roomId, navigate]);

  // WebSocket para modo sala
  const handleWebSocketMessage = (message) => {
    switch (message.type) {
      case 'QuizAnswer':
        // Registrar voto
        setVotes(prev => {
          const questionVotes = prev[message.question_index] || {};
          const answerVotes = questionVotes[message.answer] || [];
          
          // Remover voto anterior deste jogador em outras opções
          const newQuestionVotes = {};
          Object.keys(questionVotes).forEach(ans => {
            newQuestionVotes[ans] = questionVotes[ans].filter(p => p.player_id !== message.player_id);
          });
          
          // Adicionar novo voto
          if (!newQuestionVotes[message.answer]) {
            newQuestionVotes[message.answer] = [];
          }
          newQuestionVotes[message.answer].push({
            player_id: message.player_id,
            player_name: message.player_name
          });
          
          return {
            ...prev,
            [message.question_index]: newQuestionVotes
          };
        });
        break;
      
      case 'QuizAdvance':
        // Avançar para próxima pergunta quando alguém avançar
        setCurrentQuestionIndex(message.question_index + 1);
        // Resetar tempo de início da nova questão
        questionStartTimeRef.current = elapsedTime;
        break;
      
      case 'QuizTimerSync':
        // Sincronizar timer com outros jogadores (apenas se for de outro player)
        if (message.player_id !== myPlayerIdRef.current) {
          setElapsedTime(message.elapsed_time);
        }
        break;
      
      case 'QuizCurrentQuestion':
        // Sincronizar questão atual quando reconectar
        setCurrentQuestionIndex(message.question_index);
        // Resetar tempo de início da questão sincronizada
        questionStartTimeRef.current = elapsedTime;
        break;
      
      case 'QuizFinished':
        // Alguém finalizou o quiz - mostrar resultados para todos
        setShowResults(true);
        break;
      
      case 'PlayersList':
        // Receber lista de jogadores já conectados quando entrar
        setConnectedPlayers(prev => {
          const newPlayers = [...prev];
          message.players.forEach(player => {
            if (!newPlayers.find(p => p.player_id === player.player_id)) {
              newPlayers.push(player);
            }
          });
          return newPlayers;
        });
        break;
        
      case 'PlayerJoined':
        setConnectedPlayers(prev => {
          // Evitar duplicatas
          if (prev.find(p => p.player_id === message.player_id)) return prev;
          
          // Se sou EU que estou entrando, não preciso fazer nada
          if (message.player_id === myPlayerIdRef.current) return [...prev, { player_id: message.player_id, username: message.username }];
          
          // Novo jogador entrou - enviar questão atual e voto para sincronizar
          if (sendMessage) {
            // Enviar questão atual
            sendMessage({
              type: 'QuizCurrentQuestion',
              question_index: currentQuestionIndex,
              player_id: myPlayerIdRef.current
            });
            
            // Enviar voto atual se houver
            if (selectedAnswers[currentQuestionIndex]) {
              const playerName = localStorage.getItem('player_name') || localStorage.getItem('username') || 'Anônimo';
              sendMessage({
                type: 'QuizAnswer',
                question_index: currentQuestionIndex,
                answer: selectedAnswers[currentQuestionIndex],
                player_id: myPlayerIdRef.current,
                player_name: playerName
              });
            }
          }
          
          return [...prev, { player_id: message.player_id, username: message.username }];
        });
        break;
        
      case 'PlayerLeft':
        setConnectedPlayers(prev => prev.filter(p => p.player_id !== message.player_id));
        break;
    }
  };

  const { sendMessage, isConnected } = useRoomWebSocket(
    roomId ? parseInt(roomId) : null,
    handleWebSocketMessage
  );

  // Obter player_id da sessão (usando MESMA LÓGICA do backend)
  useEffect(() => {
    const sessionId = localStorage.getItem('session_id');
    const token = localStorage.getItem('token');
    
    if (sessionId) {
      // Gerar ID único usando MESMA LÓGICA do backend: wrapping_add
      let hash = 0;
      for (let i = 0; i < sessionId.length; i++) {
        hash = (hash + sessionId.charCodeAt(i)) | 0; // wrapping_add em JS
      }
      myPlayerIdRef.current = (Math.abs(hash) % 1000000) + 1;
    } else if (token) {
      // Para usuários logados, usar um ID baseado no token
      myPlayerIdRef.current = parseInt(token.substring(0, 8), 16) || Math.floor(Math.random() * 1000000);
    }
    
    // NÃO adicionar manualmente - deixar o backend enviar PlayerJoined
  }, [roomId]);

  // Só carregar o jogo SE estiver autorizado
  useEffect(() => {
    if (authorized && gameId) {
      loadGame();
    } else if (!authorized) {
      setLoading(false);
    }
  }, [authorized, gameId]);

  // Timer crescente (começa do zero e aumenta)
  useEffect(() => {
    if (!showResults && questions.length > 0) {
      const timer = setInterval(() => {
        setElapsedTime(prev => {
          const newTime = prev + 1;
          
          // Sincronizar timer a cada 2 segundos em modo multiplayer
          if (roomId && sendMessage && newTime % 2 === 0) {
            sendMessage({
              type: 'QuizTimerSync',
              elapsed_time: newTime,
              player_id: myPlayerIdRef.current
            });
          }
          
          return newTime;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [showResults, questions.length, roomId, sendMessage]);

  useEffect(() => {
    if (quizConfig?.time_limit && !showResults) {
      setTimeRemaining(quizConfig.time_limit * 60); // Convert minutes to seconds
      
      const timer = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            handleFinishQuiz();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [quizConfig, showResults]);

  const loadGame = async () => {
    try {
      setLoading(true);
      const [gameResponse, configResponse, questionsResponse] = await Promise.all([
        api.get(`/games/${gameId}`),
        api.get(`/quiz/${gameId}`),
        api.get(`/quiz/${gameId}/questions`)
      ]);

      setGame(gameResponse.data);
      setQuizConfig(configResponse.data);
      setQuestions(questionsResponse.data);
      
      // Carregar progresso salvo do banco (apenas em modo sala)
      if (roomId) {
        try {
          const sessionId = localStorage.getItem('session_id');
          const progressResponse = await api.get(`/rooms/${roomId}/quiz-progress`, {
            headers: sessionId ? { 'X-Session-Id': sessionId } : {}
          });
          
          if (progressResponse.data && Object.keys(progressResponse.data).length > 0) {
            const { answers, current_question, elapsed_time, finished } = progressResponse.data;
            
            console.log('🔍 Progress loaded:', { finished, answers, current_question });
            
            // Se o quiz foi finalizado, mostrar tela de resultados
            if (finished === true) {
              console.log('✅ Quiz finalizado! Mostrando resultados...');
              // Carregar respostas para mostrar resultados
              if (answers) {
                setSelectedAnswers(answers);
              }
              // Desligar loading antes de mostrar resultados
              setLoading(false);
              // Marcar para mostrar resultados imediatamente
              setShowResults(true);
              return;
            }
            
            if (answers) {
              setSelectedAnswers(answers);
            }
            
            if (typeof current_question === 'number' && current_question < questionsResponse.data.length) {
              setCurrentQuestionIndex(current_question);
            }
            
            if (typeof elapsed_time === 'number') {
              setElapsedTime(elapsed_time);
            }
          }
        } catch (err) {
          // Silenciar erro
          console.log('⚠️ Nenhum progresso encontrado, começando do zero');
        }
      }
    } catch (err) {
      setError('Erro ao carregar o quiz. Tente novamente.');
    } finally {
      // Só desligar loading se não for quiz finalizado (já desligou acima)
      if (!showResults) {
        setLoading(false);
      }
      // Inicializar tempo de início da primeira questão
      questionStartTimeRef.current = 0;
    }
  };

  const handleSelectAnswer = (option) => {
    const newAnswers = {
      ...selectedAnswers,
      [currentQuestionIndex]: option
    };
    
    setSelectedAnswers(newAnswers);
    
    // Registrar tempo da resposta (tempo decorrido desde o início da questão)
    const timeOnQuestion = elapsedTime - questionStartTimeRef.current;
    setAnswerTimes(prev => ({
      ...prev,
      [currentQuestionIndex]: timeOnQuestion
    }));
    
    // Salvar progresso no banco (apenas em modo sala)
    if (roomId) {
      const sessionId = localStorage.getItem('session_id');
      const playerName = localStorage.getItem('player_name') || localStorage.getItem('username') || 'Anônimo';
      api.post(`/rooms/${roomId}/quiz-progress`, {
        answers: newAnswers,
        current_question: currentQuestionIndex,
        elapsed_time: elapsedTime,
        player_name: playerName
      }, {
        headers: sessionId ? { 'X-Session-Id': sessionId } : {}
      }).catch(() => {});
    }
    
    // Se estiver em modo sala, enviar voto via WebSocket
    if (roomId && sendMessage) {
      // Usar player_name (anônimo) ou username (autenticado) do localStorage
      const playerName = localStorage.getItem('player_name') || localStorage.getItem('username') || 'Anônimo';
      const message = {
        type: 'QuizAnswer',
        question_index: currentQuestionIndex,
        answer: option,
        player_id: myPlayerIdRef.current,
        player_name: playerName
      };
      sendMessage(message);
    }
  };

  // Evitar duplo disparo (touch + click) em dispositivos móveis
  const touchUsedRef = useRef(false);

  // Calcular se há consenso (maioria)
  const getConsensus = () => {
    if (!roomId) return null; // Modo solo, sem consenso necessário
    
    const questionVotes = votes[currentQuestionIndex] || {};
    
    // Contar total de jogadores que votaram (unique player_ids)
    const allVoters = new Set();
    Object.values(questionVotes).forEach(voters => {
      voters.forEach(voter => allVoters.add(voter.player_id));
    });
    
    const totalPlayers = connectedPlayers.length;
    const totalVoters = allVoters.size;
    const allAnswered = totalVoters === totalPlayers && totalPlayers > 0;
    
    // Verificar se há maioria absoluta (mais da metade votou na mesma resposta)
    for (const [answer, voters] of Object.entries(questionVotes)) {
      const isConsensus = voters.length > totalPlayers / 2;
      if (isConsensus) {
        return { answer, votes: voters.length, total: totalPlayers, allAnswered };
      }
    }
    
    return null;
  };

  const handleNextQuestion = () => {
    // Em modo sala, enviar sinal para todos avançarem
    if (roomId && sendMessage) {
      sendMessage({
        type: 'QuizAdvance',
        question_index: currentQuestionIndex
      });
    }
    
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      // Resetar tempo de início da nova questão
      questionStartTimeRef.current = elapsedTime;
    } else {
      handleFinishQuiz();
    }
  };

  const handleFinishQuiz = async () => {
    console.log('🏁 handleFinishQuiz chamado');
    
    const correctAnswers = questions.reduce((acc, question, index) => {
      if (selectedAnswers[index] === question.correct_option) {
        return acc + 1;
      }
      return acc;
    }, 0);

    const score = Math.round((correctAnswers / questions.length) * 100);

    if (roomId) {
      try {
        const sessionId = localStorage.getItem('session_id');
        
        // Enviar sinal de finalização para todas as abas via WebSocket
        if (sendMessage) {
          sendMessage({
            type: 'QuizFinished',
            player_id: myPlayerIdRef.current
          });
        }
        
        // PRIMEIRO: Marcar quiz como finalizado no progresso (mantendo as respostas)
        const playerName = localStorage.getItem('player_name') || localStorage.getItem('username') || 'Anônimo';
        const progressData = {
          answers: selectedAnswers,
          current_question: currentQuestionIndex,
          elapsed_time: elapsedTime,
          player_name: playerName,
          finished: true
        };
        
        console.log('💾 Salvando progresso com finished:', progressData);
        
        try {
          const progressResponse = await api.post(`/rooms/${roomId}/quiz-progress`, progressData, {
            headers: sessionId ? { 'X-Session-Id': sessionId } : {}
          });
          console.log('✅ Progresso salvo:', progressResponse.data);
        } catch (progressErr) {
          console.error('⚠️ Erro ao salvar progresso (continuando):', progressErr);
        }
        
        // DEPOIS: Tentar salvar resultado final (pode falhar, mas não importa)
        try {
          await api.post(`/rooms/${roomId}/answer`, {
            answer_data: {
              answers: selectedAnswers,
              correct_answers: correctAnswers,
              total_questions: questions.length
            },
            score: score
          }, {
            headers: sessionId ? { 'X-Session-Id': sessionId } : {}
          });
        } catch (answerErr) {
          console.error('⚠️ Erro ao salvar resposta final (ignorando):', answerErr);
        }
        
        // Não fazer navigate, mostrar tela de resultados
      } catch (err) {
        console.error('❌ Erro ao finalizar:', err);
      }
    }

    setShowResults(true);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // BLOQUEIO VISUAL: Não renderizar NADA enquanto não estiver autorizado
  if (!authorized) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-purple-600 mx-auto mb-4"></div>
          <p className="text-xl text-gray-700 dark:text-dark-text-primary">Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-purple-600 mx-auto mb-4"></div>
          <p className="text-xl text-gray-700 dark:text-dark-text-primary">Carregando quiz...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark-bg flex items-center justify-center">
        <div className="bg-white dark:bg-dark-surface p-8 rounded-lg shadow-xl max-w-md">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <p className="text-xl text-center text-gray-800 dark:text-dark-text-primary mb-4">{error}</p>
          <button
            onClick={() => navigate(-1)}
            className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  if (!game || !questions.length) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark-bg flex items-center justify-center">
        <p className="text-xl text-gray-700 dark:text-dark-text-primary">Nenhuma pergunta encontrada</p>
      </div>
    );
  }

  if (showResults) {
    // Função para calcular pontos baseado no tempo POR QUESTÃO
    // 0-120s (2 min): pontuação máxima
    // Após 120s: reduz gradualmente até mínimo de 10 pontos
    const calculatePoints = (maxPoints, timeInSeconds) => {
      if (timeInSeconds <= 120) {
        return maxPoints; // Pontuação máxima nos primeiros 2 minutos
      }
      
      // Após 2 minutos, reduz gradualmente
      // Fórmula: reduz 10% a cada 30 segundos adicionais, mínimo 10 pontos
      const extraTime = timeInSeconds - 120;
      const reductionFactor = Math.floor(extraTime / 30) * 0.1;
      const reducedPoints = Math.max(10, maxPoints * (1 - reductionFactor));
      
      return Math.round(reducedPoints);
    };

    const generatePDF = () => {
      window.print();
    };
    
    const correctAnswers = questions.reduce((acc, question, index) => {
      if (selectedAnswers[index] === question.correct_option) {
        return acc + 1;
      }
      return acc;
    }, 0);
    
    // Calcular pontuação total baseada no tempo
    const totalPoints = questions.reduce((acc, question, index) => {
      if (selectedAnswers[index] === question.correct_option) {
        const timeOnQuestion = answerTimes[index] || 0;
        const points = calculatePoints(question.points || 100, timeOnQuestion);
        return acc + points;
      }
      return acc;
    }, 0);
    
    const maxPossiblePoints = questions.reduce((acc, q) => acc + (q.points || 100), 0);

    const score = Math.round((correctAnswers / questions.length) * 100);
    const endScreenText = quizConfig?.end_screen_text || 'Parabéns! Você completou o quiz!';
    const hasCustomButton = quizConfig?.end_screen_button_text && quizConfig?.end_screen_button_url;

    // Tela final completa - vai direto sem navbar
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark-bg flex items-center justify-center p-4">
        <div className="bg-white dark:bg-dark-elevated p-8 rounded-lg shadow-xl max-w-2xl w-full">
          {/* Título para impressão */}
          <div className="hidden print:block text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Relatório de Quiz</h1>
            <p className="text-gray-600">{game?.name}</p>
            <p className="text-sm text-gray-500">Data: {new Date().toLocaleDateString('pt-BR')}</p>
          </div>
          
          <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-6 no-print" />
          <h2 className="text-3xl font-bold text-center text-gray-800 dark:text-gray-200 mb-4">
            {endScreenText}
          </h2>
          <div className="text-center mb-8">
            <p className="text-6xl font-bold text-purple-600 dark:text-purple-400 mb-2">
              {totalPoints}
            </p>
            <p className="text-xl text-gray-600 dark:text-dark-text-secondary mb-2">
              pontos de {maxPossiblePoints} possíveis
            </p>
            <p className="text-lg text-gray-500 dark:text-gray-400">
              {correctAnswers} de {questions.length} corretas ({score}%)
            </p>
          </div>

          <div className="space-y-6 max-h-[500px] print:max-h-none overflow-y-auto print:overflow-visible mb-6">
            {questions.map((question, index) => {
              const userAnswer = selectedAnswers[index];
              const isCorrect = userAnswer === question.correct_option;
              
              // Pegar texto completo da opção selecionada e da correta
              const getOptionText = (letter) => {
                switch(letter) {
                  case 'A': return question.option_a;
                  case 'B': return question.option_b;
                  case 'C': return question.option_c;
                  case 'D': return question.option_d;
                  default: return '';
                }
              };
              
              const userAnswerText = userAnswer ? getOptionText(userAnswer) : 'Não respondida';
              const correctAnswerText = getOptionText(question.correct_option);
              
              // Calcular pontos ganhos nesta questão
              const timeOnQuestion = answerTimes[index] || 0;
              const pointsEarned = isCorrect ? calculatePoints(question.points || 100, timeOnQuestion) : 0;
              const maxPoints = question.points || 100;

              return (
                <div key={question.id}
                  className={`p-4 rounded-lg border-2 print-keep-together ${
                    isCorrect
                      ? 'bg-green-50 dark:bg-green-900/20 border-green-500'
                      : 'bg-red-50 dark:bg-red-900/20 border-red-500'
                  }`}
                >
                  <p className="font-semibold text-gray-800 dark:text-gray-200 mb-3">
                    {index + 1}. {question.question}
                    {isCorrect && (
                      <span className="ml-2 text-sm font-bold text-purple-600 dark:text-purple-400">
                        +{pointsEarned} pts
                      </span>
                    )}
                  </p>
                  
                  <div className="space-y-2">
                    <div className="text-sm">
                      <span className="font-medium text-gray-700 dark:text-gray-200">Sua resposta: </span>
                      <span className={`${userAnswer ? (isCorrect ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400') : 'text-gray-500 dark:text-gray-400'}`}>
                        {userAnswer && `${userAnswer}) `}{userAnswerText}
                      </span>
                    </div>
                    
                    {!isCorrect && userAnswer && (
                      <div className="text-sm">
                        <span className="font-medium text-gray-700 dark:text-gray-200">Resposta correta: </span>
                        <span className="text-green-600 dark:text-green-400">
                          {question.correct_option}) {correctAnswerText}
                        </span>
                      </div>
                    )}
                    
                    {question.justification && (
                      <div className="mt-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700">
                        <p className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-1">
                          💡 Justificativa:
                        </p>
                        <p className="text-sm text-gray-700 dark:text-gray-200">
                          {question.justification}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-3 no-print">
            <button
              onClick={generatePDF}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all font-bold shadow-lg"
            >
              <FileDown className="w-5 h-5" />
              Gerar PDF do Relatório
            </button>
            
            {hasCustomButton && (
              <a
                href={quizConfig.end_screen_button_url}
                target={quizConfig.end_screen_button_new_tab === true ? "_blank" : "_self"}
                rel={quizConfig.end_screen_button_new_tab === true ? "noopener noreferrer" : undefined}
                className="block w-full px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg hover:from-purple-600 hover:to-purple-700 transition-all font-bold text-lg text-center shadow-lg"
              >
                {quizConfig.end_screen_button_text}
              </a>
            )}
            {!hasCustomButton && (
              <button
                onClick={() => roomId ? navigate(`/room/${roomId}`) : navigate('/games')}
                className="w-full px-6 py-3 bg-purple-600 text-white hover:bg-purple-700 rounded-lg transition-colors font-bold text-lg"
              >
                {roomId ? 'Voltar para a Sala' : 'Voltar aos Jogos'}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  
  // Proteção: se não tiver pergunta atual, não renderizar opções
  if (!currentQuestion) {
    return null;
  }
  
  const options = [
    { letter: 'A', text: currentQuestion.option_a },
    { letter: 'B', text: currentQuestion.option_b },
    { letter: 'C', text: currentQuestion.option_c },
    { letter: 'D', text: currentQuestion.option_d }
  ];

  const consensus = getConsensus();
  const questionVotes = votes[currentQuestionIndex] || {};
  const canAdvance = roomId ? consensus !== null : selectedAnswers[currentQuestionIndex];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg p-4">
      <div className="max-w-7xl mx-auto py-8">
        {/* Header */}
        <div className="bg-white dark:bg-dark-surface rounded-lg shadow-lg p-6 mb-6 border border-gray-200 dark:border-dark-border">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold text-gray-800 dark:text-dark-text-primary">
              {game.name}
            </h1>
            <div className="flex items-center gap-4">
              {roomId && (
                <div className="flex items-center gap-2 text-sm bg-blue-100 dark:bg-blue-900/20 px-3 py-1 rounded-full">
                  <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="font-semibold text-blue-800 dark:text-blue-300">
                    {connectedPlayers.length} online
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2 text-lg">
                <Clock className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                <span className="font-bold text-gray-800 dark:text-dark-text-primary">
                  {formatTime(elapsedTime)}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
              />
            </div>
            <span className="text-sm text-gray-600 dark:text-dark-text-secondary font-medium">
              {currentQuestionIndex + 1}/{questions.length}
            </span>
          </div>
        </div>

        {/* Layout com Grid - Pergunta + Jogadores */}
        <div className={`grid gap-6 ${roomId ? 'lg:grid-cols-[1fr_320px]' : 'grid-cols-1'}`}>
          {/* Question */}
          <div className="bg-white dark:bg-dark-surface rounded-lg shadow-lg p-8 border border-gray-200 dark:border-dark-border">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-dark-text-primary mb-8">
            {currentQuestion.question}
          </h2>

          <div className="space-y-4 mb-8">
            {options.map((option) => {
              const voters = questionVotes[option.letter] || [];
              const voteCount = voters.length;
              const isSelected = selectedAnswers[currentQuestionIndex] === option.letter;
              
              return (
                <button
                  key={option.letter}
                  onTouchStart={(e) => { e.preventDefault(); touchUsedRef.current = true; handleSelectAnswer(option.letter); }}
                  onClick={() => { if (touchUsedRef.current) { touchUsedRef.current = false; return; } handleSelectAnswer(option.letter); }}
                  className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                    isSelected
                      ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/20 dark:border-purple-500'
                      : 'border-gray-300 dark:border-dark-border hover:border-purple-400 dark:hover:border-purple-500 hover:bg-gray-50 dark:hover:bg-dark-hover'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                          isSelected
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-200 dark:bg-dark-elevated text-gray-700 dark:text-dark-text-primary'
                        }`}
                      >
                        {option.letter}
                      </div>
                      <span className="text-lg text-gray-800 dark:text-dark-text-primary">
                        {option.text}
                      </span>
                    </div>
                    {roomId && voteCount > 0 && (
                      <div className="flex items-center gap-1">
                        {voters.map((voter, idx) => {
                          const initial = voter.player_name.charAt(0).toUpperCase();
                          const colors = ['bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-red-500', 'bg-purple-500', 'bg-pink-500'];
                          const color = colors[voter.player_id % colors.length];
                          
                          return (
                            <div
                              key={idx}
                              className={`w-7 h-7 rounded-full ${color} text-white text-xs font-bold flex items-center justify-center border-2 border-white dark:border-dark-border`}
                              title={voter.player_name}
                            >
                              {initial}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {roomId && (
            <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-800 dark:text-blue-300 text-center">
                {consensus ? (
                  <span className="font-bold">
                    ✓ Consenso alcançado! ({consensus.votes}/{consensus.total} jogadores)
                  </span>
                ) : (
                  <span>
                    {(() => {
                      const questionVotes = votes[currentQuestionIndex] || {};
                      const allVoters = new Set();
                      Object.values(questionVotes).forEach(voters => {
                        voters.forEach(voter => allVoters.add(voter.player_id));
                      });
                      const answered = allVoters.size;
                      const total = connectedPlayers.length;
                      
                      if (answered === total && total > 0) {
                        return <span className="font-semibold">⚠️ Todos responderam ({answered}/{total}), mas é necessário maioria votar na mesma resposta!</span>;
                      } else {
                        return <span>Aguardando respostas... ({answered}/{total} responderam)</span>;
                      }
                    })()}
                  </span>
                )}
              </p>
            </div>
          )}

          <button
            onClick={handleNextQuestion}
            disabled={!canAdvance}
            className="w-full px-6 py-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed font-bold text-lg flex items-center justify-center gap-2"
          >
            {currentQuestionIndex < questions.length - 1 ? (
              <>
                Próxima Pergunta
                <ArrowRight className="w-5 h-5" />
              </>
            ) : (
              'Finalizar Quiz'
            )}
          </button>
        </div>

        {/* Card de Jogadores Online - Apenas em modo sala */}
        {roomId && (
          <div className="bg-white dark:bg-dark-surface rounded-lg shadow-lg p-6 border border-gray-200 dark:border-dark-border h-fit">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <h3 className="text-lg font-bold text-gray-800 dark:text-dark-text-primary">
                Jogadores Online
              </h3>
              <span className="ml-auto text-sm font-semibold text-gray-600 dark:text-gray-400">
                {connectedPlayers.length}
              </span>
            </div>
            
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {connectedPlayers.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                  Nenhum jogador conectado
                </p>
              ) : (
                connectedPlayers.map((player, index) => {
                  const isMe = player.player_id === myPlayerIdRef.current;
                  const initial = player.username.charAt(0).toUpperCase();
                  const colors = ['bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-red-500', 'bg-purple-500', 'bg-pink-500'];
                  const color = colors[player.player_id % colors.length];
                  
                  // Verificar se o jogador já respondeu a questão atual
                  const questionVotes = votes[currentQuestionIndex] || {};
                  const hasAnswered = Object.values(questionVotes).some(voters => 
                    voters.some(voter => voter.player_id === player.player_id)
                  );
                  
                  return (
                    <div
                      key={`${player.player_id}-${index}`}
                      className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                        isMe
                          ? 'bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 border-yellow-400 dark:border-yellow-600'
                          : 'bg-gray-50 dark:bg-dark-elevated border-gray-200 dark:border-dark-border'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-full ${color} text-white font-bold flex items-center justify-center text-sm shrink-0`}>
                        {initial}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold text-sm truncate ${
                          isMe
                            ? 'text-yellow-900 dark:text-yellow-200'
                            : 'text-gray-800 dark:text-dark-text-primary'
                        }`}>
                          {player.username} {isMe && '(Você)'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {hasAnswered ? (
                            <span className="text-green-600 dark:text-green-400 font-medium">✓ Respondeu</span>
                          ) : (
                            <span className="text-gray-400 dark:text-gray-500">Aguardando...</span>
                          )}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

export default QuizPlay;
