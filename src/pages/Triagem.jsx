import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  MdMedicalServices, 
  MdAutoAwesome,
  MdRefresh,
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

// ---------- Alertas de sinais vitais ----------
const normalizarTexto = (t) =>
  String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const extrairFaixas = (texto) => {
  const t = String(texto || "");
  const num = "(\\d+(?:[.,]\\d+)?)";
  const pegar = (rotulo) => {
    const m = t.match(new RegExp(rotulo + "\\s*:\\s*" + num + "\\s*-\\s*" + num, "i"));
    return m ? [parseFloat(m[1].replace(",", ".")), parseFloat(m[2].replace(",", "."))] : null;
  };
  return { repouso: pegar("Repouso"), clinica: pegar("Cl[ií]nica") };
};

const avaliarSinal = (valor, refTexto, unidade, dica = "") => {
  const v = parseFloat(valor);
  if (isNaN(v)) return null;
  const { repouso, clinica } = extrairFaixas(refTexto);
  const lim = clinica || repouso;
  if (!lim) return null;
  if (v > lim[1]) return { nivel: "alto", texto: `Acima do limite clínico (≤ ${lim[1]} ${unidade})${dica}` };
  if (v < lim[0]) return { nivel: "baixo", texto: `Abaixo do limite clínico (≥ ${lim[0]} ${unidade})${dica}` };
  if (repouso && v > repouso[1]) return { nivel: "atencao", texto: `Acima da faixa de repouso (≤ ${repouso[1]} ${unidade})${dica}` };
  if (repouso && v < repouso[0]) return { nivel: "atencao", texto: `Abaixo da faixa de repouso (≥ ${repouso[0]} ${unidade})${dica}` };
  return null;
};

const CORES_ALERTA = {
  alto: { cor: "#b91c1c", borda: "#fca5a5", bg: "#fef2f2", icone: "🔴" },
  baixo: { cor: "#b91c1c", borda: "#fca5a5", bg: "#fef2f2", icone: "🔴" },
  atencao: { cor: "#b45309", borda: "#fcd34d", bg: "#fffbeb", icone: "⚠️" },
};

// Fonte ajustada para 10px e fontWeight 500 para igualar com as frases de referência
const renderAlertaSinal = (alerta) =>
  alerta ? (
    <span style={{ fontSize: "10px", display: "block", marginTop: "3px", fontWeight: "500", color: CORES_ALERTA[alerta.nivel].cor }}>
      {CORES_ALERTA[alerta.nivel].icone} {alerta.texto}
    </span>
  ) : null;

const estiloAlerta = (alerta) =>
  alerta
    ? { ...estiloInput, border: `1px solid ${CORES_ALERTA[alerta.nivel].borda}`, backgroundColor: CORES_ALERTA[alerta.nivel].bg, color: CORES_ALERTA[alerta.nivel].cor, fontWeight: "700" }
    : estiloInput;

function Triagem() {
  const navigate = useNavigate();

  const [atendimentosPendentes, setAtendimentosPendentes] = useState([]);
  const [animais, setAnimais] = useState([]);
  const [tutores, setTutores] = useState([]);
  const [veterinarios, setVeterinarios] = useState([]);
  const [atendimentoSelecionado, setAtendimentoSelecionado] = useState(null);

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
  const [manterClassificacao, setManterClassificacao] = useState(false);
  const [autoUrgente, setAutoUrgente] = useState(null);

  const [refsDinamicas, setRefsDinamicas] = useState({
      pesoRef: "💡 Ref. Peso: Selecione o paciente...",
      eccRef: "💡 Ideal: 4 a 5 (Escala 1 a 9)",
      temp: "Normal: --",
      fc: "Aguardando paciente...",
      fr: "Aguardando paciente...",
      tpc: "Até 2s",
      mucosasRef: "💡 Normocoradas",
      fonteRef: "📚 Fonte: Aguardando diretrizes científicas...",
      pesoAplicavel: true,
      faixaEtaria: "",
      nomeCientifico: ""
  });
  const [buscandoRefs, setBuscandoRefs] = useState(false);

  const [mensagem, setMensagem] = useState({ tipo: "", texto: "" });
  const [carregando, setCarregando] = useState(false);
  const [atualizandoSilencioso, setAtualizandoSilencioso] = useState(false);

  useEffect(() => {
    carregarDados(true);
    const intervalo = setInterval(() => carregarDados(false), 5000);
    return () => clearInterval(intervalo);
  }, []);

  useEffect(() => {
    setManterClassificacao(false);
    setAutoUrgente(null);
  }, [atendimentoSelecionado]);

  useEffect(() => {
    if (mensagem.texto) {
      const timer = setTimeout(() => setMensagem({ tipo: "", texto: "" }), 4000);
      return () => clearTimeout(timer);
    }
  }, [mensagem]);

  const animalIdSelecionado = atendimentoSelecionado?.animal_id ?? null;

  useEffect(() => {
    if (!animalIdSelecionado) return;
    let cancelado = false;

    const buscarReferenciasDaIA = async () => {
      setBuscandoRefs(true);
      setRefsDinamicas((prev) => ({
        ...prev,
        pesoRef: "💡 Buscando referências...",
        temp: "Buscando nas fontes oficiais...",
        fc: "Buscando nas fontes oficiais...",
        fr: "Buscando nas fontes oficiais...",
        fonteRef: "🔎 Consultando fontes oficiais...",
      }));
      try {
        const token = localStorage.getItem("token");
        const config = { headers: { Authorization: `Bearer ${token}` }, timeout: 180000 };
        const res = await api.post("/triagem/referencias-ia", { animal_id: animalIdSelecionado }, config);
        if (cancelado || !res.data) return;
        setRefsDinamicas({
          pesoRef: res.data.peso_ref,
          eccRef: res.data.ecc_ref || "💡 Ideal: 4 a 5 (Escala 1 a 9)",
          temp: res.data.temperatura,
          fc: res.data.fc,
          fr: res.data.fr,
          tpc: res.data.tpc,
          mucosasRef: res.data.mucosas,
          fonteRef: res.data.fonte_ref || "📚 Fonte: Literatura especializada em medicina zoológica.",
          pesoAplicavel: res.data.peso_ref_aplicavel !== false,
          faixaEtaria: res.data.faixa_etaria || "",
          nomeCientifico: res.data.nome_cientifico || "",
        });
      } catch (err) {
        console.warn("Erro ao buscar referências dinâmicas da IA:", err);
        if (!cancelado) {
          setRefsDinamicas((prev) => ({
            ...prev,
            pesoRef: "⚠️ Ref. Peso: indisponível",
            temp: "Referência indisponível. Consulte o veterinário",
            fc: "Referência indisponível. Consulte o veterinário",
            fr: "Referência indisponível. Consulte o veterinário",
            fonteRef: "⚠️ Não foi possível buscar as referências agora. Consulte o veterinário.",
            pesoAplicavel: true,
          }));
        }
      } finally {
        if (!cancelado) setBuscandoRefs(false);
      }
    };
    buscarReferenciasDaIA();
    return () => { cancelado = true; };
  }, [animalIdSelecionado]);

  useEffect(() => {
    if (!refsDinamicas.pesoAplicavel) {
      setEcc("Avaliar clinicamente (filhote)");
      return;
    }
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
  }, [peso, refsDinamicas.pesoRef, refsDinamicas.pesoAplicavel]);

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

  const carregarDados = async (loaderPrincipal = false) => {
    if (loaderPrincipal) setCarregando(true);
    else setAtualizandoSilencioso(true);

    try {
      const token = localStorage.getItem("token");
      if (!token) return navigate("/");
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const [resFila, resAnimais, resTutores, resUsuarios] = await Promise.all([
        api.get("/consultas/fila-triagem", config),
        api.get("/animais/", config),
        api.get("/tutores/", config),
        api.get("/usuarios/", config),
      ]);
      setAnimais(resAnimais.data || []);
      setTutores(resTutores.data || []);
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

  const obterHeaderDetalhado = (consulta) => {
    if (!consulta) return "";
    const a = animais.find((item) => item.id === consulta.animal_id);
    if (!a) return `PET-${consulta.animal_id}`;
    
    const cod = a.codigo || `PET-${a.id}`;
    const nomePet = a.nome;
    const raca = a.raca ? ` - ${a.raca}` : "";
    const t = tutores.find((tutor) => tutor.id === a.tutor_id);
    const nomeTutor = t ? t.nome : "Sem Tutor";

    return `${cod} - ${nomePet}${raca} - Tutor: ${nomeTutor}`;
  };

  const limparFormulario = () => {
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
    if (!temperatura && !frequenciaCardiaca) {
      setMensagem({ tipo: "erro", texto: "Por favor, preencha pelo menos a temperatura e a frequência cardíaca antes de avaliar com a IA." });
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const animalAlvo = atendimentoSelecionado 
        ? animais.find(a => a.id === atendimentoSelecionado.animal_id)
        : null;

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

    if (sugerirUrgente && !window.confirm(`Sinais acima do limite (${sinaisAlterados.join(", ")}) + ${sintomasGatilho.join(", ")}, mas a classificação está como "${CORES_MANCHESTER[classificacaoRisco]?.nome}". Finalizar assim mesmo?`)) {
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

  const alertaTemp = avaliarSinal(temperatura, refsDinamicas.temp, "°C", " — reavaliar após repouso");
  const alertaFC = avaliarSinal(frequenciaCardiaca, refsDinamicas.fc, "bpm");
  const alertaFR = avaliarSinal(frequenciaRespiratoria, refsDinamicas.fr, "ir/min");

  const alertaDesidratacao = (() => {
    if (desidratacao === "" || parseInt(desidratacao) !== 0) return null;
    const q = normalizarTexto(queixaPrincipal);
    const sugereHidrico = /(bebe\w* mais|mais agua|polidipsia|urin\w* (com )?mais|poliuria|vomit|diarre|nao (bebe|quer beber))/.test(q);
    return sugereHidrico
      ? { nivel: "atencao", texto: "Avaliar consumo hídrico relatado (TPC/mucosas podem não refletir)" }
      : null;
  })();

  const sinaisAlterados = [
    ["Temp", alertaTemp], ["FC", alertaFC], ["FR", alertaFR],
  ].filter(([, a]) => a && a.nivel === "alto").map(([nome]) => nome);

  const SINTOMAS_GATILHO = [
    ["inapetência", /(inapet|anorexi|sem apetite|nao (quer )?comer|nao comeu|recus\w* (a )?(racao|comida|alimento))/],
    ["letargia", /(letarg|apatic|prostrad|desanimad|abatid|mais quiet|muito quiet|quietinh)/],
    ["polidipsia", /(polidips|bebe\w* mais|mais agua|muita agua|sede excessiva)/],
    ["vômito", /(vomit|regurgit)/],
  ];
  const queixaNorm = normalizarTexto(queixaPrincipal);
  const sintomasGatilho = SINTOMAS_GATILHO.filter(([, re]) => re.test(queixaNorm)).map(([nome]) => nome);

  const gatilhoUrgente = sinaisAlterados.length > 0 && sintomasGatilho.length > 0;
  const classificacaoBaixa = ["VERDE", "AZUL"].includes(classificacaoRisco);

  const sugerirUrgente = gatilhoUrgente && classificacaoBaixa && !manterClassificacao;
  const mostrarBannerUrgente =
    gatilhoUrgente && !manterClassificacao &&
    (classificacaoBaixa || (autoUrgente !== null && classificacaoRisco === "AMARELO"));

  useEffect(() => {
    if (gatilhoUrgente && !manterClassificacao && autoUrgente === null && classificacaoBaixa) {
      setAutoUrgente(classificacaoRisco);
      setClassificacaoRisco("AMARELO");
    }
  }, [gatilhoUrgente, manterClassificacao, autoUrgente, classificacaoBaixa, classificacaoRisco]);

  const renderFormularioSinaisVitais = () => (
    <>
      {/* LINHA 1 E LINHA 2 DOS SINAIS VITAIS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "16px" }}>
        
        {/* LINHA 1 */}
        <div>
          <label style={{ fontSize: "12px", fontWeight: "600", color: "#374151", marginBottom: "4px", display: "block" }}>
            👨‍⚕️ Veterinário Responsável *
          </label>
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
          <label style={{ fontSize: "12px", fontWeight: "600", color: "#374151", marginBottom: "4px", display: "block" }}>Peso (kg)</label>
          <input type="number" step="0.1" value={peso} onChange={(e) => setPeso(e.target.value)} style={estiloInput} placeholder="Ex: 3.5" />
          <span style={{ fontSize: "10px", color: "#0284c7", display: "block", marginTop: "3px" }}>{refsDinamicas.pesoRef}</span>
        </div>

        <div>
          <label style={{ fontSize: "12px", fontWeight: "600", color: "#374151", marginBottom: "4px", display: "block" }}>ECC (Condição Corporal)</label>
          <input type="text" value={ecc} onChange={(e) => setEcc(e.target.value)} style={{ ...estiloInput, backgroundColor: ecc ? "#f0fdf4" : "white", color: "#166534", fontWeight: "600" }} placeholder="Auto-calculado..." />
          <span style={{ fontSize: "10px", color: "#0284c7", display: "block", marginTop: "3px" }}>{refsDinamicas.eccRef}</span>
        </div>

        <div>
          <label style={{ fontSize: "12px", fontWeight: "600", color: "#374151", marginBottom: "4px", display: "block" }}>Temperatura (°C)</label>
          <input type="number" step="0.1" value={temperatura} onChange={(e) => setTemperatura(e.target.value)} style={estiloAlerta(alertaTemp)} placeholder="Ex: 38.5" />
          <span style={{ fontSize: "10px", color: "#0284c7", display: "block", marginTop: "3px" }}>💡 {refsDinamicas.temp}</span>
          {renderAlertaSinal(alertaTemp)}
        </div>

        {/* LINHA 2 */}
        <div>
          <label style={{ fontSize: "12px", fontWeight: "600", color: "#374151", marginBottom: "4px", display: "block" }}>FC (bpm)</label>
          <input type="number" value={frequenciaCardiaca} onChange={(e) => setFrequenciaCardiaca(e.target.value)} style={estiloAlerta(alertaFC)} placeholder="Ex: 150" />
          <span style={{ fontSize: "10px", color: "#0284c7", display: "block", marginTop: "3px" }}>💡 {refsDinamicas.fc}</span>
          {renderAlertaSinal(alertaFC)}
        </div>

        <div>
          <label style={{ fontSize: "12px", fontWeight: "600", color: "#374151", marginBottom: "4px", display: "block" }}>FR (mpm)</label>
          <input type="number" value={frequenciaRespiratoria} onChange={(e) => setFrequenciaRespiratoria(e.target.value)} style={estiloAlerta(alertaFR)} placeholder="Ex: 25" />
          <span style={{ fontSize: "10px", color: "#0284c7", display: "block", marginTop: "3px" }}>💡 {refsDinamicas.fr}</span>
          {renderAlertaSinal(alertaFR)}
        </div>

        <div>
          <label style={{ fontSize: "12px", fontWeight: "600", color: "#374151", marginBottom: "4px", display: "block" }}>TPC (segundos)</label>
          <input type="number" value={tpcSegundos} onChange={(e) => setTpcSegundos(e.target.value)} style={estiloInput} placeholder="Ex: 2" />
          <span style={{ fontSize: "10px", color: "#0284c7", display: "block", marginTop: "3px" }}>💡 {refsDinamicas.tpc}</span>
        </div>

        <div>
          <label style={{ fontSize: "12px", fontWeight: "600", color: "#374151", marginBottom: "4px", display: "block" }}>Mucosas</label>
          <select value={mucosas} onChange={(e) => setMucosas(e.target.value)} style={estiloInput}>
            <option value="Normocoradas">Normocoradas (Rosadas)</option>
            <option value="Hipocoradas / Pálidas">Hipocoradas / Pálidas</option>
            <option value="Cianóticas">Cianóticas (Roxas)</option>
            <option value="Ictéricas">Ictéricas (Amareladas)</option>
            <option value="Congestas / Hiperêmicas">Congestas / Vermelhas</option>
          </select>
          <span style={{ fontSize: "10px", color: "#0284c7", display: "block", marginTop: "3px" }}>{refsDinamicas.mucosasRef}</span>
        </div>
      </div>

      {/* LINHA 3: DESIDRATAÇÃO (1/4) + QUEIXA PRINCIPAL (3/4) NA MESMA LINHA */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "16px", alignItems: "start" }}>
        
        {/* DESIDRATAÇÃO */}
        <div>
          <label style={{ fontSize: "12px", fontWeight: "600", color: "#374151", marginBottom: "4px", display: "block" }}>Desidratação (%) — IA</label>
          <input type="number" value={desidratacao} onChange={(e) => setDesidratacao(e.target.value)} style={{ ...estiloInput, backgroundColor: "#f0fdf4", color: "#166534", fontWeight: "600" }} placeholder="Auto-calculado..." />
          <span style={{ fontSize: "10px", color: "#0284c7", display: "block", marginTop: "3px" }}>💡 Normal: &lt; 5% (TPC/Mucosas)</span>
          {renderAlertaSinal(alertaDesidratacao)}
        </div>

        {/* QUEIXA PRINCIPAL Ocupando 3 Colunas */}
        <div style={{ gridColumn: "span 3" }}>
          <label style={{ fontSize: "12px", fontWeight: "600", color: "#374151", display: "block", marginBottom: "4px" }}>Queixa Principal *</label>
          <textarea 
            rows={3} 
            value={queixaPrincipal} 
            onChange={(e) => setQueixaPrincipal(e.target.value)} 
            style={{ ...estiloInput, height: "70px", padding: "8px 10px", resize: "vertical" }} 
            placeholder="Relato do tutor..." 
          />
          <span style={{ fontSize: "10px", color: "#0284c7", display: "block", marginTop: "3px", fontStyle: "italic", fontWeight: "500" }}>
            * {refsDinamicas.fonteRef}
          </span>
          {(refsDinamicas.nomeCientifico || refsDinamicas.faixaEtaria) && (
            <span style={{ fontSize: "10px", color: "#6b7280", display: "block", marginTop: "2px" }}>
              🧬 {refsDinamicas.nomeCientifico || "nome científico pendente"}
              {refsDinamicas.faixaEtaria ? ` · faixa etária: ${refsDinamicas.faixaEtaria}` : ""}
              {buscandoRefs ? " · buscando..." : ""}
            </span>
          )}
        </div>
      </div>
    </>
  );

  return (
    <Layout>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: "8px", margin: 0, fontSize: "22px", color: "#1e1b4b" }}>
            <MdMedicalServices color="#dc2626" size={26} />
            Check-in & Triagem (Protocolo Manchester)
          </h1>
          <p style={{ color: "#6b7280", margin: "2px 0 0 0", fontSize: "12px" }}>
            Recepção, entrada de pacientes e classificação de urgência clínica.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {atualizandoSilencioso && (
            <span style={{ fontSize: "12px", color: "#6366f1", fontWeight: "500" }}>Sincronizando...</span>
          )}
          <button
            onClick={() => carregarDados(true)}
            style={{ display: "flex", alignItems: "center", gap: "6px", backgroundColor: "#ffffff", border: "1px solid #d1d5db", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontWeight: "600", color: "#374151", fontSize: "12px" }}
          >
            <MdRefresh size={14} /> Atualizar
          </button>
        </div>
      </div>

      {mensagem.texto && (
        <div style={{ padding: "8px 12px", borderRadius: "6px", marginBottom: "12px", backgroundColor: mensagem.tipo === "sucesso" ? "#dcfce7" : "#fee2e2", color: mensagem.tipo === "sucesso" ? "#166534" : "#991b1b", fontWeight: "600", fontSize: "12px" }}>
          {mensagem.texto}
        </div>
      )}

      {/* ESTRUTURA EMPILHADA */}
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        
        {/* FORMULÁRIO DE TRIAGEM */}
        {atendimentoSelecionado ? (
          <div style={{ backgroundColor: "white", padding: "20px", borderRadius: "12px", border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            
            {/* TÍTULO COM O CÓDIGO, NOME, RAÇA E TUTOR */}
            <h3 style={{ marginTop: 0, color: "#1e1b4b", fontSize: "16px", borderBottom: "1px solid #f3f4f6", paddingBottom: "10px", marginBottom: "16px", fontWeight: "700" }}>
              🩺 Aferição de Sinais Vitais — {obterHeaderDetalhado(atendimentoSelecionado)}
            </h3>

            {renderFormularioSinaisVitais()}

            <div style={{ marginBottom: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <label style={{ fontSize: "12px", fontWeight: "700", color: "#111827" }}>Nível de Urgência (Manchester)</label>
                <button type="button" onClick={sugerirClassificacaoIA} style={{ backgroundColor: "#f0f9ff", color: "#0284c7", border: "1px solid #bae6fd", padding: "4px 10px", borderRadius: "6px", cursor: "pointer", fontSize: "11px", fontWeight: "600", display: "flex", alignItems: "center", gap: "4px" }}>
                  <MdAutoAwesome /> Avaliar com IA
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "8px", marginBottom: "10px" }}>
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
                        fontSize: "12px",
                        cursor: "pointer",
                        textAlign: "center"
                      }}
                    >
                      {item.nome}
                    </button>
                  );
                })}
              </div>

              {mostrarBannerUrgente && (
                <div style={{ backgroundColor: "#fffbeb", border: "1px solid #fcd34d", padding: "10px 12px", borderRadius: "6px", fontSize: "11px", color: "#92400e", marginBottom: "10px" }}>
                  <strong>⚠️ {autoUrgente !== null && classificacaoRisco === "AMARELO" ? "Classificado automaticamente como Urgente:" : "Sugestão: Urgente —"}</strong>{" "}
                  {sinaisAlterados.join(", ")} acima do limite clínico + {sintomasGatilho.join(", ")} relatado(s) na queixa.
                  <div style={{ display: "flex", gap: "6px", marginTop: "6px" }}>
                    {autoUrgente !== null && classificacaoRisco === "AMARELO" ? (
                      <>
                        <button type="button" onClick={() => setManterClassificacao(true)} style={{ backgroundColor: "#fef9c3", color: "#a16207", border: "1px solid #fde047", padding: "4px 10px", borderRadius: "4px", cursor: "pointer", fontSize: "11px", fontWeight: "700" }}>
                          Manter Urgente
                        </button>
                        <button type="button" onClick={() => { setClassificacaoRisco(autoUrgente); setManterClassificacao(true); }} style={{ backgroundColor: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db", padding: "4px 10px", borderRadius: "4px", cursor: "pointer", fontSize: "11px", fontWeight: "600" }}>
                          Desfazer ({CORES_MANCHESTER[autoUrgente]?.nome})
                        </button>
                      </>
                    ) : (
                      <>
                        <button type="button" onClick={() => setClassificacaoRisco("AMARELO")} style={{ backgroundColor: "#fef9c3", color: "#a16207", border: "1px solid #fde047", padding: "4px 10px", borderRadius: "4px", cursor: "pointer", fontSize: "11px", fontWeight: "700" }}>
                          Alterar para Urgente
                        </button>
                        <button type="button" onClick={() => setManterClassificacao(true)} style={{ backgroundColor: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db", padding: "4px 10px", borderRadius: "4px", cursor: "pointer", fontSize: "11px", fontWeight: "600" }}>
                          Manter {CORES_MANCHESTER[classificacaoRisco]?.nome}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}

              {justificativa && (
                <div style={{ backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", padding: "10px 12px", borderRadius: "6px", fontSize: "11px", color: "#334151" }}>
                  <strong>🤖 Justificativa Clínica da IA:</strong> {justificativa}
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", borderTop: "1px solid #f3f4f6", paddingTop: "14px" }}>
              <button onClick={() => setAtendimentoSelecionado(null)} style={{ backgroundColor: "#f3f4f6", color: "#374151", border: "none", padding: "8px 18px", borderRadius: "6px", cursor: "pointer", fontWeight: "600", fontSize: "12px" }}>
                Cancelar
              </button>
              <button onClick={salvarTriagemExistente} disabled={carregando} style={{ backgroundColor: "#16a34a", color: "white", border: "none", padding: "8px 22px", borderRadius: "6px", cursor: "pointer", fontWeight: "600", fontSize: "12px" }}>
                {carregando ? "Enviando..." : "Finalizar Triagem"}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ backgroundColor: "#f8fafc", padding: "28px", borderRadius: "12px", border: "1px dashed #cbd5e1", textAlign: "center", color: "#64748b" }}>
            <p style={{ margin: 0, fontSize: "14px", fontWeight: "500" }}>
              👇 Selecione um paciente na **Fila de Check-in** abaixo para iniciar a triagem e aferição de sinais vitais.
            </p>
          </div>
        )}

        {/* FILA DE CHECK-IN */}
        <div style={{ backgroundColor: "white", padding: "20px", borderRadius: "12px", border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <h3 style={{ marginTop: 0, color: "#111827", fontSize: "15px", marginBottom: "14px" }}>
            📋 Fila de Check-in para Triagem ({atendimentosPendentes.length} aguardando)
          </h3>

          {atendimentosPendentes.length === 0 ? (
            <p style={{ color: "#9ca3af", fontSize: "13px", textAlign: "center", padding: "24px 0", fontStyle: "italic" }}>
              Nenhum paciente aguardando triagem no momento. Os pacientes aparecerão aqui assim que realizarem o check-in na recepção.
            </p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "12px" }}>
              {atendimentosPendentes.map((item) => {
                const ehVacina = item.status === "AGUARDANDO_VACINA" || item.status === "Aguardando Vacina";
                const estaSendoChamado = item.status === "Chamando para Triagem";
                return (
                  <div
                    key={item.id}
                    style={{
                      padding: "12px",
                      borderRadius: "8px",
                      border: atendimentoSelecionado?.id === item.id ? "2px solid #4f46e5" : estaSendoChamado ? "2px solid #ef4444" : ehVacina ? "1px solid #ccfbf1" : "1px solid #e5e7eb",
                      backgroundColor: atendimentoSelecionado?.id === item.id ? "#f5f3ff" : estaSendoChamado ? "#fef2f2" : ehVacina ? "#f0fdf4" : "#f9fafb",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center"
                    }}
                  >
                    <div>
                      <strong style={{ color: ehVacina ? "#0f766e" : "#1f2937", display: "block", fontSize: "13px" }}>
                        {ehVacina ? "💉 " : "🐾 "} {obterNomeAnimal(item.animal_id)}
                        {estaSendoChamado && <span style={{ fontSize: "10px", backgroundColor: "#fee2e2", color: "#991b1b", padding: "1px 5px", borderRadius: "4px", marginLeft: "6px", fontWeight: "bold" }}>📢 Chamando...</span>}
                      </strong>
                      <span style={{ fontSize: "11px", color: "#6b7280", display: "block", marginTop: "3px" }}>
                        Check-in: {item.codigo || `CNS-${item.id}`} {item.queixa_principal ? `| Motivo: ${item.queixa_principal}` : ""}
                      </span>
                    </div>

                    <div style={{ display: "flex", gap: "6px" }}>
                      <button 
                        onClick={(e) => chamarPaciente(item, e)}
                        style={{ backgroundColor: "#0284c7", color: "white", border: "none", padding: "6px 10px", borderRadius: "6px", cursor: "pointer", fontSize: "11px", fontWeight: "600", display: "flex", alignItems: "center", gap: "4px" }}
                      >
                        <MdCampaign size={14} /> Chamar
                      </button>

                      <button 
                        onClick={() => selecionarParaTriagem(item)}
                        style={{ backgroundColor: ehVacina ? "#0d9488" : "#4f46e5", color: "white", border: "none", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "11px", fontWeight: "600" }}
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
      </div>
    </Layout>
  );
}

const estiloInput = {
  width: "100%",
  height: "38px",
  padding: "0 10px",
  border: "1px solid #d1d5db",
  borderRadius: "6px",
  fontSize: "12px",
  outline: "none",
  boxSizing: "border-box"
};

export default Triagem;