import type { CSSProperties, ReactNode } from 'react'
import styles from './DataTable.module.css'

interface DataTableProps {
  variant?: 'gap' | 'border'
  className?: string
  children: ReactNode
}

export function DataTable({ variant = 'gap', className, children }: DataTableProps) {
  const variantClass = variant === 'gap' ? styles.tableGap : styles.tableBorder
  return (
    <div className={`${styles.table} ${variantClass}${className ? ` ${className}` : ''}`}>
      {children}
    </div>
  )
}

interface DataTableHeaderProps {
  bordered?: boolean
  className?: string
  style?: CSSProperties
  children: ReactNode
}

export function DataTableHeader({ bordered, className, style, children }: DataTableHeaderProps) {
  return (
    <div
      className={`${styles.headerRow}${bordered ? ` ${styles.headerRowBorder}` : ''}${className ? ` ${className}` : ''}`}
      style={style}
    >
      {children}
    </div>
  )
}

interface DataTableRowProps {
  bordered?: boolean
  className?: string
  style?: CSSProperties
  children: ReactNode
}

export function DataTableRow({ bordered, className, style, children }: DataTableRowProps) {
  return (
    <div
      className={`${styles.row}${bordered ? ` ${styles.rowBorder}` : ''}${className ? ` ${className}` : ''}`}
      style={style}
    >
      {children}
    </div>
  )
}
