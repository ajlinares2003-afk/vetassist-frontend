import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MdLocalHospital, MdAutoAwesome, MdVisibility, MdEdit, MdClose, MdCheckCircle } from "react-icons/md";
import api from "../api/api";
import Layout from "../components/Layout";

function Cirurgia() {
  const navigate = useNavigate();
  const [cirurgias, setCirurgias] = useState([]);
  const [consultas, setConsultas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [cirurgiaVisualizando, setCirurgiaVisualizando] = useState(null);
  const [mensagemErro, setMensagemErro] = useState("");
  const [mensagemSucesso, setMensagemSucesso] = useState("");
  const [carregandoIa, setCarregandoIa] = useState(false);
  const [justificativaAsa, setJustificativaAsa] = useState("");

  const [consultaId, setConsultaId] = useState("");
  const [descricaoTecnica, setDescricaoTecnica] = useState("");
  const [classificacaoAsa, setClassificacaoAsa] = useState("ASA I - Paciente Saudável");
  const [statusCirurgia, setStatusCirurgia] = useState("Aguardando Cirurgia");
  const [dataHoraInicio, setDataHoraInicio] = useState("");
  const [dataHoraFim, setDataHoraFim] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [cirurgiaoId, setCirurgiaoId] = useState("");

  useEffect(() => {
    carregarCirurgias();
    carregarConsultas();
    carregarUsuarios();
  }, []);

  const carregarCirurgias = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) { navigate("/"); return; }
      const response = await api.get("/cirurgias/", { headers: { Authorization: `Bearer ${token}` } });
      setCirurgias(response.data || []);
    } catch (error) {
      setMensagemErro("❌ Não foi possível carregar a lista de procedimentos.");
    }
  };

  const carregarConsultas = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await api.get("/consultas/", { headers: { Authorization: `Bearer ${token}` } });
      
      const consultasFiltradas = (response.data || []).filter(c => c.indicacao_cirurgia === true);
      setConsultas(consultasFiltradas);
    } catch (error) { 
      console.error("Erro ao carregar consultas:", error); 
    }
  };

  // 🔹 CORREÇÃO APLICADA AQUI: Aponta para a rota dedicada de veterinários no backend
  const carregarUsuarios = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await api.get("/cirurgias/usuarios/veterinarios", { headers: { Authorization: `Bearer ${token}` } });
      setUsuarios(response.data || []);
    } catch (error) { console.error("Erro ao carregar veterinários:", error); }
  };

  const formatarDataHoraAmigavel = (dataString) => {
    if (!dataString) return "-";
    const dataObj = new Date(dataString);
    if (isNaN(dataObj.getTime())) return dataString;
    return dataObj.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const abrirFormularioNovo = () => {
    setEditandoId(null);
    setConsultaId("");
    setDescricaoTecnica("");
    setClassificacaoAsa("ASA I - Paciente Saudável");
    setStatusCirurgia("Aguardando Cirurgia");
    setDataHoraInicio("");
    setDataHoraFim("");
    setObservacoes("");
    setCirurgiaoId("");
    setJustificativaAsa("");
    setMostrarFormulario(true);
  };

  const abrirFormularioEdicao = (item) => {
    setEditandoId(item.id);
    setConsultaId(item.consulta_id || "");
    setDescricaoTecnica(item.descricao_tecnica || "");
    setClassificacaoAsa(item.classificacao_asa || "ASA I - Paciente Saudável");
    setStatusCirurgia(item.status || "Aguardando Cirurgia");
    
    if (item.data_hora_inicio) {
      setDataHoraInicio(new Date(item.data_hora_inicio).toISOString().slice(0, 16));
    } else {
      setDataHoraInicio("");
    }

    if (item.data_hora_fim) {
      setDataHoraFim(new Date(item.data_hora_fim).toISOString().slice(0, 16));
    } else {
      setDataHoraFim("");
    }

    setObservacoes(item.observacoes_pos_operatorias || "");
    setJustificativaAsa("");
    setMostrarFormulario(true);
  };

  const handleSelecionarConsulta = async (e) => {
    const idSelecionado = e.target.value;
    setConsultaId(idSelecionado);

    if (!idSelecionado) {
      setJustificativaAsa("");
      setDescricaoTecnica("");
      setObservacoes("");
      return;
    }

    const consultaSelecionada = consultas.find((c) => c.id === Number(idSelecionado));
    if (!consultaSelecionada) return;

    setCarregandoIa(true);
    setMensagemErro("");
    setJustificativaAsa("");

    try {
      const token = localStorage.getItem("token");
      const payload = {
        queixa_principal: consultaSelecionada.queixa_principal || "Não informada",
        historico_clinico: consultaSelecionada.historico_clinico || null,
        exame_fisico: consultaSelecionada.exame_fisico || null,
        temperatura: consultaSelecionada.temperatura || null,
        frequencia_cardiaca: consultaSelecionada.frequencia_cardiaca || null,
        frequencia_respiratoria: consultaSelecionada.frequencia_respiratoria || null,
      };

      const response = await api.post("/consultas/sugerir-asa", payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data) {
        if (response.data.classificacao_asa) setClassificacaoAsa(response.data.classificacao_asa);
        if (response.data.justificativa) setJustificativaAsa(response.data.justificativa);
        if (response.data.descricao_tecnica) setDescricaoTecnica(response.data.descricao_tecnica);
        if (response.data.observacoes_pos) setObservacoes(response.data.observacoes_pos);
      }
    } catch (error) {
      console.error("Erro na automação da IA:", error);
      setMensagemErro("⚠️ Não foi possível gerar os campos automáticos via IA.");
    } finally {
      setCarregandoIa(false);
    }
  };

  const salvarCirurgia = async (e) => {
    e.preventDefault();
    setMensagemErro("");
    setMensagemSucesso("");

    if (!consultaId || !descricaoTecnica || !dataHoraInicio) {
      setMensagemErro("⚠️ Preencha os campos obrigatórios.");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const dataInicioFormatada = dataHoraInicio.includes("Z") ? dataHoraInicio : new Date(dataHoraInicio).toISOString();
      const dataFimFormatada = dataHoraFim ? (dataHoraFim.includes("Z") ? dataHoraFim : new Date(dataHoraFim).toISOString()) : null;

      const payload = {
        consulta_id: Number(consultaId),
        descricao_tecnica: descricaoTecnica,
        classificacao_asa: classificacaoAsa,
        status: statusCirurgia,
        data_hora_inicio: dataInicioFormatada,
        data_hora_fim: dataFimFormatada,
        observacoes_pos_operatorias: observacoes || null,
        equipe_cirurgica_ids: cirurgiaoId ? [Number(cirurgiaoId)] : []
      };

      if (editandoId) {
        await api.put(`/cirurgias/${editandoId}`, payload, { headers: { Authorization: `Bearer ${token}` } });
        setMensagemSucesso("✅ Procedimento cirúrgico atualizado com sucesso!");
      } else {
        await api.post("/cirurgias/", payload, { headers: { Authorization: `Bearer ${token}` } });
        setMensagemSucesso("✅ Procedimento cirúrgico cadastrado com sucesso!");
      }

      setMostrarFormulario(false);
      setEditandoId(null);
      carregarCirurgias();
    } catch (error) {
      setMensagemErro(`❌ ${error.response?.data?.detail || "Erro ao salvar procedimento."}`);
    }
  };

  const corStatusBadge = (status) => {
    switch (status) {
      case "Aguardando Cirurgia": return { bg: "#fef3c7", color: "#b45309" };
      case "Em Cirurgia": return { bg: "#e0e7ff", color: "#3730a3" };
      case "Concluída": return { bg: "#dcfce7", color: "#166534" };
      default: return { bg: "#f3f4f6", color: "#374151" };
    }
  };

  return (
    <Layout>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h1 style={{ display: "flex", alignItems: "center", gap: "12px", margin: 0, fontSize: "26px", color: "#1e1b4b" }}>
          <MdLocalHospital color="#4f46e5" size={38} />
          Centro Cirúrgico & Anestesiologia
        </h1>
        <button
          onClick={() => (mostrarFormulario ? setMostrarFormulario(false) : abrirFormularioNovo())}
          style={{ backgroundColor: "#4f46e5", color: "white", border: "none", padding: "10px 20px", borderRadius: "8px", cursor: "pointer", fontWeight: "600" }}
        >
          {mostrarFormulario ? "Fechar Formulário" : "＋ Nova Cirurgia"}
        </button>
      </div>

      {mensagemSucesso && <div style={{ backgroundColor: "#dcfce7", color: "#166534", padding: "12px", borderRadius: "8px", marginBottom: "15px" }}>{mensagemSucesso}</div>}
      {mensagemErro && <div style={{ backgroundColor: "#fee2e2", color: "#991b1b", padding: "12px", borderRadius: "8px", marginBottom: "15px" }}>{mensagemErro}</div>}

      {mostrarFormulario && (
        <form onSubmit={salvarCirurgia} style={{ backgroundColor: "white", padding: "24px", borderRadius: "12px", marginBottom: "25px", border: "1px solid #e5e7eb" }}>
          <h3 style={{ margin: "0 0 16px 0", color: "#111827", display: "flex", alignItems: "center", gap: "8px" }}>
            {editandoId ? "✏️ Editar Procedimento Cirúrgico" : "🔪 Agendar Procedimento Cirúrgico"} 
            {carregandoIa && <span style={{ fontSize: "12px", color: "#4f46e5", fontWeight: "normal", display: "flex", alignItems: "center", gap: "4px" }}><MdAutoAwesome /> IA preenchendo dados...</span>}
          </h3>
          
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>Consulta de Origem *</label>
              <select value={consultaId} onChange={handleSelecionarConsulta} required style={estiloInput}>
                <option value="">Selecione a Consulta</option>
                {consultas.map((c) => (
                  <option key={c.id} value={c.id}>CNS-{c.id} - Queixa: {c.queixa_principal}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>Classificação ASA *</label>
              <select value={classificacaoAsa} onChange={(e) => setClassificacaoAsa(e.target.value)} style={estiloInput}>
                <option value="ASA I - Paciente Saudável">ASA I - Paciente Saudável</option>
                <option value="ASA II - Doença Sistêmica Leve">ASA II - Doença Sistêmica Leve</option>
                <option value="ASA III - Doença Sistêmica Grave">ASA III - Doença Sistêmica Grave</option>
                <option value="ASA IV - Risco de Vida Constante">ASA IV - Risco de Vida Constante</option>
                <option value="ASA V - Moribundo">ASA V - Moribundo</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>Status Cirúrgico *</label>
              <select value={statusCirurgia} onChange={(e) => setStatusCirurgia(e.target.value)} style={estiloInput}>
                <option value="Aguardando Cirurgia">Aguardando Cirurgia</option>
                <option value="Em Cirurgia">Em Cirurgia</option>
                <option value="Concluída">Concluída</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>Data e Hora de Início *</label>
              <input type="datetime-local" value={dataHoraInicio} onChange={(e) => setDataHoraInicio(e.target.value)} required style={estiloInput} />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>Data e Hora de Término</label>
              <input type="datetime-local" value={dataHoraFim} onChange={(e) => setDataHoraFim(e.target.value)} style={estiloInput} />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>Cirurgião Responsável</label>
              <select value={cirurgiaoId} onChange={(e) => setCirurgiaoId(e.target.value)} style={estiloInput}>
                <option value="">Selecione o Veterinário</option>
                {usuarios.map((u) => (
                  <option key={u.id} value={u.id}>{u.nome} ({u.perfil})</option>
                ))}
              </select>
            </div>
          </div>

          {justificativaAsa && (
            <div style={{ marginTop: "12px", backgroundColor: "#e0e7ff", padding: "10px 14px", borderRadius: "8px", fontSize: "13px", color: "#3730a3", borderLeft: "4px solid #4f46e5" }}>
              <strong>🤖 Parecer Automático da IA:</strong> {justificativaAsa}
            </div>
          )}

          <div style={{ marginTop: "16px" }}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>Descrição Técnica do Procedimento *</label>
            <textarea 
              rows={4}
              placeholder="Preenchimento automático via IA..." 
              value={descricaoTecnica} 
              onChange={(e) => setDescricaoTecnica(e.target.value)} 
              required 
              style={{ ...estiloInput, height: "auto", padding: "12px", resize: "vertical" }} 
            />
          </div>

          <div style={{ marginTop: "16px" }}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>Observações / Pós-Operatório</label>
            <textarea 
              rows={4}
              placeholder="Preenchimento automático via IA..." 
              value={observacoes} 
              onChange={(e) => setObservacoes(e.target.value)} 
              style={{ ...estiloInput, height: "auto", padding: "12px", resize: "vertical" }} 
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "20px" }}>
            <button type="button" onClick={() => setMostrarFormulario(false)} style={{ backgroundColor: "#f3f4f6", border: "none", padding: "10px 20px", borderRadius: "8px", cursor: "pointer" }}>Cancelar</button>
            <button type="submit" style={{ backgroundColor: "#16a34a", color: "white", border: "none", padding: "10px 24px", borderRadius: "8px", cursor: "pointer", fontWeight: "600" }}>{editandoId ? "Salvar Alterações" : "Salvar Cirurgia"}</button>
          </div>
        </form>
      )}

      <div style={{ backgroundColor: "white", borderRadius: "12px", boxShadow: "0 2px 4px rgba(0,0,0,0.05)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
          <thead>
            <tr style={{ backgroundColor: "#4f46e5", color: "white", fontSize: "14px" }}>
              <th style={{ padding: "14px" }}>Código</th>
              <th style={{ padding: "14px" }}>Paciente</th>
              <th style={{ padding: "14px" }}>Descrição Técnica Resumida</th>
              <th style={{ padding: "14px" }}>Risco ASA</th>
              <th style={{ padding: "14px" }}>Início / Fim</th>
              <th style={{ padding: "14px" }}>Status</th>
              <th style={{ padding: "14px", textAlign: "center" }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {cirurgias.length > 0 ? (
              cirurgias.map((item, index) => {
                const estiloBadge = corStatusBadge(item.status);
                return (
                  <tr key={item.id} style={{ backgroundColor: index % 2 === 0 ? "#ffffff" : "#f9fafb", borderBottom: "1px solid #f3f4f6", fontSize: "14px" }}>
                    <td style={{ padding: "14px", fontWeight: "bold", color: "#4f46e5", whiteSpace: "nowrap" }}>{item.codigo || `CIR-${String(item.id).padStart(3, '0')}`}</td>
                    <td style={{ padding: "14px", fontWeight: "600", color: "#111827", whiteSpace: "nowrap" }}>{item.animal_nome || "Paciente"}</td>
                    <td style={{ padding: "14px", color: "#1f2937", maxWidth: "250px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={item.descricao_tecnica}>
                      {item.descricao_tecnica}
                    </td>
                    <td style={{ padding: "14px", color: "#4b5563", whiteSpace: "nowrap" }}>{item.classificacao_asa}</td>
                    <td style={{ padding: "14px", color: "#4b5563", whiteSpace: "nowrap", fontSize: "13px" }}>
                      <div>Início: {formatarDataHoraAmigavel(item.data_hora_inicio)}</div>
                      {item.data_hora_fim && <div style={{ color: "#059669" }}>Fim: {formatarDataHoraAmigavel(item.data_hora_fim)}</div>}
                    </td>
                    <td style={{ padding: "14px", whiteSpace: "nowrap" }}>
                      <span style={{ backgroundColor: estiloBadge.bg, color: estiloBadge.color, padding: "4px 10px", borderRadius: "999px", fontSize: "12px", fontWeight: "600" }}>
                        {item.status || "Aguardando Cirurgia"}
                      </span>
                    </td>
                    <td style={{ padding: "14px", textAlign: "center", whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", justifyContent: "center", gap: "8px" }}>
                        <button 
                          onClick={() => setCirurgiaVisualizando(item)}
                          style={{ backgroundColor: "#4f46e5", color: "white", border: "none", padding: "6px 10px", borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontWeight: "600", display: "inline-flex", alignItems: "center", gap: "4px" }}
                        >
                          <MdVisibility size={14} /> Ver
                        </button>
                        <button 
                          onClick={() => abrirFormularioEdicao(item)}
                          style={{ backgroundColor: "#0284c7", color: "white", border: "none", padding: "6px 10px", borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontWeight: "600", display: "inline-flex", alignItems: "center", gap: "4px" }}
                        >
                          <MdEdit size={14} /> Editar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="7" style={{ padding: "24px", textAlign: "center", color: "#6b7280", fontSize: "14px" }}>
                  Nenhum procedimento cirúrgico cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {cirurgiaVisualizando && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(0, 0, 0, 0.5)", backdropFilter: "blur(3px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: "20px" }}>
          <div style={{ backgroundColor: "white", borderRadius: "16px", maxWidth: "650px", width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)", border: "1px solid #e5e7eb", boxSizing: "border-box" }}>
            
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px", borderBottom: "1px solid #f3f4f6", backgroundColor: "#f8fafc" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <MdLocalHospital size={24} color="#4f46e5" />
                <h3 style={{ margin: 0, fontSize: "18px", color: "#0f172a" }}>Detalhes do Procedimento Cirúrgico</h3>
              </div>
              <button 
                onClick={() => setCirurgiaVisualizando(null)}
                style={{ backgroundColor: "transparent", border: "none", cursor: "pointer", color: "#64748b", display: "flex", alignItems: "center", padding: "4px" }}
              >
                <MdClose size={22} />
              </button>
            </div>

            <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div style={{ backgroundColor: "#f8fafc", padding: "12px 16px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                  <span style={{ fontSize: "12px", color: "#64748b", display: "block", fontWeight: "600", marginBottom: "4px" }}>CÓDIGO</span>
                  <strong style={{ fontSize: "15px", color: "#4f46e5" }}>{cirurgiaVisualizando.codigo || `CIR-${String(cirurgiaVisualizando.id).padStart(3, '0')}`}</strong>
                </div>

                <div style={{ backgroundColor: "#f8fafc", padding: "12px 16px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                  <span style={{ fontSize: "12px", color: "#64748b", display: "block", fontWeight: "600", marginBottom: "4px" }}>PACIENTE</span>
                  <strong style={{ fontSize: "15px", color: "#1e293b" }}>{cirurgiaVisualizando.animal_nome || "Não informado"}</strong>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div style={{ backgroundColor: "#f8fafc", padding: "12px 16px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                  <span style={{ fontSize: "12px", color: "#64748b", display: "block", fontWeight: "600", marginBottom: "4px" }}>CLASSIFICAÇÃO ASA</span>
                  <span style={{ fontSize: "14px", color: "#334155", fontWeight: "500" }}>{cirurgiaVisualizando.classificacao_asa}</span>
                </div>

                <div style={{ backgroundColor: "#f8fafc", padding: "12px 16px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                  <span style={{ fontSize: "12px", color: "#64748b", display: "block", fontWeight: "600", marginBottom: "4px" }}>STATUS</span>
                  <span style={{ 
                    backgroundColor: corStatusBadge(cirurgiaVisualizando.status).bg, 
                    color: corStatusBadge(cirurgiaVisualizando.status).color, 
                    padding: "4px 10px", 
                    borderRadius: "999px", 
                    fontSize: "12px", 
                    fontWeight: "600",
                    display: "inline-block"
                  }}>
                    {cirurgiaVisualizando.status || "Aguardando Cirurgia"}
                  </span>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div style={{ backgroundColor: "#f8fafc", padding: "12px 16px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                  <span style={{ fontSize: "12px", color: "#64748b", display: "block", fontWeight: "600", marginBottom: "4px" }}>DATA E HORA DE INÍCIO</span>
                  <span style={{ fontSize: "14px", color: "#334155" }}>{formatarDataHoraAmigavel(cirurgiaVisualizando.data_hora_inicio)}</span>
                </div>

                <div style={{ backgroundColor: "#f8fafc", padding: "12px 16px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                  <span style={{ fontSize: "12px", color: "#64748b", display: "block", fontWeight: "600", marginBottom: "4px" }}>DATA E HORA DE TÉRMINO</span>
                  <span style={{ fontSize: "14px", color: "#334155" }}>{formatarDataHoraAmigavel(cirurgiaVisualizando.data_hora_fim)}</span>
                </div>
              </div>

              <div style={{ backgroundColor: "#f8fafc", padding: "16px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: "12px", color: "#64748b", display: "block", fontWeight: "600", marginBottom: "8px" }}>DESCRIÇÃO TÉCNICA DO PROCEDIMENTO</span>
                <p style={{ margin: 0, fontSize: "14px", color: "#1e293b", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>
                  {cirurgiaVisualizando.descricao_tecnica || "Nenhuma descrição técnica informada."}
                </p>
              </div>

              <div style={{ backgroundColor: "#f8fafc", padding: "16px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: "12px", color: "#64748b", display: "block", fontWeight: "600", marginBottom: "8px" }}>OBSERVAÇÕES / PÓS-OPERATÓRIO</span>
                <p style={{ margin: 0, fontSize: "14px", color: "#1e293b", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>
                  {cirurgiaVisualizando.observacoes_pos_operatorias || "Nenhuma observação pós-operatória registrada."}
                </p>
              </div>

            </div>

            <div style={{ padding: "16px 24px", borderTop: "1px solid #f3f4f6", backgroundColor: "#f8fafc", display: "flex", justifyContent: "flex-end" }}>
              <button 
                onClick={() => setCirurgiaVisualizando(null)}
                style={{ backgroundColor: "#4f46e5", color: "white", border: "none", padding: "10px 20px", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "14px" }}
              >
                Fechar
              </button>
            </div>

          </div>
        </div>
      )}

    </Layout>
  );
}

const estiloInput = {
  width: "100%",
  height: "42px",
  padding: "0 12px",
  border: "1px solid #d1d5db",
  borderRadius: "8px",
  fontSize: "14px",
  outline: "none",
  boxSizing: "border-box"
};

export default Cirurgia;