import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MdEvent, MdVisibility, MdPrint, MdPsychology, MdAutoAwesome, MdDelete, MdCampaign, MdAttachFile } from "react-icons/md";
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

      await api.put(`/consultas/${consulta.id}`, { status: "Em Atendimento" }, config);

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

  const temIndicacaoReal = indicacaoCirurgia || forcarCirurgia;

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
          
          <h3 style={{ margin: "0 0 16px 0", color: "#111827", fontSize: "16px" }}>
            📋 Dados do Paciente e Parâmetros Vitais
          </h3>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "18px", marginBottom: "18px" }}>
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

          <div style={{ marginBottom: "25px", display: "grid", gap: "14px" }}>
            <div>
              <label style={estiloLabel}>Queixa Principal / Motivo</label>
              <textarea 
                rows={2} 
                value={queixaPrincipal} 
                onChange={(e) => setQueixaPrincipal(e.target.value)} 
                style={{ ...estiloInput, height: "auto", minHeight: "68px", padding: "10px 12px", resize: "vertical" }} 
              />
            </div>

            <div>
              <label style={estiloLabel}>Exame Físico / Achados Clínicos</label>
              <textarea rows={3} value={exameFisico} onChange={(e) => setExameFisico(e.target.value)} style={{ ...estiloInput, height: "auto", padding: "10px" }} />
            </div>
          </div>

          {/* COPILOTO CLÍNICO & ANÁLISE DE EXAMES */}
          <div style={{ backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "10px", padding: "16px", marginBottom: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <h4 style={{ margin: 0, color: "#166534", display: "flex", alignItems: "center", gap: "6px", fontSize: "15px" }}>
                <MdPsychology size={20} /> Copiloto Clínico & Análise de Exames (VetAssist AI)
              </h4>
              <button 
                type="button" 
                onClick={consultarCopilotoComAnexo} 
                disabled={carregandoCopiloto} 
                style={{ backgroundColor: carregandoCopiloto ? "#9ca3af" : "#15803d", color: "white", border: "none", padding: "8px 16px", borderRadius: "6px", cursor: carregandoCopiloto ? "not-allowed" : "pointer", fontWeight: "600", fontSize: "13px", display: "flex", alignItems: "center", gap: "6px" }}
              >
                <MdAutoAwesome size={16} /> {carregandoCopiloto ? "Analisando..." : "Analisar Atendimento + Exame"}
              </button>
            </div>

            {carregandoCopiloto && (
              <div style={{ display: "flex", alignItems: "center", gap: "12px", backgroundColor: "#ecfdf5", border: "1px solid #6ee7b7", padding: "12px 16px", borderRadius: "8px", marginBottom: "14px" }}>
                <div style={{ width: "20px", height: "20px", border: "3px solid #10b981", borderTop: "3px solid transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                <div>
                  <div style={{ fontSize: "13px", fontWeight: "bold", color: "#065f46" }}>O Copiloto Clínico está analisando o caso...</div>
                  <div style={{ fontSize: "12px", color: "#047857" }}>{etapaProgressoIA}</div>
                </div>
              </div>
            )}

            <div style={{ fontSize: "12px", color: "#374151", marginBottom: "6px", fontWeight: "500" }}>
              📎 Anexar Raio-X, Ultrassom ou Laudo (Múltiplas Imagens ou PDFs) para a IA analisar:
            </div>

            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: "4px", marginBottom: "14px", backgroundColor: "#ffffff", padding: "8px 12px", borderRadius: "6px", border: "1px dashed #15803d", width: "100%", minHeight: "55px", maxHeight: "95px", overflowY: "auto", boxSizing: "border-box" }}>
              <label style={{ fontSize: "13px", color: "#15803d", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", margin: 0 }}>
                <MdAttachFile size={16} /> Selecionar Arquivos de Exames / Laudos
                <input 
                  type="file" 
                  multiple 
                  onChange={(e) => setArquivosExames(Array.from(e.target.files))} 
                  style={{ display: "none" }} 
                />
              </label>
              {arquivosExames.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginTop: "4px" }}>
                  {arquivosExames.map((arq, idx) => (
                    <span key={idx} style={{ fontSize: "11px", color: "#166534", fontWeight: "500" }}>📄 {arq.name}</span>
                  ))}
                  <button 
                    type="button" 
                    onClick={() => setArquivosExames([])} 
                    style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: "11px", fontWeight: "bold", textAlign: "left", padding: 0 }}
                  >
                    Remover todos
                  </button>
                </div>
              )}
            </div>

            <div style={{ fontSize: "12px", color: "#374151", marginBottom: "4px", fontWeight: "500" }}>
              🩺 Suspeita Diagnóstica (Preenchido pela IA ou Editável)
            </div>
            <textarea 
              rows={2} 
              value={suspeitaDiagnostica} 
              onChange={(e) => setSuspeitaDiagnostica(e.target.value)} 
              style={{ ...estiloInput, height: "auto", padding: "10px", borderColor: "#15803d", backgroundColor: "#ffffff", marginBottom: "14px" }} 
              placeholder="A suspeita diagnóstica aparecerá aqui após a análise..."
            />

            <div style={{ display: "flex", alignItems: "center", gap: "10px", backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", padding: "10px 14px", borderRadius: "8px", marginBottom: "14px" }}>
              <input 
                type="checkbox" 
                checked={solicitarExamesPreventivos} 
                onChange={(e) => setSolicitarExamesPreventivos(e.target.checked)} 
                style={{ width: "16px", height: "16px", cursor: "pointer" }} 
              />
              <label style={{ fontSize: "13px", color: "#166534", fontWeight: "600", cursor: "pointer", margin: 0 }}>
                💡 Tutor solicitou exames preventivos / Check-up de rotina nesta visita
              </label>
            </div>

            {/* CAIXA DE STATUS DE INDICAÇÃO CIRÚRGICA ATUALIZADA */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: temIndicacaoReal ? "#dcfce7" : "#f8fafc", border: `1px solid ${temIndicacaoReal ? "#86efac" : "#e2e8f0"}`, padding: "12px 14px", borderRadius: "8px", marginBottom: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "18px" }}>{temIndicacaoReal ? "🔪" : "➕"}</span>
                <div>
                  <div style={{ fontSize: "13px", fontWeight: "bold", color: temIndicacaoReal ? "#166534" : "#334155" }}>
                    {temIndicacaoReal ? "Indicação Cirúrgica Detetada pela IA." : "Sem indicação cirúrgica automática detetada."}
                  </div>
                  <div style={{ fontSize: "12px", color: temIndicacaoReal ? "#14532d" : "#64748b", marginTop: "2px" }}>
                    {justificativaCirurgica || (temIndicacaoReal ? "Encaminhar para cirurgia de descompressão (hemilaminectomia ou corpectomia) se confirmada compressão significativa." : "Paciente sem indicação cirúrgica urgente no momento.")}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <input 
                  type="checkbox" 
                  checked={forcarCirurgia} 
                  onChange={(e) => setForcarCirurgia(e.target.checked)} 
                  style={{ width: "16px", height: "16px", cursor: "pointer" }} 
                />
                <label style={{ fontSize: "12px", fontWeight: "600", color: "#334155", cursor: "pointer" }}>Forçar Cirurgia</label>
              </div>
            </div>

            {sugestoesCopiloto && (
              <div style={{ padding: "16px", backgroundColor: "#ffffff", borderRadius: "8px", border: "1px solid #d1d5db" }}>
                <div style={{ fontSize: "14px", fontWeight: "bold", color: "#166534", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
                  🤖 Parecer Detalhado do Copiloto:
                </div>
                <div style={{ backgroundColor: "#f8fafc", padding: "12px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                  {renderizarTextoFormatadoIA(sugestoesCopiloto)}
                </div>
              </div>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "24px", paddingTop: "16px", borderTop: "1px solid #f3f4f6" }}>
            <button type="button" onClick={() => { limparFormulario(); setMostrarFormulario(false); }} style={{ backgroundColor: "#f3f4f6", border: "none", padding: "10px 18px", borderRadius: "8px", cursor: "pointer", fontWeight: "600" }}>Fechar</button>
            <button type="button" onClick={salvarConsulta} style={{ backgroundColor: "#16a34a", color: "white", border: "none", padding: "10px 22px", borderRadius: "8px", cursor: "pointer", fontWeight: "600" }}>Salvar Atendimento</button>
          </div>
        </div>
      )}

      {/* TABELA DE CONSULTAS */}
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
                      <td style={{ padding: "14px", whiteSpace: "nowrap" }}>{c.peso_atendimento ?? c.peso ? `${c.peso_atendimento ?? c.peso} kg` : "-"}</td>
                      <td style={{ padding: "14px", whiteSpace: "nowrap" }}>{renderBadgeTemperatura(c.temperatura)}</td>
                      <td style={{ padding: "14px", whiteSpace: "nowrap" }}>{renderBadgeStatus(c.status)}</td>
                      <td style={{ padding: "14px", display: "flex", justifyContent: "center", gap: "6px", whiteSpace: "nowrap" }}>
                        <button onClick={(e) => chamarPaciente(c, e)} style={{ backgroundColor: "#0284c7", color: "white", border: "none", padding: "6px 10px", borderRadius: "6px", cursor: "pointer", fontWeight: "600", fontSize: "13px", display: "flex", alignItems: "center", gap: "4px" }}>
                          <MdCampaign size={16} /> Chamar
                        </button>
                        <button onClick={() => iniciarAtendimentoVeterinario(c)} style={{ backgroundColor: "#4f46e5", color: "white", border: "none", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontWeight: "600", fontSize: "13px" }}>
                          💉 Atender
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
              <div><strong>Peso:</strong> {consultaDetalhes.peso_atendimento ?? consultaDetalhes.peso ? `${consultaDetalhes.peso_atendimento ?? consultaDetalhes.peso} kg` : "-"}</div>
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
    </Layout>
  );
}

export default Consultas;