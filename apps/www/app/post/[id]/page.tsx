import { notFound } from "next/navigation";
import { getPostAction } from "@/app/actions/post";
import { PostCardMain } from "@/app/feed/components/post-card-main";
import { getSession } from "@/lib/auth";
import { CommentsList } from "../components/comments-list";
import ReplyForm from "../components/reply-form";

export default async function Post({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user } = await getSession();
  const { id } = await params;

  const data = await getPostAction(id);

  if (!data) {
    notFound();
  }

  return (
    <main className="w-full sm:max-w-lg mx-auto bg-background pb-24">
      <PostCardMain data={data} />

      {user && (
        <div className="w-full py-4 border-b mb-6 font-medium text-muted-foreground px-7 sm:px-0">
          <ReplyForm user={user} postId={id} />
        </div>
      )}

      <div className="space-y-6">
        <CommentsList isAuthenticated={!!user} postId={id} />
        {/* <PostCardWithComments sessionImage={user?.imageUrl} /> */}
        {/* {repliesData.map((comment) => { */}
        {/*   return ( */}
        {/*     <PostCard */}
        {/*       key={comment.createdAt.toString()} */}
        {/*       {...comment} */}
        {/*       className="border-b" */}
        {/*     /> */}
        {/*   ); */}
        {/* })} */}
      </div>
    </main>
  );
}
