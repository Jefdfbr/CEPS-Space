import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { 
  Target, 
  Brain, 
  User, 
  Gamepad2, 
  Rocket, 
  Dices, 
  Sparkles, 
  Zap,
  ArrowRight,
  Play
} from 'lucide-react';

const Home = () => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
    
    const handleMouseMove = (e) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const features = [
    {
      icon: Target,
      title: 'Caça-Palavras',
      description: 'Crie jogos de caça-palavras personalizados com suas próprias palavras',
      gradient: 'from-purple-500 via-pink-500 to-red-500',
      delay: '0'
    },
    {
      icon: Brain,
      title: 'Quiz Interativo',
      description: 'Desenvolva questionários de múltipla escolha para testar conhecimento',
      gradient: 'from-blue-500 via-cyan-500 to-teal-500',
      delay: '200'
    }
  ];

  const steps = [
    {
      number: '01',
      title: 'Cadastre-se',
      description: 'Crie uma conta gratuita em segundos',
      icon: User,
      color: 'from-violet-500 to-purple-500'
    },
    {
      number: '02',
      title: 'Crie Jogos',
      description: 'Configure jogos com suas regras personalizadas',
      icon: Gamepad2,
      color: 'from-blue-500 to-cyan-500'
    },
    {
      number: '03',
      title: 'Compartilhe',
      description: 'Gere códigos e convide jogadores',
      icon: Rocket,
      color: 'from-pink-500 to-rose-500'
    }
  ];

  const stats = [
    { value: '∞', label: 'Jogos Ilimitados', icon: Dices },
    { value: '100%', label: 'Gratuito', icon: Sparkles },
    { value: '24/7', label: 'Disponível', icon: Zap }
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg relative pt-0">
      {/* Animated Background Gradient */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute w-[500px] h-[500px] rounded-full bg-gradient-to-r from-purple-400 to-pink-600 opacity-20 dark:opacity-10 blur-3xl animate-blob"
             style={{ top: '10%', left: '10%' }}></div>
        <div className="absolute w-[600px] h-[600px] rounded-full bg-gradient-to-r from-blue-400 to-cyan-600 opacity-20 dark:opacity-10 blur-3xl animate-blob animation-delay-2000"
             style={{ top: '50%', right: '10%' }}></div>
        <div className="absolute w-[450px] h-[450px] rounded-full bg-gradient-to-r from-green-400 to-emerald-600 opacity-20 dark:opacity-10 blur-3xl animate-blob animation-delay-4000"
             style={{ bottom: '10%', left: '30%' }}></div>
      </div>

      {/* Mouse Follower Effect */}
      <div 
        className="fixed w-64 h-64 rounded-full bg-gradient-to-r from-blue-500/10 to-purple-500/10 blur-3xl pointer-events-none transition-all duration-1000 ease-out"
        style={{
          left: mousePosition.x - 128,
          top: mousePosition.y - 128,
        }}
      />

      {/* Hero Section */}
      <div className="container mx-auto px-4 pt-20 pb-32 relative">
        <div className={`text-center mb-20 transition-all duration-1000 transform ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          {/* Main Title with Gradient */}
          <h1 className="text-6xl md:text-7xl lg:text-8xl font-black mb-6 leading-tight">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 animate-gradient">
              Jogos Educativos
            </span>
            <br />
            <span className="text-gray-900 dark:text-dark-text-primary">Que Encantam</span>
          </h1>

          <p className="text-xl md:text-2xl text-gray-600 dark:text-dark-text-secondary mb-12 max-w-3xl mx-auto leading-relaxed">
            Crie experiências de aprendizado <span className="text-purple-600 dark:text-purple-400 font-semibold">interativas</span> e 
            <span className="text-pink-600 dark:text-pink-400 font-semibold"> inesquecíveis</span> em minutos
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row justify-center gap-4 mb-16">
            <Link
              to="/games"
              className="group relative px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-bold text-lg overflow-hidden transform transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/50"
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                Explorar Jogos
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-pink-600 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            </Link>
            
            <Link
              to="/register"
              className="group relative px-8 py-4 bg-white dark:bg-dark-elevated text-gray-900 dark:text-dark-text-primary rounded-xl font-bold text-lg border-2 border-gray-200 dark:border-dark-border overflow-hidden transform transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:border-purple-500 dark:hover:border-purple-500"
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                <Sparkles className="w-5 h-5" />
                Começar Agora
              </span>
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {stats.map((stat, index) => {
              const IconComponent = stat.icon;
              return (
                <div
                  key={index}
                  className="group p-6 rounded-2xl bg-white/80 dark:bg-dark-bg/80 backdrop-blur-lg border border-gray-200 dark:border-dark-border transform transition-all duration-300 hover:scale-105 hover:shadow-xl hover:border-purple-500 dark:hover:border-purple-500"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <IconComponent className="w-12 h-12 mx-auto mb-2 text-purple-600 dark:text-purple-400 transform group-hover:scale-110 transition-transform" />
                  <div className="text-3xl font-black text-gray-900 dark:text-dark-text-primary mb-1">{stat.value}</div>
                  <div className="text-sm text-gray-600 dark:text-dark-text-secondary font-medium">{stat.label}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Features Section */}
        <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto mb-32">
          {features.map((feature, index) => {
            const IconComponent = feature.icon;
            return (
              <div
                key={index}
                className="group relative p-1 rounded-3xl bg-gradient-to-r hover:shadow-2xl transition-all duration-500 transform hover:scale-105 hover:-rotate-1"
                style={{ 
                  backgroundImage: `linear-gradient(135deg, var(--tw-gradient-stops))`,
                  animationDelay: `${feature.delay}ms`
                }}
              >
                <div className={`absolute inset-0 bg-gradient-to-r ${feature.gradient} opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-500 rounded-3xl`}></div>
                
                <div className="relative bg-white dark:bg-dark-bg rounded-3xl p-8 h-full border dark:border-dark-border">
                  <div className="mb-6 transform group-hover:scale-110 group-hover:rotate-12 transition-all duration-500">
                    <IconComponent className="w-16 h-16 text-purple-600 dark:text-purple-400" strokeWidth={1.5} />
                  </div>
                  <h3 className={`text-3xl font-black mb-4 bg-gradient-to-r ${feature.gradient} bg-clip-text text-transparent`}>
                    {feature.title}
                  </h3>
                  <p className="text-lg text-gray-600 dark:text-dark-text-secondary leading-relaxed">
                    {feature.description}
                  </p>
                  
                  {/* Decorative Elements */}
                  <div className="absolute top-4 right-4 w-20 h-20 bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500"></div>
                </div>
              </div>
            );
          })}
        </div>

        {/* How It Works */}
        <div className="text-center mb-16">
          <h2 className="text-5xl md:text-6xl font-black text-gray-900 dark:text-dark-text-primary mb-4">
            Como <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-cyan-600">Funciona</span>
          </h2>
          <p className="text-xl text-gray-600 dark:text-dark-text-secondary mb-16">3 passos simples para começar</p>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto relative">
            {/* Connection Lines */}
            <div className="hidden md:block absolute top-1/4 left-1/4 right-1/4 h-1 bg-gradient-to-r from-violet-500 via-blue-500 to-pink-500 opacity-20"></div>
            
            {steps.map((step, index) => {
              const IconComponent = step.icon;
              return (
                <div
                  key={index}
                  className="group relative transform transition-all duration-500 hover:scale-110"
                  style={{ animationDelay: `${index * 150}ms` }}
                >
                  <div className="relative p-8 rounded-3xl bg-gradient-to-br from-white to-gray-50 dark:from-gray-950 dark:to-gray-900 border border-gray-200 dark:border-dark-border hover:border-transparent shadow-lg hover:shadow-2xl transition-all duration-500">
                    {/* Animated Border */}
                    <div className={`absolute inset-0 rounded-3xl bg-gradient-to-r ${step.color} opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10 blur-xl`}></div>
                    
                    {/* Number Badge */}
                    <div className={`absolute -top-6 left-1/2 transform -translate-x-1/2 w-12 h-12 rounded-full bg-gradient-to-r ${step.color} flex items-center justify-center text-white font-black text-lg shadow-lg group-hover:scale-125 transition-transform duration-300`}>
                      {step.number}
                    </div>
                    
                    <div className="mt-4 mb-6 transform group-hover:scale-125 group-hover:rotate-12 transition-all duration-500 flex justify-center">
                      <IconComponent className="w-12 h-12 text-purple-600 dark:text-purple-400" strokeWidth={1.5} />
                    </div>
                    
                    <h4 className="text-2xl font-black text-gray-900 dark:text-dark-text-primary mb-3">
                      {step.title}
                    </h4>
                    
                    <p className="text-gray-600 dark:text-dark-text-secondary leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Final CTA Section */}
        <div className="relative mt-32 p-12 rounded-3xl bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 overflow-hidden">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzBoLTJ2LTJoMnYyem0wLTRoLTJ2LTJoMnYyem0wLTRoLTJ2LTJoMnYyem0wLTRoLTJ2LTJoMnYyem0wLTRoLTJ2LTJoMnYyem0wLTRoLTJ2LTJoMnYyem0wLTRoLTJ2LTJoMnYyem0wLTRoLTJ2LTJoMnYyem0wLTRoLTJ2LTJoMnYyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-20"></div>
          
          <div className="relative text-center">
            <h3 className="text-4xl md:text-5xl font-black text-white mb-6">
              Pronto para Revolucionar o Aprendizado?
            </h3>
            <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
              Junte-se a educadores que estão transformando a educação através de jogos
            </p>
            <Link
              to="/register"
              className="inline-flex items-center gap-3 px-10 py-5 bg-white text-purple-600 rounded-xl font-black text-xl transform transition-all duration-300 hover:scale-110 hover:shadow-2xl group"
            >
              Começar Agora - É Grátis
              <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" strokeWidth={3} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
