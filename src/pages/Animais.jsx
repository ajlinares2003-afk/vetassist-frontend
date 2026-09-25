import { MdPets } from "react-icons/md";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";
import Layout from "../components/Layout";

function Animais() {
  const navigate = useNavigate();
  const [animais, setAnimais] = useState([]);
  const [animalEditando, setAnimalEditando] = useState(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
 
  const [codigo, setCodigo] = useState("");
  const [nome, setNome] = useState("");
  const [especie, setEspecie] = useState("");
  const [raca, setRaca] = useState("");
  const [sexo, setSexo] = useState("");
  const [idade, setIdade] = useState("");
  const [peso, setPeso] = useState("");
  const [tutorId, setTutorId] = useState("");
  const [tutores, setTutores] = useState([]);
  const [status, setStatus] = useState("ATIVO");
  
  // Novos estados para Castrado, Cor e Porte
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
        headers: {
          Authorization: `Bearer ${token}`,
        },
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
        headers: {
          Authorization: `Bearer ${token}`,
        },
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
    setRaca("");
    setSexo("");
    setIdade("");
    setPeso("");
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

      if (!/[A-Za-zÀ-ÿ]/.test(nome)) {
        setMensagemErro("🐾 Informe um nome válido para o animal.");
        return;
      }

      if (nome.trim().length < 2) {
        setMensagemErro("🐾 O nome do animal deve ter pelo menos 2 caracteres.");
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

      if (peso === "") {
        setMensagemErro("🐾 Informe o peso.");
        return;
      }

      if (Number(peso) < 0) {
        setMensagemErro("🐾 O peso não pode ser negativo.");
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

      const novoAnimal = {
        codigo: codigo.trim() ? codigo.trim() : undefined,
        nome,
        especie,
        raca,
        sexo,
        idade: parseFloat(idade),
        peso: Number(peso),
        tutor_id: Number(tutorId),
        status,
        castrado: castrado || null,
        cor: cor.trim() || null,
        porte: porte || null,
      };

      let url = "http://127.0.0.1:8000/animais/";
      let metodo = "POST";

      if (animalEditando) {
        url = `http://127.0.0.1:8000/animais/${animalEditando.id}`;
        metodo = "PUT";
      }

      const response = await fetch(url, {
        method: metodo,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(novoAnimal),
      });

      if (response.status === 401) {
        tratarSessaoExpirada();
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Erro ao salvar as alterações.");
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
      console.error("ERRO SALVAR:", error);
      setMensagemErro(`❌ ${error.message}`);
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

      const response = await fetch(
        `http://127.0.0.1:8000/animais/${animalParaExcluir.id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.status === 401) {
        setAnimalParaExcluir(null);
        tratarSessaoExpirada();
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Erro ao excluir o paciente.");
      }

      setMensagemSucesso("✅ Paciente excluído com sucesso!");
      setAnimalParaExcluir(null);
      carregarAnimais();
    } catch (error) {
      console.error("ERRO DELETE:", error);
      setMensagemErro(`❌ Erro ao excluir: ${error.message}`);
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
    setEspecie(animal.especie);
    setRaca(animal.raca);
    setSexo(animal.sexo);
    setIdade(animal.idade);
    setPeso(animal.peso);
    setTutorId(animal.tutor_id);
    setStatus(animal.status);
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
    const especieAnimal = animal.especie.toLowerCase();
    const racaAnimal = animal.raca.toLowerCase();
    const nomeTutor = obterNomeTutor(animal.tutor_id).toLowerCase();

    return (
      codigoAnimal.includes(termo) ||
      nomeAnimal.includes(termo) ||
      especieAnimal.includes(termo) ||
      racaAnimal.includes(termo) ||
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
          <MdPets color="#4f46e5" size={40} />
          Animais
        </h1>

        <button
          onClick={() => {
            if (mostrarFormulario) {
              limparFormulario();
            }
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
          {mostrarFormulario ? "Fechar Formulário" : "＋ Novo Animal"}
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
            boxShadow:
              "0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)",
            border: "1px solid #e5e7eb",
          }}
        >
          <div
            style={{
              borderBottom: "1px solid #f3f4f6",
              paddingBottom: "12px",
              marginBottom: "20px",
            }}
          >
            <h3
              style={{
                margin: 0,
                color: "#111827",
                fontSize: "18px",
                fontWeight: "600",
              }}
            >
              {animalEditando
                ? "✏️ Editar Cadastro do Paciente"
                : "🐾 Cadastrar Novo Paciente"}
            </h3>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "18px",
            }}
          >
            <div>
              <label style={estiloLabel}>Código / Ficha</label>
              <input
                type="text"
                placeholder="Ex: PET-0001 (Automático se em branco)"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                style={{ ...estiloInput, backgroundColor: "#f9fafb" }}
              />
            </div>

            <div>
              <label style={estiloLabel}>Nome do Paciente *</label>
              <input
                type="text"
                placeholder="Ex: Rex"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                style={estiloInput}
              />
            </div>

            <div>
              <label style={estiloLabel}>Espécie *</label>
              <select
                value={especie}
                onChange={(e) => setEspecie(e.target.value)}
                style={estiloInput}
              >
                <option value="">Selecione a Espécie</option>
                <option value="Canino">Canino</option>
                <option value="Felino">Felino</option>
                <option value="Ave">Ave</option>
                <option value="Roedor">Roedor</option>
                <option value="Réptil">Réptil</option>
                <option value="Outros">Outros</option>
              </select>
            </div>

            <div>
              <label style={estiloLabel}>Raça *</label>
              <input
                type="text"
                placeholder="Ex: Labrador"
                value={raca}
                onChange={(e) => setRaca(e.target.value)}
                style={estiloInput}
              />
            </div>

            <div>
              <label style={estiloLabel}>Sexo *</label>
              <select
                value={sexo}
                onChange={(e) => setSexo(e.target.value)}
                style={estiloInput}
              >
                <option value="">Selecione o Sexo</option>
                <option value="M">Macho</option>
                <option value="F">Fêmea</option>
              </select>
            </div>

            <div>
              <label style={estiloLabel}>Cor</label>
              <input
                type="text"
                placeholder="Ex: Preto e Branco"
                value={cor}
                onChange={(e) => setCor(e.target.value)}
                style={estiloInput}
              />
            </div>

            <div>
              <label style={estiloLabel}>Porte</label>
              <select
                value={porte}
                onChange={(e) => setPorte(e.target.value)}
                style={estiloInput}
              >
                <option value="">Selecione o Porte</option>
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
              >
                <option value="">Selecione</option>
                <option value="Sim">Sim</option>
                <option value="Não">Não</option>
              </select>
            </div>

            <div>
              <label style={estiloLabel}>Idade (Anos) *</label>
              <input
                type="number"
                min="0"
                step="0.1"
                placeholder="Ex: 4.6"
                value={idade}
                onChange={(e) => setIdade(e.target.value)}
                style={estiloInput}
              />
            </div>

            <div>
              <label style={estiloLabel}>Peso (Kg) *</label>
              <input
                type="number"
                min="0"
                step="0.1"
                placeholder="Ex: 12.5"
                value={peso}
                onChange={(e) => setPeso(e.target.value)}
                style={estiloInput}
              />
            </div>

            <div>
              <label style={estiloLabel}>Tutor Responsável *</label>
              <select
                value={tutorId}
                onChange={(e) => setTutorId(e.target.value)}
                style={estiloInput}
              >
                <option value="">Selecione o Tutor</option>
                {tutores.map((tutor) => (
                  <option key={tutor.id} value={tutor.id}>
                    {tutor.nome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={estiloLabel}>Status do Cadastro</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                style={estiloInput}
              >
                <option value="ATIVO">ATIVO</option>
                <option value="INATIVO">INATIVO</option>
              </select>
            </div>
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
              onClick={salvarAnimal}
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
              Salvar Alterações
            </button>
          </div>
        </div>
      )}

      {/* BARRA DE PESQUISA */}
      <div style={{ marginBottom: "16px" }}>
        <input
          type="text"
          placeholder="🔍 Pesquisar paciente por nome, código (PET-0000), tutor, espécie ou raça..."
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

      {/* TABELA DE PACIENTES */}
      <div
        style={{
          overflowX: "auto",
          backgroundColor: "white",
          borderRadius: "12px",
          boxShadow:
            "0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)",
          border: "1px solid #e5e7eb",
        }}
      >
        <table
          style={{
            width: "100%",
            minWidth: "1000px",
            borderCollapse: "collapse",
            textAlign: "center",
          }}
        >
          <thead>
            <tr
              style={{
                backgroundColor: "#4f46e5",
                color: "white",
                fontSize: "14px",
              }}
            >
              <th style={{ padding: "14px" }}>Código</th>
              <th style={{ padding: "14px" }}>Nome</th>
              <th style={{ padding: "14px" }}>Tutor</th>
              <th style={{ padding: "14px" }}>Espécie / Raça</th>
              <th style={{ padding: "14px" }}>Porte / Cor</th>
              <th style={{ padding: "14px" }}>Castrado</th>
              <th style={{ padding: "14px" }}>Idade / Peso</th>
              <th style={{ padding: "14px" }}>Status</th>
              <th style={{ padding: "14px" }}>Ações</th>
            </tr>
          </thead>

          <tbody>
            {animaisFiltrados.length > 0 ? (
              animaisFiltrados.map((animal, index) => (
                <tr
                  key={animal.id}
                  style={{
                    backgroundColor: index % 2 === 0 ? "#ffffff" : "#f9fafb",
                    borderBottom: "1px solid #f3f4f6",
                    fontSize: "14px",
                  }}
                >
                  <td
                    style={{
                      padding: "14px",
                      fontWeight: "bold",
                      color: "#4f46e5",
                    }}
                  >
                    {animal.codigo ||
                      `PET-${String(animal.id).padStart(4, "0")}`}
                  </td>
                  <td
                    style={{
                      padding: "14px",
                      fontWeight: "600",
                      color: "#1f2937",
                    }}
                  >
                    {animal.nome}
                  </td>
                  <td style={{ padding: "14px", color: "#4b5563" }}>
                    {obterNomeTutor(animal.tutor_id)}
                  </td>
                  <td style={{ padding: "14px", color: "#4b5563" }}>
                    {animal.especie} - {animal.raca}
                  </td>
                  <td style={{ padding: "14px", color: "#4b5563" }}>
                    {animal.porte || "-"} / {animal.cor || "-"}
                  </td>
                  <td style={{ padding: "14px", color: "#4b5563" }}>
                    {animal.castrado || "-"}
                  </td>
                  <td style={{ padding: "14px", color: "#4b5563" }}>
                    {animal.idade} anos / {animal.peso} kg
                  </td>
                  <td style={{ padding: "14px" }}>
                    <span
                      style={{
                        backgroundColor:
                          animal.status === "ATIVO" ? "#dcfce7" : "#fee2e2",
                        color: animal.status === "ATIVO" ? "#166534" : "#991b1b",
                        padding: "4px 10px",
                        borderRadius: "999px",
                        fontSize: "12px",
                        fontWeight: "600",
                      }}
                    >
                      {animal.status}
                    </span>
                  </td>

                  <td
                    style={{
                      padding: "14px",
                      display: "flex",
                      justifyContent: "center",
                      gap: "8px",
                    }}
                  >
                    <button
                      onClick={() => editarAnimal(animal)}
                      style={{
                        backgroundColor: "#fef3c7",
                        color: "#b45309",
                        border: "none",
                        padding: "6px 12px",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontWeight: "600",
                        fontSize: "13px",
                      }}
                    >
                      ✏️ Editar
                    </button>

                    <button
                      onClick={() => setAnimalParaExcluir(animal)}
                      style={{
                        backgroundColor: "#fee2e2",
                        color: "#b91c1c",
                        border: "none",
                        padding: "6px 12px",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontWeight: "600",
                        fontSize: "13px",
                      }}
                    >
                      🗑️ Excluir
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan="9"
                  style={{
                    padding: "24px",
                    color: "#6b7280",
                    fontSize: "14px",
                  }}
                >
                  Nenhum paciente encontrado para a busca "{busca}".
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      {animalParaExcluir && (
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
            <p
              style={{ color: "#4b5563", fontSize: "14px", lineHeight: "1.5" }}
            >
              Tem certeza que deseja excluir o paciente{" "}
              <strong>{animalParaExcluir.nome}</strong>?
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
                onClick={() => setAnimalParaExcluir(null)}
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
                onClick={deletarAnimal}
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

export default Animais;