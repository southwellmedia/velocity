/**
 * Table Component (React)
 * A styled data table with hover rows and responsive design.
 */
import { isValidElement, type HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

interface Column {
  key: string;
  label: string;
  align?: 'left' | 'center' | 'right';
  class?: string;
  /** This column names each row (rendered as <th scope="row">) */
  rowHeader?: boolean;
}

interface TableProps extends HTMLAttributes<HTMLDivElement> {
  columns: Column[];
  /** Each value is text, a number or a React element */
  rows: Record<string, unknown>[];
  /** Names the table for screen readers */
  caption?: string;
  /** Enable row hover highlighting */
  hoverable?: boolean;
  /** Enable row striping */
  striped?: boolean;
  /** Make table compact */
  compact?: boolean;
}

const alignClasses = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

export function Table({
  columns,
  rows,
  hoverable = true,
  striped = false,
  compact = false,
  caption,
  className,
  ...attrs
}: TableProps) {
  const cellPadding = compact ? 'px-3 py-2' : 'px-4 py-3';

  return (
    <div
      className={cn('overflow-auto rounded-lg border border-border', className)}
      {...attrs}
    >
      <table className="w-full text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="border-b border-border bg-secondary/50">
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={cn(
                  cellPadding,
                  'font-medium text-foreground-muted',
                  alignClasses[col.align || 'left'],
                  col.class,
                )}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className={cn(
                'border-b border-border last:border-b-0',
                'transition-colors',
                hoverable && 'hover:bg-secondary/30',
                striped && i % 2 === 1 && 'bg-secondary/20',
              )}
            >
              {columns.map((col) => {
                const value = row[col.key];
                const Tag = col.rowHeader ? 'th' : 'td';
                return (
                  <Tag
                    key={col.key}
                    scope={col.rowHeader ? 'row' : undefined}
                    className={cn(
                      cellPadding,
                      'text-foreground',
                      col.rowHeader && 'font-medium',
                      alignClasses[col.align || 'left'],
                      col.class,
                    )}
                  >
                    {isValidElement(value) ? value : String(value ?? '')}
                  </Tag>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Table;
