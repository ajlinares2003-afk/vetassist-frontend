import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  MdFolderShared,
  MdPets,
  MdVaccines,
  MdAssignment,
  MdAutoAwesome,
  MdPerson,
  MdHotel,
  MdClose,
  MdSave,
  MdDelete,
  MdWarning
} from "react-icons/md";
import api from "../api/api";
import Layout from "../components/Layout";

function Prontuarios() {
  const navigate = useNavigate();
  const [animais, setAnimais] = useState([]);
  const [animalSelecionadoId, setAnimalSelecionadoId] = useState("");
  const [prontuario, setProntuario] = useState(null);
  const [resumoIA, setResumoIA] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [carregandoIA, setCarregandoIA] = useState(false);
  const [salvandoProntuario, setSalvandoProntuario] = useState(false);
  const [mensagemErro, setMensagemErro] = useState("");
  const [mensagemSucesso, setMensagemSucesso] = useState("");
  const [prontuariosSalvosLista, setProntuariosSalvosLista] = useState([]);

  // Estado para o Modal Customizado de Exclusão
  const [prontuarioParaExcluir, setProntuarioParaExcluir] = useState(null);

  const [itensPrescricoesMap, setItensPrescricoesMap] = useState({});

  useEffect(() => {
    carregarAnimais();
    carregarProntuariosSalvos();
  }, []);

  const carregarAnimais = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/");
        return;
      }
      const response = await api.get("/animais/", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAnimais(response.data || []);
    } catch (error) {
      console.error("Erro ao carregar animais:", error);
    }
  };

  const carregarProntuariosSalvos = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await api.get("/prontuarios/salvos/todos", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProntuariosSalvosLista(response.data || []);
    } catch (error) {
      console.error("Erro ao carregar prontuários salvos:", error);
    }
  };

  const confirmarExclusao = (item, e) => {
    e.stopPropagation();
    setProntuarioParaExcluir(item);
  };

  const executarExclusaoProntuario = async () => {
    if (!prontuarioParaExcluir) return;
    try {
      const token = localStorage.getItem("token");
      await api.delete(`/prontuarios/salvos/${prontuarioParaExcluir.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMensagemSucesso(`✅ Prontuário ${prontuarioParaExcluir.codigo} excluído com sucesso!`);
      setProntuarioParaExcluir(null);
      carregarProntuariosSalvos();
    } catch (error) {
      console.error("Erro ao excluir prontuário:", error);
      setMensagemErro("❌ Não foi possível excluir o prontuário.");
      setProntuarioParaExcluir(null);
    }
  };

  const carregarProntuario = async (id) => {
    if (!id) {
      fecharProntuario();
      return;
    }
    setCarregando(true);
    setMensagemErro("");
    setMensagemSucesso("");
    try {
      const token = localStorage.getItem("token");

      const resProntuario = await api.get(`/prontuarios/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const dadosProntuario = resProntuario.data;
      setProntuario(dadosProntuario);
      
      if (dadosProntuario.resumo_ia_salvo) {
        setResumoIA(dadosProntuario.resumo_ia_salvo);
      } else {
        setResumoIA("");
      }

      if (dadosProntuario && dadosProntuario.consultas) {
        dadosProntuario.consultas.forEach(async (c) => {
          if (c.prescricoes && c.prescricoes.length > 0) {
            c.prescricoes.forEach(async (p) => {
              if (p && p.id) {
                try {
                  const resPresc = await api.get(`/prescricoes/${p.id}`, {
                    headers: { Authorization: `Bearer ${token}` },
                  });
                  const itensReceita = resPresc.data?.itens || resPresc.data?.medicamentos || resPresc.data?.receita || (Array.isArray(resPresc.data) ? resPresc.data : [resPresc.data]);
                  setItensPrescricoesMap((prev) => ({
                    ...prev,
                    [p.id]: itensReceita
                  }));
                } catch (err) {
                  console.error(`Erro ao carregar itens da prescrição ${p.id}:`, err);
                }
              }
            });
          }
        });
      }
    } catch (error) {
      console.error("Erro ao carregar prontuário:", error);
      setMensagemErro("❌ Não foi possível carregar o prontuário deste paciente.");
    } finally {
      setCarregando(false);
    }
  };

  const fecharProntuario = () => {
    setAnimalSelecionadoId("");
    setProntuario(null);
    setResumoIA("");
    setItensPrescricoesMap({});
    setMensagemSucesso("");
    setMensagemErro("");
    carregarProntuariosSalvos();
  };

  const gerarResumoCopiloto = async () => {
    if (!animalSelecionadoId) return;
    setCarregandoIA(true);
    try {
      const token = localStorage.getItem("token");
      const resResumo = await api.get(`/prontuarios/${animalSelecionadoId}/resumo`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setResumoIA(resResumo.data.resumo || "");
    } catch (error) {
      console.error("Erro ao gerar análise do Copiloto:", error);
      setResumoIA("❌ Erro ao consultar o Copiloto IA.");
    } finally {
      setCarregandoIA(false);
    }
  };

  const salvarProntuarioOficial = async () => {
    if (!animalSelecionadoId || !prontuario) return;
    setSalvandoProntuario(true);
    setMensagemErro("");
    setMensagemSucesso("");

    try {
      const token = localStorage.getItem("token");
      const response = await api.post(
        "/prontuarios/salvar",
        {
          animal_id: Number(animalSelecionadoId),
          resumo_ia: resumoIA || null,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const codigoGerado = response.data?.codigo || "PRO-001";
      setMensagemSucesso(`✅ Prontuário e Parecer do Copiloto IA salvos com sucesso sob o código ${codigoGerado}!`);
      carregarProntuariosSalvos();
    } catch (error) {
      console.error("Erro ao salvar prontuário:", error);
      setMensagemErro("❌ Erro ao salvar o prontuário no banco de dados.");
    } finally {
      setSalvandoProntuario(false);
    }
  };

  const handleSelectAnimal = (e) => {
    const id = e.target.value;
    setAnimalSelecionadoId(id);
    setResumoIA("");
    setMensagemSucesso("");
    carregarProntuario(id);
  };

  return (
    <Layout>
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ display: "flex", alignItems: "center", gap: "12px", margin: 0, fontSize: "26px", color: "#1e1b4b" }}>
          <MdFolderShared color="#4f46e5" size={38} />
          Prontuário Médico Unificado & Copiloto IA
        </h1>
        <p style={{ color: "#6b7280", fontSize: "14px", marginTop: "4px" }}>
          Visão clínica integrada: exames, vacinas, histórico de internações e análise do Gemini.
        </p>
      </div>

      {/* SELETOR DE PACIENTE & BOTÃO DE FECHAR */}
      <div style={{ backgroundColor: "#ffffff", padding: "20px", borderRadius: "12px", marginBottom: "25px", border: "1px solid #e5e7eb", display: "flex", gap: "12px", alignItems: "flex-end" }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: "block", fontSize: "14px", fontWeight: "600", color: "#374151", marginBottom: "8px" }}>
            🐾 Selecionar Paciente:
          </label>
          <select value={animalSelecionadoId} onChange={handleSelectAnimal} style={{ width: "100%", height: "44px", padding: "0 14px", border: "1px solid #d1d5db", borderRadius: "10px", fontSize: "15px" }}>
            <option value="">Selecione um paciente na lista...</option>
            {animais.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome} ({a.codigo || `PET-${a.id}`}) — {a.especie} ({a.raca || "SRD"})
              </option>
            ))}
          </select>
        </div>
        {prontuario && (
          <button
            onClick={fecharProntuario}
            style={{ height: "44px", backgroundColor: "#ef4444", color: "white", border: "none", padding: "0 16px", borderRadius: "10px", cursor: "pointer", fontWeight: "600", display: "flex", alignItems: "center", gap: "6px" }}
          >
            <MdClose size={20} /> Fechar Tela
          </button>
        )}
      </div>

      {mensagemErro && <div style={{ backgroundColor: "#fee2e2", color: "#991b1b", padding: "12px", borderRadius: "8px", marginBottom: "15px" }}>{mensagemErro}</div>}
      {mensagemSucesso && <div style={{ backgroundColor: "#dcfce7", color: "#166534", padding: "12px", borderRadius: "8px", marginBottom: "15px", border: "1px solid #bbf7d0", fontWeight: "500" }}>{mensagemSucesso}</div>}
      {carregando && <div style={{ textAlign: "center", padding: "40px", color: "#4f46e5", fontWeight: "600" }}>Carregando prontuário...</div>}

      {/* MODAL CUSTOMIZADO DE CONFIRMAÇÃO DE EXCLUSÃO */}
      {prontuarioParaExcluir && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999 }}>
          <div style={{ backgroundColor: "white", padding: "24px", borderRadius: "12px", width: "400px", boxShadow: "0 10px 25px rgba(0,0,0,0.1)", textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "12px" }}>
              <div style={{ backgroundColor: "#fee2e2", padding: "12px", borderRadius: "50%", color: "#dc2626" }}>
                <MdWarning size={32} />
              </div>
            </div>
            <h3 style={{ margin: "0 0 8px 0", color: "#1f2937", fontSize: "18px" }}>Confirmar Exclusão</h3>
            <p style={{ color: "#6b7280", fontSize: "14px", margin: "0 0 20px 0" }}>
              Deseja realmente excluir o prontuário <strong>{prontuarioParaExcluir.codigo}</strong> do paciente <strong>{prontuarioParaExcluir.animal_nome}</strong>?
            </p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <button
                onClick={() => setProntuarioParaExcluir(null)}
                style={{ padding: "10px 18px", backgroundColor: "#e5e7eb", color: "#374151", border: "none", borderRadius: "8px", fontWeight: "600", cursor: "pointer" }}
              >
                Cancelar
              </button>
              <button
                onClick={executarExclusaoProntuario}
                style={{ padding: "10px 18px", backgroundColor: "#dc2626", color: "white", border: "none", borderRadius: "8px", fontWeight: "600", cursor: "pointer" }}
              >
                Sim, Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SE NÃO HOUVER PACIENTE SELECIONADO, MOSTRA LISTA DE PRONTUÁRIOS JÁ SALVOS */}
      {!prontuario && !carregando && (
        <div style={{ backgroundColor: "#ffffff", padding: "24px", borderRadius: "12px", border: "1px solid #e5e7eb" }}>
          <h3 style={{ margin: "0 0 16px 0", color: "#1e1b4b", fontSize: "18px", display: "flex", alignItems: "center", gap: "8px" }}>
            📁 Prontuários Consolidados Cadastrados ({prontuariosSalvosLista.length})
          </h3>
          {prontuariosSalvosLista.length > 0 ? (
            <div style={{ display: "grid", gap: "12px" }}>
              {prontuariosSalvosLista.map((item) => (
                <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                  <div>
                    <strong style={{ color: "#4f46e5", fontSize: "16px" }}>{item.codigo}</strong> — <span style={{ fontWeight: "600", color: "#1f2937" }}>{item.animal_nome}</span>
                    <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "2px" }}>Salvo em: {new Date(item.data_criacao).toLocaleString("pt-BR")}</div>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      onClick={() => {
                        setAnimalSelecionadoId(item.animal_id);
                        carregarProntuario(item.animal_id);
                      }}
                      style={{ backgroundColor: "#4f46e5", color: "white", border: "none", padding: "8px 14px", borderRadius: "6px", cursor: "pointer", fontWeight: "600", fontSize: "13px" }}
                    >
                      🔍 Abrir Prontuário
                    </button>
                    <button
                      onClick={(e) => confirmarExclusao(item, e)}
                      style={{ backgroundColor: "#fee2e2", color: "#dc2626", border: "1px solid #fecaca", padding: "8px 12px", borderRadius: "6px", cursor: "pointer", fontWeight: "600", fontSize: "13px", display: "flex", alignItems: "center", gap: "4px" }}
                    >
                      <MdDelete size={16} /> Excluir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: "#9ca3af", fontStyle: "italic", margin: 0 }}>Nenhum prontuário consolidado salvo no sistema ainda.</p>
          )}
        </div>
      )}

      {/* DETALHES DO PRONTUÁRIO */}
      {prontuario && prontuario.animal && !carregando && (
        <div id="printable-area">
          {/* CABEÇALHO DO PACIENTE E TUTOR */}
          <div style={{ backgroundColor: "#ffffff", padding: "24px", borderRadius: "12px", marginBottom: "20px", borderLeft: "6px solid #4f46e5", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px", border: "1px solid #e5e7eb" }}>
            <div>
              <span style={{ fontSize: "11px", color: "#6b7280", textTransform: "uppercase" }}>PACIENTE</span>
              <div style={{ fontWeight: "bold", fontSize: "18px", color: "#111827" }}>{prontuario.animal.nome}</div>
              <span style={{ fontSize: "12px", color: "#4f46e5", fontWeight: "600" }}>{prontuario.animal.codigo || `PET-${prontuario.animal.id}`}</span>
            </div>

            <div>
              <span style={{ fontSize: "11px", color: "#6b7280", textTransform: "uppercase" }}>TUTOR RESPONSÁVEL</span>
              <div style={{ fontWeight: "600", fontSize: "15px", color: "#1f2937", display: "flex", alignItems: "center", gap: "4px" }}>
                <MdPerson color="#4f46e5" /> {prontuario.tutor ? prontuario.tutor.nome : "Não informado"}
              </div>
            </div>

            <div>
              <span style={{ fontSize: "11px", color: "#6b7280", textTransform: "uppercase" }}>ESPÉCIE / RAÇA</span>
              <div style={{ fontWeight: "600", fontSize: "14px", color: "#374151" }}>{prontuario.animal.especie} — {prontuario.animal.raca || "SRD"}</div>
            </div>

            <div style={{ textAlign: "right", display: "flex", gap: "8px", justifyContent: "flex-end", flexWrap: "wrap" }} className="no-print">
              <button
                onClick={gerarResumoCopiloto}
                disabled={carregandoIA}
                style={{ backgroundColor: carregandoIA ? "#9ca3af" : "#4f46e5", color: "white", border: "none", padding: "8px 14px", borderRadius: "8px", cursor: carregandoIA ? "not-allowed" : "pointer", fontWeight: "600", fontSize: "13px", display: "flex", alignItems: "center", gap: "6px" }}
              >
                <MdAutoAwesome size={18} /> {carregandoIA ? "Analisando..." : "🤖 Copiloto IA"}
              </button>
              <button
                onClick={salvarProntuarioOficial}
                disabled={salvandoProntuario}
                style={{ backgroundColor: salvandoProntuario ? "#9ca3af" : "#16a34a", color: "white", border: "none", padding: "8px 14px", borderRadius: "8px", cursor: salvandoProntuario ? "not-allowed" : "pointer", fontWeight: "600", fontSize: "13px", display: "flex", alignItems: "center", gap: "6px" }}
              >
                <MdSave size={18} /> {salvandoProntuario ? "Salvando..." : "💾 Salvar Prontuário"}
              </button>
              <button onClick={() => window.print()} style={{ backgroundColor: "#0284c7", color: "white", border: "none", padding: "8px 14px", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "13px" }}>
                🖨️ Imprimir
              </button>
            </div>
          </div>

          {/* CARD RESUMO CLÍNICO INTELIGENTE COM GEMINI */}
          {resumoIA && (
            <div style={{ backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", padding: "20px", borderRadius: "12px", marginBottom: "25px" }}>
              <h4 style={{ margin: "0 0 12px 0", color: "#166534", fontSize: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                <MdAutoAwesome color="#16a34a" size={22} /> Parecer Médico do Copiloto IA
              </h4>
              <div style={{ fontSize: "14px", color: "#15803d", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>
                {resumoIA}
              </div>
            </div>
          )}

          {/* HISTÓRICO DE INTERNAÇÃO E UTI */}
          <div style={{ marginBottom: "30px" }}>
            <h3 style={{ display: "flex", alignItems: "center", gap: "8px", color: "#1e1b4b", fontSize: "18px", marginBottom: "14px" }}>
              <MdHotel color="#4f46e5" /> Histórico de Internação & Sinais Vitais ({prontuario.internacoes ? prontuario.internacoes.length : 0})
            </h3>

            {prontuario.internacoes && prontuario.internacoes.length > 0 ? (
              <div style={{ display: "grid", gap: "12px" }}>
                {prontuario.internacoes.map((item) => (
                  <div key={item.id} style={{ backgroundColor: "#ffffff", padding: "16px", borderRadius: "10px", border: "1px solid #e5e7eb" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontWeight: "600" }}>
                      <span>🏠 Leito: {item.leito} | Status: <strong style={{ color: item.status === "INTERNADO" ? "#16a34a" : "#64748b" }}>{item.status}</strong></span>
                      <span style={{ fontSize: "12px", color: "#6b7280" }}>Entrada: {new Date(item.data_entrada).toLocaleString("pt-BR")}</span>
                    </div>
                    <div style={{ fontSize: "13px", color: "#334155", marginBottom: "10px" }}><strong>Motivo:</strong> {item.motivo}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: "#9ca3af", fontSize: "14px", fontStyle: "italic" }}>Nenhuma internação registrada para este paciente.</p>
            )}
          </div>

          {/* HISTÓRICO DE CONSULTAS E ATENDIMENTOS */}
          <div style={{ marginBottom: "30px" }}>
            <h3 style={{ display: "flex", alignItems: "center", gap: "8px", color: "#1e1b4b", fontSize: "18px", marginBottom: "14px" }}>
              <MdAssignment color="#4f46e5" /> Consultas e Atendimentos ({prontuario.consultas ? prontuario.consultas.length : 0})
            </h3>

            {prontuario.consultas && prontuario.consultas.length > 0 ? (
              <div style={{ display: "grid", gap: "16px" }}>
                {prontuario.consultas.map((item, idx) => (
                  <div key={idx} style={{ backgroundColor: "white", padding: "18px", borderRadius: "10px", border: "1px solid #e5e7eb" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px", borderBottom: "1px solid #f3f4f6", paddingBottom: "8px" }}>
                      <strong style={{ color: "#4f46e5", fontSize: "15px" }}>{item.consulta.codigo || `CNS-${item.consulta.id}`}</strong>
                      <span style={{ fontSize: "13px", color: "#6b7280" }}>{new Date(item.consulta.data_consulta).toLocaleString("pt-BR")}</span>
                    </div>

                    <p style={{ margin: "4px 0 8px 0", fontSize: "14px", color: "#1f2937" }}>
                      <strong>Queixa Principal:</strong> {item.consulta.queixa_principal || "-"}
                    </p>

                    {item.exames && item.exames.length > 0 && (
                      <div style={{ marginTop: "12px", backgroundColor: "#f8fafc", padding: "10px 14px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                        <strong style={{ fontSize: "13px", color: "#334155" }}>🧪 Exames Realizados:</strong>
                        <ul style={{ margin: "4px 0 0 0", paddingLeft: "20px", fontSize: "13px", color: "#475569" }}>
                          {item.exames.map((ex, i) => (
                            <li key={i}><strong>{ex.nome_exame}:</strong> {ex.resultado || "Aguardando resultado"}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {item.prescricoes && item.prescricoes.length > 0 ? (
                      <div style={{ marginTop: "10px", backgroundColor: "#f0f9ff", padding: "10px 14px", borderRadius: "8px", border: "1px solid #bae6fd" }}>
                        <strong style={{ fontSize: "13px", color: "#0369a1" }}>💊 Receituário Emitido:</strong>
                        <ul style={{ margin: "4px 0 0 0", paddingLeft: "20px", fontSize: "13px", color: "#0284c7" }}>
                          {item.prescricoes.map((p, i) => {
                            const itensDet = itensPrescricoesMap[p.id] || p.itens || p.medicamentos;

                            if (Array.isArray(itensDet) && itensDet.length > 0) {
                              return itensDet.map((med, idx) => {
                                const nome = med.medicamento || med.nome_medicamento || med.nome || med.descricao || "Medicamento";
                                const dosagem = med.dosagem ? `— ${med.dosagem}` : "";
                                const freq = med.frequencia ? `(${med.frequencia})` : "";
                                const dur = med.duracao ? `por ${med.duracao}` : "";
                                return (
                                  <li key={`${i}-${idx}`}>
                                    <strong>{nome}</strong> {dosagem} {freq} {dur}
                                  </li>
                                );
                              });
                            }

                            return (
                              <li key={i}>
                                <strong>Receituário #{p.id}</strong> {p.observacoes ? `— Obs: ${p.observacoes}` : ""}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ) : (
                      <div style={{ marginTop: "10px", backgroundColor: "#f0f9ff", padding: "10px 14px", borderRadius: "8px", border: "1px solid #bae6fd" }}>
                        <strong style={{ fontSize: "13px", color: "#0369a1" }}>💊 Receituário Emitido:</strong>
                        <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#0284c7", fontStyle: "italic" }}>Nenhum receituário vinculado a este atendimento.</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: "#9ca3af", fontSize: "14px", fontStyle: "italic" }}>Nenhum atendimento registrado.</p>
            )}
          </div>

          {/* HISTÓRICO DE VACINAÇÃO */}
          <div>
            <h3 style={{ display: "flex", alignItems: "center", gap: "8px", color: "#1e1b4b", fontSize: "18px", marginBottom: "14px" }}>
              <MdVaccines color="#16a34a" /> Carteira de Vacinação ({prontuario.vacinas ? prontuario.vacinas.length : 0})
            </h3>

            {prontuario.vacinas && prontuario.vacinas.length > 0 ? (
              <div style={{ display: "grid", gap: "10px" }}>
                {prontuario.vacinas.map((v) => (
                  <div key={v.id} style={{ backgroundColor: "white", padding: "14px", borderRadius: "10px", border: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <strong style={{ color: "#16a34a", fontSize: "15px" }}>{v.nome_vacina}</strong> ({v.dose || "Dose Única"})
                    </div>
                    <div style={{ textAlign: "right", fontSize: "13px" }}>
                      <div><strong>Aplicação:</strong> {v.data_aplicacao ? new Date(v.data_aplicacao + "T00:00:00").toLocaleDateString("pt-BR") : "-"}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: "#9ca3af", fontSize: "14px", fontStyle: "italic" }}>Nenhum registro vacinal encontrado.</p>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}

export default Prontuarios;