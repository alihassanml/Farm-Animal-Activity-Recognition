import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react'

/** Scrolls sideways inside its card on small screens; the page itself never does.
 *  `relative` keeps absolutely positioned children (sr-only labels) inside the scroll box. */
export function Table({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="relative w-full max-w-full overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm" aria-label={label}>
        {children}
      </table>
    </div>
  )
}

export function Th({ children, className = '', ...rest }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={`border-y border-line px-6 py-3 text-xs font-medium whitespace-nowrap text-muted ${className}`}
      {...rest}
    >
      {children}
    </th>
  )
}

export function Td({ children, className = '', ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={`border-b border-line px-6 py-3 align-middle text-ink ${className}`} {...rest}>
      {children}
    </td>
  )
}
