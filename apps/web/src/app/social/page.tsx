import { cn } from "@umamin/ui/lib/utils";
import { SocialCard } from "./components/card";
import { AnimatedShinyText } from "@umamin/ui/components/animated-shiny-text";

const data = [
  {
    imageUrl:
      "https://lh3.googleusercontent.com/a/ACg8ocK4CtuGuDZlPy9H_DMb3EQIue9Hrd5bqYcMZOY-Xb8LcuyqsBI=s96-c",
    username: "umamin",
    displayName: "Umamin Official",
    createdAt: 1718604131,
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
    createdAt: 1718342984,
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
    <main className="pt-36">
      <div className="flex flex-col items-center container">
        <div
          className={cn(
            "group rounded-full border border-black/5 bg-neutral-100 text-base text-white transition-all ease-in hover:bg-neutral-200 dark:border-white/5 dark:bg-neutral-900 dark:hover:bg-neutral-800"
          )}
        >
          <AnimatedShinyText className="inline-flex items-center justify-center px-4 py-1 transition ease-out hover:text-neutral-600 hover:duration-300 hover:dark:text-neutral-400">
            Coming Soon!
          </AnimatedShinyText>
        </div>

        <h1 className="font-extrabold md:text-7xl text-[10vw] leading-none bg-gradient-to-b from-foreground to-zinc-400 bg-clip-text text-transparent tracking-tighter text-center mt-6">
          Umamin Social
        </h1>
      </div>

      <section className="mt-12 pt-6 w-full max-w-lg mx-auto space-y-6 bg-background rounded-md border-t border-t-muted">
        {data.map((props) => (
          <SocialCard key={props.createdAt} {...props} />
        ))}
      </section>
    </main>
  );
}
