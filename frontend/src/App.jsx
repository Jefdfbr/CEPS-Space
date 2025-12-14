import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import Navbar from './components/Navbar';
import AdminLayout from './layouts/AdminLayout';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Games from './pages/Games';
import MyGames from './pages/MyGames';
import CreateGame from './pages/CreateGame';
import CreateWordSearch from './pages/CreateWordSearch';
import EditWordSearch from './pages/EditWordSearch';
import CreateQuiz from './pages/CreateQuiz';
import EditQuiz from './pages/EditQuiz';
import WordSearchPlay from './pages/WordSearchPlay';
import QuizPlay from './pages/QuizPlay';
import RoomsList from './pages/RoomsList';
import CreateRoom from './pages/CreateRoom';
import EditRoom from './pages/EditRoom';
import RoomDetails from './pages/RoomDetails';
import JoinGame from './pages/JoinGame';
import GameAccess from './pages/GameAccess';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';
import AdminGames from './pages/admin/AdminGames';
import CreateKahoot from './pages/CreateKahoot';
import KahootAccess from './pages/KahootAccess';
import KahootPresenter from './pages/KahootPresenter';
import KahootPlay from './pages/KahootPlay';
import CreateOpenQuestion from './pages/CreateOpenQuestion';
import EditOpenQuestion from './pages/EditOpenQuestion';
import OpenQuestionPresenter from './pages/OpenQuestionPresenter';
import OpenQuestionPlay from './pages/OpenQuestionPlay';

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={
              <div className="min-h-screen bg-gray-100 dark:bg-dark-surface">
                <Navbar />
                <Home />
              </div>
            } />
            <Route path="/login" element={
              <div className="min-h-screen bg-gray-100 dark:bg-dark-surface">
                <Navbar />
                <Login />
              </div>
            } />
            <Route path="/register" element={
              <div className="min-h-screen bg-gray-100 dark:bg-dark-surface">
                <Navbar />
                <Register />
              </div>
            } />
            <Route path="/games" element={
              <div className="min-h-screen bg-gray-100 dark:bg-dark-surface">
                <Navbar />
                <Games />
              </div>
            } />
            
            {/* Join Game Route (Anonymous) */}
            <Route path="/join" element={<JoinGame />} />
            
            {/* Game Access - verifica se precisa entrar em sala */}
            <Route path="/game" element={<GameAccess />} />
            
            {/* Protected Routes */}
            <Route path="/my-games" element={
              <div className="min-h-screen bg-gray-100 dark:bg-dark-surface">
                <Navbar />
                <MyGames />
              </div>
            } />
            <Route path="/create" element={
              <div className="min-h-screen bg-gray-100 dark:bg-dark-surface">
                <Navbar />
                <CreateGame />
              </div>
            } />
            <Route path="/create/word-search" element={
              <div className="min-h-screen bg-gray-100 dark:bg-dark-surface">
                <Navbar />
                <CreateWordSearch />
              </div>
            } />
            <Route path="/edit/word-search/:gameId" element={
              <div className="min-h-screen bg-gray-100 dark:bg-dark-surface">
                <Navbar />
                <EditWordSearch />
              </div>
            } />
            <Route path="/create/quiz" element={
              <div className="min-h-screen bg-gray-100 dark:bg-dark-surface">
                <Navbar />
                <CreateQuiz />
              </div>
            } />
            <Route path="/edit/quiz/:gameId" element={
              <div className="min-h-screen bg-gray-100 dark:bg-dark-surface">
                <Navbar />
                <EditQuiz />
              </div>
            } />
            <Route path="/play/word-search" element={
              <div className="min-h-screen bg-gray-100 dark:bg-dark-surface">
                <Navbar gameMode={true} />
                <WordSearchPlay />
              </div>
            } />
            <Route path="/play/quiz" element={
              <div className="min-h-screen bg-gray-100 dark:bg-dark-surface">
                <Navbar gameMode={true} />
                <QuizPlay />
              </div>
            } />
            
            {/* Kahoot Routes */}
            <Route path="/create/kahoot" element={
              <div className="min-h-screen bg-gray-100 dark:bg-dark-surface">
                <Navbar />
                <CreateKahoot />
              </div>
            } />
            <Route path="/kahoot/access/:gameId" element={<KahootAccess />} />
            <Route path="/kahoot/presenter/:id" element={
              <div className="min-h-screen bg-gray-100 dark:bg-dark-surface">
                <Navbar />
                <KahootPresenter />
              </div>
            } />
            <Route path="/kahoot/play/:id" element={
              <div className="min-h-screen bg-gray-100 dark:bg-dark-surface">
                <Navbar />
                <KahootPlay />
              </div>
            } />

            {/* Open Question Routes */}
            <Route path="/create/open-question" element={
              <div className="min-h-screen bg-gray-100 dark:bg-dark-surface">
                <Navbar />
                <CreateOpenQuestion />
              </div>
            } />
            <Route path="/edit/open-question/:id" element={
              <div className="min-h-screen bg-gray-100 dark:bg-dark-surface">
                <Navbar />
                <EditOpenQuestion />
              </div>
            } />
            <Route path="/open-question/presenter/:id" element={
              <div className="min-h-screen bg-gray-100 dark:bg-dark-surface">
                <Navbar gameMode={true} />
                <OpenQuestionPresenter />
              </div>
            } />
            <Route path="/open-question/play/:id" element={
              <div className="min-h-screen bg-gray-100 dark:bg-dark-surface">
                <Navbar gameMode={true} />
                <OpenQuestionPlay />
              </div>
            } />            {/* Room Routes */}
            <Route path="/rooms" element={
              <div className="min-h-screen bg-gray-100 dark:bg-dark-surface">
                <Navbar />
                <RoomsList />
              </div>
            } />
            <Route path="/create-room" element={
              <div className="min-h-screen bg-gray-100 dark:bg-dark-surface">
                <Navbar />
                <CreateRoom />
              </div>
            } />
            <Route path="/edit-room/:roomId" element={
              <div className="min-h-screen bg-gray-100 dark:bg-dark-surface">
                <Navbar />
                <EditRoom />
              </div>
            } />
            <Route path="/room/:roomCode" element={
              <div className="min-h-screen bg-gray-100 dark:bg-dark-surface">
                <Navbar />
                <RoomDetails />
              </div>
            } />

            {/* Admin Routes */}
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="games" element={<AdminGames />} />
            </Route>
          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
