import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Home() {
  return (
    <div>
      <h1>Hello World</h1>
      <Button asChild>
        <Link href="about">Click Me</Link>
      </Button>
    </div>
  );
}
