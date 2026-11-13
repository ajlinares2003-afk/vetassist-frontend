import { useEffect, useState, useRef } from "react";
import { MdTv, MdVolumeOff, MdVolumeUp } from "react-icons/md";
import api from "../api/api";

function PainelChamadas() {
  const [chamadas, setChamadas] = useState([]);
  const [audioDesbloqueado, setAudioDesbloqueado] = useState(false);
  const ultimoStatusRef = useRef(null);
  const intervaloSomRef = useRef(null);
  const [agora, setAgora] = useState(new Date());

  useEffect(() => {
    const relogio = setInterval(() => setAgora(new Date()), 1000);
    return () => clearInterval(relogio);
  }, []);

  useEffect(() => {
    carregarChamadas();
    const intervalo = setInterval(carregarChamadas, 3000);
    return () => {
      clearInterval(intervalo);
      if (intervaloSomRef.current) clearInterval(intervaloSomRef.current);
    };
  }, []);

  const desbloquearAudio = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        const audioCtx = new AudioContext();
        if (audioCtx.state === "suspended") {
          audioCtx.resume();
        }
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0.01, audioCtx.currentTime);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
      }
      setAudioDesbloqueado(true);
    } catch (e) {
      console.error("Erro ao desbloquear áudio:", e);
    }
  };

  const carregarChamadas = async () => {
    try {
      const response = await api.get("/consultas/painel-chamadas");
      const dados = response.data || [];
      setChamadas(dados);

      if (dados.length > 0) {
        const topo = dados[0];
        const chaveChamada = `${topo.id}-${topo.status}`;

        if (topo.status === "Chamando para Triagem" || topo.status === "Chamando para Consulta") {
          if (ultimoStatusRef.current !== chaveChamada) {
            ultimoStatusRef.current = chaveChamada;
            tocarSinalSuave();

            if (intervaloSomRef.current) clearInterval(intervaloSomRef.current);
            intervaloSomRef.current = setInterval(() => {
              tocarSinalSuave();
            }, 10000);
          }
        } else {
          if (ultimoStatusRef.current !== chaveChamada) {
            ultimoStatusRef.current = chaveChamada;
            if (intervaloSomRef.current) {
              clearInterval(intervaloSomRef.current);
              intervaloSomRef.current = null;
            }
          }
        }
      } else {
        if (intervaloSomRef.current) {
          clearInterval(intervaloSomRef.current);
          intervaloSomRef.current = null;
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
      if (audioCtx.state === "suspended") {
        audioCtx.resume();
      }

      const tocarNota = (frequencia, tempoInicio, duracao) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(frequencia, audioCtx.currentTime + tempoInicio);

        gain.gain.setValueAtTime(0, audioCtx.currentTime + tempoInicio);
        gain.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + tempoInicio + 0.05);
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

  const statusAtual = chamadas.length > 0 ? chamadas[0].status : "";
  const chamadaAtiva = chamadas.length > 0 && ["Chamando para Triagem", "Chamando para Consulta", "Em Triagem", "Em Atendimento"].includes(statusAtual);
  const ehChamando = statusAtual === "Chamando para Triagem" || statusAtual === "Chamando para Consulta";

  const STATUS_CHAMANDO = ["Chamando para Triagem", "Chamando para Consulta"];
  const estiloStatus = (st) => {
    if (STATUS_CHAMANDO.includes(st)) return { cls: "chamando", icone: "🔔" };
    if (String(st).startsWith("Em ")) return { cls: "andamento", icone: "●" };
    return { cls: "espera", icone: "◔" };
  };
  const outrosChamando = chamadas.slice(1).filter((c) => STATUS_CHAMANDO.includes(c.status));
  const hora = agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const dataExtenso = agora.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="pc-root" onClick={!audioDesbloqueado ? desbloquearAudio : undefined} style={{ cursor: !audioDesbloqueado ? "pointer" : "default" }}>
      <style>{CSS_PAINEL}</style>

      {!audioDesbloqueado && (
        <div className="pc-aviso-som">
          <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <MdVolumeOff size={26} /> O navegador bloqueou o som automático. Clique em qualquer lugar da tela para ativar o aviso sonoro.
          </span>
          <button onClick={desbloquearAudio}>Ativar som agora</button>
        </div>
      )}

      <header className="pc-header">
        <div className="pc-marca">
          <div className="pc-logo"><MdTv size={30} /></div>
          <div>
            <div className="pc-titulo">VetAssist AI</div>
            <div className="pc-subtitulo">Painel de atendimento</div>
          </div>
        </div>
        <div className="pc-relogio">
          <div className="pc-hora">{hora}</div>
          <div className="pc-data">{dataExtenso}</div>
        </div>
      </header>

      {chamadaAtiva ? (
        <section className={`pc-destaque ${ehChamando ? "chamando" : "andamento"}`}>
          <div className="pc-etapa">{ehChamando ? "🔔" : "🩺"} {chamadas[0].etapa}</div>
          <div className="pc-rotulo">{ehChamando ? "Chamando agora" : "Em andamento"}</div>
          <h2 className="pc-pet">{chamadas[0].pet}</h2>
          {chamadas[0].tutor && chamadas[0].tutor !== "-" && <div className="pc-tutor">Tutor(a): <strong>{chamadas[0].tutor}</strong></div>}
          <div className="pc-local">
            <span>📍 <strong>{chamadas[0].sala}</strong></span>
            <i />
            <span>👨‍⚕️ {chamadas[0].veterinario}</span>
          </div>
        </section>
      ) : (
        <section className="pc-ocioso">
          <div style={{ fontSize: "56px" }}>☕</div>
          <div>Nenhum paciente em atendimento no momento</div>
          <small>Por favor, aguarde ser chamado.</small>
        </section>
      )}

      {outrosChamando.length > 0 && (
        <div className="pc-tambem">
          {outrosChamando.map((c) => (
            <div key={c.id} className="pc-tambem-item">🔔 <strong>{c.pet}</strong> · {c.etapa || c.status} · {c.sala}</div>
          ))}
        </div>
      )}

      <section className="pc-lista">
        <div className="pc-lista-head">
          <span>Paciente</span><span>Tutor</span><span>Profissional</span><span style={{ textAlign: "right" }}>Situação</span>
        </div>
        {chamadas.length === 0 && <div className="pc-vazio">Sem pacientes na fila.</div>}
        {chamadas.map((item, idx) => {
          const est = estiloStatus(item.status);
          return (
            <div key={item.id} className={`pc-linha ${est.cls} ${idx === 0 && chamadaAtiva ? "topo" : ""}`}>
              <span className="pc-l-pet">{item.pet}</span>
              <span className="pc-l-tutor">{item.tutor !== "-" ? item.tutor : "—"}</span>
              <span className="pc-l-vet">{item.veterinario}</span>
              <span className="pc-l-status"><b className={`pc-pill ${est.cls}`}>{est.icone} {item.status}</b></span>
            </div>
          );
        })}
      </section>

      <footer className="pc-rodape">
        {audioDesbloqueado ? <span><MdVolumeUp size={16} style={{ verticalAlign: "-3px" }} /> Aviso sonoro ativo</span> : <span>Som desativado</span>}
        <span>Atualiza automaticamente</span>
      </footer>
    </div>
  );
}

const CSS_PAINEL = `
.pc-root{background:radial-gradient(1200px 600px at 80% -10%,#1e3a5f 0%,#0b1220 55%,#070c17 100%);color:#fff;min-height:100vh;padding:clamp(16px,2.2vw,36px);box-sizing:border-box;font-family:'Segoe UI',Roboto,sans-serif;text-align:left;display:flex;flex-direction:column;gap:clamp(14px,1.8vw,26px)}
.pc-aviso-som{background:#b45309;color:#fff;padding:12px 20px;border-radius:14px;display:flex;justify-content:space-between;align-items:center;gap:12px;font-weight:700;box-shadow:0 8px 24px rgba(0,0,0,.35);flex-wrap:wrap}
.pc-aviso-som button{background:#fff;color:#b45309;border:none;padding:9px 16px;border-radius:10px;font-weight:800;cursor:pointer}
.pc-header{display:flex;justify-content:space-between;align-items:center;gap:16px}
.pc-marca{display:flex;align-items:center;gap:14px}
.pc-logo{width:54px;height:54px;border-radius:16px;background:linear-gradient(135deg,#0ea5e9,#38bdf8);display:flex;align-items:center;justify-content:center;color:#fff;box-shadow:0 10px 24px -8px rgba(56,189,248,.7)}
.pc-titulo{font-size:clamp(22px,2.4vw,34px);font-weight:800;letter-spacing:-.3px}
.pc-subtitulo{font-size:clamp(13px,1.2vw,18px);color:#94a3b8;font-weight:600}
.pc-relogio{text-align:right}
.pc-hora{font-size:clamp(30px,3.6vw,54px);font-weight:800;line-height:1;font-variant-numeric:tabular-nums;letter-spacing:-1px}
.pc-data{font-size:clamp(12px,1.2vw,17px);color:#94a3b8;font-weight:600;margin-top:4px;display:inline-block}.pc-data::first-letter{text-transform:uppercase}
.pc-destaque{border-radius:28px;padding:clamp(22px,3vw,48px);text-align:center;position:relative;overflow:hidden;border:2px solid}
.pc-destaque.chamando{background:linear-gradient(135deg,#3b0d12,#7f1d1d 60%,#991b1b);border-color:#f87171;animation:pcPulso 1.8s ease-in-out infinite}
.pc-destaque.andamento{background:linear-gradient(135deg,#0f1f4a,#1e3a8a);border-color:#38bdf8;box-shadow:0 20px 50px -20px rgba(56,189,248,.5)}
@keyframes pcPulso{0%,100%{box-shadow:0 0 0 0 rgba(248,113,113,.55),0 20px 50px -20px rgba(239,68,68,.6)}50%{box-shadow:0 0 0 18px rgba(248,113,113,0),0 20px 50px -20px rgba(239,68,68,.6)}}
.pc-etapa{display:inline-block;background:rgba(255,255,255,.16);padding:8px 22px;border-radius:99px;font-size:clamp(14px,1.6vw,22px);font-weight:800;text-transform:uppercase;letter-spacing:1px}
.pc-rotulo{margin-top:14px;font-size:clamp(14px,1.5vw,20px);color:#fecaca;font-weight:700;text-transform:uppercase;letter-spacing:2px}
.pc-destaque.andamento .pc-rotulo{color:#bae6fd}
.pc-pet{margin:6px 0 2px;font-size:clamp(44px,6.4vw,104px);line-height:1.02;font-weight:900;letter-spacing:-2px;word-break:break-word}
.pc-tutor{font-size:clamp(20px,2.6vw,40px);color:#e2e8f0;margin-top:6px}
.pc-local{margin-top:clamp(12px,1.8vw,26px);font-size:clamp(18px,2.2vw,34px);color:#e2e8f0;display:flex;justify-content:center;align-items:center;gap:clamp(12px,2vw,30px);flex-wrap:wrap}
.pc-local i{width:8px;height:8px;border-radius:50%;background:#94a3b8;display:inline-block}
.pc-ocioso{background:rgba(30,41,59,.7);border:2px dashed #334155;border-radius:28px;text-align:center;padding:clamp(28px,4vw,56px);color:#cbd5e1;font-size:clamp(20px,2.4vw,34px);font-weight:700;display:flex;flex-direction:column;gap:8px;align-items:center}
.pc-ocioso small{font-size:clamp(14px,1.4vw,20px);color:#94a3b8;font-weight:500}
.pc-tambem{display:flex;flex-wrap:wrap;gap:10px}
.pc-tambem-item{background:rgba(220,38,38,.18);border:1px solid #ef4444;color:#fecaca;border-radius:14px;padding:10px 16px;font-size:clamp(14px,1.5vw,22px)}
.pc-lista{background:rgba(15,23,42,.6);border:1px solid #1e293b;border-radius:24px;overflow:hidden;backdrop-filter:blur(4px)}
.pc-lista-head,.pc-linha{display:grid;grid-template-columns:1.2fr 1.4fr 1.2fr 1.3fr;gap:14px;align-items:center;padding:0 clamp(16px,2vw,30px)}
.pc-lista-head{height:clamp(40px,4vw,56px);color:#64748b;font-size:clamp(12px,1.2vw,17px);font-weight:800;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #1e293b}
.pc-linha{min-height:clamp(54px,5.4vw,82px);border-bottom:1px solid #16213a;font-size:clamp(17px,1.9vw,28px);border-left:6px solid transparent}
.pc-linha:last-child{border-bottom:none}
.pc-linha.topo{background:rgba(56,189,248,.08)}
.pc-linha.chamando{border-left-color:#ef4444;background:rgba(239,68,68,.1)}
.pc-linha.andamento{border-left-color:#22c55e}
.pc-linha.espera{border-left-color:#f59e0b}
.pc-l-pet{font-weight:800;color:#38bdf8}
.pc-l-tutor{color:#f1f5f9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pc-l-vet{color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pc-l-status{text-align:right}
.pc-pill{display:inline-block;padding:6px 16px;border-radius:99px;font-size:clamp(13px,1.4vw,21px);font-weight:800;white-space:nowrap}
.pc-pill.chamando{background:#dc2626;color:#fff;animation:pcPisca 1.2s ease-in-out infinite}
.pc-pill.andamento{background:rgba(34,197,94,.18);color:#4ade80}
.pc-pill.espera{background:rgba(245,158,11,.18);color:#fbbf24}
@keyframes pcPisca{0%,100%{opacity:1}50%{opacity:.65}}
.pc-vazio{padding:26px;text-align:center;color:#64748b;font-size:20px}
.pc-rodape{display:flex;justify-content:space-between;color:#64748b;font-size:clamp(12px,1.1vw,15px);font-weight:600;margin-top:auto}
@media (max-width:760px){.pc-lista-head{display:none}.pc-linha{grid-template-columns:1fr auto;padding:12px 16px}.pc-l-vet,.pc-l-tutor{grid-column:1}.pc-l-status{grid-column:2;grid-row:1 / span 3}}
`;

export default PainelChamadas;