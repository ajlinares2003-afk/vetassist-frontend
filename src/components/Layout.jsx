import { Link, useLocation, useNavigate } from "react-router-dom";
import { FaUserTie } from "react-icons/fa";
import { 
  MdPets, 
  MdDashboard, 
  MdEvent, 
  MdMedicalServices, 
  MdReceiptLong, 
  MdScience,
  MdFolderShared,
  MdExitToApp,
  MdHealthAndSafety,
  MdAdminPanelSettings,
  MdHotel,
  MdLocalHospital,
  MdAttachMoney,
  MdCalendarToday,
  MdSmartToy // <-- Ícone importado corretamente aqui
} from "react-icons/md";

function Layout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();

  const perfilUsuario = localStorage.getItem("perfil") || "ADMIN";
  const nomeUsuario = localStorage.getItem("usuario_nome") || "Recepcao Teste";

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("perfil");
    localStorage.removeItem("usuario_nome");
    navigate("/login");
  };

  const getNomeConsulta = () => {
    if (perfilUsuario === "RECEPCAO") return "Check-in";
    return "Atendimento";
  };

  const menuConfig = [
    { nome: "Dashboard", rota: "/dashboard", icone: <MdDashboard size={20} />, perfis: ["ADMIN", "RECEPCAO", "TRIAGEM", "VETERINARIO"] },
    { nome: "Agenda", rota: "/agenda", icone: <MdCalendarToday size={20} />, perfis: ["ADMIN", "RECEPCAO", "VETERINARIO"] },
    { nome: getNomeConsulta(), rota: "/consultas", icone: <MdEvent size={20} />, perfis: ["ADMIN", "RECEPCAO", "VETERINARIO"] },
    { nome: "Triagem / Fila", rota: "/triagem", icone: <MdHealthAndSafety size={20} />, perfis: ["ADMIN", "TRIAGEM", "VETERINARIO"] },
    { nome: "Animais", rota: "/animais", icone: <MdPets size={20} />, perfis: ["ADMIN", "RECEPCAO", "VETERINARIO"] },
    { nome: "Tutores", rota: "/tutores", icone: <FaUserTie size={18} />, perfis: ["ADMIN", "RECEPCAO", "VETERINARIO"] },
    { nome: "Internação / UTI", rota: "/internacao", icone: <MdHotel size={20} />, perfis: ["ADMIN", "VETERINARIO", "TRIAGEM", "RECEPCAO"] },
    { nome: "Exames", rota: "/exames", icone: <MdScience size={20} />, perfis: ["ADMIN", "VETERINARIO"] },
    { nome: "Prescrições", rota: "/prescricoes", icone: <MdReceiptLong size={20} />, perfis: ["ADMIN", "VETERINARIO"] },
    { nome: "Vacinas", rota: "/vacinas", icone: <MdMedicalServices size={20} />, perfis: ["ADMIN", "TRIAGEM", "VETERINARIO"] },
    { nome: "Centro Cirúrgico", rota: "/cirurgias", icone: <MdLocalHospital size={20} />, perfis: ["ADMIN", "VETERINARIO"] },
    { nome: "Prontuários", rota: "/prontuarios", icone: <MdFolderShared size={20} />, perfis: ["ADMIN", "VETERINARIO"] },
    { nome: "Financeiro & Caixa", rota: "/financeiro", icone: <MdAttachMoney size={20} />, perfis: ["ADMIN", "RECEPCAO"] },
    { nome: "Usuários & Perfis", rota: "/usuarios", icone: <MdAdminPanelSettings size={20} />, perfis: ["ADMIN"] },
    { nome: "Configurações de IA", rota: "/configuracoes-ia", icone: <MdSmartToy size={20} />, perfis: ["ADMIN"] },
  ];

  const itensPermitidos = menuConfig.filter((item) => item.perfis.includes(perfilUsuario));

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "#F8FAFC", fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* SIDEBAR FIXA */}
      <aside
        style={{
          width: "240px",
          backgroundColor: "#0F172A",
          color: "#94A3B8",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "24px 16px",
          position: "fixed",
          top: 0,
          bottom: 0,
          left: 0,
          zIndex: 100,
          boxShadow: "2px 0 10px rgba(0,0,0,0.05)",
          overflowY: "auto",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", paddingLeft: "8px", marginBottom: "20px" }}>
            <div style={{ width: "38px", height: "38px", borderRadius: "50%", backgroundColor: "#0D9488", display: "flex", alignItems: "center", justifyContent: "center", color: "#FFFFFF" }}>
              <MdPets size={22} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#FFFFFF", lineHeight: "1.2" }}>VetAssist AI</h2>
              <span style={{ fontSize: "11px", color: "#64748B" }}>Clínica Veterinária</span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", backgroundColor: "rgba(255, 255, 255, 0.05)", padding: "10px 12px", borderRadius: "10px", marginBottom: "20px", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
            <div style={{ width: "32px", height: "32px", borderRadius: "50%", backgroundColor: "#0D9488", color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", fontSize: "13px" }}>
              {nomeUsuario.charAt(0).toUpperCase()}
            </div>
            <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#FFFFFF", lineHeight: "1.2", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {nomeUsuario}
              </span>
              <span style={{ fontSize: "10px", color: "#2DD4BF", fontWeight: "600" }}>{perfilUsuario}</span>
            </div>
          </div>

          <nav style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {itensPermitidos.map((item) => {
              const estaAtivo = location.pathname === item.rota;
              return (
                <Link
                  key={item.rota}
                  to={item.rota}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "11px 14px",
                    borderRadius: "10px",
                    textDecoration: "none",
                    fontSize: "14px",
                    fontWeight: estaAtivo ? "600" : "500",
                    color: estaAtivo ? "#FFFFFF" : "#94A3B8",
                    backgroundColor: estaAtivo ? "#0D9488" : "transparent",
                    transition: "all 0.15s ease",
                  }}
                >
                  {item.icone}
                  <span>{item.nome}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <button
          onClick={handleLogout}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            width: "100%",
            padding: "10px 14px",
            backgroundColor: "transparent",
            color: "#F87171",
            border: "none",
            borderRadius: "10px",
            fontSize: "14px",
            fontWeight: "600",
            cursor: "pointer",
          }}
        >
          <MdExitToApp size={20} />
          Sair
        </button>
      </aside>

      {/* ÁREA DE CONTEÚDO COM MARGEM ESQUERDA SEGURA */}
      <div style={{ marginLeft: "240px", flex: 1, display: "flex", flexDirection: "column", minWidth: 0, boxSizing: "border-box" }}>
        <main style={{ padding: "32px 40px", boxSizing: "border-box", width: "100%" }}>
          {children}
        </main>
      </div>
    </div>
  );
}

export default Layout;