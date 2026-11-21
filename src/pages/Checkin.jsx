import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MdEvent, MdTv, MdDelete, MdSearch, MdPets, MdAdd, MdClose, MdCheckCircle, MdErrorOutline, MdPerson, MdMedicalServices } from "react-icons/md";
import { FaDog, FaCat, FaFish, FaDove, FaHorse, FaFrog, FaBug, FaClock } from "react-icons/fa";
import { GiCow, GiPig, GiSheep, GiGoat, GiRabbit } from "react-icons/gi";
import api from "../api/api";
import Layout from "../components/Layout";

// Tags rápidas de sintomas (chips do formulário)
const SINTOMAS_RAPIDOS = ["Vômito", "Diarreia", "Tosse", "Febre", "Letargia", "Apatia", "Trauma", "Pele", "Ocular"];

// Espécie -> ícone + cores (fundo suave e cor do traço). Ordem importa: o primeiro que casar vale.
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

const corSintoma = (tag) => {
  const t = tag.toLowerCase();
  if (t.includes("trauma") || t.includes("sangue") || t.includes("dor")) return { bg: "#fee2e2", text: "#991b1b" };
  if (t.includes("pele") || t.includes("ocular") || t.includes("coceira")) return { bg: "#f3e8ff", text: "#6b21a8" };
  if (t.includes("diarreia") || t.includes("vômito")) return { bg: "#ffedd5", text: "#c2410c" };
  if (t.includes("febre") || t.includes("infecção")) return { bg: "#fef3c7", text: "#b45309" };
  if (t.includes("tosse") || t.includes("respiração")) return { bg: "#e0f2fe", text: "#0369a1" };
  if (t.includes("apatia") || t.includes("letargia")) return { bg: "#f1f5f9", text: "#475569" };
  return { bg: "#eef2ff", text: "#3730a3" };
};

// "há 12 min", "há 1 h 05" — tempo de espera desde o check-in
const textoEspera = (iso) => {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const min = Math.max(0, Math.floor((Date.now() - t) / 60000));
  if (min < 1) return { texto: "agora", nivel: 0 };
  if (min < 60) return { texto: `${min} min`, nivel: min >= 30 ? 2 : min >= 15 ? 1 : 0 };
  const h = Math.floor(min / 60);
  return { texto: `${h} h ${String(min % 60).padStart(2, "0")}`, nivel: 2 };
};

const CSS = `
.ck-root, .ck-root * { box-sizing: border-box; }
.ck-root { font-family: inherit; color: #0f172a; }
.ck-root * { text-align: left; }
.ck-vazio, .ck-vazio *, .ck-conf, .ck-conf *, .ck-sem { text-align: center; }
.ck-hero { position: relative; overflow: hidden; border-radius: 22px; padding: 24px 26px; margin-bottom: 18px;
  background: linear-gradient(120deg, #eef2ff 0%, #f5f3ff 55%, #ecfeff 100%); border: 1px solid #e0e7ff; }
.ck-hero-top { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.ck-titulo { display: flex; align-items: center; gap: 14px; }
.ck-titulo-icone { width: 52px; height: 52px; border-radius: 16px; background: #4f46e5; color: #fff; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 18px rgba(79,70,229,.28); }
.ck-hero h1 { margin: 0; font-size: 25px; font-weight: 800; color: #1e1b4b; letter-spacing: -.3px; text-align: left; }
.ck-hero p { margin: 3px 0 0; font-size: 13.5px; color: #475569; text-align: left; }
.ck-acoes { display: flex; gap: 10px; flex-wrap: wrap; }
.ck-btn { display: inline-flex; align-items: center; gap: 8px; border: none; border-radius: 12px; padding: 11px 18px; font-weight: 700; font-size: 14px; cursor: pointer; transition: transform .15s, box-shadow .15s, background .15s; }
.ck-btn:hover:not(:disabled) { transform: translateY(-1px); }
.ck-btn:disabled { opacity: .65; cursor: default; }
.ck-btn-tv { background: #fff; color: #0369a1; border: 1px solid #bae6fd; }
.ck-btn-tv:hover { background: #f0f9ff; }
.ck-btn-novo { background: #4f46e5; color: #fff; box-shadow: 0 8px 18px rgba(79,70,229,.30); }
.ck-btn-novo:hover { background: #4338ca; }
.ck-stats { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 18px; }
.ck-stat { background: rgba(255,255,255,.85); border: 1px solid #e2e8f0; border-radius: 14px; padding: 10px 16px; min-width: 130px; }
.ck-stat b { display: block; font-size: 22px; font-weight: 800; color: #1e1b4b; line-height: 1.1; }
.ck-stat span { font-size: 12px; color: #64748b; font-weight: 600; }
.ck-stat.alerta b { color: #b45309; }

.ck-barra { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
.ck-barra h2 { margin: 0; font-size: 17px; font-weight: 800; color: #0f172a; text-align: left; }
.ck-busca { position: relative; width: min(100%, 340px); }
.ck-busca svg { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #94a3b8; }
.ck-input { width: 100%; height: 44px; padding: 0 14px; border: 1px solid #d1d5db; border-radius: 12px; font-size: 14px; background: #fff; outline: none; color: #0f172a; text-align: left; transition: border-color .15s, box-shadow .15s; }
.ck-input:focus, .ck-textarea:focus, .ck-select:focus { border-color: #818cf8; box-shadow: 0 0 0 3px rgba(129,140,248,.25); }
.ck-busca .ck-input { padding-left: 40px; background: #fff; }
.ck-select { width: 100%; height: 44px; padding: 0 12px; border: 1px solid #d1d5db; border-radius: 12px; font-size: 14px; background: #fff; outline: none; color: #0f172a; }
.ck-textarea { width: 100%; min-height: 110px; padding: 12px 14px; border: 1px solid #d1d5db; border-radius: 12px; font-size: 14px; background: #fff; outline: none; color: #0f172a; resize: vertical; font-family: inherit; text-align: left; }

.ck-grid { display: flex; flex-direction: column; align-items: stretch; width: 100%; gap: 16px; }
.ck-card { position: relative; width: 100%; box-sizing: border-box; justify-self: stretch; display: flex; gap: 16px; padding: 18px 18px 18px 22px; background: #fff; border: 1px solid #e5e7eb; border-radius: 18px; box-shadow: 0 2px 6px rgba(15,23,42,.05); transition: transform .18s, box-shadow .18s; overflow: hidden; text-align: left; }
.ck-card::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 5px; background: var(--faixa, #4f46e5); }
.ck-card:hover { transform: translateY(-2px); box-shadow: 0 12px 22px rgba(15,23,42,.10); }
.ck-avatar { width: 64px; height: 64px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: inset 0 2px 4px rgba(0,0,0,.06); }
.ck-corpo { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.ck-linha1 { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.ck-codigo { font-size: 11.5px; font-weight: 800; color: #4338ca; background: #eef2ff; border-radius: 999px; padding: 3px 9px; letter-spacing: .3px; }
.ck-nome { font-size: 18px; font-weight: 800; color: #0f172a; line-height: 1.2; overflow-wrap: anywhere; }
.ck-sub { font-size: 13px; color: #64748b; }
.ck-tutor { display: flex; align-items: center; gap: 6px; font-size: 13.5px; color: #475569; min-width: 0; }
.ck-tutor { align-items: flex-start; }
.ck-tutor span { overflow-wrap: anywhere; line-height: 1.35; }
.ck-tutor b { color: #0f172a; }
.ck-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 2px; }
.ck-tag { font-size: 12.5px; font-weight: 700; padding: 4px 11px; border-radius: 999px; line-height: 1.2; }
.ck-queixa { width: 100%; box-sizing: border-box; display: block; font-size: 13px; color: #b91c1c; font-weight: 600; line-height: 1.45; background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 8px 10px; overflow-wrap: anywhere; }
.ck-lado { display: flex; flex-direction: column; align-items: flex-end; justify-content: space-between; gap: 10px; flex-shrink: 0; }
.ck-status { display: inline-flex; align-items: center; gap: 6px; background: #fef3c7; color: #b45309; padding: 6px 12px; border-radius: 999px; font-size: 12px; font-weight: 800; white-space: nowrap; }
.ck-espera { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 700; color: #64748b; }
.ck-espera.n1 { color: #b45309; }
.ck-espera.n2 { color: #b91c1c; }
.ck-excluir { width: 36px; height: 36px; border-radius: 50%; border: none; background: #fef2f2; color: #dc2626; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background .15s, transform .15s; }
.ck-excluir:hover { background: #fecaca; transform: scale(1.06); }
.ck-vazio { text-align: center; background: #fff; border: 2px dashed #e2e8f0; border-radius: 18px; padding: 48px 20px; color: #64748b; }
.ck-vazio .emoji { font-size: 40px; margin-bottom: 6px; }
.ck-vazio b { display: block; color: #0f172a; font-size: 16px; margin-bottom: 4px; }

.ck-toasts { position: fixed; top: 16px; right: 16px; z-index: 2000; display: flex; flex-direction: column; gap: 10px; max-width: min(92vw, 420px); }
.ck-toast { display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px; border-radius: 14px; font-size: 14px; font-weight: 600; box-shadow: 0 12px 24px rgba(15,23,42,.18); text-align: left; }
.ck-toast.ok { background: #f0fdf4; color: #166534; border: 1px solid #86efac; }
.ck-toast.erro { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
.ck-toast button { margin-left: auto; background: none; border: none; color: inherit; cursor: pointer; padding: 0; display: flex; }

.ck-overlay { position: fixed; inset: 0; background: rgba(15,23,42,.55); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 16px; }
.ck-modal { width: 100%; max-width: 880px; max-height: calc(100vh - 32px); background: #fff; border-radius: 22px; box-shadow: 0 30px 60px rgba(15,23,42,.30); display: flex; flex-direction: column; overflow: hidden; text-align: left; }
.ck-modal-topo { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 18px 24px; border-bottom: 1px solid #eef2f7; background: linear-gradient(120deg, #eef2ff, #f5f3ff); }
.ck-modal-topo h3 { margin: 0; font-size: 19px; font-weight: 800; color: #1e1b4b; display: flex; align-items: center; gap: 10px; text-align: left; }
.ck-fechar { width: 36px; height: 36px; border-radius: 50%; border: none; background: rgba(255,255,255,.8); color: #475569; display: flex; align-items: center; justify-content: center; cursor: pointer; }
.ck-fechar:hover { background: #fff; color: #0f172a; }
.ck-modal-corpo { padding: 22px 24px; overflow-y: auto; display: grid; grid-template-columns: 1.05fr 1fr; gap: 24px; }
.ck-rotulo { display: block; font-size: 12px; font-weight: 800; color: #475569; letter-spacing: .4px; text-transform: uppercase; margin-bottom: 8px; text-align: left; }
.ck-lista { max-height: 300px; overflow-y: auto; border: 1px solid #e5e7eb; border-radius: 14px; margin-top: 10px; background: #fff; }
.ck-item { display: flex; align-items: center; gap: 12px; padding: 10px 14px; cursor: pointer; border-bottom: 1px solid #f1f5f9; border-left: 4px solid transparent; transition: background .12s; text-align: left; }
.ck-item:last-child { border-bottom: none; }
.ck-item:hover { background: #f8fafc; }
.ck-item.sel { background: #eef2ff; border-left-color: #4f46e5; }
.ck-item .av { width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.ck-item .nm { font-size: 14px; font-weight: 700; color: #0f172a; }
.ck-item .nm small { font-weight: 500; color: #64748b; font-size: 12.5px; }
.ck-item .tt { font-size: 12px; color: #64748b; margin-top: 1px; }
.ck-item .ok { margin-left: auto; color: #4f46e5; display: flex; }
.ck-sem { padding: 22px; text-align: center; color: #64748b; font-size: 14px; }
.ck-campo { margin-bottom: 18px; }
.ck-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
.ck-chip { border: 1px solid transparent; padding: 7px 13px; border-radius: 999px; font-size: 13px; font-weight: 700; cursor: pointer; transition: transform .12s, box-shadow .12s; }
.ck-chip:hover { transform: translateY(-1px); box-shadow: 0 4px 8px rgba(15,23,42,.10); }
.ck-chip.on { border-color: currentColor; box-shadow: inset 0 0 0 1px currentColor; }
.ck-resumo { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 14px; background: #f8fafc; border: 1px dashed #cbd5e1; margin-bottom: 18px; font-size: 13.5px; color: #475569; }
.ck-resumo.pronto { background: #f0fdf4; border: 1px solid #86efac; color: #166534; }
.ck-resumo b { color: #0f172a; }
.ck-modal-rodape { display: flex; justify-content: flex-end; gap: 12px; padding: 16px 24px; border-top: 1px solid #eef2f7; background: #fafbff; }
.ck-btn-cancelar { background: #f1f5f9; color: #334155; }
.ck-btn-cancelar:hover { background: #e2e8f0; }
.ck-btn-salvar { background: #16a34a; color: #fff; box-shadow: 0 8px 16px rgba(22,163,74,.25); }
.ck-btn-salvar:hover:not(:disabled) { background: #15803d; }
.ck-conf { width: 100%; max-width: 420px; background: #fff; border-radius: 20px; padding: 26px; text-align: center; box-shadow: 0 30px 60px rgba(15,23,42,.30); }
.ck-conf .em { font-size: 40px; }
.ck-conf h3 { margin: 4px 0 6px; font-size: 18px; color: #0f172a; text-align: center; }
.ck-conf p { margin: 0; color: #475569; font-size: 14px; line-height: 1.5; text-align: center; }
.ck-conf .bt { display: flex; justify-content: center; gap: 12px; margin-top: 22px; }
.ck-btn-excluir { background: #dc2626; color: #fff; }
.ck-btn-excluir:hover { background: #b91c1c; }
@media (max-width: 760px) {
  .ck-modal-corpo { grid-template-columns: 1fr; }
  .ck-hero { padding: 18px; }
  .ck-card { flex-wrap: wrap; }
  .ck-lado { flex-direction: row; width: 100%; align-items: center; justify-content: space-between; }
}
`;

// Queixa longa no card da fila: mesmo visual do card da Triagem (rótulo + texto completo)
function QueixaRecolhivel({ texto }) {
  return (
    <div title={texto} style={{ width: "100%", alignSelf: "stretch" }}>
      <span style={{ display: "block", fontSize: "11px", fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: "6px" }}>Sintomas / queixa</span>
      <div style={{ fontSize: "13px", fontWeight: 600, lineHeight: 1.45, color: "#b91c1c", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "10px", padding: "8px 10px", overflowWrap: "anywhere", textAlign: "left" }}>
        {texto}
      </div>
    </div>
  );
}

function Checkin() {
  const navigate = useNavigate();
  const [animais, setAnimais] = useState([]);
  const [tutores, setTutores] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [filaCheckin, setFilaCheckin] = useState([]);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [consultaParaExcluir, setConsultaParaExcluir] = useState(null);
  const [filtroFila, setFiltroFila] = useState("");

  // Estados do Formulário de Check-in
  const [animalId, setAnimalId] = useState("");
  const [buscaPaciente, setBuscaPaciente] = useState("");
  const [usuarioId, setUsuarioId] = useState("");
  const [queixaPrincipal, setQueixaPrincipal] = useState("");
  const [mensagemSucesso, setMensagemSucesso] = useState("");
  const [mensagemErro, setMensagemErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    carregarDados();
    const intervalo = setInterval(() => carregarDados(), 5000);
    return () => clearInterval(intervalo);
  }, []);

  // Avisos somem sozinhos
  useEffect(() => {
    if (!mensagemSucesso) return undefined;
    const t = setTimeout(() => setMensagemSucesso(""), 5000);
    return () => clearTimeout(t);
  }, [mensagemSucesso]);
  useEffect(() => {
    if (!mensagemErro) return undefined;
    const t = setTimeout(() => setMensagemErro(""), 9000);
    return () => clearTimeout(t);
  }, [mensagemErro]);

  // Esc fecha o formulário
  useEffect(() => {
    if (!mostrarModal) return undefined;
    const onKey = (e) => { if (e.key === "Escape") fecharModal(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mostrarModal]);

  const carregarDados = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return navigate("/login");

      const config = { headers: { Authorization: `Bearer ${token}` } };

      const [resAnimais, resTutores, resUsuarios, resFila] = await Promise.all([
        api.get("/animais/", config),
        api.get("/tutores/", config),
        api.get("/usuarios/", config),
        api.get("/consultas/fila-triagem", config),
      ]);

      setAnimais(resAnimais.data || []);
      setTutores(resTutores.data || []);

      const listaUsuarios = resUsuarios.data || [];
      const apenasEnfermeiros = listaUsuarios.filter(
        (u) => u.perfil === "TRIAGEM" || u.perfil === "ENFERMEIRO"
      );
      setUsuarios(apenasEnfermeiros);

      setFilaCheckin(resFila.data || []);
    } catch (error) {
      console.error("Erro ao carregar dados da recepção:", error);
    }
  };

  const tutorDoAnimal = (a) => (a ? tutores.find((t) => t.id === a.tutor_id) : null);

  const animaisFiltrados = animais.filter((a) => {
    if (!buscaPaciente) return true;
    const termo = buscaPaciente.toLowerCase();
    const nomePet = (a.nome || "").toLowerCase();
    const t = tutorDoAnimal(a);
    const nomeTutor = t ? (t.nome || "").toLowerCase() : "";
    return nomePet.includes(termo) || nomeTutor.includes(termo);
  });

  const animalSelecionado = animais.find((a) => String(a.id) === String(animalId)) || null;

  const filaVisivel = useMemo(() => {
    const termo = filtroFila.trim().toLowerCase();
    if (!termo) return filaCheckin;
    return filaCheckin.filter((item) => {
      const a = animais.find((x) => x.id === Number(item.animal_id));
      const t = tutorDoAnimal(a);
      return `${item.codigo || ""} ${a?.nome || ""} ${t?.nome || ""} ${item.queixa_principal || ""}`.toLowerCase().includes(termo);
    });
  }, [filtroFila, filaCheckin, animais, tutores]);

  const tagsAtuais = queixaPrincipal.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

  const alternarSintoma = (sintoma) => {
    setQueixaPrincipal((prev) => {
      const partes = prev.split(",").map((s) => s.trim()).filter(Boolean);
      const existe = partes.some((p) => p.toLowerCase() === sintoma.toLowerCase());
      if (existe) return partes.filter((p) => p.toLowerCase() !== sintoma.toLowerCase()).join(", ");
      return [...partes, sintoma].join(", ");
    });
  };

  const fecharModal = () => {
    setMostrarModal(false);
    setAnimalId("");
    setBuscaPaciente("");
    setUsuarioId("");
    setQueixaPrincipal("");
  };

  const realizarCheckin = async (e) => {
    e.preventDefault();
    if (!animalId || !queixaPrincipal.trim()) {
      setMensagemErro("Preencha todos os campos obrigatórios (Paciente e Motivo).");
      return;
    }

    try {
      setCarregando(true);
      const token = localStorage.getItem("token");
      const config = { headers: { Authorization: `Bearer ${token}` } };

      const payload = {
        animal_id: Number(animalId),
        usuario_id: usuarioId ? Number(usuarioId) : null,
        queixa_principal: queixaPrincipal,
        status: "AGUARDANDO_TRIAGEM"
      };

      await api.post("/consultas/", payload, config);

      setMensagemErro("");
      setMensagemSucesso("Check-in realizado! Paciente adicionado à fila.");
      fecharModal();
      carregarDados();
    } catch (error) {
      setMensagemErro(`Erro ao realizar check-in: ${error.response?.data?.detail || error.message}`);
    } finally {
      setCarregando(false);
    }
  };

  const deletarCheckin = async () => {
    if (!consultaParaExcluir) return;

    try {
      const token = localStorage.getItem("token");
      const config = { headers: { Authorization: `Bearer ${token}` } };

      await api.delete(`/consultas/${consultaParaExcluir.id}`, config);

      setMensagemErro("");
      setMensagemSucesso("Check-in excluído com sucesso.");
      setConsultaParaExcluir(null);
      carregarDados();
    } catch (error) {
      setMensagemErro(`Erro ao excluir check-in: ${error.response?.data?.detail || error.message}`);
      setConsultaParaExcluir(null);
    }
  };

  // Resumo do topo
  const esperas = filaCheckin.map((i) => textoEspera(i.data_consulta || i.data_criacao)).filter(Boolean);
  const demorados = esperas.filter((e) => e.nivel >= 2).length;
  const maiorEspera = filaCheckin
    .map((i) => new Date(i.data_consulta || i.data_criacao).getTime())
    .filter((t) => !Number.isNaN(t))
    .reduce((min, t) => Math.min(min, t), Infinity);
  const textoMaior = Number.isFinite(maiorEspera) ? textoEspera(new Date(maiorEspera).toISOString())?.texto : null;

  const pronto = Boolean(animalId) && Boolean(queixaPrincipal.trim());

  return (
    <Layout>
      <style>{CSS}</style>
      <div className="ck-root">
        {/* Avisos */}
        {(mensagemSucesso || mensagemErro) && (
          <div className="ck-toasts">
            {mensagemSucesso && (
              <div className="ck-toast ok" role="status">
                <MdCheckCircle size={20} /> <span>{mensagemSucesso}</span>
                <button type="button" onClick={() => setMensagemSucesso("")} aria-label="Fechar aviso"><MdClose size={18} /></button>
              </div>
            )}
            {mensagemErro && (
              <div className="ck-toast erro" role="alert">
                <MdErrorOutline size={20} /> <span>{mensagemErro}</span>
                <button type="button" onClick={() => setMensagemErro("")} aria-label="Fechar aviso"><MdClose size={18} /></button>
              </div>
            )}
          </div>
        )}

        {/* Cabeçalho */}
        <div className="ck-hero">
          <div className="ck-hero-top">
            <div className="ck-titulo">
              <div className="ck-titulo-icone"><MdEvent size={28} /></div>
              <div>
                <h1>Recepção &amp; Check-in</h1>
                <p>Registre a chegada dos pacientes e acompanhe a fila de espera da triagem.</p>
              </div>
            </div>
            <div className="ck-acoes">
              <button type="button" className="ck-btn ck-btn-tv" onClick={() => window.open("/painel", "_blank")}>
                <MdTv size={20} /> Abrir Painel (TV)
              </button>
              <button type="button" className="ck-btn ck-btn-novo" onClick={() => setMostrarModal(true)}>
                <MdAdd size={20} /> Novo Check-in
              </button>
            </div>
          </div>
          <div className="ck-stats">
            <div className="ck-stat"><b>{filaCheckin.length}</b><span>{filaCheckin.length === 1 ? "paciente na fila" : "pacientes na fila"}</span></div>
            <div className="ck-stat"><b>{textoMaior || "—"}</b><span>maior tempo de espera</span></div>
            <div className={`ck-stat ${demorados > 0 ? "alerta" : ""}`}><b>{demorados}</b><span>aguardando há mais de 30 min</span></div>
          </div>
        </div>

        {/* Fila */}
        <div className="ck-barra">
          <h2>📋 Fila de espera da triagem</h2>
          {filaCheckin.length > 0 && (
            <div className="ck-busca">
              <MdSearch size={20} />
              <input className="ck-input" value={filtroFila} onChange={(e) => setFiltroFila(e.target.value)} placeholder="Buscar por pet, tutor, código ou queixa..." />
            </div>
          )}
        </div>

        {filaCheckin.length === 0 ? (
          <div className="ck-vazio">
            <div className="emoji">🐾</div>
            <b>Nenhum paciente aguardando</b>
            Quando um novo check-in for feito, ele aparece aqui.
          </div>
        ) : filaVisivel.length === 0 ? (
          <div className="ck-vazio"><b>Nada encontrado</b>Nenhum paciente da fila corresponde à busca.</div>
        ) : (
          <div className="ck-grid">
            {filaVisivel.map((item) => {
              const a = animais.find((x) => x.id === Number(item.animal_id));
              const t = tutorDoAnimal(a);
              const nomePet = a ? a.nome : "Paciente desconhecido";
              const especie = a?.especie || "Pet";
              const raca = a?.raca ? ` · ${a.raca}` : "";
              const nomeTutor = t ? t.nome : "Tutor não vinculado";
              const { Icone, bg, cor } = estiloEspecie(especie);
              const tags = (item.queixa_principal || "").split(",").map((s) => s.trim()).filter(Boolean);
              const tagsVisiveis = tags.slice(0, 3);
              const ocultas = tags.slice(3);
              const espera = textoEspera(item.data_consulta || item.data_criacao);
              // Queixa digitada como frase (com vírgulas no meio do texto) não é lista de tags: mostra como texto único.
              // Só vira "chips" quando todas as partes são curtas (tags rápidas ou palavras soltas).
              const longa = (item.queixa_principal || "").trim().length > 0 && (tags.length > 6 || tags.some((t) => t.length > 28));

              return (
                <div key={item.id} className="ck-card" style={{ "--faixa": cor }}>
                  <div className="ck-avatar" style={{ backgroundColor: bg }}><Icone size={32} color={cor} /></div>

                  <div className="ck-corpo">
                    <div className="ck-linha1">
                      {item.codigo && <span className="ck-codigo">{item.codigo}</span>}
                    </div>
                    <div className="ck-nome" title={nomePet}>{nomePet}</div>
                    <div className="ck-sub">{especie}{raca}</div>
                    <div className="ck-tutor"><MdPerson size={16} color="#94a3b8" style={{ flexShrink: 0 }} /><span title={nomeTutor}>Tutor: <b>{nomeTutor}</b></span></div>
                    {tags.length > 0 && !longa && (
                      <div className="ck-tags" title={item.queixa_principal || ""}>
                        {tagsVisiveis.map((tag, i) => {
                          const c = corSintoma(tag);
                          return <span key={i} className="ck-tag" style={{ backgroundColor: c.bg, color: c.text }}>{tag}</span>;
                        })}
                        {ocultas.length > 0 && <span className="ck-tag" style={{ backgroundColor: "#f1f5f9", color: "#475569" }} title={ocultas.join(", ")}>+{ocultas.length}</span>}
                      </div>
                    )}
                    {longa && <QueixaRecolhivel texto={item.queixa_principal} />}
                  </div>

                  <div className="ck-lado">
                    <span className="ck-status"><FaClock size={12} /> Aguardando Triagem</span>
                    {espera && <span className={`ck-espera n${espera.nivel}`}><FaClock size={11} /> {espera.texto}</span>}
                    <button type="button" className="ck-excluir" title="Excluir check-in" aria-label="Excluir check-in" onClick={() => setConsultaParaExcluir(item)}>
                      <MdDelete size={19} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Confirmação de exclusão */}
        {consultaParaExcluir && (
          <div className="ck-overlay" onClick={() => setConsultaParaExcluir(null)}>
            <div className="ck-conf" onClick={(e) => e.stopPropagation()}>
              <div className="em">⚠️</div>
              <h3>Excluir check-in?</h3>
              <p>O check-in <strong>{consultaParaExcluir.codigo}</strong> será removido da fila de espera.</p>
              <div className="bt">
                <button type="button" className="ck-btn ck-btn-cancelar" onClick={() => setConsultaParaExcluir(null)}>Cancelar</button>
                <button type="button" className="ck-btn ck-btn-excluir" onClick={deletarCheckin}>Sim, excluir</button>
              </div>
            </div>
          </div>
        )}

        {/* Novo check-in */}
        {mostrarModal && (
          <div className="ck-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) fecharModal(); }}>
            <form className="ck-modal" onSubmit={realizarCheckin}>
              <div className="ck-modal-topo">
                <h3><MdMedicalServices size={24} color="#4f46e5" /> Novo check-in de paciente</h3>
                <button type="button" className="ck-fechar" onClick={fecharModal} aria-label="Fechar"><MdClose size={20} /></button>
              </div>

              <div className="ck-modal-corpo">
                {/* Esquerda: paciente */}
                <div>
                  <label className="ck-rotulo">1 · Paciente &amp; tutor *</label>
                  <div className="ck-busca">
                    <MdSearch size={20} />
                    <input className="ck-input" autoFocus placeholder="Buscar por pet ou tutor..." value={buscaPaciente} onChange={(e) => setBuscaPaciente(e.target.value)} />
                  </div>
                  <div className="ck-lista">
                    {animaisFiltrados.length === 0 ? (
                      <div className="ck-sem">Nenhum paciente encontrado.</div>
                    ) : (
                      animaisFiltrados.map((a) => {
                        const t = tutorDoAnimal(a);
                        const sel = String(animalId) === String(a.id);
                        const { Icone, bg, cor } = estiloEspecie(a.especie);
                        return (
                          <div key={a.id} className={`ck-item ${sel ? "sel" : ""}`} onClick={() => setAnimalId(String(a.id))}>
                            <div className="av" style={{ backgroundColor: bg }}><Icone size={19} color={cor} /></div>
                            <div>
                              <div className="nm">{a.nome} <small>({a.especie}{a.raca ? ` - ${a.raca}` : ""})</small></div>
                              <div className="tt">Tutor: {t ? t.nome : "Sem tutor"}</div>
                            </div>
                            {sel && <span className="ok"><MdCheckCircle size={22} /></span>}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Direita: queixa */}
                <div>
                  <div className={`ck-resumo ${pronto ? "pronto" : ""}`}>
                    {animalSelecionado ? (() => {
                      const { Icone, bg, cor } = estiloEspecie(animalSelecionado.especie);
                      const t = tutorDoAnimal(animalSelecionado);
                      return (
                        <>
                          <div className="ck-avatar" style={{ backgroundColor: bg, width: 42, height: 42 }}><Icone size={22} color={cor} /></div>
                          <div><b>{animalSelecionado.nome}</b><br />Tutor: {t ? t.nome : "Sem tutor"}</div>
                        </>
                      );
                    })() : <span>Selecione o paciente na lista ao lado.</span>}
                  </div>

                  <div className="ck-campo">
                    <label className="ck-rotulo">2 · Queixa principal *</label>
                    <div className="ck-chips" style={{ marginTop: 0, marginBottom: 10 }}>
                      {SINTOMAS_RAPIDOS.map((s) => {
                        const c = corSintoma(s);
                        const on = tagsAtuais.includes(s.toLowerCase());
                        return (
                          <button key={s} type="button" className={`ck-chip ${on ? "on" : ""}`} onClick={() => alternarSintoma(s)} style={{ backgroundColor: c.bg, color: c.text }}>
                            {on ? "✓ " : ""}{s}
                          </button>
                        );
                      })}
                    </div>
                    <textarea className="ck-textarea" placeholder="Descreva a queixa ou toque nas tags acima..." value={queixaPrincipal} onChange={(e) => setQueixaPrincipal(e.target.value)} />
                  </div>

                  <div className="ck-campo" style={{ marginBottom: 0 }}>
                    <label className="ck-rotulo">3 · Enfermeiro(a) / triagem (opcional)</label>
                    <select className="ck-select" value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)}>
                      <option value="">Selecione o enfermeiro responsável...</option>
                      {usuarios.map((u) => (
                        <option key={u.id} value={u.id}>{u.nome || u.email}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="ck-modal-rodape">
                <button type="button" className="ck-btn ck-btn-cancelar" onClick={fecharModal}>Cancelar</button>
                <button type="submit" className="ck-btn ck-btn-salvar" disabled={carregando || !pronto}>
                  <MdCheckCircle size={19} /> {carregando ? "Salvando..." : "Concluir check-in"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </Layout>
  );
}

export default Checkin;