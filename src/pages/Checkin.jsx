import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MdEvent, MdTv, MdDelete } from "react-icons/md";
import api from "../api/api";
import Layout from "../components/Layout";

function Checkin() {
  const navigate = useNavigate();
  const [animais, setAnimais] = useState([]);
  const [tutores, setTutores] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [filaCheckin, setFilaCheckin] = useState([]);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [consultaParaExcluir, setConsultaParaExcluir] = useState(null);

  // Estados do Formulário de Check-in
  const [animalId, setAnimalId] = useState("");
  const [usuarioId, setUsuarioId] = useState("");
  const [queixaPrincipal, setQueixaPrincipal] = useState("");
  const [peso, setPeso] = useState("");
  const [mensagemSucesso, setMensagemSucesso] = useState("");
  const [mensagemErro, setMensagemErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    carregarDados();
    const intervalo = setInterval(() => carregarDados(), 5000);
    return () => clearInterval(intervalo);
  }, []);

  const carregarDados = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return navigate("/login");

      const config = { headers: { Authorization: `Bearer ${token}` } };

      const [resAnimais, resTutores, resUsuarios, resFila] = await Promise.all([
        api.get("/animais/", config),
        api.get("/tutores/", config),
        api.get("/usuarios/", config),
        api.get("/consultas/fila-triagem", config),
      ]);

      setAnimais(resAnimais.data || []);
      setTutores(resTutores.data || []);
      
      // Filtra estritamente apenas perfis de TRIAGEM ou ENFERMEIRO
      const listaUsuarios = resUsuarios.data || [];
      const apenasEnfermeiros = listaUsuarios.filter(
        (u) => u.perfil === "TRIAGEM" || u.perfil === "ENFERMEIRO"
      );
      setUsuarios(apenasEnfermeiros);

      setFilaCheckin(resFila.data || []);
    } catch (error) {
      console.error("Erro ao carregar dados da recepção:", error);
    }
  };

  const obterInfoAnimalETutor = (animalIdParam) => {
    const a = animais.find((item) => item.id === Number(animalIdParam));
    if (!a) return "Paciente desconhecido";
    
    const t = tutores.find((tutor) => tutor.id === a.tutor_id);
    const nomeTutor = t ? t.nome : "Tutor não vinculado";

    return `${a.nome} (${a.especie || "Pet"}) — Tutor: ${nomeTutor}`;
  };

  const realizarCheckin = async (e) => {
    e.preventDefault();
    if (!animalId || !queixaPrincipal || !peso) {
      setMensagemErro("Preencha todos os campos obrigatórios (Paciente, Peso e Motivo).");
      return;
    }

    try {
      setCarregando(true);
      const token = localStorage.getItem("token");
      const config = { headers: { Authorization: `Bearer ${token}` } };

      const payload = {
        animal_id: Number(animalId),
        usuario_id: usuarioId ? Number(usuarioId) : null,
        queixa_principal: queixaPrincipal,
        status: "AGUARDANDO_TRIAGEM",
        peso_atendimento: Number(peso)
      };

      await api.post("/consultas/", payload, config);

      setMensagemSucesso("✅ Check-in realizado com sucesso! Paciente adicionado à fila.");
      setMostrarModal(false);
      setAnimalId("");
      setUsuarioId("");
      setQueixaPrincipal("");
      setPeso("");
      carregarDados();
    } catch (error) {
      setMensagemErro(`❌ Erro ao realizar check-in: ${error.response?.data?.detail || error.message}`);
    } finally {
      setCarregando(false);
    }
  };

  const deletarCheckin = async () => {
    if (!consultaParaExcluir) return;

    try {
      const token = localStorage.getItem("token");
      const config = { headers: { Authorization: `Bearer ${token}` } };

      await api.delete(`/consultas/${consultaParaExcluir.id}`, config);

      setMensagemSucesso("✅ Check-in excluído com sucesso!");
      setConsultaParaExcluir(null);
      carregarDados();
    } catch (error) {
      setMensagemErro(`❌ Erro ao excluir check-in: ${error.response?.data?.detail || error.message}`);
      setConsultaParaExcluir(null);
    }
  };

  const estiloInput = {
    width: "100%",
    height: "42px",
    padding: "0 12px",
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    fontSize: "14px",
    outline: "none",
    backgroundColor: "#ffffff",
    boxSizing: "border-box"
  };

  const estiloLabel = {
    display: "block",
    fontSize: "13px",
    fontWeight: "600",
    color: "#374151",
    marginBottom: "6px"
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
                  <strong style={{ color: "#1f2937", fontSize: "15px" }}>🐾 {obterInfoAnimalETutor(item.animal_id)}</strong>
                  <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#4b5563" }}>
                    Código: <strong>{item.codigo}</strong> | Motivo: {item.queixa_principal} {item.peso_atendimento ? `| Peso: ${item.peso_atendimento}kg` : ""}
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  {/* ALTERADO PARA RETÂNGULO COM BORDAS SUAVES (6px) */}
                  <span style={{ backgroundColor: "#fef3c7", color: "#b45309", padding: "6px 12px", borderRadius: "6px", fontSize: "12px", fontWeight: "600" }}>
                    Aguardando Triagem
                  </span>
                  <button
                    onClick={() => setConsultaParaExcluir(item)}
                    title="Excluir Check-in"
                    style={{
                      backgroundColor: "#fee2e2",
                      color: "#b91c1c",
                      border: "none",
                      padding: "8px 10px",
                      borderRadius: "6px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                  >
                    <MdDelete size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de Confirmação de Exclusão */}
      {consultaParaExcluir && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(0,0,0,0.4)", backdropFilter: "blur(2px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
          <div style={{ backgroundColor: "white", padding: "28px", borderRadius: "14px", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)", textAlign: "center", maxWidth: "400px", width: "90%" }}>
            <div style={{ fontSize: "42px", marginBottom: "8px" }}>⚠️</div>
            <h3 style={{ marginTop: 0, color: "#111827", fontSize: "18px" }}>Confirmar Exclusão</h3>
            <p style={{ color: "#4b5563", fontSize: "14px", lineHeight: "1.5" }}>
              Tem certeza que deseja remover o check-in do código <strong>{consultaParaExcluir.codigo}</strong>?
            </p>
            <div style={{ display: "flex", justifyContent: "center", gap: "12px", marginTop: "22px" }}>
              <button onClick={() => setConsultaParaExcluir(null)} style={{ backgroundColor: "#f3f4f6", color: "#374151", border: "none", padding: "10px 18px", borderRadius: "8px", cursor: "pointer", fontWeight: "600" }}>Cancelar</button>
              <button onClick={deletarCheckin} style={{ backgroundColor: "#dc2626", color: "white", border: "none", padding: "10px 18px", borderRadius: "8px", cursor: "pointer", fontWeight: "600" }}>Sim, Excluir</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Novo Check-in */}
      {mostrarModal && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: "20px" }}>
          <div style={{ backgroundColor: "white", padding: "28px", borderRadius: "14px", maxWidth: "500px", width: "100%" }}>
            <h3 style={{ marginTop: 0, color: "#1e1b4b", fontSize: "20px", marginBottom: "16px" }}>Novo Check-in de Paciente</h3>
            
            <form onSubmit={realizarCheckin}>
              <div style={{ marginBottom: "14px" }}>
                <label style={estiloLabel}>Paciente & Tutor *</label>
                <select value={animalId} onChange={(e) => setAnimalId(e.target.value)} style={estiloInput} required>
                  <option value="">Selecione o paciente cadastrado...</option>
                  {animais.map((a) => {
                    const t = tutores.find((tutor) => tutor.id === a.tutor_id);
                    const nomeTutor = t ? t.nome : "Sem Tutor";
                    return (
                      <option key={a.id} value={a.id}>
                        {a.nome} ({a.especie || "Pet"}) — Tutor: {nomeTutor}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* SELEÇÃO APENAS DE ENFERMEIRO / TRIAGEM */}
              <div style={{ marginBottom: "14px" }}>
                <label style={estiloLabel}>Enfermeiro(a) / Triagem (Opcional)</label>
                <select value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)} style={estiloInput}>
                  <option value="">Selecione o enfermeiro responsável...</option>
                  {usuarios.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nome || u.email}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: "14px" }}>
                <label style={estiloLabel}>Peso Atual (Kg) *</label>
                <input type="number" step="0.1" placeholder="Ex: 5.4" value={peso} onChange={(e) => setPeso(e.target.value)} style={estiloInput} required />
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label style={estiloLabel}>Motivo da Visita / Queixa Principal *</label>
                <textarea
                  rows={5}
                  placeholder="Descreva o motivo da visita ou queixa principal..."
                  value={queixaPrincipal}
                  onChange={(e) => setQueixaPrincipal(e.target.value)}
                  style={{
                    ...estiloInput,
                    height: "auto",
                    minHeight: "110px",
                    padding: "10px 12px",
                    resize: "vertical"
                  }}
                  required
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button type="button" onClick={() => setMostrarModal(false)} style={{ backgroundColor: "#f3f4f6", border: "none", padding: "10px 18px", borderRadius: "8px", cursor: "pointer", fontWeight: "600" }}>Cancelar</button>
                <button type="submit" disabled={carregando} style={{ backgroundColor: "#16a34a", color: "white", border: "none", padding: "10px 20px", borderRadius: "8px", cursor: "pointer", fontWeight: "600" }}>{carregando ? "Salvando..." : "Concluir Check-in"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}

export default Checkin;