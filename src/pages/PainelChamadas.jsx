import { useEffect, useState, useRef } from "react";
import { MdVolumeUp, MdTv } from "react-icons/md";
import api from "../api/api";

function PainelChamadas() {
  const [chamadas, setChamadas] = useState([]);
  const ultimoStatusRef = useRef(null);

  useEffect(() => {
    carregarChamadas();
    const intervalo = setInterval(carregarChamadas, 3000); // Atualiza a cada 3 segundos
    return () => clearInterval(intervalo);
  }, []);

  const carregarChamadas = async () => {
    try {
      const response = await api.get("/consultas/painel-chamadas");
      const dados = response.data || [];
      setChamadas(dados);

      if (dados.length > 0) {
        const topo = dados[0];
        const chaveChamada = `${topo.id}-${topo.status}`;

        // Só toca o sinal sonoro quando o status de alguém mudar para "Em Triagem" ou "Em Atendimento"
        if (
          ["Em Triagem", "Em Atendimento"].includes(topo.status) &&
          ultimoStatusRef.current !== chaveChamada
        ) {
          ultimoStatusRef.current = chaveChamada;
          tocarSinalSuave();
        }
      }
    } catch (error) {
      console.error("Erro ao carregar dados do painel:", error);
    }
  };

  const tocarSinalSuave = () => {
    try {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      
      const audioCtx = new AudioContext();

      const tocarNota = (frequencia, tempoInicio, duracao) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(frequencia, audioCtx.currentTime + tempoInicio);

        gain.gain.setValueAtTime(0, audioCtx.currentTime + tempoInicio);
        gain.gain.linearRampToValueAtTime(0.15, audioCtx.currentTime + tempoInicio + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + tempoInicio + duracao);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(audioCtx.currentTime + tempoInicio);
        osc.stop(audioCtx.currentTime + tempoInicio + duracao);
      };

      tocarNota(783.99, 0.0, 0.8);
      tocarNota(523.25, 0.35, 1.2);
    } catch (e) {
      console.error("Erro ao reproduzir áudio:", e);
    }
  };

  return (
    <div style={{
      backgroundColor: "#0f172a",
      color: "#ffffff",
      minHeight: "100vh",
      padding: "30px",
      fontFamily: "'Segoe UI', Roboto, sans-serif",
      boxSizing: "border-box"
    }}>
      {/* CABEÇALHO DO PAINEL */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        borderBottom: "2px solid #334155",
        paddingBottom: "20px",
        marginBottom: "30px"
      }}>
        <h1 style={{ margin: 0, fontSize: "36px", color: "#38bdf8", display: "flex", alignItems: "center", gap: "16px" }}>
          <MdTv size={42} color="#38bdf8" />
          VetAssist AI — Painel de Atendimento
        </h1>
        <div style={{ fontSize: "20px", color: "#94a3b8", fontWeight: "600" }}>
          {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>

      {/* CHAMADA EM DESTAQUE */}
      {chamadas.length > 0 && ["Em Triagem", "Em Atendimento"].includes(chamadas[0].status) ? (
        <div style={{
          backgroundColor: chamadas[0].status === "Em Triagem" ? "#1e1b4b" : "#0f172a",
          border: `3px solid ${chamadas[0].status === "Em Triagem" ? "#818cf8" : "#38bdf8"}`,
          borderRadius: "16px",
          padding: "30px",
          marginBottom: "35px",
          boxShadow: "0 10px 25px -5px rgba(56, 189, 248, 0.3)",
          textAlign: "center"
        }}>
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
            <span style={{
              backgroundColor: chamadas[0].status === "Em Triagem" ? "#4f46e5" : "#0284c7",
              color: "white",
              padding: "6px 18px",
              borderRadius: "20px",
              fontSize: "18px",
              fontWeight: "bold",
              textTransform: "uppercase"
            }}>
              🔔 CHUMANDO AGORA: {chamadas[0].etapa}
            </span>
            <button
              onClick={tocarSinalSuave}
              style={{
                backgroundColor: "#334155",
                color: "white",
                border: "none",
                padding: "6px 14px",
                borderRadius: "20px",
                cursor: "pointer",
                fontWeight: "bold",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "14px"
              }}
            >
              <MdVolumeUp size={18} /> Repetir Sinal
            </button>
          </div>

          <h2 style={{ fontSize: "52px", margin: "16px 0 8px 0", color: "#f8fafc" }}>
            {chamadas[0].tutor && chamadas[0].tutor !== "-" ? `${chamadas[0].tutor} — ` : ""}Pet: <span style={{ color: "#38bdf8" }}>{chamadas[0].pet}</span>
          </h2>
          <div style={{ fontSize: "30px", color: "#cbd5e1", display: "flex", justifyContent: "center", gap: "30px" }}>
            <span>📍 <strong>{chamadas[0].sala}</strong></span>
            <span>•</span>
            <span>👨‍⚕️ {chamadas[0].veterinario}</span>
          </div>
        </div>
      ) : (
        <div style={{ backgroundColor: "#1e293b", padding: "30px", borderRadius: "16px", textAlign: "center", marginBottom: "35px", color: "#94a3b8", fontSize: "22px" }}>
          ☕ Nenhum paciente sendo chamado no momento. Por favor, aguarde na recepção.
        </div>
      )}

      {/* TABELA DE FILA GERAL */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #475569", color: "#94a3b8", fontSize: "20px" }}>
              <th style={{ padding: "16px" }}>Paciente / Pet</th>
              <th style={{ padding: "16px" }}>Tutor</th>
              <th style={{ padding: "16px" }}>Profissional</th>
              <th style={{ padding: "16px" }}>Status na Clínica</th>
            </tr>
          </thead>
          <tbody>
            {chamadas.map((item, idx) => (
              <tr key={item.id} style={{
                borderBottom: "1px solid #334155",
                backgroundColor: idx === 0 && ["Em Triagem", "Em Atendimento"].includes(item.status) ? "rgba(56, 189, 248, 0.1)" : "transparent",
                fontSize: "22px"
              }}>
                <td style={{ padding: "18px", fontWeight: "bold", color: "#38bdf8" }}>{item.pet}</td>
                <td style={{ padding: "18px", color: "#f1f5f9" }}>{item.tutor !== "-" ? item.tutor : "-"}</td>
                <td style={{ padding: "18px", color: "#cbd5e1" }}>{item.veterinario}</td>
                <td style={{ padding: "18px", fontWeight: "600", color: item.status.includes("Em") ? "#4ade80" : "#f59e0b" }}>
                  {item.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default PainelChamadas;