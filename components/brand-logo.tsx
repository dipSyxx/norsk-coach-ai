import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  href?: string;
  showText?: boolean;
  className?: string;
  imageClassName?: string;
  textClassName?: string;
  priority?: boolean;
};

export function BrandLogo({
  href = "/",
  showText = true,
  className,
  imageClassName = "h-12 w-12",
  textClassName,
  priority = false,
}: BrandLogoProps) {
  const content = (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        className={cn(
          "relative block shrink-0 overflow-hidden",
          imageClassName,
        )}
      >
        <Image
          src="/icon1.png"
          alt="NorskCoach logo"
          width={96}
          height={96}
          className="h-full w-full object-contain"
          priority={priority}
        />
      </span>
      {showText ? (
        <span
          className={cn(
            "font-display text-xl font-bold text-foreground",
            textClassName,
          )}
        >
          NorskCoach
        </span>
      ) : null}
    </span>
  );

  if (!href) {
    return content;
  }

  return <Link href={href}>{content}</Link>;
}
