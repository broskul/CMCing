import OpenAI from 'openai';

let cachedClient = null;
const DEFAULT_MODEL = 'gpt-5-mini';
const MAX_NOTES_CHARACTERS = 6000;
const REQUEST_TIMEOUT_MS = 15000;

function getClient() {
  const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) {
    const error = new Error('La asistencia de notas todavía no está activa. Falta OPENAI_API_KEY en el servidor.');
    error.status = 503;
    throw error;
  }
  if (!cachedClient) cachedClient = new OpenAI({ apiKey });
  return cachedClient;
}

export function getOpenAINotesStatus() {
  return {
    configured: Boolean(String(process.env.OPENAI_API_KEY || '').trim()),
    model: process.env.OPENAI_NOTES_MODEL || DEFAULT_MODEL,
    maxCharacters: MAX_NOTES_CHARACTERS,
  };
}

export async function improveTechnicalNotes({ notes, activity }) {
  const cleanNotes = String(notes || '').trim();
  if (cleanNotes.length < 5) {
    const error = new Error('Escriba algunas notas técnicas antes de solicitar la mejora.');
    error.status = 400;
    throw error;
  }

  if (cleanNotes.length > MAX_NOTES_CHARACTERS) {
    const error = new Error(`Las notas superan el máximo de ${MAX_NOTES_CHARACTERS} caracteres.`);
    error.status = 413;
    throw error;
  }

  const response = await getClient().responses.create({
    model: process.env.OPENAI_NOTES_MODEL || DEFAULT_MODEL,
    reasoning: { effort: 'low' },
    store: false,
    max_output_tokens: 1200,
    instructions: [
      'Eres un asistente de redacción para servicio técnico de equipos médicos.',
      'Reescribe las notas en español profesional, claro, preciso y auditable.',
      'No inventes mediciones, diagnósticos, repuestos, fechas ni conclusiones.',
      'Conserva todos los hechos y advertencias presentes en el texto original.',
      'Devuelve únicamente la versión mejorada de las notas, sin introducciones ni comentarios.',
    ].join(' '),
    input: [
      `OT: ${String(activity?.ordenTrabajo?.codigo || '-').slice(0, 80)}`,
      `Actividad: ${String(activity?.titulo || '-').slice(0, 200)}`,
      `Descripción breve: ${String(activity?.descripcionBreve || '-').slice(0, 800)}`,
      '',
      'Notas originales:',
      cleanNotes,
    ].join('\n'),
  }, { timeout: REQUEST_TIMEOUT_MS });

  const text = String(response.output_text || '').trim();
  if (!text) throw new Error('OpenAI no devolvió una propuesta de notas.');
  return { text, responseId: response.id };
}
