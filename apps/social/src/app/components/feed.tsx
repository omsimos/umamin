import PostForm from "../post/components/post-form";
import { getSession } from "@umamin/shared/lib/auth";
import { PostCard, PostCardWithComment } from "./post-card";

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
  {
    id: "C-r5lAwpJUg",
    imageUrl:
      "https://lh3.googleusercontent.com/a/ACg8ocKpLSOuzPnPwOYTFC88ENWUU_7ieMdwtQZ9UzkqCJaRbnpUELk=s96-c",
    username: "dale",
    displayName: "Dale Hyamero",
    createdAt: 1718342984,
    content:
      "Next generation open-source platform for sending and receiving encrypted anonymous messages. Umamin v2.0 requires a new account that can be used across the platform.",
    isLiked: false,
    isVerified: true,
    likes: 10,
    comments: 6,
  },
];

export async function Feed() {
  const { user } = await getSession();

  return (
    <main className="pb-40">
      <section className="pt-6 w-full max-w-xl mx-auto bg-background border-muted">
        <PostForm />

        <div className="border-y space-y-6 pt-6 bg-muted/20 sm:rounded-md sm:border-x">
          {userPlaceholder.map((props) => (
            <PostCard key={props.createdAt} {...props} className="border-b" />
          ))}
          <PostCardWithComment
            {...userPlaceholder}
            sessionImage={user?.imageUrl}
          />
          <PostCard {...userPlaceholder[2]!} />
        </div>
      </section>
    </main>
  );
}
