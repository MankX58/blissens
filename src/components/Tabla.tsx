import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Download, Search } from 'lucide-react';
import * as XLSX from 'xlsx';
import type { Fila } from '../lib/expediente';
import { btnChico } from './ui';

const POR_PAGINA = 10;
const formato = (k: string, v: string | number) =>
  typeof v === 'number' ? (/valor/i.test(k) ? '$' + v.toLocaleString('es-CO') : v.toLocaleString('es-CO')) : v || '—';

export function descargarHojas(hojas: { nombre: string; filas: Fila[] }[], archivo: string) {
  const libro = XLSX.utils.book_new();
  for (const h of hojas) XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(h.filas.length ? h.filas : [{ '': 'Sin datos' }]), h.nombre.slice(0, 31));
  XLSX.writeFile(libro, archivo);
}

// Vista tipo hoja de cálculo: buscar, ordenar por columna, paginar y descargar lo mismo que se ve
export function Tabla({ nombre, filas, archivo }: { nombre: string; filas: Fila[]; archivo: string }) {
  const [q, setQ] = useState('');
  const [orden, setOrden] = useState<{ k: string; asc: boolean } | null>(null);
  const [pagina, setPagina] = useState(0);
  const cols = filas[0] ? Object.keys(filas[0]) : [];

  const vistas = useMemo(() => {
    const t = q.trim().toLowerCase();
    const f = t ? filas.filter((r) => Object.values(r).some((v) => String(v).toLowerCase().includes(t))) : filas;
    if (!orden) return f;
    return [...f].sort((a, b) => {
      const x = a[orden.k];
      const y = b[orden.k];
      const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'es');
      return orden.asc ? c : -c;
    });
  }, [filas, q, orden]);

  const paginas = Math.max(1, Math.ceil(vistas.length / POR_PAGINA));
  const pag = Math.min(pagina, paginas - 1);
  const visibles = vistas.slice(pag * POR_PAGINA, pag * POR_PAGINA + POR_PAGINA);

  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative sm:w-72">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPagina(0);
            }}
            placeholder={`Buscar en ${nombre.toLowerCase()}`}
            className="field rounded-full py-2 pl-10"
          />
        </label>
        <div className="flex items-center gap-3 text-xs text-muted">
          <span className="num">{vistas.length} filas</span>
          <button onClick={() => descargarHojas([{ nombre, filas: vistas }], archivo)} className={`${btnChico} bg-ink text-white hover:bg-ink-2`}>
            <Download className="size-3.5" /> Descargar esta tabla
          </button>
        </div>
      </div>

      <div className="mt-3 overflow-x-auto rounded-2xl border border-line">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-soft/80">
            <tr>
              {cols.map((k) => (
                <th key={k} className="whitespace-nowrap px-4 py-2.5">
                  <button
                    onClick={() => setOrden((o) => (o?.k === k ? { k, asc: !o.asc } : { k, asc: true }))}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[.12em] text-muted hover:text-ink"
                  >
                    {k}
                    {orden?.k === k && (orden.asc ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody key={pag + q + (orden?.k ?? '') + orden?.asc} className="escalonado divide-y divide-line bg-white">
            {visibles.map((r, i) => (
              <tr key={i} className="hover:bg-soft/50">
                {cols.map((k) => (
                  <td key={k} className={`max-w-[260px] truncate whitespace-nowrap px-4 py-2.5 ${typeof r[k] === 'number' ? 'num text-right' : ''}`} title={String(r[k])}>
                    {formato(k, r[k])}
                  </td>
                ))}
              </tr>
            ))}
            {visibles.length === 0 && (
              <tr>
                <td colSpan={cols.length || 1} className="px-4 py-10 text-center text-muted">
                  Sin filas para mostrar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {paginas > 1 && (
        <div className="mt-3 flex items-center justify-end gap-2 text-xs text-muted">
          <span className="num">
            Página {pag + 1} de {paginas}
          </span>
          <button disabled={pag === 0} onClick={() => setPagina(pag - 1)} className="grid size-8 place-items-center rounded-full bg-white ring-1 ring-line disabled:opacity-40" aria-label="Página anterior">
            <ChevronLeft className="size-4" />
          </button>
          <button disabled={pag >= paginas - 1} onClick={() => setPagina(pag + 1)} className="grid size-8 place-items-center rounded-full bg-white ring-1 ring-line disabled:opacity-40" aria-label="Página siguiente">
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}
