import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MdPeople, MdPersonAdd, MdDelete, MdEdit, MdAdminPanelSettings } from "react-icons/md";
import api from "../api/api";
import Layout from "../components/Layout";

function Usuarios() {
  const navigate = useNavigate();
  const [usuarios, setUsuarios] = useState([]);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [usuarioEditando, setUsuarioEditando] = useState(null);

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [perfil, setPerfil] = useState("VETERINARIO");
  const [crmv, setCrmv] = useState("");

  const [mensagemSucesso, setMensagemSucesso] = useState("");
  const [mensagemErro, setMensagemErro] = useState("");
  const [usuarioParaExcluir, setUsuarioParaExcluir] = useState(null);

  useEffect(() => {
    carregarUsuarios();
  }, []);

  const carregarUsuarios = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await api.get("/usuarios/", {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsuarios(res.data || []);
    } catch (err) {
      if (err.response?.status === 403) {
        setMensagemErro("⛔ Acesso negado. Apenas Administradores podem acessar esta página.");
      }
    }
  };

  const limparForm = () => {
    setUsuarioEditando(null);
    setNome("");
    setEmail("");
    setSenha("");
    setPerfil("VETERINARIO");
    setCrmv("");
    setMensagemErro("");
  };

  const prepararEdicao = (u) => {
    setUsuarioEditando(u);
    setNome(u.nome || "");
    setEmail(u.email || "");
    setSenha(""); // Deixa em branco por segurança; se digitar, altera a senha
    setPerfil(u.perfil || "VETERINARIO");
    setCrmv(u.crmv || "");
    setMensagemErro("");
    setMostrarFormulario(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const salvarUsuario = async (e) => {
    e.preventDefault();
    setMensagemErro("");
    setMensagemSucesso("");

    try {
      const token = localStorage.getItem("token");

      const payload = {
        nome: nome.trim(),
        email: email.trim().toLowerCase(),
        senha: senha ? senha : "", 
        perfil: perfil,
        crmv: perfil === "VETERINARIO" && crmv.trim() ? crmv.trim() : null,
      };

      if (usuarioEditando) {
        await api.put(`/usuarios/${usuarioEditando.id}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setMensagemSucesso("✅ Usuário atualizado com sucesso!");
      } else {
        await api.post("/usuarios/", payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setMensagemSucesso("✅ Usuário cadastrado com sucesso!");
      }

      limparForm();
      setMostrarFormulario(false);
      carregarUsuarios();
    } catch (err) {
      console.error("Erro ao salvar usuário:", err.response);
      const detalhe = err.response?.data?.detail;
      if (Array.isArray(detalhe)) {
        const msgs = detalhe.map((d) => `${d.loc[d.loc.length - 1]}: ${d.msg}`).join(" | ");
        setMensagemErro(`❌ Erro nos dados enviados: ${msgs}`);
      } else if (typeof detalhe === "string") {
        setMensagemErro(`❌ ${detalhe}`);
      } else {
        setMensagemErro("❌ Erro ao salvar usuário. Verifique as informações fornecidas.");
      }
    }
  };

  const excluirUsuario = async () => {
    if (!usuarioParaExcluir) return;
    try {
      const token = localStorage.getItem("token");
      await api.delete(`/usuarios/${usuarioParaExcluir.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setMensagemSucesso("✅ Usuário excluído com sucesso!");
      setUsuarioParaExcluir(null);
      carregarUsuarios();
    } catch (err) {
      setMensagemErro(`❌ Erro ao excluir: ${err.response?.data?.detail || err.message}`);
      setUsuarioParaExcluir(null);
    }
  };

  const renderBadgePerfil = (p) => {
    const cores = {
      ADMIN: { bg: "#fef2f2", color: "#991b1b", border: "#fecaca" },
      VETERINARIO: { bg: "#e0e7ff", color: "#3730a3", border: "#c7d2fe" },
      TRIAGEM: { bg: "#fef3c7", color: "#92400e", border: "#fde68a" },
      RECEPCAO: { bg: "#f3f4f6", color: "#374151", border: "#e5e7eb" }
    };
    const estilo = cores[p] || cores.RECEPCAO;

    return (
      <span style={{
        backgroundColor: estilo.bg,
        color: estilo.color,
        border: `1px solid ${estilo.border}`,
        padding: "4px 10px",
        borderRadius: "12px",
        fontSize: "12px",
        fontWeight: "700"
      }}>
        {p}
      </span>
    );
  };

  return (
    <Layout>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h1 style={{ display: "flex", alignItems: "center", gap: "12px", margin: 0, fontSize: "26px", color: "#1e1b4b" }}>
          <MdAdminPanelSettings color="#4f46e5" size={38} />
          Usuários & Controle de Acesso
        </h1>

        <button
          onClick={() => {
            if (mostrarFormulario) limparForm();
            setMostrarFormulario(!mostrarFormulario);
          }}
          style={{
            backgroundColor: "#4f46e5",
            color: "white",
            border: "none",
            padding: "10px 20px",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: "600",
            fontSize: "14px"
          }}
        >
          {mostrarFormulario ? "Fechar Formulário" : "＋ Cadastrar Novo Colaborador"}
        </button>
      </div>

      {mensagemSucesso && (
        <div style={{ backgroundColor: "#dcfce7", color: "#166534", padding: "12px 16px", borderRadius: "8px", marginBottom: "15px", border: "1px solid #bbf7d0" }}>
          {mensagemSucesso}
        </div>
      )}

      {mensagemErro && (
        <div style={{ backgroundColor: "#fee2e2", color: "#991b1b", padding: "12px 16px", borderRadius: "8px", marginBottom: "15px", border: "1px solid #fecaca" }}>
          {mensagemErro}
        </div>
      )}

      {mostrarFormulario && (
        <form 
          onSubmit={salvarUsuario} 
          autoComplete="off"
          style={{ backgroundColor: "white", padding: "24px", borderRadius: "12px", marginBottom: "25px", border: "1px solid #e5e7eb" }}
        >
          <h3 style={{ margin: "0 0 16px 0", color: "#111827", fontSize: "18px" }}>
            {usuarioEditando ? "✏️ Editar Usuário" : "👤 Novo Usuário do Sistema"}
          </h3>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>Nome Completo *</label>
              <input 
                type="text" 
                required 
                autoComplete="off"
                placeholder="Ex: João Silva"
                value={nome} 
                onChange={(e) => setNome(e.target.value)} 
                style={{ width: "100%", height: "40px", padding: "0 12px", border: "1px solid #d1d5db", borderRadius: "8px" }} 
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>E-mail (Login) *</label>
              <input 
                type="email" 
                required 
                autoComplete="new-password"
                placeholder="Ex: joao@vetassist.com"
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                style={{ width: "100%", height: "40px", padding: "0 12px", border: "1px solid #d1d5db", borderRadius: "8px" }} 
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>
                {usuarioEditando ? "Nova Senha (deixe vazio p/ manter)" : "Senha de Acesso *"}
              </label>
              <input 
                type="password" 
                required={!usuarioEditando} 
                autoComplete="new-password"
                placeholder={usuarioEditando ? "Preencha apenas para alterar" : "••••••••"}
                value={senha} 
                onChange={(e) => setSenha(e.target.value)} 
                style={{ width: "100%", height: "40px", padding: "0 12px", border: "1px solid #d1d5db", borderRadius: "8px" }} 
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>Perfil de Acesso (RBAC) *</label>
              <select value={perfil} onChange={(e) => setPerfil(e.target.value)} style={{ width: "100%", height: "40px", padding: "0 12px", border: "1px solid #d1d5db", borderRadius: "8px" }}>
                <option value="VETERINARIO">🩺 VETERINARIO (Acesso Clínico + IA)</option>
                <option value="RECEPCAO">📋 RECEPCAO (Cadastro e Triagem)</option>
                <option value="TRIAGEM">💉 TRIAGEM (Fila e Sinais Vitais)</option>
                <option value="ADMIN">🛡️ ADMIN (Acesso Total ao Sistema)</option>
              </select>
            </div>

            {perfil === "VETERINARIO" && (
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>CRMV (Número do Registro)</label>
                <input type="text" placeholder="Ex: SP-12345" value={crmv} onChange={(e) => setCrmv(e.target.value)} style={{ width: "100%", height: "40px", padding: "0 12px", border: "1px solid #d1d5db", borderRadius: "8px" }} />
              </div>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "20px" }}>
            <button type="button" onClick={() => { limparForm(); setMostrarFormulario(false); }} style={{ backgroundColor: "#f3f4f6", border: "none", padding: "10px 20px", borderRadius: "8px", cursor: "pointer" }}>Cancelar</button>
            <button type="submit" style={{ backgroundColor: "#16a34a", color: "white", border: "none", padding: "10px 24px", borderRadius: "8px", cursor: "pointer", fontWeight: "600" }}>
              {usuarioEditando ? "Atualizar Usuário" : "Salvar Usuário"}
            </button>
          </div>
        </form>
      )}

      {/* TABELA DE USUÁRIOS CADASTRADOS */}
      <div style={{ backgroundColor: "white", borderRadius: "12px", overflow: "hidden", border: "1px solid #e5e7eb" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
          <thead>
            <tr style={{ backgroundColor: "#4f46e5", color: "white", fontSize: "14px" }}>
              <th style={{ padding: "14px" }}>Nome</th>
              <th style={{ padding: "14px" }}>E-mail</th>
              <th style={{ padding: "14px" }}>Perfil</th>
              <th style={{ padding: "14px" }}>CRMV</th>
              <th style={{ padding: "14px", textAlign: "center" }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u, index) => (
              <tr key={u.id} style={{ backgroundColor: index % 2 === 0 ? "#ffffff" : "#f9fafb", borderBottom: "1px solid #f3f4f6", fontSize: "14px" }}>
                <td style={{ padding: "14px", fontWeight: "600", color: "#1f2937" }}>{u.nome}</td>
                <td style={{ padding: "14px", color: "#4b5563" }}>{u.email}</td>
                <td style={{ padding: "14px" }}>{renderBadgePerfil(u.perfil)}</td>
                <td style={{ padding: "14px", color: "#6b7280" }}>{u.crmv || "-"}</td>
                <td style={{ padding: "14px", textAlign: "center", display: "flex", justifyContent: "center", gap: "8px" }}>
                  <button 
                    onClick={() => prepararEdicao(u)} 
                    title="Editar Usuário"
                    style={{ backgroundColor: "#fef3c7", color: "#b45309", border: "none", padding: "6px 10px", borderRadius: "6px", cursor: "pointer" }}
                  >
                    <MdEdit size={18} />
                  </button>
                  <button 
                    onClick={() => setUsuarioParaExcluir(u)} 
                    title="Excluir Usuário"
                    style={{ backgroundColor: "#fee2e2", color: "#b91c1c", border: "none", padding: "6px 10px", borderRadius: "6px", cursor: "pointer" }}
                  >
                    <MdDelete size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      {usuarioParaExcluir && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(0,0,0,0.4)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
          <div style={{ backgroundColor: "white", padding: "24px", borderRadius: "12px", textAlign: "center", maxWidth: "400px" }}>
            <h3>Confirmar Exclusão</h3>
            <p>Deseja realmente remover o acesso de <strong>{usuarioParaExcluir.nome}</strong>?</p>
            <div style={{ display: "flex", justifyContent: "center", gap: "12px", marginTop: "20px" }}>
              <button onClick={() => setUsuarioParaExcluir(null)} style={{ backgroundColor: "#f3f4f6", border: "none", padding: "8px 16px", borderRadius: "8px" }}>Cancelar</button>
              <button onClick={excluirUsuario} style={{ backgroundColor: "#dc2626", color: "white", border: "none", padding: "8px 16px", borderRadius: "8px" }}>Excluir</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

export default Usuarios;