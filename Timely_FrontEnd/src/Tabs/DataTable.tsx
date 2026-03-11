/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState } from "react";

/* ─────────── @tanstack/react-table ─────────── */
import {
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    useReactTable,
} from "@tanstack/react-table";
import type {
    ColumnDef,
    HeaderGroup,
    Row,
    Cell,
} from "@tanstack/react-table";
import { FiSearch, FiChevronLeft, FiChevronRight } from "react-icons/fi";

export interface DataTableProps<T extends object> {
    data: T[];
    columns: ColumnDef<T, any>[];
    filterPlaceholder?: string;
}

export default function DataTable<T extends object>({
    data,
    columns,
    filterPlaceholder = "Search…",
}: DataTableProps<T>) {
    const [globalFilter, setGlobalFilter] = useState("");

    const table = useReactTable({
        data,
        columns,
        state: { globalFilter },
        onGlobalFilterChange: setGlobalFilter,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
    });

    return (
        <div className="bg-slate-900 text-slate-100 rounded-2xl shadow-lg p-4 w-full overflow-x-auto">
            {/* 🔍 Search */}
            <div className="flex items-center mb-4 gap-2">
                <FiSearch className="text-indigo-400" />
                <input
                    className="bg-slate-800 rounded px-3 py-1 w-full focus:outline-none"
                    value={globalFilter}
                    onChange={(e) => setGlobalFilter(e.target.value)}
                    placeholder={filterPlaceholder}
                />
            </div>

            {/* 🗂 Table */}
            <table className="w-full text-sm">
                <thead className="border-b border-slate-700 text-left">
                    {table.getHeaderGroups().map((headerGroup: HeaderGroup<T>) => (
                        <tr key={headerGroup.id}>
                            {headerGroup.headers.map((header) => (
                                <th
                                    key={header.id}
                                    className="py-2 pr-4 font-medium uppercase tracking-wider"
                                >
                                    {flexRender(
                                        header.column.columnDef.header,
                                        header.getContext()
                                    )}
                                </th>
                            ))}
                        </tr>
                    ))}
                </thead>
                <tbody>
                    {table.getRowModel().rows.map((row: Row<T>) => (
                        <tr
                            key={row.id}
                            className="border-b border-slate-800 hover:bg-slate-800/50 cursor-pointer"
                        >
                            {row.getVisibleCells().map((cell: Cell<T, unknown>) => (
                                <td key={cell.id} className="py-2 pr-4">
                                    {flexRender(
                                        cell.column.columnDef.cell,
                                        cell.getContext()
                                    )}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* 📄 Pagination */}
            <div className="flex items-center justify-between mt-4 text-xs">
                <span>
                    Page {table.getState().pagination.pageIndex + 1} of{" "}
                    {table.getPageCount()}
                </span>
                <div className="flex gap-2">
                    <button
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                        className="disabled:opacity-40"
                    >
                        <FiChevronLeft />
                    </button>
                    <button
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                        className="disabled:opacity-40"
                    >
                        <FiChevronRight />
                    </button>
                </div>
            </div>
        </div>
    );
}
