import { type LucideIcon, Loader2Icon } from "lucide-react";

type Props = {
  loading: boolean;
  icon?: LucideIcon;
};
export function LoadingIcon({ loading, icon }: Props) {
  const Icon = icon;
  return (
    <>
      {loading ? (
        <Loader2Icon className="animate-spin text-white" />
      ) : (
        Icon && <Icon />
      )}
    </>
  );
}
