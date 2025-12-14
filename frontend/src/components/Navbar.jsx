import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Sun, Moon, Gamepad2, Menu, X } from 'lucide-react';

const Navbar = ({ gameMode = false }) => {
  const { user, logout, isAuthenticated } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);
  const closeMenu = () => setIsMenuOpen(false);

  // Modo de jogo: navbar simplificada
  if (gameMode) {
    return (
      <nav className="bg-white dark:bg-dark-bg shadow-lg border-b border-gray-200 dark:border-dark-border sticky top-0 z-50 backdrop-blur-sm bg-white/95 dark:bg-dark-bg/95">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center py-4">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 md:gap-3 group">
              <div className="relative">
                <Gamepad2 className="w-12 h-12 md:w-16 md:h-16 text-yellow-500 group-hover:text-yellow-400 transition-colors" strokeWidth={1.5} />
                <div className="absolute -top-1 -right-1 w-3 h-3 md:w-4 md:h-4 bg-yellow-400 rounded-full animate-pulse"></div>
              </div>
              <div className="flex flex-col">
                <span className="text-base md:text-xl font-black bg-gradient-to-r from-yellow-500 via-yellow-400 to-yellow-500 bg-clip-text text-transparent">
                  CEPS SPACE
                </span>
                <span className="hidden sm:block text-xs text-gray-600 dark:text-dark-text-secondary font-medium tracking-wide">
                  Espaço de Jogos Educativos
                </span>
              </div>
            </Link>

            {/* Direita: Nome da instituição e toggle tema */}
            <div className="flex items-center gap-4">
              {/* Nome da instituição - Desktop */}
              <div className="hidden lg:block text-right">
                <div className="text-xs md:text-sm font-bold text-gray-800 dark:text-dark-text-primary leading-tight">
                  Centro de Excelência em Privacidade e
                </div>
                <div className="text-xs md:text-sm font-bold text-gray-800 dark:text-dark-text-primary leading-tight">
                  Segurança da Informação do Governo Digital (CEPS GOV.BR)
                </div>
              </div>

              {/* Nome da instituição - Mobile (abreviado) */}
              <div className="lg:hidden text-right">
                <div className="text-xs font-bold text-gray-800 dark:text-dark-text-primary leading-tight">
                  CEPS GOV.BR
                </div>
              </div>

              {/* Botão de tema */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-hover transition-colors flex-shrink-0"
                aria-label="Alternar tema"
              >
                {isDark ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-gray-700" />}
              </button>
            </div>
          </div>
        </div>
      </nav>
    );
  }

  // Modo padrão: navbar completa
  return (
    <nav className="bg-white dark:bg-dark-bg shadow-lg border-b border-gray-200 dark:border-dark-border sticky top-0 z-50 backdrop-blur-sm bg-white/95 dark:bg-dark-bg/95">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center py-4">
          {/* Logo e Slogan */}
          <Link to="/" className="flex items-center gap-2 md:gap-3 group" onClick={closeMenu}>
            <div className="relative">
              <Gamepad2 className="w-14 h-14 md:w-18 md:h-18 text-yellow-500 group-hover:text-yellow-400 transition-colors" strokeWidth={1.5} />
              <div className="absolute -top-1 -right-1 w-3 h-3 md:w-4 md:h-4 bg-yellow-400 rounded-full animate-pulse"></div>
            </div>
            <div className="flex flex-col">
              <span className="text-lg md:text-2xl font-black bg-gradient-to-r from-yellow-500 via-yellow-400 to-yellow-500 bg-clip-text text-transparent">
                CEPS SPACE
              </span>
              <span className="hidden sm:block text-xs text-gray-600 dark:text-dark-text-secondary font-medium tracking-wide">
                Espaço de Jogos Educativos
              </span>
            </div>
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-6">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-hover transition-colors"
              aria-label="Alternar tema"
            >
              {isDark ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-gray-700" />}
            </button>

            <Link
              to="/games"
              className="text-gray-700 dark:text-dark-text-primary hover:text-yellow-500 dark:hover:text-yellow-400 font-medium transition-colors"
            >
              Jogos
            </Link>

            {isAuthenticated ? (
              <>
                {user?.is_admin && (
                  <Link
                    to="/admin"
                    className="text-yellow-600 dark:text-yellow-400 hover:text-yellow-700 dark:hover:text-yellow-300 font-bold transition-colors"
                  >
                    Admin
                  </Link>
                )}
                <Link
                  to="/my-games"
                  className="text-gray-700 dark:text-dark-text-primary hover:text-yellow-500 dark:hover:text-yellow-400 font-medium transition-colors"
                >
                  Meus Jogos
                </Link>
                <span className="text-gray-700 dark:text-dark-text-primary font-medium">
                  Olá, {user?.name}
                </span>
                <button
                  onClick={logout}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                >
                  Sair
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-4 py-2 text-gray-700 dark:text-dark-text-primary hover:text-yellow-500 dark:hover:text-yellow-400 font-medium transition-colors"
                >
                  Entrar
                </Link>
                <Link
                  to="/register"
                  className="px-6 py-2 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black rounded-lg hover:from-yellow-400 hover:to-yellow-500 transition-all font-bold shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  Cadastrar
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-hover transition-colors"
              aria-label="Alternar tema"
            >
              {isDark ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-gray-700" />}
            </button>
            <button
              onClick={toggleMenu}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-hover transition-colors"
              aria-label="Menu"
            >
              {isMenuOpen ? (
                <X className="w-6 h-6 text-gray-700 dark:text-dark-text-primary" />
              ) : (
                <Menu className="w-6 h-6 text-gray-700 dark:text-dark-text-primary" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-200 dark:border-dark-border animate-fade-in">
            <div className="flex flex-col gap-3">
              <Link
                to="/games"
                className="px-4 py-3 text-gray-700 dark:text-dark-text-primary hover:bg-gray-100 dark:hover:bg-dark-hover rounded-lg font-medium transition-colors"
                onClick={closeMenu}
              >
                Jogos
              </Link>

              {isAuthenticated ? (
                <>
                  {user?.is_admin && (
                    <Link
                      to="/admin"
                      className="px-4 py-3 bg-yellow-100 dark:bg-dark-elevated text-yellow-700 dark:text-yellow-400 hover:bg-yellow-200 dark:hover:bg-dark-hover rounded-lg font-bold transition-colors"
                      onClick={closeMenu}
                    >
                      Painel Admin
                    </Link>
                  )}
                  <Link
                    to="/my-games"
                    className="px-4 py-3 text-gray-700 dark:text-dark-text-primary hover:bg-gray-100 dark:hover:bg-dark-hover rounded-lg font-medium transition-colors"
                    onClick={closeMenu}
                  >
                    Meus Jogos
                  </Link>
                  <div className="px-4 py-2 text-gray-700 dark:text-dark-text-primary font-medium">
                    Olá, {user?.name}
                  </div>
                  <button
                    onClick={() => {
                      logout();
                      closeMenu();
                    }}
                    className="mx-4 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium text-center"
                  >
                    Sair
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="px-4 py-3 text-gray-700 dark:text-dark-text-primary hover:bg-gray-100 dark:hover:bg-dark-hover rounded-lg font-medium transition-colors"
                    onClick={closeMenu}
                  >
                    Entrar
                  </Link>
                  <Link
                    to="/register"
                    className="mx-4 px-6 py-3 bg-gradient-to-r from-yellow-500 to-yellow-600 text-black rounded-lg hover:from-yellow-400 hover:to-yellow-500 transition-all font-bold shadow-lg text-center"
                    onClick={closeMenu}
                  >
                    Cadastrar
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
