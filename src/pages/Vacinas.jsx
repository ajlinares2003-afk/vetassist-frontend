import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MdVaccines } from "react-icons/md";
import api from "../api/api";
import Layout from "../components/Layout";

function Vacinas() {
  const navigate = useNavigate();
  const [vacinas, setVacinas] = useState([]);
  const [animais, setAnimais] = useState([]);
  const [vacinaEditando, setVacinaEditando] = useState(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [cartaoPaciente, setCartaoPaciente] = useState(null); // Modal Cartão Vacinal

  // Campos da Vacina
  const [animalId, setAnimalId] = useState("");
  const [nomeVacina, setNomeVacina] = useState("");
  const [fabricante, setFabricante] = useState("");
  const [dose, setDose] = useState("1ª Dose");
  const [dataAplicacao, setDataAplicacao] = useState("");
  const [dataReforco, setDataReforco] = useState("");
  const [lote, setLote] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const [busca, setBusca] = useState("");
  const [mensagemErro, setMensagemErro] = useState("");
  const [mensagemSucesso, setMensagemSucesso] = useState("");
  const [vacinaParaExcluir, setVacinaParaExcluir] = useState(null);

  useEffect(() => {
    carregarVacinas();
    carregarAnimais();
  }, []);

  const tratarSessaoExpirada = () => {
    setMensagemErro("❌ Sessão expirada. Redirecionando para o login...");
    setTimeout(() => {
      localStorage.removeItem("token");
      navigate("/");
    }, 2000);
  };

  const carregarVacinas = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return tratarSessaoExpirada();

      const response = await api.get("/vacinas/", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setVacinas(response.data || []);
    } catch (error) {
      if (error.response?.status === 401) tratarSessaoExpirada();
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

  const handleDataAplicacaoChange = (e) => {
    const dataVal = e.target.value;
    setDataAplicacao(dataVal);

    if (dataVal && !dataReforco) {
      const dataObj = new Date(dataVal);
      dataObj.setFullYear(dataObj.getFullYear() + 1);
      const dataReforcoAuto = dataObj.toISOString().split("T")[0];
      setDataReforco(dataReforcoAuto);
    }
  };

  const limparFormulario = () => {
    setVacinaEditando(null);
    setAnimalId("");
    setNomeVacina("");
    setFabricante("");
    setDose("1ª Dose");
    setDataAplicacao("");
    setDataReforco("");
    setLote("");
    setObservacoes("");
    setMensagemErro("");
  };

  const salvarVacina = async () => {
    try {
      setMensagemErro("");
      setMensagemSucesso("");

      if (!animalId) {
        setMensagemErro("💉 Selecione o paciente (animal).");
        return;
      }

      if (!nomeVacina.trim()) {
        setMensagemErro("💉 Informe o nome da vacina.");
        return;
      }

      if (!dataAplicacao) {
        setMensagemErro("💉 Informe a data de aplicação.");
        return;
      }

      const token = localStorage.getItem("token");
      if (!token) return tratarSessaoExpirada();

      const novaVacina = {
        animal_id: Number(animalId),
        nome_vacina: nomeVacina.trim(),
        fabricante: fabricante.trim() || undefined,
        dose: dose || undefined,
        data_aplicacao: dataAplicacao,
        data_reforco: dataReforco || undefined,
        lote: lote.trim() || undefined,
        observacoes: observacoes.trim() || undefined,
      };

      let url = "http://127.0.0.1:8000/vacinas/";
      let metodo = "POST";

      if (vacinaEditando) {
        url = `http://127.0.0.1:8000/vacinas/${vacinaEditando.id}`;
        metodo = "PUT";
      }

      const response = await fetch(url, {
        method: metodo,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(novaVacina),
      });

      if (response.status === 401) return tratarSessaoExpirada();

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Erro ao salvar vacina.");
      }

      limparFormulario();
      setMostrarFormulario(false);
      carregarVacinas();

      setMensagemSucesso(
        vacinaEditando
          ? "✅ Registro de vacina atualizado com sucesso!"
          : "✅ Aplicação de vacina registrada com sucesso!"
      );
    } catch (error) {
      console.error("ERRO SALVAR VACINA:", error);
      setMensagemErro(`❌ ${error.message}`);
    }
  };

  const deletarVacina = async () => {
    if (!vacinaParaExcluir) return;

    try {
      const token = localStorage.getItem("token");
      if (!token) return tratarSessaoExpirada();

      const response = await fetch(
        `http://127.0.0.1:8000/vacinas/${vacinaParaExcluir.id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.status === 401) return tratarSessaoExpirada();

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Erro ao excluir vacina.");
      }

      setMensagemSucesso("✅ Registro de vacina excluído com sucesso!");
      setVacinaParaExcluir(null);
      carregarVacinas();
    } catch (error) {
      setMensagemErro(`❌ Erro ao excluir: ${error.message}`);
      setVacinaParaExcluir(null);
    }
  };

  const editarVacina = (vacina) => {
    setVacinaEditando(vacina);
    setAnimalId(vacina.animal_id);
    setNomeVacina(vacina.nome_vacina || "");
    setFabricante(vacina.fabricante || "");
    setDose(vacina.dose || "1ª Dose");
    setDataAplicacao(vacina.data_aplicacao || "");
    setDataReforco(vacina.data_reforco || "");
    setLote(vacina.lote || "");
    setObservacoes(vacina.observacoes || "");
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

  const renderBadgeReforco = (dtReforco) => {
    if (!dtReforco) return <span style={{ color: "#6b7280" }}>-</span>;

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const reforco = new Date(dtReforco + "T00:00:00");
    const diffDias = Math.ceil((reforco - hoje) / (1000 * 60 * 60 * 24));

    if (diffDias < 0) {
      return (
        <span style={{ backgroundColor: "#fee2e2", color: "#991b1b", padding: "4px 8px", borderRadius: "6px", fontWeight: "bold", fontSize: "12px" }}>
          ⚠️ Vencida ({new Date(dtReforco + "T00:00:00").toLocaleDateString("pt-BR")})
        </span>
      );
    }

    if (diffDias <= 30) {
      return (
        <span style={{ backgroundColor: "#fef3c7", color: "#b45309", padding: "4px 8px", borderRadius: "6px", fontWeight: "bold", fontSize: "12px" }}>
          ⏳ Próxima ({new Date(dtReforco + "T00:00:00").toLocaleDateString("pt-BR")})
        </span>
      );
    }

    return (
      <span style={{ backgroundColor: "#dcfce7", color: "#166534", padding: "4px 8px", borderRadius: "6px", fontWeight: "bold", fontSize: "12px" }}>
        🟢 Em dia ({new Date(dtReforco + "T00:00:00").toLocaleDateString("pt-BR")})
      </span>
    );
  };

  const vacinasFiltradas = vacinas.filter((v) => {
    const termo = busca.toLowerCase();
    const nomeA = obterNomeAnimal(v.animal_id).toLowerCase();
    const vacinaNome = (v.nome_vacina || "").toLowerCase();
    const fab = (v.fabricante || "").toLowerCase();

    return nomeA.includes(termo) || vacinaNome.includes(termo) || fab.includes(termo);
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
          <MdVaccines color="#4f46e5" size={38} />
          Controle de Vacinação
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
          {mostrarFormulario ? "Fechar Formulário" : "＋ Registrar Vacina"}
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
              {vacinaEditando ? "✏️ Editar Registro de Vacina" : "💉 Registrar Aplicação de Vacina"}
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
              <label style={estiloLabel}>Paciente (Animal) *</label>
              <select
                value={animalId}
                onChange={(e) => setAnimalId(e.target.value)}
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
              <label style={estiloLabel}>Nome da Vacina *</label>
              <input
                type="text"
                placeholder="Ex: V10, Antirrábica, Giardia"
                value={nomeVacina}
                onChange={(e) => setNomeVacina(e.target.value)}
                style={estiloInput}
              />
            </div>

            <div>
              <label style={estiloLabel}>Fabricante</label>
              <input
                type="text"
                placeholder="Ex: Zoetis, MSD, Boehringer"
                value={fabricante}
                onChange={(e) => setFabricante(e.target.value)}
                style={estiloInput}
              />
            </div>

            <div>
              <label style={estiloLabel}>Dose</label>
              <select
                value={dose}
                onChange={(e) => setDose(e.target.value)}
                style={estiloInput}
              >
                <option value="1ª Dose">1ª Dose</option>
                <option value="2ª Dose">2ª Dose</option>
                <option value="3ª Dose">3ª Dose</option>
                <option value="Reforço Anual">Reforço Anual</option>
                <option value="Dose Única">Dose Única</option>
              </select>
            </div>

            <div>
              <label style={estiloLabel}>Data de Aplicação *</label>
              <input
                type="date"
                value={dataAplicacao}
                onChange={handleDataAplicacaoChange}
                style={estiloInput}
              />
            </div>

            <div>
              <label style={estiloLabel}>Data do Reforço / Revacinação</label>
              <input
                type="date"
                value={dataReforco}
                onChange={(e) => setDataReforco(e.target.value)}
                style={estiloInput}
              />
            </div>

            <div>
              <label style={estiloLabel}>Lote</label>
              <input
                type="text"
                placeholder="Ex: L123456"
                value={lote}
                onChange={(e) => setLote(e.target.value)}
                style={estiloInput}
              />
            </div>
          </div>

          <div style={{ marginTop: "18px" }}>
            <label style={estiloLabel}>Observações</label>
            <textarea
              rows={2}
              placeholder="Local de aplicação, reações alérgicas..."
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
              onClick={salvarVacina}
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
              Salvar Vacina
            </button>
          </div>
        </div>
      )}

      {/* BARRA DE BUSCA */}
      <div style={{ marginBottom: "16px" }}>
        <input
          type="text"
          placeholder="🔍 Pesquisar por paciente, vacina ou fabricante..."
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

      {/* TABELA DE VACINAS */}
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
              <th style={{ padding: "14px" }}>Paciente</th>
              <th style={{ padding: "14px" }}>Vacina</th>
              <th style={{ padding: "14px" }}>Dose</th>
              <th style={{ padding: "14px" }}>Fabricante / Lote</th>
              <th style={{ padding: "14px" }}>Aplicação</th>
              <th style={{ padding: "14px" }}>Status do Reforço</th>
              <th style={{ padding: "14px" }}>Ações</th>
            </tr>
          </thead>

          <tbody>
            {vacinasFiltradas.length > 0 ? (
              vacinasFiltradas.map((v, index) => {
                const animalObj = obterAnimalCompleto(v.animal_id);
                return (
                  <tr
                    key={v.id}
                    style={{
                      backgroundColor: index % 2 === 0 ? "#ffffff" : "#f9fafb",
                      borderBottom: "1px solid #f3f4f6",
                      fontSize: "14px",
                    }}
                  >
                    <td style={{ padding: "14px", fontWeight: "600", color: "#1f2937" }}>
                      {obterNomeAnimal(v.animal_id)}
                    </td>
                    <td style={{ padding: "14px", fontWeight: "bold", color: "#4f46e5" }}>
                      {v.nome_vacina}
                    </td>
                    <td style={{ padding: "14px", color: "#4b5563" }}>
                      {v.dose || "-"}
                    </td>
                    <td style={{ padding: "14px", color: "#4b5563" }}>
                      {v.fabricante ? `${v.fabricante} (${v.lote || "S/ Lote"})` : v.lote || "-"}
                    </td>
                    <td style={{ padding: "14px", color: "#4b5563" }}>
                      {v.data_aplicacao
                        ? new Date(v.data_aplicacao + "T00:00:00").toLocaleDateString("pt-BR")
                        : "-"}
                    </td>
                    <td style={{ padding: "14px" }}>
                      {renderBadgeReforco(v.data_reforco)}
                    </td>

                    <td
                      style={{
                        padding: "14px",
                        display: "flex",
                        justifyContent: "center",
                        gap: "6px",
                      }}
                    >
                      <button
                        onClick={() => setCartaoPaciente(animalObj)}
                        title="Ver Cartão Vacinal"
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
                        👁️ Cartão
                      </button>

                      <button
                        onClick={() => editarVacina(v)}
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
                        onClick={() => setVacinaParaExcluir(v)}
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
                );
              })
            ) : (
              <tr>
                <td colSpan="7" style={{ padding: "24px", color: "#6b7280", fontSize: "14px" }}>
                  Nenhum registro de vacina encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL DO CARTÃO VACINAL COMPLETO (IMPRESSÃO / PDF) */}
      {cartaoPaciente && (
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
              maxWidth: "700px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              boxSizing: "border-box",
            }}
          >
            {/* CABEÇALHO DO CARTÃO */}
            <div
              style={{
                textAlign: "center",
                borderBottom: "2px solid #4f46e5",
                paddingBottom: "14px",
                marginBottom: "20px",
              }}
            >
              <h2 style={{ margin: 0, color: "#1e1b4b", fontSize: "22px" }}>
                VetAssist AI — Carteira de Vacinação
              </h2>
              <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#6b7280" }}>
                Histórico Oficial de Imunização
              </p>
            </div>

            {/* DADOS DO PACIENTE */}
            <div
              style={{
                backgroundColor: "#f8fafc",
                padding: "16px",
                borderRadius: "10px",
                marginBottom: "20px",
                border: "1px solid #e2e8f0",
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "8px",
                fontSize: "14px",
              }}
            >
              <div>
                <strong>Paciente:</strong> {cartaoPaciente.nome} ({cartaoPaciente.codigo || `PET-${cartaoPaciente.id}`})
              </div>
              <div>
                <strong>Espécie / Raça:</strong> {cartaoPaciente.especie} — {cartaoPaciente.raca || "SRD"}
              </div>
              <div>
                <strong>Sexo / Idade:</strong> {cartaoPaciente.sexo} | {cartaoPaciente.idade ? `${cartaoPaciente.idade} anos` : "-"}
              </div>
              <div>
                <strong>Peso Atual:</strong> {cartaoPaciente.peso ? `${cartaoPaciente.peso} kg` : "-"}
              </div>
            </div>

            {/* TABELA DE VACINAS DO PACIENTE */}
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                textAlign: "center",
                marginBottom: "20px",
                fontSize: "13px",
              }}
            >
              <thead>
                <tr style={{ backgroundColor: "#f3f4f6", color: "#374151" }}>
                  <th style={{ padding: "10px", borderBottom: "1px solid #e5e7eb" }}>Vacina</th>
                  <th style={{ padding: "10px", borderBottom: "1px solid #e5e7eb" }}>Dose</th>
                  <th style={{ padding: "10px", borderBottom: "1px solid #e5e7eb" }}>Fabricante/Lote</th>
                  <th style={{ padding: "10px", borderBottom: "1px solid #e5e7eb" }}>Aplicação</th>
                  <th style={{ padding: "10px", borderBottom: "1px solid #e5e7eb" }}>Próximo Reforço</th>
                </tr>
              </thead>
              <tbody>
                {vacinas
                  .filter((v) => v.animal_id === cartaoPaciente.id)
                  .map((v) => (
                    <tr key={v.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "10px", fontWeight: "bold", color: "#4f46e5" }}>{v.nome_vacina}</td>
                      <td style={{ padding: "10px" }}>{v.dose || "-"}</td>
                      <td style={{ padding: "10px" }}>{v.fabricante ? `${v.fabricante} (${v.lote || "S/ Lote"})` : v.lote || "-"}</td>
                      <td style={{ padding: "10px" }}>{v.data_aplicacao ? new Date(v.data_aplicacao + "T00:00:00").toLocaleDateString("pt-BR") : "-"}</td>
                      <td style={{ padding: "10px" }}>{renderBadgeReforco(v.data_reforco)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>

            {/* AÇÕES DE IMPRESSÃO */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
                paddingTop: "16px",
                borderTop: "1px solid #f3f4f6",
              }}
            >
              <button
                onClick={() => window.print()}
                style={{
                  backgroundColor: "#0284c7",
                  color: "white",
                  border: "none",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: "600",
                  fontSize: "13px",
                }}
              >
                🖨️ Imprimir Cartão / PDF
              </button>
              <button
                onClick={() => setCartaoPaciente(null)}
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
      {vacinaParaExcluir && (
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
              Tem certeza que deseja excluir o registro da vacina{" "}
              <strong>{vacinaParaExcluir.nome_vacina}</strong>?
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
                onClick={() => setVacinaParaExcluir(null)}
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
                onClick={deletarVacina}
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

export default Vacinas;