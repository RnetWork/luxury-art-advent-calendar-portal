"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="btn-ghost">
      <Printer className="size-4" strokeWidth={1.5} /> Print or save PDF
    </button>
  );
}
