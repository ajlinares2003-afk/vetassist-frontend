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

// Classificação em 3 níveis (Verde / Amarelo / Vermelho) cruzando o valor com a matriz de duplo limiar
// do perfil do paciente (espécie, porte e faixa etária), já resolvida em refTexto:
//   🟢 verde    -> dentro da faixa de REPOUSO (fisiológico ideal)
//   🟡 amarelo  -> fora do repouso, mas dentro do ENVELOPE clínico (estresse / "jaleco branco"): reavaliar após repouso
//   🔴 vermelho -> fora do envelope das duas faixas (instabilidade, dor, febre alta, choque...)
// O envelope é a união de repouso e clínica. Usar só a clínica estaria errado quando as faixas se
// sobrepõem de forma assimétrica (ex.: repouso 120-160 e clínica 130-180: um valor 125 é repouso, não crítico).
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
    if (v <= max) return { nivel: "ok", texto: "Dentro do esperado" };
    // TPC de 3 s ou mais indica perfusão comprometida (mesmo corte da regra de emergência da Triagem).
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

// SUGESTÃO de ECC pelo peso (mesma regra da Triagem). Não substitui a palpação: o veterinário confirma ou edita.
const calcularECC = (peso, pesoRef, aplicavel = true) => {
  if (aplicavel === false) return { texto: "Filhote: avaliar", nivel: null };
  const v = parseFloat(peso);
  const m = String(pesoRef || "").match(/(\d+(?:[.,]\d+)?)\s*[-–]\s*(\d+(?:[.,]\d+)?)/);
  if (isNaN(v) || v <= 0) return null;
  if (!m) return { texto: "Indeterminado", nivel: null };
  const min = parseFloat(m[1].replace(",", "."));
  const max = parseFloat(m[2].replace(",", "."));
  if (v < min * 0.85) return { texto: "1 a 2 (Muito Magro)", nivel: "alto" };
  if (v < min) return { texto: "3 (Abaixo do Peso)", nivel: "atencao" };
  if (v <= max) return { texto: "4 a 5 (Ideal)", nivel: "ok" };
  if (v <= max * 1.2) return { texto: "6 a 7 (Sobrepeso)", nivel: "atencao" };
  return { texto: "8 a 9 (Obeso)", nivel: "alto" };
};

// ECC (escala 1 a 9). O ideal vem do texto de referência da espécie ("Ideal: 5/9" ou "Ideal: 4 a 5").
const idealECC = (refTexto) => {
  const t = String(refTexto || "").replace(/\(?\s*escala[^)]*\)?/gi, "");
  const unico = t.match(/([1-9])\s*\/\s*9/);
  if (unico) return [Number(unico[1]), Number(unico[1])];
  const faixa = t.match(/([1-9])\s*(?:a|-|–)\s*([1-9])/i);
  if (faixa) return [Math.min(Number(faixa[1]), Number(faixa[2])), Math.max(Number(faixa[1]), Number(faixa[2]))];
  return null;
};

const avaliarECC = (valor, refTexto) => {
  const nums = (String(valor || "").match(/\d+/g) || []).slice(0, 2).map(Number);
  if (nums.length === 0) return null;
  if (nums.some((n) => n < 1 || n > 9)) return { nivel: "atencao", texto: "Fora da escala (1 a 9)" };
  const ideal = idealECC(refTexto);
  if (!ideal) return null; // sem referência confiável, não classifica
  const lo = Math.min(...nums);
  const hi = Math.max(...nums);
  const dist = hi < ideal[0] ? hi - ideal[0] : lo > ideal[1] ? lo - ideal[1] : 0;
  if (dist === 0) return { nivel: "ok", texto: "Dentro do ideal" };
  if (Math.abs(dist) === 1) return { nivel: "atencao", texto: dist < 0 ? "Levemente abaixo do ideal" : "Levemente acima do ideal" };
  return dist < 0
    ? { nivel: "baixo", texto: "Abaixo do ideal — condição corporal baixa" }
    : { nivel: "alto", texto: "Acima do ideal — sobrepeso/obesidade" };
};

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
  HUMANO: "Venda em Farmácia ou Drogaria",
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
// CRMV válido: número (4 a 7 dígitos) e UF do conselho
const crmvValido = (em) => /^\d{4,7}$/.test(String(em?.crmv || "").trim()) && /^[A-Za-z]{2}$/.test(String(em?.ufCrmv || "").trim());
const ehControlado = (i) =>
  typeof i.controladoManual === "boolean"
    ? i.controladoManual
    : Boolean(i.controlado) || REGEX_CONTROLADOS.test(semAcento(i.medicamento)) || /controle especial/i.test(i.observacoes || "");
// Dados da clínica (endereço, cidade, UF, telefone) lembrados neste navegador para a receita de controle especial
// Status em que o paciente ainda não foi liberado pela triagem (não aparece na fila de consulta)
const STATUS_FINALIZADOS = ["FINALIZADO", "Finalizado", "Aguardando Pagamento"];
const ehInternado = (st) => String(st || "").startsWith("Em Internação");
const CSS_LISTA = `
.cl-card,.cl-barra,.cl-hero{text-align:left}
.cl-hero{background:linear-gradient(135deg,#4338ca 0%,#4f46e5 55%,#818cf8 100%);border-radius:20px;padding:20px 26px;color:#fff;display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;box-shadow:0 10px 30px -14px rgba(79,70,229,.65);margin-bottom:18px}
.cl-hero h1{margin:0;font-size:24px;font-weight:800;display:flex;align-items:center;gap:10px;letter-spacing:-.3px;color:#fff}
.cl-hero p{margin:4px 0 0;font-size:13px;opacity:.9}
.cl-resumo{display:flex;gap:10px;flex-wrap:wrap}
.cl-resumo span{background:rgba(255,255,255,.16);border-radius:12px;padding:8px 14px;font-size:12px;font-weight:600}
.cl-resumo b{display:block;font-size:20px;font-weight:800;line-height:1.1}
.cl-barra{display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin-bottom:16px}
.cl-abas{display:flex;gap:6px;background:#fff;border:1px solid #e2e8f0;padding:5px;border-radius:14px;flex-wrap:wrap}
.cl-aba{border:none;background:transparent;color:#334155;padding:8px 13px;border-radius:10px;cursor:pointer;font-weight:700;font-size:13px;font-family:inherit;display:flex;align-items:center;gap:7px;transition:background .15s}
.cl-aba:hover{background:#f1f5f9}
.cl-aba.on{background:#4f46e5;color:#fff;box-shadow:0 6px 14px -8px #4f46e5}
.cl-aba.vazia:not(.on){color:#94a3b8}
.cl-aba em{font-style:normal;font-size:11px;font-weight:800;min-width:20px;text-align:center;padding:1px 7px;border-radius:99px;background:#e2e8f0;color:#475569}
.cl-aba.on em{background:rgba(255,255,255,.25);color:#fff}
.cl-busca{flex:1;min-width:220px;max-width:380px}
.cl-busca input{width:100%;height:42px;border:1px solid #e2e8f0;border-radius:12px;padding:0 14px;font-size:14px;outline:none;background:#fff;box-sizing:border-box;font-family:inherit}
.cl-busca input:focus{border-color:#4f46e5;box-shadow:0 0 0 3px rgba(79,70,229,.14)}
.cl-lista{display:flex;flex-direction:column;gap:10px}
.cl-card{display:flex;align-items:center;gap:16px;background:#fff;border:1px solid #e2e8f0;border-left:5px solid var(--cor);border-radius:16px;padding:14px 16px;transition:box-shadow .15s,transform .15s}
.cl-card:hover{box-shadow:0 12px 26px -16px rgba(15,23,42,.4);transform:translateY(-1px)}
.cl-avatar{width:48px;height:48px;border-radius:15px;background:var(--fundo);display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0}
.cl-id{width:190px;flex-shrink:0;min-width:0}
.cl-cod{font-size:11.5px;font-weight:800;color:#4f46e5;letter-spacing:.3px}
.cl-nome{font-size:16px;font-weight:800;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cl-tutor{font-size:12.5px;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cl-meio{flex:1;min-width:0}
.cl-queixa{font-size:13.5px;color:#334155;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.cl-chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:7px;align-items:center}
.cl-chip{font-size:12px;font-weight:700;padding:3px 10px;border-radius:99px;background:#f1f5f9;color:#475569;white-space:nowrap}
.cl-acoes{display:flex;gap:6px;align-items:center;justify-content:flex-end;flex-wrap:wrap;flex-shrink:0;max-width:450px}
.cl-b{border:none;border-radius:10px;padding:8px 12px;font-weight:700;font-size:12.5px;cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:5px;transition:filter .15s}
.cl-b:hover{filter:brightness(.94)}
.cl-b.prim{background:#4f46e5;color:#fff;box-shadow:0 6px 14px -9px #4f46e5}
.cl-b.chamar{background:#e0f2fe;color:#0369a1}
.cl-b.sec{background:#f1f5f9;color:#334155}
.cl-b.dang{background:#fef2f2;color:#dc2626;padding:8px 9px}
.cl-vazio{background:#fff;border:2px dashed #cbd5e1;border-radius:20px;text-align:center;padding:44px 20px;color:#64748b}
@media (max-width:980px){.cl-card{flex-wrap:wrap}.cl-id{width:auto;flex:1}.cl-meio{flex-basis:100%;order:3}.cl-acoes{max-width:none;width:100%;justify-content:flex-start;order:4}}
`;
const ESTILO_ESPECIE = (esp) => {
  const e = String(esp || "").toLowerCase();
  if (e.includes("can")) return { icone: "🐶", fundo: "#dbeafe" };
  if (e.includes("fel")) return { icone: "🐱", fundo: "#fce7f3" };
  if (e.includes("coelho") || e.includes("lago")) return { icone: "🐰", fundo: "#ffedd5" };
  if (e.includes("ave")) return { icone: "🦜", fundo: "#dcfce7" };
  if (e.includes("equ")) return { icone: "🐴", fundo: "#fef3c7" };
  return { icone: "🐾", fundo: "#e2e8f0" };
};
const COR_STATUS_LISTA = (st) => {
  const v = String(st || "");
  if (v.startsWith("Em Internação")) return v.includes("UTI") ? "#dc2626" : "#7c3aed";
  if (v === "Aguardando Cirurgia") return "#ea580c";
  if (v.startsWith("Chamando")) return "#dc2626";
  if (v === "Aguardando Pagamento") return "#d97706";
  if (["FINALIZADO", "Finalizado"].includes(v)) return "#16a34a";
  if (v === "Em Atendimento" || v === "EM_ATENDIMENTO") return "#4f46e5";
  return "#6366f1";
};

const moeda = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const STATUS_ANTES_DA_CONSULTA = [
  "AGUARDANDO_TRIAGEM", "Aguardando Triagem", "Aguardando Triagem (Recepção)",
  "Chamando para Triagem", "Em Triagem",
  "AGUARDANDO_VACINA", "Aguardando Vacina", "Em Vacinação",
];

const STATUS_ENCERRADOS = ["FINALIZADO", "CONCLUIDA", "Concluída", "CANCELADO", "Finalizado", "Cancelado"];
const ABAS_ATENDIMENTO = [
  { id: "ativos", rotulo: "🟢 Ativos" },
  { id: "atendimento", rotulo: "🩺 Em atendimento" },
  { id: "internados", rotulo: "🏥 Internados" },
  { id: "cirurgia", rotulo: "🔪 Cirurgia" },
  { id: "pagamento", rotulo: "💳 Pagamento" },
  { id: "finalizados", rotulo: "✅ Finalizados" },
  { id: "todos", rotulo: "📋 Todos" },
];
// Cada aba agrupa os status por etapa do fluxo. Status novo cai em "Ativos"/"Todos" mesmo sem aba própria.
const pertenceAba = (status, aba) => {
  const st = String(status || "");
  const encerrado = STATUS_ENCERRADOS.includes(st) || st === "Aguardando Pagamento";
  const preConsulta = STATUS_ANTES_DA_CONSULTA.includes(st);
  const internado = ehInternado(st);
  const cirurgia = st === "Aguardando Cirurgia" || st === "Em Cirurgia";
  const pagamento = st === "Aguardando Pagamento";
  switch (aba) {
    case "todos": return true;
    case "ativos": return !encerrado && !preConsulta;
    case "atendimento": return !encerrado && !preConsulta && !internado && !cirurgia;
    case "internados": return internado;
    case "cirurgia": return cirurgia;
    case "pagamento": return pagamento;
    case "finalizados": return encerrado;
    default: return true;
  }
};

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
  const [ecc, setEcc] = useState(""); // Escore de Condição Corporal (1 a 9)
  const [observacoes, setObservacoes] = useState("");

  const [indicacaoCirurgia, setIndicacaoCirurgia] = useState(false);
  const [indicacaoInternacao, setIndicacaoInternacao] = useState(null);   // { nivel, motivo } sugerido pelo Copiloto
  const [forcarCirurgia, setForcarCirurgia] = useState(false);
  const [justificativaCirurgica, setJustificativaCirurgica] = useState("");
  const [solicitarExamesPreventivos, setSolicitarExamesPreventivos] = useState(false);

  const [sugestoesCopiloto, setSugestoesCopiloto] = useState("");
  const [parecerEm, setParecerEm] = useState(null);
  const [laudosSalvos, setLaudosSalvos] = useState([]);
  const carregarLaudosSalvos = async (idConsulta) => {
    if (!idConsulta) { setLaudosSalvos([]); return; }
    try {
      const token = localStorage.getItem("token");
      const res = await api.get(`/consultas/${idConsulta}/anexos`, { headers: { Authorization: `Bearer ${token}` } });
      setLaudosSalvos(Array.isArray(res.data) ? res.data : []);
    } catch (_e) {
      setLaudosSalvos([]);
    }
  };
  const abrirLaudoSalvo = async (anexo) => {
    try {
      const token = localStorage.getItem("token");
      const res = await api.get(`/consultas/anexos/${anexo.id}/download`, { responseType: "blob", headers: { Authorization: `Bearer ${token}` } });
      window.open(URL.createObjectURL(res.data), "_blank");
    } catch (_e) {
      window.alert("Não foi possível abrir o laudo.");
    }
  };
  const [carregandoCopiloto, setCarregandoCopiloto] = useState(false);
  const [etapaProgressoIA, setEtapaProgressoIA] = useState("");
  const [arquivosExames, setArquivosExames] = useState([]);
  const [previewsExames, setPreviewsExames] = useState([]);

  const [refs, setRefs] = useState(null);
  const [modalValidarRefAberto, setModalValidarRefAberto] = useState(false);
  const [validandoRef, setValidandoRef] = useState(false);
  const [erroValidarRef, setErroValidarRef] = useState("");
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
  const [avisoRetornoExames, setAvisoRetornoExames] = useState("");
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
  // finalização do atendimento (conta / retorno)
  const [modalFinalizar, setModalFinalizar] = useState(false);
  const [retornoInfo, setRetornoInfo] = useState(null);
  const [ehRetorno, setEhRetorno] = useState(false);
  const [retornoMotivo, setRetornoMotivo] = useState("");
  const [retornoDias, setRetornoDias] = useState("");
  const [finalizando, setFinalizando] = useState(false);
  const [erroFinalizar, setErroFinalizar] = useState("");
  const [receitaGerada, setReceitaGerada] = useState(false);   // a sugestão da IA já foi pedida neste atendimento
  const [aplicClinica, setAplicClinica] = useState([]);      // medicações aplicadas NA CLÍNICA (não vão para o tutor; geram cobrança)
  const [aplicAlterada, setAplicAlterada] = useState(false);  // true = há mudança ainda não gravada no prontuário
  const [salvandoAplic, setSalvandoAplic] = useState(false);
  const [examesFinal, setExamesFinal] = useState([]);   // exames do atendimento com o destino escolhido ao finalizar
  const [mensagemSucesso, setMensagemSucesso] = useState("");
  useEffect(() => {
    if (!mensagemErro) return undefined;
    const t = setTimeout(() => setMensagemErro(""), 9000);
    return () => clearTimeout(t);
  }, [mensagemErro]);
  useEffect(() => {
    if (!mensagemSucesso) return undefined;
    const t = setTimeout(() => setMensagemSucesso(""), 5000);
    return () => clearTimeout(t);
  }, [mensagemSucesso]);
  
  const [consultaParaExcluir, setConsultaParaExcluir] = useState(null);
  const [modalExclusaoAberto, setModalExclusaoAberto] = useState(false);

  useEffect(() => {
    carregarConsultas();
    carregarAnimais();
    carregarUsuarios();
    carregarTutores();
  }, []);

  // carrega as aplicações na clínica já gravadas ao abrir um atendimento
  useEffect(() => {
    const id = consultaEditando?.id;
    if (!id) return;
    let cancelado = false;
    (async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await api.get(`/atendimento-ia/aplicacoes-clinica/${id}`, { headers: { Authorization: `Bearer ${token}` } });
        if (!cancelado) { setAplicClinica((res.data || []).map((i) => ({ ...i, _id: novoId() }))); setAplicAlterada(false); }
      } catch { /* sem registro ainda */ }
    })();
    return () => { cancelado = true; };
  }, [consultaEditando?.id]);

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

  const recarregarRefs = async () => {
    if (!animalId) return;
    try {
      const token = localStorage.getItem("token");
      const res = await api.get(`/triagem/referencias-salvas/${animalId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRefs(res.data || null);
    } catch (err) {
      console.warn("Erro ao recarregar referências:", err);
    }
  };

  // Confirma a referência da biblioteca (status PENDENTE -> VALIDADO). Vale para todo o perfil.
  const validarReferencia = async () => {
    if (!refs?.referencia_id || validandoRef) return;
    setValidandoRef(true);
    setErroValidarRef("");
    try {
      const token = localStorage.getItem("token");
      await api.post(`/triagem/referencias/${refs.referencia_id}/validar`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await recarregarRefs();
      setModalValidarRefAberto(false);
      setMensagemSucesso("✅ Referência validada e registrada com o seu usuário.");
    } catch (err) {
      setErroValidarRef(err.response?.data?.detail || "Não foi possível validar a referência.");
    } finally {
      setValidandoRef(false);
    }
  };

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
        // paciente internado (ou aguardando cirurgia) mantém o status ao clicar em Atender
        status: (ehInternado(consulta.status) || consulta.status === "Em Cirurgia") ? consulta.status
          : (consulta.status === "Aguardando Cirurgia" || consulta.indicacao_cirurgia) ? "Aguardando Cirurgia" : "Em Atendimento",
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

      // TPC, mucosas e ECC registrados no atendimento (tabela consulta); se o servidor ainda não tem a rota, segue sem eles
      let sinaisSalvos = {};
      try {
        const respSV = await api.get(`/sinais-vitais/${consulta.id}`, config);
        if (respSV.data) sinaisSalvos = respSV.data;
      } catch (errSV) {
        console.warn("Sinais vitais do atendimento indisponíveis.", errSV);
      }

      setCodigo(consulta.codigo || `CNS-${consulta.id}`);
      setAnimalId(consulta.animal_id || "");
      setQueixaPrincipal(consulta.queixa_principal || dadosTriagem?.queixa_principal || "");
      setExameFisico(consulta.exame_fisico || dadosTriagem?.exame_fisico || "");
      setSuspeitaDiagnostica(consulta.suspeita_diagnostica || "");
      setSugestoesCopiloto(consulta.parecer_copiloto || "");
      setParecerEm(consulta.parecer_copiloto_em || null);
      carregarLaudosSalvos(consulta.id);
      // O que o veterinário gravou no atendimento vale mais que a triagem da recepção (antes a triagem sobrescrevia as edições)
      setTemperatura(consulta.temperatura ?? dadosTriagem?.temperatura ?? "");
      setFrequenciaCardiaca(consulta.frequencia_cardiaca ?? dadosTriagem?.frequencia_cardiaca ?? "");
      setFrequenciaRespiratoria(consulta.frequencia_respiratoria ?? dadosTriagem?.frequencia_respiratoria ?? "");
      setPesoAtendimento(consulta.peso_atendimento ?? dadosTriagem?.peso ?? "");
      setTpcSegundos(sinaisSalvos.tpc_segundos ?? dadosTriagem?.tpc_segundos ?? consulta.tpc_segundos ?? "");
      setMucosas(sinaisSalvos.mucosas ?? dadosTriagem?.mucosas ?? consulta.mucosas ?? "Normocoradas");
      setEcc(sinaisSalvos.ecc ?? dadosTriagem?.ecc ?? consulta.ecc ?? "");
      // paciente internado continua com o status de internação ao reabrir o atendimento
      const statusAoAbrir = (ehInternado(consulta.status) || consulta.status === "Em Cirurgia") ? consulta.status
        : (consulta.status === "Aguardando Cirurgia" || consulta.indicacao_cirurgia) ? "Aguardando Cirurgia" : "Em Atendimento";
      setStatusAtendimento(statusAoAbrir);

      setConsultaEditando({ ...consulta, status: statusAoAbrir });
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
      if (consultaEditando?.id) formData.append("consulta_id", consultaEditando.id);
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
      if (ecc) formData.append("ecc", ecc);
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
      carregarLaudosSalvos(consultaEditando?.id);
      setParecerEm(new Date().toISOString());

      setIndicacaoInternacao(response.data.indicacao_internacao || null);
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
      const novas = (res.data.aplicacoes_clinica || []).map((i) => ({ ...i, _id: novoId() }));
      setAplicClinica((ant) => {
        // mantém o que já estava gravado/lançado à mão que a IA não repetiu; a sugestão nova substitui o que ela mesma gerou
        const nomes = new Set(novas.map((n) => String(n.medicamento || "").toLowerCase()));
        return [...novas, ...ant.filter((a) => a.manual && !nomes.has(String(a.medicamento || "").toLowerCase()))];
      });
      setAplicAlterada(true);
      setPesoUsadoReceita(res.data.peso_usado ?? null);
      setReceitaGerada(true);
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
    // Só gera sozinha na primeira vez: se já há sugestão gerada ou aplicações registradas no prontuário, não busca de novo.
    if (!receitaGerada && itensReceita.length === 0 && aplicClinica.length === 0 && !carregandoReceita) gerarReceitaIA();
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

  const aplicClinicaValidas = aplicClinica.filter((i) => String(i.medicamento || "").trim());
  const alterarAplic = (id, campo, valor) => { setAplicAlterada(true); setAplicClinica((prev) => prev.map((i) => (i._id === id ? { ...i, [campo]: valor } : i))); };
  const removerAplic = (id) => { setAplicAlterada(true); setAplicClinica((prev) => prev.filter((i) => i._id !== id)); };
  const adicionarAplic = () => { setAplicAlterada(true); setAplicClinica((prev) => [...prev, { _id: novoId(), manual: true, medicamento: "", dosagem: "", frequencia: "", duracao: "", quantidade: "", observacoes: "" }]); };

  const gravarAplicacoes = async (config) => {
    const cfgReq = config || { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } };
    await api.post("/atendimento-ia/aplicacoes-clinica", {
      consulta_id: consultaEditando.id,
      itens: aplicClinicaValidas.map((i) => ({
        medicamento: String(i.medicamento).trim(), dosagem: i.dosagem || null, frequencia: i.frequencia || null,
        duracao: i.duracao || null, observacoes: i.observacoes || null, recomendacoes: i.recomendacoes || null, quantidade: i.quantidade || null,
      })),
    }, cfgReq);
    setAplicAlterada(false);
  };

  const salvarAplicacoesNoProntuario = async () => {
    if (!consultaEditando?.id) { setErroReceita("Abra o atendimento pela lista (botão Atender) para gravar as aplicações."); return; }
    setSalvandoAplic(true);
    setErroReceita("");
    try {
      await gravarAplicacoes();
      setMensagemSucesso("✅ Aplicações na clínica registradas no prontuário!");
    } catch (error) {
      setErroReceita(mensagemApi(error, "Não foi possível registrar as aplicações na clínica."));
    } finally {
      setSalvandoAplic(false);
    }
  };

  const itensReceitaValidos = itensReceita.filter((i) => i.medicamento.trim());
  const pesoAtualNum = pesoAtendimento !== "" ? Number(pesoAtendimento) : null;
  const pesoMudouDesdeReceita = itensReceita.length > 0 && pesoAtualNum !== null && pesoUsadoReceita !== pesoAtualNum;

  const motivoBloqueioControlado = (() => {
    const ctrl = itensReceitaValidos.filter(ehControlado);
    if (ctrl.length === 0) return "";
    if (!emitente.nome.trim() || !crmvValido(emitente)) return "Preencha nome e CRMV válido (número e UF) do emitente (receita de controle especial).";
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
      if (!String(em.nome || "").trim() || !crmvValido(em)) {
        window.alert("Receita controlada: informe nome e CRMV válido (número e UF) do veterinário emitente.");
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
      setAvisoRetornoExames(res.data.ja_realizados?.length || String(res.data.aviso || "").startsWith("Retorno") ? String(res.data.aviso || "") : "");
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
    setEcc("");
    setObservacoes("");
    setIndicacaoCirurgia(false);
    setForcarCirurgia(false);
    setJustificativaCirurgica("");
    setSolicitarExamesPreventivos(false);
    setSugestoesCopiloto("");
    setParecerEm(null);
    setArquivosExames([]);
    setRefs(null);
    setMensagemErro("");
    setModalReceita(false);
    setItensReceita([]);
    setAlertasReceita([]);
    setAplicClinica([]);
    setAplicAlterada(false);
    setReceitaGerada(false);
    setIndicacaoInternacao(null);
    setObsReceita("");
    setPesoUsadoReceita(null);
    setReceitaConferida(false);
    setReceitaSalva(false);
    setErroReceita("");
    setModalExames(false);
    setExamesSugeridos([]);
    setGeradoExames(false);
    setErroExames("");
    setAvisoRetornoExames("");
    setNovoExame("");
    setExamesSalvos(false);
    setModalHistorico(false);
    setHistorico([]);
  };

  const abrirFinalizar = async () => {
    if (!consultaEditando?.id) {
      setMensagemErro("Abra o atendimento pela lista (botão Atender) para finalizar.");
      return;
    }
    setErroFinalizar("");
    setRetornoInfo(null);
    setEhRetorno(false);
    setRetornoMotivo("");
    setRetornoDias("");
    setExamesFinal([]);
    setModalFinalizar(true);
    try {
      const token = localStorage.getItem("token");
      try {
        const rex = await api.get(`/contas/exames-da-consulta/${consultaEditando.id}`, { headers: { Authorization: `Bearer ${token}` } });
        setExamesFinal((rex.data || []).map((e) => ({ ...e, destino: e.destino_sugerido || "CLINICA" })));
      } catch { setExamesFinal([]); }
      const res = await api.get(`/contas/retorno-sugerido/${consultaEditando.id}`, { headers: { Authorization: `Bearer ${token}` } });
      setRetornoInfo(res.data);
      setEhRetorno(Boolean(res.data?.sugerido));
    } catch {
      setRetornoInfo({ sugerido: false, origem: null, prazo_padrao: 15 });
    }
  };

  const confirmarFinalizar = async () => {
    setFinalizando(true);
    setErroFinalizar("");
    const origem = retornoInfo?.origem;
    const marcaRetorno = Boolean(ehRetorno && origem);
    await salvarConsulta({
      finalizar: true,
      dados: {
        exames: examesFinal.map((e) => ({ nome: e.nome, destino: e.destino })),
        retorno_gratuito: marcaRetorno,
        retorno_consulta_origem_id: marcaRetorno ? origem.id : null,
        retorno_motivo: marcaRetorno ? (retornoMotivo.trim() || null) : null,
        retorno_dias: retornoDias !== "" ? Number(retornoDias) : null,
      },
    });
    setFinalizando(false);
  };

  const salvarConsulta = async (arg) => {
    const finalizar = arg && arg.finalizar ? arg : null;   // chamado pelo onClick recebe o evento, que não tem "finalizar"
    const internar = arg && arg.internar ? arg : null;     // grava o atendimento e abre a Internação já preenchida
    const fecharAoSalvar = Boolean(arg && arg.fechar);     // "Salvar e fechar"; o botão "Salvar atendimento" mantém a tela aberta
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
      let statusFinal = (cirurgiaFinal || consultaEditando?.indicacao_cirurgia) && !ehInternado(statusAtendimento) ? "Aguardando Cirurgia" : statusAtendimento;

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
        ecc: ecc || null,
        parecer_copiloto: parecerCompletoIA || null,
        exames_anexados: arquivosExames.length > 0 ? arquivosExames.map(f => f.name).join(", ") : null,
        observacoes: observacoes || null,
        indicacao_cirurgia: Boolean(cirurgiaFinal),
        justificativa_cirurgica: justificativaCirurgica || null,
        solicitar_exames_preventivos: Boolean(solicitarExamesPreventivos)
      };

      const respSalvar = consultaEditando
        ? await api.put(`/consultas/${consultaEditando.id}`, novaConsulta, config)
        : await api.post("/consultas/", novaConsulta, config);
      const consultaSalva = respSalvar?.data || {};
      const idSalvo = consultaEditando?.id ?? consultaSalva.id;

      // TPC, mucosas e ECC não têm coluna no cadastro da consulta: vão pela rota de sinais vitais do atendimento
      let sinaisNaoGravados = false;
      if (idSalvo) {
        try {
          await api.put(`/sinais-vitais/${idSalvo}`, { tpc_segundos: tpcSegundos !== "" ? Number(tpcSegundos) : null, mucosas: mucosas || null, ecc: ecc || null }, config);
        } catch (errSV) {
          sinaisNaoGravados = true;
          console.warn("Não foi possível gravar TPC/mucosas/ECC:", errSV);
        }
      }

      if (internar && consultaEditando) {
        if (aplicAlterada) await gravarAplicacoes(config);
        const destino = {
          animalId: Number(animalId),
          consultaId: consultaEditando.id,
          nivel: indicacaoInternacao?.nivel || "MODERADO",
          motivo: String(indicacaoInternacao?.motivo || suspeitaDiagnostica || queixaPrincipal || "").slice(0, 200),
        };
        limparFormulario();
        setMostrarFormulario(false);
        navigate("/internacao", { state: destino });
        return;
      }

      let conta = null;
      if (finalizar && consultaEditando) {
        if (aplicAlterada) await gravarAplicacoes(config);   // as aplicações na clínica alimentam a cobrança
        // o prontuário já foi gravado acima; agora trava e envia a conta para o Caixa
        conta = (await api.post(`/contas/finalizar/${consultaEditando.id}`, finalizar.dados, config)).data;
      }

      if (!finalizar && !fecharAoSalvar) {
        // salva e continua na tela: o atendimento passa a existir (se era novo) e os próximos "Salvar" atualizam o mesmo registro
        setConsultaEditando((ant) => ({ ...(ant || {}), ...consultaSalva, id: idSalvo, status: statusFinal }));
        setStatusAtendimento(statusFinal);
        if (consultaSalva.codigo) setCodigo(consultaSalva.codigo);
        carregarConsultas();
        if (sinaisNaoGravados) setMensagemErro("⚠️ Atendimento salvo, mas o TPC/mucosas/ECC não foram gravados: o servidor ainda não tem a rota de sinais vitais.");
        else setMensagemSucesso("✅ Atendimento salvo. Você pode continuar editando.");
        return;
      }

      limparFormulario();
      setMostrarFormulario(false);
      setModalFinalizar(false);
      carregarConsultas();
      if (sinaisNaoGravados) setMensagemErro("⚠️ Atendimento salvo, mas o TPC/mucosas/ECC não foram gravados: o servidor ainda não tem a rota de sinais vitais.");
      if (conta) {
        const semPreco = (conta.itens || []).some((i) => i.sem_preco);
        setMensagemSucesso(`✅ Atendimento finalizado. Conta de ${moeda(conta.total)} enviada ao Caixa.` +
          (semPreco ? " Há itens sem preço cadastrado: a recepção ou o administrador precisa definir os valores." : ""));
      } else {
        setMensagemSucesso("✅ Atendimento clínico salvo com sucesso!");
      }
    } catch (error) {
      const msg = `❌ ${error.response?.data?.detail || error.message}`;
      if (finalizar) setErroFinalizar(msg); else setMensagemErro(msg);
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
    const statusVal = st || "AGUARDANDO_TRIAGEM";
    const configs = {
      AGUARDANDO_TRIAGEM: { bg: "#fef3c7", color: "#92400e", label: "⏳ Aguardando Triagem" },
      "Aguardando Triagem": { bg: "#fef3c7", color: "#92400e", label: "⏳ Aguardando Triagem" },
      "Aguardando Triagem (Recepção)": { bg: "#fef3c7", color: "#92400e", label: "⏳ Aguardando Triagem" },
      "Chamando para Triagem": { bg: "#fee2e2", color: "#991b1b", label: "📢 Chamando p/ Triagem" },
      "Em Triagem": { bg: "#fef3c7", color: "#92400e", label: "🩺 Em Triagem" },
      AGUARDANDO_VACINA: { bg: "#f3e8ff", color: "#6b21a8", label: "💉 Aguardando Vacina" },
      "Aguardando Vacina": { bg: "#f3e8ff", color: "#6b21a8", label: "💉 Aguardando Vacina" },
      "Em Vacinação": { bg: "#f3e8ff", color: "#6b21a8", label: "💉 Em Vacinação" },
      "Aguardando Cirurgia": { bg: "#ffedd5", color: "#9a3412", label: "🔪 Aguardando Cirurgia" },
      "Em Cirurgia": { bg: "#e0e7ff", color: "#3730a3", label: "🔪 Em Cirurgia" },
      EM_ATENDIMENTO: { bg: "#e0e7ff", color: "#3730a3", label: "💉 Em Atendimento" },
      "Em Atendimento": { bg: "#e0e7ff", color: "#3730a3", label: "💉 Em Atendimento" },
      "Aguardando Consulta (Fila Vet)": { bg: "#e0e7ff", color: "#3730a3", label: "🩺 Pronto para Consulta" },
      "Chamando para Consulta": { bg: "#fee2e2", color: "#991b1b", label: "📢 Chamando..." },
      FINALIZADO: { bg: "#dcfce7", color: "#166534", label: "✅ Finalizado" },
      "Finalizado": { bg: "#dcfce7", color: "#166534", label: "✅ Finalizado" },
      "Aguardando Pagamento": { bg: "#fef3c7", color: "#92400e", label: "💳 Aguardando Pagamento" },
      "Em Internação UTI": { bg: "#fee2e2", color: "#991b1b", label: "🏥 Em Internação — UTI" },
      "Em Internação": { bg: "#ede9fe", color: "#5b21b6", label: "🏥 Em Internação" },
      CANCELADO: { bg: "#fee2e2", color: "#991b1b", label: "❌ Cancelado" }
    };
    const conf = configs[statusVal] || { bg: "#f1f5f9", color: "#475569", label: String(statusVal) };
    return <span style={{ backgroundColor: conf.bg, color: conf.color, padding: "3px 11px", borderRadius: "999px", fontSize: "12px", fontWeight: "700", whiteSpace: "nowrap" }}>{conf.label}</span>;
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
      const fragmentos = textoLimpo.split(/(?=[A-Z][a-zà-ú\s]+:|(?<=\s)-\s|\u2022)/);
      linhasProcessadas = fragmentos.length > 1 ? fragmentos : [textoLimpo];
    } else {
      linhasProcessadas = linhasBrutas.filter(l => l.trim() !== "");
    }

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "6px", textAlign: "left" }}>
        {linhasProcessadas.map((linha, idx) => {
          let linhaTrim = linha.replace(/\*\*/g, "").trim();
          if (!linhaTrim) return null;

          // Linha com marcador de lista ("- ", "* ", "• ") é SEMPRE item: antes, "- Piotórax" (curto, sem ponto) virava
          // título com ":" e os diferenciais apareciam como títulos vazios. Título = sem marcador e terminado em ":",
          // todo em negrito, começando com "#", ou frase curta capitalizada.
          const original = linha.trim();
          const temMarcador = /^[-*•]\s+/.test(original);
          const todoNegrito = /^\*\*[^*]+\*\*:?$/.test(original);
          // "- Título:" curto, terminado em ":" e sem texto depois, é título de seção mesmo com hífen
          // (o modelo às vezes envia os títulos como itens de lista)
          const tituloComMarcador = temMarcador && linhaTrim.length <= 80 && /:\s*$/.test(linhaTrim);
          const ehTituloSecao = tituloComMarcador || !temMarcador && (
            linhaTrim.endsWith(":") || todoNegrito || /^#{1,4}\s/.test(original) ||
            (linhaTrim.match(/^[A-ZÀ-Ú][a-za-zà-ú\s]+$/) && linhaTrim.length < 35)
          );

          if (ehTituloSecao) {
            const tituloLimpo = linhaTrim.replace(/^#{1,4}\s+/, "").replace(/^[-*•]\s+/, "").replace(/:$/, "").trim();
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

  const contagemAbas = {};
  ABAS_ATENDIMENTO.forEach((a) => { contagemAbas[a.id] = consultas.filter((c) => pertenceAba(c.status || "", a.id)).length; });

  const consultasFiltradas = consultas.filter((c) => {
    const statusVal = c.status || "";
    if (!pertenceAba(statusVal, abaAtiva)) return false;

    const termo = busca.toLowerCase();
    const cod = (c.codigo || `CNS-${String(c.id).padStart(4, "0")}`).toLowerCase();
    const nomeA = obterNomeAnimal(c.animal_id).toLowerCase();
    const tutorA = obterTutorAnimal(animais.find((a) => a.id === c.animal_id)).toLowerCase();
    return cod.includes(termo) || nomeA.includes(termo) || tutorA.includes(termo) || String(c.queixa_principal || "").toLowerCase().includes(termo);
  });

  const estiloInput = { width: "100%", height: "42px", padding: "0 12px", border: "1px solid #dbe2ea", borderRadius: "10px", fontSize: "14px", outline: "none", backgroundColor: "#ffffff", boxSizing: "border-box" };
  const estiloLabel = { display: "block", fontSize: "12px", fontWeight: "700", color: "#475569", marginBottom: "6px", textAlign: "left" };

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

  // Sem referência para a faixa etária do paciente (usou-se a de adulto): não classifica temperatura,
  // FC e FR, para a tela não alertar com uma faixa que o próprio aviso manda ignorar.
  const semFaixaEtaria = !!refs?.ref_adulta_fallback;
  const alertaTemp = semFaixaEtaria ? null : avaliarSinal(temperatura, refs?.temperatura, "°C", " — reavaliar após repouso");
  const alertaFC = semFaixaEtaria ? null : avaliarSinal(frequenciaCardiaca, refs?.fc, "bpm", " — reavaliar após repouso");
  const alertaFR = semFaixaEtaria ? null : avaliarSinal(frequenciaRespiratoria, refs?.fr, "ir/min", " — reavaliar após repouso");
  // Perfil escolhido só pelo porte/grupo (sem a raça): peso fora da faixa pode ser perfil errado, não paciente fora do padrão.
  const perfilGenerico = ["porte", "grupo"].includes(refs?.correspondencia);
  // Peso de referência de adulto não se aplica a filhote (plano B): não compara.
  const alertaPesoBruto = refs?.peso_ref_aplicavel === false ? null : avaliarPeso(pesoAtendimento, refs?.peso_ref);
  const alertaPeso = alertaPesoBruto && alertaPesoBruto.nivel === "atencao" && perfilGenerico
    ? { nivel: "atencao", texto: `${alertaPesoBruto.texto} — perfil escolhido só pelo porte: confira raça e porte no cadastro` }
    : alertaPesoBruto;
  const alertaTPC = avaliarTPC(tpcSegundos, refs?.tpc);
  const alertaMucosas = avaliarMucosas(mucosas);
  const alertaECC = avaliarECC(ecc, refs?.ecc_ref);
  const sugestaoECC = calcularECC(pesoAtendimento, refs?.peso_ref, refs?.peso_ref_aplicavel);
  // Valor único (1 a 9) sugerido: o ponto médio do ideal da espécie. Evita gravar "4 a 5" como se fosse um escore.
  const idealRefECC = idealECC(refs?.ecc_ref);
  const valorSugeridoECC = idealRefECC ? String(Math.round((idealRefECC[0] + idealRefECC[1]) / 2)) : "";
  const mostrarSugestaoECC = !ecc && Boolean(sugestaoECC?.nivel) && Boolean(valorSugeridoECC);

  const temIndicacaoReal = indicacaoCirurgia || forcarCirurgia;
  const jaInternado = ehInternado(statusAtendimento) || ehInternado(consultaEditando?.status);

  const estiloOverlay = { position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1100, padding: "20px" };
  const estiloCaixaModal = { backgroundColor: "#ffffff", padding: "24px", borderRadius: "12px", maxWidth: "820px", width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)" };

  const renderCampoEmitente = (rotulo, chave, extra = {}) => (
    <div style={{ minWidth: 0, ...extra }}>
      <label htmlFor={`em-${chave}`} style={{ ...estiloLabel, fontSize: "12px", marginBottom: "4px" }}>{rotulo}</label>
      <input id={`em-${chave}`} type="text" value={emitente[chave] || ""} onChange={(e) => alterarEmitente(chave, e.target.value)} style={{ ...estiloInput, height: "36px", fontSize: "13px" }} />
    </div>
  );
  const impressaoBloqueada = !receitaConferida || itensReceitaValidos.length === 0 || Boolean(motivoBloqueioControlado);

  const estiloPainel = { border: "1px solid #e2e8f0", borderRadius: "18px", padding: "20px", backgroundColor: "#ffffff", minWidth: 0, boxShadow: "0 1px 2px rgba(15,23,42,.04), 0 10px 24px -20px rgba(15,23,42,.35)" };
  const estiloTituloPainel = { margin: "0 0 16px 0", color: "#0f172a", fontSize: "13px", fontWeight: 800, textTransform: "uppercase", letterSpacing: ".6px", textAlign: "left", borderLeft: "4px solid #4f46e5", paddingLeft: "10px" };
  const estiloLabelVital = { display: "block", fontSize: "12px", fontWeight: "700", color: "#475569", marginBottom: "6px", textAlign: "left" };
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

  const refsPendentes = Boolean(
    animalId && refs && (
      refs.status_ref
        ? ["PENDENTE", "RASCUNHO"].includes(refs.status_ref)
        : /pendente/i.test(refs.fonte_ref || "")
    )
  );
  // Só ADMIN e VETERINARIO validam (o backend também exige), e só linhas PENDENTE (não RASCUNHO).
  const podeValidarRef = ["ADMIN", "VETERINARIO"].includes(String(localStorage.getItem("perfil") || "").toUpperCase());
  const refValidavel = Boolean(animalId && refs?.referencia_id && refs?.status_ref === "PENDENTE" && podeValidarRef);
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
      <style>{CSS_LISTA}</style>
      <div className="cl-hero">
        <div>
          <h1><MdEvent size={32} /> {tituloPagina}</h1>
          <p>Fila de consultas, internações e atendimentos do dia</p>
        </div>
        <div className="cl-resumo">
          <span><b>{contagemAbas.atendimento || 0}</b>em atendimento</span>
          <span><b>{contagemAbas.internados || 0}</b>internados</span>
          <span><b>{contagemAbas.cirurgia || 0}</b>cirurgia</span>
          <span><b>{contagemAbas.pagamento || 0}</b>a cobrar</span>
        </div>
      </div>

      {(mensagemSucesso || mensagemErro) && (
        <div style={mostrarFormulario ? { position: "fixed", top: 16, right: 16, zIndex: 4000, maxWidth: 420, display: "flex", flexDirection: "column", gap: 8 } : { marginBottom: 15 }} role="status" aria-live="polite">
          {mensagemSucesso && <div style={{ backgroundColor: "#ecfdf5", color: "#065f46", border: "1px solid #a7f3d0", padding: "12px 16px", borderRadius: "12px", fontWeight: 600, boxShadow: mostrarFormulario ? "0 12px 30px -12px rgba(0,0,0,.3)" : "none" }}>{mensagemSucesso}</div>}
          {mensagemErro && <div style={{ backgroundColor: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca", padding: "12px 16px", borderRadius: "12px", fontWeight: 600, boxShadow: mostrarFormulario ? "0 12px 30px -12px rgba(0,0,0,.3)" : "none" }}>{mensagemErro}</div>}
        </div>
      )}

      {mostrarFormulario && (
        <div className="cns-form" style={{ backgroundColor: "#f8fafc", padding: "22px", borderRadius: "22px", marginBottom: "25px", border: "1px solid #e2e8f0", textAlign: "left", boxShadow: "0 18px 40px -28px rgba(15,23,42,.5)" }}>
          <style>{`
            @keyframes spin { to { transform: rotate(360deg); } }
            .cns-form button { border-radius: 10px !important; transition: filter .15s, box-shadow .15s; }
            .cns-form button:hover:not(:disabled) { filter: brightness(.95); }
            .cns-form textarea { border-radius: 12px !important; }
            .cns-cabecalho { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; background: linear-gradient(135deg, #eef2ff, #f5f3ff); border: 1px solid #c7d2fe; border-radius: 18px; padding: 14px 18px; margin-bottom: 18px; }
            .cns-barra-acoes { position: sticky; bottom: 0; z-index: 20; background: rgba(255,255,255,.94); backdrop-filter: blur(8px); border: 1px solid #e2e8f0 !important; border-radius: 18px; padding: 12px 16px !important; box-shadow: 0 -10px 30px -18px rgba(15,23,42,.45); margin-top: 18px !important; }
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

          <div className="cns-cabecalho">
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <div style={{ width: 48, height: 48, borderRadius: 15, background: ESTILO_ESPECIE(animais.find((a) => a.id === Number(animalId))?.especie).fundo, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>
                {ESTILO_ESPECIE(animais.find((a) => a.id === Number(animalId))?.especie).icone}
              </div>
              <div>
                <div style={{ fontSize: 11.5, fontWeight: 800, color: "#4f46e5", letterSpacing: ".5px" }}>ATENDIMENTO {codigo || "NOVO"}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>{animais.find((a) => a.id === Number(animalId))?.nome || "Selecione o paciente"}</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              {renderBadgeStatus(statusAtendimento)}
              {consultaEditando?.id && <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>Registro já criado: “Salvar” mantém você nesta tela</span>}
            </div>
          </div>

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
                  "cns-fr", "Freq. resp. (ir/min)",
                  <input id="cns-fr" type="number" value={frequenciaRespiratoria} onChange={(e) => setFrequenciaRespiratoria(e.target.value)} style={estiloAlertaVital(alertaFR)} />,
                  refTxt("fr"), alertaFR
                )}
                {renderCardVital(
                  "cns-tpc", "TPC (segundos)",
                  <input id="cns-tpc" type="number" step="0.1" min="0" value={tpcSegundos} onChange={(e) => setTpcSegundos(e.target.value)} style={estiloAlertaVital(alertaTPC)} />,
                  refTxt("tpc"), alertaTPC
                )}
                {renderCardVital(
                  "cns-mucosas", "Mucosas",
                  <select id="cns-mucosas" value={mucosas} onChange={(e) => setMucosas(e.target.value)} style={estiloAlertaVital(alertaMucosas)}>
                    <option value="Normocoradas">Normocoradas (Rosadas)</option>
                    <option value="Hipocoradas / Pálidas">Hipocoradas / Pálidas</option>
                    <option value="Cianóticas">Cianóticas</option>
                    <option value="Ictéricas">Ictéricas</option>
                    <option value="Congestas / Hiperêmicas">Congestas / Vermelhas</option>
                  </select>,
                  refTxt("mucosas"), alertaMucosas
                )}
                {renderCardVital(
                  "cns-ecc", "ECC (1 a 9)",
                  <input id="cns-ecc" type="text" inputMode="numeric" value={ecc} onChange={(e) => setEcc(e.target.value.replace(/[^1-9]/g, "").slice(0, 1))} placeholder="Ex.: 5" maxLength={1} style={estiloAlertaVital(alertaECC)} />,
                  <>
                    {refTxt("ecc_ref")}
                    {mostrarSugestaoECC && (
                      <span style={{ display: "block", marginTop: "4px", color: "#475569" }}>
                        Sugestão pelo peso: {sugestaoECC.texto} (confirme na palpação). Usar aplica {valorSugeridoECC}.{" "}
                        <button type="button" onClick={() => valorSugeridoECC && setEcc(valorSugeridoECC)}
                          style={{ border: "none", background: "none", color: "#0369a1", cursor: "pointer", fontSize: "11px", fontWeight: 700, padding: 0, textDecoration: "underline" }}>
                          Usar
                        </button>
                      </span>
                    )}
                  </>,
                  alertaECC
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
          <div style={{ background: "linear-gradient(180deg,#f0fdf4,#ecfdf5)", border: "1px solid #bbf7d0", borderRadius: "18px", padding: "20px", marginBottom: "8px", boxShadow: "0 10px 24px -22px rgba(22,163,74,.6)" }}>
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
                {refValidavel && (
                  <button
                    type="button"
                    onClick={() => { setErroValidarRef(""); setModalValidarRefAberto(true); }}
                    style={{ backgroundColor: "#ffffff", color: "#92400e", border: "1px solid #f59e0b", borderRadius: "8px", padding: "8px 12px", cursor: "pointer", fontWeight: 700, fontSize: "13px" }}
                  >
                    ✔ Validar referência
                  </button>
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
              A análise da IA é uma ferramenta de apoio à decisão e deve ser validada pelo médico-veterinário responsável.
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

            {laudosSalvos.length > 0 && (
              <div style={{ marginTop: "12px", padding: "10px 14px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px" }}>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>📎 Laudos salvos neste atendimento</div>
                {laudosSalvos.map((a) => (
                  <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", fontSize: "13px", padding: "4px 0", flexWrap: "wrap" }}>
                    <button type="button" onClick={() => abrirLaudoSalvo(a)} style={{ background: "none", border: "none", color: "#1d4ed8", cursor: "pointer", textAlign: "left", padding: 0 }}>{a.nome_original}</button>
                    <span style={{ color: "#6b7280", fontSize: "12px" }}>{a.criado_em ? new Date(a.criado_em).toLocaleString("pt-BR") : ""} · {Math.round((a.tamanho_bytes || 0) / 1024)} KB</span>
                  </div>
                ))}
              </div>
            )}
            {sugestoesCopiloto && (
              <div style={{ padding: "16px", backgroundColor: "#ffffff", borderRadius: "8px", border: "1px solid #d1d5db", marginTop: "14px" }}>
                <div style={{ fontSize: "14px", fontWeight: "bold", color: "#166534", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
                  🤖 Parecer Detalhado do Copiloto:
                  {parecerEm && (
                    <span style={{ marginLeft: "auto", fontSize: "12px", fontWeight: "normal", color: "#6b7280" }}>
                      Gerado em {new Date(parecerEm).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
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

              {indicacaoInternacao && jaInternado && (
                <div style={{ backgroundColor: "#f0fdf4", border: "1px solid #86efac", padding: "10px 14px", borderRadius: "8px", marginBottom: "10px" }}>
                  <div style={{ fontSize: "13px", fontWeight: "bold", color: "#166534" }}>🏥 Paciente já internado</div>
                  <div style={{ fontSize: "12px", color: "#475569", marginTop: "2px", lineHeight: 1.4 }}>O Copiloto confirma a indicação de internação ({indicacaoInternacao.nivel === "CRITICO" ? "crítico / UTI" : "moderado"}). Registre a evolução na tela de Internação.</div>
                </div>
              )}
              {indicacaoInternacao && !jaInternado && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap", backgroundColor: indicacaoInternacao.nivel === "CRITICO" ? "#fef2f2" : "#fffbeb", border: `1px solid ${indicacaoInternacao.nivel === "CRITICO" ? "#fca5a5" : "#fcd34d"}`, padding: "10px 14px", borderRadius: "8px", marginBottom: "10px" }}>
                  <div style={{ flex: 1, minWidth: "200px" }}>
                    <div style={{ fontSize: "13px", fontWeight: "bold", color: indicacaoInternacao.nivel === "CRITICO" ? "#991b1b" : "#92400e" }}>
                      🏥 Internação recomendada ({indicacaoInternacao.nivel === "CRITICO" ? "crítico / UTI" : "moderado"})
                    </div>
                    <div style={{ fontSize: "12px", color: "#475569", marginTop: "2px", lineHeight: 1.4 }}>{indicacaoInternacao.motivo}. A decisão é do veterinário.</div>
                  </div>
                  {consultaEditando?.id && animalId && (
                    <button type="button" onClick={() => salvarConsulta({ internar: true })} style={{ backgroundColor: indicacaoInternacao.nivel === "CRITICO" ? "#dc2626" : "#d97706", color: "white", border: "none", padding: "8px 14px", borderRadius: "8px", cursor: "pointer", fontWeight: 700, fontSize: "13px" }}>Encaminhar para internação</button>
                  )}
                </div>
              )}
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
          <div className="cns-barra-acoes" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", marginTop: "20px", paddingTop: "16px", borderTop: "1px solid #e5e7eb" }}>
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
              {consultaEditando?.id && animalId && !indicacaoInternacao && !jaInternado && (
                <button type="button" onClick={() => salvarConsulta({ internar: true })} title="Grava o atendimento e abre a Internação com o paciente preenchido"
                  style={{ backgroundColor: "#ffffff", color: "#374151", border: "1px solid #d1d5db", padding: "10px 16px", borderRadius: "8px", cursor: "pointer", fontWeight: "600" }}>
                  🏥 Internar
                </button>
              )}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
              <button type="button" onClick={() => { limparFormulario(); setMostrarFormulario(false); }} style={{ backgroundColor: "#ffffff", color: "#374151", border: "1px solid #d1d5db", padding: "10px 18px", borderRadius: "8px", cursor: "pointer", fontWeight: "600" }}>Fechar</button>
              {consultaEditando?.id && !(forcarCirurgia || indicacaoCirurgia) && (
                <button type="button" onClick={abrirFinalizar} title="Grava o prontuário, trava o atendimento e envia a conta para o Caixa" style={{ backgroundColor: "#2563eb", color: "white", border: "none", padding: "10px 20px", borderRadius: "8px", cursor: "pointer", fontWeight: "700", boxShadow: "0 2px 4px rgba(37, 99, 235, 0.35)" }}>🏁 Finalizar atendimento</button>
              )}
              <button type="button" onClick={() => salvarConsulta({ fechar: true })} title="Grava o atendimento e volta para a lista" style={{ backgroundColor: "#ffffff", color: "#166534", border: "1px solid #86efac", padding: "10px 18px", borderRadius: "8px", cursor: "pointer", fontWeight: "700" }}>Salvar e fechar</button>
              <button type="button" onClick={salvarConsulta} title="Grava o atendimento e continua na tela" style={{ backgroundColor: "#16a34a", color: "white", border: "none", padding: "10px 24px", borderRadius: "8px", cursor: "pointer", fontWeight: "700", boxShadow: "0 2px 4px rgba(22, 163, 74, 0.35)" }}>Salvar atendimento</button>
            </div>
          </div>
        </div>
      )}

      {/* TABELA DE CONSULTAS */}
      {!mostrarFormulario && (
        <>
          <div className="cl-barra">
            <div role="tablist" aria-label="Filtro de atendimentos" className="cl-abas">
              {ABAS_ATENDIMENTO.map((aba) => {
                const ativa = abaAtiva === aba.id;
                const qtd = contagemAbas[aba.id] || 0;
                return (
                  <button key={aba.id} role="tab" aria-selected={ativa} onClick={() => setAbaAtiva(aba.id)}
                    className={`cl-aba ${ativa ? "on" : ""} ${qtd === 0 && aba.id !== "todos" ? "vazia" : ""}`}>
                    {aba.rotulo}{aba.id !== "todos" && <em>{qtd}</em>}
                  </button>
                );
              })}
            </div>
            <div className="cl-busca">
              <input type="search" placeholder="Buscar por paciente, tutor, código ou queixa..." value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar atendimentos" />
            </div>
          </div>

          {consultasFiltradas.length === 0 ? (
            <div className="cl-vazio">
              <div style={{ fontSize: "44px" }}>🩺</div>
              <p style={{ fontSize: "17px", fontWeight: 800, color: "#334155", margin: "6px 0 4px" }}>Nenhum atendimento encontrado</p>
              <p style={{ fontSize: "13px", margin: 0 }}>{busca ? "Tente outro termo de busca ou outra aba." : "Quando houver pacientes nesta etapa, eles aparecem aqui."}</p>
            </div>
          ) : (
            <div className="cl-lista">
              {consultasFiltradas.map((c) => {
                const animal = animais.find((x) => x.id === c.animal_id);
                const esp = ESTILO_ESPECIE(animal?.especie);
                const tutor = obterTutorAnimal(animal);
                const encerrado = STATUS_FINALIZADOS.includes(c.status);
                const internado = ehInternado(c.status);
                const pesoTxt = obterPesoFormatado(c);
                return (
                  <div key={c.id} className="cl-card" style={{ "--cor": COR_STATUS_LISTA(c.status), "--fundo": esp.fundo }}>
                    <div className="cl-avatar">{esp.icone}</div>
                    <div className="cl-id">
                      <div className="cl-cod">{c.codigo || `CNS-${c.id}`}</div>
                      <div className="cl-nome" title={obterNomeAnimal(c.animal_id)}>{animal?.nome || "-"} <span style={{ fontSize: "11.5px", color: "#94a3b8", fontWeight: 600 }}>{animal ? (animal.codigo || `PET-${animal.id}`) : ""}</span></div>
                      <div className="cl-tutor" title={tutor}>{tutor ? `👤 ${tutor}` : animal?.especie || ""}</div>
                    </div>
                    <div className="cl-meio">
                      <div className="cl-queixa" title={c.queixa_principal || ""}>{c.queixa_principal || <span style={{ color: "#94a3b8" }}>Sem queixa registrada</span>}</div>
                      <div className="cl-chips">
                        {renderBadgeStatus(c.status)}
                        {pesoTxt !== "-" && <span className="cl-chip">⚖️ {pesoTxt}</span>}
                        {(c.temperatura || c.temperatura === 0) && <span className="cl-chip" style={{ background: "#fff" , border: "1px solid #e2e8f0" }}>{renderBadgeTemperatura(c.temperatura)}</span>}
                      </div>
                    </div>
                    <div className="cl-acoes">
                      {!encerrado && (
                        <button className="cl-b prim" onClick={() => iniciarAtendimentoVeterinario(c)}>💉 Atender</button>
                      )}
                      {!encerrado && !internado && (
                        <button className="cl-b chamar" onClick={(e) => chamarPaciente(c, e)}><MdCampaign size={16} /> Chamar</button>
                      )}
                      <button className="cl-b sec" onClick={() => abrirHistorico(c.animal_id)} title="Receitas e exames anteriores do paciente">📋 Histórico</button>
                      <button className="cl-b sec" onClick={() => setConsultaDetalhes(c)}><MdVisibility size={16} /> Ver</button>
                      {!encerrado && !internado && (
                        <button className="cl-b dang" title="Excluir atendimento" aria-label="Excluir atendimento" onClick={() => { setConsultaParaExcluir(c); setModalExclusaoAberto(true); }}><MdDelete size={17} /></button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* MODAL: FINALIZAR ATENDIMENTO */}
      {modalFinalizar && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1100, padding: "20px" }}>
          <div style={{ backgroundColor: "white", padding: "26px", borderRadius: "12px", maxWidth: "560px", width: "100%", maxHeight: "88vh", overflowY: "auto", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.15)" }}>
            <h3 style={{ margin: "0 0 6px", color: "#1e1b4b" }}>🏁 Finalizar atendimento</h3>
            <p style={{ margin: "0 0 14px", color: "#4b5563", fontSize: "14px" }}>
              O prontuário será gravado e travado, e a conta (consulta, medicações aplicadas na clínica e exames com preço cadastrado) segue para a recepção revisar e cobrar.
            </p>

            {aplicClinicaValidas.length > 0 && (
              <div style={{ border: "1px solid #c4b5fd", backgroundColor: "#f5f3ff", borderRadius: "8px", padding: "10px 12px", marginBottom: "14px" }}>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "#4c1d95", marginBottom: "4px" }}>💉 Medicações aplicadas na clínica (serão cobradas)</div>
                <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "12px", color: "#3b0764", lineHeight: 1.5 }}>
                  {aplicClinicaValidas.map((i) => <li key={i._id}>{i.medicamento}{i.quantidade ? ` — ${i.quantidade}` : ""}</li>)}
                </ul>
                <div style={{ fontSize: "11px", color: "#6b21a8", marginTop: "4px" }}>
                  O valor sai da Tabela de Preços (categoria Medicamento) pela quantidade informada. Para ajustar, edite as aplicações na tela da receita; a recepção também pode corrigir a quantidade no Caixa.
                </div>
              </div>
            )}

            {((itensReceita.length > 0 && !receitaSalva) || (examesSugeridos.length > 0 && !examesSalvos)) && (
              <div style={{ backgroundColor: "#fffbeb", border: "1px solid #fcd34d", color: "#92400e", padding: "10px 12px", borderRadius: "8px", fontSize: "13px", marginBottom: "14px" }}>
                ⚠️ {itensReceita.length > 0 && !receitaSalva ? "A receita ainda não foi salva no prontuário. " : ""}
                {examesSugeridos.length > 0 && !examesSalvos ? "Os exames ainda não foram salvos no prontuário. " : ""}
                Só o que estiver salvo entra na conta; salve antes de finalizar, se for o caso.
              </div>
            )}

            {retornoInfo?.origem ? (
              <div style={{ border: "1px solid #e5e7eb", borderRadius: "10px", padding: "12px 14px", marginBottom: "14px", backgroundColor: "#f9fafb" }}>
                <div style={{ fontSize: "13px", color: "#374151", marginBottom: "8px" }}>
                  Último atendimento finalizado deste paciente: <strong>{retornoInfo.origem.codigo || `#${retornoInfo.origem.id}`}</strong> em {retornoInfo.origem.data ? retornoInfo.origem.data.split("-").reverse().join("/") : "-"}
                  {retornoInfo.origem.dias_desde != null ? ` (há ${retornoInfo.origem.dias_desde} dia(s))` : ""}.
                  {retornoInfo.origem.queixa ? <> Queixa: <em>{String(retornoInfo.origem.queixa).slice(0, 140)}</em></> : null}
                </div>
                <div style={{ fontSize: "12px", color: retornoInfo.sugerido ? "#166534" : "#92400e", marginBottom: "8px" }}>
                  {retornoInfo.sugerido
                    ? `Dentro do prazo de retorno sem cobrança (${retornoInfo.origem.prazo_dias} dias).`
                    : `Fora do prazo de retorno sem cobrança (${retornoInfo.origem.prazo_dias} dias).`}
                </div>
                <label style={{ display: "flex", gap: "8px", alignItems: "flex-start", fontSize: "14px", cursor: "pointer", fontWeight: 600, color: "#111827" }}>
                  <input type="checkbox" checked={ehRetorno} onChange={(e) => setEhRetorno(e.target.checked)} style={{ marginTop: "3px" }} />
                  <span>É retorno do MESMO problema (consulta sem cobrança)
                    <span style={{ display: "block", fontWeight: 400, color: "#6b7280", fontSize: "12px" }}>Se o motivo for novo, deixe desmarcado: a consulta é cobrada normalmente. Exames e medicações do retorno continuam cobrados.</span>
                  </span>
                </label>
                {ehRetorno && (
                  <input type="text" value={retornoMotivo} onChange={(e) => setRetornoMotivo(e.target.value)} maxLength={500} placeholder="Observação (opcional): ex. reavaliação da ferida cirúrgica"
                    style={{ width: "100%", marginTop: "8px", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: "6px", fontSize: "13px", boxSizing: "border-box" }} />
                )}
              </div>
            ) : (
              <div style={{ fontSize: "13px", color: "#6b7280", marginBottom: "14px" }}>
                {retornoInfo ? "Nenhum atendimento anterior finalizado deste paciente: consulta cobrada normalmente." : "Verificando atendimentos anteriores..."}
              </div>
            )}

            {examesFinal.length > 0 && (
              <div style={{ marginBottom: "14px", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "10px 12px" }}>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "#111827", marginBottom: "6px" }}>🧪 Onde cada exame será realizado?</div>
                <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "8px" }}>
                  Na clínica: cobrado do tutor. Laboratório parceiro: a clínica cobra o tutor e paga o laboratório depois. Laboratório externo: o tutor paga direto ao laboratório (não entra na conta).
                </div>
                {examesFinal.map((e, idx) => (
                  <div key={`${e.nome}-${idx}`} style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "6px", flexWrap: "wrap" }}>
                    <span style={{ flex: "1 1 200px", fontSize: "13px", color: "#111827" }}>{e.nome}</span>
                    <select value={e.destino} onChange={(ev) => setExamesFinal((lista) => lista.map((x, i) => (i === idx ? { ...x, destino: ev.target.value } : x)))}
                      style={{ padding: "6px 8px", border: "1px solid #d1d5db", borderRadius: "6px", fontSize: "13px" }}>
                      <option value="CLINICA">Na clínica</option>
                      <option value="PARCEIRO">Laboratório parceiro (intermediação)</option>
                      <option value="EXTERNO">Laboratório externo (tutor paga direto)</option>
                    </select>
                  </div>
                ))}
              </div>
            )}

            <label style={{ display: "block", fontSize: "13px", color: "#374151", marginBottom: "14px" }}>
              Prazo de retorno sem cobrança para este caso (dias) — opcional
              <input type="number" min="1" max="365" value={retornoDias} onChange={(e) => setRetornoDias(e.target.value)} placeholder={`Padrão: ${retornoInfo?.prazo_padrao || 15} dias`}
                style={{ display: "block", width: "180px", marginTop: "4px", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: "6px", fontSize: "13px" }} />
            </label>

            {erroFinalizar && <div style={{ backgroundColor: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", padding: "10px 12px", borderRadius: "8px", fontSize: "13px", marginBottom: "12px" }}>{erroFinalizar}</div>}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button type="button" disabled={finalizando} onClick={() => setModalFinalizar(false)} style={{ backgroundColor: "#ffffff", color: "#374151", border: "1px solid #d1d5db", padding: "10px 18px", borderRadius: "8px", cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
              <button type="button" disabled={finalizando || !retornoInfo} onClick={confirmarFinalizar} style={{ backgroundColor: finalizando ? "#93c5fd" : "#2563eb", color: "white", border: "none", padding: "10px 20px", borderRadius: "8px", cursor: finalizando ? "wait" : "pointer", fontWeight: 700 }}>
                {finalizando ? "Finalizando..." : "Finalizar e enviar para o Caixa"}
              </button>
            </div>
          </div>
        </div>
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
                {consultaDetalhes.parecer_copiloto_em && (
                  <span style={{ marginLeft: "8px", fontSize: "12px", color: "#6b7280" }}>
                    Gerado em {new Date(consultaDetalhes.parecer_copiloto_em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
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

      {/* MODAL DE VALIDAÇÃO DA REFERÊNCIA */}
      {modalValidarRefAberto && refs && (
        <div role="dialog" aria-modal="true" aria-label="Validar referência" style={estiloOverlay}>
          <div style={{ ...estiloCaixaModal, maxWidth: "540px" }}>
            <h3 style={{ margin: "0 0 12px 0", color: "#111827" }}>Validar referência veterinária</h3>
            <div style={{ fontSize: "13px", color: "#374151", lineHeight: 1.6, backgroundColor: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "12px", marginBottom: "12px" }}>
              <div><strong>Perfil:</strong> {refs.perfil_ref}</div>
              <div><strong>Sexo:</strong> {refs.sexo_ref || "—"} · <strong>Faixa etária:</strong> {refs.faixa_ref || refs.faixa_etaria || "—"}</div>
              <div><strong>Peso:</strong> {String(refs.peso_ref || "").replace("💡 ", "")}</div>
              <div><strong>Temperatura:</strong> {refs.temperatura}</div>
              <div><strong>FC:</strong> {refs.fc}</div>
              <div><strong>FR:</strong> {refs.fr}</div>
              <div><strong>TPC:</strong> {refs.tpc} · <strong>Mucosas:</strong> {String(refs.mucosas || "").replace("💡 ", "")}</div>
              <div><strong>ECC:</strong> {String(refs.ecc_ref || "").replace("💡 ", "")}</div>
            </div>
            <div role="alert" style={{ backgroundColor: "#fffbeb", color: "#92400e", border: "1px solid #fcd34d", padding: "10px 12px", borderRadius: "8px", marginBottom: "12px", fontSize: "13px" }}>
              Esta validação vale para <strong>todos os pacientes futuros</strong> deste perfil, sexo e faixa etária, não só para este atendimento. Confirme apenas se você conferiu os valores acima contra uma fonte confiável.
              {refs.ref_adulta_fallback && (
                <div style={{ marginTop: "6px", fontWeight: 600 }}>
                  Atenção: esta é a referência de ADULTO, usada porque não há linha para a faixa etária deste paciente.
                </div>
              )}
            </div>
            {erroValidarRef && (
              <div role="alert" style={{ backgroundColor: "#fee2e2", color: "#991b1b", padding: "10px 12px", borderRadius: "8px", marginBottom: "12px", fontSize: "13px", fontWeight: 500 }}>
                {erroValidarRef}
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button onClick={() => setModalValidarRefAberto(false)} disabled={validandoRef} style={{ backgroundColor: "#f3f4f6", border: "none", padding: "8px 14px", borderRadius: "6px", cursor: "pointer", fontWeight: "600" }}>Cancelar</button>
              <button onClick={validarReferencia} disabled={validandoRef} style={{ backgroundColor: validandoRef ? "#9ca3af" : "#15803d", color: "white", border: "none", padding: "8px 14px", borderRadius: "6px", cursor: validandoRef ? "not-allowed" : "pointer", fontWeight: "600" }}>
                {validandoRef ? "Validando..." : "Confirmar validação"}
              </button>
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

            <div style={{ border: "1px solid #c4b5fd", backgroundColor: "#faf5ff", borderRadius: "8px", padding: "12px", marginBottom: "12px" }}>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "#4c1d95" }}>💉 Aplicações na clínica (não vão para o tutor)</div>
              <div style={{ fontSize: "12px", color: "#6b21a8", margin: "2px 0 8px" }}>
                Ficam registradas no prontuário e entram na conta na finalização, com a quantidade abaixo (nº de aplicações ou mL).
              </div>
              {aplicClinica.length === 0 && <div style={{ fontSize: "13px", color: "#6b7280", marginBottom: "8px" }}>Nenhuma aplicação na clínica registrada.</div>}
              {aplicClinica.map((a) => (
                <div key={a._id} style={{ display: "grid", gridTemplateColumns: "1.6fr 1.6fr 1.1fr 2.8fr auto", gap: "6px", marginBottom: "6px", alignItems: "center" }}>
                  <input value={a.medicamento || ""} onChange={(e) => alterarAplic(a._id, "medicamento", e.target.value)} placeholder="Medicamento" style={{ ...estiloInput, height: "34px", fontSize: "12px" }} />
                  <input value={a.dosagem || ""} onChange={(e) => alterarAplic(a._id, "dosagem", e.target.value)} placeholder="Dose" style={{ ...estiloInput, height: "34px", fontSize: "12px" }} />
                  <input value={a.frequencia || ""} onChange={(e) => alterarAplic(a._id, "frequencia", e.target.value)} placeholder="Frequência" style={{ ...estiloInput, height: "34px", fontSize: "12px" }} />
                  <input value={a.quantidade || ""} onChange={(e) => alterarAplic(a._id, "quantidade", e.target.value)} placeholder="Ex.: 2 (duas) aplicações (total ≈ 3,07 mL)" title="Quantidade usada para cobrar: nº de aplicações ou volume total em mL" style={{ ...estiloInput, height: "34px", fontSize: "12px" }} />
                  <button type="button" onClick={() => removerAplic(a._id)} title="Remover" style={{ border: "none", background: "none", color: "#b91c1c", cursor: "pointer", fontSize: "16px" }}>🗑</button>
                </div>
              ))}
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "6px" }}>
                <button type="button" onClick={adicionarAplic} style={{ border: "1px dashed #7c3aed", background: "#fff", color: "#5b21b6", borderRadius: "6px", padding: "6px 12px", cursor: "pointer", fontWeight: 600, fontSize: "12px" }}>+ Adicionar aplicação</button>
                <button type="button" disabled={salvandoAplic || !aplicAlterada || !consultaEditando?.id} onClick={salvarAplicacoesNoProntuario}
                  style={{ border: "none", borderRadius: "6px", padding: "6px 12px", fontWeight: 600, fontSize: "12px", cursor: aplicAlterada ? "pointer" : "default", backgroundColor: aplicAlterada && consultaEditando?.id ? "#7c3aed" : "#e5e7eb", color: aplicAlterada && consultaEditando?.id ? "#fff" : "#6b7280" }}>
                  {salvandoAplic ? "Salvando..." : aplicAlterada ? "Registrar aplicações no prontuário" : "✓ Registradas no prontuário"}
                </button>
              </div>
            </div>

            {!carregandoReceita && !erroReceita && itensReceita.length === 0 && (
              <div style={{ padding: "14px", backgroundColor: "#f8fafc", border: "1px dashed #cbd5e1", borderRadius: "8px", fontSize: "13px", color: "#475569", marginBottom: "12px" }}>
                {aplicClinica.length > 0
                  ? "Nenhuma medicação para o tutor levar para casa; as aplicações na clínica estão acima. Você pode adicionar medicamentos manualmente."
                  : "A IA não sugeriu medicação para este parecer. Você pode adicionar medicamentos manualmente."}
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

            {avisoRetornoExames && !carregandoExames && (
              <div role="status" style={{ backgroundColor: "#eff6ff", color: "#1e3a8a", border: "1px solid #bfdbfe", padding: "10px 12px", borderRadius: "8px", marginBottom: "12px", fontSize: "13px", lineHeight: 1.45 }}>
                {avisoRetornoExames}
              </div>
            )}

            {geradoExames && !carregandoExames && examesSugeridos.length === 0 && !avisoRetornoExames && (
              <div style={{ padding: "14px", backgroundColor: "#f8fafc", border: "1px dashed #cbd5e1", borderRadius: "8px", fontSize: "13px", color: "#475569", marginBottom: "12px" }}>
                A IA não considerou necessário solicitar exames para este parecer. Você pode adicionar exames manualmente.
              </div>
            )}

            {Object.keys(CATEGORIA_EXAME_ROTULO).map((cat) => {
              const lista = examesSugeridos.filter((e) => e.categoria === cat).sort((a, b) => Number(a.momento === "APOS_ESTABILIZACAO") - Number(b.momento === "APOS_ESTABILIZACAO"));
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
                        {ex.momento === "APOS_ESTABILIZACAO" && <span style={{ marginLeft: "8px", fontSize: "11px", fontWeight: 700, color: "#1e3a8a", backgroundColor: "#dbeafe", border: "1px solid #93c5fd", borderRadius: "999px", padding: "1px 8px" }}>Após estabilização</span>}
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