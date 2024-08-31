import ReplyForm from "../components/reply-form";
import { getSession } from "@umamin/shared/lib/auth";
import {
  PostCard,
  PostCardMain,
  PostCardWithComment,
} from "@/app/components/post-card";
import { userPlaceholder } from "@/app/components/feed";

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

export default async function Post() {
  const { user } = await getSession();

  return (
    <main className="w-full sm:max-w-lg mx-auto bg-background pb-24">
      <PostCardMain key={postData.createdAt} {...postData} />

      <div className="w-full py-4 border-b mb-6 font-medium text-muted-foreground px-7 sm:px-0">
        <ReplyForm user={user} />
      </div>

      <div className="space-y-6">
        {repliesData.map((reply) => {
          return (
            <PostCard key={reply.createdAt} {...reply} className="border-b" />
          );
        })}
        <PostCardWithComment
          {...userPlaceholder}
          sessionImage={user?.imageUrl}
        />
        {repliesData.map((reply) => {
          return (
            <PostCard key={reply.createdAt} {...reply} className="border-b" />
          );
        })}
      </div>
    </main>
  );
}
