import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-react';

const Register = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [validations, setValidations] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false,
    match: false
  });
  const { register } = useAuth();
  const navigate = useNavigate();

  // Validação de email RFC 5322 compliant
  const validateEmail = (email) => {
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return emailRegex.test(email);
  };

  // Sanitização de input para prevenir XSS
  const sanitizeInput = (input) => {
    return input.replace(/[<>]/g, '');
  };

  // Validação de senha em tempo real
  const handlePasswordChange = (value) => {
    setPassword(value);
    setValidations({
      length: value.length >= 8,
      uppercase: /[A-Z]/.test(value),
      lowercase: /[a-z]/.test(value),
      number: /[0-9]/.test(value),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(value),
      match: confirmPassword ? value === confirmPassword : false
    });
  };

  const handleConfirmPasswordChange = (value) => {
    setConfirmPassword(value);
    setValidations(prev => ({
      ...prev,
      match: password === value
    }));
  };

  const handleNameChange = (e) => {
    const sanitized = sanitizeInput(e.target.value);
    setName(sanitized);
  };

  const handleEmailChange = (e) => {
    const sanitized = sanitizeInput(e.target.value);
    setEmail(sanitized);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validações de segurança
    if (!validateEmail(email)) {
      setError('Por favor, insira um email válido');
      return;
    }

    if (name.length < 2) {
      setError('Nome deve ter pelo menos 2 caracteres');
      return;
    }

    if (name.length > 100) {
      setError('Nome muito longo');
      return;
    }

    if (!validations.length || !validations.uppercase || !validations.lowercase || 
        !validations.number || !validations.special) {
      setError('A senha não atende aos requisitos de segurança');
      return;
    }

    if (!validations.match) {
      setError('As senhas não coincidem');
      return;
    }

    // Prevenir SQL Injection - backend também valida
    if (email.includes("'") || email.includes('"') || email.includes(';')) {
      setError('Email contém caracteres inválidos');
      return;
    }

    setLoading(true);

    try {
      await register(email, password, name);
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao fazer cadastro');
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = Object.values(validations).every(v => v === true) && 
                      name.length >= 2 && 
                      validateEmail(email);

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-dark-bg flex items-center justify-center px-4 py-8">
      <div className="max-w-md w-full bg-white dark:bg-dark-bg rounded-lg shadow-lg p-8 border dark:border-dark-border my-20">
        <h2 className="text-3xl font-bold text-center mb-8 text-gray-900 dark:text-dark-text-primary">
          Cadastrar
        </h2>

        {error && (
          <div className="bg-red-100 dark:bg-red-900/20 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 px-4 py-3 rounded mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-primary mb-2">
              Nome Completo
            </label>
            <input
              type="text"
              value={name}
              onChange={handleNameChange}
              className="w-full px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-yellow-500 dark:bg-dark-surface dark:text-dark-text-primary"
              required
              minLength={2}
              maxLength={100}
              autoComplete="name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-primary mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={handleEmailChange}
              className="w-full px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-yellow-500 dark:bg-dark-surface dark:text-dark-text-primary"
              required
              autoComplete="email"
            />
            {email && !validateEmail(email) && (
              <p className="text-red-500 text-xs mt-1">Email inválido</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-primary mb-2">
              Senha
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => handlePasswordChange(e.target.value)}
                className="w-full px-4 py-2 pr-10 border border-gray-300 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-yellow-500 dark:bg-dark-surface dark:text-dark-text-primary"
                required
                minLength={8}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-dark-text-secondary dark:hover:text-gray-200"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            
            {/* Indicadores de força da senha */}
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2 text-xs">
                {validations.length ? 
                  <CheckCircle className="w-4 h-4 text-green-500" /> : 
                  <AlertCircle className="w-4 h-4 text-gray-400" />}
                <span className={validations.length ? "text-green-600 dark:text-green-400" : "text-gray-500 dark:text-dark-text-secondary"}>
                  Mínimo 8 caracteres
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                {validations.uppercase ? 
                  <CheckCircle className="w-4 h-4 text-green-500" /> : 
                  <AlertCircle className="w-4 h-4 text-gray-400" />}
                <span className={validations.uppercase ? "text-green-600 dark:text-green-400" : "text-gray-500 dark:text-dark-text-secondary"}>
                  Letra maiúscula (A-Z)
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                {validations.lowercase ? 
                  <CheckCircle className="w-4 h-4 text-green-500" /> : 
                  <AlertCircle className="w-4 h-4 text-gray-400" />}
                <span className={validations.lowercase ? "text-green-600 dark:text-green-400" : "text-gray-500 dark:text-dark-text-secondary"}>
                  Letra minúscula (a-z)
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                {validations.number ? 
                  <CheckCircle className="w-4 h-4 text-green-500" /> : 
                  <AlertCircle className="w-4 h-4 text-gray-400" />}
                <span className={validations.number ? "text-green-600 dark:text-green-400" : "text-gray-500 dark:text-dark-text-secondary"}>
                  Número (0-9)
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                {validations.special ? 
                  <CheckCircle className="w-4 h-4 text-green-500" /> : 
                  <AlertCircle className="w-4 h-4 text-gray-400" />}
                <span className={validations.special ? "text-green-600 dark:text-green-400" : "text-gray-500 dark:text-dark-text-secondary"}>
                  Caractere especial (!@#$%...)
                </span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-primary mb-2">
              Confirmar Senha
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => handleConfirmPasswordChange(e.target.value)}
                className="w-full px-4 py-2 pr-10 border border-gray-300 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-yellow-500 dark:bg-dark-surface dark:text-dark-text-primary"
                required
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-dark-text-secondary dark:hover:text-gray-200"
              >
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {confirmPassword && (
              <div className="flex items-center gap-2 text-xs mt-2">
                {validations.match ? 
                  <CheckCircle className="w-4 h-4 text-green-500" /> : 
                  <AlertCircle className="w-4 h-4 text-red-400" />}
                <span className={validations.match ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}>
                  {validations.match ? "Senhas coincidem" : "Senhas não coincidem"}
                </span>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !isFormValid}
            className="w-full py-3 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black rounded-lg hover:from-yellow-400 hover:to-yellow-500 transition-all font-bold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Cadastrando...' : 'Cadastrar'}
          </button>
        </form>

        <p className="mt-6 text-center text-gray-600 dark:text-dark-text-secondary">
          Já tem uma conta?{' '}
          <Link to="/login" className="text-yellow-600 dark:text-yellow-400 hover:underline font-medium">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
