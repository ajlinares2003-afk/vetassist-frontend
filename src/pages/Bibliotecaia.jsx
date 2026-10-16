import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  MdMenuBook,
  MdUploadFile,
  MdDelete,
  MdCheckCircle,
  MdError,
  MdHourglassTop,
  MdRefresh,
  MdInfoOutline,
} from "react-icons/md";
import api from "../api/api";
import Layout from "../components/Layout";

const TIPOS = [
  { valor: "frases", rotulo: "Texto corrido (livros, artigos, diretrizes)" },
  { valor: "farmaco", rotulo: "Bulário em tabela (um trecho por medicamento)" },
];

const INTERVALO_ATUALIZACAO_MS = 3000;

function BibliotecaIA() {
  const navigate = useNavigate();
  const perfilUsuario = localStorage.getItem("perfil") || "RECEPCAO";

  const [publicacoes, setPublicacoes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [feedback, setFeedback] = useState(null); // { texto, tipo: "sucesso" | "erro" }

  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState("frases");
  const [arquivo, setArquivo] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [chaveInput, setChaveInput] = useState(0); // zera o campo de arquivo após enviar

  const [confirmando, setConfirmando] = useState(null); // título aguardando confirmação de exclusão
  const [excluindo, setExcluindo] = useState(null);

  const emProcessamentoAntes = useRef(new Set());
  const montado = useRef(true);

  const cabecalho = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setCarregando(true);
    try {
      const res = await api.get("/rag/publicacoes", { headers: cabecalho() });
      if (!montado.current) return;
      const lista = res.data?.publicacoes || [];

      // avisa quando uma publicação que estava processando termina
      const agora = new Set(lista.filter((p) => p.estado === "processando").map((p) => p.titulo));
      emProcessamentoAntes.current.forEach((t) => {
        const atual = lista.find((p) => p.titulo === t);
        if (atual && atual.estado === "pronta") {
          setFeedback({ texto: `"${t}" foi concluída: ${atual.trechos} trechos disponíveis para o Copiloto.`, tipo: "sucesso" });
        }
      });
      emProcessamentoAntes.current = agora;

      setPublicacoes(lista);
    } catch (err) {
      if (!montado.current) return;
      if (!silencioso) {
        const detalhe = err.response?.data?.detail || err.message;
        setFeedback({ texto: `Erro ao carregar a biblioteca: ${detalhe}`, tipo: "erro" });
      }
    } finally {
      if (montado.current && !silencioso) setCarregando(false);
    }
  }, []);

  useEffect(() => {
    montado.current = true;
    if (perfilUsuario !== "ADMIN") {
      navigate("/dashboard");
      return undefined;
    }
    carregar();
    return () => {
      montado.current = false;
    };
  }, []);

  // enquanto houver ingestão em andamento, atualiza sozinho
  const temProcessando = publicacoes.some((p) => p.estado === "processando");
  useEffect(() => {
    if (!temProcessando) return undefined;
    const id = setInterval(() => carregar(true), INTERVALO_ATUALIZACAO_MS);
    return () => clearInterval(id);
  }, [temProcessando, carregar]);

  const enviar = async (e) => {
    e.preventDefault();
    setFeedback(null);
    if (!titulo.trim()) {
      setFeedback({ texto: "Informe o título da publicação.", tipo: "erro" });
      return;
    }
    if (!arquivo) {
      setFeedback({ texto: "Selecione um arquivo PDF.", tipo: "erro" });
      return;
    }

    const dados = new FormData();
    dados.append("titulo", titulo.trim());
    dados.append("estrategia", tipo);
    dados.append("arquivo", arquivo);

    setEnviando(true);
    try {
      // sem Content-Type manual: o navegador define o boundary do multipart
      const res = await api.post("/rag/publicacoes", dados, { headers: cabecalho() });
      setFeedback({
        texto: `"${res.data.titulo}" enviada: ${res.data.trechos_total} trechos serão gravados em segundo plano. Você pode sair desta tela.`,
        tipo: "sucesso",
      });
      setTitulo("");
      setArquivo(null);
      setChaveInput((n) => n + 1);
      await carregar(true);
    } catch (err) {
      const detalhe = err.response?.data?.detail || err.message;
      setFeedback({ texto: `Erro ao enviar: ${typeof detalhe === "string" ? detalhe : JSON.stringify(detalhe)}`, tipo: "erro" });
    } finally {
      setEnviando(false);
    }
  };

  const excluir = async (tituloAlvo) => {
    setExcluindo(tituloAlvo);
    setFeedback(null);
    try {
      const res = await api.delete("/rag/publicacoes", {
        params: { titulo: tituloAlvo },
        headers: cabecalho(),
      });
      setFeedback({
        texto: `"${tituloAlvo}" excluída (${res.data.trechos_removidos} trechos removidos).`,
        tipo: "sucesso",
      });
      setConfirmando(null);
      await carregar(true);
    } catch (err) {
      const detalhe = err.response?.data?.detail || err.message;
      setFeedback({ texto: `Erro ao excluir: ${detalhe}`, tipo: "erro" });
      setConfirmando(null);
    } finally {
      setExcluindo(null);
    }
  };

  const totalTrechos = publicacoes.reduce((soma, p) => soma + (p.trechos || 0), 0);

  return (
    <Layout>
      <div style={{ width: "100%", maxWidth: "960px", margin: "0 auto", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
          <div style={{ width: "42px", height: "42px", borderRadius: "10px", backgroundColor: "#0D9488", color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <MdMenuBook size={24} />
          </div>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#0F172A" }}>
              Biblioteca de IA
            </h1>
            <p style={{ margin: "2px 0 0 0", fontSize: "13px", color: "#64748B" }}>
              Publicações que o Copiloto Clínico consulta para embasar as respostas.
            </p>
          </div>
          <button type="button" onClick={() => carregar()} style={estiloBotaoSecundario} title="Atualizar lista">
            <MdRefresh size={16} /> Atualizar
          </button>
        </div>

        {feedback && (
          <div style={feedback.tipo === "sucesso" ? estiloSucessoGlobal : estiloErroGlobal}>
            {feedback.tipo === "sucesso" ? <MdCheckCircle size={20} /> : <MdError size={20} />}
            <span>{feedback.texto}</span>
          </div>
        )}

        {/* NOVA PUBLICAÇÃO */}
        <form onSubmit={enviar} style={{ ...estiloCard, marginBottom: "20px" }}>
          <label style={estiloLabel}>Incluir nova publicação</label>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "12px", marginTop: "12px" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <label style={estiloSubLabel}>Título</label>
              <input
                type="text"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                maxLength={255}
                style={estiloInput}
                placeholder="Ex: Clínica Cirúrgica de Pequenos Animais"
                disabled={enviando}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <label style={estiloSubLabel}>Tipo de documento</label>
              <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={estiloInput} disabled={enviando}>
                {TIPOS.map((t) => (
                  <option key={t.valor} value={t.valor}>{t.rotulo}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", marginTop: "12px" }}>
            <label style={estiloSubLabel}>Arquivo PDF (até 50 MB, com texto selecionável)</label>
            <input
              key={chaveInput}
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => setArquivo(e.target.files?.[0] || null)}
              style={{ ...estiloInput, backgroundColor: "#F8FAFC" }}
              disabled={enviando}
            />
          </div>

          <div style={{ display: "flex", alignItems: "flex-start", gap: "6px", marginTop: "12px", fontSize: "11px", color: "#64748B" }}>
            <MdInfoOutline size={14} style={{ flexShrink: 0, marginTop: "1px" }} />
            <span>
              A leitura é feita na hora; a vetorização continua em segundo plano e leva cerca de 1 minuto a cada
              90 trechos (limite do plano gratuito do Gemini). Use "Bulário em tabela" apenas para PDFs no formato
              nome do fármaco + doses por espécie.
            </span>
          </div>

          <button type="submit" disabled={enviando} style={{ ...estiloBotaoPrimario, marginTop: "14px", opacity: enviando ? 0.7 : 1 }}>
            <MdUploadFile size={18} /> {enviando ? "Lendo o PDF..." : "Enviar publicação"}
          </button>
        </form>

        {/* LISTA */}
        <div style={estiloCard}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "8px" }}>
            <label style={estiloLabel}>Publicações cadastradas</label>
            <span style={{ fontSize: "12px", color: "#64748B" }}>
              {publicacoes.length} {publicacoes.length === 1 ? "publicação" : "publicações"} · {totalTrechos.toLocaleString("pt-BR")} trechos
            </span>
          </div>

          {carregando ? (
            <div style={{ textAlign: "center", padding: "28px", color: "#0D9488", fontWeight: "600" }}>
              A carregar a biblioteca...
            </div>
          ) : publicacoes.length === 0 ? (
            <div style={{ textAlign: "center", padding: "28px", color: "#64748B", fontSize: "13px" }}>
              Nenhuma publicação cadastrada. Envie o primeiro PDF acima.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {publicacoes.map((p, i) => {
                const pct = p.total ? Math.min(100, Math.round(((p.feitos || 0) / p.total) * 100)) : 0;
                return (
                  <div key={p.titulo} style={{ padding: "14px 0", borderTop: i === 0 ? "none" : "1px solid #F1F5F9" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                      <div style={{ flex: 1, minWidth: "200px" }}>
                        <div style={{ fontSize: "14px", fontWeight: "700", color: "#0F172A", wordBreak: "break-word" }}>
                          {p.titulo}
                        </div>
                        <div style={{ fontSize: "12px", color: "#64748B", marginTop: "2px" }}>
                          {p.estado === "processando"
                            ? `${p.feitos || 0} de ${p.total} trechos processados`
                            : `${p.trechos.toLocaleString("pt-BR")} trechos · ${formatarTamanho(p.caracteres)} de texto`}
                        </div>
                      </div>

                      <span style={estiloEstado(p.estado)}>
                        {p.estado === "pronta" && <MdCheckCircle size={14} />}
                        {p.estado === "processando" && <MdHourglassTop size={14} />}
                        {p.estado === "erro" && <MdError size={14} />}
                        {p.estado === "pronta" ? "Pronta" : p.estado === "processando" ? "Processando" : "Erro"}
                      </span>

                      {confirmando === p.titulo ? (
                        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                          <button
                            type="button"
                            onClick={() => excluir(p.titulo)}
                            disabled={excluindo === p.titulo}
                            style={estiloBotaoPerigo}
                          >
                            {excluindo === p.titulo ? "Excluindo..." : p.estado === "erro" ? "Confirmar" : "Confirmar exclusão"}
                          </button>
                          <button type="button" onClick={() => setConfirmando(null)} style={estiloBotaoSecundario}>
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmando(p.titulo)}
                          disabled={p.estado === "processando"}
                          title={p.estado === "processando" ? "Aguarde terminar o processamento" : "Excluir publicação"}
                          style={{ ...estiloBotaoExcluir, opacity: p.estado === "processando" ? 0.4 : 1, cursor: p.estado === "processando" ? "not-allowed" : "pointer" }}
                        >
                          <MdDelete size={16} /> {p.estado === "erro" ? "Dispensar" : "Excluir"}
                        </button>
                      )}
                    </div>

                    {p.estado === "processando" && (
                      <div style={{ marginTop: "10px" }}>
                        <div style={{ height: "6px", borderRadius: "999px", backgroundColor: "#E2E8F0", overflow: "hidden" }}>
                          <div style={{ width: `${pct}%`, height: "100%", backgroundColor: "#0D9488", transition: "width 0.4s ease" }} />
                        </div>
                        <div style={{ fontSize: "11px", color: "#64748B", marginTop: "4px" }}>{pct}%</div>
                      </div>
                    )}

                    {p.estado === "erro" && p.mensagem && (
                      <div style={{ ...estiloErro, marginTop: "10px" }}>
                        <MdError size={16} style={{ flexShrink: 0 }} />
                        <span>{p.mensagem}</span>
                      </div>
                    )}

                    {confirmando === p.titulo && p.estado === "pronta" && (
                      <div style={{ fontSize: "11px", color: "#991B1B", marginTop: "8px" }}>
                        Os {p.trechos.toLocaleString("pt-BR")} trechos serão apagados e o Copiloto deixará de consultar esta publicação.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

function formatarTamanho(caracteres) {
  const n = Number(caracteres) || 0;
  if (n < 1000) return `${n} caracteres`;
  if (n < 1000000) return `${Math.round(n / 1000)} mil caracteres`;
  return `${(n / 1000000).toFixed(1).replace(".", ",")} mi de caracteres`;
}

const estiloEstado = (estado) => {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    padding: "3px 10px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: "700",
    border: "1px solid",
  };
  if (estado === "pronta") return { ...base, color: "#166534", backgroundColor: "#F0FDF4", borderColor: "#DCFCE7" };
  if (estado === "processando") return { ...base, color: "#92400E", backgroundColor: "#FFFBEB", borderColor: "#FDE68A" };
  return { ...base, color: "#991B1B", backgroundColor: "#FEF2F2", borderColor: "#FECACA" };
};

const estiloCard = {
  backgroundColor: "#FFFFFF",
  borderRadius: "12px",
  border: "1px solid #E2E8F0",
  padding: "16px",
  display: "flex",
  flexDirection: "column",
};

const estiloLabel = { fontSize: "13px", fontWeight: "700", color: "#0F172A" };

const estiloSubLabel = { fontSize: "11px", fontWeight: "600", color: "#475569", marginBottom: "4px" };

const estiloInput = {
  padding: "10px 12px",
  borderRadius: "8px",
  border: "1px solid #CBD5E1",
  fontSize: "13px",
  outline: "none",
  color: "#1E293B",
  backgroundColor: "#FFFFFF",
  boxSizing: "border-box",
  width: "100%",
};

const estiloBotaoPrimario = {
  backgroundColor: "#0D9488",
  color: "white",
  border: "none",
  padding: "12px 20px",
  borderRadius: "10px",
  fontWeight: "700",
  fontSize: "14px",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
};

const estiloBotaoSecundario = {
  backgroundColor: "#F0FDFA",
  color: "#0D9488",
  border: "1px solid #99F6E4",
  padding: "6px 12px",
  borderRadius: "6px",
  fontSize: "12px",
  fontWeight: "600",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
};

const estiloBotaoExcluir = {
  backgroundColor: "#FFFFFF",
  color: "#B91C1C",
  border: "1px solid #FECACA",
  padding: "6px 12px",
  borderRadius: "6px",
  fontSize: "12px",
  fontWeight: "600",
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
};

const estiloBotaoPerigo = {
  backgroundColor: "#DC2626",
  color: "#FFFFFF",
  border: "none",
  padding: "6px 12px",
  borderRadius: "6px",
  fontSize: "12px",
  fontWeight: "700",
  cursor: "pointer",
};

const estiloSucessoGlobal = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  marginBottom: "16px",
  fontSize: "13px",
  fontWeight: "600",
  color: "#166534",
  backgroundColor: "#F0FDF4",
  padding: "12px 16px",
  borderRadius: "10px",
  border: "1px solid #DCFCE7",
};

const estiloErroGlobal = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  marginBottom: "16px",
  fontSize: "13px",
  fontWeight: "600",
  color: "#991B1B",
  backgroundColor: "#FEF2F2",
  padding: "12px 16px",
  borderRadius: "10px",
  border: "1px solid #FECACA",
};

const estiloErro = {
  display: "flex",
  alignItems: "flex-start",
  gap: "6px",
  fontSize: "11px",
  color: "#991B1B",
  backgroundColor: "#FEF2F2",
  padding: "6px 10px",
  borderRadius: "6px",
  border: "1px solid #FECACA",
};

export default BibliotecaIA;