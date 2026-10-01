import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  MdMedicalServices, 
  MdAutoAwesome,
  MdRefresh,
  MdAddCircle,
  MdClose,
  MdCampaign
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
  const [veterinarios, setVeterinarios] = useState([]);
  const [atendimentoSelecionado, setAtendimentoSelecionado] = useState(null);
  const [mostrarModalNovoCheckin, setMostrarModalNovoCheckin] = useState(false);

  const [animalIdDireto, setAnimalIdDireto] = useState("");
  const [usuarioIdVet, setUsuarioIdVet] = useState(""); 
  const [consultorioAtribuido, setConsultorioAtribuido] = useState(""); 
  const [peso, setPeso] = useState("");
  const [ecc, setEcc] = useState(""); 
  const [temperatura, setTemperatura] = useState("");
  const [frequenciaCardiaca, setFrequenciaCardiaca] = useState("");
  const [frequenciaRespiratoria, setFrequenciaRespiratoria] = useState("");
  const [tpcSegundos, setTpcSegundos] = useState("");
  const [mucosas, setMucosas] = useState("Normocoradas");
  const [desidratacao, setDesidratacao] = useState("");
  const [queixaPrincipal, setQueixaPrincipal] = useState("");
  const [classificacaoRisco, setClassificacaoRisco] = useState("VERDE");
  const [justificativa, setJustificativa] = useState("");

  const [refsDinamicas, setRefsDinamicas] = useState({
    pesoRef: "💡 Ref. Peso: Selecione o paciente...",
    eccRef: "💡 Ideal: 4 a 5 (Escala 1 a 9)",
    temp: "Normal: --",
    fc: "Aguardando paciente...",
    fr: "Aguardando paciente...",
    tpc: "Até 2s",
    mucosasRef: "💡 Normocoradas"
  });

  const [mensagem, setMensagem] = useState({ tipo: "", texto: "" });
  const [carregando, setCarregando] = useState(false);
  const [atualizandoSilencioso, setAtualizandoSilencioso] = useState(false);

  useEffect(() => {
    carregarDados(true);
    const intervalo = setInterval(() => carregarDados(false), 5000);
    return () => clearInterval(intervalo);
  }, []);

  useEffect(() => {
    if (mensagem.texto) {
      const timer = setTimeout(() => setMensagem({ tipo: "", texto: "" }), 4000);
      return () => clearTimeout(timer);
    }
  }, [mensagem]);

  useEffect(() => {
    const buscarReferenciasDaIA = async () => {
      const animalAlvo = atendimentoSelecionado 
        ? animais.find(a => a.id === atendimentoSelecionado.animal_id)
        : animais.find(a => a.id === Number(animalIdDireto));

      if (!animalAlvo) return;

      try {
        const token = localStorage.getItem("token");
        const config = { headers: { Authorization: `Bearer ${token}` } };
        const payload = {
          especie: animalAlvo.especie,
          sub_especie: animalAlvo.sub_especie,
          raca: animalAlvo.raca,
          porte: animalAlvo.porte,
          idade: animalAlvo.idade
        };

        const res = await api.post("/triagem/referencias-ia", payload, config);
        if (res.data) {
          setRefsDinamicas({
            pesoRef: res.data.peso_ref,
            eccRef: res.data.ecc_ref || "💡 Ideal: 4 a 5 (Escala 1 a 9)",
            temp: res.data.temperatura,
            fc: res.data.fc,
            fr: res.data.fr,
            tpc: res.data.tpc,
            mucosasRef: res.data.mucosas
          });
        }
      } catch (err) {
        console.warn("Erro ao buscar referências dinâmicas da IA:", err);
      }
    };
    buscarReferenciasDaIA();
  }, [atendimentoSelecionado, animalIdDireto, animais]);

  useEffect(() => {
    if (!peso || !refsDinamicas.pesoRef) {
      setEcc("");
      return;
    }

    const pesoNum = parseFloat(peso);
    const matches = refsDinamicas.pesoRef.match(/(\d+\.?\d*)\s*-\s*(\d+\.?\d*)/);

    if (matches && !isNaN(pesoNum)) {
      const pesoMin = parseFloat(matches[1]);
      const pesoMax = parseFloat(matches[2]);

      if (pesoNum < pesoMin * 0.85) {
        setEcc("1 a 2 (Muito Magro)");
      } else if (pesoNum >= pesoMin * 0.85 && pesoNum < pesoMin) {
        setEcc("3 (Abaixo do Peso)");
      } else if (pesoNum >= pesoMin && pesoNum <= pesoMax) {
        setEcc("4 a 5 (Ideal)");
      } else if (pesoNum > pesoMax && pesoNum <= pesoMax * 1.20) {
        setEcc("6 a 7 (Sobrepeso)");
      } else {
        setEcc("8 a 9 (Obeso)");
      }
    } else {
      setEcc("Indeterminado");
    }
  }, [peso, refsDinamicas.pesoRef]);

  // Efeito inteligente para estimar o % de desidratação com base no TPC e Mucosas
  useEffect(() => {
    const tpcNum = parseInt(tpcSegundos);
    if (isNaN(tpcNum)) {
      setDesidratacao("");
      return;
    }

    if (tpcNum <= 2 && mucosas === "Normocoradas") {
      setDesidratacao("0");
    } else if (tpcNum === 2 && (mucosas.includes("Hipocoradas") || mucosas.includes("Pálidas"))) {
      setDesidratacao("5");
    } else if (tpcNum === 3 || mucosas.includes("Cianóticas")) {
      setDesidratacao("8");
    } else if (tpcNum >= 4) {
      setDesidratacao("10");
    } else {
      setDesidratacao("5");
    }
  }, [tpcSegundos, mucosas]);

  useEffect(() => {
    if ((atendimentoSelecionado || animalIdDireto) && (temperatura || queixaPrincipal)) {
      const timer = setTimeout(() => sugerirClassificacaoIA(), 500);
      return () => clearTimeout(timer);
    }
  }, [temperatura, frequenciaCardiaca, frequenciaRespiratoria, tpcSegundos, mucosas, queixaPrincipal, animalIdDireto, atendimentoSelecionado]);

  const carregarDados = async (loaderPrincipal = false) => {
    if (loaderPrincipal) setCarregando(true);
    else setAtualizandoSilencioso(true);

    try {
      const token = localStorage.getItem("token");
      if (!token) return navigate("/");
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const [resFila, resAnimais, resUsuarios] = await Promise.all([
        api.get("/consultas/fila-triagem", config),
        api.get("/animais/", config),
        api.get("/usuarios/", config),
      ]);
      setAnimais(resAnimais.data || []);
      setAtendimentosPendentes(resFila.data || []);
      setVeterinarios((resUsuarios.data || []).filter((u) => u.perfil === "VETERINARIO"));
    } catch (err) {
      console.error("Erro ao carregar dados de triagem:", err);
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
    setUsuarioIdVet("");
    setConsultorioAtribuido("");
    setPeso("");
    setEcc("");
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

  const handleVeterinarioChange = (e) => {
    const vetId = e.target.value;
    setUsuarioIdVet(vetId);
    const vetSelecionado = veterinarios.find((v) => v.id === Number(vetId));
    setConsultorioAtribuido(vetSelecionado?.consultorio_padrao || "Consultório 1");
  };

  const chamarPaciente = async (consulta, e) => {
    e.stopPropagation();
    try {
      const token = localStorage.getItem("token");
      await api.put(`/consultas/${consulta.id}/chamar-triagem`, {}, { headers: { Authorization: `Bearer ${token}` } }).catch(async () => {
        await api.put(`/consultas/${consulta.id}`, { status: "Chamando para Triagem" }, { headers: { Authorization: `Bearer ${token}` } });
      });
      setAtendimentosPendentes(prev => prev.map(item => item.id === consulta.id ? { ...item, status: "Chamando para Triagem" } : item));
      setMensagem({ tipo: "sucesso", texto: `📢 Chamando ${obterNomeAnimal(consulta.animal_id)} no painel para Triagem!` });
    } catch (err) {
      setMensagem({ tipo: "erro", texto: "Erro ao emitir chamada para o paciente." });
    }
  };

  const selecionarParaTriagem = async (consulta) => {
    setAtendimentoSelecionado(consulta);
    setQueixaPrincipal(consulta.queixa_principal || "");
    setPeso(consulta.peso_atendimento || "");
    setTemperatura(consulta.temperatura || "");
    setFrequenciaCardiaca(consulta.frequencia_cardiaca || "");
    setFrequenciaRespiratoria(consulta.frequencia_respiratoria || "");
    setUsuarioIdVet(consulta.usuario_id || "");

    const vEncontrado = veterinarios.find(v => v.id === Number(consulta.usuario_id));
    if (vEncontrado?.consultorio_padrao) setConsultorioAtribuido(vEncontrado.consultorio_padrao);

    try {
      const token = localStorage.getItem("token");
      const config = { headers: { Authorization: `Bearer ${token}` } };
      await api.put(`/consultas/${consulta.id}/iniciar-triagem`, {}, config).catch(async () => {
        await api.put(`/consultas/${consulta.id}`, { status: "Em Triagem" }, config);
      });
      setAtendimentosPendentes(prev => prev.map(item => item.id === consulta.id ? { ...item, status: "Em Triagem" } : item));
    } catch (err) {
      console.warn("Aviso ao iniciar triagem:", err);
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
        sub_especie: animalAlvo?.sub_especie || null,
        raca: animalAlvo?.raca || "",
        ecc: ecc,
        queixa_principal: queixaPrincipal || "Consulta de rotina",
        temperatura: temperatura ? parseFloat(temperatura) : null,
        frequencia_cardiaca: frequenciaCardiaca ? parseInt(frequenciaCardiaca) : null,
        frequencia_respiratoria: frequenciaRespiratoria ? parseInt(frequenciaRespiratoria) : null,
        tpc_segundos: tpcSegundos ? parseInt(tpcSegundos) : null,
        mucosas: mucosas || "Normocoradas"
      };

      const res = await api.post("/triagem/avaliar-ia", payloadIA, config);
      if (res.data?.classificacao_risco) {
        setClassificacaoRisco(res.data.classificacao_risco);
        setJustificativa(res.data.justificativa || "");
      }
    } catch (err) {
      console.warn("Aviso ao consultar IA na Triagem:", err);
    }
  };

  const salvarTriagemExistente = async () => {
    if (!queixaPrincipal) return setMensagem({ tipo: "erro", texto: "Informe a queixa principal do paciente." });

    try {
      setCarregando(true);
      const token = localStorage.getItem("token");
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const animalIdAlvo = atendimentoSelecionado.animal_id;

      if (animalIdAlvo && peso !== "" && peso !== null) {
        const animalEncontrado = animais.find((a) => a.id === Number(animalIdAlvo));
        if (animalEncontrado) {
          await api.put(`/animais/${animalIdAlvo}`, { ...animalEncontrado, peso: parseFloat(peso) }, config).catch(() => {});
        }
      }

      const payload = {
        consulta_id: atendimentoSelecionado.id,
        usuario_id: usuarioIdVet ? Number(usuarioIdVet) : null,
        consultorio: consultorioAtribuido || null,
        peso: peso ? parseFloat(peso) : null,
        ecc: ecc,
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
      setMensagem({ tipo: "sucesso", texto: "✅ Triagem concluída com sucesso!" });
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
    if (!animalIdDireto || !queixaPrincipal) return setMensagem({ tipo: "erro", texto: "Selecione o paciente e informe a queixa principal." });

    try {
      setCarregando(true);
      const token = localStorage.getItem("token");
      const config = { headers: { Authorization: `Bearer ${token}` } };

      const payload = {
        animal_id: Number(animalIdDireto),
        usuario_id: usuarioIdVet ? Number(usuarioIdVet) : null,
        consultorio: consultorioAtribuido || null,
        queixa_principal: queixaPrincipal,
        classificacao_risco: classificacaoRisco,
        peso: peso ? parseFloat(peso) : null,
        ecc: ecc,
        temperatura: temperatura ? parseFloat(temperatura) : null,
        frequencia_cardiaca: frequenciaCardiaca ? parseInt(frequenciaCardiaca) : null,
        frequencia_respiratoria: frequenciaRespiratoria ? parseInt(frequenciaRespiratoria) : null,
        tpc_segundos: tpcSegundos ? parseInt(tpcSegundos) : null,
        mucosas: mucosas || "Normocoradas",
        desidratacao_percentual: desidratacao ? parseInt(desidratacao) : null,
        justificativa_risco: justificativa,
      };

      await api.post("/triagem/checkin-direto", payload, config);
      setMensagem({ tipo: "sucesso", texto: "✅ Check-in e Triagem realizados com sucesso!" });
      setMostrarModalNovoCheckin(false);
      limparFormulario();
      carregarDados(true);
    } catch (err) {
      setMensagem({ tipo: "erro", texto: `❌ ${err.response?.data?.detail || "Erro ao registrar Check-in Direto."}` });
    } finally {
      setCarregando(false);
    }
  };

  // Formulário altamente compactado (padding menor e espaçamentos otimizados para evitar rolagem)
  const renderFormularioSinaisVitais = () => (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px", marginBottom: "4px" }}>
        <div>
          <label style={{ fontSize: "11px", fontWeight: "600", color: "#374151" }}>👨‍⚕️ Veterinário Responsável *</label>
          <select value={usuarioIdVet} onChange={handleVeterinarioChange} style={estiloInput} required>
            <option value="">Selecione o médico...</option>
            {veterinarios.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nome || v.email} {v.consultorio_padrao ? `(${v.consultorio_padrao})` : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ fontSize: "11px", fontWeight: "600", color: "#374151" }}>🏥 Consultório Atribuído</label>
          <input 
            type="text" 
            value={consultorioAtribuido} 
            onChange={(e) => setConsultorioAtribuido(e.target.value)} 
            style={{ ...estiloInput, backgroundColor: "#f9fafb", fontWeight: "600", color: "#1e1b4b" }} 
            placeholder="Ex: Consultório 1"
            required 
          />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px", marginBottom: "4px" }}>
        <div>
          <label style={{ fontSize: "11px", fontWeight: "600", color: "#374151" }}>Peso (kg)</label>
          <input type="number" step="0.1" value={peso} onChange={(e) => setPeso(e.target.value)} style={estiloInput} placeholder="Ex: 3.5" />
          <span style={{ fontSize: "9px", color: "#0284c7", display: "block", marginTop: "1px" }}>{refsDinamicas.pesoRef}</span>
        </div>
        <div>
          <label style={{ fontSize: "11px", fontWeight: "600", color: "#374151" }}>ECC (Condição Corporal)</label>
          <input type="text" value={ecc} onChange={(e) => setEcc(e.target.value)} style={{ ...estiloInput, backgroundColor: ecc ? "#f0fdf4" : "white", color: "#166534", fontWeight: "600" }} placeholder="Auto-calculado..." />
          <span style={{ fontSize: "9px", color: "#0284c7", display: "block", marginTop: "1px" }}>{refsDinamicas.eccRef}</span>
        </div>
        <div>
          <label style={{ fontSize: "11px", fontWeight: "600", color: "#374151" }}>Temperatura (°C)</label>
          <input type="number" step="0.1" value={temperatura} onChange={(e) => setTemperatura(e.target.value)} style={estiloInput} placeholder="Ex: 38.5" />
          <span style={{ fontSize: "9px", color: "#0284c7", display: "block", marginTop: "1px" }}>💡 {refsDinamicas.temp}</span>
        </div>
        <div>
          <label style={{ fontSize: "11px", fontWeight: "600", color: "#374151" }}>FC (bpm)</label>
          <input type="number" value={frequenciaCardiaca} onChange={(e) => setFrequenciaCardiaca(e.target.value)} style={estiloInput} placeholder="Ex: 150" />
          <span style={{ fontSize: "9px", color: "#0284c7", display: "block", marginTop: "1px" }}>💡 {refsDinamicas.fc}</span>
        </div>
        <div>
          <label style={{ fontSize: "11px", fontWeight: "600", color: "#374151" }}>FR (mpm)</label>
          <input type="number" value={frequenciaRespiratoria} onChange={(e) => setFrequenciaRespiratoria(e.target.value)} style={estiloInput} placeholder="Ex: 25" />
          <span style={{ fontSize: "9px", color: "#0284c7", display: "block", marginTop: "1px" }}>💡 {refsDinamicas.fr}</span>
        </div>
        <div>
          <label style={{ fontSize: "11px", fontWeight: "600", color: "#374151" }}>TPC (segundos)</label>
          <input type="number" value={tpcSegundos} onChange={(e) => setTpcSegundos(e.target.value)} style={estiloInput} placeholder="Ex: 2" />
          <span style={{ fontSize: "9px", color: "#0284c7", display: "block", marginTop: "1px" }}>💡 {refsDinamicas.tpc}</span>
        </div>
        
        {/* Par simétrico: Mucosas e Desidratação calculada pela IA */}
        <div>
          <label style={{ fontSize: "11px", fontWeight: "600", color: "#374151" }}>Mucosas</label>
          <select value={mucosas} onChange={(e) => setMucosas(e.target.value)} style={estiloInput}>
            <option value="Normocoradas">Normocoradas (Rosadas)</option>
            <option value="Hipocoradas / Pálidas">Hipocoradas / Pálidas</option>
            <option value="Cianóticas">Cianóticas (Roxas)</option>
            <option value="Ictéricas">Ictéricas (Amareladas)</option>
            <option value="Congestas / Hiperêmicas">Congestas / Vermelhas</option>
          </select>
          <span style={{ fontSize: "9px", color: "#0284c7", display: "block", marginTop: "1px" }}>{refsDinamicas.mucosasRef}</span>
        </div>
        <div>
          <label style={{ fontSize: "11px", fontWeight: "600", color: "#374151" }}>Desidratação (%) — IA</label>
          <input type="number" value={desidratacao} onChange={(e) => setDesidratacao(e.target.value)} style={{ ...estiloInput, backgroundColor: "#f0fdf4", color: "#166534", fontWeight: "600" }} placeholder="Auto-calculado..." />
          <span style={{ fontSize: "9px", color: "#0284c7", display: "block", marginTop: "1px" }}>💡 Baseado em TPC e Mucosas</span>
        </div>
      </div>
    </>
  );

  return (
    <Layout>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: "6px", margin: 0, fontSize: "20px", color: "#1e1b4b" }}>
            <MdMedicalServices color="#dc2626" size={24} />
            Check-in & Triagem (Protocolo Manchester)
          </h1>
          <p style={{ color: "#6b7280", margin: "2px 0 0 0", fontSize: "11px" }}>
            Recepção, entrada de pacientes e classificação de urgência clínica.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {atualizandoSilencioso && (
            <span style={{ fontSize: "11px", color: "#6366f1", fontWeight: "500" }}>Sincronizando...</span>
          )}
          <button
            onClick={() => carregarDados(true)}
            style={{ display: "flex", alignItems: "center", gap: "4px", backgroundColor: "#ffffff", border: "1px solid #d1d5db", padding: "4px 8px", borderRadius: "6px", cursor: "pointer", fontWeight: "600", color: "#374151", fontSize: "11px" }}
          >
            <MdRefresh size={13} /> Atualizar
          </button>

          <button
            onClick={() => {
              limparFormulario();
              setMostrarModalNovoCheckin(true);
            }}
            style={{ display: "flex", alignItems: "center", gap: "4px", backgroundColor: "#4f46e5", color: "white", border: "none", padding: "4px 10px", borderRadius: "6px", cursor: "pointer", fontWeight: "600", fontSize: "11px" }}
          >
            <MdAddCircle size={13} /> Novo Check-in & Triagem
          </button>
        </div>
      </div>

      {mensagem.texto && (
        <div style={{ padding: "6px 10px", borderRadius: "6px", marginBottom: "8px", backgroundColor: mensagem.tipo === "sucesso" ? "#dcfce7" : "#fee2e2", color: mensagem.tipo === "sucesso" ? "#166534" : "#991b1b", fontWeight: "600", fontSize: "11px" }}>
          {mensagem.texto}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: atendimentoSelecionado ? "1fr 1.4fr" : "1fr", gap: "12px" }}>
        <div style={{ backgroundColor: "white", padding: "12px", borderRadius: "10px", border: "1px solid #e5e7eb" }}>
          <h3 style={{ marginTop: 0, color: "#111827", fontSize: "14px", marginBottom: "8px" }}>
            📋 Fila de Check-in para Triagem ({atendimentosPendentes.length} aguardando)
          </h3>

          {atendimentosPendentes.length === 0 ? (
            <p style={{ color: "#9ca3af", fontSize: "12px", textAlign: "center", padding: "20px 0", fontStyle: "italic" }}>
              Nenhum paciente aguardando triagem. Clique em <strong>"Novo Check-in & Triagem"</strong> para dar entrada direta em um paciente!
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {atendimentosPendentes.map((item) => {
                const ehVacina = item.status === "AGUARDANDO_VACINA" || item.status === "Aguardando Vacina";
                const estaSendoChamado = item.status === "Chamando para Triagem";
                return (
                  <div
                    key={item.id}
                    style={{
                      padding: "8px",
                      borderRadius: "6px",
                      border: atendimentoSelecionado?.id === item.id ? "2px solid #4f46e5" : estaSendoChamado ? "2px solid #ef4444" : ehVacina ? "1px solid #ccfbf1" : "1px solid #e5e7eb",
                      backgroundColor: atendimentoSelecionado?.id === item.id ? "#f5f3ff" : estaSendoChamado ? "#fef2f2" : ehVacina ? "#f0fdf4" : "#f9fafb",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center"
                    }}
                  >
                    <div>
                      <strong style={{ color: ehVacina ? "#0f766e" : "#1f2937", display: "block", fontSize: "12px" }}>
                        {ehVacina ? "💉 " : "🐾 "} {obterNomeAnimal(item.animal_id)}
                        {estaSendoChamado && <span style={{ fontSize: "10px", backgroundColor: "#fee2e2", color: "#991b1b", padding: "1px 4px", borderRadius: "4px", marginLeft: "6px", fontWeight: "bold" }}>📢 Chamando...</span>}
                      </strong>
                      <span style={{ fontSize: "10px", color: "#6b7280" }}>
                        Check-in: {item.codigo || `CNS-${item.id}`} {item.queixa_principal ? `| Motivo: ${item.queixa_principal}` : ""}
                      </span>
                    </div>

                    <div style={{ display: "flex", gap: "4px" }}>
                      <button 
                        onClick={(e) => chamarPaciente(item, e)}
                        style={{ backgroundColor: "#0284c7", color: "white", border: "none", padding: "4px 7px", borderRadius: "4px", cursor: "pointer", fontSize: "10px", fontWeight: "600", display: "flex", alignItems: "center", gap: "2px" }}
                      >
                        <MdCampaign size={12} /> Chamar
                      </button>

                      <button 
                        onClick={() => selecionarParaTriagem(item)}
                        style={{ backgroundColor: ehVacina ? "#0d9488" : "#4f46e5", color: "white", border: "none", padding: "4px 8px", borderRadius: "4px", cursor: "pointer", fontSize: "10px", fontWeight: "600" }}
                      >
                        Iniciar Triagem
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {atendimentoSelecionado && (
          <div style={{ backgroundColor: "white", padding: "12px", borderRadius: "10px", border: "1px solid #e5e7eb" }}>
            <h3 style={{ marginTop: 0, color: "#111827", fontSize: "14px", borderBottom: "1px solid #f3f4f6", paddingBottom: "4px", marginBottom: "6px" }}>
              🩺 Aferição de Sinais Vitais — {obterNomeAnimal(atendimentoSelecionado.animal_id)}
            </h3>

            {renderFormularioSinaisVitais()}

            <div style={{ marginBottom: "5px" }}>
              <label style={{ fontSize: "11px", fontWeight: "600", color: "#374151", display: "block", marginBottom: "2px" }}>Queixa Principal *</label>
              <textarea 
                rows={3} 
                value={queixaPrincipal} 
                onChange={(e) => setQueixaPrincipal(e.target.value)} 
                style={{ ...estiloInput, height: "54px", padding: "4px 6px", resize: "none" }} 
                placeholder="Relato do tutor..." 
              />
            </div>

            <div style={{ marginBottom: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "3px" }}>
                <label style={{ fontSize: "11px", fontWeight: "700", color: "#111827" }}>Nível de Urgência (Manchester)</label>
                <button type="button" onClick={sugerirClassificacaoIA} style={{ backgroundColor: "#f0f9ff", color: "#0284c7", border: "1px solid #bae6fd", padding: "2px 5px", borderRadius: "4px", cursor: "pointer", fontSize: "10px", fontWeight: "600", display: "flex", alignItems: "center", gap: "2px" }}>
                  <MdAutoAwesome /> Avaliar com IA
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "4px" }}>
                {Object.keys(CORES_MANCHESTER).map((cor) => {
                  const item = CORES_MANCHESTER[cor];
                  const selecionado = classificacaoRisco === cor;
                  return (
                    <button
                      key={cor}
                      type="button"
                      onClick={() => setClassificacaoRisco(cor)}
                      style={{
                        padding: "4px 2px",
                        borderRadius: "5px",
                        border: selecionado ? `2px solid ${item.text}` : "1px solid #d1d5db",
                        backgroundColor: selecionado ? item.bg : "#ffffff",
                        color: item.text,
                        fontWeight: "700",
                        fontSize: "10px",
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

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px" }}>
              <button onClick={() => setAtendimentoSelecionado(null)} style={{ backgroundColor: "#f3f4f6", border: "none", padding: "5px 10px", borderRadius: "6px", cursor: "pointer", fontWeight: "600", fontSize: "11px" }}>
                Cancelar
              </button>
              <button onClick={salvarTriagemExistente} disabled={carregando} style={{ backgroundColor: "#16a34a", color: "white", border: "none", padding: "5px 12px", borderRadius: "6px", cursor: "pointer", fontWeight: "600", fontSize: "11px" }}>
                {carregando ? "Enviando..." : "Finalizar Triagem"}
              </button>
            </div>
          </div>
        )}
      </div>

      {mostrarModalNovoCheckin && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(3px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: "10px" }}>
          <div style={{ backgroundColor: "white", padding: "14px 18px", borderRadius: "12px", maxWidth: "860px", width: "100%", maxHeight: "94vh", overflowY: "auto", boxSizing: "border-box" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e5e7eb", paddingBottom: "6px", marginBottom: "8px" }}>
              <h3 style={{ margin: 0, color: "#111827", fontSize: "15px" }}>
                🏥 Novo Check-in & Triagem Direta
              </h3>
              <button onClick={() => setMostrarModalNovoCheckin(false)} style={{ border: "none", background: "transparent", cursor: "pointer" }}>
                <MdClose size={18} color="#6b7280" />
              </button>
            </div>

            <form onSubmit={salvarCheckinETriagemDireta}>
              <div style={{ marginBottom: "4px" }}>
                <label style={{ fontSize: "11px", fontWeight: "600", color: "#374151", display: "block", marginBottom: "2px" }}>Paciente *</label>
                <select value={animalIdDireto} onChange={(e) => setAnimalIdDireto(e.target.value)} required style={estiloInput}>
                  <option value="">Selecione o paciente...</option>
                  {animais.map((a) => (
                    <option key={a.id} value={a.id}>{a.nome} ({a.especie || 'Pet'} - {a.codigo || `PET-${a.id}`})</option>
                  ))}
                </select>
              </div>

              {renderFormularioSinaisVitais()}

              <div style={{ marginBottom: "4px" }}>
                <label style={{ fontSize: "11px", fontWeight: "600", color: "#374151", display: "block", marginBottom: "2px" }}>Queixa Principal *</label>
                <textarea 
                  rows={3} 
                  value={queixaPrincipal} 
                  onChange={(e) => setQueixaPrincipal(e.target.value)} 
                  required 
                  style={{ ...estiloInput, height: "54px", padding: "4px 6px", resize: "none" }} 
                  placeholder="Relato do tutor..." 
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px", marginTop: "8px" }}>
                <button type="button" onClick={() => setMostrarModalNovoCheckin(false)} style={{ backgroundColor: "#f3f4f6", border: "none", padding: "5px 10px", borderRadius: "6px", cursor: "pointer", fontWeight: "600", fontSize: "11px" }}>
                  Cancelar
                </button>
                <button type="submit" disabled={carregando} style={{ backgroundColor: "#4f46e5", color: "white", border: "none", padding: "5px 12px", borderRadius: "6px", cursor: "pointer", fontWeight: "600", fontSize: "11px" }}>
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
  height: "30px",
  padding: "0 6px",
  border: "1px solid #d1d5db",
  borderRadius: "5px",
  fontSize: "11px",
  outline: "none",
  boxSizing: "border-box"
};

export default Triagem;