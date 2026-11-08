import React from 'react';
import { Plus, Trash2, ArrowLeft, ArrowRight, ArrowUp, ArrowDown } from 'lucide-react';
import { TableBlock } from '../../lib/lectureNotes/types';

interface VisualTableEditorProps {
  block: TableBlock;
  onChange: (updatedBlock: TableBlock) => void;
  onDelete?: () => void;
  readOnly?: boolean;
}

export const VisualTableEditor: React.FC<VisualTableEditorProps> = ({
  block,
  onChange,
  onDelete,
  readOnly = false
}) => {
  const headers = block.headers || ['Header 1', 'Header 2'];
  const rows = block.rows || [['Cell 1', 'Cell 2']];

  const handleHeaderChange = (colIdx: number, val: string) => {
    const newHeaders = [...headers];
    newHeaders[colIdx] = val;
    onChange({ ...block, headers: newHeaders });
  };

  const handleCellChange = (rowIdx: number, colIdx: number, val: string) => {
    const newRows = rows.map((r, rI) => {
      if (rI !== rowIdx) return r;
      const newR = [...r];
      newR[colIdx] = val;
      return newR;
    });
    onChange({ ...block, rows: newRows });
  };

  const addColumn = () => {
    const newHeaders = [...headers, `Column ${headers.length + 1}`];
    const newRows = rows.map(r => [...r, '']);
    onChange({ ...block, headers: newHeaders, rows: newRows });
  };

  const deleteColumn = (colIdx: number) => {
    if (headers.length <= 1) return;
    const newHeaders = headers.filter((_, idx) => idx !== colIdx);
    const newRows = rows.map(r => r.filter((_, idx) => idx !== colIdx));
    onChange({ ...block, headers: newHeaders, rows: newRows });
  };

  const addRow = () => {
    const emptyRow = headers.map(() => '');
    onChange({ ...block, rows: [...rows, emptyRow] });
  };

  const deleteRow = (rowIdx: number) => {
    if (rows.length <= 1) return;
    const newRows = rows.filter((_, idx) => idx !== rowIdx);
    onChange({ ...block, rows: newRows });
  };

  return (
    <div className="my-4 rounded-2xl border border-slate-700/60 bg-slate-950/60 p-4 space-y-3">
      {/* Table Controls Top */}
      {!readOnly && (
        <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-300">Table</span>
            <span className="text-[11px] text-slate-500">
              {rows.length} rows × {headers.length} columns
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={addColumn}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors flex items-center gap-1 cursor-pointer text-[11px]"
            >
              <Plus className="w-3 h-3" />
              <span>Add Column</span>
            </button>
            <button
              type="button"
              onClick={addRow}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors flex items-center gap-1 cursor-pointer text-[11px]"
            >
              <Plus className="w-3 h-3" />
              <span>Add Row</span>
            </button>
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="p-1 rounded-lg text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                title="Remove Table"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Responsive Table Scroll Container */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-slate-900 border-b border-slate-700">
              {headers.map((h, colIdx) => (
                <th key={colIdx} className="p-2 text-left relative group font-bold text-slate-200">
                  {readOnly ? (
                    <span>{h}</span>
                  ) : (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={h}
                        onChange={e => handleHeaderChange(colIdx, e.target.value)}
                        placeholder={`Header ${colIdx + 1}`}
                        className="w-full bg-transparent border-b border-transparent focus:border-indigo-500 focus:outline-none text-slate-100 font-bold px-1 py-0.5"
                      />
                      {headers.length > 1 && (
                        <button
                          type="button"
                          onClick={() => deleteColumn(colIdx)}
                          className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-500 hover:text-rose-400 transition-opacity cursor-pointer"
                          title="Delete column"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => (
              <tr 
                key={rowIdx} 
                className={`border-b border-slate-800/80 group ${
                  rowIdx % 2 === 0 ? 'bg-slate-950/40' : 'bg-slate-900/30'
                }`}
              >
                {row.map((cell, colIdx) => (
                  <td key={colIdx} className="p-2 border-r border-slate-800/50 last:border-r-0">
                    {readOnly ? (
                      <span className="text-slate-300">{cell}</span>
                    ) : (
                      <input
                        type="text"
                        value={cell}
                        onChange={e => handleCellChange(rowIdx, colIdx, e.target.value)}
                        placeholder="Cell..."
                        className="w-full bg-transparent focus:outline-none focus:bg-slate-800/50 rounded px-1.5 py-1 text-slate-200 transition-colors"
                      />
                    )}
                  </td>
                ))}
                {!readOnly && rows.length > 1 && (
                  <td className="w-8 p-1 text-center">
                    <button
                      type="button"
                      onClick={() => deleteRow(rowIdx)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 transition-opacity cursor-pointer"
                      title="Delete row"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
