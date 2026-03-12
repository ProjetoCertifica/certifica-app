import React from "react";

interface Column<T> {
  key: string;
  header: string;
  width?: string;
  render?: (item: T) => React.ReactNode;
}

interface DSTableProps<T> {
  columns: Column<T>[];
  data: T[];
  caption?: string;
}

export function DSTable<T extends Record<string, unknown>>({ columns, data, caption }: DSTableProps<T>) {
  return (
    <div className="border border-certifica-200 rounded-[4px] overflow-hidden">
      {caption && (
        <div className="px-4 py-2.5 bg-certifica-50 border-b border-certifica-200">
          <span className="text-[11px] tracking-[0.06em] uppercase text-certifica-500" style={{ fontWeight: 600 }}>
            {caption}
          </span>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-certifica-50 border-b border-certifica-200">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-2.5 text-left text-[11px] tracking-[0.06em] uppercase text-certifica-500"
                  style={{ fontWeight: 600, width: col.width }}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => (
              <tr
                key={idx}
                className="border-b border-certifica-200 last:border-b-0 hover:bg-certifica-50/50 transition-colors"
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-2.5 text-[13px] text-certifica-dark" style={{ fontWeight: 400 }}>
                    {col.render ? col.render(row) : String(row[col.key] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
