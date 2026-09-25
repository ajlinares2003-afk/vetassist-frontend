import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  MdEvent,
  MdHotel,
  MdWarning,
  MdRefresh,
  MdLocalHospital,
  MdBarChart,
  MdAutoAwesome,
  MdClose,
  MdSend,
  MdMic,
  MdMedicalServices,
  MdCheckCircleOutline
} from "react-icons/md";
import api from "../api/api";
import Layout from "../components/Layout";

function Dashboard() {
  const navigate = useNavigate();
  const [metricas, setMetricas] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [atualizandoSilencioso, setAtualizandoSilencioso] = useState(false);

  const [painelIaAberto, setPainelIaAberto] = useState(false);
  const [mensagemIa, setMensagemIa] = useState("");
  const [historicoChat, setHistoricoChat] = useState([]);
  const [carregandoRespostaIa, setCarregandoRespostaIa] = useState(false);
  const [resumoDiaTexto, setResumoDiaTexto] = useState("");
  const [gerandoResumo, setGerandoResumo] = useState(false);

  const nomeUsuario = localStorage.getItem("usuario_nome") || "Recepcao Teste";
  const perfilUsuario = localStorage.getItem("perfil") || "RECEPCAO";

  useEffect(() => {
    carregarDashboard(true);
    const intervalo = setInterval(() => carregarDashboard(false), 15000);
    return () => clearInterval(intervalo);
  }, []);

  const carregarDashboard = async (exibirLoader = false) => {
    if (exibirLoader) setCarregando(true);
    else setAtualizandoSilencioso(true);

    try {
      const token = localStorage.getItem("token");
      if (!token) return navigate("/");
      const res = await api.get("/dashboard/metricas", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMetricas(res.data);
    } catch (err) {
      console.error("Erro ao carregar métricas do dashboard:", err);
    } finally {
      setCarregando(false);
      setAtualizandoSilencioso(false);
    }
  };

  const enviarPerguntaIa = async (perguntaTexto) => {
    const texto = perguntaTexto || mensagemIa;
    if (!texto.trim()) return;

    const novaMensagemUsuario = { autor: "usuario", texto };
    setHistoricoChat((prev) => [...prev, novaMensagemUsuario]);
    setMensagemIa("");
    setCarregandoRespostaIa(true);

    try {
      const token = localStorage.getItem("token");
      const res = await api.post(
        "/dashboard/ia-assistente",
        { mensagem: texto, perfil: perfilUsuario },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const respostaIa = {
        autor: "ia",
        texto: res.data.resposta || "Analisei os dados. Tudo sob controle no momento.",
      };
      setHistoricoChat((prev) => [...prev, respostaIa]);
    } catch (err) {
      setHistoricoChat((prev) => [
        ...prev,
        { autor: "ia", texto: "⚠️ Não consegui processar sua solicitação no momento." },
      ]);
    } finally {
      setCarregandoRespostaIa(false);
    }
  };

  const gerarResumoDiario = async () => {
    setGerandoResumo(true);
    try {
      const token = localStorage.getItem("token");
      const res = await api.post(
        "/dashboard/ia-resumo-dia",
        { perfil: perfilUsuario },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setResumoDiaTexto(res.data.resumo);
    } catch (err) {
      setResumoDiaTexto("Não foi possível gerar o resumo automático hoje.");
    } finally {
      setGerandoResumo(false);
    }
  };

  const maxAtendimentos = metricas?.historico_7_dias
    ? Math.max(...metricas.historico_7_dias.map((i) => i.atendimentos), 1)
    : 1;

  return (
    <Layout>
      <div style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box" }}>
        
        {/* TOPO E SAUDAÇÃO */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", width: "100%", marginBottom: "20px" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", textAlign: "left" }}>
            <h1 style={{ margin: 0, padding: 0, fontSize: "24px", fontWeight: "700", color: "#0F172A", lineHeight: "1.2" }}>
              Bom dia, {nomeUsuario}
            </h1>
            <p style={{ margin: "4px 0 0 0", padding: 0, fontSize: "14px", color: "#64748B", lineHeight: "1.4" }}>
              Painel de controle com suporte operacional VetAssist AI
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {atualizandoSilencioso && (
              <span style={{ fontSize: "12px", color: "#0D9488", fontWeight: "600" }}>Sync...</span>
            )}
            
            <button
              onClick={gerarResumoDiario}
              disabled={gerandoResumo}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                backgroundColor: "#F0FDFA",
                color: "#0D9488",
                border: "1px solid #99F6E4",
                padding: "8px 14px",
                borderRadius: "10px",
                cursor: "pointer",
                fontWeight: "600",
                fontSize: "13px"
              }}
            >
              <MdAutoAwesome size={16} /> {gerandoResumo ? "Gerando..." : "Gerar Resumo do Dia"}
            </button>

            <button
              onClick={() => carregarDashboard(true)}
              style={{
                display: "flex",
                alignItems: "center",
                backgroundColor: "#FFFFFF",
                border: "1px solid #E2E8F0",
                padding: "8px 12px",
                borderRadius: "10px",
                cursor: "pointer",
                color: "#334155"
              }}
            >
              <MdRefresh size={18} />
            </button>
          </div>
        </div>

        {/* SÍNTESE DO DIA */}
        {resumoDiaTexto && (
          <div style={{ backgroundColor: "#F0FDFA", border: "1px solid #99F6E4", borderRadius: "12px", padding: "14px 18px", marginBottom: "20px", position: "relative" }}>
            <button onClick={() => setResumoDiaTexto("")} style={{ position: "absolute", right: "12px", top: "12px", border: "none", background: "transparent", cursor: "pointer", color: "#0D9488" }}>
              <MdClose size={18} />
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#0D9488", fontWeight: "700", fontSize: "13px", marginBottom: "4px" }}>
              <MdAutoAwesome size={16} /> Síntese Operacional Inteligente ({perfilUsuario})
            </div>
            <p style={{ margin: 0, fontSize: "13px", color: "#134E4A", lineHeight: "1.4" }}>
              {resumoDiaTexto}
            </p>
          </div>
        )}

        {carregando ? (
          <div style={{ textAlign: "center", padding: "40px", color: "#0D9488", fontWeight: "600", fontSize: "14px" }}>
            Carregando informações da clínica...
          </div>
        ) : metricas ? (
          <>
            {/* CARDS PASTEL (MÉTRICAS RÁPIDAS) */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "20px" }}>
              <div style={{ backgroundColor: "#F0FDF4", padding: "14px 16px", borderRadius: "14px", border: "1px solid #DCFCE7", display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "40px", height: "40px", borderRadius: "10px", backgroundColor: "#BBF7D0", color: "#166534", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <MdEvent size={22} />
                </div>
                <div>
                  <span style={{ fontSize: "12px", color: "#166534", fontWeight: "600" }}>Consultas hoje</span>
                  <div style={{ fontSize: "22px", fontWeight: "700", color: "#14532D", lineHeight: "1.1" }}>{metricas.totais.consultas_hoje}</div>
                </div>
              </div>

              <div style={{ backgroundColor: "#FEFCE8", padding: "14px 16px", borderRadius: "14px", border: "1px solid #FEF08A", display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "40px", height: "40px", borderRadius: "10px", backgroundColor: "#FEF08A", color: "#854D0E", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <MdWarning size={22} />
                </div>
                <div>
                  <span style={{ fontSize: "12px", color: "#854D0E", fontWeight: "600" }}>Aguardando</span>
                  <div style={{ fontSize: "22px", fontWeight: "700", color: "#713F12", lineHeight: "1.1" }}>
                    {(metricas.triagem_prioridades?.POUCO_URGENTE || 0) + (metricas.triagem_prioridades?.URGENCIA || 0) + (metricas.triagem_prioridades?.EMERGENCIA || 0)}
                  </div>
                </div>
              </div>

              <div style={{ backgroundColor: "#F0F9FF", padding: "14px 16px", borderRadius: "14px", border: "1px solid #BAE6FD", display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "40px", height: "40px", borderRadius: "10px", backgroundColor: "#BAE6FD", color: "#075985", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <MdHotel size={22} />
                </div>
                <div>
                  <span style={{ fontSize: "12px", color: "#075985", fontWeight: "600" }}>Internados</span>
                  <div style={{ fontSize: "22px", fontWeight: "700", color: "#0C4A6E", lineHeight: "1.1" }}>{metricas.totais.pacientes_internados}</div>
                </div>
              </div>

              <div style={{ backgroundColor: "#FEF2F2", padding: "14px 16px", borderRadius: "14px", border: "1px solid #FECACA", display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "40px", height: "40px", borderRadius: "10px", backgroundColor: "#FECACA", color: "#991B1B", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <MdLocalHospital size={22} />
                </div>
                <div>
                  <span style={{ fontSize: "12px", color: "#991B1B", fontWeight: "600" }}>Casos Críticos</span>
                  <div style={{ fontSize: "22px", fontWeight: "700", color: "#7F1D1D", lineHeight: "1.1" }}>{metricas.totais.casos_criticos}</div>
                </div>
              </div>
            </div>

            {/* PAINÉIS SECUNDÁRIOS: AGENDA & UTI (FORÇANDO 50% / 50% RIGOROSO) */}
            <div style={{ display: "flex", gap: "20px", marginBottom: "20px", width: "100%" }}>
              
              {/* AGENDA DO DIA */}
              <div style={{ backgroundColor: "#FFFFFF", borderRadius: "16px", border: "1px solid #E2E8F0", padding: "18px", display: "flex", flexDirection: "column", height: "290px", width: "50%", boxSizing: "border-box" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexShrink: 0 }}>
                  <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "700", color: "#0F172A", display: "flex", alignItems: "center", gap: "8px" }}>
                    📅 Agenda do dia ({metricas.totais?.total_agendamentos_hoje || 0})
                  </h3>
                  <a href="/agenda" style={{ fontSize: "12px", color: "#0D9488", fontWeight: "600", textDecoration: "none" }}>Ver agenda completa →</a>
                </div>

                {(!metricas.lista_agendamentos_hoje || metricas.lista_agendamentos_hoje.length === 0) ? (
                  <p style={{ fontSize: "13px", color: "#64748B", margin: 0, padding: "20px 0", textAlign: "center" }}>Nenhum agendamento registado para hoje.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", flex: 1, overflowY: "auto", minHeight: 0 }}>
                    {metricas.lista_agendamentos_hoje.map((ag) => (
                      <div key={ag.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: "10px", backgroundColor: "#F8FAFC", border: "1px solid #F1F5F9", flexShrink: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1, minWidth: 0 }}>
                          <span style={{ backgroundColor: "#0F172A", color: "#FFFFFF", padding: "4px 8px", borderRadius: "6px", fontWeight: "700", fontSize: "12px", flexShrink: 0 }}>
                            {ag.hora}
                          </span>
                          <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "baseline", gap: "6px", minWidth: 0 }}>
                              <strong style={{ fontSize: "13px", color: "#0F172A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ag.pet_nome}</strong> 
                              <span style={{ fontSize: "11px", color: "#64748B", flexShrink: 0 }}>({ag.especie})</span>
                            </div>
                            <span style={{ fontSize: "11px", color: "#475569", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              Tutor: {ag.tutor_nome}
                            </span>
                          </div>
                        </div>
                        <span style={{ backgroundColor: "#E0F2FE", color: "#0369A1", padding: "4px 10px", borderRadius: "10px", fontSize: "10px", fontWeight: "700", flexShrink: 0, marginLeft: "8px" }}>
                          {ag.tipo_servico}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* UTI - EXATAMENTE 50% DE LARGURA E 290px DE ALTURA */}
              <div style={{ backgroundColor: "#FFFFFF", borderRadius: "16px", border: "1px solid #E2E8F0", padding: "18px", display: "flex", flexDirection: "column", height: "290px", width: "50%", boxSizing: "border-box" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexShrink: 0 }}>
                  <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "700", color: "#0F172A", display: "flex", alignItems: "center", gap: "8px" }}>
                    🏥 UTI ({metricas.totais?.pacientes_internados || 0})
                  </h3>
                  <button onClick={() => navigate("/internacao")} style={{ border: "none", background: "transparent", color: "#0D9488", fontWeight: "600", fontSize: "12px", cursor: "pointer" }}>
                    Ver todos &gt;
                  </button>
                </div>

                {metricas.lista_internados_criticos.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1, overflowY: "auto", minHeight: 0 }}>
                    {metricas.lista_internados_criticos.map((p) => (
                      <div key={p.internacao_id} style={{ padding: "8px 12px", backgroundColor: "#F8FAFC", borderRadius: "10px", border: "1px solid #F1F5F9", flexShrink: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                          <strong style={{ fontSize: "12px", color: "#0F172A" }}>{p.nome_animal} ({p.especie})</strong>
                          <span style={{ backgroundColor: "#FEF3C7", color: "#92400E", padding: "2px 6px", borderRadius: "8px", fontSize: "9px", fontWeight: "700" }}>
                            Leito {p.leito}
                          </span>
                        </div>
                        <div style={{ fontSize: "10px", color: "#475569", backgroundColor: "#FFFFFF", padding: "4px 8px", borderRadius: "6px", border: "1px solid #E2E8F0", marginBottom: "6px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          <strong>Motivo:</strong> {p.motivo}
                        </div>
                        <button onClick={() => navigate("/prontuarios")} style={{ backgroundColor: "#0D9488", color: "white", border: "none", padding: "3px 8px", borderRadius: "6px", fontSize: "10px", fontWeight: "600", cursor: "pointer" }}>
                          Ver Prontuário
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: "#94A3B8", textAlign: "center", padding: "40px 0", fontSize: "13px", fontStyle: "italic", margin: 0 }}>
                    Nenhum paciente internado no momento.
                  </p>
                )}
              </div>

            </div>

            {/* SEÇÕES EM DUAS COLUNAS: ASSISTENTE IA & GRÁFICO DA SEMANA */}
            <div style={{ display: "flex", gap: "20px", width: "100%" }}>
              
              {/* ASSISTENTE IA */}
              <div style={{
                backgroundColor: "#FFFFFF",
                borderRadius: "16px",
                border: "1px solid #E2E8F0",
                padding: "18px",
                display: "flex",
                flexDirection: "column",
                width: "50%",
                boxSizing: "border-box",
                background: "linear-gradient(135deg, #FFFFFF 0%, #F0FDFA 100%)"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#0D9488", fontWeight: "700", fontSize: "15px" }}>
                    <MdAutoAwesome size={20} /> ✨ Assistente VetAssist AI
                  </div>
                  <span style={{ fontSize: "11px", backgroundColor: "#CCFBF1", color: "#0F766E", padding: "3px 8px", borderRadius: "10px", fontWeight: "600" }}>
                    {perfilUsuario}
                  </span>
                </div>

                <p style={{ margin: "0 0 10px 0", fontSize: "13px", color: "#334155", fontWeight: "500" }}>
                  <strong>{metricas.totais.casos_criticos > 0 ? `${metricas.totais.casos_criticos} situações requerem atenção imediata:` : "Nenhum alerta crítico ativo no momento."}</strong>
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "14px" }}>
                  {metricas.lista_internados_criticos.slice(0, 2).map((item, idx) => (
                    <div key={idx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: "#FFFFFF", padding: "8px 12px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                      <span style={{ fontSize: "12px", color: "#0F172A", fontWeight: "600" }}>
                        🔴 {item.nome_animal}: leito {item.leito} crítico
                      </span>
                      <button onClick={() => navigate("/internacao")} style={{ border: "none", background: "transparent", color: "#0D9488", fontSize: "11px", fontWeight: "700", cursor: "pointer" }}>
                        Ver →
                      </button>
                    </div>
                  ))}
                  {metricas.lista_internados_criticos.length === 0 && (
                    <div style={{ fontSize: "12px", color: "#166534", display: "flex", alignItems: "center", gap: "6px" }}>
                      <MdCheckCircleOutline color="#16A34A" size={16} /> Exames e evoluções em dia.
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    onClick={() => setPainelIaAberto(true)}
                    style={{
                      backgroundColor: "#0D9488",
                      color: "white",
                      border: "none",
                      padding: "8px 14px",
                      borderRadius: "8px",
                      fontWeight: "600",
                      fontSize: "12px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px"
                    }}
                  >
                    <MdAutoAwesome /> Abrir Assistente
                  </button>

                  <button
                    onClick={() => navigate("/triagem")}
                    style={{
                      backgroundColor: "#FFFFFF",
                      color: "#334155",
                      border: "1px solid #CBD5E1",
                      padding: "8px 14px",
                      borderRadius: "8px",
                      fontWeight: "600",
                      fontSize: "12px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px"
                    }}
                  >
                    <MdMedicalServices /> Nova Triagem
                  </button>
                </div>
              </div>

              {/* GRÁFICO DA SEMANA */}
              <div style={{ backgroundColor: "#FFFFFF", padding: "18px", borderRadius: "16px", border: "1px solid #E2E8F0", display: "flex", flexDirection: "column", width: "50%", boxSizing: "border-box" }}>
                <h3 style={{ margin: "0 0 14px 0", fontSize: "15px", fontWeight: "700", color: "#0F172A", display: "flex", alignItems: "center", gap: "8px" }}>
                  <MdBarChart color="#0D9488" size={20} /> Atendimentos da Semana
                </h3>

                <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", height: "130px", paddingTop: "10px" }}>
                  {metricas.historico_7_dias?.map((item, idx) => {
                    const alturaPorcentagem = (item.atendimentos / maxAtendimentos) * 100;
                    return (
                      <div key={idx} style={{ flex: 1, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end" }}>
                        <span style={{ fontSize: "11px", fontWeight: "bold", color: "#0D9488", marginBottom: "4px" }}>
                          {item.atendimentos}
                        </span>
                        <div
                          style={{
                            width: "35%",
                            height: `${Math.max(alturaPorcentagem, 10)}%`,
                            backgroundColor: idx === 6 ? "#0D9488" : "#99F6E4",
                            borderRadius: "6px 6px 0 0",
                            transition: "height 0.4s ease"
                          }}
                        />
                        <span style={{ fontSize: "11px", color: "#64748B", marginTop: "6px", fontWeight: "500" }}>
                          {item.dia_semana}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          </>
        ) : null}

        {/* BOTÃO FLUTUANTE (FAB) */}
        <button
          onClick={() => setPainelIaAberto(true)}
          style={{
            position: "fixed",
            bottom: "28px",
            right: "28px",
            backgroundColor: "#0D9488",
            color: "white",
            border: "none",
            borderRadius: "30px",
            padding: "14px 22px",
            fontSize: "14px",
            fontWeight: "700",
            boxShadow: "0 10px 25px -5px rgba(13, 148, 136, 0.4)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            zIndex: 999
          }}
        >
          <MdAutoAwesome size={20} /> ✨ Falar com a IA
        </button>

        {/* DRAWER LATERAL IA */}
        {painelIaAberto && (
          <div style={{
            position: "fixed",
            top: 0,
            right: 0,
            width: "380px",
            height: "100vh",
            backgroundColor: "#FFFFFF",
            boxShadow: "-5px 0 25px rgba(0,0,0,0.15)",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            fontFamily: "'Inter', sans-serif"
          }}>
            <div style={{
              padding: "20px",
              backgroundColor: "#0F172A",
              color: "#FFFFFF",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", fontWeight: "700", fontSize: "16px" }}>
                <MdAutoAwesome color="#2DD4BF" size={22} /> Assistente VetAssist AI
              </div>
              <button onClick={() => setPainelIaAberto(false)} style={{ border: "none", background: "transparent", color: "#94A3B8", cursor: "pointer" }}>
                <MdClose size={22} />
              </button>
            </div>

            <div style={{ flex: 1, padding: "20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ backgroundColor: "#F8FAFC", padding: "12px 16px", borderRadius: "12px", border: "1px solid #E2E8F0", fontSize: "13px", color: "#334155" }}>
                Olá, <strong>{nomeUsuario}</strong> ({perfilUsuario}). Como posso apoiar suas tarefas agora?
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                <button onClick={() => enviarPerguntaIa("Quais pacientes precisam de atenção imediata?")} style={estiloChipIa}>
                  🔍 Pacientes críticos
                </button>
                <button onClick={() => enviarPerguntaIa("Qual a taxa de ocupação da UTI hoje?")} style={estiloChipIa}>
                  🏥 Ocupação da UTI
                </button>
                <button onClick={() => enviarPerguntaIa("Verificar exames pendentes")} style={estiloChipIa}>
                  🧪 Exames pendentes
                </button>
              </div>

              {historicoChat.map((msg, index) => (
                <div
                  key={index}
                  style={{
                    alignSelf: msg.autor === "usuario" ? "flex-end" : "flex-start",
                    backgroundColor: msg.autor === "usuario" ? "#0D9488" : "#F1F5F9",
                    color: msg.autor === "usuario" ? "#FFFFFF" : "#0F172A",
                    padding: "10px 14px",
                    borderRadius: "12px",
                    maxWidth: "85%",
                    fontSize: "13px",
                    lineHeight: "1.4"
                  }}
                >
                  {msg.texto}
                </div>
              ))}

              {carregandoRespostaIa && (
                <div style={{ alignSelf: "flex-start", backgroundColor: "#F1F5F9", padding: "10px 14px", borderRadius: "12px", fontSize: "12px", color: "#64748B", fontStyle: "italic" }}>
                  Analisando prontuários e indicadores...
                </div>
              )}
            </div>

            <div style={{ padding: "16px", borderTop: "1px solid #E2E8F0", display: "flex", gap: "8px", alignItems: "center" }}>
              <input
                type="text"
                placeholder="Digite uma pergunta..."
                value={mensagemIa}
                onChange={(e) => setMensagemIa(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && enviarPerguntaIa()}
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  borderRadius: "20px",
                  border: "1px solid #CBD5E1",
                  fontSize: "13px",
                  outline: "none"
                }}
              />
              <button style={{ border: "none", background: "transparent", color: "#64748B", cursor: "pointer" }}>
                <MdMic size={20} />
              </button>
              <button
                onClick={() => enviarPerguntaIa()}
                style={{
                  backgroundColor: "#0D9488",
                  color: "white",
                  border: "none",
                  borderRadius: "50%",
                  width: "36px",
                  height: "36px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer"
                }}
              >
                <MdSend size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

const estiloChipIa = {
  backgroundColor: "#F0FDFA",
  color: "#0D9488",
  border: "1px solid #CCFBF1",
  padding: "6px 12px",
  borderRadius: "16px",
  fontSize: "12px",
  fontWeight: "600",
  cursor: "pointer"
};

export default Dashboard;