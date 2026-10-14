import type { ComponentType } from 'react';
import CronTool from './CronTool';
import EncodeTool from './EncodeTool';
import JsonTool from './JsonTool';
import JwtTool from './JwtTool';
import RegexTool from './RegexTool';
import TimestampTool from './TimestampTool';
import UuidTool from './UuidTool';

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  /** Short monospace glyph shown in the sidebar. */
  glyph: string;
  component: ComponentType;
}

export const TOOLS = [
  { id: 'json', name: 'JSON', description: 'Format, validate, minify and diff JSON documents.', glyph: '{ }', component: JsonTool },
  { id: 'jwt', name: 'JWT Decoder', description: 'Decode JSON Web Tokens and inspect their claims and expiry.', glyph: 'jwt', component: JwtTool },
  { id: 'encode', name: 'URL / Base64', description: 'Encode and decode URL components and Base64 (UTF-8 safe).', glyph: '%20', component: EncodeTool },
  { id: 'regex', name: 'Regex Tester', description: 'Test JavaScript regular expressions with live highlighting and groups.', glyph: '.*', component: RegexTool },
  { id: 'timestamp', name: 'Timestamp', description: 'Convert between Unix timestamps, ISO 8601 and time zones.', glyph: 'ts', component: TimestampTool },
  { id: 'uuid', name: 'UUID', description: 'Generate v4 / v7 UUIDs in bulk and inspect existing ones.', glyph: 'id', component: UuidTool },
  { id: 'cron', name: 'Cron Helper', description: 'Explain cron expressions in plain English and preview upcoming runs.', glyph: '*/5', component: CronTool },
] as const satisfies readonly ToolDefinition[];

export type ToolId = (typeof TOOLS)[number]['id'];
