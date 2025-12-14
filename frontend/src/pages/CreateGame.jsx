import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, BookOpen, ArrowRight, Zap, MessageSquare } from 'lucide-react';

const CreateGame = () => {
  const navigate = useNavigate();
  const [selectedType, setSelectedType] = useState(null);
  const [gameData, setGameData] = useState({
    name: '',
    description: '',
    game_type: '',
  });

  const gameTypes = [
    {
      id: 'word_search',
      name: 'Caça-Palavras',
      description: 'Crie um jogo de caça-palavras personalizado com suas próprias palavras',
      icon: Search,
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      borderColor: 'border-blue-200 dark:border-blue-800',
      iconColor: 'text-blue-600 dark:text-blue-400',
    },
    {
      id: 'quiz',
      name: 'Quiz',
      description: 'Crie um quiz com perguntas de múltipla escolha',
      icon: BookOpen,
      color: 'from-purple-500 to-purple-600',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20',
      borderColor: 'border-purple-200 dark:border-purple-800',
      iconColor: 'text-purple-600 dark:text-purple-400',
    },
    {
      id: 'kahoot',
      name: 'Kahoot',
      description: 'Crie um jogo estilo Kahoot com perguntas ao vivo e apresentador',
      icon: Zap,
      color: 'from-pink-500 to-pink-600',
      bgColor: 'bg-pink-50 dark:bg-pink-900/20',
      borderColor: 'border-pink-200 dark:border-pink-800',
      iconColor: 'text-pink-600 dark:text-pink-400',
    },
    {
      id: 'open_question',
      name: 'Pergunta Aberta',
      description: 'Faça uma pergunta e receba respostas abertas dos jogadores em tempo real',
      icon: MessageSquare,
      color: 'from-orange-500 to-orange-600',
      bgColor: 'bg-orange-50 dark:bg-orange-900/20',
      borderColor: 'border-orange-200 dark:border-orange-800',
      iconColor: 'text-orange-600 dark:text-orange-400',
    },
  ];

  const handleSelectType = (type) => {
    setSelectedType(type);
    setGameData({ ...gameData, game_type: type });
  };

  const handleContinue = () => {
    if (!gameData.name || !gameData.description || !gameData.game_type) {
      alert('Por favor, preencha todos os campos');
      return;
    }

    // Salvar dados temporariamente e navegar para o configurador específico
    localStorage.setItem('tempGameData', JSON.stringify(gameData));
    
    if (gameData.game_type === 'word_search') {
      navigate('/create/word-search');
    } else if (gameData.game_type === 'quiz') {
      navigate('/create/quiz');
    } else if (gameData.game_type === 'kahoot') {
      navigate('/create/kahoot');
    } else if (gameData.game_type === 'open_question') {
      navigate('/create/open-question');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-dark-text-primary mb-2">
            Criar Novo Jogo
          </h1>
          <p className="text-gray-600 dark:text-dark-text-secondary">
            Escolha o tipo de jogo e configure as informações básicas
          </p>
        </div>

        {/* Step 1: Choose Game Type */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-dark-text-primary mb-4">
            1. Escolha o Tipo de Jogo
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {gameTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => handleSelectType(type.id)}
                className={`
                  p-6 rounded-xl border-2 transition-all text-left
                  ${
                    selectedType === type.id
                      ? `${type.borderColor} ${type.bgColor} shadow-lg scale-105`
                      : 'border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface hover:shadow-md hover:border-gray-300 dark:hover:border-gray-700'
                  }
                `}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg ${type.bgColor}`}>
                    <type.icon className={`w-8 h-8 ${type.iconColor}`} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-dark-text-primary mb-2">
                      {type.name}
                    </h3>
                    <p className="text-gray-600 dark:text-dark-text-secondary text-sm">
                      {type.description}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Step 2: Basic Information */}
        {selectedType && (
          <div className="bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl p-6 animate-slide-in-up">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-dark-text-primary mb-4">
              2. Informações Básicas
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-primary mb-2">
                  Nome do Jogo *
                </label>
                <input
                  type="text"
                  value={gameData.name}
                  onChange={(e) => setGameData({ ...gameData, name: e.target.value })}
                  placeholder="Ex: Animais da Floresta"
                  maxLength={100}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-dark-elevated border border-gray-300 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent text-gray-900 dark:text-dark-text-primary placeholder-gray-400 dark:placeholder-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-primary mb-2">
                  Descrição *
                </label>
                <textarea
                  value={gameData.description}
                  onChange={(e) => setGameData({ ...gameData, description: e.target.value })}
                  placeholder="Descreva seu jogo em poucas palavras..."
                  rows={4}
                  maxLength={500}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-dark-elevated border border-gray-300 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent resize-none text-gray-900 dark:text-dark-text-primary placeholder-gray-400 dark:placeholder-gray-500"
                />
                <p className="text-sm text-gray-500 dark:text-dark-text-secondary mt-1">
                  {gameData.description.length}/500 caracteres
                </p>
              </div>

              <button
                onClick={handleContinue}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black rounded-lg hover:from-yellow-400 hover:to-yellow-500 transition-all font-bold shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                Continuar para Configuração
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateGame;
