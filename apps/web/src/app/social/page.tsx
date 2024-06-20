import { SocialCard } from "./components/card";

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
        <p className="rounded-full bg-gradient-to-b from-zinc-800 to-zinc-900 text-sm px-4 py-2 text-muted-foreground">
          Coming Soon!
        </p>

        <h1 className="font-extrabold md:text-7xl text-[10vw] leading-none bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-transparent tracking-tighter text-center mt-6">
          Umamin Social
        </h1>
      </div>

      <section className="mt-12 border-t border-t-muted pt-6 w-full max-w-lg mx-auto space-y-6">
        {data.map((props) => (
          <SocialCard key={props.createdAt} {...props} />
        ))}
      </section>
    </main>
  );
}
