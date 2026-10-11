import { initialsAvatar } from "@/lib/avatar";
import { cx } from "./ui";

/**
 * Plain <img>: GitHub avatars are already resized via the API (size=200) and
 * mock avatars are data URIs, so next/image would add nothing but config.
 */
export function Avatar({
  src,
  login,
  name,
  size,
  className,
}: {
  src: string | null;
  login: string;
  name: string | null;
  size: number;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src ?? initialsAvatar(login, name ?? login)}
      alt=""
      width={size}
      height={size}
      className={cx("shrink-0 rounded-full border border-line bg-sunken", className)}
    />
  );
}
