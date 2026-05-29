import { cn } from "@/lib/utils";

/**
 * Successive-inspired chevron + dot mark.
 * Blue chevron with a yellow dot, matching the reference brand.
 */
export function BrandLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-full w-full", className)}
      aria-hidden="true"
    >
      <path
        d="M6 6 L18 16 L6 26"
        stroke="hsl(var(--brand-blue))"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="24" cy="22" r="3.5" fill="hsl(var(--brand-yellow))" />
    </svg>
  );
}

export default BrandLogo;