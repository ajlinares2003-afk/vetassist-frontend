import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MdSmartToy, MdSave, MdCheckCircle, MdError } from "react-icons/md";
import api from "../api/api";
import Layout from "../components/Layout";

function ConfiguracoesIA() {
  const navigate = useNavigate();
  const [modelos, setModelos] = useState({
    groq_model_1: "",
    groq_api_key_1: "",
    groq_model_2: "",
    groq_api_key_2: "",
    gemini_model: "",
    gemini_api_key: ""
  });
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [statusTeste, setStatusTeste] = useState({});
  const [testandoProvedor, setTestandoProvedor] = useState(null);
  const [feedback, setFeedback] = useState(null); // { texto: "", tipo: "sucesso" | "erro" }

  const perfilUsuario = localStorage.getItem("perfil") || "RECEPCAO";

  useEffect(() => {
    if (perfilUsuario !== "ADMIN") {
      navigate("/dashboard");
      return;
    }
    carregarConfiguracoes();
  }, []);

  const carregarConfiguracoes = async () => {
    setCarregando(true);
    try {
      const token = localStorage.getItem("token");
      const res = await api.get("/configuracoes/ia", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data) {
        setModelos({
          groq_model_1: res.data.groq_model_1 || "",
          groq_api_key_1: res.data.groq_api_key_1 || "",
          groq_model_2: res.data.groq_model_2 || "",
          groq_api_key_2: res.data.groq_api_key_2 || "",
          gemini_model: res.data.gemini_model || "",
          gemini_api_key: res.data.gemini_api_key || ""
        });
      }
    } catch (err) {
      console.error("Erro ao carregar configurações de IA:", err);
    } finally {
      setCarregando(false);
    }
  };

  const salvarConfiguracoes = async (e) => {
    e.preventDefault();
    setSalvando(true);
    setFeedback(null);
    try {
      const token = localStorage.getItem("token");
      await api.put("/configuracoes/ia", modelos, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFeedback({ texto: "Configurações de IA salvas com sucesso!", tipo: "sucesso" });
      carregarConfiguracoes();
    } catch (err) {
      const mensagemErro = err.response?.data?.detail || err.message;
      setFeedback({ texto: `Erro ao salvar: ${mensagemErro}`, tipo: "erro" });
    } finally {
      setSalvando(false);
    }
  };

  const testarModelo = async (provedor, campoModelo, campoChave) => {
    const nomeModelo = modelos[campoModelo];
    setTestandoProvedor(campoChave);
    setStatusTeste((prev) => ({ ...prev, [campoChave]: null }));

    try {
      const token = localStorage.getItem("token");
      const res = await api.post(
        "/configuracoes/ia/testar",
        { provedor, modelo: nomeModelo },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setStatusTeste((prev) => ({ ...prev, [campoChave]: res.data }));
    } catch (err) {
      setStatusTeste((prev) => ({
        ...prev,
        [campoChave]: { sucesso: false, erro: "Falha na requisição de teste." }
      }));
    } finally {
      setTestandoProvedor(null);
    }
  };

  return (
    <Layout>
      <div style={{ width: "100%", maxWidth: "800px", margin: "0 auto", boxSizing: "border-box" }}>
        
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
          <div style={{ width: "42px", height: "42px", borderRadius: "10px", backgroundColor: "#0D9488", color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <MdSmartToy size={24} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#0F172A" }}>
              Configurações de Modelos de IA
            </h1>
            <p style={{ margin: "2px 0 0 0", fontSize: "13px", color: "#64748B" }}>
              Altere os identificadores e chaves de API utilizadas pelo VetAssist AI em tempo real.
            </p>
          </div>
        </div>

        {/* FEEDBACK AMIGÁVEL NO TOPO */}
        {feedback && (
          <div style={feedback.tipo === "sucesso" ? estiloSucessoGlobal : estiloErroGlobal}>
            {feedback.tipo === "sucesso" ? <MdCheckCircle size={20} /> : <MdError size={20} />}
            <span>{feedback.texto}</span>
          </div>
        )}

        {carregando ? (
          <div style={{ textAlign: "center", padding: "40px", color: "#0D9488", fontWeight: "600" }}>
            A carregar configurações...
          </div>
        ) : (
          <form onSubmit={salvarConfiguracoes} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            
            {/* CARD GROQ 1 */}
            <div style={estiloCard}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <label style={estiloLabel}>Groq AI Model 1</label>
                <button
                  type="button"
                  onClick={() => testarModelo("groq_1", "groq_model_1", "groq_api_key_1")}
                  disabled={testandoProvedor === "groq_api_key_1"}
                  style={estiloBotaoTeste}
                >
                  {testandoProvedor === "groq_api_key_1" ? "Testando..." : "Testar Conexão"}
                </button>
              </div>
              <input
                type="text"
                value={modelos.groq_model_1}
                onChange={(e) => setModelos({ ...modelos, groq_model_1: e.target.value })}
                style={{ ...estiloInput, marginBottom: "10px" }}
                placeholder="Ex: openai/gpt-oss-120b"
              />
              <label style={estiloSubLabel}>Chave API Groq (Model 1)</label>
              <input
                type="password"
                value={modelos.groq_api_key_1}
                onChange={(e) => setModelos({ ...modelos, groq_api_key_1: e.target.value })}
                style={estiloInput}
                placeholder="Insira a chave API da Groq"
              />
              {statusTeste.groq_api_key_1 && (
                <div style={statusTeste.groq_api_key_1.sucesso ? estiloSucesso : estiloErro}>
                  {statusTeste.groq_api_key_1.sucesso ? <MdCheckCircle size={16} /> : <MdError size={16} />}
                  <span>{statusTeste.groq_api_key_1.sucesso ? `Resposta: ${statusTeste.groq_api_key_1.resposta}` : statusTeste.groq_api_key_1.erro}</span>
                </div>
              )}
            </div>

            {/* CARD GROQ 2 */}
            <div style={estiloCard}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <label style={estiloLabel}>Groq AI Model 2</label>
                <button
                  type="button"
                  onClick={() => testarModelo("groq_2", "groq_model_2", "groq_api_key_2")}
                  disabled={testandoProvedor === "groq_api_key_2"}
                  style={estiloBotaoTeste}
                >
                  {testandoProvedor === "groq_api_key_2" ? "Testando..." : "Testar Conexão"}
                </button>
              </div>
              <input
                type="text"
                value={modelos.groq_model_2}
                onChange={(e) => setModelos({ ...modelos, groq_model_2: e.target.value })}
                style={{ ...estiloInput, marginBottom: "10px" }}
                placeholder="Ex: qwen/qwen3.8-27b"
              />
              <label style={estiloSubLabel}>Chave API Groq (Model 2)</label>
              <input
                type="password"
                value={modelos.groq_api_key_2}
                onChange={(e) => setModelos({ ...modelos, groq_api_key_2: e.target.value })}
                style={estiloInput}
                placeholder="Insira a chave API da Groq"
              />
              {statusTeste.groq_api_key_2 && (
                <div style={statusTeste.groq_api_key_2.sucesso ? estiloSucesso : estiloErro}>
                  {statusTeste.groq_api_key_2.sucesso ? <MdCheckCircle size={16} /> : <MdError size={16} />}
                  <span>{statusTeste.groq_api_key_2.sucesso ? `Resposta: ${statusTeste.groq_api_key_2.resposta}` : statusTeste.groq_api_key_2.erro}</span>
                </div>
              )}
            </div>

            {/* CARD GEMINI */}
            <div style={estiloCard}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <label style={estiloLabel}>Google Gemini (Modelo Principal)</label>
                <button
                  type="button"
                  onClick={() => testarModelo("gemini", "gemini_model", "gemini_api_key")}
                  disabled={testandoProvedor === "gemini_api_key"}
                  style={estiloBotaoTeste}
                >
                  {testandoProvedor === "gemini_api_key" ? "Testando..." : "Testar Conexão"}
                </button>
              </div>
              <input
                type="text"
                value={modelos.gemini_model}
                onChange={(e) => setModelos({ ...modelos, gemini_model: e.target.value })}
                style={{ ...estiloInput, marginBottom: "10px" }}
                placeholder="Ex: gemini-3.6-flash"
              />
              <label style={estiloSubLabel}>Chave API Gemini</label>
              <input
                type="password"
                value={modelos.gemini_api_key}
                onChange={(e) => setModelos({ ...modelos, gemini_api_key: e.target.value })}
                style={estiloInput}
                placeholder="Insira a chave API do Google Gemini"
              />
              {statusTeste.gemini_api_key && (
                <div style={statusTeste.gemini_api_key.sucesso ? estiloSucesso : estiloErro}>
                  {statusTeste.gemini_api_key.sucesso ? <MdCheckCircle size={16} /> : <MdError size={16} />}
                  <span>{statusTeste.gemini_api_key.sucesso ? `Resposta: ${statusTeste.gemini_api_key.resposta}` : statusTeste.gemini_api_key.erro}</span>
                </div>
              )}
            </div>

            {/* BOTÃO SALVAR ALTERAÇÕES */}
            <button
              type="submit"
              disabled={salvando}
              style={{
                backgroundColor: "#0D9488",
                color: "white",
                border: "none",
                padding: "12px 20px",
                borderRadius: "10px",
                fontWeight: "700",
                fontSize: "14px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                marginTop: "10px"
              }}
            >
              <MdSave size={18} /> {salvando ? "Salvando..." : "Salvar Alterações"}
            </button>

          </form>
        )}

      </div>
    </Layout>
  );
}

const estiloCard = {
  backgroundColor: "#FFFFFF",
  borderRadius: "12px",
  border: "1px solid #E2E8F0",
  padding: "16px",
  display: "flex",
  flexDirection: "column"
};

const estiloLabel = {
  fontSize: "13px",
  fontWeight: "700",
  color: "#0F172A"
};

const estiloSubLabel = {
  fontSize: "11px",
  fontWeight: "600",
  color: "#475569",
  marginBottom: "4px"
};

const estiloInput = {
  padding: "10px 12px",
  borderRadius: "8px",
  border: "1px solid #CBD5E1",
  fontSize: "13px",
  outline: "none",
  color: "#1E293B"
};

const estiloBotaoTeste = {
  backgroundColor: "#F0FDFA",
  color: "#0D9488",
  border: "1px solid #99F6E4",
  padding: "4px 10px",
  borderRadius: "6px",
  fontSize: "11px",
  fontWeight: "600",
  cursor: "pointer"
};

const estiloSucessoGlobal = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  marginBottom: "16px",
  fontSize: "13px",
  fontWeight: "600",
  color: "#166534",
  backgroundColor: "#F0FDF4",
  padding: "12px 16px",
  borderRadius: "10px",
  border: "1px solid #DCFCE7"
};

const estiloErroGlobal = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  marginBottom: "16px",
  fontSize: "13px",
  fontWeight: "600",
  color: "#991B1B",
  backgroundColor: "#FEF2F2",
  padding: "12px 16px",
  borderRadius: "10px",
  border: "1px solid #FECACA"
};

const estiloSucesso = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  marginTop: "8px",
  fontSize: "11px",
  color: "#166534",
  backgroundColor: "#F0FDF4",
  padding: "6px 10px",
  borderRadius: "6px",
  border: "1px solid #DCFCE7"
};

const estiloErro = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  marginTop: "8px",
  fontSize: "11px",
  color: "#991B1B",
  backgroundColor: "#FEF2F2",
  padding: "6px 10px",
  borderRadius: "6px",
  border: "1px solid #FECACA"
};

export default ConfiguracoesIA;