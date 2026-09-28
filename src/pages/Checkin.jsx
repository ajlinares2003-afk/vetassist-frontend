import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MdEvent, MdTv, MdAddCircle, MdCampaign, MdCheckCircle } from "react-icons/md";
import api from "../api/api";
import Layout from "../components/Layout";

function Checkin() {
  const navigate = useNavigate();
  const [animais, setAnimais] = useState([]);
  const [filaCheckin, setFilaCheckin] = useState([]);
  const [mostrarModal, setMostrarModal] = useState(false);

  // Estados do Formulário de Check-in
  const [animalId, setAnimalId] = useState("");
  const [queixaPrincipal, setQueixaPrincipal] = useState("");
  const [peso, setPeso] = useState("");
  const [mensagemSucesso, setMensagemSucesso] = useState("");
  const [mensagemErro, setMensagemErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    carregarDados();
    const intervalo = setInterval(() => carregarDados(false), 5000);
    return () => clearInterval(intervalo);
  }, []);

  const carregarDados = async (loader = true) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return navigate("/login");

      const config = { headers: { Authorization: `Bearer ${token}` } };

      const [resAnimais, resFila] = await Promise.all([
        api.get("/animais/", config),
        api.get("/consultas/fila-triagem", config),
      ]);

      setAnimais(resAnimais.data || []);
      setFilaCheckin(resFila.data || []);
    } catch (error) {
      console.error("Erro ao carregar dados da recepção:", error);
    }
  };

  const obterNomeAnimal = (id) => {
    const a = animais.find((item) => item.id === id);
    return a ? `${a.nome} (${a.codigo || `PET-${a.id}`})` : "-";
  };

  const chamarPaciente = async (consultaId) => {
    try {
      const token = localStorage.getItem("token");
      await api.put(`/consultas/${consultaId}/chamar`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMensagemSucesso("📢 Paciente chamado para o painel de TV com sucesso!");
      carregarDados(false);
    } catch (error) {
      setMensagemErro("Erro ao emitir chamada para o paciente.");
    }
  };

  const realizarCheckin = async (e) => {
    e.preventDefault();
    if (!animalId || !queixaPrincipal) {
      setMensagemErro("Selecione o paciente e informe o motivo da visita.");
      return;
    }

    try {
      setCarregando(true);
      const token = localStorage.getItem("token");
      const config = { headers: { Authorization: `Bearer ${token}` } };

      const payload = {
        animal_id: Number(animalId),
        queixa_principal: queixaPrincipal,
        status: "AGUARDANDO_TRIAGEM",
        peso_atendimento: peso ? Number(peso) : null
      };

      await api.post("/consultas/", payload, config);

      setMensagemSucesso("✅ Check-in realizado com sucesso! Paciente adicionado à fila.");
      setMostrarModal(false);
      setAnimalId("");
      setQueixaPrincipal("");
      setPeso("");
      carregarDados();
    } catch (error) {
      setMensagemErro(`❌ Erro ao realizar check-in: ${error.response?.data?.detail || error.message}`);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <Layout>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
        <h1 style={{ display: "flex", alignItems: "center", gap: "12px", margin: 0, fontSize: "26px", color: "#1e1b4b" }}>
          <MdEvent color="#4f46e5" size={38} /> Recepção & Check-in
        </h1>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button
            type="button"
            onClick={() => window.open("/painel", "_blank")}
            style={{
              backgroundColor: "#0284c7",
              color: "#ffffff",
              border: "none",
              padding: "10px 18px",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "600",
              fontSize: "14px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <MdTv size={20} /> Abrir Painel da Recepção (TV)
          </button>

          <button
            onClick={() => setMostrarModal(true)}
            style={{
              backgroundColor: "#4f46e5",
              color: "white",
              border: "none",
              padding: "10px 20px",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "600",
              fontSize: "14px",
            }}
          >
            ＋ Novo Check-in
          </button>
        </div>
      </div>

      {mensagemSucesso && (
        <div style={{ backgroundColor: "#dcfce7", color: "#166534", padding: "12px 16px", borderRadius: "8px", marginBottom: "15px", fontWeight: "500" }}>
          {mensagemSucesso}
        </div>
      )}

      {mensagemErro && (
        <div style={{ backgroundColor: "#fee2e2", color: "#991b1b", padding: "12px 16px", borderRadius: "8px", marginBottom: "15px", fontWeight: "500" }}>
          {mensagemErro}
        </div>
      )}

      {/* Lista de Fila de Espera da Recepção */}
      <div style={{ backgroundColor: "white", padding: "24px", borderRadius: "12px", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)", border: "1px solid #e5e7eb" }}>
        <h3 style={{ marginTop: 0, color: "#111827", fontSize: "18px", marginBottom: "16px" }}>
          📋 Fila de Espera Atual ({filaCheckin.length} pacientes)
        </h3>

        {filaCheckin.length === 0 ? (
          <p style={{ color: "#6b7280", textAlign: "center", padding: "30px" }}>Nenhum paciente aguardando atendimento no momento.</p>
        ) : (
          <div style={{ display: "grid", gap: "10px" }}>
            {filaCheckin.map((item) => (
              <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px", backgroundColor: "#f9fafb", borderRadius: "8px", border: "1px solid #f3f4f6" }}>
                <div>
                  <strong style={{ color: "#1f2937", fontSize: "15px" }}>🐾 {obterNomeAnimal(item.animal_id)}</strong>
                  <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#4b5563" }}>
                    Código: <strong>{item.codigo}</strong> | Motivo: {item.queixa_principal}
                  </p>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={() => chamarPaciente(item.id)}
                    style={{ backgroundColor: "#0284c7", color: "white", border: "none", padding: "8px 14px", borderRadius: "6px", cursor: "pointer", fontWeight: "600", fontSize: "13px", display: "flex", alignItems: "center", gap: "4px" }}
                  >
                    <MdCampaign size={18} /> Chamar no Painel
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de Novo Check-in */}
      {mostrarModal && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: "20px" }}>
          <div style={{ backgroundColor: "white", padding: "28px", borderRadius: "14px", maxWidth: "500px", width: "100%" }}>
            <h3 style={{ marginTop: 0, color: "#1e1b4b", fontSize: "20px" }}>Novo Check-in de Paciente</h3>
            
            <form onSubmit={realizarCheckin}>
              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "6px" }}>Paciente (Animal) *</label>
                <select value={animalId} onChange={(e) => setAnimalId(e.target.value)} style={{ width: "100%", height: "42px", padding: "0 12px", border: "1px solid #d1d5db", borderRadius: "8px" }} required>
                  <option value="">Selecione o paciente cadastrado...</option>
                  {animais.map((a) => (
                    <option key={a.id} value={a.id}>{a.nome} ({a.codigo || `PET-${a.id}`})</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "6px" }}>Peso Atual (Kg) - Opcional</label>
                <input type="number" step="0.1" placeholder="Ex: 5.4" value={peso} onChange={(e) => setPeso(e.target.value)} style={{ width: "100%", height: "42px", padding: "0 12px", border: "1px solid #d1d5db", borderRadius: "8px", boxSizing: "border-box" }} />
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "6px" }}>Motivo da Visita / Queixa Principal *</label>
                <input type="text" placeholder="Ex: Vacinação anual, apatia, check-up..." value={queixaPrincipal} onChange={(e) => setQueixaPrincipal(e.target.value)} style={{ width: "100%", height: "42px", padding: "0 12px", border: "1px solid #d1d5db", borderRadius: "8px", boxSizing: "border-box" }} required />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button type="button" onClick={() => setMostrarModal(false)} style={{ backgroundColor: "#f3f4f6", border: "none", padding: "10px 18px", borderRadius: "8px", cursor: "pointer", fontWeight: "600" }}>Cancelar</button>
                <button type="submit" disabled={carregando} style={{ backgroundColor: "#16a34a", color: "white", border: "none", padding: "10px 20px", borderRadius: "8px", cursor: "pointer", fontWeight: "600" }}>{carregando ? "A salvar..." : "Concluir Check-in"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}

export default Checkin; // (Nota: ajuste para export default Checkin no seu projeto)