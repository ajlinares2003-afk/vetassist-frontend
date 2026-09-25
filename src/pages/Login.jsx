import { useState } from "react";
import { MdPets } from "react-icons/md";
import api from "../api/api";

function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mensagemErro, setMensagemErro] = useState("");
  const [mensagemSucesso, setMensagemSucesso] = useState("");
  const [carregando, setCarregando] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setMensagemErro("");
    setMensagemSucesso("");
    setCarregando(true);

    try {
      const formData = new FormData();
      formData.append("username", email);
      formData.append("password", senha);

      const response = await api.post("/auth/login", formData, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });

      // Salva o token e as informações de perfil/usuário no localStorage
      localStorage.setItem("token", response.data.access_token);
      
      if (response.data.usuario) {
        localStorage.setItem("perfil", response.data.usuario.perfil || "VETERINARIO");
        localStorage.setItem("usuario_nome", response.data.usuario.nome || "");
      }

      setMensagemSucesso("✅ Login realizado com sucesso!");

      // Redireciona e força a atualização do estado de autenticação
      window.location.href = "/dashboard";

    } catch (error) {
      console.error("Erro no login:", error);
      setMensagemErro(
        `❌ ${error.response?.data?.detail || "E-mail ou senha incorretos."}`
      );
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        backgroundColor: "#f3f4f6",
        padding: "20px",
      }}
    >
      <div
        style={{
          backgroundColor: "#ffffff",
          padding: "35px 30px",
          borderRadius: "16px",
          boxShadow:
            "0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.01)",
          width: "100%",
          maxWidth: "400px",
          textAlign: "center",
          border: "1px solid #e5e7eb",
        }}
      >
        {/* LOGO E TÍTULO */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "10px",
            marginBottom: "6px",
          }}
        >
          <MdPets color="#4f46e5" size={32} />
          <h2
            style={{
              margin: 0,
              fontSize: "24px",
              fontWeight: "bold",
              color: "#1e1b4b",
            }}
          >
            VetAssist AI
          </h2>
        </div>
        <p
          style={{
            color: "#6b7280",
            fontSize: "14px",
            marginTop: 0,
            marginBottom: "24px",
          }}
        >
          Sistema de Gestão Veterinária
        </p>

        {/* FEEDBACKS VISUAIS */}
        {mensagemSucesso && (
          <div
            style={{
              backgroundColor: "#dcfce7",
              color: "#166534",
              padding: "12px",
              borderRadius: "8px",
              marginBottom: "20px",
              fontSize: "14px",
              fontWeight: "600",
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
              padding: "12px",
              borderRadius: "8px",
              marginBottom: "20px",
              fontSize: "14px",
              fontWeight: "600",
              border: "1px solid #fecaca",
            }}
          >
            {mensagemErro}
          </div>
        )}

        {/* FORMULÁRIO */}
        <form
          onSubmit={handleLogin}
          style={{ display: "flex", flexDirection: "column", gap: "16px" }}
        >
          <div style={{ textAlign: "left" }}>
            <label
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: "600",
                color: "#374151",
                marginBottom: "6px",
              }}
            >
              E-mail
            </label>
            <input
              type="email"
              placeholder="seu.email@vetassist.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: "100%",
                height: "42px",
                padding: "0 12px",
                border: "1px solid #d1d5db",
                borderRadius: "8px",
                fontSize: "14px",
                outline: "none",
                backgroundColor: "#ffffff",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ textAlign: "left" }}>
            <label
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: "600",
                color: "#374151",
                marginBottom: "6px",
              }}
            >
              Senha
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
              style={{
                width: "100%",
                height: "42px",
                padding: "0 12px",
                border: "1px solid #d1d5db",
                borderRadius: "8px",
                fontSize: "14px",
                outline: "none",
                backgroundColor: "#ffffff",
                boxSizing: "border-box",
              }}
            />
          </div>

          <button
            type="submit"
            disabled={carregando}
            style={{
              marginTop: "8px",
              width: "100%",
              height: "44px",
              backgroundColor: carregando ? "#93c5fd" : "#4f46e5",
              color: "white",
              border: "none",
              borderRadius: "8px",
              fontSize: "15px",
              fontWeight: "600",
              cursor: carregando ? "not-allowed" : "pointer",
              boxShadow: "0 2px 4px rgba(79, 70, 229, 0.2)",
              transition: "background-color 0.2s",
            }}
          >
            {carregando ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;