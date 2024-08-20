import PostForm from "../post/components/post-form";
import { PostCard } from "./post-card";

export const userPlaceholder = [
  {
    id: "C-r5lAwpJUg",
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
    id: "C-r5lAwpJUg",
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

export function Feed() {
  return (
    <main>
      <section className="pt-6 w-full max-w-xl mx-auto bg-background border-muted">
        <PostForm />

        <div className="border-y space-y-6 pt-6 bg-card sm:rounded-md sm:border-x">
          {userPlaceholder.map((props) => (
            <PostCard key={props.createdAt} {...props} />
          ))}
        </div>
      </section>
    </main>
  );
}
