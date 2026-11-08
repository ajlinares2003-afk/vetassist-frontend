import { useEffect } from "react";

// Caixa de confirmação padrão do VetAssist (substitui window.confirm do navegador).
// tom: "padrao" (azul), "aviso" (âmbar) ou "perigo" (vermelho).
const TONS = {
  padrao: { fundo: "#eef2ff", borda: "#c7d2fe", texto: "#3730a3", botao: "#4f46e5", icone: "ℹ️" },
  aviso: { fundo: "#fffbeb", borda: "#fcd34d", texto: "#92400e", botao: "#d97706", icone: "⚠️" },
  perigo: { fundo: "#fef2f2", borda: "#fca5a5", texto: "#991b1b", botao: "#dc2626", icone: "↩️" },
};

export default function ModalConfirmacao({ aberto, titulo, mensagem, rotuloConfirmar = "Confirmar", rotuloCancelar = "Cancelar", tom = "padrao", icone, onConfirmar, onCancelar }) {
  useEffect(() => {
    if (!aberto) return undefined;
    const aoTeclar = (e) => { if (e.key === "Escape") onCancelar?.(); };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aberto, onCancelar]);

  if (!aberto) return null;
  const t = TONS[tom] || TONS.padrao;
  return (
    <div onClick={() => onCancelar?.()} role="presentation"
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(15,23,42,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000, padding: "16px" }}>
      <div onClick={(e) => e.stopPropagation()} role="alertdialog" aria-modal="true" aria-labelledby="confirm-titulo"
        style={{ backgroundColor: "#fff", borderRadius: "14px", maxWidth: "440px", width: "100%", padding: "22px", boxShadow: "0 20px 40px rgba(0,0,0,0.25)" }}>
        <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
          <div style={{ width: "40px", height: "40px", borderRadius: "50%", backgroundColor: t.fundo, border: `1px solid ${t.borda}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", flexShrink: 0 }}>
            {icone || t.icone}
          </div>
          <div style={{ minWidth: 0 }}>
            <h3 id="confirm-titulo" style={{ margin: "0 0 6px 0", fontSize: "17px", color: "#111827" }}>{titulo}</h3>
            <div style={{ fontSize: "14px", color: "#4b5563", lineHeight: 1.5 }}>{mensagem}</div>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px", flexWrap: "wrap" }}>
          <button type="button" onClick={() => onCancelar?.()} style={{ backgroundColor: "#f3f4f6", color: "#374151", border: "none", padding: "9px 16px", borderRadius: "8px", cursor: "pointer", fontWeight: 600 }}>{rotuloCancelar}</button>
          <button type="button" autoFocus onClick={() => onConfirmar?.()} style={{ backgroundColor: t.botao, color: "#fff", border: "none", padding: "9px 18px", borderRadius: "8px", cursor: "pointer", fontWeight: 700 }}>{rotuloConfirmar}</button>
        </div>
      </div>
    </div>
  );
}