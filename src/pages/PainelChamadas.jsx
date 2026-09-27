import os
import shutil
import time
import base64
from io import BytesIO
from pathlib import Path
from typing import List, Optional
from PIL import Image
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text
from database.database import get_db, SessionLocal
from models.consulta import Consulta
from models.animais import Animal
from models.usuario import Usuario  
from schemas.consulta import ConsultaUpdate
from services.security import obter_usuario_logado, exigir_perfil
from google import genai
from google.genai import types
from google.genai.errors import APIError
from groq import Groq
from openai import OpenAI
from dotenv import load_dotenv

router = APIRouter(
    prefix="/consultas",
    tags=["Consultas"]
)

UPLOADS_DIR = Path("uploads/exames")
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
client_openai = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None

def obter_config_ia_dinamica(provedor_desejado: str = "groq_1"):
    db = SessionLocal()
    try:
        if "groq" in provedor_desejado:
            chave_nome = "groq_api_key_2" if "2" in provedor_desejado else "groq_api_key_1"
            modelo_chave = "groq_model_2" if "2" in provedor_desejado else "groq_model_1"
            
            r_mod = db.execute(text("SELECT valor FROM configuracoes_sistema WHERE chave = :c"), {"c": modelo_chave}).fetchone()
            r_key = db.execute(text("SELECT valor FROM configuracoes_sistema WHERE chave = :c"), {"c": chave_nome}).fetchone()
            
            modelo = r_mod[0] if r_mod and r_mod[0] else ("qwen/qwen3.8-27b" if "2" in provedor_desejado else "openai/gpt-oss-120b")
            key_db = r_key[0] if r_key and r_key[0] and not str(r_key[0]).startswith("****") else None
            api_key = key_db or os.getenv("GROQ_API_KEY")
            
            client = Groq(api_key=api_key) if api_key else None
            return "groq", client, modelo
        else:
            r_mod = db.execute(text("SELECT valor FROM configuracoes_sistema WHERE chave = 'gemini_model'")).fetchone()
            r_key = db.execute(text("SELECT valor FROM configuracoes_sistema WHERE chave = 'gemini_api_key'")).fetchone()
            
            modelo = r_mod[0] if r_mod and r_mod[0] else "gemini-3.6-flash"
            key_db = r_key[0] if r_key and r_key[0] and not str(r_key[0]).startswith("****") else None
            api_key = key_db or os.getenv("GEMINI_API_KEY_PRIMARY") or os.getenv("GEMINI_API_KEY")
            
            return "gemini", api_key, modelo
    finally:
        db.close()

class ConsultaCreate(BaseModel):
    codigo: Optional[str] = None
    animal_id: int
    usuario_id: Optional[int] = None
    status: Optional[str] = "AGUARDANDO_TRIAGEM"
    queixa_principal: Optional[str] = "Check-in de rotina / Recepção"
    historico_clinico: Optional[str] = None
    sintomas: Optional[str] = None
    exame_fisico: Optional[str] = None
    suspeita_diagnostica: Optional[str] = None
    peso_atendimento: Optional[float] = None
    temperatura: Optional[float] = None
    frequencia_cardiaca: Optional[int] = None
    frequencia_respiratoria: Optional[int] = None
    parecer_copiloto: Optional[str] = None
    observacoes: Optional[str] = None
    indicacao_cirurgia: Optional[bool] = False
    justificativa_cirurgica: Optional[str] = None
    solicitar_exames_preventivos: Optional[bool] = False

class CopilotoRequest(BaseModel):
    animal_id: Optional[int] = None
    especie: Optional[str] = "Não informada"
    raca: Optional[str] = "SRD"
    idade: Optional[str] = None
    peso: Optional[str] = None
    queixa_principal: str
    sintomas: Optional[str] = None
    exame_fisico: Optional[str] = None
    temperatura: Optional[str] = None
    frequencia_cardiaca: Optional[int] = None
    frequencia_respiratoria: Optional[int] = None

class SugestaoAsaRequest(BaseModel):
    queixa_principal: str
    historico_clinico: Optional[str] = None
    exame_fisico: Optional[str] = None
    temperatura: Optional[float] = None
    frequencia_cardiaca: Optional[int] = None
    frequencia_respiratoria: Optional[int] = None

@router.post("/upload-anexo")
async def upload_anexo_exame(
    file: UploadFile = File(...),
    usuario_logado = Depends(obter_usuario_logado)
):
    try:
        caminho_arquivo = UPLOADS_DIR / f"{file.filename}"
        with open(caminho_arquivo, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        return {
            "mensagem": "Arquivo enviado com sucesso!",
            "nome_arquivo": file.filename,
            "caminho": str(caminho_arquivo)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao salvar arquivo: {str(e)}")

@router.put("/{consulta_id}/chamar")
def chamar_paciente_consulta(
    consulta_id: int,
    db: Session = Depends(get_db),
    usuario_logado = Depends(obter_usuario_logado)
):
    consulta_db = db.query(Consulta).filter(Consulta.id == consulta_id).first()
    if not consulta_db:
        raise HTTPException(status_code=404, detail="Consulta não encontrada.")
    
    consulta_db.status = "Chamando para Triagem"
    db.commit()
    db.refresh(consulta_db)
    return {"mensagem": "Paciente chamado com sucesso!", "status": consulta_db.status}

@router.get("/painel-chamadas")
def listar_chamadas_painel(db: Session = Depends(get_db)):
    consultas_ativas = db.query(Consulta).filter(
        Consulta.status.in_([
            "Aguardando Triagem (Recepção)",
            "Chamando para Triagem",
            "Em Triagem",
            "Aguardando Consulta (Fila Vet)",
            "Em Atendimento",
            "Aguardando Vacina",
            "Em Vacinação"
        ])
    ).order_by(
        Consulta.status.in_(["Chamando para Triagem", "Em Triagem", "Em Atendimento"]).desc(),
        Consulta.id.desc()
    ).limit(10).all()

    resultado = []
    for c in consultas_ativas:
        animal = db.query(Animal).filter(Animal.id == c.animal_id).first()
        veterinario = db.query(Usuario).filter(Usuario.id == c.usuario_id).first() if c.usuario_id else None
        
        nome_tutor = "-"
        if animal:
            if hasattr(animal, 'tutor') and animal.tutor:
                nome_tutor = animal.tutor.nome
            elif hasattr(animal, 'tutor_nome') and animal.tutor_nome:
                nome_tutor = animal.tutor_nome

        if c.status == "Chamando para Triagem":
            sala_atribuida = "Sala de Triagem"
            etapa = "📢 Chamando para Triagem"
        elif c.status == "Em Triagem":
            sala_atribuida = "Sala de Triagem"
            etapa = "🩺 Triagem"
        elif c.status == "Em Atendimento":
            sala_atribuida = f"Consultório {(c.id % 3) + 1}"
            etapa = "👨‍⚕️ Consulta Médica"
        else:
            sala_atribuida = "Aguardar Recepção"
            etapa = "⏳ Espera"

        resultado.append({
            "id": c.id,
            "codigo": c.codigo or f"CNS-{c.id:04d}",
            "pet": animal.nome if animal else "Paciente",
            "tutor": nome_tutor,
            "veterinario": veterinario.nome if veterinario else "Equipe Veterinária",
            "status": c.status,
            "etapa": etapa,
            "sala": sala_atribuida
        })

    return resultado

@router.get("/fila-triagem")
def listar_fila_triagem(
    db: Session = Depends(get_db),
    usuario_logado = Depends(obter_usuario_logado)
):
    consultas_aguardando = db.query(Consulta).filter(
        Consulta.status.in_([
            "AGUARDANDO_TRIAGEM",
            "Aguardando Triagem (Recepção)",
            "Aguardando Triagem",
            "Chamando para Triagem",
            "AGUARDANDO_VACINA",
            "Aguardando Vacina"
        ])
    ).order_by(Consulta.id.asc()).all()

    resultado = []
    for c in consultas_aguardando:
        animal = db.query(Animal).filter(Animal.id == c.animal_id).first()
        resultado.append({
            "id": c.id,
            "codigo": c.codigo or f"CNS-{c.id:04d}",
            "animal_id": c.animal_id,
            "pet": animal.nome if animal else "Paciente",
            "especie": animal.especie if animal else "-",
            "queixa_principal": c.queixa_principal,
            "peso_atendimento": c.peso_atendimento if hasattr(c, 'peso_atendimento') else getattr(c, 'peso', None),
            "temperatura": c.temperatura,
            "frequencia_cardiaca": c.frequencia_cardiaca,
            "frequencia_respiratoria": c.frequencia_respiratoria,
            "status": c.status
        })
    return resultado

@router.get("/")
def listar_consultas(
    usuario_logado: str = Depends(obter_usuario_logado),
    db: Session = Depends(get_db)
):
    return db.query(Consulta).order_by(Consulta.id.desc()).all()

@router.post("/")
def criar_consulta(
    consulta: ConsultaCreate,
    usuario_logado = Depends(exigir_perfil(["ADMIN", "VETERINARIO", "RECEPCAO"])),
    db: Session = Depends(get_db)
):
    animal = db.query(Animal).filter(Animal.id == consulta.animal_id).first()
    if not animal:
        raise HTTPException(status_code=404, detail="Paciente (Animal) não encontrado.")

    id_vet = consulta.usuario_id
    if not id_vet:
        usuario_padrao = db.query(Usuario).filter(Usuario.perfil.in_(["VETERINARIO", "ADMIN"])).first()
        if usuario_padrao:
            id_vet = usuario_padrao.id
        else:
            raise HTTPException(status_code=404, detail="Nenhum usuário/veterinário cadastrado.")

    nova_consulta = Consulta(
        codigo=consulta.codigo,
        usuario_id=id_vet,
        animal_id=consulta.animal_id,
        status=getattr(consulta, 'status', 'AGUARDANDO_TRIAGEM'),
        queixa_principal=consulta.queixa_principal or "Check-in de rotina / Recepção",
        historico_clinico=consulta.historico_clinico,
        sintomas=consulta.sintomas,
        exame_fisico=consulta.exame_fisico,
        suspeita_diagnostica=getattr(consulta, 'suspeita_diagnostica', None),
        peso_atendimento=consulta.peso_atendimento,
        temperatura=consulta.temperatura,
        frequencia_cardiaca=consulta.frequencia_cardiaca,
        frequencia_respiratoria=consulta.frequencia_respiratoria,
        parecer_copiloto=consulta.parecer_copiloto,
        observacoes=consulta.observacoes,
        indicacao_cirurgia=getattr(consulta, 'indicacao_cirurgia', False),
        justificativa_cirurgica=getattr(consulta, 'justificativa_cirurgica', None)
    )

    try:
        db.add(nova_consulta)
        db.flush()
        if not nova_consulta.codigo:
            nova_consulta.codigo = f"CNS-{nova_consulta.id:04d}"
        db.commit()
        db.refresh(nova_consulta)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao cadastrar consulta: {str(e)}")

    return nova_consulta

@router.get("/{consulta_id}")
def buscar_consulta(consulta_id: int, db: Session = Depends(get_db)):
    consulta = db.query(Consulta).filter(Consulta.id == consulta_id).first()
    if not consulta:
        raise HTTPException(status_code=404, detail="Consulta não encontrada.")
    return consulta

@router.put("/{consulta_id}")
def atualizar_consulta(
    consulta_id: int,
    consulta: ConsultaUpdate,
    usuario_logado = Depends(exigir_perfil(["ADMIN", "VETERINARIO", "RECEPCAO"])),
    db: Session = Depends(get_db)
):
    consulta_db = db.query(Consulta).filter(Consulta.id == consulta_id).first()
    if not consulta_db:
        raise HTTPException(status_code=404, detail="Consulta não encontrada.")

    if consulta.animal_id:
        consulta_db.animal_id = consulta.animal_id
    if consulta.usuario_id:
        consulta_db.usuario_id = consulta.usuario_id
    if consulta.codigo:
        consulta_db.codigo = consulta.codigo
    if hasattr(consulta, 'status') and consulta.status:
        consulta_db.status = consulta.status

    consulta_db.queixa_principal = consulta.queixa_principal or consulta_db.queixa_principal
    consulta_db.historico_clinico = consulta.historico_clinico
    consulta_db.sintomas = consulta.sintomas
    consulta_db.exame_fisico = consulta.exame_fisico
    if hasattr(consulta, 'suspeita_diagnostica'):
        consulta_db.suspeita_diagnostica = consulta.suspeita_diagnostica
    consulta_db.peso_atendimento = consulta.peso_atendimento
    consulta_db.temperatura = consulta.temperatura
    consulta_db.frequencia_cardiaca = consulta.frequencia_cardiaca
    consulta_db.frequencia_respiratoria = consulta.frequencia_respiratoria
    consulta_db.parecer_copiloto = consulta.parecer_copiloto or consulta_db.parecer_copiloto
    consulta_db.observacoes = consulta.observacoes
    
    if hasattr(consulta, 'indicacao_cirurgia'):
        consulta_db.indicacao_cirurgia = consulta.indicacao_cirurgia
    if hasattr(consulta, 'justificativa_cirurgica'):
        consulta_db.justificativa_cirurgica = consulta.justificativa_cirurgica

    db.commit()
    db.refresh(consulta_db)
    return consulta_db

@router.delete("/{consulta_id}")
def excluir_consulta(
    consulta_id: int,
    usuario_logado = Depends(exigir_perfil(["ADMIN", "VETERINARIO", "RECEPCAO"])),
    db: Session = Depends(get_db)
):
    consulta = db.query(Consulta).filter(Consulta.id == consulta_id).first()
    if not consulta:
        raise HTTPException(status_code=404, detail="Consulta não encontrada.")
    db.delete(consulta)
    db.commit()
    return {"mensagem": "Consulta excluída com sucesso."}