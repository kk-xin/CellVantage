import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import CellList from './pages/CellList';
import CellDetail from './pages/CellDetail';
import CellImport from './pages/CellImport';
import Navbar from './components/Navbar';
import UserManagement from './pages/UserManagement';
import BatchDetail from './pages/BatchDetail';
import AgentCopilot from './components/AgentCopilot';
import './App.css';

// Wrapper component — only allow access if user is logged in
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <p>Loading...</p>;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  return children;
}

function App() {
  return (
    <div className="app-container">
       <Navbar />
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/cells"
          element={
            <ProtectedRoute>
              <CellList />
            </ProtectedRoute>
          }
        />

        <Route
          path="/cells/:id"
          element={
            <ProtectedRoute>
              <CellDetail />
            </ProtectedRoute>
          }
        />


        <Route
          path="/cells/import"
          element={
            <ProtectedRoute>
              <CellImport />
            </ProtectedRoute>
          }
        />

        <Route
          path="/users"
          element={
            <ProtectedRoute>
               <UserManagement />
            </ProtectedRoute>
          }
        />


        <Route
          path="/batches/:id"
          element={
            <ProtectedRoute>
              <BatchDetail />
            </ProtectedRoute>
          }
        />

        {/* Default route — redirect to login */}
        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="/register" element={<Register />} />
      </Routes>
       <AgentCopilot />
    </div>
  );
}

export default App;