import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MdEvent, MdVisibility, MdPrint, MdMedicalServices, MdVaccines, MdPsychology, MdAutoAwesome, MdScience, MdLocalHospital, MdTv } from "react-icons/md";
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
  const tituloPagina = perfilUsuario === "VETERINARIO" ? "Atendimentos" : "Recepção & Check-in";

  const [codigo, setCodigo] = useState("");
  const [animalId, setAnimalId] = useState("");
  const [usuarioId, setUsuarioId] = useState("");
  const [statusAtendimento, setStatusAtendimento] = useState("AGUARDANDO_TRIAGEM");
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
  
  // NOVOS CAMPOS: TPC e Mucosas
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
      setConsultas(response.data);
      return response.data;
    } catch (error) {
      if (error.response?.status === 401) tratarSessaoExpirada();
      return [];
    }
  };

  const carregarAnimais = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const response = await api.get("/animais/", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAnimais(response.data);
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
      
      const apenasVets = response.data.filter(
        (u) => u.perfil === "VETERINARIO"
      );
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
        if (animalEncontrado.idade !== undefined && animalEncontrado.idade !== null) {
          setIdadeAtendimento(animalEncontrado.idade);
        } else {
          setIdadeAtendimento("");
        }
      }
    }
  };

  const iniciarAtendimentoVeterinario = async (consulta) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return tratarSessaoExpirada();

      const config = {
        headers: { Authorization: `Bearer ${token}` },
      };

      let dadosTriagem = {};
      try {
        const respTriagem = await api.get(`/triagem/consulta/${consulta.id}`, config);
        if (respTriagem.data) {
          dadosTriagem = respTriagem.data;
        }
      } catch (errTriagem) {
        console.warn("Nenhuma triagem encontrada para esta consulta:", errTriagem);
      }

      const tempVal = consulta.temperatura ?? dadosTriagem?.temperatura ?? "";
      const fcVal = consulta.frequencia_cardiaca ?? dadosTriagem?.frequencia_cardiaca ?? "";
      const frVal = consulta.frequencia_respiratoria ?? dadosTriagem?.frequencia_respiratoria ?? "";
      const pesoVal = consulta.peso_atendimento ?? dadosTriagem?.peso ?? "";
      const tpcVal = dadosTriagem?.tpc_segundos ?? "";
      const mucosasVal = dadosTriagem?.mucosas ?? "Normocoradas";

      setTemperatura(tempVal);
      setFrequenciaCardiaca(fcVal);
      setFrequenciaRespiratoria(frVal);
      setPesoAtendimento(pesoVal);
      setTpcSegundos(tpcVal);
      setMucosas(mucosasVal);
      setStatusAtendimento("Em Atendimento");

      await api.put(
        `/consultas/${consulta.id}`,
        {
          codigo: consulta.codigo,
          animal_id: consulta.animal_id,
          usuario_id: consulta.usuario_id,
          status: "Em Atendimento",
          queixa_principal: consulta.queixa_principal,
          historico_clinico: consulta.historico_clinico,
          sintomas: consulta.sintomas,
          exame_fisico: consulta.exame_fisico,
          suspeita_diagnostica: consulta.suspeita_diagnostica,
          peso_atendimento: pesoVal !== "" ? Number(pesoVal) : null,
          temperatura: tempVal !== "" ? Number(tempVal) : null,
          frequencia_cardiaca: fcVal !== "" ? Number(fcVal) : null,
          frequencia_respiratoria: frVal !== "" ? Number(frVal) : null,
          parecer_copiloto: consulta.parecer_copiloto,
          observacoes: consulta.observacoes,
          indicacao_cirurgia: consulta.indicacao_cirurgia,
          justificativa_cirurgica: consulta.justificativa_cirurgica,
          solicitar_exames_preventivos: consulta.solicitar_exames_preventivos
        },
        config
      );

      editarConsulta({ ...consulta, status: "Em Atendimento" });
      carregarConsultas();
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
      const mensagemDetalhada =
        error.response?.data?.detail || "Ocorreu um erro ao analisar os dados/anexos do atendimento.";
      setSugestoesCopiloto(`⚠️ ${mensagemDetalhada}`);
    } finally {
      setCarregandoCopiloto(false);
    }
  };

  const limparFormulario = () => {
    setConsultaEditando(null);
    setCodigo("");
    setAnimalId("");
    setUsuarioId("");
    setStatusAtendimento("AGUARDANDO_TRIAGEM");
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

      const config = {
        headers: { Authorization: `Bearer ${token}` },
      };

      const animalEncontrado = animais.find((a) => a.id === Number(animalId));

      if (animalEncontrado) {
        let dadosAtualizadosAnimal = { ...animalEncontrado };
        let houveMudancaAnimal = false;

        if (idadeAtendimento !== "" && idadeAtendimento !== null) {
          dadosAtualizadosAnimal.idade = parseFloat(idadeAtendimento);
          houveMudancaAnimal = true;
        }

        if (pesoAtendimento !== "" && pesoAtendimento !== null) {
          dadosAtualizadosAnimal.peso = parseFloat(pesoAtendimento);
          houveMudancaAnimal = true;
        }

        if (houveMudancaAnimal) {
          try {
            await api.put(`/animais/${animalId}`, dadosAtualizadosAnimal, config);
          } catch (errAnimal) {
            console.warn("Aviso ao atualizar cadastro oficial do animal:", errAnimal);
          }
        }
      }

      let statusFinal = statusAtendimento;
      if (indicacaoCirurgia) {
        statusFinal = "Aguardando Cirurgia";
      }

      const novaConsulta = {
        codigo: codigo && codigo.trim() !== "" ? codigo.trim() : null,
        animal_id: Number(animalId),
        usuario_id: usuarioId && usuarioId !== "" ? Number(usuarioId) : null,
        status: statusFinal,
        queixa_principal: queixaPrincipal && queixaPrincipal.trim() !== "" ? queixaPrincipal.trim() : "Check-in de rotina / Recepção",
        historico_clinico: historicoClinico || null,
        sintomas: sintomas || null,
        exame_fisico: exameFisico || null,
        suspeita_diagnostica: suspeitaDiagnostica || null,
        peso_atendimento: pesoAtendimento !== "" ? Number(pesoAtendimento) : null,
        temperatura: temperatura !== "" && temperatura !== null ? Number(temperatura) : null,
        frequencia_cardiaca: frequenciaCardiaca !== "" && frequenciaCardiaca !== null ? Number(frequenciaCardiaca) : null,
        frequencia_respiratoria: frequenciaRespiratoria !== "" && frequenciaRespiratoria !== null ? Number(frequenciaRespiratoria) : null,
        parecer_copiloto: sugestoesCopiloto || null,
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

      setMensagemSucesso(
        consultaEditando
          ? "✅ Atendimento e cadastro atualizados com sucesso!"
          : "✅ Check-in realizado e cadastro atualizado com sucesso!"
      );
    } catch (error) {
      console.error("ERRO SALVAR CONSULTA:", error);
      if (error.response?.status === 401) return tratarSessaoExpirada();
      
      const detalheErro = error.response?.data?.detail;
      if (Array.isArray(detalheErro)) {
        const mensagens = detalheErro.map(err => `${err.loc.join(" -> ")}: ${err.msg}`).join(" | ");
        setMensagemErro(`❌ Erros de validação: ${mensagens}`);
      } else {
        setMensagemErro(`❌ ${detalheErro || error.message}`);
      }
    }
  };

  const deletarConsulta = async () => {
    if (!consultaParaExcluir) return;

    try {
      const token = localStorage.getItem("token");
      if (!token) return tratarSessaoExpirada();

      await api.delete(`/consultas/${consultaParaExcluir.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setMensagemSucesso("✅ Check-in/Atendimento excluído com sucesso!");
      setConsultaParaExcluir(null);
      carregarConsultas();
    } catch (error) {
      if (error.response?.status === 401) return tratarSessaoExpirada();
      setMensagemErro(`❌ Erro ao excluir: ${error.response?.data?.detail || error.message}`);
      setConsultaParaExcluir(null);
    }
  };

  const editarConsulta = async (consulta) => {
    setConsultaEditando(consulta);
    setCodigo(consulta.codigo || "");
    setAnimalId(consulta.animal_id);
    setUsuarioId(consulta.usuario_id || "");
    setStatusAtendimento(consulta.status || "Em Atendimento");
    setQueixaPrincipal(consulta.queixa_principal || "");
    setHistoricoClinico(consulta.historico_clinico || "");
    setSintomas(consulta.sintomas || "");
    setExameFisico(consulta.exame_fisico || "");
    setSuspeitaDiagnostica(consulta.suspeita_diagnostica || "");

    let dadosTriagem = {};
    try {
      const token = localStorage.getItem("token");
      const respTriagem = await api.get(`/triagem/consulta/${consulta.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (respTriagem.data) {
        dadosTriagem = respTriagem.data;
      }
    } catch (errTriagem) {
      console.warn("Nenhuma triagem encontrada para esta consulta:", errTriagem);
    }

    const tempVal = consulta.temperatura ?? dadosTriagem?.temperatura ?? "";
    const fcVal = consulta.frequencia_cardiaca ?? dadosTriagem?.frequencia_cardiaca ?? "";
    const frVal = consulta.frequencia_respiratoria ?? dadosTriagem?.frequencia_respiratoria ?? "";
    const pesoVal = consulta.peso_atendimento ?? dadosTriagem?.peso ?? "";
    const tpcVal = dadosTriagem?.tpc_segundos ?? "";
    const mucosasVal = dadosTriagem?.mucosas ?? "Normocoradas";

    setTemperatura(tempVal !== null && tempVal !== undefined ? tempVal : "");
    setFrequenciaCardiaca(fcVal !== null && fcVal !== undefined ? fcVal : "");
    setFrequenciaRespiratoria(frVal !== null && frVal !== undefined ? frVal : "");
    setPesoAtendimento(pesoVal !== null && pesoVal !== undefined ? pesoVal : "");
    setTpcSegundos(tpcVal !== null && tpcVal !== undefined ? tpcVal : "");
    setMucosas(mucosasVal);

    const animalEncontrado = animais.find((a) => a.id === consulta.animal_id);
    setIdadeAtendimento(animalEncontrado?.idade ?? "");

    setObservacoes(consulta.observacoes || dadosTriagem?.observacoes || "");
    setIndicacaoCirurgia(consulta.indicacao_cirurgia || false);
    setJustificativaCirurgica(consulta.justificativa_cirurgica || "");
    setSolicitarExamesPreventivos(consulta.solicitar_exames_preventivos || false);
    setSugestoesCopiloto(consulta.parecer_copiloto || "");
    setArquivoExame(null);
    setMostrarFormulario(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const obterAnimalCompleto = (id) => {
    return animais.find((item) => item.id === id);
  };

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

  const imprimirFichaAtendimento = () => {
    if (!consultaDetalhes) return;

    const animal = obterAnimalCompleto(consultaDetalhes.animal_id);
    const nomeAnimal = animal ? animal.nome.replace(/\s+/g, "_") : "Paciente";
    const codigoConsulta = consultaDetalhes.codigo || `CNS-${consultaDetalhes.id}`;

    const tituloOriginal = document.title;
    document.title = `Atendimento_${nomeAnimal}_${codigoConsulta}`;

    window.print();

    setTimeout(() => {
      document.title = tituloOriginal;
    }, 1000);
  };

  const renderBadgeTemperatura = (temp) => {
    if (!temp) return "-";
    const valor = Number(temp);

    if (valor >= 39.3) {
      return (
        <span style={{ backgroundColor: "#fee2e2", color: "#991b1b", padding: "4px 8px", borderRadius: "6px", fontWeight: "bold", fontSize: "12px", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: "4px" }}>
          🔥 {valor} °C (Febre)
        </span>
      );
    }
    if (valor < 37.5) {
      return (
        <span style={{ backgroundColor: "#e0f2fe", color: "#0369a1", padding: "4px 8px", borderRadius: "6px", fontWeight: "bold", fontSize: "12px", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: "4px" }}>
          ❄️ {valor} °C (Baixa)
        </span>
      );
    }
    return <span style={{ color: "#166534", fontWeight: "600", whiteSpace: "nowrap" }}>{valor} °C</span>;
  };

  const renderBadgeStatus = (st) => {
    const statusVal = st || "AGUARDANDO_TRIAGEM";
    const configs = {
      AGUARDANDO_TRIAGEM: { bg: "#fef3c7", color: "#b45309", label: "📋 Aguardando Triagem" },
      "Aguardando Triagem (Recepção)": { bg: "#fef3c7", color: "#b45309", label: "📋 Aguardando Triagem" },
      AGUARDANDO_CONSULTA: { bg: "#e0f2fe", color: "#0369a1", label: "🩺 Aguardando Consulta" },
      "Aguardando Consulta (Fila Vet)": { bg: "#e0f2fe", color: "#0369a1", label: "🩺 Aguardando Consulta" },
      EM_ATENDIMENTO: { bg: "#e0e7ff", color: "#3730a3", label: "💉 Em Atendimento" },
      "Em Atendimento": { bg: "#e0e7ff", color: "#3730a3", label: "💉 Em Atendimento" },
      AGUARDANDO_VACINA: { bg: "#ccfbf1", color: "#0f766e", label: "💉 Aguardando Vacina" },
      "Aguardando Vacina": { bg: "#ccfbf1", color: "#0f766e", label: "💉 Aguardando Vacina" },
      EM_VACINACAO: { bg: "#99f6e4", color: "#115e59", label: "🦠 Em Vacinação" },
      "Em Vacinação": { bg: "#99f6e4", color: "#115e59", label: "🦠 Em Vacinação" },
      FINALIZADO: { bg: "#dcfce7", color: "#166534", label: "✅ Finalizado" },
      "Finalizado": { bg: "#dcfce7", color: "#166534", label: "✅ Finalizado" },
      CONCLUIDA: { bg: "#dcfce7", color: "#166534", label: "✅ Finalizado" },
      CANCELADO: { bg: "#fee2e2", color: "#991b1b", label: "❌ Cancelado" },
      "Cancelado": { bg: "#fee2e2", color: "#991b1b", label: "❌ Cancelado" },
      CANCELADA: { bg: "#fee2e2", color: "#991b1b", label: "❌ Cancelado" },
      "Aguardando Cirurgia": { bg: "#fef3c7", color: "#b45309", label: "🔪 Aguardando Cirurgia" },
      "Em Cirurgia": { bg: "#e0e7ff", color: "#3730a3", label: "⚡ Em Cirurgia" },
      "Em Observação": { bg: "#fef08a", color: "#854d0e", label: "👁️ Em Observação" },
      "Cirurgia Concluída": { bg: "#dcfce7", color: "#166534", label: "✅ Cirurgia Concluída" },
      "Concluída": { bg: "#dcfce7", color: "#166534", label: "✅ Cirurgia Concluída" }
    };
    const conf = configs[statusVal] || configs.AGUARDANDO_TRIAGEM;

    return (
      <span style={{ backgroundColor: conf.bg, color: conf.color, padding: "4px 10px", borderRadius: "999px", fontSize: "12px", fontWeight: "600", whiteSpace: "nowrap" }}>
        {conf.label}
      </span>
    );
  };

  const renderizarTextoFormatadoIA = (textoBruto) => {
    if (!textoBruto) return null;

    const textoSemJson = textoBruto.split("```json")[0].trim();
    const linhas = textoSemJson.split("\n");

    return linhas.map((linha, idx) => {
      const linhaLimpa = linha.trim();
      if (!linhaLimpa) return <div key={idx} style={{ height: "8px" }} />;

      if (linhaLimpa.startsWith("🚨") || linhaLimpa.startsWith("🖼️") || linhaLimpa.startsWith("🔍") || linhaLimpa.startsWith("📋") || linhaLimpa.startsWith("⚠️")) {
        const textoTitulo = linhaLimpa.replace(/\*\*/g, "");
        return (
          <h4 key={idx} style={{ color: "#0369a1", margin: "16px 0 6px 0", fontSize: "15px", fontWeight: "700", borderBottom: "1px solid #bae6fd", paddingBottom: "4px" }}>
            {textoTitulo}
          </h4>
        );
      }

      let conteudoFormatado = linhaLimpa
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .replace(/^-\s*/, "• ");

      return (
        <p key={idx} style={{ margin: "4px 0", fontSize: "14px", color: "#334155", lineHeight: "1.5" }}>
          {conteudoFormatado}
        </p>
      );
    });
  };

  const consultasFiltradas = consultas.filter((c) => {
    const statusVal = c.status || "AGUARDANDO_TRIAGEM";
    const ehFinalizado = ["FINALIZADO", "CONCLUIDA", "Concluída", "CANCELADO", "CANCELADA", "Finalizado", "Cancelado"].includes(statusVal);

    if (abaAtiva === "ativos" && ehFinalizado) return false;
    if (abaAtiva === "finalizados" && !ehFinalizado) return false;

    const termo = busca.toLowerCase();
    const cod = (c.codigo || `CNS-${String(c.id).padStart(4, "0")}`).toLowerCase();
    const nomeA = obterNomeAnimal(c.animal_id).toLowerCase();
    const queixa = (c.queixa_principal || "").toLowerCase();

    return cod.includes(termo) || nomeA.includes(termo) || queixa.includes(termo);
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
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
          flexWrap: "wrap",
          gap: "12px",
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
          <span style={{ display: "inline-flex", width: "38px", height: "38px", alignItems: "center", justifyContent: "center" }}>
            <MdEvent color="#4f46e5" size="{38}"/>
          </span>
          {tituloPagina}
        </h1>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          {/* BOTÃO DE ATALHO EXCLUSIVO PARA RECEPÇÃO E ADMIN */}
          {["RECEPCAO", "ADMIN"].includes(perfilUsuario) && (
            <button
              type="button"
              onClick={() => window.open("/painel", "_blank")}
              style={{
                backgroundColor: "#0284c7",
                color: "#ffffff",
                border: "none",
                padding: "10px 18px",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "600",
                fontSize: "14px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                boxShadow: "0 2px 4px rgba(2, 132, 199, 0.2)",
              }}
            >
              <MdTv size={20} />
              Abrir Painel da Recepção (TV)
            </button>
          )}

          {["ADMIN", "RECEPCAO"].includes(perfilUsuario) && (
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
              {mostrarFormulario ? "Fechar Formulário" : "＋ Fazer Check-in"}
            </button>
          )}
        </div>
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

      {/* CARD DO FORMULÁRIO DE ATENDIMENTO */}
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
              {consultaEditando ? "✏️ Editar Check-in / Atendimento" : "📋 Realizar Novo Check-in"}
            </h3>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "18px",
            }}
          >
            <div>
              <label style={estiloLabel}>Código do Atendimento</label>
              <input
                type="text"
                placeholder="Ex: CNS-0001 (Automático)"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                style={{ ...estiloInput, backgroundColor: "#f9fafb" }}
              />
            </div>

            <div>
              <label style={estiloLabel}>Paciente (Animal) *</label>
              <select
                value={animalId}
                onChange={handleAnimalChange}
                style={estiloInput}
              >
                <option value="">Selecione o Paciente</option>
                {animais.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nome} ({a.codigo || `PET-${a.id}`}) - {a.especie}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={estiloLabel}>Idade do Pet (Anos)</label>
              <input
                type="number"
                step="0.5"
                placeholder="Ex: 3.5"
                value={idadeAtendimento}
                onChange={(e) => setIdadeAtendimento(e.target.value)}
                style={estiloInput}
                disabled={perfilUsuario === "VETERINARIO"}
              />
            </div>

            <div>
              <label style={estiloLabel}>Peso Atual (Kg)</label>
              <input
                type="number"
                step="0.1"
                placeholder="Ex: 14.2"
                value={pesoAtendimento}
                onChange={(e) => setPesoAtendimento(e.target.value)}
                style={estiloInput}
              />
            </div>

            <div>
              <label style={estiloLabel}>Veterinário Responsável</label>
              <select
                value={usuarioId}
                onChange={(e) => setUsuarioId(e.target.value)}
                style={estiloInput}
              >
                <option value="">Automático / Qualquer Disponível</option>
                {usuarios.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nome || u.email}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={estiloLabel}>Status do Atendimento</label>
              <select 
                value={statusAtendimento} 
                onChange={(e) => setStatusAtendimento(e.target.value)}
                style={estiloInput}
              >
                <option value="Aguardando Triagem (Recepção)">Aguardando Triagem (Recepção)</option>
                <option value="Aguardando Consulta (Fila Vet)">Aguardando Consulta (Fila Vet)</option>
                <option value="Em Atendimento">Em Atendimento</option>
                <option value="Aguardando Vacina">Aguardando Vacina</option>
                <option value="Em Vacinação">Em Vacinação</option>
                <option value="Aguardando Cirurgia">Aguardando Cirurgia</option>
                <option value="Em Cirurgia">Em Cirurgia</option>
                <option value="Em Observação">Em Observação</option>
                <option value="Cirurgia Concluída">Cirurgia Concluída</option>
                <option value="Finalizado">Finalizado</option>
                <option value="Cancelado">Cancelado</option>
              </select>
            </div>

            {perfilUsuario !== "RECEPCAO" && (
              <>
                <div>
                  <label style={estiloLabel}>Temperatura (°C)</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="Ex: 38.5"
                    value={temperatura}
                    onChange={(e) => setTemperatura(e.target.value)}
                    style={estiloInput}
                  />
                </div>

                <div>
                  <label style={estiloLabel}>Freq. Cardíaca (bpm)</label>
                  <input
                    type="number"
                    placeholder="Ex: 110"
                    value={frequenciaCardiaca}
                    onChange={(e) => setFrequenciaCardiaca(e.target.value)}
                    style={estiloInput}
                  />
                </div>

                <div>
                  <label style={estiloLabel}>Freq. Respiratória (mpm)</label>
                  <input
                    type="number"
                    placeholder="Ex: 24"
                    value={frequenciaRespiratoria}
                    onChange={(e) => setFrequenciaRespiratoria(e.target.value)}
                    style={estiloInput}
                  />
                </div>

                {/* NOVOS CAMPOS EXIBIDOS DE FORMA DINÂMICA */}
                <div>
                  <label style={estiloLabel}>TPC (segundos)</label>
                  <input
                    type="number"
                    placeholder="Ex: 2"
                    value={tpcSegundos}
                    onChange={(e) => setTpcSegundos(e.target.value)}
                    style={estiloInput}
                  />
                </div>

                <div>
                  <label style={estiloLabel}>Mucosas</label>
                  <select
                    value={mucosas}
                    onChange={(e) => setMucosas(e.target.value)}
                    style={estiloInput}
                  >
                    <option value="Normocoradas">Normocoradas (Rosadas)</option>
                    <option value="Hipocoradas / Pálidas">Hipocoradas / Pálidas</option>
                    <option value="Cianóticas">Cianóticas (Roxas)</option>
                    <option value="Ictéricas">Ictéricas (Amareladas)</option>
                    <option value="Congestas / Hiperêmicas">Congestas / Vermelhas</option>
                  </select>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gridColumn: "span 2" }}>
                  <label style={estiloLabel}>Exames de Rotina</label>
                  <div
                    style={{
                      backgroundColor: "#f0fdf4",
                      border: "1px solid #bbf7d0",
                      borderRadius: "8px",
                      padding: "0 12px",
                      minHeight: "42px",
                      display: "flex",
                      alignItems: "center",
                      boxSizing: "border-box",
                      width: "100%",
                    }}
                  >
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        cursor: "pointer",
                        fontSize: "13px",
                        fontWeight: "600",
                        color: "#166534",
                        margin: 0,
                        width: "100%",
                        whiteSpace: "normal",
                        lineHeight: "1.2",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={solicitarExamesPreventivos}
                        onChange={(e) => setSolicitarExamesPreventivos(e.target.checked)}
                        style={{
                          width: "16px",
                          height: "16px",
                          cursor: "pointer",
                          accentColor: "#166534",
                          flexShrink: 0,
                        }}
                      />
                      <span>🧪 Solicitar Exames Preventivos / Check-up</span>
                    </label>
                  </div>
                </div>
              </>
            )}
          </div>

          <div style={{ marginTop: "18px", display: "grid", gap: "18px" }}>
            {perfilUsuario !== "RECEPCAO" && (
              <div>
                <label style={estiloLabel}>Queixa Principal / Motivo</label>
                <input
                  type="text"
                  placeholder="Ex: Prostração, inapetência e vômito há 2 dias"
                  value={queixaPrincipal}
                  onChange={(e) => setQueixaPrincipal(e.target.value)}
                  style={estiloInput}
                />
              </div>
            )}

            {perfilUsuario !== "RECEPCAO" && (
              <div>
                <label style={estiloLabel}>Sintomas Relatados</label>
                <textarea
                  rows={2}
                  placeholder="Descrição dos sintomas..."
                  value={sintomas}
                  onChange={(e) => setSintomas(e.target.value)}
                  style={{ ...estiloInput, height: "auto", padding: "10px" }}
                />
              </div>
            )}

            {perfilUsuario !== "RECEPCAO" && (
              <div>
                <label style={estiloLabel}>Histórico Clínico e Observações</label>
                <textarea
                  rows={2}
                  placeholder="Histórico de vacinação, alimentação e conduta tomadas..."
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  style={{ ...estiloInput, height: "auto", padding: "10px" }}
                />
              </div>
            )}

            {perfilUsuario === "RECEPCAO" && (
              <div>
                <label style={estiloLabel}>Observações / Motivo da Visita (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ex: Rotina, vacinação, consulta geral..."
                  value={queixaPrincipal}
                  onChange={(e) => setQueixaPrincipal(e.target.value)}
                  style={estiloInput}
                />
              </div>
            )}

            {perfilUsuario !== "RECEPCAO" && (
              <div>
                <label style={estiloLabel}>Exame Físico / Achados Clínicos</label>
                <textarea
                  rows={2}
                  placeholder="Nível de desidratação, palpação abdominal, ausculta cardiopulmonar..."
                  value={exameFisico}
                  onChange={(e) => setExameFisico(e.target.value)}
                  style={{ ...estiloInput, height: "auto", padding: "10px" }}
                />
              </div>
            )}

            {/* BLOCO DO COPILOTO CLÍNICO */}
            {perfilUsuario !== "RECEPCAO" && (
              <div
                style={{
                  backgroundColor: "#f0f9ff",
                  border: "1px solid #bae6fd",
                  borderRadius: "12px",
                  padding: "20px",
                  marginTop: "12px",
                  marginBottom: "12px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                  <h3 style={{ margin: 0, fontSize: "17px", color: "#0369a1", display: "flex", alignItems: "center", gap: "8px", fontWeight: "700" }}>
                    <span style={{ display: "inline-flex", width: "26px", height: "26px", alignItems: "center", justifyContent: "center" }}>
                      <MdPsychology color="#0284c7" size="{26}"/>
                    </span>
                    Copiloto Clínico & Análise de Exames (VetAssist AI)
                  </h3>
                  <button
                    type="button"
                    onClick={consultarCopilotoComAnexo}
                    disabled={carregandoCopiloto}
                    style={{
                      backgroundColor: "#0284c7",
                      color: "white",
                      border: "none",
                      padding: "9px 18px",
                      borderRadius: "8px",
                      cursor: "pointer",
                      fontWeight: "600",
                      fontSize: "14px",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <span style={{ display: "inline-flex", width: "20px", height: "20px", alignItems: "center", justifyContent: "center" }}>
                      <MdAutoAwesome size="{20}"/>
                    </span>
                    {carregandoCopiloto ? "Analisando Exame & Atendimento..." : "Analisar Atendimento + Exame"}
                  </button>
                </div>

                <div style={{ marginBottom: "14px" }}>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#0369a1", marginBottom: "6px" }}>
                    📎 Anexar Raio-X, Ultrassom ou Laudo (Imagem ou PDF) para a IA analisar:
                  </label>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => setArquivoExame(e.target.files[0])}
                    style={{
                      width: "100%",
                      padding: "8px",
                      border: "1px dashed #0284c7",
                      borderRadius: "8px",
                      backgroundColor: "#ffffff",
                      fontSize: "13px",
                      color: "#334155",
                      boxSizing: "border-box",
                    }}
                  />
                  {arquivoExame && (
                    <span style={{ fontSize: "12px", color: "#16a34a", fontWeight: "600", marginTop: "4px", display: "block" }}>
                      ✓ Arquivo selecionado: {arquivoExame.name}
                    </span>
                  )}
                </div>

                <div style={{ marginBottom: "14px" }}>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#0369a1", marginBottom: "6px" }}>
                    🩺 Suspeita Diagnóstica (Preenchido pela IA ou Editável)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="As hipóteses diagnósticas principais aparecerão aqui após a análise da IA..."
                    value={suspeitaDiagnostica}
                    onChange={(e) => setSuspeitaDiagnostica(e.target.value)}
                    style={{ ...estiloInput, height: "auto", padding: "10px", borderColor: "#0284c7", backgroundColor: "#ffffff" }}
                  />
                </div>

                <div style={{ backgroundColor: indicacaoCirurgia ? "#fef3c7" : "#f8fafc", border: `1px solid ${indicacaoCirurgia ? "#f59e0b" : "#cbd5e1"}`, borderRadius: "8px", padding: "12px 16px", marginBottom: "14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ display: "inline-flex", width: "22px", height: "22px", alignItems: "center", justifyContent: "center" }}>
                      <MdLocalHospital size={22} color={indicacaoCirurgia ? "#d97706" : "#64748b"} />
                    </span>
                    <div>
                      <span style={{ fontSize: "14px", fontWeight: "bold", color: indicacaoCirurgia ? "#b45309" : "#334155" }}>
                        {indicacaoCirurgia ? "🔪 IA Detectou Indicação Cirúrgica para este Caso!" : "Sem indicação cirúrgica automática detetada."}
                      </span>
                      {justificativaCirurgica && (
                        <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#475569" }}>
                          {justificativaCirurgica}
                        </p>
                      )}
                    </div>
                  </div>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "13px", fontWeight: "600", color: "#1e293b", whiteSpace: "nowrap" }}>
                    <input
                      type="checkbox"
                      checked={indicacaoCirurgia}
                      onChange={(e) => setIndicacaoCirurgia(e.target.checked)}
                      style={{ width: "16px", height: "16px", cursor: "pointer" }}
                    />
                    Forçar Cirurgia
                  </label>
                </div>

                {sugestoesCopiloto ? (
                  <div
                    style={{
                      backgroundColor: "#ffffff",
                      padding: "20px",
                      borderRadius: "10px",
                      border: "1px solid #e0f2fe",
                      color: "#1e293b",
                      fontSize: "14px",
                      lineHeight: "1.6",
                      textAlign: "left",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                    }}
                  >
                    {renderizarTextoFormatadoIA(sugestoesCopiloto)}
                  </div>
                ) : (
                  <p style={{ margin: 0, fontSize: "14px", color: "#0369a1", textAlign: "left" }}>
                    Preencha a queixa principal, opcionalmente selecione se deseja exames preventivos, e clique em <strong>Analisar Atendimento + Exame</strong>.
                  </p>
                )}
              </div>
            )}
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: "24px",
              paddingTop: "16px",
              borderTop: "1px solid #f3f4f6",
              flexWrap: "wrap",
              gap: "10px",
            }}
          >
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {perfilUsuario !== "RECEPCAO" && consultaEditando && (
                <>
                  <button
                    type="button"
                    onClick={() => irParaPrescricao(consultaEditando)}
                    style={{ backgroundColor: "#4f46e5", color: "white", border: "none", padding: "10px 16px", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "13px" }}
                  >
                    💊 Receitar
                  </button>
                  <button
                    type="button"
                    onClick={() => irParaExames(consultaEditando)}
                    style={{ backgroundColor: "#0284c7", color: "white", border: "none", padding: "10px 16px", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "13px" }}
                  >
                    🧪 Exames
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      navigate("/internacao", {
                        state: {
                          animalId: consultaEditando.animal_id,
                          motivo: consultaEditando.queixa_principal || consultaEditando.observacoes || "Encaminhado do Atendimento"
                        }
                      });
                    }}
                    style={{ backgroundColor: "#0284c7", color: "white", border: "none", padding: "10px 16px", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "13px" }}
                  >
                    🏥 Internar / Obs
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate("/vacinas")}
                    style={{ backgroundColor: "#16a34a", color: "white", border: "none", padding: "10px 16px", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "13px" }}
                  >
                    💉 Vacinar
                  </button>
                </>
              )}
            </div>

            <div style={{ display: "flex", gap: "10px", marginLeft: "auto" }}>
              <button
                type="button"
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
                Fechar / Cancelar
              </button>
              <button
                type="button"
                onClick={salvarConsulta}
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
                {perfilUsuario === "RECEPCAO" ? "Salvar Check-in" : "Salvar Atendimento"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ABAS DE FILTRO, BARRA DE PESQUISA E TABELA */}
      {!mostrarFormulario && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
            <div style={{ display: "flex", gap: "8px", backgroundColor: "#e2e8f0", padding: "4px", borderRadius: "10px" }}>
              <button
                onClick={() => setAbaAtiva("ativos")}
                style={{
                  backgroundColor: abaAtiva === "ativos" ? "#4f46e5" : "transparent",
                  color: abaAtiva === "ativos" ? "white" : "#475569",
                  border: "none",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: "600",
                  fontSize: "13px",
                  transition: "all 0.2s",
                }}
              >
                🟢 Ativos / Em Andamento
              </button>
              <button
                onClick={() => setAbaAtiva("finalizados")}
                style={{
                  backgroundColor: abaAtiva === "finalizados" ? "#4f46e5" : "transparent",
                  color: abaAtiva === "finalizados" ? "white" : "#475569",
                  border: "none",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: "600",
                  fontSize: "13px",
                  transition: "all 0.2s",
                }}
              >
                ✅ Finalizados
              </button>
              <button
                onClick={() => setAbaAtiva("todos")}
                style={{
                  backgroundColor: abaAtiva === "todos" ? "#4f46e5" : "transparent",
                  color: abaAtiva === "todos" ? "white" : "#475569",
                  border: "none",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: "600",
                  fontSize: "13px",
                  transition: "all 0.2s",
                }}
              >
                📋 Todos
              </button>
            </div>

            <div style={{ flex: 1, minWidth: "260px" }}>
              <input
                type="text"
                placeholder="🔍 Pesquisar por código, paciente ou queixa principal..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                style={{
                  width: "100%",
                  height: "42px",
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
          </div>

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
                minWidth: "950px",
                borderCollapse: "collapse",
                textAlign: "center",
              }}
            >
              <thead>
                <tr style={{ backgroundColor: "#4f46e5", color: "white", fontSize: "14px" }}>
                  <th style={{ padding: "14px", whiteSpace: "nowrap" }}>Código</th>
                  <th style={{ padding: "14px", whiteSpace: "nowrap" }}>Data/Hora</th>
                  <th style={{ padding: "14px", whiteSpace: "nowrap" }}>Paciente</th>
                  <th style={{ padding: "14px" }}>Queixa Principal</th>
                  <th style={{ padding: "14px", whiteSpace: "nowrap" }}>Peso</th>
                  {perfilUsuario !== "RECEPCAO" && (
                    <th style={{ padding: "14px", whiteSpace: "nowrap" }}>Temperatura</th>
                  )}
                  <th style={{ padding: "14px", whiteSpace: "nowrap" }}>Status</th>
                  <th style={{ padding: "14px", whiteSpace: "nowrap" }}>Ações</th>
                </tr>
              </thead>

              <tbody>
                {consultasFiltradas.length > 0 ? (
                  consultasFiltradas.map((c, index) => (
                    <tr
                      key={c.id}
                      style={{
                        backgroundColor: index % 2 === 0 ? "#ffffff" : "#f9fafb",
                        borderBottom: "1px solid #f3f4f6",
                        fontSize: "14px",
                      }}
                    >
                      <td style={{ padding: "14px", fontWeight: "bold", color: "#4f46e5", whiteSpace: "nowrap" }}>
                        {c.codigo || `CNS-${String(c.id).padStart(4, "0")}`}
                        {c.indicacao_cirurgia && (
                          <span title="Possui Indicação Cirúrgica" style={{ marginLeft: "6px", fontSize: "14px" }}>🔪</span>
                        )}
                      </td>
                      <td style={{ padding: "14px", color: "#4b5563", whiteSpace: "nowrap" }}>
                        {c.data_consulta
                          ? new Date(c.data_consulta).toLocaleString("pt-BR", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })
                          : "-"}
                      </td>
                      <td style={{ padding: "14px", fontWeight: "600", color: "#1f2937", whiteSpace: "nowrap" }}>
                        {obterNomeAnimal(c.animal_id)}
                      </td>
                      <td style={{ padding: "14px", color: "#4b5563", maxWidth: "220px" }}>
                        {c.queixa_principal}
                      </td>
                      <td style={{ padding: "14px", color: "#4b5563", whiteSpace: "nowrap" }}>
                        {c.peso_atendimento ? `${c.peso_atendimento} kg` : "-"}
                      </td>
                      
                      {perfilUsuario !== "RECEPCAO" && (
                        <td style={{ padding: "14px", whiteSpace: "nowrap" }}>
                          {renderBadgeTemperatura(c.temperatura)}
                        </td>
                      )}

                      <td style={{ padding: "14px", whiteSpace: "nowrap" }}>
                        {renderBadgeStatus(c.status)}
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
                        {!["FINALIZADO", "CONCLUIDA", "CANCELADO", "CANCELADA", "Finalizado", "Cancelado"].includes(c.status) && perfilUsuario !== "RECEPCAO" && (
                          <button
                            onClick={() => iniciarAtendimentoVeterinario(c)}
                            title="Atender / Editar Atendimento"
                            style={{
                              backgroundColor: "#4f46e5",
                              color: "white",
                              border: "none",
                              padding: "6px 12px",
                              borderRadius: "6px",
                              cursor: "pointer",
                              fontWeight: "600",
                              fontSize: "13px",
                              display: "flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            💉 Atender
                          </button>
                        )}

                        {perfilUsuario === "RECEPCAO" && (
                          <button
                            onClick={() => editarConsulta(c)}
                            title="Editar Check-in"
                            style={{
                              backgroundColor: "#e0e7ff",
                              color: "#3730a3",
                              border: "none",
                              padding: "6px 12px",
                              borderRadius: "6px",
                              cursor: "pointer",
                              fontWeight: "600",
                              fontSize: "13px",
                              display: "flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            ✏️ Editar
                          </button>
                        )}

                        <button
                          onClick={() => setConsultaDetalhes(c)}
                          title="Ver Ficha Completa"
                          style={{
                            backgroundColor: "#f3f4f6",
                            color: "#374151",
                            border: "none",
                            padding: "6px 12px",
                            borderRadius: "6px",
                            cursor: "pointer",
                            fontWeight: "600",
                            fontSize: "13px",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          <span style={{ display: "inline-flex", width: "16px", height: "16px", alignItems: "center", justifyContent: "center" }}>
                            <MdVisibility size="{16}"/>
                          </span>
                          Ver
                        </button>

                        <button
                          onClick={() => setConsultaParaExcluir(c)}
                          title="Excluir Atendimento / Check-in"
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
                          🗑️ {perfilUsuario === "RECEPCAO" ? "Excluir" : ""}
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={perfilUsuario === "RECEPCAO" ? "7" : "8"} style={{ padding: "24px", color: "#6b7280", fontSize: "14px" }}>
                      Nenhum atendimento encontrado nesta aba.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* MODAL DE FICHA COMPLETA DO ATENDIMENTO */}
      {consultaDetalhes && (
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
              padding: "30px",
              borderRadius: "16px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
              maxWidth: "650px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                textAlign: "center",
                borderBottom: "2px solid #4f46e5",
                paddingBottom: "14px",
                marginBottom: "20px",
              }}
            >
              <h2 style={{ margin: 0, color: "#1e1b4b", fontSize: "22px" }}>
                VetAssist AI — Ficha de Atendimento
              </h2>
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: "12px",
                  marginTop: "6px",
                }}
              >
                <span style={{ fontSize: "13px", color: "#6b7280" }}>
                  Código: <strong>{consultaDetalhes.codigo || `CNS-${consultaDetalhes.id}`}</strong>
                </span>
                <span>•</span>
                <div>{renderBadgeStatus(consultaDetalhes.status)}</div>
              </div>
            </div>

            <div style={{ backgroundColor: "#f8fafc", padding: "14px", borderRadius: "10px", marginBottom: "18px", border: "1px solid #e2e8f0", textAlign: "center" }}>
              <h4 style={{ margin: "0 0 4px 0", color: "#334155", fontSize: "15px" }}>🐾 Paciente: {obterNomeAnimal(consultaDetalhes.animal_id)}</h4>
              <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
                Data do Atendimento: {new Date(consultaDetalhes.data_consulta).toLocaleString("pt-BR")}
              </p>
              {consultaDetalhes.indicacao_cirurgia && (
                <div style={{ marginTop: "8px", display: "inline-block", backgroundColor: "#fef3c7", color: "#b45309", padding: "4px 12px", borderRadius: "6px", fontSize: "12px", fontWeight: "bold" }}>
                  🔪 Com Indicação Cirúrgica Ativa
                </div>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px", marginBottom: "20px", textAlign: "center" }}>
              <div style={{ border: "1px solid #e5e7eb", padding: "10px", borderRadius: "8px" }}>
                <span style={{ fontSize: "11px", color: "#6b7280" }}>PESO</span>
                <div style={{ fontWeight: "bold", fontSize: "15px", color: "#111827" }}>{consultaDetalhes.peso_atendimento ? `${consultaDetalhes.peso_atendimento} kg` : "-"}</div>
              </div>
              <div style={{ border: "1px solid #e5e7eb", padding: "10px", borderRadius: "8px" }}>
                <span style={{ fontSize: "11px", color: "#6b7280" }}>TEMP.</span>
                <div style={{ fontWeight: "bold", fontSize: "13px" }}>{renderBadgeTemperatura(consultaDetalhes.temperatura)}</div>
              </div>
              <div style={{ border: "1px solid #e5e7eb", padding: "10px", borderRadius: "8px" }}>
                <span style={{ fontSize: "11px", color: "#6b7280" }}>FREQ. CARDÍACA</span>
                <div style={{ fontWeight: "bold", fontSize: "15px", color: "#111827" }}>{consultaDetalhes.frequencia_cardiaca ? `${consultaDetalhes.frequencia_cardiaca} bpm` : "-"}</div>
              </div>
              <div style={{ border: "1px solid #e5e7eb", padding: "10px", borderRadius: "8px" }}>
                <span style={{ fontSize: "11px", color: "#6b7280" }}>FREQ. RESP.</span>
                <div style={{ fontWeight: "bold", fontSize: "15px", color: "#111827" }}>{consultaDetalhes.frequencia_respiratoria ? `${consultaDetalhes.frequencia_respiratoria} mpm` : "-"}</div>
              </div>
            </div>

            <div style={{ display: "grid", gap: "14px", fontSize: "14px", color: "#374151", textAlign: "left" }}>
              <div>
                <strong>Queixa Principal / Motivo:</strong>
                <p style={{ margin: "4px 0 0 0", color: "#4b5563" }}>{consultaDetalhes.queixa_principal || "-"}</p>
              </div>

              <div>
                <strong>Sintomas Relatados:</strong>
                <p style={{ margin: "4px 0 0 0", color: "#4b5563" }}>{consultaDetalhes.sintomas || "-"}</p>
              </div>

              {consultaDetalhes.suspeita_diagnostica && (
                <div>
                  <strong>Suspeita Diagnóstica:</strong>
                  <p style={{ margin: "4px 0 0 0", color: "#0369a1", fontWeight: "600" }}>{consultaDetalhes.suspeita_diagnostica}</p>
                </div>
              )}

              <div>
                <strong>Exame Físico / Achados Clínicos:</strong>
                <p style={{ margin: "4px 0 0 0", color: "#4b5563" }}>{consultaDetalhes.exame_fisico || "-"}</p>
              </div>

              <div>
                <strong>Histórico Clínico e Observações:</strong>
                <p style={{ margin: "4px 0 0 0", color: "#4b5563" }}>{consultaDetalhes.observacoes || "-"}</p>
              </div>

              {consultaDetalhes.justificativa_cirurgica && (
                <div>
                  <strong>Parecer de Indicação Cirúrgica:</strong>
                  <p style={{ margin: "4px 0 0 0", color: "#b45309", fontWeight: "500" }}>{consultaDetalhes.justificativa_cirurgica}</p>
                </div>
              )}

              {consultaDetalhes.parecer_copiloto && (
                <div
                  style={{
                    marginTop: "16px",
                    backgroundColor: "#f0f9ff",
                    border: "1px solid #bae6fd",
                    padding: "16px",
                    borderRadius: "10px",
                  }}
                >
                  <strong style={{ color: "#0369a1", display: "block", marginBottom: "10px", fontSize: "15px" }}>
                    🤖 Parecer do Copiloto Clínico & Análise de IA:
                  </strong>
                  <div>
                    {renderizarTextoFormatadoIA(consultaDetalhes.parecer_copiloto)}
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "28px", paddingTop: "16px", borderTop: "1px solid #f3f4f6" }}>
              <button
                type="button"
                onClick={imprimirFichaAtendimento}
                style={{
                  backgroundColor: "#0284c7",
                  color: "white",
                  border: "none",
                  padding: "10px 18px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: "600",
                  fontSize: "13px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  height: "40px"
                }}
              >
                <MdPrint size={18} style={{ flexShrink: 0 }} /> Imprimir / PDF
              </button>
              <button
                type="button"
                onClick={() => setConsultaDetalhes(null)}
                style={{
                  backgroundColor: "#f3f4f6",
                  color: "#374151",
                  border: "none",
                  padding: "10px 18px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: "600",
                  fontSize: "13px",
                  height: "40px"
                }}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EXCLUSÃO */}
      {consultaParaExcluir && (
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
              Tem certeza que deseja excluir o atendimento{" "}
              <strong>{consultaParaExcluir.codigo || `CNS-${consultaParaExcluir.id}`}</strong>?
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
                onClick={() => setConsultaParaExcluir(null)}
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
                onClick={deletarConsulta}
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

export default Consultas;