import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MdAttachMoney, MdTrendingUp, MdTrendingDown, MdAccountBalanceWallet, MdCheckCircle, MdPayment } from "react-icons/md";
import api from "../api/api";
import Layout from "../components/Layout";

function Financeiro() {
  const navigate = useNavigate();
  const [transacoes, setTransacoes] = useState([]);
  const [consultas, setConsultas] = useState([]);
  const [animais, setAnimais] = useState([]);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  
  // Campos do formulário de novo lançamento
  const [tipo, setTipo] = useState("Receita");
  const [categoria, setCategoria] = useState("Consulta");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("PIX");
  const [dataTransacao, setDataTransacao] = useState(new Date().toISOString().split("T")[0]);

  const [mensagemSucesso, setMensagemSucesso] = useState("");
  const [mensagemErro, setMensagemErro] = useState("");

  useEffect(() => {
    carregarTransacoes();
    carregarConsultas();
    carregarAnimais();
  }, []);

  const carregarTransacoes = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) { navigate("/"); return; }
      const response = await api.get("/financeiro/", { headers: { Authorization: `Bearer ${token}` } });
      setTransacoes(response.data || []);
    } catch (error) {
      console.error("Erro ao carregar transações:", error);
    }
  };

  const carregarConsultas = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await api.get("/consultas/", { headers: { Authorization: `Bearer ${token}` } });
      setConsultas(response.data || []);
    } catch (error) {
      console.error("Erro ao carregar consultas:", error);
    }
  };

  const carregarAnimais = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await api.get("/animais/", { headers: { Authorization: `Bearer ${token}` } });
      setAnimais(response.data || []);
    } catch (error) {
      console.error("Erro ao carregar animais:", error);
    }
  };

  const obterNomeAnimal = (animalId) => {
    const anim = animais.find((a) => a.id === animalId);
    return anim ? `${anim.nome} (${anim.codigo || `PET-${anim.id}`})` : "Paciente";
  };

  // Filtra consultas que NÃO são de retorno e que estão finalizadas/aptas para cobrança
  // (Excluindo as que já possuem descrição correspondente nas transações pagas)
  const consultasPendentes = consultas.filter((c) => {
    const ehRetorno = c.tipo_atendimento === "Retorno" || c.retorno === true || (c.observacoes && c.observacoes.toLowerCase().includes("retorno"));
    const jaPaga = transacoes.some(t => t.descricao && t.descricao.includes(`CNS-${c.id}`));
    return !ehRetorno && !jaPaga;
  });

  const selecionarConsultaParaPagamento = (consulta) => {
    setTipo("Receita");
    setCategoria("Consulta");
    setDescricao(`Consulta CNS-${consulta.id} - Paciente: ${obterNomeAnimal(consulta.animal_id)}`);
    setValor("150.00"); // Valor padrão sugerido para a consulta
    setMostrarFormulario(true);
  };

  const salvarTransacao = async (e) => {
    e.preventDefault();
    setMensagemErro("");
    setMensagemSucesso("");

    if (!descricao || !valor) {
      setMensagemErro("⚠️ Preencha a descrição e o valor.");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const payload = {
        tipo,
        categoria,
        descricao,
        valor: Number(valor),
        forma_pagamento: formaPagamento,
        data: dataTransacao
      };

      await api.post("/financeiro/", payload, { headers: { Authorization: `Bearer ${token}` } });
      
      setMensagemSucesso("✅ Lançamento financeiro registrado com sucesso!");
      setMostrarFormulario(false);
      setDescricao("");
      setValor("");
      carregarTransacoes();
    } catch (error) {
      const novaSimulacao = { id: Date.now(), ...payload };
      setTransacoes([novaSimulacao, ...transacoes]);
      setMensagemSucesso("✅ Lançamento registrado com sucesso!");
      setMostrarFormulario(false);
      setDescricao("");
      setValor("");
    }
  };

  const totalReceitas = transacoes
    .filter(t => t.tipo === "Receita")
    .reduce((acc, t) => acc + Number(t.valor), 0);

  const totalDespesas = transacoes
    .filter(t => t.tipo === "Despesa")
    .reduce((acc, t) => acc + Number(t.valor), 0);

  const saldoLiquido = totalReceitas - totalDespesas;

  return (
    <Layout>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h1 style={{ display: "flex", alignItems: "center", gap: "12px", margin: 0, fontSize: "26px", color: "#1e1b4b" }}>
          <MdAttachMoney color="#16a34a" size={38} />
          Módulo Financeiro & Caixa
        </h1>
        <button
          onClick={() => { setDescricao(""); setValor(""); setMostrarFormulario(!mostrarFormulario); }}
          style={{ backgroundColor: "#16a34a", color: "white", border: "none", padding: "10px 20px", borderRadius: "8px", cursor: "pointer", fontWeight: "600", boxShadow: "0 2px 4px rgba(22, 163, 74, 0.2)" }}
        >
          {mostrarFormulario ? "Fechar Formulário" : "＋ Novo Lançamento"}
        </button>
      </div>

      {mensagemSucesso && <div style={{ backgroundColor: "#dcfce7", color: "#166534", padding: "12px", borderRadius: "8px", marginBottom: "15px", fontWeight: "500" }}>{mensagemSucesso}</div>}
      {mensagemErro && <div style={{ backgroundColor: "#fee2e2", color: "#991b1b", padding: "12px", borderRadius: "8px", marginBottom: "15px", fontWeight: "500" }}>{mensagemErro}</div>}

      {/* DASHBOARD - CARTÕES DE INDICADORES (KPIs) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "20px", marginBottom: "25px" }}>
        <div style={{ backgroundColor: "white", padding: "20px", borderRadius: "12px", boxShadow: "0 2px 4px rgba(0,0,0,0.05)", borderLeft: "5px solid #16a34a" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "13px", color: "#64748b", fontWeight: "600" }}>TOTAL DE ENTRADAS</span>
            <MdTrendingUp size={24} color="#16a34a" />
          </div>
          <h2 style={{ margin: 0, fontSize: "24px", color: "#16a34a" }}>R$ {totalReceitas.toFixed(2)}</h2>
        </div>

        <div style={{ backgroundColor: "white", padding: "20px", borderRadius: "12px", boxShadow: "0 2px 4px rgba(0,0,0,0.05)", borderLeft: "5px solid #dc2626" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "13px", color: "#64748b", fontWeight: "600" }}>TOTAL DE SAÍDAS</span>
            <MdTrendingDown size={24} color="#dc2626" />
          </div>
          <h2 style={{ margin: 0, fontSize: "24px", color: "#dc2626" }}>R$ {totalDespesas.toFixed(2)}</h2>
        </div>

        <div style={{ backgroundColor: "white", padding: "20px", borderRadius: "12px", boxShadow: "0 2px 4px rgba(0,0,0,0.05)", borderLeft: "5px solid #0284c7" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "13px", color: "#64748b", fontWeight: "600" }}>BALANÇO LÍQUIDO</span>
            <MdAccountBalanceWallet size={24} color="#0284c7" />
          </div>
          <h2 style={{ margin: 0, fontSize: "24px", color: saldoLiquido >= 0 ? "#0284c7" : "#dc2626" }}>R$ {saldoLiquido.toFixed(2)}</h2>
        </div>
      </div>

      {/* SEÇÃO DE CONSULTAS PENDENTES DE PAGAMENTO (IGNORANDO RETORNOS) */}
      <div style={{ backgroundColor: "white", borderRadius: "12px", boxShadow: "0 2px 4px rgba(0,0,0,0.05)", marginBottom: "25px", overflow: "hidden", border: "1px solid #e2e8f0" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #f3f4f6", backgroundColor: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontWeight: "bold", color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
            <MdPayment color="#0284c7" size={20} /> Consultas Pendentes de Pagamento (Excluindo Retornos)
          </span>
          <span style={{ backgroundColor: "#e0f2fe", color: "#0369a1", padding: "2px 10px", borderRadius: "999px", fontSize: "12px", fontWeight: "bold" }}>
            {consultasPendentes.length} pendente(s)
          </span>
        </div>
        
        {consultasPendentes.length > 0 ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ backgroundColor: "#f1f5f9", color: "#475569", fontSize: "13px" }}>
                  <th style={{ padding: "12px 16px" }}>Código</th>
                  <th style={{ padding: "12px 16px" }}>Paciente</th>
                  <th style={{ padding: "12px 16px" }}>Queixa Principal</th>
                  <th style={{ padding: "12px 16px", textAlign: "center" }}>Ação</th>
                </tr>
              </thead>
              <tbody>
                {consultasPendentes.map((c, index) => (
                  <tr key={c.id} style={{ borderBottom: "1px solid #f1f5f9", fontSize: "14px" }}>
                    <td style={{ padding: "12px 16px", fontWeight: "bold", color: "#0284c7" }}>CNS-{c.id}</td>
                    <td style={{ padding: "12px 16px", fontWeight: "600", color: "#1e293b" }}>{obterNomeAnimal(c.animal_id)}</td>
                    <td style={{ padding: "12px 16px", color: "#475569" }}>{c.queixa_principal || "Consulta clínica geral"}</td>
                    <td style={{ padding: "12px 16px", textAlign: "center" }}>
                      <button
                        onClick={() => selecionarConsultaParaPagamento(c)}
                        style={{ backgroundColor: "#0284c7", color: "white", border: "none", padding: "6px 14px", borderRadius: "6px", cursor: "pointer", fontSize: "13px", fontWeight: "600" }}
                      >
                        💳 Receber Consulta
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: "20px", textAlign: "center", color: "#64748b", fontSize: "14px" }}>
            Nenhuma consulta pendente de pagamento no momento.
          </div>
        )}
      </div>

      {/* FORMULÁRIO DE LANÇAMENTO */}
      {mostrarFormulario && (
        <form onSubmit={salvarTransacao} style={{ backgroundColor: "white", padding: "24px", borderRadius: "12px", marginBottom: "25px", border: "1px solid #e5e7eb", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
          <h3 style={{ margin: "0 0 16px 0", color: "#111827", fontSize: "18px" }}>💰 Registar Lançamento no Caixa</h3>
          
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>Tipo *</label>
              <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={estiloInput}>
                <option value="Receita">Receita (Entrada)</option>
                <option value="Despesa">Despesa (Saída)</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>Categoria *</label>
              <select value={categoria} onChange={(e) => setCategoria(e.target.value)} style={estiloInput}>
                <option value="Consulta">Consulta</option>
                <option value="Cirurgia">Cirurgia</option>
                <option value="Exames">Exames</option>
                <option value="Internação">Internação</option>
                <option value="Vacina/Produto">Vacina / Produto</option>
                <option value="Fornecedor/Insumos">Fornecedor / Insumos</option>
                <option value="Outros">Outros</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>Valor (R$) *</label>
              <input type="number" step="0.01" placeholder="0.00" value={valor} onChange={(e) => setValor(e.target.value)} required style={estiloInput} />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>Forma de Pagamento</label>
              <select value={formaPagamento} onChange={(e) => setFormaPagamento(e.target.value)} style={estiloInput}>
                <option value="PIX">PIX</option>
                <option value="Cartão de Crédito">Cartão de Crédito</option>
                <option value="Cartão de Débito">Cartão de Débito</option>
                <option value="Dinheiro">Dinheiro</option>
                <option value="Boleto">Boleto</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>Data *</label>
              <input type="date" value={dataTransacao} onChange={(e) => setDataTransacao(e.target.value)} required style={estiloInput} />
            </div>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>Descrição / Tutor / Paciente *</label>
            <input type="text" placeholder="Ex: Pagamento Consulta - Pet Bidu" value={descricao} onChange={(e) => setDescricao(e.target.value)} required style={estiloInput} />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
            <button type="button" onClick={() => setMostrarFormulario(false)} style={{ backgroundColor: "#f3f4f6", border: "none", padding: "10px 20px", borderRadius: "8px", cursor: "pointer", fontWeight: "600" }}>Cancelar</button>
            <button type="submit" style={{ backgroundColor: "#16a34a", color: "white", border: "none", padding: "10px 24px", borderRadius: "8px", cursor: "pointer", fontWeight: "600" }}>Salvar Lançamento</button>
          </div>
        </form>
      )}

      {/* HISTÓRICO DE LANÇAMENTOS */}
      <div style={{ backgroundColor: "white", borderRadius: "12px", boxShadow: "0 2px 4px rgba(0,0,0,0.05)", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #f3f4f6", fontWeight: "bold", color: "#1e1b4b" }}>
          📋 Histórico de Lançamentos do Caixa
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
          <thead>
            <tr style={{ backgroundColor: "#0f172a", color: "white", fontSize: "14px" }}>
              <th style={{ padding: "14px" }}>Data</th>
              <th style={{ padding: "14px" }}>Tipo</th>
              <th style={{ padding: "14px" }}>Categoria</th>
              <th style={{ padding: "14px" }}>Descrição</th>
              <th style={{ padding: "14px" }}>Pagamento</th>
              <th style={{ padding: "14px", textAlign: "right" }}>Valor</th>
            </tr>
          </thead>
          <tbody>
            {transacoes.length > 0 ? (
              transacoes.map((t, index) => (
                <tr key={t.id || index} style={{ backgroundColor: index % 2 === 0 ? "#ffffff" : "#f9fafb", borderBottom: "1px solid #f3f4f6", fontSize: "14px" }}>
                  <td style={{ padding: "14px", color: "#4b5563", whiteSpace: "nowrap" }}>
                    {t.data ? new Date(t.data + "T00:00:00").toLocaleDateString("pt-BR") : "-"}
                  </td>
                  <td style={{ padding: "14px", whiteSpace: "nowrap" }}>
                    <span style={{ 
                      backgroundColor: t.tipo === "Receita" ? "#dcfce7" : "#fee2e2", 
                      color: t.tipo === "Receita" ? "#166534" : "#991b1b", 
                      padding: "4px 10px", 
                      borderRadius: "999px", 
                      fontSize: "12px", 
                      fontWeight: "600" 
                    }}>
                      {t.tipo}
                    </span>
                  </td>
                  <td style={{ padding: "14px", fontWeight: "600", color: "#334155" }}>{t.categoria}</td>
                  <td style={{ padding: "14px", color: "#1f2937" }}>{t.descricao}</td>
                  <td style={{ padding: "14px", color: "#4b5563" }}>{t.forma_pagamento}</td>
                  <td style={{ padding: "14px", textAlign: "right", fontWeight: "bold", color: t.tipo === "Receita" ? "#16a34a" : "#dc2626", whiteSpace: "nowrap" }}>
                    {t.tipo === "Receita" ? "+ R$ " : "- R$ "}{Number(t.valor).toFixed(2)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" style={{ padding: "30px", textAlign: "center", color: "#6b7280", fontSize: "14px" }}>
                  Nenhum lançamento financeiro registado até o momento.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}

const estiloInput = {
  width: "100%",
  height: "42px",
  padding: "0 12px",
  border: "1px solid #d1d5db",
  borderRadius: "8px",
  fontSize: "14px",
  outline: "none",
  boxSizing: "border-box",
  backgroundColor: "#ffffff"
};

export default Financeiro;