import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MdEvent, MdVisibility, MdPrint, MdPsychology, MdAutoAwesome, MdLocalHospital, MdDelete, MdCampaign } from "react-icons/md";
import api from "../api/api";
import Layout from "../components/Layout";

function Consultas() {
  const navigate = useNavigate();
  const [consultas, setConsultas] = useState([]);
  const [animais, setAnimais] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [consultaEditando, setConsultaEditando] = useState(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [consultaDetalhes, setConsultaDetalhes] = useState(null);

  const [abaAtiva, setAbaAtiva] = useState("ativos");

  const perfilUsuario = localStorage.getItem("perfil") || "ADMIN";
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
  const [justificativaCirurgica, setJustificativaCirurgica] = useState("");
  const [solicitarExamesPreventivos, setSolicitarExamesPreventivos] = useState(false);

  const [sugestoesCopiloto, setSugestoesCopiloto] = useState("");
  const [carregandoCopiloto, setCarregandoCopiloto] = useState(false);
  const [arquivoExame, setArquivoExame] = useState(null);

  const [busca, setBusca] = useState("");
  const [mensagemErro, setMensagemErro] = useState("");
  const [mensagemSucesso, setMensagemSucesso] = useState("");
  
  const [consultaParaExcluir, setConsultaParaExcluir] = useState(null);
  const [modalExclusaoAberto, setModalExclusaoAberto] = useState(false);

  useEffect(() => {
    carregarConsultas();
    carregarAnimais();
    carregarUsuarios();
  }, []);

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

  const handleAnimalChange = (e) => {
    const idSelecionado = e.target.value;
    setAnimalId(idSelecionado);

    if (idSelecionado && !consultaEditando) {
      const animalEncontrado = animais.find((a) => a.id === Number(idSelecionado));
      if (animalEncontrado) {
        if (animalEncontrado.peso) setPesoAtendimento(animalEncontrado.peso);
        setIdadeAtendimento(animalEncontrado.idade ?? "");
      }
    }
  };

  const chamarPaciente = async (consulta, e) => {
    e.stopPropagation();
    try {
      const token = localStorage.getItem("token");
      await api.put(
        `/consultas/${consulta.id}/chamar`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setConsultas(prev => 
        prev.map(item => item.id === consulta.id ? { ...item, status: "Chamando para Consulta" } : item)
      );

      setMensagemSucesso(`📢 A chamar ${obterNomeAnimal(consulta.animal_id)} no painel!`);
    } catch (err) {
      console.error("Erro ao chamar paciente:", err);
      setMensagemErro("Erro ao emitir chamada para o paciente.");
    }
  };

  const iniciarAtendimentoVeterinario = async (consulta) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return tratarSessaoExpirada();

      const config = { headers: { Authorization: `Bearer ${token}` } };

      let dadosTriagem = {};
      try {
        const respTriagem = await api.get(`/triagem/consulta/${consulta.id}`, config);
        if (respTriagem.data) {
          dadosTriagem = respTriagem.data;
        }
      } catch (errTriagem) {
        console.warn("Aviso: Nenhuma triagem vinculada encontrada.", errTriagem);
      }

      const tempVal = dadosTriagem?.temperatura ?? consulta.temperatura ?? "";
      const fcVal = dadosTriagem?.frequencia_cardiaca ?? consulta.frequencia_cardiaca ?? "";
      const frVal = dadosTriagem?.frequencia_respiratoria ?? consulta.frequencia_respiratoria ?? "";
      const pesoVal = dadosTriagem?.peso ?? dadosTriagem?.peso_atendimento ?? consulta.peso_atendimento ?? "";
      const tpcVal = dadosTriagem?.tpc_segundos ?? consulta.tpc_segundos ?? "";
      const mucosasVal = dadosTriagem?.mucosas ?? consulta.mucosas ?? "Normocoradas";

      // Preenchimento seguro dos estados para o formulário
      setCodigo(consulta.codigo || `CNS-${consulta.id}`);
      setAnimalId(consulta.animal_id || "");
      setQueixaPrincipal(consulta.queixa_principal || dadosTriagem?.queixa_principal || "");
      setExameFisico(consulta.exame_fisico || dadosTriagem?.exame_fisico || "");
      setSuspeitaDiagnostica(consulta.suspeita_diagnostica || "");
      setSugestoesCopiloto(consulta.parecer_copiloto || "");

      setTemperatura(tempVal !== null && tempVal !== undefined ? String(tempVal) : "");
      setFrequenciaCardiaca(fcVal !== null && fcVal !== undefined ? String(fcVal) : "");
      setFrequenciaRespiratoria(frVal !== null && frVal !== undefined ? String(frVal) : "");
      setPesoAtendimento(pesoVal !== null && pesoVal !== undefined ? String(pesoVal) : "");
      setTpcSegundos(tpcVal !== null && tpcVal !== undefined ? String(tpcVal) : "");
      setMucosas(mucosasVal);
      setStatusAtendimento("Em Atendimento");

      await api.put(
        `/consultas/${consulta.id}`,
        {
          codigo: consulta.codigo || `CNS-${consulta.id}`,
          animal_id: consulta.animal_id,
          usuario_id: consulta.usuario_id || null,
          status: "Em Atendimento",
          queixa_principal: consulta.queixa_principal || dadosTriagem?.queixa_principal || "Consulta clínica",
          exame_fisico: consulta.exame_fisico || dadosTriagem?.exame_fisico || null,
          peso_atendimento: pesoVal !== "" ? Number(pesoVal) : null,
          temperatura: tempVal !== "" ? Number(tempVal) : null,
          frequencia_cardiaca: fcVal !== "" ? Number(fcVal) : null,
          frequencia_respiratoria: frVal !== "" ? Number(frVal) : null,
          tpc_segundos: tpcVal !== "" ? Number(tpcVal) : null,
          mucosas: mucosasVal,
          parecer_copiloto: consulta.parecer_copiloto || null,
          suspeita_diagnostica: consulta.suspeita_diagnostica || null,
          observacoes: consulta.observacoes || null,
          indicacao_cirurgia: Boolean(consulta.indicacao_cirurgia),
          justificativa_cirurgica: consulta.justificativa_cirurgica || null,
          solicitar_exames_preventivos: Boolean(consulta.solicitar_exames_preventivos)
        },
        config
      );

      setConsultaEditando({ ...consulta, status: "Em Atendimento" });
      setMostrarFormulario(true);
      carregarConsultas();
      window.scrollTo({ top: 0, behavior: "smooth" });

    } catch (error) {
      console.error("Erro ao iniciar atendimento:", error);
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

      if (arquivoExame) {
        formData.append("file", arquivoExame);
      }

      const response = await api.post("/consultas/sugestoes-copiloto-multimodal", formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });

      setSugestoesCopiloto(response.data.sugestoes || "");
      if (response.data.suspeita_diagnostica) {
        setSuspeitaDiagnostica(response.data.suspeita_diagnostica);
      }
      if (response.data.indicacao_cirurgia !== undefined) {
        setIndicacaoCirurgia(response.data.indicacao_cirurgia);
        setJustificativaCirurgica(response.data.justificativa_cirurgica || "");
      }
      if (response.data.exames_sugeridos) {
        window.examesSugeridosIA = response.data.exames_sugeridos;
      }

    } catch (error) {
      console.error("Erro ao consultar Copiloto Multimodal:", error);
      setSugestoesCopiloto(`⚠️ ${error.response?.data?.detail || "Erro ao analisar dados."}`);
    } finally {
      setCarregandoCopiloto(false);
    }
  };

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
    setJustificativaCirurgica("");
    setSolicitarExamesPreventivos(false);
    setSugestoesCopiloto("");
    setArquivoExame(null);
    setMensagemErro("");
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
      let statusFinal = indicacaoCirurgia ? "Aguardando Cirurgia" : statusAtendimento;

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
        exame_fisico: exameFisico || null, // Garante o envio do exame físico preenchido
        suspeita_diagnostica: suspeitaDiagnostica || null,
        peso_atendimento: pesoAtendimento !== "" ? Number(pesoAtendimento) : null,
        temperatura: temperatura !== "" ? Number(temperatura) : null,
        frequencia_cardiaca: frequenciaCardiaca !== "" ? Number(frequenciaCardiaca) : null,
        frequencia_respiratoria: frequenciaRespiratoria !== "" ? Number(frequenciaRespiratoria) : null,
        tpc_segundos: tpcSegundos !== "" ? Number(tpcSegundos) : null,
        mucosas: mucosas || "Normocoradas",
        parecer_copiloto: parecerCompletoIA || null,
        observacoes: observacoes || null,
        indicacao_cirurgia: Boolean(indicacaoCirurgia),
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
      carregarAnimais();
      setMensagemSucesso("✅ Atendimento clínico salvo com sucesso!");
    } catch (error) {
      setMensagemErro(`❌ ${error.response?.data?.detail || error.message}`);
    }
  };

  const deletarConsulta = async () => {
    if (!consultaParaExcluir) return;
    try {
      const token = localStorage.getItem("token");
      await api.delete(`/consultas/${consultaParaExcluir.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
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

  const obterAnimalCompleto = (id) => animais.find((item) => item.id === id);
  const obterNomeAnimal = (id) => {
    const a = obterAnimalCompleto(id);
    return a ? `${a.nome} (${a.codigo || `PET-${a.id}`})` : `-`;
  };

  const irParaPrescricao = (consulta) => {
    navigate("/prescricoes", {
      state: {
        consultaId: consulta.id,
        animalId: consulta.animal_id,
        codigoConsulta: consulta.codigo || `CNS-${consulta.id}`,
        peso: consulta.peso_atendimento,
        parecerCopiloto: consulta.parecer_copiloto || "",
      },
    });
  };

  const irParaExames = (consulta) => {
    navigate("/exames", {
      state: {
        consultaId: consulta.id,
        animalId: consulta.animal_id,
        codigoConsulta: consulta.codigo || `CNS-${consulta.id}`,
        peso: consulta.peso_atendimento,
        parecer_copiloto: consulta.parecer_copiloto || "",
        examesSugeridos: window.examesSugeridosIA || []
      },
    });
  };

  const renderBadgeTemperatura = (temp) => {
    if (!temp) return "-";
    const valor = Number(temp);
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
      "Chamando para Consulta": { bg: "#fee2e2", color: "#991b1b", label: "📢 A chamar..." },
      FINALIZADO: { bg: "#dcfce7", color: "#166534", label: "✅ Finalizado" },
      "Finalizado": { bg: "#dcfce7", color: "#166534", label: "✅ Finalizado" },
      CANCELADO: { bg: "#fee2e2", color: "#991b1b", label: "❌ Cancelado" }
    };
    const conf = configs[statusVal] || configs.EM_ATENDIMENTO;
    return <span style={{ backgroundColor: conf.bg, color: conf.color, padding: "4px 10px", borderRadius: "999px", fontSize: "12px", fontWeight: "600" }}>{conf.label}</span>;
  };

  const renderizarTextoFormatadoIA = (textoBruto) => {
    if (!textoBruto) return null;
    return textoBruto.split("\n").map((linha, idx) => (
      <p key={idx} style={{ margin: "4px 0", fontSize: "14px", color: "#334155" }}>{linha}</p>
    ));
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

  const estiloInput = {
    width: "100%", height: "42px", padding: "0 12px", border: "1px solid #d1d5db", borderRadius: "8px", fontSize: "14px", outline: "none", backgroundColor: "#ffffff", boxSizing: "border-box"
  };
  const estiloLabel = { display: "block", fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "6px" };

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
        <div style={{ backgroundColor: "#ffffff", padding: "24px", borderRadius: "12px", marginBottom: "25px", border: "1px solid #e5e7eb" }}>
          <h3 style={{ margin: "0 0 20px 0", color: "#111827", fontSize: "18px" }}>
            ✏️ Prontuário & Atendimento Clínico Veterinário
          </h3>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "18px" }}>
            <div>
              <label style={estiloLabel}>Código</label>
              <input type="text" value={codigo} onChange={(e) => setCodigo(e.target.value)} style={{ ...estiloInput, backgroundColor: "#f9fafb" }} />
            </div>

            <div>
              <label style={estiloLabel}>Paciente *</label>
              <select value={animalId} onChange={handleAnimalChange} style={estiloInput}>
                <option value="">Selecione o Paciente</option>
                {animais.map((a) => (<option key={a.id} value={a.id}>{a.nome} ({a.codigo || `PET-${a.id}`})</option>))}
              </select>
            </div>

            <div>
              <label style={estiloLabel}>Peso Atual (Kg)</label>
              <input type="number" step="0.1" value={pesoAtendimento} onChange={(e) => setPesoAtendimento(e.target.value)} style={estiloInput} />
            </div>

            <div>
              <label style={estiloLabel}>Temperatura (°C)</label>
              <input type="number" step="0.1" value={temperatura} onChange={(e) => setTemperatura(e.target.value)} style={estiloInput} />
            </div>

            <div>
              <label style={estiloLabel}>Freq. Cardíaca (bpm)</label>
              <input type="number" value={frequenciaCardiaca} onChange={(e) => setFrequenciaCardiaca(e.target.value)} style={estiloInput} />
            </div>

            <div>
              <label style={estiloLabel}>Freq. Respiratória (mpm)</label>
              <input type="number" value={frequenciaRespiratoria} onChange={(e) => setFrequenciaRespiratoria(e.target.value)} style={estiloInput} />
            </div>

            <div>
              <label style={estiloLabel}>TPC (segundos)</label>
              <input type="number" value={tpcSegundos} onChange={(e) => setTpcSegundos(e.target.value)} style={estiloInput} />
            </div>

            <div>
              <label style={estiloLabel}>Mucosas</label>
              <select value={mucosas} onChange={(e) => setMucosas(e.target.value)} style={estiloInput}>
                <option value="Normocoradas">Normocoradas (Rosadas)</option>
                <option value="Hipocoradas / Pálidas">Hipocoradas / Pálidas</option>
                <option value="Cianóticas">Cianóticas</option>
                <option value="Ictéricas">Ictéricas</option>
              </select>
            </div>
          </div>

          <div style={{ marginTop: "18px", display: "grid", gap: "14px" }}>
            <div>
              <label style={estiloLabel}>Queixa Principal / Motivo</label>
              <input type="text" value={queixaPrincipal} onChange={(e) => setQueixaPrincipal(e.target.value)} style={estiloInput} />
            </div>

            <div>
              <label style={estiloLabel}>Exame Físico / Achados Clínicos</label>
              <textarea rows={3} value={exameFisico} onChange={(e) => setExameFisico(e.target.value)} style={{ ...estiloInput, height: "auto", padding: "10px" }} />
            </div>

            {/* COPILOTO CLÍNICO */}
            <div style={{ backgroundColor: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: "10px", padding: "16px", marginTop: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                <h4 style={{ margin: 0, color: "#0369a1", display: "flex", alignItems: "center", gap: "6px" }}>
                  <MdPsychology size={20} /> Copiloto Clínico (IA)
                </h4>
                <button type="button" onClick={consultarCopilotoComAnexo} disabled={carregandoCopiloto} style={{ backgroundColor: "#0284c7", color: "white", border: "none", padding: "8px 14px", borderRadius: "6px", cursor: "pointer", fontWeight: "600", fontSize: "13px" }}>
                  <MdAutoAwesome size={16} /> {carregandoCopiloto ? "Analisando..." : "Analisar com IA"}
                </button>
              </div>
              <textarea rows={2} placeholder="Suspeita diagnóstica sugerida..." value={suspeitaDiagnostica} onChange={(e) => setSuspeitaDiagnostica(e.target.value)} style={{ ...estiloInput, height: "auto", padding: "10px", borderColor: "#0284c7" }} />
              {sugestoesCopiloto && <div style={{ marginTop: "10px", padding: "10px", backgroundColor: "#ffffff", borderRadius: "6px" }}>{renderizarTextoFormatadoIA(sugestoesCopiloto)}</div>}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "24px", paddingTop: "16px", borderTop: "1px solid #f3f4f6" }}>
            <div style={{ display: "flex", gap: "8px" }}>
              {consultaEditando && (
                <>
                  <button type="button" onClick={() => irParaPrescricao(consultaEditando)} style={{ backgroundColor: "#4f46e5", color: "white", border: "none", padding: "8px 14px", borderRadius: "6px", cursor: "pointer", fontWeight: "600", fontSize: "13px" }}>💊 Receitar</button>
                  <button type="button" onClick={() => irParaExames(consultaEditando)} style={{ backgroundColor: "#0284c7", color: "white", border: "none", padding: "8px 14px", borderRadius: "6px", cursor: "pointer", fontWeight: "600", fontSize: "13px" }}>🧪 Exames</button>
                </>
              )}
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button type="button" onClick={() => { limparFormulario(); setMostrarFormulario(false); }} style={{ backgroundColor: "#f3f4f6", border: "none", padding: "10px 18px", borderRadius: "8px", cursor: "pointer", fontWeight: "600" }}>Fechar</button>
              <button type="button" onClick={salvarConsulta} style={{ backgroundColor: "#16a34a", color: "white", border: "none", padding: "10px 22px", borderRadius: "8px", cursor: "pointer", fontWeight: "600" }}>Salvar Atendimento</button>
            </div>
          </div>
        </div>
      )}

      {!mostrarFormulario && (
        <>
          <div style={{ display: "flex", gap: "8px", backgroundColor: "#e2e8f0", padding: "4px", borderRadius: "10px", marginBottom: "16px", width: "fit-content" }}>
            <button onClick={() => setAbaAtiva("ativos")} style={{ backgroundColor: abaAtiva === "ativos" ? "#4f46e5" : "transparent", color: abaAtiva === "ativos" ? "white" : "#475569", border: "none", padding: "8px 16px", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "13px" }}>🟢 Ativos</button>
            <button onClick={() => setAbaAtiva("finalizados")} style={{ backgroundColor: abaAtiva === "finalizados" ? "#4f46e5" : "transparent", color: abaAtiva === "finalizados" ? "white" : "#475569", border: "none", padding: "8px 16px", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "13px" }}>✅ Finalizados</button>
            <button onClick={() => setAbaAtiva("todos")} style={{ backgroundColor: abaAtiva === "todos" ? "#4f46e5" : "transparent", color: abaAtiva === "todos" ? "white" : "#475569", border: "none", padding: "8px 16px", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "13px" }}>📋 Todos</button>
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
                      <td style={{ padding: "14px", whiteSpace: "nowrap" }}>{c.peso_atendimento ? `${c.peso_atendimento} kg` : "-"}</td>
                      <td style={{ padding: "14px", whiteSpace: "nowrap" }}>{renderBadgeTemperatura(c.temperatura)}</td>
                      <td style={{ padding: "14px", whiteSpace: "nowrap" }}>{renderBadgeStatus(c.status)}</td>
                      <td style={{ padding: "14px", display: "flex", justifyContent: "center", gap: "6px", whiteSpace: "nowrap" }}>
                        <button 
                          onClick={(e) => chamarPaciente(c, e)} 
                          style={{ backgroundColor: "#0284c7", color: "white", border: "none", padding: "6px 10px", borderRadius: "6px", cursor: "pointer", fontWeight: "600", fontSize: "13px", display: "flex", alignItems: "center", gap: "4px" }}
                          title="Chamar paciente para o consultório"
                        >
                          <MdCampaign size={16} /> Chamar
                        </button>
                        <button onClick={() => iniciarAtendimentoVeterinario(c)} style={{ backgroundColor: "#4f46e5", color: "white", border: "none", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontWeight: "600", fontSize: "13px" }}>
                          💉 Atender
                        </button>
                        <button onClick={() => setConsultaDetalhes(c)} style={{ backgroundColor: "#f3f4f6", border: "none", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontWeight: "600", fontSize: "13px" }}>
                          <MdVisibility size={16} /> Ver
                        </button>
                        <button 
                          onClick={() => {
                            setConsultaParaExcluir(c);
                            setModalExclusaoAberto(true);
                          }}
                          style={{ backgroundColor: "#fee2e2", color: "#991b1b", border: "none", padding: "6px 10px", borderRadius: "6px", cursor: "pointer", fontWeight: "600", fontSize: "13px", display: "flex", alignItems: "center", gap: "4px" }}
                          title="Excluir atendimento"
                        >
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

      {/* MODAL DE DETALHES DO ATENDIMENTO */}
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
              <div><strong>Peso:</strong> {consultaDetalhes.peso_atendimento ? `${consultaDetalhes.peso_atendimento} kg` : "-"}</div>
              <div><strong>Temperatura:</strong> {consultaDetalhes.temperatura ? `${consultaDetalhes.temperatura} °C` : "-"}</div>
              <div><strong>Freq. Cardíaca:</strong> {consultaDetalhes.frequencia_cardiaca ? `${consultaDetalhes.frequencia_cardiaca} bpm` : "-"}</div>
              <div><strong>Freq. Respiratória:</strong> {consultaDetalhes.frequencia_respiratoria ? `${consultaDetalhes.frequencia_respiratoria} mpm` : "-"}</div>
              <div><strong>TPC:</strong> {consultaDetalhes.tpc_segundos ? `${consultaDetalhes.tpc_segundos} s` : "-"}</div>
              <div><strong>Mucosas:</strong> {consultaDetalhes.mucosas || "Normocoradas"}</div>
            </div>

            <div style={{ marginBottom: "14px" }}>
              <strong style={{ fontSize: "13px", color: "#4b5563" }}>Queixa Principal / Motivo:</strong>
              <p style={{ margin: "4px 0 0 0", padding: "10px", backgroundColor: "#f9fafb", borderRadius: "6px", fontSize: "14px", color: "#1f2937" }}>{consultaDetalhes.queixa_principal || "Não informada"}</p>
            </div>

            {consultaDetalhes.exame_fisico && (
              <div style={{ marginBottom: "14px" }}>
                <strong style={{ fontSize: "13px", color: "#4b5563" }}>Exame Físico / Achados Clínicos:</strong>
                <p style={{ margin: "4px 0 0 0", padding: "10px", backgroundColor: "#f9fafb", borderRadius: "6px", fontSize: "14px", color: "#1f2937", whiteSpace: "pre-line" }}>{consultaDetalhes.exame_fisico}</p>
              </div>
            )}

            {consultaDetalhes.parecer_copiloto && (
              <div style={{ marginBottom: "20px" }}>
                <strong style={{ fontSize: "13px", color: "#0369a1" }}>🤖 Parecer do Copiloto Clínico (IA):</strong>
                <div style={{ margin: "4px 0 0 0", padding: "12px", backgroundColor: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: "6px", fontSize: "14px", color: "#0c4a6e", whiteSpace: "pre-line" }}>
                  {consultaDetalhes.parecer_copiloto}
                </div>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", borderTop: "1px solid #e5e7eb", paddingTop: "16px" }}>
              <button 
                onClick={() => window.print()} 
                style={{ backgroundColor: "#4f46e5", color: "white", border: "none", padding: "8px 16px", borderRadius: "6px", cursor: "pointer", fontWeight: "600", display: "flex", alignItems: "center", gap: "6px" }}
              >
                <MdPrint size={16} /> Imprimir Ficha
              </button>
              <button 
                onClick={() => setConsultaDetalhes(null)} 
                style={{ backgroundColor: "#f3f4f6", border: "none", padding: "8px 16px", borderRadius: "6px", cursor: "pointer", fontWeight: "600" }}
              >
                Fechar
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      {modalExclusaoAberto && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
          <div style={{ backgroundColor: "white", padding: "24px", borderRadius: "12px", maxWidth: "400px", width: "100%" }}>
            <h3 style={{ margin: "0 0 12px 0", color: "#111827" }}>Confirmar Exclusão</h3>
            <p style={{ color: "#4b5563", fontSize: "14px", marginBottom: "20px" }}>
              Tem a certeza de que deseja apagar o atendimento <strong>{consultaParaExcluir?.codigo || `CNS-${consultaParaExcluir?.id}`}</strong> do paciente <strong>{obterNomeAnimal(consultaParaExcluir?.animal_id)}</strong>? Esta ação não pode ser desfeita.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button 
                onClick={() => setModalExclusaoAberto(false)}
                style={{ backgroundColor: "#f3f4f6", border: "none", padding: "8px 14px", borderRadius: "6px", cursor: "pointer", fontWeight: "600" }}
              >
                Cancelar
              </button>
              <button 
                onClick={deletarConsulta}
                style={{ backgroundColor: "#dc2626", color: "white", border: "none", padding: "8px 14px", borderRadius: "6px", cursor: "pointer", fontWeight: "600" }}
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

export default Consultas;