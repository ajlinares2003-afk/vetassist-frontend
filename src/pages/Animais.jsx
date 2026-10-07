import { MdPets } from "react-icons/md";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";
import Layout from "../components/Layout";

const SUB_ESPECIES_POR_ESPECIE = {
  Canino: ["Cão Doméstico"],
  Felino: ["Gato Doméstico", "Felino Exótico"],
  Equino: ["Cavalo Puros-Sangue", "Pônei", "Cavalo Quarto de Milha", "Cavalo Campolina", "Mangalarga"],
  Bovino: ["Nelore", "Angus", "Holandês", "Girolando", "Jersey", "Brahma"],
  Suíno: ["Landrace", "Large White", "Duroc", "Pietrain", "Suíno Caipira"],
  Ovino: ["Dorper", "Santa Inês", "Suffolk", "Merino", "Texel"],
  Caprino: ["Boer", "Saanen", "Alpine", "Anglo-Nubiana", "Canindé"],
  "Coelho / Lagomorfo": ["Coelho Mini Lop", "Coelho Netherland Dwarf", "Coelho Cabeça-de-Leão", "Coelho Nova Zelândia"],
  Ave: ["Galinha", "Pato", "Periquito", "Papagaio", "Pombo", "Águia", "Pardal", "Calopsita"],
  Roedor: ["Hamster", "Porquinho-da-Índia", "Chinchila", "Gerbil", "Rato Doméstico"],
  Réptil: ["Iguana", "Tartaruga", "Jabuti", "Serpente", "Gecko"],
  Outros: []
};

function Animais() {
  const navigate = useNavigate();
  const [animais, setAnimais] = useState([]);
  const [animalEditando, setAnimalEditando] = useState(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
 
  const [codigo, setCodigo] = useState("");
  const [nome, setNome] = useState("");
  const [especie, setEspecie] = useState("");
  const [subEspecieSelect, setSubEspecieSelect] = useState("");
  const [subEspecieOutro, setSubEspecieOutro] = useState("");
  const [raca, setRaca] = useState("");
  const [sexo, setSexo] = useState("");
  const [idade, setIdade] = useState("");
  const [tutorId, setTutorId] = useState("");
  const [tutores, setTutores] = useState([]);
  const [status, setStatus] = useState("ATIVO");
  
  const [castrado, setCastrado] = useState("");
  const [cor, setCor] = useState("");
  const [porte, setPorte] = useState("");

  const [busca, setBusca] = useState("");

  const [mensagemErro, setMensagemErro] = useState("");
  const [mensagemSucesso, setMensagemSucesso] = useState("");

  const [animalParaExcluir, setAnimalParaExcluir] = useState(null);

  useEffect(() => {
    carregarAnimais();
    carregarTutores();
  }, []);

  const tratarSessaoExpirada = () => {
    setMensagemErro("❌ Sessão expirada ou não autenticado. Redirecionando para o login...");
    setTimeout(() => {
      localStorage.removeItem("token");
      navigate("/");
    }, 2000);
  };

  const carregarAnimais = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return tratarSessaoExpirada();

      const response = await api.get("/animais/", {
        headers: { Authorization: `Bearer ${token}` },
      });

      setAnimais(response.data);
    } catch (error) {
      if (error.response?.status === 401) {
        tratarSessaoExpirada();
      } else {
        console.error("ERRO GET:", error.response?.status, error.response?.data);
      }
    }
  };

  const carregarTutores = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const response = await api.get("/tutores/", {
        headers: { Authorization: `Bearer ${token}` },
      });

      setTutores(response.data);
    } catch (error) {
      console.error("Erro ao carregar tutores:", error);
    }
  };

  const limparFormulario = () => {
    setAnimalEditando(null);
    setCodigo("");
    setNome("");
    setEspecie("");
    setSubEspecieSelect("");
    setSubEspecieOutro("");
    setRaca("");
    setSexo("");
    setIdade("");
    setTutorId("");
    setStatus("ATIVO");
    setCastrado("");
    setCor("");
    setPorte("");
    setMensagemErro("");
  };

  const salvarAnimal = async () => {
    try {
      setMensagemErro("");
      setMensagemSucesso("");

      if (!nome.trim()) {
        setMensagemErro("🐾 Informe o nome do animal.");
        return;
      }

      if (!especie) {
        setMensagemErro("🐾 Selecione a espécie.");
        return;
      }

      if (!raca.trim()) {
        setMensagemErro("🐾 Informe a raça.");
        return;
      }

      if (!sexo) {
        setMensagemErro("🐾 Selecione o sexo.");
        return;
      }

      if (idade === "") {
        setMensagemErro("🐾 Informe a idade.");
        return;
      }

      if (Number(idade) < 0) {
        setMensagemErro("🐾 A idade não pode ser negativa.");
        return;
      }

      if (!tutorId) {
        setMensagemErro("🐾 Selecione um tutor.");
        return;
      }

      const token = localStorage.getItem("token");
      if (!token) {
        tratarSessaoExpirada();
        return;
      }

      const subEspecieFinal = subEspecieSelect === "Outro" ? subEspecieOutro.trim() : subEspecieSelect;

      let castradoFinal = castrado;
      if (especie === "Ave" || especie === "Réptil") {
        castradoFinal = "Não";
      }

      const novoAnimal = {
        codigo: codigo.trim() ? codigo.trim() : undefined,
        nome,
        especie,
        sub_especie: subEspecieFinal || null,
        raca,
        sexo,
        idade: parseFloat(idade),
        tutor_id: Number(tutorId),
        status,
        castrado: castradoFinal || null,
        cor: cor.trim() || null,
        porte: porte || null,
      };

      if (animalEditando) {
        await api.put(`/animais/${animalEditando.id}`, novoAnimal, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } else {
        await api.post("/animais/", novoAnimal, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }

      limparFormulario();
      setMostrarFormulario(false);
      carregarAnimais();

      setMensagemSucesso(
        animalEditando
          ? "✅ Cadastro do paciente atualizado com sucesso!"
          : "✅ Paciente cadastrado com sucesso!"
      );
    } catch (error) {
      if (error.response?.status === 401) {
        tratarSessaoExpirada();
        return;
      }
      console.error("ERRO SALVAR:", error);
      setMensagemErro(`❌ ${error.response?.data?.detail || error.message || "Erro ao salvar as alterações."}`);
    }
  };

  const deletarAnimal = async () => {
    if (!animalParaExcluir) return;

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        tratarSessaoExpirada();
        return;
      }

      await api.delete(`/animais/${animalParaExcluir.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setMensagemSucesso("✅ Paciente excluído com sucesso!");
      setAnimalParaExcluir(null);
      carregarAnimais();
    } catch (error) {
      if (error.response?.status === 401) {
        setAnimalParaExcluir(null);
        tratarSessaoExpirada();
        return;
      }
      console.error("ERRO DELETE:", error);
      setMensagemErro(`❌ Erro ao excluir: ${error.response?.data?.detail || error.message}`);
      setAnimalParaExcluir(null);
    }
  };

  const obterNomeTutor = (tutorId) => {
    const tutor = tutores.find((t) => t.id === tutorId);
    return tutor ? tutor.nome : "-";
  };

  const editarAnimal = (animal) => {
    setAnimalEditando(animal);
    setCodigo(animal.codigo || "");
    setNome(animal.nome);
    setEspecie(animal.especie || "");
    
    const sub = animal.sub_especie || animal.subEspécie || "";
    const opcoesPadrao = SUB_ESPECIES_POR_ESPECIE[animal.especie] || [];
    if (sub && !opcoesPadrao.includes(sub)) {
      setSubEspecieSelect("Outro");
      setSubEspecieOutro(sub);
    } else {
      setSubEspecieSelect(sub);
      setSubEspecieOutro("");
    }

    setRaca(animal.raca || "");
    setSexo(animal.sexo || "");
    setIdade(animal.idade ?? "");
    setTutorId(animal.tutor_id || "");
    setStatus(animal.status || "ATIVO");
    setCastrado(animal.castrado || "");
    setCor(animal.cor || "");
    setPorte(animal.porte || "");
    setMostrarFormulario(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const animaisFiltrados = animais.filter((animal) => {
    const termo = busca.toLowerCase();
    const codigoAnimal = (animal.codigo || `PET-${String(animal.id).padStart(4, "0")}`).toLowerCase();
    const nomeAnimal = animal.nome.toLowerCase();
    const especieAnimal = (animal.especie || "").toLowerCase();
    const subEspecieAnimal = (animal.sub_especie || animal.subEspécie || "").toLowerCase();
    const racaAnimal = (animal.raca || "").toLowerCase();
    const nomecientificoAnimal = (animal.nome_cientifico || "").toLowerCase();
    const nomeTutor = obterNomeTutor(animal.tutor_id).toLowerCase();

    return (
      codigoAnimal.includes(termo) ||
      nomeAnimal.includes(termo) ||
      especieAnimal.includes(termo) ||
      subEspecieAnimal.includes(termo) ||
      racaAnimal.includes(termo) ||
      nomecientificoAnimal.includes(termo) ||
      nomeTutor.includes(termo)
    );
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
          <MdPets color="#4f46e5" size={40} /> Animais
        </h1>

        <button
          onClick={() => {
            if (mostrarFormulario) limparFormulario();
            setMostrarFormulario(!mostrarFormulario);
          }}
          style={{ backgroundColor: "#4f46e5", color: "white", border: "none", padding: "10px 20px", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "14px", boxShadow: "0 2px 4px rgba(79, 70, 229, 0.2)" }}
        >
          {mostrarFormulario ? "Fechar Formulário" : "＋ Novo Animal"}
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

      {/* CARD DO FORMULÁRIO */}
      {mostrarFormulario && (
        <div style={{ backgroundColor: "#ffffff", padding: "24px", borderRadius: "12px", marginBottom: "25px", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)", border: "1px solid #e5e7eb" }}>
          <div style={{ borderBottom: "1px solid #f3f4f6", paddingBottom: "12px", marginBottom: "20px" }}>
            <h3 style={{ margin: 0, color: "#111827", fontSize: "18px", fontWeight: "600" }}>
              {animalEditando ? "✏️ Editar Cadastro do Paciente" : "🐾 Cadastrar Novo Paciente"}
            </h3>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "18px" }}>
            <div>
              <label style={estiloLabel}>Código / Ficha</label>
              <input type="text" placeholder="Ex: PET-0001" value={codigo} onChange={(e) => setCodigo(e.target.value)} style={{ ...estiloInput, backgroundColor: "#f9fafb" }} />
            </div>

            <div>
              <label style={estiloLabel}>Nome do Paciente *</label>
              <input type="text" placeholder="Ex: Rex" value={nome} onChange={(e) => setNome(e.target.value)} style={estiloInput} />
            </div>

            <div>
              <label style={estiloLabel}>Espécie *</label>
              <select
                value={especie}
                onChange={(e) => {
                  const novaEspecie = e.target.value;
                  setEspecie(novaEspecie);
                  setSubEspecieSelect("");
                  setSubEspecieOutro("");
                  if (novaEspecie === "Ave" || novaEspecie === "Réptil") {
                    setCastrado("Não");
                  }
                }}
                style={estiloInput}
              >
                <option value="">Selecione a Espécie</option>
                <option value="Canino">Canino</option>
                <option value="Felino">Felino</option>
                <option value="Equino">Equino</option>
                <option value="Bovino">Bovino</option>
                <option value="Suíno">Suíno</option>
                <option value="Ovino">Ovino</option>
                <option value="Caprino">Caprino</option>
                <option value="Coelho / Lagomorfo">Coelho / Lagomorfo</option>
                <option value="Ave">Ave</option>
                <option value="Roedor">Roedor</option>
                <option value="Réptil">Réptil</option>
                <option value="Outros">Outros</option>
              </select>
            </div>

            <div>
              <label style={estiloLabel}>Sub-espécie / Tipo</label>
              <select
                value={subEspecieSelect}
                onChange={(e) => setSubEspecieSelect(e.target.value)}
                style={estiloInput}
                disabled={!especie}
              >
                <option value="">{especie ? "Selecione a Sub-espécie..." : "Primeiro selecione a Espécie"}</option>
                {especie && SUB_ESPECIES_POR_ESPECIE[especie]?.map((sub, idx) => (
                  <option key={idx} value={sub}>{sub}</option>
                ))}
                <option value="Outro">Outro (Digitar...)</option>
              </select>

              {subEspecieSelect === "Outro" && (
                <input
                  type="text"
                  placeholder="Digite a sub-espécie..."
                  value={subEspecieOutro}
                  onChange={(e) => setSubEspecieOutro(e.target.value)}
                  style={{ ...estiloInput, marginTop: "8px" }}
                />
              )}
            </div>

            <div>
              <label style={estiloLabel}>Raça *</label>
              <input type="text" placeholder="Ex: Labrador" value={raca} onChange={(e) => setRaca(e.target.value)} style={estiloInput} />
            </div>

            <div>
              <label style={estiloLabel}>Sexo *</label>
              <select value={sexo} onChange={(e) => setSexo(e.target.value)} style={estiloInput}>
                <option value="">Selecione o Sexo</option>
                <option value="Macho">Macho</option>
                <option value="Fêmea">Fêmea</option>
                <option value="Indefinido">Indefinido</option>
              </select>
            </div>

            <div>
              <label style={estiloLabel}>Cor</label>
              <input type="text" placeholder="Ex: Preto e Branco" value={cor} onChange={(e) => setCor(e.target.value)} style={estiloInput} />
            </div>

            <div>
              <label style={estiloLabel}>Porte</label>
              <select value={porte} onChange={(e) => setPorte(e.target.value)} style={estiloInput}>
                <option value="">Selecione o Porte</option>
                <option value="Miniatura">Miniatura</option>
                <option value="Pequeno">Pequeno</option>
                <option value="Médio">Médio</option>
                <option value="Grande">Grande</option>
              </select>
            </div>

            <div>
              <label style={estiloLabel}>Castrado?</label>
              <select 
                value={castrado} 
                onChange={(e) => setCastrado(e.target.value)} 
                style={estiloInput}
                disabled={especie === "Ave" || especie === "Réptil"}
              >
                <option value="">Selecione</option>
                <option value="Sim">Sim</option>
                <option value="Não">Não</option>
              </select>
            </div>

            <div>
              <label style={estiloLabel}>Idade (Anos) *</label>
              <input type="number" min="0" step="0.1" placeholder="Ex: 4.6" value={idade} onChange={(e) => setIdade(e.target.value)} style={estiloInput} />
            </div>

            <div>
              <label style={estiloLabel}>Tutor Responsável *</label>
              <select value={tutorId} onChange={(e) => setTutorId(e.target.value)} style={estiloInput}>
                <option value="">Selecione o Tutor</option>
                {tutores.map((tutor) => (
                  <option key={tutor.id} value={tutor.id}>{tutor.nome}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={estiloLabel}>Status do Cadastro</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} style={estiloInput}>
                <option value="ATIVO">ATIVO</option>
                <option value="INATIVO">INATIVO</option>
              </select>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "24px", paddingTop: "16px", borderTop: "1px solid #f3f4f6" }}>
            <button onClick={() => { limparFormulario(); setMostrarFormulario(false); }} style={{ backgroundColor: "#f3f4f6", color: "#374151", border: "none", padding: "10px 20px", borderRadius: "8px", cursor: "pointer", fontWeight: "600" }}>
              Cancelar
            </button>
            <button onClick={salvarAnimal} style={{ backgroundColor: "#16a34a", color: "white", border: "none", padding: "10px 24px", borderRadius: "8px", cursor: "pointer", fontWeight: "600", boxShadow: "0 2px 4px rgba(22, 163, 74, 0.2)" }}>
              Salvar Alterações
            </button>
          </div>
        </div>
      )}

      {/* BARRA DE PESQUISA */}
      <div style={{ marginBottom: "16px" }}>
        <input
          type="text"
          placeholder="🔍 Pesquisar paciente por nome, código, tutor, espécie, sub-espécie, raça ou nome científico..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          style={{ width: "100%", height: "44px", padding: "0 16px", border: "1px solid #d1d5db", borderRadius: "10px", fontSize: "14px", outline: "none", backgroundColor: "#ffffff", boxSizing: "border-box" }}
        />
      </div>

      {/* TABELA DE PACIENTES */}
      <div style={{ overflowX: "auto", backgroundColor: "white", borderRadius: "12px", border: "1px solid #e5e7eb" }}>
        <table style={{ width: "100%", minWidth: "1000px", borderCollapse: "collapse", textAlign: "center" }}>
          <thead>
            <tr style={{ backgroundColor: "#4f46e5", color: "white", fontSize: "14px" }}>
              <th style={{ padding: "14px" }}>Código</th>
              <th style={{ padding: "14px" }}>Nome</th>
              <th style={{ padding: "14px" }}>Tutor</th>
              <th style={{ padding: "14px" }}>Espécie / Sub-espécie</th>
              <th style={{ padding: "14px" }}>Raça</th>
              <th style={{ padding: "14px" }}>Porte / Cor</th>
              <th style={{ padding: "14px" }}>Idade</th>
              <th style={{ padding: "14px" }}>Status</th>
              <th style={{ padding: "14px" }}>Ações</th>
            </tr>
          </thead>

          <tbody>
            {animaisFiltrados.length > 0 ? (
              animaisFiltrados.map((animal, index) => (
                <tr key={animal.id} style={{ backgroundColor: index % 2 === 0 ? "#ffffff" : "#f9fafb", borderBottom: "1px solid #f3f4f6", fontSize: "14px" }}>
                  <td style={{ padding: "14px", fontWeight: "bold", color: "#4f46e5", whiteSpace: "nowrap" }}>
                    {animal.codigo || `PET-${String(animal.id).padStart(4, "0")}`}
                  </td>
                  <td style={{ padding: "14px", fontWeight: "600", color: "#1f2937" }}>{animal.nome}</td>
                  <td style={{ padding: "14px", color: "#4b5563" }}>{obterNomeTutor(animal.tutor_id)}</td>
                  <td style={{ padding: "14px", color: "#4b5563" }}>
                    <div>{animal.especie} {animal.sub_especie ? `(${animal.sub_especie})` : ""}</div>
                    {animal.nome_cientifico && (
                      <div style={{ fontSize: "11px", fontStyle: "italic", color: "#6b7280", marginTop: "2px" }}>
                        {animal.nome_cientifico}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: "14px", color: "#4b5563" }}>{animal.raca}</td>
                  <td style={{ padding: "14px", color: "#4b5563" }}>{animal.porte || "-"} / {animal.cor || "-"}</td>
                  <td style={{ padding: "14px", color: "#4b5563" }}>{animal.idade} anos</td>
                  <td style={{ padding: "14px" }}>
                    <span style={{ backgroundColor: animal.status === "ATIVO" ? "#dcfce7" : "#fee2e2", color: animal.status === "ATIVO" ? "#166534" : "#991b1b", padding: "4px 10px", borderRadius: "999px", fontSize: "12px", fontWeight: "600" }}>
                      {animal.status}
                    </span>
                  </td>

                  <td style={{ padding: "14px", display: "flex", justifyContent: "center", gap: "8px" }}>
                    <button onClick={() => editarAnimal(animal)} style={{ backgroundColor: "#fef3c7", color: "#b45309", border: "none", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontWeight: "600", fontSize: "13px" }}>✏️ Editar</button>
                    <button onClick={() => setAnimalParaExcluir(animal)} style={{ backgroundColor: "#fee2e2", color: "#b91c1c", border: "none", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontWeight: "600", fontSize: "13px" }}>🗑 Excluir</button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="9" style={{ padding: "24px", color: "#6b7280", fontSize: "14px" }}>
                  Nenhum paciente encontrado para a busca "{busca}".
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      {animalParaExcluir && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(0, 0, 0, 0.4)", backdropFilter: "blur(2px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
          <div style={{ backgroundColor: "white", padding: "28px", borderRadius: "14px", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)", textAlign: "center", maxWidth: "400px", width: "90%" }}>
            <div style={{ fontSize: "42px", marginBottom: "8px" }}>⚠️</div>
            <h3 style={{ marginTop: 0, color: "#111827", fontSize: "18px" }}>Confirmar Exclusão</h3>
            <p style={{ color: "#4b5563", fontSize: "14px", lineHeight: "1.5" }}>
              Tem certeza que deseja excluir o paciente <strong>{animalParaExcluir.nome}</strong>?
            </p>
            <div style={{ display: "flex", justifyContent: "center", gap: "12px", marginTop: "22px" }}>
              <button onClick={() => setAnimalParaExcluir(null)} style={{ backgroundColor: "#f3f4f6", color: "#374151", border: "none", padding: "10px 18px", borderRadius: "8px", cursor: "pointer", fontWeight: "600" }}>Cancelar</button>
              <button onClick={deletarAnimal} style={{ backgroundColor: "#dc2626", color: "white", border: "none", padding: "10px 18px", borderRadius: "8px", cursor: "pointer", fontWeight: "600" }}>Sim, Excluir</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

export default Animais;