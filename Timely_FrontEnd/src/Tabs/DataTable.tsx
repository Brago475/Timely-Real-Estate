/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from "react";
import { flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, useReactTable } from "@tanstack/react-table";
import type { ColumnDef, HeaderGroup, Row, Cell } from "@tanstack/react-table";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { useTheme } from "../Views_Layouts/ThemeContext";

export interface DataTableProps<T extends object> { data: T[]; columns: ColumnDef<T, any>[]; filterPlaceholder?: string; }

export default function DataTable<T extends object>({ data, columns, filterPlaceholder = "Search…" }: DataTableProps<T>) {
    const { isDark } = useTheme();
    const [globalFilter, setGlobalFilter] = useState("");

    const n = {
        card: isDark ? "neu-dark" : "neu-light",
        flat: isDark ? "neu-dark-flat" : "neu-light-flat",
        text: isDark ? "text-white" : "text-gray-900",
        secondary: isDark ? "text-gray-300" : "text-gray-600",
        tertiary: isDark ? "text-gray-500" : "text-gray-400",
        label: isDark ? "text-blue-400" : "text-blue-600",
        divider: isDark ? "border-gray-800" : "border-gray-200",
        edgeHoverFlat: isDark
            ? "hover:shadow-[0_0_0_1px_rgba(59,130,246,0.2),4px_4px_10px_rgba(0,0,0,0.6),-4px_-4px_10px_rgba(40,40,40,0.1)]"
            : "hover:shadow-[0_0_0_1px_rgba(59,130,246,0.15),4px_4px_10px_rgba(0,0,0,0.08),-4px_-4px_10px_rgba(255,255,255,0.9)]",
    };

    const table = useReactTable({ data, columns, state: { globalFilter }, onGlobalFilterChange: setGlobalFilter, getCoreRowModel: getCoreRowModel(), getFilteredRowModel: getFilteredRowModel(), getPaginationRowModel: getPaginationRowModel() });

    return (
        <div className={`${n.card} p-1.5 space-y-1.5 w-full overflow-x-auto`}>
            {/* Search */}
            <div className={`${n.flat} flex items-center gap-2 px-4 py-2.5`}>
                <Search className={`w-4 h-4 ${n.tertiary}`} />
                <input className={`w-full bg-transparent ${n.text} text-sm focus:outline-none`} value={globalFilter} onChange={e => setGlobalFilter(e.target.value)} placeholder={filterPlaceholder} />
            </div>

            {/* Table */}
            <table className="w-full text-sm">
                <thead>
                    {table.getHeaderGroups().map((hg: HeaderGroup<T>) => (
                        <tr key={hg.id} className={`${n.flat}`}>
                            {hg.headers.map(header => (
                                <th key={header.id} className={`py-3 px-4 text-left text-[11px] uppercase tracking-wider font-medium ${n.label}`}>
                                    {flexRender(header.column.columnDef.header, header.getContext())}
                                </th>
                            ))}
                        </tr>
                    ))}
                </thead>
                <tbody className="space-y-0.5">
                    {table.getRowModel().rows.map((row: Row<T>) => (
                        <tr key={row.id} className={`${n.flat} ${n.edgeHoverFlat} transition-all duration-200 cursor-pointer`}>
                            {row.getVisibleCells().map((cell: Cell<T, unknown>) => (
                                <td key={cell.id} className={`py-3 px-4 ${n.text}`}>
                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Pagination */}
            <div className={`${n.flat} flex items-center justify-between px-4 py-2.5`}>
                <span className={`text-xs ${n.tertiary}`}>Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}</span>
                <div className="flex gap-1">
                    <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className={`p-1.5 rounded-lg disabled:opacity-30 ${n.secondary}`}><ChevronLeft className="w-4 h-4" /></button>
                    <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className={`p-1.5 rounded-lg disabled:opacity-30 ${n.secondary}`}><ChevronRight className="w-4 h-4" /></button>
                </div>
            </div>
        </div>
    );
}