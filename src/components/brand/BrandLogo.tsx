import logo from "@/assets/peoplepulse-logo.png";
import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg" | "xl";

const SIZE_MAP: Record<Size, string> = {
  sm: "h-8",
  md: "h-12",
  lg: "h-16",
  xl: "h-24",
};

interface BrandLogoProps {
  size?: Size;
  className?: string;
  /** When true, removes the white card chrome (useful if already on white). */
  bare?: boolean;
}

/**
 * People Pulse brand logo. The source PNG has a hard white background,
 * so we always render it inside a white container with rounded corners.
 */
export function BrandLogo({ size = "md", className, bare = false }: BrandLogoProps) {
  return (
    <div
      className={cn(
        bare ? "" : "inline-flex items-center justify-center rounded-xl bg-white p-2 shadow-sm",
        className,
      )}
    >
      <img
        src={logo}
        alt="People Pulse — Bem-estar e Saúde Mental no Trabalho"
        className={cn(SIZE_MAP[size], "w-auto object-contain select-none")}
        draggable={false}
      />
    </div>
  );
}

export default BrandLogo;