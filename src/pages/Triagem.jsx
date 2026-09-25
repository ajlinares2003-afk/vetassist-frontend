import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  MdMedicalServices, 
  MdAutoAwesome,
  MdRefresh,
  MdAddCircle,
  MdClose,
  MdVaccines
} from "react-icons/md";
import api from "../api/api";
import Layout from "../components/Layout";

const CORES_MANCHESTER = {
  VERMELHO: { nome: "Emergência", bg: "#fee2e2", text: "#991b1b", border: "#fca5a5", badge: "🔴 0 min" },
  LARANJA: { nome: "Muito Urgente", bg: "#ffedd5", text: "#c2410c", border: "#fdba74", badge: "🟠 10 min" },
  AMARELO: { nome: "Urgente", bg: "#fef9c3", text: "#a16207", border: "#fde047", badge: "🟡 60 min" },
  VERDE: { nome: "Pouco Urgente", bg: "#dcfce7", text: "#15803d", border: "#86efac", badge: "🟢 120 min" },
  AZUL: { nome: "Não Urgente", bg: "#e0f2fe", text: "#0369a1", border: "#7dd3fc", badge: "🔵 240 min" },
};

function Triagem() {
  const navigate = useNavigate();

  const [atendimentosPendentes, setAtendimentosPendentes] = useState([]);
  const [animais, setAnimais] = useState([]);
  const [atendimentoSelecionado, setAtendimentoSelecionado] = useState(null);
  const [mostrarModalNovoCheckin, setMostrarModalNovoCheckin] = useState(false);

  // Form de sinais vitais / Check-in
  const [animalIdDireto, setAnimalIdDireto] = useState("");
  const [peso, setPeso] = useState("");
  const [temperatura, setTemperatura] = useState("");
  const [frequenciaCardiaca, setFrequenciaCardiaca] = useState("");
  const [frequenciaRespiratoria, setFrequenciaRespiratoria] = useState("");
  const [tpcSegundos, setTpcSegundos] = useState("");
  const [mucosas, setMucosas] = useState("Normocoradas");
  const [desidratacao, setDesidratacao] = useState("");
  const [queixaPrincipal, setQueixaPrincipal] = useState("");
  const [classificacaoRisco, setClassificacaoRisco] = useState("VERDE");
  const [justificativa, setJustificativa] = useState("");

  const [mensagem, setMensagem] = useState({ tipo: "", texto: "" });
  const [carregando, setCarregando] = useState(false);
  const [atualizandoSilencioso, setAtualizandoSilencioso] = useState(false);

  useEffect(() => {
    carregarDados(true);

    const intervalo = setInterval(() => {
      carregarDados(false);
    }, 5000);

    return () => clearInterval(intervalo);
  }, []);

  useEffect(() => {
    if (atendimentoSelecionado || animalIdDireto) {
      sugerirClassificacaoLocal();
    }
  }, [temperatura, frequenciaCardiaca, frequenciaRespiratoria, tpcSegundos, mucosas]);

  const carregarDados = async (loaderPrincipal = false) => {
    if (loaderPrincipal) {
      setCarregando(true);
    } else {
      setAtualizandoSilencioso(true);
    }

    try {
      const token = localStorage.getItem("token");
      if (!token) return navigate("/");

      const config = { headers: { Authorization: `Bearer ${token}` } };

      const [resFila, resAnimais] = await Promise.all([
        api.get("/triagem/fila-triagem", config),
        api.get("/animais/", config),
      ]);

      setAnimais(resAnimais.data || []);
      setAtendimentosPendentes(resFila.data || []);
    } catch (err) {
      console.error("Erro ao carregar fila de triagem:", err);
    } finally {
      setCarregando(false);
      setAtualizandoSilencioso(false);
    }
  };

  const obterNomeAnimal = (animalId) => {
    const a = animais.find((item) => item.id === animalId);
    return a ? `${a.nome} (${a.codigo || `PET-${a.id}`})` : `-`;
  };

  const limparFormulario = () => {
    setAnimalIdDireto("");
    setPeso("");
    setTemperatura("");
    setFrequenciaCardiaca("");
    setFrequenciaRespiratoria("");
    setTpcSegundos("");
    setMucosas("Normocoradas");
    setDesidratacao("");
    setQueixaPrincipal("");
    setClassificacaoRisco("VERDE");
    setJustificativa("");
  };

  const selecionarParaTriagem = async (consulta) => {
    setAtendimentoSelecionado(consulta);
    setQueixaPrincipal(consulta.queixa_principal || "");
    setPeso(consulta.peso_atendimento || "");
    setTemperatura(consulta.temperatura || "");
    setFrequenciaCardiaca(consulta.frequencia_cardiaca || "");
    setFrequenciaRespiratoria(consulta.frequencia_respiratoria || "");

    // Atualiza o status para "Em Triagem" para disparar a chamada no Painel da TV
    try {
      const token = localStorage.getItem("token");
      await api.put(
        `/consultas/${consulta.id}`,
        { ...consulta, status: "Em Triagem" },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (err) {
      console.warn("Aviso ao atualizar status para Em Triagem:", err);
    }
  };

  const sugerirClassificacaoLocal = () => {
    const temp = parseFloat(temperatura);
    const fc = parseInt(frequenciaCardiaca);
    const fr = parseInt(frequenciaRespiratoria);
    const tpc = parseInt(tpcSegundos);

    if (temp > 40.5 || temp < 37.0 || fc > 220 || mucosas === "Cianóticas" || tpc > 3) {
      setClassificacaoRisco("VERMELHO");
      setJustificativa("Alteração severa de parâmetros vitais ou perfusão (Emergência imediata).");
    } else if (temp >= 39.8 || temp <= 37.5 || fc > 180 || mucosas === "Hipocoradas / Pálidas") {
      setClassificacaoRisco("LARANJA");
      setJustificativa("Sinais vitais alterados com risco de descompensação.");
    } else if (temp >= 39.3 || fc > 160) {
      setClassificacaoRisco("AMARELO");
      setJustificativa("Parâmetros moderadamente alterados.");
    } else {
      setClassificacaoRisco("VERDE");
      setJustificativa("Sinais vitais, TPC e coloração de mucosas normais para a espécie.");
    }
  };

  const sugerirClassificacaoIA = async () => {
    try {
      const token = localStorage.getItem("token");
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      const animalAlvo = atendimentoSelecionado 
        ? animais.find(a => a.id === atendimentoSelecionado.animal_id)
        : animais.find(a => a.id === Number(animalIdDireto));

      const payloadIA = {
        animal_id: animalAlvo?.id || null,
        especie: animalAlvo?.especie || "Felino",
        queixa_principal: queixaPrincipal || "Consulta de rotina",
        temperatura: temperatura ? parseFloat(temperatura) : null,
        frequencia_cardiaca: frequenciaCardiaca ? parseInt(frequenciaCardiaca) : null,
        frequencia_respiratoria: frequenciaRespiratoria ? parseInt(frequenciaRespiratoria) : null,
        tpc_segundos: tpcSegundos ? parseInt(tpcSegundos) : null,
        mucosas: mucosas || "Normocoradas"
      };

      const res = await api.post("/triagem/avaliar-ia", payloadIA, config);
      if (res.data && res.data.classificacao_risco) {
        setClassificacaoRisco(res.data.classificacao_risco);
        setJustificativa(res.data.justificativa || "");
        return;
      }
    } catch (err) {
      console.warn("Aviso ao consultar IA na Triagem, mantendo avaliação local:", err);
    }
    sugerirClassificacaoLocal();
  };

  const salvarTriagemExistente = async () => {
    if (!queixaPrincipal) {
      setMensagem({ tipo: "erro", texto: "Informe a queixa principal do paciente." });
      return;
    }

    try {
      setCarregando(true);
      const token = localStorage.getItem("token");
      const config = { headers: { Authorization: `Bearer ${token}` } };

      const animalIdAlvo = atendimentoSelecionado.animal_id;

      if (animalIdAlvo && peso !== "" && peso !== null) {
        const animalEncontrado = animais.find((a) => a.id === Number(animalIdAlvo));
        if (animalEncontrado) {
          try {
            await api.put(
              `/animais/${animalIdAlvo}`,
              { ...animalEncontrado, peso: parseFloat(peso) },
              config
            );
          } catch (errAnimal) {
            console.warn("Aviso ao atualizar peso oficial do animal na triagem:", errAnimal);
          }
        }
      }

      const payload = {
        consulta_id: atendimentoSelecionado.id,
        peso: peso ? parseFloat(peso) : null,
        temperatura: temperatura ? parseFloat(temperatura) : null,
        frequencia_cardiaca: frequenciaCardiaca ? parseInt(frequenciaCardiaca) : null,
        frequencia_respiratoria: frequenciaRespiratoria ? parseInt(frequenciaRespiratoria) : null,
        tpc_segundos: tpcSegundos ? parseInt(tpcSegundos) : null,
        mucosas: mucosas || "Normocoradas",
        desidratacao_percentual: desidratacao ? parseInt(desidratacao) : null,
        queixa_principal: queixaPrincipal,
        classificacao_risco: classificacaoRisco,
        justificativa_risco: justificativa,
      };

      await api.post("/triagem/", payload, config);

      setMensagem({ tipo: "sucesso", texto: "✅ Triagem concluída e cadastro atualizado com sucesso!" });
      setAtendimentoSelecionado(null);
      limparFormulario();
      carregarDados(true);
    } catch (err) {
      setMensagem({ tipo: "erro", texto: `❌ ${err.response?.data?.detail || "Erro ao salvar triagem."}` });
    } finally {
      setCarregando(false);
    }
  };

  const salvarCheckinETriagemDireta = async (e) => {
    e.preventDefault();
    if (!animalIdDireto || !queixaPrincipal) {
      setMensagem({ tipo: "erro", texto: "Selecione o paciente e informe a queixa principal." });
      return;
    }

    try {
      setCarregando(true);
      const token = localStorage.getItem("token");
      const config = { headers: { Authorization: `Bearer ${token}` } };

      if (animalIdDireto && peso !== "" && peso !== null) {
        const animalEncontrado = animais.find((a) => a.id === Number(animalIdDireto));
        if (animalEncontrado) {
          try {
            await api.put(
              `/animais/${animalIdDireto}`,
              { ...animalEncontrado, peso: parseFloat(peso) },
              config
            );
          } catch (errAnimal) {
            console.warn("Aviso ao atualizar peso oficial do animal no check-in direto:", errAnimal);
          }
        }
      }

      const payload = {
        animal_id: Number(animalIdDireto),
        queixa_principal: queixaPrincipal,
        classificacao_risco: classificacaoRisco,
        peso: peso ? parseFloat(peso) : null,
        temperatura: temperatura ? parseFloat(temperatura) : null,
        frequencia_cardiaca: frequenciaCardiaca ? parseInt(frequenciaCardiaca) : null,
        frequencia_respiratoria: frequenciaRespiratoria ? parseInt(frequenciaRespiratoria) : null,
        tpc_segundos: tpcSegundos ? parseInt(tpcSegundos) : null,
        mucosas: mucosas || "Normocoradas",
        desidratacao_percentual: desidratacao ? parseInt(desidratacao) : null,
        justificativa_risco: justificativa,
      };

      await api.post("/triagem/checkin-direto", payload, config);

      setMensagem({ tipo: "sucesso", texto: "✅ Check-in, Triagem e cadastro realizados com sucesso!" });
      setMostrarModalNovoCheckin(false);
      limparFormulario();
      carregarDados(true);
    } catch (err) {
      setMensagem({ tipo: "erro", texto: `❌ ${err.response?.data?.detail || "Erro ao registrar Check-in Direto."}` });
    } finally {
      setCarregando(false);
    }
  };

  return (
    <Layout>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: "12px", margin: 0, fontSize: "26px", color: "#1e1b4b" }}>
            <MdMedicalServices color="#dc2626" size={38} />
            Check-in & Triagem (Protocolo Manchester)
          </h1>
          <p style={{ color: "#6b7280", margin: "6px 0 0 0", fontSize: "14px" }}>
            Recepção, entrada de pacientes e classificação de urgência clínica.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {atualizandoSilencioso && (
            <span style={{ fontSize: "12px", color: "#6366f1", fontWeight: "500" }}>Syncing...</span>
          )}
          <button
            onClick={() => carregarDados(true)}
            style={{ display: "flex", alignItems: "center", gap: "6px", backgroundColor: "#ffffff", border: "1px solid #d1d5db", padding: "8px 14px", borderRadius: "8px", cursor: "pointer", fontWeight: "600", color: "#374151", fontSize: "13px" }}
          >
            <MdRefresh size={18} /> Atualizar
          </button>

          <button
            onClick={() => {
              limparFormulario();
              setMostrarModalNovoCheckin(true);
            }}
            style={{ display: "flex", alignItems: "center", gap: "6px", backgroundColor: "#4f46e5", color: "white", border: "none", padding: "8px 16px", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "13px" }}
          >
            <MdAddCircle size={18} /> Novo Check-in & Triagem
          </button>
        </div>
      </div>

      {mensagem.texto && (
        <div style={{ padding: "12px 16px", borderRadius: "8px", marginBottom: "16px", backgroundColor: mensagem.tipo === "sucesso" ? "#dcfce7" : "#fee2e2", color: mensagem.tipo === "sucesso" ? "#166534" : "#991b1b", fontWeight: "600" }}>
          {mensagem.texto}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: atendimentoSelecionado ? "1fr 1.2fr" : "1fr", gap: "20px" }}>
        <div style={{ backgroundColor: "white", padding: "20px", borderRadius: "12px", border: "1px solid #e5e7eb" }}>
          <h3 style={{ marginTop: 0, color: "#111827", fontSize: "16px" }}>
            📋 Fila de Check-in para Triagem ({atendimentosPendentes.length} aguardando)
          </h3>

          {atendimentosPendentes.length === 0 ? (
            <p style={{ color: "#9ca3af", fontSize: "14px", textAlign: "center", padding: "30px 0", fontStyle: "italic" }}>
              Nenhum paciente aguardando triagem. Clique em <strong>"Novo Check-in & Triagem"</strong> para dar entrada direta num paciente!
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {atendimentosPendentes.map((item) => {
                const ehVacina = item.status === "AGUARDANDO_VACINA" || item.status === "Aguardando Vacina";
                return (
                  <div
                    key={item.id}
                    onClick={() => selecionarParaTriagem(item)}
                    style={{
                      padding: "14px",
                      borderRadius: "8px",
                      border: atendimentoSelecionado?.id === item.id ? "2px solid #4f46e5" : ehVacina ? "1px solid #ccfbf1" : "1px solid #e5e7eb",
                      backgroundColor: atendimentoSelecionado?.id === item.id ? "#f5f3ff" : ehVacina ? "#f0fdf4" : "#f9fafb",
                      cursor: "pointer",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center"
                    }}
                  >
                    <div>
                      <strong style={{ color: ehVacina ? "#0f766e" : "#1f2937", display: "block", fontSize: "15px" }}>
                        {ehVacina ? "💉 " : "🐾 "} {obterNomeAnimal(item.animal_id)}
                        {ehVacina && <span style={{ fontSize: "11px", backgroundColor: "#ccfbf1", color: "#0f766e", padding: "2px 6px", borderRadius: "4px", marginLeft: "8px" }}>Vacinação</span>}
                      </strong>
                      <span style={{ fontSize: "12px", color: "#6b7280" }}>
                        Check-in: {item.codigo || `CNS-${item.id}`} {item.queixa_principal ? `| Motivo: ${item.queixa_principal}` : ""}
                      </span>
                    </div>
                    <button style={{ backgroundColor: ehVacina ? "#0d9488" : "#4f46e5", color: "white", border: "none", padding: "8px 14px", borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontWeight: "600" }}>
                      Iniciar Triagem
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {atendimentoSelecionado && (
          <div style={{ backgroundColor: "white", padding: "24px", borderRadius: "12px", border: "1px solid #e5e7eb" }}>
            <h3 style={{ marginTop: 0, color: "#111827", fontSize: "18px", borderBottom: "1px solid #f3f4f6", paddingBottom: "10px" }}>
              🩺 Aferição de Sinais Vitais — {obterNomeAnimal(atendimentoSelecionado.animal_id)}
            </h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
              <div>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "#374151" }}>Peso (kg)</label>
                <input type="number" step="0.1" value={peso} onChange={(e) => setPeso(e.target.value)} style={estiloInput} placeholder="Ex: 3.5" />
              </div>
              <div>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "#374151" }}>Temperatura (°C)</label>
                <input type="number" step="0.1" value={temperatura} onChange={(e) => setTemperatura(e.target.value)} style={estiloInput} placeholder="Ex: 38.5" />
              </div>
              <div>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "#374151" }}>FC (bpm)</label>
                <input type="number" value={frequenciaCardiaca} onChange={(e) => setFrequenciaCardiaca(e.target.value)} style={estiloInput} placeholder="Ex: 150" />
              </div>
              <div>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "#374151" }}>FR (mpm)</label>
                <input type="number" value={frequenciaRespiratoria} onChange={(e) => setFrequenciaRespiratoria(e.target.value)} style={estiloInput} placeholder="Ex: 25" />
              </div>
              <div>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "#374151" }}>TPC (segundos)</label>
                <input type="number" value={tpcSegundos} onChange={(e) => setTpcSegundos(e.target.value)} style={estiloInput} placeholder="Ex: 2" />
              </div>
              <div>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "#374151" }}>Mucosas</label>
                <select value={mucosas} onChange={(e) => setMucosas(e.target.value)} style={estiloInput}>
                  <option value="Normocoradas">Normocoradas (Rosadas)</option>
                  <option value="Hipocoradas / Pálidas">Hipocoradas / Pálidas</option>
                  <option value="Cianóticas">Cianóticas (Roxas)</option>
                  <option value="Ictéricas">Ictéricas (Amareladas)</option>
                  <option value="Congestas / Hiperêmicas">Congestas / Vermelhas</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ fontSize: "12px", fontWeight: "600", color: "#374151" }}>Queixa Principal *</label>
              <textarea rows={2} value={queixaPrincipal} onChange={(e) => setQueixaPrincipal(e.target.value)} style={{ ...estiloInput, height: "auto", padding: "8px" }} placeholder="Relato do tutor..." />
            </div>

            <div style={{ marginBottom: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <label style={{ fontSize: "13px", fontWeight: "700", color: "#111827" }}>Nível de Urgência (Manchester)</label>
                <button type="button" onClick={sugerirClassificacaoIA} style={{ backgroundColor: "#f0f9ff", color: "#0284c7", border: "1px solid #bae6fd", padding: "4px 8px", borderRadius: "6px", cursor: "pointer", fontSize: "11px", fontWeight: "600", display: "flex", alignItems: "center", gap: "4px" }}>
                  <MdAutoAwesome /> Avaliar com IA
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "6px" }}>
                {Object.keys(CORES_MANCHESTER).map((cor) => {
                  const item = CORES_MANCHESTER[cor];
                  const selecionado = classificacaoRisco === cor;
                  return (
                    <button
                      key={cor}
                      type="button"
                      onClick={() => setClassificacaoRisco(cor)}
                      style={{
                        padding: "8px 4px",
                        borderRadius: "6px",
                        border: selecionado ? `2px solid ${item.text}` : "1px solid #d1d5db",
                        backgroundColor: selecionado ? item.bg : "#ffffff",
                        color: item.text,
                        fontWeight: "700",
                        fontSize: "11px",
                        cursor: "pointer",
                        textAlign: "center"
                      }}
                    >
                      {item.nome}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button onClick={() => setAtendimentoSelecionado(null)} style={{ backgroundColor: "#f3f4f6", border: "none", padding: "10px 16px", borderRadius: "8px", cursor: "pointer", fontWeight: "600" }}>
                Cancelar
              </button>
              <button onClick={salvarTriagemExistente} disabled={carregando} style={{ backgroundColor: "#16a34a", color: "white", border: "none", padding: "10px 20px", borderRadius: "8px", cursor: "pointer", fontWeight: "600" }}>
                {carregando ? "Enviando..." : "Finalizar Triagem"}
              </button>
            </div>
          </div>
        )}
      </div>

      {mostrarModalNovoCheckin && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(3px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: "20px" }}>
          <div style={{ backgroundColor: "white", padding: "28px", borderRadius: "16px", maxWidth: "600px", width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e5e7eb", paddingBottom: "12px", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, color: "#111827", fontSize: "18px" }}>
                🏥 Novo Check-in & Triagem Direta
              </h3>
              <button onClick={() => setMostrarModalNovoCheckin(false)} style={{ border: "none", background: "transparent", cursor: "pointer" }}>
                <MdClose size={22} color="#6b7280" />
              </button>
            </div>

            <form onSubmit={salvarCheckinETriagemDireta}>
              <div style={{ marginBottom: "14px" }}>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "#374151", display: "block", marginBottom: "4px" }}>Paciente *</label>
                <select value={animalIdDireto} onChange={(e) => setAnimalIdDireto(e.target.value)} required style={estiloInput}>
                  <option value="">Selecione o paciente cadastrado...</option>
                  {animais.map((a) => (
                    <option key={a.id} value={a.id}>{a.nome} ({a.especie || 'Pet'} - {a.codigo || `PET-${a.id}`})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "600", color: "#374151" }}>Peso (kg)</label>
                  <input type="number" step="0.1" value={peso} onChange={(e) => setPeso(e.target.value)} style={estiloInput} placeholder="Ex: 3.5" />
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "600", color: "#374151" }}>Temperatura (°C)</label>
                  <input type="number" step="0.1" value={temperatura} onChange={(e) => setTemperatura(e.target.value)} style={estiloInput} placeholder="Ex: 38.5" />
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "600", color: "#374151" }}>FC (bpm)</label>
                  <input type="number" value={frequenciaCardiaca} onChange={(e) => setFrequenciaCardiaca(e.target.value)} style={estiloInput} placeholder="Ex: 150" />
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "600", color: "#374151" }}>FR (mpm)</label>
                  <input type="number" value={frequenciaRespiratoria} onChange={(e) => setFrequenciaRespiratoria(e.target.value)} style={estiloInput} placeholder="Ex: 25" />
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "600", color: "#374151" }}>TPC (segundos)</label>
                  <input type="number" value={tpcSegundos} onChange={(e) => setTpcSegundos(e.target.value)} style={estiloInput} placeholder="Ex: 2" />
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "600", color: "#374151" }}>Mucosas</label>
                  <select value={mucosas} onChange={(e) => setMucosas(e.target.value)} style={estiloInput}>
                    <option value="Normocoradas">Normocoradas (Rosadas)</option>
                    <option value="Hipocoradas / Pálidas">Hipocoradas / Pálidas</option>
                    <option value="Cianóticas">Cianóticas (Roxas)</option>
                    <option value="Ictéricas">Ictéricas (Amareladas)</option>
                    <option value="Congestas / Hiperêmicas">Congestas / Vermelhas</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: "14px" }}>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "#374151", display: "block", marginBottom: "4px" }}>Queixa Principal *</label>
                <textarea rows={2} value={queixaPrincipal} onChange={(e) => setQueixaPrincipal(e.target.value)} required style={{ ...estiloInput, height: "auto", padding: "8px" }} placeholder="Relato do tutor..." />
              </div>

              <div style={{ marginBottom: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <label style={{ fontSize: "13px", fontWeight: "700", color: "#111827" }}>Nível de Urgência (Manchester)</label>
                  <button type="button" onClick={sugerirClassificacaoIA} style={{ backgroundColor: "#f0f9ff", color: "#0284c7", border: "1px solid #bae6fd", padding: "4px 8px", borderRadius: "6px", cursor: "pointer", fontSize: "11px", fontWeight: "600", display: "flex", alignItems: "center", gap: "4px" }}>
                    <MdAutoAwesome /> Avaliar IA
                  </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "6px" }}>
                  {Object.keys(CORES_MANCHESTER).map((cor) => {
                    const item = CORES_MANCHESTER[cor];
                    const selecionado = classificacaoRisco === cor;
                    return (
                      <button
                        key={cor}
                        type="button"
                        onClick={() => setClassificacaoRisco(cor)}
                        style={{
                          padding: "8px 4px",
                          borderRadius: "6px",
                          border: selecionado ? `2px solid ${item.text}` : "1px solid #d1d5db",
                          backgroundColor: selecionado ? item.bg : "#ffffff",
                          color: item.text,
                          fontWeight: "700",
                          fontSize: "11px",
                          cursor: "pointer",
                          textAlign: "center"
                        }}
                      >
                        {item.nome}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
                <button type="button" onClick={() => setMostrarModalNovoCheckin(false)} style={{ backgroundColor: "#f3f4f6", border: "none", padding: "10px 16px", borderRadius: "8px", cursor: "pointer", fontWeight: "600" }}>
                  Cancelar
                </button>
                <button type="submit" disabled={carregando} style={{ backgroundColor: "#4f46e5", color: "white", border: "none", padding: "10px 20px", borderRadius: "8px", cursor: "pointer", fontWeight: "600" }}>
                  {carregando ? "Processando..." : "Confirmar Check-in & Triagem"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}

const estiloInput = {
  width: "100%",
  height: "38px",
  padding: "0 10px",
  border: "1px solid #d1d5db",
  borderRadius: "6px",
  fontSize: "13px",
  outline: "none",
  boxSizing: "border-box"
};

export default Triagem;