import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { MdMedicalServices, MdPsychology, MdAutoAwesome, MdAdd, MdDelete, MdWarning, MdPrint } from "react-icons/md";
import api from "../api/api";
import Layout from "../components/Layout";

function Prescricoes() {
  const navigate = useNavigate();
  const location = useLocation();
  const dadosNavegacao = location.state || {};

  const [prescricoes, setPrescricoes] = useState([]);
  const [consultas, setConsultas] = useState([]);
  const [animais, setAnimais] = useState([]);
  const [prescricaoEditando, setPrescricaoEditando] = useState(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [receitaDetalhes, setReceitaDetalhes] = useState(null);

  const [sugestoesMedicamentosIA, setSugestoesMedicamentosIA] = useState([]);

  const [consultaId, setConsultaId] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [itens, setItens] = useState([
    { medicamento: "", dosagem: "", frequencia: "", duracao: "", tipo_uso: "Uso Veterinário (Pet Shop / Agropecuária)", observacoes: "" }
  ]);

  const [busca, setBusca] = useState("");
  const [mensagemErro, setMensagemErro] = useState("");
  const [mensagemSucesso, setMensagemSucesso] = useState("");
  const [prescricaoParaExcluir, setPrescricaoParaExcluir] = useState(null);

  useEffect(() => {
    carregarPrescricoes();
    carregarConsultas();
    carregarAnimais();
  }, []);

  useEffect(() => {
    if (dadosNavegacao.consultaId) {
      setConsultaId(String(dadosNavegacao.consultaId));
      setMostrarFormulario(true);

      if (dadosNavegacao.parecerCopiloto) {
        processarParecerIA(dadosNavegacao.parecerCopiloto);
      }
    }
  }, [dadosNavegacao]);

  const processarParecerIA = (textoParecer) => {
    const listaExtraida = extrairPrescricoesIA(textoParecer);
    setSugestoesMedicamentosIA(listaExtraida);

    if (listaExtraida.length > 0) {
      importarTodosDaIA(listaExtraida);
    }
  };

  const extrairPrescricoesIA = (textoCopiloto) => {
    if (!textoCopiloto) return [];
    try {
      const jsonMatch = textoCopiloto.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        const parsed = JSON.parse(jsonMatch[1]);
        // Suporta tanto o formato antigo (array direto) quanto o novo (objeto com chave "prescricoes")
        if (Array.isArray(parsed)) {
          return parsed;
        } else if (parsed && Array.isArray(parsed.prescricoes)) {
          return parsed.prescricoes;
        }
      }
    } catch (err) {
      console.error("Erro ao converter JSON de prescrições da IA:", err);
    }
    return [];
  };

  const definirTipoUsoApropriado = (med) => {
    if (med.tipo_uso) {
      const tipo = med.tipo_uso.toLowerCase();
      if (tipo.includes("controle especial")) return "Controle Especial (Retenção de Receita - 2 Vias)";
      if (tipo.includes("humano") || tipo.includes("drogaria")) return "Uso Humano (Drogaria Comum)";
      if (tipo.includes("veterinário") || tipo.includes("veterinario") || tipo.includes("pet")) return "Uso Veterinário (Pet Shop / Agropecuária)";
    }

    const nome = (med.medicamento || "").toLowerCase();

    const psicotropicosEOpioides = [
      "tramadol", "fenobarbital", "morfina", "ketamina", "cetamina", 
      "diazepam", "midazolam", "gabapentina", "zoletil", "tiletamina",
      "zolazepam", "methadona", "metadona", "fentanil", "fentanila"
    ];

    if (psicotropicosEOpioides.some((substancia) => nome.includes(substancia))) {
      return "Controle Especial (Retenção de Receita - 2 Vias)";
    }

    const linhaHumanaComum = [
      "novalgina", "clavulin", "pantoprazol", "omeprazol", "buscopan", 
      "ondansetrona", "vonau", "prednisona", "prednisolona", "dexametasona",
      "allegra", "furosemida", "dipirona"
    ];

    if (linhaHumanaComum.some((substancia) => nome.includes(substancia))) {
      return "Uso Humano (Drogaria Comum)";
    }

    return "Uso Veterinário (Pet Shop / Agropecuária)";
  };

  const importarTodosDaIA = (lista = sugestoesMedicamentosIA) => {
    if (lista && lista.length > 0) {
      setItens(
        lista.map((med) => ({
          medicamento: med.medicamento || "",
          dosagem: med.dosagem || "",
          frequencia: med.frequencia || "",
          duracao: med.duracao || "",
          tipo_uso: definirTipoUsoApropriado(med),
          observacoes: med.observacoes || "",
        }))
      );
    }
  };

  const adicionarItemManual = () => {
    setItens([
      ...itens,
      { medicamento: "", dosagem: "", frequencia: "", duracao: "", tipo_uso: "Uso Veterinário (Pet Shop / Agropecuária)", observacoes: "" }
    ]);
  };

  const removerItem = (index) => {
    const novosItens = itens.filter((_, i) => i !== index);
    setItens(
      novosItens.length > 0
        ? novosItens
        : [{ medicamento: "", dosagem: "", frequencia: "", duracao: "", tipo_uso: "Uso Veterinário (Pet Shop / Agropecuária)", observacoes: "" }]
    );
  };

  const atualizarCampoItem = (index, campo, valor) => {
    const novosItens = [...itens];
    novosItens[index][campo] = valor;

    if (campo === "medicamento") {
      novosItens[index].tipo_uso = definirTipoUsoApropriado(novosItens[index]);
    }

    setItens(novosItens);
  };

  const tratarSessaoExpirada = () => {
    setMensagemErro("❌ Sessão expirada. Redirecionando para o login...");
    setTimeout(() => {
      localStorage.removeItem("token");
      navigate("/");
    }, 2000);
  };

  const carregarPrescricoes = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return tratarSessaoExpirada();

      const response = await api.get("/prescricoes/", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPrescricoes(response.data || []);
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

  const limparFormulario = () => {
    setPrescricaoEditando(null);
    setConsultaId("");
    setObservacoes("");
    setItens([{ medicamento: "", dosagem: "", frequencia: "", duracao: "", tipo_uso: "Uso Veterinário (Pet Shop / Agropecuária)", observacoes: "" }]);
    setSugestoesMedicamentosIA([]);
    setMensagemErro("");
  };

  const salvarPrescricao = async () => {
    try {
      setMensagemErro("");
      setMensagemSucesso("");

      if (!consultaId) {
        setMensagemErro("💊 Selecione a consulta de origem.");
        return;
      }

      const itensValidos = itens.filter((i) => i.medicamento.trim() !== "");
      if (itensValidos.length === 0) {
        setMensagemErro("💊 Informe ao menos um medicamento válido.");
        return;
      }

      const token = localStorage.getItem("token");
      if (!token) return tratarSessaoExpirada();

      const payload = {
        consulta_id: Number(consultaId),
        observacoes: observacoes.trim() || undefined,
        itens: itensValidos.map((i) => ({
          medicamento: i.medicamento.trim(),
          dosagem: i.dosagem.trim() || undefined,
          frequencia: i.frequencia.trim() || undefined,
          duracao: i.duracao.trim() || undefined,
          tipo_uso: i.tipo_uso || undefined,
          observacoes: i.observacoes.trim() || undefined,
        })),
      };

      const config = {
        headers: { Authorization: `Bearer ${token}` },
      };

      if (prescricaoEditando) {
        await api.put(`/prescricoes/${prescricaoEditando.id}`, payload, config);
      } else {
        await api.post("/prescricoes/", payload, config);
      }

      limparFormulario();
      setMostrarFormulario(false);
      carregarPrescricoes();

      setMensagemSucesso(
        prescricaoEditando
          ? "✅ Receita atualizada com sucesso!"
          : "✅ Receita emitida com sucesso!"
      );
    } catch (error) {
      console.error("ERRO SALVAR PRESCRIÇÃO:", error);
      if (error.response?.status === 401) return tratarSessaoExpirada();
      setMensagemErro(`❌ ${error.response?.data?.detail || error.message}`);
    }
  };

  const deletarPrescricao = async () => {
    if (!prescricaoParaExcluir) return;

    try {
      const token = localStorage.getItem("token");
      if (!token) return tratarSessaoExpirada();

      await api.delete(`/prescricoes/${prescricaoParaExcluir.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setMensagemSucesso("✅ Receita excluída com sucesso!");
      setPrescricaoParaExcluir(null);
      carregarPrescricoes();
    } catch (error) {
      if (error.response?.status === 401) return tratarSessaoExpirada();
      setMensagemErro(`❌ Erro ao excluir: ${error.response?.data?.detail || error.message}`);
      setPrescricaoParaExcluir(null);
    }
  };

  const editarPrescricao = (p) => {
    setPrescricaoEditando(p);
    setConsultaId(String(p.consulta_id));
    setObservacoes(p.observacoes || "");

    if (p.itens && p.itens.length > 0) {
      setItens(
        p.itens.map((item) => ({
          medicamento: item.medicamento || "",
          dosagem: item.dosagem || "",
          frequencia: item.frequencia || "",
          duracao: item.duracao || "",
          tipo_uso: definirTipoUsoApropriado(item),
          observacoes: item.observacoes || "",
        }))
      );
    } else {
      setItens([{ medicamento: "", dosagem: "", frequencia: "", duracao: "", tipo_uso: "Uso Veterinário (Pet Shop / Agropecuária)", observacoes: "" }]);
    }

    setMostrarFormulario(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const obterConsulta = (cId) => consultas.find((c) => c.id === cId);

  const obterNomeAnimalPorConsulta = (cId) => {
    const cons = obterConsulta(cId);
    if (!cons) return "-";
    const anim = animais.find((a) => a.id === cons.animal_id);
    return anim ? `${anim.nome} (${anim.codigo || `PET-${anim.id}`})` : `-`;
  };

  const parecerIA = dadosNavegacao.parecerCopiloto || obterConsulta(Number(consultaId))?.parecer_copiloto;

  const prescricoesFiltradas = prescricoes.filter((p) => {
    const termo = busca.toLowerCase();
    const nomeA = obterNomeAnimalPorConsulta(p.consulta_id).toLowerCase();
    const temMedicamento = (p.itens || []).some((item) =>
      (item.medicamento || "").toLowerCase().includes(termo)
    );

    return temMedicamento || nomeA.includes(termo);
  });

  const verificarControleEspecial = (listaItens = []) => {
    return listaItens.some((item) => {
      const tipo = item.tipo_uso || "";
      const nome = (item.medicamento || "").toLowerCase();
      return (
        tipo.includes("Controle Especial") ||
        nome.includes("tramadol") ||
        nome.includes("fenobarbital") ||
        nome.includes("morfina") ||
        nome.includes("ketamina") ||
        nome.includes("cetamina") ||
        nome.includes("diazepam")
      );
    });
  };

  const renderBadgeAquisicao = (med) => {
    const tipoUso = typeof med === "string" ? med : med.tipo_uso;
    const nomeMed = typeof med === "object" ? (med.medicamento || "").toLowerCase() : "";

    if (
      tipoUso?.includes("Controle Especial") ||
      nomeMed.includes("tramadol") ||
      nomeMed.includes("fenobarbital") ||
      nomeMed.includes("morfina") ||
      nomeMed.includes("ketamina") ||
      nomeMed.includes("cetamina")
    ) {
      return (
        <span style={{ fontSize: "11px", backgroundColor: "#fef3c7", color: "#b45309", padding: "3px 8px", borderRadius: "6px", fontWeight: "bold", border: "1px solid #fcd34d", display: "inline-flex", alignItems: "center", gap: "4px" }}>
          ⚠️ Controle Especial (Retenção de Receita)
        </span>
      );
    }
    if (tipoUso?.includes("Humano") || tipoUso?.includes("Drogaria")) {
      return (
        <span style={{ fontSize: "11px", backgroundColor: "#e0f2fe", color: "#0369a1", padding: "3px 8px", borderRadius: "6px", fontWeight: "bold", border: "1px solid #bae6fd", display: "inline-block" }}>
          💊 Uso Humano (Drogaria Comum)
        </span>
      );
    }
    return (
      <span style={{ fontSize: "11px", backgroundColor: "#dcfce7", color: "#15803d", padding: "3px 8px", borderRadius: "6px", fontWeight: "bold", border: "1px solid #bbf7d0", display: "inline-block" }}>
        🐾 Uso Veterinário (Pet Shop / Agropecuária)
      </span>
    );
  };

  const imprimirReceita = (receita) => {
    const cons = obterConsulta(receita.consulta_id);
    const anim = cons ? animais.find((a) => a.id === cons.animal_id) : null;

    const nomePaciente = anim ? anim.nome.replace(/\s+/g, "_") : "Paciente";
    const codigoPet = anim ? (anim.codigo || `PET-${anim.id}`) : "";
    const tituloOriginal = document.title;

    document.title = `Receita_${nomePaciente}_${codigoPet}`;
    window.print();

    setTimeout(() => {
      document.title = tituloOriginal;
    }, 1000);
  };

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

  const possuiControladoForm = verificarControleEspecial(itens);

  return (
    <Layout>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
        }}
      >
        <h1
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            margin: 0,
            fontSize: "26px",
            color: "#1e1b4b",
          }}
        >
          <MdMedicalServices color="#4f46e5" size={38} />
          Receituário & Prescrições
        </h1>

        <button
          onClick={() => {
            if (mostrarFormulario) limparFormulario();
            setMostrarFormulario(!mostrarFormulario);
          }}
          style={{
            backgroundColor: "#4f46e5",
            color: "white",
            border: "none",
            padding: "10px 20px",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: "600",
            fontSize: "14px",
            boxShadow: "0 2px 4px rgba(79, 70, 229, 0.2)",
          }}
        >
          {mostrarFormulario ? "Fechar Formulário" : "＋ Nova Prescrição"}
        </button>
      </div>

      {mensagemSucesso && (
        <div
          style={{
            backgroundColor: "#dcfce7",
            color: "#166534",
            padding: "12px 16px",
            borderRadius: "8px",
            marginBottom: "15px",
            fontWeight: "500",
            border: "1px solid #bbf7d0",
          }}
        >
          {mensagemSucesso}
        </div>
      )}

      {mensagemErro && (
        <div
          style={{
            backgroundColor: "#fee2e2",
            color: "#991b1b",
            padding: "12px 16px",
            borderRadius: "8px",
            marginBottom: "15px",
            fontWeight: "500",
            border: "1px solid #fecaca",
          }}
        >
          {mensagemErro}
        </div>
      )}

      {/* CARD DO FORMULÁRIO */}
      {mostrarFormulario && (
        <div
          style={{
            backgroundColor: "#ffffff",
            padding: "24px",
            borderRadius: "12px",
            marginBottom: "25px",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
            border: "1px solid #e5e7eb",
          }}
        >
          <div style={{ borderBottom: "1px solid #f3f4f6", paddingBottom: "12px", marginBottom: "20px" }}>
            <h3 style={{ margin: 0, color: "#111827", fontSize: "18px", fontWeight: "600" }}>
              {prescricaoEditando ? "✏️ Editar Receita Médica" : "💊 Emitir Nova Receita Médica"}
            </h3>
          </div>

          {possuiControladoForm && (
            <div
              style={{
                backgroundColor: "#fffbeb",
                border: "1px solid #fde68a",
                color: "#92400e",
                padding: "12px 16px",
                borderRadius: "10px",
                marginBottom: "20px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                fontSize: "13px",
              }}
            >
              <MdWarning size={24} color="#b45309" />
              <div>
                <strong>Atenção: Receituário de Controle Especial Detectado!</strong>
                <br />
                Esta receita contém medicação sujeita a controle especial. Ao imprimir, o sistema gerará automaticamente a <strong>1ª VIA (Retenção da Farmácia)</strong> e a <strong>2ª VIA (Orientação ao Tutor)</strong>.
              </div>
            </div>
          )}

          {consultaId && (
            <div
              style={{
                backgroundColor: "#f0fdf4",
                border: "1px solid #bbf7d0",
                padding: "12px 16px",
                borderRadius: "8px",
                marginBottom: "18px",
                fontSize: "14px",
                color: "#166534",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>
                🐾 <strong>Paciente Vinculado:</strong> {obterNomeAnimalPorConsulta(Number(consultaId))}
              </span>
              {dadosNavegacao.peso && (
                <span>
                  <strong>Peso Atual:</strong> {dadosNavegacao.peso} kg
                </span>
              )}
            </div>
          )}

          {sugestoesMedicamentosIA.length > 0 && (
            <div
              style={{
                backgroundColor: "#f0f9ff",
                border: "1px solid #bae6fd",
                borderRadius: "10px",
                padding: "16px",
                marginBottom: "20px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#0369a1", fontWeight: "700", fontSize: "14px" }}>
                <MdAutoAwesome size={22} color="#0284c7" />
                {sugestoesMedicamentosIA.length} medicamento(s) sugerido(s) pelo Copiloto IA
              </div>
              <button
                type="button"
                onClick={() => importarTodosDaIA()}
                style={{
                  backgroundColor: "#0284c7",
                  color: "white",
                  border: "none",
                  padding: "8px 16px",
                  borderRadius: "6px",
                  fontSize: "13px",
                  cursor: "pointer",
                  fontWeight: "600",
                }}
              >
                ⚡ Importar Todos na Receita
              </button>
            </div>
          )}

          {parecerIA && (
            <div
              style={{
                backgroundColor: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                padding: "14px",
                marginBottom: "20px",
              }}
            >
              <h4 style={{ margin: "0 0 8px 0", color: "#334155", fontSize: "13px", fontWeight: "700" }}>
                📋 Parecer Completo do Copiloto (Referência):
              </h4>
              <div
                style={{
                  backgroundColor: "#ffffff",
                  padding: "12px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  color: "#334155",
                  fontSize: "13px",
                  lineHeight: "1.6",
                  maxHeight: "120px",
                  overflowY: "auto",
                  whiteSpace: "pre-line",
                }}
              >
                {parecerIA}
              </div>
            </div>
          )}

          <div style={{ marginBottom: "20px" }}>
            <label style={estiloLabel}>Consulta de Origem *</label>
            <select
              value={consultaId}
              onChange={(e) => setConsultaId(e.target.value)}
              style={estiloInput}
            >
              <option value="">Selecione o Atendimento</option>
              {consultas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.codigo || `CNS-${String(c.id).padStart(4, "0")}`} — {obterNomeAnimalPorConsulta(c.id)}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: "20px" }}>
            <h4 style={{ margin: "0 0 12px 0", color: "#111827", fontSize: "16px", fontWeight: "600" }}>
              💊 Medicamentos Prescritos
            </h4>

            {itens.map((item, index) => (
              <div
                key={index}
                style={{
                  backgroundColor: "#f9fafb",
                  border: "1px solid #e5e7eb",
                  borderRadius: "10px",
                  padding: "16px",
                  marginBottom: "14px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "10px",
                  }}
                >
                  <span style={{ fontSize: "13px", fontWeight: "bold", color: "#4f46e5" }}>
                    Medicamento #{index + 1}
                  </span>
                  {itens.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removerItem(index)}
                      style={{
                        backgroundColor: "transparent",
                        color: "#dc2626",
                        border: "none",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      <MdDelete size={20} />
                    </button>
                  )}
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                    gap: "12px",
                  }}
                >
                  <div>
                    <label style={estiloLabel}>Medicamento *</label>
                    <input
                      type="text"
                      placeholder="Ex: Cloridrato de Tramadol 50 mg"
                      value={item.medicamento}
                      onChange={(e) => atualizarCampoItem(index, "medicamento", e.target.value)}
                      style={estiloInput}
                    />
                  </div>

                  <div>
                    <label style={estiloLabel}>Dosagem / Posologia</label>
                    <input
                      type="text"
                      placeholder="Ex: 1 cápsula (2.6 mg/kg)"
                      value={item.dosagem}
                      onChange={(e) => atualizarCampoItem(index, "dosagem", e.target.value)}
                      style={estiloInput}
                    />
                  </div>

                  <div>
                    <label style={estiloLabel}>Frequência / Intervalo</label>
                    <input
                      type="text"
                      placeholder="Ex: A cada 8 horas (TID)"
                      value={item.frequencia}
                      onChange={(e) => atualizarCampoItem(index, "frequencia", e.target.value)}
                      style={estiloInput}
                    />
                  </div>

                  <div>
                    <label style={estiloLabel}>Duração do Tratamento</label>
                    <input
                      type="text"
                      placeholder="Ex: Por 4 dias"
                      value={item.duracao}
                      onChange={(e) => atualizarCampoItem(index, "duracao", e.target.value)}
                      style={estiloInput}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "12px", marginTop: "10px" }}>
                  <div>
                    <label style={estiloLabel}>Local de Aquisição / Controle *</label>
                    <select
                      value={item.tipo_uso || "Uso Veterinário (Pet Shop / Agropecuária)"}
                      onChange={(e) => atualizarCampoItem(index, "tipo_uso", e.target.value)}
                      style={{ ...estiloInput, fontWeight: "600" }}
                    >
                      <option value="Uso Veterinário (Pet Shop / Agropecuária)">🐾 Uso Veterinário (Pet Shop / Agropecuária)</option>
                      <option value="Uso Humano (Drogaria Comum)">💊 Uso Humano (Drogaria Comum)</option>
                      <option value="Controle Especial (Retenção de Receita - 2 Vias)">⚠️ Controle Especial (Retenção de Receita - 2 Vias)</option>
                    </select>
                  </div>

                  <div>
                    <label style={estiloLabel}>Observações do Medicamento</label>
                    <input
                      type="text"
                      placeholder="Ex: Pode causar leve sedação."
                      value={item.observacoes}
                      onChange={(e) => atualizarCampoItem(index, "observacoes", e.target.value)}
                      style={estiloInput}
                    />
                  </div>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={adicionarItemManual}
              style={{
                backgroundColor: "#e0e7ff",
                color: "#3730a3",
                border: "none",
                padding: "8px 16px",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "600",
                fontSize: "13px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <MdAdd size={18} /> Adicionar Outro Medicamento
            </button>
          </div>

          <div style={{ marginTop: "18px" }}>
            <label style={estiloLabel}>Observações Gerais da Receita</label>
            <textarea
              rows={2}
              placeholder="Instruções gerais para o tutor..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              style={{ ...estiloInput, height: "auto", padding: "10px" }}
            />
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "12px",
              marginTop: "24px",
              paddingTop: "16px",
              borderTop: "1px solid #f3f4f6",
            }}
          >
            <button
              onClick={() => {
                limparFormulario();
                setMostrarFormulario(false);
              }}
              style={{
                backgroundColor: "#f3f4f6",
                color: "#374151",
                border: "none",
                padding: "10px 20px",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "600",
              }}
            >
              Cancelar
            </button>
            <button
              onClick={salvarPrescricao}
              style={{
                backgroundColor: "#16a34a",
                color: "white",
                border: "none",
                padding: "10px 24px",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "600",
                boxShadow: "0 2px 4px rgba(22, 163, 74, 0.2)",
              }}
            >
              Salvar Receita Com {itens.length} Medicamento(s)
            </button>
          </div>
        </div>
      )}

      {/* BARRA DE BUSCA */}
      <div style={{ marginBottom: "16px" }}>
        <input
          type="text"
          placeholder="🔍 Pesquisar por medicamento ou paciente..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          style={{
            width: "100%",
            height: "44px",
            padding: "0 16px",
            border: "1px solid #d1d5db",
            borderRadius: "10px",
            fontSize: "14px",
            outline: "none",
            backgroundColor: "#ffffff",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            boxSizing: "border-box",
          }}
        />
      </div>

      {/* TABELA DE PRESCRIÇÕES */}
      <div
        style={{
          overflowX: "auto",
          backgroundColor: "white",
          borderRadius: "12px",
          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
          border: "1px solid #e5e7eb",
        }}
      >
        <table
          style={{
            width: "100%",
            minWidth: "900px",
            borderCollapse: "collapse",
            textAlign: "center",
          }}
        >
          <thead>
            <tr style={{ backgroundColor: "#4f46e5", color: "white", fontSize: "14px" }}>
              <th style={{ padding: "14px", whiteSpace: "nowrap" }}>Paciente</th>
              <th style={{ padding: "14px", whiteSpace: "nowrap" }}>Medicamento(s) Prescrito(s)</th>
              <th style={{ padding: "14px", whiteSpace: "nowrap" }}>Qtd. Fármacos</th>
              <th style={{ padding: "14px", whiteSpace: "nowrap" }}>Data Emissão</th>
              <th style={{ padding: "14px", whiteSpace: "nowrap" }}>Ações</th>
            </tr>
          </thead>

          <tbody>
            {prescricoesFiltradas.length > 0 ? (
              prescricoesFiltradas.map((p, index) => (
                <tr
                  key={p.id}
                  style={{
                    backgroundColor: index % 2 === 0 ? "#ffffff" : "#f9fafb",
                    borderBottom: "1px solid #f3f4f6",
                    fontSize: "14px",
                  }}
                >
                  <td style={{ padding: "14px", fontWeight: "600", color: "#1f2937", whiteSpace: "nowrap" }}>
                    {obterNomeAnimalPorConsulta(p.consulta_id)}
                  </td>
                  <td style={{ padding: "14px", fontWeight: "bold", color: "#4f46e5", textAlign: "left" }}>
                    {(p.itens || []).map((i) => i.medicamento).join(", ") || "Nenhum medicamento"}
                  </td>
                  <td style={{ padding: "14px", color: "#4b5563", whiteSpace: "nowrap" }}>
                    {(p.itens || []).length} item(ns)
                  </td>
                  <td style={{ padding: "14px", color: "#4b5563", whiteSpace: "nowrap" }}>
                    {p.data_prescricao
                      ? new Date(p.data_prescricao).toLocaleDateString("pt-BR")
                      : "-"}
                  </td>

                  <td
                    style={{
                      padding: "14px",
                      display: "flex",
                      justifyContent: "center",
                      gap: "6px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <button
                      onClick={() => setReceitaDetalhes(p)}
                      title="Ver Receita Médica"
                      style={{
                        backgroundColor: "#e0e7ff",
                        color: "#3730a3",
                        border: "none",
                        padding: "6px 10px",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontWeight: "600",
                        fontSize: "13px",
                      }}
                    >
                      👁️ Receita
                    </button>

                    <button
                      onClick={() => editarPrescricao(p)}
                      style={{
                        backgroundColor: "#fef3c7",
                        color: "#b45309",
                        border: "none",
                        padding: "6px 10px",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontWeight: "600",
                        fontSize: "13px",
                      }}
                    >
                      ✏️
                    </button>

                    <button
                      onClick={() => setPrescricaoParaExcluir(p)}
                      style={{
                        backgroundColor: "#fee2e2",
                        color: "#b91c1c",
                        border: "none",
                        padding: "6px 10px",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontWeight: "600",
                        fontSize: "13px",
                      }}
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" style={{ padding: "24px", color: "#6b7280", fontSize: "14px" }}>
                  Nenhuma receita encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL DE RECEITA MÉDICA A4 PARA IMPRESSÃO */}
      {receitaDetalhes && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            backdropFilter: "blur(3px)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
            padding: "20px",
          }}
        >
          <div
            id="printable-area"
            style={{
              backgroundColor: "white",
              padding: "40px",
              borderRadius: "16px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
              maxWidth: "700px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              boxSizing: "border-box",
            }}
          >
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
                  .bloco-via-receita {
                    display: block !important;
                    page-break-inside: avoid !important;
                    break-inside: avoid !important;
                    page-break-before: always !important;
                    break-before: page !important;
                    min-height: 100vh !important;
                    box-sizing: border-box !important;
                  }
                  .bloco-via-receita:first-of-type {
                    page-break-before: avoid !important;
                    break-before: avoid !important;
                  }
                  .item-medicamento-print {
                    page-break-inside: avoid !important;
                    break-inside: avoid !important;
                    margin-bottom: 10px !important;
                    padding-bottom: 8px !important;
                  }
                  .cabecalho-print {
                    margin-bottom: 14px !important;
                    padding-bottom: 8px !important;
                  }
                  .box-paciente-print {
                    margin-bottom: 14px !important;
                    padding: 10px 14px !important;
                  }
                }
              `}
            </style>

            {[1, ...(verificarControleEspecial(receitaDetalhes.itens || []) ? [2] : [])].map((via) => (
              <div
                key={via}
                className="bloco-via-receita"
                style={{
                  paddingBottom: via === 1 && verificarControleEspecial(receitaDetalhes.itens || []) ? "20px" : "0",
                }}
              >
                <div
                  className="cabecalho-print"
                  style={{
                    textAlign: "center",
                    borderBottom: "2px solid #4f46e5",
                    paddingBottom: "12px",
                    marginBottom: "18px",
                  }}
                >
                  <h2 style={{ margin: 0, color: "#1e1b4b", fontSize: "22px" }}>
                    VetAssist AI — Receituário Veterinário
                  </h2>
                  <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: "#6b7280", fontWeight: "bold", textTransform: "uppercase" }}>
                    {verificarControleEspecial(receitaDetalhes.itens || [])
                      ? via === 1
                        ? "📄 1ª VIA — RETENÇÃO DO ESTABELECIMENTO / FARMÁCIA"
                        : "📄 2ª VIA — ORIENTAÇÃO AO PACIENTE / TUTOR"
                      : "Documento Médico Oficial"}
                  </p>
                </div>

                <div
                  className="box-paciente-print"
                  style={{
                    backgroundColor: "#f8fafc",
                    padding: "12px 16px",
                    borderRadius: "10px",
                    marginBottom: "18px",
                    border: "1px solid #e2e8f0",
                    fontSize: "13px",
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <strong>Paciente:</strong> {obterNomeAnimalPorConsulta(receitaDetalhes.consulta_id)}
                  </div>
                  <div style={{ color: "#64748b", fontSize: "12px" }}>
                    <strong>Emissão:</strong> {new Date(receitaDetalhes.data_prescricao).toLocaleDateString("pt-BR")}
                  </div>
                </div>

                <div style={{ marginBottom: "20px" }}>
                  <h3 style={{ borderBottom: "1px solid #e5e7eb", paddingBottom: "6px", color: "#111827", fontSize: "15px", marginBottom: "12px" }}>
                    💊 Medicamentos & Posologias
                  </h3>

                  {(receitaDetalhes.itens || []).map((med, index) => (
                    <div
                      key={med.id || index}
                      className="item-medicamento-print"
                      style={{
                        marginBottom: "14px",
                        paddingBottom: "10px",
                        borderBottom: "1px dashed #e5e7eb",
                        fontSize: "13px",
                        color: "#1f2937",
                        lineHeight: "1.5",
                      }}
                    >
                      <div style={{ fontSize: "15px", fontWeight: "bold", color: "#4f46e5", marginBottom: "3px" }}>
                        {index + 1}. {med.medicamento}
                      </div>

                      <div style={{ marginBottom: "6px" }}>
                        {renderBadgeAquisicao(med)}
                      </div>

                      {med.dosagem && (
                        <div>
                          <strong>Dosagem:</strong> {med.dosagem}
                        </div>
                      )}
                      {med.frequencia && (
                        <div>
                          <strong>Frequência:</strong> {med.frequencia}
                        </div>
                      )}
                      {med.duracao && (
                        <div>
                          <strong>Duração:</strong> {med.duracao}
                        </div>
                      )}
                      {med.observacoes && (
                        <div style={{ marginTop: "4px", backgroundColor: "#fffbeb", padding: "6px 8px", borderRadius: "6px", border: "1px solid #fef3c7", fontSize: "11px", color: "#92400e" }}>
                          📌 <strong>Obs:</strong> {med.observacoes}
                        </div>
                      )}
                    </div>
                  ))}

                  {receitaDetalhes.observacoes && (
                    <div style={{ marginTop: "12px", backgroundColor: "#f8fafc", padding: "10px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12px" }}>
                      <strong>Observações Gerais:</strong> {receitaDetalhes.observacoes}
                    </div>
                  )}
                </div>

                {verificarControleEspecial(receitaDetalhes.itens || []) && via === 1 && (
                  <div style={{ marginTop: "16px", border: "1px solid #cbd5e1", borderRadius: "8px", padding: "10px", backgroundColor: "#fafafa", fontSize: "10px", color: "#334155" }}>
                    <strong style={{ display: "block", marginBottom: "6px", textTransform: "uppercase" }}>
                      IDENTIFICAÇÃO DO COMPRADOR / FARMÁCIA (PORTARIA SVS/MS Nº 344/98)
                    </strong>
                    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "6px", marginBottom: "4px" }}>
                      <div>Nome: _____________________________________</div>
                      <div>RG: _________________</div>
                      <div>Tel: ______________</div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr", gap: "6px" }}>
                      <div>Endereço: ______________________________________________</div>
                      <div>Assinatura Comprador: ______________________</div>
                    </div>
                  </div>
                )}

                <div style={{ marginTop: "25px", textAlign: "center" }}>
                  <div style={{ borderTop: "1px solid #9ca3af", width: "220px", margin: "0 auto 6px auto" }}></div>
                  <div style={{ fontWeight: "bold", color: "#111827", fontSize: "13px" }}>Médico(a) Veterinário(a)</div>
                  <div style={{ fontSize: "11px", color: "#6b7280" }}>CRMV Responsável</div>
                </div>
              </div>
            ))}

            <div
              className="no-print"
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
                marginTop: "24px",
                paddingTop: "14px",
                borderTop: "1px solid #f3f4f6",
              }}
            >
              <button
                onClick={() => imprimirReceita(receitaDetalhes)}
                style={{
                  backgroundColor: "#0284c7",
                  color: "white",
                  border: "none",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: "600",
                  fontSize: "13px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <MdPrint size={18} />
                Imprimir Receita {verificarControleEspecial(receitaDetalhes.itens || []) ? "(2 Vias)" : ""}
              </button>
              <button
                onClick={() => setReceitaDetalhes(null)}
                style={{
                  backgroundColor: "#f3f4f6",
                  color: "#374151",
                  border: "none",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: "600",
                  fontSize: "13px",
                }}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EXCLUSÃO */}
      {prescricaoParaExcluir && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(0, 0, 0, 0.4)",
            backdropFilter: "blur(2px)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              padding: "28px",
              borderRadius: "14px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
              textAlign: "center",
              maxWidth: "400px",
              width: "90%",
            }}
          >
            <div style={{ fontSize: "42px", marginBottom: "8px" }}>⚠️</div>
            <h3 style={{ marginTop: 0, color: "#111827", fontSize: "18px" }}>
              Confirmar Exclusão
            </h3>
            <p style={{ color: "#4b5563", fontSize: "14px", lineHeight: "1.5" }}>
              Tem certeza que deseja excluir esta receita completa e todos os seus medicamentos?
            </p>
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: "12px",
                marginTop: "22px",
              }}
            >
              <button
                onClick={() => setPrescricaoParaExcluir(null)}
                style={{
                  backgroundColor: "#f3f4f6",
                  color: "#374151",
                  border: "none",
                  padding: "10px 18px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: "600",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={deletarPrescricao}
                style={{
                  backgroundColor: "#dc2626",
                  color: "white",
                  border: "none",
                  padding: "10px 18px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: "600",
                  boxShadow: "0 2px 4px rgba(220, 38, 38, 0.2)",
                }}
              >
                Sim, Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

export default Prescricoes;