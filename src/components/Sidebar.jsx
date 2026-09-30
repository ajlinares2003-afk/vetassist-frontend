function Sidebar() {
  const logout = () => {
    localStorage.removeItem("token");
    window.location.reload();
  };
  return (
    <div
      style={{
        width: "250px",
        backgroundColor: "#4f46e5",
        color: "white",
        height: "100vh",
        padding: "20px",
      }}
    >
      <h2
        style={{
          textAlign: "center",
          marginBottom: "20px",
        }}
      >
        🐾 VetAssist AI
      </h2>

      <hr />

      <p style={{ cursor: "pointer" }} onClick={() => window.location.href = "/dashboard"}>🏠 Dashboard</p>
      <p style={{ cursor: "pointer" }} onClick={() => window.location.href = "/animais"}>🐶 Animais</p>
      <p style={{ cursor: "pointer" }} onClick={() => window.location.href = "/tutores"}>👤 Tutores</p>
      <p style={{ cursor: "pointer" }} onClick={() => window.location.href = "/checkin"}>📝 Check-in</p>
      <p style={{ cursor: "pointer" }} onClick={() => window.location.href = "/usuarios"}>🛡️ Usuários & Perfis</p> {/* <-- ADICIONADO AQUI */}
      <p style={{ cursor: "pointer" }} onClick={() => window.location.href = "/vacinas"}>💉 Vacinas</p>
      <p style={{ cursor: "pointer" }} onClick={() => window.location.href = "/prescricoes"}>💊 Prescrições</p>
      <p style={{ cursor: "pointer" }} onClick={() => window.location.href = "/prontuarios"}>📖 Prontuários</p>
      
      <button
        onClick={logout}
        style={{
          width: "100%",
          backgroundColor: "#ef4444",
          color: "white",
          border: "none",
          padding: "12px",
          borderRadius: "10px",
          cursor: "pointer",
          marginTop: "40px",
          fontWeight: "bold",
          fontSize: "16px",
        }}
      >
        🚪 Sair
      </button>
    </div>
  );
}

export default Sidebar;