import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { MdMedicalServices, MdAutoAwesome, MdAdd, MdDelete, MdWarning, MdPrint, MdSearch, MdRefresh, MdClose, MdEdit, MdPerson, MdPets, MdVisibility, MdErrorOutline, MdCheckCircle } from "react-icons/md";
import { FaDog, FaCat, FaHorse, FaDove, FaFish, FaFrog, FaBug } from "react-icons/fa";
import { GiRabbit, GiCow, GiPig, GiSheep, GiGoat } from "react-icons/gi";
import api from "../api/api";
import Layout from "../components/Layout";

const TIPO_VET = "Uso Veterinário (Pet Shop / Agropecuária)";
const TIPO_HUMANO = "Uso Humano (Drogaria Comum)";
const TIPO_CONTROLE = "Controle Especial (Retenção de Receita - 2 Vias)";
const ITEM_VAZIO = { medicamento: "", dosagem: "", frequencia: "", duracao: "", tipo_uso: TIPO_VET, observacoes: "" };

const PERIODOS = [
  { valor: 7, rotulo: "Últimos 7 dias" },
  { valor: 30, rotulo: "Últimos 30 dias" },
  { valor: 90, rotulo: "Últimos 90 dias" },
  { valor: 365, rotulo: "Último ano" },
  { valor: 0, rotulo: "Todo o período" },
];

const ESPECIES = [
  { chaves: ["bovino", "vaca", "boi", "touro"], Icone: GiCow, bg: "#f5f5f4", cor: "#44403c" },
  { chaves: ["suíno", "suino", "porco"], Icone: GiPig, bg: "#ffe4e6", cor: "#e11d48" },
  { chaves: ["ovino", "ovelha", "carneiro"], Icone: GiSheep, bg: "#f1f5f9", cor: "#475569" },
  { chaves: ["caprino", "cabra", "bode"], Icone: GiGoat, bg: "#ecfdf5", cor: "#047857" },
  { chaves: ["equino", "cavalo", "égua", "ponei"], Icone: FaHorse, bg: "#fef3c7", cor: "#b45309" },
  { chaves: ["lagomorfo", "coelho", "lebre"], Icone: GiRabbit, bg: "#fef3c7", cor: "#b45309" },
  { chaves: ["felino", "gato"], Icone: FaCat, bg: "#fce7f3", cor: "#be185d" },
  { chaves: ["canino", "cão", "cachorro"], Icone: FaDog, bg: "#dbeafe", cor: "#1d4ed8" },
  { chaves: ["ave", "pássaro", "calopsita"], Icone: FaDove, bg: "#e0f2fe", cor: "#0369a1" },
  { chaves: ["peixe", "aquático", "tilápia"], Icone: FaFish, bg: "#cffafe", cor: "#0e7490" },
  { chaves: ["réptil", "lagarto", "cobra", "tartaruga"], Icone: FaFrog, bg: "#dcfce7", cor: "#15803d" },
  { chaves: ["inseto", "aracnídeo"], Icone: FaBug, bg: "#f3f4f6", cor: "#4b5563" },
];
const estiloEspecie = (especie) => {
  const esp = (especie || "").toLowerCase();
  return ESPECIES.find((e) => e.chaves.some((k) => esp.includes(k))) || { Icone: MdPets, bg: "#f3f4f6", cor: "#4b5563" };
};

const semAcento = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const formatarDataHora = (iso) => {
  if (!iso) return { data: "-", hora: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { data: "-", hora: "" };
  return {
    data: d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }),
    hora: d.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }),
  };
};

const SUBSTANCIAS_CONTROLADAS = [
  "tramadol", "fenobarbital", "morfina", "ketamina", "cetamina", "diazepam",
  "metadona", "methadona", "fentanil", "fentanila", "midazolam", "tiletamina", "zolazepam",
];

const ehControlado = (item) => {
  const nome = (item.medicamento || "").toLowerCase();
  return (item.tipo_uso || "").includes("Controle Especial") || SUBSTANCIAS_CONTROLADAS.some((s) => nome.includes(s));
};
const temControlado = (lista = []) => lista.some(ehControlado);

const CSS = `
.rx-root, .rx-root * { box-sizing: border-box; }
.rx-root * { text-align: left; }
.rx-root { color: #0f172a; font-family: inherit; }
.rx-hero { border-radius: 22px; padding: 22px 26px; margin-bottom: 18px; background: linear-gradient(120deg, #eef2ff 0%, #f5f3ff 55%, #ecfeff 100%); border: 1px solid #c7d2fe; }
.rx-hero-top { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
.rx-titulo { display: flex; align-items: center; gap: 14px; }
.rx-icone { width: 52px; height: 52px; border-radius: 16px; background: #4f46e5; color: #fff; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 18px rgba(79,70,229,.28); }
.rx-hero h1 { margin: 0; font-size: 25px; font-weight: 800; color: #1e1b4b; letter-spacing: -.3px; }
.rx-hero p { margin: 3px 0 0; font-size: 13.5px; color: #475569; }
.rx-stats { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 16px; }
.rx-stat { background: rgba(255,255,255,.9); border: 1px solid #e2e8f0; border-radius: 14px; padding: 10px 16px; min-width: 120px; }
.rx-stat b { display: block; font-size: 22px; font-weight: 800; color: #1e1b4b; line-height: 1.1; }
.rx-stat span { font-size: 12px; color: #64748b; font-weight: 600; }
.rx-stat.ctl b { color: #b45309; }
.rx-filtros { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin-bottom: 14px; }
.rx-busca { position: relative; flex: 1; min-width: 240px; }
.rx-busca svg { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #94a3b8; }
.rx-input, .rx-select, .rx-area { border: 1px solid #d1d5db; border-radius: 12px; background: #fff; font-size: 14px; color: #0f172a; outline: none; padding: 0 14px; font-family: inherit; width: 100%; }
.rx-input, .rx-select { height: 44px; }
.rx-area { padding: 10px 14px; resize: vertical; }
.rx-filtros .rx-select { width: auto; }
.rx-busca .rx-input { padding-left: 40px; }
.rx-input:focus, .rx-select:focus, .rx-area:focus { border-color: #818cf8; box-shadow: 0 0 0 3px rgba(129,140,248,.25); }
.rx-seg { display: inline-flex; background: #f1f5f9; border-radius: 12px; padding: 4px; gap: 2px; }
.rx-seg button { border: none; background: transparent; padding: 8px 14px; border-radius: 9px; font-weight: 700; font-size: 13px; color: #475569; cursor: pointer; font-family: inherit; }
.rx-seg button.on { background: #fff; color: #4338ca; box-shadow: 0 1px 3px rgba(15,23,42,.12); }
.rx-btn { display: inline-flex; align-items: center; gap: 7px; border: none; border-radius: 12px; padding: 10px 16px; font-weight: 700; font-size: 13.5px; cursor: pointer; font-family: inherit; transition: filter .15s, transform .15s; }
.rx-btn:hover { filter: brightness(.95); transform: translateY(-1px); }
.rx-btn:disabled { opacity: .6; cursor: default; transform: none; }
.rx-btn.roxo { background: #4f46e5; color: #fff; }
.rx-btn.verde { background: #16a34a; color: #fff; }
.rx-btn.azul { background: #0284c7; color: #fff; }
.rx-btn.claro { background: #e0e7ff; color: #3730a3; }
.rx-btn.cinza { background: #f1f5f9; color: #334155; }
.rx-btn.amarelo { background: #fef3c7; color: #92400e; }
.rx-btn.vermelho { background: #fee2e2; color: #b91c1c; }
.rx-btn.perigo { background: #dc2626; color: #fff; }
.rx-btn.mini { padding: 8px 10px; }
.rx-lista { display: grid; gap: 12px; }
.rx-card { display: grid; grid-template-columns: minmax(200px, 1.1fr) minmax(220px, 2fr) auto; gap: 18px; align-items: center; background: #fff; border: 1px solid #e5e7eb; border-radius: 18px; padding: 16px 18px; box-shadow: 0 2px 6px rgba(15,23,42,.05); transition: box-shadow .18s, transform .18s; }
.rx-card:hover { box-shadow: 0 12px 22px rgba(15,23,42,.10); transform: translateY(-1px); }
.rx-card.clinica { background: #f8fafc; }
.rx-pac { display: flex; align-items: center; gap: 12px; min-width: 0; }
.rx-av { width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.rx-nome { font-size: 16px; font-weight: 800; color: #0f172a; overflow-wrap: anywhere; }
.rx-sub { font-size: 12.5px; color: #64748b; display: flex; gap: 6px; align-items: center; flex-wrap: wrap; margin-top: 2px; }
.rx-cod { font-size: 11px; font-weight: 800; color: #4338ca; background: #e0e7ff; border-radius: 99px; padding: 2px 8px; }
.rx-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.rx-chip { font-size: 12.5px; font-weight: 600; padding: 4px 10px; border-radius: 99px; background: #eef2ff; color: #3730a3; border: 1px solid #c7d2fe; }
.rx-chip.ctl { background: #fffbeb; color: #92400e; border-color: #fcd34d; }
.rx-lado { display: flex; flex-direction: column; gap: 8px; align-items: flex-end; }
.rx-lado, .rx-lado * { text-align: right; }
.rx-lado .dt { font-size: 13px; color: #475569; font-weight: 600; }
.rx-tags { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
.rx-tag { font-size: 11px; font-weight: 800; padding: 3px 9px; border-radius: 99px; white-space: nowrap; }
.rx-tag.tutor { background: #dcfce7; color: #166534; }
.rx-tag.clinica { background: #e2e8f0; color: #334155; }
.rx-tag.ctl { background: #fef3c7; color: #92400e; }
.rx-acoes { display: flex; gap: 6px; }
.rx-vazio { background: #fff; border: 2px dashed #e2e8f0; border-radius: 18px; padding: 44px 20px; color: #64748b; }
.rx-vazio, .rx-vazio * { text-align: center; }
.rx-msg { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: 12px; font-weight: 600; font-size: 14px; margin-bottom: 14px; }
.rx-msg.erro { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }
.rx-msg.ok { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; }
.rx-form { background: #fff; border: 1px solid #e5e7eb; border-radius: 18px; padding: 22px; margin-bottom: 18px; box-shadow: 0 6px 16px rgba(15,23,42,.06); }
.rx-form h3 { margin: 0 0 16px; font-size: 18px; color: #111827; }
.rx-aviso { display: flex; gap: 10px; align-items: flex-start; border-radius: 12px; padding: 12px 14px; margin-bottom: 14px; font-size: 13px; }
.rx-aviso.amarelo { background: #fffbeb; border: 1px solid #fde68a; color: #92400e; }
.rx-aviso.verde { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; align-items: center; justify-content: space-between; }
.rx-aviso.azul { background: #f0f9ff; border: 1px solid #bae6fd; color: #0369a1; align-items: center; justify-content: space-between; font-weight: 700; }
.rx-parecer { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; margin-bottom: 16px; }
.rx-parecer h4 { margin: 0 0 8px; font-size: 13px; color: #334155; }
.rx-parecer div { background: #fff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; font-size: 13px; line-height: 1.6; color: #334155; max-height: 120px; overflow-y: auto; white-space: pre-line; }
.rx-label { display: block; font-size: 12.5px; font-weight: 700; color: #374151; margin-bottom: 5px; }
.rx-item { background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 14px; padding: 14px; margin-bottom: 12px; }
.rx-item-topo { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 13px; font-weight: 800; color: #4f46e5; }
.rx-grid4 { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; }
.rx-grid2 { display: grid; grid-template-columns: 1fr 2fr; gap: 12px; margin-top: 10px; }
.rx-form-fim { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; padding-top: 14px; border-top: 1px solid #f1f5f9; flex-wrap: wrap; }
.rx-overlay { position: fixed; inset: 0; background: rgba(15,23,42,.55); backdrop-filter: blur(3px); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 16px; }
.rx-modal { background: #fff; border-radius: 20px; width: 100%; max-width: 720px; max-height: calc(100vh - 32px); overflow-y: auto; padding: 32px; box-shadow: 0 30px 60px rgba(15,23,42,.3); }
.rx-modal.peq { max-width: 420px; padding: 28px; }
.rx-modal.peq, .rx-modal.peq * { text-align: center; }
.rx-doc-topo { border-bottom: 2px solid #4f46e5; padding-bottom: 14px; margin-bottom: 18px; }
.rx-doc-topo, .rx-doc-topo * { text-align: center; }
.rx-doc-topo h2 { margin: 0; font-size: 22px; color: #1e1b4b; }
.rx-doc-topo p { margin: 4px 0 0; font-size: 12px; font-weight: 800; color: #4f46e5; text-transform: uppercase; letter-spacing: .5px; }
.rx-doc-dados { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px; font-size: 13px; display: grid; gap: 4px; margin-bottom: 18px; }
.rx-doc-med { margin-bottom: 14px; padding-bottom: 10px; border-bottom: 1px dashed #e5e7eb; font-size: 13px; color: #1f2937; line-height: 1.5; page-break-inside: avoid; break-inside: avoid; }
.rx-doc-med .nm { font-size: 15px; font-weight: 800; color: #4338ca; margin-bottom: 4px; }
.rx-badge { display: inline-block; font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 6px; margin-bottom: 6px; }
.rx-badge.vet { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
.rx-badge.hum { background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; }
.rx-badge.ctl { background: #fef3c7; color: #b45309; border: 1px solid #fcd34d; }
.rx-doc-obs { margin-top: 4px; background: #fffbeb; padding: 6px 8px; border-radius: 6px; border: 1px solid #fef3c7; font-size: 11.5px; color: #92400e; }
.rx-doc-geral { margin-top: 12px; background: #f8fafc; padding: 10px; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 12.5px; }
.rx-comprador { margin-top: 16px; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; background: #fafafa; font-size: 10.5px; color: #334155; }
.rx-comprador div.l { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 6px; margin-bottom: 4px; }
.rx-doc-assina { margin-top: 36px; }
.rx-doc-assina, .rx-doc-assina * { text-align: center; }
.rx-acoes-modal { display: flex; justify-content: flex-end; gap: 10px; margin-top: 24px; padding-top: 14px; border-top: 1px solid #f1f5f9; }
@media screen { .rx-via + .rx-via { border-top: 2px dashed #cbd5e1; margin-top: 8px; padding-top: 24px; } }
@media (max-width: 860px) {
  .rx-card { grid-template-columns: 1fr; }
  .rx-lado { align-items: flex-start; }
  .rx-lado, .rx-lado * { text-align: left; }
  .rx-tags { justify-content: flex-start; }
  .rx-grid2 { grid-template-columns: 1fr; }
  .rx-comprador div.l { grid-template-columns: 1fr; }
}
@media print {
  @page { size: A4 portrait; margin: 10mm 12mm; }
  body, html { width: 100% !important; height: auto !important; margin: 0 !important; padding: 0 !important; background: #fff !important; }
  body * { visibility: hidden !important; }
  #rx-impressao, #rx-impressao * { visibility: visible !important; }
  #rx-impressao { position: absolute !important; top: 0; left: 0; width: 100% !important; max-height: none !important; overflow: visible !important; box-shadow: none !important; padding: 0 !important; margin: 0 !important; background: #fff !important; }
  .no-print { display: none !important; }
  .rx-via { break-inside: avoid; page-break-inside: avoid; }
  .rx-via + .rx-via { break-before: page; page-break-before: always; }
}
`;

function Prescricoes() {
  const navigate = useNavigate();
  const location = useLocation();
  const dadosNavegacao = location.state || {};

  const [prescricoes, setPrescricoes] = useState([]);
  const [consultas, setConsultas] = useState([]);
  const [animais, setAnimais] = useState([]);
  const [carregando, setCarregando] = useState(true);

  const [prescricaoEditando, setPrescricaoEditando] = useState(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [receitaDetalhes, setReceitaDetalhes] = useState(null);
  const [prescricaoParaExcluir, setPrescricaoParaExcluir] = useState(null);

  const [sugestoesMedicamentosIA, setSugestoesMedicamentosIA] = useState([]);
  const [consultaId, setConsultaId] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [itens, setItens] = useState([{ ...ITEM_VAZIO }]);

  const [busca, setBusca] = useState("");
  const [periodo, setPeriodo] = useState(90);
  const [filtroTipo, setFiltroTipo] = useState("TODAS");
  const [mensagemErro, setMensagemErro] = useState("");
  const [mensagemSucesso, setMensagemSucesso] = useState("");

  useEffect(() => {
    carregarConsultas();
    carregarAnimais();
  }, []);

  useEffect(() => {
    carregarPrescricoes();
  }, [periodo]);

  useEffect(() => {
    if (dadosNavegacao.consultaId) {
      setConsultaId(String(dadosNavegacao.consultaId));
      setMostrarFormulario(true);
      if (dadosNavegacao.parecerCopiloto) processarParecerIA(dadosNavegacao.parecerCopiloto);
    }
  }, [dadosNavegacao]);

  const processarParecerIA = (textoParecer) => {
    const listaExtraida = extrairPrescricoesIA(textoParecer);
    setSugestoesMedicamentosIA(listaExtraida);
    if (listaExtraida.length > 0) importarTodosDaIA(listaExtraida);
  };

  const extrairPrescricoesIA = (textoCopiloto) => {
    if (!textoCopiloto) return [];
    try {
      const jsonMatch = textoCopiloto.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        const parsed = JSON.parse(jsonMatch[1]);
        if (Array.isArray(parsed)) return parsed;
        if (parsed && Array.isArray(parsed.prescricoes)) return parsed.prescricoes;
      }
    } catch (err) {
      console.error("Erro ao converter JSON de prescrições da IA:", err);
    }
    return [];
  };

  const definirTipoUsoApropriado = (med) => {
    if (med.tipo_uso) {
      const tipo = med.tipo_uso.toLowerCase();
      if (tipo.includes("controle especial")) return TIPO_CONTROLE;
      if (tipo.includes("humano") || tipo.includes("drogaria")) return TIPO_HUMANO;
      if (tipo.includes("veterinário") || tipo.includes("veterinario") || tipo.includes("pet")) return TIPO_VET;
    }
    const nome = (med.medicamento || "").toLowerCase();
    const psicotropicosEOpioides = [
      "tramadol", "fenobarbital", "morfina", "ketamina", "cetamina",
      "diazepam", "midazolam", "gabapentina", "zoletil", "tiletamina",
      "zolazepam", "methadona", "metadona", "fentanil", "fentanila",
    ];
    if (psicotropicosEOpioides.some((s) => nome.includes(s))) return TIPO_CONTROLE;
    const linhaHumanaComum = [
      "novalgina", "clavulin", "pantoprazol", "omeprazol", "buscopan",
      "ondansetrona", "vonau", "prednisona", "prednisolona", "dexametasona",
      "allegra", "furosemida", "dipirona",
    ];
    if (linhaHumanaComum.some((s) => nome.includes(s))) return TIPO_HUMANO;
    return TIPO_VET;
  };

  const importarTodosDaIA = (lista = sugestoesMedicamentosIA) => {
    if (lista && lista.length > 0) {
      setItens(lista.map((med) => ({
        medicamento: med.medicamento || "",
        dosagem: med.dosagem || "",
        frequencia: med.frequencia || "",
        duracao: med.duracao || "",
        tipo_uso: definirTipoUsoApropriado(med),
        observacoes: med.observacoes || "",
      })));
    }
  };

  const adicionarItemManual = () => setItens([...itens, { ...ITEM_VAZIO }]);

  const removerItem = (index) => {
    const novos = itens.filter((_, i) => i !== index);
    setItens(novos.length > 0 ? novos : [{ ...ITEM_VAZIO }]);
  };

  const atualizarCampoItem = (index, campo, valor) => {
    const novos = itens.map((it, i) => (i === index ? { ...it, [campo]: valor } : it));
    if (campo === "medicamento") novos[index].tipo_uso = definirTipoUsoApropriado(novos[index]);
    setItens(novos);
  };

  const tratarSessaoExpirada = () => {
    setMensagemErro("Sessão expirada. Redirecionando para o login...");
    setTimeout(() => {
      localStorage.removeItem("token");
      navigate("/");
    }, 2000);
  };

  const carregarPrescricoes = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return tratarSessaoExpirada();
      setCarregando(true);
      const response = await api.get("/prescricoes/completas", {
        headers: { Authorization: `Bearer ${token}` },
        params: { dias: periodo, limite: 500 },
      });
      setPrescricoes(response.data || []);
    } catch (error) {
      if (error.response?.status === 401) return tratarSessaoExpirada();
      const d = error.response?.data?.detail;
      setMensagemErro(typeof d === "string" && d ? d : "Não foi possível carregar as receitas.");
    } finally {
      setCarregando(false);
    }
  };

  const carregarConsultas = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const response = await api.get("/consultas/", { headers: { Authorization: `Bearer ${token}` } });
      setConsultas(response.data || []);
    } catch (error) {
      console.error("Erro ao carregar consultas:", error);
    }
  };

  const carregarAnimais = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const response = await api.get("/animais/", { headers: { Authorization: `Bearer ${token}` } });
      setAnimais(response.data || []);
    } catch (error) {
      console.error("Erro ao carregar animais:", error);
    }
  };

  const limparFormulario = () => {
    setPrescricaoEditando(null);
    setConsultaId("");
    setObservacoes("");
    setItens([{ ...ITEM_VAZIO }]);
    setSugestoesMedicamentosIA([]);
    setMensagemErro("");
  };

  const salvarPrescricao = async () => {
    try {
      setMensagemErro("");
      setMensagemSucesso("");
      if (!consultaId) return setMensagemErro("Selecione a consulta de origem.");

      const itensValidos = itens.filter((i) => i.medicamento.trim() !== "");
      if (itensValidos.length === 0) return setMensagemErro("Informe ao menos um medicamento válido.");

      const token = localStorage.getItem("token");
      if (!token) return tratarSessaoExpirada();

      const payload = {
        consulta_id: Number(consultaId),
        observacoes: observacoes.trim() || undefined,
        itens: itensValidos.map((i) => ({
          medicamento: i.medicamento.trim(),
          dosagem: i.dosagem.trim() || undefined,
          frequencia: i.frequencia.trim() || undefined,
          duracao: i.duracao.trim() || undefined,
          tipo_uso: i.tipo_uso || undefined,
          observacoes: i.observacoes.trim() || undefined,
        })),
      };
      const config = { headers: { Authorization: `Bearer ${token}` } };

      const editando = !!prescricaoEditando;
      if (editando) await api.put(`/prescricoes/${prescricaoEditando.id}`, payload, config);
      else await api.post("/prescricoes/", payload, config);

      limparFormulario();
      setMostrarFormulario(false);
      carregarPrescricoes();
      setMensagemSucesso(editando ? "Receita atualizada com sucesso!" : "Receita emitida com sucesso!");
    } catch (error) {
      console.error("ERRO SALVAR PRESCRIÇÃO:", error);
      if (error.response?.status === 401) return tratarSessaoExpirada();
      const d = error.response?.data?.detail;
      setMensagemErro(typeof d === "string" ? d : error.message);
    }
  };

  const deletarPrescricao = async () => {
    if (!prescricaoParaExcluir) return;
    try {
      const token = localStorage.getItem("token");
      if (!token) return tratarSessaoExpirada();
      await api.delete(`/prescricoes/${prescricaoParaExcluir.id}`, { headers: { Authorization: `Bearer ${token}` } });
      setMensagemSucesso("Receita excluída com sucesso!");
      setPrescricaoParaExcluir(null);
      carregarPrescricoes();
    } catch (error) {
      if (error.response?.status === 401) return tratarSessaoExpirada();
      const d = error.response?.data?.detail;
      setMensagemErro(`Erro ao excluir: ${typeof d === "string" ? d : error.message}`);
      setPrescricaoParaExcluir(null);
    }
  };

  const editarPrescricao = (p) => {
    setPrescricaoEditando(p);
    setConsultaId(String(p.consulta_id));
    setObservacoes(p.observacoes || "");
    setSugestoesMedicamentosIA([]);
    setItens(
      p.itens && p.itens.length > 0
        ? p.itens.map((item) => ({
            medicamento: item.medicamento || "",
            dosagem: item.dosagem || "",
            frequencia: item.frequencia || "",
            duracao: item.duracao || "",
            tipo_uso: definirTipoUsoApropriado(item),
            observacoes: item.observacoes || "",
          }))
        : [{ ...ITEM_VAZIO }]
    );
    setMostrarFormulario(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const obterConsulta = (cId) => consultas.find((c) => c.id === cId);

  const obterNomeAnimalPorConsulta = (cId) => {
    const cons = obterConsulta(cId);
    if (!cons) return "-";
    const anim = animais.find((a) => a.id === cons.animal_id);
    return anim ? `${anim.nome} (${anim.codigo || `PET-${anim.id}`})` : "-";
  };

  const parecerIA = dadosNavegacao.parecerCopiloto || obterConsulta(Number(consultaId))?.parecer_copiloto;

  const visiveis = useMemo(() => {
    const termo = semAcento(busca).trim();
    return prescricoes.filter((p) => {
      if (filtroTipo === "TUTOR" && p.tipo !== "TUTOR") return false;
      if (filtroTipo === "CLINICA" && p.tipo !== "CLINICA") return false;
      if (!termo) return true;
      return semAcento(
        `${p.animal_nome} ${p.animal_codigo} ${p.tutor_nome} ${p.consulta_codigo} ${(p.itens || []).map((i) => i.medicamento).join(" ")}`
      ).includes(termo);
    });
  }, [busca, filtroTipo, prescricoes]);

  const totalMeds = visiveis.reduce((s, p) => s + (p.itens || []).length, 0);
  const pacientes = new Set(visiveis.map((p) => p.animal_id)).size;
  const comControle = visiveis.filter((p) => p.tipo === "TUTOR" && temControlado(p.itens)).length;

  const imprimirReceita = (p) => {
    const titulo = document.title;
    document.title = `Receita_${String(p.animal_nome || "Paciente").replace(/\s+/g, "_")}_${p.animal_codigo || ""}`;
    window.print();
    setTimeout(() => { document.title = titulo; }, 1000);
  };

  const badgeAquisicao = (med) => {
    if (ehControlado(med)) return <span className="rx-badge ctl">⚠️ Controle Especial (Retenção de Receita)</span>;
    if ((med.tipo_uso || "").includes("Humano") || (med.tipo_uso || "").includes("Drogaria")) return <span className="rx-badge hum">💊 Uso Humano (Drogaria Comum)</span>;
    return <span className="rx-badge vet">🐾 Uso Veterinário (Pet Shop / Agropecuária)</span>;
  };

  const possuiControladoForm = temControlado(itens);

  const vias = (p) => (p.tipo === "TUTOR" && temControlado(p.itens) ? [1, 2] : [1]);
  const tituloVia = (p, via) => {
    if (p.tipo === "CLINICA") return "Registro de aplicações realizadas na clínica (não entregue ao tutor)";
    if (temControlado(p.itens)) return via === 1 ? "1ª via — Retenção do estabelecimento / farmácia" : "2ª via — Orientação ao paciente / tutor";
    return "Receituário";
  };

  return (
    <Layout>
      <style>{CSS}</style>
      <div className="rx-root">
        <div className="rx-hero">
          <div className="rx-hero-top">
            <div className="rx-titulo">
              <div className="rx-icone"><MdMedicalServices size={28} /></div>
              <div>
                <h1>Receituário & Prescrições</h1>
                <p>Receitas emitidas e aplicações registradas nos atendimentos. Consulte, edite e reimprima.</p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="button" className="rx-btn claro" onClick={carregarPrescricoes} disabled={carregando}>
                <MdRefresh size={18} /> {carregando ? "Atualizando..." : "Atualizar"}
              </button>
              <button
                type="button"
                className="rx-btn roxo"
                onClick={() => { if (mostrarFormulario) limparFormulario(); setMostrarFormulario(!mostrarFormulario); }}
              >
                {mostrarFormulario ? <><MdClose size={18} /> Fechar formulário</> : <><MdAdd size={18} /> Nova prescrição</>}
              </button>
            </div>
          </div>
          <div className="rx-stats">
            <div className="rx-stat"><b>{visiveis.length}</b><span>{visiveis.length === 1 ? "receita" : "receitas"}</span></div>
            <div className="rx-stat"><b>{totalMeds}</b><span>medicamentos</span></div>
            <div className="rx-stat"><b>{pacientes}</b><span>{pacientes === 1 ? "paciente" : "pacientes"}</span></div>
            <div className={`rx-stat ${comControle > 0 ? "ctl" : ""}`}><b>{comControle}</b><span>com controle especial</span></div>
          </div>
        </div>

        {mensagemSucesso && <div className="rx-msg ok"><MdCheckCircle size={20} /> {mensagemSucesso}</div>}
        {mensagemErro && <div className="rx-msg erro"><MdErrorOutline size={20} /> {mensagemErro}</div>}

        {mostrarFormulario && (
          <div className="rx-form">
            <h3>{prescricaoEditando ? "✏️ Editar receita médica" : "💊 Emitir nova receita médica"}</h3>

            {possuiControladoForm && (
              <div className="rx-aviso amarelo">
                <MdWarning size={24} color="#b45309" style={{ flexShrink: 0 }} />
                <div>
                  <strong>Atenção: receituário de controle especial detectado.</strong><br />
                  Ao imprimir, o sistema gera a <strong>1ª via (retenção da farmácia)</strong> e a <strong>2ª via (orientação ao tutor)</strong>.
                </div>
              </div>
            )}

            {consultaId && (
              <div className="rx-aviso verde">
                <span>🐾 <strong>Paciente vinculado:</strong> {obterNomeAnimalPorConsulta(Number(consultaId))}</span>
                {dadosNavegacao.peso && <span><strong>Peso atual:</strong> {dadosNavegacao.peso} kg</span>}
              </div>
            )}

            {sugestoesMedicamentosIA.length > 0 && (
              <div className="rx-aviso azul">
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <MdAutoAwesome size={22} color="#0284c7" />
                  {sugestoesMedicamentosIA.length} medicamento(s) sugerido(s) pelo Copiloto IA
                </span>
                <button type="button" className="rx-btn azul" onClick={() => importarTodosDaIA()}>⚡ Importar todos na receita</button>
              </div>
            )}

            {parecerIA && (
              <div className="rx-parecer">
                <h4>📋 Parecer completo do Copiloto (referência)</h4>
                <div>{parecerIA}</div>
              </div>
            )}

            <div style={{ marginBottom: 18 }}>
              <label className="rx-label">Consulta de origem *</label>
              <select className="rx-select" value={consultaId} onChange={(e) => setConsultaId(e.target.value)}>
                <option value="">Selecione o atendimento</option>
                {consultas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.codigo || `CNS-${String(c.id).padStart(4, "0")}`} — {obterNomeAnimalPorConsulta(c.id)}
                  </option>
                ))}
              </select>
            </div>

            <h4 style={{ margin: "0 0 12px", fontSize: 16, color: "#111827" }}>💊 Medicamentos prescritos</h4>
            {itens.map((item, index) => (
              <div key={index} className="rx-item">
                <div className="rx-item-topo">
                  <span>Medicamento #{index + 1}</span>
                  {itens.length > 1 && (
                    <button type="button" className="rx-btn vermelho mini" onClick={() => removerItem(index)} title="Remover"><MdDelete size={18} /></button>
                  )}
                </div>
                <div className="rx-grid4">
                  <div>
                    <label className="rx-label">Medicamento *</label>
                    <input className="rx-input" placeholder="Ex: Cloridrato de Tramadol 50 mg" value={item.medicamento} onChange={(e) => atualizarCampoItem(index, "medicamento", e.target.value)} />
                  </div>
                  <div>
                    <label className="rx-label">Dosagem / posologia</label>
                    <input className="rx-input" placeholder="Ex: 1 cápsula (2.6 mg/kg)" value={item.dosagem} onChange={(e) => atualizarCampoItem(index, "dosagem", e.target.value)} />
                  </div>
                  <div>
                    <label className="rx-label">Frequência / intervalo</label>
                    <input className="rx-input" placeholder="Ex: A cada 8 horas (TID)" value={item.frequencia} onChange={(e) => atualizarCampoItem(index, "frequencia", e.target.value)} />
                  </div>
                  <div>
                    <label className="rx-label">Duração do tratamento</label>
                    <input className="rx-input" placeholder="Ex: Por 4 dias" value={item.duracao} onChange={(e) => atualizarCampoItem(index, "duracao", e.target.value)} />
                  </div>
                </div>
                <div className="rx-grid2">
                  <div>
                    <label className="rx-label">Local de aquisição / controle *</label>
                    <select className="rx-select" value={item.tipo_uso || TIPO_VET} onChange={(e) => atualizarCampoItem(index, "tipo_uso", e.target.value)}>
                      <option value={TIPO_VET}>🐾 {TIPO_VET}</option>
                      <option value={TIPO_HUMANO}>💊 {TIPO_HUMANO}</option>
                      <option value={TIPO_CONTROLE}>⚠️ {TIPO_CONTROLE}</option>
                    </select>
                  </div>
                  <div>
                    <label className="rx-label">Observações do medicamento</label>
                    <input className="rx-input" placeholder="Ex: Pode causar leve sedação." value={item.observacoes} onChange={(e) => atualizarCampoItem(index, "observacoes", e.target.value)} />
                  </div>
                </div>
              </div>
            ))}
            <button type="button" className="rx-btn claro" onClick={adicionarItemManual}><MdAdd size={18} /> Adicionar outro medicamento</button>

            <div style={{ marginTop: 18 }}>
              <label className="rx-label">Observações gerais da receita</label>
              <textarea className="rx-area" rows={2} placeholder="Instruções gerais para o tutor..." value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
            </div>

            <div className="rx-form-fim">
              <button type="button" className="rx-btn cinza" onClick={() => { limparFormulario(); setMostrarFormulario(false); }}>Cancelar</button>
              <button type="button" className="rx-btn verde" onClick={salvarPrescricao}>Salvar receita com {itens.length} medicamento(s)</button>
            </div>
          </div>
        )}

        <div className="rx-filtros">
          <div className="rx-busca">
            <MdSearch size={20} />
            <input className="rx-input" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por paciente, tutor, código ou medicamento..." />
          </div>
          <select className="rx-select" value={periodo} onChange={(e) => setPeriodo(Number(e.target.value))}>
            {PERIODOS.map((p) => <option key={p.valor} value={p.valor}>{p.rotulo}</option>)}
          </select>
          <div className="rx-seg">
            <button type="button" className={filtroTipo === "TODAS" ? "on" : ""} onClick={() => setFiltroTipo("TODAS")}>Todas</button>
            <button type="button" className={filtroTipo === "TUTOR" ? "on" : ""} onClick={() => setFiltroTipo("TUTOR")}>Receitas ao tutor</button>
            <button type="button" className={filtroTipo === "CLINICA" ? "on" : ""} onClick={() => setFiltroTipo("CLINICA")}>Aplicações na clínica</button>
          </div>
        </div>

        {visiveis.length === 0 ? (
          <div className="rx-vazio">
            <div style={{ fontSize: 38 }}>💊</div>
            <b style={{ display: "block", color: "#0f172a", fontSize: 16, margin: "4px 0" }}>{carregando ? "Carregando..." : "Nenhuma receita encontrada"}</b>
            {!carregando && "Ajuste a busca, o período ou o tipo."}
          </div>
        ) : (
          <div className="rx-lista">
            {visiveis.map((p) => {
              const { Icone, bg, cor } = estiloEspecie(p.especie);
              const { data, hora } = formatarDataHora(p.data_prescricao);
              const ctl = p.tipo === "TUTOR" && temControlado(p.itens);
              return (
                <div key={p.id} className={`rx-card ${p.tipo === "CLINICA" ? "clinica" : ""}`}>
                  <div className="rx-pac">
                    <div className="rx-av" style={{ backgroundColor: bg }}><Icone size={24} color={cor} /></div>
                    <div style={{ minWidth: 0 }}>
                      <div className="rx-nome">{p.animal_nome || "Paciente"}</div>
                      <div className="rx-sub">
                        {p.animal_codigo && <span>{p.animal_codigo}</span>}
                        {p.consulta_codigo && <span className="rx-cod">{p.consulta_codigo}</span>}
                      </div>
                      <div className="rx-sub"><MdPerson size={14} color="#94a3b8" /> {p.tutor_nome || "Tutor não vinculado"}</div>
                    </div>
                  </div>

                  <div className="rx-chips">
                    {(p.itens || []).length === 0 && <span className="rx-chip">Nenhum medicamento</span>}
                    {(p.itens || []).map((i, idx) => (
                      <span key={idx} className={`rx-chip ${ehControlado(i) ? "ctl" : ""}`} title={[i.dosagem, i.frequencia, i.duracao].filter(Boolean).join(" · ")}>
                        {ehControlado(i) ? "⚠️ " : ""}{i.medicamento}
                      </span>
                    ))}
                  </div>

                  <div className="rx-lado">
                    <div className="dt">{data}{hora ? ` · ${hora}` : ""}</div>
                    <div className="rx-tags">
                      <span className={`rx-tag ${p.tipo === "CLINICA" ? "clinica" : "tutor"}`}>{p.tipo === "CLINICA" ? "Aplicação na clínica" : "Receita ao tutor"}</span>
                      {ctl && <span className="rx-tag ctl">Controle especial</span>}
                    </div>
                    <div className="rx-acoes">
                      <button type="button" className="rx-btn azul" onClick={() => setReceitaDetalhes(p)} title="Ver / imprimir"><MdVisibility size={17} /> Ver / Imprimir</button>
                      <button type="button" className="rx-btn amarelo mini" onClick={() => editarPrescricao(p)} title="Editar"><MdEdit size={17} /></button>
                      <button type="button" className="rx-btn vermelho mini" onClick={() => setPrescricaoParaExcluir(p)} title="Excluir"><MdDelete size={17} /></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {receitaDetalhes && (
          <div className="rx-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setReceitaDetalhes(null); }}>
            <div className="rx-modal" id="rx-impressao">
              {vias(receitaDetalhes).map((via) => (
                <div key={via} className="rx-via" style={{ paddingBottom: via === 1 && vias(receitaDetalhes).length > 1 ? 20 : 0 }}>
                  <div className="rx-doc-topo">
                    <h2>VetAssist AI — Receituário Veterinário</h2>
                    <p>{tituloVia(receitaDetalhes, via)}</p>
                  </div>

                  <div className="rx-doc-dados">
                    <div><strong>Paciente:</strong> {receitaDetalhes.animal_nome}{receitaDetalhes.animal_codigo ? ` (${receitaDetalhes.animal_codigo})` : ""}</div>
                    <div>
                      <strong>Espécie / raça:</strong> {[receitaDetalhes.especie, receitaDetalhes.raca].filter(Boolean).join(" · ") || "-"}
                      {receitaDetalhes.peso ? `  ·  ${String(receitaDetalhes.peso).replace(".", ",")} kg` : ""}
                    </div>
                    <div><strong>Tutor:</strong> {receitaDetalhes.tutor_nome || "-"}</div>
                    <div><strong>Atendimento:</strong> {receitaDetalhes.consulta_codigo || "-"} · <strong>Emissão:</strong> {formatarDataHora(receitaDetalhes.data_prescricao).data} {formatarDataHora(receitaDetalhes.data_prescricao).hora}</div>
                  </div>

                  <h3 style={{ margin: "0 0 12px", fontSize: 15, color: "#111827", borderBottom: "1px solid #e5e7eb", paddingBottom: 6 }}>💊 Medicamentos & posologias</h3>
                  {(receitaDetalhes.itens || []).map((med, index) => (
                    <div key={med.id || index} className="rx-doc-med">
                      <div className="nm">{index + 1}. {med.medicamento}</div>
                      <div>{badgeAquisicao(med)}</div>
                      {med.dosagem && <div><strong>Dosagem:</strong> {med.dosagem}</div>}
                      {med.frequencia && <div><strong>Frequência:</strong> {med.frequencia}</div>}
                      {med.duracao && <div><strong>Duração:</strong> {med.duracao}</div>}
                      {med.observacoes && <div className="rx-doc-obs">📌 <strong>Obs:</strong> {med.observacoes}</div>}
                    </div>
                  ))}
                  {receitaDetalhes.observacoes && receitaDetalhes.tipo !== "CLINICA" && (
                    <div className="rx-doc-geral"><strong>Observações gerais:</strong> {receitaDetalhes.observacoes}</div>
                  )}

                  {receitaDetalhes.tipo === "TUTOR" && temControlado(receitaDetalhes.itens) && via === 1 && (
                    <div className="rx-comprador">
                      <strong style={{ display: "block", marginBottom: 6, textTransform: "uppercase" }}>Identificação do comprador / farmácia (Portaria SVS/MS nº 344/98)</strong>
                      <div className="l"><div>Nome: ______________________________</div><div>RG: _______________</div><div>Tel: ____________</div></div>
                      <div className="l" style={{ gridTemplateColumns: "1fr 1fr" }}><div>Endereço: ________________________________</div><div>Assinatura: ____________________</div></div>
                    </div>
                  )}

                  <div className="rx-doc-assina">
                    <div style={{ borderTop: "1px solid #9ca3af", width: 260, margin: "0 auto 8px" }} />
                    <div style={{ fontWeight: 700, color: "#111827", fontSize: 14 }}>Médico(a) Veterinário(a){receitaDetalhes.veterinario_nome ? `: ${receitaDetalhes.veterinario_nome}` : ""}</div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>{receitaDetalhes.veterinario_crmv ? `CRMV ${receitaDetalhes.veterinario_crmv}` : "CRMV Responsável"}</div>
                  </div>
                </div>
              ))}

              <div className="rx-acoes-modal no-print">
                <button type="button" className="rx-btn cinza" onClick={() => setReceitaDetalhes(null)}><MdClose size={17} /> Fechar</button>
                <button type="button" className="rx-btn azul" onClick={() => imprimirReceita(receitaDetalhes)}>
                  <MdPrint size={17} /> Imprimir receita{vias(receitaDetalhes).length > 1 ? " (2 vias)" : ""}
                </button>
              </div>
            </div>
          </div>
        )}

        {prescricaoParaExcluir && (
          <div className="rx-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setPrescricaoParaExcluir(null); }}>
            <div className="rx-modal peq">
              <div style={{ fontSize: 42, marginBottom: 6 }}>⚠️</div>
              <h3 style={{ margin: "0 0 8px", color: "#111827", fontSize: 18 }}>Confirmar exclusão</h3>
              <p style={{ color: "#4b5563", fontSize: 14, lineHeight: 1.5, margin: 0 }}>
                Excluir a receita de <strong>{prescricaoParaExcluir.animal_nome || "paciente"}</strong> e todos os seus medicamentos?
              </p>
              <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 22 }}>
                <button type="button" className="rx-btn cinza" onClick={() => setPrescricaoParaExcluir(null)}>Cancelar</button>
                <button type="button" className="rx-btn perigo" onClick={deletarPrescricao}>Sim, excluir</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

export default Prescricoes;