import { PropsWithChildren, useMemo } from "react";

import { CopyButton } from "@/components/CopyButton";

export interface CodeCopyBlockProps extends PropsWithChildren {
  text: string;
  className?: string;
  iconOnly?: boolean;
}

export function CodeCopyBlock({ text, className, iconOnly = true, children }: CodeCopyBlockProps) {
  const safeText = useMemo(() => text ?? "", [text]);

  return (
    <div className={className ?? "relative"}>
      <div className="absolute right-2 top-2 z-10">
        <CopyButton text={safeText} iconOnly={iconOnly} label="Copy" />
      </div>
      <div className="overflow-auto">{children}</div>
    </div>
  );
}

