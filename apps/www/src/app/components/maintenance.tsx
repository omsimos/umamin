import { Badge } from "@umamin/ui/components/badge";

export function Maintenance() {
  return (
    <div className="flex flex-col space-y-6 items-center justify-center h-screen">
      <div className="space-x-2 flex items-center">
        <p>
          <span className="font-semibold text-foreground">umamin</span>
          <span className="text-muted-foreground font-medium">.link</span>
        </p>

        <Badge variant="outline">v2-beta</Badge>
      </div>

      <div className="text-center">
        <h1 className="text-3xl md:text-5xl font-bold">Under Maintenance</h1>
        <p className="text-muted-foreground mt-2">
          Sorry for the inconvenience, we&apos;re fixing things up.
        </p>
      </div>
    </div>
  );
}
