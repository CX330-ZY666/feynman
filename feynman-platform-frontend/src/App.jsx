// src/App.jsx
import { Routes, Route } from 'react-router-dom';
import './styles/animations.css'; // 全局动画样式
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import KnowledgePointFormPage from './pages/KnowledgePointFormPage';
import FeynmanRecordPage from './pages/FeynmanRecordPage';
import KnowledgePointBrowser from './components/KnowledgePointBrowser';
import QuizPage from './pages/QuizPage';
import AgentPage from './pages/AgentPage';
import GraphPage from './pages/GraphPage';
import ThreeJSPage from './pages/ThreeJSPage';
import KnowledgeUniversePage from './pages/KnowledgeUniversePage';
import FeynmanPracticePage from './pages/FeynmanPracticePage';
import FeynmanPracticeSelectPage from './pages/FeynmanPracticeSelectPage';

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        {/* 公共路由 */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* 受保护的路由 */}
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/browse" element={<KnowledgePointBrowser />} />
          <Route path="/kp/new" element={<KnowledgePointFormPage />} />
          <Route path="/kp/edit/:id" element={<KnowledgePointFormPage />} />
          <Route path="/feynman/:id" element={<FeynmanRecordPage />} />
          <Route path="/quiz/:id" element={<QuizPage />} />
          <Route path="/agent" element={<AgentPage />} />
          <Route path="/graph" element={<GraphPage />} />
          <Route path="/3d-world" element={<ThreeJSPage />} />
          <Route path="/knowledge-universe" element={<KnowledgeUniversePage />} />
          <Route path="/feynman-practice" element={<FeynmanPracticeSelectPage />} />
          <Route path="/feynman-practice/:id" element={<FeynmanPracticePage />} />
        </Route>
      </Route>
    </Routes>
  );
}
export default App;