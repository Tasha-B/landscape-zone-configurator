import type { ReactNode } from "react";

// The frame of the plans page, the editor and "not found": the showcase's
// width and side padding, with a page heading
export default function PageMain({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <main className="mx-auto max-w-content px-sm pb-lg pt-lg sm:px-md">
      <h1 className="font-display text-section text-forest-dark">{title}</h1>
      {children}
    </main>
  );
}
