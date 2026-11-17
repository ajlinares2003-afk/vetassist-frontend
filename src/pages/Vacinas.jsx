import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MdVaccines, MdSearch, MdRefresh, MdAdd, MdClose, MdEdit, MdDelete, MdPrint, MdPerson, MdPets, MdErrorOutline, MdCheckCircle, MdWhatsapp, MdVisibility, MdEventNote } from "react-icons/md";
import { FaDog, FaCat, FaHorse, FaDove, FaFish, FaFrog, FaBug } from "react-icons/fa";
import { GiRabbit, GiCow, GiPig, GiSheep, GiGoat } from "react-icons/gi";
import api from "../api/api";
import Layout from "../components/Layout";

const DOSES = ["1ª Dose", "2ª Dose", "3ª Dose", "4ª Dose", "Reforço Anual", "Dose Única"];

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

/* ---------- datas (sempre como "AAAA-MM-DD", sem fuso) ---------- */
const parseYMD = (s) => {
  if (!s) return null;
  const [y, m, d] = String(s).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};
const fmtYMD = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
const somarDias = (ymd, n) => {
  const d = parseYMD(ymd);
  if (!d) return "";
  d.setDate(d.getDate() + n);
  return fmtYMD(d);
};
const formatarData = (ymd) => {
  const d = parseYMD(ymd);
  return d ? d.toLocaleDateString("pt-BR") : "-";
};
const hojeYMD = () => fmtYMD(new Date());
const diasAte = (ymd) => {
  const d = parseYMD(ymd);
  if (!d) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.round((d - hoje) / 86400000);
};
const dataSaoPauloYMD = (iso) => {
  if (!iso) return hojeYMD();
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return hojeYMD();
  return d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
};

/* ---------- regra de intervalo ---------- */
const ehFilhote = (a) => {
  if (!a) return false;
  if (a.data_nascimento) {
    const nasc = parseYMD(a.data_nascimento);
    if (nasc) return (new Date() - nasc) / 86400000 < 365;
  }
  return a.idade !== null && a.idade !== undefined && Number(a.idade) < 1;
};
const ehRaiva = (nome) => /raiv|antirr/i.test(nome || "");

// Sugestão editável pelo veterinário: filhote em série primária 21 dias (janela 21–30);
// demais casos, reforço anual de 365 dias (confirmar bula do fabricante e risco do paciente).
const sugerirReforco = (dataAplicacao, dose, nomeVacina, filhote) => {
  if (!dataAplicacao) return { data: "", motivo: "" };
  if (ehRaiva(nomeVacina)) return { data: somarDias(dataAplicacao, 365), motivo: "Antirrábica: reforço anual (365 dias)." };
  if (filhote && (dose === "1ª Dose" || dose === "2ª Dose")) {
    return { data: somarDias(dataAplicacao, 21), motivo: "Filhote em série primária: próxima dose em 21 dias. Ajuste entre 21 e 30 dias, conforme o retorno." };
  }
  if (filhote && (dose === "3ª Dose" || dose === "4ª Dose")) {
    return { data: somarDias(dataAplicacao, 365), motivo: "Série primária concluída: reforço anual (365 dias)." };
  }
  if (!filhote && (dose === "1ª Dose" || dose === "2ª Dose")) {
    return { data: somarDias(dataAplicacao, 365), motivo: "Adulto: reforço anual (365 dias). Se for primovacinação sem histórico, considere nova dose em 21 a 30 dias." };
  }
  return { data: somarDias(dataAplicacao, 365), motivo: "Reforço anual (365 dias). Confirme na bula do fabricante e no protocolo de risco do paciente." };
};

const situacaoDe = (v) => {
  if (v._superada) return { chave: "CONCLUIDA", rotulo: "Concluída", classe: "cinza" };
  if (!v.data_reforco) return { chave: "SEM", rotulo: "Sem reforço", classe: "cinza" };
  const dias = diasAte(v.data_reforco);
  const serie = v.data_aplicacao && v.data_reforco && (parseYMD(v.data_reforco) - parseYMD(v.data_aplicacao)) / 86400000 <= 35 && (v.dose === "1ª Dose" || v.dose === "2ª Dose");
  const alvo = serie ? "Próxima dose" : "Reforço";
  if (dias < 0) return { chave: "ATRASADA", rotulo: `${alvo} vencido em ${formatarData(v.data_reforco)}`, classe: "verm", dias };
  if (dias === 0) return { chave: "BREVE", rotulo: `${alvo} hoje`, classe: "amar", dias };
  if (dias <= 30) return { chave: "BREVE", rotulo: `${alvo} em ${dias} dia${dias === 1 ? "" : "s"} (${formatarData(v.data_reforco)})`, classe: "amar", dias };
  return { chave: "EM_DIA", rotulo: `Em dia · ${alvo.toLowerCase()} ${formatarData(v.data_reforco)}`, classe: "verde", dias };
};

const linkWhatsApp = (v, sit) => {
  const tel = String(v.tutor_telefone || "").replace(/\D/g, "");
  if (tel.length < 10) return null;
  const numero = tel.startsWith("55") ? tel : `55${tel}`;
  const quando = sit.chave === "ATRASADA" ? `venceu em ${formatarData(v.data_reforco)}` : `está previsto para ${formatarData(v.data_reforco)}`;
  const msg = `Olá, ${v.tutor_nome || "tudo bem"}! Aqui é da VetAssist AI. O reforço da vacina ${v.nome_vacina} do(a) ${v.animal_nome} ${quando}. Vamos agendar o retorno?`;
  return `https://wa.me/${numero}?text=${encodeURIComponent(msg)}`;
};

const CSS = `
.vx-root, .vx-root * { box-sizing: border-box; }
.vx-root * { text-align: left; }
.vx-root { color: #0f172a; font-family: inherit; }
.vx-hero { border-radius: 22px; padding: 22px 26px; margin-bottom: 18px; background: linear-gradient(120deg, #ecfdf5 0%, #f0fdfa 55%, #eef2ff 100%); border: 1px solid #a7f3d0; }
.vx-hero-top { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
.vx-titulo { display: flex; align-items: center; gap: 14px; }
.vx-icone { width: 52px; height: 52px; border-radius: 16px; background: #059669; color: #fff; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 18px rgba(5,150,105,.28); }
.vx-hero h1 { margin: 0; font-size: 25px; font-weight: 800; color: #064e3b; letter-spacing: -.3px; }
.vx-hero p { margin: 3px 0 0; font-size: 13.5px; color: #475569; }
.vx-stats { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 16px; }
.vx-stat { background: rgba(255,255,255,.9); border: 1px solid #e2e8f0; border-radius: 14px; padding: 10px 16px; min-width: 120px; }
.vx-stat b { display: block; font-size: 22px; font-weight: 800; color: #064e3b; line-height: 1.1; }
.vx-stat span { font-size: 12px; color: #64748b; font-weight: 600; }
.vx-stat.verm b { color: #b91c1c; }
.vx-stat.amar b { color: #b45309; }
.vx-filtros { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin-bottom: 14px; }
.vx-busca { position: relative; flex: 1; min-width: 240px; }
.vx-busca svg { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #94a3b8; }
.vx-input, .vx-select, .vx-area { border: 1px solid #d1d5db; border-radius: 12px; background: #fff; font-size: 14px; color: #0f172a; outline: none; padding: 0 14px; font-family: inherit; width: 100%; }
.vx-input, .vx-select { height: 44px; }
.vx-area { padding: 10px 14px; resize: vertical; }
.vx-busca .vx-input { padding-left: 40px; }
.vx-input:focus, .vx-select:focus, .vx-area:focus { border-color: #34d399; box-shadow: 0 0 0 3px rgba(52,211,153,.25); }
.vx-seg { display: inline-flex; background: #f1f5f9; border-radius: 12px; padding: 4px; gap: 2px; flex-wrap: wrap; }
.vx-seg button { border: none; background: transparent; padding: 8px 14px; border-radius: 9px; font-weight: 700; font-size: 13px; color: #475569; cursor: pointer; font-family: inherit; }
.vx-seg button.on { background: #fff; color: #047857; box-shadow: 0 1px 3px rgba(15,23,42,.12); }
.vx-btn { display: inline-flex; align-items: center; gap: 7px; border: none; border-radius: 12px; padding: 10px 16px; font-weight: 700; font-size: 13.5px; cursor: pointer; font-family: inherit; transition: filter .15s, transform .15s; text-decoration: none; }
.vx-btn:hover { filter: brightness(.95); transform: translateY(-1px); }
.vx-btn:disabled { opacity: .6; cursor: default; transform: none; }
.vx-btn.verde { background: #059669; color: #fff; }
.vx-btn.azul { background: #0284c7; color: #fff; }
.vx-btn.claro { background: #d1fae5; color: #065f46; }
.vx-btn.cinza { background: #f1f5f9; color: #334155; }
.vx-btn.amarelo { background: #fef3c7; color: #92400e; }
.vx-btn.vermelho { background: #fee2e2; color: #b91c1c; }
.vx-btn.perigo { background: #dc2626; color: #fff; }
.vx-btn.zap { background: #dcfce7; color: #166534; }
.vx-btn.mini { padding: 8px 10px; }
.vx-pend { background: #fffbeb; border: 1px solid #fde68a; border-radius: 18px; padding: 16px 18px; margin-bottom: 18px; }
.vx-pend h3 { margin: 0 0 4px; font-size: 16px; color: #92400e; display: flex; align-items: center; gap: 8px; }
.vx-pend > p { margin: 0 0 12px; font-size: 13px; color: #a16207; }
.vx-pend-item { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; background: #fff; border: 1px solid #fde68a; border-radius: 14px; padding: 10px 14px; margin-top: 8px; }
.vx-lista { display: grid; gap: 12px; }
.vx-card { display: grid; grid-template-columns: minmax(200px, 1.1fr) minmax(200px, 1.6fr) auto; gap: 18px; align-items: center; background: #fff; border: 1px solid #e5e7eb; border-radius: 18px; padding: 16px 18px; box-shadow: 0 2px 6px rgba(15,23,42,.05); transition: box-shadow .18s, transform .18s; }
.vx-card:hover { box-shadow: 0 12px 22px rgba(15,23,42,.10); transform: translateY(-1px); }
.vx-card.concluida { background: #f8fafc; }
.vx-pac { display: flex; align-items: center; gap: 12px; min-width: 0; }
.vx-av { width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.vx-nome { font-size: 16px; font-weight: 800; color: #0f172a; overflow-wrap: anywhere; }
.vx-sub { font-size: 12.5px; color: #64748b; display: flex; gap: 6px; align-items: center; flex-wrap: wrap; margin-top: 2px; }
.vx-vac { font-size: 15px; font-weight: 800; color: #047857; }
.vx-meta { font-size: 12.5px; color: #64748b; margin-top: 3px; }
.vx-lado { display: flex; flex-direction: column; gap: 8px; align-items: flex-end; }
.vx-lado, .vx-lado * { text-align: right; }
.vx-badge { font-size: 12px; font-weight: 800; padding: 4px 10px; border-radius: 99px; }
.vx-badge.verde { background: #dcfce7; color: #166534; }
.vx-badge.amar { background: #fef3c7; color: #92400e; }
.vx-badge.verm { background: #fee2e2; color: #991b1b; }
.vx-badge.cinza { background: #e2e8f0; color: #475569; }
.vx-acoes { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
.vx-vazio { background: #fff; border: 2px dashed #e2e8f0; border-radius: 18px; padding: 44px 20px; color: #64748b; }
.vx-vazio, .vx-vazio * { text-align: center; }
.vx-msg { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: 12px; font-weight: 600; font-size: 14px; margin-bottom: 14px; }
.vx-msg.erro { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }
.vx-msg.ok { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; }
.vx-overlay { position: fixed; inset: 0; background: rgba(15,23,42,.55); backdrop-filter: blur(3px); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 16px; }
.vx-modal { background: #fff; border-radius: 20px; width: 100%; max-width: 720px; max-height: calc(100vh - 32px); overflow-y: auto; padding: 28px; box-shadow: 0 30px 60px rgba(15,23,42,.3); }
.vx-modal.peq { max-width: 420px; }
.vx-modal.peq, .vx-modal.peq * { text-align: center; }
.vx-modal h3.tit { margin: 0 0 16px; font-size: 18px; color: #111827; }
.vx-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; }
.vx-label { display: block; font-size: 12.5px; font-weight: 700; color: #374151; margin-bottom: 5px; }
.vx-dica { margin-top: 12px; background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; border-radius: 12px; padding: 10px 14px; font-size: 13px; }
.vx-form-fim { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; padding-top: 14px; border-top: 1px solid #f1f5f9; flex-wrap: wrap; }
.vx-doc-topo { border-bottom: 2px solid #059669; padding-bottom: 14px; margin-bottom: 18px; }
.vx-doc-topo, .vx-doc-topo * { text-align: center; }
.vx-doc-topo h2 { margin: 0; font-size: 22px; color: #064e3b; }
.vx-doc-topo p { margin: 4px 0 0; font-size: 12px; font-weight: 800; color: #059669; text-transform: uppercase; letter-spacing: .5px; }
.vx-doc-dados { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px; font-size: 13px; display: grid; grid-template-columns: 1fr 1fr; gap: 6px 14px; margin-bottom: 18px; }
.vx-tab { width: 100%; border-collapse: collapse; font-size: 13px; }
.vx-tab th { background: #f1f5f9; color: #334155; padding: 9px 8px; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
.vx-tab td { padding: 9px 8px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
.vx-tab th, .vx-tab td { text-align: left; }
.vx-tab tr { break-inside: avoid; page-break-inside: avoid; }
.vx-assina { margin-top: 44px; }
.vx-assina, .vx-assina * { text-align: center; }
@media (max-width: 860px) {
  .vx-card { grid-template-columns: 1fr; }
  .vx-lado { align-items: flex-start; }
  .vx-lado, .vx-lado * { text-align: left; }
  .vx-acoes { justify-content: flex-start; }
  .vx-doc-dados { grid-template-columns: 1fr; }
}
@media print {
  @page { size: A4 portrait; margin: 10mm 12mm; }
  body, html { width: 100% !important; height: auto !important; margin: 0 !important; padding: 0 !important; background: #fff !important; }
  body * { visibility: hidden !important; }
  #vx-impressao, #vx-impressao * { visibility: visible !important; }
  #vx-impressao { position: absolute !important; top: 0; left: 0; width: 100% !important; max-height: none !important; overflow: visible !important; box-shadow: none !important; padding: 0 !important; margin: 0 !important; background: #fff !important; }
  .no-print { display: none !important; }
}
`;

const FORM_VAZIO = { animalId: "", nome: "", fabricante: "", dose: "1ª Dose", aplicacao: "", reforco: "", lote: "", obs: "" };

function Vacinas() {
  const navigate = useNavigate();
  const [vacinas, setVacinas] = useState([]);
  const [pendentes, setPendentes] = useState([]);
  const [animais, setAnimais] = useState([]);
  const [carregando, setCarregando] = useState(true);

  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("TODAS");
  const [mensagemErro, setMensagemErro] = useState("");
  const [mensagemSucesso, setMensagemSucesso] = useState("");

  const [formAberto, setFormAberto] = useState(false);
  const [vacinaEditando, setVacinaEditando] = useState(null);
  const [form, setForm] = useState(FORM_VAZIO);
  const [reforcoManual, setReforcoManual] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const [cartao, setCartao] = useState(null);
  const [vacinaParaExcluir, setVacinaParaExcluir] = useState(null);
  const [ocultas, setOcultas] = useState(() => {
    try { return JSON.parse(localStorage.getItem("vacinas_pendentes_ocultas") || "[]"); } catch { return []; }
  });

  const cfg = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });

  const tratarSessaoExpirada = () => {
    setMensagemErro("Sessão expirada. Redirecionando para o login...");
    setTimeout(() => { localStorage.removeItem("token"); navigate("/"); }, 2000);
  };

  const carregar = async () => {
    if (!localStorage.getItem("token")) return tratarSessaoExpirada();
    try {
      setCarregando(true);
      const [rv, rp] = await Promise.all([
        api.get("/vacinas/completas", cfg()),
        api.get("/vacinas/pendentes", cfg()).catch(() => ({ data: [] })),
      ]);
      setVacinas(rv.data || []);
      setPendentes(rp.data || []);
    } catch (error) {
      if (error.response?.status === 401) return tratarSessaoExpirada();
      const d = error.response?.data?.detail;
      setMensagemErro(typeof d === "string" && d ? d : "Não foi possível carregar as vacinas.");
    } finally {
      setCarregando(false);
    }
  };

  const carregarAnimais = async () => {
    try {
      const r = await api.get("/animais/", cfg());
      setAnimais(r.data || []);
    } catch (e) {
      console.error("Erro ao carregar animais:", e);
    }
  };

  useEffect(() => { carregar(); carregarAnimais(); }, []);

  /* vacinas "superadas": já existe aplicação mais recente da mesma vacina no mesmo animal */
  const vacinasEnriquecidas = useMemo(() => {
    const ultimaPor = {};
    vacinas.forEach((v) => {
      const k = `${v.animal_id}|${semAcento(v.nome_vacina).trim()}`;
      if (!ultimaPor[k] || (v.data_aplicacao || "") > ultimaPor[k]) ultimaPor[k] = v.data_aplicacao || "";
    });
    return vacinas.map((v) => {
      const k = `${v.animal_id}|${semAcento(v.nome_vacina).trim()}`;
      return { ...v, _superada: (v.data_aplicacao || "") < ultimaPor[k] };
    });
  }, [vacinas]);

  const visiveis = useMemo(() => {
    const termo = semAcento(busca).trim();
    return vacinasEnriquecidas.filter((v) => {
      const sit = situacaoDe(v);
      if (filtro === "ATRASADAS" && sit.chave !== "ATRASADA") return false;
      if (filtro === "BREVE" && sit.chave !== "BREVE") return false;
      if (filtro === "EM_DIA" && sit.chave !== "EM_DIA") return false;
      if (!termo) return true;
      return semAcento(`${v.animal_nome} ${v.animal_codigo} ${v.tutor_nome} ${v.nome_vacina} ${v.fabricante} ${v.lote}`).includes(termo);
    });
  }, [busca, filtro, vacinasEnriquecidas]);

  const todasSit = vacinasEnriquecidas.map(situacaoDe);
  const nAtrasadas = todasSit.filter((s) => s.chave === "ATRASADA").length;
  const nBreve = todasSit.filter((s) => s.chave === "BREVE").length;
  const pendentesVisiveis = pendentes.filter((p) => !ocultas.includes(p.consulta_id));

  /* ---------- formulário ---------- */
  const animalDoForm = animais.find((a) => String(a.id) === String(form.animalId)) || null;

  const recalcular = (f, manual, animal) => {
    if (manual) return f;
    const r = sugerirReforco(f.aplicacao, f.dose, f.nome, ehFilhote(animal));
    return { ...f, reforco: r.data };
  };

  const mudarCampo = (campo, valor) => {
    let f = { ...form, [campo]: valor };
    let animal = animalDoForm;
    if (campo === "animalId") {
      animal = animais.find((a) => String(a.id) === String(valor)) || null;
      if (!vacinaEditando && animal) f.dose = ehFilhote(animal) ? "1ª Dose" : "Reforço Anual";
    }
    if (["animalId", "nome", "dose", "aplicacao"].includes(campo)) f = recalcular(f, reforcoManual, animal);
    setForm(f);
  };

  const abrirNovo = () => {
    setVacinaEditando(null);
    setReforcoManual(false);
    setForm({ ...FORM_VAZIO, aplicacao: hojeYMD() });
    setFormAberto(true);
  };

  const abrirDoPendente = (p) => {
    const animal = animais.find((a) => a.id === p.animal_id) || { idade: p.idade, data_nascimento: p.data_nascimento };
    const dose = ehFilhote(animal) ? "1ª Dose" : "Reforço Anual";
    const aplic = dataSaoPauloYMD(p.data_consulta);
    const base = { ...FORM_VAZIO, animalId: String(p.animal_id), nome: p.vacina_sugerida || "", dose, aplicacao: aplic };
    setVacinaEditando(null);
    setReforcoManual(false);
    setForm(recalcular(base, false, animal));
    setFormAberto(true);
  };

  const abrirEdicao = (v) => {
    setVacinaEditando(v);
    setReforcoManual(true);
    setForm({
      animalId: String(v.animal_id), nome: v.nome_vacina || "", fabricante: v.fabricante || "",
      dose: v.dose || "1ª Dose", aplicacao: v.data_aplicacao || "", reforco: v.data_reforco || "",
      lote: v.lote || "", obs: v.observacoes || "",
    });
    setFormAberto(true);
  };

  const fecharForm = () => { setFormAberto(false); setVacinaEditando(null); setReforcoManual(false); setForm(FORM_VAZIO); };

  const salvar = async () => {
    setMensagemErro("");
    setMensagemSucesso("");
    if (!form.animalId) return setMensagemErro("Selecione o paciente.");
    if (!form.nome.trim()) return setMensagemErro("Informe o nome da vacina.");
    if (!form.aplicacao) return setMensagemErro("Informe a data de aplicação.");
    const payload = {
      animal_id: Number(form.animalId),
      nome_vacina: form.nome.trim(),
      fabricante: form.fabricante.trim() || undefined,
      dose: form.dose || undefined,
      data_aplicacao: form.aplicacao,
      data_reforco: form.reforco || undefined,
      lote: form.lote.trim() || undefined,
      observacoes: form.obs.trim() || undefined,
    };
    try {
      setSalvando(true);
      const editando = !!vacinaEditando;
      if (editando) await api.put(`/vacinas/${vacinaEditando.id}`, payload, cfg());
      else await api.post("/vacinas/", payload, cfg());
      fecharForm();
      await carregar();
      setMensagemSucesso(editando ? "Registro de vacina atualizado!" : "Aplicação de vacina registrada!");
    } catch (error) {
      if (error.response?.status === 401) return tratarSessaoExpirada();
      const d = error.response?.data?.detail;
      setMensagemErro(typeof d === "string" ? d : "Erro ao salvar vacina.");
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async () => {
    if (!vacinaParaExcluir) return;
    try {
      await api.delete(`/vacinas/${vacinaParaExcluir.id}`, cfg());
      setVacinaParaExcluir(null);
      await carregar();
      setMensagemSucesso("Registro de vacina excluído!");
    } catch (error) {
      if (error.response?.status === 401) return tratarSessaoExpirada();
      const d = error.response?.data?.detail;
      setMensagemErro(`Erro ao excluir: ${typeof d === "string" ? d : error.message}`);
      setVacinaParaExcluir(null);
    }
  };

  const ocultarPendente = (id) => {
    const novas = [...ocultas, id];
    setOcultas(novas);
    try { localStorage.setItem("vacinas_pendentes_ocultas", JSON.stringify(novas)); } catch { /* sem storage */ }
  };

  const imprimirCartao = () => {
    const titulo = document.title;
    document.title = `Carteira_Vacinacao_${String(cartao.animal_nome || "Paciente").replace(/\s+/g, "_")}`;
    window.print();
    setTimeout(() => { document.title = titulo; }, 1000);
  };

  const abrirCartao = (v) => setCartao(v);
  const vacinasDoCartao = cartao
    ? vacinasEnriquecidas.filter((v) => v.animal_id === cartao.animal_id).sort((a, b) => (a.data_aplicacao || "").localeCompare(b.data_aplicacao || ""))
    : [];

  const hint = form.aplicacao ? sugerirReforco(form.aplicacao, form.dose, form.nome, ehFilhote(animalDoForm)).motivo : "";

  return (
    <Layout>
      <style>{CSS}</style>
      <div className="vx-root">
        <div className="vx-hero">
          <div className="vx-hero-top">
            <div className="vx-titulo">
              <div className="vx-icone"><MdVaccines size={28} /></div>
              <div>
                <h1>Controle de Vacinação</h1>
                <p>Aplicações, carteira de vacinação e lembretes de reforço dos pacientes.</p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="button" className="vx-btn claro" onClick={carregar} disabled={carregando}>
                <MdRefresh size={18} /> {carregando ? "Atualizando..." : "Atualizar"}
              </button>
              <button type="button" className="vx-btn verde" onClick={abrirNovo}><MdAdd size={18} /> Registrar vacina</button>
            </div>
          </div>
          <div className="vx-stats">
            <div className="vx-stat"><b>{vacinas.length}</b><span>aplicações registradas</span></div>
            <div className={`vx-stat ${nAtrasadas > 0 ? "verm" : ""}`}><b>{nAtrasadas}</b><span>reforços atrasados</span></div>
            <div className={`vx-stat ${nBreve > 0 ? "amar" : ""}`}><b>{nBreve}</b><span>vencem em 30 dias</span></div>
            <div className={`vx-stat ${pendentesVisiveis.length > 0 ? "amar" : ""}`}><b>{pendentesVisiveis.length}</b><span>aguardando registro</span></div>
          </div>
        </div>

        {mensagemSucesso && <div className="vx-msg ok"><MdCheckCircle size={20} /> {mensagemSucesso}</div>}
        {mensagemErro && <div className="vx-msg erro"><MdErrorOutline size={20} /> {mensagemErro}</div>}

        {pendentesVisiveis.length > 0 && (
          <div className="vx-pend">
            <h3><MdEventNote size={20} /> Vacinações agendadas aguardando registro</h3>
            <p>Atendimentos de vacinação vindos da Agenda que ainda não têm a aplicação registrada. Ao registrar, a vacina também entra na conta do Caixa.</p>
            {pendentesVisiveis.map((p) => (
              <div key={p.consulta_id} className="vx-pend-item">
                <div>
                  <b>{p.animal_nome}</b> <span style={{ color: "#64748b", fontSize: 12.5 }}>{p.animal_codigo} · {p.tutor_nome || "Tutor não vinculado"}</span><br />
                  <span style={{ fontSize: 13, color: "#92400e" }}>
                    {p.vacina_sugerida || "Vacina"} · {p.consulta_codigo} · {formatarData(dataSaoPauloYMD(p.data_consulta))}
                  </span>
                </div>
                <div className="vx-acoes">
                  <button type="button" className="vx-btn verde" onClick={() => abrirDoPendente(p)}>Registrar aplicação</button>
                  <button type="button" className="vx-btn cinza" onClick={() => ocultarPendente(p.consulta_id)} title="Não foi aplicada / ocultar da lista">Ocultar</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="vx-filtros">
          <div className="vx-busca">
            <MdSearch size={20} />
            <input className="vx-input" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por paciente, tutor, vacina, fabricante ou lote..." />
          </div>
          <div className="vx-seg">
            {[["TODAS", "Todas"], ["ATRASADAS", "Atrasadas"], ["BREVE", "Vencem em breve"], ["EM_DIA", "Em dia"]].map(([k, r]) => (
              <button key={k} type="button" className={filtro === k ? "on" : ""} onClick={() => setFiltro(k)}>{r}</button>
            ))}
          </div>
        </div>

        {visiveis.length === 0 ? (
          <div className="vx-vazio">
            <div style={{ fontSize: 38 }}>💉</div>
            <b style={{ display: "block", color: "#0f172a", fontSize: 16, margin: "4px 0" }}>{carregando ? "Carregando..." : "Nenhum registro de vacina encontrado"}</b>
            {!carregando && "Registre a aplicação pelo botão acima ou pelas vacinações agendadas."}
          </div>
        ) : (
          <div className="vx-lista">
            {visiveis.map((v) => {
              const { Icone, bg, cor } = estiloEspecie(v.especie);
              const sit = situacaoDe(v);
              const zap = !v._superada && (sit.chave === "ATRASADA" || sit.chave === "BREVE") ? linkWhatsApp(v, sit) : null;
              return (
                <div key={v.id} className={`vx-card ${v._superada ? "concluida" : ""}`}>
                  <div className="vx-pac">
                    <div className="vx-av" style={{ backgroundColor: bg }}><Icone size={24} color={cor} /></div>
                    <div style={{ minWidth: 0 }}>
                      <div className="vx-nome">{v.animal_nome || "Paciente"}</div>
                      <div className="vx-sub">{v.animal_codigo}</div>
                      <div className="vx-sub"><MdPerson size={14} color="#94a3b8" /> {v.tutor_nome || "Tutor não vinculado"}</div>
                    </div>
                  </div>

                  <div>
                    <div className="vx-vac">{v.nome_vacina}{v.dose ? ` · ${v.dose}` : ""}</div>
                    <div className="vx-meta">
                      Aplicada em {formatarData(v.data_aplicacao)}
                      {v.fabricante ? ` · ${v.fabricante}` : ""}{v.lote ? ` · Lote ${v.lote}` : ""}
                    </div>
                  </div>

                  <div className="vx-lado">
                    <span className={`vx-badge ${sit.classe}`}>{sit.rotulo}</span>
                    <div className="vx-acoes">
                      {zap && <a className="vx-btn zap mini" href={zap} target="_blank" rel="noreferrer" title="Avisar o tutor pelo WhatsApp"><MdWhatsapp size={18} /> Avisar</a>}
                      <button type="button" className="vx-btn azul mini" onClick={() => abrirCartao(v)} title="Carteira de vacinação"><MdVisibility size={17} /> Carteira</button>
                      <button type="button" className="vx-btn amarelo mini" onClick={() => abrirEdicao(v)} title="Editar"><MdEdit size={17} /></button>
                      <button type="button" className="vx-btn vermelho mini" onClick={() => setVacinaParaExcluir(v)} title="Excluir"><MdDelete size={17} /></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {formAberto && (
          <div className="vx-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) fecharForm(); }}>
            <div className="vx-modal">
              <h3 className="tit">{vacinaEditando ? "✏️ Editar registro de vacina" : "💉 Registrar aplicação de vacina"}</h3>
              <div className="vx-grid">
                <div>
                  <label className="vx-label">Paciente *</label>
                  <select className="vx-select" value={form.animalId} onChange={(e) => mudarCampo("animalId", e.target.value)}>
                    <option value="">Selecione o paciente</option>
                    {animais.map((a) => <option key={a.id} value={a.id}>{a.nome} ({a.codigo || `PET-${a.id}`}) - {a.especie}</option>)}
                  </select>
                </div>
                <div>
                  <label className="vx-label">Nome da vacina *</label>
                  <input className="vx-input" placeholder="Ex: V10, Antirrábica, Giárdia" value={form.nome} onChange={(e) => mudarCampo("nome", e.target.value)} />
                </div>
                <div>
                  <label className="vx-label">Fabricante</label>
                  <input className="vx-input" placeholder="Ex: Zoetis, MSD, Boehringer" value={form.fabricante} onChange={(e) => mudarCampo("fabricante", e.target.value)} />
                </div>
                <div>
                  <label className="vx-label">Dose</label>
                  <select className="vx-select" value={form.dose} onChange={(e) => mudarCampo("dose", e.target.value)}>
                    {DOSES.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="vx-label">Data de aplicação *</label>
                  <input className="vx-input" type="date" value={form.aplicacao} onChange={(e) => mudarCampo("aplicacao", e.target.value)} />
                </div>
                <div>
                  <label className="vx-label">Próxima dose / reforço</label>
                  <input className="vx-input" type="date" value={form.reforco} onChange={(e) => { setReforcoManual(true); setForm({ ...form, reforco: e.target.value }); }} />
                </div>
                <div>
                  <label className="vx-label">Lote</label>
                  <input className="vx-input" placeholder="Ex: L123456" value={form.lote} onChange={(e) => mudarCampo("lote", e.target.value)} />
                </div>
              </div>

              {hint && !reforcoManual && <div className="vx-dica">💡 <strong>Data sugerida:</strong> {hint} Você pode alterar a data.</div>}
              {reforcoManual && form.reforco && form.aplicacao && !vacinaEditando && (
                <div className="vx-dica" style={{ background: "#f8fafc", borderColor: "#e2e8f0", color: "#475569" }}>
                  Data definida por você.{" "}
                  <button type="button" onClick={() => { setReforcoManual(false); setForm(recalcular(form, false, animalDoForm)); }} style={{ border: "none", background: "none", color: "#047857", fontWeight: 700, cursor: "pointer", padding: 0, fontFamily: "inherit" }}>Usar a sugestão automática</button>
                </div>
              )}

              <div style={{ marginTop: 14 }}>
                <label className="vx-label">Observações</label>
                <textarea className="vx-area" rows={2} placeholder="Local de aplicação, reações, orientações ao tutor..." value={form.obs} onChange={(e) => mudarCampo("obs", e.target.value)} />
              </div>

              <div className="vx-form-fim">
                <button type="button" className="vx-btn cinza" onClick={fecharForm}>Cancelar</button>
                <button type="button" className="vx-btn verde" onClick={salvar} disabled={salvando}>{salvando ? "Salvando..." : "Salvar vacina"}</button>
              </div>
            </div>
          </div>
        )}

        {cartao && (
          <div className="vx-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setCartao(null); }}>
            <div className="vx-modal" id="vx-impressao">
              <div className="vx-doc-topo">
                <h2>VetAssist AI — Carteira de Vacinação</h2>
                <p>Histórico de imunização</p>
              </div>
              <div className="vx-doc-dados">
                <div><strong>Paciente:</strong> {cartao.animal_nome} ({cartao.animal_codigo})</div>
                <div><strong>Espécie / raça:</strong> {[cartao.especie, cartao.raca || "SRD"].filter(Boolean).join(" · ")}</div>
                <div><strong>Sexo / idade:</strong> {cartao.sexo || "-"} | {cartao.idade !== null && cartao.idade !== undefined ? `${String(cartao.idade).replace(".0", "")} ano(s)` : "-"}</div>
                <div><strong>Peso:</strong> {cartao.peso ? `${String(cartao.peso).replace(".", ",")} kg` : "-"}</div>
                <div style={{ gridColumn: "1 / -1" }}><strong>Tutor:</strong> {cartao.tutor_nome || "-"}</div>
              </div>

              <table className="vx-tab">
                <thead>
                  <tr><th>Vacina</th><th>Dose</th><th>Fabricante / lote</th><th>Aplicação</th><th>Próxima dose / reforço</th></tr>
                </thead>
                <tbody>
                  {vacinasDoCartao.map((v) => (
                    <tr key={v.id}>
                      <td><strong style={{ color: "#047857" }}>{v.nome_vacina}</strong></td>
                      <td>{v.dose || "-"}</td>
                      <td>{v.fabricante ? `${v.fabricante}${v.lote ? ` (${v.lote})` : ""}` : v.lote || "-"}</td>
                      <td>{formatarData(v.data_aplicacao)}</td>
                      <td>{v.data_reforco ? formatarData(v.data_reforco) : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="vx-assina">
                <div style={{ borderTop: "1px solid #9ca3af", width: 260, margin: "0 auto 8px" }} />
                <div style={{ fontWeight: 700, color: "#111827", fontSize: 14 }}>Médico(a) Veterinário(a)</div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>CRMV Responsável</div>
              </div>

              <div className="no-print" style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24, paddingTop: 14, borderTop: "1px solid #f1f5f9" }}>
                <button type="button" className="vx-btn cinza" onClick={() => setCartao(null)}><MdClose size={17} /> Fechar</button>
                <button type="button" className="vx-btn azul" onClick={imprimirCartao}><MdPrint size={17} /> Imprimir carteira (A4)</button>
              </div>
            </div>
          </div>
        )}

        {vacinaParaExcluir && (
          <div className="vx-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setVacinaParaExcluir(null); }}>
            <div className="vx-modal peq">
              <div style={{ fontSize: 42, marginBottom: 6 }}>⚠️</div>
              <h3 style={{ margin: "0 0 8px", color: "#111827", fontSize: 18 }}>Confirmar exclusão</h3>
              <p style={{ color: "#4b5563", fontSize: 14, lineHeight: 1.5, margin: 0 }}>
                Excluir o registro da vacina <strong>{vacinaParaExcluir.nome_vacina}</strong> de <strong>{vacinaParaExcluir.animal_nome}</strong>?
              </p>
              <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 22 }}>
                <button type="button" className="vx-btn cinza" onClick={() => setVacinaParaExcluir(null)}>Cancelar</button>
                <button type="button" className="vx-btn perigo" onClick={excluir}>Sim, excluir</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

export default Vacinas;