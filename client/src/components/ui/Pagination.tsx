// ===== 通用分页组件 =====
// 支持切换每页条数（10/20/50），有数据时分页
import { useState } from 'react';

interface PaginationProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  keyOf: (item: T) => string | number;
  emptyText?: string;
  pageSizeOptions?: number[];
  defaultPageSize?: number;
  grid?: boolean;
  gridMinWidth?: number;
  gap?: number;
}

export default function Pagination<T>({
  items,
  renderItem,
  keyOf,
  emptyText = '暂无数据',
  pageSizeOptions = [10, 20, 50],
  defaultPageSize = 10,
  grid = false,
  gridMinWidth = 260,
  gap = 16,
}: PaginationProps<T>) {
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [page, setPage] = useState(1);

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);

  const showPagination = total > pageSizeOptions[0];
  const currentItems = showPagination ? items.slice((safePage - 1) * pageSize, safePage * pageSize) : items;

  const changePageSize = (size: number) => {
    setPageSize(size);
    setPage(1);
  };

  if (total === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)' }}>{emptyText}</div>
    );
  }

  const containerStyle = grid
    ? { display: 'grid', gridTemplateColumns: `repeat(auto-fill,minmax(${gridMinWidth}px,1fr))`, gap }
    : {};

  return (
    <div>
      <div style={containerStyle}>
        {currentItems.map((item, idx) => (
          <div key={keyOf(item)}>{renderItem(item, idx)}</div>
        ))}
      </div>

      {showPagination && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginTop: 16, flexWrap: 'wrap', gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-text-muted)' }}>
            每页
            <select
              value={pageSize}
              onChange={(e) => changePageSize(Number(e.target.value))}
              style={{
                padding: '5px 28px 5px 10px', borderRadius: 6, border: '1px solid var(--color-border)',
                fontSize: 13, background: 'var(--color-surface)', cursor: 'pointer', color: 'var(--color-text)',
              }}
            >
              {pageSizeOptions.map((n) => (
                <option key={n} value={n}>{n} 条</option>
              ))}
            </select>
            <span>共 {total} 条</span>
          </div>

          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <button
              onClick={() => setPage(safePage - 1)}
              disabled={safePage <= 1}
              style={{
                padding: '6px 12px', fontSize: 13, cursor: safePage > 1 ? 'pointer' : 'not-allowed',
                borderRadius: 6, border: '1px solid var(--color-border)',
                background: 'var(--color-surface)', opacity: safePage <= 1 ? 0.4 : 1,
              }}
            >上一页</button>
            <span style={{ fontSize: 13, color: 'var(--color-text-muted)', padding: '0 8px' }}>
              {safePage} / {totalPages}
            </span>
            <button
              onClick={() => setPage(safePage + 1)}
              disabled={safePage >= totalPages}
              style={{
                padding: '6px 12px', fontSize: 13, cursor: safePage < totalPages ? 'pointer' : 'not-allowed',
                borderRadius: 6, border: '1px solid var(--color-border)',
                background: 'var(--color-surface)', opacity: safePage >= totalPages ? 0.4 : 1,
              }}
            >下一页</button>
          </div>
        </div>
      )}
    </div>
  );
}