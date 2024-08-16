import { PostCard, PostCardMain } from "../../components/post-card";

const postData = {
  id: "C-r5lAwpJUg",
  imageUrl:
    "https://lh3.googleusercontent.com/a/ACg8ocK4CtuGuDZlPy9H_DMb3EQIue9Hrd5bqYcMZOY-Xb8LcuyqsBI=s96-c",
  username: "umamin",
  displayName: "Umamin Official",
  createdAt: 1718604131,
  content:
    "An open-source social platform built exclusively for the Umamin community. Umamin v2.0 requires a new account that can be used across the platform.",
  isLiked: true,
  isVerified: true,
  likes: 24,
  comments: 9,
};

const repliesData = [
  {
    id: "C-r5lAwpJUg",
    imageUrl:
      "https://lh3.googleusercontent.com/a/ACg8ocKpLSOuzPnPwOYTFC88ENWUU_7ieMdwtQZ9UzkqCJaRbnpUELk=s96-c",
    username: "Dale",
    displayName: "Dale Hyamero",
    createdAt: 1718342984,
    content:
      "Next generation open-source platform for sending and receiving encrypted anonymous messages. Umamin v2.0 requires a new account that can be used across the platform.",
    isLiked: false,
    isVerified: false,
    likes: 10,
    comments: 6,
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
    username: "Dale",
    displayName: "Dale Hyamero",
    createdAt: 1718342984,
    content:
      "Next generation open-source platform for sending and receiving encrypted anonymous messages. Umamin v2.0 requires a new account that can be used across the platform.",
    isLiked: false,
    isVerified: false,
    likes: 10,
    comments: 6,
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

export default function Post() {
  return (
    <main>
      <section className="w-full max-w-lg mx-auto bg-background">
        <PostCardMain key={postData.createdAt} {...postData} />

        <div className="w-full container py-4 border-b mb-6 font-medium text-muted-foreground">
          Replies
        </div>

        <div className="space-y-6">
          {repliesData.map((reply) => {
            return <PostCard key={reply.createdAt} {...reply} />;
          })}
        </div>
      </section>
    </main>
  );
}
