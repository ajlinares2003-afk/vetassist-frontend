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
import ModalConfirmacao from "../components/ModalConfirmacao";

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

// Classificação em 3 níveis (mesma regra da tela de Atendimento):
//   🟢 verde    -> dentro da faixa de REPOUSO
//   🟡 amarelo  -> fora do repouso, mas dentro do envelope clínico (estresse / consultório): reavaliar após repouso
//   🔴 vermelho -> fora do envelope das duas faixas (união de repouso e clínica)
// O limite do vermelho é a UNIÃO das faixas: usar só a clínica marcava como crítico valores que estão
// no repouso quando as faixas se sobrepõem de forma assimétrica (ex.: repouso 120-160 e clínica 130-180).
const avaliarSinal = (valor, refTexto, unidade, dica = "") => {
  const v = parseFloat(valor);
  if (isNaN(v)) return null;
  const { repouso, clinica } = extrairFaixas(refTexto);
  const faixas = [repouso, clinica].filter(Boolean);
  if (faixas.length === 0) return null; // sem referência confiável, não classifica
  const min = Math.min(...faixas.map((f) => f[0]));
  const max = Math.max(...faixas.map((f) => f[1]));
  if (v > max) return { nivel: "alto", texto: `Acima do limite clínico (≤ ${max} ${unidade})` };
  if (v < min) return { nivel: "baixo", texto: `Abaixo do limite clínico (≥ ${min} ${unidade})` };
  if (repouso && v > repouso[1]) return { nivel: "atencao", texto: `Acima da faixa de repouso (≤ ${repouso[1]} ${unidade})${dica}` };
  if (repouso && v < repouso[0]) return { nivel: "atencao", texto: `Abaixo da faixa de repouso (≥ ${repouso[0]} ${unidade})${dica}` };
  return { nivel: "ok", texto: "Dentro do esperado" };
};

const CORES_ALERTA = {
  alto: { cor: "#b91c1c", borda: "#fca5a5", bg: "#fef2f2", icone: "🔴" },
  baixo: { cor: "#b91c1c", borda: "#fca5a5", bg: "#fef2f2", icone: "🔴" },
  atencao: { cor: "#b45309", borda: "#fcd34d", bg: "#fffbeb", icone: "⚠️" },
  ok: { cor: "#15803d", borda: "#86efac", bg: "#f0fdf4", icone: "✓" },
};

const renderAlertaSinal = (alerta) =>
  alerta ? (
    <span style={{ fontSize: "10px", display: "block", marginTop: "3px", fontWeight: "500", color: CORES_ALERTA[alerta.nivel].cor }}>
      {CORES_ALERTA[alerta.nivel].icone} {alerta.texto}
    </span>
  ) : null;

const estiloAlerta = (alerta) =>
  alerta?.nivel === "ok"
    ? { ...estiloInput, border: `1px solid ${CORES_ALERTA.ok.borda}`, backgroundColor: "#ffffff", color: "#14532d", fontWeight: "600" }
    : alerta
    ? { ...estiloInput, border: `1px solid ${CORES_ALERTA[alerta.nivel].borda}`, backgroundColor: CORES_ALERTA[alerta.nivel].bg, color: CORES_ALERTA[alerta.nivel].cor, fontWeight: "700" }
    : estiloInput;

// TPC: referências como "Até 2 segundos" (limite superior) ou faixa "1 - 2". Igual à tela de Atendimento.
const avaliarTPC = (valor, refTexto) => {
  const v = parseFloat(valor);
  const t = String(refTexto || "");
  if (isNaN(v)) return null;
  const limite = t.match(/(?:menos de|at[eé]|inferior a|<|≤)\s*(\d+(?:[.,]\d+)?)/i);
  if (limite) {
    const max = parseFloat(limite[1].replace(",", "."));
    if (v <= max) return { nivel: "ok", texto: "Dentro do esperado" };
    // TPC de 3 s ou mais indica perfusão comprometida (mesmo corte da regra de emergência).
    return v >= 3 ? { nivel: "alto", texto: `Acima do esperado (≤ ${max} s): perfusão comprometida` }
                  : { nivel: "atencao", texto: `Acima do esperado (≤ ${max} s)` };
  }
  const faixa = t.match(/(\d+(?:[.,]\d+)?)\s*[-–]\s*(\d+(?:[.,]\d+)?)/);
  if (faixa) {
    const min = parseFloat(faixa[1].replace(",", "."));
    const max = parseFloat(faixa[2].replace(",", "."));
    return v >= min && v <= max ? { nivel: "ok", texto: "Dentro do esperado" } : { nivel: "atencao", texto: `Fora da faixa esperada (${min} - ${max} s)` };
  }
  return null;
};

const avaliarMucosas = (valor) => {
  const t = String(valor || "").trim();
  if (/^normocorada/i.test(t)) return { nivel: "ok", texto: "Dentro do esperado" };
  if (/cian[oó]tic/i.test(t)) return { nivel: "alto", texto: "Mucosa cianótica: sinal de hipoxemia, avaliar já" };
  return { nivel: "atencao", texto: "Mucosa alterada — avaliar" };
};

// Suspeita cardíaca na queixa: mucosa pálida e TPC prolongado refletem baixo débito, não desidratação.
const queixaSugereCardiopatia = (texto) => {
  const q = String(texto || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const cardiaco = /(sincope|desmai|cardiopat|cardiomiopat|sopro|arritmia|edema pulmonar|insuficiencia cardiaca|dispneia|esforco respirat|taquipneia|respiracao (mais )?(forcada|ofegante|dificil)|tosse noturna)/.test(q);
  const hidrico = /(desidrat|vomit|diarre|poliuria|polidipsia|nao (bebe|quer beber)|pele (seca|sem elasticidade))/.test(q);
  return cardiaco && !hidrico;
};

// Desidratação estimada: < 5% normal; 5 a 7% atenção; 8% ou mais, grave.
const avaliarDesidratacao = (valor) => {
  const v = parseFloat(valor);
  if (isNaN(v)) return null;
  if (v >= 8) return { nivel: "alto", texto: "Desidratação estimada grave (≥ 8%)" };
  if (v >= 5) return { nivel: "atencao", texto: "Desidratação estimada moderada (5 a 7%)" };
  return null;
};

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
  const queixaEstavel = useValorEstavel(queixaPrincipal);
  const reqIA = useRef(0);                   // só a avaliação mais recente pode mudar o nível (respostas fora de ordem causavam oscilação)
  const ultimaAssinaturaIA = useRef("");     // dados da última avaliação automática: sem mudança real, não reavalia
  const classificacaoManual = useRef(false);   // o veterinário escolheu o nível com o clique: a avaliação automática não o troca
  const autoAvaliacoes = useRef(0);            // limite de avaliações automáticas por atendimento (poupa a cota da IA)

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
      nomeCientifico: "",
      refAdultaFallback: false,
      correspondencia: null,
      validada: false
  });
  const [buscandoRefs, setBuscandoRefs] = useState(false);

  const [mensagem, setMensagem] = useState({ tipo: "", texto: "" });
  const [buscaFila, setBuscaFila] = useState("");
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
    classificacaoManual.current = false;
    autoAvaliacoes.current = 0;
    reqIA.current += 1;
    ultimaAssinaturaIA.current = "";
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
          refAdultaFallback: !!res.data.ref_adulta_fallback,
          correspondencia: res.data.correspondencia || null,
          validada: !!res.data.validada,
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
    const tpcNum = parseFloat(String(tpcSegundos).replace(",", "."));
    if (isNaN(tpcNum)) {
      setDesidratacao("");
      return;
    }

    // suspeita cardíaca sem sinal hídrico: não estimar desidratação por mucosas/TPC (evita induzir fluidoterapia)
    if (queixaSugereCardiopatia(queixaEstavel) && (tpcNum > 2 || !/^normocorada/i.test(String(mucosas || "")))) {
      setDesidratacao("");
      return;
    }

    if (tpcNum <= 2 && (mucosas === "Normocoradas" || /Congestas|Ict[ée]ricas/.test(String(mucosas || "")))) {
      // TPC normal com mucosa congesta (febre, excitação, sepse) ou ictérica não indica desidratação por si só
      setDesidratacao("0");
    } else if (tpcNum <= 2 && (mucosas.includes("Hipocoradas") || mucosas.includes("Pálidas"))) {
      setDesidratacao("5");
    } else if ((tpcNum >= 3 && tpcNum < 4) || mucosas.includes("Cianóticas")) {
      setDesidratacao("8");
    } else if (tpcNum >= 4) {
      setDesidratacao("10");
    } else {
      setDesidratacao("5");
    }
  }, [tpcSegundos, mucosas, queixaEstavel]);

  useEffect(() => {
    const tpcNum = parseFloat(String(tpcEstavel).replace(",", "."));
    const tpcCritico = !isNaN(tpcNum) && tpcNum >= 3 && tpcNum <= TPC_PLAUSIVEL[1];

    const tempNum = parseFloat(temperaturaEstavel);
    const tempPlausivel = !isNaN(tempNum) && tempNum >= TEMP_PLAUSIVEL[0] && tempNum <= TEMP_PLAUSIVEL[1];
    const tempCritica = tempPlausivel && (tempNum <= 35.0 || tempNum >= 40.5);
    const queixaNorm = String(queixaEstavel || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const queixaCritica = /inconsciente|inconsciencia|desmai|decubito/.test(queixaNorm);

    if (tpcCritico || tempCritica || queixaCritica) {
      if (!emergenciaAuto.current) {
        emergenciaAuto.current = { classificacao: classificacaoRisco, justificativa, origem: origemJustificativa };
      }
      setClassificacaoRisco("VERMELHO");
      setOrigemJustificativa("regra");

      const motivos = [];
      if (tpcCritico) motivos.push(`TPC ${tpcNum}s (perfusão comprometida)`);
      if (tempCritica) motivos.push(`Temperatura ${tempNum}°C`);
      if (queixaCritica) motivos.push("queixa compatível com inconsciência/decúbito");

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
  }, [tpcEstavel, temperaturaEstavel, queixaEstavel]);

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

  const sugerirClassificacaoIA = async (silencioso = false) => {
    if (!temperatura && !frequenciaCardiaca) {
      if (silencioso === true) return;
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
        tpc_segundos: tpcSegundos !== "" && !isNaN(parseFloat(tpcSegundos)) ? parseFloat(tpcSegundos) : null,
        mucosas: mucosas || "Normocoradas"
      };

      const assinatura = JSON.stringify({ ...payloadIA, ecc: null });
      if (silencioso === true && assinatura === ultimaAssinaturaIA.current) return;   // nada mudou desde a última avaliação
      ultimaAssinaturaIA.current = assinatura;
      const meuId = ++reqIA.current;

      let res;
      try {
        res = await api.post("/triagem/avaliar-ia", payloadIA, config);
      } catch (e) {
        if (meuId === reqIA.current) ultimaAssinaturaIA.current = "";   // falhou: permite tentar de novo
        throw e;
      }
      if (meuId !== reqIA.current) return;   // chegou uma resposta mais nova (ou outro paciente): descarta esta
      if (silencioso === true && classificacaoManual.current) return;   // escolheu enquanto a IA respondia
      if (res.data?.classificacao_risco) {
        setClassificacaoRisco(res.data.classificacao_risco);
        setJustificativa(res.data.justificativa || "");
        setOrigemJustificativa(res.data.origem === "REGRA_FISICA" ? "regra" : "ia");
      }
    } catch (err) {
      console.warn("Aviso ao consultar IA na Triagem:", err);
    }
  };

  // Avaliação automática do nível de urgência: roda sozinha quando os sinais vitais e a queixa estabilizam,
  // sem o veterinário precisar clicar em "Avaliar com IA". Não troca um nível escolhido à mão, não roda se a
  // regra de emergência já classificou, e é limitada a poucas chamadas por atendimento (poupa a cota da IA).
  useEffect(() => {
    if (!atendimentoSelecionado || classificacaoManual.current || emergenciaAuto.current) return;
    if (!temperaturaEstavel || !fcEstavel || !String(queixaEstavel || "").trim()) return;
    if (autoAvaliacoes.current >= 5) return;
    const t = setTimeout(() => {
      if (classificacaoManual.current || emergenciaAuto.current) return;
      autoAvaliacoes.current += 1;
      sugerirClassificacaoIA(true);
    }, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atendimentoSelecionado, queixaEstavel, temperaturaEstavel, fcEstavel, frEstavel, tpcEstavel, mucosas]);

  const [confirmarUrgente, setConfirmarUrgente] = useState(false);

  const salvarTriagemExistente = async (jaConfirmou = false) => {
    if (!queixaPrincipal) return setMensagem({ tipo: "erro", texto: "Informe a queixa principal do paciente." });

    if (sugerirUrgente && jaConfirmou !== true) {
      setConfirmarUrgente(true);
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
        tpc_segundos: tpcSegundos !== "" && !isNaN(parseFloat(tpcSegundos)) ? parseFloat(tpcSegundos) : null,
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

  // Sem referência para a faixa etária do paciente (usou-se a de adulto): não classifica temperatura, FC e FR
  // (nem dispara a sugestão de Urgente por eles), igual à tela de Atendimento.
  const semFaixaEtaria = refsDinamicas.refAdultaFallback;
  const alertaTemp = semFaixaEtaria ? null : avaliarSinal(temperatura, refsDinamicas.temp, "°C", " — reavaliar após repouso");
  const alertaFC = semFaixaEtaria ? null : avaliarSinal(frequenciaCardiaca, refsDinamicas.fc, "bpm", " — reavaliar após repouso");
  const alertaFR = semFaixaEtaria ? null : avaliarSinal(frequenciaRespiratoria, refsDinamicas.fr, "ir/min", " — reavaliar após repouso");

  const alertaTPC = avaliarTPC(tpcSegundos, refsDinamicas.tpc);
  const alertaMucosas = mucosas ? avaliarMucosas(mucosas) : null;
  const alertaDesidratacaoNivel = avaliarDesidratacao(desidratacao);

  const alertaDesidratacao = (() => {
    if (alertaDesidratacaoNivel) return alertaDesidratacaoNivel;
    if (desidratacao === "" && queixaSugereCardiopatia(queixaEstavel) && (parseFloat(String(tpcSegundos).replace(",", ".")) > 2 || (mucosas && !/^normocorada/i.test(mucosas)))) {
      return { nivel: "atencao", texto: "Suspeita cardíaca: mucosa pálida/TPC prolongado indicam baixo débito, não desidratação. Evitar fluidoterapia sem avaliação." };
    }
    if (desidratacao === "" || parseInt(desidratacao) !== 0) return null;
    const q = normalizarTexto(queixaPrincipal);
    const sugereHidrico = /(bebe\w* mais|mais agua|polidipsia|urin\w* (com )?mais|poliuria|vomit|diarre|nao (bebe|quer beber))/.test(q);
    return sugereHidrico
      ? { nivel: "atencao", texto: "Avaliar consumo hídrico relatado (TPC/mucosas podem não refletir)" }
      : null;
  })();

  const alertaTempEstavel = semFaixaEtaria ? null : avaliarSinal(temperaturaEstavel, refsDinamicas.temp, "°C");
  const alertaFCEstavel = semFaixaEtaria ? null : avaliarSinal(fcEstavel, refsDinamicas.fc, "bpm");
  const alertaFREstavel = semFaixaEtaria ? null : avaliarSinal(frEstavel, refsDinamicas.fr, "ir/min");
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
          {["porte", "grupo"].includes(refsDinamicas.correspondencia) && ecc && (
            <span style={{ fontSize: "10px", color: "#b45309", display: "block", marginTop: "3px" }}>
              ⚠️ Estimado pelo peso com perfil escolhido só pelo porte: confirme pela palpação
            </span>
          )}
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
          <input type="number" step="0.1" min="0" value={tpcSegundos} onChange={(e) => setTpcSegundos(e.target.value)} style={estiloAlerta(alertaTPC)} placeholder="Ex: 2" />
          <span style={{ fontSize: "10px", color: "#0284c7", display: "block", marginTop: "3px" }}>💡 {refsDinamicas.tpc}</span>
          {renderAlertaSinal(alertaTPC)}
        </div>

        <div>
          <label style={{ fontSize: "12px", fontWeight: "600", color: "#374151", marginBottom: "4px", display: "block" }}>Mucosas</label>
          <select value={mucosas} onChange={(e) => setMucosas(e.target.value)} style={alertaMucosas && alertaMucosas.nivel !== "ok" ? estiloAlerta(alertaMucosas) : estiloInput}>
            <option value="Normocoradas">Normocoradas (Rosadas)</option>
            <option value="Hipocoradas / Pálidas">Hipocoradas / Pálidas</option>
            <option value="Cianóticas">Cianóticas (Roxas)</option>
            <option value="Ictéricas">Ictéricas (Amareladas)</option>
            <option value="Congestas / Hiperêmicas">Congestas / Vermelhas</option>
          </select>
          <span style={{ fontSize: "10px", color: "#0284c7", display: "block", marginTop: "3px" }}>{refsDinamicas.mucosasRef}</span>
          {alertaMucosas && alertaMucosas.nivel !== "ok" ? renderAlertaSinal(alertaMucosas) : null}
        </div>
      </div>

      {/* LINHA 3 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "16px", alignItems: "start" }}>
        <div>
          <label style={{ fontSize: "12px", fontWeight: "600", color: "#374151", marginBottom: "4px", display: "block" }}>Desidratação (%) — IA</label>
          <input type="number" value={desidratacao} onChange={(e) => setDesidratacao(e.target.value)} style={alertaDesidratacaoNivel ? estiloAlerta(alertaDesidratacaoNivel) : { ...estiloInput, backgroundColor: "#f0fdf4", color: "#166534", fontWeight: "600" }} placeholder="Auto-calculado..." />
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
            {!refsDinamicas.validada && !String(refsDinamicas.fonteRef).includes("PENDENTE") && !String(refsDinamicas.fonteRef).includes("RASCUNHO") ? "* ⚠️ Referência ainda não validada por veterinário. " : ""}{refsDinamicas.fonteRef}
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

  const nomeDoPet = (item) => animais.find((x) => x.id === Number(item.animal_id));
  const filaFiltrada = atendimentosPendentes.filter((item) => {
    const termo = buscaFila.trim().toLowerCase();
    if (!termo) return true;
    const a = nomeDoPet(item);
    const t = a ? tutores.find((tt) => tt.id === a.tutor_id) : null;
    const cod = item.codigo || `CNS-${String(item.id).padStart(4, "0")}`;
    return `${cod} ${a?.nome || ""} ${t?.nome || ""} ${item.queixa_principal || ""}`.toLowerCase().includes(termo);
  });
  const qtdChamando = atendimentosPendentes.filter((i) => i.status === "Chamando para Triagem").length;

  return (
    <Layout>
      <style>{CSS_TRIAGEM}</style>
      <div className="tg-hero">
        <div>
          <h1><MdMedicalServices size={30} /> Check-in & Triagem</h1>
          <p>Classificação de risco pelo Protocolo Manchester</p>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          {atualizandoSilencioso && <span className="tg-sync">Sincronizando...</span>}
          <button className="tg-btn-hero" onClick={() => carregarDados(true)}><MdRefresh size={18} /> Atualizar</button>
        </div>
      </div>

      {mensagem.texto && (
        <div style={{ backgroundColor: mensagem.tipo === "sucesso" ? "#ecfdf5" : "#fef2f2", color: mensagem.tipo === "sucesso" ? "#065f46" : "#991b1b", border: `1px solid ${mensagem.tipo === "sucesso" ? "#a7f3d0" : "#fecaca"}`, padding: "12px 16px", borderRadius: "12px", marginBottom: "16px", fontWeight: "600" }}>
          {mensagem.texto}
        </div>
      )}

      {atendimentoSelecionado ? (
        <div style={{ backgroundColor: "white", padding: "26px", borderRadius: "20px", border: "1px solid #e2e8f0", boxShadow: "0 10px 30px -18px rgba(15,23,42,0.35)" }}>
          <div className="tg-paciente">
            <div className="tg-paciente-ico">🩺</div>
            <div>
              <div style={{ fontSize: "12px", fontWeight: 800, color: "#0f766e", letterSpacing: ".6px", textTransform: "uppercase" }}>Aferição de sinais vitais</div>
              <div style={{ fontSize: "17px", fontWeight: 800, color: "#0f172a", marginTop: "2px" }}>{obterHeaderDetalhado(atendimentoSelecionado)}</div>
            </div>
          </div>

          {renderFormularioSinaisVitais()}

          <div style={{ marginBottom: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <label style={{ fontSize: "13px", fontWeight: "700", color: "#111827" }}>Nível de Urgência (Manchester)</label>
              <button type="button" onClick={() => { classificacaoManual.current = false; sugerirClassificacaoIA(); }} style={{ backgroundColor: "#f0f9ff", color: "#0284c7", border: "1px solid #bae6fd", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontWeight: "600", display: "flex", alignItems: "center", gap: "6px" }}>
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
                    onClick={() => { classificacaoManual.current = true; setClassificacaoRisco(cor); }}
                    style={{
                      padding: "14px 6px",
                      borderRadius: "14px",
                      border: selecionado ? `2px solid ${item.text}` : `1px solid ${item.border}`,
                      backgroundColor: selecionado ? item.bg : item.inactiveBg,
                      color: item.text,
                      fontWeight: selecionado ? "700" : "600",
                      fontSize: "13px",
                      cursor: "pointer",
                      textAlign: "center",
                      boxShadow: selecionado ? `0 6px 16px -8px ${item.text}` : "none",
                      transform: selecionado ? "translateY(-1px)" : "none",
                      transition: "all 0.15s ease-in-out"
                    }}
                  >
                    <span style={{ display: "block", width: "10px", height: "10px", borderRadius: "50%", backgroundColor: item.text, margin: "0 auto 6px", opacity: selecionado ? 1 : 0.45 }} />
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
            <button onClick={() => salvarTriagemExistente()} disabled={carregando} style={{ backgroundColor: "#16a34a", color: "white", border: "none", padding: "12px 30px", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "14px" }}>{carregando ? "Enviando..." : "Finalizar Triagem"}</button>
          </div>
        </div>
      ) : (
        <div>
          <div className="tg-kpis">
            <div className="tg-kpi"><b>{atendimentosPendentes.length}</b><span>Na fila de espera</span></div>
            <div className="tg-kpi"><b style={{ color: qtdChamando ? "#dc2626" : "#0f172a" }}>{qtdChamando}</b><span>Sendo chamados</span></div>
            <div className="tg-busca">
              <input placeholder="Buscar por pet, tutor, código ou sintoma..." value={buscaFila} onChange={(e) => setBuscaFila(e.target.value)} />
            </div>
          </div>

          {atendimentosPendentes.length === 0 ? (
            <div className="tg-vazio">
              <div style={{ fontSize: "46px" }}>🐾</div>
              <p style={{ fontSize: "17px", fontWeight: 800, color: "#334155", margin: "6px 0 4px" }}>Nenhum paciente aguardando triagem</p>
              <p style={{ fontSize: "13px", margin: 0 }}>Os pacientes aparecem aqui assim que fazem o check-in na recepção.</p>
            </div>
          ) : filaFiltrada.length === 0 ? (
            <div className="tg-vazio"><p style={{ margin: 0, fontWeight: 700 }}>Nenhum paciente encontrado para "{buscaFila}".</p></div>
          ) : (
            <div className="tg-grid">
              {filaFiltrada.map((item) => {
                const a = nomeDoPet(item);
                const t = a ? tutores.find((tutor) => tutor.id === a.tutor_id) : null;
                const nomePet = a ? a.nome : "Paciente desconhecido";
                const especie = a?.especie || "Pet";
                const raca = a?.raca ? ` · ${a.raca}` : "";
                const nomeTutor = t ? t.nome : "Tutor não vinculado";
                const codigoFormatado = item.codigo || `CNS-${String(item.id).padStart(4, "0")}`;
                const tagsSintomas = (item.queixa_principal || "").split(",").map((tag) => tag.trim()).filter(Boolean);
                const MAX_TAGS = 4;
                const tagsVisiveis = tagsSintomas.slice(0, MAX_TAGS);
                const tagsOcultas = tagsSintomas.slice(MAX_TAGS);
                const avatarBg = obterCorAvatar(especie);
                const iconColor = obterCorIcone(especie);
                const estaSendoChamado = item.status === "Chamando para Triagem";

                return (
                  <div key={item.id} className={`tg-card ${estaSendoChamado ? "chamando" : ""}`}>
                    <div className="tg-card-top">
                      <div className="tg-avatar" style={{ backgroundColor: avatarBg }}>
                        {renderizarIconeAnimal(especie, false, iconColor, "large")}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="tg-cod">{codigoFormatado}</div>
                        <div className="tg-nome" title={`${nomePet} (${especie}${raca})`}>{nomePet}</div>
                        <div className="tg-especie" title={`${especie}${raca}`}>{especie}{raca}</div>
                      </div>
                      <span className={`tg-status ${estaSendoChamado ? "chamando" : ""}`}>
                        <FaClock size={11} /> {estaSendoChamado ? "Chamando..." : "Aguardando"}
                      </span>
                    </div>

                    <div className="tg-tutor" title={nomeTutor}><FaUser size={12} color="#94a3b8" /> Tutor: <strong>{nomeTutor}</strong></div>

                    <div className="tg-queixa" title={item.queixa_principal || ""}>
                      <span className="tg-lbl">Sintomas / queixa</span>
                      {tagsSintomas.length === 0 ? (
                        <span style={{ fontSize: "13px", color: "#94a3b8" }}>Não informado</span>
                      ) : (
                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                          {tagsVisiveis.map((tag, idx) => {
                            const colors = obterCorSintoma(tag);
                            return <span key={idx} className="tg-tag" title={tag} style={{ backgroundColor: colors.bg, color: colors.text }}>{tag}</span>;
                          })}
                          {tagsOcultas.length > 0 && <span className="tg-tag" title={tagsOcultas.join(", ")} style={{ backgroundColor: "#f1f5f9", color: "#475569" }}>+{tagsOcultas.length}</span>}
                        </div>
                      )}
                    </div>

                    <div className="tg-acoes">
                      <button className="tg-b chamar" onClick={(e) => chamarPaciente(item, e)} title="Chamar no painel"><MdCampaign size={17} /> Chamar</button>
                      <button className="tg-b iniciar" onClick={() => selecionarParaTriagem(item)}>Iniciar triagem →</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    <ModalConfirmacao aberto={confirmarUrgente} titulo="Revisar a classificação de risco"
        mensagem={<>Há sinais acima do limite ({sinaisAlterados.join(", ")}) junto com {sintomasGatilho.join(", ")}, mas a classificação está como <strong>{CORES_MANCHESTER[classificacaoRisco]?.nome}</strong>. Deseja finalizar a triagem assim mesmo?</>}
        rotuloConfirmar="Finalizar assim mesmo" rotuloCancelar="Revisar classificação" tom="aviso"
        onCancelar={() => setConfirmarUrgente(false)}
        onConfirmar={() => { setConfirmarUrgente(false); salvarTriagemExistente(true); }} />
    </Layout>
  );
}

const CSS_TRIAGEM = `
.tg-hero,.tg-kpis,.tg-card,.tg-paciente,.tg-vazio{text-align:left}.tg-vazio{text-align:center}
.tg-hero{background:linear-gradient(135deg,#be123c 0%,#e11d48 55%,#fb7185 100%);border-radius:20px;padding:20px 26px;color:#fff;display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;box-shadow:0 10px 30px -14px rgba(225,29,72,.6);margin-bottom:18px}
.tg-hero h1{margin:0;font-size:24px;font-weight:800;display:flex;align-items:center;gap:10px;letter-spacing:-.3px}
.tg-hero p{margin:4px 0 0;font-size:13px;opacity:.9}
.tg-btn-hero{background:#fff;color:#be123c;border:none;padding:10px 16px;border-radius:12px;font-weight:700;font-size:14px;cursor:pointer;display:flex;align-items:center;gap:6px;box-shadow:0 4px 14px rgba(0,0,0,.14);font-family:inherit}
.tg-btn-hero:hover{filter:brightness(.96)}
.tg-sync{font-size:12px;font-weight:600;color:#ffe4e6}
.tg-kpis{display:grid;grid-template-columns:160px 160px 1fr;gap:12px;margin-bottom:16px;align-items:stretch}
.tg-kpi{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:12px 16px}
.tg-kpi b{display:block;font-size:26px;font-weight:800;line-height:1.1;color:#0f172a}
.tg-kpi span{font-size:12px;color:#64748b;font-weight:600}
.tg-busca{display:flex;align-items:center}
.tg-busca input{width:100%;height:100%;min-height:50px;border:1px solid #e2e8f0;border-radius:16px;padding:0 16px;font-size:14px;outline:none;background:#fff;font-family:inherit;box-sizing:border-box}
.tg-busca input:focus{border-color:#e11d48;box-shadow:0 0 0 3px rgba(225,29,72,.12)}
.tg-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:16px}
.tg-card{background:#fff;border:1px solid #e2e8f0;border-radius:20px;padding:18px;display:flex;flex-direction:column;gap:12px;transition:box-shadow .15s,transform .15s;position:relative;overflow:hidden}
.tg-card::before{content:"";position:absolute;left:0;top:0;bottom:0;width:5px;background:#f59e0b}
.tg-card.chamando::before{background:#dc2626}
.tg-card.chamando{background:#fff7f7;border-color:#fecaca;animation:tgPulse 1.6s ease-in-out infinite}
.tg-card:hover{box-shadow:0 14px 28px -16px rgba(15,23,42,.4);transform:translateY(-2px)}
@keyframes tgPulse{0%,100%{box-shadow:0 0 0 0 rgba(220,38,38,.25)}50%{box-shadow:0 0 0 6px rgba(220,38,38,0)}}
.tg-card-top{display:flex;align-items:center;gap:12px}
.tg-avatar{width:58px;height:58px;border-radius:18px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.tg-cod{font-size:11.5px;font-weight:800;color:#4f46e5;letter-spacing:.3px}
.tg-nome{font-size:18px;font-weight:800;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.25}
.tg-especie{font-size:12.5px;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tg-status{font-size:11.5px;font-weight:800;padding:5px 10px;border-radius:99px;background:#fef3c7;color:#b45309;display:flex;align-items:center;gap:5px;white-space:nowrap;align-self:flex-start}
.tg-status.chamando{background:#fee2e2;color:#991b1b}
.tg-tutor{font-size:13.5px;color:#475569;display:flex;align-items:center;gap:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tg-tutor strong{color:#0f172a}
.tg-lbl{display:block;font-size:11px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px}
.tg-queixa{min-height:54px}
.tg-tag{padding:4px 11px;border-radius:99px;font-size:12.5px;font-weight:700;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tg-acoes{display:flex;gap:8px;margin-top:auto}
.tg-b{border:none;border-radius:12px;padding:10px 14px;font-weight:700;font-size:13px;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:6px;transition:filter .15s}
.tg-b:hover{filter:brightness(.94)}
.tg-b.chamar{background:#e0f2fe;color:#0369a1}
.tg-b.iniciar{background:#4f46e5;color:#fff;flex:1;box-shadow:0 6px 14px -8px #4f46e5}
.tg-vazio{background:#fff;border:2px dashed #cbd5e1;border-radius:20px;text-align:center;padding:46px 20px;color:#64748b}
.tg-paciente{display:flex;align-items:center;gap:14px;background:linear-gradient(135deg,#f0fdfa,#ecfeff);border:1px solid #99f6e4;border-radius:16px;padding:14px 18px;margin-bottom:20px}
.tg-paciente-ico{width:46px;height:46px;border-radius:14px;background:#ccfbf1;display:flex;align-items:center;justify-content:center;font-size:22px}
@media (max-width:760px){.tg-kpis{grid-template-columns:1fr 1fr}.tg-busca{grid-column:1 / -1}.tg-grid{grid-template-columns:1fr}}
`;

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