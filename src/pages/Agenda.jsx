import { useEffect, useMemo, useState, useCallback } from "react";
import { MdCalendarToday, MdAdd, MdClose, MdChevronLeft, MdChevronRight, MdSearch, MdEdit } from "react-icons/md";
import api from "../api/api";
import Layout from "../components/Layout";
import ModalConfirmacao from "../components/ModalConfirmacao";

// ---------- utilidades de data (sempre no fuso local; toISOString() usa UTC e erra o dia à noite) ----------
const pad = (n) => String(n).padStart(2, "0");
const fmtData = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const paraData = (str) => new Date(`${str}T00:00:00`);
const somarDias = (str, n) => { const d = paraData(str); d.setDate(d.getDate() + n); return fmtData(d); };
const inicioSemana = (str) => { const d = paraData(str); const dia = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dia); return fmtData(d); };
const DIAS_CURTOS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

const TIPOS = [
  { id: "Consulta", rotulo: "Consulta", icone: "🩺", cor: "#4f46e5", fundo: "#eef2ff" },
  { id: "Vacina", rotulo: "Vacinação", icone: "💉", cor: "#0891b2", fundo: "#ecfeff" },
  { id: "Retorno", rotulo: "Retorno", icone: "🔁", cor: "#059669", fundo: "#ecfdf5" },
  { id: "Exame", rotulo: "Exames", icone: "🧪", cor: "#d97706", fundo: "#fffbeb" },
  { id: "Cirurgia", rotulo: "Cirurgia", icone: "🔪", cor: "#dc2626", fundo: "#fef2f2" },
];
const tipoInfo = (id) => TIPOS.find((t) => t.id === id) || { id, rotulo: id || "Serviço", icone: "📌", cor: "#475569", fundo: "#f1f5f9" };

const STATUS = {
  AGENDADO: { rotulo: "Agendado", cor: "#1d4ed8", fundo: "#dbeafe" },
  EM_ESPERA: { rotulo: "Na recepção", cor: "#92400e", fundo: "#fef3c7" },
  FALTOU: { rotulo: "Faltou", cor: "#991b1b", fundo: "#fee2e2" },
};

// Horários de 30 em 30 minutos
const HORARIOS = (() => { const l = []; for (let h = 7; h <= 19; h++) { l.push(`${pad(h)}:00`); if (h < 19) l.push(`${pad(h)}:30`); } return l; })();

const emojiEspecie = (esp) => {
  const e = String(esp || "").toLowerCase();
  if (e.includes("can")) return "🐶";
  if (e.includes("fel")) return "🐱";
  if (e.includes("ave")) return "🦜";
  if (e.includes("equ")) return "🐴";
  return "🐾";
};

const CSS = `
.ag-root{font-family:inherit;color:#0f172a}
.ag-hero{background:linear-gradient(135deg,#0f766e 0%,#0d9488 55%,#14b8a6 100%);border-radius:20px;padding:22px 26px;color:#fff;display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;box-shadow:0 10px 30px -12px rgba(13,148,136,.55);margin-bottom:18px}
.ag-hero h1{margin:0;font-size:24px;font-weight:800;display:flex;align-items:center;gap:10px;letter-spacing:-.3px}
.ag-hero p{margin:4px 0 0;font-size:13px;opacity:.88}
.ag-btn-novo{background:#fff;color:#0f766e;border:none;padding:11px 18px;border-radius:12px;font-weight:700;font-size:14px;cursor:pointer;display:flex;align-items:center;gap:6px;box-shadow:0 4px 14px rgba(0,0,0,.14);transition:transform .15s,box-shadow .15s}
.ag-btn-novo:hover{transform:translateY(-1px);box-shadow:0 8px 20px rgba(0,0,0,.18)}
.ag-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:18px}
.ag-kpi{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:14px 16px;text-align:left;cursor:pointer;transition:all .15s;font-family:inherit}
.ag-kpi:hover{border-color:#99f6e4;box-shadow:0 6px 18px -10px rgba(13,148,136,.5)}
.ag-kpi.on{border-color:#0d9488;box-shadow:0 0 0 3px rgba(13,148,136,.15)}
.ag-kpi b{display:block;font-size:26px;font-weight:800;line-height:1.1}
.ag-kpi span{font-size:12px;color:#64748b;font-weight:600}
.ag-nav{background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:14px 16px;margin-bottom:18px}
.ag-nav-top{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:12px}
.ag-nav-data{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.ag-icon-btn{width:36px;height:36px;border-radius:10px;border:1px solid #e2e8f0;background:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#334155;transition:all .15s}
.ag-icon-btn:hover{background:#f0fdfa;border-color:#5eead4;color:#0f766e}
.ag-hoje{height:36px;padding:0 14px;border-radius:10px;border:1px solid #99f6e4;background:#f0fdfa;color:#0f766e;font-weight:700;font-size:13px;cursor:pointer}
.ag-titulo-dia{font-size:15px;font-weight:700;color:#0f172a;display:inline-block}.ag-titulo-dia::first-letter{text-transform:uppercase}
.ag-date{height:36px;border:1px solid #e2e8f0;border-radius:10px;padding:0 10px;font-size:13px;font-weight:600;color:#334155;font-family:inherit}
.ag-semana{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:8px}
.ag-dia{border:1px solid #e2e8f0;background:#f8fafc;border-radius:14px;padding:9px 4px;cursor:pointer;text-align:center;transition:all .15s;font-family:inherit}
.ag-dia:hover{border-color:#5eead4;background:#f0fdfa}
.ag-dia.on{background:#0d9488;border-color:#0d9488;color:#fff;box-shadow:0 6px 16px -8px rgba(13,148,136,.9)}
.ag-dia small{display:block;font-size:11px;font-weight:700;opacity:.75;text-transform:uppercase}
.ag-dia strong{display:block;font-size:18px;margin:1px 0}
.ag-dia em{font-style:normal;font-size:11px;font-weight:700;display:inline-block;min-width:20px;padding:1px 7px;border-radius:99px;background:#e2e8f0;color:#475569}
.ag-dia.on em{background:rgba(255,255,255,.25);color:#fff}
.ag-dia em.zero{background:transparent;color:#cbd5e1}
.ag-dia.on em.zero{color:rgba(255,255,255,.6)}
.ag-periodo{font-size:12px;font-weight:800;color:#64748b;letter-spacing:.8px;text-transform:uppercase;margin:6px 4px 10px}
.ag-lista{display:flex;flex-direction:column;gap:10px;margin-bottom:14px}
.ag-card{display:flex;align-items:center;gap:16px;background:#fff;border:1px solid #e2e8f0;border-left:5px solid var(--cor);border-radius:16px;padding:14px 16px;transition:box-shadow .15s,transform .15s}
.ag-card:hover{box-shadow:0 10px 24px -14px rgba(15,23,42,.35);transform:translateY(-1px)}
.ag-hora{min-width:64px;text-align:center;font-weight:800;font-size:18px;color:#0f172a;letter-spacing:-.3px}
.ag-avatar{width:44px;height:44px;border-radius:14px;background:var(--fundo);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0}
.ag-info{flex:1;min-width:0}
.ag-nome{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.ag-nome strong{font-size:15px}
.ag-chip{font-size:11px;font-weight:700;padding:3px 9px;border-radius:99px;white-space:nowrap}
.ag-sub{font-size:12.5px;color:#64748b;margin-top:3px}
.ag-obs{font-size:12px;color:#94a3b8;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:520px}
.ag-acoes{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end}
.ag-b{border:none;border-radius:10px;padding:8px 13px;font-weight:700;font-size:12.5px;cursor:pointer;font-family:inherit;transition:filter .15s}
.ag-b:hover{filter:brightness(.94)}
.ag-b.prim{background:#0d9488;color:#fff}
.ag-b.sec{background:#f1f5f9;color:#334155}
.ag-b.warn{background:#fff7ed;color:#c2410c}
.ag-b.dang{background:#fef2f2;color:#dc2626}
.ag-vazio{background:#fff;border:2px dashed #cbd5e1;border-radius:20px;text-align:center;padding:46px 20px;color:#64748b}
.ag-vazio p{margin:0}
.ag-toast{position:fixed;top:18px;right:18px;z-index:4000;padding:12px 18px;border-radius:12px;font-weight:600;font-size:14px;box-shadow:0 12px 30px -10px rgba(0,0,0,.3);max-width:360px}
.ag-overlay{position:fixed;inset:0;background:rgba(15,23,42,.55);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;z-index:2000;padding:16px}
.ag-modal{background:#fff;border-radius:22px;width:100%;max-width:560px;max-height:92vh;overflow:auto;box-shadow:0 30px 60px -20px rgba(0,0,0,.45)}
.ag-m-head{display:flex;justify-content:space-between;align-items:center;padding:20px 24px;border-bottom:1px solid #f1f5f9}
.ag-m-head h3{margin:0;font-size:18px;font-weight:800}
.ag-m-body{padding:20px 24px;display:flex;flex-direction:column;gap:18px}
.ag-m-foot{padding:16px 24px;border-top:1px solid #f1f5f9;display:flex;justify-content:flex-end;gap:10px;background:#f8fafc;border-radius:0 0 22px 22px}
.ag-lbl{font-size:12px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;display:block}
.ag-input{width:100%;height:42px;padding:0 12px;border:1px solid #cbd5e1;border-radius:12px;font-size:14px;outline:none;box-sizing:border-box;font-family:inherit;background:#fff;transition:border .15s,box-shadow .15s}
.ag-input:focus{border-color:#0d9488;box-shadow:0 0 0 3px rgba(13,148,136,.15)}
.ag-tipos{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}
.ag-tipo{border:1.5px solid #e2e8f0;background:#fff;border-radius:12px;padding:10px 4px;cursor:pointer;font-family:inherit;font-size:12px;font-weight:700;color:#475569;display:flex;flex-direction:column;align-items:center;gap:4px;transition:all .15s}
.ag-tipo span{font-size:20px}
.ag-tipo:hover{border-color:#99f6e4}
.ag-tipo.on{border-color:var(--cor);background:var(--fundo);color:var(--cor);box-shadow:0 0 0 3px color-mix(in srgb,var(--cor) 18%,transparent)}
.ag-slots{display:grid;grid-template-columns:repeat(auto-fill,minmax(66px,1fr));gap:6px;max-height:132px;overflow:auto;padding:2px}
.ag-slot{border:1px solid #e2e8f0;background:#fff;border-radius:9px;padding:7px 0;font-size:13px;font-weight:700;cursor:pointer;color:#334155;font-family:inherit}
.ag-slot:hover:not(:disabled){border-color:#0d9488;background:#f0fdfa}
.ag-slot.on{background:#0d9488;color:#fff;border-color:#0d9488}
.ag-slot:disabled{background:#f1f5f9;color:#cbd5e1;text-decoration:line-through;cursor:not-allowed}
.ag-pets{border:1px solid #e2e8f0;border-radius:12px;margin-top:6px;max-height:190px;overflow:auto}
.ag-pet{display:flex;align-items:center;gap:10px;width:100%;padding:9px 12px;border:none;background:#fff;cursor:pointer;text-align:left;font-family:inherit;border-bottom:1px solid #f1f5f9}
.ag-pet:hover{background:#f0fdfa}
.ag-sel{display:flex;align-items:center;gap:12px;background:#f0fdfa;border:1px solid #99f6e4;border-radius:14px;padding:10px 14px}
.ag-erro{background:#fef2f2;border:1px solid #fecaca;color:#991b1b;padding:10px 14px;border-radius:12px;font-size:13px;font-weight:600}
.ag-aviso{background:#fffbeb;border:1px solid #fde68a;color:#92400e;padding:10px 14px;border-radius:12px;font-size:13px;font-weight:600}
@media (max-width:760px){
  .ag-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}
  .ag-card{flex-wrap:wrap}
  .ag-acoes{width:100%;justify-content:flex-start}
  .ag-tipos{grid-template-columns:repeat(3,minmax(0,1fr))}
  .ag-semana{gap:4px}
  .ag-dia strong{font-size:15px}
}
`;

function Agenda() {
  const hoje = fmtData(new Date());
  const [dataSelecionada, setDataSelecionada] = useState(hoje);
  const [agendaSemana, setAgendaSemana] = useState([]);
  const [animais, setAnimais] = useState([]);
  const [veterinarios, setVeterinarios] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [filtro, setFiltro] = useState("TODOS");
  const [toast, setToast] = useState(null);

  // modal novo / editar
  const [modalAberto, setModalAberto] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [animalId, setAnimalId] = useState("");
  const [buscaPet, setBuscaPet] = useState("");
  const [veterinarioId, setVeterinarioId] = useState("");
  const [dataForm, setDataForm] = useState(hoje);
  const [hora, setHora] = useState("");
  const [tipoServico, setTipoServico] = useState("Consulta");
  const [observacoes, setObservacoes] = useState("");
  const [erroForm, setErroForm] = useState("");
  const [salvando, setSalvando] = useState(false);

  const [confirmacao, setConfirmacao] = useState(null); // { item, acao: 'CANCELADO' | 'FALTOU' }

  const config = useCallback(() => ({ headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }), []);
  const avisar = (texto, tipo = "ok") => { setToast({ texto, tipo }); setTimeout(() => setToast(null), 4200); };

  const semanaInicio = useMemo(() => inicioSemana(dataSelecionada), [dataSelecionada]);
  const diasSemana = useMemo(() => Array.from({ length: 7 }, (_, i) => somarDias(semanaInicio, i)), [semanaInicio]);

  const carregarAgenda = useCallback(async () => {
    setCarregando(true);
    try {
      const res = await api.get(`/agendamentos/?data_inicio=${semanaInicio}&data_fim=${somarDias(semanaInicio, 6)}`, config());
      setAgendaSemana((res.data || []).filter((i) => i.status !== "CANCELADO"));
    } catch (err) {
      console.error("Erro ao carregar agendamentos:", err);
      setAgendaSemana([]);
      avisar("Não foi possível carregar a agenda. Tente novamente.", "erro");
    }
    setCarregando(false);
  }, [semanaInicio, config]);

  useEffect(() => { carregarAgenda(); }, [carregarAgenda]);

  useEffect(() => {
    (async () => {
      try { const r = await api.get("/animais/", config()); setAnimais(r.data || []); } catch (e) { console.error("Erro ao carregar animais:", e); }
      try {
        const r = await api.get("/usuarios/", config());
        setVeterinarios((r.data || []).filter((u) => u.perfil === "VETERINARIO" || u.perfil === "ADMIN"));
      } catch (e) { console.error("Erro ao carregar utilizadores:", e); }
    })();
  }, [config]);

  const doDia = useMemo(() => agendaSemana.filter((i) => (i.data || String(i.data_horario).slice(0, 10)) === dataSelecionada), [agendaSemana, dataSelecionada]);
  const contagemDia = (d) => agendaSemana.filter((i) => (i.data || String(i.data_horario).slice(0, 10)) === d).length;
  const kpi = {
    TODOS: doDia.length,
    AGENDADO: doDia.filter((i) => i.status === "AGENDADO").length,
    EM_ESPERA: doDia.filter((i) => i.status === "EM_ESPERA").length,
    FALTOU: doDia.filter((i) => i.status === "FALTOU").length,
  };
  const visiveis = doDia.filter((i) => filtro === "TODOS" || i.status === filtro);
  const manha = visiveis.filter((i) => Number(String(i.hora).slice(0, 2)) < 12);
  const tarde = visiveis.filter((i) => Number(String(i.hora).slice(0, 2)) >= 12);

  // ---------- modal ----------
  const abrirNovo = (horaInicial = "") => {
    setEditandoId(null); setAnimalId(""); setBuscaPet(""); setVeterinarioId(""); setDataForm(dataSelecionada);
    setHora(horaInicial); setTipoServico("Consulta"); setObservacoes(""); setErroForm(""); setModalAberto(true);
  };
  const abrirEdicao = (item) => {
    setEditandoId(item.id); setAnimalId(String(item.animal_id)); setBuscaPet(""); setVeterinarioId(item.veterinario_id ? String(item.veterinario_id) : "");
    setDataForm(item.data || String(item.data_horario).slice(0, 10)); setHora(item.hora); setTipoServico(item.tipo_servico || "Consulta");
    setObservacoes(item.observacoes || ""); setErroForm(""); setModalAberto(true);
  };
  const fecharModal = () => { if (!salvando) setModalAberto(false); };

  useEffect(() => {
    if (!modalAberto) return undefined;
    const aoTeclar = (e) => { if (e.key === "Escape" && !confirmacao) fecharModal(); };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  });

  const petSelecionado = animais.find((a) => String(a.id) === String(animalId));
  const nomeTutorDe = (a) => a?.tutor_nome || a?.tutor?.nome || "";
  const petsFiltrados = useMemo(() => {
    const t = buscaPet.trim().toLowerCase();
    const base = t ? animais.filter((a) => `${a.nome} ${nomeTutorDe(a)} ${a.especie || ""}`.toLowerCase().includes(t)) : animais;
    return base.slice(0, 30);
  }, [animais, buscaPet]);

  // horários já ocupados no dia do formulário (mesmo veterinário escolhido ou mesmo paciente)
  const ocupados = useMemo(() => {
    const set = new Set();
    // a semana carregada só cobre dias da semana atual; fora dela o servidor confirma ao salvar
    agendaSemana.forEach((i) => {
      if ((i.data || String(i.data_horario).slice(0, 10)) !== dataForm || i.id === editandoId) return;
      if (!["AGENDADO", "EM_ESPERA"].includes(i.status)) return;
      if ((veterinarioId && String(i.veterinario_id) === String(veterinarioId)) || (animalId && String(i.animal_id) === String(animalId))) set.add(i.hora);
    });
    return set;
  }, [agendaSemana, dataForm, veterinarioId, animalId, editandoId]);

  const agora = new Date();
  const passou = (h) => dataForm === fmtData(agora) && h < `${pad(agora.getHours())}:${pad(agora.getMinutes())}`;

  const salvar = async (e) => {
    e.preventDefault();
    setErroForm("");
    if (!animalId) return setErroForm("Escolha o paciente.");
    if (!hora) return setErroForm("Escolha o horário.");
    if (!editandoId && passou(hora)) return setErroForm("Esse horário já passou. Escolha um horário futuro.");
    setSalvando(true);
    try {
      const corpo = { usuario_id: veterinarioId ? Number(veterinarioId) : null, data_horario: `${dataForm}T${hora}:00`, tipo_servico: tipoServico, observacoes: observacoes.trim() || null };
      if (editandoId) await api.put(`/agendamentos/${editandoId}`, corpo, config());
      else await api.post("/agendamentos/", { animal_id: Number(animalId), ...corpo }, config());
      setModalAberto(false);
      avisar(editandoId ? "Agendamento atualizado." : "Agendamento criado com sucesso!");
      if (dataForm !== dataSelecionada) setDataSelecionada(dataForm); else carregarAgenda();
    } catch (err) {
      const d = err.response?.data?.detail;
      setErroForm(Array.isArray(d) ? "Confira os campos do formulário." : d || "Não foi possível salvar o agendamento.");
    }
    setSalvando(false);
  };

  const alterarStatus = async (id, novoStatus, msg) => {
    try {
      await api.put(`/agendamentos/${id}/status`, null, { params: { novo_status: novoStatus }, ...config() });
      avisar(msg);
      carregarAgenda();
    } catch (err) {
      const d = err.response?.data?.detail;
      avisar(d || "Não foi possível atualizar o status.", "erro");
    }
  };

  const confirmar = async () => {
    if (!confirmacao) return;
    const { item, acao } = confirmacao;
    setConfirmacao(null);
    await alterarStatus(item.id, acao, acao === "CANCELADO" ? "Agendamento cancelado." : "Falta registrada.");
  };

  const rotuloDia = paraData(dataSelecionada).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const renderCard = (item) => {
    const t = tipoInfo(item.tipo_servico);
    const st = STATUS[item.status] || STATUS.AGENDADO;
    return (
      <div key={item.id} className="ag-card" style={{ "--cor": t.cor, "--fundo": t.fundo }}>
        <div className="ag-hora">{item.hora}</div>
        <div className="ag-avatar">{emojiEspecie(item.especie)}</div>
        <div className="ag-info">
          <div className="ag-nome">
            <strong>{item.pet_nome}</strong>
            <span style={{ fontSize: 12, color: "#94a3b8" }}>{item.especie}</span>
            <span className="ag-chip" style={{ background: t.fundo, color: t.cor }}>{t.icone} {t.rotulo}</span>
            <span className="ag-chip" style={{ background: st.fundo, color: st.cor }}>{st.rotulo}</span>
          </div>
          <div className="ag-sub">👤 {item.tutor_nome} · 👨‍⚕️ {item.veterinario_nome}</div>
          {item.observacoes && <div className="ag-obs" title={item.observacoes}>📝 {item.observacoes}</div>}
        </div>
        <div className="ag-acoes">
          {item.status === "AGENDADO" && (
            <>
              <button className="ag-b prim" onClick={() => alterarStatus(item.id, "EM_ESPERA", `${item.pet_nome} está na fila da triagem.`)}>🟢 Dar entrada</button>
              <button className="ag-b sec" onClick={() => abrirEdicao(item)} title="Remarcar ou editar"><MdEdit size={14} style={{ verticalAlign: "-2px" }} /> Editar</button>
              <button className="ag-b warn" onClick={() => setConfirmacao({ item, acao: "FALTOU" })}>Faltou</button>
              <button className="ag-b dang" onClick={() => setConfirmacao({ item, acao: "CANCELADO" })}>Cancelar</button>
            </>
          )}
          {item.status === "EM_ESPERA" && <span style={{ fontSize: 12.5, fontWeight: 700, color: "#92400e" }}>⏳ Na fila da triagem</span>}
          {item.status === "FALTOU" && <button className="ag-b sec" onClick={() => alterarStatus(item.id, "AGENDADO", "Agendamento reativado.")}>Reativar</button>}
        </div>
      </div>
    );
  };

  return (
    <Layout>
      <style>{CSS}</style>
      <div className="ag-root">
        {toast && (
          <div className="ag-toast" role="status" style={toast.tipo === "erro" ? { background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca" } : { background: "#ecfdf5", color: "#065f46", border: "1px solid #a7f3d0" }}>
            {toast.tipo === "erro" ? "⚠️ " : "✅ "}{toast.texto}
          </div>
        )}

        <div className="ag-hero">
          <div>
            <h1><MdCalendarToday /> Agenda de Atendimentos</h1>
            <p>Horários, consultas e retornos da clínica em um só lugar</p>
          </div>
          <button className="ag-btn-novo" onClick={() => abrirNovo()}><MdAdd size={20} /> Novo agendamento</button>
        </div>

        <div className="ag-kpis">
          {[["TODOS", "Total do dia", "#0f172a"], ["AGENDADO", "Agendados", "#1d4ed8"], ["EM_ESPERA", "Na recepção", "#b45309"], ["FALTOU", "Faltaram", "#dc2626"]].map(([id, rotulo, cor]) => (
            <button key={id} className={`ag-kpi ${filtro === id ? "on" : ""}`} onClick={() => setFiltro(id)}>
              <b style={{ color: cor }}>{kpi[id]}</b><span>{rotulo}</span>
            </button>
          ))}
        </div>

        <div className="ag-nav">
          <div className="ag-nav-top">
            <div className="ag-nav-data">
              <button className="ag-icon-btn" onClick={() => setDataSelecionada(somarDias(dataSelecionada, -1))} aria-label="Dia anterior"><MdChevronLeft size={22} /></button>
              <button className="ag-icon-btn" onClick={() => setDataSelecionada(somarDias(dataSelecionada, 1))} aria-label="Próximo dia"><MdChevronRight size={22} /></button>
              <button className="ag-hoje" onClick={() => setDataSelecionada(hoje)}>Hoje</button>
              <span className="ag-titulo-dia">{rotuloDia}</span>
            </div>
            <input type="date" className="ag-date" value={dataSelecionada} onChange={(e) => e.target.value && setDataSelecionada(e.target.value)} />
          </div>
          <div className="ag-semana">
            {diasSemana.map((d, i) => {
              const n = contagemDia(d);
              return (
                <button key={d} className={`ag-dia ${d === dataSelecionada ? "on" : ""}`} onClick={() => setDataSelecionada(d)}>
                  <small>{DIAS_CURTOS[i]}{d === hoje ? " · hoje" : ""}</small>
                  <strong>{paraData(d).getDate()}</strong>
                  <em className={n === 0 ? "zero" : ""}>{n}</em>
                </button>
              );
            })}
          </div>
        </div>

        {carregando ? (
          <div className="ag-vazio"><p style={{ color: "#0d9488", fontWeight: 700 }}>Carregando agenda...</p></div>
        ) : visiveis.length === 0 ? (
          <div className="ag-vazio">
            <div style={{ fontSize: 44, marginBottom: 6 }}>🗓️</div>
            <p style={{ fontSize: 17, fontWeight: 800, color: "#334155" }}>{doDia.length === 0 ? "Nenhum agendamento neste dia" : "Nada neste filtro"}</p>
            <p style={{ fontSize: 13, margin: "4px 0 14px" }}>{doDia.length === 0 ? "Que tal agendar o primeiro atendimento?" : "Escolha outro filtro acima para ver os demais."}</p>
            {doDia.length === 0 && <button className="ag-b prim" style={{ padding: "10px 18px" }} onClick={() => abrirNovo()}>+ Agendar atendimento</button>}
          </div>
        ) : (
          <>
            {manha.length > 0 && <><div className="ag-periodo">☀️ Manhã · {manha.length}</div><div className="ag-lista">{manha.map(renderCard)}</div></>}
            {tarde.length > 0 && <><div className="ag-periodo">🌤️ Tarde · {tarde.length}</div><div className="ag-lista">{tarde.map(renderCard)}</div></>}
          </>
        )}
      </div>

      {modalAberto && (
        <div className="ag-overlay" onClick={fecharModal} role="presentation">
          <form className="ag-modal" onClick={(e) => e.stopPropagation()} onSubmit={salvar} role="dialog" aria-modal="true">
            <div className="ag-m-head">
              <h3>{editandoId ? "✏️ Editar agendamento" : "📅 Novo agendamento"}</h3>
              <button type="button" className="ag-icon-btn" onClick={fecharModal} aria-label="Fechar"><MdClose size={20} /></button>
            </div>

            <div className="ag-m-body">
              {erroForm && <div className="ag-erro">⚠️ {erroForm}</div>}

              <div>
                <span className="ag-lbl">Paciente *</span>
                {petSelecionado ? (
                  <div className="ag-sel">
                    <div className="ag-avatar" style={{ "--fundo": "#ccfbf1" }}>{emojiEspecie(petSelecionado.especie)}</div>
                    <div style={{ flex: 1 }}>
                      <strong>{petSelecionado.nome}</strong> <span style={{ color: "#64748b", fontSize: 12 }}>({petSelecionado.especie})</span>
                      {nomeTutorDe(petSelecionado) && <div style={{ fontSize: 12, color: "#64748b" }}>Tutor: {nomeTutorDe(petSelecionado)}</div>}
                    </div>
                    {!editandoId && <button type="button" className="ag-b sec" onClick={() => setAnimalId("")}>Trocar</button>}
                  </div>
                ) : (
                  <>
                    <div style={{ position: "relative" }}>
                      <MdSearch size={18} style={{ position: "absolute", left: 12, top: 12, color: "#94a3b8" }} />
                      <input className="ag-input" style={{ paddingLeft: 36 }} placeholder="Buscar por nome do pet ou do tutor..." value={buscaPet} onChange={(e) => setBuscaPet(e.target.value)} autoFocus />
                    </div>
                    <div className="ag-pets">
                      {petsFiltrados.length === 0 ? (
                        <div style={{ padding: 14, fontSize: 13, color: "#94a3b8", textAlign: "center" }}>Nenhum paciente encontrado.</div>
                      ) : petsFiltrados.map((a) => (
                        <button type="button" key={a.id} className="ag-pet" onClick={() => setAnimalId(String(a.id))}>
                          <span style={{ fontSize: 20 }}>{emojiEspecie(a.especie)}</span>
                          <span style={{ flex: 1 }}><strong style={{ fontSize: 14 }}>{a.nome}</strong> <span style={{ color: "#94a3b8", fontSize: 12 }}>{a.especie}</span>
                            {nomeTutorDe(a) && <span style={{ display: "block", fontSize: 12, color: "#64748b" }}>Tutor: {nomeTutorDe(a)}</span>}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div>
                <span className="ag-lbl">Tipo de serviço</span>
                <div className="ag-tipos">
                  {TIPOS.map((t) => (
                    <button type="button" key={t.id} className={`ag-tipo ${tipoServico === t.id ? "on" : ""}`} style={{ "--cor": t.cor, "--fundo": t.fundo }} onClick={() => setTipoServico(t.id)}>
                      <span>{t.icone}</span>{t.rotulo}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label className="ag-lbl" htmlFor="ag-data">Data *</label>
                  <input id="ag-data" type="date" className="ag-input" value={dataForm} min={editandoId ? undefined : hoje} onChange={(e) => { setDataForm(e.target.value); setHora(""); }} required />
                </div>
                <div>
                  <label className="ag-lbl" htmlFor="ag-vet">Veterinário</label>
                  <select id="ag-vet" className="ag-input" value={veterinarioId} onChange={(e) => setVeterinarioId(e.target.value)}>
                    <option value="">Qualquer veterinário</option>
                    {veterinarios.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <span className="ag-lbl">Horário * {hora && <span style={{ color: "#0d9488", textTransform: "none" }}>· {hora}</span>}</span>
                <div className="ag-slots">
                  {HORARIOS.map((h) => {
                    const indisponivel = ocupados.has(h) || (!editandoId && passou(h));
                    return <button type="button" key={h} className={`ag-slot ${hora === h ? "on" : ""}`} disabled={indisponivel} onClick={() => setHora(h)}>{h}</button>;
                  })}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 12, color: "#64748b" }}>
                  Outro horário:
                  <input type="time" className="ag-input" style={{ width: 120, height: 34 }} value={hora} onChange={(e) => setHora(e.target.value)} />
                </div>
                {ocupados.size > 0 && <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 6 }}>Horários riscados já estão ocupados para este paciente/veterinário.</div>}
              </div>

              <div>
                <label className="ag-lbl" htmlFor="ag-obs">Observações</label>
                <textarea id="ag-obs" rows={3} className="ag-input" style={{ height: "auto", padding: 10, resize: "vertical" }} maxLength={500} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Motivo da consulta, orientações para a recepção..." />
                <div style={{ textAlign: "right", fontSize: 11, color: "#94a3b8" }}>{observacoes.length}/500</div>
              </div>
            </div>

            <div className="ag-m-foot">
              <button type="button" className="ag-b sec" style={{ padding: "11px 18px" }} onClick={fecharModal}>Cancelar</button>
              <button type="submit" className="ag-b prim" style={{ padding: "11px 22px", opacity: salvando ? 0.7 : 1 }} disabled={salvando}>
                {salvando ? "Salvando..." : editandoId ? "Salvar alterações" : "Confirmar agendamento"}
              </button>
            </div>
          </form>
        </div>
      )}

      <ModalConfirmacao
        aberto={!!confirmacao}
        titulo={confirmacao?.acao === "CANCELADO" ? "Cancelar agendamento?" : "Registrar falta?"}
        mensagem={confirmacao ? (confirmacao.acao === "CANCELADO"
          ? `O atendimento de ${confirmacao.item.pet_nome} às ${confirmacao.item.hora} será cancelado e sairá da agenda.`
          : `${confirmacao.item.pet_nome} (${confirmacao.item.hora}) será marcado como "Faltou". Você poderá reativar depois, se necessário.`) : ""}
        rotuloConfirmar={confirmacao?.acao === "CANCELADO" ? "Sim, cancelar" : "Registrar falta"}
        rotuloCancelar="Voltar"
        tom={confirmacao?.acao === "CANCELADO" ? "perigo" : "aviso"}
        icone={confirmacao?.acao === "CANCELADO" ? "🗑️" : "⚠️"}
        onConfirmar={confirmar}
        onCancelar={() => setConfirmacao(null)}
      />
    </Layout>
  );
}

export default Agenda;