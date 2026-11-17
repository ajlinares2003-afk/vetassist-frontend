import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MdScience, MdSearch, MdPrint, MdClose, MdRefresh, MdCheckCircle, MdPets, MdPerson, MdErrorOutline } from "react-icons/md";
import { FaDog, FaCat, FaHorse, FaDove, FaFish, FaFrog, FaBug } from "react-icons/fa";
import { GiRabbit, GiCow, GiPig, GiSheep, GiGoat } from "react-icons/gi";
import api from "../api/api";
import Layout from "../components/Layout";

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

const ROTULO_CATEGORIA = { LABORATORIAL: "Laboratorial", IMAGEM: "Imagem", OUTRO: "Outro" };

const CSS = `
.pe-root, .pe-root * { box-sizing: border-box; }
.pe-root * { text-align: left; }
.pe-root { color: #0f172a; font-family: inherit; }
.pe-hero { border-radius: 22px; padding: 22px 26px; margin-bottom: 18px; background: linear-gradient(120deg, #ecfeff 0%, #f0f9ff 55%, #eef2ff 100%); border: 1px solid #bae6fd; }
.pe-hero-top { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
.pe-titulo { display: flex; align-items: center; gap: 14px; }
.pe-icone { width: 52px; height: 52px; border-radius: 16px; background: #0284c7; color: #fff; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 18px rgba(2,132,199,.28); }
.pe-hero h1 { margin: 0; font-size: 25px; font-weight: 800; color: #0c4a6e; letter-spacing: -.3px; }
.pe-hero p { margin: 3px 0 0; font-size: 13.5px; color: #475569; }
.pe-stats { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 16px; }
.pe-stat { background: rgba(255,255,255,.9); border: 1px solid #e2e8f0; border-radius: 14px; padding: 10px 16px; min-width: 120px; }
.pe-stat b { display: block; font-size: 22px; font-weight: 800; color: #0c4a6e; line-height: 1.1; }
.pe-stat span { font-size: 12px; color: #64748b; font-weight: 600; }
.pe-stat.urg b { color: #b91c1c; }
.pe-filtros { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin-bottom: 14px; }
.pe-busca { position: relative; flex: 1; min-width: 240px; }
.pe-busca svg { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #94a3b8; }
.pe-input, .pe-select { height: 44px; border: 1px solid #d1d5db; border-radius: 12px; background: #fff; font-size: 14px; color: #0f172a; outline: none; padding: 0 14px; }
.pe-busca .pe-input { width: 100%; padding-left: 40px; }
.pe-input:focus, .pe-select:focus { border-color: #38bdf8; box-shadow: 0 0 0 3px rgba(56,189,248,.25); }
.pe-check { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: #475569; cursor: pointer; padding: 0 4px; }
.pe-btn { display: inline-flex; align-items: center; gap: 7px; border: none; border-radius: 12px; padding: 10px 16px; font-weight: 700; font-size: 13.5px; cursor: pointer; font-family: inherit; transition: filter .15s, transform .15s; }
.pe-btn:hover { filter: brightness(.95); transform: translateY(-1px); }
.pe-btn.azul { background: #0284c7; color: #fff; }
.pe-btn.claro { background: #e0f2fe; color: #0369a1; }
.pe-btn.cinza { background: #f1f5f9; color: #334155; }
.pe-lista { display: grid; gap: 12px; }
.pe-card { display: grid; grid-template-columns: minmax(200px, 1.1fr) minmax(220px, 2fr) auto; gap: 18px; align-items: center; background: #fff; border: 1px solid #e5e7eb; border-radius: 18px; padding: 16px 18px; box-shadow: 0 2px 6px rgba(15,23,42,.05); transition: box-shadow .18s, transform .18s; }
.pe-card:hover { box-shadow: 0 12px 22px rgba(15,23,42,.10); transform: translateY(-1px); }
.pe-card.antigo { opacity: .7; background: #f8fafc; }
.pe-pac { display: flex; align-items: center; gap: 12px; min-width: 0; }
.pe-av { width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.pe-nome { font-size: 16px; font-weight: 800; color: #0f172a; overflow-wrap: anywhere; }
.pe-sub { font-size: 12.5px; color: #64748b; display: flex; gap: 6px; align-items: center; flex-wrap: wrap; margin-top: 2px; }
.pe-cod { font-size: 11px; font-weight: 800; color: #0369a1; background: #e0f2fe; border-radius: 99px; padding: 2px 8px; }
.pe-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.pe-chip { font-size: 12.5px; font-weight: 600; padding: 4px 10px; border-radius: 99px; background: #f0f9ff; color: #075985; border: 1px solid #bae6fd; }
.pe-chip.urg { background: #fef2f2; color: #b91c1c; border-color: #fecaca; }
.pe-quando { text-align: right; display: flex; flex-direction: column; gap: 8px; align-items: flex-end; }
.pe-quando .dt { font-size: 13px; color: #475569; font-weight: 600; text-align: right; }
.pe-quando .tag { font-size: 11px; font-weight: 800; padding: 3px 9px; border-radius: 99px; background: #fef3c7; color: #92400e; }
.pe-vazio { background: #fff; border: 2px dashed #e2e8f0; border-radius: 18px; padding: 44px 20px; color: #64748b; }
.pe-vazio, .pe-vazio * { text-align: center; }
.pe-erro { display: flex; align-items: center; gap: 10px; background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 12px 14px; border-radius: 12px; font-weight: 600; font-size: 14px; margin-bottom: 14px; }
.pe-overlay { position: fixed; inset: 0; background: rgba(15,23,42,.55); backdrop-filter: blur(3px); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 16px; }
.pe-modal { background: #fff; border-radius: 20px; width: 100%; max-width: 720px; max-height: calc(100vh - 32px); overflow-y: auto; padding: 32px; box-shadow: 0 30px 60px rgba(15,23,42,.3); }
.pe-doc-topo { text-align: center; border-bottom: 2px solid #0284c7; padding-bottom: 14px; margin-bottom: 18px; }
.pe-doc-topo, .pe-doc-topo * { text-align: center; }
.pe-doc-topo h2 { margin: 0; font-size: 22px; color: #0f172a; }
.pe-doc-topo p { margin: 4px 0 0; font-size: 12.5px; font-weight: 700; color: #0284c7; text-transform: uppercase; letter-spacing: .5px; }
.pe-doc-dados { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px; font-size: 13px; display: grid; gap: 4px; margin-bottom: 18px; }
.pe-doc-exame { display: flex; gap: 10px; align-items: flex-start; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 12px; margin-bottom: 8px; page-break-inside: avoid; break-inside: avoid; }
.pe-doc-exame b { font-size: 14px; color: #1e293b; display: block; }
.pe-doc-exame small { font-size: 12px; color: #64748b; display: block; margin-top: 2px; }
.pe-doc-assina { margin-top: 44px; }
.pe-doc-assina, .pe-doc-assina * { text-align: center; }
.pe-acoes-modal { display: flex; justify-content: flex-end; gap: 10px; margin-top: 24px; padding-top: 14px; border-top: 1px solid #f1f5f9; }
@media (max-width: 860px) {
  .pe-card { grid-template-columns: 1fr; }
  .pe-quando { align-items: flex-start; flex-direction: row; justify-content: space-between; width: 100%; }
  .pe-quando .dt { text-align: left; }
}
@media print {
  @page { size: A4 portrait; margin: 10mm 12mm; }
  body, html { width: 100% !important; height: auto !important; margin: 0 !important; padding: 0 !important; background: #fff !important; }
  body * { visibility: hidden !important; }
  #pe-impressao, #pe-impressao * { visibility: visible !important; }
  #pe-impressao { position: absolute !important; top: 0; left: 0; width: 100% !important; max-height: none !important; overflow: visible !important; box-shadow: none !important; padding: 0 !important; margin: 0 !important; background: #fff !important; }
  .no-print { display: none !important; }
}
`;

function SolicitacaoExames() {
  const navigate = useNavigate();
  const [pedidos, setPedidos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [periodo, setPeriodo] = useState(90);
  const [incluirSubstituidos, setIncluirSubstituidos] = useState(false);
  const [aberto, setAberto] = useState(null);

  const carregar = async () => {
    const token = localStorage.getItem("token");
    if (!token) return navigate("/login");
    try {
      setCarregando(true);
      setErro("");
      const res = await api.get("/atendimento-ia/pedidos-exames", {
        headers: { Authorization: `Bearer ${token}` },
        params: { dias: periodo, incluir_substituidos: incluirSubstituidos, limite: 300 },
      });
      setPedidos(res.data || []);
    } catch (error) {
      if (error.response?.status === 401) {
        localStorage.removeItem("token");
        return navigate("/login");
      }
      const d = error.response?.data?.detail;
      setErro(typeof d === "string" && d ? d : "Não foi possível carregar os pedidos de exames.");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { carregar(); }, [periodo, incluirSubstituidos]);

  const visiveis = useMemo(() => {
    const termo = semAcento(busca).trim();
    if (!termo) return pedidos;
    return pedidos.filter((p) => semAcento(
      `${p.animal_nome} ${p.animal_codigo} ${p.tutor_nome} ${p.consulta_codigo} ${(p.itens || []).map((i) => i.nome).join(" ")}`
    ).includes(termo));
  }, [busca, pedidos]);

  const totalExames = visiveis.reduce((s, p) => s + (p.itens || []).length, 0);
  const urgentes = visiveis.filter((p) => (p.itens || []).some((i) => i.prioridade === "URGENTE")).length;
  const pacientes = new Set(visiveis.map((p) => p.animal_id)).size;

  const imprimir = (p) => {
    const titulo = document.title;
    document.title = `Exames_${String(p.animal_nome || "Paciente").replace(/\s+/g, "_")}_${p.animal_codigo || ""}`;
    window.print();
    setTimeout(() => { document.title = titulo; }, 1000);
  };

  return (
    <Layout>
      <style>{CSS}</style>
      <div className="pe-root">
        <div className="pe-hero">
          <div className="pe-hero-top">
            <div className="pe-titulo">
              <div className="pe-icone"><MdScience size={28} /></div>
              <div>
                <h1>Pedidos de Exames</h1>
                <p>Todas as solicitações de exames feitas nos atendimentos. Consulte e reimprima a requisição.</p>
              </div>
            </div>
            <button type="button" className="pe-btn claro" onClick={carregar} disabled={carregando}>
              <MdRefresh size={18} /> {carregando ? "Atualizando..." : "Atualizar"}
            </button>
          </div>
          <div className="pe-stats">
            <div className="pe-stat"><b>{visiveis.length}</b><span>{visiveis.length === 1 ? "pedido" : "pedidos"}</span></div>
            <div className="pe-stat"><b>{totalExames}</b><span>exames solicitados</span></div>
            <div className="pe-stat"><b>{pacientes}</b><span>{pacientes === 1 ? "paciente" : "pacientes"}</span></div>
            <div className={`pe-stat ${urgentes > 0 ? "urg" : ""}`}><b>{urgentes}</b><span>com exame urgente</span></div>
          </div>
        </div>

        {erro && <div className="pe-erro"><MdErrorOutline size={20} /> {erro}</div>}

        <div className="pe-filtros">
          <div className="pe-busca">
            <MdSearch size={20} />
            <input className="pe-input" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por paciente, tutor, código ou exame..." />
          </div>
          <select className="pe-select" value={periodo} onChange={(e) => setPeriodo(Number(e.target.value))}>
            {PERIODOS.map((p) => <option key={p.valor} value={p.valor}>{p.rotulo}</option>)}
          </select>
          <label className="pe-check">
            <input type="checkbox" checked={incluirSubstituidos} onChange={(e) => setIncluirSubstituidos(e.target.checked)} />
            Mostrar pedidos substituídos
          </label>
        </div>

        {visiveis.length === 0 ? (
          <div className="pe-vazio">
            <div style={{ fontSize: 38 }}>🧪</div>
            <b style={{ display: "block", color: "#0f172a", fontSize: 16, margin: "4px 0" }}>{carregando ? "Carregando..." : "Nenhum pedido encontrado"}</b>
            {!carregando && "Ajuste a busca ou o período. Os pedidos são criados na tela de Atendimentos, pelo botão Exames."}
          </div>
        ) : (
          <div className="pe-lista">
            {visiveis.map((p) => {
              const { Icone, bg, cor } = estiloEspecie(p.especie);
              const { data, hora } = formatarDataHora(p.data);
              return (
                <div key={p.lote} className={`pe-card ${p.vigente ? "" : "antigo"}`}>
                  <div className="pe-pac">
                    <div className="pe-av" style={{ backgroundColor: bg }}><Icone size={24} color={cor} /></div>
                    <div style={{ minWidth: 0 }}>
                      <div className="pe-nome">{p.animal_nome || "Paciente"}</div>
                      <div className="pe-sub">
                        {p.animal_codigo && <span>{p.animal_codigo}</span>}
                        <span className="pe-cod">{p.consulta_codigo}</span>
                      </div>
                      <div className="pe-sub"><MdPerson size={14} color="#94a3b8" /> {p.tutor_nome || "Tutor não vinculado"}</div>
                    </div>
                  </div>

                  <div className="pe-chips">
                    {(p.itens || []).map((i, idx) => (
                      <span key={idx} className={`pe-chip ${i.prioridade === "URGENTE" ? "urg" : ""}`} title={i.justificativa || ""}>
                        {i.prioridade === "URGENTE" ? "⚡ " : ""}{i.nome}
                      </span>
                    ))}
                  </div>

                  <div className="pe-quando">
                    <div className="dt">{data}{hora ? ` · ${hora}` : ""}</div>
                    {!p.vigente && <span className="tag">Substituído</span>}
                    <button type="button" className="pe-btn azul" onClick={() => setAberto(p)}><MdPrint size={17} /> Ver / Imprimir</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {aberto && (
          <div className="pe-overlay no-print-bg" onMouseDown={(e) => { if (e.target === e.currentTarget) setAberto(null); }}>
            <div className="pe-modal" id="pe-impressao">
              <div className="pe-doc-topo">
                <h2>VetAssist AI — Clínica Veterinária</h2>
                <p>Requisição de Exames</p>
              </div>

              <div className="pe-doc-dados">
                <div><strong>Paciente:</strong> {aberto.animal_nome}{aberto.animal_codigo ? ` (${aberto.animal_codigo})` : ""}{aberto.especie ? ` · ${aberto.especie}` : ""}</div>
                <div><strong>Tutor:</strong> {aberto.tutor_nome || "-"}</div>
                <div><strong>Atendimento:</strong> {aberto.consulta_codigo}</div>
                <div><strong>Emissão:</strong> {formatarDataHora(aberto.data).data} {formatarDataHora(aberto.data).hora}</div>
              </div>

              <h3 style={{ margin: "0 0 10px", fontSize: 15, color: "#111827", borderBottom: "1px solid #e5e7eb", paddingBottom: 6 }}>🔬 Exames solicitados</h3>
              {(aberto.itens || []).map((i, idx) => (
                <div key={idx} className="pe-doc-exame">
                  <MdCheckCircle size={20} color="#0284c7" style={{ flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <b>{i.nome}{i.prioridade === "URGENTE" ? " — URGENTE" : ""}</b>
                    <small>{ROTULO_CATEGORIA[i.categoria] || i.categoria}{i.justificativa ? ` · ${i.justificativa}` : ""}</small>
                  </div>
                </div>
              ))}

              <div className="pe-doc-assina">
                <div style={{ borderTop: "1px solid #9ca3af", width: 260, margin: "0 auto 8px" }} />
                <div style={{ fontWeight: 700, color: "#111827", fontSize: 14 }}>Médico(a) Veterinário(a){aberto.veterinario_nome ? `: ${aberto.veterinario_nome}` : ""}</div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>{aberto.veterinario_crmv ? `CRMV ${aberto.veterinario_crmv}` : "CRMV Responsável"}</div>
              </div>

              <div className="pe-acoes-modal no-print">
                <button type="button" className="pe-btn cinza" onClick={() => setAberto(null)}><MdClose size={17} /> Fechar</button>
                <button type="button" className="pe-btn azul" onClick={() => imprimir(aberto)}><MdPrint size={17} /> Imprimir requisição (A4)</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

export default SolicitacaoExames;