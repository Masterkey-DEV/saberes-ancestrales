import type { APIRoute } from 'astro';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { Client } from '@notionhq/client';
import { Resend } from 'resend';
import { DATABASE_ID } from '../../lib/notion';

export const prerender = false;

const CATEGORIES = new Set([
  'oralidad',
  'musica',
  'medicina',
  'tejido',
  'cocina',
  'territorio',
  'otro',
]);

const DEPARTMENTS = new Set([
  'Chocó',
  'Valle del Cauca',
  'Cauca',
  'Nariño',
  'Otro territorio',
]);

const ALLOWED_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'webp', 'gif',
  'pdf', 'mp3', 'wav', 'ogg', 'm4a',
  'mp4', 'mov', 'webm',
]);

const MAX_FILES = 8;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_BYTES = 4 * 1024 * 1024;

type FieldErrors = Record<string, string>;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function textValue(form: FormData, field: string) {
  const value = form.get(field);
  return typeof value === 'string' ? value.replace(/\r\n/g, '\n').trim() : '';
}

function extensionOf(filename: string) {
  return path.extname(filename).toLowerCase().replace(/^\./, '');
}

function safeStem(filename: string, fallback: string) {
  const stem = path
    .basename(filename, path.extname(filename))
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return stem || fallback;
}

function formatBytes(bytes: number) {
  return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const contentType = request.headers.get('content-type') ?? '';
    if (!contentType.includes('multipart/form-data')) {
      return json({ ok: false, message: 'El formulario debe enviarse como multipart/form-data.' }, 415);
    }

    const form = await request.formData();

    // Campo trampa honeypot
    if (textValue(form, 'sitio_web')) {
      return json({ ok: false, message: 'No pudimos procesar el envío.' }, 400);
    }

    const nombre       = textValue(form, 'nombre');
    const comunidad    = textValue(form, 'comunidad');
    const departamento = textValue(form, 'departamento');
    const municipio    = textValue(form, 'municipio');
    const correo       = textValue(form, 'correo');
    const titulo       = textValue(form, 'titulo');
    const categoria    = textValue(form, 'categoria');
    const descripcion  = textValue(form, 'descripcion');
    const origen       = textValue(form, 'origen');
    const idioma       = textValue(form, 'idioma');
    const transmision  = textValue(form, 'transmision');
    const enlace       = textValue(form, 'enlace');
    const autoriza     = textValue(form, 'autoriza');
    const contacto     = textValue(form, 'contacto');

    const errors: FieldErrors = {};

    if (nombre.length < 2)   errors.nombre = 'Escribe al menos 2 caracteres.';
    if (nombre.length > 80)  errors.nombre = 'El nombre no puede superar 80 caracteres.';
    if (comunidad.length < 2)   errors.comunidad = 'Cuéntanos a qué comunidad perteneces.';
    if (comunidad.length > 140) errors.comunidad = 'La comunidad no puede superar 140 caracteres.';
    if (!DEPARTMENTS.has(departamento)) errors.departamento = 'Selecciona un departamento.';
    if (municipio.length < 2)   errors.municipio = 'Escribe tu municipio o distrito.';
    if (municipio.length > 120) errors.municipio = 'El municipio no puede superar 120 caracteres.';
    if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(correo)) {
      errors.correo = 'Revisa el formato del correo electrónico.';
    }
    if (correo.length > 180) errors.correo = 'El correo no puede superar 180 caracteres.';
    if (titulo.length < 3)   errors.titulo = 'Dale un nombre de al menos 3 caracteres.';
    if (titulo.length > 140) errors.titulo = 'El título no puede superar 140 caracteres.';
    if (!CATEGORIES.has(categoria)) errors.categoria = 'Selecciona una categoría.';
    if (descripcion.length < 20)   errors.descripcion = 'Cuéntanos un poco más: al menos 20 caracteres.';
    if (descripcion.length > 3000) errors.descripcion = 'La descripción no puede superar 3.000 caracteres.';
    if (origen.length > 160)     errors.origen = 'Este campo no puede superar 160 caracteres.';
    if (idioma.length > 100)     errors.idioma = 'Este campo no puede superar 100 caracteres.';
    if (transmision.length > 1500) errors.transmision = 'Este campo no puede superar 1.500 caracteres.';
    if (enlace) {
      try {
        const url = new URL(enlace);
        if (!['http:', 'https:'].includes(url.protocol)) {
          errors.enlace = 'El enlace debe comenzar por http:// o https://.';
        }
      } catch {
        errors.enlace = 'Escribe un enlace válido.';
      }
    }
    if (enlace.length > 500) errors.enlace = 'El enlace no puede superar 500 caracteres.';
    if (autoriza !== 'si') errors.autoriza = 'Necesitamos tu autorización para guardar el saber.';

    const rawFiles = form.getAll('archivos');
    const files = rawFiles.filter((e): e is File => e instanceof File && e.size > 0);

    if (files.length > MAX_FILES) {
      errors.archivos = `Puedes adjuntar un máximo de ${MAX_FILES} archivos.`;
    }

    let totalBytes = 0;
    const fileMetadata: Array<{ nombreOriginal: string; nombreGuardado: string; tipo: string; tamano: number }> = [];

    for (const [index, file] of files.entries()) {
      const extension = extensionOf(file.name);
      if (!ALLOWED_EXTENSIONS.has(extension)) {
        errors.archivos = `El archivo "${file.name}" no tiene un formato permitido.`;
        break;
      }
      if (file.size > MAX_FILE_BYTES) {
        errors.archivos = `El archivo "${file.name}" supera los 10 MB.`;
        break;
      }
      totalBytes += file.size;
      if (totalBytes > MAX_TOTAL_BYTES) {
        errors.archivos = `Los archivos superan el máximo total de ${formatBytes(MAX_TOTAL_BYTES)}.`;
        break;
      }
      const storedName = `${String(index + 1).padStart(2, '0')}-${safeStem(file.name, 'archivo')}.${extension}`;
      fileMetadata.push({
        nombreOriginal: path.basename(file.name).slice(0, 200),
        nombreGuardado: storedName,
        tipo: file.type.slice(0, 120),
        tamano: file.size,
      });
    }

    if (Object.keys(errors).length > 0) {
      return json({ ok: false, message: 'Revisa los campos señalados e intenta de nuevo.', errors }, 422);
    }

    const id        = randomUUID();
    const year      = new Date().getFullYear();
    const ticket    = `SP-${year}-${id.slice(0, 6).toUpperCase()}`;
    const createdAt = new Date().toISOString();

    // ── 1. Guardar en Notion ─────────────────────────────────────────────────
    const notionSecret = import.meta.env.NOTION_SECRET;
    if (!notionSecret) {
      console.error('[saberes] Falta NOTION_SECRET');
      return json({ ok: false, message: 'Error de configuración del servidor.' }, 500);
    }

    const notion = new Client({ auth: notionSecret });

    await notion.pages.create({
      parent: { database_id: DATABASE_ID },
      properties: {
        'Título':            { title:    [{ text: { content: titulo } }] },
        'Estado':            { select:   { name: 'Pendiente' } },
        'Ticket':            { rich_text: [{ text: { content: ticket } }] },
        'Nombre':            { rich_text: [{ text: { content: nombre } }] },
        'Comunidad':         { rich_text: [{ text: { content: comunidad } }] },
        'Departamento':      { select:   { name: departamento } },
        'Municipio':         { rich_text: [{ text: { content: municipio } }] },
        'Correo':            { email:    correo || null },
        'Categoría':         { select:   { name: categoria } },
        'Descripción':       { rich_text: [{ text: { content: descripcion.slice(0, 2000) } }] },
        'Origen':            { rich_text: [{ text: { content: origen } }] },
        'Idioma':            { rich_text: [{ text: { content: idioma } }] },
        'Transmisión':       { rich_text: [{ text: { content: transmision.slice(0, 2000) } }] },
        'Enlace':            { url:      enlace || null },
        'Autoriza contacto': { checkbox: contacto === 'si' },
        'Creado en':         { date:     { start: createdAt } },
        'ID':                { rich_text: [{ text: { content: id } }] },
      },
      // La descripción completa también va como bloque de contenido
      children: [
        {
          object: 'block',
          type: 'heading_2',
          heading_2: { rich_text: [{ text: { content: 'Descripción completa' } }] },
        },
        {
          object: 'block',
          type: 'paragraph',
          paragraph: { rich_text: [{ text: { content: descripcion } }] },
        },
        ...(transmision ? [
          {
            object: 'block' as const,
            type: 'heading_2' as const,
            heading_2: { rich_text: [{ text: { content: 'Transmisión' } }] },
          },
          {
            object: 'block' as const,
            type: 'paragraph' as const,
            paragraph: { rich_text: [{ text: { content: transmision } }] },
          },
        ] : []),
        ...(fileMetadata.length > 0 ? [
          {
            object: 'block' as const,
            type: 'heading_2' as const,
            heading_2: { rich_text: [{ text: { content: 'Archivos adjuntos' } }] },
          },
          {
            object: 'block' as const,
            type: 'bulleted_list_item' as const,
            bulleted_list_item: {
              rich_text: [{
                text: {
                  content: fileMetadata
                    .map((f) => `${f.nombreOriginal} (${formatBytes(f.tamano)})`)
                    .join('\n'),
                },
              }],
            },
          },
        ] : []),
      ],
    });

    // ── 2. Email de aviso (con archivos adjuntos si los hay) ─────────────────
    const resendApiKey = import.meta.env.RESEND_API_KEY;
    const toEmail      = import.meta.env.SABERES_EMAIL_TO;

    if (resendApiKey && toEmail) {
      const resend = new Resend(resendApiKey);
      const attachments: Array<{ filename: string; content: Buffer }> = [];

      for (const [index, file] of files.entries()) {
        const metadata = fileMetadata[index];
        attachments.push({
          filename: metadata.nombreGuardado,
          content: Buffer.from(await file.arrayBuffer()),
        });
      }

      await resend.emails.send({
        from: 'Saberes del Pacífico <onboarding@resend.dev>',
        to: [toEmail],
        subject: `[${ticket}] Nuevo saber pendiente: ${titulo} — ${nombre}`,
        html: `
          <p>Llega un nuevo saber para revisar en Notion.</p>
          <table style="font-family:sans-serif;font-size:14px;border-collapse:collapse;">
            <tr><td style="padding:4px 12px;color:#666;">Ticket</td><td><strong>${ticket}</strong></td></tr>
            <tr><td style="padding:4px 12px;color:#666;">Título</td><td>${titulo}</td></tr>
            <tr><td style="padding:4px 12px;color:#666;">Categoría</td><td>${categoria}</td></tr>
            <tr><td style="padding:4px 12px;color:#666;">Persona</td><td>${nombre} · ${comunidad}</td></tr>
            <tr><td style="padding:4px 12px;color:#666;">Territorio</td><td>${municipio}, ${departamento}</td></tr>
            <tr><td style="padding:4px 12px;color:#666;">Archivos</td><td>${fileMetadata.length > 0 ? fileMetadata.map((f) => f.nombreOriginal).join(', ') : 'Sin archivos'}</td></tr>
          </table>
          <p style="margin-top:16px;">
            <a href="https://notion.so" style="background:#c8a84b;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-family:sans-serif;">
              Revisar en Notion →
            </a>
          </p>
        `,
        attachments,
      }).catch((err) => console.warn('[saberes] Email de aviso falló (no crítico):', err));
    }

    return json(
      {
        ok: true,
        ticket,
        message: 'Tu saber fue registrado para revisión. Gracias por ayudar a sostener esta memoria.',
      },
      201
    );
  } catch (error) {
    console.error('[saberes] No se pudo procesar el envío:', error);
    return json(
      { ok: false, message: 'No pudimos guardar tu saber en este momento. Intenta de nuevo en unos minutos.' },
      500
    );
  }
};

export const GET: APIRoute = () =>
  json({ ok: false, message: 'Este endpoint solo acepta envíos por POST.' }, 405);
