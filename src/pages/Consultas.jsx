import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MdEvent, MdVisibility, MdPrint, MdPsychology, MdAutoAwesome, MdDelete, MdCampaign, MdAttachFile, MdMedicalServices, MdScience, MdAdd } from "react-icons/md";
import api from "../api/api";
import Layout from "../components/Layout";

// ---------- Referências vitais e alertas (mesmo padrão da Triagem) ----------
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
  return { nivel: "ok", texto: "Dentro do esperado" };
};

// Peso: faixa "20.40 - 34.00" dentro do texto de referência
const avaliarPeso = (valor, refTexto) => {
  const v = parseFloat(valor);
  const m = String(refTexto || "").match(/(\d+(?:[.,]\d+)?)\s*[-–]\s*(\d+(?:[.,]\d+)?)/);
  if (isNaN(v) || !m) return null;
  const min = parseFloat(m[1].replace(",", "."));
  const max = parseFloat(m[2].replace(",", "."));
  if (v < min || v > max) return { nivel: "atencao", texto: `Fora da faixa de referência (${min} - ${max} kg)` };
  return { nivel: "ok", texto: "Dentro do esperado" };
};

// TPC: referências como "Menos de 2 segundos" (limite superior) ou faixa "1 - 2"
const avaliarTPC = (valor, refTexto) => {
  const v = parseFloat(valor);
  const t = String(refTexto || "");
  if (isNaN(v)) return null;
  const limite = t.match(/(?:menos de|at[eé]|inferior a|<|≤)\s*(\d+(?:[.,]\d+)?)/i);
  if (limite) {
    const max = parseFloat(limite[1].replace(",", "."));
    return v <= max ? { nivel: "ok", texto: "Dentro do esperado" } : { nivel: "atencao", texto: `Acima do esperado (≤ ${max} s)` };
  }
  const faixa = t.match(/(\d+(?:[.,]\d+)?)\s*[-–]\s*(\d+(?:[.,]\d+)?)/);
  if (faixa) {
    const min = parseFloat(faixa[1].replace(",", "."));
    const max = parseFloat(faixa[2].replace(",", "."));
    return v >= min && v <= max ? { nivel: "ok", texto: "Dentro do esperado" } : { nivel: "atencao", texto: `Fora da faixa esperada (${min} - ${max} s)` };
  }
  return null;
};

const avaliarMucosas = (valor) =>
  /^normocorada/i.test(String(valor || "").trim())
    ? { nivel: "ok", texto: "Dentro do esperado" }
    : { nivel: "atencao", texto: "Mucosa alterada — avaliar" };

const CORES_ALERTA = {
  alto: { cor: "#b91c1c", borda: "#fca5a5", bg: "#fef2f2", icone: "🔴" },
  baixo: { cor: "#b91c1c", borda: "#fca5a5", bg: "#fef2f2", icone: "🔴" },
  atencao: { cor: "#b45309", borda: "#fcd34d", bg: "#fffbeb", icone: "⚠️" },
  ok: { cor: "#15803d", borda: "#86efac", bg: "#f0fdf4", icone: "✓" },
};

const ICONE_ALERTA = { alto: "↑", baixo: "↓", atencao: "!", ok: "✓" };

const renderAlertaSinal = (alerta) =>
  alerta ? (
    <span
      role="status"
      style={{
        display: "flex", alignItems: "flex-start", gap: "6px", marginTop: "8px",
        padding: "4px 8px", borderRadius: "6px", backgroundColor: "#ffffff",
        border: `1px solid ${CORES_ALERTA[alerta.nivel].borda}`,
        fontSize: "11px", lineHeight: 1.35, fontWeight: 600,
        color: CORES_ALERTA[alerta.nivel].cor,
      }}
    >
      <span aria-hidden="true" style={{ fontWeight: 800, fontSize: "13px", lineHeight: 1.1 }}>{ICONE_ALERTA[alerta.nivel]}</span>
      <span>{alerta.texto}</span>
    </span>
  ) : null;

const estiloRef = { fontSize: "11px", lineHeight: 1.35, color: "#0369a1", display: "block", marginTop: "6px" };

// Nome do tutor: tenta os nomes de campo mais comuns retornados por /animais/
const obterTutorAnimal = (a) => {
  if (!a) return "";
  const candidatos = [
    a.tutor_nome, a.nome_tutor, a.tutor?.nome, typeof a.tutor === "string" ? a.tutor : null,
    a.proprietario_nome, a.proprietario?.nome, typeof a.proprietario === "string" ? a.proprietario : null,
    a.dono_nome, a.cliente_nome, a.cliente?.nome,
  ];
  return String(candidatos.find((c) => c && String(c).trim()) || "").trim();
};

// ---------- Receita médica e solicitação de exames (sugeridas pela IA) ----------
const TIPO_USO_ROTULO = {
  HUMANO: "Uso Humano (Farmácia / Drogaria)",
  VETERINARIO: "Uso Veterinário (Pet Shop / Agropecuária)",
  CLINICA: "Uso Clínico (aplicação na clínica)",
  A_CONFIRMAR: "Disponibilidade a confirmar",
};
const TIPO_USO_COR = {
  HUMANO: { cor: "#0369a1", borda: "#7dd3fc", bg: "#f0f9ff", icone: "💊" },
  VETERINARIO: { cor: "#166534", borda: "#86efac", bg: "#f0fdf4", icone: "🐾" },
  CLINICA: { cor: "#6b21a8", borda: "#d8b4fe", bg: "#faf5ff", icone: "🏥" },
  A_CONFIRMAR: { cor: "#475569", borda: "#cbd5e1", bg: "#f8fafc", icone: "❔" },
};
const CATEGORIA_EXAME_ROTULO = { LABORATORIAL: "Exames laboratoriais", IMAGEM: "Exames de imagem", OUTRO: "Outros exames" };

// Título da janela de impressão = nome sugerido ao salvar em PDF. Ex.: "Receita Tody_PET-0040"
const tituloDocumento = (prefixo, animal, segundaVia = false) => {
  const limpo = (v) => String(v || "").replace(/[\\/:*?"<>|]+/g, "").trim();
  const partes = [limpo(animal?.nome), limpo(animal ? (animal.codigo || `PET-${animal.id}`) : "")].filter(Boolean);
  return `${prefixo} ${partes.join("_")}${segundaVia ? " (reimpressão)" : ""}`.trim();
};

// Possivelmente sujeitos a controle especial (Portaria SVS/MS 344/98). Mantenha em sincronia com
// POSSIVELMENTE_CONTROLADOS de routers/atendimento_ia.py. O veterinário pode marcar/desmarcar à mão.
const REGEX_CONTROLADOS = /(tramadol|morfina|metadona|fentanil|codeina|petidina|meperidina|buprenorfina|oxicodona|hidromorfona|remifentanil|sufentanil|alfentanil|tapentadol|cetamina|ketamina|tiletamina|zolazepam|diazepam|midazolam|clonazepam|alprazolam|lorazepam|clorazepato|fenobarbital|pentobarbital|amitriptilina|clomipramina|fluoxetina|sertralina|paroxetina|carbamazepina)/;
const semAcento = (v) => String(v || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const ehControlado = (i) =>
  typeof i.controladoManual === "boolean"
    ? i.controladoManual
    : Boolean(i.controlado) || REGEX_CONTROLADOS.test(semAcento(i.medicamento)) || /controle especial/i.test(i.observacoes || "");
// Dados da clínica (endereço, cidade, UF, telefone) lembrados neste navegador para a receita de controle especial
const CHAVE_CLINICA = "vetassist_clinica";
const lerClinicaSalva = () => {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE_CLINICA) || "{}");
    return salvo && typeof salvo === "object" ? salvo : {};
  } catch (e) {
    return {};
  }
};
// A quantidade a dispensar fica no campo `quantidade` e, depois de salva, dentro de `observacoes` ("Quantidade: 1 caixa.")
const extrairQuantidade = (i) => {
  const direta = String(i.quantidade || "").trim();
  if (direta) return direta;
  const m = String(i.observacoes || "").match(/Quantidade:\s*(.+?)\.(?:\s|$)/i);
  return m ? m[1].trim() : "";
};
// Observações sem as marcas que o sistema acrescenta (quantidade e "controle especial")
const observacaoVisivel = (i) =>
  String(i.observacoes || "")
    .replace(/Quantidade:\s*(.+?)\.(?:\s|$)/i, "")
    .replace(/Medicamento de controle especial\./i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
// Garante que o texto impresso/salvo diga que o item é controlado
const observacoesFinais = (i) => {
  const base = observacaoVisivel(i);
  if (!ehControlado(i)) return base;
  const qtd = extrairQuantidade(i);
  return [base, qtd ? `Quantidade: ${qtd}.` : "", "Medicamento de controle especial."].filter(Boolean).join(" ");
};

const novoId = () => Math.random().toString(36).slice(2, 10);

// Escapa texto antes de colocar no HTML da janela de impressão
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Mensagem de erro legível (o 422 do FastAPI pode vir como lista)
const mensagemApi = (error, padrao) => {
  const d = error?.response?.data?.detail;
  return typeof d === "string" && d ? d : padrao;
};

const CSS_IMPRESSAO = `
  *{box-sizing:border-box} body{font-family:Arial,Helvetica,sans-serif;color:#111827;margin:0;padding:32px 40px}
  h1{margin:0;text-align:center;font-size:22px;color:#1e1b4b} .sub{text-align:center;font-size:11px;font-weight:700;margin:6px 0 14px;letter-spacing:.3px}
  hr{border:0;border-top:2px solid #4f46e5;margin:0 0 16px}
  .pac{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;border:1px solid #e5e7eb;border-radius:8px;padding:12px 14px;font-size:13px;margin-bottom:20px}
  h2{text-align:center;font-size:16px;margin:0 0 14px}
  .item{text-align:center;padding:14px 0;border-bottom:1px dashed #d1d5db;page-break-inside:avoid}
  .nome{font-size:15px;font-weight:700;color:#4f46e5;margin-bottom:6px}
  .selo{display:inline-block;font-size:11px;font-weight:700;border:1px solid;border-radius:6px;padding:3px 9px;margin-bottom:8px}
  .linha{font-size:13px;margin:3px 0} .obs{margin:8px auto 0;max-width:620px;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:6px 10px;font-size:11px;color:#78350f}
  .geral{margin:18px 0 0;font-size:12px;color:#374151;white-space:pre-line}
  .grupo{font-size:13px;font-weight:700;color:#1e1b4b;border-bottom:1px solid #e5e7eb;margin:18px 0 8px;padding-bottom:4px}
  .ex{font-size:13px;margin:6px 0;padding-left:4px} .ex small{display:block;color:#4b5563;font-size:11px;margin-left:18px}
  .urg{color:#b91c1c;font-weight:700;font-size:11px}
  .assin{margin:70px auto 0;width:300px;text-align:center;border-top:1px solid #111827;padding-top:6px;font-size:13px;font-weight:700}
  .assin small{display:block;font-weight:400;font-size:12px;margin-top:2px}
  .quebra{page-break-after:always} .quebra:last-child{page-break-after:auto}
  .via{text-align:right;font-size:11px;font-weight:700;color:#374151;margin-bottom:6px}
  .ctrl{border:2px solid #b91c1c;color:#b91c1c;text-align:center;font-weight:700;font-size:13px;padding:6px;border-radius:6px;margin-bottom:10px;letter-spacing:.4px}
  .rc{font-size:13px;line-height:1.5}
  .rc .t{text-align:center;font-size:17px;margin:0 0 12px;padding-bottom:6px;border-bottom:1.5px solid #111}
  .rc .topo{display:flex;gap:14px;align-items:flex-start;margin-bottom:12px}
  .rc .caixa{border:1.5px solid #111;padding:8px 10px;line-height:1.9;flex:1.4}
  .rc .vias{font-size:12px;line-height:1.6;flex:1;padding-top:2px}
  .rc .vias .sel{font-weight:700}
  .rc .l2{margin:11px 0}
  .rc .v{display:inline-block;min-width:40px;border-bottom:1px solid #111;padding:0 6px;text-align:center}
  .rc .ri{display:flex;align-items:baseline;margin-top:12px;font-size:15px}
  .rc .ri .pt{flex:1;border-bottom:1px dotted #111;margin:0 8px}
  .rc .rp{margin:3px 0 0 4px;font-size:14px}
  .rc .assin2{display:inline-block;border-top:1px solid #111;padding-top:4px;margin-left:30px;min-width:270px;text-align:center;font-size:12px}
  .rc .base{display:flex;gap:10px;margin-top:44px;align-items:stretch}
  .rc .bx{border:1.5px solid #111;padding:8px 10px;font-size:12px;line-height:2.1}
  .rc .bx .v{text-align:left}
  .aviso{margin-top:28px;text-align:center;font-size:10px;color:#6b7280}
  @media print{body{padding:16px 20px}}
`;

function Consultas() {
  const navigate = useNavigate();
  const [consultas, setConsultas] = useState([]);
  const [animais, setAnimais] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [tutores, setTutores] = useState([]);
  const [consultaEditando, setConsultaEditando] = useState(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [consultaDetalhes, setConsultaDetalhes] = useState(null);

  const [abaAtiva, setAbaAtiva] = useState("ativos");
  const tituloPagina = "Atendimentos Clínicos";

  const [codigo, setCodigo] = useState("");
  const [animalId, setAnimalId] = useState("");
  const [usuarioId, setUsuarioId] = useState("");
  const [statusAtendimento, setStatusAtendimento] = useState("EM_ATENDIMENTO");
  const [queixaPrincipal, setQueixaPrincipal] = useState("");
  const [historicoClinico, setHistoricoClinico] = useState("");
  const [sintomas, setSintomas] = useState("");
  const [exameFisico, setExameFisico] = useState("");
  const [suspeitaDiagnostica, setSuspeitaDiagnostica] = useState(""); 
  const [pesoAtendimento, setPesoAtendimento] = useState("");
  const [idadeAtendimento, setIdadeAtendimento] = useState("");
  const [temperatura, setTemperatura] = useState("");
  const [frequenciaCardiaca, setFrequenciaCardiaca] = useState("");
  const [frequenciaRespiratoria, setFrequenciaRespiratoria] = useState("");
  
  const [tpcSegundos, setTpcSegundos] = useState("");
  const [mucosas, setMucosas] = useState("Normocoradas");
  const [observacoes, setObservacoes] = useState("");

  const [indicacaoCirurgia, setIndicacaoCirurgia] = useState(false);
  const [forcarCirurgia, setForcarCirurgia] = useState(false);
  const [justificativaCirurgica, setJustificativaCirurgica] = useState("");
  const [solicitarExamesPreventivos, setSolicitarExamesPreventivos] = useState(false);

  const [sugestoesCopiloto, setSugestoesCopiloto] = useState("");
  const [carregandoCopiloto, setCarregandoCopiloto] = useState(false);
  const [etapaProgressoIA, setEtapaProgressoIA] = useState("");
  const [arquivosExames, setArquivosExames] = useState([]);
  const [previewsExames, setPreviewsExames] = useState([]);

  const [refs, setRefs] = useState(null);
  const [buscandoRefs, setBuscandoRefs] = useState(false);

  // Receita médica
  const [modalReceita, setModalReceita] = useState(false);
  const [itensReceita, setItensReceita] = useState([]);
  const [alertasReceita, setAlertasReceita] = useState([]);
  const [obsReceita, setObsReceita] = useState("");
  const [pesoUsadoReceita, setPesoUsadoReceita] = useState(null);
  const [receitaConferida, setReceitaConferida] = useState(false);
  // Identificação do emitente (receita de controle especial). Nome/CRMV vêm do veterinário do
  // atendimento; endereço, cidade, UF e telefone da clínica ficam salvos neste navegador.
  const [emitente, setEmitente] = useState(() => ({
    nome: "", crmv: "", ufCrmv: "", endereco: "", cidade: "", ufCidade: "", telefone: "", ...lerClinicaSalva(),
  }));
  const [receitaSalva, setReceitaSalva] = useState(false);
  const [carregandoReceita, setCarregandoReceita] = useState(false);
  const [salvandoReceita, setSalvandoReceita] = useState(false);
  const [erroReceita, setErroReceita] = useState("");

  // Solicitação de exames
  const [modalExames, setModalExames] = useState(false);
  const [examesSugeridos, setExamesSugeridos] = useState([]);
  const [geradoExames, setGeradoExames] = useState(false);
  const [carregandoExames, setCarregandoExames] = useState(false);
  const [erroExames, setErroExames] = useState("");
  const [novoExame, setNovoExame] = useState("");
  const [salvandoExames, setSalvandoExames] = useState(false);
  const [examesSalvos, setExamesSalvos] = useState(false);

  // Histórico de receitas e exames do paciente
  const [modalHistorico, setModalHistorico] = useState(false);
  const [historicoAnimalId, setHistoricoAnimalId] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);
  const [erroHistorico, setErroHistorico] = useState("");

  const [busca, setBusca] = useState("");
  const [mensagemErro, setMensagemErro] = useState("");
  const [mensagemSucesso, setMensagemSucesso] = useState("");
  
  const [consultaParaExcluir, setConsultaParaExcluir] = useState(null);
  const [modalExclusaoAberto, setModalExclusaoAberto] = useState(false);

  useEffect(() => {
    carregarConsultas();
    carregarAnimais();
    carregarUsuarios();
    carregarTutores();
  }, []);

  useEffect(() => {
    let timer1, timer2;
    if (carregandoCopiloto) {
      setEtapaProgressoIA("Iniciando upload e leitura dos arquivos anexados...");
      timer1 = setTimeout(() => {
        setEtapaProgressoIA("Processando parâmetros vitais e laudos com o Copiloto Multimodal...");
      }, 2000);
      timer2 = setTimeout(() => {
        setEtapaProgressoIA("Sintetizando parecer clínico e hipótese diagnóstica...");
      }, 5000);
    } else {
      setEtapaProgressoIA("");
    }
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [carregandoCopiloto]);

  // Miniaturas dos exames anexados (imagens); libera a memória ao trocar/remover
  useEffect(() => {
    const urls = arquivosExames.map((f) => (f.type && f.type.startsWith("image/") ? URL.createObjectURL(f) : null));
    setPreviewsExames(urls);
    return () => urls.forEach((u) => u && URL.revokeObjectURL(u));
  }, [arquivosExames]);

  // Referências vitais já salvas na Biblioteca de parâmetros oficiais (leitura rápida, sem IA)
  useEffect(() => {
    if (!animalId) {
      setRefs(null);
      return;
    }
    let cancelado = false;
    const buscarReferenciasSalvas = async () => {
      setBuscandoRefs(true);
      try {
        const token = localStorage.getItem("token");
        const res = await api.get(`/triagem/referencias-salvas/${animalId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!cancelado) setRefs(res.data || null);
      } catch (err) {
        console.warn("Erro ao buscar referências salvas:", err);
        if (!cancelado) setRefs(null);
      } finally {
        if (!cancelado) setBuscandoRefs(false);
      }
    };
    buscarReferenciasSalvas();
    return () => { cancelado = true; };
  }, [animalId]);

  const tratarSessaoExpirada = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("perfil");
    navigate("/login");
  };

  const carregarConsultas = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return tratarSessaoExpirada();
      const response = await api.get("/consultas/", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setConsultas(response.data || []);
    } catch (error) {
      if (error.response?.status === 401) tratarSessaoExpirada();
      setConsultas([]);
    }
  };

  const carregarAnimais = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const response = await api.get("/animais/", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAnimais(response.data || []);
    } catch (error) {
      console.error("Erro ao carregar animais:", error);
    }
  };

  const carregarTutores = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const response = await api.get("/tutores/", { headers: { Authorization: `Bearer ${token}` } });
      setTutores(response.data || []);
    } catch (error) {
      console.error("Erro ao carregar tutores:", error);
    }
  };

  // O animal só traz tutor_id: o nome vem da lista de tutores
  const nomeDoTutor = (a) =>
    obterTutorAnimal(a) || (a ? String(tutores.find((t) => t.id === a.tutor_id)?.nome || "").trim() : "");

  const carregarUsuarios = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const response = await api.get("/usuarios/", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const apenasVets = (response.data || []).filter((u) => u.perfil === "VETERINARIO");
      setUsuarios(apenasVets);
    } catch (error) {
      console.error("Erro ao carregar usuários:", error);
    }
  };

  const chamarPaciente = async (consulta, e) => {
    e.stopPropagation();
    try {
      const token = localStorage.getItem("token");
      await api.put(`/consultas/${consulta.id}/chamar`, {}, { headers: { Authorization: `Bearer ${token}` } });
      setConsultas(prev => prev.map(item => item.id === consulta.id ? { ...item, status: "Chamando para Consulta" } : item));
      setMensagemSucesso(`📢 Chamando paciente no painel!`);
    } catch (err) {
      setMensagemErro("Erro ao emitir chamada para o paciente.");
    }
  };

  const iniciarAtendimentoVeterinario = async (consulta) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return tratarSessaoExpirada();
      const config = { headers: { Authorization: `Bearer ${token}` } };

      // Busca o registro atualizado e reenvia os campos já salvos junto com o novo status:
      // o PUT do backend sobrescreve com vazio o que não for enviado (ex.: exame físico).
      let atual = consulta;
      try {
        const respAtual = await api.get(`/consultas/${consulta.id}`, config);
        if (respAtual.data) atual = { ...consulta, ...respAtual.data };
      } catch (errAtual) {
        console.warn("Não foi possível recarregar a consulta; usando dados da lista.", errAtual);
      }
      consulta = atual;

      await api.put(`/consultas/${consulta.id}`, {
        status: "Em Atendimento",
        queixa_principal: consulta.queixa_principal ?? null,
        historico_clinico: consulta.historico_clinico ?? null,
        sintomas: consulta.sintomas ?? null,
        exame_fisico: consulta.exame_fisico ?? null,
        suspeita_diagnostica: consulta.suspeita_diagnostica ?? null,
        peso_atendimento: consulta.peso_atendimento ?? null,
        temperatura: consulta.temperatura ?? null,
        frequencia_cardiaca: consulta.frequencia_cardiaca ?? null,
        frequencia_respiratoria: consulta.frequencia_respiratoria ?? null,
        parecer_copiloto: consulta.parecer_copiloto ?? null,
        observacoes: consulta.observacoes ?? null,
        indicacao_cirurgia: consulta.indicacao_cirurgia ?? false,
        justificativa_cirurgica: consulta.justificativa_cirurgica ?? null,
      }, config);

      let dadosTriagem = {};
      try {
        const respTriagem = await api.get(`/triagem/consulta/${consulta.id}`, config);
        if (respTriagem.data) dadosTriagem = respTriagem.data;
      } catch (errTriagem) {
        console.warn("Nenhuma triagem vinculada.", errTriagem);
      }

      setCodigo(consulta.codigo || `CNS-${consulta.id}`);
      setAnimalId(consulta.animal_id || "");
      setQueixaPrincipal(consulta.queixa_principal || dadosTriagem?.queixa_principal || "");
      setExameFisico(consulta.exame_fisico || dadosTriagem?.exame_fisico || "");
      setSuspeitaDiagnostica(consulta.suspeita_diagnostica || "");
      setSugestoesCopiloto(consulta.parecer_copiloto || "");
      setTemperatura(dadosTriagem?.temperatura ?? consulta.temperatura ?? "");
      setFrequenciaCardiaca(dadosTriagem?.frequencia_cardiaca ?? consulta.frequencia_cardiaca ?? "");
      setFrequenciaRespiratoria(dadosTriagem?.frequencia_respiratoria ?? consulta.frequencia_respiratoria ?? "");
      setPesoAtendimento(dadosTriagem?.peso ?? consulta.peso_atendimento ?? "");
      setTpcSegundos(dadosTriagem?.tpc_segundos ?? consulta.tpc_segundos ?? "");
      setMucosas(dadosTriagem?.mucosas ?? consulta.mucosas ?? "Normocoradas");
      setStatusAtendimento("Em Atendimento");

      setConsultaEditando({ ...consulta, status: "Em Atendimento" });
      setMostrarFormulario(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
      carregarConsultas();
    } catch (error) {
      setMensagemErro(`❌ Erro ao iniciar atendimento: ${error.response?.data?.detail || error.message}`);
    }
  };

  const consultarCopilotoComAnexo = async () => {
    if (!queixaPrincipal || !queixaPrincipal.trim()) {
      setMensagemErro("🩺 Por favor, preencha a Queixa Principal antes de analisar.");
      return;
    }

    setCarregandoCopiloto(true);
    setMensagemErro("");
    try {
      const token = localStorage.getItem("token");
      const animalEncontrado = animais.find((a) => a.id === Number(animalId));

      const formData = new FormData();
      formData.append("queixa_principal", queixaPrincipal);
      if (animalId) formData.append("animal_id", animalId);
      formData.append("especie", animalEncontrado?.especie || "Não informada");
      formData.append("raca", animalEncontrado?.raca || "SRD");
      if (idadeAtendimento) formData.append("idade", `${idadeAtendimento} anos`);
      if (pesoAtendimento) formData.append("peso", `${pesoAtendimento} kg`);
      if (sintomas) formData.append("sintomas", sintomas);
      if (exameFisico) formData.append("exame_fisico", exameFisico);
      if (temperatura) formData.append("temperatura", temperatura);
      if (frequenciaCardiaca) formData.append("frequencia_cardiaca", frequenciaCardiaca);
      if (frequenciaRespiratoria) formData.append("frequencia_respiratoria", frequenciaRespiratoria);
      if (tpcSegundos) formData.append("tpc_segundos", tpcSegundos);
      if (mucosas) formData.append("mucosas", mucosas);
      formData.append("solicitar_exames_preventivos", solicitarExamesPreventivos ? "true" : "false");

      if (arquivosExames.length > 0) {
        for (let i = 0; i < arquivosExames.length; i++) {
          formData.append("files", arquivosExames[i]);
        }
      }

      const response = await api.post("/consultas/sugestoes-copiloto-multimodal", formData, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" },
      });

      let suspeitaPura = response.data.suspeita_diagnostica || "";
      if (suspeitaPura.includes("SUGESTÕES:") || suspeitaPura.includes("SUGESTOES:")) {
        suspeitaPura = suspeitaPura.split(/SUGESTÕES:|SUGESTOES:/i)[0].trim();
      }
      suspeitaPura = suspeitaPura.replace(/\*\*/g, "").trim();

      setSuspeitaDiagnostica(suspeitaPura);
      setSugestoesCopiloto(response.data.sugestoes || "");

      if (response.data.indicacao_cirurgia !== undefined) {
        setIndicacaoCirurgia(response.data.indicacao_cirurgia);
        setJustificativaCirurgica(response.data.justificativa_cirurgica || "");
      }
    } catch (error) {
      setSugestoesCopiloto(`⚠️ ${error.response?.data?.detail || "Erro ao analisar dados."}`);
    } finally {
      setCarregandoCopiloto(false);
    }
  };

  // ---------------- Receita médica e exames sugeridos pela IA ----------------
  const parecerDisponivel = Boolean(suspeitaDiagnostica.trim() || sugestoesCopiloto.trim());
  const botoesIADesabilitados = !animalId || !parecerDisponivel;
  const dicaBotoesIA = !animalId
    ? "Selecione o paciente"
    : !parecerDisponivel
      ? "Execute a análise do Copiloto Clínico primeiro: a sugestão parte do parecer da IA"
      : undefined;

  const montarContextoClinico = () => {
    const texto = (v, max) => (v && String(v).trim() ? String(v).trim().slice(0, max) : null);
    const pesoNum = pesoAtendimento !== "" ? Number(pesoAtendimento) : null;
    return {
      consulta_id: consultaEditando?.id ?? null,
      animal_id: animalId ? Number(animalId) : null,
      peso: pesoNum && pesoNum > 0 ? pesoNum : null,
      idade: idadeAtendimento ? `${idadeAtendimento} anos` : null,
      queixa_principal: texto(queixaPrincipal, 4000),
      sintomas: texto(sintomas, 4000),
      exame_fisico: texto(exameFisico, 4000),
      suspeita_diagnostica: texto(suspeitaDiagnostica, 1000),
      parecer_copiloto: texto(sugestoesCopiloto, 12000),
      temperatura: texto(temperatura, 20),
      frequencia_cardiaca: texto(frequenciaCardiaca, 20),
      frequencia_respiratoria: texto(frequenciaRespiratoria, 20),
      tpc_segundos: texto(tpcSegundos, 20),
      mucosas: texto(mucosas, 60),
      exames_anexados: arquivosExames.length > 0
        ? arquivosExames.map((f) => f.name).join(", ").slice(0, 1000)
        : texto(consultaEditando?.exames_anexados, 1000),
      solicitar_exames_preventivos: Boolean(solicitarExamesPreventivos),
    };
  };

  const gerarReceitaIA = async () => {
    setCarregandoReceita(true);
    setErroReceita("");
    setReceitaConferida(false);
    setReceitaSalva(false);
    try {
      const token = localStorage.getItem("token");
      const res = await api.post("/atendimento-ia/sugerir-receita", montarContextoClinico(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      setItensReceita((res.data.itens || []).map((i) => ({ ...i, _id: novoId() })));
      setAlertasReceita(res.data.alertas || []);
      setPesoUsadoReceita(res.data.peso_usado ?? null);
    } catch (error) {
      setErroReceita(mensagemApi(error, "Não foi possível gerar a sugestão de receita."));
    } finally {
      setCarregandoReceita(false);
    }
  };

  const alterarEmitente = (campo, valor) => {
    setEmitente((prev) => {
      const novo = { ...prev, [campo]: valor };
      try {
        const { nome, crmv, ...clinica } = novo; // nome/CRMV mudam de veterinário para veterinário
        localStorage.setItem(CHAVE_CLINICA, JSON.stringify(clinica));
      } catch (e) { /* sem armazenamento: segue sem salvar */ }
      return novo;
    });
  };

  const veterinarioDaConsulta = (usuarioId) => usuarios.find((u) => u.id === usuarioId);

  const abrirReceita = () => {
    const vet = veterinarioDaConsulta(consultaEditando?.usuario_id);
    if (vet) setEmitente((prev) => ({ ...prev, nome: vet.nome || prev.nome, crmv: vet.crmv || prev.crmv }));
    setModalReceita(true);
    // Reabrir não apaga o que o veterinário já editou; "Gerar novamente" refaz a sugestão.
    if (itensReceita.length === 0 && !carregandoReceita) gerarReceitaIA();
  };

  const alterarItemReceita = (id, campo, valor) => {
    setReceitaConferida(false);
    setReceitaSalva(false);
    setItensReceita((prev) => prev.map((i) => (i._id === id ? { ...i, [campo]: valor } : i)));
  };
  const removerItemReceita = (id) => {
    setReceitaConferida(false);
    setReceitaSalva(false);
    setItensReceita((prev) => prev.filter((i) => i._id !== id));
  };
  const adicionarItemReceita = () => {
    setReceitaConferida(false);
    setReceitaSalva(false);
    setItensReceita((prev) => [...prev, {
      _id: novoId(), medicamento: "", dosagem: "", frequencia: "", duracao: "",
      tipo_uso: "A_CONFIRMAR", observacoes: "", quantidade: "", controlado: false,
    }]);
  };

  const itensReceitaValidos = itensReceita.filter((i) => i.medicamento.trim());
  const pesoAtualNum = pesoAtendimento !== "" ? Number(pesoAtendimento) : null;
  const pesoMudouDesdeReceita = itensReceita.length > 0 && pesoAtualNum !== null && pesoUsadoReceita !== pesoAtualNum;

  const motivoBloqueioControlado = (() => {
    const ctrl = itensReceitaValidos.filter(ehControlado);
    if (ctrl.length === 0) return "";
    if (!emitente.nome.trim() || !emitente.crmv.trim()) return "Preencha nome e CRMV do emitente (receita de controle especial).";
    if (ctrl.some((i) => !extrairQuantidade(i))) return "Informe a quantidade de cada medicamento controlado (ex.: 1 caixa).";
    return "";
  })();

  const abrirJanelaImpressao = (titulo, corpoHtml) => {
    const janela = window.open("", "_blank", "width=860,height=900");
    if (!janela) {
      setMensagemErro("O navegador bloqueou a janela de impressão. Libere os pop-ups deste site e tente de novo.");
      return;
    }
    janela.document.write(
      `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(titulo)}</title><style>${CSS_IMPRESSAO}</style></head><body>${corpoHtml}</body></html>`
    );
    janela.document.close();
    janela.focus();
    setTimeout(() => janela.print(), 300);
  };

  // ctx permite imprimir dados de outro atendimento (2ª via do histórico)
  const cabecalhoImpressao = (titulo, ctx = {}) => {
    const a = ctx.animal !== undefined ? ctx.animal : animalSelecionado;
    const peso = ctx.peso !== undefined ? ctx.peso : pesoAtendimento;
    const emissao = ctx.emissao ? new Date(ctx.emissao) : new Date();
    const atendimento = ctx.atendimento !== undefined ? ctx.atendimento : codigo;
    const codigoPet = a ? (a.codigo || `PET-${a.id}`) : "";
    const pesoTxt = peso !== "" && peso !== null && peso !== undefined ? `${peso} kg` : "-";
    return `
      <h1>VetAssist AI — ${esc(titulo)}${ctx.segundaVia ? " (reimpressão)" : ""}</h1>
      <div class="sub">DOCUMENTO VÁLIDO SOMENTE COM ASSINATURA E CRMV DO MÉDICO-VETERINÁRIO</div><hr/>
      <div class="pac">
        <div><strong>Paciente:</strong> ${esc(a?.nome || "-")} (${esc(codigoPet)})<br/>
          <strong>Espécie/Raça:</strong> ${esc([a?.especie, a?.raca].filter(Boolean).join(" / ") || "-")}</div>
        <div><strong>Tutor:</strong> ${esc(nomeDoTutor(a) || "-")}<br/><strong>Peso:</strong> ${esc(pesoTxt)}</div>
        <div><strong>Emissão:</strong> ${esc(emissao.toLocaleDateString("pt-BR"))}<br/>
          <strong>Atendimento:</strong> ${esc(atendimento || "-")}</div>
      </div>`;
  };

  const rodapeAssinatura = `
    <div class="assin">Médico(a) Veterinário(a)<small>CRMV: ______________</small></div>`;

  // O histórico guarda o rótulo do tipo de uso; aqui volta para o código (cores do selo)
  const codigoTipoUso = (valor) =>
    TIPO_USO_ROTULO[valor] ? valor : (Object.keys(TIPO_USO_ROTULO).find((k) => TIPO_USO_ROTULO[k] === valor) || "A_CONFIRMAR");

  const imprimirReceitaDe = (itens, observacoes, ctx = {}) => {
    const validos = itens.filter((i) => String(i.medicamento || "").trim());
    if (validos.length === 0) return;
    const comuns = validos.filter((i) => !ehControlado(i));
    const controlados = validos.filter((i) => ehControlado(i));

    const renderItens = (lista) => lista.map((i, idx) => {
      const cod = codigoTipoUso(i.tipo_uso);
      const c = TIPO_USO_COR[cod];
      const obs = observacoesFinais(i);
      return `
        <div class="item">
          <div class="nome">${idx + 1}. ${esc(i.medicamento)}${ehControlado(i) ? ' <span class="urg">⚠ CONTROLADO</span>' : ""}</div>
          <div class="selo" style="color:${c.cor};border-color:${c.borda};background:${c.bg}">${c.icone} ${esc(TIPO_USO_ROTULO[cod])}</div>
          ${i.dosagem ? `<div class="linha"><strong>Dosagem:</strong> ${esc(i.dosagem)}</div>` : ""}
          ${i.frequencia ? `<div class="linha"><strong>Frequência:</strong> ${esc(i.frequencia)}</div>` : ""}
          ${i.duracao ? `<div class="linha"><strong>Duração:</strong> ${esc(i.duracao)}</div>` : ""}
          ${obs ? `<div class="obs">📌 <strong>Obs:</strong> ${esc(obs)}</div>` : ""}
        </div>`;
    }).join("");

    const documentoComum = (lista) => `
      <div class="quebra">
        ${cabecalhoImpressao("Receituário Veterinário", ctx)}
        <h2>💊 Medicamentos & Posologias</h2>${renderItens(lista)}
        ${String(observacoes || "").trim() ? `<div class="geral"><strong>Orientações gerais:</strong>\n${esc(observacoes)}</div>` : ""}
        ${rodapeAssinatura}
      </div>`;

    // Modelo de Receituário Veterinário de Controle Especial (1ª via farmácia/clínica; 2ª via proprietário)
    const documentoControlado = (lista, via) => {
      const em = ctx.emitente || emitente;
      const a = ctx.animal !== undefined ? ctx.animal : animalSelecionado;
      const pesoRef = ctx.peso !== undefined ? ctx.peso : pesoAtendimento;
      const emissao = ctx.emissao ? new Date(ctx.emissao) : new Date();
      const t = a ? (tutores.find((x) => x.id === a.tutor_id) || null) : null;
      const enderecoTutor = t
        ? [t.rua, t.complemento, t.bairro, [t.cidade, t.estado].filter(Boolean).join("/")].filter((x) => x && String(x).trim()).join(", ")
        : "";
      const idadeBruta = a?.idade ?? (ctx.animal === undefined ? idadeAtendimento : "");
      const idadeTxt = idadeBruta !== "" && idadeBruta != null ? (isNaN(Number(idadeBruta)) ? String(idadeBruta) : `${idadeBruta}a`) : "";
      const sexoTxt = { m: "M", f: "F" }[semAcento(a?.sexo).charAt(0)] || (a?.sexo ? "Indef." : "");
      const pesoTxt = pesoRef !== "" && pesoRef != null ? `${pesoRef}kg` : "";
      // largura mínima em px para os campos em branco ficarem com linha visível
      const v = (txt, w = 0) => `<span class="v"${w ? ` style="min-width:${w}px"` : ""}>${txt ? esc(txt) : "&nbsp;"}</span>`;
      const itens = lista.map((i) => {
        const linha = [i.dosagem, i.frequencia, i.duracao].filter((x) => x && String(x).trim()).join(" — ");
        const obs = observacaoVisivel(i);
        return `
          <div class="ri"><strong>${esc(i.medicamento)}</strong><span class="pt"></span><strong>${esc(extrairQuantidade(i) || "______")}</strong></div>
          ${linha ? `<div class="rp">${esc(linha)}</div>` : ""}
          ${obs ? `<div class="rp">${esc(obs)}</div>` : ""}`;
      }).join("");
      const viaTxt = (n, texto) => `<div class="${via === n ? "sel" : ""}">${n}ª Via: ${texto}${via === n ? " ◄" : ""}</div>`;
      return `
        <div class="quebra rc">
          <h3 class="t">RECEITUÁRIO VETERINÁRIO DE CONTROLE ESPECIAL</h3>
          <div class="topo">
            <div class="caixa">
              <strong>IDENTIFICAÇÃO DO EMITENTE:</strong><br/>
              Nome Completo: Méd. Vet. ${v(em.nome, 200)}<br/>
              CRMV: ${v(em.crmv, 90)} &nbsp; UF: ${v(em.ufCrmv, 34)}<br/>
              Endereço: ${v(em.endereco, 200)}<br/>
              Cidade: ${v(em.cidade, 110)} &nbsp; UF: ${v(em.ufCidade, 34)}<br/>
              Tel: ${v(em.telefone, 160)}
            </div>
            <div class="vias">${viaTxt(1, "Retenção na Farmácia/Clínica Veterinária.")}${viaTxt(2, "Proprietário.")}</div>
          </div>
          <div class="l2">Nome do Animal: ${v(a?.nome, 280)}</div>
          <div class="l2">Espécie: ${v(a?.especie, 90)} Idade: ${v(idadeTxt, 50)} Sexo: ${v(sexoTxt, 34)} Peso: ${v(pesoTxt, 60)} Raça: ${v(a?.raca, 120)}</div>
          <div class="l2">Nome do Proprietário: ${v(t?.nome || nomeDoTutor(a), 360)}</div>
          <div class="l2">Endereço: ${v(enderecoTutor, 440)}</div>
          <div class="l2" style="margin-top:18px"><strong>Prescrição:</strong></div>
          ${itens}
          ${String(observacoes || "").trim() ? `<div class="rp" style="margin-top:14px"><strong>Orientações:</strong> ${esc(observacoes)}</div>` : ""}
          <div class="l2" style="margin-top:64px">Data: ${v(emissao.toLocaleDateString("pt-BR"), 100)}
            <span class="assin2">Assinatura do Médico Veterinário/Carimbo</span></div>
          <div class="base">
            <div class="bx" style="flex:1.3">
              <strong>IDENTIFICAÇÃO DO COMPRADOR:</strong><br/>
              Nome: ${v("", 230)}<br/>RG: ${v("", 110)} Órgão Emissor: ${v("", 80)}<br/>
              Endereço: ${v("", 220)}<br/>Cidade: ${v("", 120)} UF: ${v("", 34)}<br/>
              Tel: ${v("", 110)} CPF: ${v("", 110)}
            </div>
            <div class="bx" style="flex:1">
              <strong>IDENTIFICAÇÃO DO FORNECEDOR:</strong><br/><br/><br/>
              ${v("", 190)} Data: ${v("", 70)}<br/>
              Assinatura do Farmacêutico/<br/>Médico Veterinário
            </div>
          </div>
        </div>`;
    };

    // Controlados saem em documento separado e em 2 vias (1ª farmácia/clínica; 2ª proprietário)
    if (controlados.length > 0) {
      const em = ctx.emitente || emitente;
      if (!String(em.nome || "").trim() || !String(em.crmv || "").trim()) {
        window.alert("Receita controlada: informe nome e CRMV do veterinário emitente (campo na tela da receita ou no cadastro do usuário).");
        return;
      }
    }
    const partes = [];
    if (comuns.length > 0) partes.push(documentoComum(comuns));
    if (controlados.length > 0) {
      partes.push(documentoControlado(controlados, 1));
      partes.push(documentoControlado(controlados, 2));
    }
    abrirJanelaImpressao(
      tituloDocumento("Receita", ctx.animal !== undefined ? ctx.animal : animalSelecionado, ctx.segundaVia),
      partes.join("")
    );
  };

  const imprimirReceita = () => imprimirReceitaDe(itensReceitaValidos, obsReceita);

  const salvarReceitaNoProntuario = async () => {
    if (!consultaEditando?.id || itensReceitaValidos.length === 0) return;
    setSalvandoReceita(true);
    setErroReceita("");
    try {
      const token = localStorage.getItem("token");
      await api.post("/atendimento-ia/receita", {
        consulta_id: consultaEditando.id,
        observacoes: obsReceita.trim() || null,
        itens: itensReceitaValidos.map((i) => ({
          medicamento: i.medicamento.trim(),
          dosagem: i.dosagem || null,
          frequencia: i.frequencia || null,
          duracao: i.duracao || null,
          tipo_uso: TIPO_USO_ROTULO[i.tipo_uso] || null,
          observacoes: observacoesFinais(i) || null,
        })),
      }, { headers: { Authorization: `Bearer ${token}` } });
      setReceitaSalva(true);
      setMensagemSucesso("✅ Receita salva no prontuário!");
    } catch (error) {
      setErroReceita(mensagemApi(error, "Não foi possível salvar a receita."));
    } finally {
      setSalvandoReceita(false);
    }
  };

  const gerarExamesIA = async () => {
    setCarregandoExames(true);
    setErroExames("");
    try {
      const token = localStorage.getItem("token");
      const res = await api.post("/atendimento-ia/sugerir-exames", montarContextoClinico(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      setExamesSugeridos((res.data.exames || []).map((e) => ({ ...e, _id: novoId(), selecionado: true })));
      setGeradoExames(true);
    } catch (error) {
      setErroExames(mensagemApi(error, "Não foi possível gerar a sugestão de exames."));
    } finally {
      setCarregandoExames(false);
    }
  };

  const abrirExames = () => {
    setModalExames(true);
    if (!geradoExames && !carregandoExames) gerarExamesIA();
  };

  const alternarExame = (id) => { setExamesSalvos(false); setExamesSugeridos((prev) => prev.map((e) => (e._id === id ? { ...e, selecionado: !e.selecionado } : e))); };
  const removerExame = (id) => { setExamesSalvos(false); setExamesSugeridos((prev) => prev.filter((e) => e._id !== id)); };
  const adicionarExameManual = () => {
    const nome = novoExame.trim();
    if (!nome) return;
    setExamesSalvos(false);
    setExamesSugeridos((prev) => [...prev, { _id: novoId(), nome, categoria: "OUTRO", prioridade: "ROTINA", justificativa: "", selecionado: true }]);
    setNovoExame("");
  };

  const examesSelecionados = examesSugeridos.filter((e) => e.selecionado);

  const imprimirExamesDe = (lista, suspeita, ctx = {}) => {
    if (lista.length === 0) return;
    const grupos = Object.keys(CATEGORIA_EXAME_ROTULO)
      .map((cat) => {
        const doGrupo = lista.filter((e) => e.categoria === cat);
        if (doGrupo.length === 0) return "";
        return `<div class="grupo">${esc(CATEGORIA_EXAME_ROTULO[cat])}</div>` + doGrupo.map((e) => `
          <div class="ex">☐ <strong>${esc(e.nome)}</strong> ${e.prioridade === "URGENTE" ? '<span class="urg">· URGENTE</span>' : ""}
            ${e.justificativa ? `<small>${esc(e.justificativa)}</small>` : ""}</div>`).join("");
      }).join("");
    abrirJanelaImpressao(
      tituloDocumento("Exames", ctx.animal !== undefined ? ctx.animal : animalSelecionado, ctx.segundaVia),
      `${cabecalhoImpressao("Solicitação de Exames", ctx)}
       ${String(suspeita || "").trim() ? `<div class="linha" style="margin-bottom:6px"><strong>Suspeita clínica:</strong> ${esc(suspeita)}</div>` : ""}
       <h2>🔬 Exames solicitados</h2>${grupos}
       ${rodapeAssinatura}`
    );
  };

  const imprimirExames = () => imprimirExamesDe(examesSelecionados, suspeitaDiagnostica);

  const salvarExamesNoProntuario = async () => {
    if (!consultaEditando?.id || examesSelecionados.length === 0) return;
    setSalvandoExames(true);
    setErroExames("");
    try {
      const token = localStorage.getItem("token");
      await api.post("/atendimento-ia/exames", {
        consulta_id: consultaEditando.id,
        exames: examesSelecionados.map((e) => ({
          nome: e.nome, categoria: e.categoria, prioridade: e.prioridade, justificativa: e.justificativa || null,
        })),
      }, { headers: { Authorization: `Bearer ${token}` } });
      setExamesSalvos(true);
      setMensagemSucesso("✅ Solicitação de exames salva no prontuário!");
    } catch (error) {
      setErroExames(mensagemApi(error, "Não foi possível salvar a solicitação de exames."));
    } finally {
      setSalvandoExames(false);
    }
  };

  // ---------------- Histórico do paciente ----------------
  const abrirHistorico = async (idAnimal) => {
    if (!idAnimal) return;
    setHistoricoAnimalId(Number(idAnimal));
    setModalHistorico(true);
    setHistorico([]);
    setErroHistorico("");
    setCarregandoHistorico(true);
    try {
      const token = localStorage.getItem("token");
      const res = await api.get(`/atendimento-ia/historico/${idAnimal}`, { headers: { Authorization: `Bearer ${token}` } });
      setHistorico(res.data || []);
    } catch (error) {
      setErroHistorico(mensagemApi(error, "Não foi possível carregar o histórico."));
    } finally {
      setCarregandoHistorico(false);
    }
  };

  const animalDoHistorico = animais.find((a) => a.id === historicoAnimalId);
  const formatarDataHora = (iso) => {
    const d = iso ? new Date(String(iso).replace(" ", "T")) : null;
    return d && !isNaN(d) ? d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "-";
  };
  const ctx2aVia = (bloco, data) => ({
    animal: animalDoHistorico || null, peso: bloco.peso_atendimento ?? "", emissao: data, atendimento: bloco.codigo, segundaVia: true,
    emitente: (() => {
      const vet = veterinarioDaConsulta(bloco.usuario_id);
      return { ...emitente, nome: vet?.nome || emitente.nome, crmv: vet?.crmv || emitente.crmv };
    })(),
  });

  const limparFormulario = () => {
    setConsultaEditando(null);
    setCodigo("");
    setAnimalId("");
    setUsuarioId("");
    setStatusAtendimento("EM_ATENDIMENTO");
    setQueixaPrincipal("");
    setHistoricoClinico("");
    setSintomas("");
    setExameFisico("");
    setSuspeitaDiagnostica("");
    setPesoAtendimento("");
    setIdadeAtendimento("");
    setTemperatura("");
    setFrequenciaCardiaca("");
    setFrequenciaRespiratoria("");
    setTpcSegundos("");
    setMucosas("Normocoradas");
    setObservacoes("");
    setIndicacaoCirurgia(false);
    setForcarCirurgia(false);
    setJustificativaCirurgica("");
    setSolicitarExamesPreventivos(false);
    setSugestoesCopiloto("");
    setArquivosExames([]);
    setRefs(null);
    setMensagemErro("");
    setModalReceita(false);
    setItensReceita([]);
    setAlertasReceita([]);
    setObsReceita("");
    setPesoUsadoReceita(null);
    setReceitaConferida(false);
    setReceitaSalva(false);
    setErroReceita("");
    setModalExames(false);
    setExamesSugeridos([]);
    setGeradoExames(false);
    setErroExames("");
    setNovoExame("");
    setExamesSalvos(false);
    setModalHistorico(false);
    setHistorico([]);
  };

  const salvarConsulta = async () => {
    try {
      setMensagemErro("");
      setMensagemSucesso("");

      if (!animalId) {
        setMensagemErro("🩺 Selecione o paciente (animal).");
        return;
      }

      const token = localStorage.getItem("token");
      if (!token) return tratarSessaoExpirada();
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      const cirurgiaFinal = forcarCirurgia || indicacaoCirurgia;
      let statusFinal = cirurgiaFinal ? "Aguardando Cirurgia" : statusAtendimento;

      const parecerCompletoIA = [
        suspeitaDiagnostica ? `Suspeita Diagnóstica: ${suspeitaDiagnostica}` : "",
        sugestoesCopiloto ? `Sugestões Clínicas:\n${sugestoesCopiloto}` : ""
      ].filter(Boolean).join("\n\n");

      const novaConsulta = {
        codigo: codigo || null,
        animal_id: Number(animalId),
        usuario_id: usuarioId ? Number(usuarioId) : null,
        status: statusFinal,
        queixa_principal: queixaPrincipal || "Consulta clínica",
        historico_clinico: historicoClinico || null,
        sintomas: sintomas || null,
        exame_fisico: exameFisico || null,
        suspeita_diagnostica: suspeitaDiagnostica || null,
        peso_atendimento: pesoAtendimento !== "" ? Number(pesoAtendimento) : null,
        temperatura: temperatura !== "" ? Number(temperatura) : null,
        frequencia_cardiaca: frequenciaCardiaca !== "" ? Number(frequenciaCardiaca) : null,
        frequencia_respiratoria: frequenciaRespiratoria !== "" ? Number(frequenciaRespiratoria) : null,
        tpc_segundos: tpcSegundos !== "" ? Number(tpcSegundos) : null,
        mucosas: mucosas || "Normocoradas",
        parecer_copiloto: parecerCompletoIA || null,
        exames_anexados: arquivosExames.length > 0 ? arquivosExames.map(f => f.name).join(", ") : null,
        observacoes: observacoes || null,
        indicacao_cirurgia: Boolean(cirurgiaFinal),
        justificativa_cirurgica: justificativaCirurgica || null,
        solicitar_exames_preventivos: Boolean(solicitarExamesPreventivos)
      };

      if (consultaEditando) {
        await api.put(`/consultas/${consultaEditando.id}`, novaConsulta, config);
      } else {
        await api.post("/consultas/", novaConsulta, config);
      }

      limparFormulario();
      setMostrarFormulario(false);
      carregarConsultas();
      setMensagemSucesso("✅ Atendimento clínico salvo com sucesso!");
    } catch (error) {
      setMensagemErro(`❌ ${error.response?.data?.detail || error.message}`);
    }
  };

  const deletarConsulta = async () => {
    if (!consultaParaExcluir) return;
    try {
      const token = localStorage.getItem("token");
      await api.delete(`/consultas/${consultaParaExcluir.id}`, { headers: { Authorization: `Bearer ${token}` } });
      setMensagemSucesso("✅ Atendimento excluído com sucesso!");
      setConsultaParaExcluir(null);
      setModalExclusaoAberto(false);
      carregarConsultas();
    } catch (error) {
      setMensagemErro(`❌ Erro ao excluir: ${error.response?.data?.detail || error.message}`);
      setConsultaParaExcluir(null);
      setModalExclusaoAberto(false);
    }
  };

  const obterNomeAnimal = (id) => {
    const a = animais.find((item) => item.id === id);
    return a ? `${a.nome} (${a.codigo || `PET-${a.id}`})` : `-`;
  };

  const obterPesoFormatado = (c) => {
    const val = c.peso_atendimento ?? c.peso ?? (animais.find(a => a.id === c.animal_id)?.peso);
    return val !== undefined && val !== null && val !== "" ? `${val} kg` : "-";
  };

  const renderBadgeTemperatura = (temp) => {
    if (!temp && temp !== 0) return "-";
    const valor = Number(temp);
    if (isNaN(valor)) return "-";
    if (valor >= 39.3) return <span style={{ color: "#991b1b", fontWeight: "bold" }}>🔥 {valor} °C (Febre)</span>;
    if (valor < 37.5) return <span style={{ color: "#0369a1", fontWeight: "bold" }}>❄️ {valor} °C (Baixa)</span>;
    return <span style={{ color: "#166534", fontWeight: "600" }}>{valor} °C</span>;
  };

  const renderBadgeStatus = (st) => {
    const statusVal = st || "EM_ATENDIMENTO";
    const configs = {
      EM_ATENDIMENTO: { bg: "#e0e7ff", color: "#3730a3", label: "💉 Em Atendimento" },
      "Em Atendimento": { bg: "#e0e7ff", color: "#3730a3", label: "💉 Em Atendimento" },
      "Aguardando Consulta (Fila Vet)": { bg: "#e0e7ff", color: "#3730a3", label: "🩺 Pronto para Consulta" },
      "Chamando para Consulta": { bg: "#fee2e2", color: "#991b1b", label: "📢 Chamando..." },
      FINALIZADO: { bg: "#dcfce7", color: "#166534", label: "✅ Finalizado" },
      "Finalizado": { bg: "#dcfce7", color: "#166534", label: "✅ Finalizado" },
      CANCELADO: { bg: "#fee2e2", color: "#991b1b", label: "❌ Cancelado" }
    };
    const conf = configs[statusVal] || configs.EM_ATENDIMENTO;
    return <span style={{ backgroundColor: conf.bg, color: conf.color, padding: "4px 10px", borderRadius: "999px", fontSize: "12px", fontWeight: "600" }}>{conf.label}</span>;
  };

  const renderizarTextoFormatadoIA = (textoBruto) => {
    if (!textoBruto) return null;

    let textoLimpo = textoBruto
      .replace(/SUSPEITA:.*/gi, "")
      .replace(/SUGESTOES:.*/gi, "")
      .replace(/Suspeita Diagnóstica:.*/gi, "")
      .replace(/Sugestões Clínicas:.*/gi, "")
      .trim();

    const linhasBrutas = textoLimpo.split("\n");
    let linhasProcessadas = [];

    if (linhasBrutas.length <= 1 && textoLimpo.length > 80) {
      const fragmentos = textoLimpo.split(/(?=[A-Z][a-zà-ú\s]+:|-|\u2022)/);
      linhasProcessadas = fragmentos.length > 1 ? fragmentos : [textoLimpo];
    } else {
      linhasProcessadas = linhasBrutas.filter(l => l.trim() !== "");
    }

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "6px", textAlign: "left" }}>
        {linhasProcessadas.map((linha, idx) => {
          let linhaTrim = linha.replace(/\*\*/g, "").trim();
          if (!linhaTrim) return null;

          const ehTituloSecao = linhaTrim.endsWith(":") || (linhaTrim.startsWith("-") && linhaTrim.length < 40 && !linhaTrim.includes(".")) || (linhaTrim.match(/^[A-ZÀ-Ú][a-za-zà-ú\s]+$/) && linhaTrim.length < 35);

          if (ehTituloSecao) {
            const tituloLimpo = linhaTrim.replace(/^- /, "").replace(/:$/, "").trim();
            return (
              <div key={idx} style={{ fontWeight: "bold", color: "#166534", fontSize: "14px", marginTop: "12px", marginBottom: "4px", textAlign: "left" }}>
                {tituloLimpo}:
              </div>
            );
          }

          const textoLimpoItem = linhaTrim.replace(/^- /, "").replace(/^[•\-\*]\s*/, "").trim();

          return (
            <div key={idx} style={{ display: "flex", gap: "8px", fontSize: "13px", color: "#334155", lineHeight: "1.5", textAlign: "left", paddingLeft: "8px" }}>
              <span style={{ color: "#166534", fontWeight: "bold" }}>•</span>
              <span style={{ flex: 1, textAlign: "left" }}>{textoLimpoItem}</span>
            </div>
          );
        })}
      </div>
    );
  };

  const consultasFiltradas = consultas.filter((c) => {
    const statusVal = c.status || "";
    const ehFinalizado = ["FINALIZADO", "CONCLUIDA", "Concluída", "CANCELADO", "Finalizado", "Cancelado"].includes(statusVal);
    if (abaAtiva === "ativos" && ehFinalizado) return false;
    if (abaAtiva === "finalizados" && !ehFinalizado) return false;

    const termo = busca.toLowerCase();
    const cod = (c.codigo || `CNS-${String(c.id).padStart(4, "0")}`).toLowerCase();
    const nomeA = obterNomeAnimal(c.animal_id).toLowerCase();
    return cod.includes(termo) || nomeA.includes(termo);
  });

  const estiloInput = { width: "100%", height: "42px", padding: "0 12px", border: "1px solid #d1d5db", borderRadius: "8px", fontSize: "14px", outline: "none", backgroundColor: "#ffffff", boxSizing: "border-box" };
  const estiloLabel = { display: "block", fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "6px" };

  const estiloAlerta = (alerta) =>
    alerta?.nivel === "ok"
      ? { ...estiloInput, border: `1px solid ${CORES_ALERTA.ok.borda}`, backgroundColor: "#ffffff", color: "#14532d", fontWeight: "600" }
      : alerta
      ? { ...estiloInput, border: `1px solid ${CORES_ALERTA[alerta.nivel].borda}`, backgroundColor: CORES_ALERTA[alerta.nivel].bg, color: CORES_ALERTA[alerta.nivel].cor, fontWeight: "700" }
      : estiloInput;

  const refTxt = (campo) =>
    buscandoRefs ? "Buscando referência..." :
    !animalId ? "Selecione o paciente..." :
    refs ? refs[campo] : "Referência indisponível. Consulte o veterinário";

  const alertaTemp = avaliarSinal(temperatura, refs?.temperatura, "°C", " — reavaliar após repouso");
  const alertaFC = avaliarSinal(frequenciaCardiaca, refs?.fc, "bpm");
  const alertaFR = avaliarSinal(frequenciaRespiratoria, refs?.fr, "ir/min");
  const alertaPeso = avaliarPeso(pesoAtendimento, refs?.peso_ref);
  const alertaTPC = avaliarTPC(tpcSegundos, refs?.tpc);
  const alertaMucosas = avaliarMucosas(mucosas);

  const temIndicacaoReal = indicacaoCirurgia || forcarCirurgia;

  const estiloOverlay = { position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1100, padding: "20px" };
  const estiloCaixaModal = { backgroundColor: "#ffffff", padding: "24px", borderRadius: "12px", maxWidth: "820px", width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)" };

  const renderCampoEmitente = (rotulo, chave, extra = {}) => (
    <div style={{ minWidth: 0, ...extra }}>
      <label htmlFor={`em-${chave}`} style={{ ...estiloLabel, fontSize: "12px", marginBottom: "4px" }}>{rotulo}</label>
      <input id={`em-${chave}`} type="text" value={emitente[chave] || ""} onChange={(e) => alterarEmitente(chave, e.target.value)} style={{ ...estiloInput, height: "36px", fontSize: "13px" }} />
    </div>
  );
  const impressaoBloqueada = !receitaConferida || itensReceitaValidos.length === 0 || Boolean(motivoBloqueioControlado);

  const estiloPainel = { border: "1px solid #e5e7eb", borderRadius: "10px", padding: "16px", backgroundColor: "#ffffff", minWidth: 0 };
  const estiloTituloPainel = { margin: "0 0 14px 0", color: "#111827", fontSize: "15px", fontWeight: 700 };
  const estiloLabelVital = { display: "block", fontSize: "12px", fontWeight: "600", color: "#374151", marginBottom: "6px" };
  const estiloInputVital = { ...estiloInput, height: "38px" };
  const estiloAlertaVital = (alerta) => ({ ...estiloAlerta(alerta), height: "38px" });

  const renderCardVital = (id, rotulo, campo, referencia, alerta) => (
    <div
      style={{
        border: `1px solid ${alerta ? CORES_ALERTA[alerta.nivel].borda : "#e5e7eb"}`,
        backgroundColor: alerta ? CORES_ALERTA[alerta.nivel].bg : "#f8fafc",
        borderRadius: "10px", padding: "10px 12px", minWidth: 0,
      }}
    >
      <label htmlFor={id} style={estiloLabelVital}>{rotulo}</label>
      {campo}
      <span style={estiloRef}>{referencia}</span>
      {renderAlertaSinal(alerta)}
    </div>
  );

  const animalSelecionado = animais.find((a) => a.id === Number(animalId));
  const rotuloPaciente = animalSelecionado
    ? [animalSelecionado.codigo || `PET-${animalSelecionado.id}`, animalSelecionado.nome, animalSelecionado.raca, nomeDoTutor(animalSelecionado)]
        .filter(Boolean)
        .join(" - ")
    : animalId ? "Carregando paciente..." : "Nenhum paciente selecionado";

  const refsPendentes = Boolean(animalId && refs?.fonte_ref && /pendente/i.test(refs.fonte_ref));
  const analiseDesabilitada = carregandoCopiloto || !queixaPrincipal.trim();

  const removerArquivoExame = (idx) => setArquivosExames((prev) => prev.filter((_, i) => i !== idx));

  const tituloCirurgia = indicacaoCirurgia
    ? "Indicação cirúrgica detectada pela IA."
    : forcarCirurgia
      ? "Indicação cirúrgica definida manualmente."
      : "Sem indicação cirúrgica automática detectada.";
  const detalheCirurgia = justificativaCirurgica
    || (temIndicacaoReal
      ? "Ao salvar, o status do atendimento passa para “Aguardando Cirurgia”."
      : "Paciente sem indicação cirúrgica urgente no momento.");

  return (
    <Layout>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h1 style={{ display: "flex", alignItems: "center", gap: "12px", margin: 0, fontSize: "26px", color: "#1e1b4b" }}>
          <MdEvent color="#4f46e5" size={38} /> {tituloPagina}
        </h1>
      </div>

      {mensagemSucesso && <div style={{ backgroundColor: "#dcfce7", color: "#166534", padding: "12px", borderRadius: "8px", marginBottom: "15px", fontWeight: "500" }}>{mensagemSucesso}</div>}
      {mensagemErro && <div style={{ backgroundColor: "#fee2e2", color: "#991b1b", padding: "12px", borderRadius: "8px", marginBottom: "15px", fontWeight: "500" }}>{mensagemErro}</div>}

      {mostrarFormulario && (
        <div className="cns-form" style={{ backgroundColor: "#ffffff", padding: "24px", borderRadius: "12px", marginBottom: "25px", border: "1px solid #e5e7eb" }}>
          <style>{`
            @keyframes spin { to { transform: rotate(360deg); } }
            .cns-topo { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); gap: 20px; align-items: stretch; margin-bottom: 20px; }
            .cns-vitais { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
            .cns-ia-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; }
            .cns-form input:focus-visible,
            .cns-form select:focus-visible,
            .cns-form textarea:focus-visible { border-color: #4f46e5 !important; box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.3) !important; }
            .cns-form button:focus-visible { outline: 2px solid #4f46e5; outline-offset: 2px; }
            @media (max-width: 1100px) { .cns-topo { grid-template-columns: minmax(0, 1fr); } }
            @media (max-width: 720px) { .cns-ia-grid { grid-template-columns: minmax(0, 1fr); } }
          `}</style>

          {/* LINHA SUPERIOR: SINAIS VITAIS (esquerda) | ANOTAÇÕES CLÍNICAS (direita) */}
          <div className="cns-topo">
            <section style={estiloPainel} aria-label="Paciente e sinais vitais">
              <h3 style={estiloTituloPainel}>Paciente e sinais vitais</h3>

              <div style={{ display: "grid", gridTemplateColumns: "minmax(110px, 1fr) minmax(0, 2fr)", gap: "12px", marginBottom: "14px" }}>
                <div>
                  <label htmlFor="cns-codigo" style={estiloLabel}>Código</label>
                  <input id="cns-codigo" type="text" value={codigo} onChange={(e) => setCodigo(e.target.value)} style={{ ...estiloInput, backgroundColor: "#f9fafb" }} />
                </div>
                <div>
                  <div id="cns-paciente-rotulo" style={estiloLabel}>Paciente</div>
                  <div
                    role="textbox"
                    aria-readonly="true"
                    aria-labelledby="cns-paciente-rotulo"
                    style={{ ...estiloInput, height: "auto", minHeight: "42px", display: "flex", alignItems: "center", padding: "8px 12px", backgroundColor: "#f9fafb", color: "#111827", fontWeight: 600, lineHeight: 1.35, cursor: "default" }}
                  >
                    {rotuloPaciente}
                  </div>
                </div>
              </div>

              <div className="cns-vitais">
                {renderCardVital(
                  "cns-peso", "Peso atual (kg)",
                  <input id="cns-peso" type="number" step="0.1" value={pesoAtendimento} onChange={(e) => setPesoAtendimento(e.target.value)} style={estiloAlertaVital(alertaPeso)} />,
                  refTxt("peso_ref"), alertaPeso
                )}
                {renderCardVital(
                  "cns-temp", "Temperatura (°C)",
                  <input id="cns-temp" type="number" step="0.1" value={temperatura} onChange={(e) => setTemperatura(e.target.value)} style={estiloAlertaVital(alertaTemp)} />,
                  refTxt("temperatura"), alertaTemp
                )}
                {renderCardVital(
                  "cns-fc", "Freq. cardíaca (bpm)",
                  <input id="cns-fc" type="number" value={frequenciaCardiaca} onChange={(e) => setFrequenciaCardiaca(e.target.value)} style={estiloAlertaVital(alertaFC)} />,
                  refTxt("fc"), alertaFC
                )}
                {renderCardVital(
                  "cns-fr", "Freq. respiratória (mpm)",
                  <input id="cns-fr" type="number" value={frequenciaRespiratoria} onChange={(e) => setFrequenciaRespiratoria(e.target.value)} style={estiloAlertaVital(alertaFR)} />,
                  refTxt("fr"), alertaFR
                )}
                {renderCardVital(
                  "cns-tpc", "TPC (segundos)",
                  <input id="cns-tpc" type="number" value={tpcSegundos} onChange={(e) => setTpcSegundos(e.target.value)} style={estiloAlertaVital(alertaTPC)} />,
                  refTxt("tpc"), alertaTPC
                )}
                {renderCardVital(
                  "cns-mucosas", "Mucosas",
                  <select id="cns-mucosas" value={mucosas} onChange={(e) => setMucosas(e.target.value)} style={estiloAlertaVital(alertaMucosas)}>
                    <option value="Normocoradas">Normocoradas (Rosadas)</option>
                    <option value="Hipocoradas / Pálidas">Hipocoradas / Pálidas</option>
                    <option value="Cianóticas">Cianóticas</option>
                    <option value="Ictéricas">Ictéricas</option>
                  </select>,
                  refTxt("mucosas"), alertaMucosas
                )}
              </div>

              {animalId && refs && (
                <div style={{ fontSize: "11px", lineHeight: 1.45, color: "#475569", marginTop: "12px" }}>
                  {refs.fonte_ref}
                  {(refs.nome_cientifico || refs.faixa_etaria) && (
                    <span style={{ display: "block", marginTop: "2px" }}>
                      🧬 {refs.nome_cientifico || "nome científico pendente"}
                      {refs.faixa_etaria ? ` · faixa etária: ${refs.faixa_etaria}` : ""}
                    </span>
                  )}
                </div>
              )}
            </section>

            <section style={{ ...estiloPainel, display: "flex", flexDirection: "column" }} aria-label="Anotações clínicas">
              <h3 style={estiloTituloPainel}>Anotações clínicas</h3>

              <div style={{ display: "flex", flexDirection: "column", flex: 1, marginBottom: "14px" }}>
                <label htmlFor="cns-queixa" style={estiloLabel}>Queixa principal / motivo</label>
                <textarea
                  id="cns-queixa"
                  value={queixaPrincipal}
                  onChange={(e) => setQueixaPrincipal(e.target.value)}
                  style={{ ...estiloInput, height: "auto", flex: 1, minHeight: "110px", padding: "10px 12px", resize: "vertical", lineHeight: 1.45 }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                <label htmlFor="cns-exame" style={estiloLabel}>Exame físico / achados clínicos</label>
                <textarea
                  id="cns-exame"
                  value={exameFisico}
                  onChange={(e) => setExameFisico(e.target.value)}
                  style={{ ...estiloInput, height: "auto", flex: 1, minHeight: "110px", padding: "10px 12px", resize: "vertical", lineHeight: 1.45 }}
                />
              </div>
            </section>
          </div>

          {/* COPILOTO CLÍNICO & ANÁLISE DE EXAMES */}
          <div style={{ backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "10px", padding: "16px", marginBottom: "8px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", marginBottom: "6px" }}>
              <h4 style={{ margin: 0, color: "#166534", display: "flex", alignItems: "center", gap: "6px", fontSize: "15px" }}>
                <MdPsychology size={20} /> Copiloto Clínico & Análise de Exames (VetAssist AI)
              </h4>
              <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                {refsPendentes && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", backgroundColor: "#fffbeb", color: "#92400e", border: "1px solid #fcd34d", borderRadius: "999px", padding: "4px 10px", fontSize: "12px", fontWeight: 600 }}>
                    <span aria-hidden="true">!</span> Referências pendentes de validação veterinária
                  </span>
                )}
                <button
                  type="button"
                  onClick={consultarCopilotoComAnexo}
                  disabled={analiseDesabilitada}
                  title={!queixaPrincipal.trim() ? "Preencha a queixa principal para analisar" : undefined}
                  style={{ backgroundColor: analiseDesabilitada ? "#9ca3af" : "#15803d", color: "white", border: "none", padding: "9px 16px", borderRadius: "8px", cursor: analiseDesabilitada ? "not-allowed" : "pointer", fontWeight: "600", fontSize: "13px", display: "flex", alignItems: "center", gap: "6px", boxShadow: analiseDesabilitada ? "none" : "0 1px 3px rgba(21, 128, 61, 0.4)" }}
                >
                  <MdAutoAwesome size={16} /> {carregandoCopiloto ? "Analisando..." : "Analisar atendimento + exame"}
                </button>
              </div>
            </div>

            <p style={{ margin: "0 0 14px 0", fontSize: "12px", color: "#475569", lineHeight: 1.45 }}>
              {!queixaPrincipal.trim()
                ? "Preencha a queixa principal para liberar a análise. "
                : ""}
              A análise da IA é apoio à decisão e precisa ser validada pelo veterinário responsável.
            </p>

            {carregandoCopiloto && (
              <div role="status" style={{ display: "flex", alignItems: "center", gap: "12px", backgroundColor: "#ecfdf5", border: "1px solid #6ee7b7", padding: "12px 16px", borderRadius: "8px", marginBottom: "14px" }}>
                <div style={{ width: "20px", height: "20px", border: "3px solid #10b981", borderTop: "3px solid transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                <div>
                  <div style={{ fontSize: "13px", fontWeight: "bold", color: "#065f46" }}>O Copiloto Clínico está analisando o caso...</div>
                  <div style={{ fontSize: "12px", color: "#047857" }}>{etapaProgressoIA}</div>
                </div>
              </div>
            )}

            <div className="cns-ia-grid">
              {/* ANEXOS */}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: "12px", color: "#374151", marginBottom: "6px", fontWeight: "600" }}>
                  Exames e laudos para a IA analisar (Raio-X, ultrassom, imagens ou PDFs)
                </div>
                <div style={{ backgroundColor: "#ffffff", padding: "10px 12px", borderRadius: "8px", border: "1px dashed #15803d", boxSizing: "border-box", minHeight: "112px" }}>
                  <label style={{ fontSize: "13px", color: "#15803d", fontWeight: "600", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px", margin: 0 }}>
                    <MdAttachFile size={16} /> Selecionar arquivos
                    <input
                      type="file"
                      multiple
                      accept="image/*,application/pdf"
                      onChange={(e) => {
                        const novos = Array.from(e.target.files || []);
                        setArquivosExames((prev) => [...prev, ...novos]);
                        e.target.value = "";
                      }}
                      style={{ position: "absolute", width: 1, height: 1, opacity: 0, overflow: "hidden" }}
                    />
                  </label>

                  {arquivosExames.length === 0 ? (
                    <div style={{ fontSize: "12px", color: "#64748b", marginTop: "6px" }}>Nenhum arquivo anexado.</div>
                  ) : (
                    <>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "10px" }}>
                        {arquivosExames.map((arq, idx) => (
                          <div key={`${arq.name}-${idx}`} style={{ position: "relative", width: "72px" }} title={arq.name}>
                            <div style={{ width: "72px", height: "72px", borderRadius: "8px", border: "1px solid #bbf7d0", backgroundColor: "#f0fdf4", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 700, color: "#166534" }}>
                              {previewsExames[idx]
                                ? <img src={previewsExames[idx]} alt={arq.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                : (arq.type === "application/pdf" ? "PDF" : "Arquivo")}
                            </div>
                            <button
                              type="button"
                              onClick={() => removerArquivoExame(idx)}
                              aria-label={`Remover ${arq.name}`}
                              style={{ position: "absolute", top: "-6px", right: "-6px", width: "20px", height: "20px", borderRadius: "50%", border: "1px solid #fca5a5", backgroundColor: "#ffffff", color: "#b91c1c", cursor: "pointer", fontSize: "11px", lineHeight: 1, padding: 0 }}
                            >
                              ✕
                            </button>
                            <div style={{ fontSize: "11px", color: "#166534", marginTop: "3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{arq.name}</div>
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => setArquivosExames([])}
                        style={{ background: "none", border: "none", color: "#b91c1c", cursor: "pointer", fontSize: "12px", fontWeight: "bold", padding: 0, marginTop: "8px" }}
                      >
                        Remover todos
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* SUSPEITA DIAGNÓSTICA */}
              <div style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
                <label htmlFor="cns-suspeita" style={{ fontSize: "12px", color: "#374151", marginBottom: "6px", fontWeight: "600" }}>
                  Suspeita diagnóstica (preenchida pela IA, editável)
                </label>
                <textarea
                  id="cns-suspeita"
                  value={suspeitaDiagnostica}
                  onChange={(e) => setSuspeitaDiagnostica(e.target.value)}
                  style={{ ...estiloInput, height: "auto", flex: 1, minHeight: "112px", padding: "10px", borderColor: "#15803d", backgroundColor: "#ffffff", resize: "vertical", lineHeight: 1.45 }}
                  placeholder="A suspeita diagnóstica aparecerá aqui após a análise..."
                />
              </div>
            </div>

            {sugestoesCopiloto && (
              <div style={{ padding: "16px", backgroundColor: "#ffffff", borderRadius: "8px", border: "1px solid #d1d5db", marginTop: "14px" }}>
                <div style={{ fontSize: "14px", fontWeight: "bold", color: "#166534", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
                  🤖 Parecer Detalhado do Copiloto:
                </div>
                <div style={{ backgroundColor: "#f8fafc", padding: "12px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                  {renderizarTextoFormatadoIA(sugestoesCopiloto)}
                </div>
              </div>
            )}

            {/* RODAPÉ DO BLOCO DE IA: OPÇÕES E INDICAÇÃO CIRÚRGICA */}
            <div className="cns-ia-grid" style={{ marginTop: "14px", paddingTop: "14px", borderTop: "1px solid #bbf7d0", alignItems: "stretch" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", backgroundColor: "#ffffff", border: "1px solid #bbf7d0", padding: "10px 14px", borderRadius: "8px" }}>
                <input
                  id="cns-preventivos"
                  type="checkbox"
                  checked={solicitarExamesPreventivos}
                  onChange={(e) => setSolicitarExamesPreventivos(e.target.checked)}
                  style={{ width: "16px", height: "16px", cursor: "pointer", flexShrink: 0 }}
                />
                <label htmlFor="cns-preventivos" style={{ fontSize: "13px", color: "#166534", fontWeight: "600", cursor: "pointer", margin: 0 }}>
                  Tutor solicitou exames preventivos / check-up de rotina nesta visita
                </label>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap", backgroundColor: temIndicacaoReal ? "#dcfce7" : "#ffffff", border: `1px solid ${temIndicacaoReal ? "#86efac" : "#e2e8f0"}`, padding: "10px 14px", borderRadius: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: "200px" }}>
                  <span style={{ fontSize: "18px" }} aria-hidden="true">{temIndicacaoReal ? "🔪" : "➕"}</span>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: "bold", color: temIndicacaoReal ? "#166534" : "#334155" }}>{tituloCirurgia}</div>
                    <div style={{ fontSize: "12px", color: temIndicacaoReal ? "#14532d" : "#64748b", marginTop: "2px", lineHeight: 1.4 }}>{detalheCirurgia}</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <input
                    id="cns-forcar-cirurgia"
                    type="checkbox"
                    checked={forcarCirurgia}
                    onChange={(e) => setForcarCirurgia(e.target.checked)}
                    style={{ width: "16px", height: "16px", cursor: "pointer" }}
                  />
                  <label htmlFor="cns-forcar-cirurgia" style={{ fontSize: "12px", fontWeight: "600", color: "#334155", cursor: "pointer" }}>Forçar cirurgia</label>
                </div>
              </div>
            </div>
          </div>

          {/* BARRA DE AÇÕES */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", marginTop: "20px", paddingTop: "16px", borderTop: "1px solid #e5e7eb" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
              <button
                type="button"
                onClick={abrirReceita}
                disabled={botoesIADesabilitados}
                title={dicaBotoesIA}
                style={{ backgroundColor: botoesIADesabilitados ? "#e5e7eb" : "#4f46e5", color: botoesIADesabilitados ? "#6b7280" : "#ffffff", border: "none", padding: "10px 16px", borderRadius: "8px", cursor: botoesIADesabilitados ? "not-allowed" : "pointer", fontWeight: "600", display: "flex", alignItems: "center", gap: "6px" }}
              >
                <MdMedicalServices size={18} /> Receita médica
              </button>
              <button
                type="button"
                onClick={abrirExames}
                disabled={botoesIADesabilitados}
                title={dicaBotoesIA}
                style={{ backgroundColor: botoesIADesabilitados ? "#e5e7eb" : "#0f766e", color: botoesIADesabilitados ? "#6b7280" : "#ffffff", border: "none", padding: "10px 16px", borderRadius: "8px", cursor: botoesIADesabilitados ? "not-allowed" : "pointer", fontWeight: "600", display: "flex", alignItems: "center", gap: "6px" }}
              >
                <MdScience size={18} /> Exames
              </button>
              <button
                type="button"
                onClick={() => abrirHistorico(animalId)}
                disabled={!animalId}
                title={!animalId ? "Selecione o paciente" : "Receitas e exames anteriores deste paciente"}
                style={{ backgroundColor: "#ffffff", color: animalId ? "#374151" : "#9ca3af", border: "1px solid #d1d5db", padding: "10px 16px", borderRadius: "8px", cursor: animalId ? "pointer" : "not-allowed", fontWeight: "600", display: "flex", alignItems: "center", gap: "6px" }}
              >
                📋 Histórico
              </button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
              <button type="button" onClick={() => { limparFormulario(); setMostrarFormulario(false); }} style={{ backgroundColor: "#ffffff", color: "#374151", border: "1px solid #d1d5db", padding: "10px 18px", borderRadius: "8px", cursor: "pointer", fontWeight: "600" }}>Fechar</button>
              <button type="button" onClick={salvarConsulta} style={{ backgroundColor: "#16a34a", color: "white", border: "none", padding: "10px 24px", borderRadius: "8px", cursor: "pointer", fontWeight: "700", boxShadow: "0 2px 4px rgba(22, 163, 74, 0.35)" }}>Salvar atendimento</button>
            </div>
          </div>
        </div>
      )}

      {/* TABELA DE CONSULTAS */}
      {!mostrarFormulario && (
        <>
          <div role="tablist" aria-label="Filtro de atendimentos" style={{ display: "flex", gap: "6px", backgroundColor: "#e2e8f0", padding: "4px", borderRadius: "10px", marginBottom: "16px", width: "fit-content", maxWidth: "100%", flexWrap: "wrap" }}>
            {[
              { id: "ativos", rotulo: "🟢 Ativos" },
              { id: "finalizados", rotulo: "✅ Finalizados" },
              { id: "todos", rotulo: "📋 Todos" },
            ].map((aba) => {
              const ativa = abaAtiva === aba.id;
              return (
                <button
                  key={aba.id}
                  role="tab"
                  aria-selected={ativa}
                  onClick={() => setAbaAtiva(aba.id)}
                  style={{ backgroundColor: ativa ? "#4f46e5" : "transparent", color: ativa ? "#ffffff" : "#334155", border: "none", padding: "8px 16px", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "13px", boxShadow: ativa ? "0 2px 5px rgba(79, 70, 229, 0.4)" : "none" }}
                >
                  {aba.rotulo}
                </button>
              );
            })}
          </div>

          <div style={{ overflowX: "auto", backgroundColor: "white", borderRadius: "12px", border: "1px solid #e5e7eb" }}>
            <table style={{ width: "100%", minWidth: "1000px", borderCollapse: "collapse", textAlign: "center" }}>
              <thead>
                <tr style={{ backgroundColor: "#4f46e5", color: "white", fontSize: "14px" }}>
                  <th style={{ padding: "14px", whiteSpace: "nowrap" }}>Código</th>
                  <th style={{ padding: "14px", whiteSpace: "nowrap" }}>Paciente</th>
                  <th style={{ padding: "14px" }}>Queixa Principal</th>
                  <th style={{ padding: "14px", whiteSpace: "nowrap" }}>Peso</th>
                  <th style={{ padding: "14px", whiteSpace: "nowrap" }}>Temperatura</th>
                  <th style={{ padding: "14px", whiteSpace: "nowrap" }}>Status</th>
                  <th style={{ padding: "14px", whiteSpace: "nowrap" }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {consultasFiltradas.length > 0 ? (
                  consultasFiltradas.map((c) => (
                    <tr key={c.id} style={{ borderBottom: "1px solid #f3f4f6", fontSize: "14px" }}>
                      <td style={{ padding: "14px", fontWeight: "bold", color: "#4f46e5", whiteSpace: "nowrap" }}>{c.codigo || `CNS-${c.id}`}</td>
                      <td style={{ padding: "14px", fontWeight: "600", whiteSpace: "nowrap" }}>{obterNomeAnimal(c.animal_id)}</td>
                      <td style={{ padding: "14px", color: "#4b5563", textAlign: "left" }}>{c.queixa_principal}</td>
                      <td style={{ padding: "14px", whiteSpace: "nowrap" }}>{obterPesoFormatado(c)}</td>
                      <td style={{ padding: "14px", whiteSpace: "nowrap" }}>{renderBadgeTemperatura(c.temperatura)}</td>
                      <td style={{ padding: "14px", whiteSpace: "nowrap" }}>{renderBadgeStatus(c.status)}</td>
                      <td style={{ padding: "14px", display: "flex", justifyContent: "center", gap: "6px", whiteSpace: "nowrap" }}>
                        <button onClick={(e) => chamarPaciente(c, e)} style={{ backgroundColor: "#0284c7", color: "white", border: "none", padding: "6px 10px", borderRadius: "6px", cursor: "pointer", fontWeight: "600", fontSize: "13px", display: "flex", alignItems: "center", gap: "4px" }}>
                          <MdCampaign size={16} /> Chamar
                        </button>
                        <button onClick={() => iniciarAtendimentoVeterinario(c)} style={{ backgroundColor: "#4f46e5", color: "white", border: "none", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontWeight: "600", fontSize: "13px" }}>
                          💉 Atender
                        </button>
                        <button onClick={() => abrirHistorico(c.animal_id)} title="Receitas e exames anteriores do paciente" style={{ backgroundColor: "#f3f4f6", border: "none", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontWeight: "600", fontSize: "13px" }}>
                          📋 Histórico
                        </button>
                        <button onClick={() => setConsultaDetalhes(c)} style={{ backgroundColor: "#f3f4f6", border: "none", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontWeight: "600", fontSize: "13px" }}>
                          <MdVisibility size={16} /> Ver
                        </button>
                        <button onClick={() => { setConsultaParaExcluir(c); setModalExclusaoAberto(true); }} style={{ backgroundColor: "#fee2e2", color: "#991b1b", border: "none", padding: "6px 10px", borderRadius: "6px", cursor: "pointer", fontWeight: "600", fontSize: "13px", display: "flex", alignItems: "center", gap: "4px" }}>
                          <MdDelete size={16} /> Excluir
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan="7" style={{ padding: "24px", color: "#6b7280" }}>Nenhum atendimento clínico encontrado.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* MODAL DE DETALHES */}
      {consultaDetalhes && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: "20px" }}>
          <div style={{ backgroundColor: "white", padding: "28px", borderRadius: "12px", maxWidth: "650px", width: "100%", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e5e7eb", paddingBottom: "12px", marginBottom: "16px" }}>
              <h2 style={{ margin: 0, color: "#1e1b4b", fontSize: "20px" }}>📋 Detalhes do Atendimento ({consultaDetalhes.codigo || `CNS-${consultaDetalhes.id}`})</h2>
              <button onClick={() => setConsultaDetalhes(null)} style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer", fontWeight: "bold", color: "#6b7280" }}>✕</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "16px", fontSize: "14px", color: "#374151" }}>
              <div><strong>Paciente:</strong> {obterNomeAnimal(consultaDetalhes.animal_id)}</div>
              <div><strong>Status:</strong> {consultaDetalhes.status}</div>
              <div><strong>Peso:</strong> {obterPesoFormatado(consultaDetalhes)}</div>
              <div><strong>Temperatura:</strong> {consultaDetalhes.temperatura ? `${consultaDetalhes.temperatura} °C` : "-"}</div>
            </div>
            <div style={{ marginBottom: "14px" }}>
              <strong style={{ fontSize: "13px", color: "#4b5563" }}>Queixa Principal:</strong>
              <p style={{ margin: "4px 0 0 0", padding: "10px", backgroundColor: "#f9fafb", borderRadius: "6px", fontSize: "14px", color: "#1f2937" }}>{consultaDetalhes.queixa_principal || "Não informada"}</p>
            </div>
            {consultaDetalhes.exames_anexados && (
              <div style={{ marginBottom: "14px" }}>
                <strong style={{ fontSize: "13px", color: "#166534" }}>📎 Exames Anexados:</strong>
                <p style={{ margin: "4px 0 0 0", padding: "8px", backgroundColor: "#f0fdf4", borderRadius: "6px", fontSize: "14px", color: "#14532d" }}>{consultaDetalhes.exames_anexados}</p>
              </div>
            )}
            {consultaDetalhes.parecer_copiloto && (
              <div style={{ marginBottom: "20px" }}>
                <strong style={{ fontSize: "13px", color: "#166534" }}>🤖 Parecer do Copiloto:</strong>
                <div style={{ margin: "4px 0 0 0", padding: "12px", backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "6px", fontSize: "14px", color: "#14532d", whiteSpace: "pre-line" }}>
                  {consultaDetalhes.parecer_copiloto}
                </div>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", borderTop: "1px solid #e5e7eb", paddingTop: "16px" }}>
              <button onClick={() => window.print()} style={{ backgroundColor: "#4f46e5", color: "white", border: "none", padding: "8px 16px", borderRadius: "6px", cursor: "pointer", fontWeight: "600", display: "flex", alignItems: "center", gap: "6px" }}>
                <MdPrint size={16} /> Imprimir
              </button>
              <button onClick={() => setConsultaDetalhes(null)} style={{ backgroundColor: "#f3f4f6", border: "none", padding: "8px 16px", borderRadius: "6px", cursor: "pointer", fontWeight: "600" }}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE EXCLUSÃO */}
      {modalExclusaoAberto && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
          <div style={{ backgroundColor: "white", padding: "24px", borderRadius: "12px", maxWidth: "400px", width: "100%" }}>
            <h3 style={{ margin: "0 0 12px 0", color: "#111827" }}>Confirmar Exclusão</h3>
            <p style={{ color: "#4b5563", fontSize: "14px", marginBottom: "20px" }}>Tem certeza de que deseja apagar o atendimento <strong>{consultaParaExcluir?.codigo}</strong>?</p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button onClick={() => setModalExclusaoAberto(false)} style={{ backgroundColor: "#f3f4f6", border: "none", padding: "8px 14px", borderRadius: "6px", cursor: "pointer", fontWeight: "600" }}>Cancelar</button>
              <button onClick={deletarConsulta} style={{ backgroundColor: "#dc2626", color: "white", border: "none", padding: "8px 14px", borderRadius: "6px", cursor: "pointer", fontWeight: "600" }}>Sim, Excluir</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: RECEITA MÉDICA (sugerida pela IA, editável) */}
      {modalReceita && (
        <div role="dialog" aria-modal="true" aria-label="Receita médica" style={estiloOverlay}>
          <div style={estiloCaixaModal}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e5e7eb", paddingBottom: "12px", marginBottom: "14px" }}>
              <h2 style={{ margin: 0, color: "#1e1b4b", fontSize: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
                <MdMedicalServices color="#4f46e5" size={24} /> Receita médica — {animalSelecionado?.nome || "paciente"}
              </h2>
              <button type="button" aria-label="Fechar" onClick={() => setModalReceita(false)} style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer", fontWeight: "bold", color: "#6b7280" }}>✕</button>
            </div>

            <p style={{ margin: "0 0 12px 0", fontSize: "12px", color: "#475569", lineHeight: 1.45 }}>
              Sugestão gerada pela IA a partir do parecer do Copiloto. Doses, apresentações e a disponibilidade (farmácia ou pet shop) <strong>precisam ser conferidas por você</strong> antes de imprimir. Todos os campos são editáveis.
            </p>

            {carregandoReceita && (
              <div role="status" style={{ display: "flex", alignItems: "center", gap: "12px", backgroundColor: "#eef2ff", border: "1px solid #c7d2fe", padding: "12px 16px", borderRadius: "8px", marginBottom: "12px" }}>
                <div style={{ width: "20px", height: "20px", border: "3px solid #4f46e5", borderTop: "3px solid transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                <span style={{ fontSize: "13px", fontWeight: 600, color: "#3730a3" }}>Montando a sugestão de receita...</span>
              </div>
            )}

            {erroReceita && (
              <div role="alert" style={{ backgroundColor: "#fee2e2", color: "#991b1b", padding: "10px 12px", borderRadius: "8px", marginBottom: "12px", fontSize: "13px", fontWeight: 500 }}>
                {erroReceita}
              </div>
            )}

            {pesoMudouDesdeReceita && !carregandoReceita && (
              <div role="alert" style={{ backgroundColor: "#fffbeb", color: "#92400e", border: "1px solid #fcd34d", padding: "10px 12px", borderRadius: "8px", marginBottom: "12px", fontSize: "13px", fontWeight: 600 }}>
                ⚠️ O peso mudou desde que as doses foram calculadas ({pesoUsadoReceita ?? "sem peso"} → {pesoAtualNum ?? "sem peso"} kg). Clique em “Gerar novamente” para recalcular.
              </div>
            )}

            {alertasReceita.length > 0 && (
              <ul style={{ margin: "0 0 12px 0", padding: "10px 12px 10px 28px", backgroundColor: "#fffbeb", border: "1px solid #fcd34d", borderRadius: "8px", fontSize: "12px", color: "#78350f", lineHeight: 1.5 }}>
                {alertasReceita.map((a, idx) => <li key={idx}>{a}</li>)}
              </ul>
            )}

            {!carregandoReceita && !erroReceita && itensReceita.length === 0 && (
              <div style={{ padding: "14px", backgroundColor: "#f8fafc", border: "1px dashed #cbd5e1", borderRadius: "8px", fontSize: "13px", color: "#475569", marginBottom: "12px" }}>
                A IA não sugeriu medicação para este parecer. Você pode adicionar medicamentos manualmente.
              </div>
            )}

            {itensReceitaValidos.some(ehControlado) && (
              <div role="status" style={{ backgroundColor: "#fef2f2", color: "#991b1b", border: "1px solid #fca5a5", padding: "10px 12px", borderRadius: "8px", marginBottom: "12px", fontSize: "13px", fontWeight: 600, lineHeight: 1.45 }}>
                🔒 Esta receita tem medicamento controlado. Ele será impresso em documento separado dos demais, em 2 vias (1ª via da farmácia, 2ª via do cliente). Confira o tipo de receituário exigido para o princípio ativo.
              </div>
            )}

            {itensReceita.map((item, idx) => {
              const cor = TIPO_USO_COR[item.tipo_uso] || TIPO_USO_COR.A_CONFIRMAR;
              const campo = (rotulo, chave, extra = {}) => (
                <div style={{ minWidth: 0, ...extra }}>
                  <label htmlFor={`rx-${item._id}-${chave}`} style={{ ...estiloLabel, fontSize: "12px", marginBottom: "4px" }}>{rotulo}</label>
                  <input id={`rx-${item._id}-${chave}`} type="text" value={item[chave] || ""} onChange={(e) => alterarItemReceita(item._id, chave, e.target.value)} style={{ ...estiloInput, height: "36px", fontSize: "13px" }} />
                </div>
              );
              return (
                <div key={item._id} style={{ border: `1px solid ${cor.borda}`, backgroundColor: "#ffffff", borderLeft: `4px solid ${cor.borda}`, borderRadius: "8px", padding: "12px", marginBottom: "10px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", marginBottom: "8px", flexWrap: "wrap" }}>
                    <strong style={{ color: "#4f46e5", fontSize: "14px" }}>
                      {idx + 1}.
                      {ehControlado(item) && <span style={{ marginLeft: "8px", fontSize: "11px", fontWeight: 700, color: "#991b1b", backgroundColor: "#fee2e2", border: "1px solid #fca5a5", borderRadius: "999px", padding: "2px 8px" }}>Controlado — receita em 2 vias</span>}
                    </strong>
                    <button type="button" onClick={() => removerItemReceita(item._id)} aria-label={`Remover medicamento ${idx + 1}`} style={{ backgroundColor: "#fee2e2", color: "#991b1b", border: "none", padding: "4px 10px", borderRadius: "6px", cursor: "pointer", fontWeight: 600, fontSize: "12px", display: "flex", alignItems: "center", gap: "4px" }}>
                      <MdDelete size={14} /> Remover
                    </button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "10px" }}>
                    {campo("Medicamento e apresentação", "medicamento", { gridColumn: "1 / -1" })}
                    {campo("Dosagem", "dosagem", { gridColumn: "1 / -1" })}
                    {campo("Frequência", "frequencia")}
                    {campo("Duração", "duracao")}
                    <div style={{ minWidth: 0 }}>
                      <label htmlFor={`rx-${item._id}-uso`} style={{ ...estiloLabel, fontSize: "12px", marginBottom: "4px" }}>Onde encontrar</label>
                      <select id={`rx-${item._id}-uso`} value={item.tipo_uso || "A_CONFIRMAR"} onChange={(e) => alterarItemReceita(item._id, "tipo_uso", e.target.value)} style={{ ...estiloInput, height: "36px", fontSize: "13px", backgroundColor: cor.bg, color: cor.cor, fontWeight: 600 }}>
                        {Object.entries(TIPO_USO_ROTULO).map(([cod, rot]) => <option key={cod} value={cod}>{rot}</option>)}
                      </select>
                    </div>
                    {campo("Observações", "observacoes", { gridColumn: "1 / -1" })}
                    {ehControlado(item) && campo("Quantidade a dispensar (ex.: 1 caixa, 10 comprimidos)", "quantidade", { gridColumn: "1 / -1" })}
                    <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: "8px" }}>
                      <input id={`rx-${item._id}-ctrl`} type="checkbox" checked={ehControlado(item)} onChange={(e) => alterarItemReceita(item._id, "controladoManual", e.target.checked)} style={{ width: "16px", height: "16px", cursor: "pointer" }} />
                      <label htmlFor={`rx-${item._id}-ctrl`} style={{ fontSize: "12px", fontWeight: 600, color: "#374151", cursor: "pointer" }}>Medicamento controlado (imprime em 2 vias: farmácia e cliente)</label>
                    </div>
                  </div>
                </div>
              );
            })}

            <button type="button" onClick={adicionarItemReceita} style={{ backgroundColor: "#ffffff", color: "#4f46e5", border: "1px dashed #4f46e5", padding: "8px 14px", borderRadius: "8px", cursor: "pointer", fontWeight: 600, fontSize: "13px", display: "inline-flex", alignItems: "center", gap: "6px", marginBottom: "14px" }}>
              <MdAdd size={16} /> Adicionar medicamento
            </button>

            <label htmlFor="rx-obs" style={estiloLabel}>Orientações gerais ao tutor (opcional)</label>
            <textarea id="rx-obs" value={obsReceita} onChange={(e) => { setObsReceita(e.target.value); setReceitaSalva(false); }} style={{ ...estiloInput, height: "auto", minHeight: "70px", padding: "10px 12px", resize: "vertical", lineHeight: 1.45, marginBottom: "14px" }} placeholder="Ex.: oferecer água fresca à vontade; retornar em 5 dias para reavaliação." />

            {itensReceitaValidos.some(ehControlado) && (
              <div style={{ border: "1px solid #fca5a5", backgroundColor: "#fef2f2", borderRadius: "8px", padding: "12px", marginBottom: "14px" }}>
                <div style={{ fontWeight: 700, fontSize: "13px", color: "#991b1b", marginBottom: "4px" }}>Identificação do emitente (receita de controle especial)</div>
                <div style={{ fontSize: "11px", color: "#7f1d1d", marginBottom: "8px" }}>Nome e CRMV vêm do veterinário do atendimento. Endereço, cidade, UF e telefone da clínica ficam salvos neste navegador.</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px" }}>
                  {renderCampoEmitente("Nome completo do veterinário", "nome", { gridColumn: "1 / -1" })}
                  {renderCampoEmitente("CRMV", "crmv")}
                  {renderCampoEmitente("UF do CRMV", "ufCrmv")}
                  {renderCampoEmitente("Endereço da clínica", "endereco", { gridColumn: "1 / -1" })}
                  {renderCampoEmitente("Cidade", "cidade")}
                  {renderCampoEmitente("UF", "ufCidade")}
                  {renderCampoEmitente("Telefone", "telefone")}
                </div>
              </div>
            )}

            <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", backgroundColor: receitaConferida ? "#f0fdf4" : "#fffbeb", border: `1px solid ${receitaConferida ? "#86efac" : "#fcd34d"}`, borderRadius: "8px", padding: "10px 12px", marginBottom: "14px" }}>
              <input id="rx-conferida" type="checkbox" checked={receitaConferida} onChange={(e) => setReceitaConferida(e.target.checked)} style={{ width: "16px", height: "16px", marginTop: "2px", cursor: "pointer", flexShrink: 0 }} />
              <label htmlFor="rx-conferida" style={{ fontSize: "13px", fontWeight: 600, color: "#374151", cursor: "pointer", lineHeight: 1.4 }}>
                Conferi medicamentos, doses, frequências e disponibilidade, e assumo a responsabilidade por esta prescrição.
              </label>
            </div>

            {motivoBloqueioControlado && (
              <div role="alert" style={{ color: "#991b1b", fontSize: "12px", fontWeight: 600, marginBottom: "8px" }}>⚠️ {motivoBloqueioControlado}</div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", borderTop: "1px solid #e5e7eb", paddingTop: "14px" }}>
              <button type="button" onClick={gerarReceitaIA} disabled={carregandoReceita} style={{ backgroundColor: "#ffffff", color: "#4f46e5", border: "1px solid #c7d2fe", padding: "8px 14px", borderRadius: "8px", cursor: carregandoReceita ? "not-allowed" : "pointer", fontWeight: 600, fontSize: "13px", display: "flex", alignItems: "center", gap: "6px" }}>
                <MdAutoAwesome size={16} /> {carregandoReceita ? "Gerando..." : "Gerar novamente"}
              </button>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                <button type="button" onClick={() => setModalReceita(false)} style={{ backgroundColor: "#f3f4f6", border: "none", padding: "8px 16px", borderRadius: "8px", cursor: "pointer", fontWeight: 600 }}>Fechar</button>
                <button
                  type="button"
                  onClick={salvarReceitaNoProntuario}
                  disabled={!receitaConferida || itensReceitaValidos.length === 0 || !consultaEditando?.id || salvandoReceita || receitaSalva}
                  title={!consultaEditando?.id ? "Abra o atendimento pela lista (botão Atender) para salvar no prontuário" : !receitaConferida ? "Confirme a conferência da receita" : undefined}
                  style={{ backgroundColor: (!receitaConferida || itensReceitaValidos.length === 0 || !consultaEditando?.id || receitaSalva) ? "#e5e7eb" : "#16a34a", color: (!receitaConferida || itensReceitaValidos.length === 0 || !consultaEditando?.id || receitaSalva) ? "#6b7280" : "#ffffff", border: "none", padding: "8px 16px", borderRadius: "8px", cursor: "pointer", fontWeight: 600 }}
                >
                  {receitaSalva ? "✓ Salva no prontuário" : salvandoReceita ? "Salvando..." : "Salvar no prontuário"}
                </button>
                <button
                  type="button"
                  onClick={imprimirReceita}
                  disabled={impressaoBloqueada}
                  title={!receitaConferida ? "Confirme a conferência da receita para imprimir" : (motivoBloqueioControlado || undefined)}
                  style={{ backgroundColor: impressaoBloqueada ? "#e5e7eb" : "#4f46e5", color: impressaoBloqueada ? "#6b7280" : "#ffffff", border: "none", padding: "8px 16px", borderRadius: "8px", cursor: impressaoBloqueada ? "not-allowed" : "pointer", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}
                >
                  <MdPrint size={16} /> Imprimir receita
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SOLICITAÇÃO DE EXAMES (sugerida pela IA, editável) */}
      {modalExames && (
        <div role="dialog" aria-modal="true" aria-label="Solicitação de exames" style={estiloOverlay}>
          <div style={estiloCaixaModal}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e5e7eb", paddingBottom: "12px", marginBottom: "14px" }}>
              <h2 style={{ margin: 0, color: "#134e4a", fontSize: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
                <MdScience color="#0f766e" size={24} /> Solicitação de exames — {animalSelecionado?.nome || "paciente"}
              </h2>
              <button type="button" aria-label="Fechar" onClick={() => setModalExames(false)} style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer", fontWeight: "bold", color: "#6b7280" }}>✕</button>
            </div>

            <p style={{ margin: "0 0 12px 0", fontSize: "12px", color: "#475569", lineHeight: 1.45 }}>
              Exames sugeridos pela IA a partir do parecer clínico. Marque os que deseja solicitar, remova os desnecessários ou adicione outros.
            </p>

            {carregandoExames && (
              <div role="status" style={{ display: "flex", alignItems: "center", gap: "12px", backgroundColor: "#f0fdfa", border: "1px solid #99f6e4", padding: "12px 16px", borderRadius: "8px", marginBottom: "12px" }}>
                <div style={{ width: "20px", height: "20px", border: "3px solid #0f766e", borderTop: "3px solid transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                <span style={{ fontSize: "13px", fontWeight: 600, color: "#115e59" }}>Escolhendo os exames mais indicados...</span>
              </div>
            )}

            {erroExames && (
              <div role="alert" style={{ backgroundColor: "#fee2e2", color: "#991b1b", padding: "10px 12px", borderRadius: "8px", marginBottom: "12px", fontSize: "13px", fontWeight: 500 }}>
                {erroExames}
              </div>
            )}

            {geradoExames && !carregandoExames && examesSugeridos.length === 0 && (
              <div style={{ padding: "14px", backgroundColor: "#f8fafc", border: "1px dashed #cbd5e1", borderRadius: "8px", fontSize: "13px", color: "#475569", marginBottom: "12px" }}>
                A IA não considerou necessário solicitar exames para este parecer. Você pode adicionar exames manualmente.
              </div>
            )}

            {Object.keys(CATEGORIA_EXAME_ROTULO).map((cat) => {
              const lista = examesSugeridos.filter((e) => e.categoria === cat);
              if (lista.length === 0) return null;
              return (
                <div key={cat} style={{ marginBottom: "12px" }}>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "#134e4a", borderBottom: "1px solid #e5e7eb", paddingBottom: "4px", marginBottom: "8px" }}>{CATEGORIA_EXAME_ROTULO[cat]}</div>
                  {lista.map((ex) => (
                    <div key={ex._id} style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "8px 10px", border: `1px solid ${ex.selecionado ? "#99f6e4" : "#e5e7eb"}`, backgroundColor: ex.selecionado ? "#f0fdfa" : "#f9fafb", borderRadius: "8px", marginBottom: "6px", opacity: ex.selecionado ? 1 : 0.7 }}>
                      <input id={`ex-${ex._id}`} type="checkbox" checked={ex.selecionado} onChange={() => alternarExame(ex._id)} style={{ width: "16px", height: "16px", marginTop: "2px", cursor: "pointer", flexShrink: 0 }} />
                      <label htmlFor={`ex-${ex._id}`} style={{ flex: 1, cursor: "pointer", minWidth: 0 }}>
                        <span style={{ fontSize: "14px", fontWeight: 600, color: "#111827" }}>{ex.nome}</span>
                        {ex.prioridade === "URGENTE" && <span style={{ marginLeft: "8px", fontSize: "11px", fontWeight: 700, color: "#991b1b", backgroundColor: "#fee2e2", border: "1px solid #fca5a5", borderRadius: "999px", padding: "1px 8px" }}>Urgente</span>}
                        {ex.justificativa && <span style={{ display: "block", fontSize: "12px", color: "#475569", marginTop: "2px", lineHeight: 1.4 }}>{ex.justificativa}</span>}
                      </label>
                      <button type="button" onClick={() => removerExame(ex._id)} aria-label={`Remover ${ex.nome}`} style={{ background: "none", border: "none", color: "#b91c1c", cursor: "pointer", fontSize: "13px", fontWeight: 700 }}>✕</button>
                    </div>
                  ))}
                </div>
              );
            })}

            <div style={{ display: "flex", gap: "8px", marginBottom: "14px", flexWrap: "wrap" }}>
              <input
                type="text"
                value={novoExame}
                onChange={(e) => setNovoExame(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); adicionarExameManual(); } }}
                aria-label="Adicionar outro exame"
                placeholder="Adicionar outro exame (ex.: Ultrassonografia abdominal)"
                style={{ ...estiloInput, height: "38px", flex: 1, minWidth: "220px", fontSize: "13px" }}
              />
              <button type="button" onClick={adicionarExameManual} disabled={!novoExame.trim()} style={{ backgroundColor: "#ffffff", color: "#0f766e", border: "1px dashed #0f766e", padding: "0 14px", borderRadius: "8px", cursor: novoExame.trim() ? "pointer" : "not-allowed", fontWeight: 600, fontSize: "13px", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <MdAdd size={16} /> Adicionar
              </button>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", borderTop: "1px solid #e5e7eb", paddingTop: "14px" }}>
              <button type="button" onClick={gerarExamesIA} disabled={carregandoExames} style={{ backgroundColor: "#ffffff", color: "#0f766e", border: "1px solid #99f6e4", padding: "8px 14px", borderRadius: "8px", cursor: carregandoExames ? "not-allowed" : "pointer", fontWeight: 600, fontSize: "13px", display: "flex", alignItems: "center", gap: "6px" }}>
                <MdAutoAwesome size={16} /> {carregandoExames ? "Gerando..." : "Gerar novamente"}
              </button>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center" }}>
                <span style={{ fontSize: "12px", color: "#475569" }}>{examesSelecionados.length} selecionado(s)</span>
                <button type="button" onClick={() => setModalExames(false)} style={{ backgroundColor: "#f3f4f6", border: "none", padding: "8px 16px", borderRadius: "8px", cursor: "pointer", fontWeight: 600 }}>Fechar</button>
                <button
                  type="button"
                  onClick={salvarExamesNoProntuario}
                  disabled={examesSelecionados.length === 0 || !consultaEditando?.id || salvandoExames || examesSalvos}
                  title={!consultaEditando?.id ? "Abra o atendimento pela lista (botão Atender) para salvar no prontuário" : undefined}
                  style={{ backgroundColor: (examesSelecionados.length === 0 || !consultaEditando?.id || examesSalvos) ? "#e5e7eb" : "#16a34a", color: (examesSelecionados.length === 0 || !consultaEditando?.id || examesSalvos) ? "#6b7280" : "#ffffff", border: "none", padding: "8px 16px", borderRadius: "8px", cursor: "pointer", fontWeight: 600 }}
                >
                  {examesSalvos ? "✓ Salva no prontuário" : salvandoExames ? "Salvando..." : "Salvar no prontuário"}
                </button>
                <button
                  type="button"
                  onClick={imprimirExames}
                  disabled={examesSelecionados.length === 0}
                  style={{ backgroundColor: examesSelecionados.length === 0 ? "#e5e7eb" : "#0f766e", color: examesSelecionados.length === 0 ? "#6b7280" : "#ffffff", border: "none", padding: "8px 16px", borderRadius: "8px", cursor: examesSelecionados.length === 0 ? "not-allowed" : "pointer", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}
                >
                  <MdPrint size={16} /> Imprimir solicitação
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: HISTÓRICO DE RECEITAS E EXAMES DO PACIENTE */}
      {modalHistorico && (
        <div role="dialog" aria-modal="true" aria-label="Histórico do paciente" style={estiloOverlay}>
          <div style={estiloCaixaModal}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e5e7eb", paddingBottom: "12px", marginBottom: "14px" }}>
              <h2 style={{ margin: 0, color: "#1e1b4b", fontSize: "20px" }}>📋 Histórico — {animalDoHistorico?.nome || "paciente"}</h2>
              <button type="button" aria-label="Fechar" onClick={() => setModalHistorico(false)} style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer", fontWeight: "bold", color: "#6b7280" }}>✕</button>
            </div>

            {carregandoHistorico && <div role="status" style={{ fontSize: "13px", color: "#475569", padding: "8px 0" }}>Carregando histórico...</div>}
            {erroHistorico && <div role="alert" style={{ backgroundColor: "#fee2e2", color: "#991b1b", padding: "10px 12px", borderRadius: "8px", fontSize: "13px" }}>{erroHistorico}</div>}
            {!carregandoHistorico && !erroHistorico && historico.length === 0 && (
              <div style={{ padding: "14px", backgroundColor: "#f8fafc", border: "1px dashed #cbd5e1", borderRadius: "8px", fontSize: "13px", color: "#475569" }}>
                Nenhuma receita ou solicitação de exames salva para este paciente ainda.
              </div>
            )}

            {historico.map((bloco) => (
              <div key={bloco.consulta_id} style={{ border: "1px solid #e5e7eb", borderRadius: "10px", padding: "12px 14px", marginBottom: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "6px", marginBottom: "8px" }}>
                  <strong style={{ color: "#4f46e5", fontSize: "14px" }}>{bloco.codigo}</strong>
                  <span style={{ fontSize: "12px", color: "#64748b" }}>{formatarDataHora(bloco.data_consulta)}</span>
                </div>
                {bloco.suspeita_diagnostica && <div style={{ fontSize: "12px", color: "#374151", marginBottom: "8px" }}><strong>Suspeita:</strong> {bloco.suspeita_diagnostica}</div>}

                {bloco.receitas.map((r) => (
                  <div key={r.id} style={{ backgroundColor: "#eef2ff", border: "1px solid #c7d2fe", borderRadius: "8px", padding: "10px 12px", marginBottom: "8px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "6px", marginBottom: "6px" }}>
                      <strong style={{ fontSize: "13px", color: "#3730a3" }}>💊 Receita · {formatarDataHora(r.data)}</strong>
                      <button type="button" onClick={() => imprimirReceitaDe(r.itens, r.observacoes, ctx2aVia(bloco, r.data))} style={{ backgroundColor: "#4f46e5", color: "#fff", border: "none", padding: "5px 10px", borderRadius: "6px", cursor: "pointer", fontWeight: 600, fontSize: "12px", display: "flex", alignItems: "center", gap: "4px" }}>
                        <MdPrint size={14} /> Reimprimir
                      </button>
                    </div>
                    <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "12px", color: "#1f2937", lineHeight: 1.5 }}>
                      {r.itens.map((i, idx) => <li key={idx}><strong>{i.medicamento}</strong>{i.dosagem ? ` — ${i.dosagem}` : ""}{i.frequencia ? ` · ${i.frequencia}` : ""}{i.duracao ? ` · ${i.duracao}` : ""}</li>)}
                    </ul>
                  </div>
                ))}

                {bloco.exames.map((lote) => (
                  <div key={lote.lote} style={{ backgroundColor: "#f0fdfa", border: "1px solid #99f6e4", borderRadius: "8px", padding: "10px 12px", marginBottom: "8px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "6px", marginBottom: "6px" }}>
                      <strong style={{ fontSize: "13px", color: "#115e59" }}>🔬 Exames solicitados · {formatarDataHora(lote.data)}</strong>
                      <button type="button" onClick={() => imprimirExamesDe(lote.itens, bloco.suspeita_diagnostica, ctx2aVia(bloco, lote.data))} style={{ backgroundColor: "#0f766e", color: "#fff", border: "none", padding: "5px 10px", borderRadius: "6px", cursor: "pointer", fontWeight: 600, fontSize: "12px", display: "flex", alignItems: "center", gap: "4px" }}>
                        <MdPrint size={14} /> Reimprimir
                      </button>
                    </div>
                    <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "12px", color: "#1f2937", lineHeight: 1.5 }}>
                      {lote.itens.map((e, idx) => <li key={idx}><strong>{e.nome}</strong>{e.prioridade === "URGENTE" ? " · URGENTE" : ""}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            ))}

            <div style={{ display: "flex", justifyContent: "flex-end", borderTop: "1px solid #e5e7eb", paddingTop: "14px" }}>
              <button type="button" onClick={() => setModalHistorico(false)} style={{ backgroundColor: "#f3f4f6", border: "none", padding: "8px 16px", borderRadius: "8px", cursor: "pointer", fontWeight: 600 }}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

export default Consultas;