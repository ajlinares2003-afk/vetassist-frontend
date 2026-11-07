import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MdAttachMoney, MdAdd, MdDelete, MdRefresh } from "react-icons/md";
import api from "../api/api";
import Layout from "../components/Layout";

const moeda = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const arred = (v) => Math.round((Number(v) || 0) * 100) / 100;
const dataBR = (iso) => (iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "-");
const FORMAS = ["Dinheiro", "Pix", "Cartão de débito", "Cartão de crédito", "Transferência"];
const CATEGORIAS = ["CONSULTA", "RETORNO", "EXAME", "MEDICAMENTO", "PROCEDIMENTO", "INTERNACAO", "CIRURGIA", "INSUMO", "OUTRO"];
const ROTULO_CAT = { CONSULTA: "Consulta", RETORNO: "Retorno", EXAME: "Exame", MEDICAMENTO: "Medicamento", PROCEDIMENTO: "Procedimento", INTERNACAO: "Internação", CIRURGIA: "Cirurgia", INSUMO: "Insumo", OUTRO: "Outro" };

const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const dataSo = (iso) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "-");
const mesAtual = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };

const estiloInput = { padding: "7px 9px", border: "1px solid #d1d5db", borderRadius: "6px", fontSize: "13px", boxSizing: "border-box", width: "100%" };
const mensagemApi = (error, padrao) => {
  const d = error?.response?.data?.detail;
  return typeof d === "string" && d ? d : padrao;
};

function Caixa() {
  const navigate = useNavigate();
  const perfil = localStorage.getItem("perfil") || "RECEPCAO";
  const token = () => localStorage.getItem("token");
  const cfg = () => ({ headers: { Authorization: `Bearer ${token()}` } });

  const [aba, setAba] = useState("AGUARDANDO_PAGAMENTO");
  const [mesLab, setMesLab] = useState(mesAtual());
  const [resumoLab, setResumoLab] = useState(null);
  const [lista, setLista] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  const [conta, setConta] = useState(null);        // conta aberta no painel
  const [itens, setItens] = useState([]);
  const [desconto, setDesconto] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [forma, setForma] = useState("");
  const [precos, setPrecos] = useState([]);
  const [precoEscolhido, setPrecoEscolhido] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erroConta, setErroConta] = useState("");

  const somenteLeitura = conta?.status !== "AGUARDANDO_PAGAMENTO";

  useEffect(() => {
    if (!["ADMIN", "RECEPCAO"].includes(perfil)) { navigate("/dashboard"); return; }
    carregarPrecos();
  }, []);
  useEffect(() => { if (aba === "LAB") carregarLab(); else carregarLista(); }, [aba, mesLab]);

  const carregarLab = async () => {
    setCarregando(true); setErro("");
    try {
      const res = await api.get(`/contas/laboratorio/resumo?mes=${mesLab}`, cfg());
      setResumoLab(res.data);
    } catch (e) {
      setResumoLab(null);
      setErro(mensagemApi(e, "Não foi possível carregar o relatório do laboratório."));
    } finally { setCarregando(false); }
  };

  const imprimirRecibo = async () => {
    setErroConta("");
    try {
      const { data } = await api.get(`/contas/${conta.id}/recibo`, cfg());
      const cl = data.clinica || {}, at = data.atendimento || {}, ct = data.conta || {};
      const linhasItens = (ct.itens || []).map((i) => `<tr><td>${esc(i.descricao)}</td><td class="n">${esc(i.quantidade)}</td><td class="n">${esc(moeda(i.valor_unitario))}</td><td class="n">${esc(moeda(i.valor_total))}</td></tr>`).join("");
      const meds = (data.medicamentos || []).map((m) => `<li>${esc(m.medicamento)}${m.dosagem ? ` — ${esc(m.dosagem)}` : ""}${m.frequencia ? `, ${esc(m.frequencia)}` : ""}${m.duracao ? `, ${esc(m.duracao)}` : ""}${m.tipo_uso ? ` <em>(${esc(m.tipo_uso)})</em>` : ""}</li>`).join("");
      const exClin = (ct.itens || []).filter((i) => i.categoria === "EXAME").map((i) => `<li>${esc(i.descricao)}${i.destino === "PARCEIRO" ? " <em>(laboratório parceiro)</em>" : ""}</li>`).join("");
      const exExt = String(ct.exames_externos || "").split(";").map((x) => x.trim()).filter(Boolean).map((x) => `<li>${esc(x)}</li>`).join("");
      const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Recibo ${esc(ct.consulta_codigo)}</title>
<style>body{font-family:Arial,sans-serif;font-size:13px;color:#111;margin:28px;max-width:780px}h1{font-size:18px;margin:0}h2{font-size:14px;margin:18px 0 6px;border-bottom:1px solid #999;padding-bottom:3px}
table{width:100%;border-collapse:collapse}th,td{border-bottom:1px solid #ddd;padding:5px 6px;text-align:left}th{background:#f3f4f6}.n{text-align:right}.sm{font-size:11px;color:#444}.ass{margin-top:46px;text-align:center}.ass div{border-top:1px solid #000;width:320px;margin:0 auto;padding-top:4px}
@media print{button{display:none}}</style></head><body>
<button onclick="window.print()">Imprimir / salvar PDF</button>
<h1>${esc(cl.nome || "Clínica veterinária")}</h1>
<div class="sm">${[cl.cnpj ? `CNPJ: ${esc(cl.cnpj)}` : "", esc(cl.endereco || ""), esc(cl.telefone || "")].filter(Boolean).join(" • ")}</div>
<h2>Recibo e relatório de atendimento veterinário (para reembolso)</h2>
<p><b>Atendimento:</b> ${esc(ct.consulta_codigo)} em ${esc(dataSo(at.data_consulta))}<br>
<b>Tutor:</b> ${esc(at.tutor_nome)}${at.tutor_cpf ? ` — CPF ${esc(at.tutor_cpf)}` : ""}<br>
<b>Paciente:</b> ${esc(at.animal_nome)} (${esc([at.especie, at.raca, at.sexo, at.idade].filter(Boolean).join(", "))})${at.microchip ? ` — microchip ${esc(at.microchip)}` : ""}<br>
<b>Médico-veterinário:</b> ${esc(at.vet_nome)}${at.vet_crmv ? ` — CRMV ${esc(at.vet_crmv)}` : ""}</p>
<h2>Relatório clínico</h2>
<p><b>Queixa principal:</b> ${esc(at.queixa_principal)}<br>
<b>Exame físico:</b> ${esc(at.exame_fisico || "-")}<br>
<b>Suspeita diagnóstica:</b> ${esc(at.suspeita_diagnostica || "-")}</p>
${meds ? `<p><b>Medicações prescritas/aplicadas:</b></p><ul>${meds}</ul>` : ""}
${exClin ? `<p><b>Exames realizados (cobrados nesta conta):</b></p><ul>${exClin}</ul>` : ""}
${exExt ? `<p><b>Exames encaminhados a laboratório externo (pagos diretamente pelo tutor ao laboratório):</b></p><ul>${exExt}</ul>` : ""}
<h2>Serviços e valores</h2>
<table><thead><tr><th>Descrição</th><th class="n">Qtd</th><th class="n">Valor unit.</th><th class="n">Total</th></tr></thead><tbody>${linhasItens}</tbody></table>
<p class="n">Subtotal: ${esc(moeda(ct.subtotal))}${Number(ct.desconto) > 0 ? ` &nbsp; Desconto: ${esc(moeda(ct.desconto))}` : ""}<br><b>Total pago: ${esc(moeda(ct.total))}</b> — ${esc(ct.forma_pagamento || "-")} em ${esc(dataSo(ct.paga_em))}</p>
<div class="ass"><div>${esc(at.vet_nome || "Médico-veterinário responsável")}${at.vet_crmv ? ` — CRMV ${esc(at.vet_crmv)}` : ""}</div></div>
<p class="sm">Este documento é um recibo e relatório clínico para apresentação ao plano de saúde. Não substitui nota fiscal de serviço.</p>
</body></html>`;
      const w = window.open("", "_blank");
      if (!w) { setErroConta("O navegador bloqueou a janela de impressão. Libere pop-ups para este site."); return; }
      w.document.open(); w.document.write(html); w.document.close();
    } catch (e) {
      setErroConta(mensagemApi(e, "Não foi possível gerar o recibo."));
    }
  };

  const carregarLista = async () => {
    setCarregando(true);
    setErro("");
    try {
      const res = await api.get(`/contas/pendentes?status=${aba}`, cfg());
      setLista(res.data || []);
    } catch (e) {
      setErro(mensagemApi(e, "Não foi possível carregar as contas."));
    } finally {
      setCarregando(false);
    }
  };

  const carregarPrecos = async () => {
    try {
      const res = await api.get("/contas/precos?somente_ativos=true", cfg());
      setPrecos(res.data || []);
    } catch { setPrecos([]); }
  };

  const abrirConta = async (id) => {
    setErroConta("");
    try {
      const res = await api.get(`/contas/${id}`, cfg());
      preencherPainel(res.data);
    } catch (e) {
      setErro(mensagemApi(e, "Não foi possível abrir a conta."));
    }
  };

  const preencherPainel = (c) => {
    setConta(c);
    setItens((c.itens || []).map((i, idx) => ({ ...i, valor_unitario: arred(i.valor_unitario).toFixed(2), _k: `${i.id || "n"}-${idx}-${Math.random().toString(36).slice(2, 6)}` })));
    setDesconto(c.desconto ? String(c.desconto) : "");
    setObservacoes(c.observacoes || "");
    setForma(c.forma_pagamento && c.forma_pagamento !== "Isento" ? c.forma_pagamento : "");
    setPrecoEscolhido("");
  };

  const subtotal = useMemo(() => arred(itens.reduce((s, i) => s + arred(i.quantidade) * arred(i.valor_unitario), 0)), [itens]);
  const descontoNum = Math.min(arred(desconto), subtotal);
  const total = Math.max(arred(subtotal - descontoNum), 0);
  const semValor = itens.filter((i) => i.sem_preco && arred(i.valor_unitario) === 0).length;

  const alterarItem = (k, campo, valor) =>
    setItens((prev) => prev.map((i) => {
      if (i._k !== k) return i;
      const novo = { ...i, [campo]: valor };
      if (campo === "valor_unitario") novo.sem_preco = false;   // quem digitou o valor assume o preço
      return novo;
    }));
  const removerItem = (k) => setItens((prev) => prev.filter((i) => i._k !== k));
  const adicionarManual = () =>
    setItens((prev) => [...prev, { _k: `m-${Math.random().toString(36).slice(2, 8)}`, categoria: "OUTRO", descricao: "", quantidade: 1, valor_unitario: "0.00", origem: "MANUAL", sem_preco: false, nota: null }]);
  const adicionarDaTabela = () => {
    const p = precos.find((x) => String(x.id) === String(precoEscolhido));
    if (!p) return;
    setItens((prev) => [...prev, { _k: `t-${p.id}-${Math.random().toString(36).slice(2, 6)}`, categoria: p.categoria, descricao: p.nome, quantidade: 1, valor_unitario: arred(p.valor).toFixed(2), origem: "MANUAL", sem_preco: false, nota: null,
      destino: p.categoria === "EXAME" ? (p.custo_parceiro != null ? "PARCEIRO" : "CLINICA") : null,
      custo_laboratorio: p.categoria === "EXAME" ? (p.custo_parceiro ?? null) : null, laboratorio: p.categoria === "EXAME" ? (p.laboratorio || null) : null }]);
    setPrecoEscolhido("");
  };

  const corpoEdicao = () => ({
    itens: itens
      .filter((i) => String(i.descricao || "").trim())
      .map((i) => ({ categoria: i.categoria, descricao: String(i.descricao).trim(), quantidade: arred(i.quantidade), valor_unitario: arred(i.valor_unitario), origem: i.origem || "MANUAL", sem_preco: Boolean(i.sem_preco), nota: i.nota || null,
        destino: i.categoria === "EXAME" ? (i.destino || null) : null, custo_laboratorio: i.custo_laboratorio ?? null, laboratorio: i.laboratorio || null })),
    desconto: descontoNum,
    observacoes: observacoes.trim() || null,
  });

  const salvarEdicao = async () => {
    const res = await api.put(`/contas/${conta.id}`, corpoEdicao(), cfg());
    preencherPainel(res.data);
    return res.data;
  };

  const aoSalvar = async () => {
    setSalvando(true); setErroConta(""); setSucesso("");
    try { await salvarEdicao(); setSucesso("Alterações da conta salvas."); }
    catch (e) { setErroConta(mensagemApi(e, "Não foi possível salvar a conta.")); }
    finally { setSalvando(false); }
  };

  const aoPagar = async () => {
    setErroConta(""); setSucesso("");
    if (total > 0 && !FORMAS.includes(forma)) { setErroConta("Escolha a forma de pagamento."); return; }
    let confirmarSemValor = false;
    if (semValor > 0) {
      if (!window.confirm(`${semValor} item(ns) estão sem valor definido (R$ 0,00). Registrar o pagamento mesmo assim, como cortesia?`)) return;
      confirmarSemValor = true;
    }
    setSalvando(true);
    try {
      await salvarEdicao();
      const res = await api.post(`/contas/${conta.id}/pagar`, { forma_pagamento: forma || null, confirmar_itens_sem_valor: confirmarSemValor }, cfg());
      setSucesso(`✅ Pagamento registrado: ${moeda(res.data.total)}${res.data.forma_pagamento ? ` (${res.data.forma_pagamento})` : ""}. Atendimento finalizado.`);
      setConta(null);
      carregarLista();
    } catch (e) {
      setErroConta(mensagemApi(e, "Não foi possível registrar o pagamento."));
    } finally {
      setSalvando(false);
    }
  };

  const aoReabrir = async () => {
    if (!window.confirm("Reabrir o atendimento? A conta será descartada e o veterinário poderá corrigir o prontuário e finalizar de novo.")) return;
    setSalvando(true); setErroConta("");
    try {
      await api.post(`/contas/${conta.id}/reabrir`, {}, cfg());
      setSucesso("Atendimento reaberto: volta para a lista do veterinário.");
      setConta(null);
      carregarLista();
    } catch (e) {
      setErroConta(mensagemApi(e, "Não foi possível reabrir o atendimento."));
    } finally {
      setSalvando(false);
    }
  };

  const abaBtn = (id, rotulo) => (
    <button type="button" onClick={() => setAba(id)} style={{ padding: "8px 16px", borderRadius: "8px", border: "none", cursor: "pointer", fontWeight: 600, fontSize: "13px",
      backgroundColor: aba === id ? "#4f46e5" : "#eef2ff", color: aba === id ? "#fff" : "#3730a3" }}>{rotulo}</button>
  );

  return (
    <Layout>
      <div style={{ width: "100%", maxWidth: "1100px", margin: "0 auto", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "18px" }}>
          <div style={{ width: "42px", height: "42px", borderRadius: "10px", backgroundColor: "#0D9488", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><MdAttachMoney size={24} /></div>
          <div>
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: "#0F172A" }}>Caixa — contas dos atendimentos</h1>
            <p style={{ margin: "2px 0 0", fontSize: "13px", color: "#64748B" }}>Revise os itens, aplique desconto e registre o pagamento. O valor entra no Financeiro.</p>
          </div>
        </div>

        {sucesso && <div style={{ backgroundColor: "#f0fdf4", border: "1px solid #86efac", color: "#166534", padding: "10px 14px", borderRadius: "8px", fontSize: "14px", marginBottom: "12px" }}>{sucesso}</div>}
        {erro && <div style={{ backgroundColor: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", padding: "10px 14px", borderRadius: "8px", fontSize: "14px", marginBottom: "12px" }}>{erro}</div>}

        <div style={{ display: "flex", gap: "8px", marginBottom: "14px", alignItems: "center" }}>
          {abaBtn("AGUARDANDO_PAGAMENTO", "💳 Aguardando pagamento")}
          {abaBtn("PAGA", "✅ Pagas")}
          {abaBtn("LAB", "🧪 Laboratório parceiro")}
          <button type="button" onClick={aba === "LAB" ? carregarLab : carregarLista} title="Atualizar" style={{ marginLeft: "auto", border: "1px solid #d1d5db", backgroundColor: "#fff", borderRadius: "8px", padding: "7px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", fontSize: "13px" }}><MdRefresh size={16} /> Atualizar</button>
        </div>

        {aba === "LAB" && (
          <div style={{ backgroundColor: "#fff", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", padding: "16px", marginBottom: "14px" }}>
            <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap", marginBottom: "12px" }}>
              <label style={{ fontSize: "13px", color: "#475569" }}>Mês{" "}
                <input type="month" value={mesLab} onChange={(e) => e.target.value && setMesLab(e.target.value)} style={{ ...estiloInput, width: "auto" }} />
              </label>
              <span style={{ fontSize: "12px", color: "#6b7280" }}>Exames de laboratório parceiro em contas já pagas. Use para conferir a fatura mensal do laboratório.</span>
            </div>
            {carregando ? <div style={{ color: "#6b7280" }}>Carregando...</div> : !resumoLab || resumoLab.itens.length === 0 ? (
              <div style={{ color: "#6b7280", fontSize: "14px" }}>Nenhum exame de laboratório parceiro pago neste mês.</div>
            ) : (
              <>
                <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: "12px", fontSize: "14px" }}>
                  <div>Cobrado dos tutores: <strong>{moeda(resumoLab.total_cobrado)}</strong></div>
                  <div>Custo dos laboratórios: <strong>{moeda(resumoLab.total_custo)}</strong></div>
                  <div>Margem: <strong>{moeda(resumoLab.total_margem)}</strong></div>
                </div>
                {resumoLab.itens_sem_custo > 0 && <div style={{ backgroundColor: "#fffbeb", border: "1px solid #fcd34d", color: "#92400e", padding: "8px 12px", borderRadius: "8px", fontSize: "13px", marginBottom: "10px" }}>⚠️ {resumoLab.itens_sem_custo} exame(s) sem custo cadastrado: cadastre o custo na Tabela de Preços para a margem ficar correta.</div>}
                <div style={{ overflowX: "auto", marginBottom: "12px" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                    <thead><tr style={{ backgroundColor: "#f8fafc", color: "#475569", textAlign: "left" }}><th style={{ padding: "8px" }}>Laboratório</th><th style={{ padding: "8px" }}>Exames</th><th style={{ padding: "8px", textAlign: "right" }}>Cobrado</th><th style={{ padding: "8px", textAlign: "right" }}>Custo</th><th style={{ padding: "8px", textAlign: "right" }}>Margem</th></tr></thead>
                    <tbody>{resumoLab.laboratorios.map((g) => (
                      <tr key={g.laboratorio} style={{ borderTop: "1px solid #f1f5f9" }}><td style={{ padding: "8px", fontWeight: 600 }}>{g.laboratorio}</td><td style={{ padding: "8px" }}>{g.exames}</td><td style={{ padding: "8px", textAlign: "right" }}>{moeda(g.cobrado)}</td><td style={{ padding: "8px", textAlign: "right" }}>{moeda(g.custo)}</td><td style={{ padding: "8px", textAlign: "right" }}>{moeda(g.margem)}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", minWidth: "640px" }}>
                    <thead><tr style={{ backgroundColor: "#f8fafc", color: "#475569", textAlign: "left" }}><th style={{ padding: "8px" }}>Pago em</th><th style={{ padding: "8px" }}>Atendimento</th><th style={{ padding: "8px" }}>Paciente</th><th style={{ padding: "8px" }}>Exame</th><th style={{ padding: "8px" }}>Laboratório</th><th style={{ padding: "8px", textAlign: "right" }}>Cobrado</th><th style={{ padding: "8px", textAlign: "right" }}>Custo</th></tr></thead>
                    <tbody>{resumoLab.itens.map((i, idx) => (
                      <tr key={`${i.conta_id}-${idx}`} style={{ borderTop: "1px solid #f1f5f9" }}><td style={{ padding: "8px" }}>{dataBR(i.paga_em)}</td><td style={{ padding: "8px" }}>{i.consulta_codigo}</td><td style={{ padding: "8px" }}>{i.animal_nome}</td><td style={{ padding: "8px" }}>{i.exame}</td><td style={{ padding: "8px" }}>{i.laboratorio}</td><td style={{ padding: "8px", textAlign: "right" }}>{moeda(i.cobrado)}</td><td style={{ padding: "8px", textAlign: "right" }}>{i.custo == null ? "—" : moeda(i.custo)}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {aba !== "LAB" && (
        <div style={{ backgroundColor: "#fff", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
            <thead>
              <tr style={{ backgroundColor: "#f8fafc", color: "#475569", textAlign: "left" }}>
                <th style={{ padding: "12px" }}>Atendimento</th><th style={{ padding: "12px" }}>Paciente</th><th style={{ padding: "12px" }}>Tutor</th>
                <th style={{ padding: "12px" }}>{aba === "PAGA" ? "Pago em" : "Finalizado em"}</th><th style={{ padding: "12px", textAlign: "right" }}>Total</th><th style={{ padding: "12px" }}></th>
              </tr>
            </thead>
            <tbody>
              {carregando ? (
                <tr><td colSpan="6" style={{ padding: "20px", color: "#6b7280" }}>Carregando...</td></tr>
              ) : lista.length === 0 ? (
                <tr><td colSpan="6" style={{ padding: "20px", color: "#6b7280" }}>{aba === "PAGA" ? "Nenhuma conta paga ainda." : "Nenhuma conta aguardando pagamento."}</td></tr>
              ) : lista.map((c) => (
                <tr key={c.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "12px", fontWeight: 700, color: "#4f46e5" }}>{c.consulta_codigo}{c.retorno_gratuito ? <span style={{ marginLeft: "6px", fontSize: "11px", backgroundColor: "#dcfce7", color: "#166534", padding: "2px 6px", borderRadius: "999px" }}>retorno</span> : null}</td>
                  <td style={{ padding: "12px" }}>{c.animal_nome}</td>
                  <td style={{ padding: "12px" }}>{c.tutor_nome}</td>
                  <td style={{ padding: "12px" }}>{dataBR(aba === "PAGA" ? c.paga_em : c.finalizada_em)}</td>
                  <td style={{ padding: "12px", textAlign: "right", fontWeight: 700 }}>{moeda(c.total)}</td>
                  <td style={{ padding: "12px", textAlign: "right" }}>
                    <button type="button" onClick={() => abrirConta(c.id)} style={{ backgroundColor: aba === "PAGA" ? "#f3f4f6" : "#4f46e5", color: aba === "PAGA" ? "#111827" : "#fff", border: "none", padding: "7px 14px", borderRadius: "6px", cursor: "pointer", fontWeight: 600, fontSize: "13px" }}>
                      {aba === "PAGA" ? "Ver" : "Revisar e cobrar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </div>

      {conta && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: "16px" }}>
          <div style={{ backgroundColor: "#fff", borderRadius: "12px", maxWidth: "900px", width: "100%", maxHeight: "92vh", overflowY: "auto", padding: "22px", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.15)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", marginBottom: "10px" }}>
              <div>
                <h3 style={{ margin: 0, color: "#1e1b4b" }}>{conta.consulta_codigo} — {conta.animal_nome}</h3>
                <div style={{ fontSize: "13px", color: "#6b7280" }}>Tutor: {conta.tutor_nome}{conta.tutor_telefone ? ` • ${conta.tutor_telefone}` : ""}{conta.veterinario_nome ? ` • Vet.: ${conta.veterinario_nome}` : ""}</div>
              </div>
              <button type="button" onClick={() => setConta(null)} style={{ border: "none", background: "none", fontSize: "22px", cursor: "pointer", color: "#6b7280" }}>×</button>
            </div>

            {conta.retorno_gratuito && <div style={{ backgroundColor: "#f0fdf4", border: "1px solid #86efac", color: "#166534", padding: "8px 12px", borderRadius: "8px", fontSize: "13px", marginBottom: "10px" }}>🔁 Retorno do mesmo problema (consulta sem cobrança){conta.retorno_motivo ? `: ${conta.retorno_motivo}` : ""}</div>}
            {conta.exames_externos && <div style={{ backgroundColor: "#eff6ff", border: "1px solid #bfdbfe", color: "#1e40af", padding: "8px 12px", borderRadius: "8px", fontSize: "13px", marginBottom: "10px" }}>🧪 Exames em laboratório externo (tutor paga direto): {conta.exames_externos}</div>}
            {conta.avisos && <div style={{ backgroundColor: "#fffbeb", border: "1px solid #fcd34d", color: "#92400e", padding: "8px 12px", borderRadius: "8px", fontSize: "13px", marginBottom: "10px" }}>⚠️ {conta.avisos.split(" | ").join(" ")}</div>}
            {conta.status === "PAGA" && <div style={{ backgroundColor: "#f0fdf4", border: "1px solid #86efac", color: "#166534", padding: "8px 12px", borderRadius: "8px", fontSize: "13px", marginBottom: "10px" }}>✅ Paga em {dataBR(conta.paga_em)} — {conta.forma_pagamento || "-"}</div>}

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", minWidth: "700px" }}>
                <thead><tr style={{ color: "#475569", textAlign: "left", backgroundColor: "#f8fafc" }}>
                  <th style={{ padding: "8px", width: "120px" }}>Tipo</th><th style={{ padding: "8px" }}>Descrição</th><th style={{ padding: "8px", width: "80px" }}>Qtd</th>
                  <th style={{ padding: "8px", width: "110px" }}>Valor unit.</th><th style={{ padding: "8px", width: "100px", textAlign: "right" }}>Total</th><th style={{ width: "36px" }}></th>
                </tr></thead>
                <tbody>
                  {itens.map((i) => (
                    <tr key={i._k} style={{ borderTop: "1px solid #f1f5f9", verticalAlign: "top" }}>
                      <td style={{ padding: "6px 8px" }}>
                        <select disabled={somenteLeitura} value={i.categoria} onChange={(e) => alterarItem(i._k, "categoria", e.target.value)} style={estiloInput}>
                          {CATEGORIAS.map((c) => <option key={c} value={c}>{ROTULO_CAT[c]}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: "6px 8px" }}>
                        <input disabled={somenteLeitura} value={i.descricao} maxLength={300} onChange={(e) => alterarItem(i._k, "descricao", e.target.value)} style={estiloInput} />
                        {i.sem_preco && arred(i.valor_unitario) === 0 && <div style={{ color: "#b45309", fontSize: "11px", marginTop: "2px" }}>⚠️ Sem preço cadastrado — defina o valor ou remova o item.</div>}
                        {i.categoria === "EXAME" && i.destino === "PARCEIRO" && <div style={{ color: "#6d28d9", fontSize: "11px", marginTop: "2px" }}>🧪 Laboratório parceiro{i.laboratorio ? ` (${i.laboratorio})` : ""} — custo: {i.custo_laboratorio != null ? moeda(i.custo_laboratorio) : "não cadastrado"}</div>}
                        {i.nota && !(i.sem_preco && arred(i.valor_unitario) === 0) && <div style={{ color: "#6b7280", fontSize: "11px", marginTop: "2px" }}>{i.nota}</div>}
                      </td>
                      <td style={{ padding: "6px 8px" }}><input disabled={somenteLeitura} type="number" min="0" step="0.01" value={i.quantidade} onChange={(e) => alterarItem(i._k, "quantidade", e.target.value)} style={estiloInput} /></td>
                      <td style={{ padding: "6px 8px" }}><input disabled={somenteLeitura} type="number" min="0" step="0.01" value={i.valor_unitario} onChange={(e) => alterarItem(i._k, "valor_unitario", e.target.value)} onBlur={(e) => alterarItem(i._k, "valor_unitario", arred(e.target.value).toFixed(2))} style={estiloInput} /></td>
                      <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 600, paddingTop: "12px" }}>{moeda(arred(i.quantidade) * arred(i.valor_unitario))}</td>
                      <td style={{ padding: "6px 0" }}>{!somenteLeitura && <button type="button" onClick={() => removerItem(i._k)} title="Remover item" style={{ border: "none", background: "none", cursor: "pointer", color: "#b91c1c" }}><MdDelete size={18} /></button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!somenteLeitura && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", margin: "12px 0" }}>
                <select value={precoEscolhido} onChange={(e) => setPrecoEscolhido(e.target.value)} style={{ ...estiloInput, width: "320px" }}>
                  <option value="">Adicionar da tabela de preços...</option>
                  {precos.map((p) => <option key={p.id} value={p.id}>{ROTULO_CAT[p.categoria]} — {p.nome} ({moeda(p.valor)})</option>)}
                </select>
                <button type="button" disabled={!precoEscolhido} onClick={adicionarDaTabela} style={{ border: "1px solid #c7d2fe", backgroundColor: "#eef2ff", color: "#3730a3", borderRadius: "6px", padding: "7px 12px", cursor: precoEscolhido ? "pointer" : "not-allowed", fontWeight: 600, fontSize: "13px" }}>Adicionar</button>
                <button type="button" onClick={adicionarManual} style={{ border: "1px dashed #9ca3af", backgroundColor: "#fff", borderRadius: "6px", padding: "7px 12px", cursor: "pointer", fontWeight: 600, fontSize: "13px", display: "flex", alignItems: "center", gap: "4px" }}><MdAdd size={16} /> Item manual (ex.: insumo, cirurgia, internação)</button>
              </div>
            )}

            <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "flex-start", marginTop: "8px" }}>
              <div style={{ flex: "1 1 280px" }}>
                <label style={{ fontSize: "12px", color: "#475569" }}>Observações</label>
                <textarea disabled={somenteLeitura} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} maxLength={1000} rows={3} style={{ ...estiloInput, resize: "vertical" }} />
              </div>
              <div style={{ flex: "0 0 270px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", marginBottom: "6px" }}><span>Subtotal</span><strong>{moeda(subtotal)}</strong></div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "14px", marginBottom: "6px", gap: "8px" }}>
                  <span>Desconto (R$)</span>
                  <input disabled={somenteLeitura} type="number" min="0" step="0.01" value={desconto} onChange={(e) => setDesconto(e.target.value)} style={{ ...estiloInput, width: "110px", textAlign: "right" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "18px", fontWeight: 800, color: "#0f172a", borderTop: "2px solid #e2e8f0", paddingTop: "8px", marginBottom: "10px" }}><span>Total</span><span>{moeda(total)}</span></div>
                {!somenteLeitura && (
                  <select value={forma} onChange={(e) => setForma(e.target.value)} style={estiloInput}>
                    <option value="">Forma de pagamento...</option>
                    {FORMAS.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                )}
              </div>
            </div>

            {erroConta && <div style={{ backgroundColor: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", padding: "10px 12px", borderRadius: "8px", fontSize: "13px", marginTop: "12px" }}>{erroConta}</div>}

            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "10px", marginTop: "16px" }}>
              <div>
                {perfil === "ADMIN" && conta.status === "AGUARDANDO_PAGAMENTO" && (
                  <button type="button" disabled={salvando} onClick={aoReabrir} style={{ border: "1px solid #fca5a5", backgroundColor: "#fff", color: "#b91c1c", borderRadius: "8px", padding: "9px 14px", cursor: "pointer", fontWeight: 600, fontSize: "13px" }}>↩ Reabrir atendimento (ADMIN)</button>
                )}
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                {conta.status === "PAGA" && <button type="button" onClick={imprimirRecibo} style={{ border: "1px solid #a7f3d0", backgroundColor: "#ecfdf5", color: "#065f46", borderRadius: "8px", padding: "9px 16px", cursor: "pointer", fontWeight: 600 }}>🖨 Recibo e relatório (reembolso)</button>}
                <button type="button" onClick={() => setConta(null)} style={{ border: "1px solid #d1d5db", backgroundColor: "#fff", borderRadius: "8px", padding: "9px 16px", cursor: "pointer", fontWeight: 600 }}>Fechar</button>
                {!somenteLeitura && (
                  <>
                    <button type="button" disabled={salvando} onClick={aoSalvar} style={{ border: "1px solid #c7d2fe", backgroundColor: "#eef2ff", color: "#3730a3", borderRadius: "8px", padding: "9px 16px", cursor: "pointer", fontWeight: 600 }}>Salvar alterações</button>
                    <button type="button" disabled={salvando} onClick={aoPagar} style={{ border: "none", backgroundColor: salvando ? "#86efac" : "#16a34a", color: "#fff", borderRadius: "8px", padding: "9px 20px", cursor: salvando ? "wait" : "pointer", fontWeight: 700 }}>Registrar pagamento</button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

export default Caixa;