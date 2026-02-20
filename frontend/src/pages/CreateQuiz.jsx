import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Save, ChevronUp, ChevronDown, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import api from '../services/api';

const CreateQuiz = () => {
  const navigate = useNavigate();
  const [gameData, setGameData] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [saving, setSaving] = useState(false);
  const [endScreenText, setEndScreenText] = useState('Parabéns! Você completou o quiz!');
  const [endScreenButtonText, setEndScreenButtonText] = useState('');
  const [endScreenButtonUrl, setEndScreenButtonUrl] = useState('');
  const [endScreenButtonNewTab, setEndScreenButtonNewTab] = useState(true);
  const [showEndScreenButton, setShowEndScreenButton] = useState(false);
  const [minPlayers, setMinPlayers] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    const tempData = localStorage.getItem('tempGameData');
    if (tempData) {
      setGameData(JSON.parse(tempData));
    } else {
      navigate('/create');
    }
  }, [navigate]);

  const showNotification = (message, type = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const addQuestion = () => {
    const newQuestion = {
      id: Date.now(),
      question_text: '',
      options: ['', '', '', ''],
      correct_answer: 0,
      points: 100,
      has_justification: false,
      justification: '',
    };
    setQuestions([...questions, newQuestion]);
  };

  const removeQuestion = (questionId) => {
    setQuestions(questions.filter((q) => q.id !== questionId));
  };

  const updateQuestion = (questionId, field, value) => {
    setQuestions(
      questions.map((q) =>
        q.id === questionId ? { ...q, [field]: value } : q
      )
    );
  };

  const updateOption = (questionId, optionIndex, value) => {
    setQuestions(
      questions.map((q) => {
        if (q.id === questionId) {
          const newOptions = [...q.options];
          newOptions[optionIndex] = value;
          return { ...q, options: newOptions };
        }
        return q;
      })
    );
  };

  const moveQuestion = (index, direction) => {
    const newQuestions = [...questions];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (newIndex < 0 || newIndex >= questions.length) return;
    
    [newQuestions[index], newQuestions[newIndex]] = [newQuestions[newIndex], newQuestions[index]];
    setQuestions(newQuestions);
  };

  const validateQuestions = () => {
    for (const q of questions) {
      if (!q.question_text.trim()) {
        showNotification('Todas as perguntas devem ter um texto', 'error');
        return false;
      }
      
      for (const option of q.options) {
        if (!option.trim()) {
          showNotification('Todas as opções devem ser preenchidas', 'error');
          return false;
        }
      }
    }
    return true;
  };

  const handleSave = async () => {
    if (questions.length === 0) {
      showNotification('Adicione pelo menos uma pergunta', 'error');
      return;
    }

    if (questions.length < 3) {
      setShowConfirmModal(true);
      return;
    }

    if (!validateQuestions()) {
      return;
    }

    await saveQuiz();
  };

  const saveQuiz = async () => {

    setSaving(true);

    try {
      // Create game
      const gameResponse = await api.post('/protected/games', {
        name: gameData.name,
        description: gameData.description,
        game_type: 'quiz',
        is_active: true,
      });

      const gameId = gameResponse.data.id;

      // Create quiz config
      const quizResponse = await api.post('/protected/quiz', {
        game_id: gameId,
        time_limit: 300, // 5 minutos
        passing_score: 60,
        end_screen_text: endScreenText,
        end_screen_button_text: showEndScreenButton ? endScreenButtonText : null,
        end_screen_button_url: showEndScreenButton ? endScreenButtonUrl : null,
        end_screen_button_new_tab: showEndScreenButton ? endScreenButtonNewTab : null,
        min_players: minPlayers ? parseInt(minPlayers) : null,
      });

      // Use game_id (not quiz config id) for creating questions
      // Create questions
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        await api.post(`/protected/quiz/${gameId}/questions`, {
          question_text: q.question_text,
          options: q.options,
          correct_answer: q.correct_answer,
          points: q.points,
          order_number: i + 1,
          justification: q.has_justification ? q.justification : null,
        });
      }

      localStorage.removeItem('tempGameData');
      showNotification('Quiz criado com sucesso!', 'success');
      setTimeout(() => navigate('/my-games'), 1000);
    } catch (error) {
      console.error('Erro ao criar quiz:', error);
      showNotification('Erro ao criar quiz. Tente novamente.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!gameData) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg py-8 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-dark-text-primary mb-2">
            Configurar Quiz
          </h1>
          <p className="text-gray-600 dark:text-dark-text-secondary">
            {gameData.name}
          </p>
        </div>

        <div className="space-y-6">
          {/* Questions List */}
          {questions.map((question, index) => (
            <div
              key={question.id}
              className="bg-white dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-xl p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900 dark:text-dark-text-primary">
                  Pergunta {index + 1}
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => moveQuestion(index, 'up')}
                    disabled={index === 0}
                    className="p-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-900 rounded-lg transition-colors disabled:opacity-30"
                    title="Mover para cima"
                  >
                    <ChevronUp className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => moveQuestion(index, 'down')}
                    disabled={index === questions.length - 1}
                    className="p-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-900 rounded-lg transition-colors disabled:opacity-30"
                    title="Mover para baixo"
                  >
                    <ChevronDown className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => removeQuestion(question.id)}
                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    title="Remover pergunta"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {/* Question Text */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-primary mb-2">
                    Texto da Pergunta *
                  </label>
                  <textarea
                    value={question.question_text}
                    onChange={(e) => updateQuestion(question.id, 'question_text', e.target.value)}
                    placeholder="Digite a pergunta..."
                    rows={2}
                    maxLength={500}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-dark-surface border border-gray-300 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none text-gray-900 dark:text-dark-text-primary"
                  />
                </div>

                {/* Options */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-primary mb-2">
                    Opções de Resposta *
                  </label>
                  <div className="space-y-2">
                    {question.options.map((option, optionIndex) => (
                      <div key={optionIndex} className="flex items-center gap-3">
                        <input
                          type="radio"
                          name={`correct-${question.id}`}
                          checked={question.correct_answer === optionIndex}
                          onChange={() => updateQuestion(question.id, 'correct_answer', optionIndex)}
                          className="w-5 h-5 text-purple-600"
                        />
                        <input
                          type="text"
                          value={option}
                          onChange={(e) => updateOption(question.id, optionIndex, e.target.value)}
                          placeholder={`Opção ${optionIndex + 1}`}
                          maxLength={200}
                          className={`flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 dark:text-dark-text-primary ${
                            question.correct_answer === optionIndex
                              ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
                              : 'bg-gray-50 dark:bg-dark-surface border-gray-300 dark:border-dark-border'
                          }`}
                        />
                      </div>
                    ))}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-dark-text-secondary mt-2">
                    Selecione o botão de rádio ao lado da resposta correta
                  </p>
                </div>

                {/* Points */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-primary mb-2">
                    Pontos
                  </label>
                  <input
                    type="number"
                    value={question.points}
                    onChange={(e) => updateQuestion(question.id, 'points', parseInt(e.target.value) || 10)}
                    min="1"
                    max="100"
                    className="w-32 px-4 py-2 bg-gray-50 dark:bg-dark-surface border border-gray-300 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 dark:text-dark-text-primary"
                  />
                </div>
                
                {/* Justification */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="checkbox"
                      id={`has-justification-${question.id}`}
                      checked={question.has_justification}
                      onChange={(e) => updateQuestion(question.id, 'has_justification', e.target.checked)}
                      className="w-4 h-4 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
                    />
                    <label htmlFor={`has-justification-${question.id}`} className="text-sm font-medium text-gray-700 dark:text-dark-text-primary">
                      Adicionar justificativa/explicação
                    </label>
                  </div>
                  
                  {question.has_justification && (
                    <textarea
                      value={question.justification}
                      onChange={(e) => updateQuestion(question.id, 'justification', e.target.value)}
                      placeholder="Digite a justificativa ou explicação da resposta correta..."
                      rows={3}
                      maxLength={1000}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-dark-surface border border-gray-300 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none text-gray-900 dark:text-dark-text-primary placeholder-gray-400 dark:placeholder-gray-500"
                    />
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Add Question Button */}
          <button
            onClick={addQuestion}
            className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gray-200 dark:bg-dark-elevated text-gray-700 dark:text-dark-text-primary rounded-xl hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors border-2 border-dashed border-gray-300 dark:border-dark-border"
          >
            <Plus className="w-5 h-5" />
            Adicionar Pergunta
          </button>

          {/* Multiplayer Settings */}
          <div className="bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl p-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-dark-text-primary mb-1">
              Modo Sala
            </h2>
            <p className="text-sm text-gray-500 dark:text-dark-text-secondary mb-4">
              Configurações aplicadas quando o jogo é jogado em uma sala com múltiplos jogadores.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-primary mb-1">
                Mínimo de respostas para avançar
              </label>
              <p className="text-xs text-gray-500 dark:text-dark-text-secondary mb-2">
                O jogo só permitirá avançar para a próxima pergunta após pelo menos esse número de jogadores responderem (e houver consenso de maioria). Deixe em branco para não exigir mínimo.
              </p>
              <input
                type="number"
                value={minPlayers}
                onChange={(e) => setMinPlayers(e.target.value)}
                placeholder="Ex: 3"
                min="1"
                max="50"
                className="w-40 px-4 py-2 bg-gray-50 dark:bg-dark-elevated border border-gray-300 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 dark:text-dark-text-primary placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>
          </div>

          {/* End Screen Configuration */}
          <div className="bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl p-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-dark-text-primary mb-4">
              Tela de Conclusão
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-primary mb-2">
                  Mensagem Final
                </label>
                <textarea
                  value={endScreenText}
                  onChange={(e) => setEndScreenText(e.target.value)}
                  placeholder="Mensagem exibida quando o jogador completar o quiz"
                  rows="3"
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-dark-elevated border border-gray-300 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 dark:text-dark-text-primary placeholder-gray-400 dark:placeholder-gray-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-2 pb-2 border-t border-gray-200 dark:border-dark-border">
                <input
                  type="checkbox"
                  id="showButton"
                  checked={showEndScreenButton}
                  onChange={(e) => setShowEndScreenButton(e.target.checked)}
                  className="w-4 h-4 text-purple-600 bg-gray-100 dark:bg-dark-elevated border-gray-300 dark:border-gray-600 rounded focus:ring-purple-500"
                />
                <label htmlFor="showButton" className="text-sm font-medium text-gray-700 dark:text-dark-text-primary cursor-pointer">
                  Exibir botão personalizado
                </label>
              </div>

              {showEndScreenButton && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-primary mb-2">
                      Texto do Botão
                    </label>
                    <input
                      type="text"
                      value={endScreenButtonText}
                      onChange={(e) => setEndScreenButtonText(e.target.value)}
                      placeholder="Ex: Voltar ao site"
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-dark-elevated border border-gray-300 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 dark:text-dark-text-primary placeholder-gray-400 dark:placeholder-gray-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-primary mb-2">
                      Link do Botão (URL)
                    </label>
                    <input
                      type="url"
                      value={endScreenButtonUrl}
                      onChange={(e) => setEndScreenButtonUrl(e.target.value)}
                      placeholder="https://exemplo.com"
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-dark-elevated border border-gray-300 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 dark:text-dark-text-primary placeholder-gray-400 dark:placeholder-gray-500"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="newTab"
                      checked={endScreenButtonNewTab}
                      onChange={(e) => setEndScreenButtonNewTab(e.target.checked)}
                      className="w-4 h-4 text-purple-600 bg-gray-100 dark:bg-dark-elevated border-gray-300 dark:border-gray-600 rounded focus:ring-purple-500"
                    />
                    <label htmlFor="newTab" className="text-sm font-medium text-gray-700 dark:text-dark-text-primary cursor-pointer">
                      Abrir em nova guia
                    </label>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-gray-200 dark:border-dark-border">
            <button
              onClick={handleSave}
              disabled={questions.length === 0 || saving}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg hover:from-purple-400 hover:to-purple-500 transition-all font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-5 h-5" />
              {saving ? 'Salvando...' : 'Salvar Quiz'}
            </button>

            <button
              onClick={() => navigate('/create')}
              className="px-6 py-4 bg-gray-200 dark:bg-dark-elevated text-gray-700 dark:text-dark-text-primary rounded-lg hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors font-medium"
            >
              Voltar
            </button>
          </div>

          {/* Info Box */}
          {questions.length === 0 && (
            <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-700 dark:text-blue-400">
                <p className="font-bold mb-1">Dica:</p>
                <ul className="space-y-1">
                  <li>• Adicione perguntas claras e objetivas</li>
                  <li>• Cada pergunta deve ter 4 opções de resposta</li>
                  <li>• Marque a resposta correta usando o botão de rádio</li>
                  <li>• Você pode reordenar as perguntas usando as setas</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in-right">
          <div className={`${
            toastType === 'success' ? 'bg-green-600' : 'bg-red-600'
          } text-white px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 min-w-[300px]`}>
            <div className="flex-shrink-0">
              {toastType === 'success' ? (
                <CheckCircle className="w-6 h-6" />
              ) : (
                <XCircle className="w-6 h-6" />
              )}
            </div>
            <div>
              <p className="font-bold text-lg">{toastType === 'success' ? 'Sucesso!' : 'Erro!'}</p>
              <p className="text-sm">{toastMessage}</p>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-surface rounded-xl shadow-2xl max-w-md w-full p-6 animate-scale-in">
            <div className="flex items-start gap-4 mb-6">
              <div className="flex-shrink-0">
                <AlertCircle className="w-12 h-12 text-yellow-500" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-dark-text-primary mb-2">
                  Poucas Perguntas
                </h3>
                <p className="text-gray-600 dark:text-dark-text-secondary">
                  Seu quiz tem menos de 3 perguntas. Recomendamos adicionar mais perguntas para uma melhor experiência. Deseja continuar mesmo assim?
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 px-4 py-3 bg-gray-200 dark:bg-dark-elevated text-gray-700 dark:text-dark-text-primary rounded-lg hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  setShowConfirmModal(false);
                  if (validateQuestions()) {
                    await saveQuiz();
                  }
                }}
                className="flex-1 px-4 py-3 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors font-bold"
              >
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateQuiz;
