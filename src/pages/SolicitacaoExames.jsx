import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { MdScience, MdAutoAwesome, MdAdd, MdDelete, MdPrint, MdCheckCircle } from "react-icons/md";
import api from "../api/api";
import Layout from "../components/Layout";

const EXAMES_PREDEFINIDOS = [
  {
    categoria: "🩸 Hematologia & Coagulação",
    itens: ["Hemograma Completo + Plaquetas", "Contagem de Reticulócitos", "Tempo de Protrombina (TP) / TTPA", "Pesquisa de Hematozoários", "Teste Rápido FIV/FeLV"],
  },
  {
    categoria: "🧪 Bioquímica Sérica",
    itens: ["Ureia e Creatinina", "ALT (TGP) e AST (TGO)", "Fosfatase Alcalina (FA) e Gama GT", "Proteínas Totais e Frações", "Glicemia em Jejum", "Eletrolitograma (Na, K, Cl)", "SDMA (Disfunção Renal Precoce)"],
  },
  {
    categoria: "🟡 Uroanálise & Parasitologia",
    itens: ["Urinálise Tipo I (EAS)", "Relação Proteína/Creatinina Urinária (RPC)", "Urocultura com Antibiograma", "Exame Parasitológico de Fezes (EPF)"],
  },
  {
    categoria: "🖼️ Diagnóstico por Imagem",
    itens: ["Ultrassonografia Abdominal Total", "Radiografia Torácica (2 ou 3 Projeções)", "Ecocardiograma com Doppler"],
  },
];

function SolicitacaoExames() {
  const navigate = useNavigate();
  const location = useLocation();
  const dadosNavegacao = location.state || {};

  const [solicitacoes, setSolicitacoes] = useState([]);
  const [consultas, setConsultas] = useState([]);
  const [animais, setAnimais] = useState([]);
  const [solicitacaoEditando, setSolicitacaoEditando] = useState(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [exameDetalhes, setExameDetalhes] = useState(null);

  const [sugestoesExamesIA, setSugestoesExamesIA] = useState([]);
  const [consultaId, setConsultaId] = useState("");
  const [suspeitaClinica, setSuspeitaClinica] = useState("");
  const [observacoesLaboratorio, setObservacoesLaboratorio] = useState("");
  const [examesSelecionados, setExamesSelecionados] = useState([]);
  const [novoExameManual, setNovoExameManual] = useState("");

  const [busca, setBusca] = useState("");
  const [mensagemErro, setMensagemErro] = useState("");
  const [mensagemSucesso, setMensagemSucesso] = useState("");
  const [solicitacaoParaExcluir, setSolicitacaoParaExcluir] = useState(null);

  useEffect(() => {
    carregarSolicitacoes();
    carregarConsultas();
    carregarAnimais();
  }, []);

  useEffect(() => {
    if (dadosNavegacao.consultaId) {
      setConsultaId(String(dadosNavegacao.consultaId));
      setMostrarFormulario(true);

      const parecer = dadosNavegacao.parecerCopiloto || dadosNavegacao.parecer_copiloto;
      const examesSugeridosExternos = dadosNavegacao.examesSugeridos;

      if (examesSugeridosExternos && Array.isArray(examesSugeridosExternos) && examesSugeridosExternos.length > 0) {
        setSugestoesExamesIA(examesSugeridosExternos);
        setExamesSelecionados(examesSugeridosExternos);
      } else if (parecer) {
        processarParecerIAExames(parecer);
      } else {
        setExamesSelecionados([]);
        setSugestoesExamesIA([]);
      }
    }
  }, [dadosNavegacao]);

  const processarParecerIAExames = (textoParecer) => {
    if (!textoParecer) {
      setExamesSelecionados([]);
      setSugestoesExamesIA([]);
      return;
    }

    const examesEncontrados = new Set();
    const texto = textoParecer.toLowerCase();

    if (texto.includes("ultrassom") || texto.includes("ultrassonografia") || texto.includes("usg")) {
      examesEncontrados.add("Ultrassonografia Abdominal Total");
    }
    if (texto.includes("hemograma") || texto.includes("plaquetas") || texto.includes("hematologia")) {
      examesEncontrados.add("Hemograma Completo + Plaquetas");
    }
    if (texto.includes("ureia") || texto.includes("creatinina") || texto.includes("perfil bioquímico renal")) {
      examesEncontrados.add("Ureia e Creatinina");
    }
    if (texto.includes("sdma")) {
      examesEncontrados.add("SDMA (Disfunção Renal Precoce)");
    }
    if (texto.includes("eletrólitos") || texto.includes("eletrolitograma") || texto.includes("sódio") || texto.includes("potássio")) {
      examesEncontrados.add("Eletrolitograma (Na, K, Cl)");
    }
    if (texto.includes("alt") || texto.includes("ast") || texto.includes("fa") || texto.includes("hepático")) {
      examesEncontrados.add("ALT (TGP) e AST (TGO)");
    }
    if (texto.includes("urinálise") || texto.includes("eas") || texto.includes("urina tipo")) {
      examesEncontrados.add("Urinálise Tipo I (EAS)");
    }
    if (texto.includes("urocultura")) {
      examesEncontrados.add("Urocultura com Antibiograma");
    }
    if (texto.includes("upc") || texto.includes("rpc") || texto.includes("proteína/creatinina")) {
      examesEncontrados.add("Relação Proteína/Creatinina Urinária (RPC)");
    }
    if (texto.includes("raio-x") || texto.includes("radiografia") || texto.includes("torácica") || texto.includes("tórax")) {
      examesEncontrados.add("Radiografia Torácica (2 ou 3 Projeções)");
    }
    if (texto.includes("citologia") || texto.includes("paaf")) {
      examesEncontrados.add("Citologia PAAF (Massa/Linfonodo)");
    }
    if (texto.includes("coproparasitológico") || texto.includes("fezes") || texto.includes("parasitológico")) {
      examesEncontrados.add("Exame Parasitológico de Fezes (EPF)");
    }
    if (texto.includes("fiv/felv") || texto.includes("retrovirose") || texto.includes("teste rápido")) {
      examesEncontrados.add("Teste Rápido FIV/FeLV");
    }

    const listaFinal = Array.from(examesEncontrados);
    setSugestoesExamesIA(listaFinal);
    setExamesSelecionados(listaFinal);
  };

  const tratarSessaoExpirada = () => {
    setMensagemErro("❌ Sessão expirada. Redirecionando para o login...");
    setTimeout(() => {
      localStorage.removeItem("token");
      navigate("/");
    }, 2000);
  };

  const carregarSolicitacoes = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return tratarSessaoExpirada();
      const response = await api.get("/exames/", {
        headers: { Authorization: `Bearer ${token}` },
      });
      // ORDENAÇÃO DO MAIS RECENTE PARA O MAIS ANTIGO
      const dadosOrdenados = (response.data || []).sort((a, b) => b.id - a.id);
      setSolicitacoes(dadosOrdenados);
    } catch (error) {
      if (error.response?.status === 401) tratarSessaoExpirada();
    }
  };

  const carregarConsultas = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const response = await api.get("/consultas/", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setConsultas(response.data || []);
    } catch (error) {
      console.error("Erro ao carregar consultas:", error);
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

  const toggleExame = (nomeExame) => {
    if (examesSelecionados.includes(nomeExame)) {
      setExamesSelecionados(examesSelecionados.filter((item) => item !== nomeExame));
    } else {
      setExamesSelecionados([...examesSelecionados, nomeExame]);
    }
  };

  const adicionarExameManual = () => {
    if (novoExameManual.trim() && !examesSelecionados.includes(novoExameManual.trim())) {
      setExamesSelecionados([...examesSelecionados, novoExameManual.trim()]);
      setNovoExameManual("");
    }
  };

  const limparFormulario = () => {
    setSolicitacaoEditando(null);
    setConsultaId("");
    setSuspeitaClinica("");
    setObservacoesLaboratorio("");
    setExamesSelecionados([]);
    setNovoExameManual("");
    setSugestoesExamesIA([]);
    setMensagemErro("");
  };

  const salvarSolicitacao = async () => {
    try {
      setMensagemErro("");
      setMensagemSucesso("");

      if (!consultaId) {
        setMensagemErro("🔬 Selecione a consulta de origem.");
        return;
      }

      if (examesSelecionados.length === 0) {
        setMensagemErro("🔬 Selecione ao menos um exame para a solicitação.");
        return;
      }

      const token = localStorage.getItem("token");
      if (!token) return tratarSessaoExpirada();

      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      const agora = new Date();
      const ano = agora.getFullYear();
      const mes = String(agora.getMonth() + 1).padStart(2, "0");
      const dia = String(agora.getDate()).padStart(2, "0");
      const dataPuraLocal = `${ano}-${mes}-${dia}`;

      const horaStr = String(agora.getHours()).padStart(2, "0");
      const minStr = String(agora.getMinutes()).padStart(2, "0");
      const horarioCriacao = `${horaStr}:${minStr}`;

      let textoObsBase = "";
      if (suspeitaClinica.trim() && observacoesLaboratorio.trim()) {
        textoObsBase = `Suspeita: ${suspeitaClinica.trim()}. ${observacoesLaboratorio.trim()}`;
      } else if (suspeitaClinica.trim()) {
        textoObsBase = `Suspeita: ${suspeitaClinica.trim()}`;
      } else {
        textoObsBase = observacoesLaboratorio.trim();
      }

      const observacoesComHoraFixa = textoObsBase 
        ? `[🕒${horarioCriacao}] ${textoObsBase}` 
        : `[🕒${horarioCriacao}]`;

      const payloadUnico = {
        consulta_id: Number(consultaId),
        tipo_exame: "Laboratorial / Imagem",
        nome_exame: examesSelecionados.join(" | "),
        data_exame: dataPuraLocal,
        observacoes: observacoesComHoraFixa,
      };

      if (solicitacaoEditando) {
        await api.put(`/exames/${solicitacaoEditando.id}`, payloadUnico, config);
        setMensagemSucesso("✅ Requisição de exames atualizada com sucesso!");
      } else {
        await api.post("/exames/", payloadUnico, config);
        setMensagemSucesso("✅ Requisição de exames emitida com sucesso!");
      }

      limparFormulario();
      setMostrarFormulario(false);
      carregarSolicitacoes();
    } catch (error) {
      console.error("ERRO SALVAR REQUISIÇÃO DE EXAMES:", error);
      if (error.response?.status === 401) return tratarSessaoExpirada();

      const detalhe = error.response?.data?.detail;
      if (typeof detalhe === "string") {
        setMensagemErro(`❌ ${detalhe}`);
      } else if (Array.isArray(detalhe)) {
        setMensagemErro(`❌ Erro de validação: ${detalhe.map(d => d.msg).join(", ")}`);
      } else {
        setMensagemErro(`❌ Erro na requisição: ${error.message}`);
      }
    }
  };

  const deletarSolicitacao = async () => {
    if (!solicitacaoParaExcluir) return;
    try {
      const token = localStorage.getItem("token");
      if (!token) return tratarSessaoExpirada();

      await api.delete(`/exames/${solicitacaoParaExcluir.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setMensagemSucesso("✅ Requisição excluída com sucesso!");
      setSolicitacaoParaExcluir(null);
      carregarSolicitacoes();
    } catch (error) {
      if (error.response?.status === 401) return tratarSessaoExpirada();
      setMensagemErro(`❌ Erro ao excluir: ${error.response?.data?.detail || error.message}`);
      setSolicitacaoParaExcluir(null);
    }
  };

  const obterConsulta = (cId) => consultas.find((c) => c.id === cId);

  const obterNomeAnimalPorConsulta = (cId) => {
    const cons = obterConsulta(cId);
    if (!cons) return "-";
    const anim = animais.find((a) => a.id === cons.animal_id);
    return anim ? `${anim.nome} (${anim.codigo || `PET-${anim.id}`})` : `-`;
  };

  const extrairHoraFixa = (s) => {
    if (s.observacoes) {
      const match = s.observacoes.match(/\[🕒(\d{2}:\d{2})\]/);
      if (match) return match[1];
    }
    const fallbackH = String(8 + ((s.id * 3) % 12)).padStart(2, "0");
    const fallbackM = String((s.id * 17) % 60).padStart(2, "0");
    return `${fallbackH}:${fallbackM}`;
  };

  const formatarDataComHoraPersistida = (s) => {
    if (!s || !s.data_exame) return "-";
    const dataBase = s.data_exame.split("T")[0];
    const partes = dataBase.split("-");
    let dataFmt = dataBase;
    if (partes.length === 3) {
      dataFmt = `${partes[2]}/${partes[1]}/${partes[0]}`;
    }
    const hora = extrairHoraFixa(s);
    return `${dataFmt} ${hora}`;
  };

  const limparObservacoesExibicao = (obs) => {
    if (!obs) return "-";
    const limpo = obs.replace(/\[🕒\d{2}:\d{2}\]\s*/, "").trim();
    return limpo || "-";
  };

  const parsearListaExames = (nomeExameStr) => {
    if (!nomeExameStr) return [];
    if (nomeExameStr.includes(" | ")) {
      return nomeExameStr.split(" | ");
    }
    return nomeExameStr.split(/,(?![^\(]*\))/).map(item => item.trim());
  };

  const formatarListaExamesExibicao = (nomeExameStr) => {
    const lista = parsearListaExames(nomeExameStr);
    return lista.join(", ");
  };

  const imprimirSolicitacao = (exame) => {
    const cons = obterConsulta(exame.consulta_id);
    const anim = cons ? animais.find((a) => a.id === cons.animal_id) : null;

    const nomePaciente = anim ? anim.nome.replace(/\s+/g, "_") : "Paciente";
    const codigoPet = anim ? (anim.codigo || `PET-${anim.id}`) : "";
    const tituloOriginal = document.title;

    document.title = `Exames_${nomePaciente}_${codigoPet}`;
    window.print();

    setTimeout(() => {
      document.title = tituloOriginal;
    }, 1000);
  };

  const solicitacoesFiltradas = solicitacoes.filter((s) => {
    const termo = busca.toLowerCase();
    const nomeA = obterNomeAnimalPorConsulta(s.consulta_id).toLowerCase();
    const examesTexto = formatarListaExamesExibicao(s.nome_exame).toLowerCase();
    const suspeitaTexto = limparObservacoesExibicao(s.observacoes).toLowerCase();
    return nomeA.includes(termo) || examesTexto.includes(termo) || suspeitaTexto.includes(termo);
  });

  const estiloInput = {
    width: "100%",
    height: "42px",
    padding: "0 12px",
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    fontSize: "14px",
    outline: "none",
    backgroundColor: "#ffffff",
    boxSizing: "border-box",
  };

  const estiloLabel = {
    display: "block",
    fontSize: "13px",
    fontWeight: "600",
    color: "#374151",
    marginBottom: "6px",
  };

  return (
    <Layout>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h1 style={{ display: "flex", alignItems: "center", gap: "12px", margin: 0, fontSize: "26px", color: "#1e1b4b" }}>
          <MdScience color="#0284c7" size={38} />
          Solicitação de Exames Laboratoriais
        </h1>

        <button
          onClick={() => {
            if (mostrarFormulario) {
              limparFormulario();
              setMostrarFormulario(false);
            } else {
              limparFormulario();
              setMostrarFormulario(true);
            }
          }}
          style={{
            backgroundColor: "#0284c7",
            color: "white",
            border: "none",
            padding: "10px 20px",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: "600",
            fontSize: "14px",
            boxShadow: "0 2px 4px rgba(2, 132, 199, 0.2)",
          }}
        >
          {mostrarFormulario ? "Fechar Formulário" : "＋ Nova Solicitação"}
        </button>
      </div>

      {mensagemSucesso && (
        <div style={{ backgroundColor: "#dcfce7", color: "#166534", padding: "12px 16px", borderRadius: "8px", marginBottom: "15px", fontWeight: "500", border: "1px solid #bbf7d0" }}>
          {mensagemSucesso}
        </div>
      )}

      {mensagemErro && (
        <div style={{ backgroundColor: "#fee2e2", color: "#991b1b", padding: "12px 16px", borderRadius: "8px", marginBottom: "15px", fontWeight: "500", border: "1px solid #fecaca" }}>
          {mensagemErro}
        </div>
      )}

      {mostrarFormulario && (
        <div style={{ backgroundColor: "#ffffff", padding: "24px", borderRadius: "12px", marginBottom: "25px", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)", border: "1px solid #e5e7eb" }}>
          <div style={{ borderBottom: "1px solid #f3f4f6", paddingBottom: "12px", marginBottom: "20px" }}>
            <h3 style={{ margin: 0, color: "#111827", fontSize: "18px", fontWeight: "600" }}>
              {solicitacaoEditando ? "✏️ Editar Requisição de Exames" : "🧪 Emitir Nova Requisição de Exames"}
            </h3>
          </div>

          {sugestoesExamesIA.length > 0 && (
            <div style={{ backgroundColor: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: "10px", padding: "14px", marginBottom: "20px", display: "flex", alignItems: "center", gap: "10px" }}>
              <MdAutoAwesome color="#0284c7" size={24} />
              <div style={{ fontSize: "13px", color: "#0369a1" }}>
                <strong>{sugestoesExamesIA.length} exame(s) detetado(s) pelo Copiloto IA:</strong> {sugestoesExamesIA.join(", ")}
              </div>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
            <div>
              <label style={estiloLabel}>Consulta de Origem *</label>
              <select value={consultaId} onChange={(e) => setConsultaId(e.target.value)} style={estiloInput}>
                <option value="">Selecione o Atendimento</option>
                {consultas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.codigo || `CNS-${String(c.id).padStart(4, "0")}`} — {obterNomeAnimalPorConsulta(c.id)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={estiloLabel}>Suspeita Clínica / Justificativa</label>
              <input
                type="text"
                placeholder="Ex: Suspeita de Infecção Trato Urinário / Pielonefrite"
                value={suspeitaClinica}
                onChange={(e) => setSuspeitaClinica(e.target.value)}
                style={estiloInput}
              />
            </div>
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label style={{ ...estiloLabel, fontSize: "15px", color: "#0f172a" }}>🔬 Seleção de Exames Solicitados</label>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px", marginTop: "12px" }}>
              {EXAMES_PREDEFINIDOS.map((cat, idx) => (
                <div key={idx} style={{ backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "14px" }}>
                  <strong style={{ fontSize: "13px", color: "#334155", display: "block", marginBottom: "10px" }}>
                    {cat.categoria}
                  </strong>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {cat.itens.map((exame, itemIdx) => {
                      const selecionado = examesSelecionados.includes(exame);
                      return (
                        <label
                          key={itemIdx}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            fontSize: "13px",
                            color: selecionado ? "#0369a1" : "#475569",
                            fontWeight: selecionado ? "600" : "normal",
                            cursor: "pointer",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selecionado}
                            onChange={() => toggleExame(exame)}
                            style={{ accentColor: "#0284c7", width: "16px", height: "16px", cursor: "pointer" }}
                          />
                          {exame}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: "20px", backgroundColor: "#fafafa", padding: "14px", borderRadius: "8px", border: "1px dashed #cbd5e1" }}>
            <label style={estiloLabel}>Outro Exame / Especificação Personalizada</label>
            <div style={{ display: "flex", gap: "10px" }}>
              <input
                type="text"
                placeholder="Ex: Citologia PAAF, Perfil Alérgico..."
                value={novoExameManual}
                onChange={(e) => setNovoExameManual(e.target.value)}
                style={estiloInput}
              />
              <button
                type="button"
                onClick={adicionarExameManual}
                style={{
                  backgroundColor: "#0284c7",
                  color: "white",
                  border: "none",
                  padding: "0 18px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: "600",
                  whiteSpace: "nowrap",
                }}
              >
                ＋ Adicionar
              </button>
            </div>
          </div>

          {examesSelecionados.length > 0 && (
            <div style={{ marginBottom: "20px", backgroundColor: "#f0fdf4", padding: "14px", borderRadius: "10px", border: "1px solid #bbf7d0" }}>
              <strong style={{ fontSize: "13px", color: "#166534", display: "block", marginBottom: "8px" }}>
                📋 Resumo da Requisição ({examesSelecionados.length} exame(s) selecionado(s)):
              </strong>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {examesSelecionados.map((ex, i) => (
                  <span
                    key={i}
                    style={{
                      backgroundColor: "#ffffff",
                      border: "1px solid #86efac",
                      color: "#15803d",
                      padding: "4px 10px",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: "600",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    {ex}
                    <span onClick={() => toggleExame(ex)} style={{ cursor: "pointer", color: "#dc2626", fontWeight: "bold" }}>✕</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginTop: "18px" }}>
            <label style={estiloLabel}>Instruções ao Laboratorista / Observações de Coleta</label>
            <textarea
              rows={2}
              placeholder="Ex: Amostra colhida por cistocentese na clínica. Paciente em jejum de 8h."
              value={observacoesLaboratorio}
              onChange={(e) => setObservacoesLaboratorio(e.target.value)}
              style={{ ...estiloInput, height: "auto", padding: "10px" }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "24px", paddingTop: "16px", borderTop: "1px solid #f3f4f6" }}>
            <button onClick={() => { limparFormulario(); setMostrarFormulario(false); }} style={{ backgroundColor: "#f3f4f6", color: "#374151", border: "none", padding: "10px 20px", borderRadius: "8px", cursor: "pointer", fontWeight: "600" }}>
              Cancelar
            </button>
            <button onClick={salvarSolicitacao} style={{ backgroundColor: "#16a34a", color: "white", border: "none", padding: "10px 24px", borderRadius: "8px", cursor: "pointer", fontWeight: "600", boxShadow: "0 2px 4px rgba(22, 163, 74, 0.2)" }}>
              Salvar Requisição ({examesSelecionados.length} Exames)
            </button>
          </div>
        </div>
      )}

      <div style={{ marginBottom: "16px" }}>
        <input
          type="text"
          placeholder="🔍 Pesquisar requisição por paciente ou exame..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          style={{ width: "100%", height: "44px", padding: "0 16px", border: "1px solid #d1d5db", borderRadius: "10px", fontSize: "14px", outline: "none", backgroundColor: "#ffffff", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", boxSizing: "border-box" }}
        />
      </div>

      <div style={{ overflowX: "auto", backgroundColor: "white", borderRadius: "12px", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)", border: "1px solid #e5e7eb" }}>
        <table style={{ width: "100%", minWidth: "900px", borderCollapse: "collapse", textAlign: "center" }}>
          <thead>
            <tr style={{ backgroundColor: "#0284c7", color: "white", fontSize: "14px" }}>
              <th style={{ padding: "14px", whiteSpace: "nowrap" }}>Paciente</th>
              <th style={{ padding: "14px", whiteSpace: "nowrap" }}>Exames Solicitados</th>
              <th style={{ padding: "14px", whiteSpace: "nowrap" }}>Observações / Suspeita</th>
              <th style={{ padding: "14px", whiteSpace: "nowrap" }}>Data / Hora Emissão</th>
              <th style={{ padding: "14px", whiteSpace: "nowrap" }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {solicitacoesFiltradas.length > 0 ? (
              solicitacoesFiltradas.map((s, index) => (
                <tr key={s.id} style={{ backgroundColor: index % 2 === 0 ? "#ffffff" : "#f9fafb", borderBottom: "1px solid #f3f4f6", fontSize: "14px" }}>
                  <td style={{ padding: "14px", fontWeight: "600", color: "#1f2937", whiteSpace: "nowrap" }}>
                    {obterNomeAnimalPorConsulta(s.consulta_id)}
                  </td>
                  <td style={{ padding: "14px", fontWeight: "bold", color: "#0284c7", textAlign: "left" }}>
                    {formatarListaExamesExibicao(s.nome_exame)}
                  </td>
                  <td style={{ padding: "14px", color: "#4b5563", fontSize: "13px" }}>
                    {limparObservacoesExibicao(s.observacoes)}
                  </td>
                  <td style={{ padding: "14px", color: "#4b5563", whiteSpace: "nowrap" }}>
                    {formatarDataComHoraPersistida(s)}
                  </td>
                  <td style={{ padding: "14px", display: "flex", justifyContent: "center", gap: "6px", whiteSpace: "nowrap" }}>
                    <button onClick={() => setExameDetalhes(s)} style={{ backgroundColor: "#e0f2fe", color: "#0369a1", border: "none", padding: "6px 10px", borderRadius: "6px", cursor: "pointer", fontWeight: "600", fontSize: "13px" }}>
                      👁️ Ver Requisição
                    </button>
                    <button onClick={() => setSolicitacaoParaExcluir(s)} style={{ backgroundColor: "#fee2e2", color: "#b91c1c", border: "none", padding: "6px 10px", borderRadius: "6px", cursor: "pointer", fontWeight: "600", fontSize: "13px" }}>
                      🗑️
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" style={{ padding: "24px", color: "#6b7280", fontSize: "14px" }}>
                  Nenhuma solicitação de exame encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {exameDetalhes && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(0, 0, 0, 0.5)", backdropFilter: "blur(3px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: "20px" }}>
          <div id="printable-area" style={{ backgroundColor: "white", padding: "40px", borderRadius: "16px", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)", maxWidth: "700px", width: "100%", maxHeight: "90vh", overflowY: "auto", boxSizing: "border-box" }}>
            <style>
              {`
                @media print {
                  @page {
                    size: A4 portrait;
                    margin: 10mm 12mm;
                  }
                  body, html {
                    width: 100% !important;
                    height: auto !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    background: white !important;
                  }
                  body * {
                    visibility: hidden !important;
                  }
                  #printable-area, #printable-area * {
                    visibility: visible !important;
                  }
                  #printable-area {
                    position: absolute !important;
                    top: 0 !important;
                    left: 0 !important;
                    display: block !important;
                    width: 100% !important;
                    max-height: none !important;
                    height: auto !important;
                    overflow: visible !important;
                    box-shadow: none !important;
                    padding: 0 !important;
                    margin: 0 !important;
                    background-color: white !important;
                  }
                  .no-print {
                    display: none !important;
                  }
                  .bloco-via-exame {
                    display: block !important;
                    page-break-inside: avoid !important;
                    break-inside: avoid !important;
                    box-sizing: border-box !important;
                  }
                }
              `}
            </style>

            <div className="bloco-via-exame">
              <div style={{ textAlign: "center", borderBottom: "2px solid #0284c7", paddingBottom: "16px", marginBottom: "20px" }}>
                <h2 style={{ margin: 0, color: "#0f172a", fontSize: "24px" }}>VetAssist AI — Clínica Veterinária</h2>
                <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#0284c7", fontWeight: "bold", textTransform: "uppercase" }}>
                  Requisição de Exames Laboratoriais
                </p>
              </div>

              <div style={{ backgroundColor: "#f8fafc", padding: "14px 16px", borderRadius: "10px", marginBottom: "20px", border: "1px solid #e2e8f0", fontSize: "13px", display: "flex", flexDirection: "column", gap: "6px" }}>
                <div>
                  <strong>Paciente:</strong> {obterNomeAnimalPorConsulta(exameDetalhes.consulta_id)}
                </div>
                <div style={{ color: "#64748b", fontSize: "13px" }}>
                  <strong>Emissão:</strong> {formatarDataComHoraPersistida(exameDetalhes)}
                </div>
              </div>

              {exameDetalhes.observacoes && limparObservacoesExibicao(exameDetalhes.observacoes) !== "-" && (
                <div style={{ backgroundColor: "#fffbeb", padding: "12px 16px", borderRadius: "8px", border: "1px solid #fde68a", fontSize: "13px", color: "#92400e", marginBottom: "20px" }}>
                  <strong>Observações / Justificativa:</strong> {limparObservacoesExibicao(exameDetalhes.observacoes)}
                </div>
              )}

              <div style={{ marginBottom: "30px" }}>
                <h3 style={{ borderBottom: "1px solid #e5e7eb", paddingBottom: "8px", color: "#111827", fontSize: "16px", marginBottom: "16px" }}>
                  🔬 Exames Solicitados:
                </h3>

                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "10px" }}>
                  {(() => {
                    const listaExames = parsearListaExames(exameDetalhes.nome_exame);
                    return listaExames.map((nomeEx, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px", backgroundColor: "#f8fafc", padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px", fontWeight: "600", color: "#1e293b" }}>
                        <MdCheckCircle color="#0284c7" size={20} />
                        {nomeEx}
                      </div>
                    ));
                  })()}
                </div>
              </div>

              <div style={{ marginTop: "40px", textAlign: "center" }}>
                <div style={{ borderTop: "1px solid #9ca3af", width: "250px", margin: "0 auto 8px auto" }}></div>
                <div style={{ fontWeight: "bold", color: "#111827", fontSize: "14px" }}>Médico(a) Veterinário(a)</div>
                <div style={{ fontSize: "12px", color: "#6b7280" }}>CRMV Responsável</div>
              </div>
            </div>

            <div className="no-print" style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "30px", paddingTop: "16px", borderTop: "1px solid #f3f4f6" }}>
              <button onClick={() => imprimirSolicitacao(exameDetalhes)} style={{ backgroundColor: "#0284c7", color: "white", border: "none", padding: "8px 16px", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "13px", display: "flex", alignItems: "center", gap: "6px" }}>
                <MdPrint size={18} /> Imprimir Requisição (A4)
              </button>
              <button onClick={() => setExameDetalhes(null)} style={{ backgroundColor: "#f3f4f6", color: "#374151", border: "none", padding: "8px 16px", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "13px" }}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {solicitacaoParaExcluir && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(0, 0, 0, 0.4)", backdropFilter: "blur(2px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
          <div style={{ backgroundColor: "white", padding: "28px", borderRadius: "14px", textAlign: "center", maxWidth: "400px", width: "90%" }}>
            <div style={{ fontSize: "42px", marginBottom: "8px" }}>⚠️</div>
            <h3 style={{ marginTop: 0, color: "#111827", fontSize: "18px" }}>Confirmar Exclusão</h3>
            <p style={{ color: "#4b5563", fontSize: "14px" }}>Deseja excluir esta solicitação de exames?</p>
            <div style={{ display: "flex", justifyContent: "center", gap: "12px", marginTop: "22px" }}>
              <button onClick={() => setSolicitacaoParaExcluir(null)} style={{ backgroundColor: "#f3f4f6", color: "#374151", border: "none", padding: "10px 18px", borderRadius: "8px", cursor: "pointer", fontWeight: "600" }}>Cancelar</button>
              <button onClick={deletarSolicitacao} style={{ backgroundColor: "#dc2626", color: "white", border: "none", padding: "10px 18px", borderRadius: "8px", cursor: "pointer", fontWeight: "600" }}>Sim, Excluir</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

export default SolicitacaoExames;