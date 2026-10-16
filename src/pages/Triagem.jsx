import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  MdMedicalServices, 
  MdAutoAwesome,
  MdRefresh,
  MdCampaign,
  MdPets
} from "react-icons/md";
import { FaDog, FaCat, FaFish, FaDove, FaHorse, FaFrog, FaBug, FaUser, FaClock } from "react-icons/fa";
import { GiCow, GiPig, GiSheep, GiGoat, GiRabbit } from "react-icons/gi";
import api from "../api/api";
import Layout from "../components/Layout";

const CORES_MANCHESTER = {
  VERMELHO: { nome: "Emergência", bg: "#fee2e2", text: "#991b1b", border: "#fca5a5", badge: "🔴 0 min", inactiveBg: "#fff5f5" },
  LARANJA: { nome: "Muito Urgente", bg: "#ffedd5", text: "#c2410c", border: "#fdba74", badge: "🟠 10 min", inactiveBg: "#fff7ed" },
  AMARELO: { nome: "Urgente", bg: "#fef9c3", text: "#a16207", border: "#fde047", badge: "🟡 60 min", inactiveBg: "#fefce8" },
  VERDE: { nome: "Pouco Urgente", bg: "#dcfce7", text: "#15803d", border: "#86efac", badge: "🟢 120 min", inactiveBg: "#f0fdf4" },
  AZUL: { nome: "Não Urgente", bg: "#e0f2fe", text: "#0369a1", border: "#7dd3fc", badge: "🔵 240 min", inactiveBg: "#f0f9ff" },
};

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

function useValorEstavel(valor, ms = 1200) {
  const [estavel, setEstavel] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setEstavel(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);
  return estavel;
}

const TEMP_PLAUSIVEL = [25, 45];
const TPC_PLAUSIVEL = [0, 10];

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
  const [origemJustificativa, setOrigemJustificativa] = useState("ia");
  const [manterClassificacao, setManterClassificacao] = useState(false);
  const [autoUrgente, setAutoUrgente] = useState(null);
  const emergenciaAuto = useRef(null);
  const temperaturaEstavel = useValorEstavel(temperatura);
  const tpcEstavel = useValorEstavel(tpcSegundos);
  const fcEstavel = useValorEstavel(frequenciaCardiaca);
  const frEstavel = useValorEstavel(frequenciaRespiratoria);

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
    emergenciaAuto.current = null;
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

  useEffect(() => {
    const tpcNum = parseInt(tpcEstavel);
    const tpcCritico = !isNaN(tpcNum) && tpcNum >= 3 && tpcNum <= TPC_PLAUSIVEL[1];

    const tempNum = parseFloat(temperaturaEstavel);
    const tempPlausivel = !isNaN(tempNum) && tempNum >= TEMP_PLAUSIVEL[0] && tempNum <= TEMP_PLAUSIVEL[1];
    const tempCritica = tempPlausivel && (tempNum <= 35.0 || tempNum >= 40.5);

    if (tpcCritico || tempCritica) {
      if (!emergenciaAuto.current) {
        emergenciaAuto.current = { classificacao: classificacaoRisco, justificativa, origem: origemJustificativa };
      }
      setClassificacaoRisco("VERMELHO");
      setOrigemJustificativa("regra");

      const motivos = [];
      if (tpcCritico) motivos.push(`TPC ${tpcNum}s (perfusão comprometida)`);
      if (tempCritica) motivos.push(`Temperatura ${tempNum}°C`);

      setJustificativa(
        `⚠️ EMERGÊNCIA CLÍNICA (Regra Automática): ${motivos.join(' e ')}. ` +
        `Protocolo de Manchester acionado por risco iminente à vida.`
      );
      setManterClassificacao(true);
    } else if (emergenciaAuto.current) {
      const anterior = emergenciaAuto.current;
      emergenciaAuto.current = null;
      setClassificacaoRisco(anterior.classificacao);
      setJustificativa(anterior.justificativa);
      setOrigemJustificativa(anterior.origem || "ia");
      setManterClassificacao(false);
    }
  }, [tpcEstavel, temperaturaEstavel]);

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
      setAtendimentosPendentes(resFila.data || []);
      setAnimais(resAnimais.data || []);
      setTutores(resTutores.data || []);
      setVeterinarios((resUsuarios.data || []).filter((u) => u.perfil === "VETERINARIO"));
    } catch (err) {
      console.error("Erro ao carregar dados de triagem:", err);
    } finally {
      setCarregando(false);
      setAtualizandoSilencioso(false);
    }
  };

  const obterCorAvatar = (especie) => {
    const esp = (especie || "").toLowerCase();
    if (esp.includes("felino") || esp.includes("gato")) return "#fce7f3";
    if (esp.includes("canino") || esp.includes("cão") || esp.includes("cachorro")) return "#dbeafe";
    if (esp.includes("ave") || esp.includes("pássaro") || esp.includes("calopsita")) return "#e0f2fe";
    if (esp.includes("lagomorfo") || esp.includes("coelho") || esp.includes("lebre")) return "#fef3c7";
    if (esp.includes("bovino") || esp.includes("vaca") || esp.includes("boi") || esp.includes("touro")) return "#f5f5f4";
    if (esp.includes("suíno") || esp.includes("suino") || esp.includes("porco")) return "#ffe4e6";
    if (esp.includes("ovino") || esp.includes("ovelha") || esp.includes("carneiro")) return "#f1f5f9";
    if (esp.includes("caprino") || esp.includes("cabra") || esp.includes("bode")) return "#ecfdf5";
    if (esp.includes("equino") || esp.includes("cavalo") || esp.includes("égua") || esp.includes("ponei")) return "#fef3c7";
    return "#f3f4f6";
  };

  const obterCorIcone = (especie) => {
    const esp = (especie || "").toLowerCase();
    if (esp.includes("felino") || esp.includes("gato")) return "#be185d"; 
    if (esp.includes("canino") || esp.includes("cão") || esp.includes("cachorro")) return "#1d4ed8"; 
    if (esp.includes("ave") || esp.includes("pássaro") || esp.includes("calopsita")) return "#0369a1"; 
    if (esp.includes("lagomorfo") || esp.includes("coelho") || esp.includes("lebre")) return "#b45309"; 
    if (esp.includes("bovino") || esp.includes("vaca") || esp.includes("boi") || esp.includes("touro")) return "#44403c"; 
    if (esp.includes("suíno") || esp.includes("suino") || esp.includes("porco")) return "#e11d48"; 
    if (esp.includes("ovino") || esp.includes("ovelha") || esp.includes("carneiro")) return "#475569"; 
    if (esp.includes("caprino") || esp.includes("cabra") || esp.includes("bode")) return "#047857"; 
    if (esp.includes("equino") || esp.includes("cavalo") || esp.includes("égua") || esp.includes("ponei")) return "#b45309";
    return "#4b5563";
  };

  const obterCorSintoma = (tag) => {
    const t = tag.toLowerCase();
    if (t.includes("trauma") || t.includes("sangue") || t.includes("dor")) return { bg: "#fee2e2", text: "#991b1b" };
    if (t.includes("pele") || t.includes("ocular") || t.includes("coceira")) return { bg: "#f3e8ff", text: "#6b21a8" };
    if (t.includes("diarreia") || t.includes("vômito")) return { bg: "#ffedd5", text: "#c2410c" };
    if (t.includes("febre") || t.includes("infecção")) return { bg: "#fef3c7", text: "#b45309" };
    if (t.includes("tosse") || t.includes("respiração")) return { bg: "#e0f2fe", text: "#0369a1" };
    if (t.includes("apatia") || t.includes("letargia")) return { bg: "#f1f5f9", text: "#475569" };
    return { bg: "#f3f4f6", text: "#374151" };
  };

  const renderizarIconeAnimal = (especie, isSelected, corUnica, sizeMode = "small") => {
    const cor = corUnica ? corUnica : (isSelected ? "#fff" : "#9ca3af");
    const tamanho = sizeMode === "large" ? 48 : 18;
    const esp = (especie || "").toLowerCase();

    if (esp.includes("bovino") || esp.includes("vaca") || esp.includes("boi") || esp.includes("touro")) return <GiCow size={tamanho} color={cor} />;
    if (esp.includes("suíno") || esp.includes("suino") || esp.includes("porco")) return <GiPig size={tamanho} color={cor} />;
    if (esp.includes("ovino") || esp.includes("ovelha") || esp.includes("carneiro")) return <GiSheep size={tamanho} color={cor} />;
    if (esp.includes("caprino") || esp.includes("cabra") || esp.includes("bode")) return <GiGoat size={tamanho} color={cor} />;
    if (esp.includes("equino") || esp.includes("cavalo") || esp.includes("égua") || esp.includes("ponei")) return <FaHorse size={tamanho} color={cor} />;
    if (esp.includes("lagomorfo") || esp.includes("coelho") || esp.includes("lebre")) return <GiRabbit size={tamanho} color={cor} />;
    if (esp.includes("felino") || esp.includes("gato")) return <FaCat size={tamanho} color={cor} />;
    if (esp.includes("canino") || esp.includes("cão") || esp.includes("cachorro")) return <FaDog size={tamanho} color={cor} />;
    if (esp.includes("ave") || esp.includes("pássaro") || esp.includes("calopsita")) return <FaDove size={tamanho} color={cor} />;
    if (esp.includes("peixe") || esp.includes("aquático") || esp.includes("tilápia")) return <FaFish size={tamanho} color={cor} />;
    if (esp.includes("réptil") || esp.includes("lagarto") || esp.includes("cobra") || esp.includes("tartaruga")) return <FaFrog size={tamanho} color={cor} />; 
    if (esp.includes("inseto") || esp.includes("aracnídeo")) return <FaBug size={tamanho} color={cor} />;
    
    return <MdPets size={tamanho} color={cor} />;
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
    setOrigemJustificativa("ia");
    emergenciaAuto.current = null;
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
      setMensagem({ tipo: "sucesso", texto: `📢 Chamando paciente no painel para Triagem!` });
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
        setOrigemJustificativa(res.data.origem === "REGRA_FISICA" ? "regra" : "ia");
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
      const animalIdAlvo = atendimentoSelecionado?.animal_id;

      if (animalIdAlvo && peso !== "" && peso !== null) {
        const animalEncontrado = animais.find((a) => a.id === Number(animalIdAlvo));
        if (animalEncontrado) {
          await api.put(`/animais/${animalIdAlvo}`, { ...animalEncontrado, peso: parseFloat(peso) }, config).catch(() => {});
        }
      }

      const payload = {
        consulta_id: atendimentoSelecionado?.id || null,
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

  const alertaTempEstavel = avaliarSinal(temperaturaEstavel, refsDinamicas.temp, "°C");
  const alertaFCEstavel = avaliarSinal(fcEstavel, refsDinamicas.fc, "bpm");
  const alertaFREstavel = avaliarSinal(frEstavel, refsDinamicas.fr, "ir/min");
  const sinaisAlterados = [
    ["Temp", alertaTempEstavel], ["FC", alertaFCEstavel], ["FR", alertaFREstavel],
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
          {temperatura !== "" && !isNaN(parseFloat(temperatura)) &&
            (parseFloat(temperatura) < TEMP_PLAUSIVEL[0] || parseFloat(temperatura) > TEMP_PLAUSIVEL[1]) && (
            <span style={{ fontSize: "10px", display: "block", marginTop: "3px", fontWeight: "600", color: "#b45309" }}>
              ⚠️ Valor improvável: confira a digitação
            </span>
          )}
        </div>

        {/* LINHA 2 */}
        <div>
          <label style={{ fontSize: "12px", fontWeight: "600", color: "#374151", marginBottom: "4px", display: "block" }}>FC (bpm)</label>
          <input type="number" value={frequenciaCardiaca} onChange={(e) => setFrequenciaCardiaca(e.target.value)} style={estiloAlerta(alertaFC)} placeholder="Ex: 150" />
          <span style={{ fontSize: "10px", color: "#0284c7", display: "block", marginTop: "3px" }}>💡 {refsDinamicas.fc}</span>
          {renderAlertaSinal(alertaFC)}
        </div>

        <div>
          <label style={{ fontSize: "12px", fontWeight: "600", color: "#374151", marginBottom: "4px", display: "block" }}>FR (ir/min)</label>
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

      {/* LINHA 3 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "16px", alignItems: "start" }}>
        <div>
          <label style={{ fontSize: "12px", fontWeight: "600", color: "#374151", marginBottom: "4px", display: "block" }}>Desidratação (%) — IA</label>
          <input type="number" value={desidratacao} onChange={(e) => setDesidratacao(e.target.value)} style={{ ...estiloInput, backgroundColor: "#f0fdf4", color: "#166534", fontWeight: "600" }} placeholder="Auto-calculado..." />
          <span style={{ fontSize: "10px", color: "#0284c7", display: "block", marginTop: "3px" }}>💡 Normal: &lt; 5% (TPC/Mucosas)</span>
          {renderAlertaSinal(alertaDesidratacao)}
        </div>

        <div style={{ gridColumn: "span 3" }}>
          <label style={{ fontSize: "12px", fontWeight: "600", color: "#374151", display: "block", marginBottom: "4px" }}>Queixa Principal *</label>
          <textarea 
            rows={3} 
            value={queixaPrincipal} 
            onChange={(e) => setQueixaPrincipal(e.target.value)} 
            style={{ ...estiloInput, height: "70px", padding: "8px 10px", resize: "vertical" }} 
            placeholder="Relato do tutor..." 
          />
          <span style={{ fontSize: "10px", color: "#64748b", display: "block", marginTop: "4px", fontStyle: "normal" }}>
            * ⚠️ <strong>PENDENTE</strong> de validação veterinária. {refsDinamicas.fonteRef}
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
        <h1 style={{ display: "flex", alignItems: "center", gap: "12px", margin: 0, fontSize: "26px", color: "#1e1b4b" }}>
          <MdMedicalServices color="#dc2626" size={38} /> Check-in & Triagem (Protocolo Manchester)
        </h1>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          {atualizandoSilencioso && (
            <span style={{ fontSize: "12px", color: "#6366f1", fontWeight: "500" }}>Sincronizando...</span>
          )}
          <button
            onClick={() => carregarDados(true)}
            style={{
              backgroundColor: "#ffffff",
              color: "#374151",
              border: "1px solid #d1d5db",
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
            <MdRefresh size={18} /> Atualizar
          </button>
        </div>
      </div>

      {mensagem.texto && (
        <div style={{ backgroundColor: mensagem.tipo === "sucesso" ? "#dcfce7" : "#fee2e2", color: mensagem.tipo === "sucesso" ? "#166534" : "#991b1b", padding: "12px 16px", borderRadius: "8px", marginBottom: "15px", fontWeight: "500" }}>
          {mensagem.texto}
        </div>
      )}

      {atendimentoSelecionado ? (
        <div style={{ backgroundColor: "white", padding: "28px", borderRadius: "16px", border: "1px solid #e5e7eb", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)" }}>
          <h3 style={{ marginTop: 0, color: "#1e1b4b", fontSize: "18px", borderBottom: "2px solid #f3f4f6", paddingBottom: "16px", marginBottom: "20px", fontWeight: "700" }}>
            🩺 Aferição de Sinais Vitais — {obterHeaderDetalhado(atendimentoSelecionado)}
          </h3>

          {renderFormularioSinaisVitais()}

          <div style={{ marginBottom: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <label style={{ fontSize: "13px", fontWeight: "700", color: "#111827" }}>Nível de Urgência (Manchester)</label>
              <button type="button" onClick={sugerirClassificacaoIA} style={{ backgroundColor: "#f0f9ff", color: "#0284c7", border: "1px solid #bae6fd", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontWeight: "600", display: "flex", alignItems: "center", gap: "6px" }}>
                <MdAutoAwesome /> Avaliar com IA
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "10px", marginBottom: "14px" }}>
              {Object.keys(CORES_MANCHESTER).map((cor) => {
                const item = CORES_MANCHESTER[cor];
                const selecionado = classificacaoRisco === cor;
                return (
                  <button
                    key={cor}
                    type="button"
                    onClick={() => setClassificacaoRisco(cor)}
                    style={{
                      padding: "12px 6px",
                      borderRadius: "8px",
                      border: selecionado ? `2px solid ${item.text}` : `1px solid ${item.border}`,
                      backgroundColor: selecionado ? item.bg : item.inactiveBg,
                      color: item.text,
                      fontWeight: selecionado ? "700" : "600",
                      fontSize: "13px",
                      cursor: "pointer",
                      textAlign: "center",
                      boxShadow: selecionado ? "0 2px 4px rgba(0,0,0,0.08)" : "none",
                      transition: "all 0.15s ease-in-out"
                    }}
                  >
                    {item.nome}
                  </button>
                );
              })}
            </div>

            {mostrarBannerUrgente && (
              <div style={{ backgroundColor: "#fffbeb", border: "1px solid #fcd34d", padding: "14px 16px", borderRadius: "8px", fontSize: "12px", color: "#92400e", marginBottom: "12px" }}>
                <strong>⚠️ {autoUrgente !== null && classificacaoRisco === "AMARELO" ? "Classificado automaticamente como Urgente:" : "Sugestão: Urgente —"}</strong>{" "}
                {sinaisAlterados.join(", ")} acima do limite clínico + {sintomasGatilho.join(", ")} relatado(s) na queixa.
                <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                  {autoUrgente !== null && classificacaoRisco === "AMARELO" ? (
                    <>
                      <button type="button" onClick={() => setManterClassificacao(true)} style={{ backgroundColor: "#fef9c3", color: "#a16207", border: "1px solid #fde047", padding: "6px 14px", borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontWeight: "700" }}>
                        Manter Urgente
                      </button>
                      <button type="button" onClick={() => { setClassificacaoRisco(autoUrgente); setManterClassificacao(true); }} style={{ backgroundColor: "#ffffff", color: "#374151", border: "1px solid #d1d5db", padding: "6px 14px", borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontWeight: "600" }}>
                        Desfazer ({CORES_MANCHESTER[autoUrgente]?.nome})
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" onClick={() => setClassificacaoRisco("AMARELO")} style={{ backgroundColor: "#fef9c3", color: "#a16207", border: "1px solid #fde047", padding: "6px 14px", borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontWeight: "700" }}>
                        Alterar para Urgente
                      </button>
                      <button type="button" onClick={() => setManterClassificacao(true)} style={{ backgroundColor: "#ffffff", color: "#374151", border: "1px solid #d1d5db", padding: "6px 14px", borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontWeight: "600" }}>
                        Manter {CORES_MANCHESTER[classificacaoRisco]?.nome}
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {justificativa && (
              <div style={{ backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", padding: "12px 14px", borderRadius: "8px", fontSize: "12px", color: "#334151" }}>
                <strong>{origemJustificativa === "regra" ? "⚙️ Regra automática (sem IA):" : "🤖 Justificativa Clínica da IA:"}</strong> {justificativa}
              </div>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", borderTop: "2px solid #f3f4f6", paddingTop: "20px", marginTop: "10px" }}>
            <button onClick={() => { setAtendimentoSelecionado(null); limparFormulario(); }} style={{ backgroundColor: "#f3f4f6", color: "#374151", border: "none", padding: "12px 24px", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "14px" }}>Voltar para a Fila</button>
            <button onClick={salvarTriagemExistente} disabled={carregando} style={{ backgroundColor: "#16a34a", color: "white", border: "none", padding: "12px 30px", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "14px" }}>{carregando ? "Enviando..." : "Finalizar Triagem"}</button>
          </div>
        </div>
      ) : (
        /* FILA DE ESPERA EM CARDS RETANGULARES (CORRIGIDO PARA LARGURA FLEXÍVEL E TEXTOS LONGOS) */
        <div style={{ backgroundColor: "white", padding: "28px", borderRadius: "16px", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)", border: "1px solid #e5e7eb" }}>
          <h3 style={{ marginTop: 0, color: "#111827", fontSize: "20px", marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
            📋 Fila de Espera Atual ({atendimentosPendentes.length} pacientes)
          </h3>

          {atendimentosPendentes.length === 0 ? (
            <p style={{ color: "#6b7280", textAlign: "center", padding: "40px 20px", fontSize: "15px" }}>Nenhum paciente aguardando triagem no momento. Os pacientes aparecerão aqui assim que realizarem o check-in na recepção.</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 500px), 1fr))", gap: "24px" }}>
              {atendimentosPendentes.map((item) => {
                const a = animais.find((itemAnim) => itemAnim.id === Number(item.animal_id));
                const t = a ? tutores.find((tutor) => tutor.id === a.tutor_id) : null;
                
                const nomePet = a ? a.nome : "Paciente desconhecido";
                const especie = a?.especie || "Pet";
                const raca = a?.raca ? ` - ${a.raca}` : "";
                const nomeTutor = t ? t.nome : "Tutor não vinculado";
                const codigoFormatado = item.codigo || `CNS-${String(item.id).padStart(4, "0")}`;

                const tagsSintomas = (item.queixa_principal || "")
                  .split(",")
                  .map((tag) => tag.trim())
                  .filter(Boolean);

                const avatarBg = obterCorAvatar(especie);
                const iconColor = obterCorIcone(especie);
                const estaSendoChamado = item.status === "Chamando para Triagem";

                return (
                  <div 
                    key={item.id} 
                    style={{ 
                      display: "flex", 
                      justifyContent: "space-between", 
                      alignItems: "flex-start", 
                      padding: "24px", 
                      backgroundColor: estaSendoChamado ? "#fef2f2" : "#ffffff", 
                      borderRadius: "16px", 
                      border: "1px solid #e5e7eb",
                      borderLeft: "6px solid #4f46e5",
                      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
                      transition: "transform 0.2s, box-shadow 0.2s",
                      cursor: "default",
                      textAlign: "left",
                      overflow: "hidden"
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.boxShadow = "0 10px 15px -3px rgba(0, 0, 0, 0.1)";
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "0 4px 6px -1px rgba(0, 0, 0, 0.05)";
                    }}
                  >
                    <div style={{ display: "flex", gap: "20px", alignItems: "flex-start", flex: 1, minWidth: 0, overflow: "hidden" }}>
                      {/* Avatar Gigante */}
                      <div style={{ 
                        backgroundColor: avatarBg, 
                        width: "90px", 
                        height: "90px", 
                        borderRadius: "50%", 
                        display: "flex", 
                        alignItems: "center", 
                        justifyContent: "center",
                        flexShrink: 0,
                        boxShadow: "inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)"
                      }}>
                        {renderizarIconeAnimal(especie, false, iconColor, "large")}
                      </div>

                      {/* Coluna Central com Textos Seguros e Flexíveis */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1, minWidth: 0, overflow: "hidden" }}>
                        
                        {/* Código na Frente do Nome e Espécie/Raça */}
                        <div style={{ fontSize: "18px", fontWeight: "800", color: "#111827", lineHeight: "1.3", wordBreak: "break-word" }}>
                          <span style={{ color: "#4f46e5", marginRight: "6px" }}>{codigoFormatado}</span>
                          - {nomePet} <span style={{ fontWeight: "500", color: "#4b5563", fontSize: "15px" }}>({especie}{raca})</span>
                        </div>

                        {/* Tutor */}
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#4b5563", fontSize: "15px", wordBreak: "break-word" }}>
                          <FaUser size={14} color="#9ca3af" style={{ flexShrink: 0 }} />
                          <span>Tutor: <strong style={{ color: "#111827" }}>{nomeTutor}</strong></span>
                        </div>

                        {/* Sintomas com Quebra de Linha Limpa */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "2px", width: "100%", overflow: "hidden" }}>
                          <span style={{ fontSize: "14px", fontWeight: "600", color: "#9ca3af" }}>Sintomas / Queixa:</span>
                          {tagsSintomas.length === 0 ? (
                            <span style={{ fontSize: "14px", color: "#6b7280" }}>-</span>
                          ) : (
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                              {tagsSintomas.map((tag, idx) => {
                                const colors = obterCorSintoma(tag);
                                return (
                                  <span 
                                    key={idx}
                                    style={{ 
                                      backgroundColor: colors.bg, 
                                      color: colors.text, 
                                      padding: "4px 12px", 
                                      borderRadius: "20px", 
                                      fontSize: "13px",
                                      fontWeight: "700",
                                      wordBreak: "break-word"
                                    }}
                                  >
                                    {tag}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                          {item.queixa_principal && item.queixa_principal.length > 30 && tagsSintomas.length <= 1 && (
                            <p style={{ 
                              fontSize: "13px", 
                              color: "#4b5563", 
                              margin: 0, 
                              overflowWrap: "break-word", 
                              wordBreak: "break-word",
                              lineHeight: "1.4",
                              maxHeight: "3.8em",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical"
                            }}>
                              {item.queixa_principal}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Coluna Direita (Status e Botões de Ação) */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", justifyContent: "space-between", minHeight: "95px", flexShrink: 0, marginLeft: "16px" }}>
                      <span style={{ 
                        backgroundColor: estaSendoChamado ? "#fee2e2" : "#fef3c7", 
                        color: estaSendoChamado ? "#991b1b" : "#b45309", 
                        padding: "6px 12px", 
                        borderRadius: "20px", 
                        fontSize: "12px", 
                        fontWeight: "700",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
                        whiteSpace: "nowrap"
                      }}>
                        <FaClock size={12} color={estaSendoChamado ? "#991b1b" : "#b45309"} />
                        {estaSendoChamado ? "📢 Chamando..." : "Aguardando Triagem"}
                      </span>

                      <div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "16px" }}>
                        <button
                          onClick={(e) => chamarPaciente(item, e)}
                          title="Chamar no Painel"
                          style={{
                            backgroundColor: "#0284c7",
                            color: "white",
                            border: "none",
                            padding: "8px 12px",
                            borderRadius: "8px",
                            cursor: "pointer",
                            fontSize: "12px",
                            fontWeight: "600",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
                            transition: "background 0.2s"
                          }}
                        >
                          <MdCampaign size={16} /> Chamar
                        </button>

                        <button
                          onClick={() => selecionarParaTriagem(item)}
                          style={{
                            backgroundColor: "#4f46e5",
                            color: "white",
                            border: "none",
                            padding: "8px 14px",
                            borderRadius: "8px",
                            cursor: "pointer",
                            fontSize: "12px",
                            fontWeight: "600",
                            boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
                            transition: "background 0.2s"
                          }}
                        >
                          Iniciar Triagem
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
  fontSize: "12px",
  outline: "none",
  boxSizing: "border-box"
};

export default Triagem;