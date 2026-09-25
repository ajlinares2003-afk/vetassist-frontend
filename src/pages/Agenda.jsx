import { useEffect, useState } from "react";
import { 
  MdCalendarToday, 
  MdAdd, 
  MdCancel, 
  MdClose 
} from "react-icons/md";
import api from "../api/api";
import Layout from "../components/Layout";

function Agenda() {
  const [agendamentos, setAgendamentos] = useState([]);
  const [animais, setAnimais] = useState([]);
  const [veterinarios, setVeterinarios] = useState([]);
  const [dataSelecionada, setDataSelecionada] = useState(new Date().toISOString().split("T")[0]);
  const [mostrarModalNovo, setMostrarModalNovo] = useState(false);
  const [carregando, setCarregando] = useState(true);

  // Form
  const [animalId, setAnimalId] = useState("");
  const [veterinarioId, setVeterinarioId] = useState("");
  const [hora, setHora] = useState("08:00");
  const [tipoServico, setTipoServico] = useState("Consulta");
  const [observacoes, setObservacoes] = useState("");

  useEffect(() => {
    carregarDados();
  }, [dataSelecionada]);

  const carregarDados = async () => {
    setCarregando(true);
    const token = localStorage.getItem("token");
    const config = { headers: { Authorization: `Bearer ${token}` } };

    // Carrega separadamente para evitar que uma falha bloqueie as outras
    try {
      const resAgendamentos = await api.get(`/agendamentos/?data_consulta=${dataSelecionada}`, config);
      setAgendamentos(resAgendamentos.data || []);
    } catch (err) {
      console.error("Erro ao carregar agendamentos (rota pode não existir ainda):", err);
      setAgendamentos([]);
    }

    try {
      const resAnimais = await api.get("/animais/", config);
      setAnimais(resAnimais.data || []);
    } catch (err) {
      console.error("Erro ao carregar animais:", err);
    }

    try {
      const resUsuarios = await api.get("/usuarios/", config);
      const vets = (resUsuarios.data || []).filter(u => u.perfil === "VETERINARIO" || u.perfil === "ADMIN");
      setVeterinarios(vets);
    } catch (err) {
      console.error("Erro ao carregar utilizadores:", err);
    }

    setCarregando(false);
  };

  const salvarAgendamento = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("token");
      const dataHoraCompleta = `${dataSelecionada}T${hora}:00`;

      await api.post("/agendamentos/", {
        animal_id: Number(animalId),
        usuario_id: veterinarioId ? Number(veterinarioId) : null,
        data_horario: dataHoraCompleta,
        tipo_servico: tipoServico,
        observacoes: observacoes
      }, { headers: { Authorization: `Bearer ${token}` } });

      setMostrarModalNovo(false);
      setAnimalId("");
      setObservacoes("");
      carregarDados();
    } catch (err) {
      alert("Erro ao criar agendamento. Verifique os campos.");
    }
  };

  const alterarStatus = async (id, novoStatus) => {
    try {
      const token = localStorage.getItem("token");
      await api.put(`/agendamentos/${id}/status?novo_status=${novoStatus}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      carregarDados();
    } catch (err) {
      console.error("Erro ao alterar status:", err);
    }
  };

  return (
    <Layout>
      {/* CABEÇALHO */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <h1 style={{ margin: 0, fontSize: "26px", fontWeight: "700", color: "#0F172A", display: "flex", alignItems: "center", gap: "10px" }}>
            <MdCalendarToday color="#0D9488" /> Agenda de Atendimentos
          </h1>
          <p style={{ margin: 0, fontSize: "14px", color: "#64748B" }}>
            Gestão preventiva de horários, consultas e retornos
          </p>
        </div>

        <button
          onClick={() => setMostrarModalNovo(true)}
          style={{
            backgroundColor: "#0D9488",
            color: "white",
            border: "none",
            padding: "10px 18px",
            borderRadius: "10px",
            fontWeight: "600",
            fontSize: "13px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            boxShadow: "0 2px 4px rgba(13, 148, 136, 0.2)"
          }}
        >
          <MdAdd size={20} /> Novo Agendamento
        </button>
      </div>

      {/* SELETOR DE DATA */}
      <div style={{ backgroundColor: "#FFFFFF", padding: "16px 20px", borderRadius: "16px", border: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <input
            type="date"
            value={dataSelecionada}
            onChange={(e) => setDataSelecionada(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", fontWeight: "600", color: "#0F172A", outline: "none" }}
          />
          <span style={{ fontSize: "14px", fontWeight: "600", color: "#64748B" }}>
            {new Date(dataSelecionada + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
          </span>
        </div>

        <div style={{ fontSize: "13px", color: "#0D9488", backgroundColor: "#F0FDFA", padding: "6px 14px", borderRadius: "20px", fontWeight: "600", border: "1px solid #CCFBF1" }}>
           Total no dia: {agendamentos.length} agendamentos
        </div>
      </div>

      {/* GRADE DE HORÁRIOS DA AGENDA */}
      <div style={{ backgroundColor: "#FFFFFF", borderRadius: "16px", border: "1px solid #E2E8F0", padding: "20px" }}>
        {carregando ? (
          <div style={{ textAlign: "center", padding: "40px", color: "#0D9488" }}>Carregando agenda...</div>
        ) : agendamentos.length === 0 ? (
          <div style={{ textAlign: "center", padding: "50px", color: "#94A3B8" }}>
            <MdCalendarToday size={40} color="#CBD5E1" style={{ marginBottom: "10px" }} />
            <p style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "#334155" }}>Agenda Vazia</p>
            <p style={{ margin: "4px 0 12px 0", fontSize: "13px", color: "#64748B" }}>Não existem agendamentos registados para esta data.</p>
            <button onClick={() => setMostrarModalNovo(true)} style={{ background: "transparent", border: "none", color: "#0D9488", fontWeight: "700", cursor: "pointer", fontSize: "13px" }}>
              + Agendar consulta agora
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {agendamentos.map((item) => (
              <div key={item.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px", borderRadius: "12px", backgroundColor: "#F8FAFC", border: "1px solid #F1F5F9" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  <div style={{ backgroundColor: "#0F172A", color: "#FFFFFF", padding: "8px 14px", borderRadius: "10px", fontWeight: "700", fontSize: "16px", minWidth: "60px", textAlign: "center" }}>
                    {item.hora}
                  </div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <strong style={{ fontSize: "15px", color: "#0F172A" }}>{item.pet_nome}</strong>
                      <span style={{ fontSize: "12px", color: "#64748B" }}>({item.especie})</span>
                      <span style={{ backgroundColor: "#E0F2FE", color: "#0369A1", padding: "2px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: "700" }}>
                        {item.tipo_servico}
                      </span>
                    </div>
                    <span style={{ fontSize: "13px", color: "#475569", display: "block", marginTop: "2px" }}>
                      👤 Tutor: {item.tutor_nome} | 👨‍⚕️ {item.veterinario_nome}
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  {item.status === "AGENDADO" && (
                    <button onClick={() => alterarStatus(item.id, "EM_ESPERA")} style={{ backgroundColor: "#10B981", color: "white", border: "none", padding: "8px 14px", borderRadius: "8px", fontWeight: "600", fontSize: "12px", cursor: "pointer" }}>
                      🟢 Dar Entrada na Recepção
                    </button>
                  )}

                  {item.status === "EM_ESPERA" && (
                    <span style={{ backgroundColor: "#FEF3C7", color: "#92400E", padding: "6px 12px", borderRadius: "12px", fontSize: "12px", fontWeight: "700" }}>
                      ⏳ Na Fila da Triagem
                    </span>
                  )}

                  <button onClick={() => alterarStatus(item.id, "CANCELADO")} style={{ backgroundColor: "transparent", color: "#EF4444", border: "none", padding: "6px", cursor: "pointer" }}>
                    <MdCancel size={20} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL NOVO AGENDAMENTO */}
      {mostrarModalNovo && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
          <div style={{ backgroundColor: "white", padding: "28px", borderRadius: "16px", maxWidth: "500px", width: "100%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ margin: 0, fontSize: "18px", color: "#0F172A" }}>📅 Novo Agendamento</h3>
              <button onClick={() => setMostrarModalNovo(false)} style={{ border: "none", background: "transparent", cursor: "pointer" }}><MdClose size={22} /></button>
            </div>

            <form onSubmit={salvarAgendamento} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "#475569", display: "block", marginBottom: "4px" }}>Paciente / Pet *</label>
                <select value={animalId} onChange={(e) => setAnimalId(e.target.value)} required style={estiloInput}>
                  <option value="">Selecione um paciente...</option>
                  {animais.map(a => <option key={a.id} value={a.id}>{a.nome} ({a.especie})</option>)}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "600", color: "#475569", display: "block", marginBottom: "4px" }}>Horário *</label>
                  <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} required style={estiloInput} />
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "600", color: "#475569", display: "block", marginBottom: "4px" }}>Tipo de Serviço</label>
                  <select value={tipoServico} onChange={(e) => setTipoServico(e.target.value)} style={estiloInput}>
                    <option value="Consulta">Consulta</option>
                    <option value="Vacina">Vacinação</option>
                    <option value="Retorno">Retorno Médico</option>
                    <option value="Exame">Exames</option>
                    <option value="Cirurgia">Cirurgia</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "#475569", display: "block", marginBottom: "4px" }}>Veterinário Responsável</label>
                <select value={veterinarioId} onChange={(e) => setVeterinarioId(e.target.value)} style={estiloInput}>
                  <option value="">Qualquer Veterinário disponível</option>
                  {veterinarios.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "#475569", display: "block", marginBottom: "4px" }}>Observações</label>
                <textarea rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} style={{ ...estiloInput, height: "auto", padding: "8px" }} placeholder="Motivo da consulta..." />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <button type="button" onClick={() => setMostrarModalNovo(false)} style={{ backgroundColor: "#F1F5F9", border: "none", padding: "10px 16px", borderRadius: "8px", fontWeight: "600", cursor: "pointer" }}>Cancelar</button>
                <button type="submit" style={{ backgroundColor: "#0D9488", color: "white", border: "none", padding: "10px 20px", borderRadius: "8px", fontWeight: "600", cursor: "pointer" }}>Confirmar Agendamento</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}

const estiloInput = { width: "100%", height: "38px", padding: "0 10px", border: "1px solid #CBD5E1", borderRadius: "8px", fontSize: "13px", outline: "none", boxSizing: "border-box" };

export default Agenda;