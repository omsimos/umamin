import { cn } from "@umamin/ui/lib/utils";
import { AnimatedShinyText } from "@/components/animated-shiny-text";
import { SocialCard } from "./components/social-card";

const data = [
  {
    imageUrl:
      "https://lh3.googleusercontent.com/a/ACg8ocK4CtuGuDZlPy9H_DMb3EQIue9Hrd5bqYcMZOY-Xb8LcuyqsBI=s96-c",
    username: "umamin",
    displayName: "Umamin Official",
    createdAt: new Date(1718604131 * 1000), // Fri Jun 17 2024 ...
    content:
      "An open-source social platform built exclusively for the Umamin community.",
    isLiked: true,
    isVerified: true,
    likes: 24,
    comments: 9,
  },
  {
    imageUrl:
      "https://lh3.googleusercontent.com/a/ACg8ocJf40m8VVe3wNxhgBe11Bm7ukLSPeR0SDPPg6q8wq6NYRZtCYk=s96-c",
    username: "josh",
    displayName: "Josh Daniel",
    createdAt: new Date(1718342984 * 1000), // Tue Jun 14 2024 ...
    content:
      "We're building Umamin Social, a new platform to connect the community. Coming soon! 🚀",
    isLiked: false,
    isVerified: false,
    likes: 7,
    comments: 4,
  },
];

export default function Social() {
  return (
    <main className="pb-24">
      <div className="flex flex-col items-center container">
        <div
          className={cn(
            "group rounded-full border border-black/5 bg-zinc-100 text-base text-white transition-all ease-in dark:border-white/5 dark:bg-zinc-900",
          )}
        >
          <AnimatedShinyText className="inline-flex items-center justify-center px-4 py-1 transition ease-out">
            Coming Soon!
          </AnimatedShinyText>
        </div>

        <h1 className="font-extrabold md:text-7xl text-[10vw] leading-none dark:bg-gradient-to-b from-foreground dark:to-zinc-400 bg-zinc-800 bg-clip-text text-transparent tracking-tighter text-center mt-6">
          Umamin Social
        </h1>
      </div>

      <section className="mt-12 pt-6 w-full max-w-lg mx-auto space-y-6 bg-background rounded-md border-t border-t-muted">
        {data.map((props) => (
          <SocialCard key={props.username} {...props} />
        ))}
      </section>
    </main>
  );
}
