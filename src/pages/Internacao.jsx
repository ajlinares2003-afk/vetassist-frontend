import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { 
  MdHotel, 
  MdCheckCircle, 
  MdShowChart, 
  MdClose, 
  MdHistory,
  MdSend,
  MdContentCopy,
  MdPrint
} from "react-icons/md";
import api from "../api/api";
import Layout from "../components/Layout";

function Internacao() {
  const location = useLocation();
  const [internacoes, setInternacoes] = useState([]);
  const [animais, setAnimais] = useState([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [modalEvolucao, setModalEvolucao] = useState(null);
  const [historicoEvolucoes, setHistoricoEvolucoes] = useState([]);

  // Estado do Boletim Diário (WhatsApp & PDF)
  const [boletimDados, setBoletimDados] = useState(null);
  const [copiado, setCopiado] = useState(false);

  // Estado para o modal customizado de confirmação de alta
  const [altaParaConfirmar, setAltaParaConfirmar] = useState(null);

  // Verifica permissão de alta com base no perfil salvo no navegador
  const usuarioPerfil = localStorage.getItem("perfil") || "";
  const podeDarAlta = ["ADMIN", "VETERINARIO"].includes(usuarioPerfil.toUpperCase());

  // Campos de Nova Internação
  const [animalId, setAnimalId] = useState("");
  const [leito, setLeito] = useState("");
  const [nivelCriticidade, setNivelCriticidade] = useState("ESTAVEL");
  const [motivo, setMotivo] = useState("");

  // Campos da Ficha de Evolução
  const [temperatura, setTemperatura] = useState("");
  const [freqCardiaca, setFreqCardiaca] = useState("");
  const [freqRespiratoria, setFreqRespiratoria] = useState("");
  const [tpcSegundos, setTpcSegundos] = useState("");
  const [mucosa, setMucosa] = useState("Normocorada");
  const [alimentacao, setAlimentacao] = useState("Voluntária (Aceitou)");
  const [dejecoes, setDejecoes] = useState("Normais");
  const [observacoes, setObservacoes] = useState("");

  const [mensagemSucesso, setMensagemSucesso] = useState("");
  const [mensagemErro, setMensagemErro] = useState("");

  const leitosPadrao = [
    "Canil 01", "Canil 02", "Canil 03", 
    "Gatil 01", "Gatil 02", 
    "Isolamento 01", "UTI 01", "UTI 02",
    "Observação 01", "Observação 02", "Box de Curta Permanência"
  ];

  // Filtra apenas os leitos que NÃO estão ocupados no momento
  const leitosDisponiveis = leitosPadrao.filter(
    (l) => !internacoes.some((i) => i.leito === l)
  );

  useEffect(() => {
    carregarInternacoes();
    carregarAnimais();
  }, []);

  // Se veio redirecionado de um atendimento, preenche os dados e abre o formulário
  useEffect(() => {
    if (location.state?.animalId) {
      setAnimalId(String(location.state.animalId));
      if (location.state.motivo) {
        setMotivo(location.state.motivo);
      }
      setMostrarForm(true);
    }
  }, [location.state]);

  const carregarInternacoes = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await api.get("/internacoes/", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const lista = res.data || [];
      setInternacoes(lista);

      const leitosLivres = leitosPadrao.filter((l) => !lista.some((i) => i.leito === l));
      if (leitosLivres.length > 0 && (!leito || lista.some((i) => i.leito === leito))) {
        setLeito(leitosLivres[0]);
      }
    } catch (err) {
      console.error("Erro ao carregar internações", err);
    }
  };

  const carregarAnimais = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await api.get("/animais/", {
        headers: { Authorization: `Bearer ${token}` }
      });

      let dadosFormatados = [];
      if (Array.isArray(res.data)) {
        dadosFormatados = res.data;
      } else if (res.data && Array.isArray(res.data.animais)) {
        dadosFormatados = res.data.animais;
      } else if (res.data && Array.isArray(res.data.items)) {
        dadosFormatados = res.data.items;
      }

      setAnimais(dadosFormatados);
    } catch (err) {
      console.error("Erro ao carregar animais:", err);
    }
  };

  const alternarFormulario = () => {
    if (!mostrarForm) {
      carregarAnimais();
      carregarInternacoes();
      if (leitosDisponiveis.length > 0) {
        setLeito(leitosDisponiveis[0]);
      }
    }
    setMostrarForm(!mostrarForm);
  };

  const carregarEvolucoes = async (internacaoId) => {
    try {
      const token = localStorage.getItem("token");
      const res = await api.get(`/internacoes/${internacaoId}/evolucoes`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setHistoricoEvolucoes(res.data || []);
    } catch (err) {
      console.error("Erro ao carregar histórico de evoluções", err);
    }
  };

  const abrirModalEvolucao = (item) => {
    setModalEvolucao(item);
    limparCamposEvolucao();
    carregarEvolucoes(item.id);
  };

  const limparCamposEvolucao = () => {
    setTemperatura("");
    setFreqCardiaca("");
    setFreqRespiratoria("");
    setTpcSegundos("");
    setMucosa("Normocorada");
    setAlimentacao("Voluntária (Aceitou)");
    setDejecoes("Normais");
    setObservacoes("");
  };

  const abrirBoletim = async (internacaoId) => {
    try {
      const token = localStorage.getItem("token");
      const res = await api.get(`/internacoes/${internacaoId}/boletim`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBoletimDados(res.data);
      setCopiado(false);
    } catch (err) {
      alert("Erro ao gerar boletim de internação.");
    }
  };

  const copiarTextoWhatsApp = () => {
    if (boletimDados?.texto_whatsapp) {
      navigator.clipboard.writeText(boletimDados.texto_whatsapp);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 3000);
    }
  };

  const enviarWhatsAppDireto = () => {
    if (boletimDados) {
      const tel = (boletimDados.telefone_tutor || "").replace(/\D/g, "");
      const textoEncoded = encodeURIComponent(boletimDados.texto_whatsapp);
      const link = tel ? `https://wa.me/55${tel}?text=${textoEncoded}` : `https://wa.me/?text=${textoEncoded}`;
      window.open(link, "_blank");
    }
  };

  const imprimirBoletim = () => {
    if (!boletimDados) return;

    const janelaImpressao = window.open("", "_blank", "width=800,height=700");
    if (!janelaImpressao) {
      alert("Por favor, permita pop-ups para imprimir o boletim.");
      return;
    }

    const agora = new Date();
    const dia = String(agora.getDate()).padStart(2, "0");
    const mes = String(agora.getMonth() + 1).padStart(2, "0");
    const ano = agora.getFullYear();
    const horas = String(agora.getHours()).padStart(2, "0");
    const minutos = String(agora.getMinutes()).padStart(2, "0");

    const dataHoraNomeArquivo = `${dia}-${mes}-${ano}_${horas}-${minutos}`;
    const nomePaciente = boletimDados.animal?.nome || "Paciente";
    const tituloPDF = `Boletim Diario - ${nomePaciente} - ${dataHoraNomeArquivo}`;

    const textoFormatadoHTML = (boletimDados.texto_whatsapp || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br/>");

    const conteudoHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${tituloPDF}</title>
          <style>
            @page { size: A4; margin: 15mm; }
            body { font-family: Arial, sans-serif; color: #111827; padding: 20px; margin: 0; background-color: #ffffff; }
            .cabecalho { border-bottom: 2px solid #4f46e5; padding-bottom: 12px; margin-bottom: 20px; }
            .titulo { font-size: 22px; font-weight: bold; color: #1e1b4b; margin: 0; }
            .subtitulo { font-size: 13px; color: #6b7280; margin-top: 4px; }
            .conteudo { background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 8px; font-family: 'Courier New', Courier, monospace; font-size: 13px; line-height: 1.6; color: #166534; }
            .rodape { margin-top: 30px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; text-align: center; }
          </style>
        </head>
        <body>
          <div class="cabecalho">
            <h1 class="titulo">🐾 VetAssist AI — Hospital Veterinário</h1>
            <div class="subtitulo">Boletim Diário de Acompanhamento Hospitalar & UTI</div>
          </div>
          <div class="conteudo">${textoFormatadoHTML}</div>
          <div class="rodape">Documento emitido eletronicamente via VetAssist AI em ${agora.toLocaleString("pt-BR")}</div>
        </body>
      </html>
    `;

    janelaImpressao.document.open();
    janelaImpressao.document.write(conteudoHTML);
    janelaImpressao.document.close();

    setTimeout(() => {
      janelaImpressao.focus();
      janelaImpressao.print();
    }, 500);
  };

  const salvarInternacao = async (e) => {
    e.preventDefault();
    setMensagemErro("");
    setMensagemSucesso("");

    if (!animalId) {
      setMensagemErro("⚠️ Por favor, selecione um paciente da lista.");
      return;
    }

    if (!leito) {
      setMensagemErro("⚠️ Selecione um leito disponível.");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      await api.post("/internacoes/", {
        animal_id: Number(animalId),
        leito,
        nivel_criticidade: nivelCriticidade,
        motivo
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setMensagemSucesso("✅ Paciente internado/em observação com sucesso!");
      setAnimalId("");
      setMotivo("");
      setMostrarForm(false);
      carregarInternacoes();
    } catch (err) {
      setMensagemErro(`❌ ${err.response?.data?.detail || "Erro ao dar entrada na internação."}`);
    }
  };

  const salvarEvolucao = async (e) => {
    e.preventDefault();
    setMensagemErro("");
    setMensagemSucesso("");

    try {
      const token = localStorage.getItem("token");
      await api.post(`/internacoes/${modalEvolucao.id}/evolucoes`, {
        temperatura: temperatura ? parseFloat(temperatura) : null,
        freq_cardiaca: freqCardiaca ? parseFloat(freqCardiaca) : null,
        freq_respiratoria: freqRespiratoria ? parseFloat(freqRespiratoria) : null,
        tpc_segundos: tpcSegundos ? parseFloat(tpcSegundos) : null,
        mucosa,
        alimentacao,
        dejecoes,
        observacoes
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setMensagemSucesso("✅ Evolução clínica registrada!");
      limparCamposEvolucao();
      carregarEvolucoes(modalEvolucao.id);
    } catch (err) {
      setMensagemErro("❌ Erro ao registrar evolução clínica.");
    }
  };

  const solicitarAlta = (id, nome) => {
    setAltaParaConfirmar({ id, nome });
  };

  const confirmarAlta = async () => {
    if (!altaParaConfirmar) return;

    try {
      const token = localStorage.getItem("token");
      await api.put(`/internacoes/${altaParaConfirmar.id}/alta`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMensagemSucesso(`✅ Alta concedida para ${altaParaConfirmar.nome}! O leito já foi liberado.`);
      setAltaParaConfirmar(null);
      carregarInternacoes();
    } catch (err) {
      setMensagemErro("❌ Erro ao dar alta médica.");
      setAltaParaConfirmar(null);
    }
  };

  const getBadgeCriticidade = (nivel) => {
    const configs = {
      CRITICO: { bg: "#fee2e2", color: "#991b1b", border: "#fecaca", label: "🚨 CRÍTICO / UTI" },
      MODERADO: { bg: "#fef3c7", color: "#92400e", border: "#fde68a", label: "⚠️ MODERADO" },
      ESTAVEL: { bg: "#dcfce7", color: "#166534", border: "#bbf7d0", label: "🟢 ESTÁVEL" }
    };
    const c = configs[nivel] || configs.ESTAVEL;
    return (
      <span style={{ backgroundColor: c.bg, color: c.color, border: `1px solid ${c.border}`, padding: "4px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "700" }}>
        {c.label}
      </span>
    );
  };

  return (
    <Layout>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h1 style={{ display: "flex", alignItems: "center", gap: "12px", margin: 0, fontSize: "26px", color: "#1e1b4b" }}>
          <MdHotel color="#4f46e5" size={38} />
          Mapa de Leitos & Internação / Observação
        </h1>

        <button
          onClick={alternarFormulario}
          style={{ backgroundColor: "#4f46e5", color: "white", border: "none", padding: "10px 20px", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "14px" }}
        >
          {mostrarForm ? "Fechar Formulário" : "＋ Nova Internação / Observação"}
        </button>
      </div>

      {mensagemSucesso && <div style={{ backgroundColor: "#dcfce7", color: "#166534", padding: "12px 16px", borderRadius: "8px", marginBottom: "15px", border: "1px solid #bbf7d0" }}>{mensagemSucesso}</div>}
      {mensagemErro && <div style={{ backgroundColor: "#fee2e2", color: "#991b1b", padding: "12px 16px", borderRadius: "8px", marginBottom: "15px", border: "1px solid #fecaca" }}>{mensagemErro}</div>}

      {/* FORMULÁRIO DE NOVA INTERNAÇÃO */}
      {mostrarForm && (
        <form onSubmit={salvarInternacao} style={{ backgroundColor: "white", padding: "24px", borderRadius: "12px", marginBottom: "25px", border: "1px solid #e5e7eb" }}>
          <h3 style={{ margin: "0 0 16px 0", color: "#111827" }}>🏥 Internar ou Alocar em Observação</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>Paciente *</label>
              <select required value={animalId} onChange={(e) => setAnimalId(e.target.value)} style={{ width: "100%", height: "40px", padding: "0 12px", border: "1px solid #d1d5db", borderRadius: "8px" }}>
                <option value="">
                  {animais.length === 0 ? "Nenhum animal cadastrado no sistema" : "Selecione o Animal"}
                </option>
                {animais.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nome} ({a.especie || 'Pet'} - {a.raca || 'S/R'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>Leito / Espaço Destino (Livres) *</label>
              <select required value={leito} onChange={(e) => setLeito(e.target.value)} style={{ width: "100%", height: "40px", padding: "0 12px", border: "1px solid #d1d5db", borderRadius: "8px" }}>
                {leitosDisponiveis.length === 0 ? (
                  <option value="">Nenhum leito disponível no momento</option>
                ) : (
                  leitosDisponiveis.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>Nível de Criticidade *</label>
              <select value={nivelCriticidade} onChange={(e) => setNivelCriticidade(e.target.value)} style={{ width: "100%", height: "40px", padding: "0 12px", border: "1px solid #d1d5db", borderRadius: "8px" }}>
                <option value="ESTAVEL">🟢 Estável</option>
                <option value="MODERADO">⚠️ Moderado</option>
                <option value="CRITICO">🚨 Crítico / UTI</option>
              </select>
            </div>
          </div>

          <div style={{ marginTop: "16px" }}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>Motivo da Internação / Observação / Diagnóstico *</label>
            <input type="text" required placeholder="Ex: Observação pós-aquisição / Fluidoterapia contínua / Pós-operatório" value={motivo} onChange={(e) => setMotivo(e.target.value)} style={{ width: "100%", height: "40px", padding: "0 12px", border: "1px solid #d1d5db", borderRadius: "8px" }} />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "20px" }}>
            <button type="button" onClick={() => setMostrarForm(false)} style={{ backgroundColor: "#f3f4f6", border: "none", padding: "10px 20px", borderRadius: "8px", cursor: "pointer" }}>Cancelar</button>
            <button type="submit" style={{ backgroundColor: "#16a34a", color: "white", border: "none", padding: "10px 24px", borderRadius: "8px", cursor: "pointer", fontWeight: "600" }}>Confirmar Alocação</button>
          </div>
        </form>
      )}

      {/* GRID KANBAN DE LEITOS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "20px" }}>
        {leitosPadrao.map((nomeLeito) => {
          const ocupacao = internacoes.find((i) => i.leito === nomeLeito);

          return (
            <div
              key={nomeLeito}
              style={{
                backgroundColor: ocupacao ? "#ffffff" : "#f9fafb",
                border: ocupacao ? "2px solid #6366f1" : "1px dashed #cbd5e1",
                borderRadius: "12px",
                padding: "18px",
                boxShadow: ocupacao ? "0 4px 6px -1px rgba(0, 0, 0, 0.05)" : "none",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                minHeight: "220px"
              }}
            >
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                  <span style={{ fontWeight: "700", color: "#334155", fontSize: "15px", display: "flex", alignItems: "center", gap: "6px" }}>
                    {nomeLeito.includes("Observação") || nomeLeito.includes("Box") ? "👁️" : "🏠"} {nomeLeito}
                  </span>
                  {ocupacao ? (
                    getBadgeCriticidade(ocupacao.nivel_criticidade)
                  ) : (
                    <span style={{ fontSize: "11px", backgroundColor: "#f1f5f9", color: "#64748b", padding: "2px 8px", borderRadius: "12px", fontWeight: "600" }}>LIVRE</span>
                  )}
                </div>

                {ocupacao ? (
                  <div>
                    <h3 style={{ margin: "0 0 4px 0", color: "#1e1b4b", fontSize: "18px" }}>
                      🐾 {ocupacao.animal_nome}
                    </h3>
                    <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "10px" }}>
                      {ocupacao.animal_codigo} • {ocupacao.animal_especie}
                    </div>
                    <div style={{ fontSize: "13px", color: "#334155", backgroundColor: "#f8fafc", padding: "8px 10px", borderRadius: "6px", border: "1px solid #e2e8f0", marginBottom: "12px" }}>
                      <strong>Motivo:</strong> {ocupacao.motivo}
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: "center", padding: "30px 0", color: "#94a3b8", fontSize: "13px" }}>
                    Espaço desocupado e higienizado
                  </div>
                )}
              </div>

              {ocupacao && (
                <div style={{ marginTop: "16px", paddingTop: "12px", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", gap: "4px" }}>
                  <button
                    onClick={() => abrirModalEvolucao(ocupacao)}
                    style={{ backgroundColor: "#e0e7ff", color: "#3730a3", border: "none", padding: "6px 8px", borderRadius: "6px", cursor: "pointer", fontWeight: "700", fontSize: "11px", display: "flex", alignItems: "center", gap: "4px" }}
                  >
                    <MdShowChart size={14} /> Evoluir
                  </button>

                  <button
                    onClick={() => abrirBoletim(ocupacao.id)}
                    style={{ backgroundColor: "#25d366", color: "white", border: "none", padding: "6px 8px", borderRadius: "6px", cursor: "pointer", fontWeight: "700", fontSize: "11px", display: "flex", alignItems: "center", gap: "4px" }}
                  >
                    <MdSend size={14} /> Boletim
                  </button>

                  {podeDarAlta && (
                    <button
                      onClick={() => solicitarAlta(ocupacao.id, ocupacao.animal_nome)}
                      style={{ backgroundColor: "#dcfce7", color: "#15803d", border: "1px solid #bbf7d0", padding: "6px 8px", borderRadius: "6px", cursor: "pointer", fontWeight: "700", fontSize: "11px", display: "flex", alignItems: "center", gap: "4px" }}
                    >
                      <MdCheckCircle size={14} /> Alta
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* MODAL DE FICHA DE EVOLUÇÃO CLÍNICA & SINAIS VITAIS */}
      {modalEvolucao && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: "20px" }}>
          <div style={{ backgroundColor: "white", padding: "28px", borderRadius: "16px", maxWidth: "800px", width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e5e7eb", paddingBottom: "12px", marginBottom: "20px" }}>
              <h2 style={{ margin: 0, color: "#1e1b4b", fontSize: "20px" }}>
                🩺 Ficha de Evolução Clínica — {modalEvolucao.animal_nome} ({modalEvolucao.leito})
              </h2>
              <button onClick={() => setModalEvolucao(null)} style={{ border: "none", backgroundColor: "transparent", cursor: "pointer" }}>
                <MdClose size={24} color="#6b7280" />
              </button>
            </div>

            <form onSubmit={salvarEvolucao} style={{ backgroundColor: "#f8fafc", padding: "18px", borderRadius: "12px", border: "1px solid #e2e8f0", marginBottom: "24px" }}>
              <h4 style={{ margin: "0 0 12px 0", color: "#334155", fontSize: "15px" }}>⏱️ Novo Registro de Sinais Vitais</h4>
              
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600" }}>Temp (°C)</label>
                  <input type="number" step="0.1" placeholder="Ex: 38.5" value={temperatura} onChange={(e) => setTemperatura(e.target.value)} style={{ width: "100%", height: "36px", padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: "6px" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600" }}>FC (bpm)</label>
                  <input type="number" placeholder="Ex: 110" value={freqCardiaca} onChange={(e) => setFreqCardiaca(e.target.value)} style={{ width: "100%", height: "36px", padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: "6px" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600" }}>FR (mpm)</label>
                  <input type="number" placeholder="Ex: 24" value={freqRespiratoria} onChange={(e) => setFreqRespiratoria(e.target.value)} style={{ width: "100%", height: "36px", padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: "6px" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600" }}>TPC (seg)</label>
                  <input type="number" step="0.5" placeholder="Ex: 2" value={tpcSegundos} onChange={(e) => setTpcSegundos(e.target.value)} style={{ width: "100%", height: "36px", padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: "6px" }} />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", marginTop: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600" }}>Mucosa</label>
                  <select value={mucosa} onChange={(e) => setMucosa(e.target.value)} style={{ width: "100%", height: "36px", padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: "6px" }}>
                    <option value="Normocorada">Normocorada</option>
                    <option value="Pálida">Pálida</option>
                    <option value="Hiporcorada">Hiporcorada</option>
                    <option value="Cianótica">Cianótica</option>
                    <option value="Ictérica">Ictérica</option>
                    <option value="Congesta">Congesta</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600" }}>Alimentação / Ingesta</label>
                  <select value={alimentacao} onChange={(e) => setAlimentacao(e.target.value)} style={{ width: "100%", height: "36px", padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: "6px" }}>
                    <option value="Voluntária (Aceitou)">Voluntária (Aceitou)</option>
                    <option value="Assistida (Forçada)">Assistida (Forçada)</option>
                    <option value="Anorexia (Recusou)">Anorexia (Recusou)</option>
                    <option value="Jejum Pré-Operatório">Jejum Pré-Operatório</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600" }}>Dejeções / Urina</label>
                  <select value={dejecoes} onChange={(e) => setDejecoes(e.target.value)} style={{ width: "100%", height: "36px", padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: "6px" }}>
                    <option value="Normais">Normais</option>
                    <option value="Diarreia">Diarreia / Fezes amolecidas</option>
                    <option value="Emese / Vômito">Emese / Vômito</option>
                    <option value="Anúria / Sem urina">Anúria / Sem urina</option>
                  </select>
                </div>
              </div>

              <div style={{ marginTop: "12px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "600" }}>Observações do Plantão</label>
                <input type="text" placeholder="Ex: Paciente calmo, mantido sob fluido de 50ml/h. Sem queixas." value={observacoes} onChange={(e) => setObservacoes(e.target.value)} style={{ width: "100%", height: "36px", padding: "0 8px", border: "1px solid #cbd5e1", borderRadius: "6px" }} />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "14px" }}>
                <button type="submit" style={{ backgroundColor: "#4f46e5", color: "white", border: "none", padding: "8px 16px", borderRadius: "6px", cursor: "pointer", fontWeight: "600", fontSize: "13px" }}>
                  ＋ Registrar Parâmetros
                </button>
              </div>
            </form>

            <h4 style={{ margin: "0 0 12px 0", color: "#1e1b4b", display: "flex", alignItems: "center", gap: "6px" }}>
              <MdHistory size={20} /> Histórico de Evoluções do Espaço
            </h4>

            <div style={{ maxHeight: "250px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px" }}>
              {historicoEvolucoes.length > 0 ? (
                historicoEvolucoes.map((ev) => (
                  <div key={ev.id} style={{ backgroundColor: "#ffffff", padding: "12px", borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "13px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", color: "#6b7280", fontSize: "11px", marginBottom: "6px", fontWeight: "600" }}>
                      <span>🕒 {new Date(ev.data_registro).toLocaleString("pt-BR")}</span>
                    </div>
                    <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", fontWeight: "600", color: "#1e293b" }}>
                      {ev.temperatura && <span>🌡️ Temp: {ev.temperatura} °C</span>}
                      {ev.freq_cardiaca && <span>❤️ FC: {ev.freq_cardiaca} bpm</span>}
                      {ev.freq_respiratoria && <span>🫁 FR: {ev.freq_respiratoria} mpm</span>}
                      {ev.tpc_segundos && <span>⏱️ TPC: {ev.tpc_segundos}s</span>}
                      {ev.mucosa && <span>👄 Mucosa: {ev.mucosa}</span>}
                    </div>
                    {(ev.alimentacao || ev.dejecoes) && (
                      <div style={{ marginTop: "6px", color: "#475569", fontSize: "12px" }}>
                        🥣 <strong>Ingesta:</strong> {ev.alimentacao} | 🚽 <strong>Eliminações:</strong> {ev.dejecoes}
                      </div>
                    )}
                    {ev.observacoes && (
                      <div style={{ marginTop: "6px", backgroundColor: "#f1f5f9", padding: "6px 8px", borderRadius: "4px", color: "#334155", fontSize: "12px" }}>
                        📌 {ev.observacoes}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div style={{ textAlign: "center", padding: "20px", color: "#94a3b8", fontSize: "13px" }}>
                  Nenhuma evolução registrada para este paciente ainda.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DO BOLETIM DIÁRIO (WHATSAPP & PDF) */}
      {boletimDados && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(0, 0, 0, 0.5)", backdropFilter: "blur(3px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: "20px" }}>
          <div style={{ backgroundColor: "white", padding: "28px", borderRadius: "16px", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)", maxWidth: "600px", width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #25d366", paddingBottom: "12px", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, color: "#111827", fontSize: "18px", display: "flex", alignItems: "center", gap: "8px" }}>
                📲 Boletim Diário de Acompanhamento
              </h3>
              <span style={{ fontSize: "12px", color: "#6b7280" }}>{boletimDados.animal?.nome}</span>
            </div>

            <div style={{ backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", padding: "16px", borderRadius: "10px", whiteSpace: "pre-wrap", fontFamily: "monospace", fontSize: "13px", color: "#166534", marginBottom: "20px", maxHeight: "320px", overflowY: "auto" }}>
              {boletimDados.texto_whatsapp}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={copiarTextoWhatsApp} style={{ backgroundColor: copiado ? "#15803d" : "#16a34a", color: "white", border: "none", padding: "10px 14px", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "13px", display: "flex", alignItems: "center", gap: "4px" }}>
                  <MdContentCopy size={16} /> {copiado ? "✓ Copiado!" : "Copiar Texto"}
                </button>
                <button onClick={enviarWhatsAppDireto} style={{ backgroundColor: "#25d366", color: "white", border: "none", padding: "10px 14px", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "13px", display: "flex", alignItems: "center", gap: "4px" }}>
                  <MdSend size={16} /> Abrir WhatsApp
                </button>
              </div>

              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={imprimirBoletim} style={{ backgroundColor: "#4f46e5", color: "white", border: "none", padding: "10px 14px", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "13px", display: "flex", alignItems: "center", gap: "4px" }}>
                  <MdPrint size={16} /> PDF / Imprimir
                </button>
                <button onClick={() => setBoletimDados(null)} style={{ backgroundColor: "#f3f4f6", color: "#374151", border: "none", padding: "10px 14px", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "13px" }}>
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE ALTA AMIGÁVEL */}
      {altaParaConfirmar && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(0, 0, 0, 0.4)", backdropFilter: "blur(2px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
          <div style={{ backgroundColor: "white", padding: "28px", borderRadius: "16px", textAlign: "center", maxWidth: "420px", width: "90%", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)", border: "1px solid #e5e7eb" }}>
            <div style={{ fontSize: "42px", marginBottom: "8px" }}>🎉</div>
            <h3 style={{ marginTop: 0, color: "#111827", fontSize: "18px", fontWeight: "600" }}>Confirmar Alta / Liberação</h3>
            <p style={{ color: "#4b5563", fontSize: "14px", lineHeight: "1.5", marginBottom: "24px" }}>
              Deseja realmente conceder alta para o paciente <strong>{altaParaConfirmar.nome}</strong>? O espaço será liberado imediatamente.
            </p>
            <div style={{ display: "flex", justifyContent: "center", gap: "12px" }}>
              <button 
                onClick={() => setAltaParaConfirmar(null)} 
                style={{ backgroundColor: "#f3f4f6", color: "#374151", border: "none", padding: "10px 18px", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "14px" }}
              >
                Voltar
              </button>
              <button 
                onClick={confirmarAlta} 
                style={{ backgroundColor: "#16a34a", color: "white", border: "none", padding: "10px 20px", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "14px", boxShadow: "0 2px 4px rgba(22, 163, 74, 0.2)" }}
              >
                Sim, Dar Alta
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

export default Internacao;