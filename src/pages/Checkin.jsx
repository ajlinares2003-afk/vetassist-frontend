import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MdEvent, MdTv, MdDelete, MdSearch, MdPets } from "react-icons/md";
import { FaDog, FaCat, FaFish, FaDove, FaHorse, FaFrog, FaBug, FaUser, FaClock } from "react-icons/fa";
import { GiCow, GiPig, GiSheep, GiGoat, GiRabbit } from "react-icons/gi";
import api from "../api/api";
import Layout from "../components/Layout";

function Checkin() {
  const navigate = useNavigate();
  const [animais, setAnimais] = useState([]);
  const [tutores, setTutores] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [filaCheckin, setFilaCheckin] = useState([]);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [consultaParaExcluir, setConsultaParaExcluir] = useState(null);

  // Estados do Formulário de Check-in
  const [animalId, setAnimalId] = useState("");
  const [buscaPaciente, setBuscaPaciente] = useState(""); 
  const [usuarioId, setUsuarioId] = useState("");
  const [queixaPrincipal, setQueixaPrincipal] = useState("");
  const [mensagemSucesso, setMensagemSucesso] = useState("");
  const [mensagemErro, setMensagemErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  // Lista de sintomas rápidos para os Chips
  const sintomasRapidos = ["Vômito", "Diarreia", "Tosse", "Febre", "Letargia", "Apatia", "Trauma", "Pele", "Ocular"];

  useEffect(() => {
    carregarDados();
    const intervalo = setInterval(() => carregarDados(), 5000);
    return () => clearInterval(intervalo);
  }, []);

  const carregarDados = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return navigate("/login");

      const config = { headers: { Authorization: `Bearer ${token}` } };

      const [resAnimais, resTutores, resUsuarios, resFila] = await Promise.all([
        api.get("/animais/", config),
        api.get("/tutores/", config),
        api.get("/usuarios/", config),
        api.get("/consultas/fila-triagem", config),
      ]);

      setAnimais(resAnimais.data || []);
      setTutores(resTutores.data || []);
      
      const listaUsuarios = resUsuarios.data || [];
      const apenasEnfermeiros = listaUsuarios.filter(
        (u) => u.perfil === "TRIAGEM" || u.perfil === "ENFERMEIRO"
      );
      setUsuarios(apenasEnfermeiros);

      setFilaCheckin(resFila.data || []);
    } catch (error) {
      console.error("Erro ao carregar dados da recepção:", error);
    }
  };

  const obterInfoAnimalETutor = (animalIdParam) => {
    const a = animais.find((item) => item.id === Number(animalIdParam));
    if (!a) return "Paciente desconhecido";
    
    const t = tutores.find((tutor) => tutor.id === a.tutor_id);
    const nomeTutor = t ? t.nome : "Tutor não vinculado";
    const especie = a.especie || "Pet";
    const raca = a.raca ? ` - ${a.raca}` : "";

    return `${a.nome} (${especie}${raca}) — Tutor: ${nomeTutor}`;
  };

  const animaisFiltrados = animais.filter((a) => {
    if (!buscaPaciente) return true;
    const termo = buscaPaciente.toLowerCase();
    const nomePet = (a.nome || "").toLowerCase();
    const t = tutores.find((tutor) => tutor.id === a.tutor_id);
    const nomeTutor = t ? (t.nome || "").toLowerCase() : "";
    return nomePet.includes(termo) || nomeTutor.includes(termo);
  });

  const adicionarSintoma = (sintoma) => {
    setQueixaPrincipal((prev) => {
      if (prev.toLowerCase().includes(sintoma.toLowerCase())) return prev;
      return prev ? `${prev}, ${sintoma}` : sintoma;
    });
  };

  const realizarCheckin = async (e) => {
    e.preventDefault();
    if (!animalId || !queixaPrincipal) {
      setMensagemErro("Preencha todos os campos obrigatórios (Paciente e Motivo).");
      return;
    }

    try {
      setCarregando(true);
      const token = localStorage.getItem("token");
      const config = { headers: { Authorization: `Bearer ${token}` } };

      const payload = {
        animal_id: Number(animalId),
        usuario_id: usuarioId ? Number(usuarioId) : null,
        queixa_principal: queixaPrincipal,
        status: "AGUARDANDO_TRIAGEM"
      };

      await api.post("/consultas/", payload, config);

      setMensagemSucesso("✅ Check-in realizado com sucesso! Paciente adicionado à fila.");
      setMostrarModal(false);
      setAnimalId("");
      setBuscaPaciente("");
      setUsuarioId("");
      setQueixaPrincipal("");
      carregarDados();
    } catch (error) {
      setMensagemErro(`❌ Erro ao realizar check-in: ${error.response?.data?.detail || error.message}`);
    } finally {
      setCarregando(false);
    }
  };

  const deletarCheckin = async () => {
    if (!consultaParaExcluir) return;

    try {
      const token = localStorage.getItem("token");
      const config = { headers: { Authorization: `Bearer ${token}` } };

      await api.delete(`/consultas/${consultaParaExcluir.id}`, config);

      setMensagemSucesso("✅ Check-in excluído com sucesso!");
      setConsultaParaExcluir(null);
      carregarDados();
    } catch (error) {
      setMensagemErro(`❌ Erro ao excluir check-in: ${error.response?.data?.detail || error.message}`);
      setConsultaParaExcluir(null);
    }
  };

  // Cores de fundo pastel personalizadas por espécie
  const obterCorAvatar = (especie) => {
    const esp = (especie || "").toLowerCase();
    if (esp.includes("felino") || esp.includes("gato")) return "#fce7f3"; // Rosa
    if (esp.includes("canino") || esp.includes("cão") || esp.includes("cachorro")) return "#dbeafe"; // Azul
    if (esp.includes("ave") || esp.includes("pássaro") || esp.includes("calopsita")) return "#e0f2fe"; // Azul Claro
    if (esp.includes("lagomorfo") || esp.includes("coelho") || esp.includes("lebre")) return "#fef3c7"; // Amarelo/Dourado
    if (esp.includes("bovino") || esp.includes("vaca") || esp.includes("boi") || esp.includes("touro")) return "#f5f5f4"; // Cinza Pedra
    if (esp.includes("suíno") || esp.includes("suino") || esp.includes("porco")) return "#ffe4e6"; // Rosé Suave
    if (esp.includes("ovino") || esp.includes("ovelha") || esp.includes("carneiro")) return "#f1f5f9"; // Slate Claro
    if (esp.includes("caprino") || esp.includes("cabra") || esp.includes("bode")) return "#ecfdf5"; // Esmeralda Suave
    if (esp.includes("equino") || esp.includes("cavalo") || esp.includes("égua") || esp.includes("ponei")) return "#fef3c7"; // Laranja/Palha
    return "#f3f4f6"; // Padrão
  };

  // Cores de ícones fortes correspondentes por espécie
  const obterCorIcone = (especie) => {
    const esp = (especie || "").toLowerCase();
    if (esp.includes("felino") || esp.includes("gato")) return "#be185d"; 
    if (esp.includes("canino") || esp.includes("cão") || esp.includes("cachorro")) return "#1d4ed8"; 
    if (esp.includes("ave") || esp.includes("pássaro") || esp.includes("calopsita")) return "#0369a1"; 
    if (esp.includes("lagomorfo") || esp.includes("coelho") || esp.includes("lebre")) return "#b45309"; 
    if (esp.includes("bovino") || esp.includes("vaca") || esp.includes("boi") || esp.includes("touro")) return "#44403c"; 
    if (esp.includes("suíno") || esp.includes("suino") || esp.includes("porco")) return "#e11d48"; 
    if (esp.includes("ovino") || esp.includes("ovelha") || esp.includes("carneiro")) return "#475569"; 
    if (esp.includes("caprino") || esp.includes("cabra") || esp.includes("bode")) return "#047857"; 
    if (esp.includes("equino") || esp.includes("cavalo") || esp.includes("égua") || esp.includes("ponei")) return "#b45309";
    return "#4b5563"; // Padrão
  };

  // Função para retornar o ícone exato baseado na espécie do banco de dados
  const renderizarIconeAnimal = (especie, isSelected, corUnica) => {
    const cor = corUnica ? corUnica : (isSelected ? "#fff" : "#9ca3af");
    const tamanho = 18;
    const esp = (especie || "").toLowerCase();

    // 🐄 Animais de Produção / Grandes Animais
    if (esp.includes("bovino") || esp.includes("vaca") || esp.includes("boi") || esp.includes("touro")) return <GiCow size={tamanho} color={cor} />;
    if (esp.includes("suíno") || esp.includes("suino") || esp.includes("porco")) return <GiPig size={tamanho} color={cor} />;
    if (esp.includes("ovino") || esp.includes("ovelha") || esp.includes("carneiro")) return <GiSheep size={tamanho} color={cor} />;
    if (esp.includes("caprino") || esp.includes("cabra") || esp.includes("bode")) return <GiGoat size={tamanho} color={cor} />;
    if (esp.includes("equino") || esp.includes("cavalo") || esp.includes("égua") || esp.includes("ponei")) return <FaHorse size={tamanho} color={cor} />;

    // 🐇 Lagomorfos
    if (esp.includes("lagomorfo") || esp.includes("coelho") || esp.includes("lebre")) return <GiRabbit size={tamanho} color={cor} />;

    // 🐈 Pets e Exóticos
    if (esp.includes("felino") || esp.includes("gato")) return <FaCat size={tamanho} color={cor} />;
    if (esp.includes("canino") || esp.includes("cão") || esp.includes("cachorro")) return <FaDog size={tamanho} color={cor} />;
    if (esp.includes("ave") || esp.includes("pássaro") || esp.includes("calopsita")) return <FaDove size={tamanho} color={cor} />;
    if (esp.includes("peixe") || esp.includes("aquático") || esp.includes("tilápia")) return <FaFish size={tamanho} color={cor} />;
    if (esp.includes("réptil") || esp.includes("lagarto") || esp.includes("cobra") || esp.includes("tartaruga")) return <FaFrog size={tamanho} color={cor} />; 
    if (esp.includes("inseto") || esp.includes("aracnídeo")) return <FaBug size={tamanho} color={cor} />;
    
    // 🐾 Fallback genérico
    return <MdPets size={tamanho} color={cor} />;
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
    boxSizing: "border-box"
  };

  const estiloLabel = {
    display: "block",
    fontSize: "13px",
    fontWeight: "600",
    color: "#374151",
    marginBottom: "8px"
  };

  return (
    <Layout>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
        <h1 style={{ display: "flex", alignItems: "center", gap: "12px", margin: 0, fontSize: "26px", color: "#1e1b4b" }}>
          <MdEvent color="#4f46e5" size={38} /> Recepção & Check-in
        </h1>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
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
            }}
          >
            <MdTv size={20} /> Abrir Painel (TV)
          </button>

          <button
            onClick={() => setMostrarModal(true)}
            style={{
              backgroundColor: "#4f46e5",
              color: "white",
              border: "none",
              padding: "10px 20px",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "600",
              fontSize: "14px",
            }}
          >
            ＋ Novo Check-in
          </button>
        </div>
      </div>

      {mensagemSucesso && (
        <div style={{ backgroundColor: "#dcfce7", color: "#166534", padding: "12px 16px", borderRadius: "8px", marginBottom: "15px", fontWeight: "500" }}>
          {mensagemSucesso}
        </div>
      )}

      {mensagemErro && (
        <div style={{ backgroundColor: "#fee2e2", color: "#991b1b", padding: "12px 16px", borderRadius: "8px", marginBottom: "15px", fontWeight: "500" }}>
          {mensagemErro}
        </div>
      )}

      {/* Lista de Fila de Espera Atualizada para Design System */}
      <div style={{ backgroundColor: "white", padding: "28px", borderRadius: "16px", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)", border: "1px solid #e5e7eb" }}>
        <h3 style={{ marginTop: 0, color: "#111827", fontSize: "20px", marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
          📋 Fila de Espera Atual ({filaCheckin.length} pacientes)
        </h3>

        {filaCheckin.length === 0 ? (
          <p style={{ color: "#6b7280", textAlign: "center", padding: "40px 20px", fontSize: "15px" }}>Nenhum paciente aguardando atendimento no momento.</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))", gap: "20px" }}>
            {filaCheckin.map((item) => {
              const a = animais.find((itemAnim) => itemAnim.id === Number(item.animal_id));
              const t = a ? tutores.find((tutor) => tutor.id === a.tutor_id) : null;
              
              const nomePet = a ? a.nome : "Paciente desconhecido";
              const especie = a?.especie || "Pet";
              const raca = a?.raca ? ` - ${a.raca}` : "";
              const nomeTutor = t ? t.nome : "Tutor não vinculado";

              // Transforma string de queixa principal em tags de sintomas
              const tagsSintomas = (item.queixa_principal || "")
                .split(",")
                .map((tag) => tag.trim())
                .filter(Boolean);

              const avatarBg = obterCorAvatar(especie);
              const iconColor = obterCorIcone(especie);

              return (
                <div 
                  key={item.id} 
                  style={{ 
                    display: "flex", 
                    justifyContent: "space-between", 
                    alignItems: "flex-start", 
                    padding: "20px", 
                    backgroundColor: "#ffffff", 
                    borderRadius: "16px", 
                    border: "1px solid #e5e7eb",
                    borderLeft: "6px solid #4f46e5",
                    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
                    transition: "transform 0.2s, box-shadow 0.2s",
                    cursor: "default"
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = "0 10px 15px -3px rgba(0, 0, 0, 0.1)";
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "0 4px 6px -1px rgba(0, 0, 0, 0.05)";
                  }}
                >
                  <div style={{ display: "flex", gap: "18px", alignItems: "flex-start", width: "100%" }}>
                    {/* Coluna do Avatar com Ícone Específico */}
                    <div style={{ 
                      backgroundColor: avatarBg, 
                      padding: "16px", 
                      borderRadius: "50%", 
                      display: "flex", 
                      alignItems: "center", 
                      justifyContent: "center",
                      width: "56px", 
                      height: "56px",
                      flexShrink: 0,
                      boxShadow: "inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)"
                    }}>
                      {renderizarIconeAnimal(especie, false, iconColor)}
                    </div>

                    {/* Coluna com Dados Clínicos e de Identificação */}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                        <span style={{ fontSize: "16px", fontWeight: "700", color: "#1e1b4b" }}>{nomePet}</span>
                        <span style={{ fontSize: "13px", color: "#6b7280" }}>({especie}{raca})</span>
                        
                        {/* Identificador com o Código */}
                        <span style={{ 
                          backgroundColor: "#f3f4f6", 
                          color: "#374151", 
                          padding: "4px 8px", 
                          borderRadius: "6px", 
                          fontSize: "12px", 
                          fontWeight: "600",
                          fontFamily: "monospace"
                        }}>
                          #{item.codigo}
                        </span>
                      </div>

                      {/* Dados de Tutor */}
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#4b5563", fontSize: "14px", marginBottom: "12px" }}>
                        <FaUser size={13} color="#9ca3af" />
                        <span>Tutor: <strong style={{ color: "#1f2937" }}>{nomeTutor}</strong></span>
                      </div>

                      {/* Sintomas em Formato de Tags (Chips) */}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
                        <span style={{ fontSize: "12px", fontWeight: "600", color: "#9ca3af", marginRight: "4px" }}>Sintomas:</span>
                        {tagsSintomas.length === 0 ? (
                          <span style={{ fontSize: "13px", color: "#6b7280" }}>Não informados</span>
                        ) : (
                          tagsSintomas.map((tag, idx) => (
                            <span 
                              key={idx}
                              style={{ 
                                backgroundColor: "#f3f4f6", 
                                color: "#1f2937", 
                                padding: "4px 10px", 
                                borderRadius: "20px", 
                                fontSize: "12px",
                                fontWeight: "500",
                                border: "1px solid #e5e7eb"
                              }}
                            >
                              {tag}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Coluna de Status e Ações */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "12px", justifyContent: "space-between", height: "100%", minHeight: "80px", flexShrink: 0 }}>
                    <span style={{ 
                      backgroundColor: "#fef3c7", 
                      color: "#b45309", 
                      padding: "6px 12px", 
                      borderRadius: "20px", 
                      fontSize: "12px", 
                      fontWeight: "700",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)"
                    }}>
                      <FaClock size={12} color="#b45309" />
                      Aguardando Triagem
                    </span>

                    <button
                      onClick={() => setConsultaParaExcluir(item)}
                      title="Excluir Check-in"
                      style={{
                        backgroundColor: "#fee2e2",
                        color: "#dc2626",
                        border: "none",
                        width: "36px",
                        height: "36px",
                        borderRadius: "50%",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "background 0.2s, transform 0.2s",
                        boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)"
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.backgroundColor = "#fca5a5";
                        e.currentTarget.style.transform = "scale(1.05)";
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.backgroundColor = "#fee2e2";
                        e.currentTarget.style.transform = "scale(1)";
                      }}
                    >
                      <MdDelete size={18} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de Confirmação de Exclusão */}
      {consultaParaExcluir && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(0,0,0,0.4)", backdropFilter: "blur(2px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
          <div style={{ backgroundColor: "white", padding: "28px", borderRadius: "14px", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)", textAlign: "center", maxWidth: "400px", width: "90%" }}>
            <div style={{ fontSize: "42px", marginBottom: "8px" }}>⚠️</div>
            <h3 style={{ marginTop: 0, color: "#111827", fontSize: "18px" }}>Confirmar Exclusão</h3>
            <p style={{ color: "#4b5563", fontSize: "14px", lineHeight: "1.5" }}>
              Tem certeza que deseja remover o check-in do código <strong>{consultaParaExcluir.codigo}</strong>?
            </p>
            <div style={{ display: "flex", justifyContent: "center", gap: "12px", marginTop: "22px" }}>
              <button onClick={() => setConsultaParaExcluir(null)} style={{ backgroundColor: "#f3f4f6", color: "#374151", border: "none", padding: "10px 18px", borderRadius: "8px", cursor: "pointer", fontWeight: "600" }}>Cancelar</button>
              <button onClick={deletarCheckin} style={{ backgroundColor: "#dc2626", color: "white", border: "none", padding: "10px 18px", borderRadius: "8px", cursor: "pointer", fontWeight: "600" }}>Sim, Excluir</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Novo Check-in Redesenhado */}
      {mostrarModal && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: "20px" }}>
          <div style={{ backgroundColor: "white", padding: "32px", borderRadius: "16px", maxWidth: "850px", width: "100%", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)" }}>
            <h3 style={{ marginTop: 0, color: "#1e1b4b", fontSize: "22px", marginBottom: "24px", borderBottom: "2px solid #f3f4f6", paddingBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
              📋 Novo Check-in de Paciente
            </h3>
            
            <form onSubmit={realizarCheckin}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: "24px", marginBottom: "20px" }}>
                
                {/* COLUNA ESQUERDA: Busca e Tags */}
                <div>
                  <label style={estiloLabel}>Busca Rápida (Pet ou Tutor)</label>
                  <div style={{ position: "relative", display: "flex", alignItems: "center", marginBottom: "20px" }}>
                    <MdSearch size={22} color="#6b7280" style={{ position: "absolute", left: "12px" }} />
                    <input
                      type="text"
                      placeholder="Buscar..."
                      value={buscaPaciente}
                      onChange={(e) => setBuscaPaciente(e.target.value)}
                      style={{ ...estiloInput, paddingLeft: "42px", height: "46px", backgroundColor: "#f9fafb" }}
                    />
                  </div>

                  <label style={{...estiloLabel, display: "flex", alignItems: "center", gap: "6px"}}>
                    <span style={{ fontSize: "16px" }}>➕</span> Tags de Sintomas Rápidos
                  </label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "10px" }}>
                    {sintomasRapidos.map((sintoma) => (
                      <button
                        key={sintoma}
                        type="button"
                        onClick={() => adicionarSintoma(sintoma)}
                        style={{
                          backgroundColor: "#e0e7ff",
                          color: "#3730a3",
                          border: "none",
                          padding: "8px 14px",
                          borderRadius: "20px",
                          fontSize: "13px",
                          fontWeight: "600",
                          cursor: "pointer",
                          transition: "background 0.2s"
                        }}
                        onMouseOver={(e) => e.target.style.backgroundColor = "#c7d2fe"}
                        onMouseOut={(e) => e.target.style.backgroundColor = "#e0e7ff"}
                      >
                        {sintoma}
                      </button>
                    ))}
                  </div>
                </div>

                {/* COLUNA DIREITA: Paciente, Enfermeiro e Queixa */}
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  
                  <div>
                    <label style={estiloLabel}>Paciente & Tutor *</label>
                    <div style={{ 
                      maxHeight: "160px", 
                      overflowY: "auto", 
                      border: "1px solid #d1d5db", 
                      borderRadius: "8px",
                      backgroundColor: "#f9fafb"
                    }}>
                      {animaisFiltrados.length === 0 ? (
                        <div style={{ padding: "12px", color: "#6b7280", textAlign: "center", fontSize: "14px" }}>Nenhum paciente encontrado.</div>
                      ) : (
                        animaisFiltrados.map((a) => {
                          const t = tutores.find((tutor) => tutor.id === a.tutor_id);
                          const nomeTutor = t ? t.nome : "Sem Tutor";
                          const isSelected = animalId === a.id.toString();
                          const raca = a.raca ? ` - ${a.raca}` : "";

                          return (
                            <div 
                              key={a.id}
                              onClick={() => setAnimalId(a.id.toString())}
                              style={{
                                padding: "12px 16px",
                                borderBottom: "1px solid #e5e7eb",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: "12px",
                                backgroundColor: isSelected ? "#eef2ff" : "#ffffff",
                                borderLeft: isSelected ? "4px solid #4f46e5" : "4px solid transparent",
                                transition: "background 0.2s"
                              }}
                            >
                              {/* Ícone dinâmico inteligente */}
                              <div style={{ 
                                backgroundColor: isSelected ? "#4f46e5" : "#f3f4f6", 
                                padding: "8px", 
                                borderRadius: "50%", 
                                display: "flex", 
                                alignItems: "center", 
                                justifyContent: "center",
                                width: "36px", 
                                height: "36px"
                              }}>
                                {renderizarIconeAnimal(a.especie, isSelected)}
                              </div>
                              <div>
                                <div style={{ fontWeight: "600", color: isSelected ? "#3730a3" : "#1f2937", fontSize: "14px" }}>
                                  {a.nome} <span style={{ fontWeight: "400", color: "#6b7280" }}>({a.especie}{raca})</span>
                                </div>
                                <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "2px" }}>Tutor: {nomeTutor}</div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div>
                    <label style={estiloLabel}>Enfermeiro(a) / Triagem (Opcional)</label>
                    <select value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)} style={{...estiloInput, height: "44px"}}>
                      <option value="">Selecione o enfermeiro responsável...</option>
                      {usuarios.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.nome || u.email}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={estiloLabel}>Queixa Principal *</label>
                    <textarea
                      rows={3}
                      placeholder="Descreva a queixa ou selecione as tags ao lado..."
                      value={queixaPrincipal}
                      onChange={(e) => setQueixaPrincipal(e.target.value)}
                      style={{
                        ...estiloInput,
                        height: "auto",
                        minHeight: "90px",
                        padding: "12px",
                        resize: "none"
                      }}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* BOTÕES DE AÇÃO */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", borderTop: "2px solid #f3f4f6", paddingTop: "20px", marginTop: "10px" }}>
                <button type="button" onClick={() => setMostrarModal(false)} style={{ backgroundColor: "#f3f4f6", color: "#374151", border: "none", padding: "12px 24px", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "14px" }}>Cancelar</button>
                <button type="submit" disabled={carregando} style={{ backgroundColor: "#16a34a", color: "white", border: "none", padding: "12px 30px", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
                  {carregando ? "Salvando..." : "Concluir Check-in"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}

export default Checkin;