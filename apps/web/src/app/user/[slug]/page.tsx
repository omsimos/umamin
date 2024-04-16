import UserProfile from "../components/user-profile";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}) {
  const slug = params.slug.startsWith("%40")
    ? params.slug.split("%40").at(1)
    : params.slug;
  const title = params.slug
    ? `(@${slug}) on Umamin`
    : // TODO: Check if user exists
      "User not found | Umamin";

  return {
    title: title,
  };
}

export default async function Page(
  {
    //   params,
  }: {
    //   params: { slug: string };
  }
) {
  return <UserProfile />;
}
