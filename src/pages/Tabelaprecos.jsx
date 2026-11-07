import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MdReceiptLong, MdSave, MdAdd } from "react-icons/md";
import api from "../api/api";
import Layout from "../components/Layout";

const CATEGORIAS = ["CONSULTA", "RETORNO", "EXAME", "MEDICAMENTO", "PROCEDIMENTO", "INTERNACAO", "CIRURGIA", "INSUMO", "OUTRO"];
const ROTULO_CAT = { CONSULTA: "Consulta", RETORNO: "Retorno", EXAME: "Exame", MEDICAMENTO: "Medicamento", PROCEDIMENTO: "Procedimento", INTERNACAO: "Internação", CIRURGIA: "Cirurgia", INSUMO: "Insumo", OUTRO: "Outro" };
const UNIDADES = { un: "unidade", aplicacao: "aplicação", mL: "mL", dose: "dose", dia: "dia" };
const estiloInput = { padding: "7px 9px", border: "1px solid #d1d5db", borderRadius: "6px", fontSize: "13px", boxSizing: "border-box", width: "100%" };
const mensagemApi = (error, padrao) => {
  const d = error?.response?.data?.detail;
  return typeof d === "string" && d ? d : padrao;
};
const novoVazio = () => ({ id: null, categoria: "CONSULTA", nome: "", palavras_chave: "", unidade: "un", valor: 0, ativo: true });

function TabelaPrecos() {
  const navigate = useNavigate();
  const perfil = localStorage.getItem("perfil") || "RECEPCAO";
  const cfg = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });

  const [linhas, setLinhas] = useState([]);
  const [filtro, setFiltro] = useState("");
  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState(null);   // linha em edição (ou nova)
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (perfil !== "ADMIN") { navigate("/dashboard"); return; }
    carregar();
  }, []);

  const carregar = async () => {
    try {
      const res = await api.get("/contas/precos", cfg());
      setLinhas(res.data || []);
    } catch (e) {
      setErro(mensagemApi(e, "Não foi possível carregar a tabela de preços."));
    }
  };

  const salvar = async () => {
    setErro(""); setSucesso("");
    const l = editando;
    if (!l.nome.trim() || l.nome.trim().length < 2) { setErro("Informe o nome do item."); return; }
    const corpo = { categoria: l.categoria, nome: l.nome.trim(), palavras_chave: (l.palavras_chave || "").trim() || null, unidade: l.unidade, valor: Number(l.valor) || 0, ativo: Boolean(l.ativo) };
    setSalvando(true);
    try {
      if (l.id) await api.put(`/contas/precos/${l.id}`, corpo, cfg());
      else await api.post("/contas/precos", corpo, cfg());
      setSucesso("Preço salvo.");
      setEditando(null);
      carregar();
    } catch (e) {
      setErro(mensagemApi(e, "Não foi possível salvar o preço."));
    } finally {
      setSalvando(false);
    }
  };

  const alternarAtivo = async (l) => {
    setErro(""); setSucesso("");
    try {
      await api.put(`/contas/precos/${l.id}`, { categoria: l.categoria, nome: l.nome, palavras_chave: l.palavras_chave, unidade: l.unidade, valor: l.valor, ativo: !l.ativo }, cfg());
      carregar();
    } catch (e) {
      setErro(mensagemApi(e, "Não foi possível alterar o item."));
    }
  };

  const visiveis = linhas.filter((l) => (!filtro || l.categoria === filtro) && (!busca || `${l.nome} ${l.palavras_chave || ""}`.toLowerCase().includes(busca.toLowerCase())));
  const moeda = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <Layout>
      <div style={{ width: "100%", maxWidth: "1000px", margin: "0 auto", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
          <div style={{ width: "42px", height: "42px", borderRadius: "10px", backgroundColor: "#0D9488", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><MdReceiptLong size={24} /></div>
          <div>
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: "#0F172A" }}>Tabela de Preços</h1>
            <p style={{ margin: "2px 0 0", fontSize: "13px", color: "#64748B" }}>Valores usados na conta automática. Itens com valor R$ 0,00 aparecem como "sem preço" para a recepção.</p>
          </div>
          <button type="button" onClick={() => { setErro(""); setSucesso(""); setEditando(novoVazio()); }} style={{ marginLeft: "auto", backgroundColor: "#4f46e5", color: "#fff", border: "none", borderRadius: "8px", padding: "9px 16px", cursor: "pointer", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px" }}><MdAdd size={18} /> Novo item</button>
        </div>

        <div style={{ backgroundColor: "#eff6ff", border: "1px solid #bfdbfe", color: "#1e40af", borderRadius: "8px", padding: "10px 14px", fontSize: "13px", marginBottom: "12px" }}>
          <strong>Como o sistema casa os preços:</strong> medicamentos e exames são encontrados pelas <em>palavras-chave</em> (separadas por vírgula; se vazio, usa o nome). Ex.: palavras-chave <code>buprenorfina</code> casa com "Buprenorfina solução injetável 0,3 mg/mL".
          Unidade <em>aplicação</em> multiplica pelo nº de aplicações da receita; unidade <em>mL</em> multiplica pelos mL totais. Exames só entram na conta automática se tiverem preço cadastrado.
        </div>

        {sucesso && <div style={{ backgroundColor: "#f0fdf4", border: "1px solid #86efac", color: "#166534", padding: "10px 14px", borderRadius: "8px", fontSize: "14px", marginBottom: "10px" }}>{sucesso}</div>}
        {erro && <div style={{ backgroundColor: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", padding: "10px 14px", borderRadius: "8px", fontSize: "14px", marginBottom: "10px" }}>{erro}</div>}

        <div style={{ display: "flex", gap: "8px", marginBottom: "10px", flexWrap: "wrap" }}>
          <select value={filtro} onChange={(e) => setFiltro(e.target.value)} style={{ ...estiloInput, width: "200px" }}>
            <option value="">Todas as categorias</option>
            {CATEGORIAS.map((c) => <option key={c} value={c}>{ROTULO_CAT[c]}</option>)}
          </select>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou palavra-chave..." style={{ ...estiloInput, width: "320px" }} />
        </div>

        <div style={{ backgroundColor: "#fff", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
            <thead><tr style={{ backgroundColor: "#f8fafc", color: "#475569", textAlign: "left" }}>
              <th style={{ padding: "12px" }}>Categoria</th><th style={{ padding: "12px" }}>Nome</th><th style={{ padding: "12px" }}>Palavras-chave</th>
              <th style={{ padding: "12px" }}>Unidade</th><th style={{ padding: "12px", textAlign: "right" }}>Valor</th><th style={{ padding: "12px" }}>Situação</th><th style={{ padding: "12px" }}></th>
            </tr></thead>
            <tbody>
              {visiveis.length === 0 ? (
                <tr><td colSpan="7" style={{ padding: "20px", color: "#6b7280" }}>Nenhum item encontrado.</td></tr>
              ) : visiveis.map((l) => (
                <tr key={l.id} style={{ borderTop: "1px solid #f1f5f9", opacity: l.ativo ? 1 : 0.5 }}>
                  <td style={{ padding: "10px 12px" }}>{ROTULO_CAT[l.categoria] || l.categoria}</td>
                  <td style={{ padding: "10px 12px", fontWeight: 600 }}>{l.nome}</td>
                  <td style={{ padding: "10px 12px", color: "#6b7280", fontSize: "12px" }}>{l.palavras_chave || "—"}</td>
                  <td style={{ padding: "10px 12px" }}>{UNIDADES[l.unidade] || l.unidade}</td>
                  <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: Number(l.valor) === 0 ? "#b45309" : "#111827" }}>{moeda(l.valor)}</td>
                  <td style={{ padding: "10px 12px" }}>{l.ativo ? "Ativo" : "Inativo"}</td>
                  <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                    <button type="button" onClick={() => { setErro(""); setSucesso(""); setEditando({ ...l, palavras_chave: l.palavras_chave || "" }); }} style={{ border: "1px solid #c7d2fe", backgroundColor: "#eef2ff", color: "#3730a3", borderRadius: "6px", padding: "5px 10px", cursor: "pointer", fontWeight: 600, fontSize: "12px", marginRight: "6px" }}>Editar</button>
                    <button type="button" onClick={() => alternarAtivo(l)} style={{ border: "1px solid #d1d5db", backgroundColor: "#fff", borderRadius: "6px", padding: "5px 10px", cursor: "pointer", fontSize: "12px" }}>{l.ativo ? "Desativar" : "Reativar"}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editando && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: "16px" }}>
          <div style={{ backgroundColor: "#fff", borderRadius: "12px", maxWidth: "520px", width: "100%", padding: "22px" }}>
            <h3 style={{ margin: "0 0 14px", color: "#1e1b4b" }}>{editando.id ? "Editar preço" : "Novo item de preço"}</h3>
            <div style={{ display: "grid", gap: "10px" }}>
              <label style={{ fontSize: "12px", color: "#475569" }}>Categoria
                <select value={editando.categoria} onChange={(e) => setEditando({ ...editando, categoria: e.target.value })} style={estiloInput}>
                  {CATEGORIAS.map((c) => <option key={c} value={c}>{ROTULO_CAT[c]}</option>)}
                </select>
              </label>
              <label style={{ fontSize: "12px", color: "#475569" }}>Nome (aparece na conta)
                <input value={editando.nome} maxLength={200} onChange={(e) => setEditando({ ...editando, nome: e.target.value })} style={estiloInput} />
              </label>
              <label style={{ fontSize: "12px", color: "#475569" }}>Palavras-chave para casar com exames/medicamentos (vírgula)
                <input value={editando.palavras_chave} maxLength={300} onChange={(e) => setEditando({ ...editando, palavras_chave: e.target.value })} placeholder="ex.: buprenorfina, temgesic" style={estiloInput} />
              </label>
              <div style={{ display: "flex", gap: "10px" }}>
                <label style={{ fontSize: "12px", color: "#475569", flex: 1 }}>Unidade de cobrança
                  <select value={editando.unidade} onChange={(e) => setEditando({ ...editando, unidade: e.target.value })} style={estiloInput}>
                    {Object.entries(UNIDADES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </label>
                <label style={{ fontSize: "12px", color: "#475569", flex: 1 }}>Valor (R$)
                  <input type="number" min="0" step="0.01" value={editando.valor} onChange={(e) => setEditando({ ...editando, valor: e.target.value })} style={estiloInput} />
                </label>
              </div>
              <label style={{ fontSize: "13px", color: "#374151", display: "flex", gap: "6px", alignItems: "center" }}>
                <input type="checkbox" checked={editando.ativo} onChange={(e) => setEditando({ ...editando, ativo: e.target.checked })} /> Ativo
              </label>
            </div>
            {erro && <div style={{ backgroundColor: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", padding: "8px 12px", borderRadius: "8px", fontSize: "13px", marginTop: "10px" }}>{erro}</div>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "16px" }}>
              <button type="button" onClick={() => setEditando(null)} style={{ border: "1px solid #d1d5db", backgroundColor: "#fff", borderRadius: "8px", padding: "9px 16px", cursor: "pointer", fontWeight: 600 }}>Cancelar</button>
              <button type="button" disabled={salvando} onClick={salvar} style={{ border: "none", backgroundColor: "#16a34a", color: "#fff", borderRadius: "8px", padding: "9px 18px", cursor: "pointer", fontWeight: 700, display: "flex", alignItems: "center", gap: "4px" }}><MdSave size={16} /> Salvar</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

export default TabelaPrecos;