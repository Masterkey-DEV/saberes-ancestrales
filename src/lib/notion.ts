import { Client } from '@notionhq/client';
import type {
  PageObjectResponse,
  RichTextItemResponse,
} from '@notionhq/client/build/src/api-endpoints';

export const DATABASE_ID = '41ed7719b99180bfb67ff9cb90776e15';

export function getNotionClient() {
  const auth = import.meta.env.NOTION_SECRET;
  if (!auth) throw new Error('Falta la variable de entorno NOTION_SECRET');
  return new Client({ auth });
}

// ── Helpers para leer propiedades de Notion ──────────────────────────────────

function richText(prop: unknown): string {
  if (!prop || typeof prop !== 'object') return '';
  const p = prop as { type?: string; rich_text?: RichTextItemResponse[] };
  if (p.type === 'rich_text' && Array.isArray(p.rich_text)) {
    return p.rich_text.map((r) => r.plain_text).join('');
  }
  return '';
}

function titleText(prop: unknown): string {
  if (!prop || typeof prop !== 'object') return '';
  const p = prop as { type?: string; title?: RichTextItemResponse[] };
  if (p.type === 'title' && Array.isArray(p.title)) {
    return p.title.map((r) => r.plain_text).join('');
  }
  return '';
}

function selectValue(prop: unknown): string {
  if (!prop || typeof prop !== 'object') return '';
  const p = prop as { type?: string; select?: { name: string } | null };
  return p.type === 'select' ? (p.select?.name ?? '') : '';
}

function emailValue(prop: unknown): string {
  if (!prop || typeof prop !== 'object') return '';
  const p = prop as { type?: string; email?: string | null };
  return p.type === 'email' ? (p.email ?? '') : '';
}

function urlValue(prop: unknown): string {
  if (!prop || typeof prop !== 'object') return '';
  const p = prop as { type?: string; url?: string | null };
  return p.type === 'url' ? (p.url ?? '') : '';
}

function checkboxValue(prop: unknown): boolean {
  if (!prop || typeof prop !== 'object') return false;
  const p = prop as { type?: string; checkbox?: boolean };
  return p.type === 'checkbox' ? (p.checkbox ?? false) : false;
}

function dateValue(prop: unknown): string {
  if (!prop || typeof prop !== 'object') return '';
  const p = prop as { type?: string; date?: { start: string } | null };
  return p.type === 'date' ? (p.date?.start ?? '') : '';
}

// ── Tipo público de un Saber ─────────────────────────────────────────────────

export interface Saber {
  id: string;
  titulo: string;
  ticket: string;
  nombre: string;
  comunidad: string;
  departamento: string;
  municipio: string;
  correo: string;
  categoria: string;
  descripcion: string;
  origen: string;
  idioma: string;
  transmision: string;
  enlace: string;
  autorizaContacto: boolean;
  creadoEn: string;
  estado: string;
}

export function pageToSaber(page: PageObjectResponse): Saber {
  const p = page.properties;
  return {
    id: page.id,
    titulo: titleText(p['Título']),
    ticket: richText(p['Ticket']),
    nombre: richText(p['Nombre']),
    comunidad: richText(p['Comunidad']),
    departamento: selectValue(p['Departamento']),
    municipio: richText(p['Municipio']),
    correo: emailValue(p['Correo']),
    categoria: selectValue(p['Categoría']),
    descripcion: richText(p['Descripción']),
    origen: richText(p['Origen']),
    idioma: richText(p['Idioma']),
    transmision: richText(p['Transmisión']),
    enlace: urlValue(p['Enlace']),
    autorizaContacto: checkboxValue(p['Autoriza contacto']),
    creadoEn: dateValue(p['Creado en']),
    estado: selectValue(p['Estado']),
  };
}

// ── Queries ──────────────────────────────────────────────────────────────────

export async function getSaberesPublicados(): Promise<Saber[]> {
  const notion = getNotionClient();
  const response = await notion.databases.query({
    database_id: DATABASE_ID,
    filter: {
      property: 'Estado',
      select: { equals: 'Publicado' },
    },
    sorts: [{ property: 'Creado en', direction: 'descending' }],
  });

  return response.results
    .filter((p): p is PageObjectResponse => p.object === 'page' && 'properties' in p)
    .map(pageToSaber);
}

export async function getSaberById(id: string): Promise<Saber | null> {
  try {
    const notion = getNotionClient();
    const page = await notion.pages.retrieve({ page_id: id });
    if (page.object !== 'page' || !('properties' in page)) return null;
    const saber = pageToSaber(page as PageObjectResponse);
    if (saber.estado !== 'Publicado') return null;
    return saber;
  } catch {
    return null;
  }
}

// ── Mapa de categorías ───────────────────────────────────────────────────────

export const CATEGORIA_LABELS: Record<string, string> = {
  oralidad: 'Oralidad',
  musica: 'Música',
  medicina: 'Medicina',
  tejido: 'Tejido',
  cocina: 'Cocina',
  territorio: 'Territorio',
  otro: 'Otro saber',
};
