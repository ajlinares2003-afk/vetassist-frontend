import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Animais from "./pages/Animais";
import Tutores from "./pages/Tutores";
import Agenda from "./pages/Agenda";
import Consultas from "./pages/Consultas";
import Vacinas from "./pages/Vacinas";
import Prescricoes from "./pages/Prescricoes";
import SolicitacaoExames from "./pages/SolicitacaoExames";
import Prontuarios from "./pages/Prontuarios";
import Triagem from "./pages/Triagem";
import Internacao from "./pages/Internacao";
import Usuarios from "./pages/Usuarios";
import Cirurgia from "./pages/Cirurgia"; 
import Financeiro from "./pages/Financeiro";
import PainelChamadas from "./pages/PainelChamadas";
import ConfiguracoesIA from "./pages/ConfiguracoesIA"; // <-- 1. Importe a página aqui

// Componente para validar e proteger as rotas dinamicamente
function RotaProtegida({ children }) {
  const token = localStorage.getItem("token");

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Rota inicial acessa o login se não estiver autenticado */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />

        {/* Rotas protegidas */}
        <Route
          path="/dashboard"
          element={
            <RotaProtegida>
              <Dashboard />
            </RotaProtegida>
          }
        />

        <Route
          path="/animais"
          element={
            <RotaProtegida>
              <Animais />
            </RotaProtegida>
          }
        />

        <Route
          path="/tutores"
          element={
            <RotaProtegida>
              <Tutores />
            </RotaProtegida>
          }
        />

        <Route
          path="/agenda"
          element={
            <RotaProtegida>
              <Agenda />
            </RotaProtegida>
          }
        />

        <Route
          path="/consultas"
          element={
            <RotaProtegida>
              <Consultas />
            </RotaProtegida>
          }
        />

        <Route
          path="/triagem"
          element={
            <RotaProtegida>
              <Triagem />
            </RotaProtegida>
          }
        />

        <Route
          path="/internacao"
          element={
            <RotaProtegida>
              <Internacao />
            </RotaProtegida>
          }
        />

        {/* Rota protegida do Centro Cirúrgico */}
        <Route
          path="/cirurgias"
          element={
            <RotaProtegida>
              <Cirurgia />
            </RotaProtegida>
          }
        />

        {/* Módulo Financeiro */}
        <Route
          path="/financeiro"
          element={
            <RotaProtegida>
              <Financeiro />
            </RotaProtegida>
          }
        />

        <Route
          path="/vacinas"
          element={
            <RotaProtegida>
              <Vacinas />
            </RotaProtegida>
          }
        />

        <Route
          path="/prescricoes"
          element={
            <RotaProtegida>
              <Prescricoes />
            </RotaProtegida>
          }
        />

        <Route
          path="/exames"
          element={
            <RotaProtegida>
              <SolicitacaoExames />
            </RotaProtegida>
          }
        />

        <Route
          path="/prontuarios"
          element={
            <RotaProtegida>
              <Prontuarios />
            </RotaProtegida>
          }
        />

        <Route
          path="/usuarios"
          element={
            <RotaProtegida>
              <Usuarios />
            </RotaProtegida>
          }
        />

        {/* 2. Adicione a rota protegida para as Configurações de IA */}
        <Route
          path="/configuracoes-ia"
          element={
            <RotaProtegida>
              <ConfiguracoesIA />
            </RotaProtegida>
          }
        />

        <Route 
          path="/painel" 
          element={
            <PainelChamadas />
          }
        />

        {/* Rota padrão para links inexistentes */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;