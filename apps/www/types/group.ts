import type { SelectGroup } from "@umamin/db/schema/group";

// The badge payload that rides cached feed/profile responses next to author
// data — id only links to the group page; never internal columns.
export type GroupBadgeData = Pick<
  SelectGroup,
  "id" | "tag" | "icon" | "accent"
>;
