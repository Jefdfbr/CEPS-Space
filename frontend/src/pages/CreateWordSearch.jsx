import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Eye, Save, AlertCircle, ArrowUp, ArrowDown, ArrowRight, ArrowLeft, ArrowUpRight, ArrowUpLeft, ArrowDownRight, ArrowDownLeft, X, Edit, CheckCircle, XCircle } from 'lucide-react';
import api from '../services/api';

const CreateWordSearch = () => {
  const navigate = useNavigate();
  const [gameData, setGameData] = useState(null);
  const [words, setWords] = useState([]);
  const [currentWord, setCurrentWord] = useState('');
  const [concepts, setConcepts] = useState({});
  const [showConceptInput, setShowConceptInput] = useState(false);
  const [currentConcept, setCurrentConcept] = useState('');
  const [editingWordConcept, setEditingWordConcept] = useState(null);
  const [gridSize, setGridSize] = useState(15);
  const [difficulty, setDifficulty] = useState('medium');
  const [showPreview, setShowPreview] = useState(false);
  const [previewGrid, setPreviewGrid] = useState([]);
  const [saving, setSaving] = useState(false);
  const [endScreenText, setEndScreenText] = useState('Parabéns! Você completou o jogo!');
  const [endScreenButtonText, setEndScreenButtonText] = useState('');
  const [endScreenButtonUrl, setEndScreenButtonUrl] = useState('');
  const [endScreenButtonNewTab, setEndScreenButtonNewTab] = useState(true);
  const [showEndScreenButton, setShowEndScreenButton] = useState(false);
  const [selectedDirections, setSelectedDirections] = useState({
    up: true,              // ↑ vertical para cima
    down: true,            // ↓ vertical para baixo
    left: true,            // ← horizontal esquerda
    right: true,           // → horizontal direita
    upLeft: true,          // ↖ diagonal
    upRight: true,         // ↗ diagonal
    downLeft: true,        // ↙ diagonal
    downRight: true,       // ↘ diagonal
  });
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');
  const [showFewWordsModal, setShowFewWordsModal] = useState(false);
  const [hideWords, setHideWords] = useState(false);

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

  const addWord = () => {
    const cleanWord = currentWord.trim().toUpperCase();
    
    if (!cleanWord) {
      showNotification('Digite uma palavra válida', 'error');
      return;
    }

    if (cleanWord.length < 3) {
      showNotification('A palavra deve ter pelo menos 3 letras', 'error');
      return;
    }

    if (cleanWord.length > gridSize) {
      showNotification(`A palavra não pode ter mais de ${gridSize} letras`, 'error');
      return;
    }

    if (!/^[A-Z]+$/.test(cleanWord)) {
      showNotification('Use apenas letras (sem acentos ou números)', 'error');
      return;
    }

    if (words.includes(cleanWord)) {
      showNotification('Esta palavra já foi adicionada', 'error');
      return;
    }

    setWords([...words, cleanWord]);
    
    if (showConceptInput && currentConcept.trim()) {
      setConcepts({
        ...concepts,
        [cleanWord]: currentConcept.trim()
      });
    }
    
    setCurrentWord('');
    setCurrentConcept('');
    setShowConceptInput(false);
  };

  const removeWord = (wordToRemove) => {
    setWords(words.filter((word) => word !== wordToRemove));
    const newConcepts = { ...concepts };
    delete newConcepts[wordToRemove];
    setConcepts(newConcepts);
  };

  const startEditingConcept = (word) => {
    setEditingWordConcept(word);
    setCurrentConcept(concepts[word] || '');
  };

  const saveWordConcept = (word) => {
    if (currentConcept.trim()) {
      setConcepts({
        ...concepts,
        [word]: currentConcept.trim()
      });
    } else {
      const newConcepts = { ...concepts };
      delete newConcepts[word];
      setConcepts(newConcepts);
    }
    setEditingWordConcept(null);
    setCurrentConcept('');
  };

  const cancelEditingConcept = () => {
    setEditingWordConcept(null);
    setCurrentConcept('');
  };

  const generateGrid = () => {
    if (words.length === 0) {
      alert('Adicione pelo menos uma palavra');
      return;
    }

    const grid = Array(gridSize).fill(null).map(() => 
      Array(gridSize).fill(null).map(() => ({ letter: '', placed: false }))
    );

    // Build directions array based on selectedDirections
    const directions = [];
    if (selectedDirections.right) {
      directions.push({ dx: 0, dy: 1 });   // → horizontal direita
    }
    if (selectedDirections.left) {
      directions.push({ dx: 0, dy: -1 });  // ← horizontal esquerda
    }
    if (selectedDirections.down) {
      directions.push({ dx: 1, dy: 0 });   // ↓ vertical baixo
    }
    if (selectedDirections.up) {
      directions.push({ dx: -1, dy: 0 });  // ↑ vertical cima
    }
    if (selectedDirections.downRight) {
      directions.push({ dx: 1, dy: 1 });   // ↘ diagonal baixo-direita
    }
    if (selectedDirections.upLeft) {
      directions.push({ dx: -1, dy: -1 }); // ↖ diagonal cima-esquerda
    }
    if (selectedDirections.downLeft) {
      directions.push({ dx: 1, dy: -1 });  // ↙ diagonal baixo-esquerda
    }
    if (selectedDirections.upRight) {
      directions.push({ dx: -1, dy: 1 });  // ↗ diagonal cima-direita
    }

    if (directions.length === 0) {
      alert('Selecione pelo menos uma direção para as palavras');
      return;
    }

    // Sort words by length (longest first for better placement)
    const sortedWords = [...words].sort((a, b) => b.length - a.length);

    let placedWords = 0;
    const maxAttempts = 100;

    for (const word of sortedWords) {
      let placed = false;
      let attempts = 0;

      while (!placed && attempts < maxAttempts) {
        const direction = directions[Math.floor(Math.random() * directions.length)];
        const row = Math.floor(Math.random() * gridSize);
        const col = Math.floor(Math.random() * gridSize);

        if (canPlaceWord(grid, word, row, col, direction)) {
          placeWord(grid, word, row, col, direction);
          placed = true;
          placedWords++;
        }

        attempts++;
      }
    }

    // Fill empty cells with random letters
    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        if (!grid[i][j].letter) {
          grid[i][j].letter = getRandomLetter();
        }
      }
    }

    setPreviewGrid(grid);
    setShowPreview(true);

    if (placedWords < words.length) {
      alert(`Atenção: Apenas ${placedWords} de ${words.length} palavras foram posicionadas. Tente usar um grid maior ou palavras menores.`);
    }
  };

  const canPlaceWord = (grid, word, row, col, direction) => {
    for (let i = 0; i < word.length; i++) {
      const newRow = row + i * direction.dx;
      const newCol = col + i * direction.dy;

      // Check bounds
      if (newRow < 0 || newRow >= gridSize || newCol < 0 || newCol >= gridSize) {
        return false;
      }

      // Check if cell is empty or has the same letter
      const cell = grid[newRow][newCol];
      if (cell.letter && cell.letter !== word[i]) {
        return false;
      }
    }

    return true;
  };

  const placeWord = (grid, word, row, col, direction) => {
    for (let i = 0; i < word.length; i++) {
      const newRow = row + i * direction.dx;
      const newCol = col + i * direction.dy;
      grid[newRow][newCol] = { letter: word[i], placed: true };
    }
  };

  const getRandomLetter = () => {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    return letters[Math.floor(Math.random() * letters.length)];
  };

  const toggleDirection = (direction) => {
    setSelectedDirections(prev => ({
      ...prev,
      [direction]: !prev[direction]
    }));
  };

  const toggleAllDirections = () => {
    const allSelected = Object.values(selectedDirections).every(v => v);
    const newValue = !allSelected;
    setSelectedDirections({
      up: newValue,
      down: newValue,
      left: newValue,
      right: newValue,
      upLeft: newValue,
      upRight: newValue,
      downLeft: newValue,
      downRight: newValue,
    });
  };

  const handleSave = async () => {
    if (words.length === 0) {
      showNotification('Adicione pelo menos uma palavra', 'error');
      return;
    }

    if (words.length < 5) {
      setShowFewWordsModal(true);
      return;
    }

    await confirmSave();
  };

  const confirmSave = async () => {
    setShowFewWordsModal(false);
    setSaving(true);

    try {
      // Create game
      const gameResponse = await api.post('/protected/games', {
        name: gameData.name,
        description: gameData.description,
        game_type: 'word_search',
        is_active: true,
        end_screen_text: endScreenText,
        end_screen_button_text: showEndScreenButton ? endScreenButtonText : null,
        end_screen_button_url: showEndScreenButton ? endScreenButtonUrl : null,
        end_screen_button_new_tab: showEndScreenButton ? endScreenButtonNewTab : null,
      });

      const gameId = gameResponse.data.id;

      // Construir array de direções permitidas
      const allowedDirections = [];
      if (selectedDirections.right) allowedDirections.push('right');
      if (selectedDirections.left) allowedDirections.push('left');
      if (selectedDirections.down) allowedDirections.push('down');
      if (selectedDirections.up) allowedDirections.push('up');
      if (selectedDirections.downRight) allowedDirections.push('downRight');
      if (selectedDirections.upLeft) allowedDirections.push('upLeft');
      if (selectedDirections.downLeft) allowedDirections.push('downLeft');
      if (selectedDirections.upRight) allowedDirections.push('upRight');

      // Create word search config
      await api.post('/protected/word-search', {
        game_id: gameId,
        grid_size: gridSize,
        words: words,
        difficulty: difficulty,
        time_limit: difficulty === 'easy' ? 600 : difficulty === 'medium' ? 300 : 180,
        allowed_directions: allowedDirections,
        concepts: concepts,
        hide_words: hideWords,
      });

      localStorage.removeItem('tempGameData');
      showNotification('Jogo criado com sucesso!');
      setTimeout(() => navigate('/my-games'), 1500);
    } catch (error) {
      console.error('Erro ao criar jogo:', error);
      showNotification('Erro ao criar jogo. Tente novamente.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!gameData) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-dark-text-primary mb-2">
            Configurar Caça-Palavras
          </h1>
          <p className="text-gray-600 dark:text-dark-text-secondary">
            {gameData.name}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Configuration Panel */}
          <div className="lg:col-span-2 space-y-6">
            {/* Add Words */}
            <div className="bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl p-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-dark-text-primary mb-1">
                Palavras do Jogo
              </h2>
              <p className="text-sm text-gray-500 dark:text-dark-text-secondary mb-4">
                Adicione de 5 a 20 palavras com letras de A–Z (sem acentos).
              </p>

              {/* Esconder Palavras — visível só quando todas as palavras têm descrição */}
              {words.length > 0 && words.every(w => concepts[w.toUpperCase()]) && (
                <div className="flex items-start gap-3 mb-5 p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg">
                  <input
                    type="checkbox"
                    id="hideWords"
                    checked={hideWords}
                    onChange={(e) => setHideWords(e.target.checked)}
                    className="w-4 h-4 mt-0.5 text-yellow-500 bg-gray-100 dark:bg-dark-elevated border-gray-300 dark:border-gray-600 rounded focus:ring-yellow-500"
                  />
                  <div>
                    <label htmlFor="hideWords" className="text-sm font-semibold text-purple-900 dark:text-purple-200 cursor-pointer">
                      🫣 Esconder Palavras
                    </label>
                    <p className="text-xs text-purple-700 dark:text-purple-300 mt-0.5">
                      O nome de cada palavra ficará desfocado e ilegível. O jogador lê a descrição para descobrir a palavra no grid. Ao encontrá-la, o nome é revelado.
                    </p>
                  </div>
                </div>
              )}

              {/* Nova Palavra */}
              <div className="mb-1">
                <label className="block text-sm font-semibold text-gray-700 dark:text-dark-text-primary mb-2">
                  Nova palavra
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={currentWord}
                    onChange={(e) => setCurrentWord(e.target.value.toUpperCase())}
                    onKeyPress={(e) => e.key === 'Enter' && addWord()}
                    placeholder="Ex: FOTOSSINTESE"
                    maxLength={gridSize}
                    className="flex-1 px-4 py-3 bg-gray-50 dark:bg-dark-elevated border border-gray-300 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent uppercase text-gray-900 dark:text-dark-text-primary placeholder-gray-400 dark:placeholder-gray-500"
                  />
                  <button
                    onClick={addWord}
                    className="px-6 py-3 bg-yellow-500 text-black rounded-lg hover:bg-yellow-400 transition-colors font-bold flex items-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    Adicionar
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    id="add-concept"
                    checked={showConceptInput}
                    onChange={(e) => setShowConceptInput(e.target.checked)}
                    className="w-4 h-4 text-yellow-600 rounded focus:ring-2 focus:ring-yellow-500"
                  />
                  <label htmlFor="add-concept" className="text-sm font-medium text-gray-700 dark:text-dark-text-primary">
                    Adicionar conceito/definição
                  </label>
                </div>

                {showConceptInput && (
                  <textarea
                    value={currentConcept}
                    onChange={(e) => setCurrentConcept(e.target.value)}
                    placeholder="Digite o conceito ou definição da palavra..."
                    rows={3}
                    maxLength={500}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-dark-elevated border border-gray-300 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent text-gray-900 dark:text-dark-text-primary placeholder-gray-400 dark:placeholder-gray-500 resize-none"
                  />
                )}
              </div>

              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-dark-text-secondary mb-4">
                <AlertCircle className="w-4 h-4" />
                <span>Use apenas letras de A-Z (sem acentos, espaços ou números)</span>
              </div>

              {words.length > 0 ? (
                <div className="space-y-2">
                  {words.map((word, index) => (
                    <div
                      key={index}
                      className="px-4 py-3 bg-gray-50 dark:bg-dark-elevated rounded-lg"
                    >
                      {editingWordConcept === word ? (
                        // Modo de edição
                        <div className="space-y-2">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-mono text-lg font-bold text-gray-900 dark:text-dark-text-primary">
                              {word}
                            </span>
                            <div className="flex gap-2">
                              <button
                                onClick={() => saveWordConcept(word)}
                                className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm transition-colors"
                              >
                                Salvar
                              </button>
                              <button
                                onClick={cancelEditingConcept}
                                className="px-3 py-1 bg-gray-500 hover:bg-gray-600 text-white rounded text-sm transition-colors"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                          <textarea
                            value={currentConcept}
                            onChange={(e) => setCurrentConcept(e.target.value)}
                            placeholder="Digite o conceito ou definição da palavra..."
                            rows={3}
                            maxLength={500}
                            autoFocus
                            className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-yellow-500 text-gray-900 dark:text-dark-text-primary placeholder-gray-400 dark:placeholder-gray-500 resize-none text-sm"
                          />
                        </div>
                      ) : (
                        // Modo de visualização
                        <>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-mono text-lg font-bold text-gray-900 dark:text-dark-text-primary">
                              {word}
                            </span>
                            <div className="flex gap-2">
                              <button
                                onClick={() => startEditingConcept(word)}
                                className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                title={concepts[word] ? 'Editar conceito' : 'Adicionar conceito'}
                              >
                                <Edit className="w-5 h-5" />
                              </button>
                              <button
                                onClick={() => removeWord(word)}
                                className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </div>
                          </div>
                          {concepts[word] && (
                            <p className="text-sm text-gray-600 dark:text-dark-text-secondary italic">
                              {concepts[word]}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 dark:text-dark-text-secondary py-8">
                  Nenhuma palavra adicionada ainda
                </p>
              )}
            </div>

            {/* Grid Settings */}
            <div className="bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl p-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-dark-text-primary mb-4">
                Configurações do Grid
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-primary mb-2 text-center">
                    Tamanho do Grid: {gridSize}x{gridSize}
                  </label>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-gray-500 dark:text-dark-text-secondary font-medium min-w-[50px]">10x10</span>
                    <input
                      type="range"
                      min="10"
                      max="20"
                      value={gridSize}
                      onChange={(e) => setGridSize(parseInt(e.target.value))}
                      className="flex-1"
                    />
                    <span className="text-xs text-gray-500 dark:text-dark-text-secondary font-medium min-w-[50px] text-right">20x20</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Word Directions Selector */}
            <div className="bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl p-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-dark-text-primary mb-4">
                Sentido das Palavras
              </h2>
              <div className="relative">
                {/* Grid de seleção de direções 3x3 */}
                <div className="grid grid-cols-3 gap-2 w-fit mx-auto">
                  {/* Linha 1 */}
                  <button
                    onClick={() => toggleDirection('upLeft')}
                    className={`p-3 rounded-lg transition-all ${
                      selectedDirections.upLeft
                        ? 'bg-yellow-500 text-black'
                        : 'bg-gray-100 dark:bg-dark-elevated text-gray-400 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                    title="Diagonal ↖"
                  >
                    <ArrowUpLeft className="w-6 h-6" />
                  </button>
                  <button
                    onClick={() => toggleDirection('up')}
                    className={`p-3 rounded-lg transition-all ${
                      selectedDirections.up
                        ? 'bg-yellow-500 text-black'
                        : 'bg-gray-100 dark:bg-dark-elevated text-gray-400 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                    title="Vertical ↑"
                  >
                    <ArrowUp className="w-6 h-6" />
                  </button>
                  <button
                    onClick={() => toggleDirection('upRight')}
                    className={`p-3 rounded-lg transition-all ${
                      selectedDirections.upRight
                        ? 'bg-yellow-500 text-black'
                        : 'bg-gray-100 dark:bg-dark-elevated text-gray-400 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                    title="Diagonal ↗"
                  >
                    <ArrowUpRight className="w-6 h-6" />
                  </button>

                  {/* Linha 2 */}
                  <button
                    onClick={() => toggleDirection('left')}
                    className={`p-3 rounded-lg transition-all ${
                      selectedDirections.left
                        ? 'bg-yellow-500 text-black'
                        : 'bg-gray-100 dark:bg-dark-elevated text-gray-400 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                    title="Horizontal ←"
                  >
                    <ArrowLeft className="w-6 h-6" />
                  </button>
                  <button
                    onClick={toggleAllDirections}
                    className="p-3 rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-all font-bold text-sm"
                    title="Selecionar/Desselecionar todas"
                  >
                    TODAS
                  </button>
                  <button
                    onClick={() => toggleDirection('right')}
                    className={`p-3 rounded-lg transition-all ${
                      selectedDirections.right
                        ? 'bg-yellow-500 text-black'
                        : 'bg-gray-100 dark:bg-dark-elevated text-gray-400 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                    title="Horizontal →"
                  >
                    <ArrowRight className="w-6 h-6" />
                  </button>

                  {/* Linha 3 */}
                  <button
                    onClick={() => toggleDirection('downLeft')}
                    className={`p-3 rounded-lg transition-all ${
                      selectedDirections.downLeft
                        ? 'bg-yellow-500 text-black'
                        : 'bg-gray-100 dark:bg-dark-elevated text-gray-400 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                    title="Diagonal ↙"
                  >
                    <ArrowDownLeft className="w-6 h-6" />
                  </button>
                  <button
                    onClick={() => toggleDirection('down')}
                    className={`p-3 rounded-lg transition-all ${
                      selectedDirections.down
                        ? 'bg-yellow-500 text-black'
                        : 'bg-gray-100 dark:bg-dark-elevated text-gray-400 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                    title="Vertical ↓"
                  >
                    <ArrowDown className="w-6 h-6" />
                  </button>
                  <button
                    onClick={() => toggleDirection('downRight')}
                    className={`p-3 rounded-lg transition-all ${
                      selectedDirections.downRight
                        ? 'bg-yellow-500 text-black'
                        : 'bg-gray-100 dark:bg-dark-elevated text-gray-400 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                    title="Diagonal ↘"
                  >
                    <ArrowDownRight className="w-6 h-6" />
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-dark-text-secondary mt-3 text-center">
                  Clique nas setas para selecionar as direções permitidas
                </p>
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
                    placeholder="Mensagem exibida quando o jogador completar o jogo"
                    rows="3"
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-dark-elevated border border-gray-300 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent text-gray-900 dark:text-dark-text-primary placeholder-gray-400 dark:placeholder-gray-500"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2 pb-2 border-t border-gray-200 dark:border-dark-border">
                  <input
                    type="checkbox"
                    id="showButton"
                    checked={showEndScreenButton}
                    onChange={(e) => setShowEndScreenButton(e.target.checked)}
                    className="w-4 h-4 text-yellow-500 bg-gray-100 dark:bg-dark-elevated border-gray-300 dark:border-gray-600 rounded focus:ring-yellow-500"
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
                        className="w-full px-4 py-3 bg-gray-50 dark:bg-dark-elevated border border-gray-300 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent text-gray-900 dark:text-dark-text-primary placeholder-gray-400 dark:placeholder-gray-500"
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
                        className="w-full px-4 py-3 bg-gray-50 dark:bg-dark-elevated border border-gray-300 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent text-gray-900 dark:text-dark-text-primary placeholder-gray-400 dark:placeholder-gray-500"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="newTab"
                        checked={endScreenButtonNewTab}
                        onChange={(e) => setEndScreenButtonNewTab(e.target.checked)}
                        className="w-4 h-4 text-yellow-600 bg-gray-100 dark:bg-dark-elevated border-gray-300 dark:border-gray-600 rounded focus:ring-yellow-500"
                      />
                      <label htmlFor="newTab" className="text-sm font-medium text-gray-700 dark:text-dark-text-primary cursor-pointer">
                        Abrir em nova guia
                      </label>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Preview/Actions Panel */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl p-6 sticky top-24">
              <h3 className="text-xl font-bold text-gray-900 dark:text-dark-text-primary mb-4">
                Ações
              </h3>

              <div className="space-y-3">
                <button
                  onClick={generateGrid}
                  disabled={words.length === 0}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Eye className="w-5 h-5" />
                  Visualizar Preview
                </button>

                <button
                  onClick={handleSave}
                  disabled={words.length === 0 || saving}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black rounded-lg hover:from-yellow-400 hover:to-yellow-500 transition-all font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="w-5 h-5" />
                  {saving ? 'Salvando...' : 'Salvar Jogo'}
                </button>

                <button
                  onClick={() => navigate('/create')}
                  className="w-full px-4 py-3 bg-gray-200 dark:bg-dark-elevated text-gray-700 dark:text-dark-text-primary rounded-lg hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors font-medium"
                >
                  Voltar
                </button>
              </div>

              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <h4 className="font-bold text-blue-900 dark:text-blue-300 mb-2 text-sm">
                  Estatísticas
                </h4>
                <div className="space-y-1 text-sm text-blue-700 dark:text-blue-400">
                  <div className="flex justify-between">
                    <span>Palavras:</span>
                    <span className="font-bold">{words.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Grid:</span>
                    <span className="font-bold">{gridSize}x{gridSize}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Dificuldade:</span>
                    <span className="font-bold">
                      {difficulty === 'easy' ? 'Fácil' : difficulty === 'medium' ? 'Médio' : 'Difícil'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Preview Modal */}
        {showPreview && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl p-6 max-w-4xl max-h-[90vh] overflow-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-dark-text-primary">
                  Preview do Grid
                </h3>
                <button
                  onClick={() => setShowPreview(false)}
                  className="p-2 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6 text-red-600" />
                </button>
              </div>

              <div className="overflow-auto">
                <div className="inline-block min-w-max">
                  <div className="grid gap-0.5 bg-gray-200 dark:bg-dark-elevated p-1 rounded-lg">
                    {previewGrid.map((row, rowIndex) => (
                      <div key={rowIndex} className="flex gap-0.5">
                        {row.map((cell, colIndex) => (
                          <div
                            key={`${rowIndex}-${colIndex}`}
                            className={`
                              w-8 h-8 flex items-center justify-center font-bold text-sm
                              ${
                                cell.placed
                                  ? 'bg-yellow-200 dark:bg-yellow-900/40 text-yellow-900 dark:text-yellow-300'
                                  : 'bg-white dark:bg-dark-surface text-gray-900 dark:text-gray-100'
                              }
                            `}
                          >
                            {cell.letter}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <p className="text-sm text-gray-600 dark:text-dark-text-secondary mt-4">
                * Células amarelas indicam onde as palavras foram posicionadas
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Confirmação - Poucas Palavras */}
      {showFewWordsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-surface rounded-xl shadow-2xl max-w-md w-full border border-gray-200 dark:border-dark-border">
            <div className="p-6">
              <div className="flex items-start gap-4 mb-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900/20 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-yellow-600 dark:text-yellow-500" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-dark-text-primary mb-2">
                    Poucas Palavras
                  </h3>
                  <p className="text-gray-600 dark:text-dark-text-secondary text-sm">
                    Seu jogo tem menos de 5 palavras. Deseja continuar mesmo assim?
                  </p>
                </div>
              </div>

              <div className="flex gap-3 justify-end mt-6">
                <button
                  onClick={() => setShowFewWordsModal(false)}
                  className="px-4 py-2 bg-gray-200 dark:bg-dark-elevated text-gray-700 dark:text-dark-text-primary rounded-lg hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmSave}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Continuar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
    </div>
  );
};

export default CreateWordSearch;
