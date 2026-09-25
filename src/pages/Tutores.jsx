import { FaUserTie } from "react-icons/fa";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";
import Layout from "../components/Layout";

function Tutores() {
  const navigate = useNavigate();
  const [tutores, setTutores] = useState([]);
  const [tutorEditando, setTutorEditando] = useState(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);

  const [codigo, setCodigo] = useState("");
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");

  // Novos estados para Endereço e Complemento
  const [cep, setCep] = useState("");
  const [rua, setRua] = useState("");
  const [complemento, setComplemento] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");

  const [busca, setBusca] = useState("");
  const [mensagemErro, setMensagemErro] = useState("");
  const [mensagemSucesso, setMensagemSucesso] = useState("");
  const [tutorParaExcluir, setTutorParaExcluir] = useState(null);

  useEffect(() => {
    carregarTutores();
  }, []);

  const tratarSessaoExpirada = () => {
    setMensagemErro("❌ Sessão expirada ou não autenticado. Redirecionando para o login...");
    setTimeout(() => {
      localStorage.removeItem("token");
      navigate("/");
    }, 2000);
  };

  const formatarCPF = (valor) => {
    if (!valor) return "-";
    const apenasNumeros = valor.replace(/\D/g, "");
    if (apenasNumeros.length !== 11) return valor;
    return apenasNumeros.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  };

  const validarCPF = (cpfStr) => {
    const cpfLimpo = cpfStr.replace(/[^\d]+/g, "");
    if (cpfLimpo.length !== 11 || /^(\d)\1{10}$/.test(cpfLimpo)) return false;
    
    let soma = 0;
    let resto;
    
    for (let i = 1; i <= 9; i++) {
      soma += parseInt(cpfLimpo.substring(i - 1, i)) * (11 - i);
    }
    resto = (soma * 10) % 11;
    if ((resto === 10) || (resto === 11)) resto = 0;
    if (resto !== parseInt(cpfLimpo.substring(9, 10))) return false;
    
    soma = 0;
    for (let i = 1; i <= 10; i++) {
      soma += parseInt(cpfLimpo.substring(i - 1, i)) * (12 - i);
    }
    resto = (soma * 10) % 11;
    if ((resto === 10) || (resto === 11)) resto = 0;
    if (resto !== parseInt(cpfLimpo.substring(10, 11))) return false;
    
    return true;
  };

  const formatarTelefone = (valor) => {
    if (!valor) return "-";
    const apenasNumeros = valor.replace(/\D/g, "");
    if (apenasNumeros.length === 11) {
      return apenasNumeros.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
    }
    if (apenasNumeros.length === 10) {
      return apenasNumeros.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
    }
    return valor;
  };

  const aplicarMascaraCPF = (e) => {
    let valor = e.target.value.replace(/\D/g, "");
    if (valor.length > 11) valor = valor.slice(0, 11);
    valor = valor.replace(/(\d{3})(\d)/, "$1.$2");
    valor = valor.replace(/(\d{3})(\d)/, "$1.$2");
    valor = valor.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    setCpf(valor);
  };

  const aplicarMascaraCEP = (e) => {
    let valor = e.target.value.replace(/\D/g, "");
    if (valor.length > 8) valor = valor.slice(0, 8);
    valor = valor.replace(/(\d{5})(\d)/, "$1-$2");
    setCep(valor);

    if (valor.replace(/\D/g, "").length === 8) {
      buscarCep(valor);
    }
  };

  const buscarCep = async (cepValor) => {
    const cepLimpo = cepValor.replace(/\D/g, "");
    if (cepLimpo.length !== 8) return;

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const data = await response.json();

      if (!data.erro) {
        setRua(data.logradouro || "");
        setBairro(data.bairro || "");
        setCidade(data.localidade || "");
        setEstado(data.uf || "");
      } else {
        setMensagemErro("❌ CEP não encontrado.");
      }
    } catch (error) {
      console.error("Erro ao buscar CEP:", error);
    }
  };

  const aplicarMascaraTelefone = (e) => {
    let valor = e.target.value.replace(/\D/g, "");
    if (valor.length > 11) valor = valor.slice(0, 11);
    if (valor.length > 10) {
      valor = valor.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
    } else if (valor.length > 5) {
      valor = valor.replace(/^(\d{2})(\d{4})(\d{0,4})$/, "($1) $2-$3");
    } else if (valor.length > 2) {
      valor = valor.replace(/^(\d{2})(\d{0,5})$/, "($1) $2");
    } else if (valor.length > 0) {
      valor = valor.replace(/^(\d*)$/, "($1");
    }
    setTelefone(valor);
  };

  const carregarTutores = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return tratarSessaoExpirada();

      const response = await api.get("/tutores/", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTutores(response.data);
    } catch (error) {
      if (error.response?.status === 401) {
        tratarSessaoExpirada();
      } else {
        console.error("ERRO GET TUTORES:", error);
      }
    }
  };

  const limparFormulario = () => {
    setTutorEditando(null);
    setCodigo("");
    setNome("");
    setCpf("");
    setTelefone("");
    setEmail("");
    setCep("");
    setRua("");
    setComplemento("");
    setBairro("");
    setCidade("");
    setEstado("");
    setMensagemErro("");
  };

  const salvarTutor = async () => {
    try {
      setMensagemErro("");
      setMensagemSucesso("");

      if (!nome.trim() || nome.trim().length < 2) {
        setMensagemErro("👤 Informe o nome completo do tutor.");
        return;
      }

      if (!cpf.trim()) {
        setMensagemErro("👤 Informe o CPF do tutor.");
        return;
      }

      if (!validarCPF(cpf)) {
        setMensagemErro("❌ O CPF informado é inválido. Verifique os dígitos.");
        return;
      }

      if (!telefone.trim()) {
        setMensagemErro("👤 Informe o telefone de contato.");
        return;
      }

      const token = localStorage.getItem("token");
      if (!token) {
        tratarSessaoExpirada();
        return;
      }

      const novoTutor = {
        codigo: codigo.trim() ? codigo.trim() : undefined,
        nome,
        cpf: cpf.replace(/\D/g, ""),
        telefone: telefone.replace(/\D/g, ""),
        email: email || null,
        cep: cep || null,
        rua: rua || null,
        complemento: complemento || null,
        bairro: bairro || null,
        cidade: cidade || null,
        estado: estado ? estado.toUpperCase() : null,
      };

      let url = "http://127.0.0.1:8000/tutores/";
      let metodo = "POST";

      if (tutorEditando) {
        url = `http://127.0.0.1:8000/tutores/${tutorEditando.id}`;
        metodo = "PUT";
      }

      const response = await fetch(url, {
        method: metodo,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(novoTutor),
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
      carregarTutores();

      setMensagemSucesso(
        tutorEditando
          ? "✅ Tutor atualizado com sucesso!"
          : "✅ Tutor cadastrado com sucesso!"
      );
    } catch (error) {
      console.error("ERRO SALVAR TUTOR:", error);
      setMensagemErro(`❌ ${error.message}`);
    }
  };

  const deletarTutor = async () => {
    if (!tutorParaExcluir) return;

    try {
      const token = localStorage.getItem("token");

      if (!token) {
        tratarSessaoExpirada();
        return;
      }

      const response = await fetch(
        `http://127.0.0.1:8000/tutores/${tutorParaExcluir.id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.status === 401) {
        setTutorParaExcluir(null);
        tratarSessaoExpirada();
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Erro ao excluir tutor.");
      }

      setMensagemSucesso("✅ Tutor excluído com sucesso!");
      setTutorParaExcluir(null);
      carregarTutores();
    } catch (error) {
      console.error("ERRO DELETE TUTOR:", error);
      setMensagemErro(`❌ Erro ao excluir: ${error.message}`);
      setTutorParaExcluir(null);
    }
  };

  const editarTutor = (tutor) => {
    setTutorEditando(tutor);
    setCodigo(tutor.codigo || "");
    setNome(tutor.nome || "");
    setCpf(formatarCPF(tutor.cpf) || "");
    setTelefone(formatarTelefone(tutor.telefone) || "");
    setEmail(tutor.email || "");
    setCep(tutor.cep || "");
    setRua(tutor.rua || "");
    setComplemento(tutor.complemento || "");
    setBairro(tutor.bairro || "");
    setCidade(tutor.cidade || "");
    setEstado(tutor.estado || "");
    setMostrarFormulario(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const tutoresFiltrados = tutores.filter((tutor) => {
    const termo = busca.toLowerCase();
    const codigoTutor = (tutor.codigo || `TUT-${String(tutor.id).padStart(4, "0")}`).toLowerCase();
    const nomeTutor = tutor.nome.toLowerCase();
    const cpfTutor = (tutor.cpf || "").toLowerCase();
    const telefoneTutor = (tutor.telefone || "").toLowerCase();
    const emailTutor = (tutor.email || "").toLowerCase();
    const cidadeTutor = (tutor.cidade || "").toLowerCase();

    return (
      codigoTutor.includes(termo) ||
      nomeTutor.includes(termo) ||
      cpfTutor.includes(termo) ||
      telefoneTutor.includes(termo) ||
      emailTutor.includes(termo) ||
      cidadeTutor.includes(termo)
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
          <FaUserTie color="#4f46e5" size={38} />
          Tutores
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
          {mostrarFormulario ? "Fechar Formulário" : "＋ Novo Tutor"}
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
              {tutorEditando ? "✏️ Editar Tutor" : "👤 Cadastrar Novo Tutor"}
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
              <label style={estiloLabel}>Código / Matrícula</label>
              <input
                type="text"
                placeholder="Ex: TUT-0001 (Automático se em branco)"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                style={{ ...estiloInput, backgroundColor: "#f9fafb" }}
              />
            </div>

            <div>
              <label style={estiloLabel}>Nome Completo *</label>
              <input
                type="text"
                placeholder="Ex: Carlos Silva"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                style={estiloInput}
              />
            </div>

            <div>
              <label style={estiloLabel}>CPF *</label>
              <input
                type="text"
                placeholder="000.000.000-00"
                value={cpf}
                onChange={aplicarMascaraCPF}
                maxLength={14}
                style={estiloInput}
              />
            </div>

            <div>
              <label style={estiloLabel}>Telefone / WhatsApp *</label>
              <input
                type="text"
                placeholder="(00) 00000-0000"
                value={telefone}
                onChange={aplicarMascaraTelefone}
                maxLength={15}
                style={estiloInput}
              />
            </div>

            <div>
              <label style={estiloLabel}>E-mail</label>
              <input
                type="email"
                placeholder="Ex: carlos@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={estiloInput}
              />
            </div>

            <div>
              <label style={estiloLabel}>CEP</label>
              <input
                type="text"
                placeholder="00000-000"
                value={cep}
                onChange={aplicarMascaraCEP}
                maxLength={9}
                style={estiloInput}
              />
            </div>

            <div>
              <label style={estiloLabel}>Rua / Logradouro</label>
              <input
                type="text"
                placeholder="Ex: Rua das Flores, 123"
                value={rua}
                onChange={(e) => setRua(e.target.value)}
                style={estiloInput}
              />
            </div>

            <div>
              <label style={estiloLabel}>Complemento</label>
              <input
                type="text"
                placeholder="Ex: Lote 15 Bloco 2 Casa 10"
                value={complemento}
                onChange={(e) => setComplemento(e.target.value)}
                style={estiloInput}
              />
            </div>

            <div>
              <label style={estiloLabel}>Bairro</label>
              <input
                type="text"
                placeholder="Ex: Centro"
                value={bairro}
                onChange={(e) => setBairro(e.target.value)}
                style={estiloInput}
              />
            </div>

            <div>
              <label style={estiloLabel}>Cidade</label>
              <input
                type="text"
                placeholder="Ex: São Paulo"
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                style={estiloInput}
              />
            </div>

            <div>
              <label style={estiloLabel}>Estado (UF)</label>
              <input
                type="text"
                maxLength={2}
                placeholder="Ex: SP"
                value={estado}
                onChange={(e) => setEstado(e.target.value.toUpperCase())}
                style={estiloInput}
              />
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
              onClick={salvarTutor}
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
          placeholder="🔍 Pesquisar tutor por nome, código, CPF, telefone, e-mail ou cidade..."
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

      {/* TABELA DE TUTORES */}
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
              <th style={{ padding: "14px" }}>Código</th>
              <th style={{ padding: "14px" }}>Nome</th>
              <th style={{ padding: "14px" }}>CPF</th>
              <th style={{ padding: "14px" }}>Telefone</th>
              <th style={{ padding: "14px" }}>Cidade/UF</th>
              <th style={{ padding: "14px" }}>E-mail</th>
              <th style={{ padding: "14px" }}>Ações</th>
            </tr>
          </thead>

          <tbody>
            {tutoresFiltrados.length > 0 ? (
              tutoresFiltrados.map((tutor, index) => (
                <tr
                  key={tutor.id}
                  style={{
                    backgroundColor: index % 2 === 0 ? "#ffffff" : "#f9fafb",
                    borderBottom: "1px solid #f3f4f6",
                    fontSize: "14px",
                  }}
                >
                  <td style={{ padding: "14px", fontWeight: "bold", color: "#4f46e5" }}>
                    {tutor.codigo || `TUT-${String(tutor.id).padStart(4, "0")}`}
                  </td>
                  <td style={{ padding: "14px", fontWeight: "600", color: "#1f2937" }}>
                    {tutor.nome}
                  </td>
                  <td style={{ padding: "14px", color: "#4b5563" }}>
                    {formatarCPF(tutor.cpf)}
                  </td>
                  <td style={{ padding: "14px", color: "#4b5563" }}>
                    {formatarTelefone(tutor.telefone)}
                  </td>
                  <td style={{ padding: "14px", color: "#4b5563" }}>
                    {tutor.cidade && tutor.estado ? `${tutor.cidade} - ${tutor.estado}` : (tutor.cidade || tutor.estado || "-")}
                  </td>
                  <td style={{ padding: "14px", color: "#4b5563" }}>
                    {tutor.email || "-"}
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
                      onClick={() => editarTutor(tutor)}
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
                      onClick={() => setTutorParaExcluir(tutor)}
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
                <td colSpan="7" style={{ padding: "24px", color: "#6b7280", fontSize: "14px" }}>
                  Nenhum tutor encontrado para a busca "{busca}".
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      {tutorParaExcluir && (
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
              Tem certeza que deseja excluir o tutor <strong>{tutorParaExcluir.nome}</strong>?
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
                onClick={() => setTutorParaExcluir(null)}
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
                onClick={deletarTutor}
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

export default Tutores;