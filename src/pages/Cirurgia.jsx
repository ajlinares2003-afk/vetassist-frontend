import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MdLocalHospital, MdAutoAwesome, MdAdd, MdClose, MdEdit, MdRefresh, MdSearch, MdPlayArrow, MdCheckCircle, MdPrint, MdWarning, MdMedication, MdErrorOutline, MdPerson, MdVisibility } from "react-icons/md";
import { FaDog, FaCat, FaHorse, FaDove, FaFish, FaFrog, FaBug } from "react-icons/fa";
import { GiRabbit, GiCow, GiPig, GiSheep, GiGoat } from "react-icons/gi";
import api from "../api/api";
import Layout from "../components/Layout";

const ASA = [
  "ASA I - Paciente Saudável",
  "ASA II - Doença Sistêmica Leve",
  "ASA III - Doença Sistêmica Grave",
  "ASA IV - Risco de Vida Constante",
  "ASA V - Moribundo",
];
const STATUS = ["Aguardando Cirurgia", "Em Cirurgia", "Concluída"];
const STATUS_ENCERRADOS = ["Finalizado", "FINALIZADO", "Cancelado", "Concluída", "Aguardando Pagamento"];

const CLASSES = {
  PRE_ANESTESICA: { rotulo: "Pré-anestésico", campo: "protocolo_mpa" },
  ANALGESIA: { rotulo: "Analgesia", campo: "protocolo_mpa" },
  ANTIEMETICO: { rotulo: "Antiemético", campo: "protocolo_mpa" },
  INDUCAO: { rotulo: "Indução", campo: "protocolo_inducao" },
  ANESTESICO_LOCAL: { rotulo: "Anestésico local / bloqueio", campo: "protocolo_manutencao" },
  ANTIBIOTICO_PROFILATICO: { rotulo: "Antibiótico profilático", campo: "protocolo_manutencao" },
  FLUIDOTERAPIA: { rotulo: "Fluidoterapia", campo: "fluidoterapia" },
};
const CAMPOS_FICHA = [
  ["protocolo_mpa", "Pré-anestesia e analgesia (MPA)"],
  ["protocolo_inducao", "Indução"],
  ["protocolo_manutencao", "Manutenção / bloqueios / profilaxia"],
  ["fluidoterapia", "Fluidoterapia"],
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
  return ESPECIES.find((e) => e.chaves.some((k) => esp.includes(k))) || { Icone: MdLocalHospital, bg: "#ede9fe", cor: "#6d28d9" };
};
const especieCalc = (especie) => {
  const e = (especie || "").toLowerCase();
  if (e.includes("felin") || e.includes("gato")) return "FELINO";
  if (e.includes("canin") || e.includes("cão") || e.includes("cao") || e.includes("cachorro")) return "CANINO";
  return null;
};

const semAcento = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/* datas: o servidor grava sem fuso (UTC); exibimos em horário de São Paulo */
const paraDate = (s) => {
  if (!s) return null;
  const str = String(s);
  const d = new Date(/[zZ]$|[+-]\d\d:?\d\d$/.test(str) ? str : `${str}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
};
const fmtDataHora = (s) => {
  const d = paraDate(s);
  return d ? d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";
};
const paraInputLocal = (s) => {
  const d = paraDate(s);
  if (!d) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const agoraInput = () => paraInputLocal(new Date().toISOString());
const inputParaISO = (v) => (v ? new Date(v).toISOString() : null);

/* ---------- cálculo de dose por peso ---------- */
const num = (v) => (v === "" || v === null || v === undefined ? NaN : Number(String(v).replace(",", ".")));
const fmtNum = (n, casas = 2) => {
  if (!Number.isFinite(n)) return "-";
  const c = n !== 0 && Math.abs(n) < 0.1 ? 3 : casas;
  return n.toLocaleString("pt-BR", { maximumFractionDigits: c, minimumFractionDigits: 0 });
};

const calcularDose = ({ peso, dose, unidadeDose, conc, unidadeConc }) => {
  if (!Number.isFinite(peso) || peso <= 0 || !Number.isFinite(dose) || dose <= 0) return null;
  const total = dose * peso;
  if (unidadeDose === "mL/kg/h") return { total, unidadeTotal: "mL/h", volume: null, porHora: true };
  if (unidadeDose === "mL/kg") return { total, unidadeTotal: "mL", volume: total, porHora: false };
  const unidadeTotal = unidadeDose === "mcg/kg" ? "mcg" : "mg";
  let volume = null;
  if (Number.isFinite(conc) && conc > 0 && (unidadeConc === "mg/mL" || unidadeConc === "mcg/mL")) {
    const concNaMesmaUnidade = unidadeTotal === "mg"
      ? (unidadeConc === "mcg/mL" ? conc / 1000 : conc)
      : (unidadeConc === "mg/mL" ? conc * 1000 : conc);
    volume = total / concNaMesmaUnidade;
  }
  return { total, unidadeTotal, volume, porHora: false };
};

const CSS = `
.cx-root, .cx-root * { box-sizing: border-box; }
.cx-root * { text-align: left; }
.cx-root { color: #0f172a; font-family: inherit; }
.cx-hero { border-radius: 22px; padding: 22px 26px; margin-bottom: 18px; background: linear-gradient(120deg, #f5f3ff 0%, #eef2ff 55%, #ecfeff 100%); border: 1px solid #ddd6fe; }
.cx-hero-top { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
.cx-titulo { display: flex; align-items: center; gap: 14px; }
.cx-icone { width: 52px; height: 52px; border-radius: 16px; background: #6d28d9; color: #fff; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 18px rgba(109,40,217,.28); }
.cx-hero h1 { margin: 0; font-size: 25px; font-weight: 800; color: #3b0764; letter-spacing: -.3px; }
.cx-hero p { margin: 3px 0 0; font-size: 13.5px; color: #475569; }
.cx-stats { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 16px; }
.cx-stat { background: rgba(255,255,255,.9); border: 1px solid #e2e8f0; border-radius: 14px; padding: 10px 16px; min-width: 120px; }
.cx-stat b { display: block; font-size: 22px; font-weight: 800; color: #3b0764; line-height: 1.1; }
.cx-stat span { font-size: 12px; color: #64748b; font-weight: 600; }
.cx-abas { display: flex; width: fit-content; max-width: 100%; background: #f1f5f9; border-radius: 12px; padding: 4px; gap: 2px; margin-bottom: 14px; flex-wrap: wrap; }
.cx-abas button { border: none; background: transparent; padding: 9px 16px; border-radius: 9px; font-weight: 700; font-size: 13.5px; color: #475569; cursor: pointer; font-family: inherit; }
.cx-abas button.on { background: #fff; color: #6d28d9; box-shadow: 0 1px 3px rgba(15,23,42,.12); }
.cx-filtros { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin-bottom: 14px; }
.cx-busca { position: relative; flex: 1; min-width: 240px; }
.cx-busca svg { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #94a3b8; }
.cx-input, .cx-select, .cx-area { border: 1px solid #d1d5db; border-radius: 12px; background: #fff; font-size: 14px; color: #0f172a; outline: none; padding: 0 14px; font-family: inherit; width: 100%; }
.cx-input, .cx-select { height: 44px; }
.cx-area { padding: 10px 14px; resize: vertical; line-height: 1.5; }
.cx-busca .cx-input { padding-left: 40px; }
.cx-input:focus, .cx-select:focus, .cx-area:focus { border-color: #a78bfa; box-shadow: 0 0 0 3px rgba(167,139,250,.28); }
.cx-btn { display: inline-flex; align-items: center; gap: 7px; border: none; border-radius: 12px; padding: 10px 16px; font-weight: 700; font-size: 13.5px; cursor: pointer; font-family: inherit; transition: filter .15s, transform .15s; }
.cx-btn:hover { filter: brightness(.95); transform: translateY(-1px); }
.cx-btn:disabled { opacity: .55; cursor: default; transform: none; }
.cx-btn.roxo { background: #6d28d9; color: #fff; }
.cx-btn.verde { background: #059669; color: #fff; }
.cx-btn.azul { background: #0284c7; color: #fff; }
.cx-btn.claro { background: #ede9fe; color: #5b21b6; }
.cx-btn.cinza { background: #f1f5f9; color: #334155; }
.cx-btn.amarelo { background: #fef3c7; color: #92400e; }
.cx-btn.mini { padding: 8px 11px; font-size: 12.5px; }
.cx-fila { background: #fffbeb; border: 1px solid #fde68a; border-radius: 18px; padding: 16px 18px; margin-bottom: 18px; }
.cx-fila h3 { margin: 0 0 4px; font-size: 16px; color: #92400e; display: flex; align-items: center; gap: 8px; }
.cx-fila > p { margin: 0 0 10px; font-size: 13px; color: #a16207; }
.cx-fila-item { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; background: #fff; border: 1px solid #fde68a; border-radius: 14px; padding: 10px 14px; margin-top: 8px; }
.cx-lista { display: grid; gap: 12px; }
.cx-card { display: grid; grid-template-columns: minmax(200px, 1fr) minmax(220px, 2fr) auto; gap: 18px; align-items: center; background: #fff; border: 1px solid #e5e7eb; border-radius: 18px; padding: 16px 18px; box-shadow: 0 2px 6px rgba(15,23,42,.05); transition: box-shadow .18s, transform .18s; }
.cx-card:hover { box-shadow: 0 12px 22px rgba(15,23,42,.10); transform: translateY(-1px); }
.cx-pac { display: flex; align-items: center; gap: 12px; min-width: 0; }
.cx-av { width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.cx-nome { font-size: 16px; font-weight: 800; color: #0f172a; overflow-wrap: anywhere; }
.cx-sub { font-size: 12.5px; color: #64748b; display: flex; gap: 6px; align-items: center; flex-wrap: wrap; margin-top: 2px; }
.cx-cod { font-size: 11px; font-weight: 800; color: #5b21b6; background: #ede9fe; border-radius: 99px; padding: 2px 8px; }
.cx-desc { font-size: 13.5px; color: #334155; line-height: 1.45; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.cx-meta { font-size: 12.5px; color: #64748b; margin-top: 5px; }
.cx-lado { display: flex; flex-direction: column; gap: 8px; align-items: flex-end; }
.cx-lado, .cx-lado * { text-align: right; }
.cx-acoes { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
.cx-badge { font-size: 12px; font-weight: 800; padding: 4px 10px; border-radius: 99px; white-space: nowrap; }
.cx-badge.amar { background: #fef3c7; color: #92400e; }
.cx-badge.roxo { background: #e0e7ff; color: #3730a3; }
.cx-badge.verde { background: #dcfce7; color: #166534; }
.cx-badge.cinza { background: #e2e8f0; color: #475569; }
.cx-badge.verm { background: #fee2e2; color: #991b1b; }
.cx-vazio { background: #fff; border: 2px dashed #e2e8f0; border-radius: 18px; padding: 44px 20px; color: #64748b; }
.cx-vazio, .cx-vazio * { text-align: center; }
.cx-msg { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: 12px; font-weight: 600; font-size: 14px; margin-bottom: 14px; }
.cx-msg.erro { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }
.cx-msg.ok { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; }
.cx-overlay { position: fixed; inset: 0; background: rgba(15,23,42,.55); backdrop-filter: blur(3px); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 16px; }
.cx-modal { background: #fff; border-radius: 20px; width: 100%; max-width: 760px; max-height: calc(100vh - 32px); overflow-y: auto; padding: 26px; box-shadow: 0 30px 60px rgba(15,23,42,.3); }
.cx-modal.larga { max-width: 960px; }
.cx-modal h3.tit { margin: 0 0 16px; font-size: 18px; color: #111827; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.cx-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; }
.cx-label { display: block; font-size: 12.5px; font-weight: 700; color: #374151; margin-bottom: 5px; }
.cx-ia { margin-top: 12px; background: #ede9fe; border-left: 4px solid #6d28d9; border-radius: 8px; padding: 10px 14px; font-size: 13px; color: #4c1d95; }
.cx-fim { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; padding-top: 14px; border-top: 1px solid #f1f5f9; flex-wrap: wrap; }
.cx-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px 16px; }
.cx-paciente { display: flex; gap: 18px; flex-wrap: wrap; align-items: center; background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 14px; padding: 12px 16px; margin-bottom: 14px; font-size: 13.5px; }
.cx-paciente b { color: #3b0764; }
.cx-calc { border: 2px solid #ddd6fe; border-radius: 16px; padding: 16px; margin: 14px 0; background: #faf5ff; }
.cx-calc h4 { margin: 0 0 10px; font-size: 15px; color: #5b21b6; display: flex; align-items: center; gap: 6px; }
.cx-res { background: #fff; border: 1px solid #c4b5fd; border-radius: 12px; padding: 12px 14px; margin-top: 12px; }
.cx-res .grande { font-size: 22px; font-weight: 800; color: #3b0764; }
.cx-res .faixa { font-size: 12.5px; color: #64748b; margin-top: 4px; }
.cx-alerta { display: flex; gap: 8px; align-items: flex-start; border-radius: 10px; padding: 8px 12px; margin-top: 8px; font-size: 12.5px; font-weight: 600; }
.cx-alerta.verm { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
.cx-alerta.amar { background: #fffbeb; color: #92400e; border: 1px solid #fde68a; }
.cx-alerta.azul { background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; }
.cx-tab { width: 100%; border-collapse: collapse; font-size: 13px; }
.cx-tab th { background: #f1f5f9; color: #334155; padding: 9px 8px; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
.cx-tab td { padding: 9px 8px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
.cx-tab th, .cx-tab td { text-align: left; }
.cx-tab tr { break-inside: avoid; page-break-inside: avoid; }
.cx-resumo { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 12px 14px; margin-top: 8px; font-size: 13px; color: #334155; }
.cx-resumo .topo { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.cx-resumo .nm { font-size: 15px; font-weight: 800; color: #0f172a; }
.cx-chip { font-size: 12px; font-weight: 700; padding: 3px 10px; border-radius: 99px; background: #f1f5f9; color: #475569; white-space: nowrap; }
.cx-chip.sinal { background: #ecfeff; color: #155e75; }
.cx-resumo .queixa { margin-top: 8px; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.cx-resumo .queixa.completo { display: block; -webkit-line-clamp: unset; overflow: visible; }
.cx-resumo details { margin-top: 8px; }
.cx-resumo summary { cursor: pointer; font-weight: 800; color: #6d28d9; font-size: 12.5px; }
.cx-resumo .bloco { margin-top: 8px; }
.cx-resumo .bloco b { display: block; font-size: 11.5px; color: #64748b; text-transform: uppercase; letter-spacing: .4px; margin-bottom: 2px; }
.cx-resumo .bloco div { white-space: pre-wrap; line-height: 1.55; }
.cx-grupo { margin: 18px 0 8px; font-size: 13px; font-weight: 800; color: #5b21b6; text-transform: uppercase; letter-spacing: .5px; }
.cx-check { display: flex; gap: 10px; align-items: flex-start; background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 12px 14px; margin-top: 14px; font-size: 13px; color: #92400e; cursor: pointer; }
.cx-doc-topo { border-bottom: 2px solid #6d28d9; padding-bottom: 12px; margin-bottom: 16px; }
.cx-doc-topo, .cx-doc-topo * { text-align: center; }
.cx-doc-topo h2 { margin: 0; font-size: 21px; color: #3b0764; }
.cx-doc-topo p { margin: 4px 0 0; font-size: 12px; font-weight: 800; color: #6d28d9; text-transform: uppercase; letter-spacing: .5px; }
.cx-assina { margin-top: 40px; }
.cx-assina, .cx-assina * { text-align: center; }
@media (max-width: 860px) {
  .cx-card { grid-template-columns: 1fr; }
  .cx-lado { align-items: flex-start; }
  .cx-lado, .cx-lado * { text-align: left; }
  .cx-acoes { justify-content: flex-start; }
}
@media print {
  @page { size: A4 portrait; margin: 10mm 12mm; }
  body, html { width: 100% !important; height: auto !important; margin: 0 !important; padding: 0 !important; background: #fff !important; }
  body * { visibility: hidden !important; }
  #cx-impressao, #cx-impressao * { visibility: visible !important; }
  #cx-impressao { position: absolute !important; top: 0; left: 0; width: 100% !important; max-height: none !important; overflow: visible !important; box-shadow: none !important; padding: 0 !important; margin: 0 !important; background: #fff !important; }
  .no-print { display: none !important; }
}
`;

function ResumoClinico({ c, aberto = false }) {
  const [expandido, setExpandido] = useState(aberto);
  if (!c) return null;
  const { Icone, bg, cor } = estiloEspecie(c.especie);
  const idade = c.idade !== null && c.idade !== undefined ? (c.idade < 1 ? `${Math.round(c.idade * 12)} meses` : `${fmtNum(c.idade, 1)} ano(s)`) : null;
  const sinais = [
    c.temperatura ? `${fmtNum(c.temperatura, 1)} °C` : null,
    c.frequencia_cardiaca ? `FC ${c.frequencia_cardiaca}` : null,
    c.frequencia_respiratoria ? `FR ${c.frequencia_respiratoria}` : null,
  ].filter(Boolean);
  return (
    <div className="cx-resumo">
      <div className="topo">
        <span className="cx-av" style={{ width: 36, height: 36, backgroundColor: bg }}><Icone size={19} color={cor} /></span>
        <span className="nm">{c.animal_nome}</span>
        <span style={{ color: "#64748b" }}>{c.animal_codigo}</span>
        <span className="cx-chip">{[c.especie, c.raca].filter(Boolean).join(" · ")}</span>
        {c.sexo && <span className="cx-chip">{c.sexo}</span>}
        {idade && <span className="cx-chip">{idade}</span>}
        {c.peso ? <span className="cx-chip">{fmtNum(c.peso)} kg</span> : null}
        {sinais.map((x) => <span key={x} className="cx-chip sinal">{x}</span>)}
        <span style={{ color: "#64748b" }}>Tutor: {c.tutor_nome || "-"}</span>
      </div>
      {c.queixa_principal && <div className={`queixa${expandido ? " completo" : ""}`}><b>Queixa / anamnese:</b> {c.queixa_principal}</div>}
      <details open={expandido} onToggle={(e) => setExpandido(e.currentTarget.open)}>
        <summary>Ver histórico clínico completo</summary>
        {c.historico_clinico && <div className="bloco"><b>Histórico clínico</b><div>{c.historico_clinico}</div></div>}
        {c.exame_fisico && <div className="bloco"><b>Exame físico</b><div>{c.exame_fisico}</div></div>}
        {c.justificativa_cirurgica && <div className="bloco"><b>Justificativa da indicação cirúrgica</b><div>{c.justificativa_cirurgica}</div></div>}
      </details>
    </div>
  );
}

const FORM_CIRURGIA = { consultaId: "", descricao: "", asa: ASA[0], status: STATUS[0], inicio: "", fim: "", obs: "", cirurgiaoId: "" };
const FORM_FARMACO = { nome: "", classe: "PRE_ANESTESICA", especie: "CANINO", dose_min: "", dose_max: "", dose_padrao: "", unidade_dose: "mg/kg", concentracao: "", unidade_conc: "mg/mL", via: "", observacoes: "", ativo: true, validado: false };

function Cirurgia() {
  const navigate = useNavigate();
  const [aba, setAba] = useState("PROCEDIMENTOS");
  const [cirurgias, setCirurgias] = useState([]);
  const [consultas, setConsultas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [contextos, setContextos] = useState([]);
  const [farmacos, setFarmacos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("ATIVAS");
  const [mensagemErro, setMensagemErro] = useState("");
  const [mensagemSucesso, setMensagemSucesso] = useState("");

  const [formAberto, setFormAberto] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState(FORM_CIRURGIA);
  const [justificativaAsa, setJustificativaAsa] = useState("");
  const [checklistAsa, setChecklistAsa] = useState([]);
  const [observacoesPosIa, setObservacoesPosIa] = useState("");
  const [carregandoIa, setCarregandoIa] = useState(false);
  const [carregandoRascunho, setCarregandoRascunho] = useState(false);
  const [erroRascunho, setErroRascunho] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [detalhe, setDetalhe] = useState(null);

  const [anestesia, setAnestesia] = useState(null); // cirurgia aberta na ficha anestésica
  const [farmacoForm, setFarmacoForm] = useState(null);
  const [farmacoEditId, setFarmacoEditId] = useState(null);

  const cfg = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });

  const erroApi = (error, padrao) => {
    const d = error?.response?.data?.detail;
    if (typeof d === "string" && d) return d;
    if (Array.isArray(d) && d[0]?.msg) return d[0].msg;
    return padrao;
  };

  const carregar = async () => {
    if (!localStorage.getItem("token")) return navigate("/");
    try {
      setCarregando(true);
      const [rc, rk, ru, rf, rx] = await Promise.all([
        api.get("/cirurgias/", cfg()),
        api.get("/consultas/", cfg()).catch(() => ({ data: [] })),
        api.get("/cirurgias/usuarios/veterinarios", cfg()).catch(() => ({ data: [] })),
        api.get("/cirurgias/farmacos", { ...cfg(), params: { incluir_inativos: true } }).catch(() => ({ data: [] })),
        api.get("/cirurgias/contextos", cfg()).catch(() => ({ data: [] })),
      ]);
      setContextos(rx.data || []);
      setCirurgias(rc.data || []);
      setConsultas(rk.data || []);
      setUsuarios(ru.data || []);
      setFarmacos(rf.data || []);
    } catch (error) {
      if (error.response?.status === 401) { localStorage.removeItem("token"); return navigate("/"); }
      setMensagemErro(erroApi(error, "Não foi possível carregar o centro cirúrgico."));
    } finally {
      setCarregando(false);
    }
  };
  useEffect(() => { carregar(); }, []);

  const consultaPorId = (id) => consultas.find((c) => c.id === Number(id));
  const ctxDe = (id) => contextos.find((c) => c.consulta_id === Number(id));
  const idsComCirurgia = useMemo(() => new Set(cirurgias.map((c) => c.consulta_id)), [cirurgias]);

  const fila = contextos.filter((c) => c.indicacao_cirurgia === true && !idsComCirurgia.has(c.consulta_id) && !STATUS_ENCERRADOS.includes(c.status));

  const visiveis = useMemo(() => {
    const termo = semAcento(busca).trim();
    return cirurgias.filter((c) => {
      if (filtro === "ATIVAS" && c.status === "Concluída") return false;
      if (filtro === "CONCLUIDAS" && c.status !== "Concluída") return false;
      if (!termo) return true;
      return semAcento(`${c.codigo} ${c.animal_nome || ctxDe(c.consulta_id)?.animal_nome || ""} ${c.descricao_tecnica} ${c.classificacao_asa}`).includes(termo);
    });
  }, [cirurgias, busca, filtro, contextos]);

  const nAguardando = cirurgias.filter((c) => c.status === "Aguardando Cirurgia").length;
  const nEmCirurgia = cirurgias.filter((c) => c.status === "Em Cirurgia").length;
  const nConcluidas = cirurgias.filter((c) => c.status === "Concluída").length;

  const gerarRascunhoTecnico = async () => {
    if (!form.consultaId) return;
    if (form.descricao.trim() && !window.confirm("Substituir o texto atual do campo pelo rascunho gerado?")) return;
    setCarregandoRascunho(true);
    setErroRascunho("");
    try {
      const r = await api.post(`/cirurgias/rascunho-tecnico/${form.consultaId}`, {}, cfg());
      setForm((f) => ({ ...f, descricao: r.data.descricao_tecnica || f.descricao }));
    } catch (error) {
      setErroRascunho(erroApi(error, "Não foi possível gerar o rascunho."));
    } finally {
      setCarregandoRascunho(false);
    }
  };

  /* ---------- formulário de cirurgia ---------- */
  const sugerirComIA = async (consultaId) => {
    const c = consultaPorId(consultaId);
    if (!c) return;
    setCarregandoIa(true);
    setJustificativaAsa("");
    setChecklistAsa([]);
    try {
      const r = await api.post("/consultas/sugerir-asa", {
        queixa_principal: c.queixa_principal || "Não informada",
        historico_clinico: c.historico_clinico || null,
        exame_fisico: c.exame_fisico || null,
        temperatura: c.temperatura || null,
        frequencia_cardiaca: c.frequencia_cardiaca || null,
        frequencia_respiratoria: c.frequencia_respiratoria || null,
        peso: c.peso || null,
      }, cfg());
      if (r.data) {
        setForm((f) => ({
          ...f,
          asa: r.data.classificacao_asa || f.asa,
          descricao: r.data.descricao_tecnica || f.descricao,
          obs: r.data.observacoes_pos || f.obs,
        }));
        if (r.data.justificativa) setJustificativaAsa(r.data.justificativa);
        setChecklistAsa(Array.isArray(r.data.checklist_pre_anestesico) ? r.data.checklist_pre_anestesico : []);
        setObservacoesPosIa(r.data.observacoes_pos || "");
      }
    } catch (e) {
      setMensagemErro("Não foi possível gerar a sugestão automática da IA. Preencha os campos manualmente.");
    } finally {
      setCarregandoIa(false);
    }
  };

  const abrirNovo = (consultaId = "") => {
    setMensagemErro(""); setMensagemSucesso("");
    setEditandoId(null);
    setJustificativaAsa("");
    setForm({ ...FORM_CIRURGIA, consultaId: consultaId ? String(consultaId) : "", inicio: agoraInput() });
    setFormAberto(true);
  };

  const abrirEdicao = (c) => {
    setEditandoId(c.id);
    setJustificativaAsa("");
    setForm({
      consultaId: String(c.consulta_id || ""), descricao: c.descricao_tecnica || "", asa: c.classificacao_asa || ASA[0],
      status: c.status || STATUS[0], inicio: paraInputLocal(c.data_hora_inicio), fim: paraInputLocal(c.data_hora_fim),
      obs: c.observacoes_pos_operatorias || "", cirurgiaoId: "",
    });
    setFormAberto(true);
  };

  const salvarCirurgia = async (e) => {
    e.preventDefault();
    setMensagemErro(""); setMensagemSucesso("");
    if (!form.consultaId || !form.descricao.trim() || !form.inicio) return setMensagemErro("Preencha a consulta de origem, a descrição técnica e o início.");
    const payload = {
      consulta_id: Number(form.consultaId),
      descricao_tecnica: form.descricao,
      classificacao_asa: form.asa,
      status: form.status,
      data_hora_inicio: inputParaISO(form.inicio),
      data_hora_fim: inputParaISO(form.fim),
      observacoes_pos_operatorias: form.obs || null,
      equipe_cirurgica_ids: form.cirurgiaoId ? [Number(form.cirurgiaoId)] : [],
    };
    try {
      setSalvando(true);
      if (editandoId) { await api.put(`/cirurgias/${editandoId}`, payload, cfg()); setMensagemSucesso("Procedimento atualizado."); }
      else { await api.post("/cirurgias/", payload, cfg()); setMensagemSucesso("Procedimento cadastrado."); }
      setFormAberto(false); setEditandoId(null);
      await carregar();
    } catch (error) {
      setMensagemErro(erroApi(error, "Erro ao salvar o procedimento."));
    } finally {
      setSalvando(false);
    }
  };

  const dispensar = async (c) => {
    if (!window.confirm(`Remover ${c.animal_nome} (${c.consulta_codigo}) da fila cirúrgica? A indicação será descartada.`)) return;
    setMensagemErro(""); setMensagemSucesso("");
    try {
      await api.post(`/cirurgias/dispensar-indicacao/${c.consulta_id}`, {}, cfg());
      setMensagemSucesso("Paciente removido da fila cirúrgica.");
      await carregar();
    } catch (error) {
      setMensagemErro(erroApi(error, "Não foi possível dispensar a indicação."));
    }
  };

  const mudarStatus = async (c, novo) => {
    setMensagemErro(""); setMensagemSucesso("");
    const agora = new Date().toISOString();
    const payload = { status: novo };
    if (novo === "Em Cirurgia" && !c.data_hora_inicio) payload.data_hora_inicio = agora;
    if (novo === "Concluída") payload.data_hora_fim = agora;
    try {
      await api.put(`/cirurgias/${c.id}`, payload, cfg());
      setMensagemSucesso(novo === "Concluída" ? "Cirurgia concluída. O paciente volta para a internação ou segue para o pagamento." : "Cirurgia iniciada.");
      await carregar();
    } catch (error) {
      setMensagemErro(erroApi(error, "Não foi possível atualizar o status."));
    }
  };

  /* ---------- fármacos ---------- */
  const abrirFarmaco = (f, validar = false) => {
    if (!f) { setFarmacoEditId(null); setFarmacoForm({ ...FORM_FARMACO }); return; }
    setFarmacoEditId(f.id);
    setFarmacoForm({
      nome: f.nome, classe: f.classe, especie: f.especie, dose_min: String(f.dose_min), dose_max: String(f.dose_max),
      dose_padrao: f.dose_padrao !== null ? String(f.dose_padrao) : "", unidade_dose: f.unidade_dose,
      concentracao: f.concentracao !== null ? String(f.concentracao) : "", unidade_conc: f.unidade_conc || "mg/mL",
      via: f.via || "", observacoes: f.observacoes || "", ativo: f.ativo, validado: validar ? true : f.status === "VALIDADO",
    });
  };

  const salvarFarmaco = async () => {
    setMensagemErro(""); setMensagemSucesso("");
    const f = farmacoForm;
    if (!f.nome.trim() || !f.dose_min || !f.dose_max) return setMensagemErro("Informe o nome e as doses mínima e máxima.");
    const payload = {
      nome: f.nome.trim(), classe: f.classe, especie: f.especie,
      dose_min: num(f.dose_min), dose_max: num(f.dose_max),
      dose_padrao: f.dose_padrao === "" ? null : num(f.dose_padrao),
      unidade_dose: f.unidade_dose,
      concentracao: f.concentracao === "" ? null : num(f.concentracao),
      unidade_conc: f.concentracao === "" ? null : f.unidade_conc,
      via: f.via || null, observacoes: f.observacoes || null, ativo: f.ativo, validado: f.validado,
    };
    try {
      if (farmacoEditId) await api.put(`/cirurgias/farmacos/${farmacoEditId}`, payload, cfg());
      else await api.post("/cirurgias/farmacos", payload, cfg());
      setFarmacoForm(null); setFarmacoEditId(null);
      setMensagemSucesso(f.validado ? "Fármaco salvo e validado em seu nome." : "Fármaco salvo como rascunho.");
      await carregar();
    } catch (error) {
      setMensagemErro(erroApi(error, "Erro ao salvar o fármaco."));
    }
  };

  const farmacosAgrupados = useMemo(() => {
    const termo = semAcento(busca).trim();
    const grupos = {};
    farmacos.forEach((f) => {
      if (termo && !semAcento(`${f.nome} ${CLASSES[f.classe]?.rotulo || f.classe}`).includes(termo)) return;
      (grupos[f.classe] = grupos[f.classe] || []).push(f);
    });
    return grupos;
  }, [farmacos, busca]);
  const nRascunho = farmacos.filter((f) => f.ativo && f.status !== "VALIDADO").length;

  const badgeStatus = (s) => ({ "Aguardando Cirurgia": "amar", "Em Cirurgia": "roxo", "Concluída": "verde" }[s] || "cinza");

  return (
    <Layout>
      <style>{CSS}</style>
      <div className="cx-root">
        <div className="cx-hero">
          <div className="cx-hero-top">
            <div className="cx-titulo">
              <div className="cx-icone"><MdLocalHospital size={28} /></div>
              <div>
                <h1>Centro Cirúrgico & Anestesiologia</h1>
                <p>Fila cirúrgica, procedimentos, ficha anestésica com cálculo de doses por peso.</p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="button" className="cx-btn claro" onClick={carregar} disabled={carregando}><MdRefresh size={18} /> {carregando ? "Atualizando..." : "Atualizar"}</button>
              {aba === "PROCEDIMENTOS"
                ? <button type="button" className="cx-btn roxo" onClick={() => abrirNovo()}><MdAdd size={18} /> Nova cirurgia</button>
                : <button type="button" className="cx-btn roxo" onClick={() => abrirFarmaco(null)}><MdAdd size={18} /> Novo fármaco</button>}
            </div>
          </div>
          <div className="cx-stats">
            <div className="cx-stat"><b>{fila.length}</b><span>na fila cirúrgica</span></div>
            <div className="cx-stat"><b>{nAguardando}</b><span>aguardando cirurgia</span></div>
            <div className="cx-stat"><b>{nEmCirurgia}</b><span>em cirurgia</span></div>
            <div className="cx-stat"><b>{nConcluidas}</b><span>concluídas</span></div>
          </div>
        </div>

        {mensagemSucesso && <div className="cx-msg ok"><MdCheckCircle size={20} /> {mensagemSucesso}</div>}
        {mensagemErro && <div className="cx-msg erro"><MdErrorOutline size={20} /> {mensagemErro}</div>}

        <div className="cx-abas">
          <button type="button" className={aba === "PROCEDIMENTOS" ? "on" : ""} onClick={() => setAba("PROCEDIMENTOS")}>Procedimentos</button>
          <button type="button" className={aba === "FARMACOS" ? "on" : ""} onClick={() => setAba("FARMACOS")}>Fármacos e doses{nRascunho > 0 ? ` · ${nRascunho} a validar` : ""}</button>
        </div>

        {aba === "PROCEDIMENTOS" && (
          <>
            {fila.length > 0 && (
              <div className="cx-fila">
                <h3><MdWarning size={20} /> Fila cirúrgica: pacientes com indicação de cirurgia</h3>
                <p>Atendimentos com indicação cirúrgica que ainda não têm procedimento aberto.</p>
                {fila.map((c) => (
                  <div key={c.consulta_id} className="cx-fila-item" style={{ display: "block" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                      <div>
                        <b>{c.consulta_codigo}</b> <span style={{ color: "#64748b", fontSize: 12.5 }}>· {c.status}</span>
                        {c.justificativa_cirurgica && <div style={{ fontSize: 13, color: "#92400e", marginTop: 2 }}>Indicação: {c.justificativa_cirurgica}</div>}
                      </div>
                      <div className="cx-acoes">
                        <button type="button" className="cx-btn roxo mini" onClick={() => abrirNovo(c.consulta_id)}>Abrir procedimento</button>
                        <button type="button" className="cx-btn cinza mini" onClick={() => dispensar(c)} title="A indicação foi descartada">Sem indicação</button>
                      </div>
                    </div>
                    <ResumoClinico c={c} />
                  </div>
                ))}
              </div>
            )}

            <div className="cx-filtros">
              <div className="cx-busca">
                <MdSearch size={20} />
                <input className="cx-input" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por código, paciente ou procedimento..." />
              </div>
              <select className="cx-select" style={{ width: "auto" }} value={filtro} onChange={(e) => setFiltro(e.target.value)}>
                <option value="ATIVAS">Em andamento</option>
                <option value="CONCLUIDAS">Concluídas</option>
                <option value="TODAS">Todas</option>
              </select>
            </div>

            {visiveis.length === 0 ? (
              <div className="cx-vazio">
                <div style={{ fontSize: 38 }}>🩺</div>
                <b style={{ display: "block", color: "#0f172a", fontSize: 16, margin: "4px 0" }}>{carregando ? "Carregando..." : "Nenhum procedimento encontrado"}</b>
                {!carregando && "Abra um procedimento pela fila cirúrgica ou pelo botão Nova cirurgia."}
              </div>
            ) : (
              <div className="cx-lista">
                {visiveis.map((c) => {
                  const cons = consultaPorId(c.consulta_id);
                  const px = ctxDe(c.consulta_id);
                  const nomePac = c.animal_nome || px?.animal_nome || "Paciente";
                  const { Icone: IconeP, bg: bgP, cor: corP } = estiloEspecie(px?.especie);
                  return (
                    <div key={c.id} className="cx-card">
                      <div className="cx-pac">
                        <div className="cx-av" style={{ backgroundColor: bgP }}><IconeP size={24} color={corP} /></div>
                        <div style={{ minWidth: 0 }}>
                          <div className="cx-nome">{nomePac}</div>
                          <div className="cx-sub"><span className="cx-cod">{c.codigo || `CIR-${String(c.id).padStart(3, "0")}`}</span>{(px?.consulta_codigo || cons?.codigo) && <span>{px?.consulta_codigo || cons?.codigo}</span>}</div>
                          <div className="cx-sub">{[px?.especie, px?.peso ? `${fmtNum(px.peso)} kg` : null].filter(Boolean).join(" · ")}{px?.tutor_nome ? ` · ${px.tutor_nome}` : ""}</div>
                          <div className="cx-sub">{c.classificacao_asa}</div>
                        </div>
                      </div>
                      <div>
                        <div className="cx-desc" title={c.descricao_tecnica}>{c.descricao_tecnica}</div>
                        <div className="cx-meta">Início: {fmtDataHora(c.data_hora_inicio)}{c.data_hora_fim ? ` · Fim: ${fmtDataHora(c.data_hora_fim)}` : ""}</div>
                      </div>
                      <div className="cx-lado">
                        <span className={`cx-badge ${badgeStatus(c.status)}`}>{c.status || "Aguardando Cirurgia"}</span>
                        <div className="cx-acoes">
                          {c.status === "Aguardando Cirurgia" && <button type="button" className="cx-btn verde mini" onClick={() => mudarStatus(c, "Em Cirurgia")}><MdPlayArrow size={17} /> Iniciar</button>}
                          {c.status === "Em Cirurgia" && <button type="button" className="cx-btn verde mini" onClick={() => mudarStatus(c, "Concluída")}><MdCheckCircle size={17} /> Concluir</button>}
                          <button type="button" className="cx-btn roxo mini" onClick={() => setAnestesia(c)}><MdMedication size={17} /> Ficha anestésica</button>
                          <button type="button" className="cx-btn azul mini" onClick={() => setDetalhe(c)} title="Detalhes"><MdVisibility size={17} /></button>
                          <button type="button" className="cx-btn amarelo mini" onClick={() => abrirEdicao(c)} title="Editar"><MdEdit size={17} /></button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {aba === "FARMACOS" && (
          <>
            <div className="cx-alerta azul" style={{ marginTop: 0, marginBottom: 14 }}>
              <MdWarning size={18} style={{ flexShrink: 0 }} />
              <span>As doses abaixo são a base do cálculo da ficha anestésica. Itens em <b>rascunho</b> ainda não foram conferidos por um veterinário: revise dose, concentração e unidade e use <b>Validar</b>. A validação fica registrada com o seu nome.</span>
            </div>
            <div className="cx-filtros">
              <div className="cx-busca">
                <MdSearch size={20} />
                <input className="cx-input" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar fármaco ou classe..." />
              </div>
            </div>
            {Object.keys(farmacosAgrupados).length === 0 && <div className="cx-vazio">Nenhum fármaco encontrado.</div>}
            {Object.entries(farmacosAgrupados).map(([classe, lista]) => (
              <div key={classe}>
                <div className="cx-grupo">{CLASSES[classe]?.rotulo || classe}</div>
                <div className="cx-box" style={{ padding: 0, overflowX: "auto" }}>
                  <table className="cx-tab">
                    <thead><tr><th>Fármaco</th><th>Espécie</th><th>Faixa de dose</th><th>Padrão</th><th>Concentração</th><th>Via</th><th>Situação</th><th /></tr></thead>
                    <tbody>
                      {lista.map((f) => (
                        <tr key={f.id} style={{ opacity: f.ativo ? 1 : 0.5 }}>
                          <td><b>{f.nome}</b>{!f.ativo ? " (inativo)" : ""}</td>
                          <td>{f.especie === "CANINO" ? "Cão" : "Gato"}</td>
                          <td>{fmtNum(f.dose_min)}–{fmtNum(f.dose_max)} {f.unidade_dose}</td>
                          <td>{f.dose_padrao !== null ? `${fmtNum(f.dose_padrao)} ${f.unidade_dose}` : "-"}</td>
                          <td>{f.concentracao !== null ? `${fmtNum(f.concentracao)} ${f.unidade_conc}` : "informar no uso"}</td>
                          <td>{f.via || "-"}</td>
                          <td>{f.status === "VALIDADO" ? <span className="cx-badge verde" title={f.validado_por ? `por ${f.validado_por}` : ""}>Validado</span> : <span className="cx-badge amar">Rascunho</span>}</td>
                          <td style={{ whiteSpace: "nowrap" }}>
                            {f.status !== "VALIDADO" && <button type="button" className="cx-btn verde mini" onClick={() => abrirFarmaco(f, true)}>Validar</button>}{" "}
                            <button type="button" className="cx-btn amarelo mini" onClick={() => abrirFarmaco(f)}><MdEdit size={15} /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </>
        )}

        {formAberto && (
          <div className="cx-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setFormAberto(false); }}>
            <form className="cx-modal" onSubmit={salvarCirurgia}>
              <h3 className="tit">
                {editandoId ? "✏️ Editar procedimento cirúrgico" : "🔪 Abrir procedimento cirúrgico"}
                {carregandoIa && <span style={{ fontSize: 12, color: "#6d28d9", fontWeight: 600, display: "inline-flex", gap: 4, alignItems: "center" }}><MdAutoAwesome /> IA preenchendo sugestões...</span>}
              </h3>
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
                <button type="button" className="cx-btn" disabled={!form.consultaId || carregandoIa}
                  onClick={() => sugerirComIA(form.consultaId)}
                  style={{ background: "#ede9fe", color: "#6d28d9", border: "1px solid #c4b5fd", display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <MdAutoAwesome /> {carregandoIa ? "Gerando sugestão..." : "Sugestão de IA"}
                </button>
              </div>
              <div className="cx-grid">
                <div>
                  <label className="cx-label">Atendimento de origem *</label>
                  <select className="cx-select" value={form.consultaId} disabled={!!editandoId} onChange={(e) => setForm({ ...form, consultaId: e.target.value })}>
                    <option value="">Selecione</option>
                    {contextos.filter((c) => c.indicacao_cirurgia === true || String(c.consulta_id) === form.consultaId).map((c) => (
                      <option key={c.consulta_id} value={c.consulta_id}>{c.consulta_codigo} · {c.animal_nome} ({c.especie})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="cx-label">Classificação ASA *</label>
                  <select className="cx-select" value={form.asa} onChange={(e) => setForm({ ...form, asa: e.target.value })}>{ASA.map((a) => <option key={a} value={a}>{a}</option>)}</select>
                </div>
                <div>
                  <label className="cx-label">Status *</label>
                  <select className="cx-select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{STATUS.map((s) => <option key={s} value={s}>{s}</option>)}</select>
                </div>
                <div>
                  <label className="cx-label">Início *</label>
                  <input className="cx-input" type="datetime-local" value={form.inicio} onChange={(e) => setForm({ ...form, inicio: e.target.value })} />
                </div>
                <div>
                  <label className="cx-label">Término</label>
                  <input className="cx-input" type="datetime-local" value={form.fim} onChange={(e) => setForm({ ...form, fim: e.target.value })} />
                </div>
                <div>
                  <label className="cx-label">Cirurgião responsável</label>
                  <select className="cx-select" value={form.cirurgiaoId} onChange={(e) => setForm({ ...form, cirurgiaoId: e.target.value })}>
                    <option value="">Selecione o veterinário</option>
                    {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
                  </select>
                </div>
              </div>
              {form.consultaId && <ResumoClinico c={ctxDe(form.consultaId)} />}
              {justificativaAsa && <div className="cx-ia"><strong>🤖 Parecer automático da IA:</strong> {justificativaAsa}</div>}
              {checklistAsa.length > 0 && (
                <div className="cx-ia">
                  <strong>✅ Checklist pré-anestésico (apoio, confira cada item):</strong>
                  <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>
                    {checklistAsa.map((item, i) => <li key={i}>{item}</li>)}
                  </ul>
                  {observacoesPosIa && <div style={{ marginTop: 6 }}><strong>Pós-anestésico:</strong> {observacoesPosIa}</div>}
                </div>
              )}
              <div style={{ marginTop: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}><label className="cx-label">Descrição técnica do procedimento *</label><button type="button" className="cx-btn cinza" disabled={!form.consultaId || carregandoRascunho} onClick={gerarRascunhoTecnico}>{carregandoRascunho ? "Gerando rascunho..." : "Gerar rascunho"}</button></div>
                <textarea className="cx-area" rows={4} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Procedimento escolhido pelo cirurgião, técnica, achados transoperatórios, intercorrências, hemostasia e fechamento" />
                {erroRascunho && <div className="cx-msg erro" style={{ marginTop: 8 }}><MdErrorOutline size={20} /> {erroRascunho}</div>}
              </div>
              <div style={{ marginTop: 14 }}>
                <label className="cx-label">Observações / pós-operatório</label>
                <textarea className="cx-area" rows={3} value={form.obs} onChange={(e) => setForm({ ...form, obs: e.target.value })} />
              </div>
              {mensagemErro && <div className="cx-msg erro"><MdErrorOutline size={20} /> {mensagemErro}</div>}
              <div className="cx-fim">
                <button type="button" className="cx-btn cinza" onClick={() => setFormAberto(false)}>Cancelar</button>
                <button type="submit" className="cx-btn verde" disabled={salvando}>{salvando ? "Salvando..." : editandoId ? "Salvar alterações" : "Salvar procedimento"}</button>
              </div>
            </form>
          </div>
        )}

        {detalhe && (
          <div className="cx-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setDetalhe(null); }}>
            <div className="cx-modal">
              <h3 className="tit"><MdLocalHospital color="#6d28d9" /> {detalhe.codigo || `CIR-${String(detalhe.id).padStart(3, "0")}`} · {detalhe.animal_nome || ctxDe(detalhe.consulta_id)?.animal_nome || "Paciente"}</h3>
              <ResumoClinico c={ctxDe(detalhe.consulta_id)} />
              <div style={{ height: 14 }} />
              <div className="cx-grid" style={{ marginBottom: 14 }}>
                <div className="cx-box"><div className="cx-label">Classificação ASA</div>{detalhe.classificacao_asa}</div>
                <div className="cx-box"><div className="cx-label">Status</div><span className={`cx-badge ${badgeStatus(detalhe.status)}`}>{detalhe.status}</span></div>
                <div className="cx-box"><div className="cx-label">Início</div>{fmtDataHora(detalhe.data_hora_inicio)}</div>
                <div className="cx-box"><div className="cx-label">Término</div>{fmtDataHora(detalhe.data_hora_fim)}</div>
              </div>
              <div className="cx-box" style={{ marginBottom: 12 }}><div className="cx-label">Descrição técnica</div><div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6, fontSize: 14 }}>{detalhe.descricao_tecnica || "Nenhuma descrição informada."}</div></div>
              <div className="cx-box"><div className="cx-label">Observações / pós-operatório</div><div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6, fontSize: 14 }}>{detalhe.observacoes_pos_operatorias || "Nenhuma observação registrada."}</div></div>
              <div className="cx-fim"><button type="button" className="cx-btn cinza" onClick={() => setDetalhe(null)}><MdClose size={17} /> Fechar</button></div>
            </div>
          </div>
        )}

        {farmacoForm && (
          <div className="cx-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setFarmacoForm(null); }}>
            <div className="cx-modal">
              <h3 className="tit">{farmacoEditId ? "✏️ Editar fármaco" : "💊 Novo fármaco"}</h3>
              <div className="cx-grid">
                <div><label className="cx-label">Nome (com apresentação) *</label><input className="cx-input" value={farmacoForm.nome} onChange={(e) => setFarmacoForm({ ...farmacoForm, nome: e.target.value })} placeholder="Ex: Propofol 10 mg/mL" /></div>
                <div><label className="cx-label">Classe *</label>
                  <select className="cx-select" value={farmacoForm.classe} onChange={(e) => setFarmacoForm({ ...farmacoForm, classe: e.target.value })}>{Object.entries(CLASSES).map(([k, v]) => <option key={k} value={k}>{v.rotulo}</option>)}</select></div>
                <div><label className="cx-label">Espécie *</label>
                  <select className="cx-select" value={farmacoForm.especie} onChange={(e) => setFarmacoForm({ ...farmacoForm, especie: e.target.value })}><option value="CANINO">Cão</option><option value="FELINO">Gato</option></select></div>
                <div><label className="cx-label">Unidade da dose *</label>
                  <select className="cx-select" value={farmacoForm.unidade_dose} onChange={(e) => setFarmacoForm({ ...farmacoForm, unidade_dose: e.target.value })}><option value="mg/kg">mg/kg</option><option value="mcg/kg">mcg/kg</option><option value="mL/kg">mL/kg</option><option value="mL/kg/h">mL/kg/h</option></select></div>
                <div><label className="cx-label">Dose mínima *</label><input className="cx-input" inputMode="decimal" value={farmacoForm.dose_min} onChange={(e) => setFarmacoForm({ ...farmacoForm, dose_min: e.target.value })} /></div>
                <div><label className="cx-label">Dose máxima *</label><input className="cx-input" inputMode="decimal" value={farmacoForm.dose_max} onChange={(e) => setFarmacoForm({ ...farmacoForm, dose_max: e.target.value })} /></div>
                <div><label className="cx-label">Dose padrão (sugerida)</label><input className="cx-input" inputMode="decimal" value={farmacoForm.dose_padrao} onChange={(e) => setFarmacoForm({ ...farmacoForm, dose_padrao: e.target.value })} /></div>
                <div><label className="cx-label">Concentração do frasco</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input className="cx-input" inputMode="decimal" value={farmacoForm.concentracao} onChange={(e) => setFarmacoForm({ ...farmacoForm, concentracao: e.target.value })} placeholder="vazio = informar no uso" />
                    <select className="cx-select" style={{ width: 120 }} value={farmacoForm.unidade_conc} onChange={(e) => setFarmacoForm({ ...farmacoForm, unidade_conc: e.target.value })}><option value="mg/mL">mg/mL</option><option value="mcg/mL">mcg/mL</option></select>
                  </div></div>
                <div><label className="cx-label">Via</label><input className="cx-input" value={farmacoForm.via} onChange={(e) => setFarmacoForm({ ...farmacoForm, via: e.target.value })} placeholder="Ex: IM/IV" /></div>
              </div>
              <div style={{ marginTop: 14 }}><label className="cx-label">Observações e cuidados</label><textarea className="cx-area" rows={3} value={farmacoForm.observacoes} onChange={(e) => setFarmacoForm({ ...farmacoForm, observacoes: e.target.value })} /></div>
              <label className="cx-check">
                <input type="checkbox" checked={farmacoForm.validado} onChange={(e) => setFarmacoForm({ ...farmacoForm, validado: e.target.checked })} style={{ marginTop: 3 }} />
                <span><b>Conferi e valido estas doses, unidade e concentração.</b> A validação fica registrada em meu nome. Se esta caixa ficar desmarcada, o fármaco permanece como rascunho.</span>
              </label>
              <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12, fontSize: 13 }}><input type="checkbox" checked={farmacoForm.ativo} onChange={(e) => setFarmacoForm({ ...farmacoForm, ativo: e.target.checked })} /> Ativo (aparece na ficha anestésica)</label>
              <div className="cx-fim">
                <button type="button" className="cx-btn cinza" onClick={() => setFarmacoForm(null)}>Cancelar</button>
                <button type="button" className="cx-btn verde" onClick={salvarFarmaco}>Salvar</button>
              </div>
            </div>
          </div>
        )}

        {anestesia && (
          <FichaAnestesica
            cirurgia={anestesia}
            contexto={ctxDe(anestesia.consulta_id)}
            farmacos={farmacos.filter((f) => f.ativo)}
            cfg={cfg}
            erroApi={erroApi}
            onFechar={() => setAnestesia(null)}
            onAviso={(m) => setMensagemSucesso(m)}
          />
        )}
      </div>
    </Layout>
  );
}

function FichaAnestesica({ cirurgia, contexto, farmacos, cfg, erroApi, onFechar, onAviso }) {
  const hepatopata = /portossistem|shunt|hepatopatia|encefalopatia hepatica|insuficiencia hepatica|hepatica grave/.test(
    semAcento([contexto?.queixa_principal, contexto?.historico_clinico, contexto?.exame_fisico, contexto?.justificativa_cirurgica,
      contexto?.suspeita_diagnostica, cirurgia?.descricao, cirurgia?.observacoes].filter(Boolean).join(" "))
  );
  const [paciente, setPaciente] = useState(null);
  const [ficha, setFicha] = useState(null);
  const [texto, setTexto] = useState({ protocolo_mpa: "", protocolo_inducao: "", protocolo_manutencao: "", fluidoterapia: "" });
  const [monit, setMonit] = useState([]);
  const [peso, setPeso] = useState("");
  const [farmacoId, setFarmacoId] = useState("");
  const [dose, setDose] = useState("");
  const [conc, setConc] = useState("");
  const [unidadeConc, setUnidadeConc] = useState("mg/mL");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [mForm, setMForm] = useState({ tempo_minutos: "", frequencia_cardiaca: "", frequencia_respiratoria: "", temperatura: "", spo2: "", pas: "", pad: "" });

  useEffect(() => {
    (async () => {
      try {
        const rp = await api.get(`/cirurgias/${cirurgia.id}/paciente`, cfg());
        setPaciente(rp.data);
        setPeso(rp.data.peso !== null && rp.data.peso !== undefined ? String(rp.data.peso) : "");
      } catch (e) { setErro(erroApi(e, "Não foi possível carregar o paciente.")); }
      try {
        const rf = await api.get(`/cirurgias/fichas-anestesicas/${cirurgia.id}`, cfg());
        setFicha(rf.data);
        setTexto({
          protocolo_mpa: rf.data.protocolo_mpa || "", protocolo_inducao: rf.data.protocolo_inducao || "",
          protocolo_manutencao: rf.data.protocolo_manutencao || "", fluidoterapia: rf.data.fluidoterapia || "",
        });
        const rm = await api.get(`/cirurgias/monitoramento/${rf.data.id}`, cfg());
        setMonit(rm.data || []);
      } catch (e) { /* ficha ainda não criada: normal */ }
    })();
  }, [cirurgia.id]);

  const esp = especieCalc(paciente?.especie);
  const opcoes = farmacos.filter((f) => f.especie === esp);
  const grupos = {};
  opcoes.forEach((f) => { (grupos[f.classe] = grupos[f.classe] || []).push(f); });
  const f = opcoes.find((x) => String(x.id) === String(farmacoId)) || null;

  const escolherFarmaco = (id) => {
    setFarmacoId(id);
    const x = opcoes.find((o) => String(o.id) === String(id));
    if (x) {
      setDose(String(x.dose_padrao ?? x.dose_min));
      setConc(x.concentracao !== null ? String(x.concentracao) : "");
      setUnidadeConc(x.unidade_conc || "mg/mL");
    } else { setDose(""); setConc(""); }
  };

  const pesoN = num(peso);
  const doseN = num(dose);
  const concN = num(conc);
  const r = f ? calcularDose({ peso: pesoN, dose: doseN, unidadeDose: f.unidade_dose, conc: concN, unidadeConc }) : null;
  const rMin = f ? calcularDose({ peso: pesoN, dose: f.dose_min, unidadeDose: f.unidade_dose, conc: concN, unidadeConc }) : null;
  const rMax = f ? calcularDose({ peso: pesoN, dose: f.dose_max, unidadeDose: f.unidade_dose, conc: concN, unidadeConc }) : null;
  const foraFaixa = f && Number.isFinite(doseN) && (doseN < f.dose_min || doseN > f.dose_max);
  const acimaMax = f && Number.isFinite(doseN) && doseN > f.dose_max;
  const ehLocal = f?.classe === "ANESTESICO_LOCAL";

  const textoLinha = () => {
    if (!f || !r) return "";
    const nome = f.nome;
    const dosePart = `${fmtNum(doseN)} ${f.unidade_dose}`;
    const totalPart = `${fmtNum(r.total)} ${r.unidadeTotal}`;
    const vol = r.volume !== null && !r.porHora ? ` = ${fmtNum(r.volume)} mL (${fmtNum(concN)} ${unidadeConc})` : "";
    return `${nome}: ${dosePart} (${totalPart})${vol}${f.via ? `, ${f.via}` : ""} — peso ${fmtNum(pesoN)} kg`;
  };

  const adicionar = () => {
    const linha = textoLinha();
    if (!linha) return;
    const campo = CLASSES[f.classe]?.campo || "protocolo_manutencao";
    setTexto((t) => ({ ...t, [campo]: t[campo] ? `${t[campo]}\n${linha}` : linha }));
    setFarmacoId(""); setDose(""); setConc("");
  };

  const salvarFicha = async () => {
    setErro(""); setSalvando(true);
    try {
      const r2 = await api.post("/cirurgias/fichas-anestesicas", { cirurgia_id: cirurgia.id, ...texto }, cfg());
      setFicha(r2.data);
      onAviso("Ficha anestésica salva.");
    } catch (e) { setErro(erroApi(e, "Erro ao salvar a ficha anestésica.")); }
    finally { setSalvando(false); }
  };

  const registrarMonit = async () => {
    setErro("");
    if (!ficha) return setErro("Salve a ficha anestésica antes de registrar o monitoramento.");
    if (mForm.tempo_minutos === "") return setErro("Informe o tempo (minutos) da aferição.");
    const payload = { ficha_anestesica_id: ficha.id };
    Object.entries(mForm).forEach(([k, v]) => { if (v !== "") payload[k] = Number(String(v).replace(",", ".")); });
    try {
      await api.post("/cirurgias/monitoramento", payload, cfg());
      const rm = await api.get(`/cirurgias/monitoramento/${ficha.id}`, cfg());
      setMonit(rm.data || []);
      setMForm({ tempo_minutos: String(Number(mForm.tempo_minutos) + 5), frequencia_cardiaca: "", frequencia_respiratoria: "", temperatura: "", spo2: "", pas: "", pad: "" });
    } catch (e) { setErro(erroApi(e, "Erro ao registrar a aferição.")); }
  };

  const imprimir = () => {
    const t = document.title;
    document.title = `Ficha_Anestesica_${String(paciente?.nome || "Paciente").replace(/\s+/g, "_")}`;
    window.print();
    setTimeout(() => { document.title = t; }, 1000);
  };

  const { Icone, bg, cor } = estiloEspecie(paciente?.especie);

  return (
    <div className="cx-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onFechar(); }}>
      <div className="cx-modal larga" id="cx-impressao">
        <h3 className="tit"><MdMedication color="#6d28d9" /> Ficha anestésica · {cirurgia.codigo || `CIR-${String(cirurgia.id).padStart(3, "0")}`}</h3>

        {erro && <div className="cx-msg erro"><MdErrorOutline size={20} /> {erro}</div>}

        {paciente && (
          <div className="cx-paciente">
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <span className="cx-av" style={{ width: 34, height: 34, backgroundColor: bg }}><Icone size={18} color={cor} /></span>
              <b>{paciente.nome}</b> ({paciente.codigo})
            </span>
            <span>{[paciente.especie, paciente.raca].filter(Boolean).join(" · ")}</span>
            <span><MdPerson size={14} /> {paciente.tutor_nome || "-"}</span>
            <span>{cirurgia.classificacao_asa}</span>
          </div>
        )}

        {contexto && <div className="no-print" style={{ marginBottom: 12 }}><ResumoClinico c={contexto} /></div>}

        {hepatopata && (
          <div className="cx-alerta amar no-print" style={{ marginTop: 0, marginBottom: 12 }}>
            <MdWarning size={16} style={{ flexShrink: 0 }} />
            <span><b>Suspeita de hepatopatia / shunt portossistêmico no prontuário.</b> Metabolização e depuração hepáticas reduzidas: evite benzodiazepínicos (ex.: diazepam, midazolam) e fármacos de metabolização hepática sem avaliação, prefira doses menores e titulação, confira glicemia, coagulação e albumina antes de anestesiar e monitore a temperatura. O veterinário define o protocolo.</span>
          </div>
        )}

        <div className="no-print">
          <div className="cx-calc">
            <h4><MdMedication size={18} /> Calculadora de dose por peso</h4>
            {!esp && paciente && <div className="cx-alerta amar"><MdWarning size={16} /> A biblioteca de doses cobre cães e gatos. Para outras espécies, preencha o protocolo manualmente.</div>}
            {esp && (
              <>
                <div className="cx-grid">
                  <div>
                    <label className="cx-label">Peso para o cálculo (kg) *</label>
                    <input className="cx-input" inputMode="decimal" value={peso} onChange={(e) => setPeso(e.target.value)} />
                    <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 4 }}>
                      {paciente?.peso_do_atendimento ? "Peso aferido neste atendimento." : paciente?.peso ? "Peso do cadastro do animal (sem pesagem neste atendimento)." : "Sem peso registrado: informe."}
                    </div>
                  </div>
                  <div>
                    <label className="cx-label">Fármaco ({esp === "CANINO" ? "cão" : "gato"})</label>
                    <select className="cx-select" value={farmacoId} onChange={(e) => escolherFarmaco(e.target.value)}>
                      <option value="">Selecione</option>
                      {Object.entries(grupos).map(([classe, lista]) => (
                        <optgroup key={classe} label={CLASSES[classe]?.rotulo || classe}>
                          {lista.map((x) => <option key={x.id} value={x.id}>{x.nome}{x.status !== "VALIDADO" ? " (rascunho)" : ""}</option>)}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                </div>

                {f && (
                  <>
                    <div className="cx-grid" style={{ marginTop: 12 }}>
                      <div>
                        <label className="cx-label">Dose ({f.unidade_dose}) · faixa {fmtNum(f.dose_min)}–{fmtNum(f.dose_max)}</label>
                        <input className="cx-input" inputMode="decimal" value={dose} onChange={(e) => setDose(e.target.value)} />
                      </div>
                      {f.unidade_dose !== "mL/kg/h" && f.unidade_dose !== "mL/kg" && (
                        <div>
                          <label className="cx-label">Concentração do frasco em uso *</label>
                          <div style={{ display: "flex", gap: 8 }}>
                            <input className="cx-input" inputMode="decimal" value={conc} onChange={(e) => setConc(e.target.value)} placeholder="confira o rótulo" />
                            <select className="cx-select" style={{ width: 110 }} value={unidadeConc} onChange={(e) => setUnidadeConc(e.target.value)}><option value="mg/mL">mg/mL</option><option value="mcg/mL">mcg/mL</option></select>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="cx-res">
                      {!r ? <div style={{ color: "#64748b", fontSize: 13 }}>Informe o peso e a dose para calcular.</div> : (
                        <>
                          <div className="grande">
                            {fmtNum(r.total)} {r.unidadeTotal}
                            {r.volume !== null && !r.porHora && f.unidade_dose !== "mL/kg" && <span style={{ color: "#6d28d9" }}> = {fmtNum(r.volume)} mL</span>}
                          </div>
                          {r.volume !== null && !r.porHora && f.unidade_dose !== "mL/kg" && r.volume > 0 && r.volume < 0.1 && (
                            <div className="cx-alerta azul"><span>Volume muito pequeno ({fmtNum(r.volume)} mL). Considere diluir o fármaco (por exemplo, 1:10 com soro fisiológico) para medir com seringa de 1 mL e recalcule o volume com a nova concentração.</span></div>
                          )}
                          {r.volume === null && !r.porHora && <div className="faixa" style={{ color: "#b45309", fontWeight: 700 }}>Informe a concentração do frasco para calcular o volume em mL.</div>}
                          <div className="faixa">
                            Faixa para {fmtNum(pesoN)} kg: {rMin ? `${fmtNum(rMin.total)}–${fmtNum(rMax.total)} ${r.unidadeTotal}` : "-"}
                            {rMin && rMin.volume !== null && !rMin.porHora && f.unidade_dose !== "mL/kg" ? ` (${fmtNum(rMin.volume)}–${fmtNum(rMax.volume)} mL)` : ""}
                          </div>
                        </>
                      )}
                      {acimaMax && <div className="cx-alerta verm"><MdWarning size={16} style={{ flexShrink: 0 }} /> Dose acima da faixa máxima ({fmtNum(f.dose_max)} {f.unidade_dose}). Confira antes de usar.</div>}
                      {foraFaixa && !acimaMax && <div className="cx-alerta amar"><MdWarning size={16} style={{ flexShrink: 0 }} /> Dose abaixo da faixa usual ({fmtNum(f.dose_min)} {f.unidade_dose}).</div>}
                      {f.classe === "INDUCAO" && <div className="cx-alerta amar"><MdWarning size={16} style={{ flexShrink: 0 }} /> O volume calculado é o teto estimado, não o volume a aplicar de uma vez. Administre fracionado, ao efeito (perda de reflexos), principalmente se o paciente já recebeu pré-anestesia.</div>}
                      {ehLocal && <div className="cx-alerta amar"><MdWarning size={16} style={{ flexShrink: 0 }} /> Anestésico local: a dose calculada é o limite máximo total do paciente, somando todos os bloqueios. Nunca por via intravenosa.</div>}
                      {f.status !== "VALIDADO" && <div className="cx-alerta amar"><MdWarning size={16} style={{ flexShrink: 0 }} /> Dose ainda não validada por um veterinário (rascunho). Confira antes de usar.</div>}
                      {f.observacoes && <div className="cx-alerta azul"><span>{f.observacoes}</span></div>}
                    </div>
                    <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
                      <button type="button" className="cx-btn roxo" disabled={!r} onClick={adicionar}><MdAdd size={18} /> Adicionar ao protocolo</button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        <div className="cx-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
          {CAMPOS_FICHA.map(([campo, rotulo]) => (
            <div key={campo}>
              <label className="cx-label">{rotulo}</label>
              <textarea className="cx-area" rows={5} value={texto[campo]} onChange={(e) => setTexto({ ...texto, [campo]: e.target.value })} />
            </div>
          ))}
        </div>

        <div className="cx-fim no-print" style={{ marginTop: 14 }}>
          <button type="button" className="cx-btn verde" onClick={salvarFicha} disabled={salvando}>{salvando ? "Salvando..." : "Salvar ficha anestésica"}</button>
        </div>

        <div className="cx-grupo">Monitoramento transoperatório</div>
        {monit.length > 0 ? (
          <div className="cx-box" style={{ padding: 0, overflowX: "auto" }}>
            <table className="cx-tab">
              <thead><tr><th>Tempo (min)</th><th>FC</th><th>FR</th><th>Temp (°C)</th><th>SpO₂ (%)</th><th>PAS</th><th>PAD</th></tr></thead>
              <tbody>{monit.map((m) => (
                <tr key={m.id}><td>{m.tempo_minutos}</td><td>{m.frequencia_cardiaca ?? "-"}</td><td>{m.frequencia_respiratoria ?? "-"}</td><td>{m.temperatura ?? "-"}</td><td>{m.spo2 ?? "-"}</td><td>{m.pas ?? "-"}</td><td>{m.pad ?? "-"}</td></tr>
              ))}</tbody>
            </table>
          </div>
        ) : <div style={{ fontSize: 13, color: "#64748b" }}>{ficha ? "Nenhuma aferição registrada." : "Salve a ficha para registrar as aferições."}</div>}

        <div className="no-print" style={{ marginTop: 12 }}>
          <div className="cx-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 8 }}>
            {[["tempo_minutos", "Tempo (min)"], ["frequencia_cardiaca", "FC"], ["frequencia_respiratoria", "FR"], ["temperatura", "Temp °C"], ["spo2", "SpO₂ %"], ["pas", "PAS"], ["pad", "PAD"]].map(([k, l]) => (
              <div key={k}><label className="cx-label">{l}</label><input className="cx-input" inputMode="decimal" value={mForm[k]} onChange={(e) => setMForm({ ...mForm, [k]: e.target.value })} /></div>
            ))}
          </div>
          <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
            <button type="button" className="cx-btn claro" onClick={registrarMonit}><MdAdd size={18} /> Registrar aferição</button>
          </div>
        </div>

        <div className="cx-assina">
          <div style={{ borderTop: "1px solid #9ca3af", width: 260, margin: "0 auto 8px" }} />
          <div style={{ fontWeight: 700, color: "#111827", fontSize: 14 }}>Médico(a) Veterinário(a) anestesista</div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>CRMV Responsável</div>
        </div>

        <div className="cx-fim no-print">
          <button type="button" className="cx-btn cinza" onClick={onFechar}><MdClose size={17} /> Fechar</button>
          <button type="button" className="cx-btn azul" onClick={imprimir}><MdPrint size={17} /> Imprimir ficha (A4)</button>
        </div>
      </div>
    </div>
  );
}

export default Cirurgia;