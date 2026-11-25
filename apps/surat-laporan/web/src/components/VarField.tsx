'use client';

import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { VarDef, VarValue } from '@/lib/types';

// Satu isian formulir sesuai tipe variabel template.
export default function VarField({
  def,
  value,
  onChange,
  disabled,
  highlight,
}: {
  def: VarDef;
  value: VarValue | undefined;
  onChange: (v: VarValue) => void;
  disabled?: boolean;
  highlight?: boolean;
}) {
  const id = `var-${def.key}`;
  const str = typeof value === 'string' ? value : '';
  const empty = def.required && (Array.isArray(value) ? value.length === 0 : !str.trim());

  let field: React.ReactNode;
  switch (def.type) {
    case 'textarea':
      field = <textarea id={id} className="input" rows={4} value={str} disabled={disabled} onChange={(e) => onChange(e.target.value)} />;
      break;
    case 'number':
      field = <input id={id} className="input" type="number" value={str} disabled={disabled} onChange={(e) => onChange(e.target.value)} />;
      break;
    case 'date':
      field = <input id={id} className="input" type="date" value={str} disabled={disabled} onChange={(e) => onChange(e.target.value)} />;
      break;
    case 'time':
      field = <input id={id} className="input" type="time" value={str} disabled={disabled} onChange={(e) => onChange(e.target.value)} />;
      break;
    case 'select':
      field = (
        <select id={id} className="input" value={str} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
          <option value="">— pilih —</option>
          {(def.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
          {str && !(def.options ?? []).includes(str) && <option value={str}>{str}</option>}
        </select>
      );
      break;
    case 'list': {
      const items = Array.isArray(value) ? (value as string[]) : str ? str.split('\n') : [];
      field = (
        <textarea
          id={id}
          className="input font-mono text-[13px]"
          rows={Math.min(Math.max(items.length + 1, 3), 10)}
          value={items.join('\n')}
          disabled={disabled}
          placeholder="Satu butir per baris"
          onChange={(e) => onChange(e.target.value.split('\n'))}
        />
      );
      break;
    }
    case 'tabel':
      field = <TableField def={def} value={value} onChange={onChange} disabled={disabled} />;
      break;
    default:
      field = <input id={id} className="input" value={str} disabled={disabled} onChange={(e) => onChange(e.target.value)} />;
  }

  return (
    <div className={`rounded-lg transition-colors ${highlight ? 'bg-teal-50 ring-2 ring-teal-400/60 -mx-1.5 px-1.5 py-1' : ''}`}>
      <label htmlFor={id} className="label flex items-center gap-1">
        {def.label}
        {def.required && <span className="text-rose-600">*</span>}
        {empty && <span className="ml-auto text-[10px] font-medium text-amber-700">wajib diisi</span>}
      </label>
      {field}
      {def.hint && <p className="text-[11px] text-slate-500 mt-1">{def.hint}</p>}
    </div>
  );
}

function TableField({
  def,
  value,
  onChange,
  disabled,
}: {
  def: VarDef;
  value: VarValue | undefined;
  onChange: (v: VarValue) => void;
  disabled?: boolean;
}) {
  const cols = def.columns ?? [];
  const rows = (Array.isArray(value) ? value : []) as string[][];
  const set = (r: number, c: number, v: string) => {
    const next = rows.map((row) => [...row]);
    while (next.length <= r) next.push(cols.map(() => ''));
    next[r][c] = v;
    onChange(next);
  };
  const shown = rows.length ? rows : [cols.map(() => '')];

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-1.5 py-1 w-6">#</th>
              {cols.map((c) => (
                <th key={c} className="px-1.5 py-1 text-left font-semibold min-w-[80px]">
                  {c}
                </th>
              ))}
              <th className="w-7" />
            </tr>
          </thead>
          <tbody>
            {shown.map((row, r) => (
              <tr key={r} className="border-t border-slate-100">
                <td className="px-1.5 text-center text-slate-400">{r + 1}</td>
                {cols.map((_, c) => (
                  <td key={c} className="p-0.5">
                    <input
                      className="w-full h-7 px-1.5 rounded border border-transparent hover:border-slate-200 focus:border-teal-500 focus:outline-none text-xs"
                      value={row[c] ?? ''}
                      disabled={disabled}
                      onChange={(e) => set(r, c, e.target.value)}
                    />
                  </td>
                ))}
                <td className="text-center">
                  {!disabled && rows.length > 0 && (
                    <button className="p-1 text-slate-400 hover:text-rose-600" onClick={() => onChange(rows.filter((_, i) => i !== r))} title="Hapus baris">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!disabled && (
        <button
          className="w-full flex items-center justify-center gap-1 py-1.5 text-xs font-medium text-teal-700 bg-slate-50 hover:bg-teal-50 border-t border-slate-200"
          onClick={() => onChange([...(rows.length ? rows : [cols.map(() => '')]), cols.map(() => '')])}
        >
          <Plus className="w-3.5 h-3.5" /> Tambah baris
        </button>
      )}
    </div>
  );
}
